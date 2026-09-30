import test from 'node:test';
import assert from 'node:assert/strict';
import { previewReconciliation } from '../api/cron/order-retention.js';

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
