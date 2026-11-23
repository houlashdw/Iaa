// Validates that every NPC / chest / exit / trigger of every dungeon map is reachable from the spawn.
// (Outdoor maps are validated visually.) usage: node tools/check-maps.mjs
import { MAPS } from '../src/data/maps.js';
import { reach } from '../src/data/dungeon.js';
let bad = 0;
for (const [id, m] of Object.entries(MAPS)) {
  if (!m.grid) continue;
  const rows = m.grid.rows ?? m.grid;
  const sp = m.checkFrom;
  const R = reach(rows, sp[0], sp[1]);
  const chk = (name, x, z) => { if (!R.has(Math.floor(x) + ',' + Math.floor(z))) { console.log(`  ✗ ${id}: ${name} at (${x},${z}) is not reachable`); bad++; } };
  for (const c of m.chests || []) chk('chest ' + c.id, c.x, c.z);
  for (const n of m.npcs || []) if (!n.ghost) chk('npc ' + n.id, n.x, n.z);
  for (const e of m.exits || []) chk('exit→' + e.to, e.rect[0] + e.rect[2] / 2, e.rect[1] + e.rect[3] / 2);
  for (const t of m.triggers || []) chk('trigger ' + t.id, t.rect[0] + t.rect[2] / 2, t.rect[1] + t.rect[3] / 2);
  console.log(`${id}: ${rows.length}×${rows[0].length}, ${R.size} reachable floor cells`);
}
console.log(bad ? `${bad} problems` : 'all dungeon maps OK');
process.exit(bad ? 1 : 0);
