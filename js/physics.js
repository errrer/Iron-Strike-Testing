// Collision, ray casting and navigation. Pure maths - no rendering dependencies.

export const STEP_H = 0.55;          // max height a player auto-steps up (stairs)
export const GRAVITY = 22;

// A box "blocks walking" if it sticks up higher than a step and starts below head height.
export const isBlocker = (b) => b.y1 > STEP_H + 0.01 && b.y0 < 1.85;

export class Colliders {
  constructor(boxes) {
    this.boxes = boxes;
    this.blockers = boxes.filter(isBlocker);
  }

  // dynamic boxes (zombie-mode barricades and doors)
  add(b) { if (this.boxes.includes(b)) return; this.boxes.push(b); if (isBlocker(b) && !b.noZ) this.blockers.push(b); }
  remove(b) {
    const i = this.boxes.indexOf(b); if (i >= 0) this.boxes.splice(i, 1);
    const j = this.blockers.indexOf(b); if (j >= 0) this.blockers.splice(j, 1);
  }

  overlaps(x, y, z, hw, h) {
    for (const b of this.boxes) {
      if (y + h > b.y0 && y < b.y1 && x + hw > b.x0 && x - hw < b.x1 && z + hw > b.z0 && z - hw < b.z1) return true;
    }
    return false;
  }

  // Moves an actor (pos, vel, hw, h) by vel*dt with axis-separated AABB resolution.
  move(a, dt) {
    const p = a.pos, v = a.vel, hw = a.hw, h = a.h;
    const boxes = this.boxes;

    // --- X ---
    p.x += v.x * dt;
    if (v.x !== 0) {
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i]; if (b.noZ && a.zombie) continue;
        if (p.y + h > b.y0 && p.y < b.y1 && p.x + hw > b.x0 && p.x - hw < b.x1 && p.z + hw > b.z0 && p.z - hw < b.z1) {
          if (b.y1 - p.y <= STEP_H && !this.overlaps(p.x, b.y1, p.z, hw, h)) { p.y = b.y1; continue; }
          p.x = v.x > 0 ? b.x0 - hw - 1e-3 : b.x1 + hw + 1e-3;
          v.x = 0;
        }
      }
    }
    // --- Z ---
    p.z += v.z * dt;
    if (v.z !== 0) {
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i]; if (b.noZ && a.zombie) continue;
        if (p.y + h > b.y0 && p.y < b.y1 && p.x + hw > b.x0 && p.x - hw < b.x1 && p.z + hw > b.z0 && p.z - hw < b.z1) {
          if (b.y1 - p.y <= STEP_H && !this.overlaps(p.x, b.y1, p.z, hw, h)) { p.y = b.y1; continue; }
          p.z = v.z > 0 ? b.z0 - hw - 1e-3 : b.z1 + hw + 1e-3;
          v.z = 0;
        }
      }
    }
    // --- Y ---
    const prevY = p.y;
    p.y += v.y * dt;
    a.onGround = false;
    if (p.y <= 0) { p.y = 0; if (v.y < 0) v.y = 0; a.onGround = true; }
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; if (b.noZ && a.zombie) continue;
      if (p.y + h > b.y0 && p.y < b.y1 && p.x + hw > b.x0 && p.x - hw < b.x1 && p.z + hw > b.z0 && p.z - hw < b.z1) {
        if (v.y <= 0 && prevY >= b.y1 - 0.02) { p.y = b.y1; v.y = 0; a.onGround = true; }
        else if (v.y > 0 && prevY + h <= b.y0 + 0.02) { p.y = b.y0 - h - 1e-3; v.y = 0; }
      }
    }
  }

  // Mantling: finds a ledge in front of an actor that is too high to step onto but within reach.
  // Returns the spot to climb to ({x, y, z}) or null. The spot must have standing room above it.
  findLedge(a, fx, fz, maxUp = 2.2) {
    const hw = a.hw, p = a.pos;
    const px = p.x + fx * (hw + 0.3), pz = p.z + fz * (hw + 0.3);      // probe just in front of the body
    let best = null;
    for (const b of this.boxes) {
      const up = b.y1 - p.y;
      if (up < STEP_H + 0.08 || up > maxUp) continue;
      if (b.y0 > p.y + 1.3) continue;                                    // has to reach down to where the hands are
      if (px < b.x0 || px > b.x1 || pz < b.z0 || pz > b.z1) continue;
      if (b.x1 - b.x0 < hw * 1.4 || b.z1 - b.z0 < hw * 1.4) continue;   // too thin to stand on
      const m = hw * 0.7;
      const ex = Math.min(b.x1 - m, Math.max(b.x0 + m, p.x + fx * (hw + 0.5)));
      const ez = Math.min(b.z1 - m, Math.max(b.z0 + m, p.z + fz * (hw + 0.5)));
      if (this.overlaps(ex, b.y1 + 0.02, ez, hw, 1.8)) continue;       // no room to stand up there
      if (!best || up < best.y - p.y) best = { x: ex, y: b.y1, z: ez };
    }
    return best;
  }

  // Distance along a normalised ray to the first box hit (or maxD).
  // solid=true also counts barricades (noRay boxes), used by zombie sight checks; bullets and cameras ignore them
  ray(ox, oy, oz, dx, dy, dz, maxD, solid) {
    let best = maxD;
    const boxes = this.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; if (b.noRay && !solid) continue;
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) continue; }
      else {
        let a = (b.x0 - ox) / dx, c = (b.x1 - ox) / dx;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) continue; }
      else {
        let a = (b.y0 - oy) / dy, c = (b.y1 - oy) / dy;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) continue; }
      else {
        let a = (b.z0 - oz) / dz, c = (b.z1 - oz) / dz;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      if (t0 < best) best = t0;
    }
    return best;
  }

  // Is the straight 2D path a->b blocked by anything that stops walking? (margin = body radius)
  segBlocked(ax, az, bx, bz, m) {
    const dx = bx - ax, dz = bz - az;
    for (const b of this.blockers) {
      const x0 = b.x0 - m, x1 = b.x1 + m, z0 = b.z0 - m, z1 = b.z1 + m;
      let t0 = 0, t1 = 1;
      if (Math.abs(dx) < 1e-9) { if (ax < x0 || ax > x1) continue; }
      else {
        let a = (x0 - ax) / dx, c = (x1 - ax) / dx;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (az < z0 || az > z1) continue; }
      else {
        let a = (z0 - az) / dz, c = (z1 - az) / dz;
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) continue;
      }
      return true;
    }
    return false;
  }
}

// ---- ray helpers for actors --------------------------------------------------------------
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}

export function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let t0 = 0, t1 = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [x0, y0, z0], mx = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return Infinity; }
    else {
      let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i];
      if (a > c) { const t = a; a = c; c = t; }
      if (a > t0) t0 = a; if (c < t1) t1 = c;
      if (t0 > t1) return Infinity;
    }
  }
  return t0;
}

// ---- navigation graph --------------------------------------------------------------------
export class NavGraph {
  // opt.margin: how far a node must be from walls; opt.seg: body radius used when linking nodes (zombie mode uses a fine grid)
  constructor(col, bounds, step = 3, opt = {}) {
    this.col = col; this.step = step; this.bounds = bounds;
    const margin = opt.margin ?? 0.8, segM = opt.seg ?? 0.45;
    this.nodes = [];   // {x,z}
    this.adj = [];
    const free = (x, z) => {
      for (const b of col.blockers) {
        if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin) return false;
      }
      return true;
    };
    const grid = [];
    let gi = 0;
    for (let x = bounds.x0 + 2; x <= bounds.x1 - 2; x += step, gi++) {
      grid[gi] = [];
      let gj = 0;
      for (let z = bounds.z0 + 2; z <= bounds.z1 - 2; z += step, gj++) {
        if (free(x, z)) { grid[gi][gj] = this.nodes.length; this.nodes.push({ x, z }); this.adj.push([]); }
        else grid[gi][gj] = -1;
      }
    }
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const a = grid[i][j]; if (a < 0) continue;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const row = grid[i + di]; if (!row) continue;
          const b = row[j + dj]; if (b === undefined || b < 0) continue;
          const A = this.nodes[a], B = this.nodes[b];
          if (!col.segBlocked(A.x, A.z, B.x, B.z, segM)) this.adj[a].push(b);
        }
      }
    }
    // keep only the largest connected component
    const comp = new Array(this.nodes.length).fill(-1);
    let best = -1, bestSize = 0, cid = 0;
    for (let s = 0; s < this.nodes.length; s++) {
      if (comp[s] >= 0) continue;
      const stack = [s]; comp[s] = cid; let size = 0;
      while (stack.length) { const n = stack.pop(); size++; for (const m of this.adj[n]) if (comp[m] < 0) { comp[m] = cid; stack.push(m); } }
      if (size > bestSize) { bestSize = size; best = cid; }
      cid++;
    }
    this.valid = comp.map((c) => c === best);
    this.validIdx = [];
    for (let i = 0; i < this.nodes.length; i++) if (this.valid[i]) this.validIdx.push(i);
    this.coverage = this.nodes.length ? bestSize / this.nodes.length : 0;
    this.grid = grid;
  }

  // Dijkstra distance field over the graph from the node nearest (x, z). `blocked` = Set of node ids that may not be crossed.
  // Returns a Float32Array of path lengths (Infinity = unreachable). Zombies walk downhill on it.
  field(x, z, blocked) {
    const N = this.nodes, dist = new Float32Array(N.length).fill(Infinity), src = this.nearest(x, z);
    if (src < 0) return dist;
    const heap = [[0, src]]; dist[src] = 0;
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { let m = i; const a = 2 * i + 1, b = a + 1; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
    while (heap.length) {
      const [d, n] = pop(); if (d > dist[n]) continue;
      for (const m of this.adj[n]) {
        if (blocked && blocked.has(m)) continue;
        const nd = d + Math.hypot(N[n].x - N[m].x, N[n].z - N[m].z);
        if (nd < dist[m]) { dist[m] = nd; push([nd, m]); }
      }
    }
    return dist;
  }

  nearest(x, z) {
    let bi = -1, bd = Infinity;
    for (const i of this.validIdx) {
      const n = this.nodes[i];
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }

  // O(1) lookup on the regular grid (falls back to a full search)
  nodeAt(x, z) {
    const s = this.step, gx = Math.round((x - (this.bounds.x0 + 2)) / s), gz = Math.round((z - (this.bounds.z0 + 2)) / s);
    let best = -1, bd = Infinity;
    for (let di = -1; di <= 1; di++) {
      const row = this.grid[gx + di]; if (!row) continue;
      for (let dj = -1; dj <= 1; dj++) {
        const n = row[gz + dj]; if (n === undefined || n < 0 || !this.valid[n]) continue;
        const d = (this.nodes[n].x - x) ** 2 + (this.nodes[n].z - z) ** 2; if (d < bd) { bd = d; best = n; }
      }
    }
    return best >= 0 ? best : this.nearest(x, z);
  }

  randomNode() { return this.validIdx[Math.floor(Math.random() * this.validIdx.length)]; }

  inRect(r) { return this.validIdx.filter((i) => { const n = this.nodes[i]; return n.x >= r.x0 && n.x <= r.x1 && n.z >= r.z0 && n.z <= r.z1; }); }

  // A* between node ids -> array of node ids (inclusive)
  path(s, g) {
    if (s < 0 || g < 0) return [];
    if (s === g) return [s];
    const N = this.nodes, open = new Set([s]), came = new Map(), gs = new Map([[s, 0]]), fs = new Map();
    const h = (i) => Math.hypot(N[i].x - N[g].x, N[i].z - N[g].z);
    fs.set(s, h(s));
    while (open.size) {
      let cur = -1, cf = Infinity;
      for (const n of open) { const f = fs.get(n); if (f < cf) { cf = f; cur = n; } }
      if (cur === g) {
        const out = [cur];
        while (came.has(cur)) { cur = came.get(cur); out.push(cur); }
        return out.reverse();
      }
      open.delete(cur);
      for (const nb of this.adj[cur]) {
        const t = gs.get(cur) + Math.hypot(N[cur].x - N[nb].x, N[cur].z - N[nb].z);
        if (t < (gs.has(nb) ? gs.get(nb) : Infinity)) {
          came.set(nb, cur); gs.set(nb, t); fs.set(nb, t + h(nb)); open.add(nb);
        }
      }
    }
    return [];
  }
}
