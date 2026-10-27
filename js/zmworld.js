// Zombies mode: everything you see on the Outpost map besides the walls - barricades, doors, wall guns, perk machines,
// the Mystery Box, Pack-a-Punch and power-ups. Pure visuals (the rules live in zombies.js). Built from boxes/canvas textures.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js?v=0.15.1';
import { buildGun } from './gunmodels.js?v=0.15.1';

const stdMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0.1, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map || null });
const bxm = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = false; parent.add(m); return m; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// text sprite (always faces the camera)
export function label(text, o = {}) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d'); c.textAlign = 'center'; c.textBaseline = 'middle';
  const lines = String(text).split('\n');
  c.lineJoin = 'round'; c.strokeStyle = '#000'; c.lineWidth = 8;
  lines.forEach((ln, i) => {
    c.font = `bold ${i === 0 ? 46 : 34}px sans-serif`;
    const y = lines.length === 1 ? 64 : 40 + i * 46;
    c.strokeText(ln, 256, y); c.fillStyle = i === 0 ? (o.color || '#ffffff') : (o.color2 || '#ffd27a'); c.fillText(ln, 256, y);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: o.depthTest !== false }));
  const s = o.scale || 1.8; sp.scale.set(s, s / 4, 1);
  return sp;
}
export function setLabel(sp, text, o = {}) {
  const fresh = label(text, o); sp.material.map.dispose(); sp.material.map = fresh.material.map; sp.material.needsUpdate = true;
}

function planksTex() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = '#6a4a2a'; c.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) { c.fillStyle = `rgb(${90 + (y * 7) % 40},${62 + (y * 5) % 30},${34})`; c.fillRect(0, y, 128, 14); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, y + 14, 128, 2); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
let _planks; const planks = () => _planks || (_planks = planksTex());

// ---- window barricade: 6 boards across a 2 m gap ----
export function buildWindow(w) {
  const g = new THREE.Group(); g.position.set(w.x, 0, w.z);
  const along = w.axis === 'x' ? 0 : Math.PI / 2; g.rotation.y = along;
  const boards = [], mat = stdMat(0x8a6a44, { map: planks(), rough: 0.9 });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.3, 0.1), mat);
    m.position.set(((i * 7) % 5 - 2) * 0.03, 0.4 + i * 0.4, (i % 2 ? 0.1 : -0.1));
    m.rotation.z = ((i * 13) % 7 - 3) * 0.012;
    g.add(m); boards.push(m);
  }
  return { group: g, boards };
}
export function setBoards(win, n) { win.view.boards.forEach((m, i) => { m.visible = i < n; }); }

// ---- bought door ----
export function buildDoor(d) {
  const g = new THREE.Group(); g.position.set(d.x, 0, d.z);
  const steel = stdMat(0x3a3f44, { metal: 0.6, rough: 0.5 }), wood = stdMat(0x8a6a44, { map: planks(), rough: 0.9 });
  // slab spans d.d along z (x thickness d.w)
  bxm(d.w, d.h, d.d, steel, 0, d.h / 2, 0, g);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) bxm(d.w + 0.12, 0.3, d.d * 0.9, wood, 0, 0.5 + i * 0.75, 0, g).rotation.x = s * 0.03 * (i - 1.5);
  for (const dz of [-d.d / 2 + 0.2, d.d / 2 - 0.2]) bxm(d.w + 0.2, d.h, 0.2, stdMat(0x2a2d31, { metal: 0.7 }), 0, d.h / 2, dz, g);
  const sp = label(`DOOR\n${d.cost}`, { color: '#ffd27a', scale: 1.9 }); sp.position.set(0, 2.2, 0); g.add(sp);
  return { group: g, sprite: sp };
}

// ---- wall-buy: chalk-style gun on a panel ----
export function buildBuy(b) {
  const g = new THREE.Group(); g.position.set(b.x, (b.y || 0) + 1.65, b.z); g.rotation.y = b.face;
  const w = WEAPONS[b.gun];
  bxm(1.5, 0.75, 0.05, stdMat(0x23282c, { rough: 0.9 }), 0, 0, 0.03, g);
  bxm(1.56, 0.04, 0.07, stdMat(0xb89a4a, { metal: 0.6, rough: 0.4 }), 0, 0.39, 0.03, g); bxm(1.56, 0.04, 0.07, stdMat(0xb89a4a, { metal: 0.6, rough: 0.4 }), 0, -0.39, 0.03, g);
  let gun = null;
  try { gun = buildGun(w); } catch (e) { gun = null; }
  if (gun) { gun.rotation.y = -Math.PI / 2; gun.scale.setScalar(1.35); gun.position.set(0, 0.02, 0.12); g.add(gun); }
  const sp = label(`${w.name}\n${b.cost}`, { color: '#ffffff', scale: 1.7 }); sp.position.set(0, 0.62, 0.1); g.add(sp);
  return { group: g, sprite: sp };
}

// ---- perk machines ----
export function buildMachine(m, perk, cost) {
  const g = new THREE.Group(); g.position.set(m.x, 0, m.z); g.rotation.y = m.face;
  const col = perk.color, w = Math.max(m.w, m.d), dd = Math.min(m.w, m.d);   // local frame: x = along the wall, z = out of the wall
  bxm(w, 2.1, dd, stdMat(0x1b1f23, { metal: 0.5, rough: 0.5 }), 0, 1.05, 0, g);
  bxm(w * 0.86, 1.15, 0.06, stdMat(col, { emissive: col, ei: 0.55, rough: 0.5 }), 0, 1.3, dd / 2 + 0.01, g);          // glowing front panel
  bxm(w, 0.18, dd + 0.08, stdMat(col, { emissive: col, ei: 0.9 }), 0, 2.16, 0, g);                                     // top light bar
  bxm(w * 0.5, 0.32, 0.08, stdMat(0x0a0a0a), 0, 0.55, dd / 2 + 0.02, g);                                                // bottle slot
  const sp = label(`${perk.name.toUpperCase()}\n${cost}`, { color: hex(col).replace('#', '#'), scale: 2.2 }); sp.position.set(0, 2.75, 0); g.add(sp);
  return { group: g, sprite: sp };
}

// ---- Mystery Box ----
export function buildBox(b) {
  const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = b.face;
  const wood = stdMat(0x7a5a34, { map: planks(), rough: 0.9 }), trim = stdMat(0xb89a4a, { metal: 0.7, rough: 0.35 });
  bxm(2.0, 0.75, 0.9, wood, 0, 0.375, 0, g);
  const lid = new THREE.Group(); lid.position.set(0, 0.75, -0.45); g.add(lid);
  bxm(2.0, 0.16, 0.9, wood, 0, 0.08, 0.45, lid);
  for (const x of [-0.9, 0, 0.9]) bxm(0.1, 0.2, 0.95, trim, x, 0.08, 0.45, lid);
  for (const x of [-0.95, 0.95]) bxm(0.12, 0.75, 0.95, trim, x, 0.375, 0, g);
  const q = label('?', { color: '#6be7ff', scale: 0.9 }); q.position.set(0, 1.5, 0.5); g.add(q);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x6be7ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 15; g.add(beam);
  const sp = label('MYSTERY BOX\n950', { color: '#6be7ff', scale: 2 }); sp.position.set(0, 2.1, 0.2); g.add(sp);
  return { group: g, lid, beam, sprite: sp, prize: null };
}

// ---- Pack-a-Punch ----
export function buildPap(p) {
  const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.face;
  const w = Math.max(p.w, p.d), dd = Math.min(p.w, p.d);
  bxm(w, 2.1, dd, stdMat(0x181b22, { metal: 0.6, rough: 0.45 }), 0, 1.05, 0, g);
  bxm(w * 0.9, 0.12, 0.08, stdMat(0x4aa0ff, { emissive: 0x4aa0ff, ei: 1.2 }), 0, 1.9, dd / 2 + 0.02, g);
  bxm(w * 0.9, 0.12, 0.08, stdMat(0x4aa0ff, { emissive: 0x4aa0ff, ei: 1.2 }), 0, 0.3, dd / 2 + 0.02, g);
  const dial = bxm(0.7, 0.7, 0.06, stdMat(0x7a3cff, { emissive: 0x7a3cff, ei: 0.8 }), 0, 1.1, dd / 2 + 0.03, g);
  const sp = label('PACK-A-PUNCH\n5000', { color: '#9fc8ff', scale: 2.3 }); sp.position.set(0, 2.7, 0); g.add(sp);
  return { group: g, dial, sprite: sp, prize: null };
}

// a gun floating above the box / PaP while it rolls
export function gunDisplay(id, pap) {
  const w = WEAPONS[id]; let g;
  try { g = buildGun(w); } catch (e) { g = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.6), stdMat(0x888888)); }
  const wrap = new THREE.Group(); wrap.add(g); wrap.scale.setScalar(1.7);
  if (pap) g.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x4a1c9c); o.material.emissiveIntensity = 0.8; } });
  return wrap;
}

// ---- power-ups ----
export const POWERUPS = {
  max: { name: 'MAX AMMO', color: 0x4ad0ff, letter: 'A' },
  insta: { name: 'INSTA-KILL', color: 0xff5a4a, letter: 'I' },
  dbl: { name: 'DOUBLE POINTS', color: 0xffd23a, letter: '2X' },
  nuke: { name: 'NUKE', color: 0xffa020, letter: 'N' },
  carp: { name: 'CARPENTER', color: 0xc8a060, letter: 'C' },
};
export function buildPowerup(type) {
  const d = POWERUPS[type], g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: d.color, fog: false })); g.add(core);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.22, depthWrite: false, fog: false })); g.add(halo);
  const sp = label(d.name, { color: hex(d.color), scale: 1.6, depthTest: false }); sp.position.y = 0.85; g.add(sp);
  g.userData = { core, halo };
  return g;
}
