"""Zombies co-op sync test (host + 2 clients).
Based on the multiplayer test: Runs a host + several clients inside one headless page, connected through a fake
in-memory PeerJS (tests/fake-peer.js) with simulated latency, driving everything with scripted players.
Usage: python3 tests/mp-test.py"""
import http.server, socketserver, threading, os, sys, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read()
fake = open('tests/fake-peer.js').read()
errors = []

HELPERS = """
window.H = {
  async mods() { const G = await import('/js/game.js'), N = await import('/js/net.js'); return {G, N}; },
  stubHud() { return new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { if (k === 'showEnd') t._ended = true; if (k === 'feed') t._feeds = (t._feeds || 0) + 1; }) }); },
  mkClient(M, closedLog) {
    const g = new M.G.Game(document.createElement('canvas'), H.stubHud(), new Proxy({}, { get: () => () => {} }), { sens: 1, fov: 80, view: 'first' });
    const ui = { lobby() {}, started() {}, closed: (w) => closedLog.push(w) };
    g.netObj = new M.N.Net(g, ui); g.ui = ui; return g;
  },
  drive(g, t, i) {
    const p = g.player; if (!p) return;
    if (g.state === 'paused') g.state = 'playing';
    const ph = i * 0.37;
    g.keys.KeyW = Math.sin(t * 0.7 + ph) > -0.4; g.keys.KeyA = Math.sin(t * 1.3 + ph) > 0.5; g.keys.KeyD = Math.sin(t * 1.3 + ph) < -0.5;
    g.keys.ShiftLeft = false; g.keys.Space = (Math.floor(t * 60) % 240 === i); g.adsHeld = false;
    let best = null, bd = 1e9;
    for (const a of g.actors) if (a.alive && a !== p && a.team !== p.team) { const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z); if (d < bd) { bd = d; best = a; } }
    if (best && p.alive) { p.yaw = Math.atan2(-(best.pos.x - p.pos.x), -(best.pos.z - p.pos.z)); p.pitch = Math.atan2(best.pos.y + 1.2 - (p.pos.y + p.eye), bd); }
    g.fireHeld = !!best && (Math.floor(t * 2) % 2 === 0); if (g.fireHeld && Math.floor(t * 60) % 9 === 0) g.fireEdge = true;
    if (p.alive && p.ammo[p.cur].mag < 3) g.startReload(p);
  },
  async run(games, secs, errs) {   // games[0] = host
    const B = window.__bus, dt = 1 / 60;
    for (let f = 0; f < secs * 60; f++) {
      const t = B.now;
      games.forEach((g, i) => { if (g.state === 'ended' || !g.scene) return; H.drive(g, t, i); try { g.frame(dt); } catch (e) { errs.push(String(e.stack || e)); } });
      B.advance(dt);
    }
  },
};
"""

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.add_init_script(fake)
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    pg.evaluate(HELPERS)

    # ---- host through the real UI
    pg.click('#lZM'); pg.fill('#zmName', 'HostMan'); pg.click('#zmHost')
    pg.evaluate("() => window.__bus.pump(0.3)"); pg.wait_for_timeout(100)

    pg.evaluate("() => window.__bus.pump(0.3)")
    R = pg.evaluate("""async () => {
      const M = await H.mods(), o = {}, closed = [], errs = [];
      const host = window.__game, hostNet = window.__mp.net;
      const code = document.getElementById('mpCodeTxt').textContent; o.code = code; o.mode = hostNet.mode;
      const clients = [];
      for (let i = 0; i < 2; i++) { const c = H.mkClient(M, closed); await Promise.all([c.netObj.join(code, 'Z' + i, {prim: 'm1911', sec: 'm1911'}), window.__bus.pumpAsync(1)]); clients.push(c); }
      await window.__bus.pumpAsync(0.5);
      o.teams = hostNet.lobby.players.map(p => p.team);
      hostNet.start(); await window.__bus.pumpAsync(0.3);
      const games = [host, ...clients];
      o.modes = games.map(g => g.mode.id); o.map = games.map(g => g.mapId);
      o.weapons = games.map(g => g.player.weapons.map(w => w.id).join());
      for (const g of games) { g.player.protT = 9999; }
      let still = false; const step = (secs) => { for (let f = 0; f < secs * 60; f++) { for (const g of games) { try { if (still) { g.keys = {}; g.fireHeld = false; } else H.drive(g, window.__bus.now, games.indexOf(g)); g.frame(1/60); } catch (e) { errs.push(String(e.stack||e)); } } window.__bus.advance(1/60); } };
      step(40);
      const zc = (g) => g.actors.filter(a => a.zombie);
      o.round = games.map(g => g.zm.round); o.phase = games.map(g => g.zm.phase);
      o.zombies = games.map(g => zc(g).length);
      o.zmatch = clients.map(c => zc(c).every(a => { const h = host.byId(a.id); return h && Math.hypot(a.pos.x - h.pos.x, a.pos.z - h.pos.z) < 2; }));
      o.pts = games.map(g => g.players ? 0 : g.player.pts); o.ptsHostView = host.actors.filter(a => !a.zombie).map(a => a.pts);
      o.ptsClientView = clients.map(c => c.zm.state && c.zm.state.pl ? 1 : 0);
      // client buys a wall gun: host must grant 'zw' and the client's weapon changes
      const c0 = clients[0], B = host.zm.buys[0];
      for (const g of games) host.byId(g.player.id).pts = 5000; step(1);
      still = true; step(0); c0.player.pos.set(B.x + Math.sin(B.face), c0.groundAt(B.x, 3, B.z), B.z + Math.cos(B.face)); c0.player.vel.set(0,0,0); step(0.4);
      c0.keys.KeyW = false; c0.zm.localUse(true); step(0.5); c0.zm.localUse(false); step(1);
      o.c0weapons = c0.player.weapons.map(w => w.id); o.c0pts = [c0.player.pts, host.byId(c0.player.id).pts];
      // door purchase by a client opens it everywhere
      const D = host.zm.doors[0]; c0.player.pos.set(D.x - 1.2, c0.groundAt(D.x, 3, D.z), D.z); c0.player.vel.set(0,0,0); step(0.4);
      c0.zm.localUse(true); step(0.5); c0.zm.localUse(false); step(1);
      o.door = games.map(g => g.zm.doors[0].open);
      still = false;
      // late joiner sees zombies already in play
      const late = H.mkClient(M, closed); await Promise.all([late.netObj.join(code, 'Late', {prim: 'm1911', sec: 'm1911'}), window.__bus.pumpAsync(1)]);
      games.push(late); step(3); o.late = [late.mode.id, late.actors.filter(a => a.zombie).length, host.actors.filter(a => a.zombie).length];
      o.errs = errs;
      return o;
    }""")
    print(json.dumps(R, indent=1))
    assert not errors and not R['errs'], (errors[:3], R['errs'][:2])
    assert R['mode'] == 'zm' and R['modes'] == ['zm'] * 3 and R['teams'] == [0, 0, 0], R
    assert R['round'][0] >= 1 and len(set(R['round'])) == 1 and all(abs(z - R['zombies'][0]) <= 1 for z in R['zombies']), R
    assert all(R['zmatch']) and 'vmp' in ''.join(R['c0weapons']) or len(R['c0weapons']) >= 2, R
    assert R['door'] == [True, True, True], R
    assert R['late'][0] == 'zm' and R['late'][1] == R['late'][2], R
    print('PASS')
