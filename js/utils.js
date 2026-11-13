// Utilities (grenades): two per life. Key 3 throws the first one, key 4 the second. Pick them in the class screen. Offline / split-screen-free only (not synced over the network).
import * as THREE from 'three';
export const UTILS = {
  frag: { name: 'Frag Grenade', desc: 'Explodes 2.6 s after the throw. Big damage in 7 m, blocked by walls.', color: 0x3c5a2a, fuse: 2.6 },
  flash: { name: 'Flashbang', desc: 'Blinds and freezes anyone looking at it for a few seconds.', color: 0xcfd4da, fuse: 1.5 },
  smoke: { name: 'Smoke Grenade', desc: 'Drops a thick smoke screen that lasts 14 s. Bots lose sight of you inside it.', color: 0x8a9096, fuse: 1.1 },
};
export const UTIL_IDS = Object.keys(UTILS);
const W = { frag: { id: 'frag', name: 'Frag Grenade' } };

export class Utilities {
  constructor(game) { this.g = game; this.items = []; this.fx = []; this.group = new THREE.Group(); game.scene.add(this.group); this.smokes = []; this.blind = 0; this.ensureOverlay(); }
  dispose() { if (this.g.scene) this.g.scene.remove(this.group); if (this.ov) this.ov.style.opacity = 0; }
  ensureOverlay() { let o = document.getElementById('flashOv'); if (!o) { o = document.createElement('div'); o.id = 'flashOv'; o.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:40;transition:none'; document.body.appendChild(o); } this.ov = o; }
  // called when the player (re)spawns: two fresh utilities
  refill() { const p = this.g.player; p.utilLeft = [1, 1]; }
  use(slot) {
    const g = this.g, p = g.player; if (!p || !p.alive || g.ended || g.net || this.g.knifeOut) return false;
    if (!p.utilLeft) this.refill();
    if (!p.utilLeft[slot]) { g.hud.center('NO UTILITY LEFT', 0.8); return false; }
    const id = (g.utilIds || ['frag', 'flash'])[slot] || 'frag', u = UTILS[id]; if (!u) return false;
    p.utilLeft[slot] = 0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: u.color, metalness: 0.5, roughness: 0.5 }));
    const cp = Math.cos(p.pitch || 0), dx = -Math.sin(p.yaw) * cp, dy = Math.sin(p.pitch || 0), dz = -Math.cos(p.yaw) * cp, eye = p.pos.y + (p.h || 1.8) - 0.2;
    m.position.set(p.pos.x + dx * 0.5, eye + dy * 0.5, p.pos.z + dz * 0.5); this.group.add(m);
    this.items.push({ id, m, v: new THREE.Vector3(dx * 15, dy * 15 + 3, dz * 15), t: u.fuse, owner: p });
    g.sound.beep(false); g.hud.center(`${u.name.toUpperCase()} OUT`, 0.6);
    return true;
  }
  update(dt) {
    const g = this.g;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], P = it.m.position, v = it.v; it.t -= dt;
      v.y -= 18 * dt; let nx = P.x + v.x * dt, ny = P.y + v.y * dt, nz = P.z + v.z * dt;
      for (const b of g.col.boxes) {
        if (b.noRay || nx < b.x0 - 0.06 || nx > b.x1 + 0.06 || ny < b.y0 - 0.06 || ny > b.y1 + 0.06 || nz < b.z0 - 0.06 || nz > b.z1 + 0.06) continue;
        const px = Math.min(nx - b.x0, b.x1 - nx), py = Math.min(ny - b.y0, b.y1 - ny), pz = Math.min(nz - b.z0, b.z1 - nz);
        if (px <= py && px <= pz) { v.x *= -0.45; nx = P.x; } else if (pz <= py) { v.z *= -0.45; nz = P.z; } else { v.y *= -0.4; ny = P.y; v.x *= 0.8; v.z *= 0.8; }
      }
      const gy = g.groundAt ? g.groundAt(nx, ny + 0.5, nz, 0.1) : 0;
      if (ny < gy + 0.06) { ny = gy + 0.06; if (v.y < 0) v.y *= -0.35; v.x *= 0.7; v.z *= 0.7; }
      P.set(nx, ny, nz); it.m.rotation.x += dt * 6;
      if (it.t <= 0) { this.detonate(it); this.group.remove(it.m); this.items.splice(i, 1); }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.life -= dt; f.m.scale.multiplyScalar(1 + dt * f.grow); f.m.material.opacity = Math.max(0, f.life / f.max) * f.o; if (f.life <= 0) { this.group.remove(f.m); this.fx.splice(i, 1); } }
    for (let i = this.smokes.length - 1; i >= 0; i--) { const s = this.smokes[i]; s.t -= dt; for (const c of s.puffs) { c.rotation.y += dt * 0.2; const k = Math.min(1, (14 - s.t) / 2.5) * Math.min(1, s.t / 2); c.scale.setScalar(c.userData.r * (0.4 + 0.6 * k)); c.material.opacity = 0.55 * k; } if (s.t <= 0) { for (const c of s.puffs) this.group.remove(c); this.smokes.splice(i, 1); } }
    if (this.blind > 0) { this.blind -= dt; this.ov.style.opacity = Math.min(1, this.blind / 1.2); if (this.blind <= 0) this.ov.style.opacity = 0; }
  }
  // is the point inside a live smoke cloud?
  inSmoke(x, y, z) { for (const s of this.smokes) if ((x - s.x) ** 2 + (y - s.y) ** 2 + (z - s.z) ** 2 < 4.6 * 4.6) return true; return false; }
  los(x, y, z, e) { const dx = e.pos.x - x, dy = e.pos.y + 1.2 - y, dz = e.pos.z + 0 - z, d = Math.hypot(dx, dy, dz) || 1; return !this.g.col.rayThrough(x, y, z, dx / d, dy / d, dz / d, d - 0.3); }
  detonate(it) {
    const g = this.g, p = g.player, x = it.m.position.x, y = it.m.position.y, z = it.m.position.z;
    if (it.id === 'frag') {
      const R = 7; this.puff(x, y, z, 0xffa030, 0.5, 11, 0.45, 0.85);
      g.burst(x, y + 0.2, z, 0xff8a1f, 16, 7); g.burst(x, y + 0.2, z, 0x555555, 8, 4); g.sound.hurt();
      for (const e of g.actors) {
        if (!e.alive || e.dummy || (e !== p && g.mode.team && e.team === p.team)) continue;
        const d = Math.hypot(e.pos.x - x, e.pos.y + 1 - y, e.pos.z - z); if (d > R || !this.los(x, y + 0.1, z, e)) continue;
        g.damage(e, p, 190 * (1 - d / R) + 20, W.frag, false);
      }
    } else if (it.id === 'flash') {
      this.puff(x, y, z, 0xffffff, 0.4, 6, 0.3, 1);
      for (const e of g.actors) {
        if (!e.alive || e.dummy) continue;
        const d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d > 22 || !this.los(x, y, z, e)) continue;
        const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), tx = (x - e.pos.x) / (d || 1), tz = (z - e.pos.z) / (d || 1), facing = fx * tx + fz * tz;
        const k = (1 - d / 22) * (0.35 + 0.65 * Math.max(0, (facing + 0.2) / 1.2));
        if (e === p) this.blind = Math.max(this.blind, 0.8 + 3.8 * k), this.ov.style.opacity = 1;
        else e.stunT = Math.max(e.stunT || 0, 0.8 + 3.2 * k);
      }
    } else {
      const puffs = []; for (let i = 0; i < 14; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb9bec4, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        c.userData.r = 1.9 + Math.random() * 1.5; c.position.set(x + (Math.random() - 0.5) * 3.6, y + 0.6 + Math.random() * 2.2, z + (Math.random() - 0.5) * 3.6); c.scale.setScalar(0.1); this.group.add(c); puffs.push(c);
      }
      this.smokes.push({ x, y: y + 1.3, z, t: 14, puffs });
    }
  }
  puff(x, y, z, color, life, grow, o, size) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, fog: false, depthWrite: false })); m.position.set(x, y + 0.2, z); this.group.add(m); this.fx.push({ m, life, max: life, grow, o });
  }
}
