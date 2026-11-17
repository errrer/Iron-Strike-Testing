// EXTREME GORE (optional, off by default; Settings > "Extreme gore"). Builds on gore.js: wounds on every hit, arterial spurting,
// blood mist, pooling and wall streaks that darken as they age, blood on your screen, organs / ribs / intestines / brain matter,
// and full dismemberment for shotguns, snipers, headshots and explosives. Purely cosmetic and local to your screen.
import * as THREE from 'three';
import { bx, mat } from './soldier.js?v=0.21.2';
import { GIBS } from './gore.js?v=0.21.2';

const V3 = THREE.Vector3, rand = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];
const G = () => new THREE.Group();
const sph = (r, m, x, y, z, g, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
const wet = (hex, r = 0.28) => { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: r, metalness: 0.05 }); return m; };

// ---- organs and body parts (extra gib models, registered into the shared GIBS table) ----
let built = false;
function buildGibs() {
  if (built) return; built = true;
  const pink = wet(0xd69aa3, 0.35), grey = wet(0xc4868f, 0.4), maroon = wet(0x5a0f14, 0.22), red = wet(0xa31620, 0.2), purple = wet(0xa8667c, 0.3), bone = mat(0xe9e1cc, 0.6), yellow = wet(0xd9c27a, 0.4), white = mat(0xf0eeea, 0.3);
  GIBS.brain = [
    () => { const g = G(); for (const [x, y, z, r] of [[0, 0, 0, 0.055], [0.04, 0.02, 0.02, 0.045], [-0.04, 0.0, 0.025, 0.045], [0.0, 0.03, -0.03, 0.045], [0.02, -0.025, -0.02, 0.04]]) sph(r, pink, x, y, z, g, 1, 0.8, 1); bx(0.1, 0.006, 0.01, grey, 0, 0.03, 0, g, 0, 0.4, 0); bx(0.01, 0.006, 0.09, grey, 0.02, 0.04, 0, g); return g; },
    () => { const g = G(); sph(0.045, pink, 0, 0, 0, g, 1.3, 0.7, 1); sph(0.03, grey, 0.04, 0.01, 0.02, g); bx(0.02, 0.01, 0.07, maroon, -0.02, -0.02, 0, g, 0, 0.5, 0); return g; },
  ];
  GIBS.eye = [() => { const g = G(); sph(0.024, white, 0, 0, 0, g); sph(0.011, mat(0x3a6b8c, 0.3), 0, 0, 0.018, g, 1, 1, 0.4); sph(0.006, mat(0x050505, 0.2), 0, 0, 0.022, g, 1, 1, 0.4); for (let i = 0; i < 4; i++) bx(0.004, 0.004, 0.07 + i * 0.01, red, 0, 0, -0.04 - i * 0.02, g, rand(-0.3, 0.3), rand(-0.4, 0.4), 0); return g; }];
  GIBS.skull = [
    () => { const g = G(); sph(0.09, bone, 0, 0.02, 0, g, 1, 0.85, 1.05); bx(0.14, 0.05, 0.05, maroon, 0, -0.045, -0.04, g, 0.2, 0, 0); bx(0.07, 0.04, 0.05, bone, 0, -0.07, -0.06, g); for (const sx of [-1, 1]) sph(0.02, mat(0x120808, 0.9), sx * 0.035, 0.0, -0.075, g); return g; },
    () => { const g = G(); bx(0.14, 0.04, 0.13, bone, 0, 0, 0, g, 0.2, 0.4, 0.2); bx(0.08, 0.03, 0.1, maroon, 0.01, -0.025, 0, g, 0.2, 0.2, 0); bx(0.03, 0.1, 0.03, bone, 0.05, 0.05, 0, g, 0.3, 0, 0.5); return g; },
  ];
  GIBS.jaw = [() => { const g = G(); bx(0.12, 0.03, 0.09, bone, 0, 0, 0, g); bx(0.025, 0.06, 0.03, bone, 0.055, 0.04, 0.04, g, 0, 0, 0.2); bx(0.025, 0.06, 0.03, bone, -0.055, 0.04, 0.04, g, 0, 0, -0.2); for (let i = 0; i < 7; i++) bx(0.012, 0.016, 0.012, white, -0.045 + i * 0.015, 0.02, -0.04, g); bx(0.08, 0.02, 0.04, maroon, 0, -0.02, 0.0, g); return g; }];
  GIBS.ribs = [() => { const g = G(); bx(0.03, 0.34, 0.03, bone, 0, 0, 0.1, g); for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) { const o = new THREE.Mesh(new THREE.TorusGeometry(0.11 - i * 0.008, 0.007, 5, 10, Math.PI * 0.85), bone); o.position.set(0, 0.14 - i * 0.052, 0.04); o.rotation.set(Math.PI / 2 + 0.2, 0, sx > 0 ? -0.2 : Math.PI + 0.2); o.rotation.z += sx * 0.1; g.add(o); } sph(0.05, maroon, 0, 0, 0.05, g, 1.6, 2.2, 0.5); return g; }];
  GIBS.spine = [() => { const g = G(); for (let i = 0; i < 7; i++) { bx(0.04, 0.028, 0.04, bone, 0, -0.1 + i * 0.033, 0, g, 0.04 * i, 0.05 * i, 0); bx(0.012, 0.02, 0.05, bone, 0, -0.1 + i * 0.033, 0.035, g); } bx(0.02, 0.05, 0.02, red, 0, 0.14, 0, g); return g; }];
  GIBS.gut = [() => { const g = G(); for (let i = 0; i < 13; i++) { const a = i * 0.7; sph(0.032 + 0.004 * Math.sin(i), i % 3 ? purple : pink, Math.sin(a) * 0.08, 0.0 + Math.cos(a * 1.3) * 0.035, -0.28 + i * 0.045, g, 1, 0.9, 1.2); } sph(0.05, yellow, 0, 0.03, 0.0, g, 1, 0.6, 1); return g; },
    () => { const g = G(); for (let i = 0; i < 9; i++) { const a = i * 0.9; sph(0.04, i % 2 ? pink : purple, Math.cos(a) * 0.07, Math.sin(a * 0.7) * 0.03, Math.sin(a) * 0.07, g, 1, 0.8, 1); } return g; }];
  GIBS.heart = [() => { const g = G(); sph(0.045, red, 0, 0, 0, g, 1, 1.15, 0.9); sph(0.03, maroon, 0.03, 0.02, 0.0, g); for (let i = 0; i < 3; i++) bx(0.012, 0.05, 0.012, i ? red : grey, -0.015 + i * 0.015, 0.06, 0, g, 0, 0, rand(-0.3, 0.3)); return g; }];
  GIBS.lung = [() => { const g = G(); sph(0.06, pink, 0.04, 0, 0, g, 0.9, 1.7, 0.8); sph(0.055, grey, -0.04, 0, 0, g, 0.9, 1.6, 0.8); bx(0.012, 0.09, 0.012, bone, 0, 0.08, 0, g); return g; }];
  GIBS.liver = [() => { const g = G(); sph(0.07, maroon, 0, 0, 0, g, 1.5, 0.5, 1); sph(0.04, wet(0x7a1a22, 0.2), 0.05, 0.01, 0.02, g, 1, 0.5, 1); sph(0.02, yellow, -0.03, 0.03, 0.0, g); return g; }];
  GIBS.hand = [() => { const g = G(); bx(0.08, 0.025, 0.09, mat(0xd7a98c, 0.6), 0, 0, 0, g); for (let i = 0; i < 4; i++) bx(0.014, 0.014, 0.06, mat(0xd7a98c, 0.6), -0.027 + i * 0.018, 0, -0.07, g, 0, rand(-0.1, 0.1), 0); bx(0.014, 0.014, 0.05, mat(0xd7a98c, 0.6), 0.05, 0, -0.04, g, 0, 0.7, 0); bx(0.05, 0.03, 0.04, maroon, 0, 0, 0.06, g); bx(0.012, 0.03, 0.05, bone, 0.01, 0, 0.09, g); return g; }];
  GIBS.foot = [() => { const g = G(); bx(0.1, 0.07, 0.24, mat(0x0c0d0e, 0.8), 0, 0, 0, g); bx(0.1, 0.03, 0.03, mat(0x1b1d20, 0.9), 0, -0.04, 0.08, g); bx(0.07, 0.06, 0.06, maroon, 0, 0.0, 0.14, g); bx(0.02, 0.05, 0.02, bone, 0.01, 0.01, 0.17, g); return g; }];
}

export class GoreX {
  constructor(game, gore) {
    this.g = game; this.gore = gore; this.mist = []; this.mI = 0; this.sBlood = []; this.t = 0;
    buildGibs(); gore.maxGibs = 150; gore.fadeAt = 90;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(120,6,6,0.8)'); gr.addColorStop(0.5, 'rgba(90,5,5,0.3)'); gr.addColorStop(1, 'rgba(80,4,4,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; s.life = 0; s.vel = new V3(); gore.parent.add(s); this.mist.push(s); }
    this.wounds = new Map();
    this.ov = document.getElementById('bloodScreen'); if (!this.ov) { this.ov = document.createElement('div'); this.ov.id = 'bloodScreen'; this.ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:35;overflow:hidden'; document.body.appendChild(this.ov); }
  }
  dispose() { for (const s of this.mist) this.gore.parent.remove(s); this.ov.innerHTML = ''; }

  puff(x, y, z, vx, vy, vz, size = 0.5) {
    const s = this.mist[this.mI++ % this.mist.length]; s.position.set(x, y, z); s.vel.set(vx, vy, vz); s.life = rand(0.35, 0.7); s.max = s.life; s.s0 = size * 0.4; s.scale.setScalar(s.s0 * 0.4); s.material.opacity = 0.3; s.material.rotation = rand(0, 6); s.visible = true;
  }

  // blood on your screen: blobs that run down the glass
  screenBlood(n = 5) {
    const ov = this.ov; while (ov.childElementCount > 40) ov.firstChild.remove();
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div'), s = rand(14, 70), x = rand(2, 98), y = rand(2, 85), dark = Math.random() < 0.4;
      d.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s * rand(0.7, 1.2)}px;margin:${-s / 2}px 0 0 ${-s / 2}px;border-radius:${rand(35, 50)}% ${rand(40, 55)}% ${rand(45, 60)}% ${rand(35, 55)}%;background:radial-gradient(circle at 40% 35%,${dark ? '#6a0a0a' : '#b11414'},${dark ? '#3e0505' : '#7d0b0b'} 70%,rgba(60,4,4,0.0) 100%);opacity:0.8;filter:blur(0.3px)`;
      ov.appendChild(d);
      if (d.animate) { d.animate([{ transform: 'translateY(0) scale(0.4)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 0.9, offset: 0.06 }, { transform: `translateY(${rand(30, 140)}px) scale(${rand(0.9, 1)} ${rand(1.5, 3)})`, opacity: 0 }], { duration: rand(6000, 12000), easing: 'cubic-bezier(.3,.1,.6,1)' }).onfinish = () => d.remove(); } else setTimeout(() => d.remove(), 6000);
    }
  }

  // a wound stuck to the body that was hit (stays on the corpse)
  wound(v, head) {
    const m = v.mesh; if (!m || !m.root) return;
    let w = this.wounds.get(m); if (!w) { w = []; this.wounds.set(m, w); }
    const tex = this._tex || (this._tex = Array.from({ length: 6 }, (_, i) => this.gore.decals[i].material.map));
    const p = new THREE.Mesh(this._wg || (this._wg = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: pick(tex), color: 0xb0b0b0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const s = head ? rand(0.1, 0.16) : rand(0.12, 0.26); p.scale.set(s, s, 1);
    const front = Math.random() < 0.65, side = rand(-0.17, 0.17);
    p.position.set(side, head ? 1.6 + rand(-0.03, 0.05) : rand(0.85, 1.4), front ? -0.145 : 0.145); p.rotation.set(0, front ? Math.PI : 0, rand(0, 6));
    if (head) { p.position.x = rand(-0.08, 0.08); p.position.z = front ? -0.115 : 0.115; }
    (m.body || m.root).add(p); w.push(p); if (w.length > 16) { const o = w.shift(); o.parent && o.parent.remove(o); o.material.dispose(); }
  }

  // blood that wraps the geometry: thin wet shells over the box parts, patchy and darker the more they were hit
  coat(root, amt = 0.5, maxN = 14, skip = null) {
    if (!root || !THREE.BoxGeometry) return; root.userData.coated = true; const tex = this.gore.decals.slice(0, 6).map((d) => d.material.map).filter(Boolean); let n = 0;
    const list = []; root.traverse((o) => { if (skip) { for (let q = o; q; q = q.parent) if (q === skip) return; } const gp = o.geometry && o.geometry.parameters; if (o.isMesh !== false && gp && gp.width && gp.height && gp.depth && !o.userData.bloodShell && o.visible) list.push(o); });
    for (const o of list) {
      if (n >= maxN || Math.random() > amt) continue; n++;
      const gp = o.geometry.parameters, t = pick(tex), mt = new THREE.MeshBasicMaterial({ map: t || null, color: pick([0x8a1a1a, 0x6e1010, 0x9c2323]), transparent: true, opacity: rand(0.55, 0.9), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      if (t && t.clone) { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rand(0.35, 0.8), rand(0.35, 0.8)); c.offset.set(rand(0, 1), rand(0, 1)); mt.map = c; }
      const sh = new THREE.Mesh(new THREE.BoxGeometry(gp.width * 1.045, gp.height * 1.045, gp.depth * 1.045), mt); sh.userData.bloodShell = true; o.add(sh);
      (this.shells || (this.shells = [])).push(sh);
    }
  }
  clearShells(root) { if (!root || !root.userData.coated) return; root.userData.coated = false; const rm = []; root.traverse((o) => { if (o.userData && o.userData.bloodShell) rm.push(o); }); for (const o of rm) { o.parent && o.parent.remove(o); o.material.dispose && o.material.dispose(); } }
  clearWounds(v) { this.clearShells(v.mesh && v.mesh.root); const m = v.mesh, w = m && this.wounds.get(m); if (!w) return; for (const o of w) { o.parent && o.parent.remove(o); o.material.dispose(); } this.wounds.delete(m); }

  // every bullet that hits somebody
  hit(v, k, w, head, amount, killed) {
    const gr = this.gore, hh = head ? 1.62 : rand(0.95, 1.45);
    let dx = v.pos.x - k.pos.x, dz = v.pos.z - k.pos.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const x = v.pos.x, y = v.pos.y + hh, z = v.pos.z, big = Math.min(2.5, amount / 35 + (head ? 0.8 : 0));
    gr.spray(x, y, z, dx, 0.15, dz, Math.round(10 + 14 * big), 6.5, 0.5);       // exit spray
    gr.spray(x, y, z, -dx, 0.1, -dz, 5, 2.4, 0.8);                               // mist back at the shooter
    for (let i = 0; i < 1 + Math.floor(big); i++) this.puff(x, y, z, dx * rand(0.5, 2) + rand(-0.6, 0.6), rand(-0.2, 0.8), dz * rand(0.5, 2) + rand(-0.6, 0.6), rand(0.35, 0.7));
    gr.splatter(x, y, z, dx, dz, Math.round(3 + 4 * big), 6);
    if (Math.random() < 0.7) this.wound(v, head);
    if (v.mesh && Math.random() < 0.5) this.coat(v.mesh.root, 0.12, 4, v.mesh.gun);
    if (!killed) { v.bloodT = 5; gr.bleed(() => this.g.stumpPos(v, { x: rand(-0.1, 0.1), y: hh - 0.05, z: -0.1 }), 0.9, 0.35 * (1 + big)); }
    const p = this.g.player; if (p && (k === p || v === p)) { const d = Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z); if (v === p) { this.screenBlood(1 + Math.round(big)); } else if (d < 3.2) this.screenBlood(Math.random() < 0.6 ? 1 : 2); }
    if (this.g.sound && this.g.sound.squelch) this.g.sound.squelch(0.5 + big * 0.2);
  }

  // on a kill: everything above, but more
  death(v, k, w, head) {
    const gr = this.gore, m = v.mesh; if (!m) return;
    const id = w.id, cls = id === 'frag' ? 'explosive' : (id === 'm680' || id === 'aa12' || w.cls === 'shotgun') ? 'shotgun' : (w.cls === 'sniper') ? 'sniper' : w.cls === 'melee' ? 'melee' : 'other';
    let dx = v.pos.x - k.pos.x, dz = v.pos.z - k.pos.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const x = v.pos.x, y = v.pos.y, z = v.pos.z, power = cls === 'explosive' ? 1.8 : cls === 'shotgun' ? 1.5 : cls === 'sniper' ? 1.3 : 1;
    // the main burst: a fan of droplets + thick mist
    gr.spray(x, y + 1.3, z, dx, 0.35, dz, Math.round(70 * power), 8, 0.7);
    gr.spray(x, y + 1.2, z, 0, 1, 0, 30, 4.5, 0.9);
    for (let i = 0; i < 4; i++) this.puff(x, y + rand(0.8, 1.6), z, dx * rand(0.5, 3) + rand(-1, 1), rand(0, 1.4), dz * rand(0.5, 3) + rand(-1, 1), rand(0.5, 1.1));
    gr.splatter(x, y + 1.3, z, dx, dz, Math.round(26 * power), 9);
    gr.splatter(x, y + 1.0, z, -dx, -dz, 8, 6);
    this.coat(m.root, head ? 0.55 : 0.7, 20, m.gun);
    // pools: several overlapping, slowly growing, darker as they age
    for (let i = 0; i < 4; i++) gr.splat({ x: x + rand(-0.45, 0.45), y, z: z + rand(-0.45, 0.45), nx: 0, ny: 1, nz: 0 }, rand(0.9, 1.7) * (i ? 0.8 : 1.15), true);
    gr.splat({ x: x + dx * 1.1, y, z: z + dz * 1.1, nx: 0, ny: 1, nz: 0 }, 0.9, true);
    // long arterial spurts (stay for ~7 s, pulse with the heartbeat) from where the neck / chest was
    const spurt = (dy, dur, pw) => gr.bleed(() => this.g.stumpPos(v, { x: rand(-0.04, 0.04), y: dy, z: -0.08 }), dur, pw);
    if (head) { spurt(1.45, 7, 2.2); gr.splat({ x: x + dx * 0.3, y, z: z + dz * 0.3, nx: 0, ny: 1, nz: 0 }, 1.1, true); } else { spurt(1.3, 5, 1.4); spurt(1.1, 4, 1.0); }
    const sp = () => rand(2.5, 8) * power, add = (part, yy, ox = 0) => { const o = gr.gib(part, { x, y: y + yy, z }, { x: dx * sp() + rand(-2.5, 2.5), y: rand(2.5, 6.5), z: dz * sp() + rand(-2.5, 2.5) }, m.color); if (o && (part === 'arm' || part === 'leg' || part === 'torso' || part === 'hand' || part === 'foot')) this.coat(o.g, 0.7, 6); return o; };
    // head: skull + brain + eyes + jaw
    if (head || cls === 'explosive' || (cls === 'shotgun' && Math.random() < 0.5)) {
      add('skull', 1.62); add('skull', 1.62); add('jaw', 1.55); add('eye', 1.65); if (Math.random() < 0.6) add('eye', 1.65);
      for (let i = 0, n = 3 + Math.floor(Math.random() * 4); i < n; i++) add('brain', rand(1.55, 1.8));
      gr.splat({ x: x - dx * 0.4, y, z: z - dz * 0.4, nx: 0, ny: 1, nz: 0 }, 0.7, true);
      if (m.headG && m.headG.visible && !(m.rich && m.rich.visible)) { m.headG.visible = false; m.goreHidden.push(m.headG); }
    }
    // chest: ribs, spine, organs, intestines
    if (cls === 'explosive' || cls === 'shotgun' || cls === 'sniper' || (!head && Math.random() < 0.55)) {
      add('ribs', 1.2); add('spine', 1.1);
      for (const part of pick([['heart', 'lung', 'lung'], ['liver', 'lung', 'heart'], ['heart', 'liver']])) add(part, rand(1.0, 1.4));
      add('gut', 0.95); if (Math.random() < 0.6) add('gut', 0.9);
    }
    // limbs by weapon class
    const list = [];
    if (cls === 'explosive') list.push('arm', 'arm', 'leg', 'leg', 'torso');
    else if (cls === 'shotgun') for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) list.push(pick(['arm', 'leg', 'arm', 'leg', 'torso']));
    else if (cls === 'sniper') for (let i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++) list.push(pick(['arm', 'leg', 'torso']));
    else if (cls === 'melee') list.push(pick(['arm', 'leg', 'arm']));
    else if (Math.random() < 0.65) for (let i = 0, n = 1 + Math.floor(Math.random() * 2); i < n; i++) list.push(pick(['arm', 'leg']));
    const rich = m.rich && m.rich.visible;
    for (const part of list) {
      let ref = null, yy = 1.1;
      if (part === 'arm') { ref = pick(m.arms.filter((o) => o.visible)) || null; yy = 1.15; } else if (part === 'leg') { ref = pick(m.legs.filter((o) => o.visible)) || null; yy = 0.6; }
      if ((part === 'arm' || part === 'leg') && !ref) continue;
      if (ref && !rich && ref.visible) { ref.visible = false; m.goreHidden.push(ref); const lp = ref.position; gr.bleed(() => this.g.stumpPos(v, lp), 6, 1.3); }
      add(part, yy); if (part === 'arm' && Math.random() < 0.6) add('hand', 1.1); if (part === 'leg' && Math.random() < 0.6) add('foot', 0.4);
    }
    for (let i = 0, n = Math.round(10 * power) + Math.floor(Math.random() * 6); i < n; i++) gr.gib('chunk', { x, y: y + rand(0.8, 1.6), z }, { x: dx * sp() + rand(-3, 3), y: rand(2, 8), z: dz * sp() + rand(-3, 3) }, m.color);
    const p = this.g.player; if (p) { const d = Math.hypot(x - p.pos.x, z - p.pos.z); if (d < 4.5 && k === p) this.screenBlood(2 + Math.round((4.5 - d) * 0.8)); else if (v === p) this.screenBlood(4); }
    if (this.g.sound && this.g.sound.squelch) { this.g.sound.squelch(1); setTimeout(() => this.g.sound.squelch && this.g.sound.squelch(0.7), 120); }
  }

  update(dt) {
    this.t += dt;
    for (const s of this.mist) {
      if (!s.visible) continue;
      s.life -= dt; if (s.life <= 0) { s.visible = false; continue; }
      const k = 1 - s.life / s.max; s.position.addScaledVector(s.vel, dt); s.vel.multiplyScalar(Math.exp(-2.2 * dt)); s.vel.y -= 0.6 * dt;
      s.scale.setScalar(s.s0 * (0.5 + 1.1 * Math.sqrt(k)));
      const cp = this.g.camera && this.g.camera.position, cd = cp ? Math.hypot(s.position.x - cp.x, s.position.y - cp.y, s.position.z - cp.z) : 9; s.material.opacity = 0.3 * (1 - k) * Math.min(1, Math.max(0, (cd - 0.8) / 2));
    }
    // aging: fresh blood is bright and wet, old blood goes dark brown
    const dk = this.gore.decals;
    for (let i = (this._ai = ((this._ai | 0) + 1) % 4); i < dk.length; i += 4) {
      const d = dk[i]; if (!d.visible) continue;
      const a = Math.min(1, d.age / 60); d.material.color.setRGB && d.material.color.setRGB(1 - 0.5 * a, 1 - 0.7 * a, 1 - 0.7 * a);
    }
    // wounded actors drip while they are alive and leave a trail
    for (const a of this.g.actors) {
      if (!a.alive || !(a.bloodT > 0) || !a.mesh) continue;
      a.bloodT -= dt; a._dr = (a._dr || 0) - dt;
      if (a._dr <= 0) { a._dr = rand(0.07, 0.18); this.gore.drop(a.pos.x + rand(-0.12, 0.12), a.pos.y + rand(0.2, 1.2), a.pos.z + rand(-0.12, 0.12), rand(-0.3, 0.3), 0, rand(-0.3, 0.3)); }
      a._tr = (a._tr || 0) - dt * Math.hypot(a.vel.x, a.vel.z);
      if (a._tr <= 0) { a._tr = 0.9; this.gore.splat({ x: a.pos.x, y: a.pos.y, z: a.pos.z, nx: 0, ny: 1, nz: 0 }, rand(0.12, 0.3)); }
    }
  }
  clear() { for (const s of this.mist) s.visible = false; this.ov.innerHTML = ''; }
}
