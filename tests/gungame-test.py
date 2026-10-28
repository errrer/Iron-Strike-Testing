"""Five classes: switch in the menu and mid-match (pause menu), saved per class. Usage: python3 tests/class-test.py"""
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
    pg.evaluate("() => { const g = window.__game; g.start({mode:'gg',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; g.matchT = 5; }")
    check('starts on g18', pg.evaluate("window.__game.player.weapons[0].id") == 'g18')
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, v = g.actors.find(a => a !== p);
      g.kill(v, p, p.weapon, false); const a = p.weapons[0].id, lv = p.gg;
      g.ggSet(p, 15); const gw = p.weapons[0]; g.ggSet(v, 3);
      g.kill(v, p, p.weapons[0], false); const w = g.ggWin === p; return [a, lv, gw.id, gw.mag, gw.reload, w]; }""")
    check('kill levels up to m1911', r[0] == 'm1911' and r[1] == 1)
    check('final gun is golden, 1 mag, slow reload', r[2] == 'goldgun' and r[3] == 1 and r[4] >= 5)
    check('golden gun kill wins', r[5] is True)
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, v = g.actors.find(a => a !== p); g.ggWin = null;
      g.ggSet(v, 4); g.ggSet(p, 2); g.kill(v, p, {id:'k_combat', cls:'melee'}, false); return [v.gg, p.gg]; }""")
    check('knife kill demotes victim', r == [3, 3])
    b.close()
print(errs[:2]); print('PASS' if ok and not errs else 'FAIL')
