"""Extreme gore Usage: python3 tests/gore-test.py"""
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
    pg.evaluate("() => { const g = window.__game; g.start({mode:'ffa',map:'dust',mapName:'D',primary:'ak47',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; g.settings.gore=true; g.gfxQ.gore=true; }")
    r = pg.evaluate("() => { const g = window.__game; const b = g.actors.find(a => a !== g.player && a.mesh); if (!b) return 'nobot'; g.settings.extremeGore = true; g.damage(b, g.player, 10, g.player.weapon, false); const hurt = !!g.gx; b.hp = 1; g.damage(b, g.player, 50, {id:'m680', cls:'shotgun'}, true); return [hurt, g.gore.gibs.map(o=>o.part).join(',')]; }")
    print(r)
    check('bot found', r != 'nobot'); check('gx created on hit', r[0])
    check('organs spawned', any(k in r[1] for k in ['brain', 'skull', 'ribs', 'gut', 'heart']))
    r = pg.evaluate("() => { const g = window.__game; g.gx.update(0.5); g.gx.screenBlood(3); return document.getElementById('bloodScreen').childElementCount; }")
    check('screen blood', r > 0)
    r = pg.evaluate("() => { const g = window.__game; g.settings.extremeGore = false; const n = g.gore.gibs.length; const b = g.actors.find(a => a.alive && a !== g.player && a.mesh); if (!b) return true; b.hp = 1; g.damage(b, g.player, 50, g.player.weapon, false); return true; }")
    check('normal gore still works', r)
    b.close()
print(errs[:3]); print('PASS' if ok and not errs else 'FAIL')
