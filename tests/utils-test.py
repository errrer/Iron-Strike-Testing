"""Utilities: 2 per life, keys 3/4. Usage: python3 tests/utils-test.py"""
import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); errs = []; ok = True
def check(n, c):
    global ok; print(('ok   ' if c else 'FAIL ') + n); ok = ok and bool(c)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("() => { localStorage.clear(); }")
    pg.evaluate("() => { const g = window.__game; g.start({mode:'ffa',map:'dust',mapName:'D',primary:'ak47',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; g.matchT = 5; }")
    check('class screen has utility pickers', pg.evaluate("() => document.getElementById('util1').options.length >= 3"))
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, v = g.actors.find(a => a !== p); g.utilIds = ['frag', 'flash']; g.col.boxes.length = 0;
      p.team = 0; v.team = 1; p.alive = true; p.pos.set(0, 0, 0); v.pos.set(0, 0, -4); v.hp = 100; v.alive = true; v.protT = 0; p.yaw = 0; p.pitch = -1.2; g.utils.refill();
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' }));
      const first = g.utils.items.length, left = p.utilLeft.slice();
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit3' })); document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' }));
      const again = g.utils.items.length;
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4' })); const two = g.utils.items.length;
      return [first, left, again, two]; }""")
    check('key 3 throws the first utility', r[0] == 1 and r[1][0] == 0 and r[1][1] == 1)
    check('only one use per slot', r[2] == 1)
    check('key 4 throws the second', r[3] == 2)
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, v = g.actors.find(a => a !== p); g.utils.items.length = 0; v.hp = 100; v.alive = true; v.pos.set(0, 0, -3); p.pos.set(0, 0, 10);
      g.utils.detonate({ id: 'frag', m: { position: { x: 0, y: 0.3, z: -3 } } }); const hp = v.hp; v.hp = 100; v.alive = true; v.stunT = 0;
      g.utils.detonate({ id: 'flash', m: { position: { x: 0, y: 1, z: -3 } } }); const st = v.stunT;
      g.utils.detonate({ id: 'smoke', m: { position: { x: 5, y: 0, z: 5 } } });
      return [hp, st, g.utils.inSmoke(5, 1.3, 5), g.utils.inSmoke(30, 1, 30)]; }""")
    check('frag hurts', r[0] < 100); check('flash stuns bots', r[1] > 0); check('smoke cloud exists', r[2] and not r[3])
    pg.evaluate("() => { const g = window.__game; g.player.alive = false; g.spawn(g.player); }")
    check('respawn refills utilities', pg.evaluate("() => window.__game.player.utilLeft.join() === '1,1'"))
    b.close()
print(errs[:3]); print('PASS' if ok and not errs else 'FAIL')
