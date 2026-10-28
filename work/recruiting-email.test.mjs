import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanText,emailDetails,generateRecruitingEmail,mailtoUrl,recipientEmail,EmailDraftBook} from '../recruiting-email.js';
import {readRecruitingSnapshot} from '../recruiting-email-source.js';
const fixture=()=>({ownerId:'owner',profileId:'athlete',parent:false,payload:{display_name:'Alex Test',sport:'Soccer',position:'Forward',graduation_year:'2028',accolade:'All-district selection',highlight_url:'https://www.youtube.com/watch?v=ixg8KKxrhsM',details:{team:'School team',club_team:'Travel club',stats:'12 goals',academics:'3.7 GPA',events:'Spring showcase',sport_metrics:{goals:'12 this season'},bio:'PRIVATE BIO',email:'PRIVATE EMAIL',address:'PRIVATE ADDRESS'},child_age_band:'PRIVATE AGE',parent_acknowledged_at:'PRIVATE CONSENT',headshot_path:'PRIVATE PHOTO'},published:{id:'athlete',owner_id:'owner',slug:'alex-test',is_public:true}});
const options=()=>({coach:'Coach Rivera',program:'Example College',why:'I am interested in the program’s academic options.',purpose:'introduction',include:['basics','team','club_team','metric:goals','academics','accolade','highlight','events','profile']});
test('only explicit selected allowlisted details enter an email; private fields never enter options',()=>{
 const s=fixture(),rows=emailDetails(s),r=generateRecruitingEmail(s,options());
 assert.match(r.body,/Alex Test/);assert.match(r.body,/Goals: 12 this season/);assert.match(r.body,/Club \/ travel team: Travel club/);assert.match(r.body,/https:\/\/www.scoutcard.tech\/profile.html\?athlete=alex-test/);
 assert.doesNotMatch(JSON.stringify(rows)+r.body,/PRIVATE/);assert.match(r.body,/expected graduation year is 2028/);
 const basics=generateRecruitingEmail(s,{...options(),include:['basics']});assert.doesNotMatch(basics.body,/Travel club|goals|GPA|https:/);
});
test('selected strengths capped at three and known sport labels are retained',()=>{
 const s=fixture();s.payload.details.sport_metrics={goals:'12',assists:'8',saves:'3',unknown:'PRIVATE METRIC'};
 const r=generateRecruitingEmail(s,{...options(),include:['basics','metric:goals','metric:assists','metric:saves','stats','academics','unknown']});
 assert.equal(r.body.match(/• /g).length,3);assert.doesNotMatch(r.body,/PRIVATE METRIC|GPA/);
});
test('track-specific event results work without soccer assumptions',()=>{
 const s=fixture();s.payload.sport='Track & Field';s.payload.position='100m';s.payload.details.sport_metrics={pr_100m:'11.24 seconds',goals:'12'};
 const r=generateRecruitingEmail(s,{...options(),include:['basics','metric:pr_100m','metric:goals']});
 assert.match(r.body,/100m personal best: 11.24 seconds/);assert.doesNotMatch(r.body,/Goals:|soccer|Soccer/);
});
test('incomplete profiles and omitted basics have natural text without invented identities',()=>{
 const s={...fixture(),payload:{details:{academics:'3.7 GPA'}},published:null};
 const r=generateRecruitingEmail(s,{...options(),include:['academics']});assert.match(r.body,/prospective athlete/);assert.doesNotMatch(r.body,/undefined|null|Alex|Class of|https:|\[.*\]/);
 assert.throws(()=>generateRecruitingEmail({...s,payload:{}},options()),/Choose at least one/);
});
test('unpublished, missing, mismatched and invalid-slug profiles never produce public links',()=>{
 for(const published of [null,{id:'athlete',slug:'alex-test',is_public:false},{id:'sibling',slug:'alex-test',is_public:true},{id:'athlete',slug:'../../secret',is_public:true}]){
  const s={...fixture(),published};assert.ok(!emailDetails(s).some(r=>r.key==='profile'));assert.doesNotMatch(generateRecruitingEmail(s,options()).body,/profile.html/);
 }
});
test('unsafe highlight URLs omitted, valid long YouTube query preserved',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,x','https://user:password@example.test']){const s=fixture();s.payload.highlight_url=url;assert.ok(!emailDetails(s).some(r=>r.key==='highlight'));}
 assert.match(generateRecruitingEmail(fixture(),options()).body,/watch\?v=ixg8KKxrhsM/);
});
test('parent voice identifies adult without pretending to be a child and requires confirmation',()=>{
 const s={...fixture(),parent:true};assert.throws(()=>generateRecruitingEmail(s,options()),/Confirm the selected child/);
 const r=generateRecruitingEmail(s,{...options(),childConfirmed:true});assert.match(r.body,/parent or guardian of Alex Test/);assert.match(r.body,/Their expected graduation/);assert.doesNotMatch(r.body,/My name is Alex|I compete/);
});
test('event purpose requires actual event details, never invents an event',()=>{
 const r=generateRecruitingEmail(fixture(),{...options(),purpose:'event'});assert.match(r.body,/Upcoming competition: Spring showcase/);
 assert.throws(()=>generateRecruitingEmail(fixture(),{...options(),purpose:'event',include:['basics']}),/Add event details/);
 const manual=generateRecruitingEmail(fixture(),{...options(),purpose:'event',include:['basics'],context:'Example meet, May 3'});assert.match(manual.body,/Example meet, May 3/);
});
test('follow-up requires user context and makes no claims of watched film or replies',()=>{
 assert.throws(()=>generateRecruitingEmail(fixture(),{...options(),purpose:'followup'}),/Describe what/);
 const r=generateRecruitingEmail(fixture(),{...options(),purpose:'followup',context:'An update to my recent results.'});assert.match(r.body,/An update to my recent results/);assert.doesNotMatch(r.body,/you watched|you replied|our conversation/);
});
test('personalization cannot be silently invented and control characters cannot enter the subject',()=>{
 assert.throws(()=>generateRecruitingEmail(fixture(),{...options(),why:''}),/your own reason/);
 assert.throws(()=>generateRecruitingEmail(fixture(),{...options(),program:''}),/college or organization/);
 const r=generateRecruitingEmail(fixture(),{...options(),program:'Test\r\nBcc: attacker@example.test'});assert.doesNotMatch(r.subject,/[\r\n]/);
 assert.equal(cleanText(null),'');
});
test('one valid optional recipient; rejects multi-recipient and header-injection attempts',()=>{
 assert.equal(recipientEmail(''),'');assert.equal(recipientEmail('coach+team@example.edu'),'coach+team@example.edu');
 for(const value of ['x@example.edu,y@example.edu','x@example.edu;z@example.edu','x@example.edu\r\nBcc:y@example.edu','x@example.edu?bcc=y@example.edu','not-an-email'])assert.throws(()=>recipientEmail(value),/one valid/);
});
test('mailto safely encodes one recipient, subject and body; long messages have copy fallback',()=>{
 const value={recipient:'coach+team@example.edu',subject:'Alex & team?',body:'Hello\nLink: https://example.edu/?a=1&b=2'};
 const url=new URL(mailtoUrl(value));assert.equal(url.searchParams.get('subject'),value.subject);assert.equal(url.searchParams.get('body'),value.body);assert.equal(url.searchParams.get('bcc'),null);
 assert.throws(()=>mailtoUrl({...value,body:'x'.repeat(3000)}),/Copy subject/);assert.throws(()=>mailtoUrl({...value,recipient:''}),/Add the coach/);
});
test('tab-memory drafts are isolated per child, cloned, deleted separately and cleared across accounts',()=>{
 const book=new EmailDraftBook();book.setOwner('parent');const one={body:'Child A'};book.write('a',one);one.body='Wrong';book.write('b',{body:'Child B'});
 assert.equal(book.read('a').body,'Child A');assert.equal(book.read('b').body,'Child B');book.delete('a');assert.equal(book.read('a'),null);assert.equal(book.read('b').body,'Child B');
 book.setOwner('other');assert.equal(book.read('b'),null);book.write('c',{body:'Other'});book.clear();assert.equal(book.hasEdits,false);assert.equal(book.read('c'),null);
});
const record=()=>({profile_id:'athlete',owner_id:'owner',parent_managed:false,payload:fixture().payload,version:1});
const database=({user='owner',result={id:'athlete',is_public:true,slug:'alex-test'},draft=record(),error=null,sessionError=null,onRead=()=>{}}={})=>{
 const filters=[];const db={auth:{getSession:async()=>({data:{session:user?{user:{id:user}}:null},error:sessionError})},from:table=>{assert.ok(['athlete_profiles','athlete_profile_drafts'].includes(table));onRead();return{select(columns){assert.equal(columns,table==='athlete_profiles'?'id,slug,is_public':'profile_id,owner_id,parent_managed,payload,eligibility,version');return this;},eq(k,v){filters.push([k,v]);return this;},async maybeSingle(){return {data:table==='athlete_profiles'?result:draft,error};}};}};return {db,filters};
};
test('source reads require matching saved owner/profile/type and a matching signed-in account',async()=>{
 for(const override of [{owner_id:'someone-else'},{profile_id:'sibling'},{parent_managed:true}])await assert.rejects(readRecruitingSnapshot({db:database().db,ownerId:'owner',profileId:'athlete',parent:false,record:{...record(),...override}}),/own saved/);
 for(const user of [null,'other'])await assert.rejects(readRecruitingSnapshot({db:database({user,onRead:()=>assert.fail('no profile read expected')}).db,ownerId:'owner',profileId:'athlete',parent:false,record:record()}),/account or selected/);
});
test('source uses explicit owner and child filters and never writes',async()=>{
 const {db,filters}=database();const s=await readRecruitingSnapshot({db,ownerId:'owner',profileId:'athlete',parent:false,record:record()});assert.deepEqual(filters,[['owner_id','owner'],['profile_id','athlete'],['id','athlete']]);assert.equal(s.published.slug,'alex-test');
});
test('source preserves private draft without creating public profile and denies unrelated returned row',async()=>{
 const s=await readRecruitingSnapshot({db:database({result:null}).db,ownerId:'owner',profileId:'athlete',parent:false,record:record()});assert.equal(s.published,null);
 await assert.rejects(readRecruitingSnapshot({db:database({result:{id:'sibling',owner_id:'owner'}}).db,ownerId:'owner',profileId:'athlete',parent:false,record:record()}),/could not be verified/);
});
test('parent source requires existing guardian acknowledgment',async()=>{
 const r={...record(),parent_managed:true};await assert.rejects(readRecruitingSnapshot({db:database().db,ownerId:'owner',profileId:'athlete',parent:true,record:r}),/guardian acknowledgment/);
 const acknowledged={...r,eligibility:{parent_ack:true}};const s=await readRecruitingSnapshot({db:database({draft:acknowledged}).db,ownerId:'owner',profileId:'athlete',parent:true,record:acknowledged});assert.equal(s.parent,true);
});
test('private draft RLS responses, cross-device versions and parent permission are checked after the server read',async()=>{
 for(const draft of [null,{...record(),owner_id:'other'},{...record(),profile_id:'sibling'},{...record(),parent_managed:true}])await assert.rejects(readRecruitingSnapshot({db:database({draft}).db,ownerId:'owner',profileId:'athlete',parent:false,record:record()}),/not available/);
 await assert.rejects(readRecruitingSnapshot({db:database({draft:{...record(),version:2}}).db,ownerId:'owner',profileId:'athlete',parent:false,record:record()}),/another device/);
 const r={...record(),parent_managed:true,eligibility:{parent_ack:true}};await assert.rejects(readRecruitingSnapshot({db:database({draft:{...r,eligibility:{}}}).db,ownerId:'owner',profileId:'athlete',parent:true,record:r}),/guardian acknowledgment/);
});
test('failed requests and interrupted sign-in never return a usable snapshot',async()=>{
 for(const args of [{error:Error('network timeout')},{sessionError:Error('session expired')}])await assert.rejects(readRecruitingSnapshot({db:database(args).db,ownerId:'owner',profileId:'athlete',parent:false,record:record()}));
 let current=true;const {db}=database({onRead:()=>{current=false;}});await assert.rejects(readRecruitingSnapshot({db,ownerId:'owner',profileId:'athlete',parent:false,record:record(),isCurrent:()=>current}),/selected athlete changed/);
});
