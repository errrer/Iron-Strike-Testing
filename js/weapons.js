// 11 primaries + 5 secondaries.  Angles in radians, ranges in metres.
// dmg = damage per bullet/pellet, rpm = rounds per minute, range = [full damage until, minimum damage from].
export const WEAPONS = {
  // ---------------- PRIMARIES ----------------
  vmp: {
    id: 'vmp', name: 'VMP', slot: 'primary', cls: 'smg', desc: 'Fast-firing SMG. Great mobility, melts at close range.',
    dmg: 22, hs: 1.5, rpm: 860, auto: true, mag: 32, reserve: 192, reload: 1.8,
    spread: 0.030, adsSpread: 0.006, recoil: 0.0045, recoilYaw: 0.0030, range: [10, 30], minMul: 0.5, pellets: 1,
    zoom: 1.3, scope: false, moveMul: 1.08, snd: { f: 3200, len: 0.09, thump: 0.5 },
    builder: 'smg', attach: ['dot', 'grip', 'laser'],
    asset: { id: 'vmp', ownSights: true, grip: 'handle', fore: 'grip', foreOffset: [0, -0.02, 0], gripOffset: [0, 0.0, 0], mount: [0, 0.066, -0.04], under: [0, -0.053, -0.1], side: [0.022, -0.02, -0.2], sights: { zr: 0.06, zf: -0.19, br: 0.0734, bf: 0.0734 } },
  },
  super46: {
    id: 'super46', name: 'Super 46', slot: 'primary', cls: 'smg', desc: 'Kriss-style SMG with a ferocious rate of fire and low recoil. Drains a magazine in two seconds.',
    dmg: 20, hs: 1.5, rpm: 1100, auto: true, mag: 33, reserve: 198, reload: 1.9,
    spread: 0.030, adsSpread: 0.005, recoil: 0.0036, recoilYaw: 0.0024, range: [9, 28], minMul: 0.5, pellets: 1,
    zoom: 1.3, scope: false, moveMul: 1.06, snd: { f: 3500, len: 0.08, thump: 0.45 },
    builder: 'super46', attach: ['dot', 'grip', 'laser'],
  },
  m4a1: {
    id: 'm4a1', name: 'M4A1', slot: 'primary', cls: 'ar', desc: 'Balanced assault rifle. Accurate and easy to control.',
    dmg: 26, hs: 1.4, rpm: 660, auto: true, mag: 30, reserve: 180, reload: 2.2,
    spread: 0.028, adsSpread: 0.003, recoil: 0.0060, recoilYaw: 0.0030, range: [20, 50], minMul: 0.65, pellets: 1,
    zoom: 1.5, scope: false, moveMul: 1.0, snd: { f: 2600, len: 0.11, thump: 0.6 }, builder: 'ar', attach: ['dot', 'grip', 'laser'],
    asset: { id: 'm4a1', xmag: 'm4a1_xmag', grip: 'handle', fore: 'grip', foreOffset: [0, 0, 0], gripOffset: [0, 0, 0], mount: [0, 0.031, -0.12], under: [0, -0.032, -0.27], side: [0.02, 0.0, -0.3] },
  },
  ak47: {
    id: 'ak47', name: 'AK-47', slot: 'primary', cls: 'ar', desc: 'Hard-hitting rifle. Heavy recoil, big damage.',
    dmg: 33, hs: 1.4, rpm: 520, auto: true, mag: 30, reserve: 150, reload: 2.5,
    spread: 0.034, adsSpread: 0.004, recoil: 0.0092, recoilYaw: 0.0050, range: [22, 55], minMul: 0.7, pellets: 1,
    zoom: 1.45, scope: false, moveMul: 0.96, snd: { f: 2100, len: 0.13, thump: 0.8 }, builder: 'ak', attach: ['dot', 'grip', 'laser'],
  },
  kar98k: {
    id: 'kar98k', name: 'Kar98k', slot: 'primary', cls: 'sniper', desc: 'Bolt-action sniper. One shot to the body kills.',
    dmg: 105, hs: 2.0, rpm: 46, auto: false, mag: 5, reserve: 25, reload: 3.0,
    spread: 0.09, adsSpread: 0.0004, recoil: 0.03, recoilYaw: 0.004, range: [60, 120], minMul: 0.95, pellets: 1,
    zoom: 4.0, scope: true, moveMul: 0.9, snd: { f: 1500, len: 0.22, thump: 1.1 }, builder: 'bolt', attach: ['grip', 'laser'],
  },
  m680: {
    id: 'm680', name: 'Model 680', slot: 'primary', cls: 'shotgun', desc: 'Pump shotgun. Devastating up close, weak at range.',
    dmg: 12, hs: 1.3, rpm: 72, auto: false, mag: 6, reserve: 36, reload: 2.6,
    spread: 0.07, adsSpread: 0.045, recoil: 0.022, recoilYaw: 0.004, range: [5, 16], minMul: 0.15, pellets: 10,
    zoom: 1.2, scope: false, moveMul: 1.0, snd: { f: 1100, len: 0.2, thump: 1.2 }, builder: 'pump', attach: ['dot', 'grip', 'laser'],
  },
  mp5: {
    id: 'mp5', name: 'MP5', slot: 'primary', cls: 'smg', desc: 'Controllable 9mm SMG. Steady fire, good at medium-close range.',
    dmg: 24, hs: 1.5, rpm: 800, auto: true, mag: 30, reserve: 180, reload: 1.9,
    spread: 0.026, adsSpread: 0.005, recoil: 0.0040, recoilYaw: 0.0028, range: [12, 34], minMul: 0.5, pellets: 1,
    zoom: 1.35, scope: false, moveMul: 1.05, snd: { f: 2900, len: 0.1, thump: 0.55 }, builder: 'mp5', attach: ['dot', 'grip', 'laser'],
  },
  p90: {
    id: 'p90', name: 'P90', slot: 'primary', cls: 'smg', desc: 'Compact PDW with a 50-round mag. Low damage but nearly endless fire.',
    dmg: 20, hs: 1.5, rpm: 900, auto: true, mag: 50, reserve: 200, reload: 2.6,
    spread: 0.03, adsSpread: 0.005, recoil: 0.0035, recoilYaw: 0.0026, range: [12, 32], minMul: 0.5, pellets: 1,
    zoom: 1.4, scope: false, moveMul: 1.04, snd: { f: 3400, len: 0.09, thump: 0.45 }, builder: 'p90', attach: ['dot', 'grip', 'laser'],
  },
  scar: {
    id: 'scar', name: 'SCAR-H', slot: 'primary', cls: 'ar', desc: 'Battle rifle. Slower and heavier hitting than the assault rifles.',
    dmg: 38, hs: 1.4, rpm: 430, auto: true, mag: 20, reserve: 100, reload: 2.4,
    spread: 0.03, adsSpread: 0.0035, recoil: 0.0088, recoilYaw: 0.0040, range: [26, 60], minMul: 0.72, pellets: 1,
    zoom: 1.5, scope: false, moveMul: 0.94, snd: { f: 1900, len: 0.14, thump: 0.9 }, builder: 'scar', attach: ['dot', 'grip', 'laser'],
  },
  lmg: {
    id: 'lmg', name: 'M249', slot: 'primary', cls: 'ar', desc: 'Belt-fed LMG. 100 rounds and heavy suppressive fire, but slow to move and reload.',
    dmg: 29, hs: 1.3, rpm: 720, auto: true, mag: 100, reserve: 200, reload: 5.2,
    spread: 0.04, adsSpread: 0.006, recoil: 0.0055, recoilYaw: 0.0040, range: [22, 52], minMul: 0.65, pellets: 1,
    zoom: 1.4, scope: false, moveMul: 0.84, snd: { f: 1800, len: 0.14, thump: 0.9 }, builder: 'lmg', attach: ['dot', 'laser'],
  },
  dmr: {
    id: 'dmr', name: 'SVD', slot: 'primary', cls: 'ar', desc: 'Semi-auto marksman rifle with a 2.6x scope. Two body shots to kill.',
    dmg: 62, hs: 2.0, rpm: 240, auto: false, mag: 10, reserve: 50, reload: 2.8,
    spread: 0.06, adsSpread: 0.001, recoil: 0.016, recoilYaw: 0.004, range: [50, 100], minMul: 0.85, pellets: 1,
    zoom: 2.6, scope: false, moveMul: 0.93, snd: { f: 1500, len: 0.2, thump: 1.0 }, builder: 'dmr', attach: ['grip', 'laser'],
  },
  aa12: {
    id: 'aa12', name: 'AA-12', slot: 'primary', cls: 'smg', desc: 'Full-auto shotgun. Shreds at point-blank, burns through shells.',
    dmg: 9, hs: 1.3, rpm: 300, auto: true, mag: 8, reserve: 48, reload: 3.2,
    spread: 0.075, adsSpread: 0.05, recoil: 0.016, recoilYaw: 0.005, range: [5, 14], minMul: 0.15, pellets: 9,
    zoom: 1.2, scope: false, moveMul: 0.95, snd: { f: 1000, len: 0.18, thump: 1.2 }, builder: 'aa12', attach: ['dot', 'grip', 'laser'],
  },

  // ---------------- SECONDARIES ----------------
  g18: {
    id: 'g18', name: 'G18', slot: 'secondary', cls: 'pistol', desc: 'Full-auto machine pistol. Insane fire rate, burns ammo.',
    dmg: 17, hs: 1.4, rpm: 1100, auto: true, mag: 24, reserve: 96, reload: 1.5,
    spread: 0.034, adsSpread: 0.012, recoil: 0.0042, recoilYaw: 0.0035, range: [8, 22], minMul: 0.45, pellets: 1,
    zoom: 1.2, scope: false, moveMul: 1.1, snd: { f: 3000, len: 0.07, thump: 0.4 }, builder: 'glock', attach: ['dot', 'laser'],
  },
  m1911: {
    id: 'm1911', name: 'M1911', slot: 'secondary', cls: 'pistol', desc: 'Classic .45. Accurate semi-auto, three shots to kill.',
    dmg: 36, hs: 1.5, rpm: 420, auto: false, mag: 8, reserve: 48, reload: 1.4,
    spread: 0.022, adsSpread: 0.004, recoil: 0.012, recoilYaw: 0.003, range: [14, 35], minMul: 0.6, pellets: 1,
    zoom: 1.25, scope: false, moveMul: 1.08, snd: { f: 2000, len: 0.12, thump: 0.8 }, builder: 'm1911', attach: ['dot', 'laser'],
  },
  magnum: {
    id: 'magnum', name: '.357 Magnum', slot: 'secondary', cls: 'pistol', desc: 'Hand cannon revolver. Two shots to kill.',
    dmg: 70, hs: 1.5, rpm: 130, auto: false, mag: 6, reserve: 30, reload: 2.4,
    spread: 0.02, adsSpread: 0.002, recoil: 0.03, recoilYaw: 0.004, range: [20, 45], minMul: 0.7, pellets: 1,
    zoom: 1.3, scope: false, moveMul: 1.05, snd: { f: 1300, len: 0.18, thump: 1.1 }, builder: 'revolver', attach: ['dot', 'laser'],
  },  deagle: {
    id: 'deagle', name: 'Desert Eagle', slot: 'secondary', cls: 'pistol', desc: 'Huge .50 pistol. Heavy recoil, two body shots at close range.',
    dmg: 58, hs: 1.6, rpm: 210, auto: false, mag: 7, reserve: 35, reload: 1.9,
    spread: 0.02, adsSpread: 0.002, recoil: 0.026, recoilYaw: 0.004, range: [18, 42], minMul: 0.65, pellets: 1,
    zoom: 1.3, scope: false, moveMul: 1.04, snd: { f: 1250, len: 0.18, thump: 1.1 }, builder: 'deagle', attach: ['dot', 'laser'],
  },
  skorp: {
    id: 'skorp', name: 'Skorpion', slot: 'secondary', cls: 'pistol', desc: 'Light machine pistol. Fast and mobile, weak at range.',
    dmg: 18, hs: 1.4, rpm: 950, auto: true, mag: 20, reserve: 100, reload: 1.5,
    spread: 0.036, adsSpread: 0.014, recoil: 0.0040, recoilYaw: 0.0036, range: [7, 20], minMul: 0.45, pellets: 1,
    zoom: 1.2, scope: false, moveMul: 1.12, snd: { f: 3100, len: 0.07, thump: 0.4 }, builder: 'skorp', attach: ['dot', 'laser'],
  },
};

// not a real weapon: what zombies "hold" (kill feed name / damage source in Zombies mode)
WEAPONS.zclaw = { id: 'zclaw', name: 'Zombie', slot: 'none', cls: 'melee', desc: '', dmg: 50, hs: 1, rpm: 60, auto: false, mag: 1, reserve: 0, reload: 1, spread: 0, adsSpread: 0, recoil: 0, recoilYaw: 0, range: [1, 2], minMul: 1, pellets: 1, zoom: 1, scope: false, moveMul: 1, snd: { f: 1000, len: 0.05, thump: 0.2 }, builder: 'm1911', attach: [] };

// ---- more guns: tuned variants that reuse an existing model, recoloured (`tint`)
const variant = (base, id, name, desc, slot, patch, tint) => { const b = WEAPONS[base]; WEAPONS[id] = { ...b, id, name, desc, slot, ...patch, tint, asset: undefined }; };
variant('mp5', 'ump', 'UMP-45', 'Heavy .45 SMG. Slower than the 9mm guns but hits harder.', 'primary', { dmg: 31, rpm: 620, mag: 25, reserve: 150, reload: 2.1, recoil: 0.0050, range: [14, 36] }, 0x7a6a45);
variant('ak47', 'm16', 'M16A4', 'Accurate rifle with a long reach and a calm, climbing recoil.', 'primary', { builder: 'ar', dmg: 34, rpm: 470, mag: 30, reserve: 150, reload: 2.3, recoil: 0.0078, recoilYaw: 0.0034, range: [28, 64], moveMul: 0.99 }, 0x55663f);
variant('scar', 'fal', 'FAL', 'Hard-kicking battle rifle. Three shots to kill at any range.', 'primary', { dmg: 46, rpm: 380, mag: 20, reserve: 100, reload: 2.6, recoil: 0.0125, range: [30, 75] }, 0x8a6a40);
variant('lmg', 'rpk', 'RPK', 'Box-fed light machine gun. Quicker than the M249, fewer rounds.', 'primary', { dmg: 35, rpm: 600, mag: 75, reserve: 225, reload: 4.2, moveMul: 0.98 }, 0x66664a);
variant('dmr', 'sks', 'SKS', 'Semi-auto battle carbine with a long reach. Heavy punch, slow cycle.', 'primary', { dmg: 70, rpm: 240, mag: 10, reserve: 60, reload: 2.6, recoil: 0.02 }, 0x8a5a2a);
variant('skorp', 'mac10', 'MAC-10', 'Tiny machine pistol that empties a mag in two seconds. Deadly up close.', 'secondary', { dmg: 15, rpm: 1150, mag: 32, reserve: 128, reload: 1.7, range: [6, 17], spread: 0.04 }, 0x6a3030);
variant('magnum', 'revolver44', '.44 Revolver', 'Slower, harder hitting cousin of the Magnum.', 'secondary', { dmg: 62, rpm: 150, mag: 6, reserve: 36, reload: 2.8 }, 0x4a4a55);
// the Gun Game finale: one bullet, one shot, one kill - then a very slow reload
variant('deagle', 'goldgun', 'Golden Gun', 'One bullet. One shot. One kill. Then a very slow reload.', 'special', { builder: 'goldgun', dmg: 500, hs: 1, rpm: 40, auto: false, mag: 1, reserve: 999, reload: 6.5, spread: 0.012, adsSpread: 0.0004, recoil: 0.022, recoilYaw: 0.002, range: [250, 250], minMul: 1, moveMul: 0.96, snd: { f: 900, len: 0.24, thump: 1.4 }, attach: [] }, 0xffd24a);

// ---- melee: five knives. `dmg` is the damage of a slash (knife equipped); a quick-melee lunge (tap V) always does 100 and one-shots.
export const KNIVES = ['k_combat', 'k_karambit', 'k_balisong', 'k_machete', 'k_tomahawk'];
const knife = (id, name, desc, o) => { WEAPONS[id] = { id, name, slot: 'melee', cls: 'melee', desc, dmg: o.dmg, hs: 1, rpm: Math.round(60 / o.cd), auto: false, mag: 1, reserve: 0, reload: 1, spread: 0, adsSpread: 0, recoil: 0, recoilYaw: 0, range: [o.reach, o.reach], minMul: 1, pellets: 1, zoom: 1, scope: false, moveMul: o.speed, maxD: o.reach, cd: o.cd, snd: { f: 900, len: 0.06, thump: 0.05 }, builder: id, attach: [], opts: {} }; };
knife('k_combat', 'Combat Knife', 'Standard issue. Balanced reach and speed.', { dmg: 60, cd: 0.5, reach: 2.6, speed: 1.1 });
knife('k_karambit', 'Karambit', 'Curved claw blade. The fastest slash, short reach.', { dmg: 50, cd: 0.34, reach: 2.3, speed: 1.14 });
knife('k_balisong', 'Balisong', 'Butterfly knife. Quick flips, light and agile.', { dmg: 52, cd: 0.38, reach: 2.4, speed: 1.15 });
knife('k_machete', 'Machete', 'Long heavy blade. Great reach, slower swings.', { dmg: 78, cd: 0.72, reach: 3.1, speed: 1.06 });
knife('k_tomahawk', 'Tomahawk', 'Throwing axe. Hits hard, a bit slow.', { dmg: 72, cd: 0.62, reach: 2.8, speed: 1.08 });

export const PRIMARIES = ['vmp', 'super46', 'mp5', 'ump', 'p90', 'm4a1', 'm16', 'ak47', 'scar', 'fal', 'lmg', 'rpk', 'dmr', 'sks', 'kar98k', 'm680', 'aa12'];
export const SECONDARIES = ['g18', 'm1911', 'skorp', 'mac10', 'magnum', 'revolver44', 'deagle'];

// Stats shown on the loadout / gunsmith screens: a 0..100 style number per row plus a 0..1 bar. `good` says which way is better.
export function weaponStats(w) {
  const pel = Math.max(1, w.pellets || 1), cl = (x) => Math.max(0, Math.min(1, x));
  const acc = Math.round(100 * cl(1 - w.adsSpread / 0.03)), hip = Math.round(100 * cl(1 - w.spread / 0.12)), ctl = Math.round(100 * cl(1 - w.recoil / 0.032));
  return [
    { k: 'Damage', v: Math.round(w.dmg * pel * 10) / 10, text: pel > 1 ? `${Math.round(w.dmg * 10) / 10} x${pel}` : String(Math.round(w.dmg * 10) / 10), bar: cl((w.dmg * Math.min(pel, 4)) / 105), good: 1 },
    { k: 'Fire rate', v: Math.round(w.rpm), text: String(Math.round(w.rpm)), bar: cl(w.rpm / 1100), good: 1 },
    { k: 'Range', v: Math.round(w.range[1]), text: Math.round(w.range[1]) + ' m', bar: cl(w.range[1] / 120), good: 1 },
    { k: 'Accuracy', v: acc, text: String(acc), bar: acc / 100, good: 1 },
    { k: 'Hip fire', v: hip, text: String(hip), bar: hip / 100, good: 1 },
    { k: 'Control', v: ctl, text: String(ctl), bar: Math.max(0.05, ctl / 100), good: 1 },
    { k: 'Mobility', v: Math.round(w.moveMul * 100), text: Math.round(w.moveMul * 100) + '%', bar: cl((w.moveMul - 0.85) / 0.3), good: 1 },
    { k: 'Reload', v: Math.round(w.reload * 100) / 100, text: (Math.round(w.reload * 100) / 100).toFixed(2) + ' s', bar: cl(1 - (w.reload - 0.8) / 3), good: -1 },
    { k: 'Magazine', v: w.mag, text: String(w.mag), bar: cl(w.mag / 60), good: 1 },
  ];
}
export function weaponBars(w) {
  const o = {}; for (const r of weaponStats(w)) if (['Damage', 'Fire rate', 'Range', 'Control', 'Mobility'].includes(r.k)) o[r.k] = r.bar; return o;
}

// ---------------- attachments ----------------
// A loadout for one gun is a single integer (cheap to save and to send online) made of one small field per SLOT, COD-gunsmith style:
// you pick at most one attachment in each slot. The top bits hold the camo.
export const SLOTS = [
  { id: 'optic', name: 'Optic', shift: 0, bits: 3 },
  { id: 'muzzle', name: 'Muzzle', shift: 3, bits: 3 },
  { id: 'barrel', name: 'Barrel', shift: 6, bits: 2 },
  { id: 'under', name: 'Underbarrel', shift: 8, bits: 2 },
  { id: 'laser', name: 'Laser', shift: 10, bits: 2 },
  { id: 'mag', name: 'Magazine', shift: 12, bits: 2 },
  { id: 'stock', name: 'Stock', shift: 14, bits: 2 },
  { id: 'ammo', name: 'Ammunition', shift: 16, bits: 2 },
];
export const CAMO_SHIFT = 18, CAMO_BITS = 6;
const range = (o, a, b = a) => { o.range = [o.range[0] * a, o.range[1] * b]; };

// id -> { slot, v (value inside the slot), name, desc, stats, mod(o) }; mod edits a copy of the weapon
export const ATT = {
  // optics: aim better, pay for it in hip fire and handling (the bigger the scope, the bigger the price)
  dot: { slot: 'optic', v: 1, name: 'Red Dot Sight', desc: 'Clear sight picture. Light and quick.', stats: 'ADS spread -25%, hip spread +5%, speed -1%', mod: (o) => { o.adsSpread *= 0.75; o.spread *= 1.05; o.moveMul *= 0.99; } },
  holo: { slot: 'optic', v: 2, name: 'Holographic Sight', desc: 'Wide window with a ring reticle and a touch of zoom.', stats: 'ADS spread -28%, zoom +15%, hip +10%, speed -2%', mod: (o) => { o.adsSpread *= 0.72; o.zoom *= 1.15; o.spread *= 1.1; o.moveMul *= 0.98; } },
  hybrid: { slot: 'optic', v: 3, name: 'Hybrid 2x Scope', desc: 'Reflex sight on a 2x magnifier.', stats: 'ADS spread -30%, zoom x1.7, hip +15%, speed -3%', mod: (o) => { o.adsSpread *= 0.7; o.zoom *= 1.7; o.spread *= 1.15; o.moveMul *= 0.97; } },
  acog: { slot: 'optic', v: 4, name: 'ACOG 4x Scope', desc: 'Fixed 4x combat scope for long lanes.', stats: 'ADS spread -34%, zoom x2.4, hip +25%, speed -5%', mod: (o) => { o.adsSpread *= 0.66; o.zoom *= 2.4; o.spread *= 1.25; o.moveMul *= 0.95; } },
  // muzzle
  fh: { slot: 'muzzle', v: 1, name: 'Flash Hider', desc: 'Hides the muzzle flash and trims sideways kick.', stats: 'Recoil -12%, sideways kick -20%, flash -80%, range -6%', mod: (o) => { o.flash = 0.2; o.recoil *= 0.88; o.recoilYaw *= 0.8; range(o, 0.94); } },
  comp: { slot: 'muzzle', v: 2, name: 'Compensator', desc: 'Vents the gas up and out to keep the muzzle down. Loud.', stats: 'Recoil -22%, sideways kick -30%, louder, range -10%, ADS spread +10%', mod: (o) => { o.recoil *= 0.78; o.recoilYaw *= 0.7; o.loud = 1.25; range(o, 0.9); o.adsSpread *= 1.1; } },
  brake: { slot: 'muzzle', v: 3, name: 'Muzzle Brake', desc: 'Big side ports soak up the sideways jolt. Very loud, a little wild when aimed.', stats: 'Sideways kick -50%, recoil -15%, much louder, hip +15%, speed -2%', mod: (o) => { o.recoilYaw *= 0.5; o.recoil *= 0.85; o.loud = 1.4; o.spread *= 1.15; o.moveMul *= 0.98; } },
  supp1: { slot: 'muzzle', v: 4, name: 'Light Suppressor', desc: 'Compact can. Takes the edge off the report.', stats: 'Quiet, recoil -8%, damage -6%, range -12%', mod: (o) => { o.quiet = 0.5; o.flash = 0.4; o.recoil *= 0.92; o.dmg *= 0.94; range(o, 0.88); } },
  supp2: { slot: 'muzzle', v: 5, name: 'Tactical Suppressor', desc: 'Standard length suppressor. Muffles the shot and calms the climb.', stats: 'Very quiet, recoil -15%, damage -10%, range -20%, speed -2%', mod: (o) => { o.quiet = 0.3; o.flash = 0.25; o.recoil *= 0.85; o.dmg *= 0.9; range(o, 0.8); o.moveMul *= 0.98; } },
  supp3: { slot: 'muzzle', v: 6, name: 'Heavy Suppressor', desc: 'Long, fat can. Nearly silent and steady, but it robs punch and range.', stats: 'Near silent, recoil -22%, damage -14%, range -28%, speed -5%', mod: (o) => { o.quiet = 0.12; o.flash = 0.1; o.recoil *= 0.78; o.dmg *= 0.86; range(o, 0.72); o.moveMul *= 0.95; } },
  // barrels
  sbar: { slot: 'barrel', v: 1, name: 'Short Barrel', desc: 'Cut-down barrel: quick to swing, but short on reach and kicky.', stats: 'Speed +8%, hip spread -25%, range -28%, recoil +12%', mod: (o) => { o.moveMul *= 1.08; o.spread *= 0.75; range(o, 0.72); o.recoil *= 1.12; } },
  lbar: { slot: 'barrel', v: 2, name: 'Long Barrel', desc: 'More range and a tighter aimed shot. Heavy to swing and sloppy from the hip.', stats: 'Range +30%, ADS spread -20%, recoil -6%, speed -8%, hip +15%', mod: (o) => { range(o, 1.3); o.adsSpread *= 0.8; o.recoil *= 0.94; o.moveMul *= 0.92; o.spread *= 1.15; } },
  hbar: { slot: 'barrel', v: 3, name: 'Heavy Barrel', desc: 'Thick barrel. Soaks recoil and carries further, but drags and wanders from the hip.', stats: 'Recoil -25%, range +15%, speed -12%, hip +15%', mod: (o) => { o.recoil *= 0.75; range(o, 1.15); o.moveMul *= 0.88; o.spread *= 1.15; } },
  // underbarrel
  grip: { slot: 'under', v: 1, name: 'Vertical Grip', desc: 'Steadies the weapon. Less recoil, a bit more weight to carry.', stats: 'Recoil -28%, sideways kick -30%, hip +5%, speed -4%', mod: (o) => { o.recoil *= 0.72; o.recoilYaw *= 0.7; o.spread *= 1.05; o.moveMul *= 0.96; } },
  agrip: { slot: 'under', v: 2, name: 'Angled Grip', desc: 'Low, forward-angled grip for snappy hip fire. Not great when aimed.', stats: 'Hip spread -30%, recoil -8%, ADS spread +12%, speed +2%', mod: (o) => { o.spread *= 0.7; o.recoil *= 0.92; o.adsSpread *= 1.12; o.moveMul *= 1.02; } },
  sgrip: { slot: 'under', v: 3, name: 'Stubby Grip', desc: 'Short grip that kills sideways drift and keeps the aimed shot tight.', stats: 'Sideways kick -45%, recoil -15%, ADS spread -15%, hip +12%, speed -2%', mod: (o) => { o.recoilYaw *= 0.55; o.recoil *= 0.85; o.adsSpread *= 0.85; o.spread *= 1.12; o.moveMul *= 0.98; } },
  // lasers: hip fire only - they do nothing for (and slightly hurt) aimed shots
  laser: { slot: 'laser', v: 1, name: 'Laser Sight', desc: 'Projects a red dot where you point. Good hip fire, a little weight.', stats: 'Hip spread -35%, ADS spread +8%, speed -2%', mod: (o) => { o.spread *= 0.65; o.adsSpread *= 1.08; o.moveMul *= 0.98; o.laser = 1; } },
  tlaser: { slot: 'laser', v: 2, name: 'Tactical Laser', desc: 'Bright green beam. Tighter hip fire, but it is heavier.', stats: 'Hip spread -45%, ADS spread +12%, speed -4%', mod: (o) => { o.spread *= 0.55; o.adsSpread *= 1.12; o.moveMul *= 0.96; o.laser = 2; } },
  wlaser: { slot: 'laser', v: 3, name: 'Compact Laser', desc: 'Light blue pointer. Smaller bonus, no weight penalty, but it kicks a little.', stats: 'Hip spread -20%, recoil +5%', mod: (o) => { o.spread *= 0.8; o.recoil *= 1.05; o.laser = 3; } },
  // magazines
  xmag: { slot: 'mag', v: 1, name: 'Extended Mag', desc: 'A longer magazine. More shots before you reload, slower to swap.', stats: 'Mag +50%, reload +25%, speed -3%', mod: (o) => { o.mag = Math.round(o.mag * 1.5); o.reload *= 1.25; o.moveMul *= 0.97; } },
  fmag: { slot: 'mag', v: 2, name: 'Fast Mags', desc: 'Pull-tab magazines that drop and seat quickly, but hold fewer rounds.', stats: 'Reload -35%, mag -15%', mod: (o) => { o.reload *= 0.65; o.mag = Math.max(1, Math.round(o.mag * 0.85)); } },
  drum: { slot: 'mag', v: 3, name: 'Drum Mag', desc: 'Huge drum. Nearly double the ammo, slow to reload and heavy to carry.', stats: 'Mag x2, reload +50%, speed -8%, hip +10%', mod: (o) => { o.mag = Math.round(o.mag * 2); o.reload *= 1.5; o.moveMul *= 0.92; o.spread *= 1.1; } },
  // stocks
  lstock: { slot: 'stock', v: 1, name: 'Light Stock', desc: 'Stripped-down stock. Fast on your feet, kicks more and wobbles when aimed.', stats: 'Speed +8%, recoil +18%, ADS spread +10%', mod: (o) => { o.moveMul *= 1.08; o.recoil *= 1.18; o.adsSpread *= 1.1; } },
  hstock: { slot: 'stock', v: 2, name: 'Heavy Stock', desc: 'Weighted stock that soaks the kick. Slower to move and to swing.', stats: 'Recoil -22%, speed -7%, hip +12%', mod: (o) => { o.recoil *= 0.78; o.moveMul *= 0.93; o.spread *= 1.12; } },
  tstock: { slot: 'stock', v: 3, name: 'Tactical Stock', desc: 'Adjustable cheek-weld. Steadier hip aim and less drift, a touch more kick.', stats: 'Hip spread -25%, sideways kick -25%, recoil +10%, speed -3%', mod: (o) => { o.spread *= 0.75; o.recoilYaw *= 0.75; o.recoil *= 1.1; o.moveMul *= 0.97; } },
  // ammunition
  fmj: { slot: 'ammo', v: 1, name: 'FMJ Rounds', desc: 'Full metal jacket. Flies further but hits a little softer.', stats: 'Range +25%, damage -6%', mod: (o) => { range(o, 1.25); o.dmg *= 0.94; } },
  hp: { slot: 'ammo', v: 2, name: 'Hollow Point', desc: 'Expanding rounds hit harder up close and fall off quickly.', stats: 'Damage +15%, range -22%, recoil +8%', mod: (o) => { o.dmg *= 1.15; range(o, 0.78); o.recoil *= 1.08; } },
  ap: { slot: 'ammo', v: 3, name: 'Armour Piercing', desc: 'Hot-loaded rounds: more bite everywhere, more kick and a heavier load.', stats: 'Damage +8%, range +10%, recoil +14%, speed -2%', mod: (o) => { o.dmg *= 1.08; range(o, 1.1); o.recoil *= 1.14; o.moveMul *= 0.98; } },
};
for (const [k, a] of Object.entries(ATT)) a.id = k;
export const ATT_BY_SLOT = {}; for (const s of SLOTS) ATT_BY_SLOT[s.id] = Object.values(ATT).filter((a) => a.slot === s.id);

// what each class of gun can take (a few guns have exceptions below)
const ALL = { optic: ['dot', 'holo', 'hybrid', 'acog'], muzzle: ['fh', 'comp', 'brake', 'supp1', 'supp2', 'supp3'], barrel: ['sbar', 'lbar', 'hbar'], under: ['grip', 'agrip', 'sgrip'], laser: ['laser', 'tlaser', 'wlaser'], mag: ['xmag', 'fmag', 'drum'], stock: ['lstock', 'hstock', 'tstock'], ammo: ['fmj', 'hp', 'ap'] };
const CLASS_OPTS = {
  smg: { ...ALL, optic: ['dot', 'holo', 'hybrid'] },
  ar: { ...ALL },
  pistol: { optic: ['dot', 'holo'], muzzle: ['fh', 'comp', 'supp1', 'supp2'], barrel: ['lbar'], laser: ['laser', 'tlaser', 'wlaser'], mag: ['xmag', 'fmag'], ammo: ['fmj', 'hp', 'ap'] },
  shotgun: { optic: ['dot', 'holo'], muzzle: ['comp', 'brake'], barrel: ['sbar', 'lbar'], under: ['grip', 'agrip', 'sgrip'], laser: ['laser', 'tlaser', 'wlaser'], mag: ['xmag', 'drum'], stock: ['lstock', 'hstock', 'tstock'] },
  sniper: { optic: ['dot', 'holo', 'hybrid', 'acog'], muzzle: ['fh', 'comp', 'brake', 'supp1', 'supp2', 'supp3'], barrel: ['lbar', 'hbar'], under: ['grip', 'sgrip'], laser: ['laser', 'tlaser', 'wlaser'], mag: ['xmag', 'fmag'], stock: ['lstock', 'hstock', 'tstock'], ammo: ['fmj', 'hp', 'ap'] },
};
const OVERRIDE = {
  kar98k: { optic: [], under: [], mag: [], laser: ['laser', 'tlaser', 'wlaser'], barrel: ['lbar', 'hbar'] },   // the bolt-action already has its own scope
  m680: { mag: [], optic: ['dot', 'holo'] },
  rpk: { optic: ['dot', 'holo', 'hybrid', 'acog'], mag: ['xmag', 'fmag'], barrel: ['lbar', 'hbar'], under: ['grip', 'sgrip'] },
  lmg: { optic: ['dot', 'holo', 'hybrid', 'acog'], mag: ['xmag', 'fmag'], barrel: ['lbar', 'hbar'], under: ['grip', 'sgrip'] },
  p90: { under: [], barrel: ['sbar', 'lbar'], mag: ['xmag', 'fmag'] },
  skorp: { optic: ['dot', 'holo'], muzzle: ['fh', 'comp', 'supp1', 'supp2'], barrel: ['lbar'], mag: ['xmag', 'fmag'], laser: ['laser', 'tlaser', 'wlaser'], ammo: ['fmj', 'hp', 'ap'] },
  magnum: { mag: [], optic: ['dot', 'holo'], barrel: ['lbar'] },
  deagle: { optic: ['dot', 'holo'], barrel: ['lbar'] },
};
const CLS_KEY = { smg: 'smg', ar: 'ar', pistol: 'pistol', shotgun: 'shotgun', sniper: 'sniper' };
for (const w of Object.values(WEAPONS)) {
  if (w.cls === 'melee' || !w.slot || w.slot === 'none' || w.slot === 'special') { w.opts = {}; w.attach = []; continue; }
  const base = CLASS_OPTS[CLS_KEY[w.cls]] || CLASS_OPTS.ar, ov = OVERRIDE[w.id] || {};
  w.opts = {}; for (const s of SLOTS) { const l = (ov[s.id] || base[s.id] || []); if (l.length) w.opts[s.id] = l; }
  w.attach = Object.values(w.opts).flat();
}

// ---- mask helpers
const slotMax = (s) => (1 << s.bits) - 1;
export const getSlot = (mask, slotId) => { const s = SLOTS.find((x) => x.id === slotId); return s ? ((mask | 0) >> s.shift) & slotMax(s) : 0; };
export const attIn = (mask, slotId) => { const v = getSlot(mask, slotId); return v ? ATT_BY_SLOT[slotId].find((a) => a.v === v) || null : null; };
export function setSlot(mask, slotId, v) { const s = SLOTS.find((x) => x.id === slotId); if (!s) return mask | 0; return ((mask | 0) & ~(slotMax(s) << s.shift)) | ((v & slotMax(s)) << s.shift); }
export const hasAtt = (mask, id) => { const a = ATT[id]; return !!a && getSlot(mask, a.slot) === a.v; };
export const camoOf = (mask) => ((mask | 0) >> CAMO_SHIFT) & ((1 << CAMO_BITS) - 1);
export const setCamo = (mask, c) => ((mask | 0) & ~(((1 << CAMO_BITS) - 1) << CAMO_SHIFT)) | ((c & ((1 << CAMO_BITS) - 1)) << CAMO_SHIFT);
export const allowedMask = (w) => (w.attach || []).reduce((m, k) => setSlot(m, ATT[k].slot, ATT[k].v) | 0, 0);   // (only used as a "has any attachment" test)
// keep only attachments this gun can take (never trust a mask that came over the wire)
export function cleanMask(w, mask) {
  mask |= 0; let out = 0;
  for (const s of SLOTS) {
    const v = getSlot(mask, s.id); if (!v) continue;
    const a = ATT_BY_SLOT[s.id].find((x) => x.v === v);
    if (a && ((w && w.opts && w.opts[s.id]) || []).includes(a.id)) out = setSlot(out, s.id, v);
  }
  const c = camoOf(mask); if (c > 0 && c < CAMOS.length) out = setCamo(out, c);
  return out;
}
// the old (pre-V0.15) save format was one bit per attachment: 1 dot, 2 grip, 4 laser, 8 suppressor, 16 xmag, 32 comp, 64 long barrel
export function migrateOldMask(old) {
  old |= 0; let m = 0;
  if (old & 1) m = setSlot(m, 'optic', 1);
  if (old & 2) m = setSlot(m, 'under', 1);
  if (old & 4) m = setSlot(m, 'laser', 1);
  if (old & 8) m = setSlot(m, 'muzzle', 5);
  else if (old & 32) m = setSlot(m, 'muzzle', 2);
  if (old & 16) m = setSlot(m, 'mag', 1);
  if (old & 64) m = setSlot(m, 'barrel', 2);
  return m;
}
export const attList = (mask) => SLOTS.map((s) => attIn(mask, s.id)).filter(Boolean);

// returns a copy of the weapon with the attachment stat changes applied (the original WEAPONS entry is never modified)
export function withAtt(w, mask) {
  mask = cleanMask(w, mask);
  const o = { ...w, range: w.range ? [w.range[0], w.range[1]] : w.range, attMask: mask };
  o.quiet = 1; o.flash = 1; o.loud = 1; o.laser = 0;
  for (const a of attList(mask)) a.mod(o);
  o.suppressed = o.quiet < 1;
  return o;
}

// ---------------- camos ----------------
// id 0 = factory finish. `req` says how a camo is earned: free, player level, kills or headshots with that particular gun.
export const CAMOS = [
  { id: 0, name: 'Factory', req: { t: 'free' } },
  { id: 1, name: 'Woodland', req: { t: 'level', n: 2 } },
  { id: 2, name: 'Desert', req: { t: 'level', n: 4 } },
  { id: 3, name: 'Arctic', req: { t: 'level', n: 6 } },
  { id: 4, name: 'Urban Digital', req: { t: 'level', n: 9 } },
  { id: 5, name: 'Tiger', req: { t: 'kills', n: 20 } },
  { id: 6, name: 'Blue Tiger', req: { t: 'kills', n: 50 } },
  { id: 7, name: 'Crimson Digital', req: { t: 'kills', n: 100 } },
  { id: 8, name: 'Gold', req: { t: 'heads', n: 40 } },
  { id: 9, name: 'Diamond', req: { t: 'heads', n: 100 } },
  { id: 10, name: 'Obsidian', req: { t: 'level', n: 30 } },
  { id: 11, name: 'Galaxy', req: { t: 'kills', n: 250 } },
  { id: 12, name: 'Carbon Fibre', req: { t: 'level', n: 12 } },
  { id: 13, name: 'Neon Grid', req: { t: 'kills', n: 150 } },
  { id: 14, name: 'Toxic', req: { t: 'heads', n: 60 } },
  { id: 15, name: 'Magma', req: { t: 'level', n: 20 } },
  { id: 16, name: 'Holo Prism', req: { t: 'heads', n: 200 } },
  { id: 17, name: 'Dragon Scale', req: { t: 'kills', n: 180 } },
];
export const camoReqText = (c) => ({ free: 'Unlocked', level: `Reach level ${c.req.n}`, kills: `${c.req.n} kills with this gun`, heads: `${c.req.n} headshots with this gun` })[c.req.t];
