// Dumps every gun's scene graph (using the Three.js stand-in) as JSON so tools/preview_guns.py can render it.
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync('/tmp/guns-');
const stubSrc = fs.readFileSync(path.join(root, 'tests/three-stub.js'), 'utf8') + `
Color.prototype.copy = function (o) { this.c = o.c; return this; }; Color.prototype.lerp = function () { return this; }; Color.prototype.clone = function () { return new Color(this.c); }; Color.prototype.set = function (c) { this.c = c; return this; };
export class Box3 { constructor() { this.min = new Vector3(1e9, 1e9, 1e9); this.max = new Vector3(-1e9, -1e9, -1e9); }
  setFromObject(o) { const mn = this.min, mx = this.max; o.traverse((m) => { if (!m.geometry) return; const g = m.geometry; let h = [0.01, 0.01, 0.01]; if (g.kind === 'box') h = g.p.map((v) => v / 2); else if (g.kind === 'cyl') h = [g.p[0], g.p[2] / 2, g.p[0]]; else if (g.p) h = [g.p[0], g.p[0], g.p[0]]; else if (g.attributes && g.attributes.position) { const a = g.attributes.position.array, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < a.length; i++) { const k = i % 3; lo[k] = Math.min(lo[k], a[i]); hi[k] = Math.max(hi[k], a[i]); } for (const [i, k] of ['x', 'y', 'z'].entries()) { mn[k] = Math.min(mn[k], m.position[k] + lo[i]); mx[k] = Math.max(mx[k], m.position[k] + hi[i]); } return; }
    const r = m.rotation, sw = Math.abs(r.x) > 1 || Math.abs(r.z) > 1; const hz = g.kind === 'cyl' && Math.abs(r.x - Math.PI / 2) < 0.1 ? [h[0], h[0], g.p[2] / 2] : h;
    for (const [i, k] of ['x', 'y', 'z'].entries()) { mn[k] = Math.min(mn[k], m.position[k] - hz[i]); mx[k] = Math.max(mx[k], m.position[k] + hz[i]); } }); return this; }
  clone() { return this; } }
export class ExtrudeGeometry {} `;
const stubFile = path.join(tmp, 'three-stub.mjs'); fs.writeFileSync(stubFile, stubSrc);
const stub = pathToFileURL(stubFile).href;
fs.writeFileSync(path.join(tmp, 'gunmodels.mjs'), fs.readFileSync(path.join(root, 'js/gunmodels.js'), 'utf8').replace("from 'three'", `from '${stub}'`).replace(/from '\.\/weapons\.js[^']*'/, "from './weapons.mjs'").replace(/from '\.\/realguns\.js[^']*'/, "from './realguns.mjs'").replace(/from '\.\/skinkits\.js[^']*'/, "from './skinkits.mjs'"));
fs.copyFileSync(path.join(root, 'js/skinkits.js'), path.join(tmp, 'skinkits.mjs'));
fs.copyFileSync(path.join(root, 'js/realguns.js'), path.join(tmp, 'realguns.mjs'));
fs.copyFileSync(path.join(root, 'js/weapons.js'), path.join(tmp, 'weapons.mjs'));
const { buildGun, MODEL_DATA } = await import(pathToFileURL(path.join(tmp, 'gunmodels.mjs')).href);
const { WEAPONS, withAtt, setSkin } = await import(pathToFileURL(path.join(tmp, 'weapons.mjs')).href);
if (process.argv.some((a) => a.startsWith('--skin='))) { /* skin preview: needs Box3 */ }
const useAssets = !process.argv.includes('--no-assets'), allAtt = process.argv.includes('--att');
if (useAssets) for (const w of Object.values(WEAPONS)) if (w.asset) { const f = path.join(root, 'assets/models', w.asset.id + '.json'); if (fs.existsSync(f)) MODEL_DATA[w.asset.id] = JSON.parse(fs.readFileSync(f, 'utf8')); }
const colv = (c) => (c && typeof c === 'object' ? colv(c.c) : c);
const out = {};
const only = (process.argv.find((a) => a.startsWith('--ids=')) || '').slice(6).split(',').filter(Boolean);
for (const w of Object.values(WEAPONS)) {
  if (only.length && !only.includes(w.id)) continue;
  const skinArg = (process.argv.find((a) => a.startsWith('--skin=')) || '').slice(7), g = buildGun(skinArg ? { ...w, attMask: setSkin(0, +skinArg) } : allAtt ? withAtt(w, 7) : w), meshes = [];
  g.traverse((o) => {
    if (!o.geometry) return;
    const geo = o.geometry;
    const m = { kind: geo.kind || 'buffer', p: geo.p, pos: [o.position.x, o.position.y, o.position.z], rot: [o.rotation.x, o.rotation.y, o.rotation.z], scl: [o.scale.x, o.scale.y, o.scale.z], color: colv(o.material.color), opacity: o.material.opacity };
    if (!geo.kind) { m.positions = Array.from(geo.attributes.position.array); m.indices = geo.index; }
    meshes.push(m);
  });
  const u = g.userData, v = (x) => [x.x, x.y, x.z];
  out[w.id] = { meshes, muzzle: v(u.muzzle), sightY: u.sightY, grip: v(u.grip), fore: v(u.fore), pistol: u.pistol, name: w.name };
}
fs.writeFileSync(process.argv.find((a) => a.endsWith('.json')) || '/tmp/guns.json', JSON.stringify(out));
console.log('exported', Object.keys(out).join(', '), 'meshes:', Object.values(out).map((o) => o.meshes.length).join(','));
