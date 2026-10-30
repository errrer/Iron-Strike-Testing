"""Killcam + best plays. Usage: python3 tests/killcam-test.py"""
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
    pg.evaluate("() => { const g = window.__game; g.start({mode:'tdm',map:'dust',mapName:'D',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; g.matchT = 5; }")
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, bots = g.actors.filter(a => a !== p);
      const [a, b2, c] = bots; for (const v of [a, b2, c]) v.pos.set(p.pos.x + 60, p.pos.y, p.pos.z);
      g.kill(a, p, p.weapon, true); g.time += 1; g.kill(b2, p, p.weapon, false); g.time += 1; g.kill(c, p, p.weapon, false);
      return g.bestPlays(5).map(x => x.text); }""")
    check('multi-kill + long shot recorded', any('Triple' in t for t in r) and any('m ' in t for t in r))
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, k = g.actors.find(a => a !== p && a.team !== p.team) || g.actors.find(a => a !== p);
      g.kill(p, k, k.weapon, false); p.deathT = 2; for (let i = 0; i < 5; i++) g.render(0.016); const kc = g._kc;
      document.getElementById('endTitle'); g.hud.showPlays(g); return [kc, document.getElementById('dead').className.includes('killcam'), document.getElementById('endPlays').innerHTML.includes('BEST PLAYS')]; }""")
    check('killcam active and banner shown', r[0] == 1 and r[1])
    check('best plays panel renders', r[2])
    r = pg.evaluate("() => { const g = window.__game; g.spawn(g.player); g.render(0.016); return g._kc; }")
    check('killcam ends on respawn', not r)
    b.close()
print(errs[:2]); print('PASS' if ok and not errs else 'FAIL')
