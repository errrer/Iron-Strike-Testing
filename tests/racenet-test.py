"""Online dirt bike race: lobby, start, state relay between a host and two clients (fake PeerJS), plus the UI wiring. Usage: python3 tests/racenet-test.py"""
import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); fake = open('tests/fake-peer.js').read(); errs = []; ok = True
def check(n, c, i=''):
    global ok; ok &= bool(c); print(('ok   ' if c else 'FAIL ') + n, i)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 700})
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.add_init_script(fake)
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(900)
    # solo: bots select
    pg.click('#lRace'); pg.select_option('#rBots', '0'); pg.select_option('#rLaps', '1'); pg.click('#rGo'); pg.wait_for_timeout(100)
    check('solo with no bots = one rider', pg.evaluate("window.__game.race.sim.bikes.length") == 1)
    pg.evaluate("window.__game.race.exit()"); pg.click('#lRace'); pg.select_option('#rBots', '3'); pg.click('#rGo'); pg.wait_for_timeout(100)
    check('solo with 3 bots = four riders', pg.evaluate("window.__game.race.sim.bikes.length") == 4)
    pg.evaluate("window.__game.race.exit()")
    # net level: host + 2 clients
    r = pg.evaluate("""async () => {
      const B = window.__bus, { RaceNet } = await import('/js/racenet.js'), { RaceSim } = await import('/js/race-core.js'); const out = {};
      const mk = (tag) => { const o = { tag, lobby: null, go: null, left: [], rows: 0, closed: null }; o.ui = { lobby: (l) => { o.lobby = l; }, go: (i) => { o.go = i; }, apply: (r) => { o.rows++; o.last = r; }, left: (n) => o.left.push(n), closed: (w) => { o.closed = w; }, collect: () => o.own || [] }; o.net = new RaceNet(o.ui); return o; };
      const H = mk('h'), A = mk('a'), C = mk('c');
      const wait = (s) => B.pumpAsync(s);
      const code = await (async () => { const pr = H.net.host('Hosty', 'Red'); await wait(0.3); return pr; })();
      out.code = code.length;
      const ja = A.net.join(code, 'Ann', 'Red'); await wait(0.5); await ja; const jc = C.net.join(code, 'Cal', 'Blue'); await wait(0.5); await jc;
      out.players = H.lobby.players.length; out.colors = H.lobby.players.map((p) => p.color).join(','); out.clientSees = A.lobby.players.length;
      H.net.setOpts({ bots: 5, laps: 1 }); await wait(0.2); out.clientOpts = A.net.opts.bots + '/' + A.net.opts.laps;
      const err = H.net.start(); await wait(0.3);
      out.err = err; out.roster = A.go && A.go.roster.length; out.bots = A.go && A.go.roster.filter((r) => r.bot).length; out.laps = C.go && C.go.laps;
      // sims
      const sims = {}; for (const o of [H, A, C]) { const me = o.net.myId; sims[o.tag] = new RaceSim({ laps: o.go.laps, riders: o.go.roster.map((r) => ({ nid: r.nid, name: r.name, color: 0, kind: r.bot ? (o.net.role === 'host' ? 'bot' : 'remote') : (r.nid === me ? 'me' : 'remote') })) }); o.sim = sims[o.tag]; }
      out.hostBots = sims.h.bikes.filter((b) => !b.remote && !b.isPlayer).length; out.clientBots = sims.a.bikes.filter((b) => !b.remote && !b.isPlayer).length;
      // drive: each owner updates its own bikes, publishes, receives
      const col = (o) => o.sim.bikes.filter((b) => !b.remote).map((b) => [b.nid, b.x, b.y, b.z, b.yaw, b.pitch, b.roll, b.speed, b.st, b.thr, 8, b.prog, b.lap, 0, b.nitro, 0]);
      for (let i = 0; i < 200; i++) {
        for (const o of [H, A, C]) { o.sim.update(0.025, { thr: 1, brk: 0, steer: 0, boost: false }); o.own = col(o); o.net.tick(0.05); B.advance(0.025); }
        for (const o of [A, C]) if (o.last) { for (const r of o.last) { const bk = o.sim.bikes.find((x) => x.nid === r[0]); if (bk && bk.remote) { bk.x = r[1]; bk.z = r[3]; bk.prog = r[11]; } } }
      }
      const ba = sims.a.bikes.find((b) => b.nid === 0), bb = sims.h.bikes.find((b) => b.nid === 1), bc = sims.a.bikes.find((b) => b.nid === 2), bot = sims.a.bikes.find((b) => b.nid === 100);
      out.seesHost = ba.remote && Math.abs(ba.z - sims.h.bikes.find((b) => b.nid === 0).z) < 8; out.seesCal = bc.remote && Math.hypot(bc.x - sims.c.player.x, bc.z - sims.c.player.z) < 10; out.seesBot = bot.remote && Math.abs(bot.prog - sims.h.bikes.find((b) => b.nid === 100).prog) < 40;
      out.rows = A.rows > 50; out.hostSeesAnn = Math.hypot(sims.h.bikes.find((b) => b.nid === 1).x - 0, 0) >= 0;
      // a client leaves
      C.net.leave(); await wait(0.3); out.left = H.left.join(','); out.hostPlayers = H.lobby.players.length;
      H.net.leave(); await wait(0.5); out.closed = A.closed;
      return out; }""")
    check('room code is 6 letters', r['code'] == 6)
    check('host sees 3 players, unique colours', r['players'] == 3 and len(set(r['colors'].split(','))) == 3, r['colors'])
    check('clients see the lobby', r['clientSees'] == 3)
    check('host options reach the clients', r['clientOpts'] == '5/1', r['clientOpts'])
    check('start gives everyone the same roster (3 humans + 5 bots)', r['err'] is None and r['roster'] == 8 and r['bots'] == 5 and r['laps'] == 1, str(r))
    check('only the host simulates bots', r['hostBots'] == 5 and r['clientBots'] == 0)
    check('riders see each other', r['seesHost'] and r['seesCal'] and r['seesBot'] and r['rows'], str(r))
    check('leaving is announced', r['left'] == '2' and r['hostPlayers'] == 2, str(r['left']))
    check('host closing kicks clients', r['closed'] and 'host' in r['closed'].lower(), str(r['closed']))
    # UI: online panel
    pg.reload(); pg.wait_for_timeout(900); pg.click('#lRace'); pg.click('#rOnline'); pg.wait_for_timeout(100)
    check('online panel opens', pg.evaluate("!document.getElementById('raceNet').classList.contains('hidden')"))
    pg.click('#rnHost'); pg.wait_for_timeout(800)
    check('room created from the UI', pg.evaluate("document.getElementById('rnCodeTxt').textContent.length") == 6 and pg.evaluate("!document.getElementById('rnRoom').classList.contains('hidden')"))
    pg.select_option('#rnBots', '0'); pg.select_option('#rnLaps', '1'); pg.click('#rnStart'); pg.wait_for_timeout(300)
    check('race starts online without bots', pg.evaluate("window.__game.state === 'race' && window.__game.race.sim.bikes.length") == 1)
    pg.evaluate("() => { const g = window.__game; for (let i = 0; i < 60 * 5; i++) g.frame(1/60); }")
    check('online race runs (countdown over)', pg.evaluate("window.__game.race.sim.state") == 'racing')
    pg.evaluate("window.__game.race.exit()")
    check('exit leaves the room and returns to the landing', pg.evaluate("window.__game.race === null && !document.getElementById('landing').classList.contains('hidden')"))
    b.close()
print('\n'.join(errs[:6])); check('no page errors', not errs); print('PASS' if ok else 'FAIL'); raise SystemExit(0 if ok else 1)
