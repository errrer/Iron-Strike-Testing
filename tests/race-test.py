"""Dirt bike race UI under the three stub. Usage: python3 tests/race-test.py"""
import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); errs = []; ok = True
def check(n, c, i=''):
    global ok; ok &= bool(c); print(('ok   ' if c else 'FAIL ') + n, i)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 700})
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(900)
    check('landing has the race card', pg.evaluate("!!document.getElementById('lRace')"))
    pg.click('#lRace'); pg.wait_for_timeout(100)
    check('race menu opens', pg.evaluate("!document.getElementById('raceMenu').classList.contains('hidden') && document.getElementById('landing').classList.contains('hidden')"))
    pg.select_option('#rLaps', '1'); pg.click('#rGo'); pg.wait_for_timeout(200)
    check('race HUD shown, game in race state', pg.evaluate("!document.getElementById('race').classList.contains('hidden') && window.__game.state === 'race'"))
    # drive: countdown, then hold gas
    pg.evaluate("() => { const g = window.__game; for (let i = 0; i < 60 * 4; i++) g.frame(1/60); }")
    check('countdown over', pg.evaluate("window.__game.race.sim.state") == 'racing')
    pg.evaluate("window.__game.race.keys.KeyW = true"); pg.evaluate("() => { const g = window.__game; for (let i = 0; i < 60 * 3; i++) g.frame(1/60); }")
    sp = pg.evaluate("window.__game.race.sim.player.speed"); check('gas accelerates', sp > 12, round(sp, 1))
    check('HUD speed updates', int(pg.evaluate("document.getElementById('rKmh').textContent")) > 40)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); check('Esc pauses', pg.evaluate("window.__game.race.paused"))
    t0 = pg.evaluate("window.__game.race.sim.t"); pg.evaluate("() => { for (let i = 0; i < 30; i++) window.__game.frame(1/60); }"); check('paused = frozen', pg.evaluate("window.__game.race.sim.t") == t0)
    pg.click('#rResume'); pg.wait_for_timeout(50); check('resume', not pg.evaluate("window.__game.race.paused"))
    # let the AI drive the player round the lap to reach the results screen
    pg.evaluate("""async () => { const m = await import('/js/race-core.js'); const r = window.__game.race; r.readInput = () => m.aiControl(r.sim.player, r.sim.track, 1/60, true); }""")
    pg.evaluate("() => { const g = window.__game; for (let i = 0; i < 60 * 120 && !g.race.endShown; i++) g.frame(1/60); }")
    check('results screen after the finish', pg.evaluate("window.__game.race.endShown && !document.getElementById('raceEnd').classList.contains('hidden')"))
    rows = pg.evaluate("document.querySelectorAll('#rEndTable tr').length"); check('results table lists 6 riders', rows == 7, rows)
    pg.click('#rAgain'); pg.wait_for_timeout(100); check('race again restarts', pg.evaluate("window.__game.race.sim.t") < 0)
    pg.click('#rPauseBtn', force=True) if False else None
    pg.evaluate("window.__game.race.exit()"); check('exit returns to the landing screen', pg.evaluate("window.__game.race === null && !document.getElementById('landing').classList.contains('hidden')"))
    # free ride
    pg.click('#lRace'); pg.select_option('#rLaps', '0'); pg.click('#rGo'); pg.wait_for_timeout(100)
    check('free ride: one bike, no countdown', pg.evaluate("window.__game.race.sim.bikes.length === 1 && window.__game.race.sim.state === 'racing'"))
    pg.evaluate("() => { for (let i = 0; i < 120; i++) window.__game.frame(1/60); }")
    b.close()
print('ERRS', errs[:4]); print('PASS' if ok and not errs else 'FAIL')
