import {DraftSession} from './draft-session.js';
import {accountEligibility} from './age-gate.js';
import {friendlyError, safeUrl, withTimeout} from './scoutcard-utils.js';
import {getSportName,setSportName,getSportMetrics,setSportMetrics,resetSportPresets} from './sport-presets.js';
import {headshot,resetHeadshot,loadHeadshot,acceptHeadshotSave} from './headshot-editor.js';
import {readRecruitingSnapshot} from './recruiting-email-source.js';
const $=id=>document.getElementById(id);
const names=['Basics','Teams','Stats','Highlights','Review'];
const keys={name:'display_name',grad:'graduation_year',position:'position',accolade:'accolade',highlight:'highlight_url'};
const labels={team:'School / primary team',club_team:'Club / travel team',stats:'Other stats',academics:'Academics',bio:'About',events:'Upcoming events'};

// Reuse the established fields, presets and photo editor rather than rebuilding them.
export function createProfileOnboarding({db,parent=false,onPublished=()=>{},onSaved=()=>{},onDirty=()=>{}}){
 const form=$('athlete-form'),button=$('save-profile'),status=$('profile-status'),root=$('child-fields')||form;status.tabIndex=-1;
 form.noValidate=true;form.classList.add('onboarding-editor');
 if(!document.querySelector('link[href="onboarding.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='onboarding.css';document.head.append(link);}
 const intro=document.createElement('p');intro.className='wizard-intro';intro.textContent='Your account and your public profile are different. Start with a name and sport; everything else can wait. Changes autosave privately. Only “Publish profile” makes this version public.';
 const steps=document.createElement('ol');steps.className='wizard-steps';steps.setAttribute('aria-label','Profile setup steps');
 const panels=names.map((name,index)=>{const item=document.createElement('li');item.textContent=(index+1)+'. '+name;steps.append(item);const panel=document.createElement('section');panel.className='wizard-step';panel.dataset.step=index;panel.innerHTML='<h3 tabindex="-1"></h3><p></p>';panel.querySelector('h3').textContent=name;panel.querySelector('p').textContent=index===0?(parent?'Display name, sport, child’s age group and guardian acknowledgment are required to publish. Position/event and graduation year are optional.':'Only display name and sport are required to publish. Position/event and graduation year are optional; add them if applicable.'):index===4?'Check this preview. Empty optional fields will not appear. Your email, age group and guardian acknowledgments stay private. Anyone—not only coaches—can view, copy or share a published profile.':'Optional. Add what matters, or skip this section for now.';return panel;});
 function move(id,to){const node=$(id);if(!node)return;let group=node;while(group.parentElement!==root&&group.parentElement!==form)group=group.parentElement;if(group===node){const label=root.querySelector('label[for="'+id+'"]');if(label)panels[to].append(label);panels[to].append(node);if(id==='highlight'&&root.querySelector('.hint')){const next=panels[to].lastChild;const hint=[...root.children].find(n=>n.classList.contains('hint'));if(hint&&next)panels[to].append(hint);}}else panels[to].append(group);}
 if(parent){move('child-age-band',0);move('parent-save-ack',0);}
 move('name',0);move('sport',0);move('sport-other-wrap',0);move('position',0);
 move('team',1);move('club_team',1);
 move('sport-preset-fields',2);for(const id of ['stats','accolade','academics'])move(id,2);
 move('highlight',3);for(const id of ['headshot','bio','events'])move(id,4);
 const review=document.createElement('div');review.className='wizard-review';review.setAttribute('aria-label','Draft preview');panels[4].append(review);
 move('is-public',4);
 root.prepend(intro,steps);panels.forEach(panel=>root.append(panel));
 const sharing=$('is-public').closest('label');
 if(parent)sharing.querySelector('span').textContent='I approve publishing this child’s profile, photo and highlights. Anyone with its profile or NFC link can view, copy or share it. Unpublishing cannot remove copies others have made.';
 else {sharing.lastChild.textContent=' I approve publishing this profile, photo and highlights. Anyone with its profile or NFC link can view, copy or share it. Teens must involve a parent or guardian before publishing.';}
 $('grad').required=false;panels[0].querySelector('label[for="grad"]').textContent='Graduation year (optional, if applicable)';panels[0].querySelector('label[for="name"]').textContent='Display name (required to publish)';panels[0].querySelector('label[for="sport"]').textContent='Sport (required to publish)';
 panels[0].querySelector('label[for="position"]').textContent='Position / event (optional, if applicable)';
 form.querySelector('.form-title')?.remove();form.querySelector('.save-hint')?.remove();
 const controls=document.createElement('div');controls.className='wizard-controls';
 const back=document.createElement('button'),next=document.createElement('button'),skip=document.createElement('button');
 for(const control of [back,next,skip])control.type='button';back.id='wizard-back';next.id='wizard-next';skip.id='wizard-skip';back.className='secondary';back.textContent='← Back';next.textContent='Next →';skip.textContent='Skip for now';skip.className='wizard-skip';button.textContent='Publish profile →';button.disabled=true;
 controls.append(back,next,skip,button);form.append(controls,status);status.classList.add('wizard-save-state');
 const unpublish=parent?null:document.createElement('button');if(unpublish){unpublish.type='button';unpublish.className='secondary';unpublish.textContent='Unpublish immediately';unpublish.hidden=true;controls.append(unpublish);}
 const recovery=document.createElement('div');recovery.className='wizard-recovery';const retry=document.createElement('button'),reload=document.createElement('button');
 for(const control of [retry,reload]){control.type='button';control.className='secondary';control.hidden=true;}retry.id='wizard-retry';reload.id='wizard-reload';retry.textContent='Retry save';reload.textContent='Reload saved draft';recovery.append(retry,reload);form.append(recovery);
 const purchase=document.createElement('aside');purchase.id='draft-purchase';purchase.className='draft-purchase';purchase.hidden=true;purchase.setAttribute('aria-labelledby','draft-purchase-title');
 const purchaseTitle=document.createElement('h3');purchaseTitle.id='draft-purchase-title';
 const purchaseCopy=document.createElement('p');purchaseCopy.textContent=parent?'You can order before finishing or publishing this child’s profile. Each child needs a separate card and private code. Buying does not replace guardian permissions. An adult must make the purchase.':'A finished or published profile is not required to order. Your draft stays private; add optional details later. An adult must make the purchase.';
 const purchaseActions=document.createElement('div');purchaseActions.className='draft-purchase-actions';const buy=document.createElement('a');buy.id='draft-buy';buy.href=parent?'index.html#order':'#order';buy.textContent='Buy a SCOUTCARD';
 const keep=document.createElement('button');keep.id='draft-keep-editing';keep.type='button';keep.className='secondary';keep.textContent='Keep editing';
 const purchaseWarning=document.createElement('p');purchaseWarning.className='draft-purchase-warning';purchaseWarning.textContent='Already bought a card? Don’t pay again. Finish and publish a basic profile when ready, then activate your physical card using its private code.';
 purchaseActions.append(buy,keep);purchase.append(purchaseTitle,purchaseCopy,purchaseActions,purchaseWarning);form.append(purchase);
 let context=null,step=0,generation=0,ready=false,busy=false,opening=false,published=null,cardConnected=null,leaving=false,purchased=null;
 function updatePurchase(){purchase.hidden=!ready||published?.is_public===true||cardConnected===true;purchaseTitle.textContent=queue.dirty?'Save your latest changes before ordering.':purchased===true?'Your draft is saved. A card purchase is confirmed for this account.':'Your draft is saved. You can order your card now.';buy.hidden=purchased===true;buy.setAttribute('aria-disabled',String(busy||leaving));purchaseWarning.textContent=purchased===true?(parent?'This order is not automatically assigned to a child. Check which child it is for before ordering another card. Each child needs a separate card and private code.':'Don’t pay again for the same card. Continue your profile, publish when ready, then activate the physical card using its private code.'):'Already bought a card? Don’t pay again. Finish and publish a basic profile when ready, then activate your physical card using its private code.';}
 const details=Object.keys(labels).filter(key=>!parent||key!=='events');
 const rpc=async(name,args)=>{const {data,error}=await withTimeout(db.rpc(name,args));if(error)throw error;return data;};
 const eligibility=()=>parent?{band:'adult',parent_ack:$('parent-save-ack').checked}:{band:accountEligibility()?.band,permission:accountEligibility()?.permission===true};
 function note(text,state='neutral'){status.textContent=text;status.dataset.state=state;}
 function lock(value){busy=value;form.setAttribute('aria-busy',String(value));root.disabled=value;for(const input of form.querySelectorAll('input,select,textarea,#remove-headshot'))input.disabled=value||!ready;for(const control of [button,back,next,skip,retry,reload,keep])control.disabled=value||!ready;updatePurchase();}
 function show(index,focus=false){step=Math.max(0,Math.min(4,index));panels.forEach((panel,i)=>panel.hidden=i!==step);[...steps.children].forEach((item,i)=>{if(i===step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});back.hidden=step===0;next.hidden=step===4;skip.hidden=step===0||step===4;button.hidden=step!==4;if(step===4)renderReview();if(focus)panels[step].querySelector('h3').focus();}
 function raw(){const value=Object.fromEntries(Object.entries(keys).map(([id,key])=>[key,$(id).value.trim()]));value.highlight_url=safeUrl(value.highlight_url)||value.highlight_url;value.sport=getSportName();value.details=Object.fromEntries(details.map(key=>[key,$(key).value.trim()]));value.details.sport_metrics=getSportMetrics();if(parent)value.child_age_band=$('child-age-band').value;return value;}
 function renderReview(){review.replaceChildren();const data=raw(),title=document.createElement('h4');title.textContent=data.display_name||'Your display name';review.append(title);const dl=document.createElement('dl');const values={Sport:data.sport,'Graduation year':data.graduation_year,'Position / event':data.position,...Object.fromEntries(details.map(key=>[labels[key],data.details[key]])),Accolade:data.accolade,'Highlight link':data.highlight_url,...data.details.sport_metrics};for(const [label,value]of Object.entries(values)){if(!value)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label.replaceAll('_',' ');dd.textContent=value;dl.append(dt,dd);}review.append(dl);}
 const queue=new DraftSession({
  read:async()=>{const payload=raw(),draftStep=step,eligible=eligibility(),id=context.profileId;if(parent&&!eligible.parent_ack)throw Error('Confirm the parent/guardian acknowledgment in Basics before child details can autosave.');const photo=await headshot.prepare(db,id);payload.headshot_path=photo.path;return {payload,step:draftStep,eligibility:eligible,photo};},
  persist:async(operation,record)=>{const ticket=generation;const result=await rpc('save_scoutcard_draft',{athlete_id:record.profile_id,managed:parent,draft_data:operation.payload,draft_step:operation.step,expected_version:operation.expected_version,operation_id:operation.request_id,eligibility:operation.eligibility});if(ticket===generation)await acceptHeadshotSave(db,operation.photo,{cleanup:false});return result;},
  changed:(state,value)=>{updatePurchase();onDirty(queue.dirty);retry.hidden=state!=='error';reload.hidden=state!=='error';if(state==='error'){note(friendlyError(value)+' Your edits are still here. Retry, or reload the saved draft if another device changed it.','error');return;}note(state==='saving'?'Saving private draft…':state==='saved'?'Saved privately. Publishing is a separate action.':'Changes waiting to save…',state==='saved'?'success':state==='saving'?'busy':'neutral');if(state==='saved')onSaved(value);}
 });
 async function open(options){context=options;const ticket=++generation;ready=false;opening=true;cardConnected=null;queue.reset();lock(true);retry.hidden=true;reload.hidden=true;resetHeadshot();form.reset();resetSportPresets();show(0);note('Creating or resuming your private draft…','busy');
  try{const record=await rpc('save_scoutcard_draft',{athlete_id:options.profileId,managed:parent,draft_data:{},draft_step:0,expected_version:null,operation_id:crypto.randomUUID(),eligibility:eligibility()});if(ticket!==generation)return;
   if(!record||record.profile_id!==options.profileId||!Number.isInteger(record.version))throw Error('The draft could not be loaded.');
   const payload=record.payload||{};for(const [id,key]of Object.entries(keys))$(id).value=payload[key]||'';setSportName(payload.sport);setSportMetrics(payload.details?.sport_metrics);for(const key of details)$(key).value=payload.details?.[key]||'';
   if(parent){$('child-age-band').value=payload.child_age_band||'';$('parent-save-ack').checked=record.eligibility?.parent_ack===true;}
   $('is-public').checked=false;queue.reset(record);published=options.profile||null;if(unpublish)unpublish.hidden=!published?.is_public;ready=true;show(record.step);document.dispatchEvent(new Event('profile-loaded'));onDirty(false);onSaved(record);note('Private draft ready. Changes autosave; publishing is your choice.','success');await loadHeadshot(db,payload.headshot_path);
  }catch(error){if(ticket===generation){note(friendlyError(error)+' Your draft has not been opened. Retry loading; no public profile was created.','error');reload.hidden=false;reload.disabled=false;}}
  finally{if(ticket===generation){opening=false;lock(false);reload.disabled=false;}}
 }
 function reset(){generation++;context=null;ready=false;purchased=null;queue.reset();resetHeadshot();form.reset();resetSportPresets();show(0);if(unpublish)unpublish.hidden=true;onDirty(false);lock(false);note('Sign in first to create or resume a private draft.');}
 async function flush(){if(!ready)throw Error('Load your draft before continuing.');return queue.flush();}
 keep.onclick=()=>panels[step].querySelector('h3').focus();
 // Save even a partial Basics step before leaving. Do not require publication,
 // discard edits, or continue to checkout when a save fails or the user changes.
 document.addEventListener('click',async event=>{
  const link=event.target.closest?.('a[href]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank')return;
  const destination=new URL(link.href,location.href),here=new URL(location.href);
  const purchaseTarget=link.id==='checkout-resume'||(destination.origin===here.origin&&['#buy','#order'].includes(destination.hash)&&/(?:\/|\/index\.html)$/.test(destination.pathname));
  if(!purchaseTarget||!ready)return;
  event.preventDefault();if(busy||leaving)return;leaving=true;const ticket=generation;lock(true);
  try{await flush();if(ticket===generation&&ready&&!queue.dirty)window.location.assign(destination.href);}
  catch{note('Your latest changes could not be saved, so we kept you here. Retry save before going to purchase; your entered information is still in this tab.','error');status.focus();}
  finally{leaving=false;if(ticket===generation)lock(false);}
 },true);
 // The purchase form can also be reached by changing the hash or using Back.
 // Keep checkout from starting while edits in this document are still unsaved.
 document.addEventListener('scoutcard-before-purchase',event=>{if(ready&&queue.dirty)event.detail.waitUntil(flush());});
 async function navigate(index){if(busy||!ready)return;if(step===0&&index>0&&!validateBasics())return;lock(true);try{await flush();show(index,true);queue.edit();await flush();}catch{}finally{lock(false);}}
 function invalid(id,message){show(Number($(id).closest('.wizard-step').dataset.step));note(message,'error');$(id).focus();return false;}
 function validateBasics(){if(parent&&!$('child-age-band').value)return invalid('child-age-band','Select this child’s age group. It stays private.');if(parent&&!$('parent-save-ack').checked)return invalid('parent-save-ack','Confirm that you are this child’s adult parent or guardian.');if(!$('name').value.trim())return invalid('name','Add a display name to continue.');if(!getSportName())return invalid('sport','Choose a sport to continue.');return true;}
 form.addEventListener('input',event=>{if(!ready||busy)return;if(event.target.id==='is-public')return;if(step===4)renderReview();queue.edit();});
 back.onclick=()=>navigate(step-1);next.onclick=()=>navigate(step+1);skip.onclick=()=>navigate(step+1);
 retry.onclick=async()=>{if(busy)return;lock(true);try{await flush();}catch{}finally{lock(false);}};
 reload.onclick=()=>{if(queue.dirty&&!confirm('Reload the server’s saved draft? Unsaved changes in this tab will be discarded.'))return;if(context)open(context);};
 form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!ready||step!==4)return;if(!validateBasics())return;
  for(const input of form.querySelectorAll('input:not([type=file]),select,textarea')){if(!input.checkValidity())return invalid(input.id,input.validationMessage||'Check this field.');}
  if(!$('is-public').checked)return invalid('is-public','Approve public sharing before publishing. Autosaving does not publish.');
  const highlight=safeUrl($('highlight').value);
  if($('highlight').value.trim()&&!highlight)return invalid('highlight','Use a valid http or https highlight link, or leave it blank.');
  // Also repair valid links in drafts saved before URL normalization existed.
  // Mark the change dirty so publication waits for its server acknowledgment.
  if($('highlight').value!==highlight){$('highlight').value=highlight;queue.edit();renderReview();}
  const ticket=generation;lock(true);try{await flush();note('Publishing the reviewed profile…','busy');const result=await rpc('publish_scoutcard_draft',{athlete_id:context.profileId,expected_version:queue.record.version,sharing_ack:true});if(ticket!==generation)return;if(!result?.profile?.is_public||!result?.draft)throw Error('The server did not confirm publication. Retry to check it.');queue.record=result.draft;published=result.profile;context.profile=result.profile;if(unpublish)unpublish.hidden=false;$('is-public').checked=false;await onPublished(result.profile);note('Published. Your profile link is ready. Buy a card only if needed, then activate it when received. Creating a profile does not buy or activate a card.','success');}
  catch(error){if(ticket===generation){note(friendlyError(error)+' Your entered information is still in this tab. Check the save status and retry; publication was not confirmed.','error');reload.hidden=false;}}
  finally{if(ticket===generation)lock(false);}
 });
 window.addEventListener('beforeunload',event=>{if(queue.dirty){event.preventDefault();event.returnValue='';}});
 document.addEventListener('scoutcard-before-signout',event=>{if(queue.dirty)event.detail.waitUntil(flush());});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&queue.dirty)flush().catch(()=>{});});
 async function unpublishProfile(){if(!context)throw Error('Load your profile first.');const ticket=generation;const result=await rpc('unpublish_scoutcard_profile',{athlete_id:context.profileId});if(ticket!==generation)return null;if(!result?.profile||result.profile.is_public!==false)throw Error('Unpublishing was not confirmed. Retry.');if(result.draft)queue.record={...queue.record,base_profile_updated_at:result.draft.base_profile_updated_at,published_version:null};published=result.profile;context.profile=result.profile;if(unpublish)unpublish.hidden=true;return published;}
 if(unpublish)unpublish.onclick=async()=>{if(busy)return;unpublish.disabled=true;try{const profile=await unpublishProfile();if(profile){await onPublished(profile);note('Unpublished. Your private draft remains. Previously issued photo links can last up to 5 minutes; copies others made cannot be recalled.','success');}}catch(error){note(friendlyError(error),'error');}finally{unpublish.disabled=false;}};
 show(0);reset();
 async function emailSnapshot(){
  if(!ready||opening||busy||!context)throw Error('Wait for your profile to finish loading or saving, then retry.');
  const ticket=generation,ownerId=context.user.id,profileId=context.profileId;
  const record=await flush();
  return readRecruitingSnapshot({db,ownerId,profileId,parent,record,isCurrent:()=>ticket===generation&&ready&&context?.user.id===ownerId&&context?.profileId===profileId&&!queue.dirty});
 }
 return {open,reset,flush,emailSnapshot,setPurchased(value){purchased=value;updatePurchase();},setCardConnected(value){cardConnected=value;updatePurchase();},review:()=>navigate(4),get dirty(){return queue.dirty;},get record(){return queue.record;},get ready(){return ready&&!opening;},unpublish:unpublishProfile};
}
