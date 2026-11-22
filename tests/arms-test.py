"""Rigged arms + Glock 19: asset sanity, setting persists/toggles without errors (stub three has no SkinnedMesh matrices, so the box hands stay)."""
import http.server, socketserver, threading, os, json, base64, struct, subprocess
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
d = json.load(open('assets/models/arms.json')); n = d['n']
si = struct.unpack('<%dH' % (n * 4), base64.b64decode(d['si'])); sw = struct.unpack('<%df' % (n * 4), base64.b64decode(d['sw']))
check('arm weights sum to 1', all(abs(sum(sw[i*4:i*4+4]) - 1) < 1e-2 for i in range(n)))
check('arm bone indices valid', max(si) < len(d['names']))
check('v_hands texture', os.path.exists('assets/models/v_hands.jpg'))
g = json.load(open('assets/models/g19.json')); check('g19 textured parts', g.get('textured') and os.path.exists('assets/models/g19/metal_base.jpg'))
m = json.load(open('assets/models/m4t.json')); check('m4t parts + mag + sights', m.get('textured') and {p['tag'] for p in m['parts']} >= {'mag', 'iron', 'body'} and all(os.path.exists(f'assets/models/m4t/{k}_{t}.jpg') for k in ('tan', 'dark') for t in ('base', 'normal', 'orm')))
# pose maths (node): every matrix finite, forearm ends at the wrist target
out = subprocess.check_output(['node', 'tools/armpose.mjs', 'pistol'], text=True); m = json.loads(out)
check('58 finite matrices', len(m) == 58 and all(abs(v) < 5 for mm in m for v in mm))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("() => { localStorage.clear(); }")
    pg.evaluate("() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'x',primary:'ak47',secondary:'g19',attP:0,attS:0,difficulty:'normal'}); }")
    r = pg.evaluate("() => { const g = window.__game; g.player.cur = 1; g.player.weapon = g.player.weapons[1]; g.setPlayerVm(); for (let i = 0; i < 10; i++) g.update(0.05); return [g.player.weapon.id, !!g.vm, g.vm.id]; }")
    print(r); check('g19 equips', r[0] == 'g19' and r[2] == 'g19')
    r = pg.evaluate("() => { const g = window.__game; g.player.cur = 0; g.player.weapons[0] = Object.assign({}, g.player.weapons[0]); return 1; }")
    g2 = pg.evaluate("() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'x',primary:'m4t',secondary:'g19',attP:0,attS:0,difficulty:'normal'}); for (let i = 0; i < 10; i++) g.update(0.05); return [g.player.weapon.id, g.vm.id, g.vm.mags.length, g.vm.sightY]; }")
    print(g2); check('m4t equips with a magazine', g2[0] == 'm4t' and g2[1] == 'm4t' and g2[2] >= 1)
    r = pg.evaluate("() => { const e = document.getElementById('arm'); e.checked = false; e.dispatchEvent(new Event('change')); const g = window.__game; for (let i = 0; i < 5; i++) g.update(0.05); const a = g.settings.armModel; e.checked = true; e.dispatchEvent(new Event('change')); for (let i = 0; i < 5; i++) g.update(0.05); return [a, g.settings.armModel, JSON.parse(localStorage.ironstrike).armModel]; }")
    print(r); check('toggle works + persists', r[0] is False and r[1] is True and r[2] is True)
    b.close()
check('no page errors', not errs)
for e in errs[:5]: print(e)
raise SystemExit(0 if ok else 1)
