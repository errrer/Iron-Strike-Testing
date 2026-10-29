// Menu weapon preview: a slowly swaying 3D render of the selected gun, plus white icon thumbnails for the weapon tiles (COD-style loadout screen).
import * as THREE from 'three';
import { buildGun, makeEnv } from './gunmodels.js?v=0.18.1';

export class WeaponPreview {
  constructor(canvas) {
    this.canvas = canvas; this.ok = false; this.w = null; this.t = 0; this.model = null; this.icons = {};
    try {
      this.r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      this.r.setClearColor(0x000000, 0); if (this.r.setPixelRatio) this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.scene = new THREE.Scene();
      { const env = makeEnv(this.r); if (env) this.scene.environment = env; }
      this.scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x4a4a52, 1.3));
      const key = new THREE.DirectionalLight(0xffffff, 3.4); key.position.set(-1.5, 2.2, 2.5); this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xffb060, 1.6); rim.position.set(2, 0.6, -2.5); this.scene.add(rim);
      this.cam = new THREE.PerspectiveCamera(24, 2, 0.05, 20);
      this.ok = !!THREE.Box3;
    } catch (e) { this.ok = false; }
  }

  // build a centred, unit-ish sized gun group facing the camera side-on (barrel to the left)
  make(w, flat) {
    const g = buildGun(w), holder = new THREE.Group(); holder.add(g); g.rotation.y = Math.PI / 2;
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder), c = new THREE.Vector3(), s = new THREE.Vector3(); box.getCenter(c); box.getSize(s);
    g.position.sub(c); holder.userData.size = s;
    if (flat) holder.traverse((o) => { if (o.isMesh) o.material = flat; });
    return holder;
  }

  frame(holder, aspect) {
    const s = holder.userData.size, fov = this.cam.fov * Math.PI / 180;
    const need = Math.max(s.x * 1.1 / aspect, s.y * 1.3), dist = need / (2 * Math.tan(fov / 2)) + s.z * 0.5;
    this.cam.aspect = aspect; this.cam.position.set(0, 0, Math.max(0.5, dist)); this.cam.lookAt(0, 0, 0); this.cam.updateProjectionMatrix();
  }

  show(w) {
    if (!this.ok) return; this.w = w;
    try {
      if (this.model) this.scene.remove(this.model);
      this.model = this.make(w); this.scene.add(this.model);
      this.size(); this.frame(this.model, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    } catch (e) { this.ok = false; }
  }

  size() { const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (w && h && (this.cw !== w || this.ch !== h)) { this.cw = w; this.ch = h; this.r.setSize(w, h, false); } }

  tick(dt) {
    if (!this.ok || !this.model || !this.canvas.offsetParent) return;
    this.t += dt; const pw = this.cw, ph = this.ch; this.size(); if (pw !== this.cw || ph !== this.ch) this.frame(this.model, this.cw / Math.max(1, this.ch));
    this.model.rotation.y = Math.sin(this.t * 0.5) * 0.45; this.model.rotation.x = Math.sin(this.t * 0.37) * 0.04;
    this.r.render(this.scene, this.cam);
  }

  // grey-white silhouette thumbnail as a data URL (cached per weapon id + attachments)
  icon(w) {
    if (!this.ok) return '';
    const key = w.id + ':' + (w.attMask | 0); if (this.icons[key]) return this.icons[key];
    try {
      const mat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.55, metalness: 0.1 }), holder = this.make({ ...w, attMask: 0 }, mat), sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 1.7)); sc.environment = this.scene.environment; const k = new THREE.DirectionalLight(0xffffff, 1.6); k.position.set(-1, 2, 3); sc.add(k); sc.add(holder);
      const prevW = this.cw, prevH = this.ch, cv = this.r.domElement;
      this.r.setSize(320, 130, false); this.frame(holder, 320 / 130); this.r.render(sc, this.cam);
      const url = cv.toDataURL('image/png'); this.icons[key] = url;
      if (prevW) this.r.setSize(prevW, prevH, false); this.cw = 0;
      return url;
    } catch (e) { return ''; }
  }
}
