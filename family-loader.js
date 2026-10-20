const key='scoutcard-parent-entry-v1', lifetime=30*24*60*60*1000;
const entry=document.getElementById('parent-entry'), auth=document.getElementById('parent-auth');
let started=false;
async function start() {
 entry.hidden=true; auth.hidden=false;
 if (started) return;
 try { await import('./parent-account.js'); started=true; }
 catch { document.getElementById('auth-note').textContent='The parent dashboard could not load. Check your connection and refresh to retry.'; }
}
function validChoice() {
 try {const saved=JSON.parse(localStorage.getItem(key));return saved?.version===1&&saved.adult===true&&saved.expiresAt>Date.now()&&saved.expiresAt<=Date.now()+lifetime;}catch{return false;}
}
document.getElementById('parent-entry-form').addEventListener('submit',event=>{
 event.preventDefault();if(!event.currentTarget.reportValidity())return;
 try{localStorage.setItem(key,JSON.stringify({version:1,adult:true,expiresAt:Date.now()+lifetime}));}catch{}
 start();
});
document.addEventListener('parent-signed-out',()=>{
 try{localStorage.removeItem(key);}catch{}
 entry.hidden=false;auth.hidden=true;document.getElementById('parent-adult-entry').checked=false;
});
if(validChoice())start();
