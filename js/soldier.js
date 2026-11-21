// Low-poly soldier body used for bots and other players: vest, plates, pouches, backpack, boots, gloves and
// one of three headgear variants. Everything is built from boxes so it stays cheap with 18 players.
import * as THREE from 'three';

const cache = new Map();
export const mat = (hex, rough = 0.85) => {
  const k = hex + ':' + rough;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough }));
  return cache.get(k);
};
const shade = (hex, f) => { const r = Math.min(255, ((hex >> 16) & 255) * f) | 0, g = Math.min(255, ((hex >> 8) & 255) * f) | 0, b = Math.min(255, (hex & 255) * f) | 0; return (r << 16) | (g << 8) | b; };

export const SKIN = 0xd2a077, DARK = 0x23282c, OLIVE = 0x39432f, KHAKI = 0x4a4f3a;

export function bx(w, h, d, m, x, y, z, parent, rx = 0, ry = 0, rz = 0) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z); if (rx || ry || rz) me.rotation.set(rx, ry, rz);
  me.castShadow = true; parent.add(me); return me;
}

// Rig (body-local, feet at y=0, forward is -z):
//   pelvis > abdomen > chest > neck > head (+ helmet/cap/balaclava, ears, nose, brow)
//   shoulder pivot > upper arm > elbow group > forearm > hand (palm, 4 fingers, thumb)
//   hip pivot > thigh > knee group > shin > ankle/foot (boot)
// returns { head, arms: [L, R] (shoulder pivots, userData.el = elbow group), legs: [L, R] (hip pivots, userData.knee) }
export const ARM = { L1: 0.3, L2: 0.32 };      // upper arm, forearm + hand (to the middle of the palm)

export function buildSoldier(body, teamColor, seed = 0) {
  const team = mat(teamColor, 0.8), teamDk = mat(shade(teamColor, 0.6), 0.85), dark = mat(DARK, 0.9), olive = mat(OLIVE, 0.9), khaki = mat(KHAKI, 0.9);
  const skin = mat(SKIN, 0.8), skinDk = mat(shade(SKIN, 0.82), 0.8), black = mat(0x0c0d0e, 0.6), plate = mat(0x30363a, 0.7);

  // pelvis, belt, abdomen, chest
  bx(0.36, 0.18, 0.24, khaki, 0, 0.87, 0, body);
  bx(0.4, 0.06, 0.27, black, 0, 0.96, 0, body);
  for (const x of [-0.21, 0.21]) bx(0.06, 0.13, 0.1, dark, x, 0.9, 0.02, body);               // hip pouches
  bx(0.32, 0.2, 0.22, olive, 0, 1.06, 0, body);
  bx(0.42, 0.3, 0.26, olive, 0, 1.3, 0, body);
  // plate carrier vest
  bx(0.47, 0.36, 0.31, team, 0, 1.27, 0, body);
  bx(0.32, 0.25, 0.04, plate, 0, 1.3, -0.17, body);
  bx(0.32, 0.25, 0.04, plate, 0, 1.3, 0.17, body);
  for (const x of [-0.12, 0, 0.12]) bx(0.09, 0.11, 0.06, dark, x, 1.1, -0.17, body);          // mag pouches
  for (const s of [-1, 1]) bx(0.09, 0.07, 0.29, teamDk, s * 0.15, 1.46, 0, body);             // shoulder straps
  bx(0.3, 0.34, 0.13, dark, 0, 1.24, 0.24, body);                                            // backpack
  bx(0.22, 0.1, 0.1, olive, 0, 1.08, 0.29, body);
  bx(0.09, 0.1, 0.09, skin, 0, 1.51, 0, body);                                               // neck

  // head
  const head = new THREE.Group(); head.position.set(0, 1.66, 0); body.add(head);
  const v = Math.abs(seed | 0) % 3;
  if (v === 2) { bx(0.2, 0.22, 0.21, black, 0, 0, 0, head); bx(0.17, 0.05, 0.02, skin, 0, 0.035, -0.108, head); }   // balaclava, eye slit
  else {
    bx(0.19, 0.21, 0.2, skin, 0, 0, 0, head);
    bx(0.14, 0.06, 0.05, skinDk, 0, -0.085, -0.1, head);                                     // jaw / chin
    bx(0.035, 0.05, 0.04, skinDk, 0, -0.015, -0.115, head);                                  // nose
    bx(0.17, 0.02, 0.02, mat(0x2a1d14, 0.9), 0, 0.055, -0.105, head);                       // brow
    for (const s of [-1, 1]) bx(0.025, 0.06, 0.04, skinDk, s * 0.105, -0.01, 0.01, head);    // ears
  }
  for (const s of [-1, 1]) bx(0.035, 0.025, 0.01, black, s * 0.047, 0.03, -0.106, head);       // eyes
  if (v === 0) {                                                                              // combat helmet + NVG mount
    bx(0.26, 0.12, 0.27, olive, 0, 0.11, 0, head); bx(0.26, 0.04, 0.29, olive, 0, 0.06, 0, head); bx(0.07, 0.06, 0.05, dark, 0, 0.1, -0.16, head);
    bx(0.04, 0.1, 0.04, olive, 0.135, 0.01, 0.02, head);                                      // side rail
  } else if (v === 1) {                                                                       // cap + tinted goggles, hair at the back
    bx(0.23, 0.09, 0.24, dark, 0, 0.12, 0, head); bx(0.19, 0.02, 0.1, dark, 0, 0.08, -0.16, head); bx(0.21, 0.1, 0.05, mat(0x2a1d14, 0.9), 0, 0.0, 0.1, head);
    bx(0.21, 0.06, 0.04, black, 0, 0.035, -0.113, head); bx(0.16, 0.035, 0.01, mat(0x3fa7ff, 0.2), 0, 0.035, -0.135, head);
  } else bx(0.25, 0.09, 0.26, plate, 0, 0.11, 0, head);                                       // helmet over the balaclava

  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.28, 1.42, 0); body.add(sh);
    bx(0.14, 0.12, 0.17, teamDk, s * 0.01, 0.0, 0, sh);                                       // shoulder pad
    bx(0.115, ARM.L1, 0.115, olive, 0, -ARM.L1 / 2, 0, sh);                                   // upper arm
    const el = new THREE.Group(); el.position.set(0, -ARM.L1, 0); sh.add(el); sh.userData.el = el;
    bx(0.095, 0.09, 0.095, olive, 0, 0.0, 0, el);                                             // elbow
    bx(0.095, 0.26, 0.095, olive, 0, -0.13, 0, el);                                           // forearm
    const hd = new THREE.Group(); hd.position.set(0, -0.26, 0); el.add(hd);
    bx(0.088, 0.04, 0.05, black, 0, 0.0, 0, hd);                                              // wrist cuff
    bx(0.085, 0.09, 0.045, black, 0, -0.06, 0, hd);                                           // palm
    for (let i = 0; i < 4; i++) bx(0.02, 0.055, 0.032, black, -0.03 + i * 0.02, -0.125, -0.02, hd, -0.6);   // curled fingers
    bx(0.025, 0.05, 0.03, black, s * 0.055, -0.07, -0.02, hd, 0, 0, s * 0.5);                 // thumb
    arms.push(sh);
  }
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, 0.84, 0); body.add(hip);
    bx(0.17, 0.42, 0.19, khaki, 0, -0.21, 0, hip);                                            // thigh
    const knee = new THREE.Group(); knee.position.set(0, -0.42, 0); hip.add(knee); hip.userData.knee = knee;
    bx(0.17, 0.1, 0.07, dark, 0, 0.0, -0.1, knee);                                            // knee pad
    bx(0.15, 0.34, 0.17, khaki, 0, -0.19, 0, knee);                                           // shin
    const ft = new THREE.Group(); ft.position.set(0, -0.38, 0); knee.add(ft); knee.userData.foot = ft;
    bx(0.14, 0.07, 0.15, black, 0, 0.01, 0, ft);                                              // ankle
    bx(0.17, 0.06, 0.29, black, 0, -0.015, -0.04, ft);                                        // boot
    bx(0.17, 0.02, 0.3, dark, 0, -0.045, -0.04, ft);                                          // sole
    legs.push(hip);
  }
  return { head, arms, legs };
}

// ---- two-bone IK: both hands on the gun -----------------------------------------------------------------------
// Euler XYZ with ry = 0 maps a limb hanging along -Y onto direction d: rz = asin(dx), rx = atan2(-dz, -dy).
export const aim = (d) => [Math.atan2(-d[2], -d[1]), Math.asin(Math.max(-1, Math.min(1, d[0])))];
export const inv = (d, rx, rz) => {                                      // d in the parent's frame (undo Rx then Rz)
  let [x, y, z] = d; const c = Math.cos(-rx), s = Math.sin(-rx); [y, z] = [y * c - z * s, y * s + z * c];
  const c2 = Math.cos(-rz), s2 = Math.sin(-rz); [x, y] = [x * c2 - y * s2, x * s2 + y * c2]; return [x, y, z];
};
export const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// Poses one arm so the middle of its palm reaches target T (body space). Returns the distance it missed by.
export function solveArm(sh, T, side) {
  const S = [sh.position.x, sh.position.y, sh.position.z], { L1, L2 } = ARM;
  let d = [T[0] - S[0], T[1] - S[1], T[2] - S[2]]; const dist = Math.hypot(...d), reach = L1 + L2 - 0.004;
  const u = norm(d), dd = Math.min(reach, Math.max(Math.abs(L1 - L2) + 0.01, dist));
  const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pole = [side * 0.5, -1, 0.35], pu = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2];
  const pp = norm([pole[0] - u[0] * pu, pole[1] - u[1] * pu, pole[2] - u[2] * pu]);
  const E = [S[0] + u[0] * a + pp[0] * h, S[1] + u[1] * a + pp[1] * h, S[2] + u[2] * a + pp[2] * h];
  const H = [S[0] + u[0] * dd, S[1] + u[1] * dd, S[2] + u[2] * dd];
  const d1 = norm([E[0] - S[0], E[1] - S[1], E[2] - S[2]]), d2 = norm([H[0] - E[0], H[1] - E[1], H[2] - E[2]]);
  const [rx1, rz1] = aim(d1); sh.rotation.set(rx1, 0, rz1);
  const [rx2, rz2] = aim(inv(d2, rx1, rz1)); sh.userData.el.rotation.set(rx2, 0, rz2);
  return Math.max(0, dist - reach);
}

const rotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };

// Puts the gun in the soldier's hands: trigger hand on the grip, support hand on the foregrip.
// pitchRot tilts the gun around the grip. o = optional animation state:
//   low (0..1) gun lowered to a low-ready carry (sprinting), kick (0..1) recoil impulse, sw (0..1) draw/holster dip,
//   rel (0..1 reload progress, or -1/undefined when not reloading) support hand fetches a mag from the vest pouch.
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const magOf = (gun) => {                                 // average mag position in gun space (cached on the gun)
  const u = gun.userData; if (u._mag) return u._mag;
  let n = 0, sx = 0, sy = 0, sz = 0;
  gun.traverse((o) => { if (o !== gun && o.userData && o.userData.mag) { sx += o.position.x; sy += o.position.y; sz += o.position.z; n++; } });
  const f = u.fore ? [u.fore.x, u.fore.y, u.fore.z] : [0, 0, -0.25];
  return (u._mag = n ? [sx / n, sy / n, sz / n] : [f[0], f[1] - 0.04, f[2] + 0.2]);
};
export function holdGun(m, pitchRot, o = {}) {
  const gun = m.gun, u = gun.userData || {}, grip = u.grip ? [u.grip.x, u.grip.y, u.grip.z] : [0, -0.07, 0.1], fore = u.fore ? [u.fore.x, u.fore.y, u.fore.z] : [0, 0, -0.25];
  const pistol = !!u.pistol, low = o.low || 0, kick = o.kick || 0, sw = o.sw || 0, rel = o.rel == null ? -1 : o.rel;
  const env = rel >= 0 ? sstep(0, 0.14, rel) * (1 - sstep(0.82, 0.96, rel)) : 0;
  const HR0 = pistol ? [0.07, 1.31, -0.36] : [0.07, 1.2, -0.1];            // where the trigger hand holds the gun (body space)
  const HR = [HR0[0] - 0.05 * low + 0.01 * env, HR0[1] - 0.2 * low - 0.34 * sw + 0.03 * env, HR0[2] + 0.1 * low + 0.035 * kick - 0.06 * sw - 0.03 * env];
  pitchRot = pitchRot - 0.55 * low - 0.8 * sw + 0.07 * kick + 0.28 * env;
  const g = rotX(grip, pitchRot), f = rotX(fore, pitchRot);
  let sx = 0, sy = 0, sz = 0;
  // long guns: if the foregrip is out of the support arm's reach, pull the whole gun in toward that shoulder
  { const S = m.arms[0].position, off = [pistol ? 0.03 : 0, -0.04, 0], reach = ARM.L1 + ARM.L2 - 0.02;
    const T = [HR[0] - g[0] + f[0] + off[0], HR[1] - g[1] + f[1] + off[1], HR[2] - g[2] + f[2] + off[2]];
    const d = [S.x - T[0], S.y - T[1], S.z - T[2]], dl = Math.hypot(d[0], d[1], d[2]);
    if (dl > reach) { const k = (dl - reach) / dl; sx = d[0] * k; sy = d[1] * k; sz = d[2] * k; } }
  const hr = [HR[0] + sx, HR[1] + sy, HR[2] + sz];
  gun.position.set(hr[0] - g[0], hr[1] - g[1], hr[2] - g[2]); gun.rotation.set(pitchRot, 0, 0.32 * env * (pistol ? 0.6 : 1));
  let TL = [hr[0] - g[0] + f[0], hr[1] - g[1] + f[1], hr[2] - g[2] + f[2]];
  if (env > 0) {                                                            // support hand: off the foregrip, down to the vest pouch, then up to the magazine well
    const mg = rotX(magOf(gun), pitchRot), MG = [hr[0] - g[0] + mg[0], hr[1] - g[1] + mg[1] - 0.05, hr[2] - g[2] + mg[2] + 0.03];
    const POUCH = [-0.08, 1.12, -0.2], pk = Math.sin(Math.PI * Math.max(0, Math.min(1, (rel - 0.22) / 0.26)));
    const a1 = Math.min(1, env * 1.0);
    const mid = [TL[0] + (MG[0] - TL[0]) * a1, TL[1] + (MG[1] - TL[1]) * a1, TL[2] + (MG[2] - TL[2]) * a1];
    TL = [mid[0] + (POUCH[0] - mid[0]) * pk, mid[1] + (POUCH[1] - mid[1]) * pk, mid[2] + (POUCH[2] - mid[2]) * pk];
  }
  // palm sits slightly under the grip/foregrip line
  const miss = Math.max(solveArm(m.arms[1], [hr[0], hr[1] - 0.01, hr[2]], 1), solveArm(m.arms[0], [TL[0] + (pistol ? 0.03 : 0), TL[1] - 0.04 * (1 - env), TL[2]], -1));
  return miss;
}
