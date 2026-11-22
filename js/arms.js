// First-person arms: the rigged arms + gloved hands model (assets/models/arms.json, baked by tools/bake-arms.py from arms.fbx).
// js/armrig.js poses the forearm / hand / finger bones for the gun, this file wraps the result in a three.js SkinnedMesh.
import * as THREE from 'three';
import { ArmRig, placeHands, SHOULDER } from './armrig.js?v=0.25.3';

let data = null, geo = null, mat = null, loading = null;
const b64 = (s, Type) => { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Type(u8.buffer); };
export const armsReady = () => !!geo;

export function loadArms() {
  if (geo) return Promise.resolve(true);
  if (loading) return loading;
  if (!THREE.SkinnedMesh || !THREE.Skeleton || !THREE.Bone || !THREE.Matrix4) return Promise.resolve(false);
  loading = fetch('assets/models/arms.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((j) => {
    data = j;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(b64(j.pos, Float32Array), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(b64(j.nor, Float32Array), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(b64(j.uv, Float32Array), 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(b64(j.si, Uint16Array), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(b64(j.sw, Float32Array), 4));
    g.setIndex(new THREE.BufferAttribute(b64(j.idx, Uint16Array), 1));
    const t = new THREE.TextureLoader().load('assets/models/v_hands.jpg'); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    geo = g;
    return true;
  }).catch((e) => { console.warn('[arms] could not load the model', e); loading = null; return false; });
  return loading;
}

// one instance (own skeleton); `update` re-poses both arms for the gun's anchors `u`, the support-hand offset `lh` and the trigger pull
export function makeArms() {
  const rig = new ArmRig(data), bones = [];
  for (let i = 0; i < rig.n; i++) { const b = new THREE.Bone(); b.matrixAutoUpdate = false; b.matrix.fromArray(rig.bind[i]); bones.push(b); }
  const mesh = new THREE.SkinnedMesh(geo, mat);
  for (const b of bones) mesh.add(b);
  mesh.frustumCulled = false;
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));                                   // bind pose = rig.bind, with the mesh still at the origin
  return {
    root: mesh,
    update(u, lh, trig, fa) {
      const h = placeHands(u, lh, trig, { fa });
      rig.pose('Right', { P: h.right.P, Rt: h.right.Rt, S: SHOULDER.Right, curl: h.right.curl });
      rig.pose('Left', { P: h.left.P, Rt: h.left.Rt, S: SHOULDER.Left, curl: h.left.curl });
      for (let i = 0; i < rig.n; i++) { bones[i].matrix.fromArray(rig.out[i]); bones[i].matrixWorldNeedsUpdate = true; }
    },
  };
}
