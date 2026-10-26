const $ = (id) => document.getElementById(id);
export const XH_DEFAULT = { style: 'crossdot', color: '#ffffff', size: 9, thick: 2, gap: 4, alpha: 1, outline: true, dyn: true };
export const XH_STYLES = [['cross', 'Cross'], ['crossdot', 'Cross + dot'], ['dot', 'Dot'], ['circle', 'Circle'], ['tee', 'T-shape'], ['x', 'X']];
export function cleanXh(c) {
  const o = { ...XH_DEFAULT, ...(c && typeof c === 'object' ? c : {}) };
  if (!XH_STYLES.some(([id]) => id === o.style)) o.style = XH_DEFAULT.style;
  if (!/^#[0-9a-f]{6}$/i.test(o.color)) o.color = XH_DEFAULT.color;
  o.size = Math.min(30, Math.max(2, +o.size || XH_DEFAULT.size)); o.thick = Math.min(8, Math.max(1, +o.thick || XH_DEFAULT.thick));
  o.gap = Math.min(30, Math.max(0, +o.gap)); if (!isFinite(o.gap)) o.gap = XH_DEFAULT.gap;
  o.alpha = Math.min(1, Math.max(0.2, +o.alpha || 1)); o.outline = !!o.outline; o.dyn = !!o.dyn;
  return o;
}
// paints any crosshair element (the HUD one or a menu preview) from a crosshair config
export function styleCrosshair(el, c, gap) {
  el.className = `xh xs-${c.style}${c.outline ? ' xo' : ''}`;
  el.style.setProperty('--xc', c.color); el.style.setProperty('--xl', `${c.size}px`); el.style.setProperty('--xt', `${c.thick}px`);
  el.style.setProperty('--xa', String(c.alpha)); el.style.setProperty('--gap', `${gap == null ? c.gap : gap}px`);
}
const lerp = (a, b, t) => a + (b - a) * t;

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'sbL', 'sbR', 'timer', 'radar', 'killfeed', 'crosshair', 'hitmarker', 'dmgind', 'vignette', 'hpfill', 'hptxt',
      'wname', 'mag', 'res', 'wsec', 'msg', 'scope', 'dead', 'deadTxt', 'deadSub', 'scoreboard', 'pause', 'endscreen', 'endTitle', 'endSub', 'endTable', 'modeTag', 'netinfo', 'sbhint', 'sbPanel', 'xppop', 'objhud', 'streakbar', 'zmhud', 'zmRound', 'zmPts', 'zmPerks', 'zmPU', 'zmPrompt']) this.el[id] = $(id);
    this.rctx = this.el.radar.getContext('2d');
    this.cache = {};
    this.msgT = 0; this.sbT = 0;
    this.xh = { ...XH_DEFAULT };
  }

  setCrosshair(c) { this.xh = cleanXh(c); styleCrosshair(this.el.crosshair, this.xh); this.xhGap = null; }

  set(id, text, html) { if (this.cache[id] !== text) { this.cache[id] = text; if (html) this.el[id].innerHTML = text; else this.el[id].textContent = text; } }

  begin(game) {
    this.cache = {};
    this.el.hud.classList.remove('hidden');
    this.el.endscreen.classList.add('hidden'); this.el.pause.classList.add('hidden'); this.el.dead.classList.add('hidden');
    this.el.killfeed.innerHTML = ''; this.el.dmgind.innerHTML = '';
    this.sandbox = !!game.mode.sandbox; this.el.sbhint.classList.toggle('hidden', !this.sandbox);
    this.el.zmhud.classList.toggle('hidden', !game.mode.zm);
    this.el.modeTag.textContent = `${game.mode.name} - ${game.cfg.mapName}` + (game.net ? ` - ROOM ${game.net.code}` : '');
    // static radar map
    const b = game.map.bounds, S = 4, cv = document.createElement('canvas');
    cv.width = (b.x1 - b.x0) * S; cv.height = (b.z1 - b.z0) * S;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(40,52,64,0.55)'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = 'rgba(190,205,220,0.85)';
    for (const bx of game.map.boxes) {
      if (bx.y1 < 0.9 || bx.y0 > 2.0 || bx.x0 < b.x0 - 1 || bx.x1 > b.x1 + 1 || bx.z0 < b.z0 - 1 || bx.z1 > b.z1 + 1) continue;
      c.fillRect((bx.x0 - b.x0) * S, (bx.z0 - b.z0) * S, (bx.x1 - bx.x0) * S, (bx.z1 - bx.z0) * S);
    }
    this.radarMap = cv;
  }

  xp(text, lvl) {
    const d = document.createElement('div'); d.textContent = text; if (lvl) d.className = 'lvl';
    this.el.xppop.appendChild(d); setTimeout(() => d.remove(), 1700);
    while (this.el.xppop.children.length > 5) this.el.xppop.firstChild.remove();
  }

  center(text, secs = 1.2) { this.el.msg.textContent = text; this.el.msg.classList.add('show'); this.msgT = secs; }

  setScope(on) { if (this.cache.scope !== on) { this.cache.scope = on; this.el.scope.classList.toggle('show', on); } }

  hitmarker(kill, head) {
    const h = this.el.hitmarker;
    h.classList.remove('show', 'kill', 'head'); void h.offsetWidth;
    h.classList.add('show'); if (kill) h.classList.add('kill'); if (head) h.classList.add('head');
  }

  damageFrom(attacker, player) {
    const dx = attacker.pos.x - player.pos.x, dz = attacker.pos.z - player.pos.z;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
    const d = document.createElement('div'); d.className = 'dmg'; d.style.transform = `rotate(${ang}rad)`;
    d.innerHTML = '<i></i>'; this.el.dmgind.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }

  feed(k, v, w, head, game) {
    const row = document.createElement('div'); row.className = 'kf';
    const rel = (a) => (game.mode.team ? (a.team === game.player.team ? 'ally' : 'enemy') : (a.isPlayer ? 'ally' : 'enemy'));
    const mk = (a) => { const s = document.createElement('b'); s.className = rel(a); s.textContent = a.name; return s; };
    const mid = document.createElement('span'); mid.className = 'kfw'; mid.textContent = ` ${k === v ? 'x' : w.name}${head ? ' (HS)' : ''} `;
    row.appendChild(k === v ? document.createTextNode('') : mk(k)); row.appendChild(mid); row.appendChild(mk(v));
    if (k.isPlayer || v.isPlayer) row.classList.add('mine');
    this.el.killfeed.appendChild(row);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.firstChild.remove();
    setTimeout(() => row.remove(), 6000);
  }

  onDeath(k, w, head) {
    this.el.dead.classList.remove('hidden');
    this.el.deadTxt.textContent = `ELIMINATED BY ${k.name.toUpperCase()}`;
    this.deadWeapon = `${w.name}${head ? ' - headshot' : ''}`;
  }
  onRespawn() { this.el.dead.classList.add('hidden'); }

  showPause(on) { this.el.pause.classList.toggle('hidden', !on); this.el.sbPanel.classList.toggle('hidden', !(on && this.sandbox)); }

  // Zombies HUD: round tally, everyone's points, perks, power-up timers and the "press F" prompt
  updateZm(game) {
    const z = game.zm, p = game.player, e = this.el; if (!z) return;
    const sec = Math.ceil(z.phaseT);
    const note = z.phase === 'pre' ? 'GET READY' : z.phase === 'break' ? `NEXT ROUND ${sec}` : '';
    this.set('zmRound', `<b>${z.round || 0}</b><i>${note}</i>`, true);
    const ps = game.actors.filter((a) => !a.zombie && !a.dummy).sort((a, b) => (b.isPlayer ? 1 : 0) - (a.isPlayer ? 1 : 0) || a.id - b.id);
    this.set('zmPts', ps.map((a) => `<div class="${a.isPlayer ? 'me' : ''}${a.down ? ' dn' : ''}${!a.alive ? ' dead' : ''}"><span>${a.isPlayer ? 'YOU' : a.name}</span><b>${a.pts | 0}</b>${!a.alive ? '<em>DEAD</em>' : a.down ? `<em>DOWN ${Math.max(0, a.downT | 0)}</em>` : ''}</div>`).join(''), true);
    const col = { 1: '#d23a3a', 2: '#3a8bff', 4: '#3ad26a', 8: '#e8901e', 16: '#e8d020' }, ab = { 1: 'JUG', 2: 'QR', 4: 'SC', 8: 'DT', 16: 'ST' };
    this.set('zmPerks', [1, 2, 4, 8, 16].filter((b) => (p.perks | 0) & b).map((b) => `<i style="background:${col[b]}">${ab[b]}</i>`).join(''), true);
    const pu = []; if (z.insta > 0) pu.push(`<span class="insta">INSTA-KILL ${Math.ceil(z.insta)}</span>`); if (z.dbl > 0) pu.push(`<span class="dbl">DOUBLE POINTS ${Math.ceil(z.dbl)}</span>`);
    this.set('zmPU', pu.join(''), true);
    let pr = z.prompt;
    if (p.alive && p.down && !(p.selfT > 0)) pr = `DOWN - bleeding out ${Math.max(0, p.downT | 0)}s${p.revP > 0 ? ` - reviving ${Math.round(p.revP * 100)}%` : ''}`;
    this.set('zmPrompt', pr || '');
    e.zmPrompt.classList.toggle('show', !!pr);
  }

  showEnd(game, win) {
    const e = this.el, p = game.player;
    if (game.mode.zm) {
      e.endTitle.textContent = 'GAME OVER'; e.endTitle.className = 'lose';
      e.endSub.textContent = `You survived ${game.teamScore[0]} round${game.teamScore[0] === 1 ? '' : 's'}` + (game.endXp ? `  -  +${game.endXp} XP` : '');
      this.buildTable(game, e.endTable); e.endscreen.classList.remove('hidden'); this.el.dead.classList.add('hidden'); return;
    }
    const won = game.mode.team ? win === p.team : win === p.team;
    e.endTitle.textContent = win === null ? 'DRAW' : (won ? 'VICTORY' : 'DEFEAT');
    e.endTitle.className = win === null ? 'draw' : (won ? 'win' : 'lose');
    e.endSub.textContent = game.mode.team ? `Allies ${game.teamScore[p.team % 2]} - ${game.teamScore[1 - (p.team % 2)]} Enemy` : `${[...game.actors].sort((a, b) => b.kills - a.kills)[0].name} wins with ${[...game.actors].sort((a, b) => b.kills - a.kills)[0].kills} kills`;
    if (game.endXp) e.endSub.textContent += `  -  +${game.endXp} XP`;
    this.buildTable(game, e.endTable);
    e.endscreen.classList.remove('hidden');
    this.el.dead.classList.add('hidden');
  }

  buildTable(game, table) {
    if (game.mode.zm) {
      const rows = game.actors.filter((a) => !a.zombie && !a.dummy).sort((a, b) => (b.pts | 0) - (a.pts | 0));
      let h = '<tr><th>Player</th><th>Points</th><th>Kills</th><th>Deaths</th></tr>';
      for (const a of rows) h += `<tr class="ally${a.isPlayer ? ' me' : ''}"><td>${a.name}${a.isPlayer ? ' (you)' : ''}</td><td>${a.pts | 0}</td><td>${a.kills}</td><td>${a.deaths}</td></tr>`;
      table.innerHTML = h; return;
    }
    const rows = [...game.actors].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    let html = '<tr><th>Player</th><th>Kills</th><th>Deaths</th><th>K/D</th></tr>';
    for (const a of rows) {
      const cls = game.mode.team ? (a.team === game.player.team ? 'ally' : 'enemy') : (a.isPlayer ? 'ally' : '');
      html += `<tr class="${cls}${a.isPlayer ? ' me' : ''}"><td>${a.name}${a.isPlayer ? ' (you)' : ''}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${(a.kills / Math.max(1, a.deaths)).toFixed(2)}</td></tr>`;
    }
    table.innerHTML = html;
  }

  update(game) {
    const p = game.player, w = p.weapon, e = this.el;
    // scores + timer
    if (game.mode.zm) { const z = game.zm; this.set('sbL', `ROUND ${z && z.round ? z.round : '-'}`); this.set('sbR', `${z ? z.left : 0} ZOMBIES`); this.updateZm(game); }
    else if (game.mode.sandbox) { this.set('sbL', `DUMMIES ${game.actors.filter((a) => a.dummy).length}`); this.set('sbR', `KILLS ${p.kills}`); }
    else if (game.mode.team) { this.set('sbL', `ALLIES ${game.teamScore[p.team % 2]}`); this.set('sbR', `${game.teamScore[1 - (p.team % 2)]} ENEMY`); }
    else {
      const sorted = [...game.actors].sort((a, b) => b.kills - a.kills);
      this.set('sbL', `YOU ${p.kills}`);
      const top = sorted[0].isPlayer && sorted[1] ? sorted[1] : sorted[0];
      this.set('sbR', `${top.name.toUpperCase()} ${top.kills}`);
    }
    const tl = Math.ceil(game.timeLeft);
    const surv = game.zm ? game.zm.survT | 0 : 0;
    this.set('timer', game.mode.zm ? `${Math.floor(surv / 60)}:${String(surv % 60).padStart(2, '0')}` : game.mode.sandbox ? 'SANDBOX' : `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`);
    // health
    const hp = Math.max(0, Math.ceil(p.hp));
    e.hpfill.style.width = `${hp}%`;
    e.hpfill.style.background = hp > 60 ? '#5fd35f' : hp > 30 ? '#e6b422' : '#e04a3a';
    this.set('hptxt', String(hp));
    e.vignette.style.opacity = String(Math.max(0, (1 - hp / 100) * 0.9 - 0.05));
    // ammo
    const am = p.ammo[p.cur];
    this.set('wname', w.name); this.set('mag', String(am.mag)); this.set('res', `/ ${am.res}`);
    e.mag.classList.toggle('low', am.mag <= Math.ceil(w.mag * 0.25));
    const o = p.weapons[1 - p.cur]; this.set('wsec', `${p.cur === 0 ? '2' : '1'}  ${o.name}  ${p.ammo[1 - p.cur].mag}`);
    // reload / low ammo prompt
    if (this.msgT > 0) { this.msgT -= game.dt || 1 / 60; if (this.msgT <= 0) e.msg.classList.remove('show'); }
    if (p.reloading && !(this.msgT > 0)) { e.msg.textContent = 'RELOADING'; e.msg.classList.add('show'); this.msgT = 0.05; }
    // crosshair
    const sp = game.currentSpread(p);
    const px = Math.min(80, 4 + sp * (window.innerHeight / 2) / Math.tan((game.camera.fov * Math.PI / 180) / 2));
    const gap = this.xh.gap + (this.xh.dyn ? Math.max(0, px - 4) : 0);
    if (this.xhGap !== gap.toFixed(1)) { this.xhGap = gap.toFixed(1); e.crosshair.style.setProperty('--gap', `${this.xhGap}px`); }
    e.crosshair.style.opacity = (p.ads > 0.3 && !game.tp) || !p.alive ? '0' : '1';
    // dead
    if (!p.alive) this.set('deadSub', `${this.deadWeapon || ''}  -  ${game.mode.oneLife || game.mode.zm ? (game.mode.zm ? 'you come back at the start of the next round' : 'waiting for the next round') : `respawning in ${Math.max(0, Math.ceil(p.respawnT))}`}`);
    // scoreboard
    this.sbT -= game.dt || 1 / 60;
    e.scoreboard.classList.toggle('hidden', !game.showScore);
    if (game.showScore && this.sbT <= 0) { this.sbT = 0.25; this.buildTable(game, e.scoreboard.querySelector('table')); }
    if (game.net) this.set('netinfo', game.net.role === 'host' ? `HOST - ${game.actors.length} players` : `PING ${Math.round(game.net.ping)} ms - ${game.actors.length} players`);
    if (game.streaks && !game.net) this.set('streakbar', game.streaks.html, true); else this.set('streakbar', '', true);
    const oh = game.obj ? game.obj.hudHtml : ''; e.objhud.classList.toggle('hidden', !oh); this.set('objhud', oh, true);
    this.drawRadar(game);
  }

  drawRadar(game) {
    const c = this.rctx, R = 75, S = 2.3, p = game.player, b = game.map.bounds;
    c.clearRect(0, 0, 150, 150);
    c.save(); c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(8,12,16,0.72)'; c.fillRect(0, 0, 150, 150);
    c.translate(R, R); c.rotate(p.yaw); c.scale(S, S); c.translate(-p.pos.x, -p.pos.z);
    c.drawImage(this.radarMap, b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    for (const a of game.actors) {
      if (a === p || !a.alive) continue;
      const ally = game.mode.team && a.team === p.team;
      const pinged = game.time - a.lastShot < 1.6 || (game.streaks && game.streaks.uav > 0) || (a.zombie && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < 22);
      if (!ally && !pinged) continue;
      c.fillStyle = ally ? '#58b4ff' : '#ff5a4a';
      c.beginPath(); c.arc(a.pos.x, a.pos.z, 1.5, 0, Math.PI * 2); c.fill();
    }
    if (game.obj) game.obj.drawRadar(c);
    c.restore();
    // player marker + ring
    c.save(); c.translate(R, R); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.stroke();
  }
}
