// Display only server-confirmed profile/purchase/card state, never infer payment from a redirect.
export function createAthleteDashboard({review}) {
 const panel=document.createElement('section');panel.id='athlete-dashboard';panel.className='athlete-dashboard wrap setup-only';panel.hidden=true;
 panel.setAttribute('aria-labelledby','dashboard-title');
 panel.innerHTML='<p class="eyebrow">YOUR SCOUTCARD</p><h1 id="dashboard-title">Your athlete dashboard</h1><div class="dashboard-statuses"><span id="dashboard-profile-state"></span><span id="dashboard-card-state"></span></div><p id="dashboard-next"></p><div class="dashboard-actions"><button type="button" id="dashboard-review">Review &amp; publish</button><a href="#profile">Edit profile</a><a href="#athlete-workspace">Inbox &amp; cards</a><a href="activate.html" id="dashboard-activate">Activate card</a><a href="family.html">Parent dashboard</a></div>';
 document.getElementById('account').before(panel);
 const $=id=>panel.querySelector('#'+id);
 $('dashboard-review').onclick=()=>review();
 let state={};
 function update(change){
  Object.assign(state,change);panel.hidden=!state.signedIn;
  const published=state.profile?.is_public===true;
  $('dashboard-title').textContent=state.record?.payload?.display_name?state.record.payload.display_name+'’s dashboard':'Your athlete dashboard';
  $('dashboard-profile-state').textContent=published?'Profile published':state.record?'Private draft':'Loading profile…';
  $('dashboard-card-state').textContent=state.connected?'Card connected':state.purchased===true?'Purchase confirmed':state.connected===false?'Card not connected':'Checking card status…';
  const pendingEdits=published&&state.record&&state.record.published_version!==state.record.version;
  $('dashboard-next').textContent=state.dirty?'Your latest edits are waiting to save. Keep this page open until saving finishes.':!state.record?'Loading your saved information…':published
   ? pendingEdits?'Your public profile is live. Review and publish your latest draft when you want those edits to appear.':state.connected?'You’re ready to share. Open Inbox & cards to find your permanent card link and coach messages.':'Your profile is ready. Have your physical card? Connect it with the private code supplied with it.'
   : 'Start with your name and sport, then review and publish. Teams, stats and highlights can wait. You can buy your card before finishing.';
  $('dashboard-review').disabled=!state.record;
  $('dashboard-review').textContent=published?'Review profile updates':'Review & publish';
  $('dashboard-activate').hidden=state.connected===true;
 }
 return {update,reset(){state={};update({signedIn:false});}};
}
