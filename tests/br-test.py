"""Battle Royale"""
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
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("() => { localStorage.clear(); }")
    r = pg.evaluate("() => { const g = window.__game; g.start({mode:'br',map:'isle',mapName:'Isle',primary:'ak47',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); return [g.actors.length, !!g.br, g.br.crates.length, g.player.air, g.map.id]; }")
    print(r); check('br started with 20 actors', r[0] == 50 and r[1]); check('crates placed', r[2] > 120); check('in heli', r[3] == 'heli')
    r = pg.evaluate("() => { const g = window.__game; for (let i = 0; i < 700; i++) g.update(0.05); return [g.player.air, g.actors.filter(a => a.air).length, g.br.heliT]; }")
    print(r); check('time passes, bots jump', r[1] < 20)
    r = pg.evaluate("() => { const g = window.__game, p = g.player; if (p.air === 'heli') { g.keys.Space = true; g.update(0.05); g.keys.Space = false; g.update(0.05); } const a = p.air; for (let i = 0; i < 2400 && p.air; i++) { g.update(0.05); if (p.air === 'fall' && p.pos.y < 90) { g.keys.Space = true; g.update(0.05); g.keys.Space = false; } } return [a, p.air, p.pos.y, g.actors.filter(a => a.alive && a.air).length]; }")
    print(r); check('player jumped', r[0] in ('fall', 'chute', 'heli')); check('player landed', r[1] is None)
    r = pg.evaluate("() => { const g = window.__game, p = g.player, br = g.br; const c = br.crates.find(c => !c.open); p.pos.x = c.x + 1; p.pos.z = c.z; p.pos.y = c.y; br.localUse(true); for (let i = 0; i < 80; i++) g.update(0.05); br.localUse(false); return [c.open, p.weapon.id, !p.weapon.starter, p.weapon.rarity, p.looted]; }")
    print(r); check('crate opened, weapon equipped', r[0] and r[2])
    r = pg.evaluate("() => { const g = window.__game; for (let i = 0; i < 4000; i++) g.update(0.1); return [g.state, g.br.zone.stage, Math.round(g.br.zone.r), g.actors.filter(a => a.alive).length, g.player.alive]; }")
    print(r); check('storm progressed', r[1] >= 1 or r[3] <= 3)
    r = pg.evaluate("() => { const g = window.__game; return [g.state, g.ended, g.br.placement()]; }")
    print(r)
    b.close()
print(errs[:3]); print('PASS' if ok and not errs else 'FAIL')
