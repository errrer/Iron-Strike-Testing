"""Secret word 'azam' retextures everything, typing it again restores. Usage: python3 tests/azam-test.py"""
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
    pg.evaluate("() => { const g = window.__game; g.start({mode:'ffa',map:'dust',mapName:'D',primary:'ak47',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; }")
    count = "() => { let n = 0, t = 0; window.__game.scene.traverse((o) => { if (o.geometry && o.material && o.material.color) { t++; if (o.material.map && o.material.map.url === 'assets/azam.jpg') n++; } }); return [n, t]; }"
    type_ = "() => { for (const ch of 'azam') document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })); }"
    pg.evaluate("() => { for (const ch of 'azam') window.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); }")
    r = pg.evaluate(count); check('azam retextures meshes', r[0] > 20 and r[0] >= r[1] * 0.5)
    pg.evaluate("() => { for (const ch of 'azam') window.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); }")
    r2 = pg.evaluate(count); check('typing it again restores', r2[0] == 0)
    b.close()
print(errs[:3]); print('PASS' if ok and not errs else 'FAIL')
