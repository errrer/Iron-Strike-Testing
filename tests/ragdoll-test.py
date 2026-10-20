"""Euphoria ragdoll checks (headless, Three.js stubbed). Usage: python3 tests/ragdoll-test.py"""
import http.server, socketserver, threading, os, json, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read()
JS = """
async () => {
  const g = window.__game; g.settings.ragdoll = true; g.settings.gore = true;
  g.start({mode:'sandbox',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',difficulty:'hard'}); g.state='playing';
  document.getElementById('pause').classList.add('hidden');
  const out = {errors: []}, p = g.player;
  const run = (n) => { for (let i = 0; i < n; i++) { try { g.frame(1/60); } catch (e) { out.errors.push(String(e.stack||e)); return; } } };
  run(30);
  for (let k = 0; k < 4 && g.actors.filter(a => a.dummy).length < 3; k++) { g.sandboxSpawn(2); run(5); }
  const ds = g.actors.filter(a => a.dummy);
  out.dummies = ds.length;
  const [a, b, c] = ds, W = (id) => window.__W ? window.__W[id] : null;
  const wp = (id) => g.constructor.WEAPONS ? null : null;
  // kill a: body shot rifle, b: headshot, c: shotgun
  const weapons = Object.values(p.weapons.map ? p.weapons : []).length;
  const m4 = p.weapons[0];
  g.kill(a, p, m4, false); g.kill(b, p, m4, true);
  out.rag = [!!a.rag, !!b.rag];
  const tr=[]; for (let i=0;i<60;i++){ run(6); tr.push([+a.rag.p[1][1].toFixed(2), +b.rag.p[1][1].toFixed(2)]); } out.trace=tr.slice(0,14);
  out.chest06 = tr[5];
  run(200);
  const lens = [[3,7,.3],[7,9,.32],[5,11,.42],[11,13,.38],[1,0,.43]];
  const bad = [];
  for (const r of [a.rag, b.rag]) {
    for (const q of r.p) for (const v of q) if (!isFinite(v)) bad.push('nan');
    for (let i = 0; i < 16; i++) if (r.p[i][1] < -0.001) bad.push('below ground ' + i);
    for (const [i, j, L] of lens) { const d = Math.hypot(r.p[i][0]-r.p[j][0], r.p[i][1]-r.p[j][1], r.p[i][2]-r.p[j][2]); if (Math.abs(d - L) > 0.06) bad.push('len ' + i + '-' + j + ' ' + d.toFixed(3)); }
  }
  out.bad = bad; out.asleep = [a.rag.asleep, b.rag.asleep]; out.t = [a.rag.t, b.rag.t];
  out.rootOrder = a.mesh.root.rotation.order;
  // respawn clears
  g.placeActor(a, 0, 0, 0, true);
  out.afterRespawn = [a.rag === null || a.rag === undefined, a.mesh.root.rotation.order];
  // second life dies again
  g.kill(a, p, m4, false); out.again = !!a.rag; run(120);
  // pause toggles exist
  out.toggle = !!document.getElementById('rag') && !!document.getElementById('rag2');
  return out;
}
"""
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox']); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    r = pg.evaluate(JS); print(json.dumps(r)); print('ERRS', errs[:3])
    ok = not errs and not r['errors'] and r['dummies'] >= 2 and all(r['rag']) and not r['bad'] and all(r['asleep']) and r['chest06'][0] > r['chest06'][1] and r['afterRespawn'][0] and r['afterRespawn'][1] == 'XYZ' and r['again'] and r['toggle']
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
