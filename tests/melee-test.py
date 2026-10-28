"""Knives: tap V = quick lunge kill, hold V = knife out + slash, 1/2 puts it away; all five knives build. Usage: python3 tests/melee-test.py"""
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
SETUP = """() => { const g = window.__game; g.start({mode:'sandbox',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'easy'}); g.state='playing'; g.matchT = 5;
  const p = g.player; p.pos.set(300, 0, 300); p.yaw = 0; p.pitch = 0; p.protT = 0; for (let f = 0; f < 5; f++) g.frame(1/60);
  g.sandboxSpawn(1); const d = g.actors.find(a => a.dummy); d.pos.set(300, 0, 297.8); d.hp = 100; d.protT = 0; d.alive = true; window.__d = d; return !!d; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    check('all knives build', pg.evaluate("import('/js/weapons.js').then(async W => { const G = await import('/js/gunmodels.js'); return W.KNIVES.every(id => { const m = G.buildGun(W.WEAPONS[id]); return m.children.length > 4 && m.userData.grip; }); })"))
    check('setup', pg.evaluate(SETUP))
    pg.keyboard.press('KeyV'); pg.evaluate("() => { for (let f = 0; f < 60; f++) window.__game.frame(1/60); }")
    check('tap V lunge kills a dummy in reach', pg.evaluate("window.__d.hp <= 0 || !window.__d.alive"))
    pg.evaluate(SETUP)
    pg.keyboard.down('KeyV'); pg.evaluate("() => { for (let f = 0; f < 30; f++) window.__game.frame(1/60); }"); pg.wait_for_timeout(450)
    pg.evaluate("() => { for (let f = 0; f < 5; f++) window.__game.frame(1/60); }"); pg.keyboard.up('KeyV')
    check('hold V takes the knife out', pg.evaluate("window.__game.knifeOut === true && window.__game.swing === null"))
    pg.evaluate("() => { const g = window.__game; g.fireEdge = true; g.frame(1/60); }")
    check('LMB starts a slash', pg.evaluate("window.__game.swing && window.__game.swing.kind === 'slash'"))
    pg.evaluate("() => { for (let f = 0; f < 90; f++) window.__game.frame(1/60); }")
    check('slash hurts (60) not kills', pg.evaluate("window.__d.hp > 0 && window.__d.hp <= 45"))
    pg.keyboard.press('Digit1'); pg.evaluate("() => { for (let f = 0; f < 20; f++) window.__game.frame(1/60); }")
    check('1 puts the knife away', pg.evaluate("window.__game.knifeOut === false"))
    pg.evaluate("() => { window.__game.knifeId = 'k_machete'; }"); pg.keyboard.press('KeyV'); pg.evaluate("() => { for (let f = 0; f < 80; f++) window.__game.frame(1/60); }")
    check('other knife works too', pg.evaluate("!window.__d.alive || window.__d.hp <= 0"))
    b.close()
print(errs[:2]); print('PASS' if ok and not errs else 'FAIL')
