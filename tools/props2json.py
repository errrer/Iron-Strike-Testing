#!/usr/bin/env python3
"""Bake prop FBX/OBJ files (crates, barrels, containers, racking...) into compact JSON with UVs.
  python3 tools/props2json.py in.fbx out.json --height 2.6 [--axis-up z] [--merge-material]
Output: {parts:[{name,color,positions,normals,uvs,indices}], bounds}. Origin = bottom centre, y up, metres.
Needs python3 + numpy (uses tools/fbxparse.py)."""
import argparse, json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbxparse import parse
from fbx2model import rot_xyz

def load_fbx(path):
    root = parse(path); obj = root.get('Objects'); conns = root.get('Connections')
    byid = {c.props[0]: c for c in obj.children}
    parent_of = {}; geom_of = {}
    for c in conns.children:
        a, b = c.props[1], c.props[2]
        if a in byid and b in byid:
            if byid[a].name == 'Geometry' and byid[b].name == 'Model': geom_of[b] = a
            elif byid[a].name == 'Model' and byid[b].name == 'Model': parent_of[a] = b
    def local(m):
        t = np.zeros(3); r = np.zeros(3); s = np.ones(3)
        pr = m.get('Properties70')
        if pr:
            for p in pr.children:
                n = p.props[0]
                if n == 'Lcl Translation': t = np.array(p.props[4:7], float)
                elif n == 'Lcl Rotation': r = np.array(p.props[4:7], float)
                elif n == 'Lcl Scaling': s = np.array(p.props[4:7], float)
        M = np.eye(4); M[:3, :3] = rot_xyz(*r) @ np.diag(s); M[:3, 3] = t
        return M
    def world(mid):
        M = local(byid[mid]); return world(parent_of[mid]) @ M if mid in parent_of else M
    parts = []
    for mid, m in byid.items():
        if m.name != 'Model' or mid not in geom_of: continue
        g = byid[geom_of[mid]]
        v = g.get('Vertices').props[0].reshape(-1, 3).astype(float)
        idx = g.get('PolygonVertexIndex').props[0]
        nl = g.get('LayerElementNormal'); N = nl.get('Normals').props[0].reshape(-1, 3).astype(float) if nl else None
        ni = nl.get('NormalsIndex') if nl else None; nidx = ni.props[0] if ni else None
        ul = g.get('LayerElementUV'); U = ul.get('UV').props[0].reshape(-1, 2).astype(float) if ul else None
        ui = ul.get('UVIndex') if ul else None; uidx = ui.props[0] if ui else None
        W = world(mid); L = W[:3, :3]; flip = np.linalg.det(L) < 0; NM = np.linalg.inv(L).T
        tris = []; poly = []
        for k, i in enumerate(idx):
            end = i < 0; poly.append((k, ~i if end else i))
            if end:
                for j in range(1, len(poly) - 1):
                    tri = [poly[0], poly[j], poly[j + 1]]
                    if flip: tri = [tri[0], tri[2], tri[1]]
                    for (pk, vi) in tri:
                        p = (W @ np.append(v[vi], 1))[:3]
                        nn = np.array([0, 1, 0.])
                        if N is not None:
                            nn = NM @ (N[nidx[pk]] if nidx is not None else N[pk]); nn = nn / (np.linalg.norm(nn) or 1)
                        uv = (U[uidx[pk]] if uidx is not None else U[pk]) if U is not None else np.zeros(2)
                        tris.append((p, nn, uv))
                poly = []
        parts.append(dict(name=m.props[1].split('\x00')[0], tris=tris))
    return parts

def load_obj(path):
    V = []; VT = []; VN = []; tris = []
    for ln in open(path, errors='ignore'):
        s = ln.split()
        if not s: continue
        if s[0] == 'v': V.append([float(x) for x in s[1:4]])
        elif s[0] == 'vt': VT.append([float(x) for x in s[1:3]])
        elif s[0] == 'vn': VN.append([float(x) for x in s[1:4]])
        elif s[0] == 'f':
            c = []
            for t in s[1:]:
                q = (t.split('/') + ['', ''])[:3]
                c.append((V[int(q[0]) - 1], VN[int(q[2]) - 1] if q[2] else [0, 1, 0], VT[int(q[1]) - 1] if q[1] else [0, 0]))
            for j in range(1, len(c) - 1):
                for k in (0, j, j + 1): tris.append(tuple(np.array(x, float) for x in c[k]))
    return [dict(name='obj', tris=tris)]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--height', type=float, default=None, help='scale so the model is this tall (m)')
    ap.add_argument('--scale', type=float, default=None, help='explicit scale (applied after the up-axis swap)')
    ap.add_argument('--up', default='y', help='which source axis is up: y, z, -y, -z')
    ap.add_argument('--keep', default=None, help='comma list of part names to keep')
    ap.add_argument('--drop', default=None, help='comma list of part names to drop')
    ap.add_argument('--decimate', type=float, default=0, help='vertex-cluster cell size (m) for heavy meshes')
    a = ap.parse_args()
    parts = load_fbx(a.src) if a.src.lower().endswith('.fbx') else load_obj(a.src)
    if a.keep: parts = [p for p in parts if p['name'] in a.keep.split(',')]
    if a.drop: parts = [p for p in parts if p['name'] not in a.drop.split(',')]
    R = {'y': np.eye(3), '-y': np.diag([1, -1, -1.]), 'z': np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0.]]), '-z': np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0.]])}[a.up]
    allp = np.vstack([R @ p[0] for part in parts for p in [(np.array([t[0] for t in part['tris']]).T,)]] if False else [(R @ np.array([t[0] for t in part['tris']]).T).T for part in parts])
    mn, mx = allp.min(0), allp.max(0)
    sc = a.scale or (a.height / (mx[1] - mn[1]) if a.height else 1.0)
    shift = np.array([-(mn[0] + mx[0]) / 2, -mn[1], -(mn[2] + mx[2]) / 2])
    out = {'name': os.path.basename(a.out), 'parts': []}
    allf = []
    for part in parts:
        P = (R @ np.array([t[0] for t in part['tris']]).T).T; P = (P + shift) * sc
        Nn = (R @ np.array([t[1] for t in part['tris']]).T).T; UV = np.array([t[2] for t in part['tris']])
        allf.append(P)
        cell = a.decimate
        key = {}; pos = []; nor = []; uvs = []; ind = []
        for p, n, uv in zip(P, Nn, UV):
            if cell:
                k = (round(p[0] / cell), round(p[1] / cell), round(p[2] / cell), round(n[0] * 2), round(n[1] * 2), round(n[2] * 2))
            else:
                k = (round(p[0], 4), round(p[1], 4), round(p[2], 4), round(n[0], 2), round(n[1], 2), round(n[2], 2), round(uv[0], 4), round(uv[1], 4))
            if k not in key: key[k] = len(pos); pos.append(p); nor.append(n); uvs.append(uv)
            ind.append(key[k])
        ind = np.array(ind).reshape(-1, 3)
        ind = ind[(ind[:, 0] != ind[:, 1]) & (ind[:, 1] != ind[:, 2]) & (ind[:, 0] != ind[:, 2])]
        out['parts'].append({'name': part['name'], 'positions': [round(float(x), 3) for p in pos for x in p],
                             'normals': [round(float(x), 2) for n in nor for x in n], 'uvs': [round(float(x), 4) for u in uvs for x in u],
                             'indices': [int(i) for i in ind.reshape(-1)]})
    F = np.vstack(allf)
    out['bounds'] = {'min': [round(float(x), 3) for x in F.min(0)], 'max': [round(float(x), 3) for x in F.max(0)]}
    json.dump(out, open(a.out, 'w'), separators=(',', ':'))
    print(a.out, 'size', (F.max(0) - F.min(0)).round(2), 'verts', sum(len(p['positions']) // 3 for p in out['parts']), 'tris', sum(len(p['indices']) // 3 for p in out['parts']), 'bytes', os.path.getsize(a.out))

if __name__ == '__main__': main()
