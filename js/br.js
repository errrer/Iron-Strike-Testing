// BATTLE ROYALE: 20 players drop from a helicopter onto the Isle of Iron with nothing but a pistol. Open loot crates (hold F) for guns with
// random attachments, armour plates and medkits, loot the players you kill, and stay inside the storm circle that keeps shrinking.
// Last one alive wins. Offline: you + 19 bots.
import * as THREE from 'three';
import { WEAPONS, PRIMARIES, SECONDARIES, randomMask, withAtt, attList } from './weapons.js?v=0.25.0';
import { ISLE_TOWNS } from './maps.js?v=0.25.0';

const V3 = THREE.Vector3, rand = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const RARITY = [
  { id: 'common', name: 'COMMON', css: '#cfd6dd', hex: 0xcfd6dd, w: 46, att: [0, 1], hold: 1.0 },
  { id: 'uncommon', name: 'UNCOMMON', css: '#4ade80', hex: 0x4ade80, w: 28, att: [2, 3], hold: 1.2 },
  { id: 'rare', name: 'RARE', css: '#4aa3ff', hex: 0x4aa3ff, w: 16, att: [3, 4], hold: 1.4 },
  { id: 'epic', name: 'EPIC', css: '#b266ff', hex: 0xb266ff, w: 7, att: [5, 6], hold: 1.7 },
  { id: 'legendary', name: 'LEGENDARY', css: '#ffb02e', hex: 0xffb02e, w: 3, att: [6, 8], hold: 2.1 },
];
const STAGES = [{ hold: 60, shrink: 60, r: 300, dmg: 1.5 }, { hold: 50, shrink: 55, r: 190, dmg: 3 }, { hold: 40, shrink: 50, r: 110, dmg: 5 }, { hold: 35, shrink: 45, r: 60, dmg: 8 }, { hold: 25, shrink: 40, r: 25, dmg: 12 }, { hold: 20, shrink: 35, r: 0, dmg: 18 }];
const HELI_ALT = 220, HELI_SPEED = 30, CHUTE_V = 6.5, ROUTE = 420, CUT = 320, PLAYER_CAR = 6;
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
    this.t = 0; this.crates = []; this.canopies = new Map(); this.over = false; this.dropAlive = 0; this.stormT = 0; this.cullT = 0;
    this.towns = ISLE_TOWNS; this.placeN = 0;
    // ---- helicopter route: a line across the island at a random bearing
    const th = rand(0, Math.PI * 2); this.dir = new V3(Math.cos(th), 0, Math.sin(th)); this.side = new V3(-this.dir.z, 0, this.dir.x);
    const off = rand(-120, 120); this.start = new V3(-this.dir.x * ROUTE + this.side.x * off, HELI_ALT, -this.dir.z * ROUTE + this.side.z * off);
    this.heliT = 0; this.heliLen = ROUTE * 2 / HELI_SPEED; this.heli = this.makeBus(); g.scene.add(this.heli); this.heliPos = this.start.clone();
    // ---- storm
    const c0 = { x: rand(-60, 60), z: rand(-60, 60) }; this.zone = { cx: c0.x, cz: c0.z, r: 480, ph: 'hold', stage: 0, t: 40 + STAGES[0].hold, c0, r0: 480, c1: null, r1: 0 }; this.pickNext();
    this.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 260, 96, 1, true), new THREE.MeshBasicMaterial({ color: 0x8a3cff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.zoneMesh.position.y = 100; g.scene.add(this.zoneMesh); this.zoneMesh.frustumCulled = false;
    // ---- loot
    this.placeCrates(); this.sunFix(); this.collectStatics();
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
  // the battle bus: a flying steam train (locomotive + three open carriages with wings, rocket jets and a spinning propeller). Local -z is the front.
  makeBus() {
    const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.25, ...o });
    const add = (geo, mat, x, y, z, parent = g, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; };
    const BX = THREE.BoxGeometry, CY = THREE.CylinderGeometry, teal = M(0x14b8c8), orange = M(0xff8a1f), cream = M(0xf4ecd8), dark = M(0x23262b), brass = M(0xd9a441, { metalness: 0.7, roughness: 0.35 }), red = M(0xc0392b);
    // carriages: floor 0 is where riders stand
    for (let i = 0; i < 3; i++) {
      const z = -8 + i * 14 + 6 - 6;       // centres at -8, 6, 20
      add(new BX(3.8, 0.8, 13), dark, 0, -0.4, z); add(new BX(3.9, 0.25, 13.1), orange, 0, -0.05, z);
      for (const sx of [-1, 1]) { add(new BX(0.16, 1.15, 13), teal, sx * 1.8, 0.58, z); add(new BX(0.2, 0.14, 13.1), orange, sx * 1.8, 1.2, z);
        for (let k = 0; k < 6; k++) add(new BX(0.16, 1.6, 0.22), teal, sx * 1.8, 2.0, z - 5.9 + k * 2.36);
        add(new BX(0.9, 0.5, 11.2), M(0x7a4a2a), sx * 1.2, 0.5, z);                                        // benches along both sides
        for (let w = 0; w < 4; w++) add(new CY(0.55, 0.55, 0.18, 16), dark, sx * 1.95, -0.5, z - 4.5 + w * 3, g, 0, 0, Math.PI / 2); }
      add(new BX(4.1, 0.22, 13.2), cream, 0, 2.95, z); add(new BX(3.9, 0.2, 13.0), teal, 0, 2.8, z);
      add(new BX(3.8, 1.9, 0.2), teal, 0, 1.9, z + 6.4); add(new BX(1.4, 2.1, 0.12), cream, 0, 1.0, z - 6.55);                                   // rear wall with a door gap in front
      for (const sx of [-1, 1]) { const w = add(new BX(13, 0.14, 3.4), i % 2 ? orange : cream, sx * 8.4, 1.6, z + (i - 1) * 0.0); w.rotation.z = sx * 0.04; add(new BX(0.14, 1.6, 0.14), dark, sx * 3.4, 0.9, z - 1.2, g, 0, 0, sx * 0.9); add(new BX(0.14, 1.6, 0.14), dark, sx * 3.4, 0.9, z + 1.2, g, 0, 0, sx * 0.9); }
      const fl = add(new THREE.ConeGeometry(0.7, 3, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0, -2.3, z + 2, g, Math.PI); (this.jets || (this.jets = [])).push(fl);
      const fl2 = add(new THREE.ConeGeometry(0.7, 3, 10, 1, true), fl.material, 0, -2.3, z - 2, g, Math.PI); this.jets.push(fl2);
    }
    // locomotive
    const zl = -22;
    add(new BX(3.8, 0.8, 11), dark, 0, -0.4, zl); add(new BX(3.9, 0.25, 11.1), red, 0, -0.05, zl);
    add(new CY(1.5, 1.5, 7.5, 20), dark, 0, 1.7, zl - 1.5, g, Math.PI / 2, 0, 0);
    for (let i = 0; i < 3; i++) add(new CY(1.56, 1.56, 0.28, 20), brass, 0, 1.7, zl - 4.2 + i * 2.2, g, Math.PI / 2, 0, 0);
    add(new CY(0.55, 0.8, 1.6, 12), dark, 0, 3.6, zl - 3.8); add(new CY(0.95, 0.55, 0.5, 12), brass, 0, 4.55, zl - 3.8); add(new THREE.SphereGeometry(0.5, 12, 8), brass, 0, 3.4, zl - 1);
    add(new BX(3.7, 3.4, 3.2), red, 0, 1.7, zl + 3.6); add(new BX(4.1, 0.3, 3.6), cream, 0, 3.5, zl + 3.6); for (const sx of [-1, 1]) add(new BX(0.1, 1.1, 1.3), M(0x9fd0e8, { transparent: true, opacity: 0.7 }), sx * 1.9, 2.0, zl + 3.6);
    add(new BX(3.4, 0.2, 2.6), dark, 0, 0.1, zl - 6.8, g, -0.5, 0, 0); for (let k = 0; k < 5; k++) add(new BX(0.14, 1.0, 0.1), brass, -1.2 + k * 0.6, 0.4, zl - 7.2, g, -0.5, 0, 0);     // cow catcher
    add(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), 0, 1.9, zl - 5.3);
    for (const sx of [-1, 1]) for (let w = 0; w < 3; w++) add(new CY(w === 1 ? 0.75 : 1.0, w === 1 ? 0.75 : 1.0, 0.22, 18), M(0xb0302a), sx * 1.95, -0.5, zl - 3 + w * 3, g, 0, 0, Math.PI / 2);
    for (const sx of [-1, 1]) { add(new BX(12, 0.16, 3.6), M(0xff8a1f), sx * 7.8, 1.3, zl, g, 0, 0, sx * 0.04); add(new BX(0.16, 1.4, 0.16), dark, sx * 3.4, 0.7, zl - 1.2, g, 0, 0, sx * 0.9); }
    this.prop = new THREE.Group(); this.prop.position.set(0, 1.7, zl - 7.5); g.add(this.prop); for (let k = 0; k < 3; k++) add(new BX(0.3, 3.4, 0.08), M(0xf0f0f0), 0, 0, 0, this.prop, 0, 0, k * 2.094); add(new THREE.SphereGeometry(0.35, 10, 8), brass, 0, 0, 0, this.prop);
    this.smoke = []; for (let i = 0; i < 12; i++) { const o = add(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.6, depthWrite: false }), 0, 4.8, zl - 3.8); o.userData.t = i / 12; this.smoke.push(o); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; }); g.frustumCulled = false; return g;
  }
  // the island has thousands of meshes: only the ones near the camera are drawn (fog hides the rest anyway)
  collectStatics() {
    this.statics = [];
    for (const o of this.g.scene.children) { if (!o.geometry || !o.geometry.computeBoundingSphere || o.isLight || o.type === 'Points' || o === this.zoneMesh || o === this.heli) continue; o.geometry.computeBoundingSphere(); const bs = o.geometry.boundingSphere; if (bs && bs.radius < 60) this.statics.push({ o, r: bs.radius * Math.max(o.scale.x, o.scale.y, o.scale.z, 1) }); }
  }
  cull(cx, cz) {
    const R = 340; for (const s of this.statics) { const p = s.o.position, dx = p.x - cx, dz = p.z - cz, rr = R + s.r; s.o.visible = dx * dx + dz * dz < rr * rr; }
    for (const c of this.crates) c.g.visible = (c.x - cx) ** 2 + (c.z - cz) ** 2 < 300 * 300;
  }
  sunFix() {            // the sun's shadow box is only 110 m wide: let it follow the player across the big island
    this.sun = null; this.g.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) this.sun = o; });
    if (this.sun && this.sun.target) { this.sunOff = this.sun.position.clone(); this.g.scene.add(this.sun.target); } else this.sun = null;
  }
  rollItem(boost = 0) {
    let r = Math.random() * RARITY.reduce((s, x) => s + x.w, 0), ri = 0; for (; ri < RARITY.length - 1; ri++) { r -= RARITY[ri].w; if (r < 0) break; }
    ri = Math.min(RARITY.length - 1, ri + (Math.random() < boost ? 1 : 0));
    const id = Math.random() < 0.85 ? pick(PRIMARIES) : pick(SECONDARIES), w = WEAPONS[id]; if (!w) return this.rollItem(boost);
    const mask = randomMask(w, Math.round(rand(RARITY[ri].att[0], RARITY[ri].att[1])), ri >= 4 ? 0.55 : 0);
    return { id, mask, rarity: ri, plates: Math.random() < 0.5 ? (ri >= 3 ? 2 : 1) : 0, med: Math.random() < 0.3 };
  }
  placeCrates() {
    const g = this.g, nav = g.nav, spots = [], vn = nav.validIdx, node = () => nav.nodes[vn[Math.floor(Math.random() * vn.length)]];
    const free = (x, z) => !g.col.overlaps(x, 0.05, z, 0.7, 1.0);
    for (const [x, z] of (g.map.loot || [])) if (Math.random() < 0.7 && free(x, z)) spots.push({ x, z, boost: 0.35 });          // inside buildings: better odds
    for (const t of this.towns) for (let i = 0, k = 0; i < 400 && k < 4; i++) { const q = node(); if (Math.hypot(q.x - t.x, q.z - t.z) < 38) { spots.push({ x: q.x, z: q.z, boost: 0.15 }); k++; } }
    for (let i = 0; i < 45; i++) { const q = node(); spots.push({ x: q.x, z: q.z, boost: 0 }); }
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
    g.placeActor(a, this.start.x, this.start.z, Math.atan2(-this.side.x, -this.side.z), true, HELI_ALT);
    a.armor = 0; a.looted = 0; a.stormAcc = 0; a.air = 'heli'; a.brHold = 0;
    if (!a.isPlayer) {
      const loot = this.g.map.loot || [], perp = (x, z) => Math.abs((x - this.start.x) * this.side.x + (z - this.start.z) * this.side.z), along = (x, z) => ((x - this.start.x) * this.dir.x + (z - this.start.z) * this.dir.z) / HELI_SPEED;
      let cand = Math.random() < 0.55 ? this.towns.map((t) => ({ x: t.x + rand(-26, 26), z: t.z + rand(-26, 26) })) : loot.map(([x, z]) => ({ x, z }));
      cand = cand.filter((c) => perp(c.x, c.z) < 190 && along(c.x, c.z) > 4 && along(c.x, c.z) < this.heliLen - 3);
      let t = null; this.used = this.used || [];
      for (let i = 0; i < 12; i++) { const c = cand.length ? pick(cand) : { x: rand(-150, 150), z: rand(-150, 150) }; t = c; if (!this.used.some((u) => Math.hypot(u.x - c.x, u.z - c.z) < 34)) break; }      // spread the landings out
      this.used.push(t);
      a.tx = clamp(t.x, -312, 312); a.tz = clamp(t.z, -312, 312);
      a.jumpAt = clamp(along(a.tx, a.tz) - rand(2.6, 5.5), 0.8, this.heliLen - 1);
      a.pos.y = HELI_ALT; a.mesh.root.visible = false;
    }
    return true;
  }
  alive() { return this.g.actors.filter((a) => a.alive && !a.dummy && !a.zombie); }
  jump(a) {
    a.air = 'fall'; a.vel.set(this.dir.x * HELI_SPEED * 0.6, 0, this.dir.z * HELI_SPEED * 0.6); a.pos.y -= 1.5;
    if (a.mesh) a.mesh.root.visible = true; if (a.isPlayer) this.g.hud.center('SKYDIVE! SPACE = PARACHUTE', 2);
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
      const hp = this.heliPos, o = (a.isPlayer ? 0 : (a.id % 5 - 2) * 0.3); a.pos.set(hp.x - this.dir.x * (PLAYER_CAR + o) + this.side.x * o, hp.y + 0.02, hp.z - this.dir.z * (PLAYER_CAR + o) + this.side.z * o); a.vel.set(0, 0, 0);
      if (p) { const sp = !!k.Space; if (g.matchT >= 0 && ((sp && !this.spaceWas) || this.heliT >= this.heliLen - 0.2)) this.jump(a); this.spaceWas = sp; }
      else if (this.heliT >= a.jumpAt || this.heliT >= this.heliLen - 0.2) this.jump(a);
      return;
    }
    const gy = this.groundY(a), h = a.pos.y - gy;
    let hs, vy, wx = 0, wz = 0;
    if (p) {
      const fwd = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), str = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
      wx = fx * fwd + rx * str; wz = fz * fwd + rz * str; const l = Math.hypot(wx, wz); if (l > 0) { wx /= l; wz /= l; }
      const sp = !!k.Space; if (a.air === 'fall' && ((sp && !this.spaceWas && h < HELI_ALT - 10) || h < 70)) { a.air = 'chute'; this.addCanopy(a); g.hud.center('PARACHUTE OPEN', 1.2); } this.spaceWas = sp;
      if (a.air === 'fall') { hs = fwd > 0 ? (a.pitch < -0.5 ? 34 : 19) : 5; vy = a.pitch < -0.6 ? -64 : -42; } else { hs = fwd > 0 ? 14 : fwd < 0 ? 3 : 5; vy = -CHUTE_V; }
    } else {
      const dx = a.tx - a.pos.x, dz = a.tz - a.pos.z, d = Math.hypot(dx, dz) || 1; wx = dx / d; wz = dz / d;
      if (a.air === 'fall' && h < 78 + (a.id % 5) * 6) { a.air = 'chute'; this.addCanopy(a); }
      const left = a.air === 'fall' ? (h - 78) / 45 + 78 / CHUTE_V : h / CHUTE_V; hs = clamp(d / Math.max(0.8, left), 0, a.air === 'fall' ? 34 : 15); vy = a.air === 'fall' ? -45 : -CHUTE_V;
      a.yaw = Math.atan2(-wx, -wz); a.pitch = 0;
    }
    const kk = Math.min(1, 3 * dt); a.vel.x += (wx * hs - a.vel.x) * kk; a.vel.z += (wz * hs - a.vel.z) * kk; a.vel.y += (vy - a.vel.y) * Math.min(1, 4 * dt);
    a.pos.x = clamp(a.pos.x + a.vel.x * dt, -316, 316); a.pos.z = clamp(a.pos.z + a.vel.z * dt, -316, 316); a.pos.y += a.vel.y * dt;
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
      let best = null, bd = a.looted ? 95 : 150; for (const c of this.crates) { if (c.open || c.reach === false) continue; const d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z) * (c.drop ? 0.7 : 1); if (d < bd) { bd = d; best = c; } }
      if (best) { if (best.reach === undefined) { const n = this.g.nav.nodes[this.g.nav.nearest(best.x, best.z)]; best.reach = !!n && Math.hypot(n.x - best.x, n.z - best.z) < 5; if (!best.reach) return this.botGoal(a); } a.brTarget = best; return { x: best.x, z: best.z }; }
    }
    // geared up: drift towards the next circle through new ground (and into whoever is there) instead of hunting across the whole island
    const g = this.g, nav = g.nav, ro = a.roam;
    if (!ro || Math.hypot(ro.x - a.pos.x, ro.z - a.pos.z) < 8 || g.time - ro.t > 30 || Math.hypot(ro.x - z.cx, ro.z - z.cz) > z.r - 10) {
      let pick = null; const tx = z.c1 ? z.c1.x : z.cx, tz = z.c1 ? z.c1.z : z.cz;
      for (let i = 0; i < 40 && !pick; i++) { const n = nav.nodes[nav.validIdx[Math.floor(Math.random() * nav.validIdx.length)]]; const dz0 = Math.hypot(n.x - a.pos.x, n.z - a.pos.z); if (dz0 > 25 && dz0 < 130 && Math.hypot(n.x - z.cx, n.z - z.cz) < z.r - 12 && Math.hypot(n.x - tx, n.z - tz) < Math.hypot(a.pos.x - tx, a.pos.z - tz) + 40) pick = { x: n.x, z: n.z, t: g.time }; }
      a.roam = pick || null; 
    }
    return a.roam || null;
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
    const g = this.g, p = g.player; if (g.matchT < 0) { this.syncHeli(); if (!this.statics.length) this.collectStatics(); return; }
    this.t += dt;
    if (this.heliT < this.heliLen + 6) this.heliT += dt;
    this.syncHeli(); this.cullT -= dt; if (this.cullT <= 0) { this.cullT = 0.3; const cam = g.camera.position; this.cull(cam.x, cam.z); }
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
    if (this.heliT > this.heliLen + 6) this.heli.visible = false;
    if (this.sun) { this.sun.position.set(p.pos.x + this.sunOff.x, this.sunOff.y, p.pos.z + this.sunOff.z); this.sun.target.position.set(p.pos.x, 0, p.pos.z); this.sun.target.updateMatrixWorld(); }
    this.updateHud(p);
  }
  syncHeli() {
    const hp = this.heliPos, t = this.heliT; hp.set(this.start.x + this.dir.x * HELI_SPEED * t, HELI_ALT + Math.sin(t * 1.3) * 0.4, this.start.z + this.dir.z * HELI_SPEED * t);
    this.heli.position.copy(hp); this.heli.rotation.y = Math.atan2(-this.dir.x, -this.dir.z); this.prop.rotation.z += 0.7;
    for (const j of this.jets) j.scale.set(1, 0.75 + Math.random() * 0.5, 1);
    for (const o of this.smoke) { o.userData.t = (o.userData.t + 0.012) % 1; const u = o.userData.t; o.position.set(Math.sin(u * 9) * 0.3, 4.8 + u * 7, -25.8 + u * 14); o.scale.setScalar(0.5 + u * 2.4); o.material.opacity = 0.6 * (1 - u); }
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
  drawRadar(c, S) { const z = this.zone; c.strokeStyle = 'rgba(190,110,255,0.95)'; c.lineWidth = 2 / S; c.beginPath(); c.arc(z.cx, z.cz, Math.max(0.1, z.r), 0, 6.283); c.stroke(); if (z.c1 && z.ph === 'hold' && z.r1 > 0) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.2 / S; c.beginPath(); c.arc(z.c1.x, z.c1.z, z.r1, 0, 6.283); c.stroke(); } }
  placement() { const p = this.g.player; return p.alive ? 1 : (p.place || this.alive().length + 1); }
  winnerTeam() { const a = this.alive(); return a.length ? a[0].team : null; }
  checkEnd() {
    const g = this.g, p = g.player, n = this.alive().length;
    if (g.matchT < 1) return false;
    return n <= 1 || (!p.alive && p.deathT > 2.6);
  }
}
