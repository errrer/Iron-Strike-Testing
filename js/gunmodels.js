import * as THREE from 'three';

// ------------------------------------------------------------------------------------------------
// Gun models.
//  * Weapons with an `asset` (e.g. the VMP) are loaded from assets/models/<id>.json - baked from your
//    FBX files by tools/fbx2model.py.  If the file is missing, the procedural stand-in below is used.
//  * Every other weapon is built procedurally from boxes/cylinders until you replace it with a real model.
// Conventions (same for both): origin = middle of the receiver, -Z = barrel direction, +Y = up, metres.
// Each model exposes userData: muzzle, sightY, grip (trigger hand), fore (support hand), pistol.
// ------------------------------------------------------------------------------------------------

export const MODEL_DATA = {};
const MODEL_VER = '0.8.9';        // bump when an assets/models/*.json changes so browsers don't keep the old copy

export async function loadModels(weapons) {
  const jobs = [];
  for (const w of Object.values(weapons)) {
    if (!w.asset || MODEL_DATA[w.asset.id]) continue;
    jobs.push(fetch(`assets/models/${w.asset.id}.json?v=${MODEL_VER}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.parts) MODEL_DATA[w.asset.id] = j; }).catch(() => {}));
  }
  await Promise.all(jobs);
  return Object.keys(MODEL_DATA);
}

// ---- shared materials -----------------------------------------------------------------------
const matCache = new Map();
function mat(color, metal = 0.5, rough = 0.5, extra) {
  const k = `${color}|${metal}|${rough}|${extra ? JSON.stringify(extra) : ''}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...(extra || {}) }));
  return matCache.get(k);
}
const M = {
  steel: () => mat(0x2c2f34, 0.85, 0.38),
  blued: () => mat(0x1b1d21, 0.8, 0.42),
  silver: () => mat(0xaeb3b9, 0.9, 0.3),
  poly: () => mat(0x212327, 0.1, 0.8),
  polyTan: () => mat(0x6b5f48, 0.1, 0.8),
  rubber: () => mat(0x111213, 0.0, 0.95),
  wood: () => mat(0x7a4a24, 0.05, 0.7),
  woodDark: () => mat(0x4a2c15, 0.05, 0.7),
  black: () => mat(0x08090a, 0.3, 0.6),
  brass: () => mat(0xb08a3a, 0.9, 0.35),
  glass: () => mat(0x3a7fb0, 0.2, 0.1, { transparent: true, opacity: 0.55 }),
  lens: () => mat(0x1b3a55, 0.3, 0.05),
  red: () => mat(0xc0392b, 0.1, 0.6),
};

class B {
  constructor() { this.g = new THREE.Group(); }
  _add(geo, m, x, y, z, rx = 0, ry = 0, rz = 0) { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); this.g.add(me); return me; }
  box(w, h, d, x, y, z, m, rx = 0, ry = 0, rz = 0) { return this._add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz); }
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
function buildAR() {                 // M4A1
  const b = new B();
  b.box(0.046, 0.052, 0.3, 0, 0.026, -0.02, M.blued());                         // upper receiver
  b.box(0.044, 0.05, 0.22, 0, -0.026, 0.035, M.blued());                        // lower receiver
  b.box(0.04, 0.045, 0.07, 0, -0.04, -0.075, M.blued());                        // magwell
  mark(b.box(0.034, 0.07, 0.056, 0, -0.1, -0.075, M.black(), 0.06), 'mag');     // mag (curved: two segments)
  mark(b.box(0.034, 0.06, 0.056, 0, -0.158, -0.082, M.black(), 0.16), 'mag');
  mark(b.box(0.036, 0.008, 0.06, 0, -0.19, -0.088, M.steel(), 0.16), 'mag');
  b.box(0.03, 0.1, 0.045, 0, -0.1, 0.115, M.poly(), -0.38);                     // pistol grip
  triggerGroup(b, 0, -0.04, 0.0);
  b.box(0.054, 0.056, 0.22, 0, 0.022, -0.26, M.poly());                         // handguard
  for (let i = 0; i < 5; i++) { b.box(0.058, 0.012, 0.016, 0, 0.022, -0.19 - i * 0.034, M.black()); b.box(0.02, 0.058, 0.016, 0, 0.022, -0.19 - i * 0.034, M.black()); }
  b.box(0.021, 0.009, 0.54, 0, 0.0575, -0.15, M.blued());                       // top rail
  railTeeth(b, 0.1, -0.42, 0.0635, 0.021);
  b.tube(0.0085, 0.13, 0, 0.022, -0.43, M.steel());                             // barrel
  b.box(0.022, 0.026, 0.03, 0, 0.034, -0.385, M.steel());                       // gas block
  ironSights(b, { y: 0.092, zr: 0.085, zf: -0.385, br: 0.0635, bf: 0.047 });
  b.tube(0.0135, 0.06, 0, 0.022, -0.485, M.blued());                            // flash hider
  for (let i = 0; i < 3; i++) b.box(0.03, 0.004, 0.012, 0, 0.022, -0.47 - i * 0.015, M.black());
  b.box(0.032, 0.014, 0.034, 0, 0.056, 0.13, M.black());                        // charging handle
  b.box(0.002, 0.022, 0.045, 0.0235, 0.03, 0.01, M.black());                    // ejection port
  b.tube(0.016, 0.2, 0, 0.002, 0.23, M.blued());                                // buffer tube
  b.box(0.04, 0.08, 0.13, 0, -0.012, 0.31, M.poly(), 0.05);                     // stock
  b.box(0.042, 0.09, 0.014, 0, -0.016, 0.38, M.rubber(), 0.05);                 // butt pad
  return b.done({ muzzle: V(0, 0.022, -0.515), sightY: 0.092, grip: V(0, -0.105, 0.11), fore: V(0, -0.015, -0.26), pistol: false, side: V(0.027, 0.022, -0.3), mount: V(0, 0.0645, 0.02), under: V(0, -0.006, -0.26) });
}

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
  b.box(0.008, 0.024, 0.014, 0, 0.044, 0.1, M.steel(), 0.5);                    // hammer
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
  b.box(0.008, 0.026, 0.014, 0, 0.034, 0.1, M.steel(), 0.5);                    // hammer
  b.box(0.032, 0.095, 0.045, 0, -0.065, 0.098, M.wood(), -0.3);                 // grip
  b.box(0.006, 0.01, 0.05, 0, -0.025, 0.04, M.silver());                        // trigger guard bottom
  b.box(0.006, 0.026, 0.005, 0, -0.012, 0.012, M.silver());
  b.box(0.005, 0.02, 0.007, 0, -0.01, 0.045, M.steel(), 0.2);                   // trigger
  return b.done({ muzzle: V(0, 0.026, -0.21), sightY: 0.05, grip: V(0, -0.06, 0.09), fore: V(-0.014, -0.08, 0.08), pistol: true, mount: V(0, 0.0295, 0.05), under: V(0, 0.001, -0.18) });
}

// ------------------------------------------------------------------------------------------------
// Generic fallback (used for the VMP if assets/models/vmp.json can't be loaded)
// ------------------------------------------------------------------------------------------------
function buildSmg() {
  const b = new B();
  b.box(0.046, 0.07, 0.34, 0, 0.0, 0, M.blued());
  b.box(0.05, 0.06, 0.16, 0, -0.005, -0.2, M.poly());
  b.tube(0.012, 0.14, 0, 0.008, -0.27, M.steel());
  b.box(0.03, 0.1, 0.04, 0, -0.085, 0.09, M.poly(), -0.3);
  mark(b.box(0.036, 0.17, 0.036, 0, -0.12, -0.03, M.black(), 0.08), 'mag');
  b.box(0.04, 0.07, 0.17, 0, -0.01, 0.255, M.poly());
  b.box(0.03, 0.03, 0.04, 0, 0.05, -0.02, M.black());
  triggerGroup(b, 0, -0.035, 0.0);
  ironSights(b, { y: 0.066, zr: 0.1, zf: -0.26, br: 0.035, bf: 0.035 });
  return b.done({ muzzle: V(0, 0.008, -0.34), sightY: 0.066, grip: V(0, -0.085, 0.09), fore: V(0, -0.04, -0.2), pistol: false, side: V(0.03, -0.005, -0.22), mount: V(0, 0.035, 0.0), under: V(0, -0.035, -0.2) });
}


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

const BUILDERS = { smg: buildSmg, ar: buildAR, ak: buildAK, bolt: buildBolt, pump: buildPump, glock: buildGlock, m1911: build1911, revolver: buildRevolver,
  mp5: buildMp5, p90: buildP90, scar: buildScar, lmg: buildLmg, dmr: buildDmr, aa12: buildAa12, deagle: buildDeagle, skorp: buildSkorp };

// ------------------------------------------------------------------------------------------------
// Baked model (FBX -> JSON)
// ------------------------------------------------------------------------------------------------
function buildFromAsset(w, data) {
  const g = new THREE.Group(), a = w.asset;
  for (const part of data.parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(part.positions), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(part.normals), 3));
    geo.setIndex(part.indices);
    const color = parseInt(part.color.slice(1), 16);
    const me = new THREE.Mesh(geo, mat(color, 0.2, 0.55));
    if (/^mag$/i.test(part.name || '')) me.userData.mag = true;
    if (part.name === 'iron') me.userData.iron = true;            // the model's own iron sights (hidden when a red dot is fitted)
    g.add(me);
  }
  const anc = data.anchors || {};
  const p = (name, off = [0, 0, 0]) => { const c = anc[name] || [0, -0.05, 0]; return V(c[0] + off[0], c[1] + off[1], c[2] + off[2]); };
  g.userData = {
    muzzle: V(...data.muzzle), sightY: data.sights ? data.sightY : 0.092,
    grip: p(a.grip, a.gripOffset), fore: p(a.fore, a.foreOffset), pistol: false,
    mount: V(...(a.mount || [0, data.sightY - 0.008, 0])), under: V(...(a.under || [0, -0.05, -0.1])), side: V(...(a.side || [0.025, -0.02, -0.2])),
  };
  if (!data.sights) { const bb = new B(); bb.g = g; ironSights(bb, { y: 0.092, zr: 0.11, zf: -0.2, br: 0.073, bf: 0.073 }); }   // the VMP model has no sights of its own; the Super 46 brings its own
  return g;
}

// ------------------------------------------------------------------------------------------------
// Attachments (red dot, vertical grip, laser) - built from the gun's `mount` / `under` anchors
// ------------------------------------------------------------------------------------------------
const dotRed = () => mat(0xff2a1a, 0, 1, { emissive: 0xff2a1a, emissiveIntensity: 2 });
function addAttachments(g, w) {
  const u = g.userData, mask = w.attMask || 0, b = new B(); b.g = g;
  if ((mask & 1) && u.mount) {
    g.traverse((o) => { if (o.userData && o.userData.iron) o.visible = false; });
    const m = u.mount, z = m.z;
    if (u.pistol) {                                         // compact slide-mounted reflex sight
      const cy = m.y + 0.014;
      const S = (o) => mark(o, 'slide');           // the sight rides on the slide
      S(b.box(0.024, 0.004, 0.042, 0, m.y + 0.002, z, M.black()));
      S(b.box(0.024, 0.004, 0.042, 0, m.y + 0.0255, z, M.black()));
      S(b.box(0.004, 0.024, 0.042, 0.0105, cy, z, M.black())); S(b.box(0.004, 0.024, 0.042, -0.0105, cy, z, M.black()));
      S(b.box(0.017, 0.018, 0.002, 0, cy, z + 0.015, mat(0x7fb6d8, 0.1, 0.05, { transparent: true, opacity: 0.16 })));
      S(b.ball(0.0012, 0, cy, z, dotRed()));
      u.sightY = cy;
    } else {                                                // tube-less open reflex sight on the top rail
      const cy = m.y + 0.026, h0 = cy - 0.018 - m.y;
      if (h0 > 0.002) b.box(0.026, h0, 0.06, 0, m.y + h0 / 2, z, M.blued());
      b.box(0.03, 0.006, 0.07, 0, cy - 0.015, z, M.black());
      b.box(0.03, 0.007, 0.07, 0, cy + 0.0145, z, M.black());
      b.box(0.004, 0.034, 0.07, 0.0135, cy, z, M.black()); b.box(0.004, 0.034, 0.07, -0.0135, cy, z, M.black());
      b.box(0.023, 0.021, 0.002, 0, cy, z + 0.02, mat(0x7fb6d8, 0.1, 0.05, { transparent: true, opacity: 0.16 }));
      b.ball(0.0015, 0, cy, z, dotRed());
      u.sightY = cy;
    }
  }
  if ((mask & 2) && !u.pistol && u.under) {
    const m = u.under, h = 0.08;
    b.box(0.022, 0.012, 0.05, 0, m.y - 0.004, m.z, M.blued());                       // rail clamp
    b.box(0.026, h, 0.03, 0, m.y - 0.01 - h / 2, m.z, M.poly(), 0.1);                // grip body
    for (let i = 0; i < 4; i++) b.box(0.028, 0.004, 0.032, 0, m.y - 0.026 - i * 0.015, m.z + 0.005, M.black(), 0.1);
    b.box(0.026, 0.008, 0.032, 0, m.y - 0.01 - h, m.z + 0.008, M.blued());           // base cap
    u.fore = V(0, m.y - 0.01 - h / 2 + 0.045, m.z + 0.004);                          // support hand moves to the grip
  }
  if ((mask & 4) && u.pistol && u.under) {
    const m = u.under, cy = m.y - 0.011;
    b.box(0.022, 0.022, 0.05, 0, cy, m.z, M.black());
    b.box(0.012, 0.012, 0.004, 0, cy, m.z - 0.027, dotRed());                       // emitter
    b.box(0.006, 0.006, 0.014, 0.0125, cy + 0.004, m.z + 0.01, M.steel());           // switch
    u.laser = V(0, cy, m.z - 0.029);
  } else if ((mask & 4) && !u.pistol && u.side) {                                    // rifles: clamped to the right side of the handguard
    const m = u.side, x = m.x + 0.011;
    b.box(0.006, 0.02, 0.04, m.x + 0.002, m.y, m.z, M.blued());                    // side rail clamp
    b.box(0.02, 0.02, 0.056, x + 0.004, m.y, m.z, M.black());                       // body
    b.box(0.012, 0.012, 0.004, x + 0.004, m.y, m.z - 0.03, dotRed());              // emitter
    b.box(0.012, 0.006, 0.016, x + 0.004, m.y + 0.013, m.z + 0.01, M.steel());      // adjustment block
    u.laser = V(x + 0.004, m.y, m.z - 0.032);
  }
}

export function buildGun(w) {
  const data = w.asset && MODEL_DATA[w.asset.id];
  const g = data ? buildFromAsset(w, data) : (BUILDERS[w.builder] || buildSmg)();
  if (w.attMask) addAttachments(g, w);
  return g;
}
