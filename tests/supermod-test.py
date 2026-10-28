"""Secret mod menu: typing supermod opens it; session vs permanent apply; mods change the game. Usage: python3 tests/supermod-test.py"""
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
    b = p.chromium.launch(); ctx = b.new_context(); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    check('hidden at start', pg.evaluate("document.getElementById('sm').classList.contains('hidden')"))
    pg.keyboard.type('supermod', delay=15)
    check('typing supermod opens it', pg.evaluate("!document.getElementById('sm').classList.contains('hidden')"))
    pg.evaluate("() => { const l = document.querySelectorAll('#smList input'); l[1].click(); l[3].click(); }")   # god + no recoil
    pg.evaluate("() => { const r = document.querySelectorAll('#smList input[type=range]')[0]; r.value = 2.5; r.dispatchEvent(new Event('input')); }")   # speed
    pg.click('#smSession')
    st = pg.evaluate("[localStorage.getItem('ironstrike_supermod'), sessionStorage.getItem('ironstrike_supermod')]")
    check('session apply only in sessionStorage', st[0] is None and st[1] and '"god":true' in st[1] and '"speed":2.5' in st[1])
    pg.click('#smClose')
    pg.evaluate("""() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; g.player.protT = 0; g.matchT = 5; }""")
    r = pg.evaluate("""async () => { const g = window.__game, p = g.player, M = await import('/js/supermod.js'); const hp0 = p.hp; g.damage(p, g.actors[1], 50, g.actors[1].weapon, false); return { hp: p.hp === hp0, speed: M.MOD.speed, god: M.MOD.god }; }""")
    check('god mode blocks damage', r['hp'] and r['god'] and r['speed'] == 2.5)
    pg.reload(); pg.wait_for_timeout(400)
    check('session mods survive a reload (same tab)', pg.evaluate("import('/js/supermod.js').then(m => m.MOD.god)"))
    pg.keyboard.type('supermod', delay=15); pg.click('#smPerm')
    check('permanent apply in localStorage', pg.evaluate("localStorage.getItem('ironstrike_supermod')") is not None)
    pg2 = ctx.new_page(); pg2.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript')); pg2.goto(f'http://127.0.0.1:{port}/index.html'); pg2.wait_for_timeout(400)
    check('permanent mods load in a new tab', pg2.evaluate("import('/js/supermod.js').then(m => m.MOD.god && m.MOD.speed === 2.5)"))
    pg.click('#smReset'); check('reset clears both', pg.evaluate("[localStorage.getItem('ironstrike_supermod'), sessionStorage.getItem('ironstrike_supermod')]") == [None, None])
    b.close()
print(errs[:2]); print('PASS' if ok and not errs else 'FAIL')
