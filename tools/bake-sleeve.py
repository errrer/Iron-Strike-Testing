#!/usr/bin/env python3
"""Paint a combat-shirt sleeve (olive fabric, wrist cuff, stitching, creases) over the bare-skin forearm island of the arms texture.
Reads tools/v_hands_src.jpg (the untouched original) and writes assets/models/v_hands.jpg. The island is found by rasterising the forearm triangles' UVs."""
import json, base64, numpy as np, os
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'
src = R + 'tools/v_hands_src.jpg'
if not os.path.exists(src): Image.open(R + 'assets/models/v_hands.jpg').save(src, quality=95)
im = np.array(Image.open(src).convert('RGB')).astype(float); H, W = im.shape[:2]
d = json.load(open(R + 'assets/models/arms.json')); n = d['n']; names = d['names']
f = lambda k, t, c: np.frombuffer(base64.b64decode(d[k]), t).reshape(-1, c)
uv = f('uv', np.float32, 2); idx = np.frombuffer(base64.b64decode(d['idx']), np.uint16).reshape(-1, 3); si = f('si', np.uint16, 4); sw = f('sw', np.float32, 4)
dom = [names[b] for b in si[np.arange(n), sw.argmax(1)]]
arm = np.array([x in ('Left_Arm', 'Right_Arm', 'L_wrist_helper', 'R_wrist_helper') for x in dom]) & (uv[:, 0] * W > 640) & ((1 - uv[:, 1]) * H < 335)   # the forearm island only (top right of the texture)
mask = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(mask)
for a, b, c in idx:
    if arm[a] and arm[b] and arm[c]: dr.polygon([(uv[i][0] * W, (1 - uv[i][1]) * H) for i in (a, b, c)], fill=255)
mk = np.array(mask) > 0; mk = ndi.binary_dilation(mk, iterations=4)
ys, xs = np.where(mk); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); print('island', x0, x1, y0, y1)
rng = np.random.default_rng(7)
def noise(sc, seed):                                              # smooth value noise, 0..1
    r = np.random.default_rng(seed); g = r.random((H // sc + 3, W // sc + 3))
    return ndi.zoom(g, sc, order=3)[:H, :W]
Y, X = np.mgrid[0:H, 0:W].astype(float)
t = np.clip((Y - y0) / (y1 - y0), 0, 1)                            # 0 = wrist end, 1 = elbow end
s = np.clip((X - x0) / (x1 - x0), 0, 1)
# base: olive drab with soft tan / dark-green blotches (low contrast so it reads as cloth, not a pattern)
b1, b2 = noise(40, 1), noise(14, 2)
od = np.array([68, 74, 56.]); tan = np.array([108, 100, 74.]); dk = np.array([44, 52, 40.])
w1 = np.clip((b1 - 0.55) * 5, 0, 1)[..., None]; w2 = np.clip((0.42 - b2) * 5, 0, 1)[..., None]
col = od + (tan - od) * w1 * 0.22 + (dk - od) * w2 * 0.3
# weave: fine twill
twill = 0.5 + 0.5 * np.sin((X + Y) * 2.1); weave = 0.5 + 0.5 * np.sin(X * 3.1) * np.sin(Y * 3.1)
col *= (0.93 + 0.07 * twill + 0.05 * weave)[..., None]
# folds: vertical bands that bend with noise, brighter ridge / darker valley, stronger towards the wrist (sleeve gathers at the cuff)
ph = s * 6.0 * np.pi + 2.2 * noise(60, 3) + 3.5 * t * noise(30, 4)
fold = np.sin(ph) * (0.07 + 0.08 * (1 - t))
fold += 0.10 * np.sin(Y / 9.0 + 4 * noise(50, 5)) * (1 - t) ** 2        # cross creases near the cuff
col *= (1 + fold)[..., None]
col *= (0.9 + 0.2 * noise(5, 6))[..., None]                           # dirt / wear
# cuff: darker elasticated band with a stitch line at the wrist end, seam at the elbow end
cuff = t < 0.17
col = np.where(cuff[..., None], col * 0.62 + np.array([4, 4, 3.]), col)
for yy, w in ((y0 + 0.17 * (y1 - y0), 1.4), (y0 + 0.03 * (y1 - y0), 1.2)):
    dash = (np.sin(X * 1.4) > -0.2)
    line = (np.abs(Y - yy) < w) & dash
    col = np.where(line[..., None], np.array([92, 90, 72.]), col)
    sh = (np.abs(Y - (yy + 2.4)) < 1.6)
    col = np.where(sh[..., None], col * 0.7, col)
col = np.clip(col, 0, 255)
out = im.copy(); out[mk] = col[mk]
Image.fromarray(out.astype(np.uint8)).save(R + 'assets/models/v_hands.jpg', quality=90); print('ok')
