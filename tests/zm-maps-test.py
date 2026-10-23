"""Every zombies map: loads, rounds run, stairs lead to the raised VMP room, zombies climb up to a player there, crawler rush works. Usage: python3 tests/zm-maps-test.py"""
import http.server, socketserver, threading, os, json, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read()
JS = """
async (id) => {
  const g = window.__game, out = {id, errors: []};
  const run = (n) => { for (let i = 0; i < n; i++) { try { g.frame(1/60); } catch (e) { out.errors.push(String(e.stack||e)); return false; } } return true; };
  localStorage.removeItem('ironstrike.prog');
  g.start({mode:'zm', map:id, mapName:id, primary:'m1911', secondary:'m1911', difficulty:'normal'}); g.state='playing';
  document.getElementById('pause').classList.add('hidden'); run(240);
  const zm = g.zm, p = g.player, U = zm.up, zs = () => g.actors.filter(a => a.zombie && a.alive);
  out.start = { nz: zm.zones.length, windows: zm.windows.length, doors: zm.doors.length, buys: zm.buys.map(b => b.gun + (b.y ? '@' + b.y : '')).join(','), nodes: g.nav.nodes.length };
  // the player walks up the stairs: start at the foot, walk west (toward the room) and check the height
  const sx = U.bot.x, sz = U.bot.z; p.pos.set(sx, 0, sz); p.vel.set(0, 0, 0);
  let maxY = 0;
  for (let i = 0; i < 60 * 5; i++) { p.yaw = Math.PI / 2; g.moveActor(p, -1, 0, 4, 1/60, false, false); g.col.move(p, 1/60); run(1); maxY = Math.max(maxY, p.pos.y); }
  out.climb = { maxY: +maxY.toFixed(2), x: +p.pos.x.toFixed(1) };
  // buy the VMP up there
  const vb = zm.buys.find(b => b.gun === 'vmp'); p.pts = 5000; p.pos.set(vb.x + Math.sin(vb.face) * 1.0, vb.y, vb.z + Math.cos(vb.face) * 1.0); p.vel.set(0, 0, 0);
  g.zm.setUse(p, true); run(4); g.zm.setUse(p, false); run(2); out.vmp = p.weapons.map(w => w.id);
  // zombies must come up the stairs to a player standing in the room
  zm.round = 1; zm.phase = 'active'; zm.toSpawn = 6; for (const w of zm.windows) w.boards = 0; zm.refreshViews(false); zm.rebuildBlocked();
  p.pts = 99999; p.hp = 100;
  let upZ = 0, hit = false, t = 0;
  for (let i = 0; i < 60 * 60 && !hit; i++) {
    p.hp = 100; p.pos.set(vb.x + 1.5, 3.0, vb.z); p.vel.set(0,0,0); p.down = false;
    run(1); t = i;
    for (const z of zs()) if (z.pos.y > 2.4) upZ++;
    if (upZ > 30) hit = true;
  }
  out.zombiesUp = { reached: hit, frames: t };
  // crawler rush
  for (const z of zs()) g.kill(z, p, p.weapon, false);
  zm.round = 4; zm.phase = 'break'; zm.phaseT = 0.1; p.pos.set(-20, 0, 0); run(60 * 3);
  out.rush = { round: zm.round, dog: zm.dogRound, left: zm.left, crawlers: zs().filter(z => z.crawl).length };
  run(60 * 12); out.rush2 = { crawlers: zs().filter(z => z.crawl).length, speeds: zs().slice(0, 3).map(z => +z.zs.spd.toFixed(1)) };
  return out;
}
"""
bad = False
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox']); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    for mid in ['outpost', 'bunker', 'farm']:
        pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
        r = pg.evaluate(JS, mid); print(json.dumps(r))
        ok = not r['errors'] and r['climb']['maxY'] > 2.9 and 'vmp' in r['vmp'] and r['zombiesUp']['reached'] and r['rush']['dog'] and r['rush']['crawlers'] > 0
        print(mid, 'OK' if ok else 'FAIL'); bad = bad or not ok
    print('ERRS', errs[:3]); bad = bad or bool(errs)
sys.exit(1 if bad else 0)
