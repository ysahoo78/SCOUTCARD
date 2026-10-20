import { db, mountAuth } from './scoutcard-client.js';
import { canonicalOrigin, safeUrl, publicUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
import { getSportName, setSportName, getSportMetrics, setSportMetrics, resetSportPresets } from './sport-presets.js';
import { headshot, loadHeadshot, resetHeadshot, refreshHeadshotPreview, acceptHeadshotSave } from './headshot-editor.js';
const $=id=>document.getElementById(id);
const form=$('athlete-form'), status=$('profile-status'), list=$('profiles-list');
const basic={name:'display_name',grad:'graduation_year',position:'position',accolade:'accolade',highlight:'highlight_url'};
const extra=['team','club_team','stats','academics','bio'];
let user=null, profiles=[], selected=null, draftId=null, epoch=0, busy=false, dirty=false, pendingSwitch=null, listVersion=0, familyReady=false;
const connections=new Map();
const cursors={cards:null,messages:null}, loading={cards:false,messages:false};
const tickets={cards:0,messages:0};
function note(target,text,state='neutral'){const node=$(target);node.textContent=text;node.dataset.state=state;}
async function rpc(name,args={}){const {data,error}=await withTimeout(db.rpc(name,args));if(error)throw error;return data;}
function preview(){refreshHeadshotPreview();$('live-name').textContent=$('name').value.trim()||'Your child’s display name';$('live-sport').textContent=getSportName();}
function setBusy(value) {
 busy=value; $('child-fields').disabled=value;$('save-profile').disabled=value;
 for(const id of ['refresh-family','unpublish-child'])$(id).disabled=value;
 $('new-child').disabled=value||!familyReady||profiles.length>=10;
 list.querySelectorAll('button').forEach(button=>button.disabled=value);
 $('save-profile').textContent=value?'Saving…':'Save child profile →';
 form.setAttribute('aria-busy',String(value));
}
function updateList(){
 list.replaceChildren();
 for(const profile of profiles){
  const button=document.createElement('button');button.type='button';button.disabled=busy;
  button.setAttribute('aria-pressed',String(selected?.id===profile.id));
  const name=document.createElement('strong');name.textContent=profile.display_name;
  const state=document.createElement('small');state.textContent=profile.sport+' · '+(profile.is_public?'Published':'Private');
  button.append(name,state);button.onclick=()=>requestSwitch(profile.id);list.append(button);
 }
}
function remember(profile) {
 const index=profiles.findIndex(p=>p.id===profile.id);
 if(index<0)profiles.push(profile);else profiles[index]=profile;
 selected=profile;draftId=profile.id;updateList();showSaved();
}
function showSaved() {
 $('child-link-box').hidden=!selected;$('child-tools').hidden=!selected;
 $('unpublish-child').hidden=!selected?.is_public;
 showNext();if(!selected)return;
 const name=selected.display_name;
 $('child-editor-title').textContent='Profile: '+name;
 $('child-public-link').textContent=publicUrl(selected.slug);$('child-public-link').href=publicUrl(selected.slug);
 $('card-child-heading').textContent='Connect a card to '+name;
 $('inbox-child-heading').textContent='Inquiries about '+name;
 $('activation-child-label').textContent='I confirm this card belongs to '+name+'.';
 $('delete-child-label').textContent='I understand and want to permanently delete '+name+'’s profile, messages and headshots, and disable their cards.';
}
function showNext() {
 $('child-next').hidden=!selected;if(!selected)return;
 const connected=connections.get(selected.id);
 $('child-next-title').textContent='Setup for '+selected.display_name;
 $('child-saved-state').textContent='Profile saved · '+(selected.is_public?'Published':'Private')+' · '+(connected===true?'Card connected':connected===false?'No card connected':'Checking card connection');
 const action=$('child-next-action');action.removeAttribute('target');action.removeAttribute('rel');
 if(!selected.is_public){
  $('child-next-copy').textContent='Review the information below. If you want others to see it, approve public sharing and select “Save child profile.” You may also keep it private; a connected card will not show a private profile.';
  action.href='#parent-public-choice';action.textContent='Review sharing choice ↓';
 }else if(connected===true){
  $('child-next-copy').textContent='Ready to share. Open the public profile to check it, then tap the physical card on an NFC-compatible phone to confirm it opens the right child’s page.';
  action.href=publicUrl(selected.slug);action.textContent='View published profile (opens a new tab) ↗';action.target='_blank';action.rel='noopener';
 }else{
  $('child-next-copy').textContent=connected===false?'Have the card? Enter its private activation code below to connect it to this child. If you already paid in person, do not buy again.':'Your profile is published. Checking whether a card is connected; you can review the card section below.';
  action.href='#parent-card-section';action.textContent='Go to this child’s card ↓';
 }
}
function clearPrivate() {
 epoch++;profiles=[];selected=null;draftId=null;dirty=false;pendingSwitch=null;listVersion++;familyReady=false;connections.clear();
 list.replaceChildren();form.reset();resetSportPresets();resetHeadshot();preview();
 $('parent-workspace').hidden=true;$('child-editor').hidden=true;$('child-tools').hidden=true;$('child-link-box').hidden=true;$('unsaved-switch').hidden=true;
 $('child-inbox').replaceChildren();$('child-cards').replaceChildren();
 $('child-next').hidden=true;$('child-public-link').textContent='';$('child-public-link').removeAttribute('href');
 $('child-next-action').removeAttribute('href');$('child-next-title').textContent='Finish this child’s setup.';
 $('child-saved-state').textContent='';$('child-next-copy').textContent='';
 for(const [id,text] of Object.entries({'child-editor-title':'New child profile','card-child-heading':'Connect this child’s card','inbox-child-heading':'Coach inquiries','activation-child-label':'I am connecting this card to the selected child.','delete-child-label':'I understand and want to permanently delete this child’s profile.'}))$(id).textContent=text;
 $('parent-activate-form').reset();$('delete-child-form').reset();
 for(const id of ['family-status','profile-status','activation-status','delete-status'])note(id,'');
 setBusy(false);
}
async function reloadFamily() {
 const account=user?.id, version=++listVersion;if(!account)return;
 familyReady=false;$('new-child').disabled=true;$('refresh-family').disabled=true;note('family-status','Loading your saved profiles…','busy');
 try{
  const data=await rpc('list_parent_athletes');
  if(user?.id!==account||listVersion!==version)return;
  if(!Array.isArray(data))throw Error('The family list could not be read. Refresh to retry.');
  profiles=data;familyReady=true;updateList();
  note('family-status',profiles.length>=10?'Your 10 saved profiles are below. Contact SCOUTCARD if you need help adding more.':profiles.length?'Choose a profile to edit, activate its card, or read its messages.':'No child profiles yet. Select “Add a child” to begin.');
  if(profiles.length===1&&!selected&&!dirty)await openChild(profiles[0].id);
 }catch(error){if(user?.id===account)note('family-status',friendlyError(error)+' Use “Reload saved profiles” to retry.','error');}
 finally{if(user?.id===account){$('refresh-family').disabled=false;$('new-child').disabled=busy||!familyReady||profiles.length>=10;}}
}
function requestSwitch(id) {
 if(busy||!user)return;
 if(dirty){pendingSwitch={id};$('unsaved-switch').hidden=false;return;}
 openChild(id);
}
async function openChild(id) {
 const version=++epoch;selected=id?profiles.find(p=>p.id===id)||null:null;draftId=selected?.id||crypto.randomUUID();dirty=false;
 form.reset();resetSportPresets();resetHeadshot();$('parent-activate-form').reset();$('delete-child-form').reset();
 $('child-inbox').replaceChildren();$('child-cards').replaceChildren();
 for(const target of ['profile-status','activation-status','delete-status'])note(target,'');
 $('unsaved-switch').hidden=true;$('child-editor').hidden=false;setBusy(false);
 $('child-editor-title').textContent=selected?'Profile: '+selected.display_name:'New child profile';
 if(selected){
  for(const [field,key] of Object.entries(basic))$(field).value=selected[key]||'';
  $('child-age-band').value=selected.child_age_band||'';setSportName(selected.sport);setSportMetrics(selected.details?.sport_metrics);
  for(const key of extra)$(key).value=selected.details?.[key]||'';
  $('is-public').checked=selected.is_public===true;
  // A stored acknowledgment is shown only for the parent's own saved profile.
  $('parent-save-ack').checked=!!selected.parent_acknowledged_at;
 }
 showSaved();updateList();preview();$('child-editor-title').focus();
 if(selected){const current=selected;await Promise.all([loadHeadshot(db,current.headshot_path),loadPage('cards',true),loadPage('messages',true)]);if(epoch!==version)return;}
}
$('new-child').onclick=()=>requestSwitch(null);
$('refresh-family').onclick=()=>{if(dirty){note('family-status','Save or switch/discard your draft before reloading.');return;}reloadFamily();};
$('discard-switch').onclick=()=>{if(pendingSwitch){const {id}=pendingSwitch;pendingSwitch=null;dirty=false;openChild(id);}};
$('cancel-switch').onclick=()=>{pendingSwitch=null;$('unsaved-switch').hidden=true;};
form.addEventListener('input',()=>{dirty=true;preview();note('profile-status','You have unsaved changes.');});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});

mountAuth(async next=>{
 const previous=user?.id;user=next;clearPrivate();
 if(!user){if(previous)document.dispatchEvent(new Event('parent-signed-out'));return;}
 $('parent-workspace').hidden=false;await reloadFamily();
 if(user?.id!==next.id)return;
 if(!profiles.length)$('new-child').focus({preventScroll:true});
},canonicalOrigin+'/family.html');

function values() {
 const name=$('name').value.trim(),sport=getSportName(),highlight=safeUrl($('highlight').value);
 if(!name||!sport)throw Error('Add a display name and sport before saving.');
 if($('highlight').value.trim()&&!highlight)throw Error('Use a valid http or https highlight link.');
 const details=Object.fromEntries(extra.map(key=>[key,$(key).value.trim()]));details.sport_metrics=getSportMetrics();
 return {display_name:name,sport,graduation_year:$('grad').value.trim(),position:$('position').value.trim(),accolade:$('accolade').value.trim(),highlight_url:highlight,details,child_age_band:$('child-age-band').value,is_public:$('is-public').checked};
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!user||busy||!form.reportValidity())return;
 const account=user.id,version=epoch,id=draftId;let payload;
 try{payload=values();}catch(error){note('profile-status',error.message,'error');return;}
 const adult=$('parent-save-ack').checked;setBusy(true);note('profile-status','Saving this child’s profile…','busy');
 try{
  if(!selected){
   const created=await rpc('save_parent_athlete',{profile_id:id,profile_data:{...payload,is_public:false},adult_ack:adult,sharing_ack:false});
   if(user?.id!==account||epoch!==version)return;remember(created);
  }
  const photo=await headshot.prepare(db,id);
  if(user?.id!==account||epoch!==version)return;
  if(photo.changed)payload.headshot_path=photo.path;
  payload.expected_updated_at=selected.updated_at;
  const saved=await rpc('save_parent_athlete',{profile_id:id,profile_data:payload,adult_ack:adult,sharing_ack:payload.is_public});
  if(user?.id!==account||epoch!==version)return;
  remember(saved);dirty=false;await acceptHeadshotSave(db,photo);
  note('profile-status',saved.is_public?'Saved and published. Review the public link below. New inquiries go to your parent inbox.':'Saved privately. Public/NFC viewers cannot see it until you approve publishing.','success');
  await Promise.all([loadPage('cards',true),loadPage('messages',true)]);
 }catch(error){if(user?.id===account&&epoch===version)note('profile-status',friendlyError(error)+(selected?' Your saved profile is still available; review it before retrying.':''),'error');}
 finally{if(user?.id===account&&epoch===version)setBusy(false);}
});
$('unpublish-child').onclick=async()=>{
 if(!selected||busy)return;const id=selected.id,account=user?.id,version=epoch;setBusy(true);
 try{const saved=await rpc('unpublish_parent_athlete',{athlete_id:id});if(user?.id!==account||version!==epoch)return;remember(saved);$('is-public').checked=false;note('profile-status','Unpublished. New public requests are blocked. Previously issued photo links may last up to 5 minutes, and others may have copies.','success');}
 catch(error){if(epoch===version)note('profile-status',friendlyError(error),'error');}finally{if(epoch===version)setBusy(false);}
};
$('copy-child-link').onclick=async()=>{if(!selected)return;try{await navigator.clipboard.writeText(publicUrl(selected.slug));note('profile-status','Profile link copied.');}catch{note('profile-status','Select and copy the permanent link below.');}};

async function loadPage(kind,reset=false) {
 const id=selected?.id,version=epoch;if(!id||!user)return;
 if(reset){cursors[kind]=null;loading[kind]=false;tickets[kind]++;if(kind==='cards'){connections.set(id,null);showNext();}}
 if(loading[kind])return;loading[kind]=true;
 const ticket=tickets[kind];
 const cards=kind==='cards',container=$(cards?'child-cards':'child-inbox'),more=$(cards?'more-cards':'more-messages');
 if(reset)container.replaceChildren();
 more.disabled=true;more.hidden=true;
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Loading…';container.append(message);
 try{
  const field=cards?'activated_at':'created_at',columns=cards?'id,public_token,activated_at':'id,coach_name,coach_email,message,created_at';
  let query=db.from(cards?'athlete_cards':'coach_messages').select(columns).eq('profile_id',id).order(field,{ascending:false}).order('id',{ascending:false}).limit(21);
  const cursor=cursors[kind];if(cursor)query=query.or(field+'.lt.'+cursor.date+',and('+field+'.eq.'+cursor.date+',id.lt.'+cursor.id+')');
  const {data,error}=await withTimeout(query);if(epoch!==version||selected?.id!==id||tickets[kind]!==ticket)return;if(error)throw error;
  message.remove();const rows=data.slice(0,20);
  if(cards){connections.set(id,rows.length>0||(!reset&&connections.get(id)===true));showNext();}
  for(const row of rows){
   const item=document.createElement('article');item.className='list-item';
   if(cards){
    const title=document.createElement('h3');title.textContent='Card connected to '+selected.display_name;
    const link=document.createElement('a');link.href=canonicalOrigin+'/card.html?card='+encodeURIComponent(row.public_token);link.textContent=link.href;link.target='_blank';link.rel='noopener';
    item.append(title,link);
   }else{
    const title=document.createElement('h3');title.textContent=row.coach_name;
    const date=document.createElement('small');date.textContent=new Date(row.created_at).toLocaleString();
    const text=document.createElement('p');text.textContent=row.message;
    const reply=document.createElement('a');reply.href='mailto:'+encodeURIComponent(row.coach_email);reply.textContent='Reply from your email';
    item.append(title,date,text,reply);
   }
   container.append(item);
  }
  if(rows.length){const last=rows.at(-1);if(!/^[0-9T:.+Z-]+$/.test(last[field])||!/^[0-9a-f-]{36}$/i.test(last.id))throw Error('Unable to load the next page. Reload this profile.');cursors[kind]={date:last[field],id:last.id};}
  if(!container.childElementCount)container.textContent=cards?'No cards connected to this child yet.':'No inquiries yet. New messages will appear here; automatic email notifications are not currently sent.';
  more.hidden=data.length<=20;more.textContent=cards?'Load more cards':'Load more messages';
 }catch(error){if(epoch===version&&tickets[kind]===ticket){message.textContent=friendlyError(error);more.hidden=false;more.textContent='Try again';}}
 finally{if(epoch===version&&tickets[kind]===ticket){loading[kind]=false;more.disabled=false;}}
}
$('more-cards').onclick=()=>loadPage('cards');$('more-messages').onclick=()=>loadPage('messages');
$('refresh-parent-inbox').onclick=()=>loadPage('messages',true);
$('parent-activate-form').addEventListener('submit',async event=>{
 event.preventDefault();const activationForm=event.currentTarget,button=activationForm.querySelector('button');if(!selected||!user||button.disabled||!activationForm.reportValidity())return;
 const id=selected.id,account=user.id,version=epoch;button.disabled=true;
 note('activation-status','Connecting the card to '+selected.display_name+'…','busy');
 try{const success=await rpc('activate_parent_card',{card_code:$('activation-code').value.trim().toUpperCase(),athlete_id:id});
  if(epoch!==version||user?.id!==account)return;
  if(!success)throw Error('Code not found, disabled, or already connected to a different profile. Check the private code; this does not move a card between children.');
  activationForm.reset();note('activation-status','Card connected to '+selected.display_name+'. '+(selected.is_public?'Taps can open the published profile.':'The profile is private; approve publishing before sharing.'),'success');await loadPage('cards',true);
 }catch(error){if(epoch===version)note('activation-status',friendlyError(error),'error');}finally{button.disabled=false;}
});
$('delete-child-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button');if(!selected||!user||busy||button.disabled||!event.currentTarget.reportValidity())return;
 const id=selected.id,account=user.id,version=epoch;let unpublished=false;button.disabled=true;setBusy(true);note('delete-status','Unpublishing, removing stored photos and deleting this child’s profile…','busy');
 try{
  const saved=await rpc('unpublish_parent_athlete',{athlete_id:id});unpublished=true;if(user?.id!==account||epoch!==version)return;remember(saved);$('is-public').checked=false;
  for(let batch=0;batch<20;batch++){
   const {data,error}=await withTimeout(db.storage.from('athlete-headshots').list(id,{limit:100,sortBy:{column:'name',order:'asc'}}));if(error)throw error;
   if(!data.length)break;
   const paths=data.map(file=>id+'/'+file.name);
   const removed=await withTimeout(db.storage.from('athlete-headshots').remove(paths));if(removed.error)throw removed.error;
   if(batch===19)throw Error('This profile has many photos. It is now private; contact SCOUTCARD to finish cleanup.');
  }
  if(user?.id!==account||epoch!==version)return;await rpc('delete_parent_athlete',{athlete_id:id});
  if(user?.id!==account||epoch!==version)return;
  dirty=false;await openChild(null);$('child-editor').hidden=true;await reloadFamily();note('family-status','Child profile and inbox deleted, stored photos removed, and connected cards disabled.','success');
 }catch(error){if(epoch===version)note('delete-status',friendlyError(error)+' Deletion did not finish. '+(unpublished?'The profile is private; retry or contact SCOUTCARD.':'Check its sharing status, then retry or contact SCOUTCARD.'),'error');}
 finally{button.disabled=false;if(epoch===version)setBusy(false);}
});
