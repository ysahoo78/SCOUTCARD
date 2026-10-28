// Navigation only: no identity, payments, email sending or profile writes.
const family=document.body.classList.contains('family-page');
function updateNavigation(){
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
