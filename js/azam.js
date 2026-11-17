// Secret: type "azam" anywhere and every texture in the game becomes the photo in assets/azam.jpg. Type it again to switch back.
// Local to your own screen. Sky shaders, particles and the like are left alone; everything with a colour/map is re-textured.
import * as THREE from 'three';

const isMeshy = (o) => !!(o.material && o.geometry && !o.isPoints && !o.isSprite && !o.isLine);

export class Azam {
  constructor(game) { this.g = game; this.on = false; this.orig = new WeakMap(); this.tex = null; this.cache = new Map(); this.timer = 0; }
  texture() {
    if (!this.tex) { this.tex = new THREE.TextureLoader().load('assets/azam.jpg'); this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) this.tex.colorSpace = THREE.SRGBColorSpace; }
    return this.tex;
  }
  texFor(rep) {                                         // one clone per repeat setting so floors/walls keep their tiling
    if (rep && (typeof rep.x !== 'number' || typeof rep.y !== 'number')) rep = null;
    const key = rep ? `${rep.x.toFixed(2)}_${rep.y.toFixed(2)}` : '1_1';
    let t = this.cache.get(key);
    if (!t) { t = this.texture().clone ? this.texture().clone() : this.texture(); if (t.repeat && t.repeat.set) t.repeat.set(rep ? rep.x : 1, rep ? rep.y : 1); t.needsUpdate = true; this.cache.set(key, t); }
    return t;
  }
  apply(root) {
    root.traverse((o) => {
      if (!isMeshy(o)) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m || m.isShaderMaterial || !m.color || this.orig.has(m) || (m.userData && m.userData.azamSkip)) continue;
        this.orig.set(m, { map: m.map || null, color: m.color.getHex(), emissiveMap: m.emissiveMap || null });
        m.map = this.texFor(m.map && m.map.repeat ? m.map.repeat : null); m.color.setHex(0xffffff); m.needsUpdate = true;
      }
    });
  }
  restore(root) {
    root.traverse((o) => {
      if (!isMeshy(o)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const s = m && this.orig.get(m); if (!s) continue;
        m.map = s.map; m.color.setHex(s.color); m.needsUpdate = true; this.orig.delete(m);
      }
    });
  }
  roots() { const g = this.g; return [g.scene, g.camera].filter(Boolean); }
  set(on) {
    this.on = on; clearInterval(this.timer);
    for (const r of this.roots()) on ? this.apply(r) : this.restore(r);
    if (on) this.timer = setInterval(() => { if (this.on) for (const r of this.roots()) this.apply(r); }, 600);   // catches guns / bots / props built later
  }
}
