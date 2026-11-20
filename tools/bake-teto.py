#!/usr/bin/env python3
"""Bakes the (static, T-posed) Kasane Teto OBJ into assets/teto/teto.json: a skinned mesh for the soldier rig.
usage: bake-teto.py <dir with tetokasane.obj + textures> <out dir>.  Model ripped by onlinesaipa."""
import sys, json, base64, shutil, os
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
V, VT, VN, F = [], [], [], []
grp = mat = ''
for l in open(os.path.join(src, 'tetokasane.obj')):
    t = l.split()
    if not t: continue
    if t[0] == 'v': V.append([float(x) for x in t[1:4]])
    elif t[0] == 'vt': VT.append([float(t[1]), float(t[2])])
    elif t[0] == 'vn': VN.append([float(x) for x in t[1:4]])
    elif t[0] == 'g': grp = t[1] if len(t) > 1 else ''
    elif t[0] == 'usemtl': mat = t[1]
    elif t[0] == 'f':
        idx = []
        for p in t[1:]:
            a = p.split('/'); idx.append((int(a[0]) - 1, int(a[1]) - 1 if len(a) > 1 and a[1] else 0, int(a[2]) - 1 if len(a) > 2 and a[2] else -1))
        for i in range(1, len(idx) - 1): F.append((idx[0], idx[i], idx[i + 1], grp, mat))
V = np.array(V); VT = np.array(VT); VN = np.array(VN)
TEX = {'material1': 'Image09C52D00_09C4A860.png', 'material71': 'Image09C52D00_09C4A860.png', 'material111': 'Image09C52D00_09C4A860.png',
       'material46': 'Image09C4AC80_09C4A440.png', 'material93': 'Image09C4AC80_09C4A440.png',
       'material153': 'Image09CCB780_09CC3280.png', 'material222': 'Image09CC3700_09CC2E60.png'}
TEXLIST = ['Image09C52D00_09C4A860.png', 'Image09C4AC80_09C4A440.png', 'Image09CCB780_09CC3280.png', 'Image09CC3700_09CC2E60.png']
NAMES = ['clothes', 'skin', 'hair', 'face']
HEAD_GROUPS = {'hair+headset', 'face', 'eyeL', 'eyeR', 'teeth', 'eyebrows'}

S = 0.0185                       # model units -> metres (about 1.83 m tall, matches the soldier's hips/knees)
K = 1.25                         # arms are stretched along their length so both hands reach a rifle
sh_o = np.array([10.0, 70.4, -1.0]); dd = np.array([0.955, -0.296, 0.0]); dd /= np.linalg.norm(dd)   # original-space shoulder + arm direction (+x side)
HIP_Y, KNEE_Y, ANK_Y, HIP_X = 47.0, 26.0, 5.0, 4.5

def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# ---- per-vertex bone weights (computed on the original T-pose, per OBJ vertex + group) ------------------------
# bones: 0 hips(root) 1 head | 2 shoulder 3 elbow 4 wrist (L = -x side after the flip) | 5 6 7 (R) | 8 hip 9 knee 10 ankle (L) | 11 12 13 (R)
def weights(p, g):
    w = np.zeros(14); x, y, z = p
    ax = abs(x); side_arm = 0 if x > 0 else 1        # after the 180deg flip original +x becomes the soldier's -x (arms[0])
    if g in HEAD_GROUPS:
        w[1] = 1; return w
    head = sm(76, 82, y) if ax < 12 else 0
    # arms: beyond the torso, up in the shoulder band
    a = sm(9.5, 13, ax) if 54 < y < 78 else 0
    if y < 54 and ax > 12: a = 1                      # hands that droop low
    if a > 0:
        proj = (np.array([ax, y, z]) - sh_o) @ dd * 1.0   # distance along the arm
        e = sm(8.5, 13.0, proj); wr = sm(18.5, 23.0, proj)   # shoulder->elbow->wrist blend along the arm
        b0 = 2 + 3 * side_arm
        wa = np.zeros(14); wa[b0] = 1 - e; wa[b0 + 1] = e * (1 - wr); wa[b0 + 2] = e * wr
        w += a * wa
    rest = 1 - a
    if y < 54:                                        # legs
        lw = 1 - sm(42, 49, y)
        if g in ('boots+belt', 'hands+clothes') and y > 47: lw *= 0.3
        s = 0 if x > 0 else 1
        k = sm(KNEE_Y - 3, KNEE_Y + 3, -y + 2 * KNEE_Y)    # 0 above the knee -> 1 below
        k = 1 - sm(KNEE_Y - 3.5, KNEE_Y + 3.5, y)
        f = 1 - sm(ANK_Y - 2.5, ANK_Y + 2.5, y)
        b0 = 8 + 3 * s
        wl = np.zeros(14); wl[b0] = (1 - k); wl[b0 + 1] = k * (1 - f); wl[b0 + 2] = k * f
        mid = sm(0.2, 2.4, ax)                        # keep the crotch seam from tearing
        wl2 = np.zeros(14); b1 = 8 + 3 * (1 - s); wl2[b1] = wl[b0]; wl2[b1 + 1] = wl[b0 + 1]; wl2[b1 + 2] = wl[b0 + 2]
        wlx = wl * (0.5 + 0.5 * mid) + wl2 * (0.5 - 0.5 * mid)
        w += rest * lw * wlx; rest *= (1 - lw)
    w[1] += rest * head; rest *= (1 - head)
    w[0] += rest
    return w

def pre(p):                                           # original -> final space (face -z, metres) incl. arm stretch handled by caller
    return p

# ---- build unique vertices ------------------------------------------------------------------------------------
uniq = {}; pos = []; uv = []; nor = []; wts = []; groups = {n: [] for n in NAMES}
for f in F:
    ti = TEXLIST.index(TEX[f[4]]); tri = []
    for (vi, ti_, ni) in f[:3]:
        key = (vi, ti_, ni, f[3])
        if key not in uniq:
            p = V[vi]; w = weights(p, f[3])
            q = p.copy()
            # stretch arm vertices along the arm direction about the shoulder
            ax = abs(p[0]); aw = (w[2:8].sum())
            if aw > 0:
                q_rel = np.array([ax, p[1], p[2]]) - sh_o; pr = q_rel @ dd
                q = np.array([ax, p[1], p[2]]) + dd * pr * (K - 1) * aw
                q[0] *= (1 if p[0] > 0 else -1)
            else:
                q = q
            fin = np.array([-q[0] * S, q[1] * S, -q[2] * S])
            n = VN[ni] if ni >= 0 else np.array([0, 1, 0]); n = np.array([-n[0], n[1], -n[2]])
            uniq[key] = len(pos); pos.append(fin); uv.append(VT[ti_] if ti_ >= 0 else [0, 0]); nor.append(n); wts.append(w)
        tri.append(uniq[key])
    tri = [tri[0], tri[2], tri[1]]                    # the flip mirrors winding -> restore
    groups[NAMES[ti]].extend(tri)
pos = np.array(pos, np.float32); uv = np.array(uv, np.float32); nor = np.array(nor, np.float32); wts = np.array(wts)
# keep the 4 strongest influences
si = np.zeros((len(pos), 4), np.uint16); sw = np.zeros((len(pos), 4), np.float32)
for i, w in enumerate(wts):
    o = np.argsort(-w)[:4]; ws = w[o]; ws = ws / ws.sum(); si[i] = o; sw[i] = ws
idx = []; gl = []
for ni, n in enumerate(NAMES):
    gl.append([len(idx), len(groups[n]), ni]); idx.extend(groups[n])
idx = np.array(idx, np.uint16 if len(pos) < 65535 else np.uint32)

# ---- bind pose (final space) -----------------------------------------------------------------------------------
shf = np.array([-sh_o[0] * S, sh_o[1] * S, -sh_o[2] * S])             # arms[0] side (-x)
d1 = np.array([-dd[0], dd[1], 0.0])
L1 = 10.5 * S * K; L2 = 13.5 * S * K
bones = {'hipsY': HIP_Y * S, 'headY': 80.5 * S, 'shoulder': shf.tolist(), 'dir': d1.tolist(), 'L1': L1, 'L2': L2,
         'hipX': HIP_X * S, 'hipY': HIP_Y * S, 'kneeY': KNEE_Y * S, 'ankY': ANK_Y * S}
b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
data = {'pos': b64(pos), 'uv': b64(uv), 'nor': b64(nor), 'idx': b64(idx), 'idx32': idx.dtype == np.uint32, 'si': b64(si), 'sw': b64(sw),
        'groups': gl, 'mats': [{'name': n, 'map': 'assets/teto/%s.png' % n, 'alpha': n in ('hair', 'face')} for n in NAMES], 'bones': bones, 'n': len(pos)}
os.makedirs(out, exist_ok=True)
for n, tf in zip(NAMES, TEXLIST):
    shutil.copy(os.path.join(src, tf), os.path.join(out, n + '.png'))
json.dump(data, open(os.path.join(out, 'teto.json'), 'w'), separators=(',', ':'))
open(os.path.join(out, 'CREDITS.txt'), 'w').write('Kasane Teto model ripped by onlinesaipa (credit appreciated, not required). Do not claim to have ripped it yourself.\n')
print('verts', len(pos), 'tris', len(idx) // 3, 'tall', pos[:, 1].max(), 'json KB', os.path.getsize(os.path.join(out, 'teto.json')) // 1024, bones)
