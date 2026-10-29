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
    check('gfx buttons in menu + pause', pg.evaluate("document.querySelectorAll('.gfxseg button').length") == 8)
    pg.evaluate("document.querySelector('.gfxseg button[data-gfx=low]').click()")
    check('low saved', pg.evaluate("JSON.parse(localStorage.getItem('ironstrike')).gfx") == 'low')
    pg.evaluate("() => { const g = window.__game; g.start({mode:'tdm',map:'dust',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; }")
    check('low turns sun shadow off', pg.evaluate("(() => { let on = 0; window.__game.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) on++; }); return on; })()") == 0)
    pg.evaluate("document.querySelector('.gfxseg button[data-gfx=high]').click()")
    check('high restores shadows', pg.evaluate("(() => { let on = 0; window.__game.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) on++; }); return on; })()") >= 1)
    pg.evaluate("document.getElementById('fps').click()")
    check('fps box shown', pg.evaluate("!document.getElementById('fpsBox').classList.contains('hidden')"))
    b.close()
print(errs[:2]); print('PASS' if ok and not errs else 'FAIL')
