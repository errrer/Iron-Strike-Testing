import * as THREE from 'three';
import { MOD } from './supermod.js?v=0.18.4';
import { canon } from './keybinds.js?v=0.18.4';
import { WEAPONS, PRIMARIES, SECONDARIES, KNIVES, withAtt, cleanMask, CAMOS } from './weapons.js?v=0.18.4';
import { buildGun, makeEnv, camoQ } from './gunmodels.js?v=0.18.4';
import { buildMap } from './maps.js?v=0.18.4';
import { Colliders, NavGraph, GRAVITY, raySphere, rayAABB } from './physics.js?v=0.18.4';
import { buildWorld } from './world.js?v=0.18.4';
import { Bot } from './bots.js?v=0.18.4';
import { makeRichtofen, richtofenReady } from './easter.js?v=0.18.4';
import { buildSoldier, SKIN } from './soldier.js?v=0.18.4';
import { animateSoldier, animateZombie, resetJoints } from './anim.js?v=0.18.4';
import { Zombies, PERKS } from './zombies.js?v=0.18.4';
import { inspectFor, inspectPose } from './inspect.js?v=0.18.4';
import { Ragdoll, makeRagdoll } from './ragdoll.js?v=0.18.4';
import { Progress, XP_REWARD, UNLOCK, rankName } from './progress.js?v=0.18.4';
import { Objectives } from './objectives.js?v=0.18.4';
import { Streaks, STREAKS } from './streaks.js?v=0.18.4';
import { Gore } from './gore.js?v=0.18.4';

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// per-knife swing character: arc = how wide the slash sweeps, reach = lunge distance, roll = wrist roll, chop = overhead drop
const KNIFE_SWING = {
  k_combat: { arc: 1, reach: 1, roll: 0.15, chop: 0 }, k_karambit: { arc: 0.8, reach: 0.8, roll: 1.4, chop: 0 }, k_balisong: { arc: 0.9, reach: 0.9, roll: 0.7, chop: 0.1 },
  k_machete: { arc: 1.3, reach: 1.1, roll: 0.1, chop: 0.2 }, k_tomahawk: { arc: 0.7, reach: 1, roll: 0, chop: 0.9 },
};
export const MODES = {
  tdm: { id: 'tdm', name: 'Team Deathmatch', team: true, perSide: 5, scoreLimit: 30, time: 420, blurb: '5v5 - first team to 30 kills' },
  '1v1': { id: '1v1', name: '1v1 Duel', team: false, count: 2, scoreLimit: 10, time: 300, blurb: 'You vs one bot - first to 10 kills' },
  ffa: { id: 'ffa', name: 'Free For All', team: false, count: 8, scoreLimit: 20, time: 420, blurb: '8 players, every man for himself - first to 20' },
  dom: { id: 'dom', name: 'Domination', team: true, perSide: 5, scoreLimit: 200, time: 600, obj: 'dom', solo: true, blurb: 'Capture A, B and C and hold them - first team to 200 (offline)' },
  hp: { id: 'hp', name: 'Hardpoint', team: true, perSide: 5, scoreLimit: 250, time: 600, obj: 'hp', solo: true, blurb: 'One zone that keeps moving - stand in it alone to score (offline)' },
  kc: { id: 'kc', name: 'Kill Confirmed', team: true, perSide: 5, scoreLimit: 40, time: 600, obj: 'kc', solo: true, blurb: 'Kills drop dog tags - grab red to confirm, blue to deny (offline)' },
  snd: { id: 'snd', name: 'Search & Destroy', team: true, perSide: 5, scoreLimit: 4, time: 1500, obj: 'snd', oneLife: true, solo: true, blurb: 'One life. Attack: plant at A or B (hold E). Defend: stop it. First to 4 rounds (offline)' },
  zm: { id: 'zm', name: 'Zombies', team: true, coop: true, zm: true, perSide: 0, scoreLimit: 0, time: 0, blurb: 'Survive endless rounds of zombies. Solo or 4-player co-op.' },
  gg: { id: 'gg', name: 'Gun Game', team: false, count: 8, scoreLimit: 9999, time: 900, gg: true, blurb: 'Every kill upgrades your gun. A knife kill sets the victim back. Kill with the one-shot Golden Gun to win' },
  sandbox: { id: 'sandbox', name: 'Sandbox', team: false, count: 1, scoreLimit: 0, time: 0, sandbox: true, blurb: 'No score, no clock. Spawn dummies (B), swap your loadout any time (Esc)' },
};
export const MAX_DUMMIES = 20;
export const GG_LADDER = ['g18', 'm1911', 'mac10', 'ump', 'mp5', 'p90', 'vmp', 'm16', 'm4a1', 'ak47', 'fal', 'm680', 'rpk', 'sks', 'kar98k', 'goldgun'];

export const MAX_PLAYERS = 18;
// online matches: same modes, scaled for bigger lobbies (every peer derives the same rules from the mode id)
export const MP_OVERRIDES = {
  tdm: { scoreLimit: 50, time: 600, blurb: 'Two teams, auto-balanced - first team to 50' },
  '1v1': { blurb: 'Two players - first to 10 kills', max: 2 },
  gg: { time: 900, blurb: 'Up to 18 players race up the gun ladder - first to kill with the Golden Gun wins' },
  ffa: { scoreLimit: 30, time: 600, blurb: 'Up to 18 players - first to 30' },
  zm: { max: 4, blurb: 'Co-op zombies for up to 4 players - board windows, buy guns, open doors, survive.' },
  sandbox: { blurb: 'Up to 18 players share one sandbox: dummies (B), live loadout swaps (Esc)' },
};
export const mpMode = (id) => ({ ...MODES[id], ...MP_OVERRIDES[id], max: (MP_OVERRIDES[id] || {}).max || MAX_PLAYERS });
const CALLSIGNS = ['Ghost', 'Viper', 'Razor', 'Havoc', 'Nova', 'Falcon', 'Rook', 'Cobra', 'Maverick', 'Reaper', 'Titan', 'Echo', 'Blaze', 'Sable', 'Onyx', 'Wolf'];
const DUMMY_COLOR = 0x8a8f94;
const FFA_COLORS = [0xc0392b, 0xd68910, 0x1e8449, 0x7d3c98, 0x148f77, 0xb7950b, 0xa04000, 0x2e86c1];
const TEAM_COLORS = [0x2e6fbd, 0xc0392b];
const BOT_PRIMARY_POOL = ['vmp', 'super46', 'vmp', 'mp5', 'p90', 'm4a1', 'm4a1', 'm4a1', 'ak47', 'ak47', 'scar', 'lmg', 'm680', 'aa12', 'dmr', 'kar98k'];

export class Game {
  constructor(canvas, hud, sound, settings) {
    this.canvas = canvas; this.hud = hud; this.sound = sound; this.settings = settings; this.prog = new Progress(); this.matchXp = 0;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.autoClear = false;

    this.camera = new THREE.PerspectiveCamera(80, 1, 0.05, 500);
    this.camera.rotation.order = 'YXZ';

    // viewmodel is drawn in its own scene on top of the world (never clips into walls)
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.6));
    { const env = makeEnv(this.renderer); if (env) this.vmScene.environment = env; }
    const vl = new THREE.DirectionalLight(0xffffff, 2.2); vl.position.set(0.4, 1, 0.8); this.vmScene.add(vl);
    this.vmRoot = new THREE.Group(); this.vmScene.add(this.vmRoot);
    this.flashLight = new THREE.PointLight(0xffc870, 0, 3, 2); this.vmScene.add(this.flashLight);

    this.state = 'menu';
    this.keys = {}; this.fireHeld = false; this.fireEdge = false; this.adsHeld = false; this.showScore = false;
    this.joy = { x: 0, y: 0 }; this.touchMode = false;          // touch controls (js/touch.js) drive these
    this.mouseDX = 0; this.swayX = 0; this.swayY = 0;
    this.time = 0; this.matchT = 0;
    this.actors = []; this.player = null; this.world = null; this.scene = null;
    this.tracers = []; this.particles = [];
    this.net = null; this.hist = []; this.richtofen = false;
    this.knifeId = 'k_combat'; this.knifeOut = false; this.swing = null; this.vHeld = false; this.vHandled = false; this.vDownT = 0;
    this.vmS = { sprint: 0, strafe: 0, land: 0, slide: 0, cycle: 0, inspectT: 0, lastVy: 0, wasGround: true, rand: 0, shake: 0, slk: 0, mvk: 0 };
    this.vmCache = {};
    this.resize();
    this.bindEvents();
  }

  // ------------------------------------------------------------------ input
  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => { this.adsKey = false; this.keys = {}; this.fireHeld = false; this.adsHeld = false; this.adsKey = false; this.breath = 1; this.breathEx = 0; });
    document.addEventListener('keydown', (ev) => {
      if (this.state !== 'playing') return;
      const e = { code: canon(ev.code), repeat: ev.repeat, shiftKey: ev.shiftKey, preventDefault: () => ev.preventDefault() };
      this.keys[e.code] = true;
      if (e.code === 'Tab') { this.showScore = true; e.preventDefault(); }
      if (e.repeat) return;
      const p = this.player;
      if (!p) return;
      if (e.code === 'KeyR') this.startReload(p);
      if (e.code === 'Digit1' || e.code === 'Digit2') { if (this.knifeOut) this.stowKnife(); else this.switchWeapon(p, e.code === 'Digit1' ? 0 : 1); }
      if (e.code === 'KeyQ') this.adsKey = true;
      if (this.streaks && !this.net) { const s = STREAKS.find((x) => x.code === e.code); if (s) this.streaks.use(s.id); }
      if (e.code === 'KeyT') this.toggleView();
      if (e.code === 'KeyV') { this.vHeld = true; this.vHandled = false; this.vDownT = performance.now(); }
      if (e.code === 'KeyB' && this.mode.sandbox) this.sandboxSpawn(e.shiftKey ? 5 : 1);
      if (e.code === 'KeyN' && this.mode.sandbox) this.sandboxClear();
      if (e.code === 'KeyF' && this.zm) this.zm.localUse(true);
      else if (e.code === 'KeyF') this.startInspect();
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (ev) => { const e = { code: canon(ev.code), preventDefault: () => ev.preventDefault() }; this.keys[e.code] = false; if (e.code === 'KeyV' && this.vHeld) { this.vHeld = false; if (!this.vHandled && this.state === 'playing') this.startSwing('quick'); } if (e.code === 'KeyQ') this.adsKey = false; if (e.code === 'KeyF' && this.zm && this.state === 'playing') this.zm.localUse(false); if (e.code === 'Tab') { this.showScore = false; e.preventDefault(); } });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      if (e.button === 0) { this.fireHeld = true; this.fireEdge = true; }
      if (e.button === 2) this.adsHeld = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.adsHeld = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing' || document.pointerLockElement !== this.canvas) return;
      const p = this.player; if (!p || !p.alive) return;
      const zoomFactor = this.camera.fov / this.settings.fov;
      const s = 0.0021 * this.settings.sens * zoomFactor;
      p.yaw -= e.movementX * s;
      p.pitch = clamp(p.pitch - e.movementY * s, -1.5, 1.5);
      this.mouseDX += e.movementX; this.mouseDY = (this.mouseDY || 0) + e.movementY;
    });
    document.addEventListener('wheel', (e) => { if (this.state === 'playing' && this.player) { if (this.knifeOut) this.stowKnife(); else this.switchWeapon(this.player, 1 - this.player.cur); } }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && this.state === 'playing') this.pause();
    });
    document.addEventListener('pointerlockerror', () => { if (this.state === 'playing') this.pause(); });
  }

  // graphics presets (Graphics setting). LOW really cuts work: half-res render, no shadows, no extra point lights,
  // simple (Lambert) materials in the world, shorter view distance, no ragdolls or gore particles. HIGH adds full-res + 4K shadows.
  static GFX = {
    low:    { pr: 0.5, shadow: 0, lambert: true,  lights: false, far: 150, fogMul: 0.55, ragdoll: false, gore: false },
    medium: { pr: 1,   shadow: 1024, lambert: false, lights: true, far: 350, fogMul: 1, ragdoll: true, gore: true },
    high:   { pr: 2,   shadow: 4096, lambert: false, lights: true, far: 500, fogMul: 1, ragdoll: true, gore: true },
    // ULTRA: lightly supersampled, 4K shadows, image-based lighting on the world, sharper textures, colour grade + vignette
    ultra:  { pr: 2, ss: 1.15, shadow: 4096, lambert: false, lights: true, far: 600, fogMul: 1.1, ragdoll: true, gore: true, env: true, aniso: true, grade: true, exposure: 1.25 },
  };
  get gfxQ() { return Game.GFX[this.settings.gfx] || Game.GFX.high; }
  applyGfx() {
    const q = this.gfxQ;
    const dpr = window.devicePixelRatio || 1;
    let ratio = Math.min(q.ss ? dpr * q.ss : dpr, q.pr); ratio = Math.min(ratio, Math.sqrt(12e6 / Math.max(1, innerWidth * innerHeight)));      // never more than ~12 megapixels
    this.renderer.setPixelRatio(ratio); this.resize();
    this.renderer.toneMappingExposure = q.exposure || 1.2; document.body.classList.toggle('ultra', !!q.grade);
    camoQ.low = !!q.lambert; this.camera.far = q.far; this.camera.updateProjectionMatrix();
    if (!this.scene) return;
    this.gfxSweep(true);
  }
  gfxSweep(full) {                                   // (re)apply the preset to everything in the world scene; cheap enough to repeat for newly spawned meshes
    const q = this.gfxQ, sc = this.scene; if (!sc) return;
    if (sc.fog && sc.fog.far) { if (sc.userData.fogFar === undefined) sc.userData.fogFar = sc.fog.far; sc.fog.far = sc.userData.fogFar * q.fogMul; }
    const lamb = this.lambCache || (this.lambCache = new Map());
    if (q.env) { if (!sc.environment) { const env = makeEnv(this.renderer); if (env) { sc.environment = env; sc.userData.ownEnv = env; full = 'mats'; } } }
    else if (sc.userData.ownEnv && sc.environment === sc.userData.ownEnv) { sc.environment = null; full = 'mats'; }
    const maxA = q.aniso && this.renderer.capabilities && this.renderer.capabilities.getMaxAnisotropy ? this.renderer.capabilities.getMaxAnisotropy() : 0;
    const cap = this.renderer.capabilities && this.renderer.capabilities.maxTextureSize || 8192;
    sc.traverse((o) => {
      if (o.isDirectionalLight && o.shadow) {
        if (o.userData.hadShadow === undefined) o.userData.hadShadow = !!o.castShadow;
        const on = o.userData.hadShadow && q.shadow > 0, sz = Math.min(q.shadow, cap);
        if (on && o.shadow.mapSize.x !== sz) { o.shadow.mapSize.set(sz, sz); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } }
        o.castShadow = on;
      } else if (o.isPointLight) {
        if (o.userData.hadVis === undefined) o.userData.hadVis = o.visible !== false;
        const v = o.userData.hadVis && q.lights; if (o.visible !== v) { o.visible = v; full = 'mats'; }
      } else if (o.isMesh && o.material && !Array.isArray(o.material)) {
        const m = o.material;
        if (maxA && m.map && m.map.anisotropy < maxA) { m.map.anisotropy = maxA; m.map.needsUpdate = true; }
        if (q.lambert && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && THREE.MeshLambertMaterial) {
          let l = lamb.get(m); if (!l) { l = new THREE.MeshLambertMaterial({ color: m.color, map: m.map || null, vertexColors: !!m.vertexColors, transparent: !!m.transparent, opacity: m.opacity, side: m.side, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, fog: m.fog }); l.userData.orig = m; lamb.set(m, l); }
          o.userData.origMat = m; o.material = l;
        } else if (!q.lambert && o.material.userData && o.material.userData.orig) o.material = o.material.userData.orig;
      }
    });
    if (full === 'mats') sc.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.needsUpdate = true; });
  }

  // ULTRA: screen-space sun - a glow plus light shafts that sit on the sun, fade out when the sun is behind you or blocked by a wall
  updateSunRays(cam, dt) {
    const el = this._sunEl || (this._sunEl = document.getElementById('sunRays')); if (!el) return;
    const q = this.gfxQ; let target = 0, sx = 0, sy = 0;
    if (q.grade && this.scene) {
      if (this._sunL === undefined || (this._sunL && !this._sunL.parent)) { this._sunL = null; this.scene.traverse((o) => { if (!this._sunL && o.isDirectionalLight && o.intensity > 1) this._sunL = o; }); }
      const L = this._sunL;
      if (L) {
        const d = this._sd || (this._sd = new V3()), pr = this._sp || (this._sp = new V3());
        d.copy(L.position); if (L.target) d.sub(L.target.position); d.normalize();
        pr.copy(cam.position).addScaledVector(d, 500).project(cam);
        const front = pr.z < 1 && Math.abs(pr.x) < 1.6 && Math.abs(pr.y) < 1.6;
        if (front) {
          sx = (pr.x * 0.5 + 0.5) * 100; sy = (-pr.y * 0.5 + 0.5) * 100;
          this._sunT = (this._sunT || 0) - dt;
          if (this._sunT <= 0 || this._sunVis === undefined) { this._sunT = 0.12; this._sunVis = this.col && this.col.ray(cam.position.x, cam.position.y, cam.position.z, d.x, d.y, d.z, 300, true) >= 299 ? 1 : 0; }
          const edge = Math.max(0, 1 - Math.max(Math.abs(pr.x), Math.abs(pr.y)) * 0.62);
          target = this._sunVis * Math.min(1, edge * 1.3);
          const c = L.color; el.style.setProperty('--sc', `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(Math.min(1, c.b + 0.1) * 255)}`);
        }
      }
    }
    this._sunA = (this._sunA || 0) + (target - (this._sunA || 0)) * Math.min(1, dt * 5);
    if (this._sunA < 0.01 && !target) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
    if (target) { this._sx = this._sx === undefined ? sx : this._sx + (sx - this._sx) * Math.min(1, dt * 14); this._sy = this._sy === undefined ? sy : this._sy + (sy - this._sy) * Math.min(1, dt * 14); el.style.setProperty('--x', this._sx.toFixed(2) + '%'); el.style.setProperty('--y', this._sy.toFixed(2) + '%'); }
    el.style.opacity = this._sunA.toFixed(3);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vmCam.aspect = w / h; this.vmCam.updateProjectionMatrix();
  }

  // turn the view by a pointer / finger movement (px); used by the mouse and by the touch look pad
  look(dx, dy, k) {
    const p = this.player; if (!p || !p.alive || this.state !== 'playing') return;
    const s = k * this.settings.sens * (this.camera.fov / this.settings.fov);
    p.yaw -= dx * s; p.pitch = clamp(p.pitch - dy * s, -1.5, 1.5);
    this.mouseDX += dx; this.mouseDY = (this.mouseDY || 0) + dy;
  }

  lock() { if (this.touchMode) return; try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ } }

  pause() { if (this.state !== 'playing') return; if (this.zm) this.zm.localUse(false); this.state = 'paused'; this.keys = {}; this.fireHeld = false; this.adsHeld = false; this.adsKey = false; this.breath = 1; this.breathEx = 0; this.hud.showPause(true); { const t = document.getElementById('pauseTitle'), c = document.getElementById('pauseClasses'); if (t) t.textContent = this.net ? 'MENU - MATCH KEEPS RUNNING' : 'PAUSED'; if (c) c.style.display = this.mode.gg ? 'none' : ''; } if (this.onPause) this.onPause(); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.hud.showPause(false); this.lock(); }

  // ------------------------------------------------------------------ match setup
  start(cfg) {
    this.net = null; this.cfg = cfg;
    this.mode = MODES[cfg.mode];
    this.disposeMatch();
    this.map = buildMap(cfg.map);
    this.col = new Colliders(this.map.boxes);
    this.nav = this.makeNav();
    this.world = buildWorld(this.map);
    this.scene = this.world.scene; this.applyGfx();
    this.fxGroup = new THREE.Group(); this.scene.add(this.fxGroup);
    this.initFx();

    // actors
    this.actors = [];
    const mode = this.mode;
    const mk = (id, name, team, isPlayer, prim, sec, ap, as) => this.makeActor(id, name, team, isPlayer, prim, sec, ap, as);
    const names = CALLSIGNS.slice().sort(() => Math.random() - 0.5);
    this.player = mk(0, 'You', 0, true, cfg.primary, cfg.secondary, cfg.attP | 0, cfg.attS | 0);
    this.actors.push(this.player);
    if (mode.zm) { /* no bots: just you (and your co-op friends online) against the zombies */ }
    else if (mode.team) {
      for (let i = 0; i < mode.perSide * 2 - 1; i++) this.actors.push(mk(i + 1, names[i], i < mode.perSide - 1 ? 0 : 1, false));
    } else {
      for (let i = 1; i < mode.count; i++) this.actors.push(mk(i, names[i], i, false));
    }
    for (const a of this.actors) {
      if (a.isPlayer) {
        // visible only in third-person view
        a.mesh = this.makeBotMesh(mode.team ? 0x4aa3ff : 0x27ae60, a.weapons[0], null);
        a.mesh.root.visible = false; this.scene.add(a.mesh.root);
      } else {
        const color = mode.team ? TEAM_COLORS[a.team] : FFA_COLORS[a.team % FFA_COLORS.length];
        a.mesh = this.makeBotMesh(color, a.weapons[0], mode.team && a.team === 0 ? a.name : null);
        this.scene.add(a.mesh.root);
        a.brain = new Bot(this, a, cfg.difficulty);
      }
    }
    this.teamScore = [0, 0];
    this.timeLeft = mode.time; this.matchT = mode.sandbox ? 0 : -3.5; this.ended = false; this.ggWin = null;
    this.killer = null; this.deathInfo = '';
    this.lastCountdown = mode.sandbox ? 0 : 99; this.nextDummyId = 1000;
    this.matchXp = 0; this.xpDone = false; this.hud.begin(this); this.gfxT = 0;
    for (const a of this.actors) this.spawn(a, true);
    this.obj = mode.obj ? new Objectives(this, mode.obj) : null;
    this.streaks = mode.sandbox || mode.zm ? null : new Streaks(this);
    this.zm = mode.zm ? new Zombies(this) : null;
    this.setPlayerVm();
    this.state = 'playing';
    this.keys = {}; this.fireHeld = false; this.adsHeld = false; this.adsKey = false; this.breath = 1; this.breathEx = 0;
    this.lock();
    this.sound.init();
  }

  disposeMatch() {
    if (this.world) this.world.dispose();
    if (this.obj) this.obj.dispose();
    if (this.streaks) this.streaks.dispose();
    if (this.zm) this.zm.dispose();
    this.zm = null; this.streaks = null; this.obj = null; this.world = null; this.scene = null;
    this.tracers = []; this.particles = []; this.gore = null;
    this.actors = [];
  }

  // zombies mode needs a fine navigation grid (windows are 2 m gaps); everything else uses the coarse one
  makeNav() { return this.mode.zm ? new NavGraph(this.col, this.map.bounds, 1, { margin: 0.55, seg: 0.3 }) : new NavGraph(this.col, this.map.bounds, this.map.navStep || 3, this.map.navStep ? { margin: 0.6 } : {}); }
  get noRespawn() { return !!(this.mode.oneLife || this.mode.zm); }

  // a stand-in killer for deaths that no living actor caused (bleeding out in Zombies)
  fakeKiller(v) { return { id: -1, name: 'ZOMBIES', team: 1, isPlayer: false, kills: 0, streak: 0, pos: new V3(v.pos.x + 1, v.pos.y, v.pos.z), zombie: true }; }

  makeZombieMesh() {
    const m = this.makeBotMesh(0x55603f, WEAPONS.m1911, null);
    m.gun.visible = false; m.zombie = true;
    if (!Game._zskin) Game._zskin = [new THREE.MeshStandardMaterial({ color: 0x86a074, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x6b8560, roughness: 0.9 })];
    m.body.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.color) return;
      const h = o.material.color.getHex();
      if (h === SKIN) o.material = Game._zskin[0]; else if (h === 0xac8361) o.material = Game._zskin[1];
    });
    const eye = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.012), eye); e.position.set(sx * 0.047, 0.03, -0.112); m.headG.add(e); }
    return m;
  }

  // zombies shamble with both arms out in front
  zombiePose(a, m) {
    const t = this.time * 2.2 + a.id * 1.7, sp = Math.hypot(a.vel.x, a.vel.z);
    m.arms.forEach((arm, i) => {
      arm.rotation.set(1.38 + Math.sin(t + i * 1.4) * 0.14, 0, (i ? -1 : 1) * 0.1);
      if (arm.userData.el) arm.userData.el.rotation.set(0.25 + Math.sin(t * 1.3 + i) * 0.12, 0, 0);
    });
    m.body.rotation.x = -(0.14 + Math.min(0.14, sp * 0.03));
    m.headG.rotation.z = Math.sin(t * 0.6) * 0.18; m.headG.rotation.x = 0.1;
  }

  makeActor(id, name, team, isPlayer, prim, sec, ap = 0, as = 0) {
    if (!prim) prim = BOT_PRIMARY_POOL[Math.floor(Math.random() * BOT_PRIMARY_POOL.length)];
    if (!sec) sec = SECONDARIES[Math.floor(Math.random() * SECONDARIES.length)];
    let weapons = [withAtt(WEAPONS[prim], ap), withAtt(WEAPONS[sec], as)];
    if (this.mode && this.mode.gg) { const gw = WEAPONS[GG_LADDER[0]]; weapons = [gw, gw]; }
    return {
      gg: 0,
      id, name, team, isPlayer, pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, hw: 0.35, h: 1.8, eye: 1.65, onGround: true,
      hp: 100, alive: true, kills: 0, deaths: 0, streak: 0, weapons, weapon: weapons[0], cur: 0,
      ammo: weapons.map((w) => ({ mag: w.mag, res: w.reserve })), fireCd: 0, reloading: false, reloadT: 0, switchT: 0,
      lastShot: -99, lastHurt: -99, respawnT: 0, protT: 0, deathT: 0, stepT: 0, heat: 0, recoilDebt: 0, walkPhase: 0, crouch: false,
      ads: 0, mesh: null, brain: null, recoilKick: 0, recoilBias: 0, slideT: 0, slideCd: 0, slideSp: 0, slideDx: 0, slideDz: 0, mantle: null, mantleCd: 0,
    };
  }

  spawn(a, first = false) {
    const nav = this.nav, map = this.map;
    let pool;
    if (this.mode.team) pool = nav.inRect(map.spawns[a.team]);
    else pool = nav.validIdx;
    let best = null, bestScore = -1;
    for (let k = 0; k < 14; k++) {
      const n = nav.nodes[pool[Math.floor(Math.random() * pool.length)]];
      let md = 1e9;
      for (const e of this.actors) {
        if (e === a || !e.alive) continue;
        if (this.mode.team && e.team === a.team) { md = Math.min(md, Math.hypot(e.pos.x - n.x, e.pos.z - n.z) * 3); continue; }
        md = Math.min(md, Math.hypot(e.pos.x - n.x, e.pos.z - n.z));
      }
      // team modes: any free spot in the spawn zone that is not crowded; FFA/duel: furthest from enemies
      const score = this.mode.team ? (md > 4 ? 100 + Math.random() * 10 : md) : md;
      if (score > bestScore) { bestScore = score; best = n; }
    }
    const x = best.x + rand(-0.4, 0.4), z = best.z + rand(-0.4, 0.4);
    this.placeActor(a, x, z, Math.atan2(-(0 - x), -(0 - z)) + rand(-0.3, 0.3), first);
    if (this.net && this.net.role === 'host') { a.sseq = (a.sseq || 0) + 1; this.net.ev(['sp', a.id, +x.toFixed(2), +z.toFixed(2), +a.yaw.toFixed(3), a.sseq]); }
  }

  // put an actor on the map in a fresh state (shared by solo spawns, host spawns and client spawn events)
  placeActor(a, x, z, yaw, first, y = 0) {
    a.pos.set(x, y, z); a.tgt = a.remote ? new V3(x, y, z) : null;
    a.vel.set(0, 0, 0);
    a.yaw = yaw; a.pitch = 0; a.ibuf = [];
    a.hp = 100; a.alive = true; a.reloading = false; a.reloadT = 0; a.switchT = 0.4; a.fireCd = 0.3; a.cur = 0; a.weapon = a.weapons[0];
    a.ammo = a.weapons.map((w) => ({ mag: w.mag, res: w.reserve })); a.crouch = false; a.slideT = 0; a.mantle = null; a.h = 1.8; a.eye = 1.65; a.heat = 0; a.recoilDebt = 0; a.ads = 0;
    a.protT = first ? 0 : 2; a.deathT = 0; a.lastHurt = -99; a.recoilBias = 0;
    if (a.brain) a.brain.reset();
    if (a.mesh) { if (a.rag) { a.rag = null; Ragdoll.reset(a.mesh); } a.flinch = null; a.mesh.root.visible = !a.isPlayer; a.mesh.body.rotation.set(0, 0, 0); this.setActorGun(a); }
    if (a.isPlayer) { this.knifeOut = false; this.swing = null; this.vHeld = false; this.setPlayerVm(); this.hud.onRespawn(); if (!first) this.sound.spawn(); }
  }


  // ------------------------------------------------------------------ sandbox: dummies + live loadout
  // top of whatever solid thing is under (x, z), up to yMax (0 = floor)
  groundAt(x, yMax, z, hw = 0.3) {
    let g = 0;
    for (const b of this.col.boxes) if (b.y1 <= yMax + 0.01 && b.y1 > g && x + hw > b.x0 && x - hw < b.x1 && z + hw > b.z0 && z - hw < b.z1) g = b.y1;
    return g;
  }

  // where the crosshair lands, as a spot a dummy can stand on: { x, y, z } or null
  aimSpot() {
    const p = this.player, ox = p.pos.x, oy = p.pos.y + p.eye, oz = p.pos.z, d = this.dirFrom(p.yaw, p.pitch, new V3());
    let t = this.col.ray(ox, oy, oz, d.x, d.y, d.z, 40);
    if (d.y < -0.02) t = Math.min(t, -oy / d.y);
    if (!(t < 40)) t = 8;                                                   // looking at the sky: 8 m ahead
    const back = Math.min(0.5, t * 0.4), hl = Math.hypot(d.x, d.z) || 1;
    const x = ox + d.x * t - (d.x / hl) * back, z = oz + d.z * t - (d.z / hl) * back, y = this.groundAt(x, Math.max(0, oy + d.y * t) + 0.35, z);
    return { x, y, z };
  }

  // host / solo: put dummies on the ground in a row around spot (row direction = the requester's right-hand side)
  spawnDummies(spot, n, who) {
    let made = 0; const rx = Math.cos(who.yaw), rz = -Math.sin(who.yaw);
    for (let i = 0; i < n; i++) {
      if (this.actors.filter((a) => a.dummy).length >= MAX_DUMMIES) break;
      const off = (i - (n - 1) / 2) * 1.1, x = spot.x + rx * off, z = spot.z + rz * off, y = this.groundAt(x, spot.y + 0.35, z, 0.35);
      if (this.col.overlaps(x, y + 0.02, z, 0.36, 1.8)) continue;
      this.spawnDummy(x, y, z, Math.atan2(-(who.pos.x - x), -(who.pos.z - z)));
      made++;
    }
    return made;
  }

  spawnDummy(x, y, z, yaw) {
    const id = this.nextDummyId++, a = this.makeActor(id, 'Dummy', id, false, 'm4a1', 'g18');
    a.dummy = true; a.alive = false;
    a.mesh = this.makeBotMesh(DUMMY_COLOR, a.weapons[0], null); this.scene.add(a.mesh.root);
    this.actors.push(a);
    if (this.net && this.net.role === 'host') this.net.ev(['add', { id, name: 'Dummy', team: id, prim: 'm4a1', sec: 'g18', ap: 0, as: 0, dummy: 1 }]);
    this.placeActor(a, x, z, yaw, true, y);
    return a;
  }

  // B (or the pause-menu button): drop dummies where you are aiming
  sandboxSpawn(n = 1) {
    const p = this.player; if (!this.mode.sandbox || !p || !p.alive || !this.scene) return 0;
    const spot = this.aimSpot();
    if (this.isClient) { this.net.sendSandbox({ a: 'spawn', x: +spot.x.toFixed(2), y: +spot.y.toFixed(2), z: +spot.z.toFixed(2), n, yaw: +p.yaw.toFixed(3) }); return n; }
    const made = this.spawnDummies(spot, n, p);
    this.hud.center(made ? (n > 1 ? `${made} DUMMIES` : 'DUMMY SPAWNED') : (this.actors.filter((a) => a.dummy).length >= MAX_DUMMIES ? `DUMMY LIMIT (${MAX_DUMMIES})` : 'NO ROOM THERE'), 0.8);
    return made;
  }

  clearDummies() { for (const a of this.actors.filter((x) => x.dummy)) this.removeNetActor(a.id); }
  sandboxClear() {
    if (!this.mode.sandbox || !this.scene) return;
    if (this.isClient) { this.net.sendSandbox({ a: 'clear' }); return; }
    this.clearDummies();
    this.hud.center('DUMMIES CLEARED', 0.8);
  }

  // swap an actor's weapons and attachments on the spot (sandbox): fresh ammo, new gun in hand and on the body
  // Gun Game: put the actor on the ladder rung `lv` (both slots hold the rung's gun)
  ggSet(a, lv, announce) {
    lv = clamp(lv, 0, GG_LADDER.length - 1); const up = lv > a.gg; a.gg = lv;
    const w = WEAPONS[GG_LADDER[lv]];
    a.weapons = [w, w]; a.cur = 0; a.weapon = w; a.reloading = false; a.reloadT = 0; a.switchT = 0.4; a.fireCd = 0.3; a.heat = 0; a.recoilDebt = 0;
    a.ammo = a.weapons.map((x) => ({ mag: x.mag, res: x.reserve }));
    if (a.mesh) this.setActorGun(a);
    if (a.isPlayer) {
      this.setPlayerVm();
      if (announce) { this.hud.center(lv === GG_LADDER.length - 1 ? 'FINAL GUN - GOLDEN GUN' : `${up ? 'LEVEL UP' : 'DEMOTED'}: ${w.name.toUpperCase()} (${lv + 1}/${GG_LADDER.length})`, 1.4); this.sound.switchGun(); }
    }
  }
  ggOnKill(k, v, w) {                                  // runs on every peer for every kill, so levels stay in sync
    if (!this.mode.gg || k === v || !k || !v) return;
    if (w.cls === 'melee' && v.gg > 0) this.ggSet(v, v.gg - 1, true);
    if (w.id === 'goldgun') { this.ggWin = k; return; }
    if (k.gg >= GG_LADDER.length - 1) return;
    this.ggSet(k, k.gg + 1, true);
  }

  applyLoadout(a, prim, sec, ap, as) {
    if (this.mode.gg) return;
    if (!a || !WEAPONS[prim] || !WEAPONS[sec]) return;
    ap = cleanMask(WEAPONS[prim], ap | 0); as = cleanMask(WEAPONS[sec], as | 0);
    if (a.weapons[0].id === prim && a.weapons[1].id === sec && (a.weapons[0].attMask | 0) === ap && (a.weapons[1].attMask | 0) === as) return;
    a.weapons = [withAtt(WEAPONS[prim], ap), withAtt(WEAPONS[sec], as)];
    a.cur = 0; a.weapon = a.weapons[0]; a.reloading = false; a.reloadT = 0; a.switchT = 0.4; a.fireCd = 0.2; a.heat = 0; a.recoilDebt = 0;
    a.ammo = a.weapons.map((w) => ({ mag: w.mag, res: w.reserve }));
    if (a.mesh) this.setActorGun(a);
    if (a.isPlayer) { this.setPlayerVm(); this.sound.switchGun(); }
  }

  // ------------------------------------------------------------------ online play
  get isClient() { return !!this.net && this.net.role === 'client'; }
  get isHost() { return !!this.net && this.net.role === 'host'; }
  byId(id) { for (const a of this.actors) if (a.id === id) return a; return null; }

  // info: {mode, map, mapName, players:[{id,name,team,prim,sec}], me, mt, ts}
  startNet(net, info) {
    this.net = net; this.cfg = { mode: info.mode, map: info.map, mapName: info.mapName, difficulty: 'normal' };
    this.mode = mpMode(info.mode);
    this.disposeMatch();
    this.map = buildMap(info.map);
    this.col = new Colliders(this.map.boxes);
    this.nav = net.role === 'host' ? this.makeNav() : null;
    this.world = buildWorld(this.map);
    this.scene = this.world.scene; this.applyGfx();
    this.fxGroup = new THREE.Group(); this.scene.add(this.fxGroup);
    this.initFx();
    this.actors = []; this.player = null; this.hist = [];
    this.myTeam = (info.players.find((p) => p.id === info.me) || { team: 0 }).team;
    for (const p of info.players) this.addNetActor(p, p.id === info.me, true);
    for (const d of info.zomb || []) { const a = this.addNetActor({ id: d.id, name: 'Zombie', team: 1, prim: 'm1911', sec: 'm1911', zombie: 1 }, false, true); this.placeActor(a, d.x, d.z, d.yaw, true, 0); a.hp = d.hp || 100; }
    for (const d of info.dummies || []) { const a = this.addNetActor({ id: d.id, name: 'Dummy', team: d.id, prim: 'm4a1', sec: 'g18', dummy: 1 }, false, true); this.placeActor(a, d.x, d.z, d.yaw, true, d.y); }
    this.teamScore = info.ts ? info.ts.slice() : [0, 0];
    this.timeLeft = this.mode.time; this.matchT = info.mt; this.ended = false; this.ggWin = null;
    this.killer = null; this.lastCountdown = this.mode.sandbox ? 0 : 99; this.clockOff = null; this.snapT = 0; this.stT = 0; this.nextDummyId = 1000;
    this.matchXp = 0; this.xpDone = false; this.hud.begin(this); this.gfxT = 0;
    for (const a of this.actors) { a.alive = false; a.mesh.root.visible = false; }
    if (net.role === 'host') for (const a of this.actors) if (!a.zombie) this.spawn(a, true);
    this.zm = this.mode.zm ? new Zombies(this) : null;
    this.setPlayerVm();
    this.state = 'playing';
    this.keys = {}; this.fireHeld = false; this.adsHeld = false; this.adsKey = false; this.breath = 1; this.breathEx = 0;
    this.lock();
    this.sound.init();
  }

  addNetActor(p, isLocal, batch) {
    const a = this.makeActor(p.id, String(p.name).replace(/[<>&"'`]/g, '').slice(0, 14), p.team, isLocal, p.prim, p.sec, p.ap | 0, p.as | 0);
    a.remote = !isLocal; a.alive = false; a.ibuf = []; a.sseq = 0; a.dummy = !!p.dummy; a.zombie = !!p.zombie; a.crawl = !!p.crawl;
    const team = this.mode.team;
    const color = a.dummy ? DUMMY_COLOR : team ? TEAM_COLORS[p.team % 2] : FFA_COLORS[p.id % FFA_COLORS.length];
    const label = team && !isLocal && p.team === this.myTeam ? p.name : null;
    a.mesh = a.zombie ? this.makeZombieMesh() : this.makeBotMesh(color, a.weapons[0], label);
    if (a.crawl) a.mesh.root.scale.setScalar(0.78);
    a.mesh.root.visible = false; this.scene.add(a.mesh.root);
    this.actors.push(a);
    if (this.zm && !a.zombie && !a.dummy) this.zm.initPlayer(a);
    if (isLocal) this.player = a;
    if (!batch && this.net.role === 'host' && !a.zombie) this.spawn(a, true);
    return a;
  }

  removeNetActor(id) {
    const a = this.byId(id); if (!a || a.isPlayer) return;
    this.scene.remove(a.mesh.root);
    this.actors = this.actors.filter((x) => x !== a);
    if (this.net && this.net.role === 'host') this.net.ev(['rm', id]);
  }

  // host: apply a state message from a remote player
  applyRemoteState(a, m) {
    if (!a.alive || this.ended || m.q !== a.sseq) return;
    if (!a.tgt) a.tgt = new V3();
    a.tgt.set(m.x, m.y, m.z);
    // reject teleports (> 14 m/s average over the gap) by snapping back instead of accepting
    a.yaw = m.yaw; a.pitch = m.pitch; a.vel.set(m.vx, 0, m.vz);
    a.crouch = !!(m.f & 1); a.h = a.crouch ? 1.25 : 1.8; a.reloading = !!(m.f & 2); a.ads = (m.f & 4) ? 1 : 0;
    const cur = (m.f >> 3) & 1;
    if (cur !== a.cur) { a.cur = cur; a.weapon = a.weapons[cur]; this.setActorGun(a); }
  }

  posAt(e, t) {
    const h = this.hist;
    if (!h.length) return { x: e.pos.x, y: e.pos.y, z: e.pos.z, h: e.h };
    let lo = null, hi = null;
    for (let i = h.length - 1; i >= 0; i--) { if (h[i].t <= t) { lo = h[i]; hi = h[i + 1] || h[i]; break; } }
    if (!lo) lo = hi = h[0];
    const A = lo.p.get(e.id), B = hi.p.get(e.id);
    if (!A) return { x: e.pos.x, y: e.pos.y, z: e.pos.z, h: e.h };
    const k = hi.t > lo.t && B ? clamp((t - lo.t) / (hi.t - lo.t), 0, 1) : 0, Bv = B || A;
    return { x: lerp(A.x, Bv.x, k), y: lerp(A.y, Bv.y, k), z: lerp(A.z, Bv.z, k), h: A.h };
  }

  recordHistory() {
    const p = new Map();
    for (const a of this.actors) p.set(a.id, { x: a.pos.x, y: a.pos.y, z: a.pos.z, h: a.h });
    this.hist.push({ t: this.time, p });
    while (this.hist.length > 90 || (this.hist.length && this.time - this.hist[0].t > 1.2)) this.hist.shift();
  }

  // host: a remote player fired. The client sends its eye position and pellet directions; we trace them against
  // where everybody was on the shooter's screen (rt), which keeps hits fair under latency.
  remoteShot(a, m) {
    if (!a.alive || this.matchT < 0 || this.ended) return;
    if (m.cur >= 2 && m.cur <= 11) {                                                         // a knife strike (2-6 quick lunge = 100 dmg, 7-11 slash)
      const kw = WEAPONS[KNIVES[(m.cur - 2) % 5]]; if (!kw || a.fireCd > 0.05) return;
      a.fireCd += kw.cd * 0.8; a.lastShot = this.time;
      let ox = m.ox, oy = m.oy, oz = m.oz; if (Math.hypot(ox - a.pos.x, oz - a.pos.z) > 3.5 || Math.abs(oy - a.pos.y - 1.5) > 2) { ox = a.pos.x; oy = a.pos.y + 1.6; oz = a.pos.z; }
      const d = new V3(m.d[0], m.d[1], m.d[2]); if (d.length() < 0.5) return; d.normalize();
      const w = { ...kw, dmg: m.cur >= 7 ? kw.dmg : 100, range: [kw.maxD, kw.maxD], minMul: 1, hs: 1 };
      this.hitscan(a, ox, oy, oz, d, w, 1, clamp(m.rt, this.time - 0.5, this.time));
      if (this.net && this.net.role === 'host') this.net.ev(['s', a.id, +ox.toFixed(2), +oy.toFixed(2), +oz.toFixed(2), kw.id]);
      return;
    }
    if (m.cur === 0 || m.cur === 1) { if (m.cur !== a.cur) { a.cur = m.cur; a.weapon = a.weapons[m.cur]; this.setActorGun(a); } }
    const w = a.weapon;
    if (a.fireCd > 0.05) return;
    a.fireCd += 60 / w.rpm / ((a.perks & 8) ? 1.4 : 1); a.lastShot = this.time;
    let ox = m.ox, oy = m.oy, oz = m.oz;
    if (Math.hypot(ox - a.pos.x, oz - a.pos.z) > 3.5 || Math.abs(oy - a.pos.y - 1.5) > 2) { ox = a.pos.x; oy = a.pos.y + 1.6; oz = a.pos.z; }
    const rew = clamp(m.rt, this.time - 0.5, this.time);
    const n = Math.min(w.pellets, Math.floor(m.d.length / 3)), d = new V3(), ends = [];
    for (let i = 0; i < n; i++) {
      d.set(m.d[i * 3], m.d[i * 3 + 1], m.d[i * 3 + 2]); if (d.length() < 0.5) continue; d.normalize();
      ends.push(this.hitscan(a, ox, oy, oz, d, w, 1, rew));
    }
    this.emitShot(a, ox, oy, oz, ends, w);
  }

  emitShot(a, ox, oy, oz, ends, w) {
    const mu = { x: ox, y: oy - 0.18, z: oz };
    for (const e of ends) this.tracer(mu, e);
    if (this.net && this.net.role === 'host') {
      const f = (v) => +v.toFixed(2), ev = ['s', a.id, f(ox), f(oy), f(oz), w.id];
      for (let i = 0; i < Math.min(3, ends.length); i++) ev.push(f(ends[i].x), f(ends[i].y), f(ends[i].z));
      this.net.ev(ev);
    }
    if (!a.isPlayer) {
      const dx = a.pos.x - this.player.pos.x, dz = a.pos.z - this.player.pos.z, dist = Math.hypot(dx, dz);
      this.sound.shot(w, 1.1 / (1 + dist / 9), this.pan(dx, dz, dist));
    }
  }

  // ---- snapshots (host -> clients) ----
  buildSnap(withKd) {
    const r = (v) => Math.round(v * 100);
    const a = this.actors.map((e) => [e.id, r(e.pos.x), r(e.pos.y), r(e.pos.z), Math.round(e.yaw * 1000), Math.round(e.pitch * 1000),
      (e.alive ? 1 : 0) | (e.crouch ? 2 : 0) | (e.reloading ? 4 : 0) | (e.ads > 0.5 ? 8 : 0) | (e.cur << 4) | (e.protT > 0 ? 64 : 0), ...(withKd ? [e.kills, e.deaths] : [])]);
    return { ht: +this.time.toFixed(3), mt: +this.matchT.toFixed(2), ts: this.teamScore, a };
  }

  applySnap(s) {
    const now = performance.now() / 1000, off = s.ht - now;
    this.clockOff = this.clockOff == null || Math.abs(off - this.clockOff) > 1 ? off : this.clockOff + (off - this.clockOff) * 0.1;
    this.matchT = s.mt; this.teamScore = s.ts;
    for (const e of s.a) {
      const a = this.byId(e[0]); if (!a) continue;
      if (e.length > 7) { a.kills = e[7]; a.deaths = e[8]; }
      if (a.isPlayer) continue;
      const f = e[6], alive = !!(f & 1);
      if (alive !== a.alive) { a.alive = alive; a.deathT = 0; if (alive) { if (a.rag) { a.rag = null; Ragdoll.reset(a.mesh); } a.mesh.body.rotation.set(0, 0, 0); } }
      a.crouch = !!(f & 2); a.reloading = !!(f & 4); a.protT = (f & 64) ? 1 : 0;
      const cur = (f >> 4) & 1;
      if (cur !== a.cur) { a.cur = cur; a.weapon = a.weapons[cur]; this.setActorGun(a); }
      a.ibuf.push({ t: s.ht, x: e[1] / 100, y: e[2] / 100, z: e[3] / 100, yaw: e[4] / 1000, pitch: e[5] / 1000 });
      if (a.ibuf.length > 12) a.ibuf.shift();
    }
  }

  // client: interpolate remote players ~100 ms behind the newest snapshot
  updateRemotes(dt) {
    if (this.clockOff == null) return;
    const rt = performance.now() / 1000 + this.clockOff - 0.13;
    this.renderT = rt;
    for (const a of this.actors) {
      if (a.isPlayer || !a.ibuf.length) continue;
      const b = a.ibuf; let i = b.length - 1;
      while (i > 0 && b[i - 1].t > rt) i--;
      const B = b[i], A = b[Math.max(0, i - 1)];
      const k = B.t > A.t ? clamp((rt - A.t) / (B.t - A.t), 0, 1) : 1;
      let dy = B.yaw - A.yaw; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
      const span = Math.max(0.02, B.t - A.t);
      a.vel.set((B.x - A.x) / span, 0, (B.z - A.z) / span);
      if (k >= 1) a.vel.set(0, 0, 0);
      a.pos.set(lerp(A.x, B.x, k), lerp(A.y, B.y, k), lerp(A.z, B.z, k));
      a.yaw = A.yaw + dy * k; a.pitch = lerp(A.pitch, B.pitch, k);
      a.h = a.crouch ? 1.25 : 1.8;
    }
  }

  // ---- events (host -> clients) ----
  applyEvents(list) {
    for (const e of list) {
      switch (e[0]) {
        case 's': {
          const a = this.byId(e[1]); if (!a || a.isPlayer) break;
          a.lastShot = this.time;
          const w = WEAPONS[e[5]]; if (!w) break;
          const mu = { x: e[2], y: e[3] - 0.18, z: e[4] };
          for (let i = 6; i + 2 < e.length; i += 3) this.tracer(mu, { x: e[i], y: e[i + 1], z: e[i + 2] });
          const dx = a.pos.x - this.player.pos.x, dz = a.pos.z - this.player.pos.z, dist = Math.hypot(dx, dz);
          this.sound.shot(w, 1.1 / (1 + dist / 9), this.pan(dx, dz, dist));
          break;
        }
        case 'sp': {
          const a = this.byId(e[1]); if (!a) break;
          a.sseq = e[5];
          this.placeActor(a, e[2], e[3], e[4], false, e[6] || 0);
          a.alive = true; a.deathT = 0; a.protT = 2;
          if (!a.isPlayer) a.mesh.root.visible = true;
          break;
        }
        case 'k': this.applyKill(e[1], e[2], e[3], !!e[4]); break;
        case 'h': { const a = this.byId(e[1]); if (a && this.player.alive) { this.hud.damageFrom(a, this.player); this.sound.hurt(); this.player.lastHurt = this.time; } break; }
        case 'hm': this.hud.hitmarker(!!e[1], !!e[2]); this.sound.hit(!!e[2]); break;
        case 'add': if (!this.byId(e[1].id)) this.addNetActor(e[1], false, true); break;
        case 'rm': this.removeNetActor(e[1]); break;
        case 'lo': this.applyLoadout(this.byId(e[1]), e[2], e[3], e[4], e[5]); break;
        case 'hp': if (this.player.alive) this.player.hp = e[1]; break;
        case 'end': this.netEnd(e[1], e[2], e[3]); break;
        default: if (this.zm && typeof e[0] === 'string' && e[0][0] === 'z') this.zm.onEvent(e); break;
      }
    }
  }

  applyKill(kid, vid, wid, head) {
    const v = this.byId(vid), k = this.byId(kid) || (kid < 0 && v ? this.fakeKiller(v) : null), w = WEAPONS[wid];
    if (!k || !v || !w) return;
    v.alive = false; v.hp = 0; v.deathT = 0; v.reloading = false; v.respawnT = 3.2; v.deaths++; if (k !== v) k.kills++;
    this.spawnGore(v, k, w, head); this.startRagdoll(v, k, w, head);
    this.killXp(k, v, head);
    this.ggOnKill(k, v, w);
    if (!v.zombie) this.hud.feed(k, v, w, head, this);
    if (v.isPlayer) { this.killer = k; v.down = false; this.hud.onDeath(k, w, head); this.fireHeld = false; this.adsHeld = false; }
    if (k.isPlayer && k !== v) {
      this.sound.kill();
      if (!v.zombie && !this.mode.gg) for (let i = 0; i < 2; i++) { const am = k.ammo[i]; am.res = Math.min(k.weapons[i].reserve, am.res + Math.ceil(k.weapons[i].mag / 2)); }
    }
  }

  netEnd(win, kd, ts) {
    if (this.ended) return;
    for (const r of kd) { const a = this.byId(r[0]); if (a) { a.kills = r[1]; a.deaths = r[2]; } }
    this.teamScore = ts; this.ended = true; this.state = 'ended';
    this.keys = {}; this.fireHeld = false; this.adsHeld = false; this.adsKey = false; this.breath = 1; this.breathEx = 0; this.showScore = false;
    try { document.exitPointerLock(); } catch (e) { /* ignore */ }
    this.finishXp(win);
    this.hud.showEnd(this, win);
  }

  // ------------------------------------------------------------------ meshes
  makeBotMesh(color, weapon, label) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    let seed = 0; for (const ch of String(label || Math.random())) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
    const sol = buildSoldier(body, color, seed), legs = sol.legs;
    const parts = [...body.children];            // the blocky soldier (hidden while the easter egg is on)
    const gun = buildGun(weapon); gun.position.set(0.14, 1.24, -0.3); body.add(gun);
    const m = { root, body, legs, gun, gunId: weapon.id, parts, rich: null, headG: sol.head, arms: sol.arms, goreHidden: [], color };
    if (this.richtofen && richtofenReady()) this.applyRich(m, true);
    if (label) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const c = cv.getContext('2d'); c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#5ec2ff'; c.strokeStyle = '#000'; c.lineWidth = 6;
      c.strokeText(label, 128, 44); c.fillText(label, 128, 44);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
      sp.scale.set(1.3, 0.33, 1); sp.position.set(0, 2.15, 0); root.add(sp);
    }
    return m;
  }

  // easter egg: swap an actor's blocky body for the Richtofen model
  applyRich(m, on) {
    if (on && !m.rich) { m.rich = makeRichtofen(); m.body.add(m.rich); }
    if (m.rich) m.rich.visible = on;
    for (const p of m.parts) p.visible = !on;
  }

  setRichtofen(on) {
    this.richtofen = on;
    for (const a of this.actors) if (a.mesh) this.applyRich(a.mesh, on);
  }

  // swap the gun model held by an actor's third-person body
  setActorGun(a) {
    const m = a.mesh; if (!m || m.gunId === a.weapon.id) return;
    const old = m.gun, pos = old.position.clone();
    m.body.remove(old);
    m.gun = buildGun(a.weapon); m.gun.position.copy(pos); m.body.add(m.gun); m.gunId = a.weapon.id;
  }

  toggleView(view) {
    this.settings.view = view || (this.settings.view === 'third' ? 'first' : 'third');
    if (this.state === 'playing') this.hud.center(this.settings.view === 'third' ? 'THIRD PERSON' : 'FIRST PERSON', 0.7);
    if (this.onViewChange) this.onViewChange(this.settings.view);
  }

  // distance to the first thing (world or enemy) hit by a ray - used to aim from the third-person camera
  aimDistance(o, d, self, maxD) {
    let best = this.col.ray(o.x, o.y, o.z, d.x, d.y, d.z, maxD);
    for (const e of this.actors) {
      if (!e.alive || e === self || e.team === self.team) continue;
      const th = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, e.pos.x, e.pos.y + e.h - 0.2, e.pos.z, 0.21);
      const tb = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, e.pos.x - 0.32, e.pos.y, e.pos.z - 0.32, e.pos.x + 0.32, e.pos.y + e.h - 0.4, e.pos.z + 0.32);
      best = Math.min(best, th, tb);
    }
    return best;
  }

  setPlayerVm() {
    const p = this.player; if (!p) return;
    for (const c of [...this.vmRoot.children]) this.vmRoot.remove(c);
    const w = this.vmWeapon();
    const key = `${w.id}:${w.attMask || 0}`;
    if (!this.vmCache[key]) this.vmCache[key] = this.buildVm(w);
    this.vm = this.vmCache[key];
    this.vmRoot.add(this.vm.root);
  }

  buildVm(w) {
    const root = new THREE.Group(), gun = buildGun(w); root.add(gun);
    const u = gun.userData, G = u.grip, F = u.fore;
    const glove = new THREE.MeshStandardMaterial({ color: 0x2a2f29, roughness: 0.9 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x3b4a3a, roughness: 0.95 });
    const lh = new THREE.Group(); gun.add(lh); lh.visible = w.cls !== 'melee';                      // support hand: animated separately (reloads, pumping, inspecting)
    const add = (w_, h_, d_, mt, x, y, z, rx = 0, ry = 0, rz = 0, parent = gun) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w_, h_, d_), mt); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); parent.add(me); return me; };
    // trigger hand: the palm sits on the back of the grip, three fingers wrap round the front, the index finger rests on the
    // trigger, the thumb lies along the left side. The whole hand is raked to match the angle of the grip.
    const rake = u.pistol ? -0.3 : -0.36;
    const hand = new THREE.Group(); hand.position.set(G.x, G.y, G.z); hand.rotation.x = rake; gun.add(hand);
    add(0.05, 0.085, 0.034, glove, 0.0, 0.0, 0.034, 0, 0, 0, hand);                         // palm / back of the hand on the backstrap
    add(0.046, 0.024, 0.05, glove, 0.0, 0.048, 0.016, 0, 0, 0, hand);                       // knuckles above the grip
    for (let i = 0; i < 3; i++) add(0.044, 0.022, 0.046, glove, 0.0, -0.002 - i * 0.026, -0.03, 0, 0, 0, hand);   // fingers wrapped round the front
    add(0.014, 0.014, 0.05, glove, 0.004, 0.046, -0.048, 0, 0, 0, hand);                    // index finger on the trigger
    add(0.016, 0.03, 0.06, glove, -0.03, 0.03, 0.005, -0.15, 0, 0.12, hand);                // thumb along the left of the frame
    const armMesh = add(0.07, 0.07, 0.36, sleeve, G.x + 0.045, G.y - 0.07, G.z + 0.24, 0.5, 0.18, 0);
    // support hand
    if (u.pistol) {
      // two-handed pistol grip: left palm on the left of the grip, fingers over the right hand's fingers, thumb forward on the frame
      add(0.026, 0.075, 0.05, glove, G.x - 0.036, G.y - 0.004, G.z + 0.01, rake, 0, 0, lh);
      for (let i = 0; i < 3; i++) add(0.05, 0.02, 0.026, glove, G.x - 0.008, G.y - 0.03 - i * 0.022, G.z - 0.052, rake, 0, 0, lh);
      add(0.014, 0.016, 0.06, glove, G.x - 0.042, G.y + 0.025, G.z - 0.045, 0, 0, 0, lh);
      add(0.07, 0.07, 0.34, sleeve, F.x - 0.09, F.y - 0.08, F.z + 0.22, 0.5, -0.4, 0, lh);
    } else {
      // C-clamp under the handguard: palm underneath, fingers up the right side, thumb up the left
      add(0.07, 0.034, 0.1, glove, F.x, F.y - 0.05, F.z + 0.005, 0, 0, 0, lh);                // palm under the handguard
      for (let i = 0; i < 4; i++) add(0.02, 0.05, 0.02, glove, F.x + 0.042, F.y - 0.022, F.z - 0.032 + i * 0.022, 0, 0, -0.35, lh);   // four fingers curled up the right side
      add(0.016, 0.05, 0.05, glove, F.x - 0.04, F.y - 0.018, F.z - 0.005, 0, 0, 0.3, lh);     // thumb up the left side
      add(0.075, 0.07, 0.42, sleeve, F.x - 0.075, F.y - 0.1, F.z + 0.3, 0.38, -0.28, 0, lh);
    }
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: this.flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    flash.position.copy(u.muzzle); flash.visible = false; gun.add(flash);
    // moving parts the animations drive (tagged in gunmodels.js)
    const mags = [], slides = [], bolts = [], pumps = [];
    gun.traverse((o) => {
      const d = o.userData; if (!d || o === gun) return;
      const e = { m: o, p: o.position.clone() };
      if (d.mag) mags.push(e); if (d.slide) slides.push(e); if (d.bolt) bolts.push(e); if (d.pump) pumps.push(e);
    });
    // where the support hand goes to reload: the magazine, or the receiver for shotguns / bolt guns / revolvers
    let tgt = new V3(0, -0.04, 0.0);
    if (mags.length && w.cls !== 'shotgun' && w.cls !== 'sniper') {
      // baked models keep every vertex in gun space (the mesh itself sits at the origin), so use the middle of the mag's bounding box, not its position
      tgt = new V3();
      for (const e of mags) {
        const g = e.m.geometry; if (g && !g.boundingBox && typeof g.computeBoundingBox === 'function') g.computeBoundingBox();
        const bb = g && g.boundingBox;
        tgt.x += e.p.x + (bb ? (bb.min.x + bb.max.x) / 2 : 0); tgt.y += e.p.y + (bb ? (bb.min.y + bb.max.y) / 2 : 0); tgt.z += e.p.z + (bb ? (bb.min.z + bb.max.z) / 2 : 0);
      }
      tgt.multiplyScalar(1 / mags.length);
    }
    const reach = new V3(tgt.x - F.x, tgt.y - F.y + (u.pistol ? 0.04 : 0.05), tgt.z - F.z);
    let piv = null, arm = null;
    if (w.cls === 'melee') {                         // knives: the hand + blade spin on a wrist pivot while the forearm only twists, so a karambit spin looks like a real wrist roll
      piv = new THREE.Group(); piv.position.set(G.x, G.y, G.z); root.remove(gun); gun.remove(armMesh); gun.position.set(-G.x, -G.y, -G.z); piv.add(gun); root.add(piv);
      arm = armMesh; arm.userData.base = { x: arm.rotation.x, y: arm.rotation.y, z: arm.rotation.z }; root.add(arm);
    }
    return { root, gun, piv, arm, flash, sightY: u.sightY, lh, mags, slides, bolts, pumps, reach, cls: w.cls, id: w.id, pistol: u.pistol };
  }

  flashTexture() {
    if (this._flashTex) return this._flashTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.35, 'rgba(255,190,80,0.8)'); g.addColorStop(1, 'rgba(255,120,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    this._flashTex = new THREE.CanvasTexture(cv);
    return this._flashTex;
  }

  initFx() {
    const tg = new THREE.BoxGeometry(0.025, 0.025, 1);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0.9, fog: false }));
      m.visible = false; m.life = 0; this.fxGroup.add(m); this.tracers.push(m);
    }
    const pg = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      m.visible = false; m.life = 0; m.vel = new V3(); this.fxGroup.add(m); this.particles.push(m);
    }
    this.laserDot = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false }));
    this.laserDot.visible = false; this.fxGroup.add(this.laserDot);
    this.tracerI = 0; this.partI = 0;
    this.gore = new Gore(this.fxGroup, this.col);
  }

  tracer(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz);
    if (len < 2) return;
    const m = this.tracers[this.tracerI++ % this.tracers.length];
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.lookAt(b.x, b.y, b.z); m.scale.set(1, 1, Math.min(len, 60)); m.life = 0.07; m.visible = true; m.material.opacity = 0.9;
  }

  burst(x, y, z, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const m = this.particles[this.partI++ % this.particles.length];
      m.position.set(x, y, z); m.material.color.setHex(color);
      m.vel.set(rand(-1, 1) * speed, rand(0.2, 1.2) * speed, rand(-1, 1) * speed); m.life = rand(0.25, 0.5); m.visible = true;
    }
  }

  // ------------------------------------------------------------------ main loop
  frame(dt) {
    dt = Math.min(dt, 0.05);
    if (this.race && this.race.active) { this.race.frame(dt); return; }
    if (!this.scene) return;
    if (this.gfxQ.lambert && (this.gfxT = (this.gfxT || 0) - dt) <= 0) { this.gfxT = 2.5; this.gfxSweep(); }     // low: keep swapping materials on freshly spawned meshes (bots, props)
    if (this.state === 'playing' || (this.net && this.state === 'paused')) this.update(dt);
    this.render(dt);
  }

  update(dt) {
    this.dt = dt;
    this.time += dt;
    this.matchT += dt;
    const p = this.player;
    // countdown
    if (this.matchT < 0) {
      const c = Math.ceil(-this.matchT);
      if (c !== this.lastCountdown) { this.lastCountdown = c; this.hud.center(String(c), 1.1); this.sound.beep(false); }
    } else if (this.lastCountdown !== 0) { this.lastCountdown = 0; this.hud.center('FIGHT!', 1.2); this.sound.beep(true); }
    else if (!this.ended) this.timeLeft = Math.max(0, this.mode.time - this.matchT);

    const client = this.isClient;
    this.updatePlayer(dt);
    if (client) this.updateRemotes(dt);
    for (const a of this.actors) {
      if (a.isPlayer) continue;
      if (client) { if (!a.alive) a.deathT += dt; continue; }
      if (a.alive) {
        if (a.brain) a.brain.update(dt);
        a.protT = Math.max(0, a.protT - dt);
        if (a.tgt) { a.pos.lerp(a.tgt, 1 - Math.exp(-22 * dt)); a.pos.y = a.tgt.y; }
      } else {
        a.deathT += dt; a.respawnT -= dt;
        if (a.dummy || a.zombie) { if (a.deathT > (a.zombie ? 6 : 8)) this.removeNetActor(a.id); }          // dead dummies / zombies are cleared away
        else if (a.respawnT <= 0 && !this.ended && !this.noRespawn) this.spawn(a);
      }
    }
    for (const a of this.actors) {
      if (!a.alive) continue;
      a.fireCd -= dt; a.switchT -= dt;
      if (a.remote && a.fireCd < -0.25) a.fireCd = -0.25;
      if (a.reloading && !a.remote) { a.reloadT -= dt; if (a.reloadT <= 0) this.finishReload(a); }
      if (a.heat > 0) a.heat = Math.max(0, a.heat - dt * 3);
      if (!client && !a.down && !a.zombie && this.time - a.lastHurt > 5 && a.hp < 100) a.hp = Math.min(100, a.hp + dt * 25);
      this.stepSounds(a, dt);
      if (a.mesh) this.syncMesh(a, dt);
    }
    for (const a of this.actors) if (!a.alive && a.mesh) this.syncMesh(a, dt);
    if (this.obj && !this.ended && this.matchT >= 0) this.obj.update(dt);
    if (this.streaks && !this.ended) this.streaks.update(dt);
    if (this.zm) this.zm.update(dt);
    this.updateFx(dt);

    if (!client && !this.ended) this.checkEnd();
    if (this.net) this.net.tick(dt);
    this.hud.update(this);
  }

  stepSounds(a, dt) {
    if (a.zombie) return;
    const sp = Math.hypot(a.vel.x, a.vel.z);
    if (!a.onGround || sp < 1.5 || (a.isPlayer && a.crouch)) { return; }
    a.stepT += sp * dt;
    if (a.stepT > 2.4) {
      a.stepT = 0;
      if (a.isPlayer) { this.sound.step(sp > 6 ? 0.22 : 0.12, 0); return; }
      const dx = a.pos.x - this.player.pos.x, dz = a.pos.z - this.player.pos.z, d = Math.hypot(dx, dz);
      if (d < 26) this.sound.step(0.5 / (1 + d / 4), this.pan(dx, dz, d));
    }
  }

  pan(dx, dz, d) { const y = this.player.yaw; return d > 0.1 ? (dx * Math.cos(y) - dz * Math.sin(y)) / d : 0; }

  // ------------------------------------------------------------------ actors: movement + weapons
  moveActor(a, wx, wz, speed, dt, jump, crouch) {
    const accel = a.onGround ? 11 : 2.2, k = Math.min(1, accel * dt);
    a.vel.x += (wx * speed - a.vel.x) * k;
    a.vel.z += (wz * speed - a.vel.z) * k;
    a.vel.y -= GRAVITY * dt * (a.isPlayer ? MOD.gravity : 1);
    if (jump && a.onGround) { a.vel.y = 7.2 * (a.isPlayer ? MOD.jump : 1); a.onGround = false; }
    if (crouch) a.h = 1.25;
    else if (a.h < 1.8 && !this.col.overlaps(a.pos.x, a.pos.y, a.pos.z, a.hw, 1.8)) a.h = 1.8;
    this.col.move(a, dt);
    a.crouch = a.h < 1.8;
  }

  // advances a mantle: up the face of the ledge first, then forward over the lip
  stepMantle(a, dt) {
    const m = a.mantle; m.t += dt;
    const u = Math.min(1, m.t / m.dur), sm = (x) => x * x * (3 - 2 * x);
    // vault (low ledge): hop up and carry on over in one flowing motion. climb (high ledge): haul up the face first, then forward over the lip.
    const v = m.vault ? sm(Math.min(1, u / 0.55)) : sm(Math.min(1, u / 0.65)), h = m.vault ? sm(Math.max(0, (u - 0.25) / 0.75)) : sm(Math.max(0, (u - 0.5) / 0.5));
    a.pos.set(m.sx + (m.ex - m.sx) * h, m.sy + (m.ey - m.sy) * v, m.sz + (m.ez - m.sz) * h);
    a.vel.set(0, 0, 0); a.onGround = false;
    if (u >= 1) { a.pos.set(m.ex, m.ey, m.ez); a.mantle = null; a.onGround = true; a.vel.x = m.cx; a.vel.z = m.cz; }
  }

  // starts a mantle if there is a ledge ahead that can be reached; returns true when it did
  tryMantle(p, fx, fz, maxUp, auto) {
    const L = this.col.findLedge(p, fx, fz, maxUp);
    if (!L) return false;
    const up = L.y - p.pos.y, vault = up <= 1.3, carry = Math.min(5.5, Math.max(p.speed2 || 0, 3)) * (vault ? 0.85 : 0.35);
    p.mantle = { t: 0, vault, dur: vault ? 0.28 + up * 0.12 : 0.4 + up * 0.17, sx: p.pos.x, sy: p.pos.y, sz: p.pos.z, ex: L.x, ey: L.y, ez: L.z, cx: fx * carry, cz: fz * carry };
    p.slideT = 0; p.vel.set(0, 0, 0); p.mantleCd = 0.45; p.sprint = false;
    return true;
  }

  // world position of a point on a dead actor's body (the corpse falls over, so stump positions follow it)
  stumpPos(v, lp) {
    if (v.alive || !v.mesh) return null;
    if (v.rag) return v.rag.toWorld(lp);
    const ang = Math.min(1, v.deathT * 3) * (Math.PI / 2), c = Math.cos(ang), s2 = Math.sin(ang);
    const y = lp.y * c - lp.z * s2, z = lp.y * s2 + lp.z * c, cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
    return [v.pos.x + lp.x * cy + z * sy, v.pos.y + y, v.pos.z - lp.x * sy + z * cy];
  }

  // Euphoria-style active ragdoll: the dying soldier staggers, clutches the wound and braces before going limp (ragdoll.js)
  startRagdoll(v, k, w, head) {
    if (!v.mesh || !this.settings.ragdoll || !this.gfxQ.ragdoll) return;
    try { Ragdoll.reset(v.mesh); v.rag = makeRagdoll(this.col, v, v.mesh, k, w, head); } catch (e) { v.rag = null; }
  }

  // GoreBox-style death: blood spray + splatter on walls and floor, a growing pool, spurting stumps, flying parts
  // (head/torso/arm/leg each have 3 models, plus chunks and organs) leaving blood trails. See gore.js.
  spawnGore(v, k, w, head) {
    const gr = this.gore; if (!gr || !this.settings.gore || !this.gfxQ.gore || !v.mesh) return;
    const m = v.mesh, cls = (w.id === 'm680' || w.id === 'aa12') ? 'shotgun' : (w.id === 'kar98k' || w.id === 'dmr') ? 'sniper' : 'other', big = cls !== 'other' || head;
    let dx = v.pos.x - k.pos.x, dz = v.pos.z - k.pos.z; const dl = Math.hypot(dx, dz);
    if (dl < 0.01) { const a = Math.random() * 6.28; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= dl; dz /= dl; }
    const x = v.pos.x, y = v.pos.y, z = v.pos.z, cy = y + (head ? 1.6 : 1.25);
    gr.spray(x, cy, z, dx, 0.3, dz, big ? 42 : 26, 7, 0.55);              // exit spray along the shot
    gr.spray(x, cy, z, -dx, 0.4, -dz, 10, 3, 0.9);                         // and a little back at the shooter
    gr.splatter(x, cy, z, dx, dz, big ? 18 : 10);                          // walls, floor, crates
    gr.splat({ x, y, z, nx: 0, ny: 1, nz: 0 }, 0.9 + Math.random() * 0.4, true);
    if (big) gr.splat({ x: x + dx * 0.7, y, z: z + dz * 0.7, nx: 0, ny: 1, nz: 0 }, 0.7, true);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const list = [];
    if (head && (cls !== 'other' || Math.random() < 0.7)) list.push('head');
    if (cls === 'shotgun') for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) list.push(pick(['arm', 'leg', 'arm', 'leg', 'torso']));
    else if (cls === 'sniper') for (let i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++) list.push(pick(['arm', 'leg', 'torso']));
    else if (!head && Math.random() < 0.55) for (let i = 0, n = 1 + Math.floor(Math.random() * 2); i < n; i++) list.push(pick(['arm', 'leg']));
    else if (head && Math.random() < 0.25) list.push(pick(['arm', 'leg']));
    const power = cls === 'shotgun' ? 1.4 : 1, rich = m.rich && m.rich.visible;
    for (const part of list) {
      let yy = 1.2, ref = null;
      if (part === 'head') { yy = 1.6; ref = m.headG; }
      else if (part === 'arm') { ref = pick(m.arms.filter((o) => o.visible)) || null; yy = 1.15; }
      else if (part === 'leg') { ref = pick(m.legs.filter((o) => o.visible)) || null; yy = 0.6; }
      if ((part === 'arm' || part === 'leg') && !ref) continue;
      if (ref && !rich && ref.visible) {
        ref.visible = false; m.goreHidden.push(ref);
        const lp = ref.position; gr.bleed(() => this.stumpPos(v, lp), 2.8, part === 'head' ? 1.3 : 1);
      }
      const sp = rand(3, 7) * power;
      gr.gib(part, { x, y: y + yy, z }, { x: dx * sp + rand(-2, 2), y: rand(2.5, 6), z: dz * sp + rand(-2, 2) }, m.color);
    }
    for (let i = 0, n = big ? 7 + Math.floor(Math.random() * 7) : 2 + Math.floor(Math.random() * 3); i < n; i++) {
      const sp = rand(2, 8) * power;
      gr.gib('chunk', { x, y: y + rand(0.9, 1.5), z }, { x: dx * sp + rand(-3, 3), y: rand(2, 7), z: dz * sp + rand(-3, 3) }, m.color);
    }
    if (!list.length) gr.bleed(() => this.stumpPos(v, { x: 0, y: 1.25, z: -0.1 }), 1.4, 0.7);   // torso wound
  }

  canFire(a) { return a.alive && this.matchT >= 0 && a.switchT <= 0 && !a.reloading && !a.mantle && a.fireCd <= 0 && a.ammo[a.cur].mag > 0; }

  // ---- melee: tap V = quick lunge with your knife (one hit kills), hold V = take the knife out (LMB slashes), tap/1/2 to put it away
  knifeW() { return WEAPONS[this.knifeId] || WEAPONS.k_combat; }
  startInspect() {                                    // F: this weapon's own inspect sequence (see inspect.js)
    const p = this.player, S = this.vmS; if (!p || !this.vm || !p.alive || p.reloading || p.sprint || S.inspectT > 0 || p.switchT > 0) return;
    S.inspectT = S.inspectDur = inspectFor(this.vm.id).dur;
  }
  vmWeapon() { return (this.knifeOut || this.swing) ? this.knifeW() : this.player.weapon; }
  toggleKnife() {
    const p = this.player; if (!p || !p.alive || this.state !== 'playing') return;
    this.knifeOut = !this.knifeOut; this.swing = null; p.reloading = false; this.adsKey = false; this.adsHeld = false; this.vmS.inspectT = 0; p.switchT = Math.max(p.switchT, 0.2);
    this.setPlayerVm(); this.sound.switchGun();
  }
  stowKnife() { if (!this.knifeOut) return; this.knifeOut = false; this.swing = null; this.player.switchT = Math.max(this.player.switchT, 0.3); this.setPlayerVm(); this.sound.switchGun(); }
  startSwing(kind) {
    const p = this.player; if (!p || !p.alive || this.swing || this.matchT < 0 || p.mantle || this.ended) return;
    const kw = this.knifeW(), quick = kind === 'quick';
    this.swing = { t: 0, dur: quick ? Math.max(0.5, kw.cd * 1.1) : kw.cd, kind, hit: false };
    p.reloading = false; this.adsKey = false; this.adsHeld = false; this.vmS.inspectT = 0;
    this.setPlayerVm(); this.sound.swish();
  }
  updateMelee(dt) {
    if (this.vHeld && !this.vHandled && performance.now() - this.vDownT > 350) { this.vHandled = true; this.toggleKnife(); }
    const s = this.swing; if (!s) return;
    s.t += dt;
    if (!s.hit && s.t >= s.dur * 0.38) { s.hit = true; this.meleeStrike(this.player, s.kind === 'quick' ? 100 : this.knifeW().dmg, s.kind === 'quick'); }
    if (s.t >= s.dur) { this.swing = null; if (!this.knifeOut) this.setPlayerVm(); }
  }
  meleeStrike(p, dmg, quick) {
    const kw = this.knifeW(), d = this.dirFrom(p.yaw, p.pitch, new V3()), ox = p.pos.x, oy = p.pos.y + p.eye, oz = p.pos.z;
    const w = { ...kw, dmg, range: [kw.maxD, kw.maxD], minMul: 1, hs: 1 };
    const end = this.hitscan(p, ox, oy, oz, d, w, 1);
    const idx = Math.max(0, KNIVES.indexOf(kw.id));
    if (this.isClient) this.net.sendShot(ox, oy, oz, [+d.x.toFixed(4), +d.y.toFixed(4), +d.z.toFixed(4)], (quick ? 2 : 7) + idx, this.renderT || 0);
    else if (this.isHost) { const f = (v) => +v.toFixed(2); this.net.ev(['s', p.id, f(ox), f(oy), f(oz), kw.id]); }
  }

  startReload(a) {
    if (a.isPlayer && (this.knifeOut || this.swing)) return;
    const am = a.ammo[a.cur], w = a.weapon;
    if (!a.alive || a.reloading || am.mag >= w.mag || (am.res <= 0 && !a.brain) || a.switchT > 0) return;
    a.reloading = true; a.reloadT = w.reload * ((a.perks & 4) ? 0.5 : 1) * (a.isPlayer && MOD.fastReload ? 0.05 : 1);
    if (a.isPlayer) this.sound.reload(0);
  }
  finishReload(a) {
    const am = a.ammo[a.cur], w = a.weapon;
    a.reloading = false;
    const need = w.mag - am.mag;
    if (a.brain) { am.mag = w.mag; return; }           // bots never run dry
    const take = Math.min(need, am.res); am.mag += take; am.res -= take;
    if (a.isPlayer) this.sound.reload(1);
  }
  switchWeapon(a, idx) {
    if (!a.alive || idx === a.cur || a.switchT > 0.1) return;
    a.cur = idx; a.weapon = a.weapons[idx]; a.reloading = false; a.switchT = 0.38; a.ads = 0;
    if (a.isPlayer) { this.setPlayerVm(); this.setActorGun(a); this.sound.switchGun(); }
  }

  los(a, e) {
    const ox = a.pos.x, oy = a.pos.y + 1.6, oz = a.pos.z;
    const dx = e.pos.x - ox, dy = e.pos.y + e.h * 0.62 - oy, dz = e.pos.z - oz, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.col.ray(ox, oy, oz, dx / d, dy / d, dz / d, d, true) >= d - 0.35;
  }

  dirFrom(yaw, pitch, out) {
    const cp = Math.cos(pitch);
    return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  }

  spreadDir(dir, s, out) {
    if (s <= 0) return out.copy(dir);
    const up = Math.abs(dir.y) > 0.95 ? new V3(1, 0, 0) : new V3(0, 1, 0);
    const r = new V3().crossVectors(dir, up).normalize(), u = new V3().crossVectors(r, dir);
    const rad = s * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
    return out.copy(dir).addScaledVector(r, Math.cos(th) * rad).addScaledVector(u, Math.sin(th) * rad).normalize();
  }

  botFire(a, errYaw, errPitch, dmgMul) {
    const dir = this.dirFrom(a.yaw + errYaw, a.pitch + errPitch, new V3());
    const w = a.weapon;
    this.fireShot(a, dir, w.cls === 'shotgun' ? w.spread : w.spread * 0.3, dmgMul);
  }

  fireShot(a, dir, spread, dmgMul = 1) {
    const w = a.weapon, am = a.ammo[a.cur];
    am.mag--; if (a.isPlayer && MOD.infAmmo) am.mag++;
    a.fireCd = 60 / w.rpm / ((a.perks & 8) ? 1.4 : 1) / (a.isPlayer ? MOD.fireRate : 1); a.lastShot = this.time;
    const eyeH = a.isPlayer ? a.eye : 1.6;
    const ox = a.pos.x, oy = a.pos.y + eyeH, oz = a.pos.z;
    const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
    const mu = { x: ox + dir.x * 0.8 + rx * 0.2, y: oy - 0.18 + dir.y * 0.8, z: oz + dir.z * 0.8 + rz * 0.2 };
    const d = new V3(), ends = [], dirs = [];
    for (let i = 0; i < w.pellets; i++) {
      this.spreadDir(dir, spread, d);
      const end = this.hitscan(a, ox, oy, oz, d, w, dmgMul);
      this.tracer(mu, end); ends.push(end); dirs.push(+d.x.toFixed(4), +d.y.toFixed(4), +d.z.toFixed(4));
    }
    if (this.isClient) this.net.sendShot(ox, oy, oz, dirs, a.cur, this.renderT || 0);
    else if (this.isHost) {
      const f = (v) => +v.toFixed(2), ev = ['s', a.id, f(ox), f(oy), f(oz), w.id];
      for (let i = 0; i < Math.min(3, ends.length); i++) ev.push(f(ends[i].x), f(ends[i].y), f(ends[i].z));
      this.net.ev(ev);
    }
    // sound
    if (a.isPlayer) this.sound.shot(w, 1, 0);
    else {
      const dx = a.pos.x - this.player.pos.x, dz = a.pos.z - this.player.pos.z, dist = Math.hypot(dx, dz);
      this.sound.shot(w, 1.1 / (1 + dist / 9), this.pan(dx, dz, dist));
    }
    if (am.mag <= 0 && a.isPlayer) this.hud.center('RELOAD', 0.8);
  }

  hitscan(a, ox, oy, oz, d, w, mul, rew = 0) {
    const MAXD = w.maxD || 160;
    let best = this.col.ray(ox, oy, oz, d.x, d.y, d.z, MAXD), victim = null, head = false;
    for (const e of this.actors) {
      if (!e.alive || e === a || e.team === a.team) continue;
      const ep = rew ? this.posAt(e, rew) : { x: e.pos.x, y: e.pos.y, z: e.pos.z, h: e.h };
      const th = raySphere(ox, oy, oz, d.x, d.y, d.z, ep.x, ep.y + ep.h - 0.2, ep.z, 0.21);
      const tb = rayAABB(ox, oy, oz, d.x, d.y, d.z, ep.x - 0.32, ep.y, ep.z - 0.32, ep.x + 0.32, ep.y + ep.h - 0.4, ep.z + 0.32);
      let t = tb, hd = false;
      if (th < tb) { t = th; hd = true; }
      if (t < best) { best = t; victim = e; head = hd; }
    }
    const px = ox + d.x * best, py = oy + d.y * best, pz = oz + d.z * best;
    if (victim) {
      const r0 = w.range[0], r1 = w.range[1];
      const f = best <= r0 ? 1 : best >= r1 ? w.minMul : lerp(1, w.minMul, (best - r0) / (r1 - r0));
      this.burst(px, py, pz, 0xb01010, 4, 2.5);
      if (!this.isClient) this.damage(victim, a, w.dmg * mul * f * (head ? w.hs : 1), w, head);
    } else if (best < MAXD) {
      this.burst(px - d.x * 0.05, py - d.y * 0.05, pz - d.z * 0.05, py < 0.08 ? this.map.impact : 0xd8d2c4, 4, 2.2);
    }
    return { x: px, y: py, z: pz };
  }

  damage(v, attacker, amount, w, head) {
    if (!v.alive || v.protT > 0 || this.ended) return;
    if (v.isPlayer && MOD.god) return;
    if (MOD.dmgMul > 1 && attacker && attacker.isPlayer && v !== attacker) amount *= MOD.dmgMul;
    if (MOD.oneHit && attacker && attacker.isPlayer && v !== attacker) amount = 1e5;
    if (this.zm) { if (v.down) return; amount = this.zm.adjust(v, attacker, amount); if (v.zombie) this.zm.onHit(attacker, v); }
    v.hp -= amount; v.lastHurt = this.time;
    if (v.isPlayer) { this.hud.damageFrom(attacker, this.player); this.sound.hurt(); }
    if (v.remote && this.net) this.net.evTo(v.id, ['h', attacker.id]);
    if (attacker.isPlayer) { this.hud.hitmarker(v.hp <= 0, head); this.sound.hit(head); }
    else if (attacker.remote && this.net) this.net.evTo(attacker.id, ['hm', v.hp <= 0 ? 1 : 0, head ? 1 : 0]);
    if (v.brain) v.brain.onHurt(attacker);
    if (v.hp <= 0) { if (this.zm && !v.zombie) this.zm.down(v, attacker); else this.kill(v, attacker, w, head); }
  }

  kill(v, k, w, head) {
    v.alive = false; v.hp = 0; v.deaths++; v.deathT = 0; v.reloading = false; v.respawnT = v.isPlayer ? 3.2 : 3;
    this.spawnGore(v, k, w, head); this.startRagdoll(v, k, w, head);
    if (k !== v) { k.kills++; k.streak++; if (this.mode.team && !this.mode.obj && !this.mode.zm) this.teamScore[k.team]++; }
    v.streak = 0;
    if (this.obj) this.obj.onKill(v, k);
    this.ggOnKill(k, v, w);
    if (this.streaks && k.isPlayer && k !== v && !v.dummy) this.streaks.earn(k.streak);
    this.killXp(k, v, head);
    if (!v.zombie) this.hud.feed(k, v, w, head, this);
    if (this.net) this.net.ev(['k', k.id, v.id, w.id, head ? 1 : 0]);
    if (v.isPlayer) { this.killer = k; v.down = false; this.hud.onDeath(k, w, head); this.fireHeld = false; this.adsHeld = false; }
    if (k.isPlayer && k !== v) {
      this.sound.kill();
      if (!v.zombie) for (let i = 0; i < 2; i++) { const am = k.ammo[i]; am.res = Math.min(k.weapons[i].reserve, am.res + Math.ceil(k.weapons[i].mag / 2)); }
    }
    if (this.zm && v.zombie) this.zm.onKill(v, k, head);
  }

  // ------------------------------------------------------------------ progression (XP, ranks; see progress.js)
  award(n, label) {
    if (this.mode.sandbox || !n) return;
    this.matchXp += n; const lv = this.prog.add(n); this.hud.xp(`+${n} ${label}`);
    if (lv) {
      this.hud.xp(`LEVEL ${lv} - ${rankName(lv).toUpperCase()}`, true);
      for (const [id, l] of Object.entries(UNLOCK)) if (l === lv && WEAPONS[id]) this.hud.xp(`UNLOCKED ${WEAPONS[id].name.toUpperCase()}`, true);
      CAMOS.forEach((c) => { if (c.req.t === 'level' && c.req.n === lv) this.hud.xp(`${c.name.toUpperCase()} CAMO UNLOCKED`, true); });
    }
  }

  // called on every peer for each kill; only counts the local player's own kills and deaths
  gunKill(k, head) {                                  // per-gun kill / headshot tally -> weapon camo unlocks
    const id = k.weapon && k.weapon.id; if (!id || !this.prog.wstat) return;
    for (const c of this.prog.wstat(id, head) || []) this.hud.xp(`${WEAPONS[id].name.toUpperCase()}: ${CAMOS[c].name.toUpperCase()} CAMO UNLOCKED`, true);
  }

  killXp(k, v, head) {
    if (this.mode.sandbox || !k || !v) return;
    if (v.isPlayer) this.prog.stat('deaths');
    if (!k.isPlayer || k === v || v.dummy) return;
    this.gunKill(k, head);
    if (v.zombie) { this.prog.stat('kills'); this.award(10, head ? 'HEADSHOT' : 'ZOMBIE'); return; }
    this.prog.stat('kills'); this.award(XP_REWARD.kill, 'KILL');
    if (head) { this.prog.stat('heads'); this.award(XP_REWARD.headshot, 'HEADSHOT'); }
    if (k.streak >= 3) this.award(XP_REWARD.streak * Math.min(k.streak - 2, 6), `${k.streak} KILL STREAK`);
  }

  finishXp(win) {
    if (this.mode.sandbox || this.xpDone) return; this.xpDone = true;
    const p = this.player; this.prog.stat('matches');
    this.award(XP_REWARD.played, 'MATCH COMPLETE');
    if (this.mode.zm) { this.award(Math.min(1500, Math.max(0, this.teamScore[0] - 1) * 40), `ROUND ${this.teamScore[0]} REACHED`); this.endXp = this.matchXp; return; }
    if (win !== null && win === p.team) { this.prog.stat('wins'); this.award(XP_REWARD.win, 'VICTORY'); }
    this.endXp = this.matchXp;
  }

  checkEnd() {
    const m = this.mode;
    if (m.sandbox || m.zm) return;
    let over = false;
    if (m.gg && this.ggWin) over = true;
    else if (m.team) over = this.teamScore[0] >= m.scoreLimit || this.teamScore[1] >= m.scoreLimit;
    else over = this.actors.some((a) => a.kills >= m.scoreLimit);
    if (this.timeLeft <= 0 && this.matchT >= 0) over = true;
    if (over) this.endMatch();
  }

  endMatch() {
    if (this.ended) return;
    this.ended = true; this.state = 'ended';
    this.keys = {}; this.fireHeld = false; this.adsHeld = false; this.adsKey = false; this.breath = 1; this.breathEx = 0; this.showScore = false;
    let win;
    if (this.mode.zm) win = null;
    else if (this.mode.team) win = this.teamScore[0] === this.teamScore[1] ? null : (this.teamScore[0] > this.teamScore[1] ? 0 : 1);
    else if (this.mode.gg && this.ggWin) win = this.ggWin.team;
    else if (this.mode.gg) { const s = [...this.actors].sort((a, b) => b.gg - a.gg || b.kills - a.kills); win = s.length > 1 && s[0].gg === s[1].gg && s[0].kills === s[1].kills ? null : s[0].team; }
    else {
      const sorted = [...this.actors].sort((a, b) => b.kills - a.kills);
      win = sorted.length > 1 && sorted[0].kills === sorted[1].kills ? null : sorted[0].team;
    }
    if (this.isHost) this.net.ev(['end', win, this.actors.map((a) => [a.id, a.kills, a.deaths]), this.teamScore]);
    try { document.exitPointerLock(); } catch (e) { /* ignore */ }
    this.finishXp(win);
    this.hud.showEnd(this, win);
  }

  // ------------------------------------------------------------------ player
  updatePlayer(dt) {
    const p = this.player, k = this.keys;
    if (!p.alive) {
      p.deathT += dt; p.respawnT -= dt;
      if (p.respawnT <= 0 && !this.ended && !this.isClient && !this.noRespawn) this.spawn(p);
      return;
    }
    p.protT = Math.max(0, p.protT - dt);
    const frozen = this.matchT < 0;
    this.updateMelee(dt);
    const jm = Math.hypot(this.joy.x, this.joy.y), jOn = jm > 0.12;                                // analog stick (touch)
    const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) + (jOn ? -this.joy.y : 0), str = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + (jOn ? this.joy.x : 0);
    const w = p.weapon;
    const wantCrouch = !!(k.KeyC || k.ControlLeft);
    const down = !!p.down;
    const ads = (this.adsHeld || this.adsKey) && !frozen && p.switchT <= 0 && !p.reloading && !down && !this.knifeOut && !this.swing;
    const sprint = !!k.ShiftLeft && fwd > 0 && !ads && !wantCrouch && !this.fireHeld && !down;
    let speed = (sprint ? 8.0 : wantCrouch ? 2.6 : 5.2) * (this.knifeOut ? this.knifeW().moveMul : w.moveMul) * (ads ? 0.62 : 1) * ((p.perks & 16) ? 1.12 : 1) * MOD.speed;
    if (jOn && !sprint) speed *= Math.max(0.5, Math.min(1, jm * 1.15));      // a light push walks, a full push runs
    if (down) speed = 1.5;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    let wx = fx * fwd + rx * str, wz = fz * fwd + rz * str;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    if (frozen) { wx = 0; wz = 0; }
    // --- slide: crouch while sprinting; you keep your momentum and it bleeds off ---
    const crouchPress = wantCrouch && !this.prevCrouch; this.prevCrouch = wantCrouch;
    p.slideCd = Math.max(0, p.slideCd - dt); p.mantleCd = Math.max(0, p.mantleCd - dt);
    if (crouchPress && p.sprint && p.onGround && !frozen && !p.mantle && p.slideCd <= 0 && p.speed2 > 5.8) {
      p.slideT = 0.9; p.slideSp = Math.min(10.5, p.speed2 * 1.3); p.slideDx = p.vel.x / p.speed2; p.slideDz = p.vel.z / p.speed2; p.slideCd = 1.1;
    }
    let jump = !!k.Space && !frozen && !down, crouchNow = wantCrouch || down;
    if (p.slideT > 0) {
      p.slideT -= dt;
      if (!p.onGround || p.speed2 < 2.2 || p.mantle || (jump && p.onGround)) p.slideT = 0;     // slide-jump keeps the speed
      else {
        const u = p.slideT / 0.9; p.slideSp = Math.max(2.4, p.slideSp - dt * 9 * (1.3 - u));
        wx = p.slideDx; wz = p.slideDz; speed = p.slideSp; p.vel.x = wx * speed; p.vel.z = wz * speed;
        crouchNow = true; jump = false;
      }
    }
    // --- mantle: jump into a ledge that is too high to step up and you pull yourself over it ---
    if (p.mantle) this.stepMantle(p, dt);
    else {
      if (!frozen && !down && fwd > 0 && p.mantleCd <= 0) {
        if (!p.onGround) this.tryMantle(p, fx, fz, 1.7);                                                      // newer-COD air mantle: anywhere in a jump or fall, a ledge within arm's reach is grabbed (no button needed)
        else if (k.Space) this.tryMantle(p, fx, fz, 2.5);                                                      // from the ground: jump into a ledge up to ~2.2 m
        else if (sprint && p.onGround && p.speed2 > 6) this.tryMantle(p, fx, fz, 1.2, true);                   // sprinting into a waist/chest-high ledge vaults it automatically
      }
      if (!p.mantle) this.moveActor(p, wx, wz, speed, dt, jump, crouchNow);
    }
    p.eye += ((down ? 0.6 : p.slideT > 0 ? 0.9 : p.crouch ? 1.12 : 1.65) - p.eye) * Math.min(1, dt * 12);
    { const S = this.vmS; S.slk += ((p.slideT > 0 ? 1 : 0) - S.slk) * Math.min(1, dt * 10); S.mvk += ((p.mantle ? Math.sin(Math.PI * Math.min(1, p.mantle.t / p.mantle.dur)) : 0) - S.mvk) * Math.min(1, dt * 16); }
    p.ads += ((ads ? 1 : 0) - p.ads) * Math.min(1, dt * 11);
    p.sprint = sprint;
    p.speed2 = Math.hypot(p.vel.x, p.vel.z);

    // recoil recovery
    const firing = this.fireHeld && p.fireCd > -0.05;
    if (!firing) p.recoilBias *= Math.max(0, 1 - dt * 2.5);
    if (this.vmS.inspectT > 0 && (this.fireHeld || ads || sprint || p.reloading)) this.vmS.inspectT = 0;
    if (!firing && p.recoilDebt > 0) { const rec = Math.min(p.recoilDebt, dt * (0.1 + p.recoilDebt * 4)); p.pitch -= rec; p.recoilDebt -= rec; }

    // firing
    if (!frozen) {
      const want = w.auto ? this.fireHeld : this.fireEdge;
      if (this.knifeOut) { if ((this.fireHeld || this.fireEdge) && !this.swing && !sprint) this.startSwing('slash'); }
      else if (want && !sprint && !this.swing && (!down || w.cls === 'pistol')) {
        if (p.ammo[p.cur].mag <= 0) { if (this.fireEdge) { this.sound.click(); } this.startReload(p); }
        else if (this.canFire(p)) this.playerShoot(p, ads);
      }
    }
    this.fireEdge = false;
  }

  // current bullet spread (radians): hip -> ADS blend, then movement / heat / air penalties
  currentSpread(p) {
    const w = p.weapon, moveF = clamp((p.speed2 || 0) / 6, 0, 1);
    let spread = lerp(w.spread, w.adsSpread, p.ads);
    spread *= 1 + moveF * 0.9 * (1 - p.ads * 0.5) + (p.onGround ? 0 : 2) + p.heat * 0.7;
    if (p.crouch) spread *= 0.75;
    return spread;
  }

  playerShoot(p, ads) {
    const w = p.weapon;
    const spread = MOD.noSpread ? 0 : this.currentSpread(p);
    let dir = this.dirFrom(p.yaw + (this.swX || 0), p.pitch + (this.swY || 0), new V3());
    if (this.tp) {
      // third person: bullets leave the player's eye but must land where the (offset) camera crosshair points
      const cp = this.camera.position, t = this.aimDistance(cp, dir, p, 150);
      const ex = p.pos.x, ey = p.pos.y + p.eye, ez = p.pos.z;
      dir = new V3(cp.x + dir.x * t - ex, cp.y + dir.y * t - ey, cp.z + dir.z * t - ez).normalize();
    }
    this.fireShot(p, dir, spread, 1);
    p.heat = Math.min(1, p.heat + 0.12);
    // every shot rolls its own recoil: random climb (sometimes a big jolt), and a horizontal drift that random-walks through a burst
    const big = Math.random() < 0.12 ? 1.5 : 1;
    const kick = MOD.noRecoil ? 0 : w.recoil * (0.5 + Math.random() * 1.0) * big * (1 - p.ads * 0.3);
    p.recoilBias = clamp(p.recoilBias + (Math.random() - 0.5) * 1.1, -1.3, 1.3);
    const yawKick = ((Math.random() - 0.5) * 1.2 + p.recoilBias * 0.3) * w.recoilYaw * 0.45 * (1 - p.ads * 0.5) * (MOD.noRecoil ? 0 : 1);   // horizontal kick kept small: it moves the real aim
    p.pitch = clamp(p.pitch + kick, -1.5, 1.5); p.recoilDebt += kick * 0.85;
    p.yaw += yawKick;
    const S = this.vmS; S.slide = 1; S.cycle = 1; S.rand = (Math.random() - 0.5) * 2 + p.recoilBias * 0.4;
    S.shake = Math.min(1, S.shake + 0.35 * big * (w.cls === 'sniper' || w.cls === 'shotgun' ? 2 : 1));
    this.vmKick = Math.min(1.5, (this.vmKick || 0) + (w.cls === 'sniper' ? 1.5 : w.cls === 'shotgun' ? 1.2 : 0.55) * (0.75 + Math.random() * 0.5));
    if (this.vm) { this.vm.flash.visible = true; this.vm.flash.rotation.z = Math.random() * 6.28; const s = (0.7 + Math.random() * 0.6) * (this.player.weapon.flash == null ? 1 : this.player.weapon.flash); this.vm.flash.scale.set(s, s, 1); }
    this.flashLight.intensity = 6; this.flashT = 0.045;
  }

  // ------------------------------------------------------------------ visuals
  syncMesh(a, dt) {
    const m = a.mesh;
    if (!a.alive && a.rag) {
      a.rag.step(dt); a.rag.apply(m); m.root.visible = a.deathT < 12;
      if (m.goreHidden.length === 0 && m.rich && m.rich.visible) m.rich.visible = false;
      return;
    }
    m.root.position.set(a.pos.x, a.pos.y, a.pos.z);
    m.root.rotation.y = a.yaw;
    if (a.alive) {
      const sp = Math.hypot(a.vel.x, a.vel.z);
      a.walkPhase += sp * dt * 2.2;
      m.crouchK = (m.crouchK || 0) + ((a.crouch ? 1 : 0) - (m.crouchK || 0)) * Math.min(1, dt * 12);
      if (m.goreHidden.length) { for (const o of m.goreHidden) o.visible = !(m.rich && m.rich.visible); m.goreHidden = []; }
      if (a.zombie) animateZombie(this, a, m, dt); else animateSoldier(this, a, m, dt);
      m.root.visible = true;
      if (a.protT > 0) m.root.visible = Math.floor(this.time * 12) % 2 === 0;
    } else {
      m.body.rotation.x = Math.min(1, a.deathT * 3) * (Math.PI / 2);
      m.root.visible = a.deathT < 2.6;
    }
  }

  updateFx(dt) {
    for (const t of this.tracers) { if (!t.visible) continue; t.life -= dt; if (t.life <= 0) t.visible = false; else t.material.opacity = t.life / 0.07 * 0.9; }
    for (const q of this.particles) {
      if (!q.visible) continue;
      q.life -= dt; if (q.life <= 0) { q.visible = false; continue; }
      q.vel.y -= 9 * dt; q.position.addScaledVector(q.vel, dt);
    }
    if (this.gore) this.gore.update(dt);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) { if (this.vm) this.vm.flash.visible = false; this.flashLight.intensity = 0; } }
  }

  render(dt) {
    const p = this.player, cam = this.camera;
    let bob = 0, roll = 0, eye = p.eye;
    if (!p.alive) { eye = Math.max(0.35, p.eye - p.deathT * 1.6); roll = Math.min(0.9, p.deathT * 2); }
    else if (p.onGround) { p.bobT = (p.bobT || 0) + (p.speed2 || 0) * dt * 1.5; bob = Math.sin(p.bobT) * 0.018 * Math.min(1, (p.speed2 || 0) / 5) * (1 - p.ads); }
    // realism (visual only, physics untouched): landing impact dip + side-to-side step sway
    if (p.alive) {
      const vy = this.prevVy || 0;
      if (p.onGround && this.prevGround === false && vy < -3) this.landDip = Math.min(0.2, (-vy - 3) * 0.022);
      this.prevGround = p.onGround; this.prevVy = p.vel.y;
      this.landDip = (this.landDip || 0) * Math.max(0, 1 - dt * 7);
      bob -= this.landDip;
    }
    const w = p.weapon;
    const scoped = w.scope && p.ads > 0.88 && p.alive;
    this.tp = this.settings.view === 'third' && !scoped;
    cam.position.set(p.pos.x, p.pos.y + eye + bob, p.pos.z);
    if (this.tp) {
      // over-the-shoulder camera, pulled in when a wall is in the way
      const cp = Math.cos(p.pitch), fx = -Math.sin(p.yaw) * cp, fy = Math.sin(p.pitch), fz = -Math.cos(p.yaw) * cp;
      const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const back = lerp(3.0, 1.9, p.ads), side = lerp(0.6, 0.45, p.ads), up = 0.25;
      const ox = p.pos.x, oy = p.pos.y + eye, oz = p.pos.z;
      let dx = -fx * back + rx * side, dy = -fy * back + up, dz = -fz * back + rz * side;
      const len = Math.hypot(dx, dy, dz); dx /= len; dy /= len; dz /= len;
      const hit = this.col.ray(ox, oy, oz, dx, dy, dz, len);
      const dist = hit < len ? Math.max(0.25, hit - 0.3) : len;
      cam.position.set(ox + dx * dist, Math.max(0.15, oy + dy * dist), oz + dz * dist);
    }
    const S = this.vmS; S.shake = Math.max(0, S.shake - dt * 5);
    this.updateAimSway(p, dt);
    cam.rotation.set(p.pitch + (this.landDip || 0) * 0.5 + this.swY - S.mvk * 0.12 + (Math.random() - 0.5) * 0.004 * S.shake, p.yaw + this.swX + (Math.random() - 0.5) * 0.004 * S.shake, roll + S.slk * 0.045 + (Math.random() - 0.5) * 0.01 * S.shake, 'YXZ');
    if (p.mesh) p.mesh.root.visible = this.tp && p.mesh.root.visible;
    const zoom = lerp(1, this.tp ? Math.min(w.zoom, 1.25) : w.zoom, p.ads);
    const fov = this.settings.fov / zoom;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    { const av = this._adsVig || (this._adsVig = document.getElementById('adsVig')); if (av) av.style.opacity = String(scoped ? 0 : p.ads * 0.9); }
    this.world.update(dt, cam.position);
    this.updateLaser(p, cam, scoped);
    this.updateViewmodel(dt);
    this.renderer.clear();
    this.renderer.render(this.scene, cam);
    this.updateSunRays(cam, dt);
    if (this.vmRoot.visible) { this.renderer.clearDepth(); this.renderer.render(this.vmScene, this.vmCam); }
  }

  // COD-style aim sway: while aiming the sights drift in a slow figure-eight (breathing) - big with scoped rifles, small with everything else,
  // worse while moving, better crouched. Holding Shift with a sniper / marksman rifle holds your breath for ~4.5 s (then a gasp makes it worse).
  updateAimSway(p, dt) {
    const w = p.weapon, t = this.time, sn = w.cls === 'sniper' || w.id === 'dmr';
    if (this.breath === undefined) { this.breath = 1; this.breathEx = 0; this.holding = false; }
    if (!(this.swX === this.swX) || this.swX === undefined) { this.swX = 0; this.swY = 0; }
    const aiming = p.alive && p.ads > 0.7 && !this.tp;
    const want = aiming && sn && !!this.keys.ShiftLeft && this.breathEx <= 0 && this.breath > 0;
    if (want) { this.breath = Math.max(0, this.breath - dt / 4.5); if (this.breath <= 0) { this.breathEx = 2.2; this.hud.center('OUT OF BREATH', 0.8); } }
    else this.breath = Math.min(1, this.breath + dt / (this.breathEx > 0 ? 9 : 5));
    this.breathEx = Math.max(0, this.breathEx - dt);
    if (want && !this.holding) this.hud.center('HOLDING BREATH', 0.5);
    this.holding = want;
    const held = want ? 0.08 : this.breathEx > 0 ? 2.2 : 1;
    const moveF = clamp((p.speed2 || 0) / 5, 0, 1);
    const amp = (w.id === 'kar98k' ? 0.0036 : w.id === 'dmr' ? 0.0024 : w.cls === 'pistol' ? 0.0006 : 0.0008) * p.ads * p.ads * (1 + moveF * 1.6) * (p.crouch ? 0.6 : 1) * held * (p.alive ? 1 : 0);
    const tx = (Math.sin(t * 1.1) + 0.45 * Math.sin(t * 2.3 + 1.1)) * amp;
    const ty = (0.7 * Math.sin(t * 2.2 + 0.6) + 0.35 * Math.sin(t * 0.8) + 0.5 * Math.sin(t * 1.5)) * amp;
    this.swX += (tx - this.swX) * Math.min(1, dt * 10); this.swY += (ty - this.swY) * Math.min(1, dt * 10);
  }

  // laser sight: a red dot where the crosshair ray lands (what the bullet will hit, spread aside)
  updateLaser(p, cam, scoped) {
    const ld = this.laserDot; if (!ld) return;
    if (!p.weapon.laser || !p.alive || scoped || p.ads > 0.85) { ld.visible = false; return; }
    ld.material.color.setHex(p.weapon.laser === 2 ? 0x2aff6a : p.weapon.laser === 3 ? 0x3aa0ff : 0xff2a1a);
    const d = this.dirFrom(p.yaw + (this.swX || 0), p.pitch + (this.swY || 0), new V3());
    let t = this.aimDistance(cam.position, d, p, 90);
    if (d.y < -0.02) t = Math.min(t, -cam.position.y / d.y);                 // the ground plane counts too
    if (!(t < 90)) { ld.visible = false; return; }
    const r = Math.max(0.012, t * 0.0032), back = Math.min(0.04, t * 0.01);
    ld.position.set(cam.position.x + d.x * (t - back), cam.position.y + d.y * (t - back), cam.position.z + d.z * (t - back));
    ld.scale.set(r, r, r); ld.visible = true;
  }

  updateViewmodel(dt) {
    const p = this.player, vm = this.vm, w = p.weapon, S = this.vmS;
    if (!vm) return;
    const scoped = w.scope && p.ads > 0.88 && p.alive;
    this.vmRoot.visible = p.alive && !scoped && !this.tp;
    this.hud.setScope(scoped);
    const clampf = clamp, sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const a = p.ads, t = this.time, sp = p.speed2 || 0;
    const am = p.ammo[p.cur];
    // --- smoothed inputs --------------------------------------------------------------------------
    this.vmKick = Math.max(0, (this.vmKick || 0) - dt * 9);
    this.swayX += ((-this.mouseDX * 0.0006) - this.swayX) * Math.min(1, dt * 8); this.mouseDX = 0;
    this.swayY = (this.swayY || 0) + (((this.mouseDY || 0) * 0.0005) - (this.swayY || 0)) * Math.min(1, dt * 8); this.mouseDY = 0;
    S.sprint += ((p.sprint ? 1 : 0) - S.sprint) * Math.min(1, dt * (p.sprint ? 8 : 12));
    const rx_ = Math.cos(p.yaw), rz_ = -Math.sin(p.yaw);
    S.strafe += (clamp((p.vel.x * rx_ + p.vel.z * rz_) / 5, -1, 1) - S.strafe) * Math.min(1, dt * 7);
    if (!p.onGround) S.lastVy = p.vel.y;
    if (p.onGround && !S.wasGround) S.land = clamp(-S.lastVy / 9, 0, 1);   // landing dip
    S.wasGround = p.onGround; S.land = Math.max(0, S.land - dt * 5);
    S.slide = Math.max(0, S.slide - dt * 14);
    S.cycle = Math.max(0, S.cycle - dt / (w.cls === 'sniper' ? 1.2 : 0.8));
    if (S.inspectT > 0) S.inspectT = Math.max(0, S.inspectT - dt);
    if (p.switchT > 0 || !p.alive) S.inspectT = 0;

    // --- base pose: hip -> ADS ------------------------------------------------------
    const hip = [0.17, -0.19, -0.45], adsP = [0, -vm.sightY, -0.38 + (w.cls === 'pistol' ? 0.06 : 0)];
    let x = lerp(hip[0], adsP[0], a), y = lerp(hip[1], adsP[1], a), z = lerp(hip[2], adsP[2], a);
    let rx = 0, ry = 0, rz = 0;
    const free = 1 - a * 0.85;                                   // motion is damped while aiming

    // --- walk / idle -----------------------------------------------------------------------------
    if (p.onGround && sp > 0.5 && !p.sprint) {
      const f = Math.min(1, sp / 5) * free , ph = t * 8;
      x += Math.sin(ph) * 0.007 * f; y += Math.abs(Math.cos(ph)) * 0.009 * f - 0.002 * f; rz += Math.sin(ph) * 0.012 * f; ry += Math.sin(ph * 0.5) * 0.01 * f;
    } else { y += Math.sin(t * 1.6) * 0.0015; x += Math.sin(t * 0.9) * 0.0008; }
    if (!p.onGround) { y += clamp(p.vel.y * 0.004, -0.03, 0.03) * free; rx += clamp(-p.vel.y * 0.006, -0.06, 0.06) * free; }
    y -= S.land * 0.05 * free; rx -= S.land * 0.1 * free;
    rz -= S.strafe * 0.05 * free; x -= S.strafe * 0.01 * free;

    // --- sprint: gun dropped and swung across the body, arms pumping (2010-2015 style) ------------
    const sprint = S.sprint * (1 - a);
    if (sprint > 0.001) {
      const ph = t * 11;
      x += 0.05 * sprint + Math.sin(ph) * 0.012 * sprint; y += -0.055 * sprint + Math.abs(Math.cos(ph)) * 0.016 * sprint; z += 0.05 * sprint;
      rx += -0.25 * sprint; ry += (0.62 + Math.sin(ph * 0.5) * 0.04) * sprint; rz += (0.06 + Math.sin(ph) * 0.035) * sprint;
    }

    // --- ADS transition arc (the gun dips and comes in along a curve), breathing, strafe/step roll ------
    { const arc = Math.sin(Math.PI * clamp(a, 0, 1)); y -= arc * 0.014; z += arc * 0.012; rz += arc * 0.03;
      const br = Math.sin(t * 1.35) * (a > 0.5 ? 0.0011 : 0.0016) * (sp < 0.5 ? 1 : 0.3); y += br; rx += br * 0.5;
      if (p.onGround && sp > 0.5 && !p.sprint) { const sw = Math.sin(t * 8) * Math.min(1, sp / 5) * free; z += Math.abs(Math.sin(t * 8)) * 0.004 * free; ry += sw * 0.006; } }
    // --- look sway + recoil kick -----------------------------------------------------------------
    x += this.swayX * free; ry += this.swayX * 0.8 * free; y += (this.swayY || 0) * free; rx += (this.swayY || 0) * 0.6 * free;
    const kick = this.vmKick;
    z += kick * 0.035; rx += kick * 0.045; x += S.rand * kick * 0.012; rz += S.rand * kick * 0.04; ry += S.rand * kick * 0.015;

    // --- draw / weapon switch: gun swings up from below ------------------------------------------
    if (p.switchT > 0) {
      const s = clamp(p.switchT / 0.38, 0, 1), e = s * s;
      y -= e * 0.32; rx -= e * 0.75; rz += e * 0.3; x += e * 0.06;
    }

    // --- reload ----------------------------------------------------------------------------------
    let hand = 0, handDy = 0, handDz = 0;
    const sw = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };                       // animated offsets (reload turn, knife swings) - smoothed by a spring before they are applied
    let slideT = Math.max(S.slide, am.mag <= 0 && !p.reloading ? 1 : 0);            // pistol slide locks back on an empty gun
    let boltOpen = 0, pumpBack = 0;
    for (const e of vm.mags) { e.m.position.copy(e.p); e.m.visible = true; }
    if (S.cycle > 0 && vm.cls === 'sniper') { const pr = 1 - S.cycle; boltOpen = Math.sin(Math.PI * clamp((pr - 0.2) / 0.6, 0, 1)); }
    if (S.cycle > 0 && vm.cls === 'shotgun') { const pr = 1 - S.cycle; pumpBack = Math.sin(Math.PI * clamp((pr - 0.25) / 0.55, 0, 1)); }
    if (p.reloading) {
      const ph = clamp(1 - p.reloadT / w.reload, 0, 1), env = sm(0, 0.14, ph) * (1 - sm(0.86, 1, ph));
      const revolver = vm.id === 'magnum';
      let tilt = env, rk = 0;
      if (vm.cls === 'shotgun') {                                                   // shells pushed in one by one, then a pump
        const cyc = clamp((ph - 0.1) / 0.72, 0, 1) * 5, f = cyc - Math.floor(cyc);
        hand = sm(0.04, 0.12, ph) * (1 - sm(0.84, 0.92, ph)); handDy = -0.03 * Math.sin(Math.PI * f) * hand; handDz = 0.02 * Math.sin(Math.PI * f) * hand;
        tilt = env * 1.1; if (ph > 0.1 && ph < 0.82) rk = Math.sin(Math.PI * f) * 0.025;
        pumpBack = Math.max(pumpBack, Math.sin(Math.PI * clamp((ph - 0.86) / 0.12, 0, 1)));
      } else if (vm.cls === 'sniper') {                                             // open bolt, load the clip, close bolt
        hand = sm(0.18, 0.3, ph) * (1 - sm(0.62, 0.74, ph)); handDy = -0.02 * Math.sin(ph * 30) * hand * 0.3;
        boltOpen = Math.max(boltOpen, sm(0.06, 0.18, ph) * (1 - sm(0.74, 0.86, ph)));
        tilt = env * 0.9; if (ph > 0.74 && ph < 0.82) rk = 0.03;
      } else {
        hand = sm(0.02, 0.16, ph) * (1 - sm(0.72, 0.9, ph));
        const pouch = Math.sin(Math.PI * clamp((ph - 0.3) / 0.2, 0, 1));            // hand goes down to fetch a fresh mag
        handDy = (vm.pistol ? -0.012 : -0.02) * pouch; handDz = 0.02 * pouch;
        if (vm.mags.length) {
          const drop = clamp((ph - 0.16) / 0.1, 0, 1), rise = clamp((ph - 0.46) / 0.16, 0, 1);
          for (const e of vm.mags) {
            if (ph < 0.16) continue;
            if (ph < 0.26) { e.m.position.y = e.p.y - (drop * 0.06 + drop * drop * 0.4); e.m.position.z = e.p.z + drop * 0.03; }   // the old mag drops clean out of the well
            else if (ph < 0.46) e.m.visible = false;
            else { const k = 1 - (1 - rise) * (1 - rise); e.m.position.y = e.p.y - (1 - k) * 0.2; e.m.position.z = e.p.z + (1 - k) * 0.03; }   // the fresh one is pushed up into it
          }
        }
        if (ph > 0.64 && ph < 0.72) rk = Math.sin(Math.PI * (ph - 0.64) / 0.08) * 0.035;         // mag slap
        if (ph > 0.8 && ph < 0.9 && !vm.pistol) { handDz -= Math.sin(Math.PI * (ph - 0.8) / 0.1) * 0.07; rk += 0.012; }   // charging handle
        if (am.mag <= 0 && vm.slides.length) slideT = ph < 0.72 ? 1 : 1 - sm(0.72, 0.78, ph);   // slide drops when the mag seats
      }
      // the gun turns and dips for the reload but always stays well inside the frame (nudged up and pushed away from the camera)
      const k = revolver ? 1.3 : vm.pistol ? 0.8 : 1;
      sw.y += tilt * (vm.pistol ? 0.07 : 0.05); sw.x -= tilt * 0.03 * k; sw.z -= tilt * 0.05; sw.rz += tilt * (revolver ? 0.6 : 0.38) * k * (1 - a); sw.rx += (-tilt * 0.22 * k + rk) * (1 - a * 0.7); sw.ry += tilt * 0.15 * k;
    }
    // sliding: gun canted and low; mantling: gun pushed down and out of the way while you climb
    if (S.slk > 0.01) { const f = S.slk * (1 - a * 0.8); x -= 0.035 * f; y -= 0.03 * f; rz += 0.3 * f; ry += 0.12 * f; rx += 0.05 * f; }
    if (S.mvk > 0.01) { y -= 0.1 * S.mvk; z += 0.03 * S.mvk; rx -= 0.35 * S.mvk; rz += 0.15 * S.mvk; }
    // inspect (F): each weapon plays its own sequence from inspect.js
    let irx = 0, iry = 0, irz = 0, ix_ = 0, iy_ = 0, iz_ = 0, jrx_ = 0, jry_ = 0, jrz_ = 0;
    if (S.inspectT > 0) {
      S.inspWas = true;
      const ip = inspectPose(inspectFor(vm.id), clamp(1 - S.inspectT / (S.inspectDur || 2.8), 0, 1)), fr = 1 - a;
      ix_ = ip.x * fr; iy_ = ip.y * fr; iz_ = ip.z * fr;
      const br = Math.sin(this.time * 1.7) * 0.5 + Math.sin(this.time * 2.9) * 0.3; ix_ += br * 0.0025; iy_ += br * 0.002;       // faint breathing while you look it over
      if (vm.piv) { irx = ip.rx * fr; iry = ip.ry * fr; irz = ip.rz * fr; } else { jrx_ = ip.rx * fr; jry_ = ip.ry * fr; jrz_ = ip.rz * fr; }      // knives: inspect spins live entirely at the wrist, the arm stays put
      hand = Math.max(hand, ip.hand); handDy += ip.hdy; slideT = Math.max(slideT, ip.slide); boltOpen = Math.max(boltOpen, ip.bolt); pumpBack = Math.max(pumpBack, ip.pump);
      for (const e of vm.mags) { e.m.visible = true; e.m.position.y = e.p.y - ip.mag * 0.075; e.m.position.z = e.p.z + ip.mag * 0.03; }
    } else if (S.inspWas) { S.inspWas = false; for (const e of vm.mags) { e.m.visible = true; e.m.position.copy(e.p); } }

    if (this.swing) {                                                                  // knife swings: wind-up, strike, follow-through, recover (tuned per knife)
      const s = this.swing, u = clamp(s.t / s.dur, 0, 1), E = (a0, b0) => sm(a0, b0, u), K = KNIFE_SWING[vm.id] || KNIFE_SWING.k_combat;
      if (s.kind === 'quick') {
        const wind = E(0, 0.24) * (1 - E(0.24, 0.36)), thrust = E(0.2, 0.46) * (1 - E(0.52, 0.95));
        sw.z += 0.08 * wind - 0.36 * K.reach * thrust; sw.y += 0.02 * wind + 0.05 * thrust; sw.x += 0.03 * wind - 0.05 * thrust;
        sw.rx += 0.3 * wind - 0.5 * thrust; sw.ry += 0.22 * thrust; sw.rz += K.roll * thrust - 0.2 * wind;
      } else {
        const wi = E(0, 0.26), p2 = E(0.26, 0.62), back = 1 - E(0.64, 1), f = wi * back, a2 = (1 - 2 * p2) * f;            // a2 sweeps +1 (high right) .. -1 (low left)
        sw.x += 0.2 * K.arc * a2; sw.y += 0.06 * (1 - a2 * a2) * f + 0.03 * f; sw.z -= 0.14 * K.reach * (1 - Math.abs(a2) * 0.4) * f;
        sw.ry += 1.1 * K.arc * a2; sw.rz += (1.0 * a2 + K.roll * Math.sin(Math.PI * p2)) * f; sw.rx += (-0.25 * (1 - a2 * a2) - K.chop * Math.sin(Math.PI * p2)) * f;
      }
    }
    {                                                                                  // organic follow-through: every animated offset chases its target on a slightly under-damped spring (soft starts, tiny overshoot, no snapping)
      const sp = S.sp || (S.sp = {}), spr = (k, t, w = 20, zt = 0.74) => { const s = sp[k] || (sp[k] = [0, 0, t]); if (/^[sij]r[xyz]$/.test(k)) { const d = t - s[2]; if (Math.abs(d) > 3) s[0] += Math.round(d / 6.2832) * 6.2832; s[2] = t; }      // full turns end back at 0: keep the spring on the shortest path
      const acc = w * w * (t - s[0]) - 2 * zt * w * s[1]; s[1] += acc * dt; s[0] += s[1] * dt; return s[0]; };
      x += spr('sx', sw.x); y += spr('sy', sw.y); z += spr('sz', sw.z); rx += spr('srx', sw.rx); ry += spr('sry', sw.ry); rz += spr('srz', sw.rz);
      hand = Math.max(0, spr('h', hand, 15, 0.85)); handDy = spr('hdy', handDy, 15, 0.85); handDz = spr('hdz', handDz, 15, 0.85);       // support hand glides instead of snapping
      const wi = 11;
      x += spr('ix', ix_, wi, 0.8); y += spr('iy', iy_, wi, 0.8); z += spr('iz', iz_, wi, 0.8);
      if (vm.piv) { irx = spr('irx', irx, wi, 0.8); iry = spr('iry', iry, wi, 0.8); irz = spr('irz', irz, wi, 0.8); } else { rx += spr('jrx', jrx_, wi, 0.8); ry += spr('jry', jry_, wi, 0.8); rz += spr('jrz', jrz_, wi, 0.8); }
    }
    // --- apply ----------------------------------------------------------------------------------
    this.vmRoot.position.set(x, y, z);
    if (vm.piv) {                                                                      // knife: most of the roll / flip happens at the wrist, the forearm twists along with it
      this.vmRoot.rotation.set(rx * 0.3, ry * 0.5, rz * 0.2); vm.piv.rotation.set(rx * 0.7 + irx, ry * 0.5 + iry, rz * 0.8 + irz);
      const bs = vm.arm.userData.base; vm.arm.rotation.set(bs.x, bs.y, bs.z + rz * 0.3);
    } else this.vmRoot.rotation.set(rx, ry, rz);
    vm.lh.position.set(vm.reach.x * hand, vm.reach.y * hand + handDy, vm.reach.z * hand + handDz + pumpBack * 0.08 * (vm.cls === 'shotgun' ? 1 : 0));
    for (const e of vm.slides) e.m.position.z = e.p.z + 0.032 * slideT;
    for (const e of vm.bolts) { e.m.position.z = e.p.z + 0.07 * boltOpen; e.m.position.y = e.p.y + 0.012 * boltOpen; }
    for (const e of vm.pumps) e.m.position.z = e.p.z + 0.085 * pumpBack;
  }
}
