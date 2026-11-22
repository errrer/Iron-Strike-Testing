// Pose maths for the rigged first-person arms (assets/models/arms.json, baked by tools/bake-arms.py).
// Pure maths (no three.js): matrices are column-major 4x4 arrays, same layout as THREE.Matrix4.elements.
// Each arm is posed from three things: where the wrist goes (P, in gun space), how the hand is turned (Rt, a rotation applied on top of the
// rest pose: fingers -Z, palm facing the other hand, thumb up) and how far each finger joint is curled (radians, positive = towards the palm).
// The forearm bone is aimed from a fixed "shoulder" point at the wrist, so the arm always comes in from behind the camera.

const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]), norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
export const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function mmul(a, b) {                                   // a * b
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
export function rinv(m) {                                      // inverse of a rigid transform
  const o = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
  o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]); o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]); o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]);
  return o;
}
const rot3 = (m) => [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];       // rows
const col = (m, i) => [m[i * 4], m[i * 4 + 1], m[i * 4 + 2]];
const withT = (R, t) => [R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, t[0], t[1], t[2], 1];     // R: column-major 3x3
function mat3mul(a, b) { const o = new Array(9); for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2]; return o; }
const R3 = (m) => [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
export function axisAngle(ax, ang) {                           // column-major 3x3
  const [x, y, z] = V3.norm(ax), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, t * x * y - s * z, t * y * y + c, t * y * z + s * x, t * x * z + s * y, t * y * z - s * x, t * z * z + c];
}
export const eulerXYZ = (rx, ry, rz) => mat3mul(axisAngle([0, 1, 0], ry), mat3mul(axisAngle([1, 0, 0], rx), axisAngle([0, 0, 1], rz)));    // yaw * pitch * roll
// rotation taking the rest hand (fingers -Z, palm normal `n0`, thumb = n0 x f) to fingers f / palm normal n
export function handFrame(f, n, n0) {
  const f0 = [0, 0, -1], t0 = V3.cross(n0, f0), fn = V3.norm(f), nn = V3.norm(V3.sub(n, V3.mul(fn, V3.dot(n, fn)))), t = V3.cross(nn, fn);
  const A = [...fn, ...nn, ...t], B = [...f0, ...n0, ...t0];                        // columns
  const Bt = [B[0], B[3], B[6], B[1], B[4], B[7], B[2], B[5], B[8]];
  return mat3mul(A, Bt);
}
// quaternions [x,y,z,w]
function q2m(q) { const [x, y, z, w] = q; return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]; }
function m2q(m) {
  const t = m[0] + m[4] + m[8]; let q;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [(m[5] - m[7]) / s, (m[6] - m[2]) / s, (m[1] - m[3]) / s, s / 4]; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; q = [s / 4, (m[3] + m[1]) / s, (m[6] + m[2]) / s, (m[5] - m[7]) / s]; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; q = [(m[3] + m[1]) / s, s / 4, (m[7] + m[5]) / s, (m[6] - m[2]) / s]; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; q = [(m[6] + m[2]) / s, (m[7] + m[5]) / s, s / 4, (m[1] - m[3]) / s]; }
  const l = Math.hypot(...q); return q.map((v) => v / l);
}
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map((v) => -v); d = -d; }
  if (d > 0.9995) { const r = a.map((v, i) => v + (b[i] - v) * t), l = Math.hypot(...r); return r.map((v) => v / l); }
  const th = Math.acos(d), s = Math.sin(th), w1 = Math.sin((1 - t) * th) / s, w2 = Math.sin(t * th) / s; return a.map((v, i) => v * w1 + b[i] * w2);
}
function fromTo(a, b) {                                        // minimal rotation taking unit a to unit b (column-major 3x3)
  const d = V3.dot(a, b);
  if (d > 0.99999) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (d < -0.99999) return axisAngle(Math.abs(a[0]) < 0.9 ? V3.cross(a, [1, 0, 0]) : V3.cross(a, [0, 1, 0]), Math.PI);
  const ax = V3.cross(a, b); return axisAngle(ax, Math.acos(Math.max(-1, Math.min(1, d))));
}
const mulV = (R, v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];

export const ARM_SCALE = 0.8;
export const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

export class ArmRig {
  constructor(data) {
    this.names = data.names; this.parents = data.parents; this.n = data.names.length;
    this.bind = data.bind.map((m) => m.slice());
    this.ix = {}; this.names.forEach((n, i) => { this.ix[n] = i; });
    this.out = this.bind.map((m) => m.slice());
    this.local = this.bind.map((m, i) => (this.parents[i] >= 0 ? mmul(rinv(this.bind[this.parents[i]]), m) : m.slice()));
    this.sides = {};
    for (const side of ['Left', 'Right']) {
      const hand = this.ix[`${side}_Hand`], arm = this.ix[`${side}_Arm`], helper = this.ix[`${side[0]}_wrist_helper`];
      const fingers = FINGERS.map((f) => [1, 2, 3].map((k) => this.ix[`${side}_${f}${f === 'Thumb' && side === 'Left' && k === 2 ? '_' : ''}0${k}`]));
      const root = this.ix[side === 'Left' ? 'Root34' : 'Root36'], members = [];
      for (let i = 0; i < this.n; i++) { let p = i; while (p >= 0 && p !== root) p = this.parents[p]; if (p === root) members.push(i); }
      const palm = side === 'Left' ? [1, 0, 0] : [-1, 0, 0];                          // palm faces the other hand
      this.sides[side] = { hand, arm, helper, fingers, members, palm, wrist: this.bind[hand].slice(12, 15), elbow: this.bind[arm].slice(12, 15) };
      const s = this.sides[side]; s.len = V3.len(V3.sub(s.wrist, s.elbow)); s.axis0 = V3.norm(V3.sub(s.wrist, s.elbow));
      // which bone-local axis flexes a finger joint towards the palm
      s.flex = fingers.map((chain) => chain.map((bi, k) => {
        const B = this.bind[bi], next = chain[k + 1] !== undefined ? this.bind[chain[k + 1]] : null, prev = chain[k - 1] !== undefined ? this.bind[chain[k - 1]] : null;
        const d = V3.norm(next ? V3.sub(next.slice(12, 15), B.slice(12, 15)) : V3.sub(B.slice(12, 15), prev.slice(12, 15)));
        let best = null;
        for (let a = 0; a < 3; a++) {
          const ax = col(B, a); if (Math.abs(V3.dot(ax, d)) > 0.8) continue;
          const sc = V3.dot(V3.cross(ax, d), palm); if (!best || Math.abs(sc) > Math.abs(best.sc)) best = { a, sc };
        }
        const lv = [0, 0, 0]; lv[best.a] = best.sc >= 0 ? 1 : -1; return lv;
      }));
    }
  }
  // opts: { P: wrist position, Rt: 3x3 hand rotation on top of the rest pose, S: shoulder anchor, curl: [thumb, index, middle, ring, pinky] each [a,b,c] (or a single number), up: preferred forearm roll reference }
  pose(side, o) {
    const sd = this.sides[side], out = this.out, bind = this.bind;
    const P = o.P, Rt = o.Rt || [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const d = V3.norm(V3.sub(P, o.S)), Pe = V3.sub(P, V3.mul(d, sd.len));
    // forearm: aim the bind axis at the wrist, then roll so the arm's up follows (half) the hand's up
    let Qa = fromTo(sd.axis0, d);
    const handUp = mulV(Rt, [0, 1, 0]), wantUp = V3.norm(V3.add(V3.mul([0, 1, 0], 0.55), V3.mul(handUp, 0.45)));
    const curUp = mulV(Qa, [0, 1, 0]), pr = (v) => V3.sub(v, V3.mul(d, V3.dot(v, d)));
    const a = V3.norm(pr(curUp)), b = V3.norm(pr(wantUp)), ang = Math.atan2(V3.dot(V3.cross(a, b), d), V3.dot(a, b));
    Qa = mat3mul(axisAngle(d, ang), Qa);
    out[sd.arm] = withT(mat3mul(Qa, R3(bind[sd.arm])), Pe);
    // hand
    const Qh = Rt; out[sd.hand] = withT(mat3mul(Qh, R3(bind[sd.hand])), P);
    // wrist twist helper: halfway between forearm and hand
    const hq = slerp(m2q(Qa), m2q(Qh), 0.5); out[sd.helper] = withT(mat3mul(q2m(hq), R3(bind[sd.helper])), P);
    // everything else under the arm / hand follows hierarchically (finger joints get their curl)
    const curlOf = new Map();
    sd.fingers.forEach((chain, f) => chain.forEach((bi, k) => { let c = o.curl ? o.curl[f] : 0; c = Array.isArray(c) ? c[k] : c; curlOf.set(bi, [f, k, c || 0]); }));
    for (const i of sd.members) {
      if (i === sd.arm || i === sd.hand || i === sd.helper) continue;
      const p = this.parents[i];
      let L = this.local[i];
      const cf = curlOf.get(i);
      if (cf && cf[2]) L = mmul(L, withT(axisAngle(sd.flex[cf[0]][cf[1]], cf[2]), [0, 0, 0]));
      out[i] = mmul(out[p], L);
    }
    // the model's hands are big next to the guns: scale the whole arm about the wrist
    const k = o.scale === undefined ? ARM_SCALE : o.scale;
    if (k !== 1) for (const i of sd.members) { const m = out[i]; for (let j = 0; j < 9; j++) m[j] *= k; for (let j = 0; j < 3; j++) m[12 + j] = P[j] + k * (m[12 + j] - P[j]); }
    return out;
  }
}

// ---- hand placements for a gun (all in gun space; the gun's -Z is the muzzle) ---------------------------------------------------------
// Returns { right: {P, Rt, curl}, left: {P, Rt, curl} } for a gun whose anchors are `u` = { grip, fore, pistol, ... }.
// `lh` is the support-hand offset the viewmodel animation applies on top (reloads, pumping, inspecting); `trig` 0..1 pulls the trigger finger.
const HAND_L = [1, 0, 0], HAND_R = [-1, 0, 0];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// `extra.fa` = finger / hand animation state from the game (all 0..1 unless noted): hand (support hand away from the gun), grab (closed round a mag / shell),
// slap (flat palm on the mag), charge (hooked on the charging handle), release (thumb on the mag catch), trigOff (finger off the trigger), draw, sprint, insp, kick, t (seconds)
const scaleCurl = (c, k) => c.map((j) => j.map((v) => v * k));
export function placeHands(u, lh, trig = 0, extra = {}) {
  const fa = extra.fa || {}, T = fa.t || 0, pulse = (i, s) => 0.5 + 0.5 * Math.sin(T * s + i * 1.3);
  const G = [u.grip.x, u.grip.y, u.grip.z], F = [u.fore.x, u.fore.y, u.fore.z], off = lh ? [lh.x, lh.y, lh.z] : [0, 0, 0];
  const wrapC = (k) => [1.15 * k, 1.5 * k, 1.0 * k];
  const R = {}, Lh = {};
  const rake = u.pistol ? 0.3 : 0.36, kk = fa.kick || 0;
  const pitchR = (extra.pitchR === undefined ? -rake * 0.55 : extra.pitchR) - kk * 0.1;                    // the wrist rolls with the recoil
  if (u.pistol) {
    const wp = u.handRight ? [u.handRight.x, u.handRight.y, u.handRight.z] : [G[0] + 0.031, G[1] + 0.005, G[2] + 0.045];
    R.P = wp; R.Rt = mat3mul(axisAngle([1, 0, 0], pitchR), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    R.curl = [[0.05, 0.1, 0.1], [0.18 + 0.4 * trig, 0.3 + 0.5 * trig, 0.15 + 0.2 * trig], wrapC(0.95), wrapC(0.92), wrapC(0.85)];
    const wl = u.handLeft ? [u.handLeft.x, u.handLeft.y, u.handLeft.z] : [G[0] - 0.031, G[1] - 0.01, G[2] + 0.04];
    Lh.P = wl; Lh.Rt = mat3mul(axisAngle([1, 0, 0], extra.pitchL === undefined ? -rake * 0.55 : extra.pitchL), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    Lh.curl = [[0.02, 0.05, 0.05], wrapC(1.0), wrapC(1.0), wrapC(0.95), wrapC(0.9)];
  } else {
    R.P = [G[0] + 0.03, G[1] + 0.02, G[2] + 0.092]; R.Rt = mat3mul(axisAngle([1, 0, 0], pitchR + (-rake * 0.6 + rake * 0.55)), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    R.curl = [[0.2, 0.3, 0.2], [0.2 + 0.4 * trig, 0.3 + 0.5 * trig, 0.15], wrapC(0.9), wrapC(0.88), wrapC(0.82)];
    const C = { dp: [-0.02, -0.025, 0.05], f: [0.3, 0.1, -0.95], n: [0.3, 0.95, 0] }, Gm = { dp: [-0.05, -0.05, -0.055], f: [0.95, -0.1, 0.15], n: [0.1, 0.2, 0.97] };   // handguard C-grip / holding the magazine
    const gk = Math.min(1, fa.magGrab || 0), mix = (p, q) => p.map((v, i) => v + (q[i] - v) * gk);
    const LL = Object.assign({ dp: mix(C.dp, Gm.dp), f: mix(C.f, Gm.f), n: mix(C.n, Gm.n) }, extra.L || {}), f = LL.f, n = LL.n;
    Lh.Rt = handFrame(f, n, HAND_L);
    Lh.P = [F[0] + LL.dp[0], F[1] + LL.dp[1], F[2] + LL.dp[2]]; Lh.curl = [[0.45, 0.4, 0.3], wrapC(0.9), wrapC(0.9), wrapC(0.85), wrapC(0.8)];
  }
  // ---- finger animation ----
  const open = (fa.hand || 0) * (1 - (fa.grab || 0)), slap = fa.slap || 0, ch = fa.charge || 0, insp = fa.insp || 0;
  for (let i = 1; i < 5; i++) {                                                                               // support hand: opens while it travels, closes round a mag, flat on the slap, hooks the charging handle
    let m = 1 - (fa.magGrab ? 0.4 : 0.7) * open; m = Math.min(m, 1 - 0.85 * slap); if (ch) m = m * (1 - ch) + (i === 1 ? 0.45 : 0.8) * ch;
    m *= 1 - (fa.draw || 0) * 0.45; m *= 1 - (fa.sprint || 0) * 0.28;
    m *= 1 - insp * 0.5 * Math.max(0, Math.sin(T * 5.5 - i * 0.8));                                           // inspect: the fingers ripple
    m *= 1 + 0.025 * Math.sin(T * 1.3 + i);                                                                   // faint life in the grip
    Lh.curl[i] = scaleCurl([Lh.curl[i]], m)[0];
  }
  Lh.curl[0] = scaleCurl([Lh.curl[0]], 1 - 0.55 * open + (fa.grab || 0) * 0.5 + (fa.draw || 0) * -0.3)[0];
  for (let i = 2; i < 5; i++) R.curl[i] = scaleCurl([R.curl[i]], (1 - (fa.draw || 0) * 0.45) * (1 - (fa.sprint || 0) * 0.28) * (1 + kk * 0.1) * (1 + 0.02 * Math.sin(T * 1.1 + i)))[0];
  const off_ = Math.min(1, fa.trigOff || 0);                                                                  // index finger lies along the frame when the gun is not about to fire
  R.curl[1] = R.curl[1].map((v, j) => v * (1 - off_) + [0.04, 0.05, 0.03][j] * off_ + (fa.draw || 0) * -0.1);
  R.curl[0] = R.curl[0].map((v, j) => v + (fa.release || 0) * [0.55, 0.45, 0.3][j]);                          // thumb presses the mag catch
  if (insp) for (let i = 1; i < 5; i++) R.curl[i] = scaleCurl([R.curl[i]], 1 - insp * 0.25 * Math.max(0, Math.sin(T * 4.3 + i * 0.9 + 1)))[0];
  Lh.P = [Lh.P[0] + off[0], Lh.P[1] + off[1], Lh.P[2] + off[2]];
  return { right: R, left: Lh };
}
// shoulder anchors (where the forearms come from: behind and below the camera, in gun space)
export const SHOULDER = { Left: [-0.22, -0.5, 0.5], Right: [0.22, -0.5, 0.5] };
