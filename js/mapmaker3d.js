// 3D Map Maker: a small Blender-style editor. Orbit/pan/zoom camera, click to select, move/rotate/scale gizmo, game props, primitives and
// importable models (.glb/.gltf/.obj/.fbx). Exports JSON (and .glb). Maps made here are NOT loaded by the game; the developer has to add them.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { PROPS, PROP_NAMES, loadProps } from './props.js';

const KEY = 'ironstrike.mm3d';
const NOTE = 'Not playable in game unless the developer adds it.';
const PRIMS = { box: 'Box', cylinder: 'Cylinder', sphere: 'Sphere', plane: 'Floor plane', ramp: 'Ramp' };
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
  if (kind === 'sphere') return new THREE.SphereGeometry(0.5, 24, 16);
  if (kind === 'plane') { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }
  if (kind === 'ramp') {
    const s = new THREE.Shape(); s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g;
  }
  return new THREE.BoxGeometry(1, 1, 1);
}

export function createEditor(root, onExit) {
  root.innerHTML = '';
  // ---------- layout ----------
  const top = el('div', 'mmtop'), left = el('div', 'mmside'), view = el('div', 'mmview'), right = el('div', 'mmside r'), foot = el('div', 'mmfoot', NOTE + '  |  Orbit: left drag - Pan: right drag - Zoom: wheel - Click to select - G / R / S = move / rotate / scale - Del = delete - Ctrl+D = duplicate - Ctrl+Z / Ctrl+Y = undo / redo');
  root.append(top, left, view, right, foot);
  const canvas = el('canvas'); view.appendChild(canvas);
  const btn = (parent, text, fn, cls = '') => { const b = el('button', 'btn ' + cls, text); b.type = 'button'; b.addEventListener('click', fn); parent.appendChild(b); return b; };

  // ---------- scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a2230);
  const cam = new THREE.PerspectiveCamera(55, 1, 0.1, 1000); cam.position.set(14, 12, 16);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x36322c, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(12, 24, 8); scene.add(sun);
  const grid = new THREE.GridHelper(80, 80, 0x4a5a70, 0x2a3646); scene.add(grid);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false })); scene.add(ground);
  const world = new THREE.Group(); scene.add(world);
  const orbit = new OrbitControls(cam, canvas); orbit.target.set(0, 0, 0); orbit.enableDamping = false; orbit.maxPolarAngle = Math.PI * 0.499;
  const tc = new TransformControls(cam, canvas); scene.add(tc);
  const sel = new THREE.BoxHelper(new THREE.Object3D(), 0xffaa33); sel.visible = false; scene.add(sel);
  tc.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value; });

  // ---------- state ----------
  let hist = ['[]'], hpos = 0, restoring = false, pieces = [], models = {}, current = null, counter = 0, running = false, raf = 0, saveT = 0;
  const st = { snap: true, mode: 'translate' };
  const listBox = el('div', 'list'), props = el('div');

  function material(color, vc) { return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, vertexColors: !!vc, side: THREE.DoubleSide }); }
  function register(obj, meta) {
    obj.userData.pid = ++counter; obj.userData.meta = meta; world.add(obj); pieces.push(obj); changed(); return obj;
  }
  function groundY(obj) { obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(obj); obj.position.y += -b.min.y; }
  function spawnPoint() { const t = orbit.target; return [Math.round(t.x), 0, Math.round(t.z)]; }
  function addPrim(kind, saved) {
    const mk = MARKS[kind], col = saved?.color || mk?.color || '#8a96a3';
    const m = new THREE.Mesh(primGeo(kind), material(col));
    if (mk) { m.material.transparent = true; m.material.opacity = 0.7; }
    if (saved) apply(m, saved); else { if (mk) m.scale.set(...mk.size); else m.scale.set(kind === 'plane' ? 6 : 2, kind === 'plane' ? 1 : 2, kind === 'plane' ? 6 : 2); const p = spawnPoint(); m.position.set(p[0], 0, p[2]); groundY(m); }
    return register(m, { kind, name: saved?.name || mk?.name || PRIMS[kind], color: col, val: saved?.val || '' });
  }
  async function addProp(name, saved) {
    await loadProps().catch(() => {});
    const p = PROPS[name]; if (!p) return null;
    const m = new THREE.Mesh(p.geo, material(0xffffff, true));
    if (saved) apply(m, saved); else { const q = spawnPoint(); m.position.set(q[0], 0, q[2]); groundY(m); }
    return register(m, { kind: 'prop', prop: name, name: saved?.name || name });
  }
  function apply(o, s) { o.position.fromArray(s.pos); o.rotation.set(...s.rot.map((d) => (d * Math.PI) / 180)); o.scale.fromArray(s.scl); }
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
    const g = new THREE.Group(); g.add(obj); return g;
  }
  async function addModel(buf, ext, name, saved, mid) {
    const g = await parseModel(buf, ext, name);
    const id = mid || 'm' + (Object.keys(models).length + 1) + '_' + name.replace(/\W+/g, '').slice(0, 14);
    models[id] = { name, ext, data: buf };
    if (saved) apply(g, saved);
    else {
      const b = new THREE.Box3().setFromObject(g), sz = b.getSize(new THREE.Vector3()), mx = Math.max(sz.x, sz.y, sz.z) || 1;
      if (mx > 30 || mx < 0.2) g.scale.setScalar(2 / mx);
      const p = spawnPoint(); g.position.set(p[0], 0, p[2]); groundY(g);
    }
    return register(g, { kind: 'model', model: id, name: saved?.name || name.replace(/\.[^.]+$/, '') });
  }
  function select(o) {
    current = o || null;
    if (current) { tc.attach(current); sel.setFromObject(current); sel.visible = true; } else { tc.detach(); sel.visible = false; }
    renderProps(); renderList();
  }
  function remove(o) { if (!o) return; if (current === o) select(null); world.remove(o); pieces = pieces.filter((p) => p !== o); o.traverse((c) => { if (c.isMesh && c.userData.pid) { c.material?.dispose?.(); } }); changed(); }
  async function duplicate(o) {
    if (!o) return; const m = o.userData.meta, s = describe(o); s.pos[0] += 1; s.pos[2] += 1; s.name = m.name + ' copy'; let n;
    if (m.kind === 'prop') n = await addProp(m.prop, s);
    else if (m.kind === 'model') { const md = models[m.model]; n = await addModel(md.data, md.ext, md.name, s, m.model); }
    else n = addPrim(m.kind, s);
    if (n) select(n);
  }
  function describe(o) {
    const m = o.userData.meta, r = (x) => +x.toFixed(3);
    return { id: o.userData.pid, kind: m.kind, name: m.name, prop: m.prop, model: m.model, color: m.color, val: m.val || undefined,
      pos: o.position.toArray().map(r), rot: [o.rotation.x, o.rotation.y, o.rotation.z].map((x) => r((x * 180) / Math.PI)), scl: o.scale.toArray().map(r) };
  }
  function exportData(withModels = true) {
    const used = new Set(pieces.filter((p) => p.userData.meta.kind === 'model').map((p) => p.userData.meta.model)), mo = {};
    if (withModels) for (const id of used) mo[id] = { name: models[id].name, ext: models[id].ext, data: b64(models[id].data) };
    return { format: 'iron-strike-map', version: 2, note: NOTE, units: 'metres', pieces: pieces.map(describe), models: mo };
  }
  async function loadData(d) {
    restoring = true;
    for (const p of [...pieces]) { world.remove(p); } pieces = []; models = {}; select(null);
    for (const s of d.pieces || []) {
      try {
        if (s.kind === 'prop') await addProp(s.prop, s);
        else if (s.kind === 'model') { const md = d.models?.[s.model]; if (md) await addModel(unb64(md.data), md.ext, md.name, s, s.model); }
        else if (PRIMS[s.kind] || MARKS[s.kind]) addPrim(s.kind, s);
      } catch (e) { console.warn('skipped piece', s.name, e); }
    }
    restoring = false; changed();
  }
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  function snap() { if (restoring) return; const j = JSON.stringify(pieces.map((p) => { const d = describe(p); delete d.id; return d; })); if (hist[hpos] === j) return; hist = hist.slice(0, hpos + 1); hist.push(j); if (hist.length > 100) hist.shift(); hpos = hist.length - 1; }
  async function goto(i) {
    if (i < 0 || i >= hist.length) return; hpos = i; restoring = true; const list = JSON.parse(hist[i]);
    try {
      for (const p of [...pieces]) world.remove(p); pieces = []; select(null);
      for (const s of list) {
        try {
          if (s.kind === 'prop') await addProp(s.prop, s);
          else if (s.kind === 'model' && models[s.model]) { const md = models[s.model]; await addModel(md.data, md.ext, md.name, s, s.model); }
          else if (PRIMS[s.kind] || MARKS[s.kind]) addPrim(s.kind, s);
        } catch (e) { console.warn('undo: skipped', s.name, e); }
      }
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
  for (const [m, t] of [['translate', 'Move (G)'], ['rotate', 'Rotate (R)'], ['scale', 'Scale (S)']]) modeBtns[m] = btn(top, t, () => setMode(m), m === st.mode ? 'sel' : '');
  function setMode(m) { st.mode = m; tc.setMode(m); for (const k in modeBtns) modeBtns[k].classList.toggle('sel', k === m); }
  const snapL = el('label'); snapL.style.cssText = 'display:flex;gap:4px;align-items:center'; const snapC = el('input'); snapC.type = 'checkbox'; snapC.checked = true; snapL.append(snapC, 'Snap');
  const applySnap = () => { tc.setTranslationSnap(snapC.checked ? 0.5 : null); tc.setRotationSnap(snapC.checked ? Math.PI / 12 : null); tc.setScaleSnap(snapC.checked ? 0.1 : null); };
  snapC.addEventListener('change', applySnap); applySnap(); top.appendChild(snapL);
  btn(top, 'Undo', undo); btn(top, 'Redo', redo); btn(top, 'Duplicate', () => duplicate(current)); btn(top, 'Delete', () => remove(current));
  btn(top, 'Focus (F)', () => focus());
  const mapIn = el('input'); mapIn.type = 'file'; mapIn.accept = '.json'; mapIn.style.display = 'none';
  mapIn.addEventListener('change', async () => { const f = mapIn.files[0]; mapIn.value = ''; if (!f) return; try { await loadData(JSON.parse(await f.text())); } catch (e) { alert('Could not load that map file.'); } });
  btn(top, 'Load map', () => mapIn.click());
  btn(top, 'Save map file', () => download('my-iron-strike-map.json', new Blob([JSON.stringify(exportData(true))], { type: 'application/json' })), 'alt');
  btn(top, 'Export .glb', async () => {
    try { const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js'); new GLTFExporter().parse(world, (r) => download('my-iron-strike-map.glb', new Blob([r], { type: 'model/gltf-binary' })), (e) => alert('Export failed'), { binary: true }); } catch (e) { alert('Export failed: ' + e.message); }
  });
  btn(top, 'Clear', () => { if (pieces.length && !confirm('Remove everything from the map?')) return; for (const p of [...pieces]) world.remove(p); pieces = []; models = {}; select(null); changed(); });
  btn(top, 'Exit', () => { hide(); onExit(); });

  left.appendChild(el('h4', '', 'Shapes'));
  for (const k in PRIMS) btn(left, '+ ' + PRIMS[k], () => { const o = addPrim(k); select(o); });
  left.appendChild(el('h4', '', 'Gameplay markers'));
  for (const k in MARKS) btn(left, '+ ' + MARKS[k].name, () => { const o = addPrim(k); select(o); });
  left.appendChild(el('h4', '', 'Game props'));
  for (const n of PROP_NAMES) btn(left, '+ ' + n, async () => { const o = await addProp(n); if (o) select(o); });
  left.appendChild(el('h4', '', 'Your models'));
  const fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = '.glb,.gltf,.obj,.fbx'; fileIn.multiple = true; fileIn.style.display = 'none';
  fileIn.addEventListener('change', async () => {
    const fs = [...fileIn.files]; fileIn.value = '';
    for (const f of fs) {
      const ext = f.name.split('.').pop().toLowerCase();
      try { const o = await addModel(await f.arrayBuffer(), ext, f.name); select(o); } catch (e) { alert('Could not import ' + f.name + ': ' + (e.message || e)); }
    }
  });
  btn(left, 'Import model...', () => fileIn.click(), 'alt');
  left.appendChild(el('p', 'hint', '.glb, .gltf (single file), .obj or .fbx. Export from Blender with File > Export > glTF 2.0 (.glb).'));
  left.appendChild(fileIn);

  right.append(el('h4', '', 'Selected'), props, el('h4', '', 'Objects'), listBox);
  function numRow(label, arr, get, set) {
    const r = el('div', 'row'); r.appendChild(el('label', '', label));
    const v = get();
    for (let i = 0; i < 3; i++) { const inp = el('input'); inp.type = 'number'; inp.step = '0.1'; inp.value = v[i]; inp.addEventListener('change', () => { const n = get(); n[i] = parseFloat(inp.value) || 0; set(n); sel.setFromObject(current); changed(); }); r.appendChild(inp); }
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
    if (!['prop', 'model'].includes(m.kind)) { const r = el('div', 'row'); r.appendChild(el('label', '', 'Colour')); const c = el('input'); c.type = 'color'; c.value = m.color || '#8a96a3'; c.addEventListener('input', () => { m.color = c.value; o.material.color.set(c.value); changed(); }); r.appendChild(c); props.appendChild(r); }
  }
  function renderList() {
    listBox.innerHTML = '';
    for (const p of pieces) { const b = el('button', 'btn' + (p === current ? ' sel' : ''), p.userData.meta.name); b.type = 'button'; b.addEventListener('click', () => select(p)); listBox.appendChild(b); }
  }
  tc.addEventListener('objectChange', () => { if (current) { sel.setFromObject(current); renderProps(); } });
  tc.addEventListener('mouseUp', () => changed());

  // ---------- picking, camera ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, tc.dragging]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || down[2] || tc.dragging || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || e.button !== 0) return;
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(world.children, true)[0]; let o = hit?.object; while (o && o.parent !== world) o = o.parent;
    select(o && pieces.includes(o) ? o : null);
  });
  function focus() {
    const b = new THREE.Box3(); if (current) b.setFromObject(current); else if (pieces.length) b.setFromObject(world); else { orbit.target.set(0, 0, 0); return; }
    const c = b.getCenter(new THREE.Vector3()), s = Math.max(b.getSize(new THREE.Vector3()).length(), 2); orbit.target.copy(c);
    cam.position.copy(c).add(new THREE.Vector3(0.7, 0.55, 0.8).normalize().multiplyScalar(s * 1.5 + 3));
  }
  window.addEventListener('keydown', (e) => {
    if (!running || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (k === 'g') setMode('translate'); else if (k === 'r') setMode('rotate'); else if (k === 's' && !e.ctrlKey) setMode('scale');
    else if (k === 'f') focus(); else if (k === 'delete' || k === 'backspace') remove(current);
    else if (k === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplicate(current); } else if (k === 'escape') select(null);
  });
  let lw = 0, lh = 0;
  function resize() { const w = view.clientWidth || 1, h = view.clientHeight || 1; if (w === lw && h === lh) return; lw = w; lh = h; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  window.addEventListener('resize', resize);
  function loop() { if (!running) return; raf = requestAnimationFrame(loop); resize(); orbit.update(); if (current) sel.setFromObject(current); renderer.render(scene, cam); }
  async function restore() { try { const j = localStorage.getItem(KEY); if (j && !pieces.length) await loadData(JSON.parse(j)); } catch { /* ignore broken saves */ } }
  function show() { running = true; resize(); cancelAnimationFrame(raf); loop(); renderProps(); renderList(); restore(); }
  function hide() { running = false; cancelAnimationFrame(raf); }
  renderProps();
  return { show, hide, count: () => pieces.length, exportData, addPrim: (k) => select(addPrim(k)), addProp: async (n) => { const o = await addProp(n); if (o) select(o); return !!o; }, addModel: async (buf, ext, name) => select(await addModel(buf, ext, name)), loadData, selected: () => current && describe(current) };
}
