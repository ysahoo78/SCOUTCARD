import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBoundedBody, createBoundedFetch } from '../request-safety.js';
import { friendlyError } from '../scoutcard-utils.js';
import { health } from '../api/health.js';

test('body reader preserves exact signature bytes', async () => {
  const payload = ' {"name":"é"}\n';
  assert.equal(new TextDecoder().decode(await readBoundedBody(new Response(payload))), payload);
});
test('oversized declared and chunked bodies rejected', async () => {
  for (const response of [new Response('abc', {headers:{'content-length':'100'}}), new Response('abcdefgh')]) {
    await assert.rejects(readBoundedBody(response, {maxBytes:4}), e => e.status===413);
  }
});
test('stalled body terminates and cancels stream', async () => {
  let cancelled=false;
  const body=new ReadableStream({start(){},cancel(){cancelled=true;}});
  await assert.rejects(readBoundedBody(new Response(body),{timeoutMs:10}), e=>e.status===408);
  assert.equal(cancelled,true);
});
test('transport deadline aborts and never retries writes', async () => {
  let calls=0, signal;
  const send=createBoundedFetch(async (_input,options)=>{calls++;signal=options.signal;return new Promise(()=>{});},10);
  await assert.rejects(send('https://example.test',{method:'POST'}),/timed out/);
  assert.equal(calls,1);assert.equal(signal.aborted,true);
});
test('non-success responses preserve status and retry header', async () => {
  const send=createBoundedFetch(async()=>new Response('{"error":"busy"}',{status:429,headers:{'retry-after':'60'}}));
  const response=await send('https://example.test');
  assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
  assert.deepEqual(await response.json(),{error:'busy'});
});
test('100 simultaneous local mocked requests stay isolated',async()=>{
  let calls=0;
  const send=createBoundedFetch(async input=>{calls++;return Response.json({id:input});});
  const results=await Promise.all(Array.from({length:100},(_,i)=>send(String(i)).then(r=>r.json())));
  assert.equal(calls,100);assert.equal(new Set(results.map(r=>r.id)).size,100);
});
test('empty HTTP response is supported',async()=>{
  const response=await createBoundedFetch(async()=>new Response(null,{status:204}))('https://example.test');
  assert.equal(response.status,204);assert.equal(await response.text(),'');
});
test('rate and timeout messages do not tell customers to pay again',()=>{
  assert.match(friendlyError({status:429}),/wait/i);
  assert.match(friendlyError(new Error('Request timed out')),/may have completed/);
});
test('health endpoint is read-only and does not disclose settings',async()=>{
  const response=health(new Request('https://example.test/api/health'));
  assert.deepEqual(await response.json(),{status:'ok',service:'scoutcard'});
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(health(new Request('https://example.test/api/health',{method:'POST'})).status,405);
});
