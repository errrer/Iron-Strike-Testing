import * as THREE from 'three';
import { getSlot, camoOf } from './weapons.js?v=0.18.8';

// ------------------------------------------------------------------------------------------------
// Gun models.
//  * Weapons with an `asset` (e.g. the VMP) are loaded from assets/models/<id>.json - baked from your
//    FBX files by tools/fbx2model.py.  If the file is missing, the procedural stand-in below is used.
//  * Every other weapon is built procedurally from boxes/cylinders until you replace it with a real model.
// Conventions (same for both): origin = middle of the receiver, -Z = barrel direction, +Y = up, metres.
// Each model exposes userData: muzzle, sightY, grip (trigger hand), fore (support hand), pistol.
// ------------------------------------------------------------------------------------------------

export const MODEL_DATA = {};
const MODEL_VER = '0.18.8';        // bump when an assets/models/*.json changes so browsers don't keep the old copy

export async function loadModels(weapons) {
  const jobs = [];
  for (const w of Object.values(weapons)) {
    if (!w.asset || MODEL_DATA[w.asset.id]) continue;
    for (const id of [w.asset.id, ...(w.asset.xmag ? [w.asset.xmag] : [])]) jobs.push(fetch(`assets/models/${id}.json?v=${MODEL_VER}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.parts) MODEL_DATA[id] = j; }).catch(() => {}));
  }
  await Promise.all(jobs);
  return Object.keys(MODEL_DATA);
}

// ---- shared materials -----------------------------------------------------------------------
const matCache = new Map();
function mat(color, metal = 0.5, rough = 0.5, extra) {
  const k = `${color}|${metal}|${rough}|${extra ? Object.entries(extra).map(([n, v]) => n + '=' + (v && v.isTexture ? 't' + n : v && v.isColor ? v.getHex() : typeof v === 'object' ? JSON.stringify(v) : v)).join(',') : ''}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...(extra || {}) }));
  return matCache.get(k);
}
// procedural surface detail: a fine metal / polymer grain (bump) and a wood-grain colour map, generated once on a canvas
let _grain = null, _wood = null;
function grainTex() {
  if (_grain || typeof document === 'undefined') return _grain;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); if (!g) return null;
  for (let i = 0; i < 64 * 64; i++) { const v = 110 + Math.random() * 90; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i % 64, (i / 64) | 0, 1, 1); }
  _grain = new THREE.CanvasTexture(c); _grain.wrapS = _grain.wrapT = THREE.RepeatWrapping; return _grain;
}
function woodTex() {
  if (_wood || typeof document === 'undefined') return _wood;
  const c = document.createElement('canvas'); c.width = 8; c.height = 128; const g = c.getContext('2d'); if (!g) return null;
  for (let y = 0; y < 128; y++) { const v = 0.78 + 0.22 * Math.sin(y * 0.55 + Math.sin(y * 0.11) * 3) * Math.sin(y * 0.21 + 1) + (Math.random() - 0.5) * 0.12, k = Math.round(255 * Math.min(1, Math.max(0.35, v))); g.fillStyle = `rgb(${k},${k},${k})`; g.fillRect(0, y, 8, 1); }
  _wood = new THREE.CanvasTexture(c); _wood.wrapS = _wood.wrapT = THREE.RepeatWrapping; return _wood;
}
const gmat = (color, metal, rough, bump = 0.35) => { const t = grainTex(); return mat(color, metal, rough, { envMapIntensity: 1.0, ...(t ? { bumpMap: t, bumpScale: bump } : {}) }); };
const wmat = (color, rough) => { const t = woodTex(); return mat(t ? 0xffffff : color, 0.05, rough, t ? { map: t, color: new THREE.Color(color), envMapIntensity: 0.6 } : {}); };
const cm = (m) => { m.userData = m.userData || {}; m.userData.camo = true; return m; };       // parts painted by a camo (receiver, handguard, furniture)
const M = {
  steel: () => gmat(0x4a4f57, 0.9, 0.32),
  blued: () => cm(gmat(0x30343a, 0.85, 0.36)),
  silver: () => cm(gmat(0x80868e, 0.95, 0.32, 0.2)),
  poly: () => cm(gmat(0x3a3d43, 0.1, 0.68, 0.6)),
  polyTan: () => cm(gmat(0x7d7054, 0.1, 0.72, 0.6)),
  rubber: () => gmat(0x141516, 0.0, 0.92, 0.6),
  wood: () => cm(wmat(0x8a5428, 0.55)),
  woodDark: () => cm(wmat(0x53301a, 0.55)),
  black: () => gmat(0x181a1d, 0.4, 0.45, 0.3),
  brass: () => mat(0xb08a3a, 0.9, 0.35),
  glass: () => mat(0x3a7fb0, 0.2, 0.1, { transparent: true, opacity: 0.55 }),
  lens: () => mat(0x1b3a55, 0.3, 0.05),
  red: () => mat(0xc0392b, 0.1, 0.6),
};

// bevelled box (chamfered edges catch the light, which is most of what makes a boxy gun read as machined metal). Flat shaded, cached by size.
const bevelCache = new Map();
function bevelBox(w, h, d) {
  const r = Math.min(0.0026, Math.min(w, h, d) * 0.3);
  if (!(r >= 0.0007)) return new THREE.BoxGeometry(w, h, d);
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}`; if (bevelCache.has(key)) return bevelCache.get(key);
  const H = [w / 2, h / 2, d / 2], P = [], tri = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, cx = a[0] + b[0] + c[0], cy = a[1] + b[1] + c[1], cz = a[2] + b[2] + c[2];
    if (nx * cx + ny * cy + nz * cz < 0) P.push(a, c, b); else P.push(a, b, c); };
  const quad = (a, b, c, e) => { tri(a, b, c); tri(a, c, e); };
  // inset corner of face (axis k, sign s) with corner signs (cs[0..2]; the entry for axis k is ignored)
  const fc = (k, s, cs) => { const p = [0, 0, 0]; for (let j = 0; j < 3; j++) p[j] = j === k ? s * H[k] : cs[j] * (H[j] - r); return p; };
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) { const a = (k + 1) % 3, b = (k + 2) % 3, q = (ca, cb) => { const cs = [0, 0, 0]; cs[a] = ca; cs[b] = cb; return fc(k, s, cs); }; quad(q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)); }
  for (let k1 = 0; k1 < 3; k1++) for (let k2 = k1 + 1; k2 < 3; k2++) { const k3 = 3 - k1 - k2; for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    const c = (face, s, o3) => { const cs = [0, 0, 0]; cs[k1 === face ? k2 : k1] = face === k1 ? s2 : s1; cs[k3] = o3; return fc(face, s, cs); };
    quad(c(k1, s1, -1), c(k1, s1, 1), c(k2, s2, 1), c(k2, s2, -1)); } }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const s = [sx, sy, sz]; tri(fc(0, sx, s), fc(1, sy, s), fc(2, sz, s)); }
  const pos = new Float32Array(P.length * 3), uv = new Float32Array(P.length * 2);
  P.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
  const nm = g.attributes.normal;                                           // box-projected UVs (metres * 18 so the grain stays the same size on every part)
  for (let i = 0; i < P.length; i++) { const nx = nm ? Math.abs(nm.getX(i)) : 0, ny = nm ? Math.abs(nm.getY(i)) : 1, nz = nm ? Math.abs(nm.getZ(i)) : 0, p = P[i];
    if (nx >= ny && nx >= nz) { uv[i * 2] = p[2] * 18; uv[i * 2 + 1] = p[1] * 18; } else if (ny >= nz) { uv[i * 2] = p[2] * 18; uv[i * 2 + 1] = p[0] * 18; } else { uv[i * 2] = p[0] * 18; uv[i * 2 + 1] = p[1] * 18; } }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); bevelCache.set(key, g); return g;
}

// image-based lighting for the gun scenes: a soft sky / ground gradient with a few bright softboxes, so metal has something to reflect
const envCache = new WeakMap();
export function makeEnv(renderer) {
  if (!THREE.PMREMGenerator || !renderer) return null;
  if (envCache.has(renderer)) return envCache.get(renderer);
  let tex = null;
  try {
    const sc = new THREE.Scene(), geo = new THREE.SphereGeometry(10, 24, 16), pos = geo.attributes.position, cols = [];
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10, t = Math.max(0, y), b = Math.max(0, -y), v = y >= 0 ? [0.42 + 0.4 * t, 0.44 + 0.42 * t, 0.47 + 0.46 * t] : [0.42 - 0.34 * Math.min(1, b * 1.6), 0.44 - 0.36 * Math.min(1, b * 1.6), 0.47 - 0.38 * Math.min(1, b * 1.6)]; cols.push(v[0], v[1], v[2]); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (w, h, x, y, z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i * 0.97, i * 0.92), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
    panel(7, 3.5, -4.5, 6.5, 4.5, 7); panel(2.5, 6, 8, 1.5, -2, 5); panel(6, 1.6, 1, -1.5, 7, 1.6); panel(3, 3, -8, 2, -4, 2.5);
    const pm = new THREE.PMREMGenerator(renderer); tex = pm.fromScene(sc, 0.03).texture; pm.dispose();
  } catch (e) { tex = null; }
  envCache.set(renderer, tex); return tex;
}

class B {
  constructor() { this.g = new THREE.Group(); }
  _add(geo, m, x, y, z, rx = 0, ry = 0, rz = 0) { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); this.g.add(me); return me; }
  box(w, h, d, x, y, z, m, rx = 0, ry = 0, rz = 0) { return this._add(bevelBox(w, h, d), m, x, y, z, rx, ry, rz); }
  // cylinder lying along Z (barrels, tubes)
  tube(r, len, x, y, z, m, r2) { return this._add(new THREE.CylinderGeometry(r2 ?? r, r, len, 12), m, x, y, z, Math.PI / 2); }
  // cylinder standing along Y
  post(r, h, x, y, z, m) { return this._add(new THREE.CylinderGeometry(r, r, h, 12), m, x, y, z); }
  // cylinder lying along X
  rod(r, len, x, y, z, m) { return this._add(new THREE.CylinderGeometry(r, r, len, 10), m, x, y, z, 0, 0, Math.PI / 2); }
  ball(r, x, y, z, m) { return this._add(new THREE.SphereGeometry(r, 10, 8), m, x, y, z); }
  done(u) { Object.assign(this.g.userData, u); return this.g; }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mark = (m, ...ks) => { for (const k of ks) m.userData[k] = true; return m; };   // tags used by attachments + animations
const iron = (m) => mark(m, 'iron');   // iron sights: hidden when a red dot is fitted

// Iron sights: a rear aperture ring (or open U-notch) and a front post with protective ears, both centred on the sight line `y` so the
// view down the gun lines up with them. br / bf = height of the surface the rear / front sight stand on. Pistols get a notched blade
// and a post with white dots. Everything is tagged 'iron' (hidden when a red dot is fitted) and optionally 'slide' (moves with the slide).
const white = () => mat(0xe9e9df, 0, 0.5);
function ironSights(b, o) {
  const { y, zr, zf, br, bf } = o, tag = (m) => (o.slide ? mark(m, 'iron', 'slide') : iron(m));
  const bx = (w, h, d, x, y0, y1, z, m) => tag(b.box(w, y1 - y0, d, x, (y0 + y1) / 2, z, m));
  if (o.pistol) {
    const w = 0.0048, gap = 0.0046, top = y + 0.004;
    for (const s of [-1, 1]) {
      bx(w, 0, 0.01, s * (gap / 2 + w / 2), br, top, zr, M.black());
      tag(b.box(0.0024, 0.0024, 0.001, s * (gap / 2 + w / 2), top - 0.003, zr - 0.0056, white()));
    }
    bx(0.0048, 0, 0.008, 0, bf, y + 0.0015, zf, M.black());
    tag(b.box(0.0026, 0.0026, 0.001, 0, y - 0.001, zf - 0.0045, white()));
    return;
  }
  const r = o.r || 0.0058, t = 0.0045;
  if (o.open) {                                                    // open rear notch: two blades with a wide V gap
    const gap = o.gap || 0.011;
    for (const s of [-1, 1]) bx(0.0055, 0, 0.012, s * (gap / 2 + 0.00275), br, y + 0.006, zr, M.black());
    bx(0.03, 0, 0.016, 0, br, br + 0.006, zr, M.blued());
  } else {                                                         // aperture ring with a base and two tall guard ears
    bx(0.022, 0, 0.016, 0, br, y - r, zr, M.blued());
    for (const s of [-1, 1]) bx(t, 0, 0.012, s * (r + t / 2), y - r, y + r + t, zr, M.black());
    bx(2 * r + 2 * t, 0, 0.012, 0, y + r, y + r + t, zr, M.black());
    for (const s of [-1, 1]) bx(0.003, 0, 0.022, s * (r + t + 0.006), y - r, y + r + 0.012, zr, M.blued());
  }
  // front: base, post, and two protective ears
  bx(0.024, 0, 0.022, 0, bf, bf + 0.008, zf, M.blued());
  if (o.bead) { tag(b.ball(0.0048, 0, y - 0.0048 + 0.001, zf, M.brass())); bx(0.003, 0, 0.003, 0, bf, y - 0.0048, zf, M.steel()); }
  else {
    bx(0.0042, 0, 0.006, 0, bf, y + 0.003, zf, M.black());
    for (const s of [-1, 1]) bx(0.0035, 0, 0.014, s * 0.0105, bf, y + 0.011, zf, M.blued());
  }
}

// small repeated details ----------------------------------------------------------------------
function railTeeth(b, z0, z1, y, w, step = 0.026) {
  for (let z = z0; z > z1; z -= step) b.box(w, 0.004, 0.012, 0, y, z, M.blued());
}
function triggerGroup(b, x, y, z, len = 0.055) {
  b.box(0.007, 0.004, len, x, y - 0.03, z, M.blued());                       // guard bottom
  b.box(0.007, 0.03, 0.005, x, y - 0.016, z - len / 2, M.blued());           // guard front
  b.box(0.006, 0.022, 0.008, x, y - 0.012, z + 0.002, M.blued(), 0.25);      // trigger
}

// ------------------------------------------------------------------------------------------------
// ASSEMBLY LINE RIFLES
// ------------------------------------------------------------------------------------------------

function buildAK() {                 // AK-47
  const b = new B();
  b.box(0.05, 0.062, 0.32, 0, 0.0, -0.01, M.blued());                           // receiver
  b.box(0.046, 0.022, 0.3, 0, 0.04, 0.0, M.blued());                            // dust cover
  b.tube(0.0095, 0.34, 0, 0.012, -0.34, M.steel());                             // barrel
  b.tube(0.012, 0.2, 0, 0.046, -0.32, M.steel());                               // gas tube
  b.box(0.046, 0.03, 0.2, 0, 0.044, -0.32, M.wood());                           // upper handguard
  b.box(0.054, 0.042, 0.2, 0, -0.006, -0.31, M.wood());                         // lower handguard
  b.box(0.02, 0.06, 0.028, 0, 0.03, -0.49, M.steel());                          // gas block / front sight base
  ironSights(b, { y: 0.068, zr: -0.1, zf: -0.49, br: 0.051, bf: 0.06, open: true });
  b.tube(0.014, 0.012, 0, 0.012, -0.49, M.steel());
  b.tube(0.0125, 0.045, 0, 0.012, -0.53, M.steel());                            // muzzle device
  for (let k = 0; k < 4; k++) mark(b.box(0.036, 0.075, 0.058, 0, -0.07 - k * 0.062, -0.03 - k * 0.006 - k * k * 0.0035, M.steel(), 0.12 + k * 0.09), 'mag');   // banana mag
  b.box(0.032, 0.1, 0.045, 0, -0.1, 0.12, M.woodDark(), -0.32);                 // grip
  triggerGroup(b, 0, -0.038, 0.03);
  b.rod(0.006, 0.03, 0.036, 0.02, 0.005, M.steel());                            // charging handle
  b.box(0.004, 0.02, 0.05, 0.0255, 0.01, 0.04, M.black());                      // ejection port
  b.box(0.038, 0.07, 0.2, 0, -0.012, 0.25, M.wood(), 0.04);                     // stock
  b.box(0.036, 0.04, 0.1, 0, 0.0, 0.16, M.wood());                              // stock wrist
  b.box(0.04, 0.1, 0.012, 0, -0.02, 0.35, M.steel(), 0.06);                     // butt plate
  return b.done({ muzzle: V(0, 0.012, -0.555), sightY: 0.068, grip: V(0, -0.1, 0.12), fore: V(0, -0.025, -0.31), pistol: false, side: V(0.028, -0.006, -0.37), mount: V(0, 0.051, 0.03), under: V(0, -0.027, -0.31) });
}

function buildBolt() {               // Kar98k + scope
  const b = new B();
  b.box(0.034, 0.045, 0.16, 0, 0.012, 0.0, M.steel());                          // receiver
  b.tube(0.0095, 0.56, 0, 0.016, -0.34, M.steel());                             // barrel
  b.box(0.036, 0.034, 0.36, 0, -0.004, -0.24, M.wood());                        // fore-stock
  b.box(0.03, 0.016, 0.28, 0, 0.026, -0.26, M.woodDark());                      // hand guard
  for (const z of [-0.12, -0.28, -0.44]) b.box(0.042, 0.042, 0.01, 0, 0.002, z, M.steel());   // barrel bands
  b.box(0.012, 0.022, 0.02, 0, 0.044, -0.6, M.blued());                         // front sight hood
  b.tube(0.0075, 0.02, 0, 0.016, -0.625, M.steel());
  b.box(0.034, 0.06, 0.34, 0, -0.04, 0.2, M.wood(), -0.06);                     // stock body
  b.box(0.034, 0.05, 0.1, 0, -0.022, 0.06, M.wood());                           // wrist
  b.box(0.038, 0.11, 0.014, 0, -0.06, 0.375, M.rubber(), -0.1);                 // butt plate
  mark(b.rod(0.0045, 0.075, 0.04, 0.022, 0.07, M.steel()), 'bolt');             // bolt handle
  mark(b.ball(0.011, 0.082, 0.022, 0.07, M.steel()), 'bolt');                   // bolt knob
  b.box(0.03, 0.02, 0.07, 0, -0.04, -0.01, M.steel());                          // magazine box
  triggerGroup(b, 0, -0.03, 0.03, 0.06);
  // scope
  b.box(0.018, 0.028, 0.02, 0, 0.056, -0.09, M.blued()); b.box(0.018, 0.028, 0.02, 0, 0.056, 0.07, M.blued());   // mounts
  b.tube(0.0165, 0.27, 0, 0.082, -0.01, M.black());                             // main tube
  b.tube(0.024, 0.06, 0, 0.082, -0.15, M.black(), 0.0165);                      // objective bell
  b.tube(0.0165, 0.05, 0, 0.082, 0.14, M.black(), 0.021);                       // eyepiece
  b.tube(0.0215, 0.004, 0, 0.082, -0.181, M.lens());                            // objective lens
  b.tube(0.0185, 0.004, 0, 0.082, 0.166, M.lens());                             // eyepiece lens
  b.post(0.009, 0.02, 0, 0.108, -0.01, M.steel());                              // elevation turret
  b.rod(0.009, 0.02, 0.022, 0.082, -0.01, M.steel());                           // windage turret
  return b.done({ muzzle: V(0, 0.016, -0.635), sightY: 0.082, grip: V(0, -0.03, 0.09), fore: V(0, -0.01, -0.2), pistol: false, side: V(0.02, 0.0, -0.3), under: V(0, -0.021, -0.24) });
}

function buildPump() {               // Model 680 pump shotgun
  const b = new B();
  b.box(0.04, 0.062, 0.22, 0, 0.0, 0.0, M.steel());                             // receiver
  b.tube(0.0125, 0.5, 0, 0.02, -0.36, M.blued());                               // barrel
  b.tube(0.011, 0.42, 0, -0.006, -0.3, M.steel());                              // magazine tube
  b.box(0.012, 0.004, 0.5, 0, 0.0365, -0.34, M.black());                        // vent rib
  ironSights(b, { y: 0.048, zr: 0.08, zf: -0.6, br: 0.031, bf: 0.0385, open: true, bead: true, gap: 0.01 });
  b.tube(0.0145, 0.03, 0, -0.006, -0.52, M.steel());                            // mag cap
  mark(b.box(0.05, 0.048, 0.17, 0, -0.012, -0.25, M.poly()), 'pump');           // pump fore-end
  for (let i = 0; i < 6; i++) mark(b.box(0.054, 0.052, 0.008, 0, -0.012, -0.18 - i * 0.026, M.black()), 'pump');   // grip ridges
  b.box(0.034, 0.075, 0.28, 0, -0.03, 0.25, M.poly(), 0.04);                    // stock
  b.box(0.034, 0.07, 0.07, 0, -0.025, 0.12, M.poly());                          // grip area
  b.box(0.038, 0.1, 0.016, 0, -0.035, 0.395, M.rubber(), 0.04);                 // recoil pad
  b.box(0.002, 0.026, 0.07, 0.0205, 0.012, 0.0, M.black());                     // ejection port
  triggerGroup(b, 0, -0.03, 0.03, 0.06);
  return b.done({ muzzle: V(0, 0.02, -0.615), sightY: 0.048, grip: V(0, -0.045, 0.125), fore: V(0, -0.012, -0.25), pistol: false, side: V(0.026, -0.012, -0.3), mount: V(0, 0.031, 0.0), under: V(0, -0.036, -0.25) });
}

// ------------------------------------------------------------------------------------------------
// PISTOLS
// ------------------------------------------------------------------------------------------------
function buildGlock() {              // G18 (extended mag, compensator cuts)
  const b = new B();
  mark(b.box(0.03, 0.034, 0.195, 0, 0.02, 0, M.blued()), 'slide');              // slide
  for (let i = 0; i < 5; i++) { mark(b.box(0.032, 0.026, 0.004, 0, 0.02, 0.06 + i * 0.01, M.black()), 'slide'); }   // rear serrations
  mark(b.box(0.012, 0.004, 0.03, 0, 0.0375, -0.075, M.black()), 'slide');       // comp cut
  mark(b.box(0.002, 0.012, 0.045, 0.0155, 0.026, 0.0, M.black()), 'slide');     // ejection port
  b.box(0.028, 0.02, 0.15, 0, -0.004, 0.012, M.poly());                         // frame
  b.box(0.02, 0.008, 0.04, 0, -0.02, -0.045, M.poly());                         // rail
  b.box(0.03, 0.09, 0.042, 0, -0.05, 0.062, M.poly(), -0.32);                   // grip
  b.box(0.0305, 0.01, 0.045, 0, -0.1, 0.075, M.black(), -0.32);                 // grip texture band
  mark(b.box(0.024, 0.07, 0.036, 0, -0.14, 0.088, M.black(), -0.32), 'mag');    // extended magazine
  mark(b.box(0.026, 0.008, 0.04, 0, -0.18, 0.1, M.steel(), -0.32), 'mag');
  b.box(0.007, 0.004, 0.058, 0, -0.027, -0.005, M.poly());                      // trigger guard bottom
  b.box(0.007, 0.024, 0.005, 0, -0.016, -0.034, M.poly());                      // trigger guard front
  b.box(0.006, 0.02, 0.008, 0, -0.012, -0.003, M.black(), 0.25);                // trigger
  ironSights(b, { y: 0.0475, zr: 0.088, zf: -0.088, br: 0.037, bf: 0.037, pistol: true, slide: true });
  b.tube(0.0055, 0.008, 0, 0.02, -0.099, M.steel());                            // barrel tip
  return b.done({ muzzle: V(0, 0.022, -0.103), sightY: 0.047, grip: V(0, -0.05, 0.06), fore: V(-0.014, -0.075, 0.05), pistol: true, mount: V(0, 0.037, 0.02), under: V(0, -0.024, -0.05) });
}

function build1911() {
  const b = new B();
  mark(b.box(0.028, 0.034, 0.205, 0, 0.022, 0, M.silver()), 'slide');           // slide
  for (let i = 0; i < 6; i++) mark(b.box(0.03, 0.026, 0.003, 0, 0.022, 0.065 + i * 0.008, M.steel()), 'slide');
  mark(b.tube(0.0095, 0.02, 0, 0.018, -0.108, M.silver()), 'slide');            // barrel bushing
  b.box(0.026, 0.024, 0.19, 0, -0.008, 0.0, M.silver());                        // frame
  b.box(0.03, 0.09, 0.044, 0, -0.058, 0.065, M.silver(), -0.22);                // grip frame
  b.box(0.004, 0.08, 0.04, 0.0165, -0.058, 0.065, M.woodDark(), -0.22);         // grip panels
  b.box(0.004, 0.08, 0.04, -0.0165, -0.058, 0.065, M.woodDark(), -0.22);
  mark(b.box(0.026, 0.01, 0.045, 0, -0.104, 0.078, M.steel(), -0.22), 'mag');   // mag base
  mark(b.box(0.008, 0.024, 0.014, 0, 0.044, 0.1, M.steel(), 0.5), 'hammer');       // hammer
  b.box(0.008, 0.03, 0.02, 0, -0.03, 0.098, M.silver());                        // grip safety
  b.box(0.008, 0.012, 0.03, 0.018, 0.005, 0.07, M.steel());                     // thumb safety
  b.box(0.007, 0.004, 0.062, 0, -0.03, -0.005, M.silver());                     // trigger guard
  b.box(0.007, 0.024, 0.005, 0, -0.018, -0.036, M.silver());
  b.box(0.005, 0.024, 0.007, 0, -0.012, 0.0, M.steel(), 0.15);                  // trigger
  ironSights(b, { y: 0.0485, zr: 0.09, zf: -0.09, br: 0.039, bf: 0.039, pistol: true, slide: true });
  return b.done({ muzzle: V(0, 0.022, -0.118), sightY: 0.048, grip: V(0, -0.055, 0.065), fore: V(-0.014, -0.075, 0.055), pistol: true, mount: V(0, 0.039, 0.03), under: V(0, -0.021, -0.075) });
}

function buildRevolver() {           // .357 Magnum
  const b = new B();
  b.box(0.03, 0.055, 0.1, 0, 0.002, 0.04, M.silver());                          // frame
  b.tube(0.029, 0.058, 0, 0.012, -0.015, M.silver());                           // cylinder
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.box(0.007, 0.012, 0.052, Math.cos(a) * 0.029, 0.012 + Math.sin(a) * 0.029, -0.015, M.steel(), 0, 0, a); }   // flutes
  b.tube(0.0125, 0.16, 0, 0.026, -0.13, M.silver());                            // barrel
  b.box(0.02, 0.022, 0.11, 0, 0.012, -0.13, M.silver());                        // barrel shroud
  b.tube(0.005, 0.1, 0, -0.004, -0.11, M.steel());                              // ejector rod
  ironSights(b, { y: 0.05, zr: 0.085, zf: -0.2, br: 0.0295, bf: 0.0385, pistol: true });
  mark(b.box(0.008, 0.026, 0.014, 0, 0.034, 0.1, M.steel(), 0.5), 'hammer');       // hammer
  b.box(0.032, 0.095, 0.045, 0, -0.065, 0.098, M.wood(), -0.3);                 // grip
  b.box(0.006, 0.01, 0.05, 0, -0.025, 0.04, M.silver());                        // trigger guard bottom
  b.box(0.006, 0.026, 0.005, 0, -0.012, 0.012, M.silver());
  b.box(0.005, 0.02, 0.007, 0, -0.01, 0.045, M.steel(), 0.2);                   // trigger
  return b.done({ muzzle: V(0, 0.026, -0.21), sightY: 0.05, grip: V(0, -0.06, 0.09), fore: V(-0.014, -0.08, 0.08), pistol: true, mount: V(0, 0.0295, 0.05), under: V(0, 0.001, -0.18) });
}

// ------------------------------------------------------------------------------------------------
// Generic fallback (used for the VMP if assets/models/vmp.json can't be loaded)
// ------------------------------------------------------------------------------------------------


// ------------------------------------------------------------------------------------------------
// MORE GUNS (V0.7)
// ------------------------------------------------------------------------------------------------
function buildMp5() {                // MP5-style SMG
  const b = new B();
  b.box(0.046, 0.058, 0.3, 0, 0.012, -0.02, M.blued());                         // receiver
  b.box(0.05, 0.05, 0.17, 0, 0.002, -0.205, M.poly());                          // handguard
  for (let i = 0; i < 4; i++) b.box(0.052, 0.006, 0.012, 0, 0.002, -0.15 - i * 0.034, M.black());
  b.tube(0.011, 0.1, 0, 0.014, -0.34, M.steel());                               // barrel sleeve
  b.tube(0.0145, 0.03, 0, 0.014, -0.4, M.blued());                              // muzzle ring
  mark(b.box(0.032, 0.08, 0.05, 0, -0.075, -0.055, M.black(), 0.06), 'mag');    // curved mag
  mark(b.box(0.032, 0.07, 0.05, 0, -0.14, -0.065, M.black(), 0.2), 'mag');
  b.box(0.03, 0.1, 0.045, 0, -0.07, 0.11, M.poly(), -0.3);                      // grip
  triggerGroup(b, 0, -0.025, 0.02);
  b.box(0.02, 0.014, 0.03, 0.026, 0.02, 0.05, M.steel());                       // selector
  b.box(0.007, 0.007, 0.22, 0.017, 0.012, 0.24, M.steel()); b.box(0.007, 0.007, 0.22, -0.017, 0.012, 0.24, M.steel());   // collapsible wire stock
  b.box(0.04, 0.07, 0.014, 0, 0.005, 0.355, M.rubber());                        // butt pad
  b.box(0.03, 0.012, 0.034, 0, 0.046, 0.12, M.black());                         // charging handle
  ironSights(b, { y: 0.075, zr: 0.06, zf: -0.36, br: 0.041, bf: 0.028, r: 0.0052 });
  return b.done({ muzzle: V(0, 0.014, -0.42), sightY: 0.075, grip: V(0, -0.085, 0.11), fore: V(0, -0.02, -0.205), pistol: false, side: V(0.027, 0.004, -0.2), mount: V(0, 0.0475, 0.0), under: V(0, -0.024, -0.205) });
}

function buildP90() {                // bullpup PDW with a top-mounted mag
  const b = new B();
  b.box(0.056, 0.08, 0.44, 0, -0.01, 0.02, M.poly());                           // body
  b.box(0.05, 0.03, 0.12, 0, -0.065, 0.2, M.poly());                            // thumbhole stock underside
  mark(b.box(0.05, 0.026, 0.3, 0, 0.05, 0.0, M.glass()), 'mag');                // translucent top mag
  mark(b.box(0.052, 0.01, 0.3, 0, 0.065, 0.0, M.black()), 'mag');
  b.tube(0.0105, 0.12, 0, 0.0, -0.27, M.steel());                               // barrel
  b.tube(0.014, 0.03, 0, 0.0, -0.33, M.blued());                                // flash hider
  b.box(0.03, 0.08, 0.03, 0, -0.078, -0.09, M.poly());                          // loop foregrip
  b.box(0.03, 0.03, 0.1, 0, -0.1, -0.05, M.poly());
  b.box(0.034, 0.09, 0.04, 0, -0.08, 0.06, M.poly(), -0.2);                     // rear grip
  triggerGroup(b, 0, -0.04, 0.0, 0.05);
  b.box(0.046, 0.07, 0.014, 0, -0.01, 0.245, M.rubber());                       // butt pad
  ironSights(b, { y: 0.092, zr: 0.1, zf: -0.17, br: 0.066, bf: 0.066, open: true });
  return b.done({ muzzle: V(0, 0.0, -0.345), sightY: 0.092, grip: V(0, -0.08, 0.06), fore: V(0, -0.06, -0.09), pistol: false, side: V(0.029, -0.01, -0.2), mount: V(0, 0.0655, -0.03), under: V(0, -0.115, -0.05) });
}

function buildSuper46() {            // chunky Kriss-style SMG: slab receiver, vented shroud, folding triangle stock
  const b = new B();
  b.box(0.036, 0.058, 0.34, 0, 0.0, 0.0, M.poly());                               // receiver
  b.box(0.032, 0.034, 0.2, 0, -0.045, 0.06, M.poly());                           // lower receiver
  b.box(0.04, 0.05, 0.22, 0, -0.002, -0.27, M.blued());                       // shroud
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box(0.004, 0.028, 0.012, s * 0.0205, -0.002, -0.2 - i * 0.04, M.black(), 0, 0, 0);   // vents
  b.box(0.018, 0.008, 0.46, 0, 0.0395, -0.1, M.black()); railTeeth(b, 0.12, -0.32, 0.0395, 0.018);   // top rail
  b.box(0.022, 0.016, 0.1, 0, -0.034, -0.2, M.poly());                             // under rail block
  b.tube(0.0075, 0.1, 0, 0.0, -0.44, M.steel());                                // barrel
  b.tube(0.0105, 0.06, 0, 0.0, -0.5, M.blued()); b.tube(0.012, 0.012, 0, 0.0, -0.53, M.black());   // muzzle brake
  mark(b.box(0.022, 0.13, 0.036, 0, -0.115, -0.015, M.black(), -0.18), 'mag');    // magazine
  mark(b.box(0.024, 0.012, 0.04, 0, -0.18, -0.03, M.steel(), -0.18), 'mag');
  b.box(0.026, 0.1, 0.034, 0, -0.09, 0.1, M.poly(), 0.28);                       // pistol grip
  triggerGroup(b, 0, -0.04, 0.03);
  b.box(0.016, 0.022, 0.24, 0, 0.012, 0.28, M.blued());                         // stock upper arm
  b.box(0.016, 0.1, 0.018, 0, -0.03, 0.39, M.blued(), -0.5);                     // stock strut
  b.box(0.016, 0.02, 0.2, 0, -0.07, 0.3, M.blued(), -0.12);                    // stock lower arm
  b.box(0.026, 0.11, 0.016, 0, -0.025, 0.4, M.rubber());                        // butt pad
  b.box(0.014, 0.016, 0.05, 0.023, 0.014, 0.02, M.steel());                         // charging handle
  ironSights(b, { y: 0.066, zr: 0.1, zf: -0.32, br: 0.0395, bf: 0.0395, open: true });
  return b.done({ muzzle: V(0, 0.0, -0.545), sightY: 0.066, grip: V(0, -0.085, 0.1), fore: V(0, -0.025, -0.2), pistol: false, side: V(0.022, 0.0, -0.25), mount: V(0, 0.0395, -0.02), under: V(0, -0.044, -0.2) });
}

function buildScar() {               // tan battle rifle
  const b = new B();
  b.box(0.05, 0.062, 0.34, 0, 0.01, 0.0, M.polyTan());                          // upper receiver
  b.box(0.048, 0.05, 0.2, 0, -0.03, 0.04, M.polyTan());                         // lower
  b.box(0.04, 0.045, 0.07, 0, -0.045, -0.07, M.polyTan());                      // magwell
  mark(b.box(0.036, 0.1, 0.06, 0, -0.105, -0.075, M.black(), 0.08), 'mag');     // mag
  mark(b.box(0.038, 0.008, 0.062, 0, -0.158, -0.082, M.steel(), 0.08), 'mag');
  b.box(0.03, 0.1, 0.045, 0, -0.1, 0.12, M.poly(), -0.36);                      // grip
  triggerGroup(b, 0, -0.045, 0.01);
  b.box(0.056, 0.064, 0.27, 0, 0.012, -0.31, M.polyTan());                      // handguard
  for (let i = 0; i < 6; i++) b.box(0.058, 0.01, 0.014, 0, 0.012, -0.22 - i * 0.04, M.black());
  b.box(0.022, 0.008, 0.6, 0, 0.0505, -0.12, M.blued()); railTeeth(b, 0.15, -0.42, 0.0555, 0.022);
  b.tube(0.0095, 0.22, 0, 0.012, -0.55, M.steel());                             // barrel
  b.tube(0.014, 0.06, 0, 0.012, -0.665, M.blued());                             // flash hider
  b.box(0.022, 0.032, 0.032, 0, 0.04, -0.455, M.blued());                       // front sight base
  b.box(0.04, 0.08, 0.2, 0, 0.0, 0.3, M.polyTan(), 0.03);                       // stock
  b.box(0.042, 0.04, 0.12, 0, 0.034, 0.27, M.polyTan());                        // cheek riser
  b.box(0.042, 0.09, 0.014, 0, -0.005, 0.405, M.rubber(), 0.03);
  b.box(0.034, 0.014, 0.034, 0, 0.056, 0.14, M.black());
  ironSights(b, { y: 0.09, zr: 0.12, zf: -0.455, br: 0.0545, bf: 0.056 });
  return b.done({ muzzle: V(0, 0.012, -0.7), sightY: 0.09, grip: V(0, -0.105, 0.115), fore: V(0, -0.015, -0.3), pistol: false, side: V(0.029, 0.012, -0.35), mount: V(0, 0.0625, 0.02), under: V(0, -0.02, -0.3) });
}

function buildLmg() {                // belt-fed light machine gun with bipod
  const b = new B();
  b.box(0.06, 0.08, 0.38, 0, 0.0, 0.0, M.blued());                              // receiver
  b.box(0.058, 0.032, 0.26, 0, 0.056, -0.03, M.steel());                        // feed cover
  b.box(0.05, 0.022, 0.1, 0, 0.074, -0.01, M.black());
  mark(b.box(0.1, 0.095, 0.14, 0, -0.115, -0.04, M.poly()), 'mag');             // ammo box
  mark(b.box(0.03, 0.02, 0.07, 0.045, -0.045, -0.04, M.brass()), 'mag');        // belt
  mark(b.box(0.024, 0.02, 0.06, 0.07, -0.06, -0.04, M.brass()), 'mag');
  b.box(0.034, 0.1, 0.046, 0, -0.085, 0.14, M.poly(), -0.3);                    // grip
  triggerGroup(b, 0, -0.045, 0.1);
  b.box(0.062, 0.062, 0.24, 0, 0.012, -0.32, M.poly());                         // perforated handguard
  for (let i = 0; i < 5; i++) b.box(0.064, 0.014, 0.018, 0, 0.012, -0.24 - i * 0.04, M.black());
  b.tube(0.0125, 0.22, 0, 0.012, -0.55, M.blued());                             // heavy barrel
  b.tube(0.016, 0.06, 0, 0.012, -0.67, M.steel());                              // muzzle device
  b.box(0.012, 0.06, 0.05, 0, 0.07, -0.37, M.blued());                          // carry handle
  b.box(0.02, 0.02, 0.1, 0, 0.1, -0.37, M.blued());
  b.box(0.007, 0.007, 0.22, 0.026, -0.045, -0.45, M.steel(), 0.18);             // folded bipod legs
  b.box(0.007, 0.007, 0.22, -0.026, -0.045, -0.45, M.steel(), 0.18);
  b.box(0.042, 0.09, 0.24, 0, -0.02, 0.32, M.poly(), 0.03);                     // stock
  b.box(0.044, 0.1, 0.014, 0, -0.02, 0.44, M.rubber());
  ironSights(b, { y: 0.108, zr: 0.1, zf: -0.52, br: 0.0735, bf: 0.0185 + 0.02 });
  return b.done({ muzzle: V(0, 0.012, -0.705), sightY: 0.108, grip: V(0, -0.11, 0.14), fore: V(0, -0.03, -0.32), pistol: false, side: V(0.032, 0.012, -0.32), mount: V(0, 0.0805, 0.04), under: V(0, -0.025, -0.32) });
}

function buildDmr() {                // wood-stock marksman rifle with a short scope
  const b = new B();
  b.box(0.046, 0.06, 0.3, 0, 0.0, 0.0, M.steel());                              // receiver
  b.box(0.05, 0.048, 0.26, 0, -0.006, -0.27, M.wood());                         // handguard
  b.box(0.04, 0.02, 0.18, 0, 0.034, -0.28, M.woodDark());                       // top cover
  b.tube(0.0095, 0.34, 0, 0.016, -0.5, M.steel());                              // barrel
  b.tube(0.0135, 0.07, 0, 0.016, -0.7, M.blued());                              // flash hider
  mark(b.box(0.034, 0.1, 0.06, 0, -0.085, -0.03, M.steel(), 0.1), 'mag');       // mag
  mark(b.box(0.036, 0.01, 0.062, 0, -0.14, -0.022, M.black(), 0.1), 'mag');
  b.box(0.032, 0.1, 0.045, 0, -0.095, 0.12, M.woodDark(), -0.3);                // grip
  triggerGroup(b, 0, -0.035, 0.03);
  b.box(0.036, 0.09, 0.28, 0, -0.03, 0.3, M.wood(), 0.04);                      // stock
  b.box(0.036, 0.034, 0.16, 0, 0.034, 0.22, M.wood());                          // cheek rest
  b.box(0.04, 0.11, 0.014, 0, -0.03, 0.455, M.rubber(), 0.05);
  // scope on a side-style mount
  b.box(0.02, 0.026, 0.03, 0, 0.044, -0.03, M.blued()); b.box(0.02, 0.026, 0.03, 0, 0.044, 0.07, M.blued());
  b.tube(0.0165, 0.2, 0, 0.072, 0.02, M.black());
  b.tube(0.022, 0.04, 0, 0.072, -0.1, M.black(), 0.0165);
  b.tube(0.0165, 0.04, 0, 0.072, 0.15, M.black(), 0.02);
  b.tube(0.0205, 0.004, 0, 0.072, -0.122, M.lens()); b.tube(0.018, 0.004, 0, 0.072, 0.172, M.lens());
  b.post(0.008, 0.016, 0, 0.096, 0.02, M.steel());
  return b.done({ muzzle: V(0, 0.016, -0.745), sightY: 0.072, grip: V(0, -0.095, 0.115), fore: V(0, -0.025, -0.28), pistol: false, side: V(0.028, 0.0, -0.3), under: V(0, -0.03, -0.28) });
}

function buildAa12() {               // fully automatic shotgun
  const b = new B();
  b.box(0.058, 0.075, 0.5, 0, 0.0, 0.0, M.blued());                             // body
  b.box(0.02, 0.01, 0.42, 0, 0.0425, -0.02, M.black());                         // top rail
  b.tube(0.02, 0.3, 0, 0.008, -0.4, M.steel());                                 // barrel shroud
  b.tube(0.024, 0.06, 0, 0.008, -0.58, M.blued());                              // muzzle brake
  for (let i = 0; i < 3; i++) b.box(0.05, 0.006, 0.012, 0, 0.008, -0.57 - i * 0.015, M.black());
  mark(b.box(0.05, 0.12, 0.09, 0, -0.1, -0.03, M.black(), 0.04), 'mag');        // box magazine
  mark(b.box(0.052, 0.008, 0.092, 0, -0.16, -0.025, M.steel(), 0.04), 'mag');
  b.box(0.03, 0.09, 0.036, 0, -0.07, -0.2, M.poly());                           // front handle
  b.box(0.034, 0.1, 0.046, 0, -0.08, 0.14, M.poly(), -0.3);                     // rear grip
  triggerGroup(b, 0, -0.04, 0.1, 0.06);
  b.box(0.044, 0.08, 0.2, 0, -0.01, 0.35, M.poly(), 0.03);                      // stock
  b.box(0.046, 0.09, 0.014, 0, -0.012, 0.455, M.rubber());
  b.box(0.034, 0.014, 0.034, 0, 0.056, 0.15, M.black());
  ironSights(b, { y: 0.075, zr: 0.12, zf: -0.5, br: 0.0475, bf: 0.028 });
  return b.done({ muzzle: V(0, 0.008, -0.62), sightY: 0.075, grip: V(0, -0.085, 0.135), fore: V(0, -0.03, -0.2), pistol: false, side: V(0.03, 0.008, -0.3), mount: V(0, 0.048, 0.02), under: V(0, -0.03, -0.3) });
}

function buildDeagle() {             // hand cannon
  const b = new B();
  mark(b.box(0.034, 0.042, 0.27, 0, 0.025, -0.02, M.silver()), 'slide');        // slide
  for (let i = 0; i < 6; i++) mark(b.box(0.036, 0.034, 0.004, 0, 0.026, 0.085 + i * 0.01, M.steel()), 'slide');
  mark(b.box(0.002, 0.014, 0.05, 0.018, 0.028, 0.0, M.black()), 'slide');       // ejection port
  b.box(0.03, 0.03, 0.22, 0, -0.008, -0.01, M.blued());                         // frame
  b.box(0.018, 0.012, 0.09, 0, -0.026, -0.08, M.blued());                       // rail
  b.box(0.034, 0.1, 0.05, 0, -0.062, 0.08, M.poly(), -0.22);                    // grip
  b.box(0.0045, 0.09, 0.046, 0.019, -0.062, 0.08, M.woodDark(), -0.22); b.box(0.0045, 0.09, 0.046, -0.019, -0.062, 0.08, M.woodDark(), -0.22);
  mark(b.box(0.03, 0.01, 0.05, 0, -0.116, 0.092, M.steel(), -0.22), 'mag');
  b.box(0.007, 0.004, 0.07, 0, -0.03, 0.0, M.blued());                          // trigger guard
  b.box(0.007, 0.026, 0.005, 0, -0.018, -0.034, M.blued());
  b.box(0.006, 0.022, 0.008, 0, -0.012, 0.0, M.steel(), 0.2);
  ironSights(b, { y: 0.0565, zr: 0.115, zf: -0.13, br: 0.046, bf: 0.046, pistol: true, slide: true });
  return b.done({ muzzle: V(0, 0.025, -0.16), sightY: 0.0565, grip: V(0, -0.06, 0.075), fore: V(-0.014, -0.085, 0.065), pistol: true, mount: V(0, 0.0495, 0.05), under: V(0, -0.032, -0.09) });
}

function buildSkorp() {              // machine pistol
  const b = new B();
  mark(b.box(0.03, 0.042, 0.2, 0, 0.016, -0.005, M.blued()), 'slide');          // top cover
  for (let i = 0; i < 4; i++) mark(b.box(0.032, 0.03, 0.004, 0, 0.016, 0.06 + i * 0.009, M.black()), 'slide');
  b.box(0.028, 0.034, 0.17, 0, -0.012, -0.005, M.poly());                       // frame
  b.tube(0.0065, 0.05, 0, 0.016, -0.125, M.steel());                            // barrel
  mark(b.box(0.026, 0.1, 0.034, 0, -0.09, -0.012, M.black(), 0.02), 'mag');     // straight mag
  b.box(0.03, 0.085, 0.042, 0, -0.06, 0.07, M.poly(), -0.25);                   // grip
  b.box(0.007, 0.004, 0.06, 0, -0.03, 0.03, M.poly());
  b.box(0.007, 0.022, 0.005, 0, -0.018, 0.0, M.poly());
  b.box(0.006, 0.02, 0.008, 0, -0.012, 0.03, M.steel(), 0.2);
  b.box(0.006, 0.006, 0.17, 0, 0.046, 0.08, M.steel());                         // folded wire stock
  ironSights(b, { y: 0.0525, zr: 0.08, zf: -0.095, br: 0.037, bf: 0.037, pistol: true, slide: true });
  return b.done({ muzzle: V(0, 0.016, -0.155), sightY: 0.0525, grip: V(0, -0.055, 0.065), fore: V(-0.014, -0.075, 0.055), pistol: true, mount: V(0, 0.0395, 0.03), under: V(0, -0.028, -0.06) });
}


// ------------------------------------------------------------------------------------------------
// Knives: blade points along -Z, the hand grips the handle at `grip`
// ------------------------------------------------------------------------------------------------
const kdone = (b, grip, tip) => b.done({ muzzle: V(0, 0, tip), sightY: 0.07, grip, fore: V(0, -0.03, -0.05), pistol: true, mount: V(0, 0.03, 0), under: V(0, -0.03, 0), side: V(0.03, 0, 0) });
// a blade is a real outline (pairs of [z, y] in gun space, -z = toward the tip) extruded thin with a chamfered edge; falls back to a plain slab if shapes are unavailable
function blade(b, pts, th, m, x = 0) {
  if (!THREE.Shape || !THREE.ExtrudeGeometry) { const zs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), z0 = Math.min(...zs), z1 = Math.max(...zs), y0 = Math.min(...ys), y1 = Math.max(...ys); return b.box(th, y1 - y0, z1 - z0, x, (y0 + y1) / 2, (z0 + z1) / 2, m); }
  const s = new THREE.Shape(); pts.forEach((p, k) => { if (k) s.lineTo(-p[0], p[1]); else s.moveTo(-p[0], p[1]); });
  const bv = Math.min(0.0014, th * 0.3), geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0008, th - bv * 2), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.9, bevelSegments: 1, curveSegments: 4 });
  geo.translate(0, 0, -(th - bv * 2) / 2);
  return b._add(geo, m, x, 0, 0, 0, Math.PI / 2, 0);
}
const arc = (cz, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / n; return [cz - r * Math.sin(a), cy - r * (1 - Math.cos(a))]; });
const fuller = (b, z0, z1, y, x = 0.0035, th = 0.0012) => { b.box(th, 0.005, z1 - z0, x, y, (z0 + z1) / 2, mat(0x5a626b, 0.9, 0.3)); b.box(th, 0.005, z1 - z0, -x, y, (z0 + z1) / 2, mat(0x5a626b, 0.9, 0.3)); };

function buildKCombat() {                                      // tactical drop-point fighting knife
  const b = new B();
  b.box(0.028, 0.034, 0.118, 0, -0.006, 0.004, M.black());                                  // contoured handle
  for (let i = 0; i < 4; i++) b.box(0.03, 0.012, 0.014, 0, -0.026, -0.036 + i * 0.026, M.blued());   // finger grooves
  b.box(0.026, 0.006, 0.12, 0, 0.0155, 0.004, M.blued());                                   // spine plate
  b.ball(0.0185, 0, -0.006, 0.066, M.steel());                                              // pommel
  b.box(0.012, 0.064, 0.012, 0, 0.0, -0.066, M.steel());                                    // cross guard
  blade(b, [[-0.07, 0.022], [-0.2, 0.027], [-0.262, 0.016], [-0.298, -0.002], [-0.262, -0.014], [-0.2, -0.026], [-0.07, -0.022]], 0.0068, M.silver());
  fuller(b, -0.09, -0.21, 0.012);
  for (let i = 0; i < 6; i++) b.box(0.0075, 0.005, 0.01, 0, -0.019, -0.1 - i * 0.017, M.black());   // choil teeth
  return kdone(b, V(0, -0.004, 0.0), -0.3);
}
function buildKKarambit() {                                    // hooked claw blade growing out of the front of the handle, finger ring at the back
  const b = new B();
  b.box(0.026, 0.034, 0.104, 0, -0.006, 0.0, M.poly());                                     // handle
  for (let i = 0; i < 5; i++) b.box(0.0285, 0.036, 0.007, 0, -0.006, -0.036 + i * 0.019, M.black());   // grip rings
  b.box(0.0285, 0.012, 0.016, 0, 0.0165, -0.046, M.steel());                                 // front bolster
  b.box(0.0285, 0.012, 0.016, 0, -0.0285, -0.046, M.steel());
  b._add(new THREE.TorusGeometry(0.024, 0.0058, 8, 22), M.steel(), 0, -0.014, 0.082, 0, Math.PI / 2, 0);   // finger ring
  // blade: spine follows an arc that curls down and forward; the cutting edge is the spine pulled in by a width that tapers to the tip
  const z0 = -0.052, y0 = 0.011, R = 0.125, aEnd = 1.38, N = 16, spine = [], edge = [];
  for (let k = 0; k <= N; k++) {
    const a = aEnd * k / N, sz = z0 - R * Math.sin(a), sy = y0 - R * (1 - Math.cos(a)), nz = -(-Math.sin(a)) * 0, w = 0.046 * Math.pow(1 - Math.pow(k / N, 1.5), 0.9) + 0.0015;
    const cz = z0, cy = y0 - R, dz = (cz - sz) / R, dy = (cy - sy) / R;                       // unit vector from the spine towards the arc centre
    spine.push([sz, sy]); edge.push([sz + dz * w, sy + dy * w]); void nz;
  }
  blade(b, [...spine, ...edge.reverse()], 0.0072, M.silver());
  for (let k = 3; k < 12; k += 2) { const p = spine[k]; b.box(0.0078, 0.004, 0.006, 0, p[1] - 0.0008, p[0], M.steel(), 0.0); }   // jimping on the spine
  return kdone(b, V(0, -0.006, 0.0), -0.2);
}
function buildKBalisong() {                                    // butterfly knife with the blade flipped out
  const b = new B();
  for (const s of [-1, 1]) { b.box(0.011, 0.036, 0.126, s * 0.0108, -0.004, 0.02, M.blued()); b.box(0.004, 0.028, 0.104, s * 0.0168, -0.004, 0.02, M.black());
    for (let i = 0; i < 4; i++) b.box(0.0046, 0.012, 0.008, s * 0.0168, -0.004, -0.016 + i * 0.024, M.steel()); }          // two handle halves with grip inserts
  for (const z of [-0.04, 0.078]) b.rod(0.0082, 0.044, 0, -0.004, z, M.steel());             // pivot pins
  b.box(0.014, 0.03, 0.018, 0, -0.004, -0.036, M.steel());                                    // latch
  blade(b, [[-0.046, 0.016], [-0.18, 0.02], [-0.25, 0.013], [-0.292, -0.002], [-0.24, -0.015], [-0.18, -0.018], [-0.046, -0.016]], 0.0052, M.silver());
  fuller(b, -0.07, -0.16, 0.002, 0.0028);
  b.box(0.0056, 0.008, 0.07, 0, 0.018, -0.12, mat(0x252a30, 0.9, 0.35));                     // dark spine
  b.box(0.006, 0.01, 0.02, 0, -0.016, -0.052, M.steel());                                     // kicker
  return kdone(b, V(0, -0.004, 0.02), -0.29);
}
function buildKMachete() {                                     // long cleaver-belly machete
  const b = new B();
  b.box(0.028, 0.036, 0.128, 0, -0.004, 0.0, M.wood());                                       // wooden scales
  for (const z of [-0.04, 0.0, 0.04]) b.rod(0.0044, 0.036, 0, -0.004, z, M.steel());          // rivets
  b.box(0.012, 0.044, 0.012, 0, 0.004, -0.07, M.steel());                                      // guard
  b.box(0.006, 0.01, 0.028, 0, -0.024, 0.075, M.steel());                                      // lanyard hole boss
  blade(b, [[-0.074, 0.02], [-0.2, 0.03], [-0.36, 0.042], [-0.46, 0.046], [-0.5, 0.034], [-0.5, 0.012], [-0.44, -0.03], [-0.32, -0.052], [-0.2, -0.05], [-0.074, -0.02]], 0.0062, M.silver());
  fuller(b, -0.1, -0.4, 0.016, 0.0034);
  b.box(0.0068, 0.007, 0.4, 0, 0.0445, -0.28, M.steel());                                      // spine
  return kdone(b, V(0, -0.004, 0.0), -0.5);
}
function buildKTomahawk() {                                    // tactical axe: bearded bit up front, spike on the back
  const b = new B();
  b.box(0.028, 0.032, 0.42, 0, -0.004, -0.04, M.wood());                                      // shaft
  b.box(0.032, 0.036, 0.11, 0, -0.004, 0.1, M.black());                                       // grip wrap
  for (let i = 0; i < 5; i++) b.box(0.034, 0.038, 0.005, 0, -0.004, 0.058 + i * 0.022, M.blued());
  b.box(0.034, 0.016, 0.03, 0, -0.004, 0.158, M.blued());                                     // butt flare
  b.box(0.02, 0.05, 0.07, 0, 0.012, -0.235, M.steel());                                       // eye / socket
  blade(b, [[-0.215, 0.036], [-0.25, 0.06], [-0.285, 0.088], [-0.31, 0.064], [-0.3, 0.02], [-0.31, -0.04], [-0.285, -0.074], [-0.25, -0.052], [-0.215, -0.018]], 0.011, M.silver());
  blade(b, [[-0.215, 0.026], [-0.15, 0.0], [-0.215, -0.004]], 0.011, M.steel());              // back spike
  fuller(b, -0.25, -0.3, 0.016, 0.0058, 0.0014);
  return kdone(b, V(0, -0.004, 0.065), -0.34);
}
const BUILDERS = { ak: buildAK, bolt: buildBolt, pump: buildPump, glock: buildGlock, m1911: build1911, revolver: buildRevolver,
  mp5: buildMp5, p90: buildP90, scar: buildScar, super46: buildSuper46, lmg: buildLmg, dmr: buildDmr, aa12: buildAa12, deagle: buildDeagle, skorp: buildSkorp, k_combat: buildKCombat, k_karambit: buildKKarambit, k_balisong: buildKBalisong, k_machete: buildKMachete, k_tomahawk: buildKTomahawk,
  goldgun: () => { const g = buildDeagle(), gold = mat(0xffd24a, 1, 0.16, { emissive: 0x3a2400, emissiveIntensity: 0.35 }); g.traverse((o) => { if (o.isMesh && !(o.userData && o.userData.iron)) o.material = gold; }); return g; } };

// ------------------------------------------------------------------------------------------------
// Baked model (FBX -> JSON)
// ------------------------------------------------------------------------------------------------
// planar UVs from position + dominant normal (metres * 18): the baked models carry none, and the grain bump needs some
function boxUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal; if (!p || geo.attributes.uv || !THREE.BufferAttribute) return;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n ? Math.abs(n.getX(i)) : 0, ny = n ? Math.abs(n.getY(i)) : 1, nz = n ? Math.abs(n.getZ(i)) : 0;
    if (nx >= ny && nx >= nz) { uv[i * 2] = z * 18; uv[i * 2 + 1] = y * 18; } else if (ny >= nz) { uv[i * 2] = z * 18; uv[i * 2 + 1] = x * 18; } else { uv[i * 2] = x * 18; uv[i * 2 + 1] = y * 18; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
// the same machined-metal / polymer look as the procedural guns, chosen from the colour of each baked part (the shapes are never touched)
function bakedMat(color, name) {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255, lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
  if (name === 'iron') return gmat(0x1d1f22, 0.7, 0.4, 0.3);
  if (lum > 0.26) return gmat(Math.min(0xffffff, color + 0x0d0f12), 0.88, 0.34, 0.3);            // bare / blued metal
  if (lum > 0.12) return gmat(color + 0x050607, 0.75, 0.4, 0.3);                                 // dark steel
  return gmat(color + 0x080808, 0.12, 0.62, 0.6);                                                // polymer
}
function buildFromAsset(w, data) {
  const g = new THREE.Group(), a = w.asset;
  data.parts.forEach((part) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(part.positions), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(part.normals), 3));
    geo.setIndex(part.indices);
    try { boxUV(geo); } catch (e) { /* stub three: no uv needed */ }
    const color = parseInt(part.color.slice(1), 16), tris = part.indices.length / 3;
    const base = bakedMat(color, part.name), me = new THREE.Mesh(geo, base);
    if (/^mag$/i.test(part.name || '')) me.userData.mag = true;
    else if (part.name !== 'iron' && (/^(body|rail|grip|stock)$/i.test(part.name || '') || (!part.name || part.name === 'part') && tris >= 90)) me.userData.camoPart = true;   // the big parts take a camo
    if (part.name === 'iron') me.userData.iron = true;            // the model's own iron sights (hidden when a red dot is fitted)
    g.add(me);
  });
  const anc = data.anchors || {};
  const p = (name, off = [0, 0, 0]) => { const c = anc[name] || [0, -0.05, 0]; return V(c[0] + off[0], c[1] + off[1], c[2] + off[2]); };
  g.userData = {
    muzzle: V(...data.muzzle), sightY: (data.sights || a.ownSights) ? data.sightY : 0.092,
    grip: p(a.grip, a.gripOffset), fore: p(a.fore, a.foreOffset), pistol: false,
    mount: V(...(a.mount || [0, data.sightY - 0.008, 0])), under: V(...(a.under || [0, -0.05, -0.1])), side: V(...(a.side || [0.025, -0.02, -0.2])),
  };
  if (!data.sights && !a.ownSights) { const bb = new B(); bb.g = g; const sg = a.sights || { zr: 0.11, zf: -0.2, br: 0.073, bf: 0.073 }; ironSights(bb, { y: 0.092, ...sg }); }   // the VMP model has no sights of its own; the Super 46 brings its own
  return g;
}


// ------------------------------------------------------------------------------------------------
// Camos: procedural textures painted onto the receiver / furniture (the parts whose material is flagged `camo`).
// The pattern is projected in the gun's own space (triplanar), so it flows over every part without stretching.
// ------------------------------------------------------------------------------------------------
const CS = 512;
const seeded = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const canvasOf = () => { if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = c.height = CS; const g = c.getContext('2d'); return g ? [c, g] : null; };
const wrapped = (g, fn) => { for (const dx of [-CS, 0, CS]) for (const dy of [-CS, 0, CS]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };   // draw at the 9 neighbouring offsets so the tile repeats seamlessly
function blobs(g, rnd, color, n, r0, r1) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = rnd() * CS, y = rnd() * CS, r = r0 + rnd() * (r1 - r0), k = 5 + Math.floor(rnd() * 4), rot = rnd() * 6.28;
    wrapped(g, () => { for (let j = 0; j < k; j++) { const a = rot + (j / k) * 6.28 + rnd() * 0.8, d = r * (0.2 + rnd() * 0.55); g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.45 + rnd() * 0.4), r * (0.3 + rnd() * 0.35), rnd() * 3.14, 0, 6.28); g.fill(); } });
  }
}
function tnoise(rnd, P) {                                    // tileable value noise with period P cells
  const L = new Float32Array(P * P).map(() => rnd()), at = (x, y) => L[((y % P) + P) % P * P + ((x % P) + P) % P];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy; };
}
function digital(g, rnd, pal, cell) {
  const P = CS / cell, n1 = tnoise(rnd, 8), n2 = tnoise(rnd, 16);
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
    const v = n1(x / P * 8, y / P * 8) * 0.65 + n2(x / P * 16, y / P * 16) * 0.35 + (rnd() - 0.5) * 0.12;
    g.fillStyle = pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length * 1.05 - 0.02)))]; g.fillRect(x * cell, y * cell, cell, cell);
  }
}
function stripes(g, rnd, color, n, w0, len0) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = rnd() * CS, y = rnd() * CS, len = len0 * (0.7 + rnd() * 0.7), w = w0 * (0.6 + rnd() * 0.8), ang = -1.05 + (rnd() - 0.5) * 0.5, bend = (rnd() - 0.5) * 1.6, pts = [], pts2 = [];
    for (let k = 0; k <= 14; k++) { const t = k / 14, a = ang + bend * t * t, px = x + Math.cos(a) * len * t, py = y + Math.sin(a) * len * t, ww = Math.sin(Math.PI * Math.pow(t, 0.8)) * w * (1 + 0.25 * Math.sin(t * 9 + i)); const nx = -Math.sin(a), ny = Math.cos(a); pts.push([px + nx * ww, py + ny * ww]); pts2.push([px - nx * ww, py - ny * ww]); }
    wrapped(g, () => { g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let k = pts2.length - 1; k >= 0; k--) g.lineTo(pts2[k][0], pts2[k][1]); g.closePath(); g.fill(); });
  }
}
function veins(g, rnd, colors, n) {
  for (let i = 0; i < n; i++) {
    let x = rnd() * CS, y = rnd() * CS, a = rnd() * 6.28; const col = colors[i % colors.length], w = 1 + rnd() * 2.2, steps = 40 + Math.floor(rnd() * 60), pts = [[x, y]];
    for (let k = 0; k < steps; k++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; pts.push([x, y]); }
    wrapped(g, () => { g.strokeStyle = col; g.lineWidth = w; g.shadowColor = col; g.shadowBlur = 8; g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); });
  }
  g.shadowBlur = 0;
}
// each painter returns [colour canvas, optional emissive canvas]
const CAMO_PAINT = {
  1: () => { const [c, g] = canvasOf(), r = seeded(11); g.fillStyle = '#4a5a2a'; g.fillRect(0, 0, CS, CS); blobs(g, r, '#6d5c30', 9, 70, 120); blobs(g, r, '#2c3a1b', 10, 60, 110); blobs(g, r, '#8a9a55', 7, 40, 80); blobs(g, r, '#1c2512', 14, 16, 34); return [c]; },
  2: () => { const [c, g] = canvasOf(), r = seeded(22); g.fillStyle = '#c9a977'; g.fillRect(0, 0, CS, CS); blobs(g, r, '#a88655', 10, 70, 120); blobs(g, r, '#e5d3a2', 9, 55, 100); blobs(g, r, '#7c6241', 8, 40, 80); blobs(g, r, '#5a452c', 12, 14, 30); return [c]; },
  3: () => { const [c, g] = canvasOf(), r = seeded(33); g.fillStyle = '#e7eef3'; g.fillRect(0, 0, CS, CS); blobs(g, r, '#b4c1d0', 10, 60, 110); blobs(g, r, '#d3dde6', 9, 55, 100); blobs(g, r, '#8496ad', 8, 36, 72); blobs(g, r, '#5b6b82', 10, 12, 26); return [c]; },
  4: () => { const [c, g] = canvasOf(), r = seeded(44); digital(g, r, ['#1f2329', '#323840', '#4d545e', '#78808b', '#a3abb5'], 16); return [c]; },
  5: () => { const [c, g] = canvasOf(), r = seeded(55); g.fillStyle = '#c4621a'; g.fillRect(0, 0, CS, CS); blobs(g, r, '#e59a3c', 14, 50, 90); stripes(g, r, '#5a2a0c', 16, 11, 150); stripes(g, r, '#0b0705', 22, 9, 170); return [c]; },
  6: () => { const [c, g] = canvasOf(), r = seeded(66); g.fillStyle = '#1e5cae'; g.fillRect(0, 0, CS, CS); blobs(g, r, '#5aa6ec', 14, 50, 90); stripes(g, r, '#0f3270', 16, 11, 150); stripes(g, r, '#040d22', 22, 9, 170); return [c]; },
  7: () => { const [c, g] = canvasOf(), r = seeded(77); digital(g, r, ['#12080a', '#3a0d12', '#7a1219', '#b8171f', '#ec3a40'], 14); return [c]; },
  8: () => { const [c, g] = canvasOf(), r = seeded(88); const gr = g.createLinearGradient(0, 0, CS, CS); gr.addColorStop(0, '#c99524'); gr.addColorStop(0.5, '#f1c552'); gr.addColorStop(1, '#b07c16'); g.fillStyle = gr; g.fillRect(0, 0, CS, CS);
    for (let i = 0; i < 500; i++) { const y = r() * CS, x = r() * CS, l = 40 + r() * 160; g.fillStyle = r() > 0.5 ? 'rgba(255,240,170,0.10)' : 'rgba(120,80,10,0.12)'; wrapped(g, () => g.fillRect(x, y, l, 1 + r() * 1.5)); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,236,150,${0.05 + r() * 0.12})`; g.fillRect(r() * CS, r() * CS, 2, 2); } return [c]; },
  9: () => { const [c, g] = canvasOf(), r = seeded(99), N = 8, cell = CS / N, pts = []; for (let y = 0; y < N; y++) { pts[y] = []; for (let x = 0; x < N; x++) pts[y][x] = [(x + 0.5 + (r() - 0.5) * 0.8) * cell, (y + 0.5 + (r() - 0.5) * 0.8) * cell]; }
    const P = (x, y) => { const p = pts[((y % N) + N) % N][((x % N) + N) % N]; return [p[0] + Math.floor(x / N) * CS, p[1] + Math.floor(y / N) * CS]; };
    for (let y = -1; y < N; y++) for (let x = -1; x < N; x++) for (const tri of [[[x, y], [x + 1, y], [x, y + 1]], [[x + 1, y], [x + 1, y + 1], [x, y + 1]]]) {
      const t = r(), l = 48 + t * 38; g.fillStyle = `hsl(${196 + (r() - 0.5) * 22},${70 + t * 25}%,${l}%)`; g.beginPath(); tri.forEach(([a, b], k) => { const p = P(a, b); if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.stroke(); }
    for (let i = 0; i < 26; i++) { const x = r() * CS, y = r() * CS, s = 3 + r() * 6; g.fillStyle = 'rgba(255,255,255,0.9)'; wrapped(g, () => { g.fillRect(x - s, y - 0.7, s * 2, 1.4); g.fillRect(x - 0.7, y - s, 1.4, s * 2); }); } return [c]; },
  10: () => { const [c, g] = canvasOf(), [e, ge] = canvasOf(), r = seeded(101); g.fillStyle = '#07070b'; g.fillRect(0, 0, CS, CS); ge.fillStyle = '#000'; ge.fillRect(0, 0, CS, CS);
    const lg = g.createRadialGradient(CS * 0.3, CS * 0.3, 10, CS * 0.3, CS * 0.3, CS * 0.7); lg.addColorStop(0, 'rgba(60,30,110,0.35)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lg; g.fillRect(0, 0, CS, CS);
    veins(g, seeded(5), ['#8a4bff', '#3fd0ff', '#b46bff'], 26); veins(ge, seeded(5), ['#8a4bff', '#3fd0ff', '#b46bff'], 26); return [c, e]; },
  11: () => { const [c, g] = canvasOf(), [e, ge] = canvasOf(), r = seeded(111); const bg = g.createLinearGradient(0, 0, 0, CS); bg.addColorStop(0, '#080820'); bg.addColorStop(1, '#190a36'); g.fillStyle = bg; g.fillRect(0, 0, CS, CS); ge.fillStyle = '#000'; ge.fillRect(0, 0, CS, CS);
    for (const [col, n] of [['120,60,220', 7], ['40,90,230', 6], ['220,60,150', 5]]) for (let i = 0; i < n; i++) { const x = r() * CS, y = r() * CS, rad = 70 + r() * 110; wrapped(g, () => { const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, `rgba(${col},0.55)`); rg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }); wrapped(ge, () => { const rg = ge.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, `rgba(${col},0.22)`); rg.addColorStop(1, `rgba(${col},0)`); ge.fillStyle = rg; ge.fillRect(x - rad, y - rad, rad * 2, rad * 2); }); }
    for (let i = 0; i < 380; i++) { const x = r() * CS, y = r() * CS, s = r() < 0.07 ? 2.6 : 1.1, a = 0.4 + r() * 0.6; for (const q of [g, ge]) { q.fillStyle = `rgba(255,255,255,${a})`; q.fillRect(x, y, s, s); } } return [c, e]; },
};
CAMO_PAINT[12] = () => { const [c, g] = canvasOf(), r = seeded(121); g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, CS, CS); const T = 16;      // carbon-fibre twill
  for (let y = 0; y < CS / T; y++) for (let x = 0; x < CS / T; x++) { const up = ((x + y) >> 1) % 2 === 0, gr = g.createLinearGradient(x * T, y * T, (x + 1) * T, (y + 1) * T); gr.addColorStop(0, up ? '#3b3f46' : '#15171a'); gr.addColorStop(0.5, up ? '#1c1e22' : '#2e3238'); gr.addColorStop(1, up ? '#0d0e10' : '#111316'); g.fillStyle = gr; g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2); }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.06})`; g.fillRect(r() * CS, r() * CS, 1, 6); } return [c]; };
CAMO_PAINT[13] = () => { const [c, g] = canvasOf(), [e, ge] = canvasOf(); const bg = g.createLinearGradient(0, 0, 0, CS); bg.addColorStop(0, '#06051a'); bg.addColorStop(1, '#14052e'); g.fillStyle = bg; g.fillRect(0, 0, CS, CS); ge.fillStyle = '#000'; ge.fillRect(0, 0, CS, CS);   // neon grid
  for (const q of [g, ge]) for (let i = 0; i <= 8; i++) { const p = i * 64, hot = i % 4 === 0; q.strokeStyle = hot ? '#ff2fd0' : '#18e6ff'; q.lineWidth = hot ? 4 : 2; q.shadowColor = q.strokeStyle; q.shadowBlur = 10; q.beginPath(); q.moveTo(p, 0); q.lineTo(p, CS); q.moveTo(0, p); q.lineTo(CS, p); q.stroke(); }
  for (const q of [g, ge]) { q.shadowBlur = 0; q.fillStyle = '#fff'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j += 4) q.fillRect(i * 64 - 3, j * 64 - 3, 6, 6); } return [c, e]; };
CAMO_PAINT[14] = () => { const [c, g] = canvasOf(), [e, ge] = canvasOf(), r = seeded(141); g.fillStyle = '#0c1a08'; g.fillRect(0, 0, CS, CS); ge.fillStyle = '#000'; ge.fillRect(0, 0, CS, CS);   // toxic acid
  blobs(g, r, '#1d4a10', 12, 50, 100); blobs(g, r, '#4fc21a', 10, 34, 70); blobs(g, r, '#c6ff3a', 9, 14, 34);
  for (let i = 0; i < 70; i++) { const x = r() * CS, y = r() * CS, rad = 3 + r() * 11; for (const [q, a] of [[g, 0.5], [ge, 0.7]]) wrapped(q, () => { q.strokeStyle = `rgba(190,255,70,${a})`; q.lineWidth = 2; q.fillStyle = 'rgba(120,255,40,0.18)'; q.beginPath(); q.arc(x, y, rad, 0, 6.28); q.fill(); q.stroke(); }); }
  blobs(ge, r, 'rgba(120,255,30,0.35)', 10, 20, 50); return [c, e]; };
CAMO_PAINT[15] = () => { const [c, g] = canvasOf(), [e, ge] = canvasOf(), r = seeded(151); g.fillStyle = '#120807'; g.fillRect(0, 0, CS, CS); ge.fillStyle = '#000'; ge.fillRect(0, 0, CS, CS);   // magma cracks
  blobs(g, r, '#2a1411', 16, 40, 90); blobs(g, r, '#0a0505', 12, 30, 70);
  veins(g, seeded(9), ['#ff5a0a', '#ffb02a', '#ff2a00'], 34); veins(ge, seeded(9), ['#ff5a0a', '#ffb02a', '#ff2a00'], 34);
  veins(ge, seeded(19), ['#ff7a1a'], 20); return [c, e]; };
CAMO_PAINT[16] = () => { const [c, g] = canvasOf(), r = seeded(161); const gr = g.createLinearGradient(0, 0, CS, CS); ['#ff3b6b', '#ffb02a', '#d8ff3a', '#2affb0', '#2ab4ff', '#9a4bff', '#ff3b6b'].forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col)); g.fillStyle = gr; g.fillRect(0, 0, CS, CS);   // holo prism (hue-shifts live)
  for (let i = 0; i < 40; i++) { const x = r() * CS, w = 4 + r() * 22; g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'; wrapped(g, () => { g.save(); g.translate(x, 0); g.rotate(0.6); g.fillRect(-w / 2, -CS, w, CS * 3); g.restore(); }); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; g.fillRect(r() * CS, r() * CS, 2, 2); } return [c]; };
CAMO_PAINT[17] = () => { const [c, g] = canvasOf(); const R = 32, H = 28; g.fillStyle = '#04140c'; g.fillRect(0, 0, CS, CS);                    // dragon scales
  for (let row = -1; row < CS / H + 2; row++) for (let col = -1; col < CS / (R * 2) + 2; col++) { const x = col * R * 2 + (row % 2 ? R : 0), y = row * H, gr = g.createRadialGradient(x, y - R * 0.3, 2, x, y, R); gr.addColorStop(0, '#d9ff9a'); gr.addColorStop(0.35, '#2fbf5a'); gr.addColorStop(0.8, '#0b5a2e'); gr.addColorStop(1, '#03180d'); g.fillStyle = gr; g.strokeStyle = 'rgba(255,214,90,0.7)'; g.lineWidth = 1.5;
    for (const dx of [-CS, 0, CS]) for (const dy of [-CS, 0, CS]) { g.beginPath(); g.arc(x + dx, y + dy, R - 1, 0, Math.PI); g.fill(); g.stroke(); } } return [c]; };
// look per camo: metalness / roughness / env reflection / clearcoat; `em` glows, `pulse` breathes, `hue` shifts colour over time
const CAMO_LOOK = {
  1: { m: 0.12, r: 0.6, env: 0.8, cc: 0.35 }, 2: { m: 0.12, r: 0.6, env: 0.8, cc: 0.35 }, 3: { m: 0.12, r: 0.55, env: 0.9, cc: 0.4 }, 4: { m: 0.15, r: 0.5, env: 0.9, cc: 0.45 },
  5: { m: 0.2, r: 0.4, env: 1.1, cc: 0.7 }, 6: { m: 0.2, r: 0.4, env: 1.1, cc: 0.7 }, 7: { m: 0.25, r: 0.38, env: 1.1, cc: 0.7 },
  8: { m: 1.0, r: 0.2, env: 1.7, cc: 0.5, deep: 0.35, sweep: 1, rim: [1, 0.8, 0.3] }, 9: { m: 0.9, r: 0.1, env: 1.8, cc: 1.0, flake: 1, deep: 0.6, sweep: 1, rim: [0.6, 0.9, 1] }, 10: { m: 0.6, r: 0.12, env: 1.5, cc: 1.0, em: 1.9, pulse: 1, deep: 0.7, rim: [0.5, 0.2, 1], flow: [0.0, 0.02, 0.04] }, 11: { m: 0.5, r: 0.2, env: 1.2, cc: 1.0, em: 1.5, pulse: 1, deep: 1.0, rim: [0.4, 0.6, 1], flow: [0.02, 0.0, 0.03] },
  12: { m: 0.35, r: 0.28, env: 1.3, cc: 1.0 }, 13: { m: 0.3, r: 0.3, env: 1.0, cc: 0.6, em: 2.2, pulse: 1, deep: 0.8, rim: [0.1, 1, 0.9], flow: [0.0, 0.0, 0.08] }, 14: { m: 0.3, r: 0.3, env: 1.0, cc: 0.9, em: 1.7, pulse: 1 }, 15: { m: 0.3, r: 0.45, env: 0.9, cc: 0.4, em: 2.4, pulse: 1, deep: 0.9, rim: [1, 0.35, 0.05], flow: [0.0, -0.06, 0.02] },
  16: { m: 1.0, r: 0.14, env: 1.9, cc: 1.0, hue: 1, deep: 0.6, sweep: 1, rim: [0.8, 0.5, 1] }, 17: { m: 0.55, r: 0.3, env: 1.4, cc: 0.9, deep: 0.55, sweep: 1, rim: [0.4, 1, 0.5] },
};
const camoCache = new Map();
function camoSet(id) {
  if (camoCache.has(id)) return camoCache.get(id);
  let out = null;
  try {
    const paint = CAMO_PAINT[id], res = paint && paint();
    if (res && res[0]) {
      const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
      out = { canvas: res[0], map: mk(res[0]), em: res[1] ? mk(res[1]) : null };
    }
  } catch (e) { out = null; }
  camoCache.set(id, out); return out;
}
export function camoSwatch(id, w = 72, h = 44) {                                // small preview image for the menu
  const set = camoSet(id); if (!set || typeof document === 'undefined') return '';
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (!g) return '';
  g.drawImage(set.canvas, 0, 0, CS * 0.45, CS * 0.45 * h / w, 0, 0, w, h); return c.toDataURL();
}
const camoMats = new Map(), camoTime = { value: 0 };
export function tickCamos(dt) { camoTime.value += dt; }
export const camoQ = { low: false };                                  // Graphics: Low draws camos as plain painted metal (no clearcoat, animation or depth layers)
function camoMat(id) {
  const ck = id + (camoQ.low ? 'L' : '');
  if (camoMats.has(ck)) return camoMats.get(ck);
  const set = camoSet(id); if (!set) { camoMats.set(ck, null); return null; }
  const full = CAMO_LOOK[id] || { m: 0.18, r: 0.55, env: 0.9 }, look = camoQ.low ? { m: full.m, r: Math.max(0.35, full.r), env: 0.8 } : full;
  const Phys = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
  const m = new Phys({ color: 0xffffff, metalness: look.m, roughness: look.r, envMapIntensity: look.env });
  if (look.cc && 'clearcoat' in m) { m.clearcoat = look.cc; m.clearcoatRoughness = 0.08; }
  if (set.em && !camoQ.low) { m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = look.em || 1; }
  const hasEm = !!set.em && !camoQ.low;
  const fl = look.flow || [0.01, 0.03, 0.05], rim = look.rim || [1, 1, 1], f = (x) => (+x).toFixed(4);
  // depth: three layers of the pattern at different scales, parallax-shifted by the view direction and drifting, plus a rim glow - reads as paint with a volume under it
  const deepFrag = look.deep ? `vec3 vdir = normalize(vVp); vec3 flw = vec3(${f(fl[0])}, ${f(fl[1])}, ${f(fl[2])}) * camoT;
    vec3 cA = camoTri(camoMap, vGp, vGn);
    vec3 cB = camoTri(camoMap, vGp * 0.6 + vdir * 0.05 + flw, vGn);
    vec3 cC = camoTri(camoMap, vGp * 0.33 + vdir * 0.11 - flw * 1.7, vGn);
    float tw = 0.55 + 0.45 * sin(camoT * 1.4 + dot(vGp, vec3(31.0, 17.0, 23.0)));
    vec3 deepCol = cA * (1.0 - ${f(look.deep * 0.35)}) + (cB * 0.55 + cC * 0.4 * tw) * ${f(look.deep)};
    ${look.hue ? 'deepCol = hueRot(deepCol, camoT * 0.9 + vGp.z * 3.0);' : ''}
    ${look.sweep ? 'deepCol *= 1.0 + 0.55 * smoothstep(0.86, 1.0, sin(vGp.z * 14.0 + vGp.y * 9.0 - camoT * 2.2));' : ''}
    float fres = pow(1.0 - abs(dot(normalize(vNormal), -vdir)), 2.4);
    deepCol += vec3(${f(rim[0])}, ${f(rim[1])}, ${f(rim[2])}) * fres * ${f(0.25 + look.deep * 0.35)} * (0.7 + 0.3 * sin(camoT * 2.0));
    diffuseColor.rgb *= deepCol;` : '';
  const deepEm = `totalEmissiveRadiance *= mix(camoTri(camoEm, vGp, vGn), camoTri(camoEm, vGp * 0.7 + vVp * 0.04 + vec3(${f(fl[0])}, ${f(fl[1])}, ${f(fl[2])}) * camoT * 2.0, vGn), 0.6) * (0.65 + 0.35 * sin(camoT * 2.2 + vGp.z * 14.0));`;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.camoMap = { value: set.map }; sh.uniforms.camoEm = { value: set.em || set.map }; sh.uniforms.camoScale = { value: 6.5 }; sh.uniforms.camoT = camoTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 gpos;\nattribute vec3 gnrm;\nvarying vec3 vGp;\nvarying vec3 vGn;\nvarying vec3 vVp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGp = gpos; vGn = gnrm; vVp = (modelViewMatrix * vec4(position, 1.0)).xyz;');
    const tri = 'vec3 camoTri(sampler2D t, vec3 p, vec3 n) { vec3 w = pow(abs(normalize(n)), vec3(4.0)); w /= (w.x + w.y + w.z); return texture2D(t, p.zy * camoScale).rgb * w.x + texture2D(t, p.xz * camoScale).rgb * w.y + texture2D(t, p.xy * camoScale).rgb * w.z; }';
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D camoMap;\nuniform sampler2D camoEm;\nuniform float camoScale;\nuniform float camoT;\nvarying vec3 vGp;\nvarying vec3 vGn;\nvarying vec3 vVp;\nvec3 hueRot(vec3 c, float a) { const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }\n' + tri)
      .replace('#include <map_fragment>', look.deep ? deepFrag : look.hue ? 'diffuseColor.rgb *= hueRot(camoTri(camoMap, vGp, vGn), camoT * 0.9 + vGp.z * 3.0);' : look.flake ? 'diffuseColor.rgb *= camoTri(camoMap, vGp, vGn) * (0.85 + 0.35 * step(0.82, fract(sin(dot(floor(vGp * 420.0), vec3(12.9, 78.2, 37.7))) * 43758.5)) * (0.5 + 0.5 * sin(camoT * 3.0 + vGp.x * 60.0)));' : 'diffuseColor.rgb *= camoTri(camoMap, vGp, vGn);')
      .replace('#include <emissivemap_fragment>', hasEm ? (look.deep ? deepEm : look.pulse ? 'totalEmissiveRadiance *= camoTri(camoEm, vGp, vGn) * (0.65 + 0.35 * sin(camoT * 2.2 + vGp.z * 14.0));' : 'totalEmissiveRadiance *= camoTri(camoEm, vGp, vGn);') : '');
  };
  m.customProgramCacheKey = () => 'camo' + ck;
  camoMats.set(ck, m); return m;
}
function applyCamo(g, id) {
  if (!id || !THREE.BufferAttribute || !THREE.Matrix4 || !THREE.Matrix3) return;
  const cmat = camoMat(id); if (!cmat) return;
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    if (!((o.material && o.material.userData && o.material.userData.camo) || o.userData.camoPart)) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(rel);
    const geo = o.geometry.clone(), p = geo.attributes.position, n = geo.attributes.normal, gp = new Float32Array(p.count * 3), gn = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(rel); gp[i * 3] = v.x; gp[i * 3 + 1] = v.y; gp[i * 3 + 2] = v.z;
      if (n) v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); else v.set(0, 1, 0); gn[i * 3] = v.x; gn[i * 3 + 1] = v.y; gn[i * 3 + 2] = v.z;
    }
    geo.setAttribute('gpos', new THREE.BufferAttribute(gp, 3)); geo.setAttribute('gnrm', new THREE.BufferAttribute(gn, 3));
    o.geometry = geo; o.material = cmat;
  });
}

// ------------------------------------------------------------------------------------------------
// Attachments - built from the gun's `mount` / `under` / `side` / `muzzle` anchors
// ------------------------------------------------------------------------------------------------
const dotRed = () => mat(0xff2a1a, 0, 1, { emissive: 0xff2a1a, emissiveIntensity: 2 });
const dotGreen = () => mat(0x2aff6a, 0, 1, { emissive: 0x2aff6a, emissiveIntensity: 2 });
const dotBlue = () => mat(0x3aa0ff, 0, 1, { emissive: 0x3aa0ff, emissiveIntensity: 2 });
const lens = () => mat(0x7fb6d8, 0.1, 0.05, { transparent: true, opacity: 0.16 });
const ring = (b, r, x, y, z, m, n = 10) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; b.ball(0.0008, x + Math.cos(a) * r, y + Math.sin(a) * r, z, m); } };

// the player's own reticle image (Custom Decal Sight): one shared canvas texture, so every sight updates the moment a new image is picked
const DECAL_KEY = 'ironstrike_decal';
export const decal = (() => {
  const S = 128; let cv = null, tex = null, img = null, keyDark = true;
  const store = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const draw = () => {
    if (!cv) return; const g = cv.getContext('2d'); g.clearRect(0, 0, S, S);
    if (img) {
      const r = Math.min(S / img.width, S / img.height), w = img.width * r, h = img.height * r; g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      if (keyDark) { const d = g.getImageData(0, 0, S, S), p = d.data; for (let i = 0; i < p.length; i += 4) { const l = (p[i] + p[i + 1] + p[i + 2]) / 3; if (l < 60) p[i + 3] = Math.min(p[i + 3], Math.max(0, (l - 25) * 7)); } g.putImageData(d, 0, 0); }
    } else {                                                                                         // default reticle: ring, dot and ticks
      g.strokeStyle = g.fillStyle = '#ff2a1a'; g.lineWidth = 5; g.beginPath(); g.arc(S / 2, S / 2, 40, 0, 6.283); g.stroke(); g.beginPath(); g.arc(S / 2, S / 2, 5, 0, 6.283); g.fill();
      for (const [x, y, w, h] of [[S / 2 - 2, 4, 4, 18], [S / 2 - 2, S - 22, 4, 18], [4, S / 2 - 2, 18, 4], [S - 22, S / 2 - 2, 18, 4]]) g.fillRect(x, y, w, h);
    }
    if (tex) tex.needsUpdate = true;
  };
  const api = {
    get hasImage() { return !!img; }, get keyDark() { return keyDark; },
    texture() {
      if (tex) return tex;
      if (typeof document === 'undefined' || !THREE.CanvasTexture) return null;
      cv = document.createElement('canvas'); cv.width = cv.height = S; tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; draw(); return tex;
    },
    setKeyDark(v) { keyDark = !!v; store(DECAL_KEY + '_key', keyDark ? '1' : '0'); draw(); },
    load(url, save = true) {
      return new Promise((res) => { const i = new Image(); i.onload = () => { img = i; if (save) { try { const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), r = Math.min(S / i.width, S / i.height); g.drawImage(i, (S - i.width * r) / 2, (S - i.height * r) / 2, i.width * r, i.height * r); store(DECAL_KEY, c.toDataURL('image/png')); } catch (e) { /* ignore */ } } draw(); res(true); }; i.onerror = () => res(false); i.src = url; });
    },
    clear() { img = null; store(DECAL_KEY, null); draw(); },
  };
  keyDark = read(DECAL_KEY + '_key') !== '0';
  const saved = read(DECAL_KEY); if (saved && typeof Image !== 'undefined') api.load(saved, false);
  return api;
})();

function buildOptic(b, u, g, kind) {
  const m = u.mount, z = m.z;
  g.traverse((o) => { if (o.userData && o.userData.iron) o.visible = false; });
  if (kind === 5) {                                       // custom decal sight: open reflex frame with the player's image floating in the window
    const pistol = !!u.pistol, cy = m.y + (pistol ? 0.014 : 0.026), zz = z, S = pistol ? ((o) => mark(o, 'slide')) : ((o) => o), w = pistol ? 0.024 : 0.03, len = pistol ? 0.042 : 0.07;
    const h0 = cy - 0.018 - m.y; if (!pistol && h0 > 0.002) b.box(0.026, h0, 0.06, 0, m.y + h0 / 2, zz, M.blued());
    S(b.box(w, 0.005, len, 0, cy - (pistol ? 0.0115 : 0.015), zz, M.black())); S(b.box(w, 0.006, len, 0, cy + (pistol ? 0.0115 : 0.0145), zz, M.black()));
    S(b.box(0.004, pistol ? 0.024 : 0.034, len, w / 2 - 0.0015, cy, zz, M.black())); S(b.box(0.004, pistol ? 0.024 : 0.034, len, -(w / 2 - 0.0015), cy, zz, M.black()));
    S(b.box(w - 0.007, pistol ? 0.018 : 0.021, 0.002, 0, cy, zz + len / 2 - 0.004, lens()));
    const tx = decal.texture();
    if (tx && THREE.PlaneGeometry && THREE.MeshBasicMaterial) {
      const pm = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: false }), sz = pistol ? 0.014 : 0.02;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), pm); p.position.set(0, cy, zz + len / 2 - 0.006); p.renderOrder = 5; p.userData.decal = true; b.g ? b.g.add(p) : g.add(p); S(p);
    } else b.ball(0.0015, 0, cy, zz, dotRed());
    u.sightY = cy; return;
  }
  if (u.pistol) {                                         // compact slide-mounted reflex sight (the holographic one gets a ring reticle)
    const cy = m.y + 0.014, S = (o) => mark(o, 'slide');           // the sight rides on the slide
    S(b.box(0.024, 0.004, 0.042, 0, m.y + 0.002, z, M.black()));
    S(b.box(0.024, 0.004, 0.042, 0, m.y + 0.0255, z, M.black()));
    S(b.box(0.004, 0.024, 0.042, 0.0105, cy, z, M.black())); S(b.box(0.004, 0.024, 0.042, -0.0105, cy, z, M.black()));
    S(b.box(0.017, 0.018, 0.002, 0, cy, z + 0.015, lens()));
    if (kind === 2) { ring(b, 0.004, 0, cy, z, dotRed(), 8); b.ball(0.0009, 0, cy, z, dotRed()); } else S(b.ball(0.0012, 0, cy, z, dotRed()));
    u.sightY = cy;
    g.traverse((o) => { if (o.userData && o.userData.hammer) o.position.y -= Math.max(0, o.position.y + 0.016 - (cy - 0.008)); });   // drop the hammer below the sight line so it does not block the dot
    return;
  }
  if (kind === 1 || kind === 3) {                         // open reflex (also the front half of the hybrid)
    const zz = kind === 3 ? z - 0.03 : z, cy = m.y + 0.026, h0 = cy - 0.018 - m.y;
    if (h0 > 0.002) b.box(0.026, h0, 0.06, 0, m.y + h0 / 2, zz, M.blued());
    b.box(0.03, 0.006, 0.07, 0, cy - 0.015, zz, M.black());
    b.box(0.03, 0.007, 0.07, 0, cy + 0.0145, zz, M.black());
    b.box(0.004, 0.034, 0.07, 0.0135, cy, zz, M.black()); b.box(0.004, 0.034, 0.07, -0.0135, cy, zz, M.black());
    b.box(0.023, 0.021, 0.002, 0, cy, zz + 0.02, lens());
    b.ball(0.0015, 0, cy, zz, dotRed());
    if (kind === 3) {                                     // 2x magnifier behind it
      b.box(0.02, 0.014, 0.08, 0, m.y + 0.007, z + 0.07, M.blued());
      b.tube(0.0185, 0.075, 0, cy, z + 0.07, M.black());
      b.tube(0.0195, 0.01, 0, cy, z + 0.108, M.blued()); b.tube(0.0165, 0.002, 0, cy, z + 0.03, lens()); b.tube(0.0155, 0.002, 0, cy, z + 0.114, lens());
    }
    u.sightY = cy; return;
  }
  if (kind === 2) {                                       // holographic: tall box frame with a wide window and a ring + dot reticle
    const cy = m.y + 0.03;
    b.box(0.034, 0.012, 0.09, 0, m.y + 0.006, z, M.black());
    b.box(0.036, 0.007, 0.074, 0, cy + 0.0245, z - 0.004, M.black());
    b.box(0.005, 0.045, 0.09, 0.0155, cy + 0.0015, z, M.black()); b.box(0.005, 0.045, 0.09, -0.0155, cy + 0.0015, z, M.black());
    b.box(0.026, 0.034, 0.002, 0, cy, z + 0.044, lens()); b.box(0.026, 0.034, 0.002, 0, cy, z - 0.04, lens());
    ring(b, 0.0045, 0, cy, z + 0.043, dotRed(), 10); b.ball(0.0009, 0, cy, z + 0.043, dotRed());
    u.sightY = cy; return;
  }
  // ACOG 4x: scope body on a mount, big front objective, fibre-optic strip on top
  const cy = m.y + 0.034;
  b.box(0.026, cy - 0.016 - m.y, 0.07, 0, m.y + (cy - 0.016 - m.y) / 2, z, M.blued());
  b.tube(0.0165, 0.12, 0, cy, z, M.black());
  b.tube(0.0215, 0.032, 0, cy, z - 0.058, M.black()); b.tube(0.0195, 0.002, 0, cy, z - 0.075, lens());
  b.tube(0.0195, 0.026, 0, cy, z + 0.065, M.black()); b.tube(0.0145, 0.002, 0, cy, z + 0.079, lens());
  b.box(0.007, 0.007, 0.08, 0, cy + 0.0205, z - 0.01, mat(0xe86a1a, 0.2, 0.4, { emissive: 0xe86a1a, emissiveIntensity: 0.8 }));
  b.box(0.01, 0.012, 0.03, 0, cy + 0.0165, z + 0.03, M.black());
  b.ball(0.0012, 0, cy, z + 0.03, dotRed());
  u.sightY = cy;
}

function buildUnder(b, u, kind) {
  const m = u.under;
  if (kind === 1) {                                                                    // vertical grip
    const h = 0.08;
    b.box(0.022, 0.012, 0.05, 0, m.y - 0.004, m.z, M.blued());
    b.box(0.026, h, 0.03, 0, m.y - 0.01 - h / 2, m.z, M.poly(), 0.1);
    for (let i = 0; i < 4; i++) b.box(0.028, 0.004, 0.032, 0, m.y - 0.026 - i * 0.015, m.z + 0.005, M.black(), 0.1);
    b.box(0.026, 0.008, 0.032, 0, m.y - 0.01 - h, m.z + 0.008, M.blued());
    u.fore = V(0, m.y - 0.01 - h / 2 + 0.045, m.z + 0.004);                          // support hand moves to the grip
  } else if (kind === 2) {                                                             // angled grip: leans forward, smooth and wide
    const th = 0.62, len = 0.075, cx = m.y - 0.008 - Math.cos(th) * len / 2, cz = m.z - Math.sin(th) * len / 2;
    b.box(0.022, 0.012, 0.06, 0, m.y - 0.004, m.z + 0.008, M.blued());
    b.box(0.028, len, 0.034, 0, cx, cz, M.poly(), th);
    for (let i = 0; i < 3; i++) b.box(0.03, 0.004, 0.036, 0, cx + 0.018 - i * 0.017, cz - 0.0 - (i - 1) * 0.0 + 0.0, M.black(), th);
    u.fore = V(0, cx + 0.012, cz - 0.004);
  } else if (kind === 3) {                                                             // stubby grip: short fat post you cup with the whole hand
    b.box(0.022, 0.012, 0.045, 0, m.y - 0.004, m.z, M.blued());
    b.post(0.0155, 0.042, 0, m.y - 0.03, m.z, M.poly());
    b.post(0.0175, 0.008, 0, m.y - 0.056, m.z, M.blued());
    u.fore = V(0, m.y - 0.02, m.z + 0.002);
  }
}

function rearOf(g) {                                                  // where the back end of the gun is (z) and how high its stock sits (y)
  if (!g.updateMatrixWorld || !THREE.Matrix4) return { z: 0.3, y: -0.02 };
  g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), v = new THREE.Vector3(); let zmax = -1e9; const pts = [];
  g.traverse((o) => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !o.visible) return; const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 400));
    for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(rel); pts.push(v.y, v.z); if (v.z > zmax) zmax = v.z; } });
  let sy = 0, n = 0; for (let i = 0; i < pts.length; i += 2) if (pts[i + 1] > zmax - 0.03) { sy += pts[i]; n++; }
  return { z: zmax, y: n ? sy / n : -0.02 };
}
function buildLaser(b, u, kind) {
  const emit = kind === 2 ? dotGreen() : kind === 3 ? dotBlue() : dotRed(), body = kind === 2 ? M.silver() : kind === 3 ? M.blued() : M.black();
  if (u.pistol && u.under) {
    const m = u.under, cy = m.y - 0.011;
    if (kind === 2) { b.tube(0.0115, 0.06, 0, cy, m.z, body); b.tube(0.008, 0.004, 0, cy, m.z - 0.031, emit); }                        // tactical: round barrel-style body
    else if (kind === 3) { b.box(0.014, 0.014, 0.03, 0, cy + 0.002, m.z, body); b.box(0.007, 0.007, 0.004, 0, cy + 0.002, m.z - 0.017, emit); }   // compact: tiny cube
    else { b.box(0.022, 0.022, 0.05, 0, cy, m.z, body); b.box(0.012, 0.012, 0.004, 0, cy, m.z - 0.027, emit); }              // standard box
    b.box(0.006, 0.006, 0.014, 0.0125, cy + 0.004, m.z + 0.01, M.steel());           // switch
    u.laser = V(0, cy, m.z - 0.029);
  } else if (!u.pistol && u.side) {                                                  // rifles: clamped to the right side of the handguard
    const m = u.side, x = m.x + 0.011;
    b.box(0.006, 0.02, 0.04, m.x + 0.002, m.y, m.z, M.blued());
    if (kind === 2) { b.tube(0.011, 0.07, x + 0.004, m.y, m.z, body); b.tube(0.008, 0.004, x + 0.004, m.y, m.z - 0.036, emit); }
    else if (kind === 3) { b.box(0.014, 0.014, 0.03, x + 0.002, m.y, m.z, body); b.box(0.007, 0.007, 0.004, x + 0.002, m.y, m.z - 0.017, emit); }
    else { b.box(0.02, 0.02, 0.056, x + 0.004, m.y, m.z, body); b.box(0.012, 0.012, 0.004, x + 0.004, m.y, m.z - 0.03, emit); }
    b.box(0.012, 0.006, 0.016, x + 0.004, m.y + 0.013, m.z + 0.01, M.steel());
    u.laser = V(x + 0.004, m.y, m.z - 0.032);
  }
}

function addAttachments(g, w) {
  const u = g.userData, mask = w.attMask || 0, b = new B(); b.g = g;
  const optic = getSlot(mask, 'optic'), under = getSlot(mask, 'under'), laser = getSlot(mask, 'laser');
  if (optic && u.mount) buildOptic(b, u, g, optic);
  if (under && !u.pistol && u.under) buildUnder(b, u, under);
  if (laser) buildLaser(b, u, laser);
}

// barrel extensions, muzzle devices and magazines
function addMuzzleAttachments(g, w) {
  const u = g.userData, mask = w.attMask || 0, b = new B(); b.g = g;
  const barrel = getSlot(mask, 'barrel'), muz = getSlot(mask, 'muzzle'), mag = getSlot(mask, 'mag');
  if (u.muzzle && (barrel || muz)) {
    const mz = u.muzzle.clone(), X = mz.x, Y = mz.y;
    const tube = (r, len, m, r2) => { b.tube(r, len, X, Y, mz.z - len / 2 + 0.004, m, r2); mz.z -= len - 0.004; };
    const ringAt = (r, zz, m) => b.tube(r, 0.004, X, Y, zz, m || M.black());
    // barrels: short = a ported stub, long = slim rod with a collar, heavy = thick fluted barrel
    if (barrel === 1) { const z0 = mz.z; tube(0.0105, 0.03, M.black()); for (let i = 0; i < 3; i++) b.box(0.003, 0.012, 0.004, X + (i - 1) * 0.0085, Y + 0.0, z0 - 0.012, M.steel()); }
    if (barrel === 2) { const z0 = mz.z; tube(0.0085, 0.12, M.steel()); ringAt(0.0112, z0 - 0.03, M.blued()); ringAt(0.0112, z0 - 0.1, M.blued()); }
    if (barrel === 3) { const z0 = mz.z; tube(0.0125, 0.075, M.blued()); for (let i = 0; i < 5; i++) { ringAt(0.0135, z0 - 0.008 - i * 0.014, M.black()); b.box(0.004, 0.004, 0.06, X + 0.0125, Y + (i % 2 ? 0.003 : -0.003), z0 - 0.04, M.black()); } }
    // muzzle devices - each one has its own silhouette
    if (muz === 1) { const z0 = mz.z; tube(0.0115, 0.055, M.black()); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; b.box(0.004, 0.006, 0.03, X + Math.cos(a) * 0.0118, Y + Math.sin(a) * 0.0118, z0 - 0.034, M.steel(), 0, 0, a); } ringAt(0.0122, z0 - 0.012, M.blued()); }                       // birdcage: 6 prongs
    else if (muz === 2) { const z0 = mz.z; tube(0.0125, 0.034, M.blued()); b.box(0.028, 0.0045, 0.036, X, Y + 0.0128, z0 - 0.02, M.black()); for (let i = 0; i < 3; i++) b.box(0.02, 0.0055, 0.004, X, Y + 0.0128, z0 - 0.01 - i * 0.011, M.steel()); for (const sd of [-1, 1]) b.box(0.003, 0.012, 0.026, X + sd * 0.0138, Y, z0 - 0.02, M.black()); }   // compensator: slotted top plate + side vents
    else if (muz === 3) { const z0 = mz.z; tube(0.0135, 0.052, M.black()); for (let i = 0; i < 3; i++) { b.tube(0.0185, 0.004, X, Y, z0 - 0.012 - i * 0.014, M.steel()); } b.tube(0.0095, 0.012, X, Y, z0 - 0.056, M.steel()); }   // brake: three wide disc baffles
    else if (muz === 4) { const z0 = mz.z; tube(0.0128, 0.095, M.blued(), 0.0105); b.tube(0.0138, 0.008, X, Y, z0 - 0.004, M.steel()); b.tube(0.0095, 0.004, X, Y, z0 - 0.098, M.black()); mz.z -= 0.0; }   // light: slim tapered can, bluing
    else if (muz === 5) { const z0 = mz.z; tube(0.0162, 0.15, M.black()); b.tube(0.0172, 0.012, X, Y, z0 - 0.004, M.steel()); for (let i = 0; i < 5; i++) b.tube(0.0168, 0.0035, X, Y, z0 - 0.03 - i * 0.026, M.steel()); b.tube(0.0172, 0.01, X, Y, z0 - 0.146, M.steel()); }   // tactical: ringed baffle can
    else if (muz === 6) { const z0 = mz.z; tube(0.0205, 0.2, M.blued()); b.tube(0.0215, 0.016, X, Y, z0 - 0.006, M.steel()); b.tube(0.0165, 0.02, X, Y, z0 - 0.202, M.black(), 0.0125); for (let i = 0; i < 6; i++) b.box(0.007, 0.007, 0.15, X + Math.cos(i * 1.047) * 0.0208, Y + Math.sin(i * 1.047) * 0.0208, z0 - 0.1, M.steel()); b.box(0.01, 0.006, 0.05, X, Y + 0.0218, z0 - 0.05, mat(0xb03020, 0.2, 0.5)); }   // heavy: fat can with a ribbed heat shield + red band
    u.muzzle = mz;
  }
  // stocks: bolt-on parts at the back of the gun
  const stock = getSlot(mask, 'stock');
  if (stock) {
    const r = rearOf(g), Z = r.z, Yc = r.y;
    if (stock === 1) { for (const sd of [-1, 1]) b.box(0.006, 0.006, 0.07, sd * 0.012, Yc + 0.012, Z + 0.025, M.steel()); b.box(0.034, 0.05, 0.008, 0, Yc - 0.01, Z + 0.062, M.black()); b.box(0.034, 0.006, 0.07, 0, Yc - 0.036, Z + 0.025, M.steel()); }                              // light skeleton frame
    if (stock === 2) { b.box(0.04, 0.115, 0.03, 0, Yc - 0.012, Z + 0.015, M.black()); b.box(0.036, 0.03, 0.1, 0, Yc + 0.047, Z - 0.03, M.poly()); for (let i = 0; i < 5; i++) b.box(0.042, 0.003, 0.032, 0, Yc - 0.05 + i * 0.022, Z + 0.015, M.blued()); }          // heavy rubber butt pad + cheek riser
    if (stock === 3) { b.box(0.03, 0.012, 0.11, 0, Yc + 0.03, Z - 0.02, M.blued()); b.box(0.034, 0.024, 0.06, 0, Yc + 0.046, Z + 0.012, M.poly()); for (let i = 0; i < 4; i++) b.box(0.032, 0.004, 0.004, 0, Yc + 0.0375, Z - 0.05 + i * 0.026, M.steel()); b.box(0.038, 0.07, 0.016, 0, Yc - 0.002, Z + 0.062, M.black()); }                   // adjustable cheek rest + rail
  }
  if (mag) {
    const mags = []; g.traverse((o) => { if (o.userData && o.userData.mag && o.isMesh) mags.push(o); });
    for (const o of mags) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox, sy = o.scale.y, h = (bb.max.y - bb.min.y) * sy;
      if (mag === 1) {                                                               // extended
        const xd = w.asset && w.asset.xmag && MODEL_DATA[w.asset.xmag];
        if (xd) {                                                                    // a hand-made extended mag replaces the stock one
          o.visible = false;
          for (const part of xd.parts) {
            const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(part.positions), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(part.normals), 3)); geo.setIndex(part.indices);
            try { boxUV(geo); } catch (e) { /* stub three */ }
            const m2 = new THREE.Mesh(geo, bakedMat(parseInt(part.color.slice(1), 16), 'mag')); m2.userData.mag = true; g.add(m2);
          }
        } else { const top = o.position.y + sy * bb.max.y; o.scale.y *= 1.4; o.position.y = top - o.scale.y * bb.max.y; }   // stretch downwards, the top stays in the mag well
      }
      else if (mag === 2) {                                                          // fast mag: bright pull tab on the base plate
        const tab = new THREE.Mesh(bevelBox(0.02, 0.012, 0.012), mat(0xe86a1a, 0.1, 0.5)); tab.position.set((bb.max.x + bb.min.x) / 2, bb.min.y - 0.003, bb.min.z + (bb.max.z - bb.min.z) * 0.15); o.add(tab);
      } else if (mag === 3) {                                                        // drum: hide the stick mag, hang a drum off the same spot (it still animates as the mag)
        o.visible = false;
        const R = 0.052, cx = (bb.max.x + bb.min.x) / 2, cz = (bb.max.z + bb.min.z) / 2, cy = bb.min.y * sy + R * 0.55;
        const d = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.05, 22), M.black()); d.rotation.z = Math.PI / 2; d.position.set(o.position.x + cx * o.scale.x, o.position.y + cy, o.position.z + cz * o.scale.z); mark(d, 'mag'); g.add(d);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.054, 16), M.steel()); cap.rotation.z = Math.PI / 2; cap.position.copy(d.position); mark(cap, 'mag'); g.add(cap);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283, rib = new THREE.Mesh(bevelBox(0.052, 0.012, 0.012), M.blued()); rib.position.set(d.position.x, d.position.y + Math.cos(a) * R, d.position.z + Math.sin(a) * R); rib.rotation.x = -a; mark(rib, 'mag'); g.add(rib); }
        const stub = new THREE.Mesh(bevelBox(bb.max.x - bb.min.x || 0.026, 0.05, bb.max.z - bb.min.z || 0.034), M.black()); stub.position.set(d.position.x, o.position.y + bb.max.y * sy - 0.025, d.position.z); mark(stub, 'mag'); g.add(stub);
      }
    }
  }
  const ammo = getSlot(mask, 'ammo');
}

export function buildGun(w) {
  const data = w.asset && MODEL_DATA[w.asset.id];
  const g = data ? buildFromAsset(w, data) : (BUILDERS[w.builder] || (() => new THREE.Group()))();
  if (w.tint && w.builder !== 'goldgun' && THREE.Color) g.traverse((o) => {                       // recoloured variants: tint the dark metal / polymer parts
    if (!o.isMesh || !o.material || o.material.map || (o.userData && o.userData.iron) || !o.material.color) return;
    const c = o.material.color; if ((c.r + c.g + c.b) / 3 > 0.45) return;
    o.material = o.material.clone(); o.material.color.lerp(new THREE.Color(w.tint), 0.55);
  });
  if (w.attMask) {
    addAttachments(g, w); addMuzzleAttachments(g, w);
    const c = camoOf(w.attMask);
    if (c) { try { applyCamo(g, c); } catch (e) { /* headless test environment */ } }
  }
  return g;
}
