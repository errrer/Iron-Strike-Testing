#!/usr/bin/env python3
"""Bakes the textured Glock 19 FBX (+ PBR texture sets) into assets/models/g19.json and assets/models/g19/*.jpg
usage: bake-g19.py <G19.fbx> <texture dir> [out dir]
Model space: metres, muzzle towards -Z, +Y up, origin = middle of the slide / bottom of the slide (same convention as every other gun)."""
import sys, os, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbxparse import parse
from fbx2model import rot_xyz

fbx, texdir = sys.argv[1], sys.argv[2]; out = sys.argv[3] if len(sys.argv) > 3 else 'assets/models'
r = parse(fbx); o = r.get('Objects'); conns = r.get('Connections').children
byid = {c.props[0]: c for c in o.children}
par = {}; geo = {}; mats = {}
for c in conns:
    a, b = c.props[1], c.props[2]
    if a in byid and b in byid:
        A, B = byid[a].name, byid[b].name
        if A == 'Model' and B == 'Model': par[a] = b
        elif A == 'Geometry' and B == 'Model': geo[b] = a
        elif A == 'Material' and B == 'Model': mats.setdefault(b, []).append(a)
def trs(m):
    t = np.zeros(3); rot = np.zeros(3); s = np.ones(3)
    for p in m.get('Properties70').children:
        n = p.props[0]
        if n == 'Lcl Translation': t = np.array(p.props[4:7], float)
        elif n == 'Lcl Rotation': rot = np.array(p.props[4:7], float)
        elif n == 'Lcl Scaling': s = np.array(p.props[4:7], float)
    return t, rot, s
def local(m):
    t, rr, s = trs(m); M = np.eye(4); M[:3, :3] = rot_xyz(*rr) @ np.diag(s); M[:3, 3] = t; return M
def world(i):
    M = local(byid[i]); return world(par[i]) @ M if i in par else M
SC = 0.01                                           # file units are centimetres
FLIP = np.diag([-1.0, 1, -1])                       # the file has the muzzle at +Z; the game wants -Z
parts = []
for mid, m in byid.items():
    if m.name != 'Model' or mid not in geo: continue
    name = m.props[1].split('\x00')[0]
    if name.startswith('Bullet'): continue          # loose round + casing: not used
    g = byid[geo[mid]]; V = g.get('Vertices').props[0].reshape(-1, 3).astype(float)
    W = world(mid); L = W[:3, :3]; NM = np.linalg.inv(L).T
    idx = g.get('PolygonVertexIndex').props[0]
    ln = g.get('LayerElementNormal'); N = ln.get('Normals').props[0].reshape(-1, 3).astype(float); nidx = ln.get('NormalsIndex'); nidx = nidx.props[0] if nidx else None
    lu = g.get('LayerElementUV'); UV = lu.get('UV').props[0].reshape(-1, 2).astype(float); uvi = lu.get('UVIndex').props[0]
    lm = g.get('LayerElementMaterial'); mi = lm.get('Materials').props[0] if lm else np.zeros(1, int); mmap = lm.get('MappingInformationType').props[0] if lm else 'AllSame'
    slots = [byid[x].props[1].split('\x00')[0] for x in mats.get(mid, [])]
    flip = np.linalg.det(L) < 0
    groups = {}
    poly = []; pn = 0
    for k, i in enumerate(idx):
        end = i < 0; poly.append((k, ~i if end else i))
        if end:
            slot = slots[mi[pn] if mmap == 'ByPolygon' else mi[0]] if slots else 'GL19_Metal'
            for j in range(1, len(poly) - 1):
                tri = [poly[0], poly[j], poly[j + 1]]
                for (pk, vi) in tri:
                    p = (W @ np.append(V[vi], 1))[:3] * SC; n = NM @ N[nidx[pk] if nidx is not None else pk]; n /= np.linalg.norm(n) or 1
                    p = FLIP @ p; n = FLIP @ n
                    groups.setdefault(slot, []).append((p, n, UV[uvi[pk]]))
                # FLIP has det +1 (180 deg about Y) so winding only flips if the node transform mirrors
                if flip: 
                    t = groups[slot]; t[-2], t[-1] = t[-1], t[-2]
            poly = []; pn += 1
    for slot, corners in groups.items(): parts.append((name, 'plastic' if 'Plastic' in slot else 'metal', corners))
allp = np.array([c[0] for _, _, cs in parts for c in cs])
mn, mx = allp.min(0), allp.max(0)
slide = np.array([c[0] for n, _, cs in parts if n == 'GL_Slide' for c in cs])
ox = (mn[0] + mx[0]) / 2; oy = slide[:, 1].min(); oz = (slide[:, 2].min() + slide[:, 2].max()) / 2
off = np.array([ox, oy, oz])
outp = []
for name, mt, cs in parts:
    key = {}; pos = []; nor = []; uv = []; ind = []
    for p, n, u in cs:
        p = p - off; k = (round(p[0], 5), round(p[1], 5), round(p[2], 5), round(n[0], 2), round(n[1], 2), round(n[2], 2), round(u[0], 4), round(u[1], 4))
        if k not in key: key[k] = len(pos); pos.append(p); nor.append(n); uv.append(u)
        ind.append(key[k])
    outp.append({'name': name, 'mat': mt, 'positions': [round(float(x), 5) for p in pos for x in p], 'normals': [round(float(x), 3) for n in nor for x in n],
                 'uvs': [round(float(x), 5) for u in uv for x in u], 'indices': ind})
F = allp - off
def part_pts(n): return np.array([c[0] - off for nn, _, cs in parts if nn == n for c in cs])
fr = part_pts('GL_Frame'); mag = part_pts('GL_Magazine'); sl = part_pts('GL_Slide'); br = part_pts('GL_Barrel'); tg = part_pts('GL_Trigger')
data = {'name': 'g19', 'version': 2, 'textured': True, 'parts': outp,
        'bounds': {'min': [round(float(x), 4) for x in F.min(0)], 'max': [round(float(x), 4) for x in F.max(0)]},
        'muzzle': [0.0, round(float(br[:, 1].mean()), 4), round(float(F[:, 2].min()), 4)], 'sightY': round(float(sl[:, 1].max()), 4),
        'anchors': {'slide': [round(float(x), 4) for x in sl.mean(0)], 'mag': [round(float(x), 4) for x in mag.mean(0)], 'trigger': [round(float(x), 4) for x in tg.mean(0)],
                    'frame': [round(float(x), 4) for x in fr.mean(0)]},
        'magBounds': {'min': [round(float(x), 4) for x in mag.min(0)], 'max': [round(float(x), 4) for x in mag.max(0)]},
        'slideBounds': {'min': [round(float(x), 4) for x in sl.min(0)], 'max': [round(float(x), 4) for x in sl.max(0)]},
        'frameBounds': {'min': [round(float(x), 4) for x in fr.min(0)], 'max': [round(float(x), 4) for x in fr.max(0)]}}
os.makedirs(os.path.join(out, 'g19'), exist_ok=True)
json.dump(data, open(os.path.join(out, 'g19.json'), 'w'), separators=(',', ':'))
# ---- textures: base colour, normal, packed ORM (R = ambient occlusion, G = roughness, B = metalness; what three.js reads for roughnessMap / metalnessMap / aoMap)
def load(n, mode):
    return Image.open(os.path.join(texdir, n)).convert(mode)
def sz(im, s): return im.resize((s, s), Image.LANCZOS)
for key, pre, S in (('metal', 'G19_Metal', 2048), ('plastic', 'G19_Plastic', 2048)):
    base = sz(load(f'{pre}_BaseColor.png', 'RGB'), S); base.save(os.path.join(out, 'g19', f'{key}_base.jpg'), quality=88)
    nrm = sz(load(f'{pre}_NormalGL.png', 'RGB'), S); nrm.save(os.path.join(out, 'g19', f'{key}_normal.jpg'), quality=92)
    ao = sz(load(f'{pre}_AO.png', 'L'), S); ro = sz(load(f'{pre}_Roughness.png', 'L'), S); me = sz(load(f'{pre}_Metallic.png', 'L'), S)
    Image.merge('RGB', (ao, ro, me)).save(os.path.join(out, 'g19', f'{key}_orm.jpg'), quality=90)
print('parts', [(p['name'], p['mat'], len(p['indices']) // 3) for p in outp]); print('bounds', data['bounds']); print({k: data[k] for k in ('muzzle', 'sightY', 'anchors', 'magBounds', 'slideBounds', 'frameBounds')})
