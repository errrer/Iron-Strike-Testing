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
    asset: { id: 'vmp', grip: 'handle', fore: 'grip', foreOffset: [0, -0.02, 0], gripOffset: [0, 0.0, 0], mount: [0, 0.066, -0.04], under: [0, -0.053, -0.1], side: [0.022, -0.02, -0.2] },
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

export const PRIMARIES = ['vmp', 'super46', 'mp5', 'p90', 'm4a1', 'ak47', 'scar', 'lmg', 'dmr', 'kar98k', 'm680', 'aa12'];
export const SECONDARIES = ['g18', 'm1911', 'skorp', 'magnum', 'deagle'];

// Stats used by the loadout screen bars (0..1)
export function weaponBars(w) {
  return {
    Damage: Math.min(1, (w.dmg * Math.min(w.pellets, 4)) / 105),
    'Fire rate': Math.min(1, w.rpm / 1100),
    Range: Math.min(1, w.range[1] / 120),
    Control: Math.max(0.1, 1 - w.recoil / 0.032),
    Mobility: Math.min(1, (w.moveMul - 0.85) / 0.3),
  };
}

// ---------------- attachments ----------------
// Equipped attachments are stored as a bit mask (1 = red dot, 2 = vertical grip, 4 = laser) so they are cheap to send online.
export const ATT = {
  dot: { bit: 1, name: 'Red Dot Sight', desc: 'Clear sight picture, aim down the dot. Tighter aimed fire.', stats: 'ADS accuracy +20%' },
  grip: { bit: 2, name: 'Vertical Grip', desc: 'Steadies the weapon. Less recoil and tighter hip fire.', stats: 'Recoil -20%, hip spread -10%' },
  laser: { bit: 4, name: 'Laser Sight', desc: 'Projects a red dot where you point. Much tighter hip fire.', stats: 'Hip spread -30%, ADS +5%' },
};
export const ATT_DOT = 1, ATT_GRIP = 2, ATT_LASER = 4;
export const allowedMask = (w) => (w.attach || []).reduce((m, k) => m | ATT[k].bit, 0);
export const cleanMask = (w, mask) => (mask | 0) & allowedMask(w);

// returns a copy of the weapon with the attachment stat changes applied (the original WEAPONS entry is never modified)
export function withAtt(w, mask) {
  mask = cleanMask(w, mask);
  if (!mask) return { ...w, attMask: 0 };
  const o = { ...w, attMask: mask };
  if (mask & ATT_DOT) o.adsSpread *= 0.8;
  if (mask & ATT_GRIP) { o.recoil *= 0.8; o.recoilYaw *= 0.8; o.spread *= 0.9; }
  if (mask & ATT_LASER) { o.spread *= 0.7; o.adsSpread *= 0.95; }
  return o;
}
