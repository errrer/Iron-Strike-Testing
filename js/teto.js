// Secret: type "teto" anywhere and you turn into Kasane Teto (model ripped by onlinesaipa). Type it again to switch back.
// The model is a skinned mesh (tools/bake-teto.py computes the skin weights from a T-pose OBJ) whose skeleton is driven by the
// soldier rig, so every animation, gun-holding IK and ragdoll the soldier has works on her too. First person uses her hands.
import * as THREE from 'three';

let data = null, loading = null, geo = null, mats = null;

function b64(s, Type) {
  const bin = atob(s), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Type(u8.buffer);
}

export const tetoReady = () => !!geo;
export const TETO_SKIN = 0xf7e7d6, TETO_SLEEVE = 0x2f5a6e, TETO_CUFF = 0xe0687f;     // first-person hands: bare skin, teal arm-warmers, pink trim

export function loadTeto() {
  if (geo) return Promise.resolve(true);
  if (loading) return loading;
  if (!THREE.SkinnedMesh || !THREE.Skeleton || !THREE.Bone || !THREE.Quaternion) return Promise.resolve(false);
  loading = fetch('assets/teto/teto.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((j) => {
    data = j;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(b64(j.pos, Float32Array), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(b64(j.nor, Float32Array), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(b64(j.uv, Float32Array), 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(b64(j.si, Uint16Array), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(b64(j.sw, Float32Array), 4));
    g.setIndex(new THREE.BufferAttribute(j.idx32 ? b64(j.idx, Uint32Array) : b64(j.idx, Uint16Array), 1));
    if (g.addGroup) for (const [s, n, mi] of j.groups) if (n > 0) g.addGroup(s, n, mi);
    const tl = new THREE.TextureLoader();
    mats = j.mats.map((m) => {
      const t = tl.load(m.map); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, alphaTest: m.alpha ? 0.45 : 0 });
    });
    geo = g;
    return true;
  }).catch((e) => { console.warn('[teto] could not load the model', e); loading = null; return false; });
  return loading;
}

// one instance: a SkinnedMesh + its own skeleton. Geometry/materials/textures are shared.
export function makeTeto() {
  const B = data.bones, V = THREE.Vector3, Q = THREE.Quaternion;
  const bones = [];
  const mk = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); if (parent) parent.add(b); bones.push(b); return b; };
  const root = mk(null, 0, B.hipsY, 0);
  const head = mk(root, 0, B.headY - B.hipsY, 0);                                              // 1
  const arm = [];
  for (const side of [0, 1]) {                                                                  // 2-4 left (-x), 5-7 right
    const sg = side === 0 ? 1 : -1, d = [B.dir[0] * sg, B.dir[1]];
    const b0 = mk(root, B.shoulder[0] * sg, B.shoulder[1] - B.hipsY, B.shoulder[2]);
    const b1 = mk(b0, d[0] * B.L1, d[1] * B.L1, 0), b2 = mk(b1, d[0] * B.L1, d[1] * B.L1, 0);
    const q0 = new Q().setFromUnitVectors(new V(d[0], d[1], 0).normalize(), new V(0, -1, 0));  // bind arm points along d, the soldier's arm hangs along -y
    arm.push({ b0, b1, q0, q0i: q0.clone().invert() });
  }
  const leg = [];
  for (const side of [0, 1]) {                                                                  // 8-10 left, 11-13 right
    const hip = mk(root, (side === 0 ? -1 : 1) * B.hipX, 0, 0), knee = mk(hip, 0, B.kneeY - B.hipY, 0), ank = mk(knee, 0, B.ankY - B.kneeY, 0);
    leg.push({ hip, knee, ank });
  }
  const mesh = new THREE.SkinnedMesh(geo, mats);
  mesh.add(root); mesh.frustumCulled = false; mesh.castShadow = true;
  mesh.bind(new THREE.Skeleton(bones));
  const tq = new Q();
  return {
    root: mesh, on: false,
    // pose the skeleton from the soldier rig (called every frame after the animation ran)
    sync(m) {
      for (let i = 0; i < 2; i++) {
        const sh = m.arms[i], A = arm[i];
        A.b0.quaternion.multiplyQuaternions(sh.quaternion, A.q0);
        tq.multiplyQuaternions(A.q0i, sh.userData.el.quaternion); A.b1.quaternion.multiplyQuaternions(tq, A.q0);
        const hip = m.legs[i], kn = hip.userData.knee, ft = kn && kn.userData.foot, L = leg[i];
        L.hip.quaternion.copy(hip.quaternion);
        if (kn) L.knee.quaternion.copy(kn.quaternion);
        if (ft) L.ank.quaternion.copy(ft.quaternion);
      }
      if (m.headG) head.quaternion.copy(m.headG.quaternion);
    },
    // shoulders/arm lengths of the soldier rig become hers while she is on, so the gun-holding IK fits her arms
    setRig(m, on) {
      for (let i = 0; i < 2; i++) {
        const sh = m.arms[i], ud = sh.userData;
        if (on) {
          if (!ud.p0) ud.p0 = sh.position.clone();
          sh.position.set(B.shoulder[0] * (i === 0 ? 1 : -1), B.shoulder[1], B.shoulder[2]);
          ud.L1 = B.L1; ud.L2 = B.L2 * 1.0;
        } else {
          if (ud.p0) sh.position.copy(ud.p0);
          ud.p0 = null; ud.L1 = 0; ud.L2 = 0;
        }
      }
    },
  };
}
