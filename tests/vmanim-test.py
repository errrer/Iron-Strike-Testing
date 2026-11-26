"""First-person viewmodel animation: every gun class through idle / walk / sprint / ADS / fire / reload / draw / inspect must give finite, in-frame, smooth poses.
Usage: python3 tests/vmanim-test.py"""
import http.server, socketserver, threading, os, json, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read()
JS = """
async () => {
  const g = window.__game, out = { bad: [], stats: {}, errors: [] };
  const guns = ['m4a1', 'kar98k', 'spas12', 'm1911', 'g19', 'm4t', 'magnum'];
  const W = await import('/js/weapons.js');
  for (const id of guns) {
    if (!W.WEAPONS[id]) continue;
    g.start({ mode: 'ffa', map: 'warehouse', mapName: 'W', primary: W.WEAPONS[id].cls === 'pistol' ? 'm4a1' : id, secondary: W.WEAPONS[id].cls === 'pistol' ? id : 'm1911', difficulty: 'easy' }); g.state = 'playing'; g.matchT = 1;
    const p = g.player; p.protT = 99; for (const x of g.actors) if (!x.isPlayer) { x.alive = false; x.respawnT = 9999; }
    if (W.WEAPONS[id].cls === 'pistol') g.switchWeapon(p, 1);
    g.keys = {}; for (let i = 0; i < 60; i++) g.frame(1/60);
    const r = g.vmRoot, lh = g.vm && g.vm.lh; if (!r || !lh) { out.bad.push([id, 'no viewmodel']); continue; }
    let prev = null, maxP = 0, maxR = 0, n = 0; const byTag = {}; const box = { x: [9, -9], y: [9, -9], z: [9, -9], r: 0 };
    const sample = (tag) => {
      const v = [r.position.x, r.position.y, r.position.z, r.rotation.x, r.rotation.y, r.rotation.z, lh.position.x, lh.position.y, lh.position.z];
      if (v.some(x => !Number.isFinite(x))) { out.bad.push([id, tag, 'NaN', v]); return; }
      if (prev) { let dp = 0, dr = 0; for (let k = 0; k < 3; k++) dp = Math.max(dp, Math.abs(v[k] - prev[k])); for (let k = 3; k < 6; k++) dr = Math.max(dr, Math.abs(v[k] - prev[k])); maxP = Math.max(maxP, dp); maxR = Math.max(maxR, dr); const b = byTag[tag] || (byTag[tag] = [0, 0]); b[0] = Math.max(b[0], dp); b[1] = Math.max(b[1], dr); }
      box.x = [Math.min(box.x[0], v[0]), Math.max(box.x[1], v[0])]; box.y = [Math.min(box.y[0], v[1]), Math.max(box.y[1], v[1])]; box.z = [Math.min(box.z[0], v[2]), Math.max(box.z[1], v[2])];
      box.r = Math.max(box.r, Math.abs(v[3]), Math.abs(v[4]), Math.abs(v[5])); prev = v; n++;
    };
    const run = (tag, frames, setup) => { for (let i = 0; i < frames; i++) { setup && setup(i); try { g.frame(1/60); } catch (e) { out.errors.push(id + ':' + tag + ' ' + e.stack); return; } sample(tag); } };
    run('idle', 60);
    g.keys = { KeyW: true }; run('walk', 120); g.keys = {};
    g.keys = { KeyW: true, ShiftLeft: true }; run('sprint', 120); g.keys = {};
    g.frame(1/60); if (!(p.sprintRecover > 0) || g.canFire(p)) out.bad.push([id, 'no sprint-out delay', p.sprintRecover]);
    run('stop', 40); if (!(p.sprintRecover <= 0)) out.bad.push([id, 'sprint-out delay never ends', p.sprintRecover]);
    run('use', 40, () => { g.playerUsing = true; }); run('use-out', 40);
    run('streak', 70, (i) => { if (i === 0) g.vmS.streakT = 0.9; });
    g.adsHeld = true; run('ads', 60); run('ads-fire', 30, (i) => { if (i % 5 === 0) { g.vmKick = Math.min(1.5, (g.vmKick || 0) + 0.55); g.vmS.slide = 1; g.vmS.cycle = 1; g.vmS.rand = Math.sin(i * 7); } }); g.adsHeld = false; run('unads', 60);
    p.ammo[p.cur].mag = Math.max(1, p.ammo[p.cur].mag - 3); g.startReload(p); run('reload', Math.ceil((p.weapon.reload + 0.5) * 60));
    p.ammo[p.cur].mag = 0; g.startReload(p); run('reload-empty', Math.ceil((p.weapon.reload + 0.5) * 60));
    const oldId = g.vm.id; g.switchWeapon(p, 1 - p.cur); const newId = p.weapon.id;
    if (g.vm.id !== oldId) out.bad.push([id, 'old gun should stay up while it is holstered', g.vm.id, oldId]);
    let sawOld = false; for (let i = 0; i < 3; i++) { g.frame(1/60); sample('holster'); sawOld = sawOld || g.vm.id === oldId; }
    if (!sawOld) out.bad.push([id, 'no holster phase']);
    run('draw', 60);                                                              // pose must stay continuous through the model swap
    if (g.vm.id !== newId) out.bad.push([id, 'new gun never came up', g.vm.id, newId]);
    g.startInspect(); run('inspect', 200);
    out.stats[id] = { byTag: Object.fromEntries(Object.entries(byTag).map(([k, v]) => [k, v.map(x => +x.toFixed(3))])), n, maxPosStep: +maxP.toFixed(4), maxRotStep: +maxR.toFixed(4), x: box.x.map(v => +v.toFixed(3)), y: box.y.map(v => +v.toFixed(3)), z: box.z.map(v => +v.toFixed(3)), rot: +box.r.toFixed(2) };
    for (const [tg, [dp, dr]] of Object.entries(byTag)) { const sw = tg === 'holster' || tg === 'draw'; if (dp > (sw ? 0.075 : 0.04) || dr > (sw ? 0.2 : 0.16)) out.bad.push([id, 'jerky', tg, dp, dr]); }
    if (box.x[0] < -0.45 || box.x[1] > 0.55 || box.y[0] < -0.62 || box.y[1] > 0.3 || box.z[0] < -0.75 || box.z[1] > -0.05 || box.r > 1.7) out.bad.push([id, 'out of frame', box]);
  }
  return out;
}
"""
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox']); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    r = pg.evaluate(JS); print(json.dumps(r, indent=1)); print('ERRS', errs[:3])
    ok = not errs and not r['errors'] and not r['bad'] and len(r['stats']) >= 5
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
