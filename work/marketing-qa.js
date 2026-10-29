// Local-only browser checks. Uses the existing isolated SDK, never live APIs.
const frame = document.querySelector('#preview');
const output = document.querySelector('#results');
const assert = (test, text) => { if (!test) throw new Error(text); };
const pause = () => new Promise(resolve => setTimeout(resolve, 30));
let navigation = 0;
async function load(path, width) {
  frame.style.width = width + 'px';
  const url = new URL('/__qa/' + path, location.origin);
  url.searchParams.set('qa-layout', String(++navigation));
  frame.src = url.href;
  await new Promise(resolve => frame.onload = resolve);
  await frame.contentDocument.fonts.ready;
  // Module imports can finish after the load event; check the settled route.
  if (path === 'index.html#setup') {
    for (let attempt=0; attempt<80 && !frame.contentDocument.body.classList.contains('setup-mode'); attempt++) await pause();
    assert(frame.contentDocument.body.classList.contains('setup-mode'), 'Setup route did not initialize');
  }
  await pause();
  return frame.contentDocument;
}
document.querySelector('#run').onclick = async () => {
  const button = document.querySelector('#run'); button.disabled = true;
  output.textContent = 'Running marketing checks...\n';
  let count = 0;
  try {
    // The preview origin contains only disposable local fixtures, not live sessions.
    localStorage.removeItem('scoutcard-age-group-v2');
    sessionStorage.removeItem('scoutcard-age-session-v1');
    for (const width of [320, 332, 375, 768, 1280]) {
      for (const path of ['index.html', 'index.html#setup', 'activate.html', 'about.html', 'parents.html', 'example-profile.html','family.html','parent-privacy.html','data-request.html','safety.html']) {
        const doc = await load(path, width);
        const win = frame.contentWindow;
        assert(doc.documentElement.scrollWidth <= win.innerWidth, path + ' overflows at ' + width);
        assert(win.scrollY === 0, path + ' jumped on initial load at ' + width);
        assert(doc.activeElement?.id !== 'scoutcard-age', 'Age control stole focus');
        // Exercise off-screen lazy images too, without scrolling past the setup choice.
        await Promise.all([...doc.images].map(async image => { image.loading = 'eager'; await image.decode(); }));
        assert([...doc.images].every(image => image.complete && image.naturalWidth > 0), path + ' has a broken image');
        if (path === 'index.html#setup') {
          assert([...doc.querySelectorAll('.buy-only')].every(node => win.getComputedStyle(node).display === 'none'), 'Buying content must not clutter setup: '+[...doc.querySelectorAll('.buy-only')].filter(node=>win.getComputedStyle(node).display!=='none').map(node=>node.className).join(', '));
          const gate = doc.querySelector('.scoutcard-age-gate');
          const roadmap = doc.querySelector('.setup-roadmap');
          assert(gate && roadmap.compareDocumentPosition(gate) & Node.DOCUMENT_POSITION_FOLLOWING, 'Gate must follow the setup introduction');
          assert(doc.querySelector('#profile').hidden, 'Age gate must still protect the form');
          const choices = doc.querySelector('.setup-choices');
          assert(choices && frame.contentWindow.getComputedStyle(choices).display !== 'none', 'Account choice must be visible before age gate');
          assert(choices.querySelector('a[href="family.html"]'), 'Parents must reach their dashboard without the individual age gate');
          assert(choices.querySelector('a[href="#account"]'), 'Athletes must reach the individual sign-in');
        }
        if (path === 'example-profile.html') {
          assert(doc.querySelector('.demo-notice').textContent.includes('fictional'), 'Demo must disclose fictional data');
          assert(!doc.querySelector('form'), 'Demo must not send messages or customer records');
          assert(!win.testState, 'Demo must not initialize an auth/database client');
        }
        count++; output.textContent += 'PASS ' + width + 'px / ' + path + '\n';
      }
    }
    const doc = await load('index.html', 375);
    assert(doc.querySelector('.hero .button').getAttribute('href') === '#setup', 'Primary CTA must start setup');
    assert(doc.querySelector('.hero .parent-hero-button').getAttribute('href') === 'parents.html', 'Parent hero action must open the separate information page');
    assert(!doc.querySelector('#parents,.parent-play'), 'Parent section must not remain on the landing page');
    assert(!doc.querySelector('.page-jumps'), 'Redundant section-navigation bar should be removed');
    assert(doc.querySelector('.hero .lede').textContent.split(/\s+/).length <= 16, 'Hero copy should stay concise');
    assert(doc.querySelectorAll('.share-grid article').length === 6, 'All six profile features must remain');
    assert(doc.querySelector('#order').textContent.includes('20-day returns'), 'Keep the return summary');
    assert(doc.querySelector('#order').textContent.includes('30 days of payment'), 'Keep the shipping timeframe');
    assert(doc.querySelector('#buy-at-your-pace'), 'Keep the buy-before-publishing explanation');
    assert(doc.querySelector('.hero').nextElementSibling.matches('.athlete-perspective'), 'Raymond testimonial must stay immediately below the hero');
    assert(doc.querySelectorAll('.athlete-perspective').length === 1, 'Testimonial must not be duplicated');
    const portraits = [...doc.querySelectorAll('.perspective-photo img')];
    assert(portraits.length === 2, 'Both testimonial portraits must display');
    for (const portrait of portraits) {
      portrait.scrollIntoView();
      await portrait.decode();
      assert(portrait.naturalWidth > 0, 'Both testimonial portraits must load');
    }
    assert(doc.querySelector('[aria-labelledby="raymond-title"] blockquote.recommendation').textContent === '“SCOUTCARD is a great tool that is going to help a lot of young athletes.”', 'Preserve Raymond’s exact supplied quote');
    assert(!doc.querySelector('[aria-labelledby="raymond-title"]').textContent.includes('Approved paraphrase'), 'Do not label Raymond’s direct quote as a paraphrase');
    assert(doc.querySelector('#preston-title').textContent === 'Preston Wagner', 'Preston must be identified');
    assert(doc.querySelector('[aria-labelledby="preston-title"] blockquote.recommendation').textContent === '“All high-school athletes should get a SCOUTCARD to reach their goals.”', 'Preserve Preston’s quote with the requested brand capitalization');
    const disclosure = doc.querySelector('.perspective-disclosure').textContent;
    assert(disclosure.includes('Raymond and Preston know SCOUTCARD’s founders personally'), 'Both personal connections must be disclosed');
    assert(disclosure.includes('not an endorsement by UVA'), 'UVA clarification must display');
    assert(doc.querySelectorAll('.perspective-stars svg').length === 5, 'Five stars must display');
    assert(doc.querySelector('.perspective-layout').children[1].matches('.perspective-rating'), 'The shared stars must stay between both athletes');
    for (const width of [375, 768, 1280]) {
      const layout = await load('index.html', width);
      const [raymond, stars, preston] = [...layout.querySelector('.perspective-layout').children].map(node => node.getBoundingClientRect());
      if (width > 760) {
        assert(raymond.right <= stars.left && stars.right <= preston.left, 'Both athletes must sit on opposite sides of the stars at ' + width);
        const row = layout.querySelector('.perspective-layout').getBoundingClientRect();
        assert(Math.abs((stars.left + stars.width / 2) - (row.left + row.width / 2)) < 2, 'Stars must be centered at ' + width);
      } else {
        assert(raymond.bottom <= stars.top && stars.bottom <= preston.top, 'Small screens must stack Raymond, stars, then Preston');
      }
    }
    assert(!doc.querySelector('.college-strip'), 'Non-customer college strip must not appear as proof');
    const parentDoc = await load('parents.html', 375);
    assert(parentDoc.querySelector('#parents a.button').getAttribute('href') === 'family.html', 'Separate parent page must reach the existing dashboard');
    assert(parentDoc.querySelector('#parents').textContent.includes('published profile'), 'Parent sharing must explain publishing');
    assert(parentDoc.querySelector('#parents').textContent.includes('does not automatically save a contact'), 'Do not imply automatic contact saving');
    localStorage.setItem('scoutcard-age-group-v2', JSON.stringify({version:2,band:'adult',permission:false,expiresAt:Date.now()+86400000}));
    for (const width of [320,390,768,1280]) {
      const checkout = await load('index.html#order', width), win = frame.contentWindow;
      for(let attempt=0;attempt<80 && (!checkout.querySelector('#order-form .scoutcard-form-disclosure') || checkout.querySelector('#order-form').hidden);attempt++) await pause();
      const form = checkout.querySelector('#order-form');
      assert(!form.hidden, 'Eligible adult must still see the purchase form');
      const checks = [...form.querySelectorAll('.scoutcard-form-disclosure input[type="checkbox"]')];
      assert(checks.length===2 && checks.every(input=>input.required && !input.checked), 'Keep both explicit, required, unchecked purchase consents');
      for(const input of checks) {
        const box=input.getBoundingClientRect(),label=input.closest('label'),text=label.querySelector('span').getBoundingClientRect();
        assert(box.width>=18 && box.width<=22 && box.height>=18 && box.height<=22, 'Consent checkbox must not stretch at '+width);
        assert(text.left>=box.right+8 && Math.abs(text.top-box.top)<=6, 'Consent text must align beside its checkbox at '+width);
        assert(label.getBoundingClientRect().height>=44, 'Consent label needs a comfortable click target');
        label.click(); assert(input.checked,'Clicking the label must select consent');label.click();assert(!input.checked,'Consent can be deselected');
      }
      assert(form.querySelector('[type="submit"]').getBoundingClientRect().height>=48,'Payment action must remain easy to tap');
      assert(checkout.documentElement.scrollWidth<=win.innerWidth,'Checkout must not overflow at '+width);
      output.textContent+='PASS checkout consent alignment / '+width+'px (no submission)\n';
    }
    localStorage.removeItem('scoutcard-age-group-v2');
    output.textContent += '\n' + count + ' responsive page checks plus athlete/parent paths, section navigation, CTA, portrait, rating and disclosure checks passed. No live customer data or payments used.';
  } catch (error) { output.textContent += '\nFAIL ' + error.message; }
  finally { button.disabled = false; }
};
