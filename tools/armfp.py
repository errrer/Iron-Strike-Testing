#!/usr/bin/env python3
"""dev preview: first-person view of the posed arms + gun through the game's viewmodel camera. usage: armfp.py <pistol|m4t> [ads 0|1] [full] -> /tmp/tt/arms_fp.png"""
import sys, json, base64, subprocess, numpy as np, os
sys.path.insert(0, '/tmp/tt')
from fp import render_fp
from PIL import Image
kind = sys.argv[1] if len(sys.argv) > 1 else 'm4t'; ads = int(sys.argv[2]) if len(sys.argv) > 2 else 0
R = '/home/claude/iron-strike-testing/'
d = json.load(open(R + 'assets/models/arms.json')); n = d['n']
f = lambda k, t, c: np.frombuffer(base64.b64decode(d[k]), t).reshape(-1, c)
pos = f('pos', np.float32, 3).astype(float); uv = f('uv', np.float32, 2); idx = np.frombuffer(base64.b64decode(d['idx']), np.uint16).reshape(-1, 3)
si = f('si', np.uint16, 4); sw = f('sw', np.float32, 4)
env = dict(os.environ)
out = json.loads(subprocess.check_output(['node', R + 'tools/armpose.mjs', kind, '0'], cwd=R, env=env))
M = lambda a: np.array(a).reshape(4, 4).T
bind = [M(m) for m in d['bind']]; pose = [M(m) for m in out]
skin = [pose[i] @ np.linalg.inv(bind[i]) for i in range(len(bind))]
P = np.zeros_like(pos); ph = np.append(pos, np.ones((n, 1)), 1)
for k in range(4):
    for b in np.unique(si[:, k]):
        m = (si[:, k] == b) & (sw[:, k] > 0)
        P[m] += sw[m, k:k+1] * (ph[m] @ skin[b].T)[:, :3]
tex = {'a': np.array(Image.open(R + 'assets/models/v_hands.jpg').convert('RGB'))}
V = list(P); VT = list(uv); F = [(int(a), int(b), int(c), 'a') for a, b, c in idx]
def add(path, keymap):
    mm = json.load(open(path))
    for p in mm['parts']:
        o = len(V); V.extend(np.array(p['positions']).reshape(-1, 3)); VT.extend(np.array(p['uvs']).reshape(-1, 2)); ix = p['indices']
        for i in range(0, len(ix), 3): F.append((o + ix[i], o + ix[i + 1], o + ix[i + 2], keymap[p['mat']]))
if kind == 'm4t':
    for k in ('tan', 'dark'): tex[k] = np.array(Image.open(R + f'assets/models/m4t/{k}_base.jpg').resize((1024, 1024)).convert('RGB'))
    add(R + 'assets/models/m4t.json', {'tan': 'tan', 'dark': 'dark'}); sy = 0.062; hip = [0.17, -0.19, -0.45]
else:
    for k in ('metal', 'plastic'): tex[k] = np.array(Image.open(R + f'assets/models/g19/{k}_base.jpg').resize((1024, 1024)).convert('RGB'))
    add(R + 'assets/models/g19.json', {'metal': 'metal', 'plastic': 'plastic'}); sy = json.load(open(R + 'assets/models/g19.json')).get('sightY', 0.03); hip = [0.17, -0.19, -0.45]
V = np.array(V); VT = np.array(VT)
off = np.array([0, -sy, -0.38 + (0.06 if kind == 'pistol' else 0)]) if ads else np.array(hip)
if os.environ.get('OFF'): off = np.array(json.loads(os.environ['OFF']))
img = render_fp(V + off, VT, F, tex, W=1920, H=1080)
full = len(sys.argv) > 3 and sys.argv[3] == 'full'
crop = img if full else (img[300:1080, 560:1920] if ads else img[430:1080, 900:1920])
Image.fromarray(crop).save("/tmp/tt/arms_fp.png"); print('ok')
