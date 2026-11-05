// Navigation only: no identity, payments, email sending or profile writes.
const family=document.body.classList.contains('family-page');
if(document.body.classList.contains('activation-page')&&!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.className='skip-link';skip.href='#main';skip.textContent='Skip to content';document.body.prepend(skip);}
const header=document.querySelector('header.action-header');
if(header){
 const shortcut=document.createElement('a');shortcut.className='account-shortcut';shortcut.id='account-shortcut';
 const updateShortcut=()=>{const signedIn=document.body.classList.contains('authenticated');shortcut.textContent=signedIn?(family?'Your family dashboard →':'Your dashboard →'):'Already have an account? Sign in →';shortcut.href=family?(signedIn?'#main':'#parent-auth'):document.getElementById('athlete-form')?(signedIn?'#setup':'#account'):'index.html#account';};
 header.append(shortcut);document.addEventListener('scoutcard-auth-state',updateShortcut);updateShortcut();
}
function updateNavigation(){
  const home=!!document.getElementById('order');
  document.body.classList.toggle('checkout-mode',home&&location.hash==='#order');
  document.body.classList.toggle('athlete-entry',home&&['#account','#profile','#athlete-workspace'].includes(location.hash));
  // Preserve old shared parent links after moving the section to its own page.
  if ((location.pathname === '/' || location.pathname.endsWith('/index.html')) && location.hash === '#parents') {
    location.replace(new URL('parents.html', location.href).href);
    return;
  }
  const email=['#email','#recruiting-email'].includes(location.hash);
  const entry=document.getElementById('email-entry');
  if(entry)entry.hidden=!email;
  if(!family)return;
  const activate=location.hash==='#parent-card-section';
  const notice=document.getElementById('family-action-entry');
  if(notice){
    notice.hidden=!email&&!activate;
    document.getElementById('family-action-title').textContent=activate?'Activate the right child’s card.':'Write a recruiting email.';
    document.getElementById('family-action-copy').textContent=activate
      ? 'Sign in as the adult parent and choose the correct child first. Publish their basic profile, then enter that card’s private activation code in the selected child’s card section. Each child has a separate profile and card; buying does not activate it.'
      : 'Sign in as the adult parent, then choose the correct child’s profile. Select “Write a recruiting email” in that child’s workspace. A private draft is enough; a confirmed SCOUTCARD purchase is required. Review the message and send it yourself—nothing is sent automatically.';
  }
  const action=email?'email':activate?'activate':'setup';
  for(const link of document.querySelectorAll('header .primary-actions a')){
    const current=link.dataset.action===action;
    if(current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange',updateNavigation);
updateNavigation();
const helpHost=document.getElementById('account')||document.getElementById('parent-auth')||document.querySelector('.auth-panel');
if(helpHost){
 const help=document.createElement('details');help.className='task-help';
 help.innerHTML='<summary>Need help signing in?</summary><p>Use the email you signed up with. Open the newest sign-in email and continue on the page it opens. If it’s missing, check Spam or Junk. You can request another link after the timer ends.</p><p>Your email sign-in link and your card’s private activation code are different. The activation code comes with your physical card.</p><a href="mailto:scout.card26@gmail.com?subject=SCOUTCARD%20setup%20help">Contact SCOUTCARD support →</a>';
 helpHost.append(help);
}
