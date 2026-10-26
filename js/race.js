// Dirt Bike Race: a gun-free racing mode. Rendering, input and HUD live here; the simulation is in race-core.js.
import * as THREE from 'three';
import { RaceSim, HW, VMAX } from './race-core.js?v=0.14.1';
import { RaceNet, COLOR_NAMES, MAX_HUMANS, MAX_RIDERS } from './racenet.js?v=0.14.1';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => { const T = Math.PI * 2; a %= T; if (a > Math.PI) a -= T; if (a < -Math.PI) a += T; return a; };
const fmt = (t) => { if (!isFinite(t) || t < 0) t = 0; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] || 'th');
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const BIKE_COLORS = { Red: 0xd8281c, Blue: 0x1f6fd1, Green: 0x2fae4a, Yellow: 0xf0b400, Orange: 0xe86a1a, Purple: 0x8e44ad };

// ------------------------------------------------------------------ the bike model
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.6, metalness: o.m ?? 0.1 });
export function makeBikeMesh(color = 0xd8281c, jersey = 0x222831) {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = new THREE.Group(); root.add(body);
  const P = mat(color, { r: 0.45 }), BLK = mat(0x15171a, { r: 0.8 }), STEEL = mat(0xb9c0c7, { r: 0.35, m: 0.8 }), GRY = mat(0x3a3f46, { r: 0.6, m: 0.4 }), WHT = mat(0xf4f4f4, { r: 0.6 });
  const box = (parent, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.position.set(x, y, z); q.rotation.set(rx, ry, rz); q.castShadow = true; parent.add(q); return q; };
  const limb = (parent, a, b, t, m) => {                                   // a box from point a to point b (long axis = z)
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz) || 0.01;
    const q = new THREE.Mesh(new THREE.BoxGeometry(t, t, l), m); q.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    q.rotation.order = 'YXZ'; q.rotation.set(-Math.asin(dy / l), Math.atan2(dx, dz), 0); q.castShadow = true; parent.add(q); return q;
  };
  const wheel = (r, z, width) => {
    const piv = new THREE.Group(); piv.position.set(0, 0, 0);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 22), BLK); tire.rotation.z = Math.PI / 2; tire.castShadow = true; piv.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, width + 0.02, 18), STEEL); rim.rotation.z = Math.PI / 2; piv.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, width + 0.1, 8), GRY); hub.rotation.z = Math.PI / 2; piv.add(hub);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const k = new THREE.Mesh(new THREE.BoxGeometry(width * 1.05, 0.05, 0.075), BLK); k.position.set(0, Math.sin(a) * (r + 0.01), Math.cos(a) * (r + 0.01)); k.rotation.x = -a; piv.add(k); }
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, r * 1.4, 0.02), STEEL); s.rotation.x = i * Math.PI / 4; piv.add(s); }
    return piv;
  };
  // frame / engine / bodywork (the bike faces -z, wheels sit on y = 0)
  const rear = wheel(0.38, 0.72, 0.15), front = wheel(0.4, -0.72, 0.13);
  const rearG = new THREE.Group(); rearG.position.set(0, 0.38, 0.72); rearG.add(rear); body.add(rearG);
  const steerG = new THREE.Group(); steerG.position.set(0, 0.4, -0.72); body.add(steerG);
  const frontG = new THREE.Group(); frontG.add(front); steerG.add(frontG);
  box(body, 0.26, 0.3, 0.38, GRY, 0, 0.5, 0.04);                                          // engine
  box(body, 0.12, 0.14, 0.95, STEEL, 0, 0.68, 0.0, 0.1);                                   // frame spine
  box(body, 0.1, 0.5, 0.1, STEEL, 0, 0.55, -0.34, 0.28);                                   // down tube / neck
  box(body, 0.28, 0.24, 0.46, P, 0, 0.86, -0.22, 0.05);                                    // tank + shrouds
  box(body, 0.22, 0.1, 0.66, BLK, 0, 0.86, 0.3, 0.06);                                     // seat
  box(body, 0.22, 0.05, 0.56, P, 0, 0.98, 0.74, 0.35);                                     // rear fender
  box(body, 0.05, 0.05, 0.78, STEEL, 0.1, 0.41, 0.4, -0.08); box(body, 0.05, 0.05, 0.78, STEEL, -0.1, 0.41, 0.4, -0.08);   // swingarm
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.62, 10), STEEL); ex.rotation.x = Math.PI / 2 - 0.12; ex.position.set(0.19, 0.62, 0.5); ex.castShadow = true; body.add(ex);
  box(body, 0.06, 0.06, 0.44, STEEL, 0.17, 0.5, 0.0);                                       // exhaust header
  box(body, 0.2, 0.2, 0.03, WHT, 0, 0.9, -0.5, 0.45);                                      // number plate
  limb(steerG, [0.08, 0, 0], [0.08, 0.62, 0.24], 0.05, STEEL); limb(steerG, [-0.08, 0, 0], [-0.08, 0.62, 0.24], 0.05, STEEL);   // forks
  box(steerG, 0.16, 0.04, 0.42, P, 0, 0.3, -0.04, -0.12);                                   // front fender
  box(steerG, 0.76, 0.035, 0.035, STEEL, 0, 0.7, 0.26);                                    // handlebar
  box(steerG, 0.12, 0.04, 0.04, BLK, 0.36, 0.7, 0.26); box(steerG, 0.12, 0.04, 0.04, BLK, -0.36, 0.7, 0.26);
  // rider
  const rider = new THREE.Group(); body.add(rider);
  const J = mat(jersey, { r: 0.8 }), PANTS = mat(0x1b1d22, { r: 0.8 }), BOOT = mat(0x2a2a2a, { r: 0.7 }), HELM = mat(color, { r: 0.3, m: 0.3 }), VIS = mat(0x10151c, { r: 0.1, m: 0.6 });
  const torso = box(rider, 0.36, 0.5, 0.24, J, 0, 1.2, 0.08, -0.5); void torso;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), HELM); head.position.set(0, 1.58, -0.12); head.castShadow = true; rider.add(head);
  box(rider, 0.22, 0.09, 0.16, VIS, 0, 1.58, -0.26);
  box(rider, 0.2, 0.04, 0.2, HELM, 0, 1.7, -0.3, 0.2);                                       // peak
  for (const s of [-1, 1]) {
    limb(rider, [s * 0.2, 1.38, 0.0], [s * 0.3, 1.15, -0.2], 0.1, J); limb(rider, [s * 0.3, 1.15, -0.2], [s * 0.36, 0.96, -0.46], 0.085, BLK);          // arms to the grips
    limb(rider, [s * 0.14, 0.96, 0.28], [s * 0.24, 0.78, -0.02], 0.15, PANTS); limb(rider, [s * 0.24, 0.78, -0.02], [s * 0.22, 0.4, 0.14], 0.12, PANTS);   // thigh, shin
    box(rider, 0.1, 0.1, 0.26, BOOT, s * 0.22, 0.34, 0.08);
  }
  return { root, body, rear, front, steerG, rider, head };
}

// ------------------------------------------------------------------ the whole game mode
export class RaceMode {
  constructor(game, $, showScreen) {
    this.game = game; this.$ = $; this.showScreen = showScreen; this.sim = null; this.active = false; this.paused = false;
    this.keys = {}; this.touch = {}; this.padPrev = {}; this.cfg = { laps: 3, diff: 'normal', color: 'Red', bots: 5 }; this.net = null; this.endAcc = 0;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 700);
    this.buildDom();
    this._kd = (e) => this.onKey(e, true); this._ku = (e) => this.onKey(e, false);
  }

  // ---------------- DOM: setup menu, HUD, pause and results
  buildDom() {
    const mk = (id, cls, html) => { const d = document.createElement('div'); d.id = id; d.className = cls; d.innerHTML = html; document.body.appendChild(d); return d; };
    let best = ''; try { best = localStorage.getItem('ironstrike.race.best') || ''; } catch (e) { /* storage blocked */ }
    this.menu = mk('raceMenu', 'overlay hidden', `<div class="panel racepanel"><h2>DIRT BIKE RACE</h2>
      <p class="rsub">No guns. A dirt track with four jumps. Race bots, race friends online, or both. Hold the throttle, hit the kickers and keep it pinned.</p>
      <div class="rrow"><label for="rLaps">Laps</label><select id="rLaps"><option value="0">Free ride (no race)</option><option value="1">1 lap</option><option value="3" selected>3 laps</option><option value="5">5 laps</option></select></div>
      <div class="rrow"><label for="rBots">Bots</label><select id="rBots"><option value="0">None (just you)</option><option value="1">1 bot</option><option value="3">3 bots</option><option value="5" selected>5 bots</option></select></div>
      <div class="rrow"><label for="rDiff">Bot skill</label><select id="rDiff"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option></select></div>
      <div class="rrow"><label for="rColor">Your bike</label><select id="rColor">${Object.keys(BIKE_COLORS).map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="rkeys"><b>W / &uarr;</b> throttle &middot; <b>S / &darr;</b> brake &middot; <b>A D / &larr; &rarr;</b> steer &middot; <b>Shift / Space</b> nitro &middot; <b>R</b> reset to track &middot; <b>V</b> camera &middot; <b>Esc</b> pause<br>Controller: RT gas, LT brake, left stick steer, A nitro, Y reset, Start pause. Touch: on-screen buttons.</div>
      <div class="rbest" id="rBest">${best ? 'Best lap: ' + fmt(parseFloat(best)) : ''}</div>
      <button id="rGo" class="btn primary" type="button">START RACE</button> <button id="rOnline" class="btn alt" type="button">PLAY ONLINE</button> <button id="rBack" class="btn" type="button">Back</button></div>`);
    let nm = 'Player'; try { nm = localStorage.getItem('ironstrike.race.name') || nm; } catch (e) { /* storage blocked */ }
    this.netEl = mk('raceNet', 'overlay hidden', `<div class="panel racepanel"><h2>RACE ONLINE</h2>
      <div class="rrow"><label for="rnName">Callsign</label><input id="rnName" maxlength="14" autocomplete="off" spellcheck="false" value="${nm}"></div>
      <div class="rrow"><label for="rnColor">Your bike</label><select id="rnColor">${COLOR_NAMES.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div id="rnHome"><div class="rnbtns"><button id="rnHost" class="btn primary" type="button">Create room</button></div>
        <div class="rnor">or join a friend</div>
        <div class="rnbtns"><input id="rnCode" maxlength="6" placeholder="ABCDEF" autocomplete="off" spellcheck="false"><button id="rnJoin" class="btn primary" type="button">Join</button></div></div>
      <div id="rnRoom" class="hidden"><div class="mpcode">ROOM CODE <b id="rnCodeTxt">------</b> <button id="rnCopy" class="btn small" type="button">Copy</button></div>
        <table id="rnPlayers"></table>
        <div id="rnOpts"><div class="rrow"><label for="rnLaps">Laps</label><select id="rnLaps"><option value="1">1 lap</option><option value="3" selected>3 laps</option><option value="5">5 laps</option></select></div>
        <div class="rrow"><label for="rnBots">Bots</label><select id="rnBots"><option value="0">None (players only)</option><option value="1">1 bot</option><option value="2">2 bots</option><option value="3" selected>3 bots</option><option value="5">5 bots</option></select></div>
        <div class="rrow"><label for="rnDiff">Bot skill</label><select id="rnDiff"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option></select></div></div>
        <p id="rnInfo" class="rsub"></p>
        <div class="rnbtns"><button id="rnStart" class="btn primary" type="button">START RACE</button></div></div>
      <p id="rnStatus" class="mpstatus"></p>
      <button id="rnBack" class="btn" type="button">Back</button></div>`);
    this.hud = mk('race', 'hidden', `<div id="rLapBox"><small>LAP</small><b id="rLap">1/3</b></div><div id="rPosBox"><small>POSITION</small><b id="rPos">1st</b></div>
      <div id="rTimeBox"><small>TIME</small><b id="rTime">0:00.00</b><span id="rLast"></span></div>
      <div id="rSpd"><b id="rKmh">0</b><small>km/h</small><div id="rNit"><i id="rNitFill"></i></div></div>
      <canvas id="rMap" width="150" height="150"></canvas><div id="rMsg"></div><div id="rBoostFx"></div>
      <div id="rTouch"><div class="rtL"><button data-k="left" type="button">&#9664;</button><button data-k="right" type="button">&#9654;</button></div><div class="rtR"><button data-k="boost" type="button">NITRO</button><button data-k="brake" type="button">BRAKE</button><button data-k="gas" type="button" class="gas">GAS</button></div></div>
      <button id="rPauseBtn" type="button">II</button>`);
    this.pauseEl = mk('racePause', 'overlay hidden', `<div class="panel racepanel"><h2>PAUSED</h2><button id="rResume" class="btn primary" type="button">Resume</button> <button id="rRestart" class="btn" type="button">Restart</button> <button id="rQuit" class="btn" type="button">Quit to menu</button></div>`);
    this.endEl = mk('raceEnd', 'overlay hidden', `<div class="panel racepanel"><h2 id="rEndTitle">FINISHED</h2><table id="rEndTable"></table><div id="rEndBest"></div><button id="rAgain" class="btn primary" type="button">Race again</button> <button id="rEndQuit" class="btn" type="button">Menu</button></div>`);
    const $ = this.$, on = (id, f) => document.getElementById(id).addEventListener('click', f);
    on('rGo', () => this.start()); on('rBack', () => { this.menu.classList.add('hidden'); this.showScreen('landing'); });
    on('rResume', () => this.setPause(false)); on('rRestart', () => this.start()); on('rQuit', () => this.exit());
    on('rAgain', () => this.again());
    on('rOnline', () => this.openOnline()); this.bindOnline(on); on('rEndQuit', () => this.exit()); on('rPauseBtn', () => this.setPause(true));
    this.map = document.getElementById('rMap'); this.mapCtx = this.map.getContext('2d');
    const bind = (btn, k) => {
      const set = (v) => (e) => { this.touch[k] = v; if (e && e.preventDefault) e.preventDefault(); };
      btn.addEventListener('pointerdown', set(true)); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, set(false));
    };
    for (const b of this.hud.querySelectorAll('#rTouch button')) bind(b, b.dataset.k);
    void $;
  }

  open() { this.showScreen(''); this.menu.classList.remove('hidden'); this.netEl.classList.add('hidden'); this.active = false; }

  // ---------------- online: lobby panel and the glue between the race and RaceNet
  bindOnline(on) {
    const $ = (id) => document.getElementById(id), name = () => { const n = ($('rnName').value || '').trim() || 'Player'; try { localStorage.setItem('ironstrike.race.name', n); } catch (e) { /* blocked */ } return n; };
    const status = (t, err) => { const e = $('rnStatus'); e.textContent = t || ''; e.classList.toggle('err', !!err); };
    this.rnStatus = status;
    const mkNet = () => { if (this.net) this.net.leave(); this.net = new RaceNet(this.netUi()); return this.net; };
    const run = async (label, f) => { status(label); $('rnHost').disabled = $('rnJoin').disabled = true; try { await f(); status(''); } catch (e) { status((e && e.message) || 'Could not connect.', true); if (this.net && !this.net.active) this.net = null; } $('rnHost').disabled = $('rnJoin').disabled = false; };
    on('rnHost', () => run('Creating room...', async () => { const n = mkNet(); await n.host(name(), $('rnColor').value); }));
    on('rnJoin', () => run('Connecting...', async () => { const n = mkNet(); await n.join($('rnCode').value, name(), $('rnColor').value); }));
    $('rnCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    $('rnColor').addEventListener('change', () => { if (this.net && this.net.active) this.net.setMyColor($('rnColor').value); });
    for (const id of ['rnLaps', 'rnBots', 'rnDiff']) $(id).addEventListener('change', () => { if (this.net && this.net.role === 'host') this.net.setOpts({ laps: +$('rnLaps').value, bots: +$('rnBots').value, diff: $('rnDiff').value }); });
    on('rnStart', () => { if (this.net) { const e = this.net.start(); if (e) status(e, true); } });
    on('rnCopy', () => { const c = $('rnCodeTxt').textContent; try { navigator.clipboard.writeText(c); status('Code copied.'); } catch (e) { status('Code: ' + c); } });
    on('rnBack', () => { if (this.net) { this.net.leave(); this.net = null; } this.netEl.classList.add('hidden'); this.open(); });
  }

  openOnline(msg) {
    this.menu.classList.add('hidden'); this.netEl.classList.remove('hidden'); this.showScreen('');
    const $ = (id) => document.getElementById(id);
    const inRoom = !!(this.net && this.net.active); $('rnHome').classList.toggle('hidden', inRoom); $('rnRoom').classList.toggle('hidden', !inRoom);
    this.rnStatus(msg || '', !!msg);
  }

  netUi() {
    return {
      lobby: (l) => this.renderLobby(l),
      go: (info) => this.startOnline(info),
      apply: (rows) => this.applyNet(rows),
      collect: () => this.collect(),
      left: (nid) => { const b = this.sim && this.sim.bikes.find((x) => x.nid === nid); if (b && !b.isPlayer) { b.gone = true; if (this.meshes) { const m = this.meshes[this.sim.bikes.indexOf(b)]; if (m) m.root.visible = false; } } },
      closed: (why) => { this.net = null; const racing = this.active; if (racing) this.exit(true); this.openOnline(why); },
    };
  }

  renderLobby(l) {
    const $ = (id) => document.getElementById(id), net = this.net; if (!net) return;
    const host = net.role === 'host', n = l.players.length;
    $('rnCodeTxt').textContent = l.code;
    $('rnPlayers').innerHTML = '<tr><th></th><th>Rider</th><th>Bike</th></tr>' + l.players.map((p) => `<tr class="${p.id === net.myId ? 'me' : ''}"><td><i class="rndot" style="background:#${(BIKE_COLORS[p.color] ?? 0xffffff).toString(16).padStart(6, '0')}"></i></td><td>${p.name.replace(/[<>&"]/g, '')}${p.id === 0 ? ' (host)' : ''}</td><td>${p.color}</td></tr>`).join('');
    const bots = Math.min(l.opts.bots, MAX_RIDERS - n);
    $('rnOpts').classList.toggle('hidden', !host); $('rnStart').classList.toggle('hidden', !host);
    if (host) { $('rnLaps').value = String(l.opts.laps); $('rnBots').value = String(l.opts.bots); $('rnDiff').value = l.opts.diff; }
    $('rnColor').value = (l.players.find((p) => p.id === net.myId) || {}).color || $('rnColor').value;
    $('rnInfo').textContent = `${n} rider${n > 1 ? 's' : ''} + ${bots} bot${bots === 1 ? '' : 's'}, ${l.opts.laps} lap${l.opts.laps > 1 ? 's' : ''}` + (host ? (n < MAX_HUMANS ? '. Share the code with friends.' : '.') : '. Waiting for the host to start.') + (l.running && !this.active ? ' A race is running, you join the next one.' : '');
    if (!this.active) { this.netEl.classList.remove('hidden'); $('rnHome').classList.add('hidden'); $('rnRoom').classList.remove('hidden'); }
  }

  // host announced a race (or we are the host and pressed start)
  startOnline(info) {
    const net = this.net; if (!net) return;
    const riders = info.roster.map((r) => ({ nid: r.nid, name: r.name, color: BIKE_COLORS[r.color] ?? 0xd8281c, kind: r.bot ? (net.role === 'host' ? 'bot' : 'remote') : (r.nid === net.myId ? 'me' : 'remote') }));
    this.netEl.classList.add('hidden'); this.start({ riders, laps: info.laps, diff: info.diff, color: (net.players.get(net.myId) || {}).color });
  }

  again() { if (this.net) { if (this.net.role === 'host') this.net.start(); } else this.start(); }

  // state of the bikes this machine owns (the player, plus the AI riders on the host)
  collect() {
    if (!this.sim) return []; const f = (v, d = 2) => +v.toFixed(d), out = [];
    for (const b of this.sim.bikes) {
      if (b.remote || b.gone) continue;
      out.push([b.nid, f(b.x), f(b.y), f(b.z), f(b.yaw, 3), f(b.pitch, 3), f(b.roll, 3), f(b.speed), f(b.st), f(b.thr, 1), (b.air ? 1 : 0) | (b.boosting ? 2 : 0) | (b.finished ? 4 : 0) | (b.on ? 8 : 0), f(b.prog, 1), b.lap, f(b.finishT), f(b.nitro), f(b.lapTimes.length ? Math.min(...b.lapTimes) : 0)]);
    }
    return out;
  }
  applyNet(rows) {
    if (!this.sim || !this.active) return; const now = performance.now();
    for (const r of rows) {
      const b = this.sim.bikes.find((x) => x.nid === r[0]); if (!b || !b.remote || !isFinite(r[1])) continue;
      const fl = r[10] | 0, first = !b.net;
      b.net = { x: r[1], y: r[2], z: r[3], yaw: r[4], pitch: r[5], roll: r[6], speed: r[7], st: r[8], thr: r[9], t: now };
      b.air = !!(fl & 1); b.boosting = !!(fl & 2); b.on = !!(fl & 8); b.finished = !!(fl & 4);
      b.prog = r[11]; b.lap = r[12]; b.finishT = r[13]; b.nitro = r[14]; b.bestLap = r[15];
      if (first) { b.x = r[1]; b.y = r[2]; b.z = r[3]; b.yaw = r[4]; }
    }
  }
  // glide the other riders towards their latest reported pose (and carry them forward by their speed so they don't stutter)
  smoothRemotes(dt) {
    const k = 1 - Math.exp(-dt * 14), now = performance.now(), T = this.sim.track;
    for (const b of this.sim.bikes) {
      const n = b.net; if (!b.remote || !n || b.gone) continue;
      const age = Math.min(0.25, (now - n.t) / 1000), fx = -Math.sin(n.yaw), fz = -Math.cos(n.yaw);
      const tx = n.x + fx * n.speed * age, tz = n.z + fz * n.speed * age;
      b.x += (tx - b.x) * k; b.z += (tz - b.z) * k; b.y += (n.y + (b.air ? 0 : 0) - b.y) * k;
      b.yaw += wrap(n.yaw - b.yaw) * k; b.pitch += (n.pitch - b.pitch) * k; b.roll += (n.roll - b.roll) * k; b.st += (n.st - b.st) * k;
      b.speed = n.speed; b.thr = n.thr; b.wheel += n.speed * dt;
      if (!b.air) { const g = T.ground(b.x, b.z, b.idx); b.idx = g.i; }
    }
  }

  // ---------------- build the world
  buildScene() {
    const T = this.sim.track, scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fc4ee); scene.fog = new THREE.Fog(0xbcd8ee, 140, 480);
    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x5b6b3a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 300; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; scene.add(sun); if (sun.target) scene.add(sun.target); this.sun = sun;
    // terrain: a heightfield that follows the track profile and fades into rolling grass
    const b = T.bounds, cell = 2.5, nx = Math.ceil((b.x1 - b.x0) / cell) + 1, nz = Math.ceil((b.z1 - b.z0) / cell) + 1, rand = rng(7);
    const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3), idx = []; let hint = -1;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = b.x0 + i * cell, z = b.z0 + j * cell, g = T.ground(x, z, -1), k = j * nx + i; hint = g.i;
      pos[k * 3] = x; pos[k * 3 + 1] = g.h; pos[k * 3 + 2] = z;
      const n = (rand() - 0.5) * 0.05, edge = clamp((g.d - HW) / 3.5, 0, 1), far = clamp((g.d - 30) / 80, 0, 1);
      col[k * 3] = (0.2 + 0.26 * (1 - edge) + 0.1 * far) + n; col[k * 3 + 1] = (0.42 + 0.0 * (1 - edge) - 0.07 * (1 - edge) - 0.1 * far) + n; col[k * 3 + 2] = (0.17 + 0.0 * (1 - edge) - 0.0 * far) + n * 0.5;
    }
    void hint;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, c = a + 1, d = a + nx, e = d + 1; idx.push(a, d, c, c, d, e); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); terrain.receiveShadow = true; scene.add(terrain);
    // dirt ribbon with darker racing lines
    const N = T.N, cols = 9, rp = [], rc = [], ri = [], r2 = rng(3);
    for (let i = 0; i <= N; i++) {
      const k = i % N, l = T.left(k), wob = (r2() - 0.5) * 0.02;
      for (let c = 0; c < cols; c++) {
        const u = c / (cols - 1) * 2 - 1, lat = u * HW;
        rp.push(T.x[k] + l[0] * lat, T.y[k] + 0.07, T.z[k] + l[1] * lat);
        const rut = Math.exp(-Math.pow((Math.abs(u) - 0.42) / 0.12, 2)), berm = Math.abs(u) > 0.9 ? 0.06 : 0;
        rc.push(0.47 - 0.11 * rut + berm + wob, 0.31 - 0.08 * rut + berm * 0.7 + wob, 0.19 - 0.06 * rut + wob);
      }
    }
    for (let i = 0; i < N; i++) for (let c = 0; c < cols - 1; c++) { const a = i * cols + c, d = (i + 1) * cols + c; ri.push(a, a + 1, d, a + 1, d + 1, d); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3)); rg.setIndex(ri); rg.computeVertexNormals();
    const ribbon = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })); ribbon.receiveShadow = true; scene.add(ribbon);
    // scenery: trees, hay bales on the outside of corners, course posts, jump warning signs, start arch
    const rr = rng(21), trunkM = mat(0x5b4026, { r: 1 }), leafM = mat(0x2e6b34, { r: 1 }), leaf2 = mat(0x3d7d3a, { r: 1 });
    const trunkG = new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6), coneG = new THREE.ConeGeometry(1.7, 3.6, 7), coneG2 = new THREE.ConeGeometry(1.3, 3, 7);
    for (let n = 0; n < 220; n++) {
      const x = b.x0 + rr() * (b.x1 - b.x0), z = b.z0 + rr() * (b.z1 - b.z0), g = T.ground(x, z, -1); if (g.d < HW + 12) continue;
      const s = 0.8 + rr() * 0.9, tr = new THREE.Mesh(trunkG, trunkM), c1 = new THREE.Mesh(coneG, rr() > 0.5 ? leafM : leaf2), c2 = new THREE.Mesh(coneG2, leafM);
      tr.position.set(x, g.h + 1.2 * s, z); tr.scale.set(s, s, s); c1.position.set(x, g.h + 3.6 * s, z); c1.scale.set(s, s, s); c2.position.set(x, g.h + 5.5 * s, z); c2.scale.set(s, s, s);
      for (const m of [tr, c1, c2]) { m.castShadow = true; scene.add(m); }
    }
    const hayM = mat(0xd2b25a, { r: 1 }), hayG = new THREE.CylinderGeometry(0.55, 0.55, 1.3, 10), postW = mat(0xf2f2f2), postR = mat(0xd9301f);
    for (let i = 0; i < N; i += 4) {
      const k = Math.abs(T.curv[i]), l = T.left(i), side = T.curv[i] > 0 ? -1 : 1;                 // outside of a left turn is the right side
      if (k > 0.011) { const m = new THREE.Mesh(hayG, hayM); const lat = side * (HW + 1.4); m.position.set(T.x[i] + l[0] * lat, T.y[i] + 0.6, T.z[i] + l[1] * lat); m.rotation.order = 'YXZ'; m.rotation.set(0, T.yaw[i], Math.PI / 2); m.castShadow = true; scene.add(m); }
    }
    for (let i = 0; i < N; i += 14) for (const s of [-1, 1]) {
      const l = T.left(i), lat = s * (HW + 0.9), m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), (i / 14) % 2 ? postW : postR);
      m.position.set(T.x[i] + l[0] * lat, T.y[i] + 0.55, T.z[i] + l[1] * lat); m.castShadow = true; scene.add(m);
    }
    const signM = mat(0xffd21a, { r: 0.5 });
    for (const j of T.jumps) { const i = (j.idx - 46 + N) % N, l = T.left(i); for (const s of [-1, 1]) { const lat = s * (HW + 1.5), m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 1.1), signM); m.position.set(T.x[i] + l[0] * lat, T.y[i] + 1, T.z[i] + l[1] * lat); m.rotation.y = T.yaw[i]; m.castShadow = true; scene.add(m); } }
    const arch = new THREE.Group(); arch.position.set(T.x[0], T.y[0], T.z[0]); arch.rotation.y = T.yaw[0];
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), mat(0x2b2f36)); p.position.set(s * (HW + 1.2), 3.5, 0); p.castShadow = true; arch.add(p); }
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const cx = cv.getContext('2d');
    if (cx) { cx.fillStyle = '#111'; cx.fillRect(0, 0, 512, 96); cx.fillStyle = '#fff'; for (let i = 0; i < 32; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) cx.fillRect(i * 16, j * 8, 16, 8); cx.fillStyle = '#e8c24a'; cx.font = 'bold 52px sans-serif'; cx.textAlign = 'center'; cx.fillText('START / FINISH', 256, 74); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const ban = new THREE.Mesh(new THREE.BoxGeometry((HW + 1.2) * 2, 1.4, 0.25), new THREE.MeshBasicMaterial({ map: tex })); ban.position.set(0, 6.6, 0); arch.add(ban); scene.add(arch);
    const lineM = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.02, 1.0), new THREE.MeshBasicMaterial({ color: 0xffffff })); lineM.position.set(T.x[0], T.y[0] + 0.1, T.z[0]); lineM.rotation.y = T.yaw[0]; scene.add(lineM);
    // bikes
    this.meshes = this.sim.bikes.map((bk) => { const m = makeBikeMesh(bk.color, bk.isPlayer ? 0x15181d : [0x2b3a67, 0x6a2c2c, 0x2c5b3a, 0x5e4b1c, 0x4a2f63, 0x1f5b5b][bk.id % 6]); scene.add(m.root);
      if (this.net && !bk.isPlayer) { try {                                   // name tag above other racers
        const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
        if (x) { x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.8)'; x.strokeText(bk.name, 128, 44); x.fillStyle = '#fff'; x.fillText(bk.name, 128, 44); }
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); sp.scale.set(3.2, 0.8, 1); sp.position.set(0, 2.5, 0); sp.renderOrder = 9; m.root.add(sp);
      } catch (e) { /* no canvas */ } }
      return m; });
    // dust
    this.dustN = 260; this.dustPos = new Float32Array(this.dustN * 3).fill(-9999); this.dustAge = new Float32Array(this.dustN).fill(9); this.dustVel = new Float32Array(this.dustN * 3); this.dustI = 0;
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(this.dustPos, 3)); this.dustGeo = dg;
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xc9ac7c, size: 0.9, map: this.puffTex(), alphaTest: 0.02, transparent: true, opacity: 0.4, depthWrite: false })); dust.frustumCulled = false; scene.add(dust);
    this.scene = scene;
    // minimap backdrop
    const mc = document.createElement('canvas'); mc.width = 150; mc.height = 150; const g = mc.getContext('2d');
    if (g) {
      const w = b.x1 - b.x0 - 100, h = b.z1 - b.z0 - 100, sc2 = Math.min(130 / w, 130 / h); this.mapScale = sc2; this.mapOx = 75 - ((b.x0 + 50) + (b.x1 - 50)) / 2 * sc2; this.mapOz = 75 - ((b.z0 + 50) + (b.z1 - 50)) / 2 * sc2;
      g.fillStyle = 'rgba(10,14,18,0.55)'; g.fillRect(0, 0, 150, 150); g.strokeStyle = '#d8b878'; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath();
      for (let i = 0; i <= N; i++) { const k = i % N, x = T.x[k] * sc2 + this.mapOx, z = T.z[k] * sc2 + this.mapOz; if (i) g.lineTo(x, z); else g.moveTo(x, z); } g.stroke();
      g.fillStyle = '#fff'; g.fillRect(T.x[0] * sc2 + this.mapOx - 4, T.z[0] * sc2 + this.mapOz - 1.5, 8, 3);
    }
    this.mapBg = mc;
  }

  puffTex() {                                                                // soft round dust puff
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    if (g) { const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
    return new THREE.CanvasTexture(c);
  }

  // ---------------- lifecycle
  start(mp) {
    const $ = (id) => document.getElementById(id);
    this.cfg = mp ? { laps: mp.laps, diff: mp.diff, color: mp.color || 'Red', bots: 0 } : { laps: parseInt($('rLaps').value, 10), diff: $('rDiff').value, color: $('rColor').value, bots: parseInt($('rBots').value, 10) };
    if (!mp && this.net) { this.net.leave(); this.net = null; }
    this.menu.classList.add('hidden'); this.pauseEl.classList.add('hidden'); this.endEl.classList.add('hidden');
    this.showScreen(''); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this.sim = new RaceSim({ laps: this.cfg.laps, diff: this.cfg.diff, color: BIKE_COLORS[this.cfg.color], bots: this.cfg.bots, riders: mp && mp.riders });
    this.buildScene();
    const g = this.game; g.state = 'race'; g.race = this; this.active = true; this.paused = false; this.endShown = false; this.lastCount = 99; this.goT = 0; this.finT = 0; this.camPos = null; this.camYaw = this.sim.player.yaw; this.shake = 0; this.close = false; this.wrongT = 0; this.last = ''; this.endAcc = 0; this.raceOverSent = false;
    document.getElementById('rRestart').style.display = this.net ? 'none' : '';
    document.getElementById('rAgain').textContent = this.net && this.net.role !== 'host' ? 'Waiting for host...' : 'Race again'; document.getElementById('rAgain').disabled = !!(this.net && this.net.role !== 'host');
    this.hud.classList.remove('hidden'); document.body.classList.add('racing');
    $('rLapBox').style.display = this.cfg.laps ? '' : 'none'; $('rPosBox').style.display = this.cfg.laps ? '' : 'none';
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    g.sound.init(); this.startEngine();
    if (this.cfg.laps === 0) this.msg('FREE RIDE', 1.6);
  }

  exit(keepNet) {
    if (this.net && !keepNet) { this.net.leave(); this.net = null; } else if (this.net && keepNet) this.net = null;
    this.active = false; this.stopEngine(); const g = this.game; g.race = null; g.state = 'menu';
    window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku);
    this.hud.classList.add('hidden'); this.pauseEl.classList.add('hidden'); this.endEl.classList.add('hidden'); this.menu.classList.add('hidden'); this.netEl.classList.add('hidden'); document.body.classList.remove('racing');
    this.scene = null; this.sim = null; this.keys = {}; this.touch = {};
    this.showScreen('landing');
  }

  setPause(p) {
    if (!this.active || (this.endShown && p)) return;
    this.paused = p; document.getElementById('rResume').parentNode.querySelector('#rRestart').style.display = this.net ? 'none' : '';
     this.pauseEl.classList.toggle('hidden', !p); if (this.gain) this.gain.gain.value = 0;
    if (!p) this.keys = {};
  }

  onKey(e, down) {
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(c)) e.preventDefault();
    this.keys[c] = down;
    if (!down) return;
    if (c === 'Escape' || c === 'KeyP') this.setPause(!this.paused);
    else if (c === 'KeyR' && this.sim && !this.paused) this.sim.player.reset();
    else if (c === 'KeyV') this.close = !this.close;
  }

  readInput() {
    const k = this.keys, t = this.touch;
    let thr = (k.KeyW || k.ArrowUp || t.gas) ? 1 : 0, brk = (k.KeyS || k.ArrowDown || t.brake) ? 1 : 0;
    let steer = ((k.KeyA || k.ArrowLeft || t.left) ? 1 : 0) - ((k.KeyD || k.ArrowRight || t.right) ? 1 : 0), boost = !!(k.ShiftLeft || k.ShiftRight || k.Space || t.boost);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [], gp = pads && [...pads].find((p) => p && p.connected);
    if (gp) {
      const ax = gp.axes[0] || 0, B = (i) => (gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0);
      if (Math.abs(ax) > 0.12) steer = -clamp((Math.abs(ax) - 0.12) / 0.88, 0, 1) * Math.sign(ax);
      thr = Math.max(thr, B(7)); brk = Math.max(brk, B(6)); boost = boost || B(0) > 0.5 || B(5) > 0.5;
      const edge = (i, f) => { const d = B(i) > 0.5; if (d && !this.padPrev[i]) f(); this.padPrev[i] = d; };
      edge(3, () => { if (this.sim && !this.paused) this.sim.player.reset(); }); edge(9, () => this.setPause(!this.paused)); edge(4, () => { this.close = !this.close; });
    }
    return { thr, brk, steer: clamp(steer, -1, 1), boost };
  }

  // ---------------- engine sound
  startEngine() {
    const ctx = this.game.sound.ctx; if (!ctx || this.osc) return;
    try {
      this.osc = ctx.createOscillator(); this.osc.type = 'sawtooth'; this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
      this.filt = ctx.createBiquadFilter(); this.filt.type = 'lowpass'; this.filt.frequency.value = 500; this.gain = ctx.createGain(); this.gain.gain.value = 0;
      this.osc.connect(this.filt); this.osc2.connect(this.filt); this.filt.connect(this.gain); this.gain.connect(this.game.sound.master); this.osc.start(); this.osc2.start();
    } catch (e) { this.osc = null; }
  }
  stopEngine() { try { if (this.osc) { this.osc.stop(); this.osc2.stop(); this.gain.disconnect(); } } catch (e) { /* already stopped */ } this.osc = null; }
  updateEngine(p, thr) {
    if (!this.osc || this.paused) return; const ctx = this.game.sound.ctx, now = ctx.currentTime, r = clamp(Math.abs(p.speed) / VMAX, 0, 1.3), rpm = 0.25 + 0.75 * ((r * 3) % 1) * 0.6 + 0.4 * r;
    const f = 42 + 85 * rpm + (p.boosting ? 20 : 0) + (p.air ? 25 : 0);
    this.osc.frequency.setTargetAtTime(f, now, 0.04); this.osc2.frequency.setTargetAtTime(f * 0.5, now, 0.04); this.filt.frequency.setTargetAtTime(380 + 900 * rpm, now, 0.05);
    this.gain.gain.setTargetAtTime((0.05 + 0.06 * thr) * (this.sim.state === 'countdown' ? 0.6 : 1), now, 0.06);
  }

  msg(text, t = 1) { const m = document.getElementById('rMsg'); m.textContent = text; m.classList.add('show'); clearTimeout(this._mt); this._mt = setTimeout(() => m.classList.remove('show'), t * 1000); }

  // ---------------- per frame
  frame(dt) {
    if (!this.active || !this.sim || !this.scene) return;
    dt = Math.min(dt, 0.05);
    const sim = this.sim, p = sim.player, inp = this.readInput();
    if (!this.paused || this.net) {
      const prevCount = this.lastCount;
      sim.update(dt, (p.finished || this.paused) ? { thr: 0, brk: 0, steer: 0, boost: false } : inp);
      if (this.net) { this.smoothRemotes(dt); this.net.tick(dt); if (this.net.role === 'host' && this.net.running && !this.raceOverSent && sim.bikes.every((b) => b.gone || b.nid >= 100 || b.finished)) { this.raceOverSent = true; this.net.raceOver(); } }
      if (sim.state === 'countdown') { const c = Math.ceil(-sim.t); if (c !== this.lastCount) { this.lastCount = c; this.msg(String(c), 0.9); this.game.sound.beep(false); } }
      else if (prevCount !== 0 && this.cfg.laps) { this.lastCount = 0; this.msg('GO!', 1.0); this.game.sound.beep(true); }
      this.finT = p.finished ? this.finT + dt : 0;
      if (p.finished && !this.endShown) { if (this.finT < 0.05) this.msg(sim.rank().indexOf(p) === 0 ? 'YOU WIN!' : 'FINISHED', 2.4); if (this.finT > 2.4) this.showEnd(); }
      if (this.endShown && this.net && (this.endAcc += dt) > 0.5) { this.endAcc = 0; this.fillEnd(); }
      this.updateEngine(p, inp.thr);
      if (p.landed > 0) { this.shake = Math.max(this.shake, Math.min(0.5, p.landed * 0.025)); p.landed = 0; }
    }
    this.updateVisuals(dt);
    this.updateHud(dt, inp);
    this.render(dt);
  }

  updateVisuals(dt) {
    const sim = this.sim, T = sim.track;
    sim.bikes.forEach((b, i) => {
      const m = this.meshes[i], r = m.root;
      r.position.set(b.x, b.y, b.z); r.rotation.set(b.pitch, b.yaw, b.roll);
      m.rear.rotation.x = -b.wheel / 0.38; m.front.rotation.x = -b.wheel / 0.4; m.steerG.rotation.y = b.st * 0.4;
      m.rider.rotation.x = b.thr > 0.2 ? 0.06 : 0; m.rider.rotation.z = -b.roll * 0.35;
      // dust behind the rear wheel
      if (!b.air && Math.abs(b.speed) > 5 && b.thr > 0.1 && (b.on ? true : true) && Math.random() < 0.9) {
        const k = this.dustI++ % this.dustN, fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
        this.dustPos[k * 3] = b.x - fx * 0.8 + (Math.random() - 0.5) * 0.4; this.dustPos[k * 3 + 1] = b.y + 0.25; this.dustPos[k * 3 + 2] = b.z - fz * 0.8 + (Math.random() - 0.5) * 0.4;
        this.dustVel[k * 3] = -fx * 1.2 + (Math.random() - 0.5) * 1.6; this.dustVel[k * 3 + 1] = 1.1 + Math.random() * 1.4; this.dustVel[k * 3 + 2] = -fz * 1.2 + (Math.random() - 0.5) * 1.6; this.dustAge[k] = 0;
      }
    });
    for (let k = 0; k < this.dustN; k++) {
      if (this.dustAge[k] > 1.1) { this.dustPos[k * 3 + 1] = -9999; continue; }
      this.dustAge[k] += dt; this.dustPos[k * 3] += this.dustVel[k * 3] * dt; this.dustPos[k * 3 + 1] += this.dustVel[k * 3 + 1] * dt; this.dustPos[k * 3 + 2] += this.dustVel[k * 3 + 2] * dt; this.dustVel[k * 3 + 1] *= 0.97;
    }
    const a = this.dustGeo.attributes.position; if (a) { a.array = this.dustPos; a.needsUpdate = true; }
    void T;
  }

  updateHud(dt, inp) {
    const sim = this.sim, p = sim.player, $ = (id) => document.getElementById(id), set = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
    const order = sim.rank();
    if (this.cfg.laps) { set('rLap', Math.min(this.cfg.laps, p.lap + 1) + '/' + this.cfg.laps); set('rPos', ordinal(order.indexOf(p) + 1) + ' / ' + order.length); }
    set('rTime', fmt(Math.max(0, sim.t))); set('rKmh', String(Math.round(Math.abs(p.speed) * 3.6)));
    $('rNitFill').style.width = Math.round(p.nitro * 100) + '%'; $('rBoostFx').style.opacity = p.boosting ? '1' : '0';
    if (p.lapTimes.length) { const best = Math.min(...p.lapTimes); set('rLast', 'Last ' + fmt(p.lapTimes[p.lapTimes.length - 1]) + '  Best ' + fmt(best)); }
    // wrong way
    const T = sim.track, i = p.idx, vdot = p.vx * T.tx[i] + p.vz * T.tz[i];
    this.wrongT = (vdot < -4 && !p.air) ? this.wrongT + dt : 0; if (this.wrongT > 1.2 && sim.state === 'racing') { this.msg('WRONG WAY', 0.5); this.wrongT = 0.6; }
    // minimap
    const g = this.mapCtx; if (g && this.mapBg) {
      g.clearRect(0, 0, 150, 150); g.drawImage(this.mapBg, 0, 0);
      for (const b of sim.bikes) { if (b.gone) continue; g.fillStyle = b.isPlayer ? '#ffffff' : '#' + b.color.toString(16).padStart(6, '0'); g.beginPath(); g.arc(b.x * this.mapScale + this.mapOx, b.z * this.mapScale + this.mapOz, b.isPlayer ? 4.2 : 3, 0, 7); g.fill(); if (b.isPlayer) { g.strokeStyle = '#000'; g.lineWidth = 1.2; g.stroke(); } }
    }
    void inp;
  }

  render(dt) {
    const g = this.game, r = g.renderer, p = this.sim.player, T = this.sim.track, cam = this.camera;
    const w = window.innerWidth, h = window.innerHeight; if (Math.abs(cam.aspect - w / h) > 0.001) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    this.camYaw += wrap(p.yaw - this.camYaw) * Math.min(1, dt * (p.air ? 2.5 : 5));
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), dist = (this.close ? 3.3 : 5.2) + Math.abs(p.speed) * 0.025, hgt = this.close ? 1.6 : 2.1;
    const want = [p.x - fx * dist, p.y + hgt + (p.air ? Math.max(-0.5, p.vy * 0.04) : 0), p.z - fz * dist];
    if (!this.camPos) this.camPos = want.slice(); else { const k = Math.min(1, dt * 11); for (let i = 0; i < 3; i++) this.camPos[i] += (want[i] - this.camPos[i]) * k; }
    const gh = T.ground(this.camPos[0], this.camPos[2], -1).h + 0.7; if (this.camPos[1] < gh) this.camPos[1] = gh;
    this.shake = Math.max(0, this.shake - dt * 2.2); const sh = this.shake * 0.08, s2 = Math.abs(p.speed) > 25 ? 0.012 : 0;
    cam.position.set(this.camPos[0] + (Math.random() - 0.5) * (sh + s2), this.camPos[1] + (Math.random() - 0.5) * (sh + s2), this.camPos[2] + (Math.random() - 0.5) * (sh + s2));
    cam.lookAt(p.x + fx * 3, p.y + 1.2 + (p.air ? p.vy * 0.02 : 0), p.z + fz * 3);
    const fov = 68 + Math.min(1, Math.abs(p.speed) / VMAX) * 10 + (p.boosting ? 12 : 0); if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix(); }
    if (this.sun) { this.sun.position.set(p.x + 70, p.y + 100, p.z + 45); if (this.sun.target) this.sun.target.position.set(p.x, p.y, p.z); }
    r.clear(); r.render(this.scene, cam);
  }

  showEnd() { this.endShown = true; this.fillEnd(); this.endEl.classList.remove('hidden'); }

  fillEnd() {
    const sim = this.sim; if (!sim) return; const order = sim.rank(), p = sim.player, pos = order.indexOf(p) + 1;
    document.getElementById('rEndTitle').textContent = pos === 1 ? 'YOU WIN!' : ordinal(pos) + ' PLACE';
    const bestOf = (b) => (b.remote ? b.bestLap : (b.lapTimes.length ? Math.min(...b.lapTimes) : 0));
    const rows = order.map((b, i) => `<tr class="${b.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td>${b.name}</td><td>${b.finished ? fmt(b.finishT) : 'Lap ' + Math.min(this.cfg.laps, b.lap + 1)}</td><td>${bestOf(b) ? fmt(bestOf(b)) : '-'}</td></tr>`).join('');
    document.getElementById('rEndTable').innerHTML = '<tr><th>#</th><th>Rider</th><th>Time</th><th>Best lap</th></tr>' + rows;
    let best = Infinity; try { best = parseFloat(localStorage.getItem('ironstrike.race.best')) || Infinity; } catch (e) { /* blocked */ }
    const mine = p.lapTimes.length ? Math.min(...p.lapTimes) : Infinity;
    if (mine < best) { try { localStorage.setItem('ironstrike.race.best', String(mine)); } catch (e) { /* blocked */ } best = mine; document.getElementById('rEndBest').textContent = 'New best lap: ' + fmt(mine) + '!'; }
    else document.getElementById('rEndBest').textContent = isFinite(best) ? 'Best lap: ' + fmt(best) : '';
    document.getElementById('rBest').textContent = isFinite(best) ? 'Best lap: ' + fmt(best) : '';
  }
}
