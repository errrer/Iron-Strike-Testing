"""V0.5 checks: objective modes, killstreaks, XP/ranks (headless, Three.js stubbed). Usage: python3 tests/modes-test.py"""
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
  const run = (n) => { for (let i = 0; i < n; i++) { try { g.frame(1/60); } catch (e) { out.errors.push(String(e.stack||e)); return; } } };
  const begin = (mode, solo) => {
    localStorage.removeItem('ironstrike.prog');
    g.start({mode, map:'warehouse', mapName:'W', primary:'m4a1', secondary:'g18', difficulty:'hard'}); g.state='playing';
    document.getElementById('pause').classList.add('hidden');
    run(240);                                                // countdown
    if (solo) for (const a of g.actors.slice()) if (!a.isPlayer) g.removeNetActor(a.id);
    g.player.protT = 999;
  };
  const put = (x, z) => { const p = g.player; p.pos.set(x, g.groundAt(x, 3, z), z); p.vel.set(0,0,0); };

  // ---- full-length bot games of each new mode run without errors
  out.full = {};
  for (const m of ['dom', 'hp', 'kc', 'snd']) {
    begin(m, false); const p = g.player; p.protT = 9999; g.keys.KeyW = true; run(60 * 25);
    out.full[m] = [!!g.obj, g.teamScore.join('-'), g.actors.filter(a => a.alive).length]; g.keys = {};
  }

  // ---- domination: stand on B alone
  begin('dom', true); const B = g.obj.zones[1]; put(B.x, B.z); run(60 * 9);
  out.dom = {owner: B.owner, score: g.teamScore[0], zones: g.obj.zones.length, hud: g.obj.hudHtml.includes('ally')};
  // ---- hardpoint: stand in the active point
  begin('hp', true); const Z = g.obj.zones[0]; put(Z.x, Z.z); run(60 * 5);
  out.hp = {owner: Z.owner, score: g.teamScore[0], active: Z.active};
  // ---- kill confirmed
  begin('kc', false); const en = g.actors.find(a => a.team === 1 && a.alive); en.protT = 0; put(en.pos.x + 12, en.pos.z); en.pos.x += 0; g.damage(en, g.player, 999, g.player.weapon, false);
  out.kcTags = g.obj.tags.length; const tg = g.obj.tags[0]; for (const a of g.actors) if (a !== g.player) a.alive = false;
  put(tg.x, tg.z); run(10); out.kc = {tagsLeft: g.obj.tags.length, score: g.teamScore[0]};
  const al = g.actors.find(a => a.team === 0 && !a.isPlayer); al.alive = true; al.hp = 100; al.protT = 0; al.pos.set(g.player.pos.x + 10, g.player.pos.y, g.player.pos.z); put(g.player.pos.x + 30, g.player.pos.z);
  g.damage(al, g.player, 999, g.player.weapon, false); const at = g.obj.tags[0]; put(at.x, at.z); run(10); out.kcDeny = {tagsLeft: g.obj.tags.length, score: g.teamScore[0]};
  // ---- search & destroy
  begin('snd', true);
  const dummyDef = () => { const d = g.makeActor(900 + g.actors.length, 'D', 1, false, 'm4a1', 'g18'); d.brain = null; d.mesh = g.makeBotMesh(0xff0000, d.weapons[0], null); g.scene.add(d.mesh.root); g.actors.push(d); g.placeActor(d, g.player.pos.x + 30, g.player.pos.z + 30, 0, true); return d; };
  const def = dummyDef(); run(60 * 3); out.sndRound = [g.obj.phase, g.obj.round]; def.pos.set(g.player.pos.x + 30, 0, g.player.pos.z + 30); const SA = g.obj.zones[0]; put(SA.x, SA.z); g.keys.KeyE = true; run(60 * 4);
  out.plant = [!!g.obj.bomb, g.obj.bomb && g.obj.bomb.zone.name]; g.keys = {};
  def.pos.set(500, 0, 500);
  run(60 * 41); out.boom = [g.teamScore[0], g.obj.phase];
  run(60 * 6); out.round2 = g.obj.round;
  // elimination win
  const d2 = g.actors.filter(a => a.team === 1 && a.alive); for (const a of d2) g.damage(a, g.player, 999, g.player.weapon, false);
  out.elim = [g.teamScore[0], g.obj.phase];
  // ---- killstreaks + xp
  begin('tdm', true); const p = g.player;
  const t1 = g.makeActor(901, 'T', 1, false, 'm4a1', 'g18'); t1.brain = null; t1.mesh = g.makeBotMesh(0xff0000, t1.weapons[0], null); g.scene.add(t1.mesh.root); g.actors.push(t1); g.placeActor(t1, p.pos.x, p.pos.z - 8, 0, true);
  p.streak = 3; g.streaks.earn(3); out.ready = {...g.streaks.ready}; g.streaks.use('uav'); out.uav = g.streaks.uav;
  g.streaks.earn(5); g.streaks.use('sentry'); out.sentries = g.streaks.sentries.length;
  g.streaks.earn(7); p.yaw = 0; t1.pos.set(p.pos.x, p.pos.y, p.pos.z - 10); t1.protT = 0; g.streaks.use('strike'); out.strikes = g.streaks.strikes.length;
  p.pos.set(p.pos.x, p.pos.y, p.pos.z); run(60 * 6); out.t1alive = t1.alive; out.streakLeft = {...g.streaks.ready};
  out.xp = g.prog.d.xp; out.kills = g.prog.d.kills;
  g.prog.reset(); g.prog.add(5000); out.level = g.prog.info.level; out.ul = [g.prog.unlocked('kar98k', false), g.prog.unlocked('ak47', false)];
  g.prog.reset(); out.ul0 = [g.prog.unlocked('kar98k', false), g.prog.unlocked('m4a1', false)];
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
    ok = ok and r['dom']['owner'] == 0 and r['dom']['score'] >= 1 and r['hp']['score'] >= 2 and r['kcTags'] == 1 and r['kc']['score'] == 1 and r['kc']['tagsLeft'] == 0 and r['kcDeny']['score'] == 1 and r['kcDeny']['tagsLeft'] == 0
    ok = ok and r['plant'][0] and r['boom'][0] == 1 and r['elim'][0] >= 2 and r['ready']['uav'] == 1 and r['uav'] > 20 and r['sentries'] == 1 and r['strikes'] == 1 and r['kills'] >= 1 and r['level'] >= 6 and r['ul'] == [False, True] and r['ul0'] == [False, True]
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
