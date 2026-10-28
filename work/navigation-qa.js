const frame=document.getElementById('preview'),out=document.getElementById('results');
const wait=async check=>{const end=Date.now()+8000;while(Date.now()<end){if(check())return;await new Promise(r=>setTimeout(r,25));}throw Error('Navigation did not finish loading');};
document.getElementById('run').onclick=async()=>{
  let count=0;out.textContent='Running four-action navigation checks…\n';
  try{
    for(const width of [320,390,768,1280])for(const path of ['index.html#email','about.html','activate.html','family.html#email']){
      frame.style.width=width+'px';let loaded=false;frame.onload=()=>loaded=true;frame.src='/__qa/'+path;await wait(()=>loaded);
      const doc=frame.contentDocument,win=frame.contentWindow;
      await wait(()=>doc.querySelectorAll('header .primary-actions a').length===4);
      if(path.includes('#email'))await wait(()=>path.startsWith('index')?doc.body.classList.contains('email-mode'):!doc.getElementById('family-action-entry').hidden);
      await doc.fonts.ready;
      const links=[...doc.querySelectorAll('header .primary-actions a')];
      if(links.map(a=>a.textContent).join('|')!=='Set Up Profile|Buy The Card|Activate The Card|Send An Email')throw Error('Wrong action labels');
      if(win.innerWidth!==width)throw Error('Unexpected iframe viewport');
      for(const link of links){const box=link.getBoundingClientRect();if(box.width<44||box.height<44||box.x<0||box.right>width+1||win.getComputedStyle(link).display==='none')throw Error('Clipped or undersized navigation action');}
      if(doc.documentElement.scrollWidth>width+1)throw Error('Horizontal overflow');
      if(doc.querySelectorAll('header .primary-actions [aria-current="page"]').length>1)throw Error('Multiple current actions');
      out.textContent+='PASS '+(++count)+' '+path+' at '+width+'px: four visible keyboard links, 44px+ targets, no overflow\n';
    }
    out.textContent+='COMPLETE: '+count+' responsive layouts passed. No sign-in emails or payments.\n';
  }catch(error){out.textContent+='FAIL '+error.message;}
};
