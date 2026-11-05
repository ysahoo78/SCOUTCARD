import { db, mountAuth } from './scoutcard-client.js';
import { publicUrl, friendlyError, withTimeout } from './scoutcard-utils.js';
const form = document.querySelector('#activate-form'), note = document.querySelector('#note');
let user = null;
let checkVersion=0;
const setup=document.createElement('a');setup.className='activation-next';setup.href='index.html#profile';setup.textContent='Continue profile setup →';setup.hidden=true;note.after(setup);
const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='Retry profile check';retry.hidden=true;setup.after(retry);
async function checkProfile(){
 const id=user?.id,version=++checkVersion;form.hidden=true;setup.hidden=true;retry.hidden=true;
 if(!id)return;
 note.textContent='Checking your profile before activation…';note.dataset.state='busy';
 try{
  const {data:profile,error}=await withTimeout(db.from('athlete_profiles').select('slug,is_public').eq('id',id).maybeSingle());
  if(user?.id!==id||version!==checkVersion)return;
  if(error)throw error;
  if(!profile){note.textContent='First, publish your basic profile. Add your name and sport, choose Review now, then approve public sharing. Return here with the private code supplied with your card.';setup.hidden=false;note.dataset.state='neutral';return;}
  form.hidden=false;note.dataset.state='neutral';note.textContent=profile.is_public?'Profile ready. Enter the private code supplied with your physical card.':'You can connect this card now. Your profile stays private until you publish it.';
 }catch(error){if(user?.id===id&&version===checkVersion){note.textContent=friendlyError(error)+' Retry the profile check below.';note.dataset.state='error';retry.hidden=false;}}
}
retry.onclick=()=>checkProfile();
mountAuth(async next => {
  user = next;
  form.hidden = true;setup.hidden=true;retry.hidden=true;checkVersion++;
  document.querySelector('#activation-links').hidden = true;
  note.textContent = user ? 'Enter your card’s activation code below.' : 'Sign in above to connect your card.';
  note.dataset.state = 'neutral';
  if(user)await checkProfile();
}, '/activate.html');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button'), code = document.querySelector('#activation-code').value.trim().toUpperCase();
  if (!user || button.disabled || !form.reportValidity()) return;
  const id = user.id;
  button.disabled = true; button.textContent = 'Activating…';
  form.setAttribute('aria-busy', 'true');
  note.textContent = 'Checking your card and connecting it to your profile…';
  note.dataset.state = 'busy';
  document.querySelector('#activation-links').hidden = true;
  try {
    const { data:profile, error:profileError } = await withTimeout(db.from('athlete_profiles').select('slug,is_public').eq('id', id).maybeSingle());
    if(user?.id!==id)return;
    if (profileError) throw profileError;
    if (!profile) { note.textContent = 'Your private draft is not a published profile yet. Open Set up profile, finish Basics, skip any optional sections, then review and publish. Return here with your card’s private activation code afterward. Signing in does not buy or activate a card.'; note.dataset.state = 'error'; return; }
    const { data, error } = await withTimeout(db.rpc('activate_athlete_card', { card_code:code }));
    if (error) throw error;
    if (user?.id !== id) return;
    if (!data) { note.textContent = 'This code was not found or belongs to another account. Check the code printed in your package.'; note.dataset.state = 'error'; return; }
    note.textContent = profile.is_public ? 'Your card is connected. NFC taps and shared links can now open your profile.' : 'Your card is connected. Publish your profile from Set up profile before sharing it with coaches.';
    note.dataset.state = 'success';
    document.querySelector('#activated-profile').href = profile.is_public?publicUrl(profile.slug):'index.html#profile';
    document.querySelector('#activated-profile').textContent=profile.is_public?'View your profile →':'Publish your profile →';
    document.querySelector('#activation-links').hidden = false;
    form.reset();
  } catch (error) { if(user?.id===id){note.textContent = friendlyError(error); note.dataset.state = 'error';} }
  finally { form.setAttribute('aria-busy', 'false'); button.disabled = false; button.textContent = 'Activate my card →'; }
});
