// Battle arenas: small maps built with the same MapBuilder (real surface textures + CC0 props).
const back = (b, names, n, cx = 16, cz = 13, rx = 14, rz = 9, opts = {}) => {
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const x = cx + Math.cos(a) * (rx + (b.rng() - 0.5) * 3), z = cz + Math.sin(a) * (rz + (b.rng() - 0.5) * 2.5) - 1;
    b.prop(names[Math.floor(b.rng() * names.length)], x, z, { s: 1 + b.rng() * 0.5, ...opts });
  }
};
const sides = (b, names, n, side = 1) => {
  for (let i = 0; i < n; i++) b.prop(names[Math.floor(b.rng() * names.length)], 16 + side * (13 + b.rng() * 6), 6 + b.rng() * 14, { s: 1 + b.rng() * 0.6 });
};
export const STAGES = {
  field: { mood: 'day', size: [32, 26], seed: 5, build(b) {
    b.ground('grass', { tint: 0xd6f09a, tile: 3.2 });
    back(b, ['tree_oak', 'tree_fat', 'tree_pine'], 22); sides(b, ['tree_oak', 'tree_fat'], 6, 1); sides(b, ['tree_oak', 'tree_pine'], 6, -1);
    b.scatter(['bush', 'flower_red', 'rock_small', 'mushroom_red'], [2, 3, 28, 8], 18); b.scatter(['flower_red', 'rock_small', 'mushroom_red'], [7, 9, 18, 10], 12);
  } },
  forest: { mood: 'forest', size: [32, 26], seed: 9, build(b) {
    b.ground('grass', { tint: 0xb4d48a, tile: 3 });
    back(b, ['tree_dark', 'tree_pine', 'tree_pine_tall', 'tree_oak'], 28, 16, 13, 15, 10); sides(b, ['tree_dark', 'tree_pine'], 8, 1); sides(b, ['tree_dark', 'tree_pine_tall'], 8, -1);
    b.scatter(['mushroom_red', 'bush', 'log', 'stump', 'rock_small'], [2, 3, 28, 9], 18);
  } },
  night: { mood: 'night', size: [32, 26], seed: 5, build(b) {
    b.ground('grass', { tint: 0xc0e090, tile: 3.2 });
    back(b, ['tree_oak', 'tree_fat', 'tree_pine'], 22); sides(b, ['tree_oak', 'tree_pine'], 8, 1);
    b.fire(8.5, 8.5, {}); b.fire(23.5, 8.5, {});
  } },
  shrine: { mood: 'shrine', size: [32, 26], seed: 4, build(b) {
    b.ground('gravel', { tint: 0xd0c8d8, tile: 3 });
    b.patch('stone', 7, 8, 18, 10, { tint: 0xc8c0d4, tile: 2.2 });
    b.torii(16, 3.4, { w: 6, h: 3.6 });
    for (let i = 0; i < 6; i++) b.prop(i % 2 ? 'column_broken' : 'column', 5 + i * 4.4, 6.2 + (i % 2) * 0.8, { s: 1 });
    back(b, ['tree_autumn', 'tree_dark', 'rock_tall', 'rock_large'], 12, 16, 13, 15, 9.5);
    sides(b, ['tree_autumn', 'rock_tall'], 6, 1); sides(b, ['tree_autumn', 'rock_tall'], 6, -1);
    b.scatter(['rock_small', 'bush'], [2, 4, 28, 8], 14);
  } },
  port: { mood: 'port', size: [32, 26], seed: 6, build(b) {
    b.ground('wood', { tint: 0xe6b480, tile: 2.6 });
    b.water(-8, -14, 48, 15.5, { color: 0x3d8fc4 });
    b.prop('cargo_ship', 8, 2, { ry: 0.3, s: 1.6 }); b.prop('cargo_ship', 25, 1, { ry: -0.2, s: 1.3 });
    b.scatter(['barrels', 'crate', 'barrel'], [2, 4, 28, 6], 8);
    b.prop('tree_palm', 3, 5, { s: 1.2 }); b.prop('tree_palm', 29, 5.5, { s: 1.2 });
  } },
  cave: { mood: 'cave', size: [32, 26], seed: 12, build(b) {
    b.ground('stone', { tint: 0x9aa4c8, tile: 2.4 });
    b.patch('plate', 8, 8.5, 16, 9, { tint: 0x8890b8, tile: 2 });
    back(b, ['rock_tall', 'rock_large', 'crystal_rock'], 20, 16, 13, 14, 9);
    for (const [x, z, c] of [[5, 6, 0x6fe8ff], [27, 6, 0xb08aff], [10, 4, 0x7affd0], [22, 4.4, 0x6fe8ff], [4, 16, 0xb08aff], [28, 17, 0x6fe8ff]]) b.glowCrystal(x, z, { color: c, s: 1 + b.rng() * 0.8 });
  } },
  castle: { mood: 'castle', size: [32, 26], seed: 14, build(b) {
    b.ground('plate', { tint: 0x8878a8, tile: 2.4 });
    b.patch('plate', 7, 8, 18, 10, { tint: 0x6a4a78, tile: 2.4 });
    for (let i = 0; i < 7; i++) { b.prop(i % 3 === 1 ? 'column_broken' : 'column', 3 + i * 4.3, 5.2, { s: 1.1 }); }
    b.box(0, 2.5, 32, 1.6, 6, { tex: 'stone', tint: 0x6a6088, solid: false, tile: 2.4 });
    b.fire(6, 8, { model: false, color: 0x9a60ff }); b.fire(26, 8, { model: false, color: 0x9a60ff });
    b.prop('obelisk', 2.5, 11, { s: 1 }); b.prop('obelisk', 29.5, 11, { s: 1 });
  } },
  throne: { mood: 'castle', size: [32, 26], seed: 15, build(b) {
    b.ground('plate', { tint: 0x786090, tile: 2.4 });
    b.patch('plate', 6, 7.5, 20, 11, { tint: 0x8a2a46, tile: 2.2 });
    for (let i = 0; i < 6; i++) b.prop('column', 3 + i * 5, 5, { s: 1.25 });
    b.box(0, 2.5, 32, 1.8, 7, { tex: 'stone', tint: 0x5a4a78, solid: false, tile: 2.4 });
    b.fire(5, 9, { model: false, color: 0xb070ff }); b.fire(27, 9, { model: false, color: 0xb070ff });
    b.glowCrystal(16, 4.2, { color: 0xc090ff, s: 1.8 });
  } },
  indoor: { mood: 'indoor', size: [32, 26], seed: 16, build(b) {
    b.ground('wood', { tint: 0xd8a070, tile: 2.2 });
    b.box(2, 3, 28, 1, 5, { tex: 'wall', tint: 0xcdb8a8, solid: false, tile: 2.4 });
    b.scatter(['barrels', 'crate', 'barrel'], [3, 5, 26, 4], 6);
  } },
};
