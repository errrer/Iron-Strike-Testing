"""Every non-melee gun has a unique look signature (base model + mods + style). Usage: python3 tests/gunlook-test.py"""
import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(400)
    r = pg.evaluate("""async () => { const v = document.querySelector('script[src*="main.js"]').src.split('?')[1] || ''; const W = await import('./js/weapons.js?' + v), G = await import('./js/gunmodels.js?' + v);
      const RG = await import('./js/realguns.js?' + v), real = Object.keys(RG.makeReal({})); const sig = {}, dup = []; for (const w of Object.values(W.WEAPONS)) { if (w.cls === 'melee' || w.hidden) continue;
        const k = real.includes(w.id) ? 'real:' + w.id : JSON.stringify([(w.asset && w.asset.id) || w.builder, (G.GUN_MODS[w.id] || []).slice().sort(), G.GUN_STYLE[w.id] || null, w.tint === undefined ? null : w.tint]); if (sig[k]) dup.push(w.id + '=' + sig[k]); else sig[k] = w.id; }
      return [Object.keys(sig).length, dup]; }""")
    print(r); ok = not r[1] and not errs
    b.close()
print('PASS' if ok else 'FAIL')
