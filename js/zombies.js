// Zombies mode (round based survival, co-op up to 4). Black Ops 3 style rules:
//  - rounds of zombies climb through barricaded windows; hit = 10 points, kill = 60 (head 100)
//  - spend points on wall guns, doors (open new rooms), perk machines, the Mystery Box and Pack-a-Punch
//  - power-ups drop from zombies (Max Ammo, Insta-Kill, Double Points, Nuke, Carpenter)
//  - zombies hit for 50: two hits and you are DOWN; a teammate holds F to revive you before you bleed out
//  - the match ends when every player is down or dead
// The host (or the offline player) runs everything; clients mirror the state from 'zs' snapshots and 'z*' events.
import * as THREE from 'three';
import { WEAPONS, withAtt } from './weapons.js?v=0.18.4';
import { buildWindow, setBoards, buildDoor, buildBuy, buildMachine, buildBox, buildPap, gunDisplay, buildPowerup, label, setLabel, POWERUPS } from './zmworld.js?v=0.18.4';

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const PERKS = {
  jug: { bit: 1, name: 'Juggernog', cost: 2500, color: 0xd23a3a, blurb: 'Zombie hits do less damage' },
  qr: { bit: 2, name: 'Quick Revive', cost: 500, coop: 1500, color: 0x3a8bff, blurb: 'Fast revives. Solo: self-revive' },
  sc: { bit: 4, name: 'Speed Cola', cost: 3000, color: 0x3ad26a, blurb: 'Reload twice as fast' },
  dt: { bit: 8, name: 'Double Tap', cost: 2000, color: 0xe8901e, blurb: 'Fire 40% faster' },
  st: { bit: 16, name: 'Stamin-Up', cost: 2000, color: 0xe8d020, blurb: 'Move faster' },
};
export const PERK_KEYS = Object.keys(PERKS);
export const START_PTS = 500, BOX_COST = 950, PAP_COST = 5000, BLEED = 45, HIT_PTS = 10, KILL_PTS = 60, HEAD_PTS = 100;
export const START_GUN = 'm1911';
const BOX_POOL = ['vmp', 'vmp', 'super46', 'super46', 'mp5', 'p90', 'm680', 'm680', 'aa12', 'm4a1', 'm4a1', 'ak47', 'ak47', 'scar', 'lmg', 'dmr', 'kar98k', 'g18', 'skorp', 'magnum', 'magnum', 'deagle', 'm1911'];
const POWER_POOL = ['max', 'max', 'max', 'insta', 'insta', 'dbl', 'dbl', 'nuke', 'carp', 'carp'];

// a purchasable weapon: normal, or Pack-a-Punched (double damage, bigger mags)
export function zmWeapon(id, pap = false) {
  const w = withAtt(WEAPONS[id], 0);
  if (!pap) return w;
  return { ...w, name: `PaP ${w.name}`, dmg: w.dmg * 2, mag: Math.ceil(w.mag * 1.5), reserve: Math.ceil(w.reserve * 1.5), pap: true };
}
export const zHp = (r) => { const hp9 = 100 + 8 * 70; return r < 10 ? 100 + (r - 1) * 70 : Math.floor(hp9 * Math.pow(1.1, r - 9)); };
export const zCount = (r, n = 1) => Math.round((6 + (r - 1) * 2.6 + (r - 1) * (r - 1) * 0.1) * (1 + 0.5 * (n - 1)));
export function zSpeed(r) {
  const x = Math.random();
  if (r <= 2) return 1.4 + Math.random() * 0.3;
  if (r <= 4) return x < 0.6 ? 1.6 : 3.0;
  if (r <= 7) return x < 0.3 ? 1.6 : x < 0.8 ? 3.1 : 4.6;
  return x < 0.1 ? 1.7 : x < 0.5 ? 3.2 : 4.9;
}
const slab = (w) => w.axis === 'x' ? { x0: w.x - 1, x1: w.x + 1, y0: 0, y1: 2.7, z0: w.z - 0.25, z1: w.z + 0.25 } : { x0: w.x - 0.25, x1: w.x + 0.25, y0: 0, y1: 2.7, z0: w.z - 1, z1: w.z + 1 };
const inBox = (b, x, z, m) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m;

export class Zombies {
  constructor(game) {
    const g = this.g = game, M = this.M = g.map.zm;
    this.group = new THREE.Group(); g.scene.add(this.group);
    this.round = 0; this.phase = 'pre'; this.phaseT = 6; this.left = 0; this.toSpawn = 0; this.spawnT = 2; this.cap = 24;
    this.zones = Array.from({ length: M.nz || 3 }, (_, i) => i === 0); this.up = M.upper || null; this.dogRound = false; this.crawlers = 0; this.insta = 0; this.dbl = 0; this.pus = []; this.nextPu = 1; this.drops = 0;
    this.nextZid = 2000; this.t = 0; this.stT = 0; this.fieldT = 0; this.fields = []; this.blocked = new Set(); this.survT = 0; this.grT = 2;
    this.prompt = ''; this.shownRound = 0; this.clientPts = new Map(); this.rollT = 0; this.nukeKill = false;
    const copyBox = (b) => ({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1 });
    this.windows = M.windows.map((w) => { const o = { ...w, boards: 6, box: Object.assign(slab(w), { noRay: true }), wall: Object.assign(slab(w), { noZ: true, noRay: true }), blocking: false, view: buildWindow(w), tearing: 0 }; this.group.add(o.view.group); return o; });
    this.doors = M.doors.map((d) => {
      const o = { ...d, open: false, blocking: false, box: { x0: d.x - d.w / 2, x1: d.x + d.w / 2, y0: 0, y1: d.h, z0: d.z - d.d / 2, z1: d.z + d.d / 2 }, view: buildDoor(d) };
      this.group.add(o.view.group); return o;
    });
    this.buys = M.buys.map((b) => { const o = { ...b, view: buildBuy(b) }; this.group.add(o.view.group); return o; });
    this.perks = M.perks.map((m) => { const o = { ...m, perk: PERKS[m.id], view: buildMachine(m, PERKS[m.id], PERKS[m.id].cost) }; this.group.add(o.view.group); return o; });
    this.box = { ...M.box, st: 0, t: 0, wid: 'm1911', owner: -1, view: buildBox(M.box), shown: '' }; this.group.add(this.box.view.group);
    this.pap = { ...M.pap, st: 0, t: 0, owner: -1, slot: 0, wid: '', view: buildPap(M.pap), shown: '' }; this.group.add(this.pap.view.group);
    this.items = [
      ...this.doors.map((o) => ({ kind: 'door', o, x: o.x, z: o.z, r: 2.3 })),
      ...this.buys.map((o) => ({ kind: 'buy', o, x: o.x + Math.sin(o.face) * 0.9, z: o.z + Math.cos(o.face) * 0.9, r: 1.5, y: o.y || 0 })),
      ...this.perks.map((o) => ({ kind: 'perk', o, x: o.x, z: o.z, r: 2.1 })),
      { kind: 'box', o: this.box, x: this.box.x, z: this.box.z, r: 2.3 },
      { kind: 'pap', o: this.pap, x: this.pap.x, z: this.pap.z, r: 2.3 },
    ];
    for (const a of g.actors) if (!a.zombie) this.initPlayer(a);
    for (const w of this.windows) g.col.add(w.wall);      // players can never climb out through a window, bullets still pass
    this.refreshViews(true);
    this.rebuildBlocked();
  }

  dispose() { this.g.scene.remove(this.group); }
  get auth() { return !this.g.isClient; }
  players() { return this.g.actors.filter((a) => !a.zombie && !a.dummy); }
  zombies() { return this.g.actors.filter((a) => a.zombie && a.alive); }
  solo() { return this.players().length <= 1; }
  qrCost() { return this.solo() ? PERKS.qr.cost : PERKS.qr.coop; }
  perkCost(k) { return k === 'qr' ? this.qrCost() : PERKS[k].cost; }

  initPlayer(a) {
    a.pts = START_PTS; a.perks = 0; a.down = false; a.downT = 0; a.revP = 0; a.useHeld = false; a.usePrev = false; a.boardT = 0; a.qrUses = 3; a.selfT = 0; a.zHitT = -1; a.revBy = null;
  }

  // ------------------------------------------------------------------ events (host -> everybody, host also applies locally)
  emit(e) { const g = this.g; if (g.net && g.isHost) g.net.ev(e); this.onEvent(e); }
  toast(a, text) { const g = this.g; if (a.isPlayer) g.hud.center(text, 0.9); else if (g.net && g.isHost) g.net.evTo(a.id, ['zn', text]); }

  onEvent(e) {
    const g = this.g;
    switch (e[0]) {
      case 'zs': this.applyState(e[1]); break;
      case 'zn': g.hud.center(String(e[1]), 1.4); break;
      case 'zw': this.giveWeapon(g.byId(e[1]), e[2], e[3], !!e[4]); if (g.player && e[1] === g.player.id) g.sound.cash && g.sound.cash(); break;
      case 'za': { const a = g.byId(e[1]); if (a) this.refill(a, e[2]); if (a && a.isPlayer) g.sound.reload(1); break; }
      case 'zmx': for (const a of this.players()) this.refill(a, -1); g.hud.center('MAX AMMO', 1.4); g.sound.cash && g.sound.cash(); break;
      case 'zp': { const a = g.byId(e[1]); if (a) a.perks |= PERKS[e[2]].bit; if (a && a.isPlayer) { g.hud.center(`${PERKS[e[2]].name.toUpperCase()}!`, 1.4); g.sound.cash && g.sound.cash(); } break; }
      case 'zdn': {
        const a = g.byId(e[1]); if (!a) break;
        a.down = !!e[2];
        if (a.down) { a.crouch = true; g.hud.center(a.isPlayer ? 'YOU ARE DOWN' : `${a.name} IS DOWN`, 1.6); if (a.isPlayer) this.toPistol(a); }
        else if (a.isPlayer) g.hud.center('REVIVED', 1.2);
        break;
      }
      case 'zr': g.sound.beep && g.sound.beep(true); break;
      case 'zpg': g.hud.center(POWERUPS[e[1]].name, 1.6); g.sound.cash && g.sound.cash(); break;
      case 'zz': g.sound.beep && g.sound.beep(false); break;
      default: break;
    }
  }

  // switch a downed player to a pistol (the only thing you can shoot while down)
  toPistol(a) {
    const i = a.weapons.findIndex((w) => w.cls === 'pistol');
    if (i >= 0 && i !== a.cur) { a.cur = i; a.weapon = a.weapons[i]; a.reloading = false; if (a.isPlayer) this.g.setPlayerVm(); this.g.setActorGun(a); }
  }

  giveWeapon(a, slot, wid, pap) {
    if (!a || !WEAPONS[wid]) return;
    const w = zmWeapon(wid, pap), g = this.g;
    a.weapons[slot] = w; a.ammo[slot] = { mag: w.mag, res: w.reserve };
    a.cur = slot; a.weapon = w; a.reloading = false; a.reloadT = 0; a.switchT = 0.45; a.fireCd = 0.2;
    if (a.mesh) g.setActorGun(a);
    if (a.isPlayer) g.setPlayerVm();
  }
  refill(a, slot) {
    for (let i = 0; i < a.weapons.length; i++) if (slot < 0 || slot === i) { const w = a.weapons[i]; a.ammo[i] = { mag: w.mag, res: w.reserve }; }
    if (a.reloading && !a.brain) { a.reloading = false; }
  }

  // ------------------------------------------------------------------ input (F)
  localUse(on) {
    const g = this.g, p = g.player; if (!p) return;
    if (g.isClient) g.net.sendUse(on); else this.setUse(p, on);
  }
  setUse(a, on) { a.useHeld = !!on; }

  // ------------------------------------------------------------------ frame
  update(dt) {
    const g = this.g;
    this.t += dt;
    this.animate(dt);
    this.updatePrompt();
    this.ambient(dt);
    if (this.auth) { if (!g.ended) this.hostUpdate(dt); }
  }

  ambient(dt) {
    const g = this.g, p = g.player; if (!p) return;
    this.grT -= dt;
    if (this.grT > 0) return;
    this.grT = rand(0.8, 1.8);
    let best = null, bd = 18;
    for (const z of g.actors) if (z.zombie && z.alive) { const d = Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z); if (d < bd) { bd = d; best = z; } }
    if (best && Math.random() < 0.7 && g.sound.groan) { const dx = best.pos.x - p.pos.x, dz = best.pos.z - p.pos.z; g.sound.groan(0.5 / (1 + bd / 5), g.pan(dx, dz, bd), best.id); }
  }

  // ------------------------------------------------------------------ host: rules
  hostUpdate(dt) {
    const g = this.g;
    if (g.matchT < 0) return;
    this.survT += dt;
    this.stT += dt; this.fieldT -= dt;
    if (this.insta > 0) this.insta = Math.max(0, this.insta - dt);
    if (this.dbl > 0) this.dbl = Math.max(0, this.dbl - dt);
    const ps = this.players();
    this.runRound(dt, ps);
    if (this.fieldT <= 0) this.updateFields(ps);
    for (const z of g.actors) if (z.zombie && z.alive) this.aiZombie(z, dt);
    for (const a of ps) this.processPlayer(a, dt, ps);
    this.updatePowerups(dt, ps);
    this.updateMachines(dt);
    if (this.stT >= 0.25) { this.stT = 0; this.sendState(ps); }
    // over: nobody left standing
    if (ps.length && ps.every((a) => !a.alive || a.down) && !ps.some((a) => a.down && a.selfT > 0)) { this.sendState(ps); g.teamScore[0] = Math.max(1, this.round); g.endMatch(); }
  }

  runRound(dt, ps) {
    const g = this.g;
    if (this.phase === 'pre' || this.phase === 'break') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startRound(ps);
      return;
    }
    const alive = this.zombies().length;
    this.left = this.toSpawn + alive;
    this.spawnT -= dt;
    if (this.toSpawn > 0 && alive < Math.min(24, this.cap) && this.spawnT <= 0) {
      if (this.spawnZombie()) { this.toSpawn--; this.spawnT = Math.max(0.45, 2.4 - this.round * 0.12) / (1 + 0.25 * (ps.length - 1)) * (this.dogRound ? 0.5 : 1); }
      else this.spawnT = 0.5;
    }
    if (this.toSpawn <= 0 && alive === 0) { this.phase = 'break'; this.phaseT = 8; this.left = 0; this.emit(['zz']); }
  }

  startRound(ps) {
    const g = this.g;
    this.round++; this.phase = 'active'; this.drops = 0;
    this.dogRound = this.round >= 5 && this.round % 4 === 1;                    // every fourth round from 5: a rush of fast crawlers
    this.toSpawn = zCount(this.round, ps.length || 1);
    if (this.dogRound) this.toSpawn = Math.max(8, Math.round(this.toSpawn * 0.6));
    this.left = this.toSpawn; this.spawnT = 2.2;
    if (this.dogRound) this.emit(['zn', 'CRAWLER RUSH']);
    this.cap = clamp(8 + this.round * 2, 8, 24) + (ps.length - 1) * 4;
    // dead players come back at the start of the next round with a fresh start
    for (const a of ps) if (!a.alive) this.respawn(a);
    this.emit(['zr', this.round]);
    this.sendState(ps);
  }

  respawn(a) {
    const g = this.g;
    g.spawn(a);
    this.initPlayer(a);
    this.giveWeapon(a, 0, START_GUN, false); this.giveWeapon(a, 1, START_GUN, false); a.cur = 0; a.weapon = a.weapons[0];
    if (g.net && g.isHost) { g.net.ev(['zw', a.id, 0, START_GUN, 0]); g.net.ev(['zw', a.id, 1, START_GUN, 0]); }
    if (a.isPlayer) g.setPlayerVm();
  }

  // ---- zombies ----
  pickWindow() {
    const ps = this.players().filter((a) => a.alive && !a.down);
    if (!ps.length) return null;
    const open = this.windows.filter((w) => this.zones[w.zone]);
    if (!open.length) return null;
    const scored = open.map((w) => { let d = 1e9; for (const p of ps) d = Math.min(d, Math.hypot(w.x - p.pos.x, w.z - p.pos.z)); return { w, d }; }).sort((a, b) => a.d - b.d);
    // never right in a player's face (those are skipped while another window is available)
    const far = scored.filter((s) => s.d > 6), pool = (far.length ? far : scored).slice(0, 4);
    return pool[Math.floor(Math.random() * pool.length)].w;
  }

  spawnZombie() {
    const g = this.g, w = this.pickWindow(); if (!w) return false;
    const x = w.outx + (w.axis === 'x' ? rand(-0.6, 0.6) : 0), z = w.outz + (w.axis === 'z' ? rand(-0.6, 0.6) : 0);
    for (const e of g.actors) if (e.zombie && e.alive && Math.hypot(e.pos.x - x, e.pos.z - z) < 0.7) return false;
    const id = this.nextZid++, crawl = this.dogRound, spd = crawl ? 5.6 + Math.min(1.6, this.round * 0.08) : zSpeed(this.round);
    const a = g.makeActor(id, 'Zombie', 1, false, START_GUN, START_GUN);
    a.zombie = true; a.alive = false; a.remote = false; a.crawl = crawl;
    a.mesh = g.makeZombieMesh(); g.scene.add(a.mesh.root); g.actors.push(a);
    if (crawl) a.mesh.root.scale.setScalar(0.78);
    const hp = crawl ? Math.floor(zHp(this.round) * 0.45) : zHp(this.round);
    if (g.net && g.isHost) g.net.ev(['add', { id, name: 'Zombie', team: 1, prim: START_GUN, sec: START_GUN, zombie: 1, crawl: crawl ? 1 : 0 }]);
    g.placeActor(a, x, z, Math.atan2(-(w.x - x), -(w.z - z)), true, 0);
    a.hp = a.maxHp = hp; a.protT = 0; a.hw = crawl ? 0.3 : 0.33; a.h = crawl ? 1.35 : 1.8;
    a.zs = { win: w.boards > 0 ? w : null, tear: 0, rise: 0.9, atk: 0.6, spd, stuck: 0, lx: x, lz: z, tgt: null, wob: Math.random() * 6 };
    return true;
  }

  updateFields(ps) {
    this.fieldT = 0.45; this.fields = [];
    const nav = this.g.nav; if (!nav) return;
    let stairF = null;
    for (const p of ps) if (p.alive && !p.down) {
      const up = this.lvl(p) === 1;
      if (up && !stairF) stairF = nav.field(this.up.bot.x, this.up.bot.z, this.blocked);
      this.fields.push({ a: p, up, d: up ? stairF : nav.field(p.pos.x, p.pos.z, this.blocked) });
    }
  }

  // 0 = ground, 1 = on the raised level (or the top half of its stairs)
  lvl(a) { return this.up && a.pos.y > 1.7 ? 1 : 0; }

  rebuildBlocked() {
    this.blocked = new Set();
    const nav = this.g.nav; if (!nav) return;
    const boxes = [...this.windows.filter((w) => w.boards > 0).map((w) => w.box), ...this.doors.filter((d) => !d.open).map((d) => d.box)];
    for (let i = 0; i < nav.nodes.length; i++) { const n = nav.nodes[i]; for (const b of boxes) if (inBox(b, n.x, n.z, 0.7)) { this.blocked.add(i); break; } }
    this.fieldT = 0;
  }

  aiZombie(z, dt) {
    const g = this.g, zs = z.zs; if (!zs) return;
    if (zs.rise > 0) { zs.rise -= dt; z.vel.set(0, 0, 0); return; }
    z.lastShot = g.time;
    const turn = (wx, wz, k = 9) => { let d = Math.atan2(-wx, -wz) - z.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; z.yaw += d * Math.min(1, k * dt); };
    const win = zs.win;
    if (win) {
      if (win.boards <= 0) zs.win = null;
      else {
        const dx = win.outx - z.pos.x, dz = win.outz - z.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.45) { g.moveActor(z, dx / d, dz / d, Math.min(zs.spd, 2.2), dt, false, false); turn(dx, dz); }
        else {
          g.moveActor(z, 0, 0, 0, dt, false, false); turn(win.x - z.pos.x, win.z - z.pos.z);
          zs.tear += dt;
          if (zs.tear > 1.25) { zs.tear = 0; win.boards = Math.max(0, win.boards - 1); this.dirty = true; }
        }
        return;
      }
    }
    // pick the nearest living, standing player by walking distance (players on the raised level count as a few metres further)
    const nav = g.nav, node = nav.nodeAt(z.pos.x, z.pos.z), zl = this.lvl(z), up = this.up;
    const onSt = !!up && z.pos.x < up.bot.x - 1.2 && z.pos.x > up.x1 && Math.abs(z.pos.z - up.bot.z) < 1.8;
    let best = null, bf = null, bd = Infinity;
    for (const f of this.fields) {
      if (zl === 1 && !f.up) continue;
      let d = f.d[node]; if (f.up) d += 6;
      if (zl === 1) d = Math.hypot(f.a.pos.x - z.pos.x, f.a.pos.z - z.pos.z);
      if (d < bd) { bd = d; best = f.a; bf = f.d; }
    }
    if (!best && zl === 1) {                                   // nobody up here any more: walk back down
      const dx = up.top.x - z.pos.x, dz = up.top.z - z.pos.z;
      const inside = z.pos.x > up.x0 && z.pos.x < up.x1 && z.pos.z > up.z0 && z.pos.z < up.z1;
      const tx = inside && Math.hypot(dx, dz) > 1.2 ? up.top : up.bot;
      const ex = tx.x - z.pos.x, ez = tx.z - z.pos.z, el = Math.hypot(ex, ez) || 1;
      g.moveActor(z, ex / el, ez / el, Math.min(zs.spd, 2.4), dt, false, false); turn(ex, ez); return;
    }
    if (!best) { g.moveActor(z, 0, 0, 0, dt, false, false); return; }
    const dx = best.pos.x - z.pos.x, dz = best.pos.z - z.pos.z, dist = Math.hypot(dx, dz);
    const bl = this.lvl(best);
    let wx, wz;
    if (bl === 1 && zl === 0 && (onSt || Math.hypot(up.bot.x - z.pos.x, up.bot.z - z.pos.z) < 3.6)) {   // at the foot of the stairs: line up, then climb
      const started = z.pos.x < up.bot.x - 1.3 && Math.abs(z.pos.z - up.bot.z) < 1.1;
      const align = !started && Math.abs(z.pos.z - up.bot.z) > 0.6, tx = align ? up.bot.x : up.top.x, tz = align ? up.bot.z : up.top.z;
      const ex = tx - z.pos.x, ez = (started ? up.bot.z : tz) - z.pos.z, el = Math.hypot(ex, ez) || 1; wx = ex / el; wz = ez / el;
    } else if (bl === zl && dist < 3.5 && g.los(z, best)) { wx = dx / dist; wz = dz / dist; }
    else if (bl === 1 && zl === 1) { wx = dx / (dist || 1); wz = dz / (dist || 1); }
    else {
      let bn = -1, bv = bf[node];
      for (const m of nav.adj[node]) if (bf[m] < bv) { bv = bf[m]; bn = m; }
      if (bn < 0) { wx = dx / (dist || 1); wz = dz / (dist || 1); }
      else { const n = nav.nodes[bn]; const ex = n.x - z.pos.x, ez = n.z - z.pos.z, el = Math.hypot(ex, ez) || 1; wx = ex / el; wz = ez / el; }
    }
    // keep a little space from the other zombies
    for (const o of onSt ? [] : g.actors) {
      if (o === z || !o.zombie || !o.alive) continue;
      const ox = z.pos.x - o.pos.x, oz = z.pos.z - o.pos.z, od = Math.hypot(ox, oz);
      if (od < 0.75 && od > 0.001) { wx += (ox / od) * (0.75 - od) * 1.4; wz += (oz / od) * (0.75 - od) * 1.4; }
    }
    const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
    const near = dist < 1.3 && Math.abs(best.pos.y - z.pos.y) < 1.4;
    g.moveActor(z, near ? 0 : wx, near ? 0 : wz, zs.spd * (zs.stag > 0 ? 0.35 : 1), dt, false, false);
    if (zs.stag > 0) zs.stag -= dt;
    turn(near ? dx : wx, near ? dz : wz);
    zs.atk -= dt;
    if (near && zs.atk <= 0) {
      zs.atk = 1.0;
      g.damage(best, z, z.crawl ? 35 : 50, WEAPONS.zclaw, false);
    }
    // stuck for a long time: put it back at a window
    zs.stuck += dt;
    if (zs.stuck > 1) {
      const moved = Math.hypot(z.pos.x - zs.lx, z.pos.z - zs.lz);
      zs.lx = z.pos.x; zs.lz = z.pos.z; zs.stuck = 0;
      zs.idle = moved < 0.25 && !near ? (zs.idle || 0) + 1 : 0;
      if (zs.idle > 8) { const w = this.pickWindow(); if (w) { z.pos.set(w.outx, 0, w.outz); z.vel.set(0, 0, 0); zs.win = w.boards > 0 ? w : null; zs.idle = 0; } }
    }
  }

  // damage hooks (called from Game.damage)
  adjust(v, attacker, amount) {
    if (v.zombie) { if (this.insta > 0 && attacker && !attacker.zombie) return 1e9; return amount; }
    if (!v.zombie && attacker && attacker.zombie) return amount * ((v.perks & PERKS.jug.bit) ? 0.4 : 1);
    return amount;
  }
  onHit(attacker, v) {
    if (!attacker || attacker.zombie || attacker.zHitT === this.g.time) return;
    attacker.zHitT = this.g.time; this.award(attacker, HIT_PTS);
    if (v.zs && !v.crawl) v.zs.stag = 0.22;
  }
  award(a, n) { if (!a || a.zombie) return; a.pts = Math.max(0, (a.pts | 0) + Math.round(n * (n > 0 && this.dbl > 0 ? 2 : 1))); }

  onKill(v, k, head) {
    if (!v.zombie || !this.auth) return;
    if (!this.nukeKill && k && !k.zombie) this.award(k, head ? HEAD_PTS - HIT_PTS : KILL_PTS - HIT_PTS);   // the hit that killed it already paid 10
    if (!this.nukeKill) this.maybeDrop(v);
    if (this.dogRound && this.toSpawn <= 0 && this.zombies().length === 0) this.pus.push({ id: this.nextPu++, type: 'max', x: v.pos.x, z: v.pos.z, t: 30, view: null });
  }

  maybeDrop(z) {
    if (this.drops >= 4 || this.round < 2 || Math.random() > 0.045) return;
    this.drops++;
    this.pus.push({ id: this.nextPu++, type: POWER_POOL[Math.floor(Math.random() * POWER_POOL.length)], x: z.pos.x, z: z.pos.z, t: 30, view: null });
  }

  // ---- players ----
  processPlayer(a, dt, ps) {
    const g = this.g;
    // bleeding out / self revive
    if (a.down) {
      if (a.selfT > 0) { a.selfT -= dt; if (a.selfT <= 0) this.revive(a); }
      else {
        // a teammate reviving?
        const rev = ps.find((o) => o !== a && o.alive && !o.down && o.useHeld && Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) < 1.9);
        if (rev) {
          a.revP += dt / ((rev.perks & PERKS.qr.bit) ? 2 : 4);
          if (a.revP >= 1) this.revive(a);
        } else a.revP = Math.max(0, a.revP - dt * 0.5);
        if (a.down) { a.downT -= dt; if (a.downT <= 0) this.bleedOut(a); }
      }
      a.usePrev = a.useHeld; return;
    }
    if (!a.alive) { a.usePrev = a.useHeld; return; }
    const held = a.useHeld, press = held && !a.usePrev; a.usePrev = held;
    if (!held) { a.boardT = 0; return; }
    if (press) {
      const it = this.nearestItem(a);
      if (it) { this.use(a, it); return; }
    }
    // hold: rebuild a barricade
    const w = this.nearestWindow(a);
    if (w && w.boards < 6) {
      const blocked = g.actors.some((o) => o.alive && Math.hypot(o.pos.x - w.x, o.pos.z - w.z) < 1.0);
      if (blocked) return;
      a.boardT += dt;
      if (a.boardT >= 0.6) { a.boardT = 0; w.boards++; this.award(a, 10); this.dirty = true; }
    } else a.boardT = 0;
  }

  down(v, attacker) {
    if (v.down || !v.alive) return;
    const g = this.g;
    v.down = true; v.hp = 0; v.downT = BLEED; v.revP = 0; v.crouch = true;
    // solo + Quick Revive: you pick yourself up (3 times per game)
    if (this.solo() && (v.perks & PERKS.qr.bit) && v.qrUses > 0) { v.qrUses--; v.selfT = 6; if (v.qrUses <= 0) v.perks &= ~PERKS.qr.bit; }
    this.emit(['zdn', v.id, 1]);
  }
  revive(a) {
    a.down = false; a.hp = 100; a.revP = 0; a.downT = 0; a.selfT = 0; a.protT = 1.5; a.lastHurt = this.g.time; a.crouch = false;
    this.emit(['zdn', a.id, 0]);
  }
  bleedOut(a) {
    const g = this.g;
    a.down = false; a.selfT = 0;
    this.emit(['zdn', a.id, 0]);
    g.kill(a, g.fakeKiller(a), WEAPONS.zclaw, false);
  }

  nearestItem(a) {
    let best = null, bd = Infinity;
    for (const it of this.items) {
      const d = Math.hypot(a.pos.x - it.x, a.pos.z - it.z);
      if (d > it.r || d >= bd || Math.abs(a.pos.y - (it.y || 0)) > 2.3) continue;
      if (it.kind === 'door' && it.o.open) continue;
      if (it.kind === 'perk' && (a.perks & it.o.perk.bit)) continue;
      best = it; bd = d;
    }
    return best;
  }
  nearestWindow(a) {
    let best = null, bd = 2.4;
    for (const w of this.windows) { const d = Math.hypot(a.pos.x - w.inx, a.pos.z - w.inz); if (d < bd) { bd = d; best = w; } }
    return best;
  }

  charge(a, cost) {
    if (a.pts < cost) { this.toast(a, 'NOT ENOUGH POINTS'); return false; }
    a.pts -= cost; return true;
  }
  slotFor(a, wid) {
    const starter = a.weapons.findIndex((w) => w.id === START_GUN && !w.pap);
    return starter >= 0 && wid !== START_GUN ? starter : a.cur;
  }

  use(a, it) {
    const o = it.o;
    if (it.kind === 'door') {
      if (!this.charge(a, o.cost)) return;
      o.open = true; this.zones[o.opens] = true; this.dirty = true;
      this.emit(['zn', 'DOOR OPENED']);
    } else if (it.kind === 'buy') {
      const own = a.weapons.findIndex((w) => w.id === o.gun);
      if (own >= 0) {
        const cost = a.weapons[own].pap ? 2500 : Math.floor(o.cost / 2);
        if (!this.charge(a, cost)) return;
        this.emit(['za', a.id, own]);
      } else {
        if (!this.charge(a, o.cost)) return;
        this.emit(['zw', a.id, this.slotFor(a, o.gun), o.gun, 0]);
      }
    } else if (it.kind === 'perk') {
      const k = o.perk === PERKS.qr ? 'qr' : PERK_KEYS.find((x) => PERKS[x] === o.perk);
      if (!this.charge(a, this.perkCost(k))) return;
      a.perks |= o.perk.bit;
      this.emit(['zp', a.id, k]);
    } else if (it.kind === 'box') {
      if (o.st === 0) {
        if (!this.charge(a, BOX_COST)) return;
        o.st = 1; o.t = 0; o.owner = a.id; o.wid = BOX_POOL[Math.floor(Math.random() * BOX_POOL.length)];
      } else if (o.st === 2 && o.owner === a.id) {
        o.st = 0; this.emit(['zw', a.id, this.slotFor(a, o.wid), o.wid, 0]);
      }
    } else if (it.kind === 'pap') {
      if (o.st !== 0) return;
      const w = a.weapons[a.cur];
      if (w.pap) { this.toast(a, 'ALREADY PACK-A-PUNCHED'); return; }
      if (!this.charge(a, PAP_COST)) return;
      o.st = 1; o.t = 0; o.owner = a.id; o.slot = a.cur; o.wid = w.id;
    }
  }

  updateMachines(dt) {
    const b = this.box, p = this.pap;
    if (b.st === 1) { b.t += dt; if (b.t >= 3) { b.st = 2; b.t = 0; } }
    else if (b.st === 2) { b.t += dt; if (b.t >= 10) b.st = 0; }
    if (p.st === 1) {
      p.t += dt;
      if (p.t >= 3) { p.st = 0; const a = this.g.byId(p.owner); if (a && a.alive) this.emit(['zw', a.id, p.slot, p.wid, 1]); }
    }
    if (this.dirty) { this.dirty = false; this.rebuildBlocked(); }
  }

  updatePowerups(dt, ps) {
    for (let i = this.pus.length - 1; i >= 0; i--) {
      const u = this.pus[i]; u.t -= dt;
      let taker = null;
      for (const a of ps) if (a.alive && !a.down && Math.hypot(a.pos.x - u.x, a.pos.z - u.z) < 1.5) { taker = a; break; }
      if (taker) { this.collect(taker, u, ps); this.pus.splice(i, 1); this.dropView(u); }
      else if (u.t <= 0) { this.pus.splice(i, 1); this.dropView(u); }
    }
  }
  dropView(u) { if (u.view) { this.group.remove(u.view); u.view = null; } }
  collect(a, u, ps) {
    const g = this.g;
    this.emit(['zpg', u.type]);
    if (u.type === 'max') this.emit(['zmx']);
    else if (u.type === 'insta') this.insta = 30;
    else if (u.type === 'dbl') this.dbl = 30;
    else if (u.type === 'carp') { for (const w of this.windows) w.boards = 6; this.dirty = true; for (const p of ps) this.award(p, 200); }
    else if (u.type === 'nuke') {
      this.nukeKill = true;
      for (const z of this.zombies()) g.kill(z, a, WEAPONS.zclaw, false);
      this.nukeKill = false;
      for (const p of ps) this.award(p, 400);
    }
  }

  // ------------------------------------------------------------------ snapshots
  sendState(ps) {
    const g = this.g; if (!g.net || !g.isHost) return;
    g.net.ev(['zs', this.stateObj(ps || this.players())]);
  }
  stateObj(ps) {
    return {
      r: this.round, l: this.left, ph: this.phase === 'active' ? 1 : this.phase === 'break' ? 2 : 0, pt: +this.phaseT.toFixed(1), i: +this.insta.toFixed(1), d: +this.dbl.toFixed(1), st: Math.round(this.survT),
      z: this.zones.map(Number), w: this.windows.map((w) => w.boards), o: this.doors.map((d) => (d.open ? 1 : 0)),
      b: [this.box.st, this.box.wid, this.box.owner], pp: [this.pap.st, this.pap.owner, this.pap.wid],
      p: ps.map((a) => [a.id, a.pts | 0, a.perks | 0, a.down ? 1 : 0, Math.round(a.downT), Math.round((a.revP || 0) * 100), a.qrUses | 0, a.selfT > 0 ? 1 : 0]),
      u: this.pus.map((u) => [u.id, u.type, +u.x.toFixed(1), +u.z.toFixed(1), Math.round(u.t)]),
    };
  }
  applyState(s) {
    const g = this.g;
    if (s.r !== this.round) {
      this.round = s.r;
      if (s.r > 0) g.hud.center(`ROUND ${s.r}`, 2.4);
    }
    this.left = s.l; this.phase = s.ph === 1 ? 'active' : s.ph === 2 ? 'break' : 'pre'; this.phaseT = s.pt; this.insta = s.i; this.dbl = s.d; this.survT = s.st;
    s.z.forEach((v, i) => { this.zones[i] = !!v; });
    s.w.forEach((v, i) => { if (this.windows[i]) this.windows[i].boards = v; });
    s.o.forEach((v, i) => { if (this.doors[i]) this.doors[i].open = !!v; });
    [this.box.st, this.box.wid, this.box.owner] = s.b; [this.pap.st, this.pap.owner, this.pap.wid] = s.pp;
    for (const e of s.p) {
      const a = g.byId(e[0]); if (!a) continue;
      a.pts = e[1]; a.perks = e[2]; a.downT = e[4]; a.revP = e[5] / 100; a.qrUses = e[6]; a.selfT = e[7];
      const down = !!e[3]; if (down !== a.down) { a.down = down; if (!down && a.isPlayer) g.hud.center('REVIVED', 1); }
    }
    // power-ups: create / drop views to match the list
    const have = new Set(s.u.map((u) => u[0]));
    this.pus = this.pus.filter((u) => { if (have.has(u.id)) return true; this.dropView(u); return false; });
    for (const e of s.u) {
      let u = this.pus.find((x) => x.id === e[0]);
      if (!u) { u = { id: e[0], type: e[1], x: e[2], z: e[3], t: e[4], view: null }; this.pus.push(u); }
      u.t = e[4];
    }
  }

  // ------------------------------------------------------------------ views (both roles)
  refreshViews(force) {
    const g = this.g;
    for (const w of this.windows) {
      if (force || w.shown !== w.boards) { w.shown = w.boards; setBoards(w, w.boards); }
      const blk = w.boards > 0;
      if (blk !== w.blocking) { w.blocking = blk; if (blk) g.col.add(w.box); else g.col.remove(w.box); if (!this.auth) { /* clients need no nav */ } }
    }
    for (const d of this.doors) {
      const blk = !d.open;
      if (blk !== d.blocking) { d.blocking = blk; if (blk) g.col.add(d.box); else g.col.remove(d.box); d.view.group.visible = blk; }
    }
  }

  animate(dt) {
    const g = this.g;
    this.refreshViews(false);
    // perk machine / door / buy labels that depend on state
    const qr = this.perks.find((m) => m.id === 'qr');
    if (qr) { const c = this.qrCost(); if (qr.shownCost !== c) { qr.shownCost = c; setLabel(qr.view.sprite, `QUICK REVIVE\n${c}`, { color: '#6ab0ff', scale: 2.2 }); } }
    // Mystery Box
    const b = this.box, bv = b.view, open = b.st !== 0;
    bv.lid.rotation.x = clamp(bv.lid.rotation.x + ((open ? -1.1 : 0) - bv.lid.rotation.x) * Math.min(1, dt * 8), -1.2, 0);
    bv.beam.visible = open; bv.sprite.visible = !open;
    let showId = '';
    if (b.st === 1) { this.rollT -= dt; if (this.rollT <= 0) { this.rollT = 0.13; this.rollId = BOX_POOL[Math.floor(Math.random() * BOX_POOL.length)]; } showId = this.rollId || b.wid; }
    else if (b.st === 2) showId = b.wid;
    if (showId !== b.shown) { b.shown = showId; if (bv.prize) { bv.group.remove(bv.prize); bv.prize = null; } if (showId) { bv.prize = gunDisplay(showId, false); bv.prize.position.set(0, 1.55, 0); bv.group.add(bv.prize); } }
    if (bv.prize) { bv.prize.rotation.y += dt * 2.2; bv.prize.position.y = 1.55 + Math.sin(this.t * 3) * 0.06; }
    // Pack-a-Punch
    const p = this.pap, pv = p.view;
    pv.dial.rotation.z += dt * (p.st ? 6 : 0.6);
    const pid = p.st ? p.wid : '';
    if (pid !== p.shown) { p.shown = pid; if (pv.prize) { pv.group.remove(pv.prize); pv.prize = null; } if (pid) { pv.prize = gunDisplay(pid, p.st === 1 ? false : true); pv.prize.position.set(0.0, 1.15, 0.7); pv.prize.rotation.y = Math.PI / 2; pv.group.add(pv.prize); } }
    // power-ups
    for (const u of this.pus) {
      if (!u.view) { u.view = buildPowerup(u.type); this.group.add(u.view); }
      u.view.position.set(u.x, 0.9 + Math.sin(this.t * 3 + u.id) * 0.12, u.z); u.view.rotation.y += dt * 2;
      u.view.visible = u.t > 6 || Math.floor(this.t * 6) % 2 === 0;
    }
  }

  // ------------------------------------------------------------------ prompt text for the local player (client side only)
  updatePrompt() {
    const g = this.g, p = g.player; let t = '';
    if (!p || !p.alive || g.ended) { this.prompt = ''; return; }
    if (p.down) { this.prompt = p.selfT > 0 ? 'SELF REVIVING...' : 'BLEEDING OUT - wait for a teammate'; return; }
    const dn = this.players().find((o) => o !== p && o.alive && o.down && Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < 1.9);
    if (dn) t = `Hold F to revive ${dn.name}`;
    else {
      const it = this.nearestItem(p);
      if (it) t = this.itemPrompt(p, it);
      if (!t) { const w = this.nearestWindow(p); if (w && w.boards < 6) t = 'Hold F to rebuild the barricade'; }
    }
    this.prompt = t;
  }
  itemPrompt(p, it) {
    const o = it.o;
    if (it.kind === 'door') return `Press F to open the door [${o.cost}]`;
    if (it.kind === 'buy') { const own = p.weapons.find((w) => w.id === o.gun); return own ? `Press F to buy ammo [${own.pap ? 2500 : Math.floor(o.cost / 2)}]` : `Press F to buy the ${WEAPONS[o.gun].name} [${o.cost}]`; }
    if (it.kind === 'perk') { const k = PERK_KEYS.find((x) => PERKS[x] === o.perk); return `Press F to buy ${o.perk.name} [${this.perkCost(k)}] - ${o.perk.blurb}`; }
    if (it.kind === 'box') { if (o.st === 0) return `Press F for the Mystery Box [${BOX_COST}]`; if (o.st === 2 && o.owner === p.id) return `Press F to take the ${WEAPONS[o.wid].name}`; return ''; }
    if (it.kind === 'pap') { if (o.st !== 0) return ''; return p.weapon.pap ? 'Already Pack-a-Punched' : `Press F to Pack-a-Punch your ${p.weapon.name} [${PAP_COST}]`; }
    return '';
  }
}
