// Cosmetic gore: body-part gibs (4 parts x 3 models each), blood bursts and floor splats.
// Stylised low-poly like the rest of the game. Can be switched off in the settings.
import * as THREE from 'three';
import { bx, mat, SKIN, DARK, OLIVE, KHAKI } from './soldier.js?v=0.18.4';

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);

// textures: a flesh surface for the torn ends of the body parts, and 15 blood splats for the floor
const url = (f) => new URL('../assets/gore/' + f, import.meta.url).href;
let loader = null, fleshTex = null, bloodTex = null; const fleshMats = {};
const load = (f) => { if (!loader) loader = new THREE.TextureLoader(); const t = loader.load(url(f)); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t; };
const fleshMat = (key, tint, rough) => {
  if (!fleshMats[key]) { if (!fleshTex) fleshTex = load('flesh.jpg'); fleshMats[key] = new THREE.MeshStandardMaterial({ map: fleshTex, color: tint, roughness: rough }); }
  return fleshMats[key];
};
const flesh = () => fleshMat('flesh', 0xe0a0a0, 0.55), meat = () => fleshMat('meat', 0xffffff, 0.45), bone = () => mat(0xe7e0cd, 0.7);
const bloodTextures = () => bloodTex || (bloodTex = Array.from({ length: 15 }, (_, i) => load('blood' + (i + 1) + '.png')));
const G = () => new THREE.Group();

// ---- gib models: GIBS[part][variant](teamColor) -> Group centred on its own middle ----
export const GIBS = {
  head: [
    (c) => { const g = G(); bx(0.2, 0.22, 0.2, mat(SKIN), 0, 0, 0, g); bx(0.27, 0.12, 0.28, mat(OLIVE), 0, 0.12, 0, g); bx(0.16, 0.07, 0.16, meat(), 0, -0.13, 0, g); bx(0.06, 0.05, 0.06, bone(), 0.03, -0.17, 0, g); return g; },   // helmeted head, torn neck
    (c) => { const g = G(); bx(0.2, 0.22, 0.2, mat(SKIN), 0, 0, 0, g); bx(0.22, 0.07, 0.22, mat(0x241a14), 0, 0.12, 0, g); bx(0.2, 0.08, 0.2, flesh(), 0, -0.14, 0.02, g); bx(0.14, 0.03, 0.05, bone(), 0, -0.1, -0.1, g); return g; },   // bare head, jaw ripped
    (c) => { const g = G(); bx(0.24, 0.07, 0.24, mat(OLIVE), 0, 0.03, 0, g, 0.2, 0, 0.15); bx(0.16, 0.08, 0.16, meat(), 0.02, -0.03, 0, g, -0.2, 0.3, 0); bx(0.1, 0.03, 0.12, bone(), -0.08, -0.07, 0.03, g, 0.3, 0.5, 0.2); bx(0.07, 0.07, 0.07, mat(SKIN), 0.1, -0.08, 0.05, g); return g; },   // helmet half + skull shards
  ],
  torso: [
    (c) => { const g = G(); bx(0.46, 0.3, 0.27, mat(OLIVE), 0, 0, 0, g); bx(0.5, 0.26, 0.31, mat(c, 0.8), 0, 0.05, 0, g); bx(0.34, 0.2, 0.05, mat(0x30363a), 0, 0.05, -0.17, g); bx(0.4, 0.06, 0.22, meat(), 0, -0.17, 0, g); return g; },       // chest in vest
    (c) => { const g = G(); bx(0.4, 0.07, 0.22, flesh(), 0, -0.1, 0, g); for (const y of [-0.04, 0.05, 0.14]) { bx(0.34, 0.03, 0.04, bone(), 0, y, -0.1, g, 0.15, 0, 0); bx(0.34, 0.03, 0.04, bone(), 0, y, 0.1, g, -0.15, 0, 0); } bx(0.05, 0.3, 0.05, bone(), 0, 0.03, 0, g); bx(0.3, 0.07, 0.2, meat(), 0, 0.2, 0, g); return g; },   // ribcage
    (c) => { const g = G(); bx(0.46, 0.2, 0.27, mat(KHAKI), 0, -0.03, 0, g); bx(0.5, 0.07, 0.3, mat(0x0c0d0e), 0, 0.09, 0, g); bx(0.38, 0.06, 0.22, meat(), 0, 0.16, 0, g); bx(0.1, 0.06, 0.1, bone(), -0.1, 0.2, 0.02, g); return g; },             // pelvis + belt
  ],
  arm: [
    (c) => { const g = G(); bx(0.12, 0.28, 0.12, mat(OLIVE), 0, 0.14, 0, g); bx(0.1, 0.25, 0.1, mat(OLIVE), 0, -0.13, 0, g, -0.3, 0, 0); bx(0.115, 0.09, 0.115, mat(0x0c0d0e), 0, -0.29, -0.04, g, -0.3, 0, 0); bx(0.1, 0.05, 0.1, meat(), 0, 0.3, 0, g); return g; },   // whole arm
    (c) => { const g = G(); bx(0.1, 0.25, 0.1, mat(OLIVE), 0, 0.02, 0, g); bx(0.115, 0.09, 0.115, mat(0x0c0d0e), 0, -0.15, 0, g); bx(0.09, 0.05, 0.09, flesh(), 0, 0.16, 0, g); bx(0.03, 0.08, 0.03, bone(), 0.02, 0.2, 0, g); return g; },    // forearm + glove
    (c) => { const g = G(); bx(0.12, 0.28, 0.12, mat(OLIVE), 0, 0, 0, g); bx(0.15, 0.09, 0.2, mat(c, 0.7), 0, 0.12, 0, g); bx(0.1, 0.05, 0.1, meat(), 0, -0.16, 0, g); bx(0.04, 0.1, 0.04, bone(), 0, -0.2, 0.01, g); return g; },     // upper arm + shoulder pad
  ],
  leg: [
    (c) => { const g = G(); bx(0.18, 0.4, 0.2, mat(KHAKI), 0, 0.2, 0, g); bx(0.16, 0.3, 0.18, mat(KHAKI), 0, -0.15, 0.02, g, -0.2, 0, 0); bx(0.19, 0.11, 0.28, mat(0x0c0d0e), 0, -0.34, -0.05, g, -0.2, 0, 0); bx(0.16, 0.05, 0.16, meat(), 0, 0.42, 0, g); return g; },   // whole leg
    (c) => { const g = G(); bx(0.18, 0.4, 0.2, mat(KHAKI), 0, 0, 0, g); bx(0.2, 0.1, 0.06, mat(DARK), 0, -0.1, -0.1, g); bx(0.16, 0.05, 0.16, flesh(), 0, -0.22, 0, g); bx(0.05, 0.1, 0.05, bone(), 0.02, -0.27, 0, g); return g; },                    // thigh
    (c) => { const g = G(); bx(0.16, 0.3, 0.18, mat(KHAKI), 0, 0.05, 0, g); bx(0.19, 0.11, 0.28, mat(0x0c0d0e), 0, -0.15, -0.03, g); bx(0.14, 0.05, 0.14, meat(), 0, 0.21, 0, g); bx(0.04, 0.08, 0.04, bone(), -0.02, 0.26, 0, g); return g; },                  // shin + boot
  ],
};
GIBS.chunk = [
  (c) => { const g = G(); bx(0.12, 0.09, 0.1, meat(), 0, 0, 0, g, 0.3, 0.4, 0.1); bx(0.07, 0.06, 0.07, flesh(), 0.05, 0.04, 0.02, g, 0.1, 0.8, 0.3); return g; },            // lump of meat
  (c) => { const g = G(); bx(0.03, 0.17, 0.03, bone(), 0, 0, 0, g, 0.4, 0, 0.5); bx(0.06, 0.06, 0.06, meat(), 0, 0.08, 0, g, 0.2, 0.2, 0.5); return g; },                     // bone shard
  (c) => { const g = G(); bx(0.14, 0.07, 0.08, mat(0x7a1212, 0.35), 0, 0, 0, g, 0, 0.5, 0.2); bx(0.08, 0.06, 0.06, flesh(), 0.07, 0.03, 0, g, 0.3, 0.1, 0); bx(0.05, 0.05, 0.14, mat(0xb05a5a, 0.4), -0.03, -0.03, 0.05, g); return g; },   // organ
];
export const GIB_PARTS = Object.keys(GIBS);

const FACES = [['x', 'x0', -1], ['x', 'x1', 1], ['y', 'y0', -1], ['y', 'y1', 1], ['z', 'z0', -1], ['z', 'z1', 1]];

// Cosmetic gore engine: droplets that splat on floors AND walls, spurting stumps, flying parts with blood trails,
// growing pools. Everything is pooled so a full lobby of kills stays cheap.
export class Gore {
  constructor(parent, col) {
    this.parent = parent; this.col = col; this.gibs = []; this.decals = []; this.dI = 0; this.drops = []; this.drI = 0; this.bleeders = [];
    const dg = new THREE.PlaneGeometry(1, 1), tex = bloodTextures();
    for (let i = 0; i < 170; i++) {
      const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ map: tex[i % tex.length], color: 0xd8d0d0, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.visible = false; m.age = 0; m.grow = null; parent.add(m); this.decals.push(m);
    }
    const pg = new THREE.BoxGeometry(0.04, 0.04, 0.04), pm = new THREE.MeshBasicMaterial({ color: 0x8a0f0f });
    for (let i = 0; i < 240; i++) { const m = new THREE.Mesh(pg, pm); m.visible = false; m.vel = new V3(); m.life = 0; parent.add(m); this.drops.push(m); }
  }

  // nearest solid surface to a point: { x, y, z, nx, ny, nz } (point snapped onto the face) or null
  surfaceAt(x, y, z) {
    if (y < 0.07) return { x, y: 0, z, nx: 0, ny: 1, nz: 0 };
    let best = null, bd = 0.1; const E = 0.1;
    for (const b of this.col.boxes) {
      if (x < b.x0 - E || x > b.x1 + E || y < b.y0 - E || y > b.y1 + E || z < b.z0 - E || z > b.z1 + E) continue;
      for (const [ax, key, sg] of FACES) {
        const pos = ax === 'x' ? x : ax === 'y' ? y : z, d = Math.abs(pos - b[key]);
        if (d >= bd) continue;
        const o1 = ax === 'x' ? y : x, o2 = ax === 'z' ? y : z;       // the two other coordinates must lie on the face
        const r1 = ax === 'x' ? [b.y0, b.y1] : [b.x0, b.x1], r2 = ax === 'z' ? [b.y0, b.y1] : [b.z0, b.z1];
        if (o1 < r1[0] - E || o1 > r1[1] + E || o2 < r2[0] - E || o2 > r2[1] + E) continue;
        bd = d; best = { x, y, z, nx: 0, ny: 0, nz: 0 }; best[ax] = b[key]; best['n' + ax] = sg;
      }
    }
    return best;
  }

  _decal() { const m = this.decals[this.dI++ % this.decals.length]; m.grow = null; m.age = 0; return m; }

  // a blood splat stuck to a surface (floor, wall, ceiling or top of a crate); size in metres
  splat(sf, size, grow) {
    const m = this._decal(), tex = bloodTextures();
    m.material.map = tex[Math.floor(Math.random() * tex.length)];
    m.position.set(sf.x + sf.nx * 0.012, sf.y + sf.ny * 0.012, sf.z + sf.nz * 0.012);
    if (Math.abs(sf.ny) > 0.9) m.rotation.set(sf.ny > 0 ? -Math.PI / 2 : Math.PI / 2, 0, Math.random() * 6.28);
    else { m.lookAt(sf.x + sf.nx, sf.y + sf.ny, sf.z + sf.nz); m.rotateZ(Math.random() * 6.28); }
    const k = size * 1.9, f = Math.random() < 0.5 ? -1 : 1;
    if (grow) { m.grow = { t: 0, from: k * 0.35, to: k, f }; m.scale.set(k * 0.35 * f, k * 0.35, 1); } else m.scale.set(k * f, k, 1);
    m.material.opacity = 0.92; m.visible = true; return m;
  }
  decal(x, y, z, size) { this.splat({ x, y, z, nx: 0, ny: 1, nz: 0 }, size); }

  // a single flying droplet; becomes a small splat where it lands
  drop(x, y, z, vx, vy, vz) {
    const m = this.drops[this.drI++ % this.drops.length];
    m.position.set(x, y, z); m.vel.set(vx, vy, vz); m.life = 2.5; m.visible = true;
    const s = rand(0.6, 1.6); m.scale.set(s, s, s);
  }
  // spray n droplets in a cone around (dx, dy, dz)
  spray(x, y, z, dx, dy, dz, n, speed, spread) {
    for (let i = 0; i < n; i++) {
      const sp = speed * rand(0.35, 1.1);
      this.drop(x, y, z, (dx + rand(-spread, spread)) * sp, (dy + rand(-spread, spread * 0.8)) * sp, (dz + rand(-spread, spread)) * sp);
    }
  }
  // a stump that keeps spurting for a moment. at() returns [x, y, z] or null (stop)
  bleed(at, dur, power) { this.bleeders.push({ at, t: 0, dur, power, acc: 0 }); if (this.bleeders.length > 24) this.bleeders.shift(); }

  // blood thrown against nearby walls/floor: rays from the wound, mostly along the shot direction
  splatter(x, y, z, dx, dz, n, reach = 7) {
    for (let i = 0; i < n; i++) {
      const f = rand(0.8, 2.4); let rx = dx * f + rand(-0.9, 0.9), ry = rand(-0.7, 0.8), rz = dz * f + rand(-0.9, 0.9);
      const l = Math.hypot(rx, ry, rz); rx /= l; ry /= l; rz /= l;
      let t = this.col.ray(x, y, z, rx, ry, rz, reach);
      if (ry < -0.05) { const tg = -y / ry; if (tg < t) t = tg; }
      if (!(t < reach)) continue;
      const sf = this.surfaceAt(x + rx * (t - 0.02), y + ry * (t - 0.02), z + rz * (t - 0.02));
      if (sf) this.splat(sf, Math.max(0.35, 1.5 - t * 0.17) * rand(0.6, 1.3));
    }
  }

  // part: 'head' | 'torso' | 'arm' | 'leg' | 'chunk'; variant: 0..2 (random if omitted)
  gib(part, pos, vel, teamColor, variant) {
    const set = GIBS[part]; const v = variant == null ? Math.floor(Math.random() * set.length) : variant;
    const g = set[v](teamColor);
    g.position.set(pos.x, pos.y, pos.z); g.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    this.parent.add(g);
    const o = { g, part, variant: v, vel: new V3(vel.x, vel.y, vel.z), spin: new V3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), age: 0, rest: false, bounces: 0, trail: 0, bleeds: part !== 'chunk' || Math.random() < 0.5 };
    this.gibs.push(o);
    if (this.gibs.length > 80) this._drop(this.gibs.shift());
    return o;
  }

  _drop(o) { this.parent.remove(o.g); }

  update(dt) {
    const col = this.col;
    // decals: grow, then fade
    for (const d of this.decals) {
      if (!d.visible) continue;
      d.age += dt;
      if (d.grow) { const gr = d.grow; gr.t = Math.min(1, gr.t + dt / 2.5); const k = gr.from + (gr.to - gr.from) * (1 - (1 - gr.t) * (1 - gr.t)); d.scale.set(k * gr.f, k, 1); if (gr.t >= 1) d.grow = null; }
      if (d.age > 40) { d.material.opacity = 0.92 * Math.max(0, 1 - (d.age - 40) / 5); if (d.age > 45) d.visible = false; }
    }
    // droplets
    for (const m of this.drops) {
      if (!m.visible) continue;
      m.life -= dt; if (m.life <= 0) { m.visible = false; continue; }
      const v = m.vel, p = m.position; v.y -= 13 * dt;
      const nx = p.x + v.x * dt, ny = p.y + v.y * dt, nz = p.z + v.z * dt;
      if (ny < 0.03 || col.overlaps(nx, ny - 0.02, nz, 0.02, 0.04)) {
        m.visible = false;
        if (Math.random() < 0.1) { const sf = ny < 0.03 ? { x: nx, y: 0, z: nz, nx: 0, ny: 1, nz: 0 } : this.surfaceAt(p.x + v.x * dt * 0.6, p.y + v.y * dt * 0.6, p.z + v.z * dt * 0.6); if (sf) this.splat(sf, rand(0.1, 0.3)); }
        continue;
      }
      p.set(nx, ny, nz);
    }
    // spurting stumps
    for (let i = this.bleeders.length - 1; i >= 0; i--) {
      const b = this.bleeders[i]; b.t += dt;
      const at = b.t < b.dur ? b.at() : null;
      if (!at) { this.bleeders.splice(i, 1); continue; }
      const k = 1 - b.t / b.dur, pulse = 0.55 + 0.45 * Math.sin(b.t * 16);
      b.acc += dt * 70 * b.power * k * pulse;
      while (b.acc >= 1) { b.acc -= 1; this.drop(at[0], at[1], at[2], rand(-0.7, 0.7) * 2.2, rand(3.2, 5.6) * (0.5 + k * 0.7), rand(-0.7, 0.7) * 2.2); }
    }
    // gibs
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const o = this.gibs[i], g = o.g, p = g.position, v = o.vel;
      o.age += dt;
      if (o.age > 22) { const s = Math.max(0, 1 - (o.age - 22) / 2); g.scale.set(s, s, s); if (s <= 0) { this._drop(o); this.gibs.splice(i, 1); } continue; }
      if (o.rest) continue;
      v.y -= 15 * dt;
      if (o.bleeds && o.age < 3.5) { o.trail -= dt; if (o.trail <= 0 && v.length() > 1.5) { o.trail = 0.035; this.drop(p.x, p.y, p.z, rand(-0.6, 0.6), rand(0, 1.2), rand(-0.6, 0.6)); } }
      let nx = p.x + v.x * dt, nz = p.z + v.z * dt, ny = p.y + v.y * dt;
      if (col.overlaps(nx, p.y - 0.07, p.z, 0.08, 0.14)) { this._wall(p.x + Math.sign(v.x) * 0.1, p.y, p.z, o); v.x *= -0.35; nx = p.x; }
      if (col.overlaps(nx, p.y - 0.07, nz, 0.08, 0.14)) { this._wall(nx, p.y, p.z + Math.sign(v.z) * 0.1, o); v.z *= -0.35; nz = p.z; }
      let landed = false;
      if (col.overlaps(nx, ny - 0.07, nz, 0.08, 0.14)) { if (v.y < 0) landed = true; v.y *= -0.3; ny = p.y; }
      if (ny < 0.08) { ny = 0.08; landed = true; if (v.y < 0) v.y *= -0.3; }
      p.set(nx, ny, nz);
      g.rotation.x += o.spin.x * dt; g.rotation.y += o.spin.y * dt; g.rotation.z += o.spin.z * dt;
      if (landed) {
        const hard = Math.abs(v.y) > 0.5;
        if (hard || o.bounces === 0) {
          this.splat({ x: p.x, y: p.y - 0.07, z: p.z, nx: 0, ny: 1, nz: 0 }, (o.part === 'chunk' ? 0.25 : 0.5) * rand(0.8, 1.4));
          if (o.bleeds) this.spray(p.x, p.y, p.z, 0, 1, 0, 6, 2.5, 0.8);
        }
        o.bounces++; v.x *= 0.6; v.z *= 0.6; o.spin.multiplyScalar(0.55);
        if (!hard) { v.y = 0; const k = Math.exp(-7 * dt); v.x *= k; v.z *= k; o.spin.multiplyScalar(0.5); }
        if (Math.hypot(v.x, v.z) < 0.25 && !hard) { o.rest = true; v.set(0, 0, 0); }
      }
    }
  }

  _wall(x, y, z, o) {
    if (!o.bleeds) return;
    const sf = this.surfaceAt(x, y, z); if (sf) this.splat(sf, (o.part === 'chunk' ? 0.4 : 0.8) * rand(0.8, 1.3));
  }

  clear() { for (const o of this.gibs) this._drop(o); this.gibs = []; this.bleeders = []; for (const d of this.decals) d.visible = false; for (const m of this.drops) m.visible = false; }
}
