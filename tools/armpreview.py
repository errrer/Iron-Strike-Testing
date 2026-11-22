#!/usr/bin/env python3
"""dev preview: skins the arms with the poses from tools/armpose.mjs (same maths as the game) next to the Glock, renders 3 views to /tmp/tt/arms_pose.png"""
import sys, json, base64, subprocess, numpy as np
sys.path.insert(0, '/tmp/tt')
import render as rr
from PIL import Image
kind = sys.argv[1] if len(sys.argv) > 1 else 'pistol'; trig = sys.argv[2] if len(sys.argv) > 2 else '0'
R = '/home/claude/iron-strike-testing/'
d = json.load(open(R + 'assets/models/arms.json')); n = d['n']
f = lambda k, t, c: np.frombuffer(base64.b64decode(d[k]), t).reshape(-1, c)
pos = f('pos', np.float32, 3).astype(float); uv = f('uv', np.float32, 2); idx = np.frombuffer(base64.b64decode(d['idx']), np.uint16).reshape(-1, 3)
si = f('si', np.uint16, 4); sw = f('sw', np.float32, 4)
out = json.loads(subprocess.check_output(['node', R + 'tools/armpose.mjs', kind, trig], cwd=R))
M = lambda a: np.array(a).reshape(4, 4).T
bind = [M(m) for m in d['bind']]; pose = [M(m) for m in out]
skin = [pose[i] @ np.linalg.inv(bind[i]) for i in range(len(bind))]
P = np.zeros_like(pos); ph = np.append(pos, np.ones((n, 1)), 1)
for k in range(4):
    for b in np.unique(si[:, k]):
        m = (si[:, k] == b) & (sw[:, k] > 0)
        P[m] += sw[m, k:k+1] * (ph[m] @ skin[b].T)[:, :3]
rr.tex = {'a': np.array(Image.open('/mnt/user-data/attachments/402bcaf6-fdf1-5b59-83c4-cae5b0d35324/115375aa-image.jpg').convert('RGBA'))}
V = list(P * 100); VT = list(uv); F = [((int(a), int(a), -1), (int(b), int(b), -1), (int(c), int(c), -1), '', 'a') for a, b, c in idx]
g = json.load(open(R + 'assets/models/g19.json'))
rr.tex['m'] = np.array(Image.open(R + 'assets/models/g19/metal_base.jpg').resize((512, 512)).convert('RGBA')); rr.tex['p'] = np.array(Image.open(R + 'assets/models/g19/plastic_base.jpg').resize((512, 512)).convert('RGBA'))
if kind == 'pistol':
    for p in g['parts']:
        o = len(V); pp = np.array(p['positions']).reshape(-1, 3) * 100; V.extend(pp); VT.extend(np.array(p['uvs']).reshape(-1, 2)); ix = p['indices']
        for i in range(0, len(ix), 3): F.append(tuple((o + ix[i + j], o + ix[i + j], -1) for j in range(3)) + ('', 'm' if p['mat'] == 'metal' else 'p'))
if kind == 'm4t':
    mm = json.load(open(R + 'assets/models/m4t.json'))
    for p in mm['parts']:
        o = len(V); pp = np.array(p['positions']).reshape(-1, 3) * 100; V.extend(pp); VT.extend(np.array(p['uvs']).reshape(-1, 2)); ix = p['indices']
        for i in range(0, len(ix), 3): F.append(tuple((o + ix[i + j], o + ix[i + j], -1) for j in range(3)) + ('', 'm' if p['mat'] == 'dark' else 'p'))
V = np.array(V); VT = np.array(VT)
CROP = float(sys.argv[3]) if len(sys.argv) > 3 else 24
F = [f for f in F if max(V[f[k][0]][2] for k in range(3)) < CROP]
rr.tex['m'] = np.full((8, 8, 4), (90, 150, 255, 255) if kind != 'm4t' else (60, 60, 70, 255), np.uint8); rr.tex['p'] = np.full((8, 8, 4), (255, 120, 90, 255) if kind != 'm4t' else (140, 120, 80, 255), np.uint8)
# brighten the gun a little so it reads against the hands
ims = [rr.render(V, VT, None, F, v, W=640, H=520) for v in [(90, 0), (0, 25), (-90, 0), (180 - 0.001, 80)]]
Image.fromarray(np.concatenate([np.concatenate(ims[:2], 1), np.concatenate(ims[2:], 1)], 0)).save('/tmp/tt/arms_pose.png'); print('ok')
