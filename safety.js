import {publicUrl} from './scoutcard-utils.js';
const slug=new URLSearchParams(location.search).get('athlete');
if(slug&&/^[a-z0-9-]{3,60}$/.test(slug)) {
 const profile=publicUrl(slug),link=document.getElementById('safety-email');
 link.href='mailto:scout.card26@gmail.com?'+new URLSearchParams({subject:'SCOUTCARD safety or privacy concern',body:'Relevant public profile: '+profile+'\n\nBriefly describe the concern (do not include passwords, sign-in links, activation codes or extra identifying information about a child):\n'}).toString();
 document.getElementById('safety-context').textContent='This email draft includes only the relevant public profile link: '+profile+'. You can review or remove it before sending.';
}
