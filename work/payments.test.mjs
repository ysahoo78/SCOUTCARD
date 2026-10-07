import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { handleWebhook } from '../api/stripe-webhook.js';
const env = { STRIPE_WEBHOOK_SECRET:'whsec_local_fixture_only', SUPABASE_SERVICE_ROLE_KEY:'local-fixture', SUPABASE_URL:'https://example.supabase.co', STRIPE_PAYMENT_LINK_ID:'plink_fixture', STRIPE_LIVEMODE:'false', STRIPE_EXPECTED_AMOUNT:'500', STRIPE_EXPECTED_CURRENCY:'usd' };
const base = () => ({id:'evt_fixture',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_fixture',livemode:false,payment_link:'plink_fixture',mode:'payment',payment_status:'paid',client_reference_id:'11111111-1111-4111-8111-111111111111',amount_total:500,currency:'usd',payment_intent:'pi_fixture',customer_details:{email:'buyer@example.com'},collected_information:{shipping_details:{name:'Buyer Example',address:{line1:'123 Example St',city:'Richmond',state:'VA',postal_code:'23220',country:'US'}}}}}});
function request(event, timestamp, secret=env.STRIPE_WEBHOOK_SECRET) {
 const payload=JSON.stringify(event);
 const header=Stripe.webhooks.generateTestHeaderString({payload,secret,...(timestamp?{timestamp}:{})});
 return new Request('https://example.com/api/stripe-webhook',{method:'POST',body:payload,headers:{'stripe-signature':header}});
}
test('paid checkout saves exact order reference',async()=>{
 let body;
 const res=await handleWebhook(request(base()),env,async(url,opts)=>{body=JSON.parse(opts.body);return Response.json('paid');});
 assert.equal(res.status,200);assert.equal(body.p_paid,true);assert.equal(body.p_order_id,base().data.object.client_reference_id);
 assert.equal(body.p_shipping_name,'Buyer Example');
 assert.equal(body.p_shipping_address,'123 Example St, Richmond, VA, 23220, US');
 assert.equal(body.p_checkout_email,'buyer@example.com');
});
test('legacy Stripe event shape still supplies shipping details',async()=>{
 const event=base(),session=event.data.object;
 session.shipping_details=session.collected_information.shipping_details;
 delete session.collected_information;
 let body;
 const res=await handleWebhook(request(event),env,async(url,opts)=>{body=JSON.parse(opts.body);return Response.json('paid');});
 assert.equal(res.status,200);assert.equal(body.p_shipping_name,'Buyer Example');
});
test('missing shipping details never invents an address',async()=>{
 const event=base();delete event.data.object.collected_information;
 let body;
 const res=await handleWebhook(request(event),env,async(url,opts)=>{body=JSON.parse(opts.body);return new Response('',{status:500});});
 assert.equal(body.p_shipping_name,null);assert.equal(body.p_shipping_address,null);
 assert.equal(res.status,500);
});
test('async success and failure are recorded correctly',async()=>{
 for(const [type,paid] of [['checkout.session.async_payment_succeeded',true],['checkout.session.async_payment_failed',false]]) {
  const e=base();e.type=type;e.data.object.payment_status=paid?'paid':'unpaid';let calls=0;
  const r=await handleWebhook(request(e),env,async(u,o)=>{calls++;assert.equal(JSON.parse(o.body).p_paid,paid);return Response.json('ok');});
  assert.equal(r.status,200);assert.equal(calls,1);
 }
});
test('unpaid, wrong link, wrong mode, unrelated events never write',async()=>{
 const variants=[e=>e.data.object.payment_status='unpaid',e=>e.data.object.payment_link='plink_other',e=>e.livemode=true,e=>e.type='customer.created',e=>e.data.object.mode='subscription',e=>e.data.object.client_reference_id=null];
 for(const mutate of variants){const e=base();mutate(e);let calls=0;const r=await handleWebhook(request(e),env,async()=>{calls++;});assert.equal(r.status,200);assert.equal(calls,0);}
});
test('incorrect currency or amount requires review without write',async()=>{
 for(const [key,value] of [['amount_total',100],['currency','eur']]){const e=base();e.data.object[key]=value;const r=await handleWebhook(request(e),env,()=>assert.fail('Must not write'));assert.equal(r.status,422);}
});
test('invalid or stale signature rejected',async()=>{
 for(const req of [request(base(),1),request(base(),undefined,'wrong-secret'),new Request('https://example.com',{method:'POST',body:'{}'})]) assert.equal((await handleWebhook(req,env,()=>assert.fail('Must not write'))).status,400);
});
test('database errors request Stripe retry',async()=>{
 assert.equal((await handleWebhook(request(base()),env,async()=>new Response('',{status:500}))).status,500);
});
test('configuration and method fail closed',async()=>{
 assert.equal((await handleWebhook(request(base()),{})).status,503);
 assert.equal((await handleWebhook(new Request('https://example.com'),env)).status,405);
});
