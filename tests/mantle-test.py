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
    r = pg.evaluate("""() => { const g = window.__game; g.start({mode:'tdm',map:'warehouse',mapName:'W',primary:'m4a1',secondary:'m1911',difficulty:'normal'}); g.state='playing';
      const col = g.col, pl = g.player; for (let i=0;i<20;i++) g.frame(1/60);
      // build a 1.6 m ledge in front, put player mid-air beside it with no Space held
      col.boxes.push({x0:-2,x1:2,z0:-6,z1:-3,y0:0,y1:1.6}); pl.pos.set(0,0.9,-2.2); pl.yaw=0; pl.vel.set(0,0,0); pl.onGround=false; pl.mantleCd=0; g.matchT=Math.max(g.matchT,1); g.keys={KeyW:true}; window.__d=()=>({ft:typeof g.frame,fr:g.frozen,st:g.state,mt:g.matchT});
      let got=false; for (let i=0;i<30;i++){ g.frame(1/60); if (pl.mantle) {got=true;break;} }
      for (let i=0;i<90;i++) g.frame(1/60);
      return {d:window.__d(), fwd: g.keys, got, y: pl.pos.y, z: pl.pos.z, ground: pl.onGround}; }""")
    print(r); print('ERRS', errs[:3]); b.close()
