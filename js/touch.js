// Touch controls for phones and tablets: floating move stick (left), look pad (right), fire / aim / jump / crouch / reload / swap buttons,
// use (zombies), killstreaks, scoreboard and pause. It drives the same state the keyboard and mouse do (game.keys, game.joy, game.fireHeld ...).
import { STREAKS } from './streaks.js?v=0.17.0';

export function wantsTouch() {
  const q = new URLSearchParams(location.search);
  if (q.get('touch') === '0') return false;
  if (q.has('touch')) return true;
  let coarse = false; try { coarse = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch (e) { /* old browser */ }
  return coarse || (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && (navigator.maxTouchPoints || 0) > 0);
}

// Stop the browser zooming when you tap quickly or pinch (double-tap zoom), on any touch device
export function blockZoom() {
  if (!(navigator.maxTouchPoints > 0 || 'ontouchstart' in window)) return;
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  let last = 0;
  document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - last < 350 && e.cancelable) e.preventDefault(); last = n; }, { passive: false });
  document.addEventListener('touchstart', (e) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
}

export function initTouch(game, $) {
  if (!wantsTouch()) return null;
  game.touchMode = true; document.body.classList.add('touch');
  const root = document.createElement('div'); root.id = 'touch';
  root.innerHTML = `
    <div id="tLook"></div>
    <div id="tStickZone"></div>
    <div id="tStick"><i id="tKnob"></i></div>
    <button class="tb" id="tFire"   data-l="FIRE"></button>
    <button class="tb" id="tAds"    data-l="AIM"></button>
    <button class="tb" id="tJump"   data-l="JUMP"></button>
    <button class="tb" id="tCrouch" data-l="CROUCH"></button>
    <button class="tb" id="tReload" data-l="RELOAD"></button>
    <button class="tb" id="tSwap"   data-l="SWAP"></button>
    <button class="tb" id="tUse"    data-l="USE"></button>
    <div id="tStreaks"></div>
    <button class="tb small" id="tScore" data-l="TAB"></button>
    <button class="tb small" id="tPause" data-l="II"></button>`;
  document.body.appendChild(root);
  const rot = document.createElement('div'); rot.id = 'tRotate'; rot.innerHTML = '<b>Rotate your phone</b><span>Iron Strike plays in landscape</span>'; document.body.appendChild(rot);
  const g = (id) => root.querySelector('#' + id);
  const P = () => game.player;
  const LOOK_K = 0.0042;

  // ---- move stick (floating: appears where the thumb lands) ----
  const stick = g('tStick'), knob = g('tKnob'), zone = g('tStickZone'), R = 58;
  let sid = null, ox = 0, oy = 0;
  const setStick = (x, y) => {
    let dx = (x - ox) / R, dy = (y - oy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    game.joy.x = dx; game.joy.y = dy; knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
    game.keys.ShiftLeft = Math.hypot(dx, dy) > 0.93 && dy < -0.55;          // pushed right to the rim, forwards = sprint
  };
  const endStick = () => { sid = null; game.joy.x = game.joy.y = 0; game.keys.ShiftLeft = false; knob.style.transform = ''; stick.classList.remove('live'); stick.style.left = stick.style.top = ''; };
  zone.addEventListener('pointerdown', (e) => {
    if (sid !== null) return; sid = e.pointerId; zone.setPointerCapture(sid);
    ox = Math.max(R + 8, Math.min(innerWidth * 0.45, e.clientX)); oy = Math.max(R + 8, Math.min(innerHeight - R - 8, e.clientY));
    stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.classList.add('live'); setStick(e.clientX, e.clientY); e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === sid) setStick(e.clientX, e.clientY); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(t, (e) => { if (e.pointerId === sid) endStick(); });

  // ---- look pad: drag anywhere on the right ----
  const dragLook = (el, onDown, onUp) => {
    const last = new Map();
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); last.set(e.pointerId, [e.clientX, e.clientY]); if (onDown) onDown(e); e.preventDefault(); });
    el.addEventListener('pointermove', (e) => { const l = last.get(e.pointerId); if (!l) return; game.look(e.clientX - l[0], e.clientY - l[1], LOOK_K); l[0] = e.clientX; l[1] = e.clientY; });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, (e) => { if (last.delete(e.pointerId) && onUp) onUp(e); });
  };
  dragLook(g('tLook'));

  // ---- buttons ----
  const hold = (id, down, up) => {
    const b = g(id); b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); b.classList.add('down'); down(e); e.preventDefault(); e.stopPropagation(); });
    for (const t of ['pointerup', 'pointercancel']) b.addEventListener(t, (e) => { if (!b.classList.contains('down')) return; b.classList.remove('down'); if (up) up(e); });
  };
  const tap = (id, fn) => hold(id, fn);
  dragLook(g('tFire'), () => { game.fireHeld = true; game.fireEdge = true; g('tFire').classList.add('down'); }, () => { game.fireHeld = false; g('tFire').classList.remove('down'); });   // fire and swipe to aim at the same time
  g('tFire').addEventListener('pointerdown', (e) => e.stopPropagation());
  tap('tAds', () => { game.adsHeld = !game.adsHeld; });
  hold('tJump', () => { game.keys.Space = true; }, () => { game.keys.Space = false; });
  tap('tCrouch', () => { game.keys.KeyC = !game.keys.KeyC; });
  tap('tReload', () => { if (P()) game.startReload(P()); });
  tap('tSwap', () => { if (P()) game.switchWeapon(P(), 1 - P().cur); });
  hold('tUse', () => { if (game.zm) game.zm.localUse(true); }, () => { if (game.zm) game.zm.localUse(false); });
  hold('tScore', () => { game.showScore = true; }, () => { game.showScore = false; });
  tap('tPause', () => game.pause());
  const sk = g('tStreaks');
  for (const s of STREAKS) { const b = document.createElement('button'); b.className = 'tb small'; b.dataset.l = s.name.split(' ')[0]; b.id = 'tS_' + s.id; sk.appendChild(b); b.addEventListener('pointerdown', (e) => { if (game.streaks) game.streaks.use(s.id); e.preventDefault(); e.stopPropagation(); }); }
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- full screen + landscape on the first tap (Android; iOS Safari ignores it: use Share > Add to Home Screen) ----
  let fs = false;
  document.addEventListener('click', () => {
    if (fs) return; fs = true;
    try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => Promise.resolve())).call(el).catch(() => {}); } catch (e) { /* ignore */ }
    try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ }
  }, { capture: true });

  // ---- per-frame sync: show only while playing, mirror toggles, show only the buttons that matter ----
  let was = false;
  const loop = () => {
    requestAnimationFrame(loop);
    const on = game.state === 'playing';
    root.classList.toggle('on', on); rot.classList.toggle('on', on && innerHeight > innerWidth);
    if (!on) { if (was) { endStick(); was = false; } return; }
    was = true;
    g('tAds').classList.toggle('active', !!game.adsHeld); g('tCrouch').classList.toggle('active', !!game.keys.KeyC);
    g('tUse').style.display = game.zm ? '' : 'none';
    g('tScore').style.display = game.zm ? 'none' : '';
    sk.style.display = game.streaks && !game.net ? '' : 'none';
    for (const s of STREAKS) { const b = g('tS_' + s.id); if (b) b.classList.toggle('ready', !!(game.streaks && game.streaks.ready[s.id] > 0)); }
  };
  requestAnimationFrame(loop);
  return { root };
}
