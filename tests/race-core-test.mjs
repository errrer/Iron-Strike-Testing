// Node test for the dirt-bike simulation (no browser needed): node tests/race-core-test.mjs
import { Track, RaceSim, HW } from '../js/race-core.js';
let ok = true; const check = (n, c, i = '') => { ok &&= !!c; console.log((c ? 'ok   ' : 'FAIL ') + n, i); };
const T = new Track();
check('track length sane', T.length > 800 && T.length < 1600, T.length.toFixed(0));
let kmax = 0; for (let i = 0; i < T.N; i++) kmax = Math.max(kmax, Math.abs(T.curv[i]));
check('tightest corner radius >= 11 m', 1 / kmax >= 11, (1 / kmax).toFixed(1));
let minSep = 1e9; for (let i = 0; i < T.N; i++) for (let j = i + 40; j < T.N; j++) { if (T.N - (j - i) < 40) continue; minSep = Math.min(minSep, Math.hypot(T.x[i] - T.x[j], T.z[i] - T.z[j])); }
check('track never comes near itself', minSep > HW * 2 + 6, minSep.toFixed(1));
let maxSlope = 0; for (let i = 0; i < T.N; i++) maxSlope = Math.max(maxSlope, Math.abs(T.y[(i + 1) % T.N] - T.y[i]) / T.ds);
check('slopes drivable', maxSlope < 0.75, maxSlope.toFixed(2));
// full race, player driven by the same AI controller
import { aiControl } from '../js/race-core.js';
const sim = new RaceSim({ laps: 2, diff: 'normal' });
let air = 0, frames = 0, maxV = 0;
for (let t = 0; t < 400 && sim.state !== 'done'; t += 1 / 60) {
  const p = sim.player, inp = aiControl(p, sim.track, 1 / 60, true);
  sim.update(1 / 60, sim.state === 'countdown' ? { thr: 0, brk: 0, steer: 0, boost: false } : inp);
  frames++; if (p.air) air++; maxV = Math.max(maxV, p.speed);
}
const r = sim.rank();
check('race finishes', sim.state === 'done', sim.t.toFixed(1) + 's');
check('lap times recorded', sim.player.lapTimes.length === 2, sim.player.lapTimes.map((x) => x.toFixed(1)).join(','));
check('jumps get airtime', air / frames > 0.02, (100 * air / frames).toFixed(1) + '%');
check('top speed reached', maxV > 25, maxV.toFixed(1));
check('bots racing too', sim.bikes.filter((b) => b !== sim.player).every((b) => b.prog > 400), sim.bikes.map((b) => b.prog.toFixed(0)).join(' '));
console.log('order', r.map((b) => b.name + (b.finished ? ' ' + b.finishT.toFixed(1) : '')).join(' | '));
// idle player: nobody should wedge or crash, grass slows you down
const s2 = new RaceSim({ laps: 1 }); for (let i = 0; i < 60 * 12; i++) s2.update(1 / 60, { thr: 1, brk: 0, steer: 0.0, boost: false });
check('driving straight into the grass recovers/limits speed', s2.player.speed < 25 && isFinite(s2.player.x), s2.player.speed.toFixed(1));
// free ride
const s3 = new RaceSim({ laps: 0 }); check('free ride = one bike', s3.bikes.length === 1 && s3.state === 'racing');
console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
