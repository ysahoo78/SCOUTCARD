import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handlePurchaseStatus} from '../api/purchase-status.js';
import {readPurchaseStatus} from '../purchase-status.js';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-fixture-only'};
const authUser={id:'owner-fixture',email:'Buyer+Team@Example.test',email_confirmed_at:'2026-10-25T00:00:00Z'};
const request=(url='https://example.test/api/purchase-status',token='synthetic-access-token-fixture')=>new Request(url,{headers:{Authorization:'Bearer '+token}});
test('confirmed order check uses only Auth-verified email and returns no private order data',async()=>{
 const calls=[];
 const response=await handlePurchaseStatus(request(),env,async(url,options)=>{calls.push([new URL(url),options]);return Response.json(calls.length===1?authUser:[{id:'private-order-id'}]);});
 assert.deepEqual(await response.json(),{purchased:true});assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(calls[0][0].pathname,'/auth/v1/user');assert.equal(calls[0][1].headers.Authorization,'Bearer synthetic-access-token-fixture');
 assert.equal(calls[1][0].searchParams.get('email'),'eq.buyer+team@example.test');assert.equal(calls[1][0].searchParams.get('select'),'id');
 assert.equal(calls[1][0].searchParams.get('status'),'in.(paid,shipped,fulfilled)');assert.equal(calls[1][0].searchParams.get('paid_at'),'not.is.null');assert.equal(calls[1][0].searchParams.get('limit'),'1');
 assert.equal(calls[1][1].headers.Authorization,'Bearer server-fixture-only');assert.equal(calls[1][1].cache,'no-store');assert.ok(calls[1][1].signal);
});
test('no confirmed order is a hint, not an invented paid status',async()=>{let n=0;const r=await handlePurchaseStatus(request(),env,async()=>Response.json(++n===1?authUser:[]));assert.deepEqual(await r.json(),{purchased:false});});
test('unauthenticated, unsupported methods and missing config fail closed',async()=>{
 const fail=()=>assert.fail('No upstream read expected');
 assert.equal((await handlePurchaseStatus(new Request('https://example.test'),env,fail)).status,401);
 assert.equal((await handlePurchaseStatus(new Request('https://example.test',{method:'POST'}),env,fail)).status,405);
 assert.equal((await handlePurchaseStatus(request(),{},fail)).status,503);
 assert.equal((await handlePurchaseStatus(request('https://example.test?email=another@example.test'),env,fail)).status,400);
});
test('invalid or expired token never reads orders',async()=>{let calls=0;const r=await handlePurchaseStatus(request(),env,async()=>{calls++;return new Response('',{status:401});});assert.equal(r.status,401);assert.equal(calls,1);});
test('unconfirmed and anonymous accounts cannot check order status',async()=>{for(const fields of [{email_confirmed_at:null},{is_anonymous:true}]){let calls=0;const r=await handlePurchaseStatus(request(),env,async()=>{calls++;return Response.json({...authUser,...fields});});assert.equal(r.status,401);assert.equal(calls,1);}});
test('backend failures, malformed results and timeouts never claim paid or no purchase',async()=>{
 for(const second of [()=>new Response('',{status:500}),()=>Response.json({paid:true}),()=>Response.json([{}]),()=>{throw Error('timed out');}]){
  let n=0;const r=await handlePurchaseStatus(request(),env,async()=>++n===1?Response.json(authUser):second());assert.equal(r.status,503);assert.equal((await r.json()).purchased,undefined);
 }
});
const db=(token='synthetic-token')=>({auth:{getSession:async()=>({data:{session:{user:{id:'own-user'},access_token:token}}})}});
test('client checks its session and makes one same-origin no-store request',async()=>{
 let calls=0;assert.equal(await readPurchaseStatus(db(),{id:'own-user'},async(url,options)=>{calls++;assert.equal(url,'/api/purchase-status');assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,'Bearer synthetic-token');return Response.json({purchased:true});}),true);assert.equal(calls,1);
 assert.equal(await readPurchaseStatus(db(),{id:'different-user'},()=>assert.fail('Mismatched account must not request')),null);
});
test('client failures and unexpected response stay unknown',async()=>{
 for(const fetcher of [async()=>{throw Error('timeout');},async()=>new Response('',{status:503}),async()=>Response.json({purchased:'yes'})])assert.equal(await readPurchaseStatus(db(),{id:'own-user'},fetcher),null);
});
