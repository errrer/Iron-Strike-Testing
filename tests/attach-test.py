"""Every gun builds and fires with all muzzle/mag attachments fitted. Usage: python3 tests/attach-test.py"""
import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); errs = []
JS = """async () => { const W = await import('/js/weapons.js'), G = await import('/js/gunmodels.js'); const g = window.__game, out = {bad: [], n: 0};
  for (const id of [...W.PRIMARIES, ...W.SECONDARIES]) {
    const w = W.withAtt(W.WEAPONS[id], 4272 | 1 | (2 << 10));
    try { const m = G.buildGun(w); out.n++; if (!m.userData.muzzle || ![m.userData.muzzle.x, m.userData.muzzle.y, m.userData.muzzle.z].every(Number.isFinite)) out.bad.push(id + ' muzzle'); } catch (e) { out.bad.push(id + ': ' + e.message); }
  }
  for (const id of [...W.PRIMARIES, ...W.SECONDARIES]) for (const [slot, list] of Object.entries(W.WEAPONS[id].opts)) for (const key of list) {
    try { const m = G.buildGun(W.withAtt(W.WEAPONS[id], W.setSlot(0, slot, W.ATT[key].v))); out.n++; if (!m.children.length) out.bad.push(id + ':' + key + ' empty'); } catch (e) { out.bad.push(id + ':' + key + ' ' + e.message); }
  }
  g.start({mode:'tdm',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:4272,attS:4272,difficulty:'normal'}); g.state='playing';
  for (let i = 0; i < 60; i++) { try { g.frame(1/60); } catch (e) { out.bad.push('frame ' + e.message); break; } }
  out.mag = g.player.weapons[0].mag; return out; }"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    r = pg.evaluate(JS); print(r, errs[:2]); b.close()
print('PASS' if not r['bad'] and not errs and r['n'] >= 200 and r["mag"] == 45 else 'FAIL')
