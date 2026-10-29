import { labelFor } from './keybinds.js?v=0.18.1';
// Killstreak rewards (offline matches): earn them with kills in a row, then press the number key.
//   3 kills  UAV        - every enemy shows on the radar for 25 s            (key 4)
//   5 kills  SENTRY GUN - an automatic turret guards the spot for 60 s       (key 5)
//   7 kills  AIRSTRIKE  - a line of bombs lands where you are looking        (key 6)
// The cycle repeats every 10 kills (13, 15, 17 ...).
import * as THREE from 'three';

export const STREAKS = [
  { id: 'uav', name: 'UAV', at: 3, key: 4, code: 'Digit4' },
  { id: 'sentry', name: 'SENTRY GUN', at: 5, key: 5, code: 'Digit5' },
  { id: 'strike', name: 'AIRSTRIKE', at: 7, key: 6, code: 'Digit6' },
];
const SENTRY_W = { id: 'sentry', name: 'Sentry Gun' }, STRIKE_W = { id: 'strike', name: 'Airstrike' };
const rand = (a, b) => a + Math.random() * (b - a);

export class Streaks {
  constructor(game) {
    this.g = game; this.ready = {}; this.uav = 0; this.sentries = []; this.strikes = []; this.booms = [];
    this.group = new THREE.Group(); game.scene.add(this.group); this.html = '';
  }

  dispose() { if (this.g.scene) this.g.scene.remove(this.group); }

  // the player's kill streak just reached n
  earn(n) {
    const s = STREAKS.find((x) => x.at === n % 10);
    if (!s) return;
    this.ready[s.id] = (this.ready[s.id] || 0) + 1;
    this.g.hud.center(`${s.name} READY - PRESS ${labelFor(s.code)}`, 2); this.g.sound.beep(true);
  }

  use(id) {
    const g = this.g, p = g.player;
    if (!p.alive || !(this.ready[id] > 0) || g.ended) return false;
    if (id === 'uav') { this.uav = 25; g.hud.center('UAV ONLINE', 1.4); }
    else if (id === 'sentry') {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), x = p.pos.x + fx * 1.6, z = p.pos.z + fz * 1.6, y = g.groundAt(x, p.pos.y + 0.6, z, 0.3);
      this.placeSentry(x, y, z, p.yaw); g.hud.center('SENTRY DEPLOYED', 1.4);
    } else if (id === 'strike') {
      const spot = g.aimSpot(), fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      this.strikes.push({ x: spot.x, y: spot.y, z: spot.z, dx: fx, dz: fz, delay: 2.2, n: 0, next: 0 });
      this.mark(spot);
      g.hud.center('AIRSTRIKE INBOUND', 1.6);
    }
    this.ready[id]--; g.sound.beep(false);
    return true;
  }

  mark(s) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3a20, transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
    b.position.set(s.x, s.y + 20, s.z); b.life = 2.6; b.userData.mark = true; this.group.add(b); this.booms.push(b);
  }

  placeSentry(x, y, z, yaw) {
    const grp = new THREE.Group(); grp.position.set(x, y, z);
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3036 }), olive = new THREE.MeshStandardMaterial({ color: 0x4b5a3a });
    const add = (w, h, d, m, px, py, pz, par) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(px, py, pz); (par || grp).add(b); return b; };
    add(0.7, 0.06, 0.7, dark, 0, 0.03, 0);
    for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [0, 0.35]]) add(0.05, 0.5, 0.05, dark, lx, 0.28, lz);
    const head = new THREE.Group(); head.position.set(0, 0.6, 0); grp.add(head);
    add(0.3, 0.2, 0.36, olive, 0, 0, 0, head); add(0.07, 0.07, 0.5, dark, 0, 0.02, -0.4, head); add(0.2, 0.05, 0.2, dark, 0, 0.13, 0.02, head);
    this.group.add(grp);
    this.sentries.push({ x, y, z, grp, head, life: 60, cd: 0, yaw: yaw, tgt: null, scanT: 0 });
  }

  update(dt) {
    const g = this.g, p = g.player;
    if (this.uav > 0) this.uav -= dt;
    // sentries
    for (let i = this.sentries.length - 1; i >= 0; i--) {
      const s = this.sentries[i]; s.life -= dt; s.cd -= dt; s.scanT -= dt;
      if (s.life <= 0) { this.group.remove(s.grp); this.sentries.splice(i, 1); continue; }
      if (s.scanT <= 0) {
        s.scanT = 0.2; s.tgt = null; let bd = 30;
        for (const e of g.actors) {
          if (!e.alive || e === p || e.dummy || (g.mode.team && e.team === p.team)) continue;
          const d = Math.hypot(e.pos.x - s.x, e.pos.z - s.z);
          if (d < bd && g.los({ pos: { x: s.x, y: s.y + 0.2, z: s.z } }, e)) { bd = d; s.tgt = e; }
        }
      }
      const t = s.tgt;
      if (t && t.alive) {
        const want = Math.atan2(-(t.pos.x - s.x), -(t.pos.z - s.z));
        let df = want - s.yaw; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283;
        s.yaw += Math.max(-1, Math.min(1, df)) * Math.min(1, dt * 9); s.head.rotation.y = s.yaw;
        if (s.cd <= 0 && Math.abs(df) < 0.25) {
          s.cd = 0.11;
          const from = { x: s.x, y: s.y + 0.62, z: s.z }, to = { x: t.pos.x + rand(-0.15, 0.15), y: t.pos.y + 1.2 + rand(-0.3, 0.3), z: t.pos.z + rand(-0.15, 0.15) };
          g.tracer(from, to); g.sound.shot({ snd: { f: 2600, len: 0.11, thump: 0.6 } }, 0.3, 0);
          if (Math.random() < 0.75) g.damage(t, p, 11, SENTRY_W, false);
        }
      }
    }
    // airstrikes
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const st = this.strikes[i]; st.delay -= dt;
      if (st.delay > 0) continue;
      st.next -= dt;
      if (st.next <= 0) {
        st.next = 0.16;
        const k = st.n++, off = (k - 3.5) * 5.5;
        this.boom(st.x + st.dx * off + rand(-1, 1), st.y, st.z + st.dz * off + rand(-1, 1));
        if (st.n >= 8) this.strikes.splice(i, 1);
      }
    }
    // explosion visuals
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i]; b.life -= dt;
      if (!b.userData.mark) { const k = 1 - b.life / 0.55; b.scale.set(1 + k * 6, 1 + k * 6, 1 + k * 6); b.material.opacity = Math.max(0, 0.8 * (1 - k)); }
      if (b.life <= 0) { this.group.remove(b); this.booms.splice(i, 1); }
    }
    this.html = this.buildHud();
  }

  boom(x, y, z) {
    const g = this.g, p = g.player, R = 7;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
    m.position.set(x, y + 0.8, z); m.life = 0.55; this.group.add(m); this.booms.push(m);
    g.burst(x, y + 0.6, z, 0xff8a1f, 14, 7); g.burst(x, y + 0.6, z, 0x555555, 8, 4);
    g.sound.hurt();
    for (const e of g.actors) {
      if (!e.alive || e === p || e.dummy || (g.mode.team && e.team === p.team)) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (d < R && Math.abs(e.pos.y - y) < 3) g.damage(e, p, 220 * (1 - d / R) + 30, STRIKE_W, false);
    }
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < R * 0.6 && p.alive) g.damage(p, p, 60, STRIKE_W, false);          // danger close
  }

  buildHud() {
    const rows = [];
    for (const s of STREAKS) {
      const n = this.ready[s.id] || 0, on = (s.id === 'uav' && this.uav > 0) || (s.id === 'sentry' && this.sentries.length);
      if (n) rows.push(`<div class="ready">[${labelFor(s.code)}] ${s.name}${n > 1 ? ' x' + n : ''}</div>`);
      else if (on) rows.push(`<div class="active">${s.name}${s.id === 'uav' ? ' ' + Math.ceil(this.uav) + 's' : ''}</div>`);
    }
    const st = this.g.player.streak; const nxt = STREAKS.map((s) => s.at).find((a) => a > st % 10) || 3;
    rows.push(`<div>STREAK ${st}${st % 10 < 7 ? ` - next reward at ${nxt}` : ''}</div>`);
    return rows.join('');
  }
}
