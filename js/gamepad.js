// Controller support (Gamepad API, standard mapping: Xbox / PlayStation / Switch Pro / most Android + iOS pads).
//   In game:  left stick move (click it to sprint) - right stick look - RT fire - LT aim (hold) - A jump - B crouch / slide - X reload - Y swap weapon
//             LB use (zombies) / inspect - RB killstreak - D-pad killstreaks (up UAV, left sentry, right airstrike), down scoreboard - R3 camera view
//             Select scoreboard (hold) - Start pause / resume
//   Menus:    left stick or D-pad moves the highlight, A selects, B goes back, left / right on a slider changes it.
import { STREAKS } from './streaks.js?v=0.18.6';

const DEAD = 0.14, LOOK_RATE = 2.9;         // rad/s at full right-stick deflection (x sensitivity setting)
const curve = (v) => { const a = Math.abs(v); if (a < DEAD) return 0; const t = (a - DEAD) / (1 - DEAD); return Math.sign(v) * t * (0.35 + 0.65 * t); };

export function initGamepad(game, $) {
  if (!navigator.getGamepads) return null;
  let prev = [], lastT = performance.now(), active = null, sprintLatch = false, navCool = 0, toasted = false;
  const crouchOn = () => !!game.keys.KeyC;

  function toast(text) {
    let el = document.getElementById('padToast');
    if (!el) { el = document.createElement('div'); el.id = 'padToast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200);
  }
  window.addEventListener('gamepadconnected', (e) => { toast('Controller connected: ' + e.gamepad.id.replace(/\(.*?\)/g, '').slice(0, 40)); document.body.classList.add('pad'); });
  window.addEventListener('gamepaddisconnected', () => { toast('Controller disconnected'); if (game.state === 'playing') game.pause(); });

  // ---------- menu navigation: move focus to the nearest visible control in the pressed direction ----------
  const SEL = 'button:not(:disabled), .card:not(.locked), select, input[type=range], input[type=checkbox], input[type=text], input:not([type]), .chip, .seg > *';
  function visible(el) { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; for (let n = el; n; n = n.parentElement) if (n.classList && n.classList.contains('hidden')) return false; return r.bottom > 0 && r.top < innerHeight; }
  function topOverlay() { const o = [...document.querySelectorAll('.overlay')].filter((x) => !x.classList.contains('hidden')); return o.length ? o[o.length - 1] : null; }
  function focusMove(dx, dy) {
    const root = topOverlay(); if (!root) return;
    const items = [...root.querySelectorAll(SEL)].filter(visible);
    if (!items.length) return;
    let cur = document.activeElement && items.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) { const pri = items.find((e) => e.classList.contains('primary') || e.classList.contains('sel')) || items[0]; pri.focus(); pri.scrollIntoView({ block: 'nearest' }); return; }
    const cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let best = null, bs = 1e9;
    for (const e of items) {
      if (e === cur) continue;
      const r = e.getBoundingClientRect(), x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy;
      const along = dx ? x * dx : y * dy, across = dx ? Math.abs(y) : Math.abs(x);
      if (along <= 4) continue;
      const s = along + across * 2.2; if (s < bs) { bs = s; best = e; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    else if (dy) { root.scrollBy({ top: dy * 120, behavior: 'smooth' }); }
  }
  function menuPad(gp, dt, pressed) {
    navCool -= dt;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    let dx = (gp.buttons[15] && gp.buttons[15].pressed ? 1 : 0) - (gp.buttons[14] && gp.buttons[14].pressed ? 1 : 0), dy = (gp.buttons[13] && gp.buttons[13].pressed ? 1 : 0) - (gp.buttons[12] && gp.buttons[12].pressed ? 1 : 0);
    if (!dx && !dy) { if (Math.abs(ax) > 0.6) dx = Math.sign(ax); else if (Math.abs(ay) > 0.6) dy = Math.sign(ay); }
    const a = document.activeElement;
    if ((dx || dy) && navCool <= 0) {
      navCool = 0.17;
      if (dx && a && a.type === 'range') { const st = parseFloat(a.step) || 1; a.value = String(parseFloat(a.value) + dx * st * 2); a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (dx && a && a.tagName === 'SELECT') { a.selectedIndex = Math.max(0, Math.min(a.options.length - 1, a.selectedIndex + dx)); a.dispatchEvent(new Event('change', { bubbles: true })); }
      else focusMove(dx, dy);
    }
    if (!dx && !dy) navCool = Math.min(navCool, 0);
    if (pressed(0)) { const f = document.activeElement; if (f && f !== document.body && f.click) f.click(); else focusMove(0, 1); }          // A
    if (pressed(1)) { const b = [...document.querySelectorAll('.overlay:not(.hidden) button')].find((x) => /^(back|‹ back|‹back|close|cancel)/i.test(x.textContent.trim().replace(/^[^\w]*/, '')) && visible(x)); if (b) b.click(); }   // B
    if ((pressed(9) || (pressed(1) && game.state === 'paused')) && game.state === 'paused') game.resume();                                                                            // Start
  }

  // ---------- gameplay ----------
  function play(gp, dt, down, pressed) {
    const p = game.player; if (!p) return;
    const lx = curve(gp.axes[0] || 0), ly = curve(gp.axes[1] || 0), rx = curve(gp.axes[2] || 0), ry = curve(gp.axes[3] || 0);
    // movement
    if (lx || ly || prev.joy) { game.joy.x = lx; game.joy.y = ly; prev.joy = !!(lx || ly); }          // (only touch the stick state while the pad is actually being used)
    if (pressed(10)) sprintLatch = !sprintLatch;                      // click the left stick to sprint
    if (Math.hypot(lx, ly) < 0.1 || game.adsHeld) sprintLatch = false;
    const sh = sprintLatch || (Math.hypot(lx, ly) > 0.97 && ly < -0.6); if (sh || prev.sh) { game.keys.ShiftLeft = sh; prev.sh = sh; }
    // look
    if (rx || ry) game.look(rx * dt * 1000 * LOOK_RATE / 1.0, ry * dt * 1000 * LOOK_RATE * 0.8, 0.001);
    // triggers (analog on most pads, plain buttons on some)
    const rt = gp.buttons[7] ? Math.max(gp.buttons[7].value, gp.buttons[7].pressed ? 1 : 0) : 0, lt = gp.buttons[6] ? Math.max(gp.buttons[6].value, gp.buttons[6].pressed ? 1 : 0) : 0;
    const fire = rt > 0.35, aim = lt > 0.35;
    if (fire !== !!prev.fire) { game.fireHeld = fire; if (fire) game.fireEdge = true; prev.fire = fire; }
    if (aim !== !!prev.aim) { game.adsHeld = aim; prev.aim = aim; }
    // buttons
    const jump = down(0); if (jump !== !!prev.jump) { game.keys.Space = jump; prev.jump = jump; }
    if (pressed(1)) game.keys.KeyC = !crouchOn();
    if (pressed(2)) game.startReload(p);
    if (pressed(3)) game.switchWeapon(p, 1 - p.cur);
    const use = down(4); if (use !== !!prev.use) { prev.use = use; if (game.zm) game.zm.localUse(use); else if (use) game.startInspect(); }
    const useStreak = (id) => { if (game.streaks && !game.net) game.streaks.use(id); };
    if (pressed(5)) { const s = STREAKS.find((x) => game.streaks && game.streaks.ready[x.id] > 0); if (s) useStreak(s.id); }
    if (pressed(12)) useStreak('uav'); if (pressed(14)) useStreak('sentry'); if (pressed(15)) useStreak('strike');
    const score = down(8) || down(13); if (score !== !!prev.score) { game.showScore = score; prev.score = score; }
    if (pressed(11)) game.toggleView && game.toggleView();
    if (pressed(9)) game.pause();
  }

  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter((g) => g && g.connected) : [];
    const gp = pads.find((g) => g.mapping === 'standard') || pads[0];
    if (!gp) { if (active) { active = null; prev = []; game.joy.x = game.joy.y = 0; } return; }
    if (!active || active.index !== gp.index) { active = gp; prev = []; }
    const down = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const was = frame.was || (frame.was = []);
    // edge detection: compare against the previous frame's snapshot
    const snap = gp.buttons.map((b) => !!(b && b.pressed));
    const edge = (i) => snap[i] && !was[i];
    if (game.state === 'playing') play(gp, dt, down, edge); else menuPad(gp, dt, edge);
    for (let i = 0; i < snap.length; i++) was[i] = snap[i];
    if (game.state !== 'playing' && prev.fire) { prev.fire = false; }
  }
  requestAnimationFrame(frame);
  return { toast };
}
