// BATTLE ROYALE: 20 players drop from a helicopter onto the Isle of Iron with nothing but a pistol. Open loot crates (hold F) for guns with
// random attachments, armour plates and medkits, loot the players you kill, and stay inside the storm circle that keeps shrinking.
// Last one alive wins. Offline: you + 19 bots.
import * as THREE from 'three';
import { WEAPONS, PRIMARIES, SECONDARIES, ATT, SLOTS, SKINS, setSlot, setSkin, cleanMask, withAtt, attList } from './weapons.js?v=0.22.0';
import { ISLE_TOWNS } from './maps.js?v=0.22.0';

const V3 = THREE.Vector3, rand = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const RARITY = [
  { id: 'common', name: 'COMMON', css: '#cfd6dd', hex: 0xcfd6dd, w: 46, att: [0, 1], hold: 1.0 },
  { id: 'uncommon', name: 'UNCOMMON', css: '#4ade80', hex: 0x4ade80, w: 28, att: [2, 3], hold: 1.2 },
  { id: 'rare', name: 'RARE', css: '#4aa3ff', hex: 0x4aa3ff, w: 16, att: [3, 4], hold: 1.4 },
  { id: 'epic', name: 'EPIC', css: '#b266ff', hex: 0xb266ff, w: 7, att: [5, 6], hold: 1.7 },
  { id: 'legendary', name: 'LEGENDARY', css: '#ffb02e', hex: 0xffb02e, w: 3, att: [6, 8], hold: 2.1 },
];
const STAGES = [{ hold: 40, shrink: 45, r: 115, dmg: 2 }, { hold: 30, shrink: 40, r: 70, dmg: 4 }, { hold: 25, shrink: 35, r: 38, dmg: 7 }, { hold: 20, shrink: 30, r: 16, dmg: 11 }, { hold: 15, shrink: 25, r: 0, dmg: 16 }];
const HELI_ALT = 125, HELI_SPEED = 22, CHUTE_V = 6.5;
const STORM = { id: -2, name: 'THE STORM', team: 99, isPlayer: false, kills: 0, streak: 0, deaths: 0, pos: new V3(), weapon: null };
const STORM_W = { id: 'storm', name: 'The Storm', cls: 'other', slot: 'primary' };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let cssDone = false;
function css() {
  if (cssDone || typeof document === 'undefined') return; cssDone = true;
  const s = document.createElement('style');
  s.textContent = `#brhud{position:fixed;top:44px;left:50%;transform:translateX(-50%);z-index:30;text-align:center;font:700 14px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none}
  #brhud .row{display:flex;gap:18px;justify-content:center;margin-bottom:3px}#brhud .row b{background:rgba(10,14,20,.6);padding:3px 10px;border-radius:4px;letter-spacing:1px}
  #brZone{font-size:13px;color:#d9b6ff}#brZone.out{color:#ff6b6b}#brArrow{display:inline-block;margin-right:6px;transition:transform .1s}
  #brArmor{position:fixed;left:24px;bottom:96px;z-index:30;font:700 15px system-ui,sans-serif;color:#9fd4ff;text-shadow:0 1px 3px #000;pointer-events:none}
  #brPrompt{position:fixed;left:50%;bottom:26%;transform:translateX(-50%);z-index:30;font:700 17px system-ui,sans-serif;color:#fff;text-shadow:0 2px 4px #000;pointer-events:none;text-align:center;display:none}
  #brBarWrap{width:220px;height:8px;background:rgba(0,0,0,.55);margin:8px auto 0;border-radius:4px;overflow:hidden;display:none}#brBar{height:100%;width:0;background:#fff}
  #brStorm{position:fixed;inset:0;z-index:20;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(ellipse at center,rgba(120,40,200,0) 35%,rgba(140,40,220,.55) 100%)}
  #brJump{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:30;font:800 22px system-ui,sans-serif;color:#fff;text-shadow:0 2px 6px #000;pointer-events:none;text-align:center;display:none}`;
  document.head.appendChild(s);
}

export class BattleRoyale {
  constructor(game) {
    const g = this.g = game; css();
    this.t = 0; this.crates = []; this.canopies = new Map(); this.over = false; this.dropAlive = 0; this.stormT = 0;
    this.towns = ISLE_TOWNS; this.placeN = 0;
    // ---- helicopter route: a line across the island at a random bearing
    const th = rand(0, Math.PI * 2); this.dir = new V3(Math.cos(th), 0, Math.sin(th)); this.side = new V3(-this.dir.z, 0, this.dir.x);
    const off = rand(-35, 35); this.start = new V3(-this.dir.x * 190 + this.side.x * off, HELI_ALT, -this.dir.z * 190 + this.side.z * off);
    this.heliT = 0; this.heliLen = 380 / HELI_SPEED; this.heli = this.makeHeli(); g.scene.add(this.heli); this.heliPos = this.start.clone();
    // ---- storm
    const c0 = { x: rand(-25, 25), z: rand(-25, 25) }; this.zone = { cx: c0.x, cz: c0.z, r: 215, ph: 'hold', stage: 0, t: 25 + STAGES[0].hold, c0, r0: 215, c1: null, r1: 0 }; this.pickNext();
    this.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 220, 72, 1, true), new THREE.MeshBasicMaterial({ color: 0x8a3cff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.zoneMesh.position.y = 100; g.scene.add(this.zoneMesh); this.zoneMesh.frustumCulled = false;
    // ---- loot
    this.placeCrates(); this.sunFix();
    // ---- hud
    this.el = document.createElement('div'); this.el.id = 'brhud'; this.el.innerHTML = '<div class="row"><b id="brAlive">ALIVE 20</b><b id="brKills">KILLS 0</b></div><div id="brZone"><span id="brArrow">&#9650;</span><span id="brZt"></span></div>';
    const mk = (id) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; };
    this.dom = [this.el, mk('brArmor'), mk('brPrompt'), mk('brStorm'), mk('brJump')]; document.body.appendChild(this.el);
    this.dom[2].innerHTML = '<div id="brPt"></div><div id="brBarWrap"><div id="brBar"></div></div>';
    this.q = (id) => document.getElementById(id);
    this.use = false; this.useT = 0; this.useCrate = null; this.spaceWas = false; this.stormHint = 0;
  }
  dispose() {
    for (const d of this.dom) d.remove();
    const s = this.g.scene; if (s) { s.remove(this.heli); s.remove(this.zoneMesh); for (const c of this.crates) s.remove(c.g); for (const m of this.canopies.values()) s.remove(m); }
  }

  // ------------------------------------------------------------------ set up
  makeHeli() {
    const g = new THREE.Group(), m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2 });
    const add = (geo, mat, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o); return o; };
    add(new THREE.BoxGeometry(2.8, 2.4, 7), m(0x3d4a3a), 0, 0, 0); add(new THREE.BoxGeometry(2.4, 1.2, 2.2), m(0x9fd0e8), 0, 0.6, -3.5);
    add(new THREE.BoxGeometry(0.7, 0.8, 7.5), m(0x3d4a3a), 0, 0.5, 6.5); add(new THREE.BoxGeometry(0.2, 2.2, 1.4), m(0x2a3328), 0, 1.6, 9.8);
    for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(0.12, 0.12, 6), m(0x222), sx * 1.5, -1.5, 0); add(new THREE.BoxGeometry(0.1, 0.9, 0.1), m(0x222), sx * 1.5, -1.05, -1.5); add(new THREE.BoxGeometry(0.1, 0.9, 0.1), m(0x222), sx * 1.5, -1.05, 1.5); }
    add(new THREE.BoxGeometry(0.3, 0.7, 0.3), m(0x222), 0, 1.5, 0);
    this.rotor = new THREE.Group(); this.rotor.position.y = 1.9; g.add(this.rotor); add(new THREE.BoxGeometry(13, 0.07, 0.5), m(0x222), 0, 0, 0, this.rotor); add(new THREE.BoxGeometry(0.5, 0.07, 13), m(0x222), 0, 0, 0, this.rotor);
    g.frustumCulled = false; return g;
  }
  sunFix() {            // the sun's shadow box is only 110 m wide: let it follow the player across the big island
    this.sun = null; this.g.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) this.sun = o; });
    if (this.sun && this.sun.target) { this.sunOff = this.sun.position.clone(); this.g.scene.add(this.sun.target); } else this.sun = null;
  }
  rollItem(boost = 0) {
    let r = Math.random() * RARITY.reduce((s, x) => s + x.w, 0), ri = 0; for (; ri < RARITY.length - 1; ri++) { r -= RARITY[ri].w; if (r < 0) break; }
    ri = Math.min(RARITY.length - 1, ri + (Math.random() < boost ? 1 : 0));
    const id = Math.random() < 0.85 ? pick(PRIMARIES) : pick(SECONDARIES), w = WEAPONS[id]; if (!w) return this.rollItem(boost);
    let mask = 0, n = Math.round(rand(RARITY[ri].att[0], RARITY[ri].att[1]));
    const slots = SLOTS.map((s) => s.id).filter((sid) => ((w.opts && w.opts[sid]) || []).length).sort(() => Math.random() - 0.5);
    for (const sid of slots) { if (n <= 0) break; const a = ATT[pick(w.opts[sid])]; if (a) { mask = setSlot(mask, a.slot, a.v); n--; } }
    if (ri >= 4 && Math.random() < 0.55 && w.slot !== 'melee') mask = setSkin(mask, 1 + Math.floor(Math.random() * (SKINS.length - 1)));
    mask = cleanMask(w, mask);
    return { id, mask, rarity: ri, plates: Math.random() < 0.5 ? (ri >= 3 ? 2 : 1) : 0, med: Math.random() < 0.3 };
  }
  placeCrates() {
    const g = this.g, nav = g.nav, spots = [];
    const free = (x, z) => !g.col.overlaps(x, 0.05, z, 0.7, 1.0);
    for (const [x, z] of (g.map.loot || [])) if (free(x, z)) spots.push({ x, z, boost: 0.35 });         // inside buildings: better odds
    for (const t of this.towns) for (let i = 0; i < 3; i++) { const n = nav.nodes[nav.validIdx[Math.floor(Math.random() * nav.validIdx.length)]]; for (let k = 0; k < 60; k++) { const q = nav.nodes[nav.validIdx[Math.floor(Math.random() * nav.validIdx.length)]]; if (Math.hypot(q.x - t.x, q.z - t.z) < 24) { spots.push({ x: q.x, z: q.z, boost: 0.15 }); break; } } void n; }
    for (let i = 0; i < 16; i++) { const q = nav.nodes[nav.validIdx[Math.floor(Math.random() * nav.validIdx.length)]]; spots.push({ x: q.x, z: q.z, boost: 0 }); }
    for (const s of spots) this.addCrate(s.x, s.z, this.rollItem(s.boost));
  }
  addCrate(x, z, item, drop = false) {
    const g = this.g, r = RARITY[item.rarity], y = g.groundAt(x, 4, z, 0.4), grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), new THREE.MeshStandardMaterial({ color: drop ? 0x2a2a30 : 0x3d4a3a, roughness: 0.7, metalness: 0.2 }));
    body.position.y = 0.3; grp.add(body);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.08, 0.79), new THREE.MeshBasicMaterial({ color: r.hex })); strip.position.y = 0.45; grp.add(strip);
    const lidP = new THREE.Group(); lidP.position.set(0, 0.6, -0.375); grp.add(lidP);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.75), new THREE.MeshStandardMaterial({ color: 0x555d52, roughness: 0.6, metalness: 0.3 })); lid.position.set(0, 0.05, 0.375); lidP.add(lid);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(drop ? 0.1 : 0.16, drop ? 0.1 : 0.16, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: r.hex, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    beam.position.y = 35.3; grp.add(beam); grp.position.set(x, y, z); grp.rotation.y = rand(0, 6.28); g.scene.add(grp);
    const c = { x, y, z, item, g: grp, lid: lidP, beam, open: false, openT: 0, drop }; this.crates.push(c); return c;
  }

  // ------------------------------------------------------------------ actors
  place(a, first) {              // called from Game.spawn: everyone starts in the helicopter
    const g = this.g; if (!a.starter) { const s = { ...withAtt(WEAPONS.m1911, 0), starter: true, reserve: 24 }; a.weapons = [s, { ...s }]; a.weapon = a.weapons[0]; a.starter = true; }
    g.placeActor(a, this.start.x, this.start.z, Math.atan2(-this.side.x, -this.side.z), true, HELI_ALT - 2);
    a.armor = 0; a.looted = 0; a.stormAcc = 0; a.air = 'heli'; a.brHold = 0;
    if (!a.isPlayer) {
      const t = Math.random() < 0.75 ? pick(this.towns) : { x: rand(-100, 100), z: rand(-100, 100) };
      a.tx = clamp(t.x + rand(-22, 22), -138, 138); a.tz = clamp(t.z + rand(-22, 22), -138, 138);
      const tp = ((a.tx - this.start.x) * this.dir.x + (a.tz - this.start.z) * this.dir.z) / HELI_SPEED;      // when the heli is nearest to the landing spot
      a.jumpAt = clamp(tp - rand(1.0, 2.2), 0.8, this.heliLen - 1);
      a.pos.y = HELI_ALT - 2; a.mesh.root.visible = false;
    }
    return true;
  }
  alive() { return this.g.actors.filter((a) => a.alive && !a.dummy && !a.zombie); }
  jump(a) {
    a.air = 'fall'; a.vel.set(this.dir.x * HELI_SPEED * 0.6, 0, this.dir.z * HELI_SPEED * 0.6); a.pos.x += this.side.x * 0.5; a.pos.z += this.side.z * 0.5;
    if (a.mesh) a.mesh.root.visible = !a.isPlayer; if (a.isPlayer) this.g.hud.center('SKYDIVE! SPACE = PARACHUTE', 2);
  }
  addCanopy(a) {
    if (this.canopies.has(a)) return; const col = pick([0xd04a3a, 0x3a7ad0, 0xe0c040, 0x3aa86a, 0xc060d0, 0xf0f0f0]);
    const m = new THREE.Mesh(new THREE.SphereGeometry(2, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, side: THREE.DoubleSide })); m.scale.set(1, 0.55, 1);
    this.g.scene.add(m); this.canopies.set(a, m);
  }
  dropCanopy(a) { const m = this.canopies.get(a); if (m) { this.g.scene.remove(m); this.canopies.delete(a); } }
  groundY(a) { return this.g.groundAt(a.pos.x, a.pos.y + 2, a.pos.z, 0.3); }

  updateAir(a, dt) {
    const g = this.g, p = a.isPlayer, k = g.keys;
    if (a.air === 'heli') {
      const hp = this.heliPos; a.pos.set(hp.x + this.side.x * 2.4, hp.y - 2.4, hp.z + this.side.z * 2.4); a.vel.set(0, 0, 0);
      if (p) { const sp = !!k.Space; if (g.matchT >= 0 && ((sp && !this.spaceWas) || this.heliT >= this.heliLen - 0.2)) this.jump(a); this.spaceWas = sp; }
      else if (this.heliT >= a.jumpAt || this.heliT >= this.heliLen - 0.2) this.jump(a);
      return;
    }
    const gy = this.groundY(a), h = a.pos.y - gy;
    let hs, vy, wx = 0, wz = 0;
    if (p) {
      const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), str = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
      wx = fx * fwd + rx * str; wz = fz * fwd + rz * str; const l = Math.hypot(wx, wz); if (l > 0) { wx /= l; wz /= l; }
      const sp = !!k.Space; if (a.air === 'fall' && ((sp && !this.spaceWas && h < HELI_ALT - 10) || h < 62)) { a.air = 'chute'; this.addCanopy(a); g.hud.center('PARACHUTE OPEN', 1.2); } this.spaceWas = sp;
      if (a.air === 'fall') { hs = fwd > 0 ? (a.pitch < -0.5 ? 30 : 17) : 5; vy = a.pitch < -0.6 ? -64 : -42; } else { hs = fwd > 0 ? 12 : fwd < 0 ? 3 : 5; vy = -CHUTE_V; }
    } else {
      const dx = a.tx - a.pos.x, dz = a.tz - a.pos.z, d = Math.hypot(dx, dz) || 1; wx = dx / d; wz = dz / d;
      if (a.air === 'fall' && h < 70 + (a.id % 5) * 6) { a.air = 'chute'; this.addCanopy(a); }
      const left = a.air === 'fall' ? (h - 70) / 45 + 70 / CHUTE_V : h / CHUTE_V; hs = clamp(d / Math.max(0.8, left), 0, a.air === 'fall' ? 28 : 13); vy = a.air === 'fall' ? -45 : -CHUTE_V;
      a.yaw = Math.atan2(-wx, -wz); a.pitch = 0;
    }
    const kk = Math.min(1, 3 * dt); a.vel.x += (wx * hs - a.vel.x) * kk; a.vel.z += (wz * hs - a.vel.z) * kk; a.vel.y += (vy - a.vel.y) * Math.min(1, 4 * dt);
    a.pos.x = clamp(a.pos.x + a.vel.x * dt, -146, 146); a.pos.z = clamp(a.pos.z + a.vel.z * dt, -146, 146); a.pos.y += a.vel.y * dt;
    const c = this.canopies.get(a); if (c) { c.position.set(a.pos.x, a.pos.y + 3.4, a.pos.z); c.rotation.y = a.yaw; }
    const ng = this.groundY(a);
    if (a.pos.y <= ng + 0.02) {                                                    // touch down
      a.pos.y = ng; a.vel.set(0, 0, 0); a.air = null; a.onGround = true; this.dropCanopy(a); a.protT = 1.2; if (a.brain) a.brain.reset();
      if (p) { g.hud.center('LANDED - FIND A CRATE (HOLD F)', 2.4); this.spaceWas = false; }
    }
  }

  // ------------------------------------------------------------------ crates
  localUse(down) { this.use = down; if (!down) { this.useT = 0; this.useCrate = null; } }
  nearCrate(a, r) { let best = null, bd = r; for (const c of this.crates) { if (c.open) continue; const d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z); if (d < bd && Math.abs(c.y - a.pos.y) < 2.5) { bd = d; best = c; } } return best; }
  giveWeapon(a, item) {
    const g = this.g, w = { ...withAtt(WEAPONS[item.id], item.mask), rarity: item.rarity };
    let slot = a.weapons[a.cur].starter ? a.cur : a.weapons[1 - a.cur].starter ? 1 - a.cur : a.cur;
    a.weapons[slot] = w; a.ammo[slot] = { mag: w.mag, res: w.reserve }; a.cur = slot; a.weapon = w; a.reloading = false; a.switchT = 0.4; a.ads = 0;
    if (a.isPlayer) g.setPlayerVm(); g.setActorGun(a); if (a.isPlayer) g.sound.switchGun();
  }
  openCrate(a, c) {
    if (c.open) return; c.open = true; c.openT = 0; const it = c.item, r = RARITY[it.rarity];
    this.giveWeapon(a, it); a.looted = (a.looted || 0) + 1;
    if (it.plates) a.armor = Math.min(100, (a.armor || 0) + 30 * it.plates);
    if (it.med) a.hp = Math.min(100, a.hp + 50);
    if (a.isPlayer) { const w = a.weapon, att = attList(w.attMask).map((x) => x.name); this.g.hud.center(`${r.name}: ${w.name}`, 2.6); this.g.hud.xp(att.length ? att.join(' / ') : 'no attachments', it.rarity >= 3); if (it.plates) this.g.hud.xp(`+${30 * it.plates} ARMOUR`); if (it.med) this.g.hud.xp('+50 HEALTH'); }
  }
  onKill(v, k) {
    if (v.dummy || v.zombie) return;
    v.air = null; this.dropCanopy(v); v.place = this.alive().length + 1;
    const w = v.weapons.find((x, i) => !x.starter && i === v.cur) || v.weapons.find((x) => !x.starter);
    if (w && w.id && WEAPONS[w.id]) { const n = attList(w.attMask).length; const ri = clamp(Math.floor(n / 2), 0, 4); this.addCrate(v.pos.x + rand(-0.6, 0.6), v.pos.z + rand(-0.6, 0.6), { id: w.id, mask: w.attMask || 0, rarity: ri, plates: v.armor > 0 ? 1 : 0, med: Math.random() < 0.25 }, true); }
  }
  adjust(v, amount) { if (v.armor > 0) { const ab = Math.min(v.armor, amount * 0.7); v.armor -= ab; return amount - ab; } return amount; }

  // ------------------------------------------------------------------ bots
  botGoal(a) {
    if (a.air) return null; const z = this.zone;
    if (Math.hypot(a.pos.x - z.cx, a.pos.z - z.cz) > z.r - 6) { const ang = Math.atan2(a.pos.z - z.cz, a.pos.x - z.cx), rr = Math.max(0, z.r - 14); return { x: z.cx + Math.cos(ang) * rr * 0.5, z: z.cz + Math.sin(ang) * rr * 0.5 }; }
    if (a.looted < 3 || a.weapon.starter) {
      let best = null, bd = 95; for (const c of this.crates) { if (c.open || c.reach === false) continue; const d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z) * (c.drop ? 0.7 : 1); if (d < bd) { bd = d; best = c; } }
      if (best) { if (best.reach === undefined) { const n = this.g.nav.nodes[this.g.nav.nearest(best.x, best.z)]; best.reach = !!n && Math.hypot(n.x - best.x, n.z - best.z) < 5; if (!best.reach) return this.botGoal(a); } a.brTarget = best; return { x: best.x, z: best.z }; }
    }
    return null;
  }

  // ------------------------------------------------------------------ zone
  pickNext() {
    const z = this.zone, S = STAGES[z.stage]; if (!S) return; z.r0 = z.r; z.c0 = { x: z.cx, z: z.cz }; z.r1 = S.r;
    const a = rand(0, 6.283), m = Math.max(0, z.r0 - S.r) * 0.7 * Math.sqrt(Math.random()); z.c1 = { x: z.c0.x + Math.cos(a) * m, z: z.c0.z + Math.sin(a) * m };
  }
  updateZone(dt) {
    const z = this.zone, S = STAGES[z.stage]; if (!S) return;
    if (z.ph === 'hold') { z.t -= dt; if (z.t <= 0) { z.ph = 'shrink'; z.t = S.shrink; z.tt = S.shrink; this.g.hud.center('THE STORM IS CLOSING IN', 2); } }
    else { z.t -= dt; const u = 1 - clamp(z.t / z.tt, 0, 1); z.r = z.r0 + (z.r1 - z.r0) * u; z.cx = z.c0.x + (z.c1.x - z.c0.x) * u; z.cz = z.c0.z + (z.c1.z - z.c0.z) * u; if (z.t <= 0) { z.stage++; z.ph = 'hold'; if (STAGES[z.stage]) { z.t = STAGES[z.stage].hold; this.pickNext(); } else z.t = 1e9; } }
    this.zoneMesh.position.x = z.cx; this.zoneMesh.position.z = z.cz; this.zoneMesh.scale.set(Math.max(0.01, z.r), 1, Math.max(0.01, z.r));
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, p = g.player; if (g.matchT < 0) { this.syncHeli(); return; }
    this.t += dt;
    if (this.heliT < this.heliLen + 6) this.heliT += dt;
    this.syncHeli();
    if (this.t > 0.5) this.updateZone(dt);
    // storm damage + bots opening crates
    const S = STAGES[Math.min(this.zone.stage, STAGES.length - 1)];
    for (const a of g.actors) {
      if (!a.alive || a.dummy) continue;
      if (a.air) continue;
      const out = Math.hypot(a.pos.x - this.zone.cx, a.pos.z - this.zone.cz) > this.zone.r;
      if (out && this.t > 1) { a.hp -= S.dmg * dt; a.lastHurt = g.time; if (a.isPlayer) { this.stormHint -= dt; if (this.stormHint <= 0) { this.stormHint = 1; g.sound.hurt(); } } if (a.hp <= 0) { STORM.pos.set(a.pos.x + 1, a.pos.y, a.pos.z); g.kill(a, STORM, STORM_W, false); } }
      if (!a.isPlayer && a.brTarget) {
        const c = a.brTarget; if (c.open) { a.brTarget = null; a.brHold = 0; continue; }
        if (Math.hypot(c.x - a.pos.x, c.z - a.pos.z) < 1.9) { a.brHold += dt; if (a.brHold > RARITY[c.item.rarity].hold + 0.4) { this.openCrate(a, c); a.brTarget = null; a.brHold = 0; } } else a.brHold = 0;
      }
    }
    // player interaction
    if (p.alive && !p.air) {
      const c = this.nearCrate(p, 2.4), pr = this.q('brPrompt');
      if (c && this.use) { if (this.useCrate !== c) { this.useCrate = c; this.useT = 0; } this.useT += dt; const need = RARITY[c.item.rarity].hold; this.q('brBar').style.width = `${Math.min(100, this.useT / need * 100)}%`; if (this.useT >= need) { this.openCrate(p, c); this.useT = 0; this.useCrate = null; } }
      else if (!this.use) { this.useT = 0; this.useCrate = null; }
      if (c) { const r = RARITY[c.item.rarity]; pr.style.display = 'block'; this.q('brPt').innerHTML = `HOLD <b>F</b> - ${c.drop ? 'LOOT' : 'OPEN CRATE'} <span style="color:${r.css}">[${r.name}]</span>`; this.q('brBarWrap').style.display = this.use ? 'block' : 'none'; }
      else pr.style.display = 'none';
    } else this.q('brPrompt').style.display = 'none';
    // crate lids / beams
    for (const c of this.crates) if (c.open && c.openT < 1) { c.openT = Math.min(1, c.openT + dt * 2.5); c.lid.rotation.x = -c.openT * 1.9; c.beam.material.opacity = 0.25 * (1 - c.openT); if (c.openT >= 1) c.beam.visible = false; }
    if (this.heliT > this.heliLen + 4) this.heli.visible = false;
    if (this.sun) { this.sun.position.set(p.pos.x + this.sunOff.x, this.sunOff.y, p.pos.z + this.sunOff.z); this.sun.target.position.set(p.pos.x, 0, p.pos.z); this.sun.target.updateMatrixWorld(); }
    this.updateHud(p);
  }
  syncHeli() {
    const hp = this.heliPos, t = this.heliT; hp.set(this.start.x + this.dir.x * HELI_SPEED * t, HELI_ALT + Math.sin(t * 1.3) * 0.4, this.start.z + this.dir.z * HELI_SPEED * t);
    this.heli.position.copy(hp); this.heli.rotation.y = Math.atan2(this.dir.x, this.dir.z) + Math.PI; this.rotor.rotation.y += 0.9;
  }
  updateHud(p) {
    const z = this.zone, n = this.alive().length, q = this.q;
    q('brAlive').textContent = `ALIVE ${n}`; q('brKills').textContent = `KILLS ${p.kills}`;
    const out = Math.hypot(p.pos.x - z.cx, p.pos.z - z.cz) > z.r, d = Math.max(0, Math.hypot(p.pos.x - z.cx, p.pos.z - z.cz) - z.r);
    const zt = q('brZone'); zt.className = out && !p.air ? 'out' : '';
    q('brZt').textContent = (z.ph === 'hold' ? (this.zone.stage >= STAGES.length ? 'FINAL CIRCLE' : `STORM CLOSES IN ${fmt(z.t)}`) : `STORM SHRINKING ${fmt(z.t)}`) + (out && !p.air ? `  -  IN THE STORM ${Math.round(d)} m` : `  -  ${Math.round(Math.max(0, z.r - Math.hypot(p.pos.x - z.cx, p.pos.z - z.cz)))} m to edge`);
    const ang = Math.atan2(-(z.cx - p.pos.x), -(z.cz - p.pos.z)) - p.yaw; q('brArrow').style.transform = `rotate(${-ang}rad)`;
    q('brArmor').textContent = p.armor > 0 ? `ARMOUR ${Math.round(p.armor)}` : '';
    q('brStorm').style.opacity = out && !p.air && p.alive ? '1' : '0';
    const j = q('brJump'); if (p.air === 'heli') { j.style.display = 'block'; j.innerHTML = `HELICOPTER - PRESS <b>SPACE</b> TO JUMP<br><span style="font-size:14px;font-weight:600">drop zone: look around, then pick your town (${Math.max(0, Math.ceil(this.heliLen - this.heliT))}s left)</span>`; } else if (p.air === 'fall') { j.style.display = 'block'; j.innerHTML = 'FREEFALL - W TO GLIDE, LOOK DOWN TO DIVE<br><span style="font-size:14px;font-weight:600">SPACE opens the parachute</span>'; } else j.style.display = 'none';
  }
  placement() { const p = this.g.player; return p.alive ? 1 : (p.place || this.alive().length + 1); }
  winnerTeam() { const a = this.alive(); return a.length ? a[0].team : null; }
  checkEnd() {
    const g = this.g, p = g.player, n = this.alive().length;
    if (g.matchT < 1) return false;
    return n <= 1 || (!p.alive && p.deathT > 2.6);
  }
}
