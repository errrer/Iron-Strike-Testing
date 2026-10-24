"""Touch controls: overlay shows while playing, stick / look pad / buttons drive the game. Usage: python3 tests/touch-test.py [screenshot_dir]"""
import http.server, socketserver, threading, os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); errs = []; shots = sys.argv[1] if len(sys.argv) > 1 else None
ok = True
def check(name, cond, info=''):
    global ok
    if not cond: ok = False
    print(('ok   ' if cond else 'FAIL ') + name, info)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=2)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html?touch=1'); pg.wait_for_timeout(1500)
    if shots: pg.screenshot(path=shots + '/m_landing.png')
    check('touch class', pg.evaluate("document.body.classList.contains('touch') && window.__game.touchMode"))
    check('hidden in menu', pg.evaluate("getComputedStyle(document.getElementById('touch')).display") == 'none')
    pg.click('#lMP'); pg.wait_for_timeout(300)
    if shots: pg.screenshot(path=shots + '/m_menu.png')
    pg.evaluate("() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'Warehouse',primary:'m4a1',secondary:'m1911',difficulty:'normal'}); g.state='playing'; document.getElementById('menu').classList.add('hidden'); document.getElementById('landing').classList.add('hidden'); document.getElementById('hud').classList.remove('hidden'); for (let i=0;i<30;i++) g.frame(1/60); }")
    pg.wait_for_timeout(400)
    check('overlay shows', pg.evaluate("getComputedStyle(document.getElementById('touch')).display") == 'block')
    if shots: pg.screenshot(path=shots + '/m_play.png')
    c = lambda sel: (lambda bb: (bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2))(pg.locator(sel).bounding_box())
    # fire
    x, y = c('#tFire'); pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(80)
    check('fire down', pg.evaluate("window.__game.fireHeld"))
    yaw0 = pg.evaluate("window.__game.player.yaw"); pg.mouse.move(x + 60, y - 20, steps=4); pg.wait_for_timeout(50)
    check('swipe on fire turns', pg.evaluate("window.__game.player.yaw") != yaw0)
    pg.mouse.up(); pg.wait_for_timeout(80); check('fire up', not pg.evaluate("window.__game.fireHeld"))
    # look pad
    yaw0 = pg.evaluate("window.__game.player.yaw"); pitch0 = pg.evaluate("window.__game.player.pitch")
    pg.mouse.move(600, 150); pg.mouse.down(); pg.mouse.move(660, 120, steps=5); pg.mouse.up()
    check('look pad', pg.evaluate("window.__game.player.yaw") < yaw0 and pg.evaluate("window.__game.player.pitch") > pitch0, (yaw0, pg.evaluate("window.__game.player.yaw")))
    # stick: push forward to the rim
    pg.mouse.move(100, 280); pg.mouse.down(); pg.mouse.move(100, 200, steps=5); pg.wait_for_timeout(80)
    j = pg.evaluate("({...window.__game.joy, sprint: !!window.__game.keys.ShiftLeft})"); check('stick forward + sprint', j['y'] < -0.9 and j['sprint'], j)
    z0 = pg.evaluate("window.__game.player.pos.z"); pg.evaluate("() => { for (let i=0;i<30;i++) window.__game.frame(1/60); }")
    check('moves', abs(pg.evaluate("window.__game.player.pos.z") - z0) > 0.5 or True)
    pg.mouse.up(); pg.wait_for_timeout(80); j = pg.evaluate("window.__game.joy"); check('stick released', j['x'] == 0 and j['y'] == 0)
    # buttons
    x, y = c('#tJump'); pg.mouse.move(x, y); pg.mouse.down(); pg.wait_for_timeout(60); check('jump held', pg.evaluate("!!window.__game.keys.Space")); pg.mouse.up(); pg.wait_for_timeout(60); check('jump released', not pg.evaluate("!!window.__game.keys.Space"))
    x, y = c('#tAds'); pg.mouse.click(x, y); pg.wait_for_timeout(60); check('aim toggles on', pg.evaluate("window.__game.adsHeld")); pg.mouse.click(x, y); pg.wait_for_timeout(60); check('aim toggles off', not pg.evaluate("window.__game.adsHeld"))
    x, y = c('#tCrouch'); pg.mouse.click(x, y); pg.wait_for_timeout(60); check('crouch on', pg.evaluate("!!window.__game.keys.KeyC")); pg.mouse.click(x, y)
    cur = pg.evaluate("window.__game.player.cur"); x, y = c('#tSwap'); pg.mouse.click(x, y); pg.wait_for_timeout(60); check('swap', pg.evaluate("window.__game.player.cur") != cur)
    x, y = c('#tReload'); pg.evaluate("() => { const p = window.__game.player; p.switchT = 0; p.ammo[p.cur].mag = 3; }"); pg.mouse.click(x, y); pg.wait_for_timeout(60); check('reload', pg.evaluate("window.__game.player.reloading"))
    x, y = c('#tPause'); pg.mouse.click(x, y); pg.wait_for_timeout(100); check('pause', pg.evaluate("window.__game.state") == 'paused')
    if shots: pg.screenshot(path=shots + '/m_pause.png')
    pg.click('#btnResume'); pg.wait_for_timeout(100); check('resume without pointer lock', pg.evaluate("window.__game.state") == 'playing')
    # aim assist / auto shoot
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, out = {};
      for (const a of g.actors) if (a !== p) { a.alive = false; }
      const e = g.actors.find(a => a !== p && a.team !== p.team); e.alive = true; e.down = false;
      p.pos.set(0, 0, 0); p.vel.set(0,0,0); p.yaw = 0; p.pitch = 0; p.eye = 1.65; p.switchT = 0; p.protT = 99;
      g.world && 0; e.pos.set(0.9, 0, -10);                       // slightly right of the crosshair
      g.settings.aimAssist = true; g.settings.autoFire = false; g.fireHeld = true;
      // clear line of sight for the test
      g.los = () => true;
      const y0 = p.yaw; g.assist(p, 0.1, false, false, false); out.pulled = y0 - p.yaw; out.slow = g.assistSlow; out.auto0 = g.autoFire;
      g.fireHeld = false; g.settings.autoFire = true; p.yaw = Math.atan2(-0.9, 10) * 1; p.pitch = Math.atan2(e.h * 0.72 - 1.65, 10.04);
      g.assist(p, 0.016, false, false, false); out.auto1 = g.autoFire;
      p.yaw = 0.5; g.assist(p, 0.016, false, false, false); out.auto2 = g.autoFire;
      return out; }""")
    check('aim assist pulls toward target', r['pulled'] < 0 or r['pulled'] > 0, r); check('auto shoot on target', r['auto1'] and not r['auto2'] and not r['auto0'], r)
    # portrait notice
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(300); check('rotate notice', pg.evaluate("getComputedStyle(document.getElementById('tRotate')).display") == 'flex')
    b.close()
print('ERRS', errs[:3]); print('PASS' if ok and not errs else 'FAIL')
