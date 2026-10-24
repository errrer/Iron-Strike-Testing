import { Game, MODES, mpMode } from './game.js';
import { Net, cleanCode, cleanName } from './net.js';
import { watchForEgg } from './easter.js';
import { HUD, XH_STYLES, cleanXh, styleCrosshair } from './hud.js';
import { Sound } from './audio.js';
import { WEAPONS, PRIMARIES, SECONDARIES, weaponBars, ATT, cleanMask } from './weapons.js';
import { loadModels } from './gunmodels.js';
import { loadProps } from './props.js';
import { MAP_IDS, MAP_INFO, ZM_MAPS } from './maps.js';
import { rankName, UNLOCK } from './progress.js';
import { initMapMaker } from './mapmaker.js';
import { initTouch } from './touch.js';

const $ = (id) => document.getElementById(id);

// ---------------- settings (persisted) ----------------
const DEFAULTS = { mode: 'tdm', map: 'warehouse', primary: 'vmp', secondary: 'g18', difficulty: 'normal', sens: 1, fov: 80, vol: 0.55, view: 'first', name: '', att: {}, xh: null };
let cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('ironstrike') || '{}')); } catch (e) { /* ignore */ }
if (!MODES[cfg.mode] || MODES[cfg.mode].zm) cfg.mode = DEFAULTS.mode;
if (!MAP_IDS.includes(cfg.map)) cfg.map = DEFAULTS.map;
if (!PRIMARIES.includes(cfg.primary)) cfg.primary = DEFAULTS.primary;
if (!SECONDARIES.includes(cfg.secondary)) cfg.secondary = DEFAULTS.secondary;
cfg.xh = cleanXh(cfg.xh);
if (!cfg.att || typeof cfg.att !== 'object') cfg.att = {};
if (!cfg.name) cfg.name = 'Player' + Math.floor(100 + Math.random() * 900);
if (cfg.view !== 'first' && cfg.view !== 'third') cfg.view = 'first';
const save = () => { try { localStorage.setItem('ironstrike', JSON.stringify(cfg)); } catch (e) { /* ignore */ } };

function showFatal(msg) {
  const el = $('loaderr'); el.classList.remove('hidden');
  el.innerHTML = `<div><b>Could not start the game.</b><br>${msg}<br><br><small>If you opened index.html straight from disk, serve the folder instead (e.g. <code>python3 -m http.server</code>) and make sure you are online so Three.js can load.</small></div>`;
}

// ---------------- boot ----------------
let game, hud, sound;
try {
  hud = new HUD(); sound = new Sound();
  const settings = { sens: cfg.sens, fov: cfg.fov, view: cfg.view, gore: cfg.gore !== false, ragdoll: cfg.ragdoll !== false, unlockAll: cfg.unlockAll !== false };
  game = new Game($('c'), hud, sound, settings);
  window.__game = game;
} catch (err) {
  console.error(err);
  showFatal(err && err.message ? err.message : String(err));
  throw err;
}

// ---------------- menu cards ----------------
function card(parent, html, selected, onClick) {
  const d = document.createElement('div'); d.className = 'card' + (selected ? ' sel' : ''); d.innerHTML = html;
  d.addEventListener('click', () => { if (d.classList.contains('locked')) return; onClick(); for (const c of parent.children) c.classList.remove('sel'); d.classList.add('sel'); save(); });
  parent.appendChild(d); return d;
}

for (const m of Object.values(MODES)) {
  if (m.zm) continue;
  card($('modes'), `<h3>${m.name}</h3><p>${m.blurb}</p>`, cfg.mode === m.id, () => { cfg.mode = m.id; });
}
for (const id of MAP_IDS) {
  const i = MAP_INFO[id];
  card($('maps'), `<div class="thumb" style="background:${i.thumb}"></div><h3>${i.name}</h3><p>${i.desc}</p>`, cfg.map === id, () => { cfg.map = id; });
}
function weaponCard(parent, id, key) {
  const w = WEAPONS[id], bars = weaponBars(w);
  const barsHtml = Object.entries(bars).map(([k, v]) => `<div class="bar"><span>${k}</span><i><b style="width:${Math.round(v * 100)}%"></b></i></div>`).join('');
  const el = card(parent, `<span class="cls">${w.cls}</span><h3>${w.name}</h3><p>${w.desc}</p><div class="bars">${barsHtml}</div>`, cfg[key] === id, () => { cfg[key] = id; refreshAtt(); });
  el.dataset.wid = id; el.insertAdjacentHTML('beforeend', '<span class="lock"></span>');
}
let net = null;
// ---------------- progression: rank box + weapon unlocks ----------------
function refreshProg() {
  const pr = game.prog, i = pr.info, all = cfg.unlockAll !== false;
  $('rankName').textContent = `LV ${i.level} ${rankName(i.level)}`;
  $('rankFill').style.width = `${Math.round(i.into / i.next * 100)}%`;
  $('landRankName').textContent = $('rankName').textContent; $('landRankFill').style.width = $('rankFill').style.width;
  $('rankTxt').textContent = `${i.into} / ${i.next} XP  -  ${pr.d.kills} kills  -  ${pr.d.wins}/${pr.d.matches} wins`;
  $('landRankTxt').textContent = $('rankTxt').textContent;
  for (const c of document.querySelectorAll('[data-wid]')) {
    const id = c.dataset.wid, lock = !pr.unlocked(id, all);
    c.classList.toggle('locked', lock); c.querySelector('.lock').textContent = lock ? `LEVEL ${UNLOCK[id]}` : '';
  }
  for (const [key, list] of [['primary', PRIMARIES], ['secondary', SECONDARIES]]) {
    if (!pr.unlocked(cfg[key], all)) { cfg[key] = list.find((id) => pr.unlocked(id, all)); for (const c of document.querySelectorAll(`#${key === 'primary' ? 'primaries' : 'secondaries'} .card`)) c.classList.toggle('sel', c.dataset.wid === cfg[key]); }
  }
}
for (const id of PRIMARIES) weaponCard($('primaries'), id, 'primary');
for (const id of SECONDARIES) weaponCard($('secondaries'), id, 'secondary');
// ---------------- attachments (equipped per weapon, remembered between sessions) ----------------
const MAX_DUMMIES_UI = 20;
const maskFor = (id) => cleanMask(WEAPONS[id], cfg.att[id] | 0);
function renderAtt(el, slot) {
  const id = cfg[slot], w = WEAPONS[id]; el.textContent = '';
  const label = document.createElement('div'); label.className = 'attlabel'; label.textContent = `${w.name} attachments`; el.appendChild(label);
  for (const key of w.attach || []) {
    const a = ATT[key], b = document.createElement('button'); b.type = 'button';
    b.className = 'chip' + (maskFor(id) & a.bit ? ' sel' : '');
    for (const [tag, text] of [['b', a.name], ['span', a.desc], ['em', a.stats]]) { const x = document.createElement(tag); x.textContent = text; b.appendChild(x); }
    b.addEventListener('click', () => {
      cfg.att[id] = maskFor(id) ^ a.bit; save(); refreshAtt(); loadoutChanged();
    });
    el.appendChild(b);
  }
  if (!(w.attach || []).length) { const n = document.createElement('div'); n.className = 'none'; n.textContent = 'No attachments for this weapon.'; el.appendChild(n); }
}
function refreshAtt() {
  renderAtt($('attP'), 'primary'); renderAtt($('attS'), 'secondary');
  renderAtt($('mpAttP'), 'primary'); renderAtt($('mpAttS'), 'secondary');
  renderAtt($('sbAttP'), 'primary'); renderAtt($('sbAttS'), 'secondary');
}
// a loadout edit goes to the lobby (multiplayer), or straight into a running sandbox match
function loadoutChanged() {
  if (net) { net.setLoadout(cfg.primary, cfg.secondary, maskFor(cfg.primary), maskFor(cfg.secondary)); return; }
  if (game.mode && game.mode.sandbox && game.scene && (game.state === 'playing' || game.state === 'paused')) game.applyLoadout(game.player, cfg.primary, cfg.secondary, maskFor(cfg.primary), maskFor(cfg.secondary));
}
refreshAtt();


for (const d of ['easy', 'normal', 'hard']) {
  const b = document.createElement('button'); b.textContent = d; if (cfg.difficulty === d) b.classList.add('sel');
  b.addEventListener('click', () => { cfg.difficulty = d; for (const c of $('difficulty').children) c.classList.remove('sel'); b.classList.add('sel'); save(); });
  $('difficulty').appendChild(b);
}

// each setting has a control in the main menu and one in the pause menu; they stay in sync
function slider(ids, key, fmt, apply) {
  const sync = () => { for (const [id, outId] of ids) { $(id).value = cfg[key]; $(outId).textContent = fmt(cfg[key]); } };
  sync(); apply(cfg[key]);
  for (const [id] of ids) $(id).addEventListener('input', () => { cfg[key] = parseFloat($(id).value); sync(); apply(cfg[key]); save(); });
}
slider([['sens', 'sensOut'], ['sens2', 'sensOut2']], 'sens', (v) => v.toFixed(2), (v) => { game.settings.sens = v; });
slider([['fov', 'fovOut'], ['fov2', 'fovOut2']], 'fov', (v) => String(Math.round(v)), (v) => { game.settings.fov = v; });
slider([['vol', 'volOut'], ['vol2', 'volOut2']], 'vol', (v) => v.toFixed(2), (v) => { sound.volume = v; if (sound.master) sound.master.gain.value = v; });

// ragdoll toggle (main menu + pause menu)
for (const id of ['rag', 'rag2']) {
  const el = $(id); if (!el) continue;
  el.checked = cfg.ragdoll !== false;
  el.addEventListener('change', () => { cfg.ragdoll = el.checked; game.settings.ragdoll = el.checked; for (const o of ['rag', 'rag2']) if ($(o)) $(o).checked = el.checked; save(); });
}
// gore toggle (main menu + pause menu)
for (const id of ['gore', 'gore2']) {
  const el = $(id); if (!el) continue;
  el.checked = cfg.gore !== false;
  el.addEventListener('change', () => { cfg.gore = el.checked; game.settings.gore = el.checked; for (const o of ['gore', 'gore2']) if ($(o)) $(o).checked = el.checked; save(); });
}

// ---------------- crosshair changer (main menu + pause menu share one config) ----------------
const XH_COLORS = ['#ffffff', '#39ff14', '#ff3b30', '#00e5ff', '#ffd23a', '#ff4fd8'];
const xhSync = [];
function applyXh() { cfg.xh = cleanXh(cfg.xh); hud.setCrosshair(cfg.xh); for (const el of document.querySelectorAll('.xhprev .xh')) styleCrosshair(el, cfg.xh); for (const f of xhSync) f(); save(); }
function buildXh(box) {
  const prev = document.createElement('div'); prev.className = 'xhprev';
  prev.innerHTML = '<div class="xh"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="dot"></i><i class="ring"></i></div>';
  const ctl = document.createElement('div'); ctl.className = 'xhctl';
  const row1 = document.createElement('div'); row1.className = 'xhrow'; row1.append('Style ');
  const sel = document.createElement('select'); for (const [id, name] of XH_STYLES) { const o = document.createElement('option'); o.value = id; o.textContent = name; sel.appendChild(o); }
  sel.addEventListener('change', () => { cfg.xh.style = sel.value; applyXh(); }); row1.appendChild(sel); ctl.appendChild(row1);
  const row2 = document.createElement('div'); row2.className = 'xhrow'; row2.append('Colour ');
  const sws = XH_COLORS.map((col) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = col; b.addEventListener('click', () => { cfg.xh.color = col; applyXh(); }); row2.appendChild(b); return [col, b]; });
  const pick = document.createElement('input'); pick.type = 'color'; pick.addEventListener('input', () => { cfg.xh.color = pick.value; applyXh(); }); row2.appendChild(pick); ctl.appendChild(row2);
  const sliders = [['size', 'Length', 2, 30, 1], ['thick', 'Thickness', 1, 8, 1], ['gap', 'Gap', 0, 30, 1], ['alpha', 'Opacity', 0.2, 1, 0.05]].map(([key, label, min, max, step]) => {
    const l = document.createElement('label'), r = document.createElement('input'), o = document.createElement('output');
    r.type = 'range'; r.min = min; r.max = max; r.step = step; l.append(label, r, o);
    r.addEventListener('input', () => { cfg.xh[key] = parseFloat(r.value); applyXh(); }); ctl.appendChild(l); return [key, r, o];
  });
  const row3 = document.createElement('div'); row3.className = 'xhrow';
  const chks = [['outline', 'Outline'], ['dyn', 'Spreads when moving / firing']].map(([key, label]) => {
    const l = document.createElement('label'); l.className = 'chk'; const c = document.createElement('input'); c.type = 'checkbox';
    c.addEventListener('change', () => { cfg.xh[key] = c.checked; applyXh(); }); l.append(c, label); row3.appendChild(l); return [key, c];
  });
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn small'; reset.textContent = 'Reset';
  reset.addEventListener('click', () => { cfg.xh = cleanXh(null); applyXh(); }); row3.appendChild(reset); ctl.appendChild(row3);
  box.append(prev, ctl);
  xhSync.push(() => {
    const c = cfg.xh; sel.value = c.style; pick.value = c.color;
    for (const [col, b] of sws) b.classList.toggle('sel', col.toLowerCase() === c.color.toLowerCase());
    for (const [key, r, o] of sliders) { r.value = c[key]; o.textContent = key === 'alpha' ? c[key].toFixed(2) : String(Math.round(c[key])); }
    for (const [key, ck] of chks) ck.checked = !!c[key];
    styleCrosshair(prev.firstChild, c);
  });
}
buildXh($('xhMenu')); buildXh($('xhPause')); applyXh();

// camera view toggle (main menu + pause menu + V key in game)
const viewBtns = [];
for (const seg of document.querySelectorAll('.viewseg')) {
  for (const [v, label] of [['first', 'First person'], ['third', 'Third person']]) {
    const b = document.createElement('button'); b.textContent = label; b.dataset.view = v;
    b.addEventListener('click', () => game.toggleView(v));
    seg.appendChild(b); viewBtns.push(b);
  }
}
function showView(v) { cfg.view = v; for (const b of viewBtns) b.classList.toggle('sel', b.dataset.view === v); save(); }
game.onViewChange = showView;
showView(cfg.view);

// ---------------- models ----------------
// Weapons with an `asset` (assets/models/<id>.json, baked from FBX) are loaded before the first match.
const startBtn = $('btnStart');
startBtn.disabled = true; startBtn.textContent = 'LOADING...';
Promise.all([loadModels(WEAPONS), loadProps().catch(() => [])]).then(([ids]) => ids).then((ids) => console.log('[models] loaded:', ids.join(', ') || 'none (procedural fallbacks)'))
  .catch(() => {}).finally(() => { startBtn.disabled = false; startBtn.textContent = 'DEPLOY'; });

// ---------------- start screen: Multiplayer / Zombies ----------------
const screens = ['landing', 'menu', 'zmenu', 'mmaker', 'mdmaker'];
function showScreen(id) { for (const s of screens) $(s).classList.toggle('hidden', s !== id); }
initMapMaker($, showScreen);
initTouch(game, $);
$('lMP').addEventListener('click', () => showScreen('menu'));
$('lZM').addEventListener('click', () => { $('zmName').value = cfg.name; zmStatus(''); showScreen('zmenu'); });
$('btnLandBack').addEventListener('click', () => showScreen('landing'));
$('zmBack').addEventListener('click', () => showScreen('landing'));
function zmStatus(text, err) { const el = $('zmStatus'); el.textContent = text || ''; el.classList.toggle('err', !!err); }
const zmLoadout = () => ({ prim: 'm1911', sec: 'm1911', ap: 0, as: 0 });
$('zmSolo').addEventListener('click', () => {
  cfg.name = cleanName($('zmName').value); save(); lastZm = true;
  zmDeploy();
});
let lastZm = false;
function zmDeploy() {
  resetMpUi(); sound.init();
  if (sound.master) sound.master.gain.value = cfg.vol;
  for (const id of ['landing', 'menu', 'zmenu', 'endscreen', 'pause']) $(id).classList.add('hidden');
  const zmap = $('zmMap').value || 'outpost';
  game.start({ mode: 'zm', map: zmap, mapName: MAP_INFO[zmap].name, primary: 'm1911', secondary: 'm1911', attP: 0, attS: 0, difficulty: cfg.difficulty, name: cfg.name });
}

// ---------------- flow ----------------
function deploy() {
  save(); resetMpUi();
  sound.init();
  if (sound.master) sound.master.gain.value = cfg.vol;
  lastZm = false;
  $('menu').classList.add('hidden'); $('endscreen').classList.add('hidden'); $('pause').classList.add('hidden');
  game.start({ mode: cfg.mode, map: cfg.map, mapName: MAP_INFO[cfg.map].name, primary: cfg.primary, secondary: cfg.secondary, attP: maskFor(cfg.primary), attS: maskFor(cfg.secondary), difficulty: cfg.difficulty });
}
function toMenu() {
  if (net) { net.leave(); net = null; resetMpUi(); }
  game.net = null; game.state = 'menu';
  try { document.exitPointerLock(); } catch (e) { /* ignore */ }
  $('hud').classList.add('hidden'); $('pause').classList.add('hidden'); $('endscreen').classList.add('hidden');
  showScreen('landing'); refreshProg();
}
$('btnStart').addEventListener('click', deploy);
$('btnAgain').addEventListener('click', () => {
  if (!net) return lastZm ? zmDeploy() : deploy();
  if (net.role === 'host') net.toLobby();
  $('endscreen').classList.add('hidden'); $('hud').classList.add('hidden');
  $('mp').classList.remove('hidden'); mpShow('lobby'); renderLobby(net.lobby);
});
$('btnMenu').addEventListener('click', toMenu);
$('btnQuit').addEventListener('click', toMenu);
$('btnResume').addEventListener('click', () => game.resume());
document.addEventListener('keydown', (e) => { if (e.code === 'Enter' && game.state === 'menu' && !$('menu').classList.contains('hidden') && $('mp').classList.contains('hidden') && !startBtn.disabled) deploy(); });

// ---------------- multiplayer ----------------
const mpShow = (w) => { $('mpHome').classList.toggle('hidden', w !== 'home'); $('mpLobby').classList.toggle('hidden', w !== 'lobby'); };
function mpStatus(id, text, err) { const el = $(id); el.textContent = text || ''; el.classList.toggle('err', !!err); }
function resetMpUi() { $('btnAgain').textContent = 'Play again'; $('pauseTitle').textContent = 'PAUSED'; $('btnQuit').textContent = 'Quit to menu'; }

function fillSelect(id, items) { const el = $(id); for (const [v, label] of items) { const o = document.createElement('option'); o.value = v; o.textContent = label; el.appendChild(o); } }
fillSelect('mpMode', Object.values(MODES).filter((m) => !m.solo).map((m) => [m.id, m.name]));
for (const o of $('mpMode').options) if (o.value === 'zm') o.hidden = true;     // zombies rooms are made from the Zombies screen
fillSelect('mpMap', MAP_IDS.map((id) => [id, MAP_INFO[id].name]));
fillSelect('zmMap', ZM_MAPS.map((id) => [id, MAP_INFO[id].name]));
const zmMapDesc = () => { $('zmMapDesc').textContent = (MAP_INFO[$('zmMap').value] || {}).desc || ''; };
$('zmMap').addEventListener('change', zmMapDesc); zmMapDesc();
fillSelect('sbPrim', PRIMARIES.map((id) => [id, WEAPONS[id].name]));
fillSelect('sbSec', SECONDARIES.map((id) => [id, WEAPONS[id].name]));
fillSelect('mpPrim', PRIMARIES.map((id) => [id, WEAPONS[id].name]));
fillSelect('mpSec', SECONDARIES.map((id) => [id, WEAPONS[id].name]));
$('mpPrim').value = cfg.primary; $('mpSec').value = cfg.secondary; $('mpName').value = cfg.name;

// ---------------- sandbox panel (pause menu) ----------------
function sbRefresh() {
  $('sbPrim').value = cfg.primary; $('sbSec').value = cfg.secondary; refreshAtt();
  const n = game.actors ? game.actors.filter((a) => a.dummy).length : 0;
  $('sbCount').textContent = `Dummies: ${n} / ${MAX_DUMMIES_UI}. They stand still and do nothing; dead ones disappear after a few seconds.`;
}
game.onPause = sbRefresh;
setInterval(() => { if (game.mode && game.mode.sandbox && game.state === 'paused') sbRefresh(); }, 500);
$('sbSpawn').addEventListener('click', () => { game.sandboxSpawn(1); sbRefresh(); });
$('sbSpawn5').addEventListener('click', () => { game.sandboxSpawn(5); sbRefresh(); });
$('sbClear').addEventListener('click', () => { game.sandboxClear(); sbRefresh(); });
for (const [id, key] of [['sbPrim', 'primary'], ['sbSec', 'secondary']]) $(id).addEventListener('change', () => { cfg[key] = $(id).value; save(); refreshAtt(); loadoutChanged(); });

function renderLobby(st) {
  if (!net || !st) return;
  const host = net.role === 'host';
  $('mpCodeTxt').textContent = net.code;
  $('mpMode').value = st.mode; $('mpMap').value = st.map;
  const zm = st.mode === 'zm';
  $('mpMode').disabled = !host || zm; $('mpMap').disabled = !host || zm; $('mpPrim').parentElement.classList.toggle('hidden', zm); $('mpSec').parentElement.classList.toggle('hidden', zm);
  for (const id of ['mpAttP', 'mpAttS']) $(id).classList.toggle('hidden', zm);
  $('mpCount').textContent = `${st.players.length} / ${st.max}`;
  $('mpInfo').textContent = `${mpMode(st.mode).blurb}${host ? '' : ' (the host picks mode and map)'}`;
  const tbl = $('mpPlayers'); tbl.textContent = '';
  const head = tbl.insertRow(); for (const h of ['Player', 'Team', 'Loadout']) { const th = document.createElement('th'); th.textContent = h; head.appendChild(th); }
  const team = mpMode(st.mode).team;
  for (const p of st.players) {
    const r = tbl.insertRow(); r.className = (team ? 't' + (p.team % 2) : '') + (p.id === net.myId ? ' me' : '');
    r.insertCell().textContent = p.name + (p.id === 0 ? ' (host)' : '') + (p.id === net.myId ? ' (you)' : '');
    r.insertCell().textContent = team ? (p.team % 2 === 0 ? 'Blue' : 'Red') : '-';
    const tag = (id, mask) => (WEAPONS[id] || {}).name + ((mask | 0) ? ` (${Object.values(ATT).filter((a) => mask & a.bit).map((a) => a.name.split(' ')[0]).join('+')})` : '');
    r.insertCell().textContent = `${tag(p.prim, p.ap)} / ${tag(p.sec, p.as)}`;
  }
  $('mpStart').classList.toggle('hidden', !host);
  const minP = mpMode(st.mode).sandbox || zm ? 1 : 2;
  $('mpStart').disabled = st.players.length < minP;
  mpStatus('mpLStatus', host ? (st.players.length < minP ? 'Waiting for players - share the room code.' : '') : (st.inMatch ? 'A match is in progress...' : 'Waiting for the host to start the match...'));
}

const mpUi = {
  lobby: (st) => renderLobby(st),
  started: () => {
    for (const id of ['mp', 'menu', 'endscreen', 'pause']) $(id).classList.add('hidden');
    $('btnAgain').textContent = 'Back to lobby'; $('pauseTitle').textContent = 'MENU'; $('btnQuit').textContent = 'Leave match';
  },
  closed: (why) => {
    net = null; game.net = null; game.state = 'menu'; resetMpUi();
    try { document.exitPointerLock(); } catch (e) { /* ignore */ }
    for (const id of ['hud', 'pause', 'endscreen']) $(id).classList.add('hidden');
    showScreen('landing'); $('mp').classList.remove('hidden'); mpShow('home'); mpStatus('mpStatus', why, true);
  },
};
const loadout = () => ({ prim: cfg.primary, sec: cfg.secondary, ap: maskFor(cfg.primary), as: maskFor(cfg.secondary) });
const myName = () => { cfg.name = cleanName($('mpName').value); $('mpName').value = cfg.name; save(); return cfg.name; };

$('btnMP').addEventListener('click', () => { $('mpPrim').value = cfg.primary; $('mpSec').value = cfg.secondary; refreshAtt(); $('mp').classList.remove('hidden'); mpShow(net ? 'lobby' : 'home'); mpStatus('mpStatus', ''); });
$('mpBack').addEventListener('click', () => $('mp').classList.add('hidden'));
$('mpCode').addEventListener('input', () => { $('mpCode').value = cleanCode($('mpCode').value); });
$('mpCode').addEventListener('keydown', (e) => { if (e.code === 'Enter') $('mpJoinBtn').click(); });
function busy(on) { for (const id of ['mpHostBtn', 'mpJoinBtn']) $(id).disabled = on; }
$('mpHostBtn').addEventListener('click', async () => {
  busy(true); mpStatus('mpStatus', 'Creating room...');
  net = new Net(game, mpUi);
  try { await net.host(myName(), loadout(), cfg.mode, cfg.map); mpShow('lobby'); renderLobby(net.lobby); }
  catch (e) { try { net.leave(); } catch (x) { /* ignore */ } net = null; mpStatus('mpStatus', (e && e.message) || 'Could not create a room.', true); }
  busy(false);
});
$('mpJoinBtn').addEventListener('click', async () => {
  busy(true); mpStatus('mpStatus', 'Connecting...');
  net = new Net(game, mpUi);
  try { await net.join($('mpCode').value, myName(), loadout()); mpStatus('mpStatus', ''); mpShow('lobby'); if (net.lobby) renderLobby(net.lobby); }
  catch (e) { net = null; mpStatus('mpStatus', (e && e.message) || 'Could not join.', true); }
  busy(false);
});
$('mpMode').addEventListener('change', () => { const err = net && net.setMode($('mpMode').value); if (err) { mpStatus('mpLStatus', err, true); renderLobby(net.lobby); } });
$('mpMap').addEventListener('change', () => net && net.setMap($('mpMap').value));
for (const [id, key] of [['mpPrim', 'primary'], ['mpSec', 'secondary']]) $(id).addEventListener('change', () => { cfg[key] = $(id).value; save(); refreshAtt(); if (net) net.setLoadout(cfg.primary, cfg.secondary, maskFor(cfg.primary), maskFor(cfg.secondary)); });
$('mpStart').addEventListener('click', () => { const err = net && net.start(); if (err) mpStatus('mpLStatus', err, true); });
$('mpLeave').addEventListener('click', () => { const z = net && net.mode === 'zm'; if (net) net.leave(); net = null; mpShow('home'); mpStatus('mpStatus', ''); if (z) { $('mp').classList.add('hidden'); showScreen('zmenu'); } });
$('mpCopy').addEventListener('click', () => {
  const code = net ? net.code : '';
  const done = () => { $('mpCopy').textContent = 'Copied'; setTimeout(() => { $('mpCopy').textContent = 'Copy'; }, 1500); };
  try { navigator.clipboard.writeText(code).then(done, () => {}); } catch (e) { /* ignore */ }
});
// ---- zombies co-op: host / join through the same lobby screen ----
function zmBusy(on) { for (const id of ['zmSolo', 'zmHost', 'zmJoin']) $(id).disabled = on; }
$('zmCode').addEventListener('input', () => { $('zmCode').value = cleanCode($('zmCode').value); });
$('zmCode').addEventListener('keydown', (e) => { if (e.code === 'Enter') $('zmJoin').click(); });
$('zmHost').addEventListener('click', async () => {
  zmBusy(true); zmStatus('Creating room...'); cfg.name = cleanName($('zmName').value); $('mpName').value = cfg.name; save();
  net = new Net(game, mpUi);
  try { await net.host(cfg.name, zmLoadout(), 'zm', $('zmMap').value || 'outpost'); $('mp').classList.remove('hidden'); mpShow('lobby'); renderLobby(net.lobby); zmStatus(''); }
  catch (e) { try { net.leave(); } catch (x) { /* ignore */ } net = null; zmStatus((e && e.message) || 'Could not create a room.', true); }
  zmBusy(false);
});
$('zmJoin').addEventListener('click', async () => {
  zmBusy(true); zmStatus('Connecting...'); cfg.name = cleanName($('zmName').value); $('mpName').value = cfg.name; save();
  net = new Net(game, mpUi);
  try { await net.join($('zmCode').value, cfg.name, zmLoadout()); zmStatus(''); $('mp').classList.remove('hidden'); mpShow('lobby'); if (net.lobby) renderLobby(net.lobby); }
  catch (e) { net = null; zmStatus((e && e.message) || 'Could not join.', true); }
  zmBusy(false);
});
window.addEventListener('beforeunload', () => { if (net) net.leave(); });
window.__mp = { get net() { return net; }, mpUi };

// ---------------- easter egg: type "richtofen" ----------------
function toast(text) {
  let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = text; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
watchForEgg(() => { game.setRichtofen(!game.richtofen); toast(game.richtofen ? 'EASTER EGG ACTIVATED' : 'EASTER EGG OFF'); });

// ---------------- loop ----------------
let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000; last = now;
  try { game.frame(dt); } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// unlock-all toggle + initial rank display
{
  const el = $('unlockAll');
  if (el) { el.checked = cfg.unlockAll !== false; el.addEventListener('change', () => { cfg.unlockAll = el.checked; game.settings.unlockAll = el.checked; save(); refreshProg(); }); }
  refreshProg();
}
