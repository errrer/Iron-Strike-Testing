// Rebindable keys. The game logic keeps testing the DEFAULT key codes; every key event is passed through canon() first, which turns the
// key the player bound into the default code of that action (and silences a default key that was moved to something else).
export const ACTIONS = [
  { id: 'fwd', name: 'Move forward', def: ['KeyW'] },
  { id: 'back', name: 'Move backward', def: ['KeyS'] },
  { id: 'left', name: 'Move left', def: ['KeyA'] },
  { id: 'right', name: 'Move right', def: ['KeyD'] },
  { id: 'jump', name: 'Jump / mantle', def: ['Space'] },
  { id: 'sprint', name: 'Sprint / hold breath', def: ['ShiftLeft'] },
  { id: 'crouch', name: 'Crouch / slide', def: ['KeyC', 'ControlLeft'] },
  { id: 'reload', name: 'Reload', def: ['KeyR'] },
  { id: 'prim', name: 'Primary weapon', def: ['Digit1'] },
  { id: 'sec', name: 'Secondary weapon', def: ['Digit2'] },
  { id: 'ads', name: 'Aim (key)', def: ['KeyQ'] },
  { id: 'use', name: 'Use / inspect', def: ['KeyF'] },
  { id: 'view', name: 'Change camera view', def: ['KeyV'] },
  { id: 'score', name: 'Scoreboard', def: ['Tab'] },
  { id: 'uav', name: 'Killstreak: UAV', def: ['Digit4'] },
  { id: 'sentry', name: 'Killstreak: Sentry gun', def: ['Digit5'] },
  { id: 'strike', name: 'Killstreak: Airstrike', def: ['Digit6'] },
  { id: 'spawn', name: 'Sandbox: spawn dummy', def: ['KeyB'] },
  { id: 'clear', name: 'Sandbox: clear dummies', def: ['KeyN'] },
];
const STORE = 'ironstrike_keys';
let binds = {};                                   // action id -> bound code (only entries that differ from the default)
try { const o = JSON.parse(localStorage.getItem(STORE) || '{}'); if (o && typeof o === 'object') for (const a of ACTIONS) if (typeof o[a.id] === 'string' && o[a.id].length < 24) binds[a.id] = o[a.id]; } catch (e) { binds = {}; }
let rev = {}, silent = new Set();
function rebuild() {
  rev = {}; silent = new Set();
  const taken = new Set();
  for (const a of ACTIONS) { const c = bound(a.id); taken.add(c); if (binds[a.id] && binds[a.id] !== a.def[0]) rev[binds[a.id]] = a.def[0]; }
  for (const a of ACTIONS) if (binds[a.id] && binds[a.id] !== a.def[0]) for (const d of a.def) if (!taken.has(d)) silent.add(d);   // moved away: the old key does nothing
}
export const bound = (id) => binds[id] || ACTIONS.find((a) => a.id === id).def[0];
export const canon = (code) => (rev[code] !== undefined ? rev[code] : silent.has(code) ? 'None' : code);
function persist() { try { localStorage.setItem(STORE, JSON.stringify(binds)); } catch (e) { /* ignore */ } rebuild(); }
export function setBind(id, code) {
  const a = ACTIONS.find((x) => x.id === id); if (!a) return;
  const old = bound(id), other = ACTIONS.find((x) => x.id !== id && bound(x.id) === code);
  if (other) { if (old === other.def[0]) delete binds[other.id]; else binds[other.id] = old; }     // swap with whoever had that key
  if (code === a.def[0]) delete binds[id]; else binds[id] = code;
  persist();
}
export function resetBinds() { binds = {}; persist(); }
export function resetOne(id) { setBind(id, ACTIONS.find((x) => x.id === id).def[0]); }
export function keyLabel(code) {
  if (!code) return '-';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return ({ Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' })[code] || code;
}
// label for the key currently doing what `defCode` used to (used by on-screen prompts)
export const labelFor = (defCode) => { const a = ACTIONS.find((x) => x.def.includes(defCode)); return keyLabel(a ? bound(a.id) : defCode); };
rebuild();

// ---- settings panel (overlay #kb)
export function initKeybinds() {
  const root = document.getElementById('kb'); if (!root) return;
  const list = document.getElementById('kbList'); let waiting = null;
  const draw = () => {
    list.textContent = '';
    for (const a of ACTIONS) {
      const row = document.createElement('div'); row.className = 'kb-row';
      const n = document.createElement('span'); n.textContent = a.name;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'kb-key' + (waiting === a.id ? ' wait' : '') + (bound(a.id) !== a.def[0] ? ' changed' : '');
      b.textContent = waiting === a.id ? 'Press a key...' : keyLabel(bound(a.id));
      b.addEventListener('click', () => { waiting = a.id; draw(); b.blur(); });
      row.appendChild(n); row.appendChild(b); list.appendChild(row);
    }
  };
  const open = () => { waiting = null; draw(); root.classList.remove('hidden'); };
  const close = () => { waiting = null; root.classList.add('hidden'); };
  for (const id of ['btnKeys', 'btnKeys2']) { const el = document.getElementById(id); if (el) el.addEventListener('click', open); }
  document.getElementById('kbClose').addEventListener('click', close);
  document.getElementById('kbReset').addEventListener('click', () => { resetBinds(); waiting = null; draw(); });
  window.addEventListener('keydown', (e) => {                          // capture phase: nothing else sees keys while this panel is open
    if (root.classList.contains('hidden')) return;
    e.stopPropagation(); e.preventDefault();
    if (e.repeat) return;
    if (waiting) {
      if (e.code === 'Escape') { waiting = null; draw(); return; }
      if (e.code === 'Backspace' || e.code === 'Delete') { resetOne(waiting); waiting = null; draw(); return; }
      if (/^(Meta|OS|ContextMenu|F\d+)/.test(e.code)) return;
      setBind(waiting, e.code); waiting = null; draw();
    } else if (e.code === 'Escape') close();
  }, true);
  window.addEventListener('keyup', (e) => { if (!root.classList.contains('hidden')) e.stopPropagation(); }, true);
}
