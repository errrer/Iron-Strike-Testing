"""Headless logic smoke test.  Three.js is replaced by tests/three-stub.js (no GPU/network needed),
so this checks game logic, bots, HUD and UI flow for runtime errors - not the visuals.
Usage: python3 tests/smoke.py"""
import http.server, socketserver, threading, os, sys, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read()

errors = []
SIM = """
async ([mode, map, prim, sec, seconds, diff, view]) => {
  const g = window.__game; g.settings.view = view || 'first';
  g.start({mode, map, mapName: map, primary: prim, secondary: sec, difficulty: diff});
  g.state = 'playing'; document.getElementById('pause').classList.add('hidden');
  const dt = 1/60; const p = g.player; const out = {errors: []};
  let shots = 0, switched = 0, reloads = 0;
  const startPos = g.actors.filter(a => !a.isPlayer).map(a => [a.pos.x, a.pos.z]);
  for (let i = 0; i < seconds * 60; i++) {
    // scripted player: wander, strafe, shoot at nearest enemy
    const t = i / 60;
    g.keys.KeyW = Math.sin(t * 0.7) > -0.3; g.keys.KeyA = Math.sin(t * 1.3) > 0.5; g.keys.KeyD = Math.sin(t * 1.3) < -0.5;
    g.keys.ShiftLeft = (Math.floor(t / 6) % 3 === 0); g.keys.Space = (i % 200 === 0); g.keys.KeyC = (Math.floor(t / 9) % 4 === 3);
    g.adsHeld = (Math.floor(t / 5) % 3 === 1);
    let best = null, bd = 1e9;
    for (const a of g.actors) if (a.alive && a !== p && a.team !== p.team) { const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z); if (d < bd) { bd = d; best = a; } }
    if (best && p.alive) { p.yaw = Math.atan2(-(best.pos.x - p.pos.x), -(best.pos.z - p.pos.z)); p.pitch = Math.atan2(best.pos.y + 1.2 - (p.pos.y + p.eye), bd); }
    g.fireHeld = !!best && (i % 90) < 45; if (g.fireHeld && i % 7 === 0) g.fireEdge = true;
    if (i % 500 === 250) { g.switchWeapon(p, 1 - p.cur); switched++; }
    if (i % 400 === 399) { g.startReload(p); reloads++; }
    if (i % 600 === 0) { g.showScore = !g.showScore; }
    try { g.frame(dt); } catch (e) { out.errors.push(String(e.stack || e)); break; }
    if (g.state === 'ended') break;
  }
  const moved = g.actors.filter(a => !a.isPlayer).map((a, i) => Math.hypot(a.pos.x - startPos[i][0], a.pos.z - startPos[i][1]));
  out.state = g.state; out.time = g.matchT; out.score = g.teamScore;
  out.kills = g.actors.map(a => [a.name, a.kills, a.deaths]);
  out.minMoved = Math.min(...moved).toFixed(1); out.maxMoved = Math.max(...moved).toFixed(1);
  out.playerAlive = p.alive; out.nanPos = g.actors.some(a => !isFinite(a.pos.x + a.pos.y + a.pos.z));
  out.feed = document.getElementById('killfeed').children.length;
  out.endShown = !document.getElementById('endscreen').classList.contains('hidden');
  out.outOfBounds = g.actors.some(a => Math.abs(a.pos.x) > 41 || Math.abs(a.pos.z) > 29 || a.pos.y < -0.1 || a.pos.y > 12);
  return out;
}
"""

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)
    pg.route('**/cdn.jsdelivr.net/**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(500)
    # menu sanity
    counts = pg.evaluate("() => ({modes: document.querySelectorAll('#modes .card').length, maps: document.querySelectorAll('#maps .card').length, prim: document.querySelectorAll('#primaries .card').length, sec: document.querySelectorAll('#secondaries .card').length})")
    print('menu cards:', counts)
    assert counts == {'modes': 8, 'maps': 4, 'prim': 5, 'sec': 3}, counts
    chips = pg.evaluate("() => ({p: document.querySelectorAll('#attP .chip').length, s: document.querySelectorAll('#attS .chip').length})")
    pg.click('#attP .chip'); pg.click('#attS .chip:nth-of-type(2)')   # VMP red dot, G18 laser
    saved = pg.evaluate("() => JSON.parse(localStorage.getItem('ironstrike')).att")
    print('attachment chips:', chips, 'saved:', saved); assert chips == {'p': 3, 's': 2} and saved.get('vmp') == 1 and saved.get('g18') == 4, (chips, saved)
    pg.click('#primaries .card:nth-child(4)'); print('kar98k chips:', pg.evaluate("() => document.querySelectorAll('#attP .chip').length"))   # sniper: grip + laser
    pg.click('#primaries .card:nth-child(1)')
    # UI flow: click DEPLOY via the real button
    pg.click('#btnStart'); pg.wait_for_timeout(300)
    print('after deploy: hud visible =', pg.evaluate("() => !document.getElementById('hud').classList.contains('hidden')"), 'state =', pg.evaluate('() => window.__game.state'))
    runs = [('tdm','warehouse','vmp','g18',150,'normal'), ('1v1','dust','m4a1','m1911',120,'hard'), ('ffa','skyline','ak47','magnum',150,'normal'),
            ('tdm','frostbite','kar98k','g18',120,'easy'), ('ffa','warehouse','m680','m1911',100,'hard'), ('1v1','frostbite','vmp','g18',90,'normal'), ('tdm','dust','ak47','magnum',100,'hard'), ('ffa','frostbite','m4a1','g18',100,'normal'), ('tdm','skyline','m680','m1911',100,'normal'),
            ('tdm','warehouse','vmp','g18',100,'normal','third'), ('ffa','dust','kar98k','magnum',100,'normal','third'), ('1v1','frostbite','m680','g18',80,'hard','third')]
    for r in runs:
        res = pg.evaluate(SIM, list(r))
        bad = res['errors'] or res['nanPos'] or res['outOfBounds']
        print(('FAIL ' if bad else 'OK   ') + '/'.join(map(str, r[:4])), json.dumps({k: res[k] for k in ('state','time','score','minMoved','maxMoved','playerAlive','feed','endShown','nanPos','outOfBounds')}))
        print('      kills:', res['kills'])
        for e in res['errors']: print('      ERROR', e[:600])
        if bad: errors.append('sim failed ' + str(r))
    # force a match end and check the end screen + play again
    pg.evaluate("() => { const g = window.__game; g.matchT = g.mode.time + 1; g.update(1/60); }")
    print('forced end ->', pg.evaluate("() => ({state: window.__game.state, title: document.getElementById('endTitle').textContent, rows: document.querySelectorAll('#endTable tr').length})"))
    pg.click('#btnAgain'); pg.wait_for_timeout(200)
    print('play again state =', pg.evaluate('() => window.__game.state'))
    # toggle controls: pause-menu button + V key
    pg.evaluate("() => { window.__game.state = 'playing'; }")
    pg.keyboard.press('KeyV'); pg.wait_for_timeout(100)
    print('after V key view =', pg.evaluate('() => window.__game.settings.view'), 'buttons sel =', pg.evaluate("() => [...document.querySelectorAll('.viewseg .sel')].map(b => b.dataset.view)"))
    pg.evaluate("() => document.querySelectorAll('.viewseg button[data-view=first]')[1].click()")
    print('after pause-menu click view =', pg.evaluate('() => window.__game.settings.view'), 'saved =', pg.evaluate("() => JSON.parse(localStorage.getItem('ironstrike')).view"))
    # animations / recoil / tac stance on every weapon with every attachment
    ANIM = pg.evaluate("""async () => { const g = window.__game, out = {errors: [], weapons: {}};
      const prims = ['vmp','m4a1','ak47','kar98k','m680'], secs = ['g18','m1911','magnum'];
      for (const [i, prim] of prims.entries()) {
        const sec = secs[i % 3];
        g.start({mode:'ffa',map:'warehouse',mapName:'W',primary:prim,secondary:sec,attP:7,attS:7,difficulty:'easy'}); g.state='playing';
        const p = g.player; p.protT = 99; g.matchT = 1; g.keys = {};
        const rec = [];
        for (const slot of [0, 1]) {
          p.switchT = 0; if (p.cur !== slot) g.switchWeapon(p, slot); p.switchT = 0;
          const w = p.weapon, vm = g.vm; let bad = false, base = [];
          // fire 12 shots (or as many as the mag allows), record the pitch kick of each
          const kicks = [];
          for (let n = 0; n < Math.min(12, w.mag); n++) { p.fireCd = 0; p.switchT = 0; const before = p.pitch; g.playerShoot(p, false); kicks.push(p.pitch - before); for (let f = 0; f < 6; f++) { try { g.frame(1/60); } catch (e) { out.errors.push(String(e.stack || e)); } } p.recoilDebt = 0; p.pitch = 0; }
          // reload sequence, sampled through the whole animation
          p.ammo[p.cur].mag = 0; g.startReload(p);
          for (let f = 0; f < Math.ceil(w.reload * 60) + 10; f++) {
            try { g.frame(1/60); } catch (e) { out.errors.push(String(e.stack || e)); break; }
            // everything the player should see during a reload must stay inside the view (vmCam: fov 58, 16:9)
            { const r = g.vmRoot, T = Math.tan(29 * Math.PI / 180), asp = 1280 / 720, u = vm.gun.userData;
              const toNdc = (v) => { let [x, y, z] = v;
                let c = Math.cos(r.rotation.z), sn = Math.sin(r.rotation.z); [x, y] = [x * c - y * sn, x * sn + y * c];
                c = Math.cos(r.rotation.y); sn = Math.sin(r.rotation.y); [x, z] = [x * c + z * sn, -x * sn + z * c];
                c = Math.cos(r.rotation.x); sn = Math.sin(r.rotation.x); [y, z] = [y * c - z * sn, y * sn + z * c];
                x += r.position.x; y += r.position.y; z += r.position.z; return [x / -z / (T * asp), y / -z / T]; };
              const pts = [[0, 0, 0], [u.fore.x + vm.lh.position.x, u.fore.y + vm.lh.position.y, u.fore.z + vm.lh.position.z]];
              // the support hand of a pistol already rests low at the hip, so a point may not go further out of frame than it started
              if (f === 0) base = pts.map(q => Math.min(-0.93, toNdc(q)[1]));
              for (const [qi, q] of pts.entries()) { const [nx, ny] = toNdc(q); if (Math.abs(nx) > 0.98 || ny < base[qi] - 0.03 || ny > 0.95) { bad = true; out.offscreen = (out.offscreen || []).concat([[w.id, qi, +nx.toFixed(2), +ny.toFixed(2), +base[qi].toFixed(2)]]).slice(0, 5); } } }
            const r = g.vmRoot; if (![r.position.x, r.position.y, r.position.z, r.rotation.x, r.rotation.y, r.rotation.z, vm.lh.position.x, vm.lh.position.y, vm.lh.position.z].every(isFinite)) bad = true;
          }
          for (const e of vm.mags) if (Math.abs(e.m.position.y - e.p.y) > 1e-6 || !e.m.visible) bad = true;      // mags must end up back in the gun
          g.vmS.inspectT = 2.8; for (let f = 0; f < 200; f++) g.frame(1/60);
          p.tacOn = true; g.adsHeld = true; for (let f = 0; f < 40; f++) g.frame(1/60); const tacSpread = g.currentSpread(p), tacV = p.tac, adsInTac = p.ads, rz = g.vmRoot.rotation.z, crossHidden = g.hud.el.crosshair && g.hud.el.crosshair.style.opacity; g.adsHeld = false; p.tacOn = false; for (let f = 0; f < 40; f++) g.frame(1/60);
          const hipSpread = g.currentSpread(p);
          rec.push({w: w.id, bad, kicks: kicks.length, distinct: new Set(kicks.map(k => k.toFixed(5))).size, tac: +tacV.toFixed(2), tacBetter: tacSpread < hipSpread, adsInTac: +adsInTac.toFixed(2), tacRoll: +rz.toFixed(2), crossHidden, lasers: !!(w.attMask & 4), dot: !!(w.attMask & 1), slides: vm.slides.length, mags: vm.mags.length, bolts: vm.bolts.length, pumps: vm.pumps.length});
        }
        out.weapons[prim + '/' + sec] = rec;
      }
      return out; }""")
    bad = [r for k, v in ANIM['weapons'].items() for r in v if r['bad'] or not r['tacBetter'] or r['tac'] < 0.95 or r['adsInTac'] > 0.05 or abs(r['tacRoll']) < 1.0 or r['crossHidden'] == '0' or (r['kicks'] > 3 and r['distinct'] < 3)]
    for k, v in ANIM['weapons'].items(): print('anim', k, [(r['w'], 'mags', r['mags'], 'slides', r['slides'], 'bolt', r['bolts'], 'pump', r['pumps'], 'distinct kicks', r['distinct']) for r in v])
    print('offscreen:', ANIM.get('offscreen')); print('anim problems:', bad, 'errors:', ANIM['errors'][:2])
    assert not bad and not ANIM['errors'], (bad, ANIM['errors'])
    # attachments: stats + models + laser dot
    A = pg.evaluate("""() => { const g = window.__game;
      g.start({mode:'tdm',map:'dust',mapName:'Dust',primary:'m4a1',secondary:'g18',attP:3,attS:5,difficulty:'normal'}); g.state='playing';
      const p = g.player; p.protT = 99; g.adsHeld = false; g.fireHeld = false; g.keys = {};
      const w0 = p.weapons[0], w1 = p.weapons[1];
      const out = {m4a1: [w0.attMask, +w0.recoil.toFixed(4), +w0.adsSpread.toFixed(4), +w0.spread.toFixed(4)], g18: [w1.attMask, +w1.spread.toFixed(4), +w1.adsSpread.toFixed(4)], sightY: g.vm.sightY};
      p.switchT = 0; g.switchWeapon(p, 1); p.switchT = 0; for (let i = 0; i < 90; i++) g.frame(1/60);
      out.sightY2 = g.vm.sightY; p.yaw = 0; p.pitch = -0.6; g.frame(1/60); out.laser = g.laserDot.visible;
      p.switchT = 0; g.switchWeapon(p, 0); p.switchT = 0; g.frame(1/60); out.laserOff = g.laserDot.visible;
      return out; }""")
    print('attachments:', A)
    assert A['m4a1'][0] == 3 and A['g18'][0] == 5 and A['laser'] and not A['laserOff'] and A['sightY2'] < 0.07 and A['sightY'] > 0.09, A
    # slide + mantle
    M = pg.evaluate("""() => { const g = window.__game; const out = {};
      g.start({mode:'ffa',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'easy'}); g.state='playing';
      const p = g.player; p.protT = 99; g.matchT = 1; g.fireHeld = false; g.adsHeld = false; g.prevCrouch = false; for (const a of g.actors) if (!a.isPlayer) { a.alive = false; a.respawnT = 9999; }
      p.pos.set(900, 0, 900); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = 0; g.keys = {};
      // slide: sprint, then tap crouch
      g.keys.KeyW = true; g.keys.ShiftLeft = true; for (let f = 0; f < 70; f++) g.frame(1/60);
      out.sprintSp = +p.speed2.toFixed(2);
      g.keys.KeyC = true; g.frame(1/60); out.sliding = p.slideT > 0; out.slideSp = +p.speed2.toFixed(2);
      for (let f = 0; f < 20; f++) g.frame(1/60); out.crouched = p.crouch; out.eyeLow = p.eye < 1.3;
      g.keys.KeyC = false; for (let f = 0; f < 90; f++) g.frame(1/60); out.slideEnded = p.slideT <= 0; out.stood = !p.crouch;
      // a slide must not start from a standstill or from walking
      g.keys = {}; for (let f = 0; f < 60; f++) g.frame(1/60); g.keys.KeyC = true; g.frame(1/60); out.noStandSlide = !(p.slideT > 0); g.keys = {}; for (let f = 0; f < 30; f++) g.frame(1/60);
      // mantle: a 1.2 m ledge straight ahead
      p.pos.set(500, 0, 500); p.vel.set(0, 0, 0); p.yaw = 0; g.keys = {}; g.prevCrouch = false;
      g.col.boxes.push({x0: 498.5, x1: 501.5, z0: 496.5, z1: 499.6, y0: 0, y1: 1.2});
      g.keys.KeyW = true; g.keys.Space = true; let sawMantle = false;
      for (let f = 0; f < 120; f++) { g.frame(1/60); if (p.mantle) sawMantle = true; if (!p.mantle && sawMantle) break; }
      out.mantled = sawMantle; out.topY = +p.pos.y.toFixed(2); out.onTop = Math.abs(p.pos.y - 1.2) < 0.05 && p.pos.z < 499.6 && p.pos.z > 496.5; out.finite = [p.pos.x, p.pos.y, p.pos.z].every(isFinite);
      // too high to mantle
      g.keys = {}; p.pos.set(700, 0, 700); p.vel.set(0, 0, 0); g.col.boxes.push({x0: 698.5, x1: 701.5, z0: 696.5, z1: 699.6, y0: 0, y1: 2.6});
      g.keys.KeyW = true; g.keys.Space = true; let tall = false; for (let f = 0; f < 60; f++) { g.frame(1/60); if (p.mantle) tall = true; } out.tallBlocked = !tall;
      return out; }""")
    print('slide/mantle:', M)
    assert M['sprintSp'] > 5.8 and M['sliding'] and M['slideSp'] > M['sprintSp'] and M['crouched'] and M['eyeLow'] and M['slideEnded'] and M['noStandSlide'], M
    assert M['mantled'] and M['onTop'] and M['finite'] and M['tallBlocked'], M
    # gore: 12 gib models, head popping, parts hidden then restored, toggle
    GR = pg.evaluate("""() => { const g = window.__game, out = {};
      g.start({mode:'ffa',map:'warehouse',mapName:'W',primary:'m680',secondary:'g18',attP:0,attS:0,difficulty:'easy'}); g.state='playing'; g.matchT = 1;
      const p = g.player; p.protT = 99; g.settings.gore = true;
      const bots = g.actors.filter(a => !a.isPlayer); const gr = g.gore;
      // every model builds and has several meshes
      out.models = {}; for (const part of ['head','torso','arm','leg']) { out.models[part] = [0,1,2].map(v => { const o = gr.gib(part, {x: 800+v, y: 2, z: 800}, {x: 0, y: 0, z: 0}, 0x4aa3ff, v); return o.g.children.length; }); }
      gr.clear();
      const b = bots[0]; b.protT = 0; b.hp = 1; b.pos.set(b.pos.x, b.pos.y, b.pos.z);
      g.kill(b, p, p.weapons[0], true);       // shotgun headshot
      out.gibs = gr.gibs.length; out.headHidden = b.mesh.headG.visible === false; out.hiddenN = b.mesh.goreHidden.length;
      out.kinds = gr.gibs.map(o => o.part + o.variant);
      for (let f = 0; f < 240; f++) { try { g.frame(1/60); } catch (e) { out.err = String(e); break; } }
      out.finite = gr.gibs.every(o => [o.g.position.x, o.g.position.y, o.g.position.z].every(isFinite));
      out.resting = gr.gibs.filter(o => o.rest).length; out.decals = gr.decals.filter(d => d.visible).length; out.decalMaps = new Set(gr.decals.map(d => d.material.map && d.material.map.url)).size; 
      // respawn restores the body
      g.spawn(b); for (let f = 0; f < 3; f++) g.frame(1/60); out.restored = b.mesh.headG.visible === true && b.mesh.goreHidden.length === 0;
      // gore off = no gibs
      gr.clear(); g.settings.gore = false; const c = bots[1]; c.protT = 0; g.kill(c, p, p.weapons[0], true); out.offGibs = gr.gibs.length; g.settings.gore = true;
      return out; }""")
    # blood must stick to walls too (surface normal pointing away from the wall)
    WS = pg.evaluate("""() => { const g = window.__game; g.start({mode:'ffa',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'easy'}); g.state='playing'; g.matchT = 1; g.settings.gore = true;
      const p = g.player; p.protT = 99; for (const a of g.actors) if (!a.isPlayer) { a.alive = false; a.respawnT = 9999; }
      g.col.boxes.push({x0: 490, x1: 510, z0: 497, z1: 498, y0: 0, y1: 4});
      const v = g.actors.find(a => !a.isPlayer); v.alive = true; v.protT = 0; v.pos.set(500, 0, 500); p.pos.set(500, 0, 506);
      const calls = []; const orig = g.gore.splat.bind(g.gore); g.gore.splat = (sf, size, grow) => { calls.push([+sf.nx.toFixed(1), +sf.ny.toFixed(1), +sf.nz.toFixed(1), +sf.z.toFixed(2)]); return orig(sf, size, grow); };
      g.kill(v, p, p.weapons[0], false);
      for (let f = 0; f < 120; f++) g.frame(1/60);
      return { total: calls.length, wall: calls.filter(c => c[2] === 1 && Math.abs(c[3] - 498) < 0.05).length, floor: calls.filter(c => c[1] === 1).length }; }""")
    print('wall splatter:', WS)
    assert WS['wall'] >= 2 and WS['floor'] >= 2, WS
    # soldiers hold their guns: forward kinematics of both arms must put the palms on the grip / foregrip
    HG = pg.evaluate("""async () => { const g = window.__game, W = await import('/js/weapons.js'), S = await import('/js/soldier.js'); const out = { worst: {}, bad: [] };
      const rx = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c]; };
      const rz = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0]*c - v[1]*s, v[0]*s + v[1]*c, v[2]]; };
      const fk = (sh) => { const L1 = S.ARM.L1, L2 = S.ARM.L2, el = sh.userData.el;
        const a = rx(rz([0, -L2, 0], el.rotation.z), el.rotation.x);                       // forearm in the shoulder frame
        const b = rx(rz([a[0], a[1] - L1, a[2]], sh.rotation.z), sh.rotation.x);           // upper arm + forearm in body space
        return [sh.position.x + b[0], sh.position.y + b[1], sh.position.z + b[2]]; };
      for (const id of Object.keys(W.WEAPONS)) {
        const m = g.makeBotMesh(0x4aa3ff, W.WEAPONS[id], null); let worst = 0;
        for (const pitch of [-0.6, -0.2, 0, 0.3, 0.6]) {
          const miss = S.holdGun(m, pitch), u = m.gun.userData;
          const gp = rx([u.grip.x, u.grip.y, u.grip.z], pitch), fp = rx([u.fore.x, u.fore.y, u.fore.z], pitch);
          const grip = [m.gun.position.x + gp[0], m.gun.position.y + gp[1], m.gun.position.z + gp[2]], fore = [m.gun.position.x + fp[0], m.gun.position.y + fp[1], m.gun.position.z + fp[2]];
          const R = fk(m.arms[1]), Lh = fk(m.arms[0]);
          const dR = Math.hypot(R[0]-grip[0], R[1]-grip[1], R[2]-grip[2]), dL = Math.hypot(Lh[0]-fore[0], Lh[1]-fore[1], Lh[2]-fore[2]);
          worst = Math.max(worst, dR, dL); if (dR > 0.04 || dL > 0.09) out.bad.push([id, pitch, +dR.toFixed(3), +dL.toFixed(3)]);
        }
        out.worst[id] = +worst.toFixed(3);
      }
      return out; }""")
    print('hold gun:', HG)
    assert not HG['bad'], HG
    # sandbox: no bots, no end, dummies that do nothing, instant loadout swaps
    SB = pg.evaluate("""() => { const g = window.__game, out = {};
      g.start({mode:'sandbox',map:'warehouse',mapName:'W',primary:'vmp',secondary:'g18',attP:7,attS:5,difficulty:'hard'}); g.state='playing';
      const p = g.player; out.actors0 = g.actors.length; out.cd = g.matchT;
      p.pos.set(300, 0, 300); p.vel.set(0, 0, 0); p.yaw = 0; p.pitch = -0.25; g.keys = {};
      for (let f = 0; f < 60; f++) g.frame(1/60);
      out.timer = g.hud.cache.timer; out.hint = !g.hud.el.sbhint.classList.contains('hidden');
      // B key spawns one dummy at the crosshair
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' })); document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyB' }));
      const ds = () => g.actors.filter(a => a.dummy);
      out.one = ds().length; const d0 = ds()[0];
      out.d0 = d0 && { alive: d0.alive, x: +d0.pos.x.toFixed(2), y: +d0.pos.y.toFixed(2), z: +d0.pos.z.toFixed(2), vis: d0.mesh.root.visible, facing: Math.abs(Math.sin(d0.yaw - Math.atan2(-(p.pos.x - d0.pos.x), -(p.pos.z - d0.pos.z)))) < 0.01 };
      // Shift+B x5 -> capped at 20
      for (let k = 0; k < 6; k++) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', shiftKey: true }));
      out.capped = ds().length;
      // dummies stand still and never shoot
      const before = ds().map(a => [a.pos.x, a.pos.y, a.pos.z]);
      for (let f = 0; f < 400; f++) g.frame(1/60);
      out.still = ds().every((a, i) => a.pos.x === before[i][0] && a.pos.y === before[i][1] && a.pos.z === before[i][2] && a.alive && a.lastShot < 0);
      out.hp = p.hp; out.state = g.state; out.stillActors = g.actors.length;
      // kill one: it falls, then is removed
      g.damage(d0, p, 500, p.weapon, true); out.deadFlag = !d0.alive; out.kills = p.kills;
      for (let f = 0; f < 60 * 9; f++) g.frame(1/60);
      out.removed = !g.actors.includes(d0);
      // N clears
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' })); out.cleared = ds().length;
      // crate: dummy stands on top of it
      g.col.boxes.push({x0: 299, x1: 301, z0: 296, z1: 298, y0: 0, y1: 1.0}); p.pos.set(300, 0, 300); p.pitch = -0.21; g.frame(1/60);
      g.sandboxSpawn(1); const dc = ds()[0]; out.crateY = dc && +dc.pos.y.toFixed(2);
      g.clearDummies();
      // live loadout swap
      p.alive = true; g.applyLoadout(p, 'ak47', 'm1911', 7, 1); for (let f = 0; f < 5; f++) g.frame(1/60);
      out.lo = [p.weapons[0].id, p.weapons[1].id, p.weapons[0].attMask, p.weapons[1].attMask, p.weapon.id, g.vm && g.vm.id, p.ammo[0].mag === p.weapons[0].mag, p.mesh.gunId];
      g.timeLeft = 0; g.matchT = 5000; for (let f = 0; f < 10; f++) g.frame(1/60); out.stillPlaying = g.state === 'playing' && !g.ended;
      return out; }""")
    print('sandbox:', SB)
    assert SB['actors0'] == 1 and SB['cd'] >= 0 and SB['timer'] == 'SANDBOX' and SB['hint'] and SB['one'] == 1 and SB['d0']['alive'] and SB['d0']['vis'] and SB['d0']['facing'] and SB['capped'] == 20, SB
    assert SB['still'] and SB['hp'] == 100 and SB['deadFlag'] and SB['kills'] == 1 and SB['removed'] and SB['cleared'] == 0 and abs(SB['crateY'] - 1.0) < 0.05, SB
    assert SB['lo'][:6] == ['ak47', 'm1911', 7, 1, 'ak47', 'ak47'] and SB['lo'][6] and SB['lo'][7] == 'ak47' and SB['stillPlaying'], SB
    # sandbox pause-menu panel: spawn button + live loadout through the real UI
    SU = pg.evaluate("""async () => { const g = window.__game, $ = (id) => document.getElementById(id), o = {};
      g.start({mode:'sandbox',map:'dust',mapName:'D',primary:'vmp',secondary:'g18',attP:0,attS:0,difficulty:'easy'}); g.state = 'playing';
      const p = g.player; p.pos.set(400, 0, 400); p.yaw = 0; p.pitch = -0.3; for (let f = 0; f < 10; f++) g.frame(1/60);
      g.pause(); o.panelShown = !$('sbPanel').classList.contains('hidden'); o.pauseShown = !$('pause').classList.contains('hidden');
      $('sbSpawn').click(); $('sbSpawn5').click(); o.dummies = g.actors.filter(a => a.dummy).length; o.countTxt = $('sbCount').textContent;
      $('sbPrim').value = 'm4a1'; $('sbPrim').dispatchEvent(new Event('change'));
      $('sbSec').value = 'magnum'; $('sbSec').dispatchEvent(new Event('change'));
      o.chips = $('sbAttP').querySelectorAll('.chip').length;
      $('sbAttP').querySelector('.chip').click();                // toggle the first attachment on the new primary
      o.weapons = [p.weapons[0].id, p.weapons[1].id, p.weapons[0].attMask > 0];
      $('sbClear').click(); o.cleared = g.actors.filter(a => a.dummy).length;
      g.resume(); o.resumed = g.state;
      // other modes never show the sandbox panel
      g.start({mode:'ffa',map:'dust',mapName:'D',primary:'vmp',secondary:'g18',attP:0,attS:0,difficulty:'easy'}); g.state = 'playing'; g.pause(); o.ffaPanel = !$('sbPanel').classList.contains('hidden'); g.resume();
      return o; }""")
    print('sandbox ui:', SU)
    assert SU['panelShown'] and SU['pauseShown'] and SU['dummies'] == 6 and SU['weapons'][:2] == ['m4a1', 'magnum'] and SU['weapons'][2] and SU['chips'] == 3 and SU['cleared'] == 0 and not SU['ffaPanel'], SU
    print('gore:', GR)
    assert all(len(v) == 3 and all(n >= 3 for n in v) for v in GR['models'].values()), GR
    assert GR['gibs'] >= 2 and GR['headHidden'] and GR['finite'] and GR['resting'] >= 1 and GR['decals'] >= 1 and GR['decalMaps'] == 19 and GR['restored'] and GR['offGibs'] == 0 and 'err' not in GR, GR
    # easter egg: type "richtofen"
    pg.evaluate("() => { const g = window.__game; g.start({mode:'tdm',map:'dust',mapName:'Dust',primary:'vmp',secondary:'g18',difficulty:'normal'}); g.state='playing'; }")
    pg.keyboard.type('richtofen', delay=20); pg.wait_for_timeout(800)
    egg = pg.evaluate("() => { const g = window.__game; return {on: g.richtofen, rich: g.actors.filter(a => a.mesh.rich && a.mesh.rich.visible).length, hidden: g.actors.every(a => a.mesh.parts.every(p => !p.visible)), n: g.actors.length, toast: document.getElementById('toast').textContent}; }")
    print('easter egg on:', egg); assert egg['on'] and egg['rich'] == egg['n'] and egg['hidden'], egg
    pg.evaluate("() => { const g = window.__game; for (let i = 0; i < 120; i++) g.frame(1/60); g.start({mode:'ffa',map:'dust',mapName:'Dust',primary:'vmp',secondary:'g18',difficulty:'normal'}); }")
    print('new match keeps it:', pg.evaluate("() => window.__game.actors.every(a => a.mesh.rich && a.mesh.rich.visible)"))
    pg.keyboard.type('richtofen', delay=20); pg.wait_for_timeout(300)
    print('toggled off:', pg.evaluate("() => window.__game.richtofen === false && window.__game.actors.every(a => !a.mesh.rich.visible && a.mesh.parts.every(p => p.visible))"))
    b.close()
print('\nRUNTIME ERRORS:', errors if errors else 'none')
sys.exit(1 if errors else 0)
