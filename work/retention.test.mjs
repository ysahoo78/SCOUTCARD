import test from 'node:test';
import assert from 'node:assert/strict';
import { previewReconciliation, handleRetentionPreview } from '../api/cron/order-retention.js';

const orders = [{ id: 'order-a' }, { id: 'order-b' }];

test('paid, open, missing, or incomplete Stripe results always require review', () => {
  assert.deepEqual(previewReconciliation(orders, [
    { client_reference_id: 'order-a', payment_status: 'paid', status: 'complete' }
  ], true), { reviewed: 2, review: 2, notPaid: 0 });
  assert.deepEqual(previewReconciliation(orders, [
    { client_reference_id: 'order-a', payment_status: 'unpaid', status: 'expired' },
    { client_reference_id: 'order-b', payment_status: 'unpaid', status: 'open' }
  ], true), { reviewed: 2, review: 1, notPaid: 1 });
  assert.deepEqual(previewReconciliation(orders, [
    { client_reference_id: 'order-a', payment_status: 'unpaid', status: 'expired' },
    { client_reference_id: 'order-b', payment_status: 'unpaid', status: 'expired' }
  ], false), { reviewed: 2, review: 2, notPaid: 0 });
});

test('processing, unknown, recovery, and attached-payment sessions require review', () => {
  for (const session of [
    {status:'complete', payment_status:'unpaid'},
    {status:'expired', payment_status:'no_payment_required'},
    {status:'expired'},
    {status:'expired', payment_status:'unpaid', payment_intent:'pi_processing'},
    {status:'expired', payment_status:'unpaid', after_expiration:{recovery:{enabled:true}}}
  ]) {
    assert.equal(previewReconciliation([{id:'order-a'}], [{client_reference_id:'order-a', ...session}], true).review, 1);
  }
});

test('a second uncertain checkout blocks an otherwise expired checkout', () => {
  assert.equal(previewReconciliation([{id:'order-a'}], [
    {client_reference_id:'order-a', status:'expired', payment_status:'unpaid'},
    {client_reference_id:'order-a', status:'complete', payment_status:'paid'}
  ], true).notPaid, 0);
});

const env = {CRON_SECRET:'test-only-secret', RETENTION_MODE:'preview', SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'test-only-key', STRIPE_RECONCILIATION_KEY:'rk_test_fixture', STRIPE_PAYMENT_LINK_ID:'plink_fixture'};
const request = () => new Request('https://example.com/api/cron/order-retention', {headers:{authorization:'Bearer test-only-secret'}});
const candidate = {id:'order-a', created_at:'2026-01-01T00:00:00Z'};

test('a paid session on the next page prevents an unpaid classification', async () => {
  let calls = 0;
  const response = await handleRetentionPreview(request(), env, async () => Response.json([candidate]), {
    checkout:{sessions:{list:async params => {
      calls += 1;
      if (calls === 1) return {data:[{id:'cs_old',client_reference_id:'order-a',status:'expired',payment_status:'unpaid'}],has_more:true};
      assert.equal(params.starting_after, 'cs_old');
      return {data:[{id:'cs_paid',client_reference_id:'order-a',status:'complete',payment_status:'paid'}],has_more:false};
    }}}
  });
  assert.equal(calls, 2);
  assert.deepEqual(await response.json(), {mode:'preview',reviewed:1,review:1,notPaid:0});
});

test('scan limit never treats a partial result as complete', async () => {
  let calls = 0;
  const response = await handleRetentionPreview(request(), env, async () => Response.json([candidate]), {
    checkout:{sessions:{list:async () => ({data:[{id:'cs_'+(++calls),client_reference_id:'order-a',status:'expired',payment_status:'unpaid'}],has_more:true})}}
  });
  assert.equal(calls, 3);
  assert.equal((await response.json()).notPaid, 0);
});

test('missing or incorrect secret cannot reach either provider', async () => {
  const forbidden = () => { throw new Error('provider must not be called'); };
  assert.equal((await handleRetentionPreview(new Request('https://example.com', {headers:{authorization:'Bearer '}}), {...env, CRON_SECRET:''}, forbidden)).status, 401);
  assert.equal((await handleRetentionPreview(request(), {...env, CRON_SECRET:'different'}, forbidden)).status, 401);
});

test('preview is read-only, uses aggregate output, and queries oldest candidates', async () => {
  const response = await handleRetentionPreview(request(), env, async (url, options) => {
    assert.equal(options.method, undefined);
    assert.equal(url.searchParams.get('order'), 'created_at.asc,id.asc');
    assert.equal(url.searchParams.get('select'), 'id,created_at,status,stripe_session_id');
    return Response.json([candidate]);
  }, {checkout:{sessions:{list:async () => ({data:[{client_reference_id:'order-a', status:'expired', payment_status:'unpaid'}], has_more:false})}}});
  assert.deepEqual(await response.json(), {mode:'preview', reviewed:1, review:0, notPaid:1});
});

test('provider errors and malformed responses fail closed', async () => {
  for (const result of [{data:[], has_more:undefined}, {data:null, has_more:false}]) {
    const response = await handleRetentionPreview(request(), env, async () => Response.json([candidate]),
      {checkout:{sessions:{list:async () => result}}});
    assert.equal(response.status, 502);
  }
  const failed = await handleRetentionPreview(request(), env, async () => Response.json([candidate]),
    {checkout:{sessions:{list:async () => {throw new Error('provider unavailable');}}}});
  assert.equal(failed.status, 502);
  const malformed = await handleRetentionPreview(request(), env, async () => Response.json([{id:'order-a',created_at:'invalid'}]));
  assert.equal(malformed.status, 502);
});
