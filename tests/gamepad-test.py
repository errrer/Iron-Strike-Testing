"""Controller support with a fake Gamepad. Usage: python3 tests/gamepad-test.py"""
import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); errs = []; ok = True
def check(n, c, i=''):
    global ok; ok &= bool(c); print(('ok   ' if c else 'FAIL ') + n, i)
INIT = """
window.__pad = { id: 'Fake Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0,0,0,0], buttons: Array.from({length: 17}, () => ({pressed: false, value: 0})) };
window.__padOn = false;
navigator.getGamepads = () => window.__padOn ? [window.__pad] : [null];
window.setBtn = (i, v) => { window.__pad.buttons[i] = {pressed: v > 0.3, value: v}; };
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 700})
    pg.add_init_script(INIT); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(1000)
    pg.evaluate("window.__padOn = true"); pg.wait_for_timeout(200)
    # menus: d-pad moves focus, A clicks
    pg.evaluate("setBtn(15, 1)"); pg.wait_for_timeout(150); pg.evaluate("setBtn(15, 0)"); pg.wait_for_timeout(100)
    f = pg.evaluate("document.activeElement && document.activeElement.id"); check('menu focus moves', f in ('lMP', 'lZM', 'lMM', 'lMD'), f)
    pg.evaluate("document.getElementById('lMP').focus()"); pg.evaluate("setBtn(0, 1)"); pg.wait_for_timeout(120); pg.evaluate("setBtn(0, 0)"); pg.wait_for_timeout(200)
    check('A selects', pg.evaluate("!document.getElementById('menu').classList.contains('hidden')"))
    pg.evaluate("""() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'m1911',difficulty:'normal'}); g.state='playing'; for (const id of ['menu','landing','zmenu']) document.getElementById(id).classList.add('hidden'); for (let i=0;i<30;i++) g.frame(1/60); }""")
    pg.wait_for_timeout(200)
    pg.evaluate("window.__pad.axes = [0, -1, 0, 0]"); pg.wait_for_timeout(150); j = pg.evaluate("({...window.__game.joy, sh: !!window.__game.keys.ShiftLeft})"); check('left stick moves + rim sprints', j['y'] < -0.9 and j['sh'], j)
    pg.evaluate("window.__pad.axes = [0, 0, 0, 0]"); pg.wait_for_timeout(150); check('stick released', pg.evaluate("window.__game.joy.y") == 0 and not pg.evaluate("!!window.__game.keys.ShiftLeft"))
    y0 = pg.evaluate("window.__game.player.yaw"); pg.evaluate("window.__pad.axes = [0, 0, 1, 0]"); pg.wait_for_timeout(300); pg.evaluate("window.__pad.axes = [0,0,0,0]")
    check('right stick looks', pg.evaluate("window.__game.player.yaw") < y0 - 0.2, (y0, pg.evaluate("window.__game.player.yaw")))
    pg.evaluate("setBtn(7, 1)"); pg.wait_for_timeout(100); check('RT fires', pg.evaluate("window.__game.fireHeld")); pg.evaluate("setBtn(7, 0)"); pg.wait_for_timeout(100); check('RT release', not pg.evaluate("window.__game.fireHeld"))
    pg.evaluate("setBtn(6, 1)"); pg.wait_for_timeout(100); check('LT aims', pg.evaluate("window.__game.adsHeld")); pg.evaluate("setBtn(6, 0)"); pg.wait_for_timeout(100); check('LT release', not pg.evaluate("window.__game.adsHeld"))
    pg.evaluate("setBtn(0, 1)"); pg.wait_for_timeout(100); check('A jumps', pg.evaluate("!!window.__game.keys.Space")); pg.evaluate("setBtn(0, 0)"); pg.wait_for_timeout(100)
    pg.evaluate("setBtn(1, 1)"); pg.wait_for_timeout(100); pg.evaluate("setBtn(1, 0)"); pg.wait_for_timeout(100); check('B crouches', pg.evaluate("!!window.__game.keys.KeyC"))
    c = pg.evaluate("window.__game.player.cur"); pg.evaluate("setBtn(3, 1)"); pg.wait_for_timeout(100); pg.evaluate("setBtn(3, 0)"); pg.wait_for_timeout(100); check('Y swaps', pg.evaluate("window.__game.player.cur") != c)
    pg.evaluate("() => { const p = window.__game.player; p.switchT = 0; p.ammo[p.cur].mag = 2; }"); pg.evaluate("setBtn(2, 1)"); pg.wait_for_timeout(100); pg.evaluate("setBtn(2, 0)"); pg.wait_for_timeout(100); check('X reloads', pg.evaluate("window.__game.player.reloading"))
    pg.evaluate("setBtn(9, 1)"); pg.wait_for_timeout(100); pg.evaluate("setBtn(9, 0)"); pg.wait_for_timeout(150); check('Start pauses', pg.evaluate("window.__game.state") == 'paused')
    pg.evaluate("setBtn(9, 1)"); pg.wait_for_timeout(100); pg.evaluate("setBtn(9, 0)"); pg.wait_for_timeout(150); check('Start resumes', pg.evaluate("window.__game.state") == 'playing')
    b.close()
print('ERRS', errs[:3]); print('PASS' if ok and not errs else 'FAIL')
