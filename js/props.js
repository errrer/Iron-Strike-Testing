import * as THREE from 'three';

// Baked prop models (assets/props/<name>.json, made by tools/props2json.py) + image textures (assets/tex/<name>.jpg).
// Everything is optional: if a file is missing the map falls back to its plain box/procedural look.
export const PROPS = {};   // name -> { geo, size:[x,y,z] }
export const PROP_NAMES = ['container', 'barrel', 'racking', 'shutter', 'crate', 'door'];

export async function loadProps(names = PROP_NAMES) {
  await Promise.all(names.map((n) => (PROPS[n] ? null : fetch(`assets/props/${n}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j || !j.parts) return;
    const pos = [], nor = [], uv = [], ind = [];
    for (const p of j.parts) {
      const o = pos.length / 3; pos.push(...p.positions); nor.push(...p.normals); uv.push(...p.uvs);
      for (const i of p.indices) ind.push(i + o);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ind);
    const b = j.bounds; PROPS[n] = { geo: g, size: [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] };
  }).catch(() => {}))));
  return Object.keys(PROPS);
}

const texCache = new Map();
// Image texture. `unique` returns a private copy (needed when you change repeat, e.g. the ground).
export function imgTex(name, unique = false) {
  if (!unique && texCache.has(name)) return texCache.get(name);
  const t = new THREE.TextureLoader().load(`assets/tex/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (!unique) texCache.set(name, t);
  return t;
}
