// 3D Map Maker: a small Blender-style editor. Orbit/pan/zoom camera, click to select, move/rotate/scale gizmo, game props, primitives and
// importable models (.glb/.gltf/.obj/.fbx). Exports JSON (and .glb). Maps made here are NOT loaded by the game; the developer has to add them.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { PROPS, PROP_NAMES, loadProps } from './props.js?v=0.14.1';


const PRIMS = { box: 'Box', cylinder: 'Cylinder', sphere: 'Sphere', plane: 'Floor plane', ramp: 'Ramp', cone: 'Cone', torus: 'Ring (torus)' };
// Gameplay markers: invisible in a real map, they tell the dev where things go. `val` = optional cost / note shown in the properties panel.
const MARKS = {
  spawnA: { name: 'Team A spawn', color: '#4cc2ff', size: [1, 0.2, 1] }, spawnB: { name: 'Team B spawn', color: '#ff5a4c', size: [1, 0.2, 1] },
  pstart: { name: 'Player start (zombies)', color: '#7dff7d', size: [1, 0.2, 1] }, zspawn: { name: 'Zombie spawn', color: '#b02020', size: [1, 0.2, 1] },
  zwindow: { name: 'Barricade window', color: '#ff9a2e', size: [2.4, 1.6, 0.25] }, zbuy: { name: 'Wall buy', color: '#38c172', size: [1.4, 1, 0.2], val: 'Cost' },
  zdoor: { name: 'Buyable door', color: '#c9a227', size: [2.4, 2.6, 0.3], val: 'Cost' }, zbox: { name: 'Mystery box', color: '#6a5acd', size: [1.4, 0.8, 0.7] },
  zperk: { name: 'Perk machine', color: '#ec4899', size: [1, 2, 0.8], val: 'Perk' },
};
const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u.buffer; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function primGeo(kind) {
  if (MARKS[kind]) return new THREE.BoxGeometry(1, 1, 1);
  if (kind === 'cylinder') return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
  if (kind === 'cone') return new THREE.ConeGeometry(0.5, 1, 24);
  if (kind === 'torus') return new THREE.TorusGeometry(0.4, 0.1, 12, 32);
  if (kind === 'sphere') return new THREE.SphereGeometry(0.5, 24, 16);
  if (kind === 'plane') { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }
  if (kind === 'ramp') {
    const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g;
  }
  return new THREE.BoxGeometry(1, 1, 1);
}

export function createEditor(root, onExit, opts = {}) {
  const MODEL = opts.kind === 'model';
  const KEY = MODEL ? 'ironstrike.model3d' : 'ironstrike.mm3d';
  const NOTE = MODEL ? 'Not usable in game unless the developer adds it.' : 'Not playable in game unless the developer adds it.';
  const FILE = MODEL ? 'my-iron-strike-model' : 'my-iron-strike-map';
  root.innerHTML = '';
  // ---------- layout ----------
  const top = el('div', 'mmtop'), left = el('div', 'mmside'), view = el('div', 'mmview'), right = el('div', 'mmside r'), foot = el('div', 'mmfoot', NOTE + '  |  Orbit: left drag - Pan: right drag - Zoom: wheel - Click to select - Shift+click = multi-select. Every button shows its shortcut. Shift+1-7 add shapes.');
  root.append(top, left, view, right, foot);
  const canvas = el('canvas'); view.appendChild(canvas);
  const keymap = {};
  const pretty = (sp) => sp.split('+').map((p) => ({ ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', escape: 'Esc', delete: 'Del' }[p] || (/^digit/.test(p) ? p.slice(5) : p.toUpperCase()))).join('+');
  const btn = (parent, text, fn, cls = '', spec = '') => {
    const b = el('button', 'btn ' + cls, text); b.type = 'button'; b.addEventListener('click', fn);
    if (spec) { keymap[spec] = fn; const k = el('span', 'kbd', pretty(spec)); b.appendChild(k); }
    parent.appendChild(b); return b;
  };

  // ---------- scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2230);
  const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 1000); if (MODEL) cam.position.set(1.8, 1.4, 2.2); else cam.position.set(14, 12, 16);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x36322c, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(12, 24, 8); scene.add(sun);
  // soft studio reflections so metal is not black and nothing blows out to white (loaded lazily; the plain lights above still work without it)
  import('three/addons/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7; pm.dispose();
  }).catch(() => {});
  const grid = MODEL ? new THREE.GridHelper(4, 40, 0x4a5a70, 0x2a3646) : new THREE.GridHelper(80, 80, 0x4a5a70, 0x2a3646); scene.add(grid);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false })); scene.add(ground);
  const world = new THREE.Group(); scene.add(world);
  const orbit = new OrbitControls(cam, canvas); orbit.target.set(0, 0, 0); orbit.enableDamping = false; if (MODEL) { orbit.minDistance = 0.1; } orbit.maxPolarAngle = Math.PI * 0.499;
  const tc = new TransformControls(cam, canvas); scene.add(tc);
  const sel = new THREE.BoxHelper(new THREE.Object3D(), 0xffaa33); sel.visible = false; scene.add(sel);
  tc.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value; });

  // ---------- state ----------
  let multi = [], msel = [], hist = ['[]'], hpos = 0, restoring = false, pieces = [], models = {}, current = null, counter = 0, running = false, raf = 0, saveT = 0;
  const st = { snap: true, mode: 'translate', wire: false };
  const listBox = el('div', 'list'), props = el('div');

  function material(color, vc, rough = 0.75, metal = 0.05) { const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, vertexColors: !!vc, side: THREE.DoubleSide }); m.wireframe = st.wire; return m; }
  function register(obj, meta) {
    if (obj.rotation.order !== 'YXZ') obj.rotation.reorder('YXZ');     // yaw first: turning an object around Y no longer shows up as 180 / 180 on X and Z
    obj.userData.pid = ++counter; obj.userData.meta = meta; world.add(obj); pieces.push(obj); changed(); return obj;
  }
  function groundY(obj) { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); obj.position.y += -b.min.y; }
  function spawnPoint() { const t = orbit.target; return MODEL ? [0, 0, 0] : [Math.round(t.x), 0, Math.round(t.z)]; }
  function addPrim(kind, saved) {
    const mk = MARKS[kind], col = saved?.color || mk?.color || '#8a96a3';
    const m = new THREE.Mesh(primGeo(kind), material(col, false, saved?.rough ?? 0.75, saved?.metal ?? 0.05));
    if (mk) { m.material.transparent = true; m.material.opacity = 0.7; }
    if (saved) apply(m, saved); else { if (mk) m.scale.set(...mk.size); else { const u = MODEL ? 0.15 : 2; m.scale.set(kind === 'plane' ? u * 3 : u, kind === 'plane' ? 1 : u, kind === 'plane' ? u * 3 : u); } const p = spawnPoint(); m.position.set(p[0], 0, p[2]); groundY(m); }
    return register(m, { kind, name: saved?.name || mk?.name || PRIMS[kind], color: col, val: saved?.val || '', rough: saved?.rough ?? 0.75, metal: saved?.metal ?? 0.05 });
  }
  async function addProp(name, saved) {
    await loadProps().catch(() => {});
    const p = PROPS[name]; if (!p) return null;
    const m = new THREE.Mesh(p.geo, material(0xffffff, true));
    if (saved) apply(m, saved); else { const q = spawnPoint(); m.position.set(q[0], 0, q[2]); groundY(m); }
    return register(m, { kind: 'prop', prop: name, name: saved?.name || name });
  }
  function apply(o, s) { o.position.fromArray(s.pos); o.rotation.set(...s.rot.map((d) => (d * Math.PI) / 180), s.rotOrder || 'XYZ'); o.scale.fromArray(s.scl); }
  async function parseModel(buf, ext, name) {
    let obj;
    if (ext === 'glb' || ext === 'gltf') {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      obj = await new Promise((res, rej) => new GLTFLoader().parse(ext === 'gltf' ? new TextDecoder().decode(buf) : buf, '', (g) => res(g.scene), rej));
    } else if (ext === 'obj') {
      const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
      obj = new OBJLoader().parse(new TextDecoder().decode(buf));
      obj.traverse((c) => { if (c.isMesh && (!c.material || !c.material.map)) c.material = material(0xb0b6bd); });
    } else if (ext === 'fbx') {
      const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
      obj = new FBXLoader().parse(buf, '');
    } else throw new Error('Unsupported file type .' + ext + ' (use .glb, .gltf, .obj or .fbx)');
    obj.traverse((c) => {                                  // imported meshes often have flipped normals or missing ones: light both sides, fix the shading
      if (!c.isMesh) return;
      if (c.geometry && !c.geometry.attributes.normal) c.geometry.computeVertexNormals();
      for (const m of [].concat(c.material)) { if (!m) continue; m.side = THREE.DoubleSide; if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.35); if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.85); m.wireframe = st.wire; if (m.emissiveIntensity > 1) m.emissiveIntensity = 1; }
    });
    const g = new THREE.Group(); g.add(obj); return g;
  }
  async function addModel(buf, ext, name, saved, mid) {
    const g = await parseModel(buf, ext, name);
    const id = mid || 'm' + (Object.keys(models).length + 1) + '_' + name.replace(/\W+/g, '').slice(0, 14);
    models[id] = { name, ext, data: buf };
    if (saved) apply(g, saved);
    else {
      const b = new THREE.Box3().setFromObject(g), sz = b.getSize(new THREE.Vector3()), mx = Math.max(sz.x, sz.y, sz.z) || 1;
      if (MODEL ? (mx > 5 || mx < 0.02) : (mx > 30 || mx < 0.2)) g.scale.setScalar((MODEL ? 0.4 : 2) / mx);
      const p = spawnPoint(); g.position.set(p[0], 0, p[2]); groundY(g);
    }
    return register(g, { kind: 'model', model: id, name: saved?.name || name.replace(/\.[^.]+$/, '') });
  }
  function select(o) {
    current = o || null; multi = [];
    if (current) { tc.attach(current); sel.setFromObject(current); sel.visible = true; } else { tc.detach(); sel.visible = false; }
    renderProps(); renderList();
  }
  // ----- baked meshes (results of Join / Boolean): geometry is stored in the map file as plain arrays -----
  const rd = (a, n = 4) => Array.from(a, (x) => +x.toFixed(n));
  function meshGeo(md) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(md.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(md.nor, 3));
    if (md.idx) g.setIndex(md.idx);
    for (const [a, b, c] of md.groups) g.addGroup(a, b, c);
    return g;
  }
  function addMeshPiece(s) {
    const md = s.mesh, mats = md.mats.map((q) => { const m = material(q.color, false, q.rough, q.metal); m.userData.mat = q; return m; });
    const o = new THREE.Mesh(meshGeo(md), mats);
    if (s.pos) apply(o, s);
    return register(o, { kind: 'mesh', name: s.name || 'Mesh', mesh: md, color: md.mats[0]?.color });
  }
  const matData = (m) => ({ color: m.color || '#8a96a3', rough: m.rough ?? 0.75, metal: m.metal ?? 0.05 });
  // world-space copy of an object's geometry (position + normal only) with its material list
  function bakeWorld(o) {
    o.updateMatrixWorld(true);
    let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const m = o.userData.meta, mats = m.kind === 'mesh' ? m.mesh.mats.map((q) => ({ ...q })) : [matData(m)];
    if (m.kind !== 'mesh') g.clearGroups();                                    // box / cylinder come with one group per face: use a single material
    if (!g.groups.length) g.addGroup(0, g.index ? g.index.count : g.attributes.position.count, 0);
    return { g, mats };
  }
  function toMeshData(g, mats) {
    const pos = g.attributes.position, nor = g.attributes.normal;
    return { pos: rd(pos.array), nor: rd(nor.array), idx: g.index ? Array.from(g.index.array) : null, groups: g.groups.map((q) => [q.start, q.count, q.materialIndex]), mats };
  }
  const meshable = (o) => o && ['mesh', 'box', 'cylinder', 'sphere', 'plane', 'ramp', 'cone', 'torus'].includes(o.userData.meta.kind);
  const targets = () => (current ? [current, ...multi] : []);
  async function batch(fn) { const was = restoring; restoring = true; try { return await fn(); } finally { restoring = was; changed(); } }
  async function build(s) {
    let o = null;
    if (s.kind === 'prop') o = await addProp(s.prop, s);
    else if (s.kind === 'model') { const md = models[s.model]; if (md) o = await addModel(md.data, md.ext, md.name, s, s.model); }
    else if (s.kind === 'mesh') o = addMeshPiece(s);
    else if (PRIMS[s.kind] || MARKS[s.kind]) o = addPrim(s.kind, s);
    if (o && s.hidden) { o.userData.meta.hidden = true; o.visible = false; }
    return o;
  }
  function join() {
    const t = targets().filter(meshable); if (t.length < 2) { alert('Join: shift-click two or more shapes first (blocks, cylinders, joined meshes).'); return; }
    const pos = [], nor = [], groups = [], mats = [];
    for (const o of t) {
      const { g, mats: mm } = bakeWorld(o), base = mats.length, ng = g.index ? g.toNonIndexed() : g;
      const off = pos.length / 3; pos.push(...ng.attributes.position.array); nor.push(...ng.attributes.normal.array);
      const gs = ng.groups.length && !g.index ? ng.groups : [{ start: 0, count: ng.attributes.position.count, materialIndex: 0 }];
      if (g.index) { /* toNonIndexed drops groups: rebuild them from the indexed ones */ let cur = 0; for (const q of g.groups) { groups.push([off + q.start, q.count, base + q.materialIndex]); cur += q.count; } }
      else for (const q of gs) groups.push([off + q.start, q.count, base + q.materialIndex]);
      mats.push(...mm);
    }
    const md = { pos: rd(pos), nor: rd(nor), idx: null, groups, mats };
    batch(() => { for (const o of t) remove(o); const n = addMeshPiece({ mesh: md, name: 'Joined' }); select(n); });
  }
  async function boolean(op) {
    const a = current, b = multi[multi.length - 1];
    if (!meshable(a) || !meshable(b)) { alert('Boolean: select the first shape, then shift-click the shape to cut with it. The first shape is kept; the shift-clicked one is the tool.'); return; }
    let csg; try { csg = await import('three-bvh-csg'); } catch (e) { alert('Boolean tools could not load (they need an internet connection): ' + (e.message || e)); return; }
    try {
      const A = bakeWorld(a), B = bakeWorld(b), ev = new csg.Evaluator(); ev.attributes = ['position', 'normal']; ev.useGroups = true;
      const mk = (x) => { const arr = x.mats.map((q) => { const m = material(q.color, false, q.rough, q.metal); m.userData.mat = q; return m; }); return new csg.Brush(x.g, arr); };
      const ba = mk(A), bb = mk(B); ba.updateMatrixWorld(true); bb.updateMatrixWorld(true);
      const res = ev.evaluate(ba, bb, op === 'sub' ? csg.SUBTRACTION : op === 'int' ? csg.INTERSECTION : csg.ADDITION);
      const rm = Array.isArray(res.material) ? res.material : [res.material];
      if (!res.geometry.attributes.position.count) { alert('The boolean left nothing (the shapes may not overlap).'); return; }
      const md = toMeshData(res.geometry, rm.map((m) => m.userData.mat || matData({ color: '#' + m.color.getHexString() })));
      const name = a.userData.meta.name;
      batch(() => { remove(a); remove(b); const n = addMeshPiece({ mesh: md, name: name + (op === 'sub' ? ' cut' : op === 'int' ? ' intersect' : ' union') }); select(n); });
    } catch (e) { alert('Boolean failed: ' + (e.message || e)); console.error(e); }
  }
  async function mirror(axis) {
    const o = current; if (!o) return; const R = new THREE.Matrix4().makeScale(axis === 0 ? -1 : 1, axis === 1 ? -1 : 1, axis === 2 ? -1 : 1);
    const s = describe(o), m = new THREE.Matrix4().makeRotationFromEuler(o.rotation); m.premultiply(R).multiply(R);
    const e = new THREE.Euler().setFromRotationMatrix(m, 'YXZ'); s.rotOrder = 'YXZ'; s.rot = [e.x, e.y, e.z].map((x) => +((x * 180) / Math.PI).toFixed(3));
    s.pos[axis] = -s.pos[axis]; s.scl[axis] = -s.scl[axis]; s.name = s.name + ' mirror'; delete s.id;
    const n = await build(s); if (n) select(n);
  }
  async function array() {
    const o = current; if (!o) return; const v = (prompt('Array: count, offset X, Y, Z (metres). Example: 5, 2, 0, 0', '4, 1, 0, 0') || '').split(',').map((x) => parseFloat(x));
    if (!(v[0] >= 2)) return; const n = Math.min(Math.round(v[0]), 60);
    await batch(async () => { for (let i = 1; i < n; i++) { const s = describe(o); delete s.id; for (let k = 0; k < 3; k++) s.pos[k] += (v[k + 1] || 0) * i; s.name = s.name + ' ' + i; await build(s); } });
  }
  function toggleHide(o) { o.userData.meta.hidden = !o.userData.meta.hidden; o.visible = !o.userData.meta.hidden; if (o === current && !o.visible) select(null); changed(); }
  function setWire(v) { st.wire = v; world.traverse((c) => { if (c.isMesh) for (const m of [].concat(c.material)) m.wireframe = v; }); }
  function remove(o) { if (!o) return; multi = multi.filter((x) => x !== o); if (current === o) select(null); world.remove(o); pieces = pieces.filter((p) => p !== o); o.traverse((c) => { if (c.isMesh && c.userData.pid) { c.material?.dispose?.(); } }); changed(); }
  async function duplicate(o) {
    if (!o) return; const s = describe(o); delete s.id; s.name = o.userData.meta.name + ' copy';
    const n = await build(s); if (n) select(n);
  }
  function describe(o) {
    const m = o.userData.meta, r = (x) => +x.toFixed(3);
    return { id: o.userData.pid, kind: m.kind, name: m.name, prop: m.prop, model: m.model, color: m.color, val: m.val || undefined, hidden: m.hidden || undefined, rough: m.rough, metal: m.metal, mesh: m.kind === 'mesh' ? m.mesh : undefined,
      rotOrder: o.rotation.order, pos: o.position.toArray().map(r), rot: [o.rotation.x, o.rotation.y, o.rotation.z].map((x) => r((x * 180) / Math.PI)), scl: o.scale.toArray().map(r) };
  }
  function exportData(withModels = true) {
    const used = new Set(pieces.filter((p) => p.userData.meta.kind === 'model').map((p) => p.userData.meta.model)), mo = {};
    if (withModels) for (const id of used) mo[id] = { name: models[id].name, ext: models[id].ext, data: b64(models[id].data) };
    return { format: MODEL ? 'iron-strike-model' : 'iron-strike-map', version: 2, note: NOTE, units: 'metres', pieces: pieces.map(describe), models: mo };
  }
  async function loadData(d) {
    restoring = true;
    for (const p of [...pieces]) { world.remove(p); } pieces = []; models = {}; select(null);
    for (const [id, md] of Object.entries(d.models || {})) models[id] = { name: md.name, ext: md.ext, data: unb64(md.data) };
    for (const s of d.pieces || []) { try { await build(s); } catch (e) { console.warn('skipped piece', s.name, e); } }
    restoring = false; changed();
  }
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function snap() { if (restoring) return; const j = JSON.stringify(pieces.map((p) => { const d = describe(p); delete d.id; return d; })); if (hist[hpos] === j) return; hist = hist.slice(0, hpos + 1); hist.push(j); if (hist.length > 100) hist.shift(); hpos = hist.length - 1; }
  async function goto(i) {
    if (i < 0 || i >= hist.length) return; hpos = i; restoring = true; const list = JSON.parse(hist[i]);
    try {
      for (const p of [...pieces]) world.remove(p); pieces = []; select(null);
      for (const s of list) { try { await build(s); } catch (e) { console.warn('undo: skipped', s.name, e); } }
    } finally { restoring = false; }
    changed();
  }
  const undo = () => goto(hpos - 1), redo = () => goto(hpos + 1);
  function changed() {
    snap(); renderList(); if (current) sel.setFromObject(current);
    clearTimeout(saveT); saveT = setTimeout(() => { try { const j = JSON.stringify(exportData(true)); if (j.length < 4e6) localStorage.setItem(KEY, j); } catch { /* storage full or unavailable */ } }, 600);
  }

  // ---------- UI ----------
  const modeBtns = {};
  for (const [m, t] of [['translate', 'Move (G)'], ['rotate', 'Rotate (R)'], ['scale', 'Scale (S)']]) modeBtns[m] = btn(top, t.replace(/ \(.\)/, ''), () => setMode(m), m === st.mode ? 'sel' : '', t.match(/\((.)\)/)[1].toLowerCase());
  function setMode(m) { st.mode = m; tc.setMode(m); for (const k in modeBtns) modeBtns[k].classList.toggle('sel', k === m); }
  const snapL = el('label'); snapL.style.cssText = 'display:flex;gap:4px;align-items:center'; const snapC = el('input'); snapC.type = 'checkbox'; snapC.checked = true; snapL.append(snapC, 'Snap');
  const applySnap = () => { tc.setTranslationSnap(snapC.checked ? (MODEL ? 0.01 : 0.5) : null); tc.setRotationSnap(snapC.checked ? Math.PI / 12 : null); tc.setScaleSnap(snapC.checked ? (MODEL ? 0.01 : 0.1) : null); };
  snapC.addEventListener('change', applySnap); applySnap(); keymap.n = () => { snapC.checked = !snapC.checked; applySnap(); }; snapL.append(el('span', 'kbd', 'N')); top.appendChild(snapL);
  btn(top, 'Undo', undo, '', 'ctrl+z'); keymap['ctrl+shift+z'] = redo; btn(top, 'Redo', redo, '', 'ctrl+y');
  btn(top, 'Duplicate', () => duplicate(current), '', 'shift+d'); keymap['ctrl+d'] = () => duplicate(current);
  btn(top, 'Delete', () => { for (const o of targets()) remove(o); }, '', 'x'); keymap.delete = keymap.x; keymap.backspace = keymap.x;
  const spaceB = btn(top, 'Global', () => { const l = tc.space === 'world'; tc.setSpace(l ? 'local' : 'world'); spaceB.firstChild.textContent = l ? 'Local' : 'Global'; }, '', 'l');
  const wireB = btn(top, 'Wireframe', () => { setWire(!st.wire); wireB.classList.toggle('sel', st.wire); }, '', 'z');
  btn(top, 'Focus', () => focus(), '', 'f');
  const mapIn = el('input'); mapIn.type = 'file'; mapIn.accept = '.json'; mapIn.style.display = 'none';
  mapIn.addEventListener('change', async () => { const f = mapIn.files[0]; mapIn.value = ''; if (!f) return; try { await loadData(JSON.parse(await f.text())); } catch (e) { alert('Could not load that file.'); } });
  btn(top, MODEL ? 'Load model' : 'Load map', () => mapIn.click(), '', 'ctrl+o');
  btn(top, MODEL ? 'Save model file' : 'Save map file', () => download(FILE + '.json', new Blob([JSON.stringify(exportData(true))], { type: 'application/json' })), 'alt', 'ctrl+s');
  btn(top, 'Export .glb', async () => {
    try { const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js'); new GLTFExporter().parse(world, (r) => download(FILE + '.glb', new Blob([r], { type: 'model/gltf-binary' })), (e) => alert('Export failed'), { binary: true }); } catch (e) { alert('Export failed: ' + e.message); }
  }, '', 'ctrl+e');
  btn(top, 'Clear', () => { if (pieces.length && !confirm('Remove everything from the map?')) return; for (const p of [...pieces]) world.remove(p); pieces = []; models = {}; select(null); changed(); });
  btn(top, 'Exit', () => { hide(); onExit(); });

  left.appendChild(el('h4', '', 'Object tools'));
  btn(left, 'Join', join, '', 'ctrl+j');
  btn(left, 'Boolean: cut (A - B)', () => boolean('sub'), '', 'c'); btn(left, 'Boolean: union (A + B)', () => boolean('add'), '', 'u'); btn(left, 'Boolean: intersect', () => boolean('int'), '', 'i');
  left.appendChild(el('p', 'hint', 'Boolean: click A, then shift-click B. B is the tool.'));
  btn(left, 'Mirror X', () => mirror(0), '', 'alt+x'); btn(left, 'Mirror Y', () => mirror(1), '', 'alt+y'); btn(left, 'Mirror Z', () => mirror(2), '', 'alt+z');
  btn(left, 'Array...', array, '', 'a'); btn(left, 'Drop to ground', () => { if (current) { groundY(current); sel.setFromObject(current); renderProps(); changed(); } }, '', 'd');
  btn(left, 'Hide / show', () => { if (current) toggleHide(current); }, '', 'h');
  left.appendChild(el('h4', '', 'View'));
  const setView = (dir) => { const d = Math.max(cam.position.distanceTo(orbit.target), 1); cam.position.copy(orbit.target).add(new THREE.Vector3(...dir).normalize().multiplyScalar(d)); };
  btn(left, 'Front', () => setView([0, 0.0001, 1]), '', '1'); btn(left, 'Right', () => setView([1, 0.0001, 0]), '', '3'); btn(left, 'Top', () => setView([0.0001, 1, 0.0001]), '', '7'); btn(left, 'Perspective', () => setView([0.7, 0.55, 0.8]), '', '5');
  left.appendChild(el('h4', '', 'Shapes'));
  Object.keys(PRIMS).forEach((k, i) => btn(left, '+ ' + PRIMS[k], () => { const o = addPrim(k); select(o); }, '', 'shift+digit' + (i + 1)));
  if (!MODEL) {
    left.appendChild(el('h4', '', 'Gameplay markers'));
    for (const k in MARKS) btn(left, '+ ' + MARKS[k].name, () => { const o = addPrim(k); select(o); });
    left.appendChild(el('h4', '', 'Game props'));
    for (const n of PROP_NAMES) btn(left, '+ ' + n, async () => { const o = await addProp(n); if (o) select(o); });
  }
  left.appendChild(el('h4', '', MODEL ? 'Import parts' : 'Your models'));
  const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = '.glb,.gltf,.obj,.fbx'; fileIn.multiple = true; fileIn.style.display = 'none';
  fileIn.addEventListener('change', async () => {
    const fs = [...fileIn.files]; fileIn.value = '';
    for (const f of fs) {
      const ext = f.name.split('.').pop().toLowerCase();
      try { const o = await addModel(await f.arrayBuffer(), ext, f.name); select(o); } catch (e) { alert('Could not import ' + f.name + ': ' + (e.message || e)); }
    }
  });
  btn(left, 'Import model...', () => fileIn.click(), 'alt', 'ctrl+i');
  left.appendChild(el('p', 'hint', '.glb, .gltf (single file), .obj or .fbx. Export from Blender with File > Export > glTF 2.0 (.glb).'));
  left.appendChild(fileIn);

  right.append(el('h4', '', 'Selected'), props, el('h4', '', 'Objects'), listBox);
  function numRow(label, arr, get, set) {
    const r = el('div', 'row'); r.appendChild(el('label', '', label));
    const v = get();
    for (let i = 0; i < 3; i++) { const inp = el('input'); inp.type = 'number'; inp.step = MODEL ? '0.01' : '0.1'; inp.value = v[i]; inp.addEventListener('change', () => { const n = get(); n[i] = parseFloat(inp.value) || 0; set(n); sel.setFromObject(current); changed(); }); r.appendChild(inp); }
    props.appendChild(r);
  }
  function renderProps() {
    props.innerHTML = ''; if (!current) { props.appendChild(el('p', 'hint', 'Nothing selected. Click an object.')); return; }
    const m = current.userData.meta, o = current, d = () => describe(o);
    const nr = el('div', 'row'); const ni = el('input'); ni.type = 'text'; ni.value = m.name; ni.addEventListener('change', () => { m.name = ni.value || m.name; changed(); }); nr.appendChild(ni); props.appendChild(nr);
    numRow('Pos', 0, () => d().pos, (n) => o.position.fromArray(n));
    numRow('Rot', 0, () => d().rot, (n) => o.rotation.set(...n.map((x) => (x * Math.PI) / 180)));
    numRow('Size', 0, () => d().scl, (n) => o.scale.fromArray(n.map((x) => x || 0.01)));
    if (MARKS[m.kind]?.val) { const r = el('div', 'row'); r.appendChild(el('label', '', MARKS[m.kind].val)); const v = el('input'); v.type = 'text'; v.value = m.val || ''; v.addEventListener('change', () => { m.val = v.value; changed(); }); r.appendChild(v); props.appendChild(r); }
    const numField = (label, get, set) => { const r = el('div', 'row'); r.appendChild(el('label', '', label)); const v = el('input'); v.type = 'number'; v.min = 0; v.max = 1; v.step = 0.05; v.value = get(); v.addEventListener('change', () => { set(Math.max(0, Math.min(1, parseFloat(v.value) || 0))); changed(); }); r.appendChild(v); props.appendChild(r); };
    const colField = (label, get, set) => { const r = el('div', 'row'); r.appendChild(el('label', '', label)); const c = el('input'); c.type = 'color'; c.value = get(); c.addEventListener('input', () => set(c.value)); c.addEventListener('change', () => changed()); r.appendChild(c); props.appendChild(r); };
    if (m.kind === 'mesh') {
      m.mesh.mats.forEach((q, i) => { colField('Mat ' + (i + 1), () => q.color, (v) => { q.color = v; o.material[i].color.set(v); }); });
      numField('Rough', () => m.mesh.mats[0].rough, (v) => m.mesh.mats.forEach((q, i) => { q.rough = v; o.material[i].roughness = v; }));
      numField('Metal', () => m.mesh.mats[0].metal, (v) => m.mesh.mats.forEach((q, i) => { q.metal = v; o.material[i].metalness = v; }));
    } else if (!['prop', 'model'].includes(m.kind)) {
      colField('Colour', () => m.color || '#8a96a3', (v) => { m.color = v; o.material.color.set(v); });
      numField('Rough', () => m.rough ?? 0.75, (v) => { m.rough = v; o.material.roughness = v; });
      numField('Metal', () => m.metal ?? 0.05, (v) => { m.metal = v; o.material.metalness = v; });
    }
    if (multi.length) props.appendChild(el('p', 'hint', multi.length + ' more selected (shift-click).'));
  }
  function renderList() {
    listBox.innerHTML = '';
    for (const p of pieces) {
      const row = el('div', 'row'), b = el('button', 'btn' + (p === current || multi.includes(p) ? ' sel' : ''), (p.userData.meta.hidden ? '(hidden) ' : '') + p.userData.meta.name); b.type = 'button';
      b.addEventListener('click', (e) => { if (e.shiftKey && current && p !== current) pick(p, true); else select(p); });
      row.appendChild(b); listBox.appendChild(row);
    }
  }
  function pick(o, add) { if (!add || !current || o === current) { select(o); return; } multi = multi.includes(o) ? multi.filter((x) => x !== o) : [...multi, o]; renderList(); renderProps(); }
  tc.addEventListener('objectChange', () => { if (current) { sel.setFromObject(current); renderProps(); } });
  tc.addEventListener('mouseUp', () => changed());

  // ---------- picking, camera ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, tc.dragging]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || down[2] || tc.dragging || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || e.button !== 0) return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(world.children, true)[0]; let o = hit?.object; while (o && o.parent !== world) o = o.parent;
    const pk = o && pieces.includes(o) ? o : null; if (e.shiftKey && pk) pick(pk, true); else select(pk);
  });
  function focus() {
    const b = new THREE.Box3(); if (current) b.setFromObject(current); else if (pieces.length) b.setFromObject(world); else { orbit.target.set(0, 0, 0); return; }
    const c = b.getCenter(new THREE.Vector3()), s = Math.max(b.getSize(new THREE.Vector3()).length(), 2); orbit.target.copy(c);
    cam.position.copy(c).add(new THREE.Vector3(0.7, 0.55, 0.8).normalize().multiplyScalar(s * 1.5 + 3));
  }
  keymap.escape = () => select(null);
  window.addEventListener('keydown', (e) => {
    if (!running || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    let k = /^Digit\d$/.test(e.code) ? e.code.toLowerCase() : e.key.toLowerCase();
    if (k === 'control' || k === 'shift' || k === 'alt' || k === 'meta') return;
    if (/^digit/.test(k) && !e.shiftKey) k = k.slice(5);
    const spec = [(e.ctrlKey || e.metaKey) ? 'ctrl' : '', e.altKey ? 'alt' : '', e.shiftKey ? 'shift' : '', k].filter(Boolean).join('+');
    const fn = keymap[spec]; if (!fn) return;
    e.preventDefault(); fn();
  });
  let lw = 0, lh = 0;
  function resize() { const w = view.clientWidth || 1, h = view.clientHeight || 1; if (w === lw && h === lh) return; lw = w; lh = h; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize);
  function loop() { if (!running) return; raf = requestAnimationFrame(loop); resize(); orbit.update(); if (current) sel.setFromObject(current);
    while (msel.length < multi.length) { const h = new THREE.BoxHelper(new THREE.Object3D(), 0x55ccff); scene.add(h); msel.push(h); }
    msel.forEach((h, i) => { h.visible = i < multi.length; if (h.visible) h.setFromObject(multi[i]); });
    renderer.render(scene, cam); }
  async function restore() { try { const j = localStorage.getItem(KEY); if (j && !pieces.length) await loadData(JSON.parse(j)); } catch { /* ignore broken saves */ } }
  function show() { running = true; resize(); cancelAnimationFrame(raf); loop(); renderProps(); renderList(); restore(); }
  function hide() { running = false; cancelAnimationFrame(raf); }
  renderProps();
  return { show, hide, count: () => pieces.length, exportData, addPrim: (k) => select(addPrim(k)), join, mirror, array, select: (i) => select(pieces[i]), pieces: () => pieces.map((p) => p.userData.meta.kind), build, addProp: async (n) => { const o = await addProp(n); if (o) select(o); return !!o; }, addModel: async (buf, ext, name) => select(await addModel(buf, ext, name)), loadData, selected: () => current && describe(current) };
}
