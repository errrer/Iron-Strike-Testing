#!/usr/bin/env python3
"""Bakes the rigged first-person arms FBX (forearm + hand + finger bones, skinned) into assets/models/arms.json.
usage: bake-arms.py <arms.fbx> [out.json]
Output space ("arms space", metres): y up, hands point towards -Z (away from the camera), left hand at -X.
Every bone is exported as a rigid world matrix (bind pose) + the skin weights; the game poses the bones itself (js/armrig.js)."""
import sys, os, json, base64, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbxparse import parse
from fbx2model import rot_xyz

path = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'assets/models/arms.json'
SC = 0.00033                       # FBX units -> metres (hand ~ 18 cm long)
root = parse(path); o = root.get('Objects'); conns = root.get('Connections').children
byid = {c.props[0]: c for c in o.children}
par = {}
for c in conns:
    a, b = c.props[1], c.props[2]
    if a in byid and b in byid and byid[a].name == 'Model' and byid[b].name == 'Model': par[a] = b
def trs(m):
    t = np.zeros(3); r = np.zeros(3); s = np.ones(3)
    for p in m.get('Properties70').children:
        n = p.props[0]
        if n == 'Lcl Translation': t = np.array(p.props[4:7], float)
        elif n == 'Lcl Rotation': r = np.array(p.props[4:7], float)
        elif n == 'Lcl Scaling': s = np.array(p.props[4:7], float)
    return t, r, s
def local(m):
    t, r, s = trs(m); M = np.eye(4); M[:3, :3] = rot_xyz(*r) @ np.diag(s); M[:3, 3] = t; return M
def world(i):
    M = local(byid[i]); return world(par[i]) @ M if i in par else M
mesh_id = [i for i, m in byid.items() if m.name == 'Model' and m.props[2] == 'Mesh'][0]
geo_id = None
for c in conns:
    if c.props[1] in byid and byid[c.props[1]].name == 'Geometry' and c.props[2] == mesh_id: geo_id = c.props[1]
g = byid[geo_id]; Mm = world(mesh_id)
V = g.get('Vertices').props[0].reshape(-1, 3).astype(float)
pidx = g.get('PolygonVertexIndex').props[0]
nrm = g.get('LayerElementNormal'); N = nrm.get('Normals').props[0].reshape(-1, 3).astype(float); nmap = nrm.get('MappingInformationType').props[0]
ni = nrm.get('NormalsIndex'); nidx = ni.props[0] if ni else None
uvn = g.get('LayerElementUV'); UV = uvn.get('UV').props[0].reshape(-1, 2).astype(float); uvi = uvn.get('UVIndex').props[0]
# game frame: rotate 180deg about Y (arms point to -Z, left hand at -X), then scale
Fm = np.diag([-1.0, 1, -1, 1]); Fm[:3, :3] *= 1.0
def to_final(M4):                  # world 4x4 -> final rigid 4x4 (rotation normalised, translation scaled)
    R = M4[:3, :3].copy(); R = R / np.linalg.norm(R, axis=0); t = M4[:3, 3]
    out = np.eye(4); out[:3, :3] = Fm[:3, :3] @ R; out[:3, 3] = Fm[:3, :3] @ t * SC; return out
Pw = (Mm[:3, :3] @ V.T).T + Mm[:3, 3]; Pf = (Fm[:3, :3] @ Pw.T).T * SC          # bind-pose vertex positions, final space
# bones (those with a skin cluster)
bone_of_cluster = {}
for c in conns:
    a, b = c.props[1], c.props[2]
    if a in byid and b in byid and byid[b].name == 'Deformer' and byid[a].name == 'Model': bone_of_cluster[b] = a
clusters = [(i, m) for i, m in byid.items() if m.name == 'Deformer' and m.props[2] == 'Cluster']
names = []; bind = []; bid = []; W = [[] for _ in V]
for ci, cm in clusters:
    b = bone_of_cluster[ci]; nm = byid[b].props[1].split('\x00')[0].replace('v_weapon.', '')
    bi = len(names); names.append(nm); bid.append(b)
    TL = np.array(cm.get('TransformLink').props[0]).reshape(4, 4).T
    bind.append(to_final(TL))
    if cm.get('Indexes'):
        for vi, w in zip(cm.get('Indexes').props[0], cm.get('Weights').props[0]):
            if w > 1e-4: W[int(vi)].append((bi, float(w)))
# logical parents (by FBX hierarchy, skipping non-skin helper nodes)
bset = {b: k for k, b in enumerate(bid)}
parents = []
for k, b in enumerate(bid):
    p = par.get(b); 
    while p is not None and p not in bset: p = par.get(p)
    parents.append(bset[p] if p is not None else -1)
# unweld to triangles
pos = []; uv = []; nor = []; si = []; sw = []; idx = []; key = {}
poly = []
for k, i in enumerate(pidx):
    end = i < 0; poly.append((k, ~i if end else i))
    if end:
        for j in range(1, len(poly) - 1):
            for (pk, vi) in (poly[0], poly[j], poly[j + 1]):
                u = UV[uvi[pk]]; n = N[nidx[pk] if nidx is not None else pk]
                n = Fm[:3, :3] @ (np.linalg.inv(Mm[:3, :3]).T @ n); n /= np.linalg.norm(n) or 1
                kk = (vi, round(u[0], 5), round(u[1], 5), round(n[0], 2), round(n[1], 2), round(n[2], 2))
                if kk not in key:
                    key[kk] = len(pos); pos.append(Pf[vi]); uv.append(u); nor.append(n)
                    ws = sorted(W[vi], key=lambda x: -x[1])[:4]; tw = sum(w for _, w in ws) or 1
                    ws = ws + [(0, 0.0)] * (4 - len(ws)); si.append([b for b, _ in ws]); sw.append([w / tw for _, w in ws])
                idx.append(key[kk])
        poly = []
# the rotation Fm has det +1 (180deg about Y) so winding is preserved
pos = np.array(pos, np.float32); uv = np.array(uv, np.float32); nor = np.array(nor, np.float32)
b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
data = {'names': names, 'parents': parents, 'bind': [list(map(float, M.T.reshape(-1))) for M in bind],     # column-major, rigid
        'pos': b64(pos), 'uv': b64(uv), 'nor': b64(nor), 'idx': b64(np.array(idx, np.uint16)), 'si': b64(np.array(si, np.uint16)), 'sw': b64(np.array(sw, np.float32)), 'n': len(pos), 'tris': len(idx) // 3}
os.makedirs(os.path.dirname(out), exist_ok=True); json.dump(data, open(out, 'w'), separators=(',', ':'))
print('bones', len(names), 'verts', len(pos), 'tris', len(idx) // 3, 'bounds', pos.min(0).round(3), pos.max(0).round(3), 'KB', os.path.getsize(out) // 1024)
print(names)
