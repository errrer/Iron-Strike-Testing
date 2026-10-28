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
    r = pg.evaluate("""async () => { const W = await import('/js/weapons.js'), I = await import('/js/inspect.js'); const out = {missing: [], same: [], bad: [], n: 0};
      const ids = [...W.PRIMARIES, ...W.SECONDARIES, 'goldgun', ...W.KNIVES], seen = new Map();
      for (const id of ids) { if (!I.INSPECTS[id]) out.missing.push(id); else { const k = JSON.stringify(I.INSPECTS[id]); if (seen.has(k)) out.same.push(id + '=' + seen.get(k)); seen.set(k, id); } }
      for (const an of Object.values(I.INSPECTS)) for (let u = 0; u <= 1.0001; u += 0.02) { const p = I.inspectPose(an, u); for (const k in p) if (!Number.isFinite(p[k])) out.bad.push(k); out.n++; }
      const e = I.inspectPose(I.INSPECTS.vmp, 0.999); out.endZero = Math.abs(e.x) + Math.abs(e.rz) + Math.abs(e.mag) < 0.05;
      const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; g.matchT = 5; g.player.switchT = 0;
      const run = (id) => { g.startInspect(); const t0 = g.vmS.inspectT; for (let i = 0; i < 400 && g.vmS.inspectT > 0; i++) { try { g.frame(1/60); } catch (er) { out.bad.push(id + ': ' + er.message); break; } } return t0; };
      out.dur = run('m4a1');
      g.applyLoadout(g.player, 'ak47', 'deagle', 0, 0); g.player.switchT = 0; g.frame(1/60); out.ak = run('ak47');
      g.toggleKnife && g.toggleKnife(); out.knifeVm = g.vm && g.vm.id; g.player.switchT = 0; out.kn = run('knife');
      return out; }""")
    print(r)
    check('every gun and knife has an inspect', not r['missing'])
    check('every inspect is unique', not r['same'])
    check('poses finite, ends neutral', not r['bad'] and r['endZero'])
    check('F plays and finishes in game', r['dur'] > 0 and r['ak'] > 0)
    b.close()
print(errs[:2]); print('PASS' if ok and not errs else 'FAIL')
