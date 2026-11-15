// DK Vehicle System (Drift Kings) v1.2.0
// One car-handling core shared by Drift Kings, Horizon Pages and the Iron Strike dirt bike race.
// Pure JS, no rendering. Conventions: forward = (sin th, cos th); +steer / +yaw rate = turning LEFT;
// u = forward speed, v = lateral speed (left +), w = yaw rate.
//
// Two handling profiles share the same tyre model:
//   'drift' - easy to start a slide (throttle, steering weight, handbrake) and easy to hold it (counter-steer assist).
//   'sim'   - no assists at all (no counter-steer, no anti-spin): a real tyre model for a wheel and pedals.
//   'grip'  - the car tracks the wheel and will NOT slide on throttle or hard steering. Only the handbrake breaks the
//             rear loose; let go and it hooks back up after a moment.
// dkHandling() is exported on its own so another physics core (Horizon Pages) can borrow just the handling layer.

export const DK_VERSION = '1.2.0';
const G = 9.81;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const PROFILES = {
  drift: {
    rearGrip: 1.0,        // rear lateral grip multiplier
    throttleCircle: 0.5,  // how much of the rear grip full throttle eats (friction circle)
    steerRearLoss: 0.18,  // extra rear grip loss when steering hard on throttle (x assist)
    hbRearLoss: 0.42,     // rear grip lost to the handbrake
    hbRelease: 8.5,       // 1/s: how fast the handbrake effect fades after letting go
    stab: 0,              // yaw-rate tracking strength (1/s); 0 = free to rotate
    limitSteer: false,    // cap the steering angle so the front tyres never saturate
    counter: 0.9,         // counter-steer assist gain (x assist) on slip angle
    catchBeta: 0.55,      // slip angle where the anti-spin moment starts
  },
  sim: {
    rearGrip: 1.0, throttleCircle: 0.62, steerRearLoss: 0, hbRearLoss: 0.72, hbRelease: 8,
    stab: 0, limitSteer: false, counter: 0, catchBeta: 9, noAssist: true,
  },
  grip: {
    rearGrip: 1.14,
    throttleCircle: 0.2,
    steerRearLoss: 0,
    hbRearLoss: 0.6,
    hbRelease: 2.6,       // slides for a beat after release, then regrips
    stab: 9,
    limitSteer: true,
    counter: 0.5,
    catchBeta: 0.45,
  },
};

// Handling layer. s: {u, v, w, delta, thr, steer, hbT, beta, Iz, L}; P: profile; assist 0..1.
// Returns { rearGripMul, steerAdd, yawMoment, throttleCircle, handbrakeLoss }.
export function dkHandling(P, s, assist = 0.75) {
  const hb = s.hbT, free = 1 - hb;
  const out = { rearGripMul: P.rearGrip, steerAdd: 0, yawMoment: 0, throttleCircle: P.throttleCircle, handbrakeLoss: P.hbRearLoss * hb, maxDelta: 9 };
  const ayMax = 0.9 * (s.mu || 1) * G;
  // grip: steering lock shrinks with speed so full lock = the tightest line the tyres can hold (handbrake releases the limit)
  if (P.limitSteer) out.maxDelta = lerp(ayMax * s.L * (1 + (s.u / 28) ** 2) / Math.max(s.u * s.u, 30), 9, hb);
  // counter-steer assist: fades in with speed, always on in drift, gentle in grip
  if (s.u > 3) out.steerAdd = assist * P.counter * clamp(s.beta, -0.75, 0.75) * (P === PROFILES.grip ? (1 - 0.5 * free) : 1);
  // steering-on-throttle rear loss (drift only)
  if (P.steerRearLoss) out.rearGripMul *= 1 - assist * P.steerRearLoss * sstep(0.3, 0.85, Math.abs(s.steer)) * s.thr * sstep(9, 18, s.u);
  // yaw-rate tracking: pulls the car toward the yaw rate the steering asks for (neutral steer with a touch of understeer)
  if (P.stab && s.u > 2) {
    const wRef = clamp(s.u * Math.tan(s.delta) / (s.L * (1 + (s.u / 28) ** 2)), -ayMax / Math.max(s.u, 5), ayMax / Math.max(s.u, 5));
    out.yawMoment -= P.stab * s.Iz * (s.w - wRef) * free * sstep(2, 9, Math.abs(s.u));
  }
  // anti-spin catch for big slip angles
  const over = Math.abs(s.beta) - P.catchBeta;
  if (over > 0) out.yawMoment += assist * s.Iz * 10 * over * Math.sign(s.beta);
  return out;
}

// Two-wheeler version of the grip profile (Iron Strike dirt bike). hbT 0..1 is the eased handbrake level.
// Returns the slide parameters for one frame: how fast sideways speed is pulled back in line (latRate, 1/s),
// how much the yaw rate is boosted by the locked rear wheel, speed scrubbed by the lock (m/s^2) and how much of the
// sideways speed the tyres turn back into forward speed (conv; the rest is lost as scrub).
export function dkBikeSlide(P, hbT, speed) {
  const k = clamp(hbT, 0, 1) * sstep(4, 9, Math.abs(speed));
  return { latRate: lerp(34, 1.8, k), yawBoost: 1 + 0.85 * k, scrub: 5.5 * k, conv: lerp(0.92, 0.3, k) };
}

const GEAR_MAX = [17, 29, 41, 52, 61, 70];

export class DKVehicle {
  constructor(spec, profile = 'drift') { this.assist = 0.75; this.setSpec(spec); this.setProfile(profile); this.reset(); }
  setSpec(spec) { this.spec = spec; }
  setProfile(name) { this.profileName = name; this.P = PROFILES[name] || PROFILES.drift; }
  reset(x = 0, z = 0, th = 0) {
    Object.assign(this, {
      x, z, th, u: 0, v: 0, w: 0, steer: 0, delta: 0, thr: 0, brk: 0, hb: 0, hbT: 0, nitro: 1, nitroOn: false,
      ax: 0, ay: 0, slipR: 0, spinF: 0, surf: 1, off: 0, rpm: 900, gear: 0, beta: 0,
    });
  }
  get speed() { return Math.hypot(this.u, this.v); }
  get slipAngle() { return Math.atan2(Math.abs(this.v), Math.max(this.u, 0.1)); }

  // inp: {steer -1..1 (+ = left), thr 0..1, brk 0..1, hb 0..1, nitro bool}
  setInput(raw, dt, chaining = false) {
    const inp = { steer: raw.steer || 0, thr: raw.thr || 0, brk: raw.brk || 0, hb: raw.hb || 0, nitro: !!raw.nitro };
    if (raw.direct) {            // wheel and pedals are already physical: no key-style smoothing
      this.steer = clamp(inp.steer, -1, 1); this.thr = clamp(inp.thr, 0, 1); this.brk = clamp(inp.brk, 0, 1);
    } else {
      const sp = Math.abs(this.u);
      let rate = lerp(8, 3.6, clamp(sp / 35, 0, 1));
      if (Math.abs(inp.steer) < 0.01 || inp.steer * this.steer < 0) rate *= 1.7;
      this.steer += clamp(inp.steer - this.steer, -rate * dt, rate * dt);
      this.thr += clamp(inp.thr - this.thr, -9 * dt, 5.5 * dt);
      this.brk += clamp(inp.brk - this.brk, -12 * dt, 10 * dt);
    }
    this.hb = inp.hb;
    const up = 12 * dt, down = this.P.hbRelease * dt;
    this.hbT += clamp(inp.hb - this.hbT, -down, up);
    this.nitroOn = !!inp.nitro && this.nitro > 0.02 && inp.thr > 0;
    if (this.nitroOn) this.nitro = Math.max(0, this.nitro - dt * 0.25);
    else this.nitro = Math.min(1, this.nitro + dt * (chaining ? 0.16 : 0.03));
  }

  // advance by dt (use a fixed ~1/120 s). env: {mu surface multiplier, off 0..1}
  step(dt) {
    const sp = this.spec, P = this.P, A = P.noAssist ? 0 : this.assist;
    const Lb = sp.a + sp.b;
    const Fzf = sp.m * G * sp.b / Lb, Fzr = sp.m * G * sp.a / Lb, Iz = sp.m * sp.a * sp.b * 1.35;
    const muS = sp.mu * this.surf;
    let { u, v, w } = this;
    const thr = this.thr, brk = this.brk, hb = this.hbT;
    const beta = u > 3 ? Math.atan2(v, u) : 0;
    this.beta = beta;
    const maxSt = sp.steer * (1 - 0.72 * clamp(Math.abs(u) / 45, 0, 1));
    const H = dkHandling(P, { u, v, w, delta: 0, thr, steer: this.steer, hbT: hb, beta, Iz, L: Lb, mu: muS }, A);
    const baseDelta = clamp(this.steer * maxSt, -Math.min(0.62, H.maxDelta), Math.min(0.62, H.maxDelta));
    H.yawMoment = dkHandling(P, { u, v, w, delta: baseDelta, thr, steer: this.steer, hbT: hb, beta, Iz, L: Lb, mu: muS }, A).yawMoment;
    const delta = clamp(baseDelta + H.steerAdd, -0.62, 0.62);
    this.delta = delta;
    const cd = Math.cos(delta), sd = Math.sin(delta);
    // engine / brakes
    let Fe = 0;
    if (thr > 0) { let cap = Math.min(sp.Fcap, sp.P / Math.max(Math.abs(u), 4)); if (this.nitroOn) cap *= 1.5; Fe = thr * cap; }
    let Fb = 0;
    if (brk > 0) { if (u > 1) Fb = brk * Math.min(sp.m * G * muS * 0.85, 13000); else if (u > -14) Fe -= brk * Math.min(sp.Fcap * 0.55, 4800); }
    if (hb > 0 && u > 1) Fb += hb * sp.m * G * 0.12;
    const rearMax = muS * Fzr;
    const FeC = clamp(Fe, -rearMax * 1.1, rearMax * 1.1);
    const use = Math.min(Math.abs(FeC) / rearMax, 1.2);
    let Fmr = rearMax * Math.sqrt(Math.max(0.1, 1 - H.throttleCircle * use * use));
    Fmr *= H.rearGripMul * (1 - H.handbrakeLoss);
    const Fmf = muS * Fzf * (1 - 0.12 * Math.min(1, brk));
    // tyre forces (saturating with a small fall-off past the peak)
    const vfy = (v + sp.a * w) * cd - u * sd, vfx = u * cd + (v + sp.a * w) * sd;
    const vry = v - sp.b * w;
    const af = vfy / Math.max(Math.abs(vfx), 3), ar = vry / Math.max(Math.abs(u), 3);
    const tire = (a) => Math.tanh(8.5 * a) * (1 - 0.22 * sstep(0.22, 0.6, Math.abs(a)));
    const Fyf = -Fmf * tire(af), Fyr = -Fmr * tire(ar);
    // drag + off-road resistance
    let Fd = 0.72 * u * Math.abs(u) + 160 * Math.tanh(u * 0.6);
    Fd += this.off * (900 * Math.tanh(u * 0.4) + 3.2 * u * Math.abs(u));
    const Fx = FeC - Fb * Math.tanh(u * 3) - Fd;
    const low = 1 - sstep(0, 5, Math.abs(u));
    const ax = (Fx - Fyf * sd) / sp.m + v * w;
    const ay = (Fyf * cd + Fyr) / sp.m - u * w - v * 8 * low;
    const aw = (sp.a * Fyf * cd - sp.b * Fyr + H.yawMoment) / Iz - w * 0.3 - w * 6 * low;
    u += ax * dt; v += ay * dt; w += aw * dt;
    u = clamp(u, -18, 85); v = clamp(v, -40, 40); w = clamp(w, -4, 4);
    this.u = u; this.v = v; this.w = w; this.ax = ax; this.ay = ay;
    this.slipR = Math.abs(vry); this.spinF = use;
    this.th += w * dt;
    const sn = Math.sin(this.th), cs = Math.cos(this.th);
    this.x += (u * sn + v * cs) * dt; this.z += (u * cs - v * sn) * dt;
    if (!Number.isFinite(this.x + this.z + this.u + this.v + this.w)) this.reset(0, 0, 0);
  }

  // gearbox / rpm for HUD + sound (call once per frame)
  updateEngine(dt) {
    const ua = Math.abs(this.u); let gi = 0; while (gi < 5 && ua > GEAR_MAX[gi]) gi++;
    let rf = clamp(ua / GEAR_MAX[gi], 0, 1); if (ua < 8 && this.thr > 0) rf = Math.max(rf, this.thr * 0.55);
    const tgt = 900 + rf * 6000 + this.thr * 350;
    this.rpm += (tgt - this.rpm) * Math.min(1, dt * 10);
    this.gear = ua < 0.5 ? (this.thr > 0.1 ? 1 : 0) : gi + 1;
  }
}
