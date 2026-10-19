// Cosmetic gore: body-part gibs (4 parts x 3 models each), blood bursts and floor splats.
// Stylised low-poly like the rest of the game. Can be switched off in the settings.
import * as THREE from 'three';
import { bx, mat, SKIN, DARK, OLIVE, KHAKI } from './soldier.js';

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);

const flesh = () => mat(0x9a1c1c, 0.55), meat = () => mat(0x5e0e0e, 0.5), bone = () => mat(0xe7e0cd, 0.7);
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
export const GIB_PARTS = Object.keys(GIBS);

export class Gore {
  constructor(parent, col) {
    this.parent = parent; this.col = col; this.gibs = []; this.decals = []; this.dI = 0;
    const dg = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: 0x5a0b0b, transparent: true, opacity: 0.85, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.visible = false; m.age = 0; parent.add(m); this.decals.push(m);
    }
  }

  decal(x, y, z, size) {
    const m = this.decals[this.dI++ % this.decals.length];
    m.position.set(x, y + 0.012, z); m.rotation.z = Math.random() * 6.28; m.scale.set(size, size * rand(0.7, 1.2), 1);
    m.material.color.setHex(Math.random() < 0.5 ? 0x5a0b0b : 0x730f0f); m.material.opacity = 0.85; m.age = 0; m.visible = true;
  }

  // part: 'head' | 'torso' | 'arm' | 'leg'; variant: 0..2 (random if omitted)
  gib(part, pos, vel, teamColor, variant) {
    const set = GIBS[part]; const v = variant == null ? Math.floor(Math.random() * set.length) : variant;
    const g = set[v](teamColor);
    g.position.set(pos.x, pos.y, pos.z); g.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    this.parent.add(g);
    const o = { g, part, variant: v, vel: new V3(vel.x, vel.y, vel.z), spin: new V3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), age: 0, rest: false, bounces: 0 };
    this.gibs.push(o);
    if (this.gibs.length > 40) this._drop(this.gibs.shift());
    return o;
  }

  _drop(o) { this.parent.remove(o.g); }

  update(dt, burst) {
    for (const d of this.decals) {
      if (!d.visible) continue;
      d.age += dt;
      if (d.age > 24) { d.material.opacity = 0.85 * Math.max(0, 1 - (d.age - 24) / 4); if (d.age > 28) d.visible = false; }
    }
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const o = this.gibs[i], g = o.g, p = g.position, v = o.vel;
      o.age += dt;
      if (o.age > 16) { const s = Math.max(0, 1 - (o.age - 16) / 2); g.scale.set(s, s, s); if (s <= 0) { this._drop(o); this.gibs.splice(i, 1); } continue; }
      if (o.rest) continue;
      v.y -= 15 * dt;
      const col = this.col;
      let nx = p.x + v.x * dt, nz = p.z + v.z * dt, ny = p.y + v.y * dt;
      if (col && col.overlaps(nx, p.y - 0.07, p.z, 0.08, 0.14)) { v.x *= -0.35; nx = p.x; }
      if (col && col.overlaps(nx, p.y - 0.07, nz, 0.08, 0.14)) { v.z *= -0.35; nz = p.z; }
      let landed = false;
      if (col && col.overlaps(nx, ny - 0.07, nz, 0.08, 0.14)) { if (v.y < 0) landed = true; v.y *= -0.3; ny = p.y; }
      if (ny < 0.08) { ny = 0.08; landed = true; if (v.y < 0) v.y *= -0.3; }
      p.set(nx, ny, nz);
      g.rotation.x += o.spin.x * dt; g.rotation.y += o.spin.y * dt; g.rotation.z += o.spin.z * dt;
      if (landed) {
        const hard = Math.abs(v.y) > 0.5;
        if (hard || o.bounces === 0) { this.decal(p.x, p.y - 0.07, p.z, rand(0.35, 0.7)); if (burst) burst(p.x, p.y, p.z, 0x8a0f0f, 4, 2); }
        o.bounces++; v.x *= 0.6; v.z *= 0.6; o.spin.multiplyScalar(0.55);
        if (!hard) { v.y = 0; const k = Math.exp(-7 * dt); v.x *= k; v.z *= k; o.spin.multiplyScalar(0.5); }
        if (Math.hypot(v.x, v.z) < 0.25 && !hard) { o.rest = true; v.set(0, 0, 0); }
      }
    }
  }

  clear() { for (const o of this.gibs) this._drop(o); this.gibs = []; for (const d of this.decals) d.visible = false; }
}
