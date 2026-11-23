// Procedural dungeon layout from hand-placed rooms: guarantees connectivity (rooms + L-shaped corridors).
// Returns rows of '#'(wall) / '.'(floor) and the room centres so maps can place NPCs, chests and exits.
import { mulberry32 } from '../core/util.js';

export function dungeon({ w, h, seed = 1, rooms, links, corridor = 3, organic = 0.35, decor = 0 }) {
  const rng = mulberry32(seed);
  const g = Array.from({ length: h }, () => Array(w).fill('#'));
  const carve = (cx, cz) => { if (cx > 0 && cz > 0 && cx < w - 1 && cz < h - 1) g[cz][cx] = '.'; };
  const centers = [];
  for (const r of rooms) {
    const cx = r.x + r.w / 2, cz = r.z + r.h / 2;
    centers.push([Math.floor(cx), Math.floor(cz)]);
    for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) {
      if (r.round) { const dx = (x + 0.5 - cx) / (r.w / 2), dz = (z + 0.5 - cz) / (r.h / 2); if (dx * dx + dz * dz > 1.0 + (rng() - 0.5) * organic) continue; }
      else if (organic > 0 && (x === r.x || x === r.x + r.w - 1 || z === r.z || z === r.z + r.h - 1) && rng() < organic * 0.5) continue;
      carve(x, z);
    }
  }
  const hw = Math.floor(corridor / 2);
  const line = (x0, z0, x1, z1) => {
    const sx = Math.sign(x1 - x0), sz = Math.sign(z1 - z0);
    let x = x0, z = z0;
    while (x !== x1) { for (let k = -hw; k <= hw; k++) carve(x, z + k); x += sx; }
    while (z !== z1) { for (let k = -hw; k <= hw; k++) carve(x + k, z); z += sz; }
    for (let a = -hw; a <= hw; a++) for (let b = -hw; b <= hw; b++) carve(x + a, z + b);
  };
  for (const [a, b] of links) {
    const [ax, az] = centers[a], [bx, bz] = centers[b];
    if (rng() < 0.5) { line(ax, az, bx, az); line(bx, az, bx, bz); } else { line(ax, az, ax, bz); line(ax, bz, bx, bz); }
  }
  // decoration: solid crystal nooks ('c') placed only where they cannot cut the level in two
  const nb8 = (x, z) => { let n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if ((a || b) && g[z + b] && g[z + b][x + a] === '#') n++; return n; };
  if (decor > 0) {
    const cand = [];
    for (let z = 1; z < h - 1; z++) for (let x = 1; x < w - 1; x++) if (g[z][x] === '.' && nb8(x, z) >= 4) cand.push([x, z]);
    let p = decor;
    for (let attempt = 0; attempt < 6; attempt++) {
      const placed = cand.filter(() => rng() < p);
      for (const [x, z] of placed) g[z][x] = 'c';
      const rows = g.map((r) => r.join(''));
      const R = reach(rows, centers[0][0], centers[0][1]);
      if (centers.every(([cx, cz]) => R.has(cx + ',' + cz))) break;
      for (const [x, z] of placed) g[z][x] = '.';
      p *= 0.5;
    }
  }
  return { rows: g.map((r) => r.join('')), centers };
}

/** flood fill over '.' cells from (sx,sz); returns a Set of "x,z" */
export function reach(rows, sx, sz) {
  const seen = new Set(), q = [[Math.floor(sx), Math.floor(sz)]];
  const ok = (x, z) => rows[z] && rows[z][x] === '.';
  while (q.length) {
    const [x, z] = q.pop();
    const k = x + ',' + z;
    if (seen.has(k) || !ok(x, z)) continue;
    seen.add(k);
    q.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen;
}
