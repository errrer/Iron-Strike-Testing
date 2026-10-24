// Map Maker: a simple top-down editor. Exports a JSON map file. Maps made here are NOT loaded by the game; the developer has to add them.
const N = 40, CELL = 16;                       // 40 x 40 squares of 2 m
const TOOLS = [
  { id: 'wall', name: 'Wall', col: '#7b8794' }, { id: 'crate', name: 'Crate', col: '#a0763a' },
  { id: 'barrel', name: 'Barrel', col: '#3f7fcc' }, { id: 'container', name: 'Container', col: '#b5533c' },
  { id: 'spawnA', name: 'Spawn A', col: '#4cc2ff' }, { id: 'spawnB', name: 'Spawn B', col: '#ff5a4c' },
  { id: 'erase', name: 'Erase', col: '#ffffff' },
];
const KEY = 'ironstrike.mapmaker';
let items = [], tool = 'wall', drag = null, cv, cx;

function load() { try { const j = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(j)) items = j.filter((i) => i && TOOLS.some((t) => t.id === i.t)); } catch { items = []; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ } }
export function mapJSON() {
  return JSON.stringify({ format: 'iron-strike-map', version: 1, note: 'Not playable in game unless the developer adds it.', cell: 2, size: [N, N],
    pieces: items.map((i) => ({ type: i.t, x: i.x, z: i.z, w: i.w, d: i.d })) }, null, 2);
}
function draw() {
  cx.clearRect(0, 0, cv.width, cv.height);
  cx.strokeStyle = 'rgba(255,255,255,0.07)'; cx.lineWidth = 1;
  for (let i = 0; i <= N; i++) { cx.beginPath(); cx.moveTo(i * CELL + 0.5, 0); cx.lineTo(i * CELL + 0.5, N * CELL); cx.moveTo(0, i * CELL + 0.5); cx.lineTo(N * CELL, i * CELL + 0.5); cx.stroke(); }
  const rect = (i, a = 1) => { const t = TOOLS.find((q) => q.id === i.t); cx.globalAlpha = a; cx.fillStyle = t.col; cx.fillRect(i.x * CELL, i.z * CELL, i.w * CELL, i.d * CELL); cx.globalAlpha = 1; };
  for (const i of items) { rect(i); if (i.t.startsWith('spawn')) { cx.fillStyle = '#000'; cx.font = '10px sans-serif'; cx.fillText(i.t === 'spawnA' ? 'A' : 'B', i.x * CELL + 4, i.z * CELL + 12); } }
  if (drag && tool !== 'erase') rect(dragRect(), 0.6);
}
function cell(e) { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(N - 1, Math.floor(((e.clientX - r.left) / r.width) * N))), Math.max(0, Math.min(N - 1, Math.floor(((e.clientY - r.top) / r.height) * N)))]; }
function dragRect() {
  const [a, b] = [drag.a, drag.b]; const x = Math.min(a[0], b[0]), z = Math.min(a[1], b[1]);
  const single = tool === 'spawnA' || tool === 'spawnB' || tool === 'barrel';
  return { t: tool, x, z, w: single ? 1 : Math.abs(a[0] - b[0]) + 1, d: single ? 1 : Math.abs(a[1] - b[1]) + 1 };
}
function eraseAt(c) { const k = items.findIndex((i) => c[0] >= i.x && c[0] < i.x + i.w && c[1] >= i.z && c[1] < i.z + i.d); if (k >= 0) { items.splice(k, 1); save(); } }

export function initMapMaker($, showScreen) {
  cv = $('mmCanvas'); cx = cv.getContext('2d'); load();
  const bar = $('mmTools');
  for (const t of TOOLS) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (t.id === tool ? ' sel' : ''); b.textContent = t.name;
    b.addEventListener('click', () => { tool = t.id; for (const c of bar.children) c.classList.remove('sel'); b.classList.add('sel'); });
    bar.appendChild(b);
  }
  $('lMM').addEventListener('click', () => { $('mmWarn').classList.remove('hidden'); $('mmEditor').classList.add('hidden'); showScreen('mmaker'); });
  $('mmOk').addEventListener('click', () => { $('mmWarn').classList.add('hidden'); $('mmEditor').classList.remove('hidden'); draw(); });
  $('mmBack').addEventListener('click', () => showScreen('landing'));
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    const c = cell(e); cv.setPointerCapture(e.pointerId);
    if (e.button === 2 || tool === 'erase') { eraseAt(c); draw(); return; }
    drag = { a: c, b: c }; draw();
  });
  cv.addEventListener('pointermove', (e) => { if (drag) { drag.b = cell(e); draw(); } });
  cv.addEventListener('pointerup', () => {
    if (!drag) return; const r = dragRect(); drag = null;
    if (r.t.startsWith('spawn')) items = items.filter((i) => i.t !== r.t || false).concat(r);   // one spawn of each kind
    else items.push(r);
    save(); draw();
  });
  $('mmClear').addEventListener('click', () => { items = []; save(); draw(); });
  $('mmCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(mapJSON()); $('mmNote').textContent = 'Copied. Not playable in game unless the dev adds it.'; } catch { $('mmNote').textContent = 'Copy failed - use Download instead.'; } });
  $('mmExport').addEventListener('click', () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([mapJSON()], { type: 'application/json' })); a.download = 'my-iron-strike-map.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
