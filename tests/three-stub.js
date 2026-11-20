// Minimal stand-in for Three.js used ONLY by the headless logic smoke test (tests/smoke.py).
// It implements just enough of the API surface the game touches, with real vector maths.
export const SRGBColorSpace = 'srgb', RepeatWrapping = 1000, BackSide = 1, DoubleSide = 2, AdditiveBlending = 2, PCFSoftShadowMap = 2, ACESFilmicToneMapping = 4;

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
}
export class Color { constructor(c) { this.c = c; } setHex(c) { this.c = c; return this; } getHex() { return this.c; } }
class Rot { constructor() { this.x = 0; this.y = 0; this.z = 0; this.order = 'XYZ'; } set(x, y, z, o) { this.x = x; this.y = y; this.z = z; if (o) this.order = o; } }
export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(q) { return this.set(q.x, q.y, q.z, q.w); }
  clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
  invert() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  multiplyQuaternions(a, b) {
    const x = a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y, y = a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z, z = a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x, w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
    return this.set(x, y, z, w);
  }
  multiply(b) { return this.multiplyQuaternions(this, b); }
  setFromUnitVectors(a, b) {
    let r = a.x * b.x + a.y * b.y + a.z * b.z + 1;
    if (r < 1e-6) return this.set(0, 0, 1, 0);
    return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x, r).normalize();
  }
  normalize() { const l = Math.hypot(this.x, this.y, this.z, this.w) || 1; return this.set(this.x / l, this.y / l, this.z / l, this.w / l); }
  setFromEuler(e) {
    const q = (ax, a) => { const s = Math.sin(a / 2), c = Math.cos(a / 2); return new Quaternion(ax === 'x' ? s : 0, ax === 'y' ? s : 0, ax === 'z' ? s : 0, c); };
    const m = { x: q('x', e.x), y: q('y', e.y), z: q('z', e.z) }; const o = e.order || 'XYZ';
    const r = new Quaternion(); for (const ch of o.toLowerCase()) r.multiply(m[ch]); return this.copy(r);
  }
}
class Obj {
  get quaternion() { if (!this._q) this._q = new Quaternion(); if (this.rotation && !this._qfix) this._q.setFromEuler(this.rotation); return this._q; }
  set quaternion(v) { this._q = v; this._qfix = true; }
  constructor() { this.position = new Vector3(); this.rotation = new Rot(); this.scale = new Vector3(1, 1, 1); this.children = []; this.visible = true; this.userData = {}; this.parent = null; }
  add(c) { this.children.push(c); c.parent = this; return this; }
  remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
  traverse(f) { f(this); for (const c of this.children) c.traverse(f); }
  lookAt() {}
  rotateZ(a) { this.rotation.z += a; }
  updateProjectionMatrix() {}
}
export class Scene extends Obj { constructor() { super(); this.background = null; this.fog = null; } }
export class Group extends Obj {}
export class Mesh extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class Bone extends Obj { constructor() { super(); this._q = new Quaternion(); this._qfix = true; } }
export class Skeleton { constructor(b) { this.bones = b; } }
export class SkinnedMesh extends Mesh { bind(s) { this.skeleton = s; } }
export class Sprite extends Obj { constructor(m) { super(); this.material = m; } }
export class Points extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class PerspectiveCamera extends Obj { constructor(fov, aspect) { super(); this.fov = fov; this.aspect = aspect; } }
class Light extends Obj { constructor() { super(); this.shadow = { mapSize: { set() {} }, camera: { updateProjectionMatrix() {} } }; this.intensity = 1; } }
export class HemisphereLight extends Light {}
export class DirectionalLight extends Light { constructor() { super(); this.isDirectionalLight = true; this.shadow.mapSize = { x: 0, y: 0, set(a, b) { this.x = a; this.y = b; } }; } }
export class PointLight extends Light {}
export class Fog { constructor(c, n, f) { this.color = c; } }

class Attr {
  constructor(arr, n) { this.array = arr; this.itemSize = n; this.count = arr.length / n; this.needsUpdate = false; }
  getX(i) { return this.array[i * this.itemSize]; } getY(i) { return this.array[i * this.itemSize + 1]; }
  setXY(i, x, y) { this.array[i * 2] = x; this.array[i * 2 + 1] = y; }
  setY(i, y) { this.array[i * this.itemSize + 1] = y; }
  setXYZ(i, x, y, z) { this.array[i * 3] = x; this.array[i * 3 + 1] = y; this.array[i * 3 + 2] = z; }
}
export class BufferAttribute extends Attr { constructor(a, n) { super(a, n); } }
export class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = Array.from(i.array || i); } computeVertexNormals() {} dispose() {} }
class Geo extends BufferGeometry { constructor() { super(); this.attributes.uv = new Attr(new Float32Array(48), 2); } }
export class BoxGeometry extends Geo { constructor(w, h, d) { super(); this.kind = 'box'; this.p = [w, h, d]; } }
export class CylinderGeometry extends Geo { constructor(rt, rb, h) { super(); this.kind = 'cyl'; this.p = [rt, rb, h]; } }
export class TorusGeometry extends Geo { constructor(r, t) { super(); this.kind = 'torus'; this.p = [r, t]; } }
export class ConeGeometry extends Geo { constructor(r, h) { super(); this.kind = 'cone'; this.p = [r, h]; } }
export class PlaneGeometry extends Geo {}
export class SphereGeometry extends Geo { constructor(r) { super(); this.kind = 'sphere'; this.p = [r]; } }
export class OctahedronGeometry extends Geo { constructor(r) { super(); this.kind = 'octa'; this.p = [r]; } }
export class Float32BufferAttribute extends Attr { constructor(a, n) { super(Float32Array.from(a), n); } }
class Mat { constructor(o = {}) { Object.assign(this, o); this.color = new Color(o.color); } }
export class MeshStandardMaterial extends Mat {}
export class MeshBasicMaterial extends Mat {}
export class SpriteMaterial extends Mat {}
export class PointsMaterial extends Mat {}
export class ShaderMaterial extends Mat {}
export class TextureLoader { load(u) { return { url: u, repeat: { set() {} }, colorSpace: null }; } }
export class CanvasTexture { constructor(c) { this.image = c; this.repeat = { set() {} }; } clone() { return new CanvasTexture(this.image); } dispose() {} }
export class WebGLRenderer {
  constructor(o) { this.domElement = o.canvas; this.shadowMap = {}; this.frames = 0; }
  setPixelRatio() {} setSize() {} clear() {} clearDepth() {}
  render() { this.frames++; }
}
