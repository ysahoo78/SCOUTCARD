const frame=document.getElementById('preview'),out=document.getElementById('results');
const wait=async test=>{const end=Date.now()+8000;while(Date.now()<end){if(test())return;await new Promise(r=>setTimeout(r,25));}throw Error('Footer did not finish loading');};
const check=(value,message)=>{if(!value)throw Error(message);};
document.getElementById('run').onclick=async()=>{
  let count=0;out.textContent='Running shared footer checks…\n';
  try{
    for(const width of [320,390,768,1280])for(const path of ['index.html','about.html','parents.html','activate.html','family.html','privacy.html','refunds.html','parent-privacy.html','profile.html','card.html']){
      frame.style.width=width+'px';let loaded=false;frame.onload=()=>loaded=true;frame.src='/__qa/'+path;await wait(()=>loaded);
      const doc=frame.contentDocument,win=frame.contentWindow;
      await wait(()=>doc.getElementById('scoutcard-footer')&&doc.querySelector('link[href="footer.css"]')?.sheet);
      await doc.fonts.ready;
      const footer=doc.getElementById('scoutcard-footer'),links=[...footer.querySelectorAll('a')];
      check(doc.querySelectorAll('body>footer').length===1,'Duplicate footer: '+path);
      check(!doc.querySelector('header .header-utility,header a[href="about.html"]'),'Secondary links remain in header');
      if(doc.querySelector('header .primary-actions'))check(doc.querySelectorAll('header .primary-actions a').length===4,'Four primary actions must remain');
      for(const href of ['about.html','parents.html','family.html','privacy.html','terms.html','refunds.html','cookies.html','parent-privacy.html','data-request.html','safety.html'])check(links.some(a=>a.href===new URL(href,doc.baseURI).href),'Missing footer destination: '+href);
      if(doc.querySelector('header .primary-actions'))check([...footer.querySelectorAll('.footer-start a')].every((a,index)=>a.href===doc.querySelectorAll('header .primary-actions a')[index].href),'Footer shortcuts must preserve header context');
      check(links.some(a=>a.getAttribute('href')==='mailto:scout.card26@gmail.com'),'Missing support email');
      check(footer.textContent.includes('Yash Sahoo and Toryn Ibarra')&&footer.textContent.includes('Virginia, United States'),'Missing business details');
      check(footer.querySelectorAll('.footer-social-link svg').length===2,'Social logos missing');
      check(footer.querySelectorAll('.footer-social-link[target="_blank"][rel="noopener noreferrer"]').length===2,'External links need safe targets');
      check(doc.documentElement.scrollWidth<=win.innerWidth+1,'Horizontal overflow: '+path+' '+width);
      for(const link of links){const box=link.getBoundingClientRect();check(box.x>=-1&&box.right<=width+1,'Footer link clipped');}
      const settings=footer.querySelector('button');settings.click();
      const notice=doc.getElementById('scoutcard-storage-notice');
      check(!notice.hidden&&settings.getAttribute('aria-expanded')==='true','Cookie Settings must still open existing notice');
      notice.querySelector('button').click();
      check(notice.hidden&&doc.activeElement===settings,'Cookie dismissal must return keyboard focus');
      if(path==='index.html'){
        check(doc.querySelector('#signin-form input[name="terms_acknowledgment"]')?.required,'Sign-in consent removed');
        check(doc.querySelector('#order-form input[name="adult_purchaser"]')?.required,'Adult purchase requirement removed');
      }
      if(path==='profile.html')check(footer.textContent.includes('Profile information is supplied'),'Profile attribution removed');
      out.textContent+='PASS '+(++count)+' '+path+' at '+width+'px: one footer, policies/contact/socials, cookie controls, no overflow\n';
    }
    out.textContent+='COMPLETE: '+count+' shared footer layouts passed. Local synthetic data only.\n';
  }catch(error){out.textContent+='FAIL '+error.message;}
};
