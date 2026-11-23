export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
export const rand = (a, b, rng = Math.random) => a + (b - a) * rng();
export const randInt = (a, b, rng = Math.random) => Math.floor(a + (b - a + 1) * rng());
/** Await-able frame loop helper: runs fn(t01, dt) for `ms` milliseconds. */
export function tween(ms, fn) {
  return new Promise((res) => {
    const t0 = performance.now();
    let last = t0;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t, (now - last) / 1000);
      last = now;
      if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
