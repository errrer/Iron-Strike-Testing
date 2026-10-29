// Objective game modes (single player): Domination, Hardpoint, Kill Confirmed, Search & Destroy.
// The game calls update(dt) every frame, onKill() for each kill and botGoal() when a bot picks where to go.
import * as THREE from 'three';
import { XP_REWARD } from './progress.js?v=0.17.2';

const C_ALLY = 0x58b4ff, C_ENEMY = 0xff5a4a, C_NEUTRAL = 0xcfd6dc, C_HOT = 0xffd45e;
const rand = (a, b) => a + Math.random() * (b - a);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

export class Objectives {
  constructor(game, kind) {
    this.g = game; this.kind = kind; this.t = 0; this.zones = []; this.tags = [];
    this.group = new THREE.Group(); game.scene.add(this.group);
    this.tick = 0; this.hudT = 0; this.hudHtml = '';
    const sp = game.map.spawns, c = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
    const a = c(sp[0]), b = c(sp[1]), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dir = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], perp = [-dir[1], dir[0]];
    // a point t of the way from team 0's spawn to team 1's, pushed sideways by off metres, snapped to the nav graph
    this.at = (t, off) => {
      const nav = game.nav, n = nav.nodes[nav.nearest(a[0] + dir[0] * L * t + perp[0] * off, a[1] + dir[1] * L * t + perp[1] * off)];
      return { x: n.x, z: n.z, y: game.groundAt(n.x, 3, n.z, 0.3) };
    };
    if (kind === 'dom') {
      [['A', 0.22, 9], ['B', 0.5, -9], ['C', 0.78, 9]].forEach(([n, t, o]) => this.addZone(n, this.at(t, o), 5));
      this.scoreT = 0;
    } else if (kind === 'hp') {
      this.order = [0.3, 0.7, 0.5, 0.5].map((t, i) => this.at(t, i === 0 ? -8 : i === 1 ? 8 : 0));
      this.hpI = -1; this.hpT = 0; this.hpGap = 5; this.addZone('HP', this.order[0], 6); this.zones[0].active = false; this.scoreT = 0;
      this.nextPoint();
    } else if (kind === 'snd') {
      this.addZone('A', this.at(0.62, 14), 4); this.addZone('B', this.at(0.62, -14), 4);
      this.round = 0; this.phase = 'over'; this.phaseT = 2; this.bomb = null; this.useT = 0;
    }
    this.sync();
  }

  addZone(name, p, r) {
    const z = { name, x: p.x, y: p.y, z: p.z, r, owner: -1, prog: 0, c: [0, 0], active: true, hot: false };
    const g = new THREE.Group(); g.position.set(z.x, z.y, z.z);
    const mat = () => new THREE.MeshBasicMaterial({ color: C_NEUTRAL, transparent: true, opacity: 0.3, fog: false, depthWrite: false });
    z.disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 28), mat()); z.disc.position.y = 0.05; g.add(z.disc);
    z.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 12, 10, 1, true), mat()); z.beam.position.y = 6; z.beam.material.opacity = 0.2; g.add(z.beam);
    z.group = g; this.group.add(g); this.zones.push(z);
    return z;
  }

  dispose() { if (this.g.scene) this.g.scene.remove(this.group); }

  inZone(z, a) { return a.alive && Math.hypot(a.pos.x - z.x, a.pos.z - z.z) < z.r && Math.abs(a.pos.y - z.y) < 3; }
  team0(a) { return a.team === 0; }
  rel(owner) { return owner < 0 ? 'neutral' : owner === this.g.player.team ? 'ally' : 'enemy'; }
  color(owner) { return owner < 0 ? C_NEUTRAL : owner === this.g.player.team ? C_ALLY : C_ENEMY; }
  sync() {
    for (const z of this.zones) {
      z.group.visible = z.active;
      const col = z.hot ? C_HOT : this.color(z.owner);
      z.disc.material.color.setHex(col); z.beam.material.color.setHex(col);
    }
  }

  // -------------------------------------------------------------------------------------------- per frame
  update(dt) {
    this.t += dt;
    const g = this.g;
    if (this.kind === 'dom') this.updateDom(dt);
    else if (this.kind === 'hp') this.updateHp(dt);
    else if (this.kind === 'kc') this.updateKc(dt);
    else if (this.kind === 'snd') this.updateSnd(dt);
    for (const z of this.zones) z.group.rotation.y += dt * 0.4;
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.1; this.hudHtml = this.buildHud(); }
  }

  count(z) {
    z.c = [0, 0];
    for (const a of this.g.actors) if (this.inZone(z, a)) z.c[a.team === 0 ? 0 : 1]++;
    return z.c;
  }

  updateDom(dt) {
    const g = this.g;
    for (const z of this.zones) {
      const [c0, c1] = this.count(z); z.hot = c0 > 0 && c1 > 0;
      const diff = c0 - c1;
      if (diff !== 0) {
        const before = z.owner, step = dt / 7 * Math.min(2, Math.abs(diff)) * Math.sign(diff);
        z.prog = Math.max(-1, Math.min(1, z.prog + step));
        const newOwner = z.prog >= 1 ? 0 : z.prog <= -1 ? 1 : (z.owner === 0 && z.prog <= 0) || (z.owner === 1 && z.prog >= 0) ? -1 : z.owner;
        if (newOwner !== z.owner) {
          z.owner = newOwner;
          if (newOwner >= 0) {
            g.hud.center(newOwner === g.player.team ? `${z.name} CAPTURED` : `ENEMY CAPTURED ${z.name}`, 1.5);
            if (this.inZone(z, g.player) && newOwner === g.player.team) g.award(XP_REWARD.capture, `CAPTURED ${z.name}`);
          } else if (before >= 0) g.hud.center(before === g.player.team ? `${z.name} LOST` : `${z.name} NEUTRALISED`, 1.2);
        }
      }
    }
    this.scoreT += dt;
    if (this.scoreT >= 3) { this.scoreT -= 3; for (const z of this.zones) if (z.owner >= 0) g.teamScore[z.owner]++; }
    this.sync();
  }

  nextPoint() {
    this.hpI = (this.hpI + 1) % this.order.length; const z = this.zones[0], p = this.order[this.hpI];
    z.x = p.x; z.y = p.y; z.z = p.z; z.group.position.set(p.x, p.y, p.z); z.active = true; z.owner = -1; this.hpT = 45; this.hpWait = 0;
    this.g.hud.center('HARDPOINT MOVED', 1.4);
  }

  updateHp(dt) {
    const g = this.g, z = this.zones[0];
    if (!z.active) { this.hpWait -= dt; if (this.hpWait <= 0) this.nextPoint(); this.sync(); return; }
    this.hpT -= dt;
    const [c0, c1] = this.count(z); z.hot = c0 > 0 && c1 > 0; z.owner = z.hot ? z.owner : c0 > 0 ? 0 : c1 > 0 ? 1 : -1;
    if (!z.hot && z.owner >= 0) {
      this.scoreT += dt;
      if (this.scoreT >= 1) { this.scoreT -= 1; g.teamScore[z.owner]++; if (z.owner === g.player.team && this.inZone(z, g.player)) g.award(XP_REWARD.hold, 'HOLDING'); }
    }
    if (this.hpT <= 0) { z.active = false; z.owner = -1; this.hpWait = 6; g.hud.center('HARDPOINT CLOSED', 1.2); }
    this.sync();
  }

  // ---------------------------------------------------------------- kill confirmed
  onKill(v, k) {
    const g = this.g;
    if (this.kind === 'kc' && v.team !== undefined && !v.dummy) {
      const grp = new THREE.Group(); grp.position.set(v.pos.x, v.pos.y + 0.7, v.pos.z);
      const col = v.team === g.player.team ? C_ALLY : C_ENEMY;
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.04), new THREE.MeshBasicMaterial({ color: col, fog: false })); grp.add(tag);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, fog: false })); beam.position.y = 1; grp.add(beam);
      this.group.add(grp); this.tags.push({ x: v.pos.x, y: v.pos.y, z: v.pos.z, team: v.team, life: 25, mesh: grp, ph: Math.random() * 6 });
    }
    if (this.kind === 'snd' && this.phase === 'live') this.checkRound();
  }

  updateKc(dt) {
    const g = this.g;
    for (let i = this.tags.length - 1; i >= 0; i--) {
      const t = this.tags[i]; t.life -= dt; t.mesh.rotation.y += dt * 3; t.mesh.position.y = t.y + 0.7 + Math.sin(this.t * 3 + t.ph) * 0.08;
      let taken = null;
      for (const a of g.actors) if (a.alive && Math.hypot(a.pos.x - t.x, a.pos.z - t.z) < 1.3 && Math.abs(a.pos.y - t.y) < 2) { taken = a; break; }
      if (taken || t.life <= 0) {
        if (taken) {
          if (taken.team === t.team) { if (taken.isPlayer) { g.award(XP_REWARD.deny, 'KILL DENIED'); g.hud.center('KILL DENIED', 1); } }
          else { g.teamScore[taken.team]++; if (taken.isPlayer) { g.award(XP_REWARD.confirm, 'KILL CONFIRMED'); g.hud.center('KILL CONFIRMED', 1); g.sound.kill(); } }
        }
        this.group.remove(t.mesh); this.tags.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- search & destroy
  // team 0 attacks (plants the bomb at A or B), team 1 defends. One life per round, first to 4 rounds.
  alive(team) { return this.g.actors.filter((a) => a.alive && a.team === team).length; }

  newRound() {
    const g = this.g; this.round++; this.phase = 'live'; this.phaseT = 100; this.bomb = null; this.useT = 0;
    for (const z of this.zones) { z.owner = -1; z.hot = false; }
    for (const a of g.actors) { g.spawn(a); a.protT = 2.5; }
    this.carrier = g.actors.find((a) => a.team === 0 && a.isPlayer) || null;
    this.pick = this.zones.map(() => 0);
    this.sync();
    g.hud.center(`ROUND ${this.round}`, 1.6); g.sound.beep(true);
  }

  endRound(win, why) {
    if (this.phase !== 'live') return;
    const g = this.g; this.phase = 'over'; this.phaseT = 4.5; g.teamScore[win]++;
    g.hud.center(`${win === g.player.team ? 'ROUND WON' : 'ROUND LOST'} - ${why}`, 3.5);
    if (this.bomb) { this.group.remove(this.bomb.mesh); this.bomb = null; }
  }

  checkRound() {
    if (this.phase !== 'live') return;
    const a0 = this.alive(0), a1 = this.alive(1);
    if (a1 === 0) this.endRound(0, 'DEFENDERS ELIMINATED');
    else if (a0 === 0 && !this.bomb) this.endRound(1, 'ATTACKERS ELIMINATED');
  }

  updateSnd(dt) {
    const g = this.g;
    this.phaseT -= dt;
    if (this.phase === 'over') { if (this.phaseT <= 0 && !g.ended) this.newRound(); return; }
    this.checkRound(); if (this.phase !== 'live') return;
    if (!this.bomb) {
      if (this.phaseT <= 0) return this.endRound(1, 'TIME UP');
      // planting: an attacker standing in a site with nobody shooting at them
      for (const z of this.zones) {
        const who = g.actors.find((a) => a.alive && a.team === 0 && this.inZone(z, a) && (a.isPlayer ? g.keys.KeyE : true));
        if (who) {
          this.useT += dt;
          if (this.useT >= 3) { this.plant(z, who); this.useT = 0; }
          return;
        }
      }
      this.useT = 0;
    } else {
      this.bomb.t -= dt; this.bomb.mesh.rotation.y += dt;
      const z = this.bomb.zone, who = g.actors.find((a) => a.alive && a.team === 1 && this.inZone(z, a) && (a.isPlayer ? g.keys.KeyE : this.defuser(a)));
      if (who && !g.actors.some((a) => a.alive && a.team === 0 && this.inZone(z, a))) {
        this.useT += dt; if (this.useT >= 5) { if (who.isPlayer) g.award(XP_REWARD.defuse, 'BOMB DEFUSED'); this.endRound(1, 'BOMB DEFUSED'); }
      } else this.useT = Math.max(0, this.useT - dt * 2);
      if (this.bomb && this.bomb.t <= 0) { const bz = this.bomb.zone; for (const a of g.actors) if (a.alive && Math.hypot(a.pos.x - bz.x, a.pos.z - bz.z) < 14) g.damage(a, a, 999, { id: 'bomb', name: 'Bomb' }, false); this.endRound(0, 'BOMB DETONATED'); }
    }
  }
  defuser() { return true; }

  plant(z, who) {
    const g = this.g; z.hot = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.3), new THREE.MeshBasicMaterial({ color: 0xff3020 })); mesh.position.set(z.x, z.y + 0.2, z.z); this.group.add(mesh);
    this.bomb = { zone: z, t: 40, mesh }; this.sync();
    g.hud.center(who.team === g.player.team ? 'BOMB PLANTED' : 'BOMB PLANTED - DEFUSE IT', 2); g.sound.beep(true);
    if (who.isPlayer) g.award(XP_REWARD.plant, 'BOMB PLANTED');
  }

  // ---------------------------------------------------------------- bots
  botGoal(a) {
    const g = this.g;
    const jitter = (z, k = 0.6) => ({ x: z.x + rand(-z.r, z.r) * k, z: z.z + rand(-z.r, z.r) * k });
    if (this.kind === 'dom') {
      const own = this.zones.filter((z) => z.owner === a.team), other = this.zones.filter((z) => z.owner !== a.team);
      const list = other.length && (Math.random() < 0.65 || !own.length) ? other : own;
      return jitter(list[Math.floor(Math.random() * list.length)]);
    }
    if (this.kind === 'hp') { const z = this.zones[0]; return z.active ? jitter(z) : jitter({ ...this.order[(this.hpI + 1) % this.order.length], r: 6 }); }
    if (this.kind === 'kc') {
      let best = null, bd = 30;
      for (const t of this.tags) { const d = Math.hypot(t.x - a.pos.x, t.z - a.pos.z); if (d < bd) { bd = d; best = t; } }
      if (best && Math.random() < 0.8) return { x: best.x, z: best.z };
      return null;
    }
    if (this.kind === 'snd' && this.phase === 'live') {
      if (this.bomb) return jitter(this.bomb.zone, 0.3);
      const idx = a.id % 2, z = this.zones[idx];
      return jitter(z, a.team === 0 ? 0.3 : 0.9);
    }
    return null;
  }

  // ---------------------------------------------------------------- HUD
  buildHud() {
    const g = this.g, chip = (z) => {
      const cls = z.hot ? 'contested' : this.rel(z.owner), pct = Math.round(Math.abs(z.prog) * 100);
      return `<div class="z ${cls}">${z.name}</div>`;
    };
    if (this.kind === 'dom') return this.zones.map(chip).join('');
    if (this.kind === 'hp') { const z = this.zones[0]; return `<div class="z ${z.active ? (z.hot ? 'contested' : this.rel(z.owner)) : ''}">${z.active ? '' : '-'}</div><div class="info">${z.active ? `POINT ${mmss(this.hpT)}` : `MOVING ${mmss(this.hpWait)}`}</div>`; }
    if (this.kind === 'kc') return `<div class="info">TAGS ${this.tags.length} - pick up red to confirm, blue to deny</div>`;
    if (this.kind === 'snd') {
      const atk = g.player.team === 0;
      const state = this.phase === 'over' ? 'ROUND OVER' : this.bomb ? `BOMB ${this.bomb.zone.name} ${Math.ceil(this.bomb.t)}s` : `ROUND ${this.round} ${mmss(Math.max(0, this.phaseT))}`;
      const prog = this.useT > 0 ? ` - ${this.bomb ? 'DEFUSING' : 'PLANTING'} ${Math.round(this.useT / (this.bomb ? 5 : 3) * 100)}%` : '';
      const hint = this.phase === 'live' && !this.bomb && g.player.alive && atk && this.zones.some((z) => this.inZone(z, g.player)) ? ' - HOLD E TO PLANT' : (this.bomb && !atk ? ' - HOLD E AT THE BOMB' : '');
      return `${this.zones.map(chip).join('')}<div class="info">${state}${prog}${hint} - ${this.alive(0)}v${this.alive(1)}</div>`;
    }
    return '';
  }

  drawRadar(c) {
    for (const z of this.zones) {
      if (!z.active) continue;
      c.strokeStyle = z.hot ? '#ffd45e' : '#' + this.color(z.owner).toString(16).padStart(6, '0'); c.lineWidth = 0.8;
      c.beginPath(); c.arc(z.x, z.z, z.r, 0, Math.PI * 2); c.stroke();
    }
    for (const t of this.tags) { c.fillStyle = t.team === this.g.player.team ? '#58b4ff' : '#ff5a4a'; c.fillRect(t.x - 0.8, t.z - 0.8, 1.6, 1.6); }
  }
}
