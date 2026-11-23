#!/usr/bin/env python3
"""Round off the forearms: every forearm edge is split once and the new vertex is pushed out to the tube's radius, so the 8-sided arm becomes a 16-sided one.
Reads tools/arms_src.json (the model straight from bake-arms.py) and writes assets/models/arms.json. Triangles that touch the forearm only along one or two edges are split
along those edges only, so there are no cracks at the glove cuff."""
import json, base64, numpy as np, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'
src = R + 'tools/arms_src.json'
if not os.path.exists(src): open(src, 'w').write(open(R + 'assets/models/arms.json').read())
d = json.load(open(src)); n = d['n']; names = d['names']
f = lambda k, t, c: np.frombuffer(base64.b64decode(d[k]), t).reshape(-1, c)
pos = f('pos', np.float32, 3).astype(float); uv = f('uv', np.float32, 2).astype(float); nor = f('nor', np.float32, 3).astype(float)
si = f('si', np.uint16, 4); sw = f('sw', np.float32, 4); idx = np.frombuffer(base64.b64decode(d['idx']), np.uint16).reshape(-1, 3)
bind = [np.array(m).reshape(4, 4).T for m in d['bind']]; ix = {nm: i for i, nm in enumerate(names)}
dom = np.array([names[b] for b in si[np.arange(n), sw.argmax(1)]])
side = {}                                                                          # vertex -> (elbow, wrist) of its arm, for forearm vertices only
for sd, arm, hand, helper in (('L', 'Left_Arm', 'Left_Hand', 'L_wrist_helper'), ('R', 'Right_Arm', 'Right_Hand', 'R_wrist_helper')):
    e, w = bind[ix[arm]][:3, 3], bind[ix[hand]][:3, 3]
    for v in range(n):
        if dom[v] in (arm, helper) and uv[v, 0] * 1024 > 640 and (1 - uv[v, 1]) * 512 < 335: side[v] = (e, w)
def axis_of(v):
    e, w = side[v]; a = (w - e) / np.linalg.norm(w - e); return e, a
P, UV, NO, SI, SW = list(pos), list(uv), list(nor), list(si), list(sw)
mid = {}
def midpoint(a, b):
    k = (min(a, b), max(a, b))
    if k in mid: return mid[k]
    m = (pos[a] + pos[b]) / 2; e, ax = axis_of(a)
    pr = lambda p: e + ax * np.dot(p - e, ax)
    ra, rb = np.linalg.norm(pos[a] - pr(pos[a])), np.linalg.norm(pos[b] - pr(pos[b]))
    rv = m - pr(m); ln = np.linalg.norm(rv)
    if ln > 1e-6: m = pr(m) + rv / ln * (ra + rb) / 2
    w = {}
    for v, t in ((a, 0.5), (b, 0.5)):
        for j in range(4):
            if sw[v][j] > 0: w[int(si[v][j])] = w.get(int(si[v][j]), 0) + sw[v][j] * t
    top = sorted(w.items(), key=lambda kv: -kv[1])[:4]; s = sum(x for _, x in top)
    ids = [b_ for b_, _ in top] + [0] * (4 - len(top)); ws = [x / s for _, x in top] + [0.0] * (4 - len(top))
    nn = nor[a] + nor[b]; nn = nn / (np.linalg.norm(nn) or 1)
    P.append(m); UV.append((uv[a] + uv[b]) / 2); NO.append(nn); SI.append(np.array(ids, np.uint16)); SW.append(np.array(ws, np.float32))
    mid[k] = len(P) - 1; return mid[k]
tris = []
for a, b, c in idx:
    v = [int(a), int(b), int(c)]; sp = [(v[i] in side and v[(i + 1) % 3] in side) for i in range(3)]      # edge i = v[i] -> v[i+1]
    m = [midpoint(v[i], v[(i + 1) % 3]) if sp[i] else None for i in range(3)]
    k = sum(sp)
    if k == 0: tris.append(v)
    elif k == 3: tris += [[v[0], m[0], m[2]], [m[0], v[1], m[1]], [m[2], m[1], v[2]], [m[0], m[1], m[2]]]
    elif k == 1:
        i = sp.index(True); p0, p1, p2 = v[i], v[(i + 1) % 3], v[(i + 2) % 3]; tris += [[p0, m[i], p2], [m[i], p1, p2]]
    else:
        i = sp.index(False); q0, q1, q2 = v[(i + 1) % 3], v[(i + 2) % 3], v[i]          # q0->q1 and q1->q2 split? edge i is the unsplit one = v[i]->v[i+1]; the split ones are q0->q1... (i+1) and q1->q2... (i+2)
        ma, mb = m[(i + 1) % 3], m[(i + 2) % 3]                                          # ma on v[i+1]->v[i+2], mb on v[i+2]->v[i]
        tris += [[ma, v[(i + 2) % 3], mb], [v[i], v[(i + 1) % 3], ma], [v[i], ma, mb]]
N = len(P); assert N < 65535
enc = lambda arr, t: base64.b64encode(np.array(arr, t).tobytes()).decode()
d['pos'] = enc(P, np.float32); d['uv'] = enc(UV, np.float32); d['nor'] = enc(NO, np.float32); d['si'] = enc(SI, np.uint16); d['sw'] = enc(SW, np.float32)
d['idx'] = enc(tris, np.uint16); d['n'] = N; d['tris'] = len(tris)
json.dump(d, open(R + 'assets/models/arms.json', 'w'), separators=(',', ':')); print('verts', n, '->', N, 'tris', len(idx), '->', len(tris))
