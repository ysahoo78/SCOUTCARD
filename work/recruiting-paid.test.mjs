import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleRecruitingEmail} from '../api/recruiting-email.js';
import {requestRecruitingEmail} from '../recruiting-email-source.js';
import {readFile} from 'node:fs/promises';
const owner='00000000-1111-4222-8333-000000000001',child='00000000-1111-4222-8333-000000000002';
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-fixture-only'};
const token='synthetic-user-token-fixture';
const user={id:owner,email:'Buyer+Test@Example.test',email_confirmed_at:'2026-10-27T00:00:00Z'};
const draft=()=>({profile_id:owner,owner_id:owner,parent_managed:false,version:3,eligibility:{band:'teen',permission:true},payload:{display_name:'Synthetic Athlete',sport:'Soccer',details:{stats:'12 goals',email:'PRIVATE_EMAIL'}}});
const input=()=>({profileId:owner,version:3,options:{coach:'Coach Test',program:'Example College',why:'I am interested in the academic program.',purpose:'introduction',include:['basics','stats','profile'],childConfirmed:false}});
function request(data=input(),headers={}) {return new Request('https://example.test/api/recruiting-email',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...headers},body:JSON.stringify(data)});}
function fixture(settings={}) {
 const calls=[];
 const send=async(value,options)=>{
  const url=new URL(value);calls.push({url,options});
  if(settings.fail===url.pathname)throw Error('Synthetic timeout');
  if(url.pathname==='/auth/v1/user')return settings.authStatus?new Response('',{status:settings.authStatus}):Response.json({...user,...settings.user});
  if(url.pathname==='/rest/v1/card_orders') {
   const orders=settings.orders??[{id:'settled-order',email:'buyer+test@example.test',status:'paid',paid_at:'2026-10-27'}];
   // Apply the real REST filters, including status and settlement time.
   return Response.json(orders.filter(row=>'eq.'+row.email===url.searchParams.get('email')&&['paid','shipped','fulfilled'].includes(row.status)&&row.paid_at).slice(0,1).map(({id})=>({id})));
  }
  if(url.pathname==='/rest/v1/athlete_profile_drafts')return Response.json(settings.draft===null?[]:[settings.draft??draft()]);
  if(url.pathname==='/rest/v1/athlete_profiles')return Response.json(settings.published===undefined?[{id:owner,slug:'synthetic-athlete',is_public:true}]:settings.published===null?[]:[settings.published]);
  assert.fail('Unexpected upstream route');
 };
 return {send,calls};
}
test('paid confirmed user generates from server-owned data, with no-store and RLS',async()=>{
 const {send,calls}=fixture(),response=await handleRecruitingEmail(request(),env,send),body=await response.json();
 assert.equal(response.status,200);assert.match(body.body,/Synthetic Athlete|12 goals/);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_EMAIL|server-fixture|paid_at|owner_id/);
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Authorization');
 assert.equal(calls.length,4);const orders=calls[1];assert.equal(orders.url.searchParams.get('email'),'eq.buyer+test@example.test');assert.equal(orders.options.headers.Authorization,'Bearer server-fixture-only');
 const source=calls[2];assert.equal(source.url.searchParams.get('owner_id'),'eq.'+owner);assert.equal(source.url.searchParams.get('profile_id'),'eq.'+owner);assert.equal(source.options.headers.Authorization,'Bearer '+token);
 assert.equal(calls[3].url.searchParams.get('select'),'id,slug,is_public');assert.ok(calls.every(call=>call.options.cache==='no-store'&&call.options.signal));
});
test('unpaid direct API requests are denied before reading any athlete data',async()=>{
 const {send,calls}=fixture({orders:[]}),r=await handleRecruitingEmail(request(),env,send),data=await r.json();assert.equal(r.status,403);assert.equal(data.code,'payment_required');assert.equal(calls.length,2);assert.equal(data.body,undefined);
});
test('pending, failed, canceled, refunded and unsettled orders never unlock generation',async()=>{
 for(const [status,paid_at] of [['payment_pending','x'],['payment_failed','x'],['canceled','x'],['refunded','x'],['paid',null]]){
  const {send}=fixture({orders:[{id:'order',email:'buyer+test@example.test',status,paid_at}]});assert.equal((await handleRecruitingEmail(request(),env,send)).status,403);
 }
});
test('paid, shipped and fulfilled settled orders unlock, including administrator-recorded cash orders',async()=>{
 for(const status of ['paid','shipped','fulfilled']){const {send}=fixture({orders:[{id:'cash-order',email:'buyer+test@example.test',status,paid_at:'2026-10-27'}]});assert.equal((await handleRecruitingEmail(request(),env,send)).status,200);}
});
test('someone else’s email or local purchased flag cannot grant access',async()=>{
 const {send,calls}=fixture({orders:[{id:'other',email:'other@example.test',status:'paid',paid_at:'x'}]});
 const r=await handleRecruitingEmail(request({...input(),purchased:true,email:'other@example.test'}),env,send);assert.equal(r.status,403);assert.equal(calls.length,2);
});
test('expired, absent, unconfirmed and anonymous sessions never read orders',async()=>{
 for(const settings of [{authStatus:401},{user:{email_confirmed_at:null}},{user:{is_anonymous:true}}]){const {send,calls}=fixture(settings);assert.equal((await handleRecruitingEmail(request(),env,send)).status,401);assert.equal(calls.length,1);}
 const {send,calls}=fixture();assert.equal((await handleRecruitingEmail(request(input(),{Authorization:''}),env,send)).status,401);assert.equal(calls.length,0);
});
test('payment and source errors fail closed, never generate fallback email',async()=>{
 for(const fail of ['/auth/v1/user','/rest/v1/card_orders','/rest/v1/athlete_profile_drafts','/rest/v1/athlete_profiles']){const {send}=fixture({fail}),r=await handleRecruitingEmail(request(),env,send);assert.equal(r.status,503);assert.equal((await r.json()).body,undefined);}
});
test('paid users cannot inject profile data, owner, public links or paid flags',async()=>{
 for(const addition of [{payload:{display_name:'Invented'}},{ownerId:child},{published:{is_public:true}},{purchased:true}]){const {send,calls}=fixture();assert.equal((await handleRecruitingEmail(request({...input(),...addition}),env,send)).status,400);assert.equal(calls.length,2);}
});
test('paid user cannot generate for another owner or unrelated sibling',async()=>{
 for(const data of [null,{...draft(),owner_id:child},{...draft(),profile_id:child}]){const {send}=fixture({draft:data});assert.equal((await handleRecruitingEmail(request(),env,send)).status,403);}
});
test('stale saved versions return conflict without replacing output',async()=>{const {send}=fixture({draft:{...draft(),version:4}});assert.equal((await handleRecruitingEmail(request(),env,send)).status,409);});
test('parent source requires adult guardian permission and selected-child confirmation',async()=>{
 const data={...draft(),profile_id:child,parent_managed:true,eligibility:{band:'adult',parent_ack:true}};
 const body={...input(),profileId:child,options:{...input().options,childConfirmed:true}};
 const {send}=fixture({draft:data,published:null}),r=await handleRecruitingEmail(request(body),env,send);assert.equal(r.status,200);assert.match((await r.json()).body,/parent or guardian of Synthetic Athlete/);
 for(const eligibility of [{band:'teen',parent_ack:true},{band:'adult',parent_ack:false}]){const {send}=fixture({draft:{...data,eligibility}});assert.equal((await handleRecruitingEmail(request(body),env,send)).status,403);}
 const absent=fixture({draft:data,published:null});assert.equal((await handleRecruitingEmail(request({...body,options:{...body.options,childConfirmed:false}}),env,absent.send)).status,400);
});
test('individual eligibility is checked independently of payment',async()=>{
 for(const eligibility of [{band:'under13'},{band:'teen',permission:false},{}]){const {send}=fixture({draft:{...draft(),eligibility}});assert.equal((await handleRecruitingEmail(request(),env,send)).status,403);}
});
test('private/unpublished profiles never get public links',async()=>{
 for(const published of [null,{id:owner,slug:'synthetic-athlete',is_public:false}]){const {send}=fixture({published}),r=await handleRecruitingEmail(request(),env,send);assert.equal(r.status,200);assert.doesNotMatch((await r.json()).body,/profile.html/);}
});
test('invalid, oversized and long personalization inputs are safely rejected',async()=>{
 for(const bad of [{...input(),profileId:'not-a-uuid'},{...input(),version:0},{...input(),options:{...input().options,why:'x'.repeat(651)}},{...input(),options:{...input().options,body:'inject'}}]){const {send}=fixture();assert.equal((await handleRecruitingEmail(request(bad),env,send)).status,400);}
 const {send}=fixture();assert.equal((await handleRecruitingEmail(request({...input(),padding:'x'.repeat(9000)}),env,send)).status,413);
 const malformed=new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{'});assert.equal((await handleRecruitingEmail(malformed,env,send)).status,400);
});
test('unsupported methods, query overrides and non-JSON are rejected without upstream calls',async()=>{
 const send=()=>assert.fail('No request expected');assert.equal((await handleRecruitingEmail(new Request('https://example.test'),env,send)).status,405);
 assert.equal((await handleRecruitingEmail(new Request('https://example.test?email=x',{method:'POST'}),env,send)).status,400);
 assert.equal((await handleRecruitingEmail(request(input(),{'Content-Type':'text/plain'}),env,send)).status,415);
});
test('client sends no profile contents, paid claim, subject or body and uses its session token',async()=>{
 const db={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:token}}})}};
 await requestRecruitingEmail(db,{ownerId:owner,profileId:owner,version:3,payload:{private:'DO_NOT_SEND'}},{...input().options,body:'DO_NOT_SEND'},async(url,options)=>{
  assert.equal(url,'/api/recruiting-email');assert.equal(options.headers.Authorization,'Bearer '+token);assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.ok(options.signal);
  assert.deepEqual(JSON.parse(options.body),input());assert.doesNotMatch(options.body,/DO_NOT_SEND/);return Response.json({subject:'Test',body:'Test email'});
 });
});
test('client rejects account switches, failed requests and payment revocation',async()=>{
 const snapshot={ownerId:owner,profileId:owner,version:3};const db={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:token}}})}};
 const other={auth:{getSession:async()=>({data:{session:{user:{id:child},access_token:token}}})}};
 await assert.rejects(()=>requestRecruitingEmail(other,snapshot,{},()=>assert.fail('Do not send')),/Sign in again/);
 await assert.rejects(()=>requestRecruitingEmail(db,snapshot,{},async()=>{throw Error('timeout');}),/timeout/);
 await assert.rejects(()=>requestRecruitingEmail(db,snapshot,{},async()=>Response.json({code:'payment_required',message:'Payment required'},{status:403})),e=>e.code==='payment_required');
});
test('public browser modules contain no callable generation template',async()=>{
 const core=await readFile(new URL('../recruiting-email.js',import.meta.url),'utf8');const builder=await readFile(new URL('../recruiting-email-builder.js',import.meta.url),'utf8');
 assert.doesNotMatch(core,/export function generateRecruitingEmail/);assert.doesNotMatch(builder,/generateRecruitingEmail\(/);assert.match(builder,/requestRecruitingEmail\(/);
});
