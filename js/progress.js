// Player progression: XP, levels, ranks and weapon unlocks, saved in localStorage (per browser).
const KEY = 'ironstrike.prog';
export const MAX_LEVEL = 30;
export const XP_REWARD = { kill: 100, headshot: 50, streak: 25, capture: 75, hold: 5, confirm: 60, deny: 40, plant: 150, defuse: 200, win: 300, played: 100 };
export const RANKS = ['Recruit', 'Private', 'Corporal', 'Sergeant', 'Staff Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel', 'General'];
// level required for each weapon
export const UNLOCK = { vmp: 1, m4a1: 1, g18: 1, m1911: 3, mp5: 2, ak47: 5, skorp: 6, scar: 7, m680: 8, p90: 9, magnum: 11, lmg: 12, kar98k: 14, aa12: 16, deagle: 17, dmr: 19 };

export const need = (level) => 300 + level * 100;                      // xp from this level to the next
export const rankName = (level) => RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))] + (level >= MAX_LEVEL ? ' (MAX)' : '');
export function levelOf(xp) {
  let l = 1, left = xp;
  while (l < MAX_LEVEL && left >= need(l)) { left -= need(l); l++; }
  return { level: l, into: l >= MAX_LEVEL ? need(l) : left, next: need(l) };
}

export class Progress {
  constructor() {
    this.d = { xp: 0, kills: 0, deaths: 0, heads: 0, matches: 0, wins: 0 };
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') for (const k of Object.keys(this.d)) if (isFinite(o[k])) this.d[k] = Math.max(0, +o[k]); } catch (e) { /* no storage */ }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ } }
  get info() { return levelOf(this.d.xp); }
  // returns the new level if this XP gained one, else 0
  add(n) {
    const before = this.info.level; this.d.xp += Math.round(n);
    const after = this.info.level; this.save();
    return after > before ? after : 0;
  }
  stat(k, n = 1) { this.d[k] = (this.d[k] || 0) + n; this.save(); }
  unlocked(weaponId, all) { return !!all || this.info.level >= (UNLOCK[weaponId] || 1); }
  reset() { for (const k of Object.keys(this.d)) this.d[k] = 0; this.save(); }
}
