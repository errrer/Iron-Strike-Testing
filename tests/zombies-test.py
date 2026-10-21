"""V0.6 Zombies checks (headless, Three.js stubbed). Usage: python3 tests/zombies-test.py"""
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
  const g = window.__game, out = {errors: []};
  const run = (n) => { for (let i = 0; i < n; i++) { try { g.frame(1/60); } catch (e) { out.errors.push(String(e.stack||e)); return false; } } return true; };
  const begin = () => {
    localStorage.removeItem('ironstrike.prog');
    g.start({mode:'zm', map:'outpost', mapName:'Outpost', primary:'m1911', secondary:'m1911', difficulty:'normal'}); g.state='playing';
    document.getElementById('pause').classList.add('hidden');
    run(240);
  };
  const put = (x, z) => { const p = g.player; p.pos.set(x, g.groundAt(x, 3, z), z); p.vel.set(0,0,0); };
  const zs = () => g.actors.filter(a => a.zombie && a.alive);
  const use = () => { g.zm.setUse(g.player, true); run(3); g.zm.setUse(g.player, false); run(2); };

  begin(); const zm = g.zm, p = g.player;
  out.start = { mode: g.mode.id, nodes: g.nav.nodes.length, cov: +g.nav.coverage.toFixed(2), windows: zm.windows.length, doors: zm.doors.length, pts: p.pts, weapons: p.weapons.map(w => w.id) };
  p.protT = 9999;
  // ---- round 1 starts and zombies come through the windows
  run(60 * 8); out.round1 = { round: zm.round, phase: zm.phase, zombies: zs().length, left: zm.left };
  run(60 * 25);
  out.tear = { boards: zm.windows.map(w => w.boards).join(''), zombies: zs().length, moved: zs().some(z => !z.zs.win) };
  // ---- a zombie hunts the player
  put(-20, 0); run(60 * 30);
  const near = Math.min(...zs().map(z => Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z)));
  out.hunt = { near: +near.toFixed(1), inside: zs().filter(z => z.pos.x > -30 && z.pos.x < -10 && Math.abs(z.pos.z) < 10).length };
  // ---- points: hit = 10, kill = 60 total, headshot = 100
  p.pts = 0; p.protT = 9999;
  const z1 = zs()[0]; z1.hp = 100; g.damage(z1, p, 20, p.weapon, false); out.hit = p.pts;
  g.damage(z1, p, 1000, p.weapon, false); out.kill = [p.pts, z1.alive];
  const z2 = zs()[0]; g.time += 1; g.damage(z2, p, 1000, p.weapon, true); out.head = p.pts;
  out.kills = p.kills;
  // ---- buying: wall gun, ammo, door, perk, box, pap
  p.pts = 20000; p.protT = 9999;
  const B = zm.buys[0]; put(B.x + Math.sin(B.face) * 1.0, B.z + Math.cos(B.face) * 1.0); use();
  out.wall = { weapons: p.weapons.map(w => w.id), cur: p.weapon.id, pts: p.pts };
  use(); out.ammo = p.pts;
  const D = zm.doors[0]; put(D.x - 1.2, D.z); use();
  out.door = { open: D.open, zone1: zm.zones[1], blocking: g.col.boxes.includes(D.box) };
  const Pk = zm.perks.find(m => m.id === 'jug'); put(Pk.x, Pk.z + 1.5); use(); out.jug = p.perks;
  const sc = zm.perks.find(m => m.id === 'sc'); put(sc.x + 1.5, sc.z); use(); out.sc = p.perks;
  const bx = zm.box; put(bx.x, bx.z - 1.6); const before = p.pts; use(); out.box1 = [bx.st, before - p.pts];
  run(60 * 3.5); out.box2 = bx.st; use(); out.box3 = [bx.st, p.weapons.map(w => w.id)];
  const pp = zm.pap; put(pp.x - 1.6, pp.z); use(); out.pap1 = pp.st; run(60 * 3.5); out.pap2 = [pp.st, p.weapons.map(w => !!w.pap)];
  // ---- barricade: rebuild
  const W = zm.windows[0]; W.boards = 2; put(W.inx, W.inz); for (const z of zs()) z.pos.set(0, 0, 20); g.zm.setUse(p, true); run(60 * 3); g.zm.setUse(p, false); out.rebuild = W.boards;
  // ---- power-ups
  zm.pus.push({ id: 99, type: 'dbl', x: p.pos.x, z: p.pos.z, t: 30, view: null }); run(5); out.dbl = zm.dbl > 0;
  zm.pus.push({ id: 100, type: 'insta', x: p.pos.x, z: p.pos.z, t: 30, view: null }); run(5); out.insta = zm.insta > 0;
  const zz = zs()[0]; if (zz) { zz.hp = 1e6; g.damage(zz, p, 5, p.weapon, false); out.instaKill = zz.alive; }
  zm.pus.push({ id: 101, type: 'nuke', x: p.pos.x, z: p.pos.z, t: 30, view: null }); run(5); out.nuke = zs().length;
  // ---- end of round -> next round
  const r0 = zm.round; zm.toSpawn = 0; for (const z of zs()) g.kill(z, p, p.weapon, false); run(60 * 3); out.brk = zm.phase; run(60 * 9); out.next = [r0, zm.round, zm.phase];
  // ---- downed + game over (no Quick Revive in solo)
  p.protT = 0; p.perks = 0; p.hp = 100; const zq = zs()[0] || null;
  put(-20, 0); zm.toSpawn = 5; run(60 * 40); out.down = [p.down, p.hp, g.ended];
  out.over = { ended: g.ended, state: g.state, rounds: g.teamScore[0] };
  return out;
}
"""
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox']); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    r = pg.evaluate(JS); print(json.dumps(r, indent=1)); print('ERRS', errs[:3])
    ok = not errs and not r['errors']
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
