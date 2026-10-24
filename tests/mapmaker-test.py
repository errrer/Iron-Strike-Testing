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
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/three*', lambda r: r.fulfill(body=stub, content_type='text/javascript')) if False else None
    pg.route('https://unpkg.com/**', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    pg.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(body=stub, content_type='text/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(1500)
    pg.click('#lMM')
    warn = pg.inner_text('#mmWarn'); ok &= 'not playable' in warn.lower() and pg.is_hidden('#mmEditor')
    pg.click('#mmOk'); ok &= pg.is_visible('#mmEditor')
    box = pg.locator('#mmCanvas').bounding_box()
    pg.mouse.move(box['x'] + 100, box['y'] + 100); pg.mouse.down(); pg.mouse.move(box['x'] + 300, box['y'] + 130); pg.mouse.up()
    n = pg.evaluate("async()=>{const m=await import('/js/mapmaker.js');return JSON.parse(m.mapJSON()).pieces.length}")
    ok &= n == 1
    pg.click('#mmBack'); ok &= pg.is_visible('#landing')
    b.close()
print('ERRS', errs); print('PASS' if ok and not errs else 'FAIL', n)
