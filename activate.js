import{createClient}from'https://esm.sh/@supabase/supabase-js@2';
const db=createClient('https://canyprcqtbvvrrvaoltu.supabase.co','sb_publishable_0Qu4eJEl1jRtY6xZeW9Z1Q_dz6GsKYn'),form=document.querySelector('#activate-form'),note=document.querySelector('#note');
let user;
async function state(){const{data:{session}}=await db.auth.getSession();user=session?.user;form.hidden=!user;document.querySelector('#sign-in').hidden=!!user}
document.querySelector('#sign-in').onclick=async()=>{const email=prompt('Email');if(!email)return;const{error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:'https://scoutcard.vercel.app/activate.html'}});note.textContent=error?error.message:'Check email, then return here.'};
form.onsubmit=async e=>{e.preventDefault();const{data:p}=await db.from('athlete_profiles').select('id,slug').eq('id',user.id).maybeSingle();if(!p){note.textContent='Save athlete profile first.';return}const code=document.querySelector('#activation-code').value.trim().toUpperCase();const{data,error}=await db.rpc('activate_athlete_card',{card_code:code});if(error){note.textContent='Could not activate: '+error.message;return}note.innerHTML=data?'Activated! <a href="profile.html?athlete='+p.slug+'">Open public profile</a>':'Invalid or already-used code.'};
await state();db.auth.onAuthStateChange(state);
