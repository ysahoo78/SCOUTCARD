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
      for (const path of ['index.html', 'index.html#setup', 'activate.html', 'about.html', 'example-profile.html','family.html']) {
        const doc = await load(path, width);
        const win = frame.contentWindow;
        assert(doc.documentElement.scrollWidth <= win.innerWidth, path + ' overflows at ' + width);
        assert(win.scrollY === 0, path + ' jumped on initial load at ' + width);
        assert(doc.activeElement?.id !== 'scoutcard-age', 'Age control stole focus');
        assert([...doc.images].every(image => image.complete && image.naturalWidth > 0), path + ' has a broken image');
        if (path === 'index.html#setup') {
          const gate = doc.querySelector('.scoutcard-age-gate');
          const roadmap = doc.querySelector('.setup-roadmap');
          assert(gate && roadmap.compareDocumentPosition(gate) & Node.DOCUMENT_POSITION_FOLLOWING, 'Gate must follow the setup introduction');
          assert(doc.querySelector('#profile').hidden, 'Age gate must still protect the form');
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
    doc.querySelector('.perspective-photo').scrollIntoView();
    await doc.querySelector('.perspective-photo img').decode();
    assert(doc.querySelector('.perspective-photo img').naturalWidth > 0, 'Approved portrait must load');
    assert(doc.querySelector('.recommendation').textContent.includes('great idea'), 'Recommendation missing');
    assert(doc.querySelector('.perspective-disclosure').textContent.includes('not an endorsement by UVA'), 'Personal-recommendation disclosure missing');
    assert(!doc.querySelector('.college-strip'), 'Non-customer college strip must not appear as proof');
    output.textContent += '\n' + count + ' responsive page checks plus CTA, photo, and disclosure checks passed. No live customer data or payments used.';
  } catch (error) { output.textContent += '\nFAIL ' + error.message; }
  finally { button.disabled = false; }
};
