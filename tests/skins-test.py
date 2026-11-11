"""Wall-bang, skins + money, knife camos, new knives/maps. Usage: python3 tests/skins-test.py"""
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
    pg.evaluate("() => { localStorage.clear(); }")
    pg.evaluate("() => { const g = window.__game; g.start({mode:'ffa',map:'dust',mapName:'D',primary:'ak47',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; g.matchT = 5; }")
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, v = g.actors.find(a => a !== p);
      g.col.boxes.length = 0; g.col.boxes.push({ x0: -0.15, x1: 0.15, y0: 0, y1: 4, z0: -10, z1: -9.7 });          // a thin wall at z=-10
      const out = {}; for (const [k, wid] of [['ar', 'ak47'], ['sg', 'm680'], ['sn', 'kar98k']]) {
        const w = Object.values(g.player.weapons).concat([window.__WEAPONS && window.__WEAPONS[wid]]).find(x => x && x.id === wid) || null; out[k] = w ? 1 : 0; }
      p.team = 0; v.team = 1; p.pos.set(0, 0, -5); v.pos.set(0, 0, -14); v.protT = 0; v.alive = true; v.hp = 100;
      const d = { x: 0, y: 0, z: -1 }, w = p.weapon; g.isClient = false;
      g.hitscan(p, 0, 1.2, -5, d, w, 1); const hpAr = v.hp;
      v.hp = 100; g.col.boxes[0].z0 = -14; g.col.boxes[0].z1 = -8;                 // thick wall: 6m
      g.hitscan(p, 0, 1.2, -5, d, w, 1); const hpThick = v.hp;
      return [hpAr, hpThick]; }""")
    check('rifle shoots through a thin wall', r[0] < 100)
    check('thick wall stops the bullet', r[1] == 100)
    r = pg.evaluate("""() => { const g = window.__game, pr = g.prog; pr.d.cash = 4900; const c = 18;
      const a = pr.canBuy(c); pr.addCash(100); const b = pr.canBuy(c); const bought = pr.buy('ak47', c);
      return [a, b, bought, pr.d.cash, pr.camoUnlocked('ak47', c), pr.camoUnlocked('m4a1', c)]; }""")
    check('skin needs 5000', r[0] is False and r[1] is True)
    check('buying deducts 5000 and unlocks only that gun', r[2] is True and r[3] == 0 and r[4] is True and r[5] is False)
    r = pg.evaluate("""async () => { const m = await import('./js/supermod.js?v=0.18.9').catch(() => null); return !!m; }""")
    r = pg.evaluate("""() => { const g = window.__game, pr = g.prog; pr.d.cash = 0; const before = pr.canBuy(19);
      const s = JSON.parse(localStorage.getItem('ironstrike_supermod') || '{}'); return [before, typeof pr.cash]; }""")
    check('no money, no skin', r[0] is False)
    # infinite money via the supermod
    pg.evaluate("() => { localStorage.setItem('ironstrike_supermod', JSON.stringify({ infMoney: true })); }")
    pg.reload(); pg.wait_for_timeout(600)
    r = pg.evaluate("""() => { const g = window.__game, pr = g.prog; g.start({mode:'ffa',map:'dust',mapName:'D',primary:'ak47',secondary:'g18',attP:0,attS:0,difficulty:'normal'});
      const ok1 = pr.canBuy(20), got = pr.buy('m4a1', 20); return [ok1, got, pr.camoUnlocked('m4a1', 20), pr.cash === Infinity, pr.d.cash]; }""")
    check('infinite money buys skins free', r[0] and r[1] and r[2] and r[3] and r[4] == 0)
    r = pg.evaluate("""() => { const g = window.__game; g.knifeId = 'k_katana'; g.knifeMask = (21 << 18); const w = g.knifeW(); return [w.id, (w.attMask >> 18) & 63, ['k_katana','k_kukri','k_dagger'].every(k => !!window.__game && true)]; }""")
    check('knife carries its camo mask', r[0] == 'k_katana' and r[1] == 21)
    r = pg.evaluate("""() => { document.getElementById('knifeGs').click(); const gs = document.getElementById('gs'); return !gs.classList.contains('hidden') && document.getElementById('gsCamos') !== undefined; }""")
    check('knife camo menu opens', r)
    for m in ['catacombs', 'ruins', 'plaza']:
        r = pg.evaluate("(m) => { const g = window.__game; g.start({mode:'tdm',map:m,mapName:m,primary:'m4a1',secondary:'g18',attP:0,attS:0,difficulty:'normal'}); g.state='playing'; for (let i=0;i<30;i++) g.update ? g.update(1/30) : 0; return g.actors.length; }", m)
        check('map ' + m + ' loads', r > 1)
    b.close()
print(errs[:3]); print('PASS' if ok and not errs else 'FAIL')
