// Secret mod menu: type "supermod" anywhere. Options can be applied for this session only (gone when the tab/game is closed)
// or permanently (kept in localStorage). `MOD` is a live object the game reads every frame.
const DEFAULTS = { unlockAll: false, god: false, infAmmo: false, noRecoil: false, noSpread: false, oneHit: false, fastReload: false, speed: 1, jump: 1, gravity: 1, fireRate: 1, dmgMul: 1 };
const KEY = 'ironstrike_supermod';
const read = (store) => { try { const o = JSON.parse(store.getItem(KEY) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } };
const write = (store, o) => { try { if (o) store.setItem(KEY, JSON.stringify(o)); else store.removeItem(KEY); } catch (e) { /* ignore */ } };
const clean = (o) => { const r = { ...DEFAULTS }; for (const k of Object.keys(DEFAULTS)) { if (o && typeof DEFAULTS[k] === 'boolean' && typeof o[k] === 'boolean') r[k] = o[k]; else if (o && typeof DEFAULTS[k] === 'number' && Number.isFinite(o[k])) r[k] = Math.max(0.1, Math.min(5, o[k])); } return r; };
export const MOD = clean({ ...(read(localStorage) || {}), ...(read(sessionStorage) || {}) });
export const modActive = () => Object.keys(DEFAULTS).some((k) => MOD[k] !== DEFAULTS[k]);

const TOGGLES = [
  ['unlockAll', 'Unlock everything', 'All weapons, attachments and every camo, rank-free'],
  ['god', 'God mode', 'You cannot be hurt (solo / host only)'],
  ['infAmmo', 'Infinite ammo', 'Your magazine never runs dry'],
  ['noRecoil', 'No recoil', 'The gun does not kick'],
  ['noSpread', 'Laser accurate', 'Zero bullet spread, hip and aimed'],
  ['oneHit', 'One-hit kills', 'Anything you shoot dies (solo / host only)'],
  ['fastReload', 'Instant reload', 'Reloads finish almost at once'],
];
const SLIDERS = [
  ['speed', 'Speed boost', 1, 4, 0.1, 'x'], ['jump', 'Jump boost', 1, 3.5, 0.1, 'x'], ['gravity', 'Gravity', 0.15, 1, 0.05, 'x'], ['fireRate', 'Fire rate', 1, 5, 0.1, 'x'], ['dmgMul', 'Damage', 1, 5, 0.1, 'x'],
];

export function initSupermod(hooks = {}) {
  const root = document.getElementById('sm'); if (!root) return;
  const list = document.getElementById('smList'), note = document.getElementById('smNote'), draft = { ...MOD };
  const say = (t) => { note.textContent = t; };
  const draw = () => {
    list.textContent = '';
    for (const [k, name, desc] of TOGGLES) {
      const row = document.createElement('label'); row.className = 'sm-row';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!draft[k]; cb.addEventListener('change', () => { draft[k] = cb.checked; });
      const t = document.createElement('span'); const b = document.createElement('b'); b.textContent = name; const s = document.createElement('small'); s.textContent = desc; t.appendChild(b); t.appendChild(s);
      row.appendChild(cb); row.appendChild(t); list.appendChild(row);
    }
    for (const [k, name, min, max, step, unit] of SLIDERS) {
      const row = document.createElement('label'); row.className = 'sm-row sl';
      const t = document.createElement('span'); const b = document.createElement('b'); b.textContent = name; const out = document.createElement('output'); out.textContent = (+draft[k]).toFixed(2).replace(/\.?0+$/, '') + unit; t.appendChild(b); t.appendChild(out);
      const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = draft[k]; r.addEventListener('input', () => { draft[k] = +r.value; out.textContent = (+r.value).toFixed(2).replace(/\.?0+$/, '') + unit; });
      row.appendChild(t); row.appendChild(r); list.appendChild(row);
    }
  };
  const open = () => { Object.assign(draft, MOD); draw(); say(''); root.classList.remove('hidden'); if (hooks.onOpen) hooks.onOpen(); };
  const close = () => root.classList.add('hidden');
  const apply = (permanent) => {
    Object.assign(MOD, clean(draft)); Object.assign(draft, MOD);
    if (permanent) write(localStorage, { ...MOD }); else write(sessionStorage, { ...MOD });      // session = this tab only; permanent = stays after the game is closed
    if (hooks.onChange) hooks.onChange(MOD);
    say(permanent ? 'Saved permanently. These stay on every time you play.' : 'Applied until the game is closed.');
  };
  document.getElementById('smSession').addEventListener('click', () => apply(false));
  document.getElementById('smPerm').addEventListener('click', () => apply(true));
  document.getElementById('smReset').addEventListener('click', () => { Object.assign(MOD, DEFAULTS); Object.assign(draft, DEFAULTS); write(localStorage, null); write(sessionStorage, null); draw(); if (hooks.onChange) hooks.onChange(MOD); say('All mods reset.'); });
  document.getElementById('smMax').addEventListener('click', () => { if (hooks.maxRank) hooks.maxRank(); say('Rank set to MAX.'); });
  document.getElementById('smClose').addEventListener('click', close);
  let buf = '';
  window.addEventListener('keydown', (e) => {
    if (!root.classList.contains('hidden')) { if (e.code === 'Escape') { e.stopPropagation(); close(); } return; }
    const el = document.activeElement; if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-8); if (buf === 'supermod') { buf = ''; open(); }
  }, true);
}
