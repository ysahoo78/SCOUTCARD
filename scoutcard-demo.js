// An illustrative, local-only animation. No profile writes, email sends, or API calls.
const root = document.getElementById('scoutcard-demo');
if (root) {
  const $ = selector => root.querySelector(selector);
  const player = $('.scd-player');
  const stage = $('.scd-stage');
  const build = $('.scd-build');
  const email = $('.scd-email');
  const play = $('.scd-play');
  const full = $('.scd-full');
  const status = $('.scd-status');
  const progress = $('.scd-progress');
  const time = $('.scd-time');
  const steps = [...root.querySelectorAll('[data-demo-step]')];
  const reveals = [...root.querySelectorAll('[data-demo-reveal]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 24000;
  const chapterText = [
    '1 of 4 · Building a fictional athlete profile.',
    '2 of 4 · The card opens the profile after delivery and activation.',
    '3 of 4 · Assembling an illustrative email preview.',
    '4 of 4 · The finished email. Scroll to explore, or view the full email.'
  ];
  let elapsed = 0;
  let lastFrame = 0;
  let frame = 0;
  let chapter = -1;
  let playing = false;
  let lastCue = -1;
  let manuallyScrolled = false;

  function announce(text) { status.textContent = text; }
  function stop() {
    playing = false;
    cancelAnimationFrame(frame);
    lastFrame = 0;
  }
  function setPlayLabel(label, symbol) {
    play.replaceChildren();
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = symbol;
    play.append(icon, document.createTextNode(` ${label}`));
  }
  function revealAll() {
    reveals.forEach(node => { node.classList.remove('scd-pending'); node.inert = false; });
  }
  function updateProgress() {
    const seconds = Math.floor(elapsed / 1000);
    progress.value = elapsed / 1000;
    progress.setAttribute('aria-valuetext', `${seconds} of 24 seconds`);
    time.textContent = `0:${String(seconds).padStart(2, '0')} / 0:24`;
  }
  function scrollToCue(node) {
    if (manuallyScrolled) return;
    const offset = node.getBoundingClientRect().top - stage.getBoundingClientRect().top + stage.scrollTop - 18;
    stage.scrollTo({top: Math.max(0, offset), behavior: 'smooth'});
  }
  function render() {
    const nextChapter = elapsed < 6000 ? 0 : elapsed < 11000 ? 1 : elapsed < 18500 ? 2 : 3;
    if (nextChapter !== chapter) {
      chapter = nextChapter;
      steps.forEach((step, index) => {
        if (index === chapter) step.setAttribute('aria-current', 'step');
        else step.removeAttribute('aria-current');
      });
      announce(chapterText[chapter]);
      build.hidden = chapter >= 2;
      email.hidden = chapter < 2;
      build.classList.toggle('is-connected', chapter === 1);
      $('.scd-connect').hidden = chapter !== 1;
      $('.scd-scene-heading h3').textContent = chapter === 1 ? 'One card. Your profile.' : 'Your athlete profile.';
      $('.scd-build-caption').textContent = chapter === 1 ? 'Tap with a compatible NFC phone.' : 'Add the details you want to share.';
      // Scene changes stay inside the player and never move the page itself.
      if (chapter !== 3) { stage.scrollTop = 0; manuallyScrolled = false; }
    }
    reveals.forEach(node => {
      const pending = elapsed < Number(node.dataset.demoReveal);
      node.classList.toggle('scd-pending', pending);
      node.inert = pending;
    });
    // Reveal each readable block, then gently follow it within the email viewport.
    // Manual scrolling takes over for the rest of that scene.
    const cue = elapsed >= 18500 ? 5 : elapsed >= 16500 ? 4 : elapsed >= 14500 ? 3 : elapsed >= 11000 ? 2 : elapsed >= 8500 ? 1 : elapsed >= 3700 ? .5 : 0;
    if (cue !== lastCue) {
      lastCue = cue;
      if ((cue === .5 || cue === 1) && stage.clientWidth < 600) scrollToCue($('.scd-build .scd-profile'));
      if (cue === 3) scrollToCue($('.scd-email-product'));
      if (cue === 4) scrollToCue($('.scd-inclusions'));
      if (cue === 5) scrollToCue($('.scd-email-finish'));
    }
    updateProgress();
  }
  function tick(now) {
    if (!playing) return;
    if (lastFrame) elapsed = Math.min(duration, elapsed + now - lastFrame);
    lastFrame = now;
    render();
    if (elapsed === duration) {
      stop();
      player.dataset.demoState = 'ended';
      setPlayLabel('Replay demo', '↻');
      announce('Demo complete. Replay it, view the full email, or get your SCOUTCARD.');
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function pause(message = 'Demo paused. Select Resume demo to continue.') {
    if (!playing) return;
    stop();
    // Cancel any in-flight smooth scrolling as well as the playback clock.
    stage.scrollTo({top: stage.scrollTop, behavior: 'instant'});
    player.dataset.demoState = 'paused';
    setPlayLabel('Resume demo', '▶');
    announce(message);
  }
  function showFull({focus = true} = {}) {
    stop();
    elapsed = duration;
    player.dataset.demoMode = 'full';
    player.dataset.demoState = 'ended';
    build.hidden = true;
    email.hidden = false;
    revealAll();
    stage.scrollTop = 0;
    steps.forEach((step, index) => index === 3 ? step.setAttribute('aria-current', 'step') : step.removeAttribute('aria-current'));
    updateProgress();
    setPlayLabel('Replay demo', '↻');
    announce(reducedMotion.matches ? 'Reduced motion enabled. The complete static email is shown.' : 'Full sample email. Take your time exploring the preview.');
    if (focus) $('#scd-email-subject').focus({preventScroll: true});
  }
  function start() {
    if (reducedMotion.matches) { showFull(); return; }
    const freshPlayback = player.dataset.demoState !== 'paused';
    if (elapsed >= duration || player.dataset.demoMode === 'full' || player.dataset.demoState === 'idle') {
      elapsed = 0;
      chapter = -1;
      lastCue = -1;
      manuallyScrolled = false;
      stage.scrollTop = 0;
    }
    player.dataset.demoMode = 'animation';
    player.dataset.demoState = 'playing';
    playing = true;
    render();
    setPlayLabel('Pause demo', 'Ⅱ');
    announce(chapterText[chapter]);
    // An explicit play/replay brings the player into view once; scenes scroll only inside it.
    if (freshPlayback) player.scrollIntoView({block: 'start', behavior: 'smooth'});
    frame = requestAnimationFrame(tick);
  }

  $('.scd-controls').hidden = false;
  play.addEventListener('click', () => playing ? pause() : start());
  full.addEventListener('click', () => showFull());
  // Avoid changing scenes while a visitor reads, interacts, or moves to another task.
  stage.addEventListener('focusin', () => pause('Demo paused while you explore the preview.'));
  for (const event of ['wheel', 'touchstart', 'keydown']) stage.addEventListener(event, () => { manuallyScrolled = true; }, {passive: true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('hashchange', () => pause());
  const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) pause(); });
  observer.observe(root);
  function applyMotionPreference() {
    play.hidden = reducedMotion.matches;
    full.hidden = reducedMotion.matches;
    if (reducedMotion.matches) showFull({focus: false});
  }
  reducedMotion.addEventListener('change', applyMotionPreference);
  if (reducedMotion.matches) applyMotionPreference();
  else {
    player.dataset.demoMode = 'animation';
    render();
    // A useful poster frame before playback, rather than an empty profile.
    revealAll();
    build.classList.add('is-connected');
    $('.scd-connect').hidden = false;
    $('.scd-scene-heading h3').textContent = 'Your card. Your story.';
    $('.scd-build-caption').textContent = 'See how it all comes together.';
    steps.forEach(step => step.removeAttribute('aria-current'));
    announce('Play the 24-second walkthrough, or view the full sample email.');
  }
}
