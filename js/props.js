import * as THREE from 'three';

// Map props (shipping containers, crates, barrels, racking, roller shutters, doors), built in code from boxes and cylinders so they match the
// blocky style of the soldiers and guns. Each prop is ONE merged mesh with vertex colours (one draw call). Models are built at their natural size in
// metres with the origin at the bottom centre; maps fit them into a w x h x d box. Crates use the wood-grain image (assets/tex/crate.jpg).
export const PROPS = {};   // name -> { geo, size:[x,y,z] }
export const PROP_NAMES = ['container', 'barrel', 'racking', 'shutter', 'crate', 'door', 'car', 'hvac', 'solar'];
export const PROP_TEX = { crate: 'crate' };       // props that also use an image texture (box-projected UVs)

const lin = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255].map((c) => Math.pow(c, 2.2));

class Mesh {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.i = []; this.k = 0; }
  quad(a, b, c, d, nrm, col, uvk, ax) {                    // four corners (counter-clockwise seen from outside)
    const o = this.p.length / 3;
    for (const v of [a, b, c, d]) { this.p.push(v[0], v[1], v[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.c.push(col[0], col[1], col[2]); }
    const u = (v) => [v[ax[0]] * uvk, v[ax[1]] * uvk];
    for (const v of [a, b, c, d]) this.uv.push(...u(v));
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  // box centred on (x, y, z) with size (w, h, d), optionally rotated (euler XYZ, radians) about its centre
  box(x, y, z, w, h, d, hex, rx = 0, ry = 0, rz = 0, o = {}) {
    const j = o.shade === false ? 1 : 0.94 + ((this.k++ * 37) % 11) / 100;
    const col = lin(hex).map((c) => Math.min(1, c * j));
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    const rot = (v) => {
      let [a, b, c] = v;
      [b, c] = [b * cx - c * sx, b * sx + c * cx];
      [a, c] = [a * cy + c * sy, -a * sy + c * cy];
      [a, b] = [a * cz - b * sz, a * sz + b * cz];
      return [a, b, c];
    };
    const hw = w / 2, hh = h / 2, hd = d / 2, uvk = o.uvk || 1.4;
    const F = [                                            // [corners], normal, uv axes
      [[[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]], [1, 0, 0], [2, 1]],
      [[[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]], [-1, 0, 0], [2, 1]],
      [[[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]], [0, 1, 0], [0, 2]],
      [[[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]], [0, -1, 0], [0, 2]],
      [[[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]], [0, 0, 1], [0, 1]],
      [[[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]], [0, 0, -1], [0, 1]],
    ];
    for (const [cs, nr, ax] of F) {
      const pts = cs.map((v) => { const r = rot(v); return [r[0] + x, r[1] + y, r[2] + z]; });
      this.quad(pts[0], pts[1], pts[2], pts[3], rot(nr), col, uvk, ax);
    }
  }
  // vertical cylinder from y0 to y0 + h
  cyl(x, y0, z, r, h, hex, seg = 14, o = {}) {
    const col = lin(hex), a0 = o.r2 ?? r, o0 = this.p.length / 3;
    for (let s = 0; s <= seg; s++) {
      const t = (s / seg) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
      this.p.push(x + c * r, y0, z + sn * r, x + c * a0, y0 + h, z + sn * a0);
      this.n.push(c, 0, sn, c, 0, sn); this.c.push(...col, ...col); this.uv.push(s / seg, 0, s / seg, h);
    }
    for (let s = 0; s < seg; s++) { const a = o0 + s * 2; this.i.push(a, a + 3, a + 1, a, a + 2, a + 3); }
    const cap = (y, rr, ny) => {                           // flat disc
      const c0 = this.p.length / 3; this.p.push(x, y, z); this.n.push(0, ny, 0); this.c.push(...col); this.uv.push(0.5, 0.5);
      for (let s = 0; s <= seg; s++) { const t = (s / seg) * Math.PI * 2; this.p.push(x + Math.cos(t) * rr, y, z + Math.sin(t) * rr); this.n.push(0, ny, 0); this.c.push(...col); this.uv.push(0.5 + Math.cos(t) * 0.5, 0.5 + Math.sin(t) * 0.5); }
      for (let s = 0; s < seg; s++) { if (ny > 0) this.i.push(c0, c0 + s + 2, c0 + s + 1); else this.i.push(c0, c0 + s + 1, c0 + s + 2); }
    };
    if (o.top !== false) cap(y0 + h, a0, 1);
    if (o.bottom) cap(y0, r, -1);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    return g;
  }
}

// ---- 20 ft shipping container: 6 x 2.6 x 2.4 (white body so the map can tint it), corrugated sides and roof, steel frame, locking-bar doors
function container() {
  const m = new Mesh(), L = 5.9, W = 2.3, H = 2.5, STEEL = 0x6b737b;
  m.box(0, 0.1 + H / 2, 0, L, H, W, 0xdedede, 0, 0, 0, { shade: false });                       // body
  for (let i = 0; i < 38; i++) {                                                                  // corrugated side ribs (both sides)
    const x = -2.8 + i * 0.1514, c = i % 2 ? 0xffffff : 0xcfcfcf;
    m.box(x, 0.1 + H / 2, W / 2 + 0.025, 0.085, H - 0.12, 0.05, c); m.box(x, 0.1 + H / 2, -W / 2 - 0.025, 0.085, H - 0.12, 0.05, c);
  }
  for (let i = 0; i < 38; i++) m.box(-2.8 + i * 0.1514, 0.1 + H + 0.02, 0, 0.085, 0.045, W - 0.2, i % 2 ? 0xffffff : 0xcfcfcf);   // roof ribs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.box(sx * (L / 2 + 0.03), 1.3, sz * (W / 2 + 0.02), 0.16, 2.6, 0.16, STEEL, 0, 0, 0, { shade: false });        // corner posts
    m.box(sx * (L / 2 - 0.12), 2.6 - 0.04, sz * (W / 2 - 0.05), 0.24, 0.1, 0.24, 0x3a3f45, 0, 0, 0, { shade: false });   // corner casting
  }
  for (const sz of [-1, 1]) { m.box(0, 2.56, sz * (W / 2 + 0.03), L + 0.1, 0.12, 0.14, STEEL); m.box(0, 0.08, sz * (W / 2 + 0.03), L + 0.1, 0.16, 0.14, STEEL); }   // top / bottom rails
  for (const sx of [-1, 1]) { m.box(sx * (L / 2 + 0.03), 2.56, 0, 0.14, 0.12, W + 0.08, STEEL); m.box(sx * (L / 2 + 0.03), 0.08, 0, 0.14, 0.16, W + 0.08, STEEL); }   // end rails
  for (const x of [-1.2, 1.2]) m.box(x, 0.0, 0, 0.5, 0.1, W - 0.1, 0x3a3f45);                      // forklift skids
  // door end (+x): two leaves with four locking bars and handles
  for (const sz of [-1, 1]) {
    m.box(L / 2 + 0.01, 1.35, sz * 0.58, 0.05, 2.28, 1.08, 0xe8e8e8);
    for (const dz of [0.14, 0.5, 0.9]) m.cyl(L / 2 + 0.07, 0.25, sz * dz - sz * 0.02, 0.022, 2.18, 0x6c7176, 8);
    m.box(L / 2 + 0.1, 1.1, sz * 0.2, 0.05, 0.22, 0.05, 0x8a9199);
  }
  m.box(L / 2 + 0.04, 1.3, 0, 0.06, 2.3, 0.05, STEEL);                                            // centre seam
  m.box(-L / 2 - 0.005, 1.35, 0, 0.04, 2.3, W - 0.2, 0xd0d0d0);                                     // closed back end
  return { geo: m.geometry(), size: [6.1, 2.62, 2.5] };
}

// ---- wooden crate: 1 x 1 x 1 (wood-grain texture), corner posts, plank faces, diagonal braces
function crate() {
  const m = new Mesh(), P = [0xdbb98e, 0xf0d2a4, 0xcfa878, 0xe6c294], F = 0xa77a4c;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(sx * 0.44, 0.5, sz * 0.44, 0.12, 1, 0.12, F, 0, 0, 0, { uvk: 2 });          // corner posts
  for (const y of [0.04, 0.96]) for (const s of [-1, 1]) {                                                                        // top / bottom rims
    m.box(0, y, s * 0.44, 0.76, 0.08, 0.12, F, 0, 0, 0, { uvk: 2 }); m.box(s * 0.44, y, 0, 0.12, 0.08, 0.76, F, 0, 0, 0, { uvk: 2 });
  }
  let k = 0;
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {                                                                          // plank faces
    m.box(0, 0.19 + i * 0.205, s * 0.465, 0.76, 0.185, 0.06, P[k++ % 4], 0, 0, 0, { uvk: 1.6 });
    m.box(s * 0.465, 0.19 + i * 0.205, 0, 0.06, 0.185, 0.76, P[k++ % 4], 0, 0, 0, { uvk: 1.6 });
  }
  for (const s of [-1, 1]) {                                                                                                      // diagonal braces
    m.box(0, 0.5, s * 0.5, 1.02, 0.1, 0.04, F, 0, 0, s * 0.78, { uvk: 2 });
    m.box(s * 0.5, 0.5, 0, 0.04, 0.1, 1.02, F, s * 0.78, 0, 0, { uvk: 2 });
  }
  for (let i = 0; i < 4; i++) m.box(-0.33 + i * 0.22, 1.0, 0, 0.19, 0.035, 0.88, P[i], 0, 0, 0, { uvk: 1.6 });                     // lid boards
  return { geo: m.geometry(), size: [1.02, 1.04, 1.02] };
}

// ---- barrel: 0.6 x 0.9 x 0.6, ribbed steel drum with hoops, rim and two bungs
function barrel() {
  const m = new Mesh(), BODY = 0xffffff, HOOP = 0xb8b8b8;
  m.cyl(0, 0, 0, 0.27, 0.9, BODY, 14, { bottom: true });
  for (const y of [0.1, 0.45, 0.78]) m.cyl(0, y, 0, 0.292, 0.05, HOOP, 14, { top: false });
  m.cyl(0, 0.86, 0, 0.285, 0.05, 0xe6e6e6, 14);                                                // top rim
  m.cyl(0, 0.0, 0, 0.285, 0.04, HOOP, 14, { top: false });                                     // bottom rim
  m.cyl(0.09, 0.9, 0.06, 0.04, 0.025, 0xc9cdd1, 8); m.cyl(-0.1, 0.9, -0.07, 0.028, 0.02, 0xc9cdd1, 8);   // bungs
  m.box(0, 0.905, 0, 0.3, 0.006, 0.02, 0x1f4373, 0, 0, 0, { shade: false });
  return { geo: m.geometry(), size: [0.6, 0.93, 0.6] };
}

// ---- pallet racking bay: 4.2 x 4 x 2.2, orange uprights with bracing, blue beams, decking and a few cartons
function racking() {
  const m = new Mesh(), OR = 0xe5801c, BL = 0x2a5aa6;
  for (const sx of [-1, 1]) {                                                                   // two end frames
    const x = sx * 2.0;
    for (const sz of [-1, 1]) m.box(x, 2.0, sz * 1.0, 0.1, 4.0, 0.08, OR, 0, 0, 0, { shade: false });
    for (let i = 0; i < 4; i++) {                                                               // zig-zag bracing
      const y0 = 0.3 + i * 0.9, a = Math.atan2(1.9, 0.9) * (i % 2 ? -1 : 1);
      m.box(x, y0 + 0.45, 0, 0.05, Math.hypot(1.9, 0.9), 0.04, OR, a, 0, 0);
    }
    m.box(x, 0.02, 0, 0.16, 0.04, 2.2, 0x2a2d31); m.box(x, 3.97, 0, 0.1, 0.06, 2.1, OR);
  }
  const cart = [[0, 0.5], [1, 0.8], [2, 0.3]];
  for (let lv = 0; lv < 3; lv++) {
    const y = 0.45 + lv * 1.25;
    for (const sz of [-1, 1]) m.box(0, y, sz * 0.96, 4.0, 0.14, 0.07, BL, 0, 0, 0, { shade: false });   // beams
    m.box(0, y + 0.085, 0, 3.95, 0.03, 1.9, 0x7c8186);                                                  // decking
    for (let b = 0; b < 3; b++) {                                                                     // cartons
      if ((lv + b) % 2) continue;
      const w = 0.7 + ((lv * 3 + b) % 3) * 0.15, h = 0.45 + ((lv + b * 2) % 3) * 0.12;
      m.box(-1.3 + b * 1.3 + lv * 0.1, y + 0.1 + h / 2, 0.05, w, h, 0.8, [0xb48a56, 0x9c7544, 0xc59b66][(lv + b) % 3], 0, 0.04 * (b - 1), 0);
      m.box(-1.3 + b * 1.3 + lv * 0.1, y + 0.1 + h / 2, 0.05, w + 0.01, 0.03, 0.82, 0x6f5330, 0, 0.04 * (b - 1), 0);
    }
  }
  return { geo: m.geometry(), size: [4.2, 4.0, 2.2] };
}

// ---- roller shutter: 3.47 x 3.15 x 0.33
function shutter() {
  const m = new Mesh();
  m.box(0, 3.0, 0, 3.47, 0.3, 0.33, 0x2f3438, 0, 0, 0, { shade: false });                          // housing
  for (const sx of [-1, 1]) m.box(sx * 1.67, 1.5, 0, 0.14, 3.0, 0.3, 0x3a4046, 0, 0, 0, { shade: false });   // guide rails
  for (let i = 0; i < 33; i++) m.box(0, 0.2 + i * 0.0845, 0, 3.2, 0.075, 0.07, i % 2 ? 0xb6bcc2 : 0xa2a9b0);   // slats
  m.box(0, 0.08, 0, 3.3, 0.14, 0.14, 0x2f3438);                                                      // bottom bar
  for (let i = 0; i < 8; i++) m.box(-1.5 + i * 0.43, 0.08, 0.075, 0.2, 0.1, 0.02, i % 2 ? 0x15171a : 0xd8a416, 0, 0, 0.5);   // hazard stripes
  m.box(0, 0.9, 0.09, 0.12, 0.2, 0.05, 0x1f2326);                                                    // handle
  return { geo: m.geometry(), size: [3.47, 3.15, 0.33] };
}

// ---- industrial double door in a steel frame: 3.76 x 3.57 x 0.36
function door() {
  const m = new Mesh(), FR = 0x66707a;
  for (const sx of [-1, 1]) m.box(sx * 1.78, 1.785, 0, 0.2, 3.57, 0.36, FR, 0, 0, 0, { shade: false });   // posts
  m.box(0, 3.45, 0, 3.76, 0.25, 0.36, FR, 0, 0, 0, { shade: false });                                      // lintel
  m.box(0, 0.03, 0, 3.4, 0.06, 0.34, 0x24292d);                                                           // threshold
  for (const sx of [-1, 1]) {
    const x = sx * 0.8;
    m.box(x, 1.65, 0, 1.54, 3.2, 0.08, 0x5f6d68);                                                         // leaf
    m.box(x, 0.3, 0.045, 1.5, 0.5, 0.03, 0x4a5550);                                                       // kick plate
    m.box(x, 2.3, 0.045, 0.7, 0.55, 0.03, 0x1b2a33); m.box(x, 2.3, 0.05, 0.78, 0.63, 0.02, 0x2a3036);    // window + trim
    m.box(sx * 0.2, 1.15, 0.09, 0.08, 0.5, 0.08, 0xb6bcc2);                                                // push bar
    for (const y of [0.5, 1.65, 2.8]) m.box(sx * 1.55, y, 0.06, 0.07, 0.2, 0.06, 0x2a2e32);              // hinges
  }
  m.box(0, 1.65, 0, 0.04, 3.2, 0.1, 0x20252a);                                                            // centre gap
  m.box(0, 3.6 - 0.14, 0.19, 3.7, 0.05, 0.02, 0xd8a416);                                                  // yellow trim
  return { geo: m.geometry(), size: [3.76, 3.57, 0.36] };
}

// ---- wrecked / parked car: 4.2 x 1.7 x 1.9 (body white so maps can tint it)
function car() {
  const m = new Mesh(), TY = 0x1b1d20, GL = 0x2a3b48;
  m.box(0, 0.62, 0, 4.2, 0.62, 1.8, 0xffffff, 0, 0, 0, { shade: false });                 // lower body
  m.box(-0.15, 1.2, 0, 2.2, 0.55, 1.62, 0xf2f2f2);                                          // cabin
  for (const s of [-1, 1]) m.box(-0.15, 1.22, s * 0.82, 1.9, 0.38, 0.03, GL);
  m.box(0.95, 1.22, 0, 0.03, 0.36, 1.4, GL); m.box(-1.25, 1.22, 0, 0.03, 0.36, 1.4, GL);   // wind/rear screens
  m.box(1.55, 0.97, 0, 1.0, 0.06, 1.7, 0xe0e0e0);                                           // bonnet
  m.box(2.11, 0.55, 0, 0.06, 0.2, 1.5, 0x3a3f45);                                           // bumpers
  m.box(-2.11, 0.55, 0, 0.06, 0.2, 1.5, 0x3a3f45);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { m.cyl(sx * 1.35, 0.0, sz * 0.9, 0.34, 0.2, TY, 12, { bottom: true }); m.box(sx * 1.35, 0.3, sz * 0.9, 0.7, 0.05, 0.22, 0x555a60); }
  for (const s of [-1, 1]) m.box(2.12, 0.78, s * 0.6, 0.04, 0.12, 0.28, 0xf6e9a8);          // headlights
  return { geo: m.geometry(), size: [4.3, 1.5, 1.9] };
}

// ---- rooftop HVAC unit: 5 x 3 x 2.4, casing, louvres, fan grille and a duct
function hvac() {
  const m = new Mesh(), C = 0xb9bec4;
  m.box(0, 1.1, 0, 5, 2.2, 3, C, 0, 0, 0, { shade: false });
  m.box(0, 2.25, 0, 5.1, 0.1, 3.1, 0x8a9098);
  for (let i = 0; i < 10; i++) for (const s of [-1, 1]) m.box(-2.0 + i * 0.44, 1.2, s * 1.52, 0.3, 1.2, 0.04, 0x6f757c);   // louvres
  m.cyl(-1.0, 2.3, 0, 0.8, 0.12, 0x2a2d31, 16); m.cyl(-1.0, 2.42, 0, 0.62, 0.03, 0x555a60, 16);
  for (let i = 0; i < 4; i++) m.box(-1.0, 2.46, 0, 1.4, 0.02, 0.05, 0x2a2d31, 0, i * Math.PI / 4, 0);
  m.box(1.5, 2.55, 0, 1.6, 0.45, 1.2, 0xa0a6ad);                                            // duct block
  m.box(2.55, 0.55, 0, 0.1, 0.9, 1.6, 0x6f757c);                                            // service panel
  m.box(0, 0.06, 0, 5.2, 0.12, 3.2, 0x3a3f45);                                              // base rail
  return { geo: m.geometry(), size: [5.2, 2.6, 3.2] };
}

// ---- solar panel row: 6 x 1.6 x 1.0, tilted panels on a frame
function solar() {
  const m = new Mesh(), A = 0.4;
  for (const x of [-2.6, 0, 2.6]) { m.box(x, 0.25, 0.55, 0.07, 0.5, 0.07, 0x9aa0a6); m.box(x, 0.5, -0.55, 0.07, 1.0, 0.07, 0x9aa0a6); }
  m.box(0, 0.74, 0, 5.9, 0.07, 1.5, 0xc7ccd1, A, 0, 0, { shade: false });                    // frame
  m.box(0, 0.775, 0, 5.74, 0.03, 1.34, 0x1e3a66, A, 0, 0, { shade: false });                // glass
  for (let i = 1; i < 8; i++) m.box(-2.87 + i * 0.7175, 0.79, 0, 0.03, 0.03, 1.34, 0xaab4c4, A, 0, 0, { shade: false });
  m.box(0, 0.79, 0, 5.74, 0.03, 0.03, 0xaab4c4, A, 0, 0, { shade: false });
  return { geo: m.geometry(), size: [6, 1.1, 1.6] };
}

const BUILD = { container, crate, barrel, racking, shutter, door, car, hvac, solar };

export async function loadProps(names = PROP_NAMES) {
  for (const n of names) {
    if (PROPS[n] || !BUILD[n]) continue;
    try { PROPS[n] = BUILD[n](); } catch (e) { /* the box underneath stays as the fallback */ }
  }
  return Object.keys(PROPS);
}

const texCache = new Map();
// Image texture. `unique` returns a private copy (needed when you change repeat, e.g. the ground).
export function imgTex(name, unique = false) {
  if (!unique && texCache.has(name)) return texCache.get(name);
  const t = new THREE.TextureLoader().load(`assets/tex/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (!unique) texCache.set(name, t);
  return t;
}
