// Sanity checks for every map: navigation coverage, spawn zones and a path between the spawns.
import { MAP_BUILDERS, buildMap } from '../js/maps.js';
import { Colliders, NavGraph } from '../js/physics.js';

let failed = false;
for (const id of Object.keys(MAP_BUILDERS)) {
  const map = buildMap(id), zm = !!map.zm;
  const col = new Colliders(map.boxes);
  const nav = zm ? new NavGraph(col, map.bounds, 1, { margin: 0.55, seg: 0.3 }) : new NavGraph(col, map.bounds, 3);
  const a = nav.inRect(map.spawns[0]), b = nav.inRect(map.spawns[1]);
  const path = nav.path(a[0], b[b.length - 1]);
  let ok = nav.coverage > (zm ? 0.8 : 0.9) && a.length >= 6 && b.length >= 6 && path.length > 0, extra = '';
  if (zm) {                                                                 // every window must connect to the spawn room (doors open), the stairs foot must be reachable
    const m = map.zm, open = new Set(), field = nav.field(map.spawns[0].x0 + 2, 0, null);
    const bad = m.windows.filter((w) => { const n = nav.nodeAt(w.inx, w.inz); return !(field[n] < Infinity); });
    const up = m.upper, bot = nav.nodeAt(up.bot.x, up.bot.z), botOk = field[bot] < Infinity;
    const vmp = m.buys.find((x) => x.gun === 'vmp');
    const buyOk = m.buys.every((x) => x.gun === 'vmp' || field[nav.nodeAt(x.x + Math.sin(x.face), x.z + Math.cos(x.face))] < Infinity);
    ok = ok && !bad.length && botOk && !!vmp && vmp.y === 3 && buyOk && m.windows.length === 10 && m.doors.length === m.nz - 1;
    extra = ` windows=${m.windows.length}(unreachable ${bad.length}) doors=${m.doors.length} stairsFoot=${botOk} vmpUp=${vmp && vmp.y}`;
  }
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${id.padEnd(10)} boxes=${map.boxes.length} nodes=${nav.nodes.length} coverage=${(nav.coverage * 100).toFixed(0)}% spawnA=${a.length} spawnB=${b.length} pathLen=${path.length}${extra}`);
}
process.exit(failed ? 1 : 0);
