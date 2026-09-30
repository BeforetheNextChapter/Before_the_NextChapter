/* Existing story reveals and reading progress. */
const progress = document.querySelector('.progress');
let progressFrame = 0;
const updateProgress = () => {
  progressFrame = 0;
  const height = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = `${height > 0 ? scrollY / height * 100 : 0}%`;
};
window.addEventListener('scroll', () => {
  if (!progressFrame) progressFrame = requestAnimationFrame(updateProgress);
}, { passive: true });
window.addEventListener('resize', updateProgress);
updateProgress();
const obs = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) {
    entry.target.classList.add('show');
    obs.unobserve(entry.target);
  }
}), { threshold: .15 });
document.querySelectorAll('.reveal').forEach(element => obs.observe(element));

/* One audio controller: explicit user choices always override automatic start. */
(() => {
  const audio = document.getElementById('chapterAudio');
  const orb = document.getElementById('musicOrb');
  const toggle = document.getElementById('musicToggle');
  const details = document.getElementById('musicDetails');
  const panel = document.getElementById('musicPanel');
  const volume = document.getElementById('musicVolume');
  const mute = document.getElementById('musicMute');
  const status = document.getElementById('musicStatus');
  const icon = toggle.querySelector('.music-orb__icon');
  let automatic = true;
  let pending = false;
  let wantsPlayback = false;
  audio.volume = Number(volume.value);

  const message = text => { status.textContent = text; };
  const sync = () => {
    const playing = !audio.paused && !audio.error;
    orb.classList.toggle('is-playing', playing);
    orb.classList.toggle('is-muted', audio.muted || audio.volume === 0);
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    icon.textContent = playing ? 'Ⅱ' : '▶';
    mute.setAttribute('aria-pressed', String(audio.muted || audio.volume === 0));
    mute.setAttribute('aria-label', audio.muted || audio.volume === 0 ? 'Unmute music' : 'Mute music');
    mute.textContent = audio.muted || audio.volume === 0 ? 'Unmute' : 'Mute';
  };
  const openPanel = open => {
    orb.classList.toggle('is-open', open);
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    details.setAttribute('aria-expanded', String(open));
    details.setAttribute('aria-label', open ? 'Close music settings' : 'Open music settings');
  };
  const play = async () => {
    if (pending) return;
    pending = true;
    wantsPlayback = true;
    orb.classList.add('is-loading');
    message('Opening this chapter’s soundtrack…');
    if (audio.error) audio.load();
    try {
      await audio.play();
      if (!wantsPlayback) audio.pause();
      else {
        automatic = false;
        message('Playing softly');
      }
    } catch (error) {
      message(error.name === 'NotAllowedError' ? 'Tap play to begin the music' : 'Unable to play · tap to retry');
    } finally {
      pending = false;
      orb.classList.remove('is-loading');
      sync();
    }
  };
  toggle.addEventListener('click', () => {
    automatic = false;
    if (pending || !audio.paused) {
      wantsPlayback = false;
      audio.pause();
      message('Paused · take your time');
      sync();
    } else play();
  });
  details.addEventListener('click', () => openPanel(!orb.classList.contains('is-open')));
  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
    audio.muted = audio.volume === 0;
    sync();
  });
  mute.addEventListener('click', () => {
    if (audio.volume === 0) { audio.volume = .22; volume.value = '.22'; audio.muted = false; }
    else audio.muted = !audio.muted;
    sync();
  });
  document.addEventListener('click', event => {
    if (!orb.contains(event.target)) openPanel(false);
    // A completed click, rather than a scroll gesture, is meaningful interaction.
    if (automatic && !orb.contains(event.target)) play();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && orb.classList.contains('is-open')) {
      openPanel(false);
      details.focus();
    }
    if (automatic && !event.repeat && ['Enter', ' '].includes(event.key) && !orb.contains(event.target)) play();
  });
  orb.addEventListener('focusout', event => {
    if (!orb.contains(event.relatedTarget)) openPanel(false);
  });
  audio.addEventListener('playing', () => { message('Playing softly'); orb.classList.remove('is-loading'); sync(); });
  audio.addEventListener('pause', () => { message('Paused · take your time'); sync(); });
  audio.addEventListener('waiting', () => { if (wantsPlayback) { message('Loading the music…'); orb.classList.add('is-loading'); } });
  audio.addEventListener('volumechange', sync);
  const audioError = () => { message('Music unavailable · tap to retry'); orb.classList.remove('is-loading'); sync(); };
  audio.addEventListener('error', audioError);
  audio.querySelector('source').addEventListener('error', audioError);
  sync();
})();

/* Pointer type switches per event so touch laptops support both systems.
   Decoration never captures events, changes scrolling, or alters original transforms. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(any-pointer: fine)');
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorGlow');
  const effects = document.getElementById('touchHearts');
  const ambient = document.createElement('div');
  ambient.className = 'pointer-ambient';
  ambient.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ambient);
  let x = 0, y = 0, rx = 0, ry = 0, frame = 0, lastTime = 0;
  let target = null, bounds = null, depth = null, depthBounds = null;
  let touchTime = -Infinity, touch = null;
  const cleanDepth = () => {
    if (depth) { depth.style.removeProperty('translate'); depth.style.removeProperty('--light-x'); depth.style.removeProperty('--light-y'); }
    depth = depthBounds = null;
  };
  const hide = () => {
    document.body.classList.remove('custom-cursor-active');
    ring.classList.remove('is-hover', 'is-image');
    ambient.classList.remove('is-visible');
    cancelAnimationFrame(frame);
    frame = 0; lastTime = 0;
    target = bounds = null;
    cleanDepth();
  };
  const animate = time => {
    frame = 0;
    const delta = Math.min(time - (lastTime || time - 16), 50);
    lastTime = time;
    const amount = 1 - Math.exp(-delta / 75);
    let tx = x, ty = y;
    if (bounds && target && !target.matches('input')) {
      tx += (bounds.left + bounds.width / 2 - x) * .12;
      ty += (bounds.top + bounds.height / 2 - y) * .12;
    }
    rx += (tx - rx) * amount; ry += (ty - ry) * amount;
    dot.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
    ambient.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    if (depth && depthBounds) {
      const dx = (x - depthBounds.left) / depthBounds.width - .5;
      const dy = (y - depthBounds.top) / depthBounds.height - .5;
      depth.style.translate = `${dx * 5}px ${dy * 5}px`;
      depth.style.setProperty('--light-x', `${(dx + .5) * 100}%`);
      depth.style.setProperty('--light-y', `${(dy + .5) * 100}%`);
    }
    if (Math.abs(tx - rx) + Math.abs(ty - ry) > .1) frame = requestAnimationFrame(animate);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(animate); };
  const hover = element => {
    const next = element.closest('a, button, input, [role="button"], .memory-collage, .artwork-frame, .quote-card, .paper');
    if (next === target) return;
    target = next;
    bounds = next?.getBoundingClientRect() || null;
    ring.classList.toggle('is-hover', !!next);
    ring.classList.toggle('is-image', !!next?.matches('.memory-collage, .artwork-frame, .quote-card, .paper'));
    cleanDepth();
    depth = element.closest('.memory-collage, .artwork-frame, .quote-card, .paper');
    depthBounds = depth?.getBoundingClientRect() || null;
  };
  const spawn = (px, py, heart = false) => {
    if (reduced.matches || effects.childElementCount >= 12 || document.hidden) return;
    const ripple = document.createElement('span');
    ripple.className = 'interaction-ripple';
    ripple.style.left = `${px}px`; ripple.style.top = `${py}px`;
    effects.appendChild(ripple);
    const remove = element => {
      element.addEventListener('animationend', () => element.remove(), { once: true });
      setTimeout(() => element.remove(), 1600);
    };
    remove(ripple);
    if (heart) {
      const element = document.createElement('span');
      element.className = 'touch-heart'; element.textContent = '♡';
      element.style.left = `${px}px`; element.style.top = `${py}px`;
      effects.appendChild(element); remove(element);
    }
  };
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') {
      if (touch && event.pointerId === touch.id && performance.now() - touchTime > 420 && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 45) {
        spawn(event.clientX, event.clientY, true); touchTime = performance.now();
        touch.x = event.clientX; touch.y = event.clientY;
      }
      return;
    }
    if (!fine.matches || reduced.matches || document.hidden) return;
    x = event.clientX; y = event.clientY;
    if (!document.body.classList.contains('custom-cursor-active')) { rx = x; ry = y; }
    document.body.classList.add('custom-cursor-active');
    ambient.classList.add('is-visible');
    hover(event.target);
    schedule();
  }, { passive: true });
  window.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') {
      hide();
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
      if (performance.now() - touchTime > 180) { spawn(event.clientX, event.clientY, true); touchTime = performance.now(); }
    } else if (event.button === 0) spawn(event.clientX, event.clientY);
  }, { passive: true });
  const endTouch = () => { touch = null; };
  window.addEventListener('pointerup', endTouch, { passive: true });
  window.addEventListener('pointercancel', endTouch, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('blur', hide);
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { hide(); effects.replaceChildren(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Tab') hide(); });
  reduced.addEventListener('change', () => { hide(); if (reduced.matches) effects.replaceChildren(); });
  fine.addEventListener('change', hide);
})();
