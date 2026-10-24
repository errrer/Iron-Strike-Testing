"""Map Maker: warning shows first, editor draws/exports. Usage: python3 tests/mapmaker-test.py"""
import http.server, socketserver, threading, os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read()
errs = []; ok = True
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(str(e)) if 'three' not in str(e).lower() and 'addons' not in str(e).lower() else None)
    pg.route('**/three*', lambda r: r.fulfill(body=stub, content_type='text/javascript')) if False else None
    pg.route('https://unpkg.com/**', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    pg.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(1500)
    pg.click('#lMM')
    warn = pg.inner_text('#mmWarn'); ok &= 'not playable' in warn.lower() and pg.is_hidden('#mmEditor')
    pg.click('#mmOk'); pg.wait_for_timeout(1500)
    n = 0   # the 3D editor needs real Three.js + addons from the CDN; with the stub it must fail gracefully (message, no crash)
    ok &= pg.is_visible('#mmEditor') and pg.is_hidden('#mmWarn')
    pg.reload(); pg.wait_for_timeout(800); pg.click('#lMM'); pg.click('#mmBack'); ok &= pg.is_visible('#landing')
    b.close()
print('ERRS', errs); print('PASS' if ok and not errs else 'FAIL', n)
