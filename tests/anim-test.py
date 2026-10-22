"""Animation checks: no NaN / twisted limbs under any movement state, hands reach the grips for every gun. Usage: python3 tests/anim-test.py"""
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
  const S = await import('/js/soldier.js'), A = await import('/js/anim.js'), W = await import('/js/weapons.js'), GM = await import('/js/gunmodels.js');
  const g = window.__game, out = { errors: [], bad: [], miss: [] };
  g.start({mode:'tdm', map:'warehouse', mapName:'Warehouse', primary:'m4a1', secondary:'m1911', difficulty:'normal'}); g.state='playing';
  for (let i = 0; i < 30; i++) g.frame(1/60);
  const a = g.actors.find(x => !x.isPlayer), m = a.mesh;
  const chk = (tag) => {
    for (const hip of m.legs) {
      const v = [hip.rotation.x, hip.rotation.y, hip.rotation.z, hip.userData.knee.rotation.x, hip.userData.knee.rotation.z];
      if (v.some(x => !Number.isFinite(x)) || Math.abs(hip.rotation.z) > 1e-6 || Math.abs(hip.rotation.x) > 2 || Math.abs(hip.rotation.y) > 1.7 || Math.abs(hip.userData.knee.rotation.z) > 1e-6) out.bad.push([tag, v.map(x => +x.toFixed(2))]);
    }
    for (const arm of m.arms) { const v = [arm.rotation.x, arm.rotation.y, arm.rotation.z]; if (v.some(x => !Number.isFinite(x))) out.bad.push([tag + ':arm', v]); }
    const gp = m.gun.position; if (![gp.x, gp.y, gp.z].every(Number.isFinite)) out.bad.push([tag + ':gun']);
  };
  const run = (tag, n, setup) => { for (let i = 0; i < n; i++) { setup(i); try { g.syncMesh(a, 1/60); g.time += 1/60; } catch (e) { out.errors.push(tag + ': ' + e.stack); return; } chk(tag); } };
  a.alive = true; a.protT = 0;
  const dirs = [0, 0.7, 1.57, 2.4, 3.14, -2.4, -1.57, -0.7];
  for (const yaw of [0, 1, 2.5]) for (const d of dirs) for (const sp of [0, 1.2, 3, 5, 7]) {
    run('move', 40, () => { a.yaw = yaw; a.vel.set(Math.sin(yaw + d) * -sp, 0, Math.cos(yaw + d) * -sp); a.onGround = true; a.crouch = false; });
  }
  run('crouch', 60, (i) => { a.vel.set(0, 0, -2 * (i % 30 < 15)); a.crouch = true; });
  run('air', 60, (i) => { a.crouch = false; a.onGround = i > 40; a.vel.set(0, i < 20 ? 6 : -6, -4); });
  run('slide', 30, () => { a.slideT = 0.5; a.vel.set(0, 0, -6); a.onGround = true; });
  a.slideT = 0; a.vel.set(0, 0, 0);
  run('reload', 150, (i) => { a.reloading = i < 120; a.onGround = true; });
  run('switch', 30, (i) => { a.switchT = 0.38 - i * 0.012; });
  run('shoot', 30, (i) => { a.switchT = 0; a.lastShot = g.time - (i % 6) * 0.02; a.pitch = Math.sin(i) * 0.9; });
  // ragdoll twisting hips, then a respawn must leave the legs straight
  m.legs[0].rotation.z = 1.2; m.legs[1].userData.knee.rotation.z = 0.9; m.legs[1].rotation.y = 1.4;
  const R = await import('/js/ragdoll.js'); R.Ragdoll.reset(m);
  out.afterReset = [m.legs[0].rotation.z, m.legs[1].userData.knee.rotation.z, m.legs[1].rotation.y];
  m.legs[0].rotation.z = 1.2; run('recover', 5, () => { a.vel.set(0, 0, -3); });   // the animation itself must overwrite stray twist
  // every gun and attachment: do the hands reach the grips?
  for (const id of Object.keys(W.WEAPONS)) {
    if (id === 'zclaw') continue;
    for (const mask of [0, 1, 2, 4, 7]) {
      let w; try { w = W.withAtt ? W.withAtt(W.WEAPONS[id], mask) : W.WEAPONS[id]; } catch (e) { w = W.WEAPONS[id]; }
      const gun = GM.buildGun(w); const old = m.gun; m.body.remove(old); m.gun = gun; m.body.add(gun);
      for (const o of [{}, { low: 1 }, { kick: 1 }, { sw: 1 }, { rel: 0.35 }, { rel: 0.6 }]) for (const pitch of [0, 0.5, -0.5]) {
        const miss = S.holdGun(m, pitch, o); if (!(miss < 0.03)) out.miss.push([id, mask, JSON.stringify(o), pitch, +miss.toFixed(3)]);
      }
    }
  }
  // zombie
  const z = g.makeZombieMesh(); const za = { id: 2001, vel: {x:0,z:-3,y:0}, pos: {x:0,z:0,y:0}, yaw: 0, zs: { atk: 0.8, win: null, tear: 0 }, zombie: true };
  for (let i = 0; i < 120; i++) { try { A.animateZombie(g, za, z, 1/60); g.time += 1/60; } catch (e) { out.errors.push('zombie ' + e.stack); break; } }
  out.zleg = z.legs.map(h => +h.rotation.x.toFixed(2));
  return out;
}
"""
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox']); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    r = pg.evaluate(JS); print(json.dumps({k: (v[:8] if isinstance(v, list) else v) for k, v in r.items()}, indent=1)); print('counts', len(r['bad']), len(r['miss']), 'ERRS', errs[:3])
    ok = not errs and not r['errors'] and not r['bad'] and not r['miss']
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
