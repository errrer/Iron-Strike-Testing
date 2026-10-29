// Inspect animations (press F): every gun and every knife has its own sequence.
// A sequence is a duration plus "beats". A beat is a named move played between t0 and t1 (0..1 of the sequence); the poses of overlapping
// beats add up. Every beat returns to neutral by its end, so the weapon always lands back in the normal hold.
const TAU = Math.PI * 2;
const sm = (u) => u * u * u * (u * (u * 6 - 15) + 10);                          // smootherstep: zero velocity AND acceleration at both ends
const env = (u) => sm(Math.min(1, u / 0.32)) * sm(Math.min(1, (1 - u) / 0.32));       // ease in, hold the pose, ease out - no sudden starts

// pose channels: x y z (metres), rx ry rz (radians), hand (support hand on the gun), hdy, mag (0 seated .. 1 out), slide, bolt, pump
const BEATS = {
  show:   (u, a) => ({ x: -0.09 * env(u), y: 0.03 * env(u), z: 0.06 * env(u), ry: (a.side || -1) * 0.95 * env(u), rz: (a.side || -1) * -0.25 * env(u) }),           // turn the gun to show its side
  tilt:   (u, a) => ({ y: 0.025 * env(u), x: -0.04 * env(u), rz: (a.k || 0.7) * env(u), rx: 0.1 * env(u) }),                                                         // roll it to look along the top
  raise:  (u, a) => ({ y: 0.07 * (a.k || 1) * env(u), z: 0.06 * env(u), x: -0.05 * env(u), rx: 0.4 * (a.k || 1) * env(u) }),                                         // lift it up toward your face
  lower:  (u, a) => ({ y: -0.05 * env(u), z: 0.04 * env(u), rx: -0.25 * env(u) }),
  roll:   (u, a) => ({ rz: (a.dir || 1) * (TAU * (a.n || 1) * sm(u) - 0.22 * Math.sin(Math.PI * Math.min(1, u * 2.2)) * (1 - u)), x: -0.05 * env(u), y: 0.025 * env(u) }),                                                         // full roll around the barrel
  spin:   (u, a) => ({ ry: (a.dir || 1) * (TAU * (a.n || 1) * sm(u) - 0.2 * Math.sin(Math.PI * Math.min(1, u * 2.2)) * (1 - u)), x: -0.1 * env(u), z: 0.05 * env(u), y: 0.02 * env(u) }),                                          // pirouette
  toss:   (u, a) => ({ y: (a.h || 0.12) * Math.sin(Math.PI * u), z: 0.07 * env(u), x: -0.05 * env(u), rx: (a.dir || 1) * TAU * (a.n || 1) * sm(u) }),                // throw up, flip, catch
  twirl:  (u, a) => ({ rx: (a.dir || 1) * TAU * (a.n || 1) * sm(u), z: 0.04 * env(u), y: 0.02 * env(u), x: -0.06 * env(u) }),                                         // end over end
  nod:    (u, a) => ({ rx: -(a.k || 0.1) * 0.8 * env(u) }),                                                                                              // one slow look-down
  wobble: (u, a) => ({ rz: (a.k || 0.12) * 0.7 * env(u), ry: -(a.k || 0.12) * 0.4 * env(u) }),                                                   // one gentle tilt
  magOut: (u, a) => ({ hand: env(u), hdy: -0.025 * env(u), mag: Math.min(1, env(u) * 1.35), rz: 0.28 * env(u), x: -0.05 * env(u), y: 0.02 * env(u) }),               // support hand pulls the mag, looks, seats it
  charge: (u, a) => ({ hand: sm(Math.min(1, u * 3)) * (1 - sm(Math.max(0, u * 3 - 2))), hdy: -0.01, bolt: env(Math.min(1, Math.max(0, (u - 0.25) / 0.5))), slide: env(Math.min(1, Math.max(0, (u - 0.25) / 0.5))), rz: 0.2 * env(u), x: -0.03 * env(u) }),
  pump:   (u, a) => ({ hand: sm(Math.min(1, u * 4)) * (1 - sm(Math.max(0, u * 4 - 3))), pump: env(Math.min(1, Math.max(0, (u - 0.3) / 0.45))), rz: 0.1 * env(u) }),
  slidePull: (u, a) => ({ hand: env(u), slide: Math.min(1, env(u) * 1.5), rz: 0.35 * env(u), y: 0.03 * env(u), x: -0.04 * env(u), rx: 0.15 * env(u) }),
  twist:  (u, a) => ({ ry: (a.k || 0.5) * 0.7 * env(u), rz: (a.k || 0.5) * 0.3 * env(u), x: -0.04 * env(u) }),
  shake:  (u, a) => ({ y: -0.008 * env(u), rx: 0.04 * env(u) }),                                                                                   // a small settle
};

const A = (dur, ...beats) => ({ dur: dur * 1.25, beats: beats.map(([b, t0, t1, a]) => ({ b, t0: Math.max(0, t0 - 0.07), t1: Math.min(1, t1 + 0.07), a: a || {} })) });      // beats overlap a little so one move flows into the next

export const INSPECTS = {
  // --- SMGs
  vmp:      A(3.4, ['show', 0.0, 0.34, { side: -1 }], ['magOut', 0.34, 0.66], ['charge', 0.66, 0.9], ['nod', 0.9, 1]),
  super46:  A(3.2, ['raise', 0.0, 0.3], ['roll', 0.3, 0.62, { dir: 1 }], ['charge', 0.62, 0.88], ['shake', 0.88, 1]),
  mp5:      A(3.0, ['tilt', 0.0, 0.3, { k: 0.8 }], ['magOut', 0.3, 0.62], ['show', 0.62, 0.92, { side: 1 }]),
  ump:      A(3.3, ['show', 0.0, 0.3, { side: -1 }], ['charge', 0.3, 0.55], ['spin', 0.55, 0.9, { n: 1, dir: -1 }]),
  p90:      A(3.2, ['tilt', 0.0, 0.25, { k: -0.6 }], ['magOut', 0.25, 0.58], ['twist', 0.58, 0.9, { k: 0.45 }]),
  // --- rifles
  m4a1:     A(3.6, ['show', 0.0, 0.3, { side: -1 }], ['magOut', 0.3, 0.6], ['charge', 0.6, 0.82], ['raise', 0.82, 1, { k: 0.5 }]),
  m16:      A(3.4, ['raise', 0.0, 0.28, { k: 0.8 }], ['show', 0.28, 0.58, { side: 1 }], ['charge', 0.58, 0.84], ['nod', 0.84, 1]),
  ak47:     A(3.8, ['show', 0.0, 0.28, { side: -1 }], ['roll', 0.28, 0.58, { dir: -1 }], ['charge', 0.58, 0.84], ['wobble', 0.84, 1]),
  scar:     A(3.4, ['tilt', 0.0, 0.26, { k: 0.8 }], ['charge', 0.26, 0.5], ['show', 0.5, 0.82, { side: -1 }], ['shake', 0.82, 1]),
  fal:      A(3.6, ['show', 0.0, 0.3, { side: 1 }], ['magOut', 0.3, 0.6], ['spin', 0.6, 0.95, { n: 1, dir: 1 }]),
  // --- heavy
  lmg:      A(4.0, ['raise', 0.0, 0.3, { k: 0.5 }], ['show', 0.3, 0.6, { side: -1 }], ['charge', 0.6, 0.86], ['wobble', 0.86, 1, { k: 0.08 }]),
  rpk:      A(3.6, ['tilt', 0.0, 0.28, { k: 0.7 }], ['magOut', 0.28, 0.58], ['charge', 0.58, 0.84], ['twist', 0.84, 1, { k: 0.3 }]),
  // --- marksman / sniper
  dmr:      A(3.6, ['raise', 0.0, 0.3, { k: 0.9 }], ['tilt', 0.3, 0.55, { k: -0.7 }], ['magOut', 0.55, 0.85], ['nod', 0.85, 1]),
  sks:      A(3.4, ['show', 0.0, 0.3, { side: -1 }], ['charge', 0.3, 0.58], ['twist', 0.58, 0.9, { k: 0.4 }]),
  kar98k:   A(4.0, ['raise', 0.0, 0.22, { k: 0.6 }], ['charge', 0.22, 0.52], ['show', 0.52, 0.8, { side: 1 }], ['charge', 0.8, 1]),
  // --- shotguns
  m680:     A(3.4, ['show', 0.0, 0.3, { side: -1 }], ['pump', 0.3, 0.55], ['pump', 0.55, 0.78], ['raise', 0.78, 1, { k: 0.6 }]),
  aa12:     A(3.6, ['tilt', 0.0, 0.25, { k: 0.8 }], ['magOut', 0.25, 0.55], ['roll', 0.55, 0.85, { dir: 1 }], ['shake', 0.85, 1]),
  // --- pistols
  g18:      A(2.8, ['raise', 0.0, 0.25, { k: 0.8 }], ['slidePull', 0.25, 0.6], ['show', 0.6, 0.9, { side: 1 }]),
  m1911:    A(3.0, ['show', 0.0, 0.3, { side: -1 }], ['magOut', 0.3, 0.62], ['roll', 0.62, 0.92, { dir: 1 }]),
  mac10:    A(2.6, ['twist', 0.0, 0.3, { k: 0.5 }], ['slidePull', 0.3, 0.62], ['spin', 0.62, 0.95, { n: 1, dir: -1 }]),
  skorp:    A(2.8, ['tilt', 0.0, 0.28, { k: 0.9 }], ['slidePull', 0.28, 0.6], ['toss', 0.6, 0.92, { h: 0.08, n: 1 }]),
  magnum:   A(3.0, ['raise', 0.0, 0.25, { k: 1 }], ['roll', 0.25, 0.58, { dir: -1 }], ['show', 0.58, 0.9, { side: -1 }]),
  revolver44: A(3.4, ['show', 0.0, 0.28, { side: 1 }], ['wobble', 0.28, 0.5, { k: 0.12 }], ['roll', 0.5, 0.82, { dir: 1, n: 1 }], ['nod', 0.82, 1]),
  deagle:   A(3.2, ['raise', 0.0, 0.3, { k: 1 }], ['slidePull', 0.3, 0.6], ['twist', 0.6, 0.94, { k: 0.6 }]),
  goldgun:  A(4.4, ['raise', 0.0, 0.3, { k: 1 }], ['spin', 0.3, 0.8, { n: 1, dir: 1 }], ['shake', 0.8, 0.9], ['nod', 0.9, 1, { k: 0.15 }]),
  // --- knives
  k_combat:   A(2.8, ['raise', 0.0, 0.25, { k: 0.6 }], ['twirl', 0.25, 0.6, { n: 1, dir: -1 }], ['roll', 0.6, 0.9, { dir: 1 }]),
  k_karambit: A(3.0, ['tilt', 0.0, 0.2, { k: 0.5 }], ['roll', 0.2, 0.6, { n: 2, dir: 1 }], ['twirl', 0.6, 0.9, { n: 1, dir: 1 }]),
  k_balisong: A(3.4, ['raise', 0.0, 0.2, { k: 0.5 }], ['twirl', 0.2, 0.4, { n: 1, dir: 1 }], ['roll', 0.4, 0.62, { n: 1, dir: -1 }], ['twirl', 0.62, 0.84, { n: 1, dir: -1 }], ['shake', 0.84, 1]),
  k_machete:  A(3.2, ['raise', 0.0, 0.28, { k: 0.9 }], ['show', 0.28, 0.6, { side: -1 }], ['twist', 0.6, 0.92, { k: 0.5 }]),
  k_tomahawk: A(3.0, ['raise', 0.0, 0.18, { k: 0.5 }], ['toss', 0.18, 0.62, { h: 0.16, n: 1, dir: 1 }], ['wobble', 0.62, 0.9, { k: 0.1 }]),
};
const FALLBACK = A(2.8, ['show', 0.0, 0.5, { side: -1 }], ['roll', 0.5, 0.9, { dir: 1 }]);

export const inspectFor = (id) => INSPECTS[id] || FALLBACK;

const ZERO = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, hand: 0, hdy: 0, mag: 0, slide: 0, bolt: 0, pump: 0 };
const OUT = { ...ZERO };
// pose of sequence `an` at u in [0,1]; returns a shared object (read it straight away)
export function inspectPose(an, u) {
  for (const k in ZERO) OUT[k] = 0;
  for (const bt of an.beats) {
    if (u <= bt.t0 || u >= bt.t1) continue;
    const p = BEATS[bt.b](Math.min(1, Math.max(0, (u - bt.t0) / (bt.t1 - bt.t0))), bt.a);
    for (const k in p) OUT[k] += p[k];
  }
  OUT.hand = Math.min(1, OUT.hand); OUT.mag = Math.min(1, OUT.mag); OUT.slide = Math.min(1, OUT.slide); OUT.bolt = Math.min(1, OUT.bolt); OUT.pump = Math.min(1, OUT.pump);
  return OUT;
}
