// Dirt bike racing: pure simulation (no rendering, no THREE) so it can be unit-tested in Node.
// Coordinates match the shooter: x east/west, z north/south, y up; yaw 0 faces -z, positive yaw turns left (towards -x).

export const HW = 7;                 // half width of the dirt track (m)
export const VMAX = 31;              // top speed on the track (m/s, ~110 km/h)
const G = 24;                        // gravity (a bit heavy so jumps feel snappy)
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const smooth = (t) => t * t * (3 - 2 * t);

// closed loop control points [x, z]; a long start straight, a hairpin, an esses section and a big sweeper
const CP0 = [[-10, 70], [45, 72], [92, 55], [108, 12], [82, -22], [48, -18], [30, 8], [4, 12], [-18, -14], [-8, -50], [-45, -72], [-95, -58], [-112, -15], [-92, 25], [-52, 38], [-38, 62]];
const CP = CP0.map(([x, z]) => [x * 1.4, z * 1.4]);

export class Track {
  constructor() {
    const dense = [], n = CP.length, K = 48;
    for (let i = 0; i < n; i++) {
      const p0 = CP[(i + n - 1) % n], p1 = CP[i], p2 = CP[(i + 1) % n], p3 = CP[(i + 2) % n];
      for (let k = 0; k < K; k++) {
        const t = k / K, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const L = cum[dense.length], N = 640, ds = L / N;
    this.N = N; this.ds = ds; this.length = L;
    this.x = new Float32Array(N); this.z = new Float32Array(N); this.y = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N); this.curv = new Float32Array(N); this.yaw = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i * ds;
      while (j < dense.length - 1 && cum[j + 1] < s) j++;
      const a = dense[j], b = dense[(j + 1) % dense.length], u = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      this.x[i] = a[0] + (b[0] - a[0]) * u; this.z[i] = a[1] + (b[1] - a[1]) * u;
    }
    // the loop runs clockwise as drawn; flip so the start straight heads east (x increasing)
    for (let i = 0; i < N; i++) {
      const a = (i + 1) % N, b = (i + N - 1) % N, dx = this.x[a] - this.x[b], dz = this.z[a] - this.z[b], l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l; this.tz[i] = dz / l; this.yaw[i] = Math.atan2(-this.tx[i], -this.tz[i]);
    }
    for (let i = 0; i < N; i++) this.curv[i] = wrap(this.yaw[(i + 1) % N] - this.yaw[(i + N - 1) % N]) / (2 * ds);
    // height profile along the lap: rolling hills + four jumps (kicker up over Lu metres, sharp drop over Ld)
    const jumps = [[0.14, 2.2, 15, 7], [0.37, 1.7, 13, 6], [0.6, 2.7, 17, 8], [0.82, 1.9, 14, 6]];
    for (let i = 0; i < N; i++) {
      const s = i * ds, f = s / L;
      let y = 0.7 * Math.sin(TAU * 7 * f) + 0.5 * Math.sin(TAU * 13 * f + 1) + 0.9 * Math.sin(TAU * 3 * f + 2);
      for (const [f0, A, Lu, Ld] of jumps) {
        let u = s - f0 * L; if (u > L / 2) u -= L; if (u < -L / 2) u += L;
        if (u >= -Lu && u <= 0) y += A * (0.5 - 0.5 * Math.cos(Math.PI * (u + Lu) / Lu));
        else if (u > 0 && u <= Ld) y += A * (0.5 + 0.5 * Math.cos(Math.PI * u / Ld));
      }
      this.y[i] = y + 1.5;
    }
    // start line on the middle of the first straight
    let sh = 0, bd = 1e18; for (let i = 0; i < N; i++) { const d = Math.hypot(this.x[i] - 31, this.z[i] - 99); if (d < bd) { bd = d; sh = i; } }
    for (const k of ['x', 'z', 'y', 'tx', 'tz', 'curv', 'yaw']) { const src = this[k], dst = new Float32Array(N); for (let i = 0; i < N; i++) dst[i] = src[(i + sh) % N]; this[k] = dst; }
    this.jumps = jumps.map((j) => ({ idx: ((Math.round(j[0] * N) - sh) % N + N) % N, h: j[1] }));
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < N; i++) { x0 = Math.min(x0, this.x[i]); x1 = Math.max(x1, this.x[i]); z0 = Math.min(z0, this.z[i]); z1 = Math.max(z1, this.z[i]); }
    this.bounds = { x0: x0 - 60, x1: x1 + 60, z0: z0 - 60, z1: z1 + 60 };
  }

  left(i) { return [this.tz[i], -this.tx[i]]; }                    // left of the direction of travel (matches yaw: 0 faces -z, left is -x)

  // nearest centreline sample to (x, z); `hint` narrows the search to a window around the last answer
  nearest(x, z, hint = -1) {
    const N = this.N; let best = 0, bd = 1e18;
    const test = (i) => { const dx = x - this.x[i], dz = z - this.z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } };
    if (hint < 0) for (let i = 0; i < N; i++) test(i);
    else for (let k = -30; k <= 30; k++) test((hint + k + N) % N);
    return best;
  }

  // ground info at (x, z): height, distance from the centreline, whether on the dirt, progress index
  terrainAt(x, z) { return 0.9 * Math.sin(x * 0.031) * Math.cos(z * 0.027) - 0.5; }
  ground(x, z, hint = -1) {
    const B = this.bounds;
    if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return { h: this.terrainAt(x, z), d: 999, lat: 0, on: false, i: hint >= 0 ? hint : 0 };      // far from the track: just rolling grass (free ride goes anywhere)
    const N = this.N, i = this.nearest(x, z, hint);
    // project onto the neighbouring segment for a smooth height and distance
    const dx = x - this.x[i], dz = z - this.z[i];
    const along = dx * this.tx[i] + dz * this.tz[i];
    const j = along >= 0 ? (i + 1) % N : (i + N - 1) % N, tt = Math.min(1, Math.abs(along) / this.ds);
    const trackY = this.y[i] + (this.y[j] - this.y[i]) * tt;
    const lat = dx * this.tz[i] - dz * this.tx[i];                  // +left
    const d = Math.abs(lat);
    const t = smooth(clamp((d - HW) / 9, 0, 1));
    const terrain = this.terrainAt(x, z);
    return { h: trackY * (1 - t) + terrain * t, d, lat, on: d < HW + 0.6, i };
  }
}

export class Bike {
  constructor(track, o = {}) {
    this.track = track; this.id = o.id || 0; this.name = o.name || 'Rider'; this.color = o.color || 0xd8281c; this.isPlayer = !!o.isPlayer;
    this.nid = o.nid ?? this.id; this.remote = false; this.gone = false; this.bestLap = 0; this.skill = o.skill || 1; this.lane = o.lane || 0; this.laneT = this.lane;
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.speed = 0; this.vx = 0; this.vz = 0; this.vy = 0;
    this.air = false; this.pitch = 0; this.roll = 0; this.st = 0; this.nitro = 1; this.boosting = false; this.on = true;
    this.idx = 0; this.prog = 0; this.lap = 0; this.lapStart = 0; this.lapTimes = []; this.finished = false; this.finishT = 0; this.stuckT = 0; this.landed = 0; this.offT = 0;
    this.wheel = 0; this.thr = 0; this.wh = 0; this.wheelie = false; this.free = false; this.whT = 0;
  }
  place(idx, lat = 0) {
    const T = this.track, N = T.N, i = ((idx % N) + N) % N, l = T.left(i);
    this.x = T.x[i] + l[0] * lat; this.z = T.z[i] + l[1] * lat; this.yaw = T.yaw[i];
    const g = T.ground(this.x, this.z, i); this.y = g.h; this.idx = i; this.on = g.on;
    this.speed = 0; this.vx = this.vz = this.vy = 0; this.air = false; this.pitch = 0; this.roll = 0; this.stuckT = 0; this.offT = 0;
  }
  // put the bike back on the track just ahead of where it is (used by the reset key and when stuck)
  reset() { this.place(this.idx + 3, 0); this.nitro = Math.max(this.nitro, 0.3); }

  update(dt, inp) {
    const T = this.track;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const boosting = !!inp.boost && this.nitro > 0.02 && !this.air;
    this.boosting = boosting; this.thr = inp.thr;
    // wheelie (Shift): front wheel up while on the ground and moving; holding one slowly tops the nitro up
    const wantWh = !!inp.wheelie && !this.air && this.speed > 5;
    this.wh += ((wantWh ? 1 : 0) - this.wh) * Math.min(1, dt * (wantWh ? 3.2 : 4.5)); this.wheelie = this.wh > 0.35; this.whT = this.wheelie ? this.whT + dt : 0;
    if (this.wheelie) this.nitro = Math.min(1, this.nitro + dt * 0.1);
    if (boosting) this.nitro = Math.max(0, this.nitro - dt * 0.34); else this.nitro = Math.min(1, this.nitro + dt * 0.05);
    const vmax = VMAX * (this.on ? 1 : 0.62) * (boosting ? 1.3 : 1) * this.skill;
    this.st += (inp.steer - this.st) * Math.min(1, dt * 9);
    if (!this.air) {
      let a = 0;
      if (inp.thr > 0) a += inp.thr * 15 * Math.max(0, 1 - Math.max(0, this.speed) / vmax) * (boosting ? 1.8 : 1) * (1 - 0.18 * this.wh);
      if (inp.brk > 0) a -= inp.brk * (this.speed > 0.5 ? 30 : 7);
      a -= this.speed * 0.04 + (this.speed > 0 ? 1.4 : -1.4) * (this.on ? 1 : 3);              // drag + rolling resistance (dirt is grippy, grass is not)
      a -= 9.8 * Math.sin(this.pitch) * 0.75;                                                    // hills cost speed going up, give it back going down
      if (this.speed > vmax) a -= (this.speed - vmax) * 2;
      this.speed = clamp(this.speed + a * dt, -6, VMAX * 1.5);
      const yr = this.st * 2.3 * (1 - 0.45 * this.wh) / (1 + Math.max(0, Math.abs(this.speed)) / 15) * Math.min(1, Math.abs(this.speed) / 4) * (this.speed >= 0 ? 1 : -1);
      this.yaw += yr * dt;
      const nfx = -Math.sin(this.yaw), nfz = -Math.cos(this.yaw);
      this.vx = nfx * this.speed; this.vz = nfz * this.speed;
    } else this.yaw += this.st * 0.45 * dt;
    if (this.free) { this.x += this.vx * dt; this.z += this.vz * dt; }                                   // free ride: no edge of the world
    else { this.x = clamp(this.x + this.vx * dt, T.bounds.x0, T.bounds.x1); this.z = clamp(this.z + this.vz * dt, T.bounds.z0, T.bounds.z1); }
    // vertical: ballistic, snapped to the ground whenever it would end up underneath it (so crests launch you, dips don't)
    const g = T.ground(this.x, this.z, this.free && this.far ? -1 : this.idx);
    this.far = g.d > 30;
    const yFree = this.y + this.vy * dt - 0.5 * G * dt * dt;
    if (yFree <= g.h + 0.001) {
      const wasAir = this.air;
      if (wasAir) {
        this.landed = Math.max(0, -this.vy);
        if (this.landed > 11) this.speed *= 1 - Math.min(0.2, (this.landed - 11) * 0.02);       // hard landings scrub speed
        this.vy = 0;
        const nfx = -Math.sin(this.yaw), nfz = -Math.cos(this.yaw); this.speed = Math.max(0, this.vx * nfx + this.vz * nfz);
        this.vx = nfx * this.speed; this.vz = nfz * this.speed;
      } else this.vy = Math.max(-30, Math.min(16, (g.h - this.y) / dt));
      this.y = g.h; this.air = false;
    } else {
      if (!this.air && this.vy < 1.5 && yFree - g.h < 0.12) { this.y = g.h; }                    // tiny hops over bumps stay glued
      else { this.air = true; this.y = yFree; this.vy -= G * dt; }
    }
    this.on = g.on; this.idx = g.i;
    // visual attitude: follow the slope on the ground, level out on the velocity in the air; lean into turns
    const f2x = -Math.sin(this.yaw), f2z = -Math.cos(this.yaw);
    let pt;
    if (!this.air) { const gf = T.ground(this.x + f2x * 0.7, this.z + f2z * 0.7, this.idx).h, gb = T.ground(this.x - f2x * 0.7, this.z - f2z * 0.7, this.idx).h; pt = Math.atan2(gf - gb, 1.4); }
    else pt = Math.atan2(this.vy, Math.max(6, Math.hypot(this.vx, this.vz))) * 0.8 + (inp.thr > 0 ? 0.08 : 0);
    pt += this.wh * 0.62;
    this.pitch += (pt - this.pitch) * Math.min(1, dt * (this.air ? 3 : 14));
    this.roll += (this.st * Math.min(1, Math.abs(this.speed) / 18) * 0.55 - this.roll) * Math.min(1, dt * 7);
    this.wheel += this.speed * dt;
    // off the map / stuck for too long -> back on the track
    this.offT = !this.free && g.d > HW + 38 ? this.offT + dt : 0;
    this.stuckT = (!this.free && !this.air && Math.abs(this.speed) < 1.2 && inp.thr > 0.5) ? this.stuckT + dt : 0;
    if (this.offT > 2 || this.stuckT > 4) this.reset();
  }
}

// ---- AI rider: aims at a point further up the track, brakes for corners it can see coming, picks a lane
export function aiControl(bike, track, dt, boostOk) {
  const N = track.N, ds = track.ds, v = Math.max(0, bike.speed);
  const la = 9 + v * 0.5, ti = (bike.idx + Math.round(la / ds)) % N, l = track.left(ti);
  bike.laneT += (bike.lane - bike.laneT) * Math.min(1, dt * 0.8);
  const tx = track.x[ti] + l[0] * bike.laneT, tz = track.z[ti] + l[1] * bike.laneT;
  const want = Math.atan2(-(tx - bike.x), -(tz - bike.z)), err = wrap(want - bike.yaw);
  let kmax = 0; const span = Math.max(8, Math.round((v * 1.4 + 6) / ds));
  for (let k = 0; k < span; k += 3) kmax = Math.max(kmax, Math.abs(track.curv[(bike.idx + k) % N]));
  const vSafe = clamp(Math.sqrt(20 * bike.skill / Math.max(kmax, 1e-3)), 11, VMAX * 1.05);
  const over = v - vSafe;
  return { thr: over < 0 ? 1 : 0, brk: over > 2 ? clamp(over / 8, 0.2, 1) : 0, steer: clamp(err * 2, -1, 1), boost: !!boostOk && kmax < 0.012 && v > 20 };
}

const NAMES = ['Dusty', 'Mud', 'Roost', 'Kicker', 'Whip', 'Berm', 'Scrub', 'Nitro', 'Clutch'];
const COLORS = [0xd8281c, 0x1f6fd1, 0x2fae4a, 0xf0b400, 0x8e44ad, 0x16a39a, 0xe86a1a];

// ---- the whole race: grid, countdown, laps, ranking
export class RaceSim {
  constructor(o = {}) {
    this.track = new Track(); this.laps = o.laps ?? 3; this.free = this.laps === 0;
    this.diff = o.diff || 'normal'; this.t = this.free ? 0 : -3.5; this.state = this.free ? 'racing' : 'countdown'; this.finishOrder = [];
    const base = { easy: 0.86, normal: 0.94, hard: 1.0 }[this.diff] || 0.94, T = this.track;
    this.bikes = [];
    // riders: [{ nid, name, color, kind }]  kind 'me' = driven here, 'bot' = AI simulated here, 'remote' = driven by someone else (poses come from the network)
    const riders = o.riders || RaceSim.defaultRiders(this.free ? 0 : (o.bots ?? 5), o.color);
    riders.forEach((r, k) => {
      const isP = r.kind === 'me';
      const b = new Bike(T, { id: k, nid: r.nid ?? k, isPlayer: isP, name: r.name, color: r.color, skill: r.kind === 'bot' ? base * (0.97 + 0.05 * ((k * 7) % 5) / 4) : 1, lane: (((k * 5) % 7) - 3) * 1.1 });
      b.remote = r.kind === 'remote';
      const row = Math.floor(k / 2), side = k % 2 ? 2.4 : -2.4;
      b.place(T.N - Math.round((7 + row * 7) / T.ds), side);
      b.prog = -(7 + row * 7); b.idx = ((T.N - Math.round((7 + row * 7) / T.ds)) % T.N + T.N) % T.N;
      b.free = this.free; this.bikes.push(b);
    });
    this.player = this.bikes.find((b) => b.isPlayer) || this.bikes[0];
  }

  // you + `bots` AI riders (you start towards the back of the grid, like before)
  static defaultRiders(bots, color) {
    const n = bots + 1, slot = Math.min(4, n - 1), out = [];
    for (let k = 0; k < n; k++) out.push(k === slot ? { nid: k, kind: 'me', name: 'You', color: color ?? 0xd8281c } : { nid: k, kind: 'bot', name: NAMES[(k * 3 + 1) % NAMES.length], color: COLORS[(k + 1) % COLORS.length] });
    return out;
  }

  rank() {
    const arr = this.bikes.filter((b) => !b.gone).sort((a, b) => (a.finished && b.finished) ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog);
    arr.forEach((b, i) => { b.place_ = i + 1; });
    return arr;
  }

  update(dt, pin) {
    const T = this.track, L = T.length;
    if (this.state === 'countdown') { this.t += dt; if (this.t >= 0) this.state = 'racing'; }
    else if (this.state !== 'racing' && this.state !== 'done') return;
    else this.t += dt;
    const racing = this.state !== 'countdown';
    const pp = this.player.prog;
    for (const b of this.bikes) {
      if (b.remote || b.gone) continue;                                                             // other people's bikes are posed from the network
      let inp = { thr: 0, brk: 0, steer: 0, boost: false };
      if (racing && !(b.finished && b.isPlayer)) {
        if (b.isPlayer) inp = pin; else {
          const rb = clamp((pp - b.prog) / 500, -0.04, 0.06);                                    // gentle rubber band so the pack stays together
          const sk = b.skill; b.skill = sk * (1 + rb); inp = aiControl(b, T, dt, b.nitro > 0.5 && sk > 0.97); b.skill = sk;
        }
      } else if (b.finished) inp = { thr: 0, brk: 0.6, steer: 0, boost: false };
      const old = b.idx; b.update(dt, inp);
      let d = b.idx - old; if (d > T.N / 2) d -= T.N; if (d < -T.N / 2) d += T.N;
      if (Math.abs(d) < 45) b.prog += d * T.ds;                                                    // ignore teleports (reset / shortcuts through the grass)
      if (racing && !b.finished && !this.free) {
        const lap = Math.floor(b.prog / L);
        if (lap > b.lap) { b.lapTimes.push(this.t - b.lapStart); b.lapStart = this.t; b.lap = lap; if (lap >= this.laps) { b.finished = true; b.finishT = this.t; this.finishOrder.push(b); } }
      } else if (this.free && racing) { const lap = Math.floor(b.prog / L); if (lap > b.lap) { b.lapTimes.push(this.t - b.lapStart); b.lapStart = this.t; b.lap = lap; } }
    }
    // bikes shove each other a little
    for (let i = 0; i < this.bikes.length; i++) for (let j = i + 1; j < this.bikes.length; j++) {
      const a = this.bikes[i], c = this.bikes[j]; if (a.gone || c.gone) continue; const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
      if (d < 1.1 && d > 1e-4 && Math.abs(a.y - c.y) < 1.4) {
        const push = (1.1 - d) * 0.5, nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push; c.x += nx * push; c.z += nz * push;
        if (a.speed > c.speed) { a.speed -= 0.4; c.speed += 0.2; } else { c.speed -= 0.4; a.speed += 0.2; }
      }
    }
    if (this.player.finished && this.state === 'racing') this.state = 'done';
  }
}
