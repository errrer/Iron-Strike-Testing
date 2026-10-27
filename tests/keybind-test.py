"""Rebinding keys: bound key drives the action, the old key goes dead, swap works, UI capture works. Usage: python3 tests/keybind-test.py"""
import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); errs = []; ok = True
def check(name, cond):
    global ok; print(('ok   ' if cond else 'FAIL ') + name); ok = ok and bool(cond)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('btnKeys').click()")
    check('panel opens', pg.evaluate("!document.getElementById('kb').classList.contains('hidden')"))
    rows = pg.query_selector_all('.kb-row .kb-key'); names = pg.evaluate("[...document.querySelectorAll('.kb-row span')].map(s => s.textContent)")
    jump = names.index('Jump / mantle'); fwd = names.index('Move forward')
    rows[jump].click(); pg.keyboard.press('KeyX')
    check('jump now X', pg.evaluate("document.querySelectorAll('.kb-key')[%d].textContent" % jump) == 'X')
    rows = pg.query_selector_all('.kb-row .kb-key'); rows[fwd].click(); pg.keyboard.press('KeyX')   # steal X -> jump gets W's old key (swap)
    t = pg.evaluate("[...document.querySelectorAll('.kb-key')].map(k => k.textContent)")
    check('swap: forward X, jump W', t[fwd] == 'X' and t[jump] == 'W')
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    check('panel closes', pg.evaluate("document.getElementById('kb').classList.contains('hidden')"))
    pg.evaluate("""() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; }""")
    pg.keyboard.down('KeyX'); k = pg.evaluate("({...window.__game.keys})"); pg.keyboard.up('KeyX')
    check('X drives forward', k.get('KeyW') is True)
    pg.keyboard.down('KeyW'); k = pg.evaluate("({...window.__game.keys})"); pg.keyboard.up('KeyW')
    check('W now jumps (Space)', k.get('Space') is True and not k.get('KeyW'))
    pg.keyboard.down('Space'); k = pg.evaluate("({...window.__game.keys})"); pg.keyboard.up('Space')
    check('old Space key dead', not k.get('Space'))
    pg.reload(); pg.wait_for_timeout(400)
    check('persists', pg.evaluate("import('/js/keybinds.js').then(m => m.bound('fwd'))") == 'KeyX')
    b.close()
print(errs[:2]); print('PASS' if ok and not errs else 'FAIL')
