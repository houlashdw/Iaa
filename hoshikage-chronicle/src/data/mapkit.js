// Shared building blocks for map definitions.
export function room(b, { floor = 'wood', floorTint = 0xe4b484, wall = 'concrete', wallTint = 0xf2e4cc, doorX = 5, trim = 0x7a5238 } = {}) {
  const w = b.w, d = b.h;
  b.ground(floor, { tint: floorTint, tile: 2, margin: 0 });
  b.box(0, 0, w, 1, 3.8, { tex: wall, tint: wallTint });
  b.box(0, 0, 1, d, 3.8, { tex: wall, tint: wallTint });
  b.box(w - 1, 0, 1, d, 3.8, { tex: wall, tint: wallTint });
  b.box(0, 0.9, w, 0.12, 0.28, { tex: 'wood', tint: trim, solid: false, tile: 1.2 });
  for (let x = 2.5; x < w - 2; x += 4.2) {
    b.glow(x, 2.3, 1.02, 1.4, 1.1, 0.05, 0xbfe4ff);
    b.glow(x, 2.3, 1.0, 1.7, 1.4, 0.04, 0x5a4030);
  }
  b.solid(0, d - 1, doorX, 1); b.solid(doorX + 3, d - 1, w - doorX - 3, 1);
  b.reserve(doorX, d - 3, 3, 3);
  b.box(doorX, d - 0.2, 3, 0.2, 0.05, { tex: 'wood', tint: 0x6a4a30, solid: false, tile: 1 });
}
export const counter = (b, x, z, w, d = 1.1, h = 1.1) => {
  b.box(x, z, w, d, h, { tex: 'wood', tint: 0xb07a48, tile: 1.4 });
  b.box(x - 0.1, z - 0.05, w + 0.2, d + 0.1, 0.12, { tex: 'wood', tint: 0x6b4426, y: h, solid: false, tile: 1.2 });
};
export const table = (b, x, z, w = 2, d = 1.4) => {
  b.box(x, z, w, d, 0.85, { tex: 'wood', tint: 0xa87040, tile: 1.4 });
  b.box(x - 0.1, z - 0.1, w + 0.2, d + 0.2, 0.1, { tex: 'wood', tint: 0x7a5030, y: 0.85, solid: false, tile: 1.2 });
};
export const shelf = (b, x, z, w = 3, h = 2.6) => {
  b.box(x, z, w, 0.8, h, { tex: 'wood', tint: 0x8a5a38, tile: 1.2 });
  for (let i = 0; i < 3; i++) b.box(x + 0.1, z + 0.78, w - 0.2, 0.06, 0.08, { tex: 'wood', tint: 0x4a3020, y: 0.5 + i * 0.7, solid: false, tile: 1 });
};
export const rug = (b, x, z, w, d, tint = 0xb03a46) => b.patch('concrete', x, z, w, d, { tint, tile: 3, y: 0.02 });
/** lanterns on posts along a line (glow + light) */
export function lanterns(b, pts, color = 0xffc870, light = true) {
  for (const [x, z] of pts) {
    b.box(x - 0.06, z - 0.06, 0.12, 0.12, 2.0, { tex: 'wood', tint: 0x4a3426, solid: false, tile: 1 });
    b.glow(x, 2.2, z, 0.34, 0.42, 0.34, color);
    if (light) b.light(x, 2.1, z, color, 2.0, 9, { flicker: 0.15 });
  }
}
/** a simple well made of stacked stone boxes */
export function well(b, x, z) {
  b.box(x - 0.9, z - 0.9, 1.8, 1.8, 0.9, { tex: 'stone', tint: 0xcfc8d8, tile: 1.4 });
  b.box(x - 0.6, z - 0.6, 1.2, 1.2, 0.95, { tex: 'wood', tint: 0x2a3d6a, solid: false, tile: 1 });
  b.box(x - 0.9, z - 0.9, 0.14, 0.14, 2.2, { tex: 'wood', tint: 0x7a5030, solid: false, tile: 1 });
  b.box(x + 0.76, z - 0.9, 0.14, 0.14, 2.2, { tex: 'wood', tint: 0x7a5030, solid: false, tile: 1 });
  b.box(x - 1.1, z - 1.0, 2.2, 0.3, 0.14, { tex: 'wood', tint: 0xb5473a, y: 2.2, solid: false, tile: 1 });
}
export function signpost(b, x, z, tint = 0xa07040) {
  b.box(x - 0.07, z - 0.07, 0.14, 0.14, 1.4, { tex: 'wood', tint: 0x6a4a30, solid: false, tile: 1 });
  b.box(x - 0.55, z - 0.1, 1.1, 0.14, 0.5, { tex: 'wood', tint, y: 1.0, solid: false, tile: 1 });
  b.solid(x - 0.4, z - 0.4, 0.8, 0.8);
}
