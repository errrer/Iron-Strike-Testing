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
    r = pg.evaluate("""() => { const g = window.__game, p = g.player, v = g.actors.find(a => a !== p), w = p.weapon, d = { x: 0, y: 0, z: -1 }, out = [];
      for (const mat of ['wood', 'concrete']) { g.col.boxes.length = 0; g.col.boxes.push({ x0: -3, x1: 3, y0: 0, y1: 4, z0: -10.5, z1: -9.5, mat }); v.hp = 100; g.hitscan(p, 0, 1.2, -5, d, w, 1); out.push(v.hp); }
      g.col.boxes.length = 0; g.col.boxes.push({ x0: -3, x1: 3, y0: 0, y1: 4, z0: -10.5, z1: -9.5, mat: 'concrete' }); const weak = Object.assign({}, w, { pen: 0.2 }); v.hp = 100; g.hitscan(p, 0, 1.2, -5, d, weak, 1); out.push(v.hp);
      return out; }""")
    check('1m wood is shot through (ak)', r[0] < 100)
    check('wood hurts less than nothing, concrete resists more', r[1] >= r[0])
    check('weak-pen gun stopped by concrete', r[2] == 100)
    r = pg.evaluate("""() => { const g = window.__game, pr = g.prog; pr.d.cash = 4900; const c = 18;
      const a = pr.canBuy(c); pr.addCash(100); const b = pr.canBuy(c); const bought = pr.buy('ak47', c);
      return [a, b, bought, pr.d.cash, pr.camoUnlocked('ak47', c), pr.camoUnlocked('m4a1', c)]; }""")
    check('skin needs 5000', r[0] is False and r[1] is True)
    check('buying deducts 5000 and unlocks only that gun', r[2] is True and r[3] == 0 and r[4] is True and r[5] is False)
    r = pg.evaluate("""async () => { const m = await import('./js/supermod.js?v=0.19.4').catch(() => null); return !!m; }""")
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
    r = pg.evaluate("""async () => { const P = await import('./js/progress.js?v=0.19.4'), W = await import('./js/weapons.js?v=0.19.4'), M = await import('./js/gunmodels.js?v=0.19.4');
      (await import('./js/supermod.js?v=0.19.4')).MOD.infMoney = false; const pr = new P.Progress(); const bad = []; for (const id of Object.keys(P.UNLOCK)) if (!W.WEAPONS[id]) bad.push(id);
      pr.d.xp = 1e9; const maxed = pr.info.level; pr.reset(); pr.d.xp = 0; pr.d.cash = 0;
      const locked = !pr.unlocked('barrett', false), cant = !pr.canBuyGun('barrett'); pr.d.cash = P.gunPrice('barrett'); const can = pr.canBuyGun('barrett'), got = pr.buyGun('barrett');
      return { bad, maxed, locked, cant, can, got, own: pr.unlocked('barrett', false), cash: pr.d.cash, price: P.gunPrice('barrett'), n: W.PRIMARIES.length + W.SECONDARIES.length, lock2: !pr.unlocked('awp', false) }; }""")
    check('max level is 100', r['maxed'] == 100)
    check('every UNLOCK id is a real gun', not r['bad'])
    check('buying a gun with money works', r['locked'] and r['cant'] and r['can'] and r['got'] and r['own'] and r['cash'] == 0 and r['lock2'])
    check('lots of guns', r['n'] >= 45)
    # skins & cases: mask bits, rolling, panel + reel
    r = pg.evaluate("""async () => { const W = await import('./js/weapons.js?v=0.19.4'), P = await import('./js/progress.js?v=0.19.4');
      (await import('./js/supermod.js?v=0.19.4')).MOD.infMoney = false;
      const m = W.setSkin(W.setCamo(0, 5), 8), keep = W.cleanMask(W.WEAPONS.ak47, m), knife = W.cleanMask(W.WEAPONS.k_combat, m);
      const counts = { rare: 0, epic: 0, legendary: 0, mythic: 0 }; for (let i = 0; i < 4000; i++) counts[W.rollCase(W.CASES[1]).rarity]++;
      const pr = new P.Progress(); pr.d.cash = 999; const no = pr.openCase(W.CASES[0]); pr.d.cash = 1000; const a = pr.openCase(W.CASES[0]);
      return { skin: W.skinOf(keep), camo: W.camoOf(keep), knifeSkin: W.skinOf(knife), counts, no, a: !!a && pr.ms.length === 1 && pr.d.cash === 0, n: W.SKINS.length - 1 }; }""")
    check('skin bits survive cleanMask next to a camo (not on knives)', r['skin'] == 8 and r['camo'] == 5 and r['knifeSkin'] == 0)
    check('case odds are sensible', r['counts']['rare'] < r['counts']['epic'] and r['counts']['mythic'] > 0 and r['counts']['mythic'] < 400)
    check('case needs its price, then pays out a skin', r['no'] is None and r['a'])
    pg.evaluate("() => { window.__game.prog.d.cash = 20000; }")
    pg.evaluate("() => { document.querySelector('.skinbtn').click(); }")
    check('skins panel opens', pg.evaluate("() => !document.getElementById('sk').classList.contains('hidden')"))
    pg.evaluate("() => document.querySelector('.sk-tabs button[data-tab=cases]').click()")
    pg.evaluate("() => document.querySelector('.sk-open').click()")
    pg.wait_for_timeout(6200)
    check('case reel finishes with a result', pg.evaluate("() => !document.getElementById('skResult').classList.contains('hidden') && document.getElementById('skResult').textContent.length > 10"))
    pg.evaluate("() => { const b = [...document.querySelectorAll('#skResult button')][0]; b.click(); }")
    pg.evaluate("() => document.querySelector('.sk-tabs button[data-tab=mine]').click()")
    check('won skin is equipped', pg.evaluate("() => !/Factory/.test(document.getElementById('skName').textContent)") or pg.evaluate("() => document.querySelectorAll('.sk-card.sel').length > 0"))
    b.close()
print(errs[:3]); print('PASS' if ok and not errs else 'FAIL')
