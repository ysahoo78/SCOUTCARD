const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:4173';
const userId = '00000000-1111-4222-8333-000000000001';
const mock = `
let callback, notifying = false;
const user = {id:'00000000-1111-4222-8333-000000000001',email:'athlete@example.com'};
const state = window.testState = {signedIn:sessionStorage.getItem('signed-in')==='yes',profile:window.fixture||null,failSave:false,failOrder:false,calls:[],cards:[],messages:[],sessionCalls:0};
const result=(data,error=null)=>({data,error});
const emit=()=>{notifying=true;callback('SIGNED_IN',state.signedIn?{user}:null);notifying=false;};
window.testSignIn=()=>{state.signedIn=true;sessionStorage.setItem('signed-in','yes');emit();};
class Query {
 constructor(table){this.table=table;this.filters=[];this.value=null;}
 select(){return this;} eq(k,v){this.filters.push([k,v]);return this;} order(){return this;} limit(){return this;}
 upsert(v){this.value=v;return this;} maybeSingle(){return this;}
 then(resolve,reject){return Promise.resolve().then(()=>{
  if(notifying)throw Error('Nested auth operation');
  if(this.table==='athlete_profiles'){
   if(this.value){state.calls.push(['save',this.value]);if(state.failSave)return result(null,{message:'Save rejected'});state.profile=this.value;return result(null);}
   let data=state.profile;if(data&&this.filters.some(([k,v])=>data[k]!==v))data=null;return result(data);
  }
  if(this.table==='coach_messages')return result(state.messages);
  if(this.table==='athlete_cards')return result(state.cards);
  return result(null);
 }).then(resolve,reject);}
}
export function createClient(){
 state.clients=(state.clients||0)+1;
 return {auth:{
  onAuthStateChange(fn){callback=fn;emit();return {data:{subscription:{unsubscribe(){}}}};},
  async getSession(){state.sessionCalls++;if(notifying)throw Error('Auth callback deadlock');return result({session:state.signedIn?{user}:null});},
  async signInWithOtp(args){state.calls.push(['email',args]);return result(null);},
  async signOut(){state.signedIn=false;sessionStorage.removeItem('signed-in');emit();return result(null);}
 },from(table){return new Query(table);},async rpc(name,args){
  state.calls.push([name,args]);
  if(name==='reserve_scoutcard_order_email_only')return state.failOrder?result(null,{message:'Order failed'}):result(args.request_id);
  if(name==='activate_athlete_card')return result(args.card_code==='VALID-CODE-123456');
  if(name==='resolve_scoutcard')return result(null);
  if(name==='send_coach_message')return result(true);
  return result(null);
 }};
}`;

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext();const errors=[];let passed=0;
 await context.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));
 await context.route('https://fonts.gstatic.com/**',r=>r.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
 const wait=async(s,p)=>page.waitForFunction(([s,p])=>document.querySelector(s)?.textContent.includes(p),[s,p]);
 try {
 await check('Buy/setup links work; setup has blank form and no order panel',async()=>{
  await page.goto(origin);await page.getByRole('link',{name:'Build your profile ↗',exact:true}).click();
  await page.waitForSelector('body.setup-mode');assert.equal(await page.locator('#order').isVisible(),false);assert.equal(await page.locator('#name').inputValue(),'');
 });
 await check('One auth client; no callback deadlock',async()=>{
  await page.waitForFunction(()=>window.testState?.sessionCalls===1);assert.equal(await page.evaluate(()=>testState.clients),1);assert.deepEqual(errors,[]);
 });
 await check('Email request has cooldown and no duplicate sends',async()=>{
  await page.locator('#signin-email').fill('athlete@example.com');await page.locator('#signin-form button').click();await wait('#auth-note','Check your inbox');
  assert.equal(await page.locator('#signin-form button').isDisabled(),true);assert.equal(await page.evaluate(()=>testState.calls.filter(x=>x[0]==='email').length),1);
 });
 await check('Sign-in enables save',async()=>{
  await page.evaluate(()=>testSignIn());await page.waitForFunction(()=>!document.querySelector('#save-profile').disabled);assert.equal(await page.locator('#signout').isVisible(),true);
 });
 await check('Unsafe highlight is rejected',async()=>{
  await page.locator('#name').fill('Test Athlete');await page.locator('#sport').fill('Soccer');await page.locator('#grad').fill('2028');await page.locator('#highlight').fill('javascript:alert(1)');
  await page.locator('#save-profile').click();await wait('#profile-status','valid http');assert.equal(await page.evaluate(()=>testState.calls.filter(x=>x[0]==='save').length),0);
 });
 let slug;
 await check('Profile saves stats and displays its permanent link',async()=>{
  await page.locator('#highlight').fill('hudl.com/example');await page.locator('#stats').fill('2026 season: 12 goals');await page.locator('#is-public').check();
  await page.locator('#save-profile').click();await wait('#profile-status','saved and published');slug=await page.evaluate(()=>testState.profile.slug);
  assert.match(slug,/test-athlete-/);assert.equal(await page.evaluate(()=>testState.profile.details.stats),'2026 season: 12 goals');assert.ok((await page.locator('#public-link').getAttribute('href')).includes(slug));
 });
 await check('Name edit does not break printed links',async()=>{
  await page.locator('#name').fill('Renamed Athlete');await page.locator('#save-profile').click();await wait('#profile-status','saved and published');assert.equal(await page.evaluate(()=>testState.profile.slug),slug);
 });
 await check('Save failure reports error and re-enables button',async()=>{
  await page.evaluate(()=>testState.failSave=true);await page.locator('#name').fill('Retry Athlete');await page.locator('#save-profile').click();await wait('#profile-status','Save rejected');
  assert.equal(await page.locator('#save-profile').isEnabled(),true);await page.evaluate(()=>testState.failSave=false);await page.locator('#save-profile').click();await wait('#profile-status','saved and published');
 });
 await check('Coach inbox renders messages safely',async()=>{
  await page.evaluate(()=>testState.messages=[{coach_name:'<img src=x onerror=alert(1)>',coach_email:'coach@example.com',message:'Interested in speaking with you.',created_at:new Date().toISOString()}]);
  await page.locator('#refresh-inbox').click();await wait('#inbox','Interested');assert.equal(await page.locator('#inbox img').count(),0);
 });
 await check('Setup has no horizontal overflow on phone',async()=>{
  await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'work/setup-mobile.png',fullPage:true});
 });
 await check('Sign-out clears private profile and messages',async()=>{
  await page.locator('#signout').click();await wait('#auth-note','signed out');await page.waitForFunction(()=>document.querySelector('#save-profile').disabled);
  assert.equal(await page.locator('#name').inputValue(),'');assert.equal(await page.locator('#athlete-workspace').isVisible(),false);
 });
 await check('Activation requires saved profile and handles invalid code',async()=>{
  await page.goto(origin+'/activate.html');await page.waitForFunction(()=>window.testSignIn);await page.evaluate(()=>testSignIn());await page.waitForSelector('#activate-form');
  await page.locator('#activation-code').fill('UNKNOWN-CODE');await page.locator('#activate-form button').click();await wait('#note','Save your athlete profile');
  await page.evaluate(id=>testState.profile={id,slug:'test-athlete',is_public:true},userId);
  await page.locator('#activate-form button').click();await wait('#note','not found');assert.equal(await page.locator('#activate-form button').isEnabled(),true);
 });
 await check('Activation success and retry are usable',async()=>{
  for(let i=0;i<2;i++){await page.locator('#activation-code').fill('VALID-CODE-123456');await page.locator('#activate-form button').click();await wait('#note','Your card is connected');}
  assert.equal(await page.locator('#activation-links').isVisible(),true);
 });
 await check('Incomplete or missing profile link never opens a demo',async()=>{
  await page.goto(origin+'/profile.html');await wait('#profile-page','Incomplete profile link');assert.equal(await page.locator('#share').isVisible(),false);
  await page.goto(origin+'/profile.html?athlete=missing-athlete');await wait('#profile-page','Profile not available');
 });
 await check('Public profile/contact safely render; PDF button exists',async()=>{
  await page.addInitScript(id=>window.fixture={id,slug:'public-athlete',display_name:'<img src=x onerror=alert(1)>',sport:'Soccer',graduation_year:'2028',position:'Forward',is_public:true,highlight_url:'javascript:alert(1)',details:{stats:'12 goals',events:'Showcase · October 12'}},userId);
  await page.goto(origin+'/profile.html?athlete=public-athlete');await page.waitForSelector('#message-form');assert.equal(await page.locator('#name img').count(),0);assert.equal(await page.locator('#highlight').isVisible(),false);assert.equal(await page.locator('#print-profile').isVisible(),true);
  await page.locator('#coach-name').fill('Coach Example');await page.locator('#coach-email').fill('coach@example.com');await page.locator('#coach-message').fill('Hello, I would like to learn more about your upcoming season.');
  await page.locator('#message-form button').click();await wait('#message-note','delivered');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 });
 await check('Card links handle unactivated cards and malformed URLs',async()=>{
  await page.goto(origin+'/card.html?card=00000000-1111-4222-8333-000000000002');await wait('#card-status','no public profile');await page.goto(origin+'/card.html?card=bad');await wait('#card-status','incomplete');
 });
 await check('Checkout retries reuse order ID; Stripe receives order reference',async()=>{
  await page.goto(origin+'/#buy');await page.waitForFunction(()=>window.testState);await page.evaluate(()=>testState.failOrder=true);
  await page.locator('#order-email').fill('buyer@example.com');await page.locator('#order-form [name="terms_acknowledgment"]').check();await page.locator('#order-form [name="adult_purchaser"]').check();
  await page.locator('#order-form button').click();await wait('#order-note','Order failed');assert.equal(await page.locator('#order-form button').isEnabled(),true);assert.equal(await page.locator('#checkout-resume').isVisible(),false);
  const first=await page.evaluate(()=>testState.calls.find(x=>x[0]==='reserve_scoutcard_order_email_only')[1].request_id);
  await page.locator('#order-form button').click();await wait('#order-note','Order failed');assert.equal(await page.evaluate(()=>testState.calls.filter(x=>x[0]==='reserve_scoutcard_order_email_only')[1][1].request_id),first);
  await page.evaluate(()=>testState.failOrder=false);let checkout='';
  await context.route('https://buy.stripe.com/**',r=>{checkout=r.request().url();return r.fulfill({body:'Checkout intercepted; no payment submitted.'});});
  await page.locator('#order-form button').click();await page.waitForURL('https://buy.stripe.com/**');assert.equal(new URL(checkout).searchParams.get('client_reference_id'),first);assert.equal(new URL(checkout).searchParams.get('prefilled_email'),'buyer@example.com');
 });
 assert.deepEqual(errors,[]);console.log(passed+' browser regressions passed; no uncaught errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
