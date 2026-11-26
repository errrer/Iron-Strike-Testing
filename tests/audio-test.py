"""Sound engine: every gun class, hit/kill and every reload cue builds its WebAudio graph without throwing (real AudioContext in Chromium).
Usage: python3 tests/audio-test.py"""
import http.server, socketserver, threading, os, json, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Q); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = """
async () => {
  const { Sound } = await import('/js/audio.js'); const s = new Sound(); s.init(); await new Promise(r => setTimeout(r, 600));
  const out = { ctx: !!s.ctx, rev: !!s.rev, errors: [], n: 0 };
  if (!s.ctx) return out;
  const t = (name, f) => { try { f(); out.n++; } catch (e) { out.errors.push(name + ': ' + e.message); } };
  for (const cls of ['pistol', 'smg', 'ar', 'lmg', 'dmr', 'sniper', 'shotgun', undefined]) {
    t('shot ' + cls, () => s.shot({ cls, snd: { f: 2600, len: 0.11, thump: 0.6 } }, 1, 0.3));
    t('shot quiet ' + cls, () => s.shot({ cls, quiet: 0.25, snd: { f: 2600, len: 0.11, thump: 0.6 } }, 1, -0.3));
  }
  for (const c of ['release', 'magout', 'rustle', 'magin', 'tug', 'boltback', 'boltfwd', 'shell', 'pump']) t('cue ' + c, () => s.cue(c));
  t('hit', () => s.hit(false)); t('head', () => s.hit(true)); t('kill', () => s.kill()); t('switch', () => s.switchGun()); t('click', () => s.click());
  return out;
}
"""
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required']); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(300)
    r = pg.evaluate(JS); print(json.dumps(r)); ok = r['ctx'] and r['rev'] and not r['errors'] and r['n'] >= 25 and not errs
    print('PASS' if ok else 'FAIL', errs[:2]); sys.exit(0 if ok else 1)
