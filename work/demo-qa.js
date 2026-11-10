const output=document.getElementById('result');
const results=[];
function check(condition,description){if(!condition)throw Error(description);results.push('PASS · '+description);output.textContent=results.join('\n');}
const source=await (await fetch('../index.html')).text();
async function fixture({width=1280,reduced=false,js=true}={}){
 const iframe=document.createElement('iframe');iframe.style.width=width+'px';
 let html=source.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
 const setup=`window.__clock={now:100,callbacks:new Map(),next:1};window.requestAnimationFrame=fn=>{const id=__clock.next++;__clock.callbacks.set(id,fn);return id};window.cancelAnimationFrame=id=>__clock.callbacks.delete(id);window.__advance=ms=>{__clock.now+=ms;const callbacks=[...__clock.callbacks.values()];__clock.callbacks.clear();callbacks.forEach(fn=>fn(__clock.now))};window.__motion={matches:${reduced},listeners:[],addEventListener(type,fn){this.listeners.push(fn)}};const originalMatchMedia=window.matchMedia.bind(window);window.matchMedia=q=>q==='(prefers-reduced-motion: reduce)'?__motion:originalMatchMedia(q);window.__setMotion=value=>{__motion.matches=value;__motion.listeners.forEach(fn=>fn())};window.IntersectionObserver=class{observe(){}disconnect(){}};`;
 html=html.replace('<head>','<head><base href="'+location.origin+'/">');
 if(js)html=html.replace('</body>','<script>'+setup+'</script><script type="module" src="scoutcard-demo.js"></script></body>');
 iframe.srcdoc=html;document.getElementById('frames').replaceChildren(iframe);
 await new Promise(resolve=>iframe.onload=resolve);
 await new Promise(resolve=>setTimeout(resolve,150));
 const win=iframe.contentWindow,doc=iframe.contentDocument,$=s=>doc.querySelector(s);
 return {iframe,win,doc,$};
}
document.getElementById('run').onclick=async()=>{
 results.length=0;output.textContent='Running…';
 try{
  let f=await fixture();let {$,win}=f;
  check($('.scd-player').dataset.demoState==='idle'&&!$('.scd-controls').hidden,'Playback starts idle, never autoplays');
  check(!$('.scd-build .scd-identity').classList.contains('scd-pending'),'Initial poster frame contains a readable sample profile');
  $('.scd-play').click();win.__advance(16);win.__advance(4000);
  check($('.scd-player').dataset.demoState==='playing'&&$('[data-demo-step="0"]').getAttribute('aria-current')==='step','Play starts chapter 1 and reveals profile fields');
  check(!$('.scd-build .scd-stats').classList.contains('scd-pending'),'Sample stats become visible during profile assembly');
  $('.scd-play').click();const paused=$('.scd-progress').value;win.__advance(3000);
  check($('.scd-progress').value===paused&&$('.scd-player').dataset.demoState==='paused','Pause freezes the playback clock');
  $('.scd-play').click();win.__advance(16);win.__advance(2300);
  check(!$('.scd-connect').hidden&&$('.scd-activation-pill').textContent==='After delivery and activation','Chapter 2 shows the real card and activation qualifier');
  win.__advance(5000);
  check(!$('.scd-email').hidden&&$('.scd-build').hidden&&$('.scd-email-intro').classList.contains('scd-pending'),'Chapter 3 opens the email shell before its content');
  win.__advance(3500);
  check(!$('.scd-email-product').classList.contains('scd-pending'),'Card and profile appear inside the assembling email');
  win.__advance(4000);
  check(!$('.scd-email-finish').classList.contains('scd-pending')&&$('[data-demo-step="3"]').getAttribute('aria-current')==='step','Final chapter reveals CTA, activation instructions, and footer');
  win.__advance(5200);
  check($('.scd-progress').value===24&&$('.scd-player').dataset.demoState==='ended'&&$('.scd-play').textContent.includes('Replay demo'),'Sequence ends at 24 seconds with Replay demo');
  win.__advance(10000);check($('.scd-player').dataset.demoState==='ended','Finished demo does not loop');
  $('.scd-play').click();win.__advance(16);check($('.scd-progress').value===0&&$('.scd-email').hidden,'Replay restarts at chapter 1');
  $('.scd-full').click();check($('.scd-player').dataset.demoMode==='full'&&!$('.scd-email').hidden&&$('.scd-email-link').inert===false&&f.doc.activeElement.id==='scd-email-subject','Full-email control stops playback, expands the email, and moves focus');
  check(!f.doc.querySelector('.scd-pending'),'Full email reveals every block');
  check($('.scd-buy').getAttribute('href')==='#order'&&$('#scoutcard-demo').nextElementSibling.id==='order','Purchase CTA uses the existing purchase anchor and demo is adjacent');
  check($('.scd-email-link').getAttribute('href')==='example-profile.html','Sample email CTA opens the fictional profile');
  win.__setMotion(true);check($('.scd-play').hidden&&$('.scd-player').dataset.demoMode==='full','Changing to reduced motion stops animation immediately');
  f=await fixture({reduced:true});check(f.$('.scd-player').dataset.demoMode==='full'&&f.$('.scd-play').hidden&&!f.$('.scd-email').hidden,'Reduced motion starts with the complete static email');
  for(const width of [320,390,768,1280]){
   f=await fixture({width});f.$('.scd-full').click();
   const stage=f.$('.scd-stage'),card=f.$('.scd-product-grid .scd-card').getBoundingClientRect(),profile=f.$('.scd-product-grid .scd-profile').getBoundingClientRect();
   check(stage.scrollWidth<=stage.clientWidth+1&&f.doc.documentElement.scrollWidth<=width+1,`${width}px layout has no horizontal overflow`);
   if(width<600)check(card.bottom<=profile.top,`${width}px mobile layout stacks the card above the profile`);
   const img=f.$('.scd-product-grid img');check(img.complete&&img.naturalWidth===1536,`${width}px real card artwork loaded`);
  }
  f=await fixture({width:390,js:false});check(!f.$('.scd-email').hidden&&f.$('.scd-controls').hidden,'Without JavaScript, the full email remains readable');
  output.textContent=results.join('\n')+'\n\nALL '+results.length+' CHECKS PASSED';
 }catch(error){output.textContent=results.join('\n')+'\nFAIL · '+error.message;}
};
