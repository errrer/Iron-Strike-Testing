"""Dirt bike race UI under the three stub. Usage: python3 tests/race-test.py"""
import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); errs = []; ok = True
def check(n, c, i=''):
    global ok; ok &= bool(c); print(('ok   ' if c else 'FAIL ') + n, i)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 700})
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(900)
    pg.click('#lRace'); pg.select_option('#rLaps', '0'); pg.click('#rGo'); pg.wait_for_timeout(100)
    r = pg.evaluate("""() => { const g = window.__game, R = g.race, p = R.sim.player, o = {};
      R.keys.KeyW = true; for (let i = 0; i < 60 * 5; i++) g.frame(1/60);
      R.keys.ShiftLeft = true; for (let i = 0; i < 60 * 1.5; i++) g.frame(1/60); o.wh = p.wh; o.pitchUp = p.pitch; o.nit1 = p.boosting;
      R.keys.ShiftLeft = false; for (let i = 0; i < 60 * 1.5; i++) g.frame(1/60); o.whOff = p.wh;
      R.keys.Space = true; for (let i = 0; i < 30; i++) g.frame(1/60); o.boost = p.boosting; R.keys.Space = false;
      R.keys.KeyW = true; const x0 = p.x, z0 = p.z; for (let i = 0; i < 60 * 40; i++) { g.frame(1/60); if (Math.hypot(p.x - x0, p.z - z0) > 900) break; }
      o.far = Math.hypot(p.x - x0, p.z - z0); o.bounds = R.sim.track.bounds; o.pos = [p.x, p.z]; o.sus = R.meshes[0].sus; return o; }""")
    print(r)
    check('Shift = wheelie (no nitro)', r['wh'] > 0.5 and not r['nit1'] and r['pitchUp'] > 0.3)
    check('wheelie drops again', r['whOff'] < 0.1)
    check('Space = nitro', r['boost'])
    check('free ride: can leave the track area', not (r['bounds']['x0'] < r['pos'][0] < r['bounds']['x1'] and r['bounds']['z0'] < r['pos'][1] < r['bounds']['z1']) or r['far'] > 600, r['far'])
    check('suspension state exists', r['sus'] is not None)
    z = pg.evaluate("() => { const g = window.__game, R = g.race, p = R.sim.player; p.update(0, {thr: 1, brk: 0, steer: 0}); R.sim.update(0, {thr: 1, brk: 0, steer: 0}); for (let i = 0; i < 5; i++) g.frame(0); g.frame(1/60); const c = R.camera.position; return [Number.isFinite(p.y), Number.isFinite(c.x + c.y + c.z)]; }")
    check('zero-length frames cannot break the bike or camera', z == [True, True], z)
    b.close()
print(errs[:3]); print('PASS' if ok and not errs else 'FAIL')
