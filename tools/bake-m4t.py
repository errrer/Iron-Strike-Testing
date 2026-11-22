#!/usr/bin/env python3
"""Bakes the textured M4A1 OBJ (2 PBR texture sets: 1231 = tan furniture/magazine, 2132 = black receiver) into assets/models/m4t.json + assets/models/m4t/*.jpg
usage: bake-m4t.py <model.obj> <texture dir> [out dir]   (texture dir holds 1231_Base_color.png, 1231_Metallic.png, 1231_Mixed_AO.png, 1231_Normal_DirectX.png, 1231_Roughness.png and the same for 2132)
Model space: metres, muzzle towards -Z, +Y up, origin on the bore axis at the receiver (same convention as every other gun). The OBJ is in centimetres with the muzzle at +Z."""
import sys, os, json, collections
import numpy as np
from PIL import Image
obj, texdir = sys.argv[1], sys.argv[2]; out = sys.argv[3] if len(sys.argv) > 3 else 'assets/models'
V = []; VT = []; VN = []; faces = []; mat = None
for l in open(obj):
    if l.startswith('v '): V.append(l.split()[1:4])
    elif l.startswith('vt '): VT.append(l.split()[1:3])
    elif l.startswith('vn '): VN.append(l.split()[1:4])
    elif l.startswith('usemtl'): mat = l.split()[1]
    elif l.startswith('f '): faces.append(([tuple(int(x) if x else 0 for x in c.split('/')) for c in l.split()[1:]], mat))
V = np.array(V, float); VT = np.array(VT, float); VN = np.array(VN, float)
# connected pieces (union-find over shared vertices) so the magazine and the iron sights can be animated / hidden on their own
par = list(range(len(V)))
def find(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
for f, _ in faces:
    a = find(f[0][0] - 1)
    for c in f[1:]:
        b = find(c[0] - 1)
        if a != b: par[b] = a
comp = {}
for f, m in faces: comp.setdefault(find(f[0][0] - 1), []).append((f, m))
BORE = 1.2                                                           # bore axis height in the file (cm)
tag = {}
for r, fs in comp.items():
    idx = np.unique([c[0] - 1 for f, _ in fs for c in f]); P = V[idx]; mn, mx = P.min(0), P.max(0)
    if mx[0] - mn[0] < 3.2 and mn[2] > 1.5 and mx[2] < 11 and mn[1] < -6.2 and mx[1] < 1.6: tag[r] = 'mag'          # the magazine (shell, spring, follower, base plate)
    elif mx[1] > 5.0 and (mx[2] < -2.5 or mn[2] > 30.5): tag[r] = 'iron'                                             # front / rear iron sights
    else: tag[r] = 'body'
FLIP = np.array([-1.0, 1, -1])
groups = {}                                                          # (tag, material) -> list of corner tuples
for r, fs in comp.items():
    for f, m in fs:
        for k in range(1, len(f) - 1):
            for c in (f[0], f[k], f[k + 1]): groups.setdefault((tag[r], m), []).append(c)
allv = V * FLIP / 100.0 * np.array([1, 1, 1]); allv[:, 1] = (V[:, 1] - BORE) / 100.0
def tp(i): return allv[i]
parts = []; allpts = []
for (tg, m), cs in groups.items():
    key = {}; pos = []; nor = []; uv = []; ind = []
    for c in cs:
        k = (c[0], c[1], c[2])
        if k not in key:
            key[k] = len(pos); pos.append(tp(c[0] - 1))
            n = VN[c[2] - 1] * FLIP if c[2] else np.array([0, 1.0, 0]); nor.append(n / (np.linalg.norm(n) or 1)); uv.append(VT[c[1] - 1] if c[1] else [0, 0])
        ind.append(key[k])
    allpts.append(np.array(pos))
    parts.append({'name': tg, 'mat': 'tan' if m == '1231' else 'dark', 'tag': tg, 'positions': [round(float(x), 4) for p in pos for x in p], 'normals': [round(float(x), 3) for n in nor for x in n],
                  'uvs': [round(float(x), 4) for u in uv for x in u], 'indices': ind})
def ptsof(t): return np.concatenate([np.array(p['positions']).reshape(-1, 3) for p in parts if p['tag'] == t])
A = np.concatenate(allpts); mag = ptsof('mag'); body = ptsof('body')
r5 = lambda a: [round(float(x), 4) for x in a]
data = {'name': 'm4t', 'version': 1, 'textured': True, 'texKeys': ['tan', 'dark'], 'rifle': True, 'parts': parts,
        'bounds': {'min': r5(A.min(0)), 'max': r5(A.max(0))}, 'magBounds': {'min': r5(mag.min(0)), 'max': r5(mag.max(0))},
        'muzzle': [0.0, 0.0, round(float(A[:, 2].min()), 4)], 'sightY': 0.062,
        'ud': {'grip': [0.0, -0.077, 0.06], 'fore': [0.0, -0.03, -0.25], 'mount': [0.0, 0.037, -0.12], 'under': [0.0, -0.02, -0.22], 'side': [0.019, 0.012, -0.22]}}
os.makedirs(os.path.join(out, 'm4t'), exist_ok=True); json.dump(data, open(os.path.join(out, 'm4t.json'), 'w'), separators=(',', ':'))
S = 2048
def load(n, mode): return Image.open(os.path.join(texdir, n)).convert(mode).resize((S, S), Image.LANCZOS)
for key, pre in (('tan', '1231'), ('dark', '2132')):
    load(f'{pre}_Base_color.png', 'RGB').save(os.path.join(out, 'm4t', f'{key}_base.jpg'), quality=88)
    r, g, b = load(f'{pre}_Normal_DirectX.png', 'RGB').split(); Image.merge('RGB', (r, g.point(lambda v: 255 - v), b)).save(os.path.join(out, 'm4t', f'{key}_normal.jpg'), quality=92)   # DirectX -> OpenGL (flip green)
    Image.merge('RGB', (load(f'{pre}_Mixed_AO.png', 'L'), load(f'{pre}_Roughness.png', 'L'), load(f'{pre}_Metallic.png', 'L'))).save(os.path.join(out, 'm4t', f'{key}_orm.jpg'), quality=90)
print({p['name'] + '/' + p['mat']: len(p['indices']) // 3 for p in parts}); print(data['bounds'], data['magBounds'])
