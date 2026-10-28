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
    check('5 class buttons (menu + pause)', pg.evaluate("[document.querySelectorAll('#classBar .cls').length, document.querySelectorAll('#pauseClasses .cls').length]") == [5, 5])
    pg.evaluate("document.querySelectorAll('#classBar .cls')[1].click()")
    cfg = pg.evaluate("JSON.parse(localStorage.getItem('ironstrike'))")
    check('class 2 loaded (ak47 / m1911)', cfg['primary'] == 'ak47' and cfg['secondary'] == 'm1911' and cfg['cls'] == 1)
    pg.evaluate("document.querySelectorAll('#classBar .cls')[0].click()")
    cfg = pg.evaluate("JSON.parse(localStorage.getItem('ironstrike'))")
    check('class 1 kept its own guns', cfg['primary'] == 'vmp' and cfg['classes'][1]['prim'] == 'ak47')
    pg.evaluate("() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; g.matchT = 5; g.pause(); }")
    pg.evaluate("document.querySelectorAll('#pauseClasses .cls')[2].click()")
    w = pg.evaluate("window.__game.player.weapons.map(w => w.id)")
    check('mid-match class swap gives mp5 / skorp', w == ['mp5', 'skorp'])
    b.close()
print(errs[:2]); print('PASS' if ok and not errs else 'FAIL')
