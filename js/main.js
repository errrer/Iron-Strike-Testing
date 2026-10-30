import { Game, MODES, mpMode } from './game.js?v=0.18.6';
import { Net, cleanCode, cleanName } from './net.js?v=0.18.6';
import { watchForEgg } from './easter.js?v=0.18.6';
import { HUD, XH_STYLES, cleanXh, styleCrosshair } from './hud.js?v=0.18.6';
import { Sound } from './audio.js?v=0.18.6';
import { WEAPONS, PRIMARIES, SECONDARIES, weaponStats, withAtt, KNIVES, CAMOS, cleanMask, migrateOldMask, camoOf, attList } from './weapons.js?v=0.18.6';
import { loadModels, tickCamos } from './gunmodels.js?v=0.18.6';
import { loadProps } from './props.js?v=0.18.6';
import { MAP_IDS, MAP_INFO, ZM_MAPS } from './maps.js?v=0.18.6';
import { rankName, UNLOCK } from './progress.js?v=0.18.6';
import { initMapMaker } from './mapmaker.js?v=0.18.6';
import { RaceMode } from './race.js?v=0.18.6';
import { initSupermod, MOD } from './supermod.js?v=0.18.6';
import { initKeybinds } from './keybinds.js?v=0.18.6';
import { Gunsmith } from './gunsmith.js?v=0.18.6';
import { WeaponPreview } from './wpreview.js?v=0.18.6';
import { initTouch, blockZoom } from './touch.js?v=0.18.6';
import { initGamepad } from './gamepad.js?v=0.18.6';

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
if (cfg.attv !== 2) { for (const k of Object.keys(cfg.att)) cfg.att[k] = migrateOldMask(cfg.att[k]); cfg.attv = 2; }
if (!cfg.name) cfg.name = 'Player' + Math.floor(100 + Math.random() * 900);
if (cfg.view !== 'first' && cfg.view !== 'third') cfg.view = 'first';
// ---------------- classes: five custom loadouts (primary, secondary, their attachments, knife) you can swap between, even mid-match
const CLASS_DEFAULTS = [['m4a1', 'g18'], ['ak47', 'm1911'], ['mp5', 'skorp'], ['dmr', 'magnum'], ['m680', 'deagle']];
const snapClass = () => ({ prim: cfg.primary, sec: cfg.secondary, knife: cfg.knife, ap: cleanMask(WEAPONS[cfg.primary], cfg.att[cfg.primary] | 0), as: cleanMask(WEAPONS[cfg.secondary], cfg.att[cfg.secondary] | 0) });
if (!Array.isArray(cfg.classes) || cfg.classes.length !== 5) cfg.classes = CLASS_DEFAULTS.map(([p, s], i) => (i === 0 ? { prim: cfg.primary, sec: cfg.secondary, knife: cfg.knife || 'k_combat', ap: 0, as: 0 } : { prim: p, sec: s, knife: 'k_combat', ap: 0, as: 0 }));
if (!(cfg.cls >= 0 && cfg.cls < 5)) cfg.cls = 0;
const save = () => { try { if (cfg.classes && WEAPONS[cfg.primary] && WEAPONS[cfg.secondary]) cfg.classes[cfg.cls] = snapClass(); localStorage.setItem('ironstrike', JSON.stringify(cfg)); } catch (e) { /* ignore */ } };

function showFatal(msg) {
  const el = $('loaderr'); el.classList.remove('hidden');
  el.innerHTML = `<div><b>Could not start the game.</b><br>${msg}<br><br><small>If you opened index.html straight from disk, serve the folder instead (e.g. <code>python3 -m http.server</code>) and make sure you are online so Three.js can load.</small></div>`;
}

// ---------------- boot ----------------
let game, hud, sound;
try {
  hud = new HUD(); sound = new Sound();
  const settings = { sens: cfg.sens, fov: cfg.fov, view: cfg.view, gfx: ['low', 'medium', 'high', 'ultra'].includes(cfg.gfx) ? cfg.gfx : 'high', gore: cfg.gore !== false, ragdoll: cfg.ragdoll !== false, unlockAll: cfg.unlockAll !== false };
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
const maskFor = (id) => cleanMask(WEAPONS[id], cfg.att[id] | 0);
// ---------------- COD-style loadout preview ----------------
let wprev = null, curSlot = 'primary';
const CLS_NAMES = { ar: 'ASSAULT RIFLE', smg: 'SMG', pistol: 'HANDGUN', shotgun: 'SHOTGUN', sniper: 'SNIPER RIFLE', melee: 'MELEE', lmg: 'LMG', dmr: 'MARKSMAN RIFLE' };
const CARD_STATS = ['Damage', 'Fire rate', 'Range', 'Control', 'Mobility'];
const barsHtml = (w, all) => weaponStats(w).filter((r) => all || CARD_STATS.includes(r.k)).map((r) => `<div class="bar num"><span>${r.k}</span><i><b style="width:${Math.round(r.bar * 100)}%"></b></i><em>${r.text}</em></div>`).join('');
function showWeapon(id, slot) {
  const w = WEAPONS[id]; if (!w || !$('wpName')) return;
  if (slot !== 'melee') curSlot = slot || curSlot;
  $('wpSlot').textContent = (slot || curSlot).toUpperCase(); $('wpCls').textContent = CLS_NAMES[w.cls] || String(w.cls).toUpperCase(); $('wpName').textContent = w.name; $('wpDesc').textContent = w.desc;
  const eff = withAtt(w, maskFor(id));
  $('wpBars').innerHTML = barsHtml(eff, true);
  $('wpMag').textContent = eff.mag; $('wpRes').textContent = w.reserve;
  if (wprev && wprev.ok) wprev.show({ ...w, attMask: maskFor(id) });
}
function weaponCard(parent, id, key) {
  const w = WEAPONS[id], bh = barsHtml(withAtt(w, maskFor(id)), false);
  const el = card(parent, `<img class="wicon" alt="" draggable="false"><span class="cls">${CLS_NAMES[w.cls] || w.cls}</span><h3>${w.name}</h3><p>${w.desc}</p><div class="bars">${bh}</div>`, cfg[key] === id, () => { cfg[key] = id; refreshAtt(); showWeapon(id, key); });
  el.dataset.wid = id; el.insertAdjacentHTML('beforeend', '<span class="lock"></span>');
  el.addEventListener('mouseenter', () => showWeapon(id, key)); el.addEventListener('focus', () => showWeapon(id, key));
  parent.onmouseleave = () => showWeapon(cfg[curSlot], curSlot);
}
let net = null;
// ---------------- progression: rank box + weapon unlocks ----------------
function refreshProg() {
  const pr = game.prog, i = pr.info, all = cfg.unlockAll !== false || MOD.unlockAll;
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
if (!KNIVES.includes(cfg.knife)) cfg.knife = 'k_combat';
for (const id of KNIVES) {
  const w = WEAPONS[id];
  const el = card($('knives'), `<img class="wicon" alt="" draggable="false"><span class="cls">KNIFE</span><h3>${w.name}</h3><p>${w.desc}</p><div class="bars"><div class="bar num"><span>Slash</span><i><b style="width:${Math.round(w.dmg)}%"></b></i><em>${w.dmg}</em></div><div class="bar num"><span>Speed</span><i><b style="width:${Math.round(100 * 0.34 / w.cd)}%"></b></i><em>${Math.round(60 / w.cd)}/min</em></div><div class="bar num"><span>Reach</span><i><b style="width:${Math.round(w.maxD / 3.2 * 100)}%"></b></i><em>${w.maxD} m</em></div></div>`, cfg.knife === id, () => { cfg.knife = id; game.knifeId = id; });
  el.dataset.wid = id; el.insertAdjacentHTML('beforeend', '<span class="lock"></span>'); el.addEventListener('mouseenter', () => showWeapon(id, 'melee')); el.addEventListener('focus', () => showWeapon(id, 'melee'));
}
$('knives').onmouseleave = () => showWeapon(cfg[curSlot] || cfg.primary, curSlot);
game.knifeId = cfg.knife;
// ---------------- attachments (equipped per weapon, remembered between sessions) ----------------
const MAX_DUMMIES_UI = 20;
const mk = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
let gsm = null;
function renderAtt(el, slot) {
  const id = cfg[slot], w = WEAPONS[id]; el.textContent = '';
  const m = maskFor(id), l = attList(m), total = Object.keys(w.opts || {}).length;
  const b = mk('button', 'btn gsbtn'); b.type = 'button'; b.appendChild(mk('span', null, `GUNSMITH - ${w.name}`)); b.appendChild(mk('span', null, `${l.length}/${total} attachments${camoOf(m) ? ' - ' + CAMOS[camoOf(m)].name : ''}`));
  b.addEventListener('click', () => { if (gsm) gsm.show(id); });
  el.appendChild(b);
  if (l.length) { const s = mk('div', 'attsum'); s.textContent = l.map((a) => a.name).join(' \u00b7 '); el.appendChild(s); }
}
function refreshAtt() {
  renderAtt($('attP'), 'primary'); renderAtt($('attS'), 'secondary');
  renderAtt($('mpAttP'), 'primary'); renderAtt($('mpAttS'), 'secondary');
  renderAtt($('sbAttP'), 'primary'); renderAtt($('sbAttS'), 'secondary');
}
// a loadout edit goes to the lobby (multiplayer), or straight into a running sandbox match
function loadoutChanged() {
  if (net) { net.setLoadout(cfg.primary, cfg.secondary, maskFor(cfg.primary), maskFor(cfg.secondary)); return; }
  if (game.mode && !game.mode.zm && game.scene && (game.state === 'playing' || game.state === 'paused')) game.applyLoadout(game.player, cfg.primary, cfg.secondary, maskFor(cfg.primary), maskFor(cfg.secondary));
}
function applyClassCfg() {                                                                // load the selected class into the live config
  const c = cfg.classes[cfg.cls];
  if (PRIMARIES.includes(c.prim)) cfg.primary = c.prim; if (SECONDARIES.includes(c.sec)) cfg.secondary = c.sec; if (KNIVES.includes(c.knife)) cfg.knife = c.knife;
  cfg.att[cfg.primary] = cleanMask(WEAPONS[cfg.primary], c.ap | 0); cfg.att[cfg.secondary] = cleanMask(WEAPONS[cfg.secondary], c.as | 0); game.knifeId = cfg.knife;
}
function renderClasses() {
  for (const id of ['classBar', 'pauseClasses']) {
    const el = $(id); if (!el) continue; el.textContent = '';
    cfg.classes.forEach((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cls' + (i === cfg.cls ? ' sel' : '');
      const t = document.createElement('b'); t.textContent = `CLASS ${i + 1}`; const s = document.createElement('span'); s.textContent = `${(WEAPONS[c.prim] || {}).name || '-'} / ${(WEAPONS[c.sec] || {}).name || '-'}`;
      b.appendChild(t); b.appendChild(s);
      b.addEventListener('click', () => selectClass(i)); el.appendChild(b);
    });
  }
}
function selectClass(i) {
  cfg.cls = i; applyClassCfg(); save();
  for (const [key, box] of [['primary', 'primaries'], ['secondary', 'secondaries']]) for (const c of document.querySelectorAll(`#${box} .card`)) c.classList.toggle('sel', c.dataset.wid === cfg[key]);
  for (const c of document.querySelectorAll('#knives .card')) c.classList.toggle('sel', c.dataset.wid === cfg.knife);
  for (const id of ['mpPrim', 'mpSec', 'sbPrim', 'sbSec']) { const el = $(id); if (el) el.value = id.endsWith('Prim') ? cfg.primary : cfg.secondary; }
  refreshAtt(); loadoutChanged(); showWeapon(cfg[curSlot], curSlot); renderClasses();
}
refreshAtt(); renderClasses();
try { wprev = new WeaponPreview($('wpCanvas')); } catch (e) { wprev = null; }
initKeybinds();
initSupermod({
  onOpen: () => { if (game.state === 'playing') { try { document.exitPointerLock(); } catch (e) { /* ignore */ } game.pause(); } },
  onChange: () => { game.settings.unlockAll = cfg.unlockAll !== false || MOD.unlockAll; refreshProg(); refreshAtt(); },
  maxRank: () => { game.prog.add(1e7); refreshProg(); refreshAtt(); },
});
gsm = new Gunsmith({ prog: game.prog, getMask: (id) => maskFor(id), setMask: (id, m) => { cfg.att[id] = m; save(); }, onClose: (id) => { renderClasses(); refreshAtt(); loadoutChanged(); showWeapon(cfg[curSlot], curSlot); for (const c of document.querySelectorAll('[data-wid]')) { const w = WEAPONS[c.dataset.wid], bx = c.querySelector('.bars'); if (bx && w) bx.innerHTML = barsHtml(withAtt(w, maskFor(w.id)), false); } } });
showWeapon(cfg.primary, 'primary');

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
cfg.touchSens = cfg.touchSens || 1;
slider([['tsens', 'tsensOut'], ['tsens2', 'tsensOut2']], 'touchSens', (v) => v.toFixed(2), (v) => { game.settings.touchSens = v; });
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

// graphics preset + FPS counter (main menu + pause menu)
const gfxBtns = [];
for (const seg of document.querySelectorAll('.gfxseg')) {
  for (const v of ['low', 'medium', 'high', 'ultra']) {
    const b = document.createElement('button'); b.textContent = v; b.dataset.gfx = v;
    b.addEventListener('click', () => { cfg.gfx = v; game.settings.gfx = v; showGfx(); game.applyGfx(); save(); });
    seg.appendChild(b); gfxBtns.push(b);
  }
}
function showGfx() { for (const b of gfxBtns) b.classList.toggle('sel', b.dataset.gfx === game.settings.gfx); }
showGfx(); game.applyGfx();
for (const id of ['fps', 'fps2']) {
  const el = $(id); if (!el) continue; el.checked = !!cfg.fps;
  el.addEventListener('change', () => { cfg.fps = el.checked; for (const o of ['fps', 'fps2']) if ($(o)) $(o).checked = el.checked; $('fpsBox').classList.toggle('hidden', !el.checked); save(); });
}
$('fpsBox').classList.toggle('hidden', !cfg.fps);
let fpsAcc = 0, fpsN = 0;
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
  .catch(() => {}).finally(() => {
    startBtn.disabled = false; startBtn.textContent = 'DEPLOY';
    if (wprev && wprev.ok) { for (const c of document.querySelectorAll('[data-wid]')) { const im = c.querySelector('.wicon'); if (im) im.src = wprev.icon(WEAPONS[c.dataset.wid]); } showWeapon(cfg[curSlot], curSlot); }
  });

// ---------------- start screen: Multiplayer / Zombies ----------------
const screens = ['landing', 'menu', 'zmenu', 'mmaker', 'mdmaker'];
function showScreen(id) { for (const s of screens) $(s).classList.toggle('hidden', s !== id); }
initMapMaker($, showScreen);
blockZoom();
initTouch(game, $);
initGamepad(game, $);
const race = new RaceMode(game, $, showScreen);
$('lRace').addEventListener('click', () => race.open());
for (const b of document.querySelectorAll('.cod-nav .cn')) {
  const hov = () => { $('codTitle').textContent = b.querySelector('span').textContent; $('codDesc').textContent = b.dataset.d || ''; for (const o of document.querySelectorAll('.cod-nav .cn')) o.classList.toggle('on', o === b); };
  b.addEventListener('mouseenter', hov); b.addEventListener('focus', hov);
}
{ const first = $('lOnline'); $('codTitle').textContent = 'ONLINE'; $('codDesc').textContent = first.dataset.d; first.classList.add('on'); }
$('lOnline').addEventListener('click', () => { showScreen('menu'); $('btnMP').click(); });
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
    const tag = (id, mask) => { const l = attList(mask | 0); return (WEAPONS[id] || {}).name + (l.length ? ` (${l.length} att.)` : ''); };
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
  if ((game.settings.gfx || 'high') !== 'low') tickCamos(Math.min(dt, 0.1));
  if (cfg.fps) { fpsAcc += dt; fpsN++; if (fpsAcc >= 0.5) { $('fpsBox').textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = 0; fpsN = 0; } }
  if (gsm && gsm.open) gsm.tick(Math.min(dt, 0.1));
  else if (wprev && !$('menu').classList.contains('hidden')) { try { wprev.tick(Math.min(dt, 0.1)); } catch (e) { wprev.ok = false; } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// unlock-all toggle + initial rank display
{
  const el = $('unlockAll');
  if (el) { el.checked = cfg.unlockAll !== false; el.addEventListener('change', () => { cfg.unlockAll = el.checked; game.settings.unlockAll = el.checked; save(); refreshProg(); }); }
  refreshProg();
}
