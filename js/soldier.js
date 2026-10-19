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

// returns { head, arms: [L, R], legs: [L, R] } - the groups that can be shot off, plus the pivots the animation uses
export function buildSoldier(body, teamColor, seed = 0) {
  const team = mat(teamColor, 0.8), teamDk = mat(shade(teamColor, 0.6), 0.85), dark = mat(DARK, 0.9), olive = mat(OLIVE, 0.9), khaki = mat(KHAKI, 0.9);
  const skin = mat(SKIN, 0.8), black = mat(0x0c0d0e, 0.6), plate = mat(0x30363a, 0.7);

  // torso: shirt, vest with front/back plates, pouches, belt, backpack
  bx(0.46, 0.62, 0.27, olive, 0, 1.1, 0, body);
  bx(0.5, 0.4, 0.31, team, 0, 1.2, 0, body);
  bx(0.34, 0.26, 0.05, plate, 0, 1.23, -0.17, body);
  bx(0.34, 0.26, 0.05, plate, 0, 1.23, 0.17, body);
  for (const x of [-0.14, 0, 0.14]) bx(0.1, 0.12, 0.07, dark, x, 0.98, -0.17, body);
  bx(0.5, 0.07, 0.3, black, 0, 0.84, 0, body);
  bx(0.46, 0.2, 0.27, khaki, 0, 0.73, 0, body);
  bx(0.3, 0.36, 0.14, dark, 0, 1.17, 0.24, body);
  bx(0.24, 0.1, 0.1, olive, 0, 1.0, 0.28, body);
  for (const s of [-1, 1]) bx(0.15, 0.09, 0.22, teamDk, s * 0.3, 1.42, 0, body);
  bx(0.1, 0.09, 0.1, skin, 0, 1.45, 0, body);                      // neck

  // head + headgear (3 variants)
  const head = new THREE.Group(); head.position.set(0, 1.56, 0); body.add(head);
  const v = Math.abs(seed | 0) % 3;
  if (v === 2) { bx(0.22, 0.23, 0.22, black, 0, 0, 0, head); bx(0.17, 0.05, 0.02, skin, 0, 0.03, -0.112, head); }   // balaclava
  else bx(0.2, 0.22, 0.2, skin, 0, 0, 0, head);
  for (const s of [-1, 1]) bx(0.035, 0.03, 0.01, black, s * 0.05, 0.035, -0.103, head);                               // eyes
  if (v === 0) {                                                    // combat helmet + NVG mount
    bx(0.27, 0.12, 0.28, olive, 0, 0.12, 0, head); bx(0.27, 0.04, 0.3, olive, 0, 0.06, 0, head); bx(0.07, 0.06, 0.05, dark, 0, 0.11, -0.16, head);
  } else if (v === 1) {                                             // cap + tinted goggles
    bx(0.24, 0.09, 0.25, dark, 0, 0.13, 0, head); bx(0.2, 0.02, 0.1, dark, 0, 0.09, -0.16, head);
    bx(0.22, 0.06, 0.04, black, 0, 0.04, -0.115, head); bx(0.17, 0.035, 0.01, mat(0x3fa7ff, 0.2), 0, 0.04, -0.14, head);
  } else bx(0.26, 0.09, 0.27, plate, 0, 0.12, 0, head);             // helmet over the balaclava

  // arms: shoulder pivot, bent elbow, glove. Held out toward the gun.
  const arms = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.31, 1.38, 0); piv.rotation.x = 1.3; piv.rotation.y = -s * 0.25; body.add(piv);
    bx(0.12, 0.28, 0.12, olive, 0, -0.14, 0, piv);
    const el = new THREE.Group(); el.position.set(0, -0.28, 0); el.rotation.x = -0.25; piv.add(el);
    bx(0.1, 0.25, 0.1, olive, 0, -0.125, 0, el); bx(0.115, 0.09, 0.115, black, 0, -0.29, 0, el);
    arms.push(piv);
  }
  // legs: hip pivot, thigh, knee pad, shin, boot
  const legs = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.13, 0.8, 0); body.add(piv);
    bx(0.18, 0.4, 0.2, khaki, 0, -0.2, 0, piv); bx(0.2, 0.1, 0.06, dark, 0, -0.41, -0.1, piv);
    bx(0.16, 0.3, 0.18, khaki, 0, -0.55, 0, piv); bx(0.19, 0.11, 0.28, black, 0, -0.745, -0.03, piv);
    legs.push(piv);
  }
  return { head, arms, legs };
}
