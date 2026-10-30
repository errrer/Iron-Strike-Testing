// Third-person character animation (bots, other players, zombies): a procedural locomotion cycle with strafing legs,
// speed-scaled stride, pelvis bounce, torso lean, jump / landing poses, crouch, slide, head look, breathing, low-ready sprint carry,
// recoil, reload and draw animations for the hands. Everything is driven by the actor's velocity / state, so it also
// works for remote players (whose state arrives in snapshots).
import { holdGun } from './soldier.js?v=0.18.7';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function state(m, a) {
  return m.an || (m.an = { ph: Math.random() * 6, ang: 0, rev: 1, k: 0, air: 0, land: 0, vy: 0, was: true, ck: 0, lean: 0, lat: 0, low: 0, relT: -1, wasRel: false, sw: 0, wasSw: 0, seed: (a.id * 1.7) % 6.28, atk: 0, pitch: 0 });
}

// resets every joint the animation touches, so nothing (a ragdoll, a gore hit, a dropped frame) can leave a limb twisted
export function resetJoints(m) {
  for (const hip of m.legs) {
    hip.rotation.order = 'YXZ'; hip.rotation.set(0, 0, 0);
    const kn = hip.userData.knee; if (kn) { kn.rotation.set(0, 0, 0); if (kn.userData.foot) kn.userData.foot.rotation.set(0, 0, 0); }
  }
}

export function animateSoldier(g, a, m, dt) {
  const an = state(m, a), t = g.time;
  const vx = a.vel.x, vz = a.vel.z, sp = Math.hypot(vx, vz);
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
  const lf = vx * fx + vz * fz, lr = vx * rx + vz * rz;
  const moving = sp > 0.35;

  // smoothed speed, move direction relative to the facing (legs turn to the way you travel; walking backwards reverses the cycle)
  an.k = damp(an.k, Math.min(sp, 7), 9, dt);
  const spK = clamp(an.k / 5.2, 0, 1.3);
  let raw = 0, rev = 1;
  if (moving) { raw = Math.atan2(lr, lf); if (Math.abs(raw) > Math.PI / 2) { raw -= Math.sign(raw) * Math.PI; rev = -1; } }
  an.ang = damp(an.ang, raw, 13, dt);
  an.rev = rev;
  const crouchT = a.crouch || a.slideT > 0 ? 1 : 0;
  an.ck = damp(an.ck, crouchT, 13, dt);
  const ck = an.ck;
  const stride = (1.5 + sp * 1.12) * (1 - 0.3 * ck);
  if (moving && a.onGround) an.ph += rev * dt * stride;

  // air / landing
  if (!a.onGround) an.vy = a.vel.y;
  if (a.onGround && !an.was) an.land = clamp(-an.vy / 8, 0.15, 1);
  an.was = a.onGround; an.land = Math.max(0, an.land - dt * 4.2);
  an.air = damp(an.air, a.onGround ? 0 : 1, 14, dt);

  const sprintK = damp(an.sprintK || 0, (sp > 5.3 && lf > 3.5 && a.onGround && !crouchT) ? 1 : 0, 9, dt); an.sprintK = sprintK;
  const A = lerp(0.16, 0.74, clamp(an.k / 4.6, 0, 1)) + 0.2 * sprintK;       // thigh swing amplitude
  const flexAmp = 0.3 + 0.95 * spK + 0.3 * sprintK;
  const idle = 1 - clamp(an.k / 1.0, 0, 1);

  // ---- legs
  for (let i = 0; i < 2; i++) {
    const hip = m.legs[i], kn = hip.userData.knee, ft = kn && kn.userData.foot;
    const phi = an.ph + i * Math.PI, sw = Math.sin(phi), c = Math.cos(phi);
    const moveK = clamp(an.k / 0.8, 0, 1);
    let th = sw * A * moveK * (1 - 0.35 * ck) - 0.0;
    let kf = (Math.max(0, c * an.rev) * flexAmp + 0.07) * moveK * (1 - 0.6 * ck);
    // stance: slight weight shift when standing still
    th += (i ? -1 : 1) * 0.02 * idle;
    // crouch folds both legs (thigh forward, knee bent), landing squashes them for a moment
    th = th * (1 - ck) + th * 0.5 * ck + 1.1 * ck;
    kf = kf * (1 - ck) + 1.45 * ck + kf * 0.4 * ck;
    const sq = an.land * 0.65; th += sq * 0.55; kf += sq * 0.95;
    // jump / fall: one knee up, one trailing
    const lead = i === 0 ? 1 : -1;
    const fall = clamp(-a.vel.y / 8, 0, 1);
    th = lerp(th, lead * 0.5 + 0.1 - fall * lead * 0.2, an.air * (1 - ck * 0.5));
    kf = lerp(kf, lead > 0 ? 0.95 - fall * 0.5 : 0.35 + fall * 0.2, an.air * (1 - ck * 0.5));
    if (a.mantle) { const sc = Math.sin(t * 17 + i * Math.PI); th = 0.95 + sc * (a.mantle.vault ? 0.25 : 0.5) * (i ? 1 : -1) * -1; kf = 1.2 + (sc > 0 ? 0.35 : 0); }
    hip.rotation.order = 'YXZ';
    hip.rotation.set(th, -an.ang * clamp(an.k / 1.5, 0, 1) * (1 - ck * 0.5), 0);
    if (kn) { kn.rotation.set(-kf, 0, 0); if (ft) ft.rotation.set(clamp(-(th - kf) * 0.55, -0.5, 0.5) + (c * an.rev > 0.4 ? 0.15 : 0), 0, 0); }
  }

  // ---- body: pelvis bounce, breathing, lean
  const ph2 = Math.sin(an.ph);
  const bounce = -0.045 * clamp(an.k / 4, 0, 1.2) * ph2 * ph2 * (1 - ck);
  const breath = Math.sin(t * 1.9 + an.seed) * 0.005 * (0.4 + idle);
  const dip = -an.land * 0.2 * (1 - ck) - 0.06 * an.sprintK;
  m.body.position.set(Math.sin(an.ph) * 0.012 * clamp(an.k / 4, 0, 1) * (1 - ck), -0.34 * ck + bounce + breath + dip - an.air * 0.04, 0);
  const leanF = clamp(lf * 0.022, -0.1, 0.16) + 0.1 * sprintK;
  const leanS = clamp(-lr * 0.016, -0.1, 0.1);
  an.lean = damp(an.lean, leanF, 8, dt); an.lat = damp(an.lat, leanS, 8, dt);
  m.body.rotation.set(an.lean + (a.slideT > 0 ? -0.35 : 0) + (a.mantle ? 0.28 : 0), 0, an.lat);
  if (m.rich) m.rich.position.y = moving ? Math.abs(Math.sin(an.ph)) * 0.05 : 0;

  // ---- head: looks where the soldier aims, with a slow idle glance
  if (m.headG) {
    const glance = Math.sin(t * 0.45 + an.seed * 2) * 0.22 * idle;
    an.pitch = damp(an.pitch, clamp(a.pitch, -0.9, 0.9), 14, dt);
    m.headG.rotation.set(clamp(an.pitch * 0.75 - an.lean * 0.7, -0.7, 0.7), glance, -an.lat * 0.6);
  }

  // ---- hands / gun
  const kick = clamp(1 - (t - a.lastShot) / 0.13, 0, 1);
  an.sw = damp(an.sw, a.switchT > 0 ? clamp(a.switchT / 0.38, 0, 1) : 0, 22, dt);
  if (a.reloading) { if (an.relT < 0) an.relT = 0; an.relT += dt; } else an.relT = -1;
  const rl = Math.max(0.3, (a.weapon && a.weapon.reload) || 2);
  const rel = an.relT >= 0 ? clamp(an.relT / rl, 0, 1) : -1;
  an.low = damp(an.low, (an.sprintK > 0.5 || a.mantle) && !a.reloading && kick < 0.01 ? 1 : 0, 10, dt);
  const sway = Math.sin(t * 1.7 + an.seed) * 0.012 * idle;
  holdGun(m, (a.isPlayer ? 0 : a.pitch * 0.7) + sway + (a.ads > 0.5 ? 0.02 : 0), { low: an.low, kick, sw: an.sw, rel });
}

// ---- zombies -----------------------------------------------------------------------------------------------------
// Shamblers drag their feet with arms out; runners and sprinters lunge forward with a wilder gait; everyone swipes when
// a player is in reach and staggers briefly when hit.
export function animateZombie(g, a, m, dt) {
  const an = state(m, a), t = g.time;
  const sp = Math.hypot(a.vel.x, a.vel.z), moving = sp > 0.25;
  an.k = damp(an.k, sp, 8, dt);
  const run = clamp((an.k - 1.4) / 3.4, 0, 1);                 // 0 shambler .. 1 sprinter
  an.ph += dt * (1.3 + an.k * (1.35 - 0.3 * run)) * (moving ? 1 : 0.2);
  // a zombie "limps" with one dragging leg (decided by id)
  const limp = (a.id % 3 === 0) ? 1 : 0;
  // attacks: host reads the AI timer, clients treat a nearby player as being attacked
  let attacking = false;
  if (a.zs) attacking = a.zs.atk > 0.55 && a.zs.atk < 1.0 + 1e-6 && !a.zs.win;
  else if (g.player && g.player.alive) attacking = Math.hypot(g.player.pos.x - a.pos.x, g.player.pos.z - a.pos.z) < 1.5;
  an.atk = attacking ? an.atk + dt * 4.2 : 0;
  const swipe = attacking ? Math.max(0, Math.sin(an.atk * 1.0)) : 0;
  const tear = a.zs && a.zs.win && a.zs.tear > 0 ? 1 : 0;          // tearing a board off a window
  const tm = (g.time * 5 + a.id) % 6.28;

  for (let i = 0; i < 2; i++) {
    const hip = m.legs[i], kn = hip.userData.knee, ft = kn && kn.userData.foot, lg = limp && i === 1;
    const phi = an.ph + i * Math.PI, sw = Math.sin(phi), c = Math.cos(phi);
    const A = (0.28 + 0.5 * run) * (lg ? 0.45 : 1);
    let th = sw * A * clamp(an.k / 0.6, 0, 1) + (lg ? -0.12 : 0.04);
    let kf = (Math.max(0, c) * (0.45 + 0.7 * run) + 0.1) * clamp(an.k / 0.6, 0, 1) * (lg ? 0.3 : 1);
    hip.rotation.order = 'YXZ'; hip.rotation.set(th, (lg ? 0.14 : 0) + (i ? -0.04 : 0.04), 0);
    if (kn) { kn.rotation.set(-kf, 0, 0); if (ft) ft.rotation.set(lg ? 0.7 : clamp(-(th - kf) * 0.4, -0.4, 0.4), 0, 0); }
  }
  const lunge = a.crawl ? 0.55 + 0.1 * swipe : 0.1 + 0.2 * run + 0.15 * swipe;
  an.lean = damp(an.lean, lunge, 7, dt);
  const sway = Math.sin(an.ph) * 0.07 * clamp(an.k / 1, 0, 1);
  m.body.position.set(0, -0.03 * run * Math.abs(Math.sin(an.ph)) - 0.02 * swipe - (limp ? 0.03 : 0), 0);
  m.body.rotation.set(-an.lean, sway * (limp ? 1.5 : 1), sway * 0.6);
  // arms: reaching out, one swaying higher than the other; swipe = both claws sweep down; tearing = pull back and forth
  m.arms.forEach((arm, i) => {
    const s = i ? -1 : 1, ph = t * 2.2 + a.id * 1.7 + i * 1.4;
    let ax = 1.4 + Math.sin(ph) * 0.15 + (run > 0.5 ? -0.35 * run : 0), az = s * (0.08 + 0.05 * Math.sin(ph * 0.7)), el = 0.25 + Math.sin(ph * 1.3) * 0.12;
    if (swipe > 0) { ax = lerp(ax, 0.55 + 0.4 * Math.sin(an.atk * 2 + i), swipe); el = lerp(el, 0.3, swipe); az = lerp(az, s * 0.3, swipe); }
    if (tear) { ax = 1.7 + Math.sin(tm * 2 + i * 3) * 0.45; el = 0.4 + Math.max(0, Math.sin(tm * 2 + i * 3)) * 0.6; }
    arm.rotation.set(ax, 0, az); if (arm.userData.el) arm.userData.el.rotation.set(el, 0, 0);
  });
  if (m.headG) m.headG.rotation.set(0.15 + 0.15 * run + Math.sin(t * 3 + a.id) * 0.04, Math.sin(t * 0.8 + a.id) * 0.25, Math.sin(t * 0.6 + a.id * 2) * 0.22 + (limp ? 0.12 : 0));
}
