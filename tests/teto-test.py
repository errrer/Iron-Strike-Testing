"""Teto secret: type 'teto' -> skinned Kasane Teto replaces the player's body, first-person hands change; type again -> restored."""
import http.server, socketserver, threading, os, json, base64, struct
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
# data sanity (offline)
d = json.load(open('assets/teto/teto.json'))
n = d['n']; si = struct.unpack('<%dH' % (n * 4), base64.b64decode(d['si'])); sw = struct.unpack('<%df' % (n * 4), base64.b64decode(d['sw']))
check('weights sum to 1', all(abs(sum(sw[i*4:i*4+4]) - 1) < 1e-3 for i in range(n)))
check('bone indices valid', max(si) <= 13)
used = set(si[i] for i in range(n * 4) if sw[i] > 0.05); check('all 14 bones used', len(used) == 14)
for f in ['clothes', 'skin', 'hair', 'face']: check('texture ' + f, os.path.exists('assets/teto/%s.png' % f))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("() => { localStorage.clear(); }")
    pg.evaluate("() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'x',primary:'ak47',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); }")
    for ch in 'teto': pg.keyboard.press(ch)
    pg.wait_for_timeout(1200)
    r = pg.evaluate("() => { const g = window.__game, m = g.player.mesh; for (let i = 0; i < 20; i++) g.update(0.05); return [g.teto, !!m.teto, m.teto && m.teto.on, m.parts.every(p => !p.visible), m.arms[0].userData.L1 > 0.2, m.rich === (m.teto && m.teto.root)]; }")
    print(r); check('teto on', r[0] and r[1] and r[2]); check('soldier parts hidden', r[3]); check('arm lengths set', r[4])
    r = pg.evaluate("() => { const g = window.__game, m = g.player.mesh; g.settings.view = 'third'; for (let i = 0; i < 40; i++) { g.keys.KeyW = true; g.update(0.05); } const b = m.teto.root.skeleton.bones; return [b.length, b[2].quaternion.w, b[8].quaternion.w, Math.hypot(b[3].quaternion.x, b[3].quaternion.y, b[3].quaternion.z, b[3].quaternion.w)]; }")
    print(r); check('14 bones driven', r[0] == 14 and abs(r[3] - 1) < 1e-3)
    r = pg.evaluate("() => { const g = window.__game; return [g.vm && g.vm.lh.children.length > 0, String((() => { let f = false; g.vm.root.traverse(c => { if (c.material && c.material.color && c.material.color.c === 0xf7e7d6) f = true; }); return f; })())]; }")
    print(r); check('fp hands are skin coloured', r[1] == 'true')
    for ch in 'teto': pg.keyboard.press(ch)
    pg.wait_for_timeout(300)
    r = pg.evaluate("() => { const g = window.__game, m = g.player.mesh; for (let i = 0; i < 5; i++) g.update(0.05); return [g.teto, m.teto.on, m.parts.every(p => p.visible), m.arms[0].userData.L1 || 0, m.arms[0].position.x]; }")
    print(r); check('off restores soldier', (not r[0]) and (not r[1]) and r[2] and r[3] == 0 and abs(r[4] + 0.28) < 1e-6)
    b.close()
print(errs[:3]); print('PASS' if ok and not errs else 'FAIL')
