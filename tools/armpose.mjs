// dev preview helper: node tools/armpose.mjs <pistol|rifle> [trig] -> prints JSON of posed bone matrices {Left, Right} (used by tools/armpreview.py)
import { ArmRig, placeHands, SHOULDER } from '../js/armrig.js';
import fs from 'fs';
const d = JSON.parse(fs.readFileSync(new URL('../assets/models/arms.json', import.meta.url)));
const rig = new ArmRig(d); const kind = process.argv[2] || 'pistol', trig = +(process.argv[3] || 0);
const g = JSON.parse(fs.readFileSync(new URL('../assets/models/g19.json', import.meta.url)));
const fb = g.frameBounds, mb = g.magBounds, gy = (fb.min[1] + fb.max[1]) / 2 + 0.012, gz = (mb.min[2] + mb.max[2]) / 2 + 0.006;
const m4 = JSON.parse(fs.readFileSync(new URL('../assets/models/m4t.json', import.meta.url))).ud, o3 = (a) => ({ x: a[0], y: a[1], z: a[2] });
const u = kind === 'm4t' ? { grip: o3(m4.grip), fore: o3(m4.fore), pistol: false } : kind === 'pistol' ? { grip: { x: 0, y: gy, z: gz }, fore: { x: -0.014, y: gy - 0.02, z: gz - 0.01 }, pistol: true, handRight: { x: 0.036, y: gy - 0.017, z: mb.max[2] + 0.012 }, handLeft: { x: -0.038, y: gy - 0.034, z: mb.max[2] + 0.004 } }
  : { grip: { x: 0, y: -0.1, z: 0.105 }, fore: { x: 0, y: 0, z: -0.27 }, pistol: false };
const h = placeHands(u, process.env.LH ? JSON.parse(process.env.LH) : null, trig, { fa: process.env.FA ? JSON.parse(process.env.FA) : {}, L: process.env.LL ? JSON.parse(process.env.LL) : undefined });
rig.pose('Right', { P: h.right.P, Rt: h.right.Rt, S: SHOULDER.Right, curl: h.right.curl });
rig.pose('Left', { P: h.left.P, Rt: h.left.Rt, S: SHOULDER.Left, curl: h.left.curl });
console.log(JSON.stringify(rig.out));
