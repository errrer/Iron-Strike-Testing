// Map definitions. Pure data + geometry helpers (no rendering code) so they can be unit-tested in Node.
// Coordinates: x = east/west, z = north/south, y = up. Every map is 80 x 56 metres: x in [-40,40], z in [-28,28].

export const BOUNDS = { x0: -40, x1: 40, z0: -28, z1: 28 };

class Builder {
  constructor() { this.boxes = []; this.visuals = []; }

  // Solid box (collides + renders). Centre x,z; size w(x) d(z) h(y); starts at y0.
  box(x, z, w, d, h, o = {}) {
    const y0 = o.y0 || 0;
    if (o.collide !== false) this.boxes.push({ x0: x - w / 2, x1: x + w / 2, y0, y1: y0 + h, z0: z - d / 2, z1: z + d / 2 });
    this.visuals.push({ shape: 'box', x, z, y0, w, h, d, tex: o.tex || 'concrete', color: o.color ?? 0x888888, tile: o.tile || 4, emissive: o.emissive, cast: o.cast, opacity: o.opacity });
  }
  // Procedural prop (js/props.js) fitted into w(x) x d(z) x h(y), rot = quarter turns about Y. Visual only.
  prop(model, x, z, w, d, h, o = {}) { this.visuals.push({ shape: 'prop', model, x, z, y0: o.y0 || 0, w, d, h, rot: o.rot || 0, tex: o.tex || model, tint: o.tint ?? (model === 'barrel' ? 0x3f7fcc : 0xffffff), rough: o.rough, metal: o.metal }); }
  // Procedural prop over an exact collision box (the plain box underneath is the fallback if the prop fails to build)
  solid(model, x, z, w, d, h, o = {}) {
    this.box(x, z, w - 0.06, d - 0.06, h - 0.06, { tex: o.tex || 'metal', color: o.color ?? 0x888888, tile: 3, cast: false });
    this.boxes[this.boxes.length - 1] = { x0: x - w / 2, x1: x + w / 2, y0: o.y0 || 0, y1: (o.y0 || 0) + h, z0: z - d / 2, z1: z + d / 2 };
    this.visuals[this.visuals.length - 1].fb = model;
    this.prop(model, x, z, w, d, h, o);
  }
  // Visual only (no collision)
  deco(x, z, w, d, h, o = {}) { this.box(x, z, w, d, h, { ...o, collide: false }); }
  // Cylinder (collides as a square box)
  cyl(x, z, r, h, o = {}) {
    const y0 = o.y0 || 0;
    if (o.collide !== false) this.boxes.push({ x0: x - r, x1: x + r, y0, y1: y0 + h, z0: z - r, z1: z + r });
    this.visuals.push({ shape: 'cyl', x, z, y0, r, h, tex: o.tex || 'metal', color: o.color ?? 0x888888, tile: o.tile || 3, emissive: o.emissive });
  }
  cone(x, z, r, h, o = {}) { this.visuals.push({ shape: 'cone', x, z, y0: o.y0 || 0, r, h, tex: 'plain', color: o.color ?? 0x244a2c, tile: 3 }); }
  disc(x, z, r, o = {}) { this.visuals.push({ shape: 'disc', x, z, y0: o.y0 || 0.01, r, h: 0.04, tex: o.tex || 'plain', color: o.color ?? 0x556677, tile: 4 }); }

  // Axis-aligned wall from (x0,z0) to (x1,z1) with openings: {at: distance from start, w, type:'door'|'window'}
  wall(x0, z0, x1, z1, t, h, o = {}, openings = []) {
    const horiz = z0 === z1;
    const start = horiz ? Math.min(x0, x1) : Math.min(z0, z1);
    const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      const c = start + (a + b) / 2, l = b - a;
      if (horiz) this.box(c, z0, l, t, yb - ya, { ...o, y0: ya });
      else this.box(x0, c, t, l, yb - ya, { ...o, y0: ya });
    };
    let cur = 0;
    for (const op of [...openings].sort((a, b) => a.at - b.at)) {
      const s = op.at - op.w / 2, e = op.at + op.w / 2;
      if (s > cur) seg(cur, s, 0, h);
      if (op.type === 'window') { seg(s, e, 0, 0.95); seg(s, e, 2.15, h); }
      cur = e;
    }
    if (cur < len) seg(cur, len, 0, h);
  }

  // Hollow building. doors: array of sides 'px','nx','pz','nz'. windows: sides that get a window.
  building(cx, cz, w, d, h, o = {}) {
    const t = 0.5, doors = o.doors || [], wins = o.windows || [];
    const sides = {
      nz: [cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, w],
      pz: [cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, w],
      nx: [cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, d],
      px: [cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, d],
    };
    for (const k of Object.keys(sides)) {
      const [a, b, c, e, len] = sides[k];
      const ops = [];
      if (doors.includes(k)) ops.push({ at: len / 2, w: 2.6, type: 'door' });
      if (wins.includes(k)) { ops.push({ at: len * 0.2, w: 1.6, type: 'window' }); ops.push({ at: len * 0.8, w: 1.6, type: 'window' }); }
      this.wall(a, b, c, e, t, h, o, ops);
    }
    this.box(cx, cz, w + 0.8, d + 0.8, 0.3, { ...o, y0: h, tex: o.roofTex || 'concrete', color: o.roofColor ?? 0x6b6258 });
  }

  // Stairs rising from (x,z) in direction dir ('px','nx','pz','nz')
  stairs(x, z, dir, n, width, rise, run, o = {}) {
    for (let i = 0; i < n; i++) {
      const off = (i + 0.5) * run, top = (i + 1) * rise;
      if (dir === 'nx') this.box(x - off, z, run, width, top, o);
      else if (dir === 'px') this.box(x + off, z, run, width, top, o);
      else if (dir === 'nz') this.box(x, z - off, width, run, top, o);
      else this.box(x, z + off, width, run, top, o);
    }
  }

  outerWalls(h, o = {}) {
    const B = BOUNDS, t = 2;
    this.box(0, B.z0 - t / 2, (B.x1 - B.x0) + t * 2, t, h, o);
    this.box(0, B.z1 + t / 2, (B.x1 - B.x0) + t * 2, t, h, o);
    this.box(B.x0 - t / 2, 0, t, (B.z1 - B.z0), h, o);
    this.box(B.x1 + t / 2, 0, t, (B.z1 - B.z0), h, o);
  }
}

// seeded RNG so decorations are identical every load
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

const SPAWNS = { 0: { x0: -37, x1: -29, z0: -24, z1: 24 }, 1: { x0: 29, x1: 37, z0: -24, z1: 24 } };

// ------------------------------------------------------------------------------------------
// 1. WAREHOUSE - indoor, containers + central catwalk
// ------------------------------------------------------------------------------------------
function warehouse() {
  const b = new Builder();
  b.outerWalls(12, { tex: 'img:wall', color: 0x9aa2ac, tile: 4 });
  b.box(0, 0, 90, 66, 0.5, { y0: 12, tex: 'metal', color: 0x2d3238, collide: true, cast: false });  // roof
  const cols = [0xb23a2f, 0x2f5fa6, 0x3f8a4a, 0xc7842b, 0x7a4a9b, 0x2f8a8a];
  let ci = 0;
  // containers: the old coloured box stays (inset) as the end caps + the collision, a real container model is laid over it in two halves
  const tint = (c) => { const r = (c >> 16 & 255), g = (c >> 8 & 255), bl = (c & 255), m = (v) => Math.round(255 + (v - 255) * 0.55); return (m(r) << 16) | (m(g) << 8) | m(bl); };
  const cont = (x, z, w, d, y0 = 0) => {
    const col = cols[ci++ % cols.length];
    b.boxes.push({ x0: x - w / 2, x1: x + w / 2, y0, y1: y0 + 2.6, z0: z - d / 2, z1: z + d / 2 });
    b.visuals.push({ shape: 'box', x, z, y0: y0 + 0.05, w: w - 0.25, h: 2.5, d: d - 0.25, tex: 'metal', color: col, tile: 3, cast: false });
    const alongX = w >= d, half = (alongX ? w : d) / 2;
    for (const s of [-1, 1]) b.prop('container', alongX ? x + s * half / 2 : x, alongX ? z : z + s * half / 2, alongX ? half : d, alongX ? d : half, 2.6, { y0, rot: alongX ? (s < 0 ? 2 : 0) : (s < 0 ? 1 : 3), tint: tint(col), metal: 0.4, rough: 0.6 });
  };
  // two long rows of containers (gaps are lanes)
  for (const z of [-12, 12]) for (const x of [-26, -10, 10, 26]) cont(x, z, 12, 2.6);
  cont(-10, -12, 12, 2.6, 2.6); cont(26, 12, 12, 2.6, 2.6);   // stacked
  // central catwalk (reached by stairs both ends)
  b.box(0, 0, 20, 6, 0.4, { y0: 2.8, tex: 'metal', color: 0x3c4046, tile: 2 });
  b.stairs(16.4, 0, 'nx', 8, 3, 0.4, 0.8, { tex: 'metal', color: 0x4b5058, tile: 2 });
  b.stairs(-16.4, 0, 'px', 8, 3, 0.4, 0.8, { tex: 'metal', color: 0x4b5058, tile: 2 });
  b.box(0, 2.85, 20, 0.3, 1.0, { y0: 3.2, tex: 'metal', color: 0xd9a11a, tile: 2 });
  b.box(0, -2.85, 20, 0.3, 1.0, { y0: 3.2, tex: 'metal', color: 0xd9a11a, tile: 2 });
  for (const sx of [-9.7, 9.7]) for (const sz of [-2.8, 2.8]) b.box(sx, sz, 0.6, 0.6, 2.8, { tex: 'metal', color: 0xd9a11a });
  // pillars
  for (const x of [-22, 22]) b.box(x, 0, 1.4, 1.4, 12, { tex: 'concrete', color: 0x6e7379 });
  // crates and pallets in the side lanes
  const crate = (x, z, s = 2, h = 2) => {
    b.box(x, z, s - 0.04, s - 0.04, h - 0.04, { tex: 'crate', color: 0xa07040, tile: 2, cast: false });   // fallback / hidden under the model
    b.boxes[b.boxes.length - 1] = { x0: x - s / 2, x1: x + s / 2, y0: 0, y1: h, z0: z - s / 2, z1: z + s / 2 };
    b.prop('crate', x, z, s, s, h, { rot: ((x * 7 + z * 3) | 0) & 3, rough: 0.9, metal: 0 });
  };
  crate(-8, -22); crate(-5.5, -22, 2, 1.2); crate(8, -21.5); crate(0, -18, 3, 1.2); crate(18, -22, 2.4, 2.4); crate(-18, -23, 2.4, 1.2);
  crate(8, 22); crate(5.5, 22, 2, 1.2); crate(-8, 21.5); crate(0, 18, 3, 1.2); crate(-18, 22, 2.4, 2.4); crate(18, 23, 2.4, 1.2);
  crate(-30, 16, 2, 1.2); crate(-30, -16, 2, 1.2); crate(30, 16, 2, 1.2); crate(30, -16, 2, 1.2);
  crate(-3, -6, 1.6, 1.0); crate(3, 6, 1.6, 1.0);
  // barrels
  for (const [x, z] of [[-14, -6], [-14, 6], [14, -6], [14, 6], [-24, 0], [24, 0]]) { b.boxes.push({ x0: x - 0.32, x1: x + 0.32, y0: 0, y1: 0.9, z0: z - 0.32, z1: z + 0.32 }); b.prop('barrel', x, z, 0.6, 0.6, 0.9, { rot: ((x + z) | 0) & 3, metal: 0.1, rough: 0.8 }); }
  // pallet racking along the north/south walls (solid), roller shutters + big doors on the walls (decor)
  for (const z of [-26.9, 26.9]) for (const x of [-30, -25.6, -14, 14, 25.6, 30]) {
    b.boxes.push({ x0: x - 2.1, x1: x + 2.1, y0: 0, y1: 4, z0: z - 1.1, z1: z + 1.1 });
    b.prop('racking', x, z, 4.2, 2.2, 4);
  }
  for (const z of [-27.8, 27.8]) { b.prop('shutter', 0, z, 3.47, 0.33, 3.15, { rot: 1, rough: 0.5, metal: 0.5 }); b.prop('door', z < 0 ? 8 : -8, z * 0.995, 3.76, 0.36, 3.57, { rough: 0.6, metal: 0.4 }); }
  for (const x of [-39.8, 39.8]) b.prop('shutter', x, 0, 0.33, 3.47, 3.15, { rough: 0.5, metal: 0.5 });
  // ceiling lights (decor)
  for (const x of [-30, -15, 0, 15, 30]) for (const z of [-20, -7, 7, 20]) b.deco(x, z, 6, 0.8, 0.2, { y0: 11.6, tex: 'plain', color: 0xffffff, emissive: 0xfff2d0 });
  return finish(b, {
    id: 'warehouse',
    indoor: true,
    sky: [0x1b1e24, 0x2b2f36], fog: [0x23262c, 30, 85],
    hemi: [0xbfc8d6, 0x2a2a2e, 0.9], sun: null,
    lights: [[-22, 9, -14], [22, 9, -14], [-22, 9, 14], [22, 9, 14], [0, 9, 0]],
    ground: { tex: 'img:floor', color: 0xa4a7ac, tile: 5 },
    impact: 0xd8d0c0,
  });
}

// ------------------------------------------------------------------------------------------
// 2. DUST - desert village
// ------------------------------------------------------------------------------------------
function dust() {
  const b = new Builder();
  b.outerWalls(7, { tex: 'brick', color: 0xb98f5f, tile: 3 });
  const mud = { tex: 'brick', color: 0xc49a66, tile: 3, roofColor: 0x8b6a45 };
  b.building(-24, -13, 10, 8, 3.6, { ...mud, doors: ['px'], windows: ['nz', 'pz'] });
  b.building(-24, 13, 10, 8, 3.6, { ...mud, doors: ['px'], windows: ['nz', 'pz'] });
  b.building(24, -13, 10, 8, 3.6, { ...mud, doors: ['nx'], windows: ['nz', 'pz'] });
  b.building(24, 13, 10, 8, 3.6, { ...mud, doors: ['nx'], windows: ['nz', 'pz'] });
  b.building(-9, -21, 8, 6, 3.4, { ...mud, color: 0xd0a46c, doors: ['pz'], windows: ['px'] });
  b.building(9, 21, 8, 6, 3.4, { ...mud, color: 0xd0a46c, doors: ['nz'], windows: ['nx'] });
  b.building(9, -20, 6, 6, 3.4, { ...mud, doors: ['nx'], windows: ['pz'] });
  b.building(-9, 20, 6, 6, 3.4, { ...mud, doors: ['px'], windows: ['nz'] });
  // plaza with a well and low walls
  b.cyl(0, 0, 1.6, 1.1, { tex: 'brick', color: 0x9c8466 });
  b.box(-6, -5, 7, 0.8, 1.1, { tex: 'brick', color: 0xb08a58 }); b.box(6, 5, 7, 0.8, 1.1, { tex: 'brick', color: 0xb08a58 });
  b.box(-6, 5, 0.8, 5, 1.1, { tex: 'brick', color: 0xb08a58 }); b.box(6, -5, 0.8, 5, 1.1, { tex: 'brick', color: 0xb08a58 });
  // silos
  b.cyl(0, 22, 3, 7.5, { tex: 'brick', color: 0xcdb48a }); b.cyl(0, -22, 3, 7.5, { tex: 'brick', color: 0xcdb48a });
  // market stalls (awning sits above head height)
  for (const [x, z] of [[-14, 0], [14, 0]]) {
    b.box(x, z, 4, 1.6, 1.0, { tex: 'wood', color: 0x8a5a2b, tile: 2 });
    b.deco(x, z, 5, 3, 0.15, { y0: 2.6, tex: 'plain', color: 0xb23a2f });
    for (const dx of [-2.2, 2.2]) b.deco(x + dx, z + 1.4, 0.15, 0.15, 2.6, { tex: 'wood', color: 0x5a3a1b });
  }
  // sandbags near spawns
  b.box(-32, -8, 1.2, 7, 1.2, { tex: 'sand', color: 0x9b8a62 }); b.box(-32, 8, 1.2, 7, 1.2, { tex: 'sand', color: 0x9b8a62 });
  b.box(32, -8, 1.2, 7, 1.2, { tex: 'sand', color: 0x9b8a62 }); b.box(32, 8, 1.2, 7, 1.2, { tex: 'sand', color: 0x9b8a62 });
  // crates + barrels
  const crate = (x, z, s = 1.6, h = 1.6) => b.solid('crate', x, z, s, s, h, { tex: 'crate', color: 0x9a6c3c, rot: ((x * 7 + z * 3) | 0) & 3, rough: 0.9 });
  crate(-17, -2); crate(-17, 2, 1.6, 1.0); crate(17, -2, 1.6, 1.0); crate(17, 2); crate(-2, 11, 2.2, 1.2); crate(2, -11, 2.2, 1.2);
  crate(-14, -24); crate(14, 24); crate(-33, 0, 2, 1.2); crate(33, 0, 2, 1.2);
  for (const [x, z] of [[-3, -3], [3, 3], [-20, 25], [20, -25], [-12, 12], [12, -12]]) b.solid('barrel', x, z, 0.9, 0.9, 1.0, { color: 0x7a4a2a, tint: 0xb5703c, rough: 0.85 });
  // burnt-out car (a long low box + cabin)
  b.solid('car', -1, 17, 4.3, 1.9, 1.5, { color: 0x6e5d4b, tint: 0xb59a78, rough: 0.9 });
  b.solid('car', 1, -17, 4.3, 1.9, 1.5, { color: 0x4b5a6b, tint: 0x8fa6c0, rough: 0.9, rot: 2 });
  return finish(b, {
    id: 'dust',
    sky: [0x5f9fd6, 0xf1d9a8], fog: [0xe6cfa0, 50, 160],
    hemi: [0xfff0d0, 0xb08a5a, 1.0], sun: { color: 0xfff1d0, intensity: 3.2, pos: [-30, 40, 20] },
    ground: { tex: 'sand', color: 0xd2b27c, tile: 8 },
    impact: 0xcdb48a,
  });
}

// ------------------------------------------------------------------------------------------
// 3. SKYLINE - rooftop at dusk
// ------------------------------------------------------------------------------------------
function skyline() {
  const b = new Builder();
  // low visible parapet + tall invisible-ish boundary (so nobody can leave)
  b.outerWalls(1.3, { tex: 'concrete', color: 0x8a8d92, tile: 3 });
  const B = BOUNDS, t = 2, H = 10;
  const inv = { tex: 'plain', color: 0x88aacc, opacity: 0.0, cast: false };
  b.box(0, B.z0 - t / 2 - 2, 90, t, H, inv); b.box(0, B.z1 + t / 2 + 2, 90, t, H, inv);
  b.box(B.x0 - t / 2 - 2, 0, t, 60, H, inv); b.box(B.x1 + t / 2 + 2, 0, t, 60, H, inv);
  const hvac = (x, z, w, d, h = 2.4) => b.solid('hvac', x, z, w, d, h, { color: 0xb9bec4, rough: 0.8, tint: 0xffffff });
  hvac(-14, -8, 5, 3); hvac(14, 8, 5, 3); hvac(-20, 10, 4, 3, 2.2); hvac(20, -10, 4, 3, 2.2); hvac(0, -19, 7, 3, 2.6); hvac(0, 19, 7, 3, 2.6);
  hvac(-10, 20, 3, 3, 2); hvac(10, -20, 3, 3, 2);
  // stair huts
  const hut = { tex: 'concrete', color: 0xa39d92, roofColor: 0x57595e };
  b.building(-30, 0, 7, 8, 3.4, { ...hut, doors: ['px', 'nz'] });
  b.building(30, 0, 7, 8, 3.4, { ...hut, doors: ['nx', 'pz'] });
  // water tank on legs (high enough to walk beneath)
  b.cyl(0, 0, 2.3, 3.2, { y0: 2.4, tex: 'wood', color: 0x7d5a3a });
  for (const dx of [-1.6, 1.6]) for (const dz of [-1.6, 1.6]) b.box(dx, dz, 0.4, 0.4, 2.4, { tex: 'metal', color: 0x444a50 });
  // solar panel rows (jump-over cover)
  for (const [x, z] of [[-9, -19], [9, 19], [-26, -20], [26, 20], [-26, 20], [26, -20]]) b.solid('solar', x, z, 6, 1.6, 1.1, { color: 0x23395b, rough: 0.5 });
  // vent stacks, low pipes
  for (const [x, z] of [[-5, 8], [5, -8], [-17, -17], [17, 17]]) b.cyl(x, z, 0.6, 2.2, { tex: 'metal', color: 0x8f959c });
  b.box(-12, 0, 0.5, 14, 0.5, { tex: 'metal', color: 0x5d6168, collide: true });
  b.box(12, 0, 0.5, 14, 0.5, { tex: 'metal', color: 0x5d6168 });
  // cover blocks
  const blk = (x, z, w, d, h) => b.box(x, z, w, d, h, { tex: 'concrete', color: 0x7e8187 });
  blk(-6, -12, 3, 1.2, 1.2); blk(6, 12, 3, 1.2, 1.2); blk(-6, 12, 1.2, 3, 1.2); blk(6, -12, 1.2, 3, 1.2);
  blk(-34, -18, 3, 3, 2); blk(34, 18, 3, 3, 2); blk(-34, 18, 3, 3, 2); blk(34, -18, 3, 3, 2);
  // helipad (decor)
  b.disc(0, -8.5, 3.6, { color: 0x30343a }); b.disc(0, -8.5, 2.6, { y0: 0.03, color: 0xe6c53a });
  // the tower itself: roof slab, cornice and the building below it (visible when you look over the parapet)
  b.deco(0, 0, 86, 62, 1.6, { y0: -1.64, tex: 'concrete', color: 0x6d7076, tile: 4, cast: false });
  b.deco(0, 0, 80, 56, 40, { y0: -41.6, tex: 'windows', color: 0xffe9c8, tile: 7, cast: false });
  b.deco(0, 0, 84, 60, 0.35, { y0: -2.0, tex: 'concrete', color: 0x4a4d53, tile: 4, cast: false });
  // parapet cap and corner lights
  b.deco(0, B.z0 - 1, 84, 0.5, 0.25, { y0: 1.3, tex: 'concrete', color: 0xb4b7bc, cast: false });
  b.deco(0, B.z1 + 1, 84, 0.5, 0.25, { y0: 1.3, tex: 'concrete', color: 0xb4b7bc, cast: false });
  b.deco(B.x0 - 1, 0, 0.5, 58, 0.25, { y0: 1.3, tex: 'concrete', color: 0xb4b7bc, cast: false });
  b.deco(B.x1 + 1, 0, 0.5, 58, 0.25, { y0: 1.3, tex: 'concrete', color: 0xb4b7bc, cast: false });
  for (const [x, z] of [[-39, -27], [39, -27], [-39, 27], [39, 27]]) {
    b.deco(x, z, 0.3, 0.3, 4.5, { tex: 'metal', color: 0x50565c, cast: false });
    b.deco(x, z, 0.4, 0.4, 0.4, { y0: 4.5, tex: 'plain', color: 0xff3b30, emissive: 0xff3b30, cast: false });
  }
  // neighbouring towers rising out of the haze, some taller than this one, with the street far below
  const r = rng(7);
  for (let i = 0; i < 60; i++) {
    const ang = (i / 60) * Math.PI * 2 + r() * 0.08, rad = 70 + r() * 90;
    const w = 12 + r() * 18, top = -45 + r() * 110 - (rad > 130 ? 20 : 0);
    const x = Math.cos(ang) * rad * 1.35, z = Math.sin(ang) * rad;
    b.deco(x, z, w, w * (0.8 + r() * 0.5), top + 160, { y0: -160, tex: 'windows', color: [0xffffff, 0xd8e4ff, 0xffe2c4][i % 3], tile: 10, cast: false });
    if (top > 10 && i % 3 === 0) { b.deco(x, z, 0.5, 0.5, 14, { y0: top, tex: 'metal', color: 0x50565c, cast: false }); b.deco(x, z, 0.8, 0.8, 0.8, { y0: top + 14, tex: 'plain', color: 0xff3b30, emissive: 0xff3b30, cast: false }); }
  }
  return finish(b, {
    id: 'skyline',
    sky: [0x2b2f5a, 0xf0956a], fog: [0xd88a78, 60, 230],
    hemi: [0xffc9a8, 0x4a3f55, 0.95], sun: { color: 0xffb27a, intensity: 2.6, pos: [40, 22, -30] },
    ground: { tex: 'tile', color: 0x8a8d92, tile: 6, size: [84, 60] }, deep: { y: -150, color: 0xd88a78 },
    impact: 0xb8b8b8,
  });
}

// ------------------------------------------------------------------------------------------
// 4. FROSTBITE - snow compound with watchtowers
// ------------------------------------------------------------------------------------------
function frostbite() {
  const b = new Builder();
  b.outerWalls(6, { tex: 'wood', color: 0x6b5238, tile: 3 });
  const cabin = { tex: 'wood', color: 0x8a6a45, roofColor: 0xdfe6ee, roofTex: 'snow' };
  b.building(-22, -12, 9, 7, 3.2, { ...cabin, doors: ['px'], windows: ['nz', 'pz'] });
  b.building(22, 12, 9, 7, 3.2, { ...cabin, doors: ['nx'], windows: ['nz', 'pz'] });
  b.building(-22, 14, 7, 7, 3.2, { ...cabin, doors: ['nz'], windows: ['px'] });
  b.building(22, -14, 7, 7, 3.2, { ...cabin, doors: ['pz'], windows: ['nx'] });
  // watchtowers (sniper perches), reached by stairs
  const tower = (pz) => {
    const c = pz < 0 ? 1 : -1;                 // direction from the tower towards the map centre
    const edge = pz + c * 2.5;                 // platform edge that faces the centre
    b.box(0, pz, 5, 5, 0.3, { y0: 4.2, tex: 'wood', color: 0x7a5a38, tile: 2 });
    for (const dx of [-2.2, 2.2]) for (const dz of [-2.2, 2.2]) b.box(dx, pz + dz, 0.5, 0.5, 4.2, { tex: 'wood', color: 0x5c4129 });
    b.box(-2.4, pz, 0.2, 5, 1.0, { y0: 4.5, tex: 'wood', color: 0x6a4d30 });
    b.box(2.4, pz, 0.2, 5, 1.0, { y0: 4.5, tex: 'wood', color: 0x6a4d30 });
    b.box(0, pz - c * 2.4, 5, 0.2, 1.0, { y0: 4.5, tex: 'wood', color: 0x6a4d30 });
    // 10 steps x 0.45 rise, 0.8 run: climbs away from the centre and ends flush with the platform
    b.stairs(0, edge + c * 8, c > 0 ? 'nz' : 'pz', 10, 3, 0.45, 0.8, { tex: 'wood', color: 0x7a5a38, tile: 2 });
  };
  tower(-16);   // platform z in [-18.5,-13.5]; stairs start at z=-5.5
  tower(16);
  // rocks
  const rock = (x, z, w, d, h, c = 0x6f757b) => b.box(x, z, w, d, h, { tex: 'concrete', color: c, tile: 3 });
  rock(-9, 0, 4, 3, 2.4); rock(-8, 1.6, 2.4, 2.4, 3.4); rock(-10.5, -1.8, 2, 2, 1.4);
  rock(9, 0, 4, 3, 2.4); rock(8, -1.6, 2.4, 2.4, 3.4); rock(10.5, 1.8, 2, 2, 1.4);
  // sandbag lines & barriers
  b.box(-14, -4, 6, 0.9, 1.15, { tex: 'sand', color: 0x9a9680 }); b.box(14, 4, 6, 0.9, 1.15, { tex: 'sand', color: 0x9a9680 });
  b.box(-31, -10, 1, 6, 1.15, { tex: 'sand', color: 0x9a9680 }); b.box(31, 10, 1, 6, 1.15, { tex: 'sand', color: 0x9a9680 });
  b.box(-31, 10, 1, 6, 1.15, { tex: 'sand', color: 0x9a9680 }); b.box(31, -10, 1, 6, 1.15, { tex: 'sand', color: 0x9a9680 });
  // cargo containers
  // procedural props (js/props.js) over exact collision boxes
  const solid = (...a) => b.solid(...a);
  const cont = (x, z, w, d, col) => solid('container', x, z, w, d, 2.6, { color: col, rot: d > w ? 1 : 0, tint: col, metal: 0.4, rough: 0.6 });
  cont(-7.5, 9, 6, 2.4, 0x6f9bd8); cont(7.5, -9, 6, 2.4, 0xd9675c); cont(-12, -22, 2.4, 6, 0x6fbf7a); cont(12, 22, 2.4, 6, 0xe0a94d);
  // crates
  const crate = (x, z, s = 1.6, h = 1.6) => solid('crate', x, z, s, s, h, { color: 0x8a6a45, tex: 'crate', rot: ((x * 7 + z * 3) | 0) & 3, rough: 0.9, metal: 0 });
  crate(-15, 4); crate(15, -4); crate(-3, -2, 1.6, 1.0); crate(3, 2, 1.6, 1.0); crate(-33, 0, 2, 1.2); crate(33, 0, 2, 1.2);
  // fuel barrels by the cabins
  for (const [x, z] of [[-6, 17], [-6.9, 17.7], [6, -17], [6.9, -17.7], [-26, -1.5], [26, 1.5]]) solid('barrel', x, z, 0.6, 0.6, 0.9, { color: 0x2e6aa8, tex: 'metal', rot: ((x + z) | 0) & 3, metal: 0.1, rough: 0.8 });
  // pines
  const pine = (x, z, s = 1) => { b.box(x, z, 0.6, 0.6, 3 * s, { tex: 'wood', color: 0x4a3524 }); b.cone(x, z, 1.9 * s, 5 * s, { y0: 1.6 * s, color: 0x1f4a2e }); b.cone(x, z, 1.4 * s, 4 * s, { y0: 3.6 * s, color: 0x275a38 }); };
  for (const [x, z, s] of [[-12, -9, 1], [12, 9, 1], [-17, 21, 1.1], [17, -21, 1.1], [-31, -22, 1], [31, 22, 1], [-31, 22, 1], [31, -22, 1], [-5, 24, 1], [5, -24, 1], [13, -7, 0.9], [-13, 7, 0.9], [-26, 0, 1.2], [26, 0, 1.2], [0, 26, 1.1], [0, -26, 1.1]]) pine(x, z, s);
  // frozen pond (decor)
  b.disc(0, 9.5, 4.5, { color: 0x9ccbe8, y0: 0.02 });
  return finish(b, {
    id: 'frostbite',
    snow: true,
    sky: [0x4f6f93, 0xdfe9f2], fog: [0xcfdbe6, 25, 120],
    hemi: [0xdfeaff, 0x8fa0b4, 1.15], sun: { color: 0xe8f0ff, intensity: 2.2, pos: [20, 40, 30] },
    ground: { tex: 'snow', color: 0xf2f6fb, tile: 8 },
    impact: 0xe8eef5,
  });
}


// ------------------------------------------------------------------------------------------
// Zombies map kit: a chain of rooms (walls with 2 m window gaps, bought doorways between rooms) and the raised VMP room.
// ------------------------------------------------------------------------------------------
function zmChain(b, S) {
  const { H, T, wallO, roofO, xs, z0, z1 } = S, zc = (z0 + z1) / 2, windows = [], doors = [];
  const lintel = (cx, cz, w, d) => b.box(cx, cz, w, d, H - 2.7, { ...wallO, y0: 2.7 });
  const nr = xs.length - 1;
  const winsOf = (r, side) => (S.wins || []).filter((w) => w.r === r && w.side === side);
  const hwall = (r, z, side, ins) => {
    const ws = winsOf(r, side), xa = xs[r], xb = xs[r + 1];
    b.wall(xa, z, xb, z, T, H, wallO, ws.map((w) => ({ at: w.at - xa, w: 2, type: 'door' })));
    for (const w of ws) {
      lintel(w.at, z, 2, T);
      windows.push({ id: windows.length, zone: r, x: w.at, z, inx: w.at, inz: z + ins * 1.7, outx: w.at, outz: z - ins * 1.7, w: 2, axis: 'x' });
    }
  };
  for (let r = 0; r < nr; r++) { hwall(r, z0, 'n', 1); hwall(r, z1, 's', -1); }
  const vwall = (x, side, ins, zone, gaps) => {
    b.wall(x, z0, x, z1, T, H, wallO, gaps.map((g) => ({ at: g - z0, w: g === zc && side === 'd' ? 3 : 2, type: 'door' })));
    if (side === 'd') return;
    for (const g of gaps) { lintel(x, g, T, 2); windows.push({ id: windows.length, zone, x, z: g, inx: x + ins * 1.7, inz: g, outx: x - ins * 1.7, outz: g, w: 2, axis: 'z' }); }
  };
  vwall(xs[0], 'w', 1, 0, (S.wins || []).filter((w) => w.side === 'w').map((w) => w.at));
  vwall(xs[nr], 'e', -1, nr - 1, (S.wins || []).filter((w) => w.side === 'e').map((w) => w.at));
  for (let i = 1; i < nr; i++) {
    vwall(xs[i], 'd', 0, 0, [zc]);
    doors.push({ id: i - 1, x: xs[i], z: zc, w: 0.5, d: 3, h: H, cost: S.doorCost[i - 1], opens: i });
  }
  for (let r = 0; r < nr; r++) b.deco((xs[r] + xs[r + 1]) / 2, zc, xs[r + 1] - xs[r] + 0.6, z1 - z0 + 0.6, 0.3, { y0: H, ...roofO });
  return { windows, doors, nz: nr };
}

// Raised room on a solid base (3 m up) reached by a stair on its east side. Holds the VMP wall-buy.
// Zombies climb it through the stair foot / top waypoints described in `upper` (see Zombies.aiZombie).
function zmUpper(b, U) {
  const T = 0.4, { bx0, bx1, bz0, bz1, zc } = U, w = bx1 - bx0, d = bz1 - bz0, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  const wo = { tex: U.tex || 'concrete', color: U.color || 0x6a6e74, tile: 3 }, y0 = 3, H = 3.4;
  b.box(cx, cz, w, d, 3, { tex: 'concrete', color: U.baseColor || 0x4a4e54, tile: 3 });                      // solid base (the floor of the room is its top)
  b.stairs(bx1 + 6.4, zc, 'nx', 8, 2.4, 0.375, 0.8, { tex: 'metal', color: 0x5a6068, tile: 2 });
  const slit = (z, face) => {                                                                                  // wall with a shooting slit
    b.box((bx0 + cx - 1) / 2, z, cx - 1 - bx0, T, H, { ...wo, y0 }); b.box((cx + 1 + bx1) / 2, z, bx1 - cx - 1, T, H, { ...wo, y0 });
    b.box(cx, z, 2, T, 0.9, { ...wo, y0 }); b.box(cx, z, 2, T, 1.3, { ...wo, y0: y0 + 2.1 });
  };
  slit(bz0 + T / 2); slit(bz1 - T / 2);
  b.box(bx0 + T / 2, cz, T, d, H, { ...wo, y0 });                                                              // west wall (the VMP panel hangs on it)
  b.box(bx1 - T / 2, (bz0 + zc - 1.3) / 2, T, zc - 1.3 - bz0, H, { ...wo, y0 });                               // east wall with a doorway
  b.box(bx1 - T / 2, (zc + 1.3 + bz1) / 2, T, bz1 - zc - 1.3, H, { ...wo, y0 });
  b.box(bx1 - T / 2, zc, T, 2.6, 0.8, { ...wo, y0: y0 + 2.6 });
  b.box(cx, cz, w + 0.8, d + 0.8, 0.3, { tex: 'concrete', color: U.roofColor || 0x30343a, y0: y0 + H });       // roof
  b.deco(cx, cz, w - 1.2, d - 1.2, 0.02, { y0: 3.0, tex: 'plain', color: 0x24282c, cast: false });              // dark floor mat
  b.deco(bx1 - 0.5, zc, 0.12, 2.6, 0.04, { y0: 3.0, tex: 'plain', color: 0xd9a11a, emissive: 0xd9a11a, cast: false });   // threshold strip
  return {
    upper: { x0: bx0, x1: bx1, z0: bz0, z1: bz1, y: 3, bot: { x: bx1 + 7.8, z: zc }, top: { x: bx1 - 1.6, z: zc } },
    vmp: { gun: 'vmp', cost: 1000, x: bx0 + T + 0.03, z: zc, y: 3, face: Math.PI / 2 },
    light: [cx, 4.9, cz, 0xffe2b0],
  };
}

// solid machines / box / PaP (players cannot walk through them)
function zmMachines(b, zm) {
  for (const m of [...zm.perks, zm.box, zm.pap]) b.boxes.push({ x0: m.x - m.w / 2, x1: m.x + m.w / 2, y0: 0, y1: 2.2, z0: m.z - m.d / 2, z1: m.z + m.d / 2 });
}

// ------------------------------------------------------------------------------------------
// 5. OUTPOST - zombies map. Three rooms in a row (start room, middle room, back room) inside a walled yard.
//    Windows in the outer walls are where zombies break in (barricade boards are added by zombies.js; the openings are
//    real gaps so the nav graph can route through them). Doors between rooms are bought. Everything gameplay related
//    (windows, doors, wall guns, perk machines, box, Pack-a-Punch) is described in map.zm.
// ------------------------------------------------------------------------------------------
function outpost() {
  const b = new Builder();
  b.outerWalls(6, { tex: 'concrete', color: 0x3c4148, tile: 3 });
  const H = 3.4, T = 0.5, wallO = { tex: 'brick', color: 0x6a5a4e, tile: 3 };
  const windows = [];
  const lintel = (cx, cz, w, d) => b.box(cx, cz, w, d, H - 2.7, { ...wallO, y0: 2.7 });
  // outer wall piece of one room with 2 m wide full-height gaps (windows). side: 'n' | 's' | 'w' | 'e'
  const room = (x0, x1, zone, gaps, sides) => {
    for (const side of sides) {
      const z = side === 'n' ? -10 : 10, ins = side === 'n' ? 1.7 : -1.7;
      b.wall(x0, z, x1, z, T, H, wallO, gaps[side].map((g) => ({ at: g - x0, w: 2, type: 'door' })));
      for (const g of gaps[side]) { lintel(g, z, 2, T); windows.push({ id: windows.length, zone, x: g, z, inx: g, inz: z + ins, outx: g, outz: z - ins, w: 2, axis: 'x' }); }
    }
  };
  room(-30, -10, 0, { n: [-20], s: [-20] }, ['n', 's']);
  room(-10, 10, 1, { n: [0], s: [0] }, ['n', 's']);
  room(10, 30, 2, { n: [20], s: [20] }, ['n', 's']);
  // west / east end walls
  for (const [x, zone, ins] of [[-30, 0, 1.7], [30, 2, -1.7]]) {
    b.wall(x, -10, x, 10, T, H, wallO, [-5, 5].map((g) => ({ at: g + 10, w: 2, type: 'door' })));
    for (const g of [-5, 5]) { lintel(x, g, T, 2); windows.push({ id: windows.length, zone, x, z: g, inx: x + ins, inz: g, outx: x - ins, outz: g, w: 2, axis: 'z' }); }
  }
  // dividers between the rooms, each with a 3 m doorway (closed by a bought door in zombie mode)
  for (const x of [-10, 10]) b.wall(x, -10, x, 10, T, H, wallO, [{ at: 10, w: 3, type: 'door' }]);
  // roofs (visual only)
  for (const cx of [-20, 0, 20]) b.deco(cx, 0, 20.6, 20.6, 0.3, { y0: H, tex: 'concrete', color: 0x30343a });
  // some cover inside the rooms
  b.box(-20, 0, 3, 1.2, 1.0, { tex: 'wood', color: 0x5a4430, tile: 2 });
  b.solid('crate', 0, 0, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x8a6a45 });
  b.solid('crate', 17, 3, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x8a6a45 }); b.solid('crate', 23, -3, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x8a6a45 });
  b.solid('crate', -26, 6, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x8a6a45 }); b.solid('crate', -14, -6, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x8a6a45 });
  // yard: wrecks and barrels for the zombies to shamble around
  for (const [x, z, w, d] of [[-8, -21, 4.2, 1.8], [14, -19, 1.8, 4.2], [33, -17, 4.2, 1.8], [-34, 17, 1.8, 4.2], [-6, 20, 4.2, 1.8], [16, 21, 4.2, 1.8], [34, 20, 1.8, 4.2]]) {
    b.solid('car', x, z, w + 0.1, d + 0.1, 1.5, { color: 0x4a4038, tint: 0x6a5e52, rough: 0.95, rot: d > w ? 1 : 0 });
  }
  for (const [x, z] of [[-24, -16], [26, 14], [0, 16], [-2, -16], [-36, 4]]) b.solid('barrel', x, z, 0.8, 0.8, 1.0, { color: 0x6a3a2a, tint: 0x9a4a32, rough: 0.85 });

  const up = zmUpper(b, { bx0: -36, bx1: -26, bz0: -26, bz1: -17, zc: -21.5 });
  const zm = {
    nz: 3, upper: up.upper,
    windows,
    doors: [{ id: 0, x: -10, z: 0, w: 0.5, d: 3, h: H, cost: 750, opens: 1 }, { id: 1, x: 10, z: 0, w: 0.5, d: 3, h: H, cost: 1250, opens: 2 }],
    // face = direction (radians, 0 = +z/south, PI/2 = +x/east ...) the panel looks into the room
    buys: [
      { id: 0, gun: 'm680', cost: 1000, x: -25, z: -9.7, face: 0 },
      { id: 1, gun: 'g18', cost: 600, x: -25, z: 9.7, face: Math.PI },
      { id: 2, gun: 'm4a1', cost: 1500, x: -5, z: -9.7, face: 0 },
      { id: 3, gun: 'magnum', cost: 800, x: -5, z: 9.7, face: Math.PI },
      { id: 4, gun: 'ak47', cost: 1800, x: 14, z: -9.7, face: 0 },
      { id: 5, gun: 'kar98k', cost: 1200, x: 14, z: 9.7, face: Math.PI },
      { id: 6, ...up.vmp },                                   // the VMP lives in the raised room (north-west yard)
      { id: 7, gun: 'lmg', cost: 2200, x: 28, z: -9.7, face: 0 },
    ],
    perks: [
      { id: 'qr', x: -14, z: -9.1, face: 0, w: 1.7, d: 0.9 },
      { id: 'sc', x: -9.1, z: 5.5, face: Math.PI / 2, w: 0.9, d: 1.7 },
      { id: 'jug', x: 9.1, z: -5.5, face: -Math.PI / 2, w: 0.9, d: 1.7 },
      { id: 'dt', x: 24, z: -9.1, face: 0, w: 1.7, d: 0.9 },
      { id: 'st', x: 24, z: 9.1, face: Math.PI, w: 1.7, d: 0.9 },
    ],
    box: { x: 3, z: 9.1, face: Math.PI, w: 2.0, d: 0.9 },
    pap: { x: 29.1, z: 0, face: -Math.PI / 2, w: 0.9, d: 1.8 },
  };
  // solid machines / box (players cannot walk through them)
  zmMachines(b, zm);
  const sp = { 0: { x0: -28, x1: -12, z0: -8, z1: 8 }, 1: { x0: -28, x1: -12, z0: -8, z1: 8 } };
  const r = { ...finish(b, {
    id: 'outpost', night: true,
    sky: [0x05080f, 0x141c2a], fog: [0x0a0e15, 8, 58],
    hemi: [0x6a7a96, 0x15161c, 0.55], sun: null,
    lights: [[-20, 2.7, 0], [0, 2.7, 0], [20, 2.7, 0], up.light, [4, 4.5, -21], [34, 4.5, 18]],
    ground: { tex: 'concrete', color: 0x2b2e33, tile: 6 },
    impact: 0x9a948a,
  }), zm };
  r.spawns = sp;
  return r;
}

// ------------------------------------------------------------------------------------------
// 6. BUNKER - zombies map. Four rooms in a row underground (military bunker): barracks, armoury, generator hall, vault.
// ------------------------------------------------------------------------------------------
function bunker() {
  const b = new Builder();
  b.outerWalls(6, { tex: 'concrete', color: 0x2c3036, tile: 3 });
  const H = 3.6, wallO = { tex: 'concrete', color: 0x666b72, tile: 3 };
  const ch = zmChain(b, { H, T: 0.5, wallO, roofO: { tex: 'concrete', color: 0x2a2d32 }, xs: [-34, -17, 0, 17, 34], z0: -12, z1: 12, doorCost: [750, 1250, 1750],
    wins: [{ r: 0, side: 'n', at: -25.5 }, { r: 0, side: 's', at: -25.5 }, { r: 0, side: 'w', at: 0 }, { r: 1, side: 'n', at: -8.5 }, { r: 1, side: 's', at: -8.5 },
      { r: 2, side: 'n', at: 8.5 }, { r: 2, side: 's', at: 8.5 }, { r: 3, side: 'n', at: 25.5 }, { r: 3, side: 's', at: 25.5 }, { r: 3, side: 'e', at: 0 }] });
  const up = zmUpper(b, { bx0: -14, bx1: -4, bz0: 16, bz1: 25, zc: 20.5, color: 0x5d6a62, baseColor: 0x3f4a44 });
  // room dressing: pillars, cover crates, racks, barrels
  for (const [x, z] of [[-25.5, 5.5], [-25.5, -5.5], [-8.5, 5.5], [-8.5, -5.5], [8.5, 5.5], [8.5, -5.5], [25.5, 5.5], [25.5, -5.5]]) b.box(x, z, 0.9, 0.9, H, { tex: 'concrete', color: 0x7b8087 });
  b.solid('crate', -9, 0, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x6f6a45, rot: 1 }); b.solid('crate', -7.4, 0.5, 1.2, 1.2, 1.0, { tex: 'crate', color: 0x6f6a45 });
  b.solid('crate', 9.5, 0, 1.6, 1.6, 1.6, { tex: 'crate', color: 0x6f6a45 });
  b.solid('crate', 28, -1.5, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x6f6a45 }); b.solid('crate', 28, 0.2, 1.4, 1.4, 1.0, { tex: 'crate', color: 0x6f6a45, rot: 1 });
  for (const [x, z] of [[-20, 9], [-20, -9], [4, 9], [14, 9]]) b.solid('barrel', x, z, 0.7, 0.7, 0.95, { tint: 0x6f8f5a, rough: 0.85 });
  b.solid('racking', 13, 7, 4.2, 2.2, 4, { rot: 0 }); b.solid('racking', -4, -8, 4.2, 2.2, 4, { rot: 0 });
  // yard: containers and wrecks to shamble around
  b.solid('container', 8, -21, 6, 2.4, 2.6, { color: 0x5c7a8a, tint: 0x8aa6b4, metal: 0.1 });
  b.solid('container', -24, -21, 2.4, 6, 2.6, { color: 0x8a5a4a, tint: 0xc58a76, rot: 1 });
  b.solid('car', 22, 20, 4.3, 1.9, 1.5, { tint: 0x7a8a6a, rough: 0.95 }); b.solid('car', 26, -17, 1.9, 4.3, 1.5, { tint: 0x8a7a6a, rough: 0.95, rot: 1 });
  for (const [x, z] of [[-30, 19], [0, 17], [14, -17], [-8, -17]]) b.solid('barrel', x, z, 0.7, 0.7, 0.95, { tint: 0xa05a3a, rough: 0.85 });
  // glowing hazard strips (visual) and ceiling pipes
  for (const x of [-25.5, -8.5, 8.5, 25.5]) { b.deco(x, 0, 0.4, 20, 0.12, { y0: H - 0.25, tex: 'plain', color: 0x39d98a, emissive: 0x39d98a, cast: false }); b.deco(x - 3, 0, 0.5, 22, 0.35, { y0: H - 0.6, tex: 'metal', color: 0x4a5057, cast: false }); }
  const zm = {
    nz: ch.nz, upper: up.upper, windows: ch.windows, doors: ch.doors,
    buys: [
      { id: 0, gun: 'm680', cost: 1000, x: -30, z: -11.7, face: 0 }, { id: 1, gun: 'g18', cost: 600, x: -30, z: 11.7, face: Math.PI },
      { id: 2, gun: 'm4a1', cost: 1500, x: -13, z: -11.7, face: 0 }, { id: 3, gun: 'magnum', cost: 800, x: -4, z: 11.7, face: Math.PI },
      { id: 4, gun: 'ak47', cost: 1800, x: 13, z: -11.7, face: 0 }, { id: 5, gun: 'kar98k', cost: 1200, x: 3.5, z: 11.7, face: Math.PI },
      { id: 6, ...up.vmp }, { id: 7, gun: 'lmg', cost: 2200, x: 29, z: 11.7, face: Math.PI },
    ],
    perks: [
      { id: 'qr', x: -21, z: -11.2, face: 0, w: 1.7, d: 0.9 }, { id: 'jug', x: -12.5, z: 11.2, face: Math.PI, w: 1.7, d: 0.9 },
      { id: 'sc', x: -4, z: -11.2, face: 0, w: 1.7, d: 0.9 }, { id: 'dt', x: 12, z: 11.2, face: Math.PI, w: 1.7, d: 0.9 },
      { id: 'st', x: 21, z: -11.2, face: 0, w: 1.7, d: 0.9 },
    ],
    box: { x: 5, z: -11.2, face: 0, w: 2.0, d: 0.9 },
    pap: { x: 33.2, z: -6.5, face: -Math.PI / 2, w: 0.9, d: 1.8 },
  };
  zmMachines(b, zm);
  const r = { ...finish(b, {
    id: 'bunker', night: true,
    sky: [0x04070a, 0x10161c], fog: [0x080b0e, 8, 56],
    hemi: [0x6f8a7e, 0x14181a, 0.5], sun: null,
    lights: [[-25.5, 2.9, 0, 0xffe6c0], [-8.5, 2.9, 0, 0x9affb0], [8.5, 2.9, 0, 0xffe6c0], [25.5, 2.9, 0, 0xff7a68], up.light, [0, 4.5, -20, 0xffd9a0]],
    ground: { tex: 'concrete', color: 0x24282c, tile: 6 },
    impact: 0x8a8e8a,
  }), zm };
  r.spawns = { 0: { x0: -32, x1: -19, z0: -9, z1: 9 }, 1: { x0: -32, x1: -19, z0: -9, z1: 9 } };
  return r;
}

// ------------------------------------------------------------------------------------------
// 7. FARMSTEAD - zombies map. Farmhouse, barn and granary on a foggy night; hay bales and a tractor in the yard; hayloft up the stairs.
// ------------------------------------------------------------------------------------------
function farm() {
  const b = new Builder();
  b.outerWalls(5, { tex: 'wood', color: 0x4a3a28, tile: 3 });
  const H = 3.2, wallO = { tex: 'wood', color: 0x80603c, tile: 2 };
  const ch = zmChain(b, { H, T: 0.5, wallO, roofO: { tex: 'wood', color: 0x3a2c20 }, xs: [-34, -12, 10, 30], z0: -10, z1: 10, doorCost: [750, 1250],
    wins: [{ r: 0, side: 'n', at: -26 }, { r: 0, side: 's', at: -26 }, { r: 0, side: 'w', at: -5 }, { r: 0, side: 'w', at: 5 },
      { r: 1, side: 'n', at: -4 }, { r: 1, side: 's', at: -4 }, { r: 1, side: 's', at: 4 }, { r: 2, side: 'n', at: 20 }, { r: 2, side: 's', at: 20 }, { r: 2, side: 'e', at: 0 }] });
  const up = zmUpper(b, { bx0: 16, bx1: 26, bz0: -26, bz1: -17, zc: -21.5, tex: 'wood', color: 0x7a5a38, baseColor: 0x5a4430, roofColor: 0x3a2c20 });
  const hay = 0xe0c060;
  // inside: tables, hay, crates
  b.solid('crate', 0, 0, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x8a6a45 });
  for (const [x, z] of [[-6, 6], [6, -6], [3, 6.5]]) b.solid('crate', x, z, 1.5, 1.5, 1.5, { tex: 'crate', color: 0xc9a84a, tint: hay, rot: ((x + z) | 0) & 3 });
  b.solid('crate', 22, 4, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x8a6a45 }); b.solid('crate', 18, -4, 1.6, 1.6, 1.0, { tex: 'crate', color: 0x8a6a45 });
  for (const [x, z] of [[-14, 7.5], [-30, 5], [27, -7.5]]) b.solid('barrel', x, z, 0.7, 0.7, 0.95, { tint: 0x9a6a3a, rough: 0.9 });
  // yard: tractor, hay bales, fuel barrels, silos
  b.solid('car', -6, -19, 4.3, 1.9, 1.5, { tint: 0x4a8a3a, rough: 0.9 }); b.solid('car', 30, 19, 1.9, 4.3, 1.5, { tint: 0x9a3a2a, rough: 0.9, rot: 1 });
  for (const [x, z, s] of [[-26, -18, 1.6], [-24, -16.6, 1.6], [4, 20, 1.6], [6, 21.6, 1.6], [36, -4, 1.6], [-37, 14, 1.6], [14, -15, 1.6], [-14, 17, 1.6]]) b.solid('crate', x, z, s, s, s, { tex: 'crate', color: 0xc9a84a, tint: hay, rot: ((x * 3 + z) | 0) & 3 });
  for (const [x, z] of [[-20, 20], [20, 17], [-2, -17], [34, 8]]) b.solid('barrel', x, z, 0.8, 0.8, 1.0, { tint: 0xb04a2a, rough: 0.9 });
  b.solid('container', -22, -22, 6, 2.4, 2.6, { color: 0x6a4a3a, tint: 0xa87a62, metal: 0.1 });
  b.cyl(-36, -22, 2.2, 9, { tex: 'metal', color: 0x8a8f94 }); b.cyl(36, 21, 2.2, 9, { tex: 'metal', color: 0x8a8f94 });
  b.cone(-36, -22, 2.6, 2.2, { color: 0x6a3a2a }); b.cone(36, 21, 2.6, 2.2, { color: 0x6a3a2a });
  const zm = {
    nz: ch.nz, upper: up.upper, windows: ch.windows, doors: ch.doors,
    buys: [
      { id: 0, gun: 'm680', cost: 1000, x: -30, z: -9.7, face: 0 }, { id: 1, gun: 'g18', cost: 600, x: -30, z: 9.7, face: Math.PI },
      { id: 2, gun: 'm4a1', cost: 1500, x: 4, z: -9.7, face: 0 }, { id: 3, gun: 'magnum', cost: 800, x: -8, z: 9.7, face: Math.PI },
      { id: 4, gun: 'ak47', cost: 1800, x: 25, z: -9.7, face: 0 }, { id: 5, gun: 'kar98k', cost: 1200, x: 25, z: 9.7, face: Math.PI },
      { id: 6, ...up.vmp }, { id: 7, gun: 'lmg', cost: 2200, x: 29.7, z: 5, face: -Math.PI / 2 },
    ],
    perks: [
      { id: 'qr', x: -22, z: -9.1, face: 0, w: 1.7, d: 0.9 }, { id: 'jug', x: 0, z: 9.1, face: Math.PI, w: 1.7, d: 0.9 },
      { id: 'sc', x: -17, z: 9.1, face: Math.PI, w: 1.7, d: 0.9 }, { id: 'dt', x: 15.5, z: -9.1, face: 0, w: 1.7, d: 0.9 },
      { id: 'st', x: 15.5, z: 9.1, face: Math.PI, w: 1.7, d: 0.9 },
    ],
    box: { x: -8.5, z: -9.1, face: 0, w: 2.0, d: 0.9 },
    pap: { x: 29.1, z: -5, face: -Math.PI / 2, w: 0.9, d: 1.8 },
  };
  zmMachines(b, zm);
  const r = { ...finish(b, {
    id: 'farm', night: true,
    sky: [0x0a0f1c, 0x2c3a46], fog: [0x1a2430, 8, 62],
    hemi: [0x7a8aa8, 0x1c1812, 0.62], sun: { color: 0x9db4d8, intensity: 0.7, pos: [-30, 40, 20] },
    lights: [[-23, 2.6, 0, 0xffc98a], [0, 2.6, 0, 0xffc98a], [20, 2.6, 0, 0xffc98a], up.light, [-6, 4.5, -19, 0xffe6c0], [30, 4.5, 19, 0xffe6c0]],
    ground: { tex: 'sand', color: 0x4a5a38, tile: 7 },
    impact: 0x7a7a5a,
  }), zm };
  r.spawns = { 0: { x0: -31, x1: -15, z0: -6, z1: 6 }, 1: { x0: -31, x1: -15, z0: -6, z1: 6 } };
  return r;
}

function finish(b, theme) {
  return { ...theme, bounds: BOUNDS, boxes: b.boxes, visuals: b.visuals, spawns: SPAWNS };
}

export const MAP_INFO = {
  warehouse: { name: 'Warehouse', desc: 'Indoor containers & a central catwalk. Tight lanes, close fights.', thumb: 'linear-gradient(135deg,#2b2f36,#59616b 55%,#c7842b)' },
  dust: { name: 'Dust', desc: 'Desert village. Buildings, windows and a busy central plaza.', thumb: 'linear-gradient(135deg,#f1d9a8,#c49a66 55%,#5f9fd6)' },
  skyline: { name: 'Skyline', desc: 'Rooftop at dusk. HVAC cover, stair huts, open sightlines.', thumb: 'linear-gradient(135deg,#2b2f5a,#d8725a 60%,#f0956a)' },
  outpost: { name: 'Outpost', desc: 'Zombies map: three rooms, ten windows, doors, perks and the Mystery Box. (Also playable as a night arena.)', thumb: 'linear-gradient(135deg,#05080f,#2c4a2a 55%,#8a1c14)' },
  bunker: { name: 'Bunker', desc: 'Zombies: four rooms deep underground, ten windows, three doors, a raised armoury up the stairs.', thumb: 'linear-gradient(135deg,#06090c,#39d98a 60%,#ff7a68)' },
  farm: { name: 'Farmstead', desc: 'Zombies: foggy farm night. Farmhouse, barn and granary, a hayloft up the stairs.', thumb: 'linear-gradient(135deg,#0a0f1c,#4a5a38 60%,#e0c060)' },
  frostbite: { name: 'Frostbite', desc: 'Snow compound with watchtowers for long-range duels.', thumb: 'linear-gradient(135deg,#4f6f93,#dfe9f2 60%,#8a6a45)' },
};

export const MAP_BUILDERS = { warehouse, dust, skyline, frostbite, outpost, bunker, farm };
export const ZM_MAPS = ['outpost', 'bunker', 'farm'];                                    // zombies-only maps (not offered in the normal map list)
export const MAP_IDS = Object.keys(MAP_BUILDERS).filter((id) => !ZM_MAPS.includes(id));
export function buildMap(id) { return MAP_BUILDERS[id](); }
