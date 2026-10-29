// Online dirt bike racing (WebRTC via PeerJS, same no-server approach as the shooter).
//   HOST   = creates the room, owns the AI riders, and relays everybody's bike state to everybody 20 times a second.
//   CLIENT = drives its own bike locally (instant controls) and sends its state to the host.
// Each bike is simulated by whoever owns it, so there is no steering lag; the others are smoothed on screen.
import { loadPeerLib, openPeer, genCode, cleanCode, cleanName } from './net.js?v=0.17.2';

const PREFIX = 'ironstrike-race-v1-';
const PROTOCOL = 1;
export const MAX_HUMANS = 6, MAX_RIDERS = 8;
export const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple'];

export class RaceNet {
  // ui: { lobby(l), go(info), apply(rows), left(nid), closed(why), collect() -> [[nid, ...state]] for the bikes this machine owns }
  constructor(ui) {
    this.ui = ui; this.role = null; this.code = ''; this.myId = 0; this.peer = null; this.conn = null; this.conns = new Map();
    this.players = new Map(); this.nextId = 1; this.opts = { laps: 3, bots: 3, diff: 'normal' }; this.rows = new Map();
    this.acc = 0; this.hb = null; this.lastRx = 0; this.running = false;
  }
  get active() { return !!this.role; }

  sendTo(c, m) { try { if (c && c.open) c.send(m); } catch (e) { /* ignore */ } }

  lobbyState() {
    return { code: this.code, opts: this.opts, running: this.running, players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color })) };
  }
  pushLobby() { this.lobby = this.lobbyState(); for (const c of this.conns.values()) this.sendTo(c, { t: 'lobby', lobby: this.lobby }); this.ui.lobby(this.lobby); }

  uniqueName(n) { const used = new Set([...this.players.values()].map((p) => p.name)); let out = n, i = 2; while (used.has(out)) out = `${n.slice(0, 11)}${i++}`; return out; }
  freeColor(want) {
    const used = new Set([...this.players.values()].map((p) => p.color)); want = COLOR_NAMES.includes(want) ? want : COLOR_NAMES[0];
    return used.has(want) ? (COLOR_NAMES.find((c) => !used.has(c)) || want) : want;
  }

  // ---------------------------------------------------------------- host
  async host(name, color) {
    await loadPeerLib();
    let code = '', peer = null;
    for (let i = 0; i < 8 && !peer; i++) { code = genCode(); try { peer = await openPeer(PREFIX + code); } catch (e) { if (!e || e.type !== 'unavailable-id') throw e; } }
    if (!peer) throw new Error('Could not reserve a room code, try again.');
    this.role = 'host'; this.code = code; this.peer = peer; this.myId = 0;
    this.players.set(0, { id: 0, name: cleanName(name), color: COLOR_NAMES.includes(color) ? color : 'Red' });
    peer.on('connection', (c) => this.hostConn(c));
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
    peer.on('error', (e) => console.warn('[racenet] peer error', e && e.type));
    this.startWatch(); this.pushLobby();
    return code;
  }

  hostConn(c) {
    c.lastRx = performance.now();
    c.on('data', (m) => { c.lastRx = performance.now(); try { this.hostData(c, m); } catch (e) { console.error('[racenet] host data', e); } });
    c.on('close', () => this.hostDrop(c)); c.on('error', () => this.hostDrop(c));
  }

  hostData(c, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join') {
      if (c.pid != null) return;
      if (m.v !== PROTOCOL) { this.sendTo(c, { t: 'deny', why: 'Version mismatch - refresh the page.' }); setTimeout(() => c.close(), 300); return; }
      if (this.players.size >= MAX_HUMANS) { this.sendTo(c, { t: 'deny', why: 'Room is full.' }); setTimeout(() => c.close(), 300); return; }
      const id = this.nextId++; c.pid = id; this.conns.set(id, c);
      this.players.set(id, { id, name: this.uniqueName(cleanName(m.name)), color: this.freeColor(m.color) });
      this.sendTo(c, { t: 'welcome', id }); this.pushLobby(); return;
    }
    const id = c.pid; if (id == null) return;
    if (m.t === 's' && Array.isArray(m.a)) this.rows.set(id, m.a.map(Number));
    else if (m.t === 'col') { const p = this.players.get(id); if (p && !this.running) { p.color = this.freeColor(m.color === p.color ? '' : m.color); this.pushLobby(); } }
    else if (m.t === 'ping') this.sendTo(c, { t: 'pong' });
    else if (m.t === 'bye') this.hostDrop(c);
  }

  hostDrop(c) {
    const id = c.pid; if (id == null || !this.players.has(id)) return;
    this.players.delete(id); this.conns.delete(id); this.rows.delete(id);
    try { c.close(); } catch (e) { /* ignore */ }
    for (const o of this.conns.values()) this.sendTo(o, { t: 'left', id });
    this.ui.left(id); this.pushLobby();
  }

  setOpts(o) { if (this.role !== 'host') return; this.opts = { ...this.opts, ...o }; this.pushLobby(); }
  setMyColor(color) {
    if (this.role === 'host') { const p = this.players.get(0); p.color = this.freeColor(color === p.color ? '' : color); this.pushLobby(); }
    else this.sendTo(this.conn, { t: 'col', color });
  }

  // everybody who is here gets a grid slot (humans first, then AI riders), the host announces the race
  start() {
    if (this.role !== 'host') return 'Only the host can start the race.';
    const humans = [...this.players.values()], nb = Math.max(0, Math.min(this.opts.bots | 0, MAX_RIDERS - humans.length));
    const roster = humans.map((p) => ({ nid: p.id, name: p.name, color: p.color, bot: 0 }));
    const taken = new Set(humans.map((p) => p.color)), spare = COLOR_NAMES.filter((c) => !taken.has(c)).concat(COLOR_NAMES);
    const BN = ['Dusty', 'Mud', 'Roost', 'Kicker', 'Whip', 'Berm', 'Scrub', 'Nitro'];
    for (let i = 0; i < nb; i++) roster.push({ nid: 100 + i, name: BN[(i * 3 + 1) % BN.length], color: spare[i % spare.length], bot: 1 });
    const info = { t: 'go', roster, laps: this.opts.laps | 0 || 3, diff: this.opts.diff };
    this.running = true; this.rows.clear();
    for (const c of this.conns.values()) this.sendTo(c, info);
    this.ui.go(info); this.pushLobby();
    return null;
  }
  raceOver() { if (this.role === 'host') { this.running = false; this.pushLobby(); } }

  // ---------------------------------------------------------------- client
  async join(code, name, color) {
    code = cleanCode(code);
    if (code.length !== 6) throw new Error('Enter the 6-letter room code.');
    await loadPeerLib();
    const peer = await openPeer(null);
    this.peer = peer; this.role = 'client'; this.code = code;
    const conn = await new Promise((res, rej) => {
      const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const t = setTimeout(() => rej(new Error('Connection timed out. The host may be behind a strict firewall.')), 20000);
      peer.on('error', (e) => { clearTimeout(t); rej(e && e.type === 'peer-unavailable' ? new Error('No room with that code.') : new Error((e && e.message) || 'Connection failed.')); });
      c.on('open', () => { clearTimeout(t); res(c); });
      c.on('error', () => { clearTimeout(t); rej(new Error('Connection failed.')); });
    }).catch((e) => { this.leave(); throw e; });
    this.conn = conn;
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('The host did not answer.')), 10000);
      this.onWelcome = () => { clearTimeout(t); res(); }; this.onDeny = (why) => { clearTimeout(t); rej(new Error(why)); };
      conn.on('data', (m) => { try { this.clientData(m); } catch (e) { console.error('[racenet] client data', e); } });
      conn.on('close', () => this.closed('Disconnected from the host.'));
      conn.send({ t: 'join', v: PROTOCOL, name: cleanName(name), color });
    }).catch((e) => { this.leave(); throw e; });
    this.peer.on('error', (e) => console.warn('[racenet] peer error', e && e.type));
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) { /* ignore */ } });
    this.startWatch();
    return code;
  }

  clientData(m) {
    if (!m || typeof m !== 'object') return;
    this.lastRx = performance.now();
    switch (m.t) {
      case 'welcome': this.myId = m.id; if (this.onWelcome) this.onWelcome(); break;
      case 'deny': if (this.onDeny) this.onDeny(m.why); break;
      case 'lobby': this.lobby = m.lobby; this.running = !!m.lobby.running; this.opts = m.lobby.opts; this.players = new Map(m.lobby.players.map((p) => [p.id, p])); this.ui.lobby(m.lobby); break;
      case 'go': this.running = true; this.ui.go(m); break;
      case 'S': this.ui.apply(m.r); break;
      case 'left': this.ui.left(m.id); break;
      case 'bye': this.closed('The host closed the room.'); break;
      default: break;
    }
  }

  closed(why) { if (!this.role) return; this.leave(); this.ui.closed(why); }

  startWatch() {
    this.lastRx = performance.now(); clearInterval(this.hb);
    this.hb = setInterval(() => {                         // heartbeat + watchdog, independent of the frame loop
      if (this.role === 'client' && this.conn) { this.sendTo(this.conn, { t: 'ping' }); if (performance.now() - this.lastRx > 15000) this.closed('Connection lost (no data from the host for 15 s).'); }
      else if (this.role === 'host') { const n = performance.now(); for (const c of [...this.conns.values()]) if (n - (c.lastRx || n) > 25000) this.hostDrop(c); }
    }, 2000);
  }

  leave() {
    if (this.role === 'host') for (const c of this.conns.values()) this.sendTo(c, { t: 'bye' });
    else if (this.conn) this.sendTo(this.conn, { t: 'bye' });
    clearInterval(this.hb); const peer = this.peer;
    setTimeout(() => { try { if (peer) peer.destroy(); } catch (e) { /* ignore */ } }, 250);
    this.role = null; this.peer = null; this.conn = null; this.conns.clear(); this.players.clear(); this.rows.clear(); this.running = false;
  }

  // called every frame while racing: 20 packets per second
  tick(dt) {
    this.acc += dt; if (this.acc < 0.05) return; this.acc = 0;
    const own = this.ui.collect();
    if (this.role === 'client') { if (this.conn && own.length) this.sendTo(this.conn, { t: 's', a: own[0].slice(1).concat([]) }); }
    else if (this.role === 'host') {
      const r = own.slice();
      for (const [id, a] of this.rows) r.push([id, ...a]);
      const msg = { t: 'S', r };
      for (const c of this.conns.values()) this.sendTo(c, msg);
    }
  }
}
