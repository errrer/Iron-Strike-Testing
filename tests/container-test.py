import http.server, socketserver, threading, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
stub = open('tests/three-stub.js').read(); errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/cdn.jsdelivr.net/npm/three@**', lambda r: r.fulfill(body=stub, content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(800)
    r = pg.evaluate("""() => { const g = window.__game; g.start({mode:'tdm',map:'container',mapName:'C',primary:'m4a1',secondary:'m1911',difficulty:'normal'}); g.state='playing';
      for (let i=0;i<300;i++) g.frame(1/60);
      const n = g.nav; const A = n.inRect(g.map.spawns[0]).length, B = n.inRect(g.map.spawns[1]).length;
      return {boxes: g.map.boxes.length, A, B, alive: g.actors.filter(a=>a.alive).length, pos: [g.player.pos.x, g.player.pos.z]}; }""")
    print(r); print('ERRS', errs[:3]); b.close()
