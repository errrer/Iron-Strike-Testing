// Euphoria-style active ragdoll. A dying soldier is a Verlet particle skeleton that is still "conscious" for a moment:
// it staggers (stumble steps), clutches the wound, flails the free arm, braces for the fall with its hands, and only then
// goes limp. The Verlet skeleton is mapped back onto the jointed soldier mesh (js/soldier.js) every frame.
import { ARM, aim, inv, norm } from './soldier.js?v=0.16.0';

const H = 1 / 60, G = 20;
// particle ids
const PEL = 0, CHE = 1, HED = 2, SHL = 3, SHR = 4, HPL = 5, HPR = 6, ELL = 7, ELR = 8, HNL = 9, HNR = 10, KNL = 11, KNR = 12, FTL = 13, FTR = 14, BEL = 15;
const TEMPLATE = [
  [0, 0.87, 0], [0, 1.3, 0], [0, 1.66, 0], [-0.28, 1.42, 0], [0.28, 1.42, 0], [-0.1, 0.84, 0], [0.1, 0.84, 0], null, null, null, null, null, null, null, null, [0, 1.15, -0.16],
];
const RAD = [0.1, 0.1, 0.11, 0.07, 0.07, 0.08, 0.08, 0.05, 0.05, 0.05, 0.05, 0.07, 0.07, 0.06, 0.06, 0.06];
const L_THIGH = 0.42, L_SHIN = 0.38;
// weapon -> shove given to the body (m/s)
export const IMPULSE = { aa12: 5, dmr: 5, scar: 3.4, lmg: 3, deagle: 5, mp5: 2.1, p90: 1.8, skorp: 1.7, m680: 6.5, kar98k: 7, magnum: 4.5, ak47: 3, m4a1: 2.6, vmp: 2.2, super46: 1.9, g18: 1.8, m1911: 2.2 };
// how long the body keeps fighting before it goes limp (s)
const CONSCIOUS = { aa12: 0.5, dmr: 0.55, scar: 0.8, lmg: 0.85, deagle: 0.8, mp5: 0.95, p90: 1.0, skorp: 1.1, m680: 0.45, kar98k: 0.5, magnum: 0.8, ak47: 0.85, m4a1: 0.9, vmp: 0.95, super46: 1.0, g18: 1.1, m1911: 1.0 };

const rx = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
const ry = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
const rz = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
const eul = (v, o) => rx(ry(rz(v, o.z), o.y), o.x);                 // three.js 'XYZ' order
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export class Ragdoll {
  // opts: { dx, dz (shove direction), imp, head, conscious, hand (0/1: wound hand) }
  constructor(col, actor, mesh, opts) {
    this.col = col; this.t = 0; this.acc = 0; this.asleep = false; this.still = 0; this.dirty = true;
    this.dx = opts.dx; this.dz = opts.dz; this.head = !!opts.head;
    this.dur = opts.conscious; this.hand = opts.hand; this.stepT = 0; this.stepFoot = Math.random() < 0.5 ? 0 : 1;
    this.flailT = 0; this.flail = [[0, 0, 0], [0, 0, 0]];
    this.fr = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];          // torso frame columns X, Y, Z in world space
    const P = (this.p = []), O = (this.o = []);
    // ---- initial pose from the living pose (body space -> world)
    const m = mesh, ck = m.crouchK || 0, off = -0.34 * ck;
    const loc = TEMPLATE.map((t) => (t ? [t[0], t[1] + off, t[2]] : null));
    for (let i = 0; i < 2; i++) {
      const sh = m.arms[i], S = loc[i === 0 ? SHL : SHR];
      const e = eul([0, -ARM.L1, 0], sh.rotation), el = sh.userData.el;
      const E = [S[0] + e[0], S[1] + e[1], S[2] + e[2]];
      const f = eul(eul([0, -ARM.L2, 0], el.rotation), sh.rotation);
      loc[i === 0 ? ELL : ELR] = E; loc[i === 0 ? HNL : HNR] = [E[0] + f[0], E[1] + f[1], E[2] + f[2]];
      const hip = m.legs[i], hp = loc[i === 0 ? HPL : HPR], kn = hip.userData.knee;
      const k = eul([0, -L_THIGH, 0], hip.rotation), K = [hp[0] + k[0], hp[1] + k[1], hp[2] + k[2]];
      const kr = kn ? kn.rotation : { x: 0, y: 0, z: 0 };
      const s = eul(eul([0, -L_SHIN, 0], kr), hip.rotation);
      loc[i === 0 ? KNL : KNR] = K; loc[i === 0 ? FTL : FTR] = [K[0] + s[0], K[1] + s[1], K[2] + s[2]];
    }
    const cy = Math.cos(actor.yaw), sy = Math.sin(actor.yaw);
    for (let i = 0; i < 16; i++) {
      const l = loc[i], x = actor.pos.x + l[0] * cy + l[2] * sy, z = actor.pos.z - l[0] * sy + l[2] * cy;
      P.push([x, actor.pos.y + l[1], z]); O.push([x, actor.pos.y + l[1], z]);
    }
    // ---- distance constraints: rigid torso cluster + limb segments
    const C = (this.cons = []);
    const torso = [PEL, CHE, HED, SHL, SHR, HPL, HPR, BEL];
    for (let a = 0; a < torso.length; a++) for (let b = a + 1; b < torso.length; b++) C.push([torso[a], torso[b], Math.hypot(...sub(TEMPLATE[torso[a]], TEMPLATE[torso[b]])), 1]);
    C.push([SHL, ELL, ARM.L1, 1], [ELL, HNL, ARM.L2, 1], [SHR, ELR, ARM.L1, 1], [ELR, HNR, ARM.L2, 1]);
    C.push([HPL, KNL, L_THIGH, 1], [KNL, FTL, L_SHIN, 1], [HPR, KNR, L_THIGH, 1], [KNR, FTR, L_SHIN, 1]);
    // soft: keep the limbs from folding all the way back on themselves
    C.push([SHL, HNL, 0.1, -1], [SHR, HNR, 0.1, -1], [HPL, FTL, 0.12, -1], [HPR, FTR, 0.12, -1]);
    // ---- the shove
    const vx = actor.vel.x, vz = actor.vel.z, imp = opts.imp, dx = this.dx, dz = this.dz;
    const kick = (i, f, up) => { const v = [vx + dx * imp * f, up, vz + dz * imp * f]; O[i] = [P[i][0] - v[0] * H, P[i][1] - v[1] * H, P[i][2] - v[2] * H]; };
    for (let i = 0; i < 16; i++) kick(i, 0.35, 0);
    for (const i of [CHE, SHL, SHR, BEL, ELL, ELR]) kick(i, 1, imp * 0.12);
    kick(HED, this.head ? 1.5 : 1.2, this.head ? imp * 0.5 : imp * 0.18);
    this.measure();
  }

  // torso frame from the particles
  measure() {
    const P = this.p, X = norm(sub(P[SHR], P[SHL]));
    let Y = sub(P[CHE], P[PEL]); const d = dot(Y, X); Y = norm([Y[0] - X[0] * d, Y[1] - X[1] * d, Y[2] - X[2] * d]);
    this.fr = [X, Y, norm(cross(X, Y))];
  }

  // body-space point (feet at y = 0, forward = -z, as in soldier.js) -> world
  toWorld(lp) {
    const [X, Y, Z] = this.fr, p = this.p[PEL], l = [lp.x, lp.y - 0.87, lp.z];
    return [p[0] + X[0] * l[0] + Y[0] * l[1] + Z[0] * l[2], p[1] + X[1] * l[0] + Y[1] * l[1] + Z[1] * l[2], p[2] + X[2] * l[0] + Y[2] * l[1] + Z[2] * l[2]];
  }
  local(w) {                                                  // world -> torso frame (origin at the pelvis)
    const [X, Y, Z] = this.fr, d = sub(w, this.p[PEL]);
    return [dot(d, X), dot(d, Y), dot(d, Z)];
  }

  step(dt) {
    if (this.asleep) return;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= H) { this.acc -= H; this.sub(); }
    this.measure(); this.dirty = true;
  }

  pull(i, t, k) { const p = this.p[i]; p[0] += (t[0] - p[0]) * k; p[1] += (t[1] - p[1]) * k; p[2] += (t[2] - p[2]) * k; }
  push(i, a, f) { const p = this.p[i]; p[0] += a[0] * f; p[1] += a[1] * f; p[2] += a[2] * f; }

  sub() {
    const P = this.p, O = this.o, t = (this.t += H);
    const u = t / this.dur, c = u >= 1 ? 0 : u < 0.3 ? 1 : Math.pow((1 - u) / 0.7, 1.3);     // consciousness
    // ---- verlet
    for (let i = 0; i < 16; i++) {
      const p = P[i], o = O[i], vx = (p[0] - o[0]) * 0.996, vy = (p[1] - o[1]) * 0.996, vz = (p[2] - o[2]) * 0.996;
      o[0] = p[0]; o[1] = p[1]; o[2] = p[2];
      p[0] += vx; p[1] += vy - G * H * H; p[2] += vz;
    }
    if (c > 0) this.willpower(c, t);
    // ---- constraints + collisions
    const near = this.nearBoxes();
    for (let it = 0; it < 4; it++) {
      for (const [a, b, len, kind] of this.cons) {
        const A = P[a], B = P[b], dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], d = Math.hypot(dx, dy, dz) || 1e-6;
        let diff;
        if (kind > 0) diff = (d - len) / d * 0.5; else if (d < len) diff = (d - len) / d * 0.5; else continue;
        A[0] += dx * diff; A[1] += dy * diff; A[2] += dz * diff; B[0] -= dx * diff; B[1] -= dy * diff; B[2] -= dz * diff;
      }
      this.hinges();
      this.collide(near);
    }
    // ---- sleep
    let vmax = 0;
    for (let i = 0; i < 16; i++) vmax = Math.max(vmax, Math.hypot(P[i][0] - O[i][0], P[i][1] - O[i][1], P[i][2] - O[i][2]) / H);
    this.still = vmax < 0.35 && t > this.dur ? this.still + H : 0;
    if (this.still > 0.6 || t > this.dur + 4) this.asleep = true;
  }

  // knees fold forward, elbows fold backward (relative to the torso)
  hinges() {
    this.measure();
    const P = this.p, Z = this.fr[2];
    const fix = (a, k, b, sign) => {
      const A = P[a], K = P[k], B = P[b], ab = sub(B, A), l2 = dot(ab, ab) || 1e-6, u = dot(sub(K, A), ab) / l2;
      const off = [K[0] - (A[0] + ab[0] * u), K[1] - (A[1] + ab[1] * u), K[2] - (A[2] + ab[2] * u)], s = dot(off, Z) * sign;   // Z = back
      if (s < -0.01) { const f = s * 1.6 * sign; K[0] -= Z[0] * f; K[1] -= Z[1] * f; K[2] -= Z[2] * f; }
    };
    fix(HPL, KNL, FTL, -1); fix(HPR, KNR, FTR, -1);           // knee offset must point forward (-Z)
    fix(SHL, ELL, HNL, 1); fix(SHR, ELR, HNR, 1);             // elbow offset points back (+Z)
  }

  nearBoxes() {
    const p = this.p[PEL], out = [];
    for (const b of this.col.boxes) if (p[0] > b.x0 - 2.2 && p[0] < b.x1 + 2.2 && p[2] > b.z0 - 2.2 && p[2] < b.z1 + 2.2 && p[1] > b.y0 - 2.2 && p[1] < b.y1 + 2.2) out.push(b);
    return out;
  }

  collide(near) {
    const P = this.p, O = this.o;
    for (let i = 0; i < 16; i++) {
      const p = P[i], o = O[i], r = RAD[i];
      for (const b of near) {
        if (p[0] < b.x0 - r || p[0] > b.x1 + r || p[1] < b.y0 - r || p[1] > b.y1 + r || p[2] < b.z0 - r || p[2] > b.z1 + r) continue;
        const pen = [p[0] - (b.x0 - r), b.x1 + r - p[0], p[1] - (b.y0 - r), b.y1 + r - p[1], p[2] - (b.z0 - r), b.z1 + r - p[2]];
        let k = 0; for (let j = 1; j < 6; j++) if (pen[j] < pen[k]) k = j;
        const ax = k >> 1, s = k & 1 ? 1 : -1, tgt = k & 1 ? [b.x1, b.y1, b.z1][ax] + r : [b.x0, b.y0, b.z0][ax] - r;
        p[ax] = tgt; o[ax] = p[ax];                                // inelastic
        if (ax === 1 && s > 0) this.friction(p, o, 0.4);
        else { const q = ax === 0 ? 2 : 0; o[q] += (p[q] - o[q]) * 0.1; }
      }
      if (p[1] < r) { p[1] = r; o[1] = r; this.friction(p, o, 0.35); }
    }
  }
  friction(p, o, k) { o[0] += (p[0] - o[0]) * k; o[2] += (p[2] - o[2]) * k; }

  // ---- the "euphoria": what the body does with its last moments of control
  willpower(c, t) {
    const P = this.p, dx = this.dx, dz = this.dz, [X, , Z] = this.fr;
    const feet = [FTL, FTR], grounded = P[FTL][1] < 0.2 || P[FTR][1] < 0.2 || this.onSomething();
    // stay upright: chest over pelvis, head over chest, pelvis held at standing height
    this.pull(CHE, [P[PEL][0], P[PEL][1] + 0.43, P[PEL][2]], 0.05 * c);
    this.pull(HED, [P[CHE][0], P[CHE][1] + 0.36, P[CHE][2]], 0.06 * c * (this.head ? 0.3 : 1));
    if (grounded) { const g = G * H * H * 0.97 * c; for (const i of [PEL, CHE, HED, SHL, SHR, HPL, HPR, BEL]) P[i][1] += g; const lift = P[PEL][1] < 0.86 ? (0.86 - P[PEL][1]) : 0; P[PEL][1] += lift * 0.2 * c; P[CHE][1] += lift * 0.1 * c; }
    // legs hold the body up: straighten the knees (they buckle as consciousness fades)
    if (grounded) for (const [h, k, f] of [[HPL, KNL, FTL], [HPR, KNR, FTR]]) {
      const A = P[h], B = P[f]; this.pull(k, [(A[0] + B[0]) / 2 - Z[0] * 0.03, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2 - Z[2] * 0.03], 0.3 * c);
    }
    // stumble steps in the direction of the shove, alternating feet
    this.stepT -= H;
    if (this.stepT <= 0) { this.stepT = 0.17 + Math.random() * 0.06; this.stepFoot ^= 1; this.stepGoal = [P[PEL][0] + dx * 0.3 + (Math.random() - 0.5) * 0.2, 0.06, P[PEL][2] + dz * 0.3 + (Math.random() - 0.5) * 0.2]; }
    if (this.stepGoal) {
      const f = feet[this.stepFoot], lift = Math.sin(Math.min(1, (0.2 - this.stepT) / 0.2) * Math.PI) * 0.12;
      this.pull(f, [this.stepGoal[0], this.stepGoal[1] + lift, this.stepGoal[2]], 0.12 * c);
    }
    // one hand clutches the wound, the other spasms
    const wound = this.head ? [P[HED][0] - Z[0] * 0.05, P[HED][1] - 0.04, P[HED][2] - Z[2] * 0.05] : [P[BEL][0] - Z[0] * 0.04, P[BEL][1] + 0.08, P[BEL][2] - Z[2] * 0.04];
    const hands = [HNL, HNR], mine = hands[this.hand], other = hands[this.hand ^ 1];
    this.pull(mine, wound, 0.16 * c);
    this.flailT -= H;
    if (this.flailT <= 0) { this.flailT = 0.07 + Math.random() * 0.08; this.flail = [(Math.random() - 0.5) * 1.1, Math.random() * 0.9 - 0.2, (Math.random() - 0.5) * 1.1]; }
    const os = P[this.hand ^ 1 ? SHR : SHL];
    this.pull(other, [os[0] + this.flail[0] * 0.6, os[1] + this.flail[1] * 0.6, os[2] + this.flail[2] * 0.6], 0.08 * c);
    // body thrashes a little
    if (this.head) this.push(HED, [X[0], 0, X[2]], (Math.random() - 0.5) * 0.004 * c);
    // brace for the fall: hands reach for the ground ahead as the body goes over
    const falling = P[CHE][1] < 1.05 || (P[CHE][1] - this.o[CHE][1]) / H < -0.6;
    if (falling && c < 0.7) {
      const f = c < 0.5 ? 0.18 : 0.06, rd = Math.hypot(dx, dz) || 1;
      for (const h of hands) if (!(h === mine && this.head)) this.pull(h, [P[CHE][0] + dx / rd * 0.35 + (h === HNL ? -0.15 : 0.15), 0.05, P[CHE][2] + dz / rd * 0.35], f * (1 - c * 0.5));
    }
  }
  onSomething() { return this.p[FTL][1] < 0.3 || this.p[FTR][1] < 0.3 || this.p[PEL][1] < 1.05; }

  // ---- write the pose onto the soldier mesh
  apply(m) {
    if (!this.dirty) return; this.dirty = false;
    const P = this.p, [X, Y, Z] = this.fr;
    // root: torso frame as a 'YXZ' euler, origin at the pelvis; body hangs 0.87 below
    m.root.rotation.order = 'YXZ';
    const m23 = Y[2], m13 = Z[0], m33 = Z[2], m21 = X[1], m22 = Y[1];
    const ex = Math.asin(-Math.max(-1, Math.min(1, m23)));
    let ey, ez; if (Math.abs(m23) < 0.9999) { ey = Math.atan2(m13, m33); ez = Math.atan2(m21, m22); } else { ey = Math.atan2(-X[2], X[0]); ez = 0; }
    m.root.rotation.set(ex, ey, ez); m.root.position.set(P[PEL][0], P[PEL][1], P[PEL][2]); m.body.position.set(0, -0.87, 0);
    const L = (i) => this.local(P[i]);
    const dir = (a, b, from) => { const A = L(a), B = L(b); return norm([B[0] - A[0], B[1] - A[1], B[2] - A[2]]); };
    for (let i = 0; i < 2; i++) {
      const sh = m.arms[i], S = i === 0 ? SHL : SHR, E = i === 0 ? ELL : ELR, Hn = i === 0 ? HNL : HNR;
      const [r1x, r1z] = aim(dir(S, E)); sh.rotation.set(r1x, 0, r1z);
      const [r2x, r2z] = aim(inv(dir(E, Hn), r1x, r1z)); sh.userData.el.rotation.set(r2x, 0, r2z);
      const hip = m.legs[i], Hp = i === 0 ? HPL : HPR, K = i === 0 ? KNL : KNR, F = i === 0 ? FTL : FTR;
      const [t1x, t1z] = aim(dir(Hp, K)); hip.rotation.set(t1x, 0, t1z);
      if (hip.userData.knee) { const [t2x, t2z] = aim(inv(dir(K, F), t1x, t1z)); hip.userData.knee.rotation.set(t2x, 0, t2z); }
    }
    // head follows its particle, gun stays in the right hand
    const hd = dir(CHE, HED); if (m.headG) m.headG.rotation.set(Math.atan2(hd[2], hd[1]), 0, -Math.asin(Math.max(-1, Math.min(1, hd[0]))));
    const hp = L(HNR), fd = dir(ELR, HNR);
    m.gun.position.set(hp[0], hp[1] + 0.87, hp[2]); m.gun.rotation.order = 'YXZ';
    m.gun.rotation.set(Math.asin(Math.max(-1, Math.min(1, fd[1]))), Math.atan2(-fd[0], -fd[2]), 0);
  }

  // put a mesh back the way syncMesh expects a living soldier
  static reset(m) {
    m.root.rotation.order = 'XYZ'; m.root.rotation.set(0, 0, 0); m.body.position.set(0, 0, 0); m.body.rotation.set(0, 0, 0);
    if (m.headG) m.headG.rotation.set(0, 0, 0); m.gun.rotation.order = 'XYZ'; m.gun.rotation.set(0, 0, 0);
    for (const hip of m.legs) { hip.rotation.order = 'XYZ'; hip.rotation.set(0, 0, 0); const kn = hip.userData.knee; if (kn) { kn.rotation.set(0, 0, 0); if (kn.userData.foot) kn.userData.foot.rotation.set(0, 0, 0); } }
    for (const sh of m.arms) { sh.rotation.set(0, 0, 0); if (sh.userData.el) sh.userData.el.rotation.set(0, 0, 0); }
  }
}

export function makeRagdoll(col, actor, mesh, killer, weapon, head) {
  let dx = actor.pos.x - killer.pos.x, dz = actor.pos.z - killer.pos.z; const dl = Math.hypot(dx, dz);
  if (dl < 0.01) { const a = Math.random() * 6.28; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= dl; dz /= dl; }
  const id = weapon.id, k = 0.85 + Math.random() * 0.3;
  const imp = (IMPULSE[id] || 2.5) * k * (head ? 0.8 : 1);
  const conscious = head ? 0.25 + Math.random() * 0.1 : (CONSCIOUS[id] || 0.9) * (0.7 + Math.random() * 0.6);
  return new Ragdoll(col, actor, mesh, { dx, dz, imp, head, conscious, hand: Math.random() < 0.5 ? 0 : 1 });
}
