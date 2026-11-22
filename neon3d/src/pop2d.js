// 2D-слои поп-арта: фоны (растровые точки, лучи, полосы), пиксельные сердечки, ноты, искры, пузырь «?!», переходы, зерно.
export const W = 1280, H = 720, TAU = Math.PI * 2;
const C = { ink: '#1b1522', red: '#e8254f', redD: '#b3163a', cream: '#fff6f8', yellow: '#ffd84a' };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const outCubic = t => 1 - Math.pow(1 - t, 3);
const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const outBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const outElastic = t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1;
export const prog = (u, t0, d) => clamp((u - t0) / d);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let Q = 1.5, patCtx = null;
const DPAT = {}, HC = {};
export function setQ(q, ctx) { Q = q; patCtx = ctx; for (const k in DPAT) delete DPAT[k]; for (const k in HC) delete HC[k]; grainPat = null; }

/* ---------- спрайты ---------- */
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
function mkHeart(col, hi, lo) {
  const p = 8, e = document.createElement('canvas'); e.width = 9 * p; e.height = 8 * p; const g = e.getContext('2d');
  const on = (x, y) => x >= 0 && y >= 0 && y < 6 && x < 7 && HEART[y][x] === 'X';
  for (let y = -1; y <= 6; y++) for (let x = -1; x <= 7; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) { g.fillStyle = C.ink; g.fillRect((x + 1) * p, (y + 1) * p, p, p); }
  for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) if (on(x, y)) {
    g.fillStyle = col; if (x === 1 && y <= 1) g.fillStyle = hi;
    if ((x === 5 && y >= 1 && y <= 2) || (x === 4 && y === 3) || (x === 3 && y >= 4)) g.fillStyle = lo; g.fillRect((x + 1) * p, (y + 1) * p, p, p);
  }
  return e;
}
const HEARTS = { red: mkHeart('#ee2d5c', '#ff8fa8', '#b8163c'), blue: mkHeart('#9be2fb', '#e6faff', '#5fb4d6'), yellow: mkHeart('#ffd84a', '#fff3a8', '#e0a420'), pink: mkHeart('#ff7ea8', '#ffd0e0', '#d94a7c') };
function drawHeart(c, key, x, y, s, rot = 0) { const e = HEARTS[key]; c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.imageSmoothingEnabled = false; c.drawImage(e, -e.width / 2, -e.height / 2); c.restore(); }
function star4(c, x, y, r, rot, fill, stroke, lw, pinch = .2) {
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, b = a + Math.PI / 4, n = a + Math.PI / 2; if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); c.quadraticCurveTo(Math.cos(b) * r * pinch, Math.sin(b) * r * pinch, Math.cos(n) * r, Math.sin(n) * r); }
  c.closePath(); c.lineJoin = 'round'; if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } c.restore();
}
function note(c, x, y, s, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.lineJoin = c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) { const g = pass === 0 ? 7 : 0; c.strokeStyle = c.fillStyle = pass ? col : C.ink; c.lineWidth = 7 + g; c.beginPath(); c.moveTo(11, 8); c.lineTo(11, -42); c.quadraticCurveTo(14, -40, 25, -28); c.stroke(); c.beginPath(); c.ellipse(0, 10, 13 + g / 2, 10 + g / 2, -.45, 0, TAU); c.fill(); }
  c.restore();
}
export const noiseTiles = [0, 1, 2].map(k => { const e = document.createElement('canvas'); e.width = e.height = 256; const g = e.getContext('2d'), d = g.createImageData(256, 256), r = mulberry(99 + k); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return e; });
let grainPat = null;

/* ---------- растровые точки ---------- */
function halftone(c, x0, y0, x1, y1, step, col, rFn, ox = 0, oy = 0) {
  c.fillStyle = col; c.beginPath(); const h = step * .5; let row = 0;
  for (let y = y0 - ((oy % step) + step) % step; y < y1 + step; y += h, row++) { const xo = row & 1 ? h : 0;
    for (let x = x0 - ((ox % step) + step) % step + xo - step; x < x1 + step; x += step) { const r = rFn(x, y); if (r < .5) continue; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } }
  c.fill();
}
function dots(c, x, y, w, h, step, r, col, ox, oy) {
  const key = step + col + r; let pat = DPAT[key];
  if (!pat) { const e = document.createElement('canvas'); e.width = e.height = Math.round(step * Q); const g = e.getContext('2d'); g.scale(Q, Q); g.fillStyle = col; g.beginPath(); const hh = step / 2;
    for (const [px, py] of [[0, 0], [step, 0], [0, step], [step, step], [hh, hh]]) { g.moveTo(px + r, py); g.arc(px, py, r, 0, TAU); } g.fill(); pat = DPAT[key] = patCtx.createPattern(e, 'repeat'); pat.setTransform(new DOMMatrix().scale(1 / Q)); }
  const mx = ((ox % step) + step) % step, my = ((oy % step) + step) % step;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(-mx, -my); c.fillStyle = pat; c.fillRect(x + mx, y + my, w + step, h + step); c.restore();
}
function halftoneC(c, key, step, col, rFn, ox, oy) {
  let e = HC[key];
  if (!e) { e = HC[key] = document.createElement('canvas'); e.width = Math.round((W + 2 * step) * Q); e.height = Math.round((H + 2 * step) * Q); const g = e.getContext('2d'); g.scale(Q, Q); g.translate(step, step); halftone(g, -step, -step, W + step, H + step, step, col, rFn, 0, 0); }
  const mx = ((ox % step) + step) % step, my = ((oy % step) + step) % step; c.drawImage(e, -step - mx, -step - my, e.width / Q, e.height / Q);
}

/* ---------- фоны ---------- */
function bgGrey(c, u, t, pul) {
  c.fillStyle = '#7f818d'; c.fillRect(0, 0, W, H); dots(c, 0, 0, W, H, 22, 3.1, '#6d6f7b', t * 6, t * 3);
  const slide = (t0, d, dir) => (1 - outCubic(prog(u, t0, d))) * dir, drift = Math.sin(t * .8);
  const panel = (x, y, w, h, dx) => { c.save(); c.translate(dx, 0); c.fillStyle = '#f6f6f9'; c.fillRect(x, y, w, h); dots(c, x, y, w, h, 24, 3.4, '#dcdde4', -t * 5, 0); c.restore(); };
  panel(0, 47, 217, 216, slide(.15, .55, -320) + drift * 6); panel(504, 270, 575, 190, slide(.3, .6, 700) - drift * 8); panel(0, 510, 600, 178, slide(.45, .6, -700) + drift * 6);
  c.fillStyle = C.red; c.fillRect(0, 29, 267 * outCubic(prog(u, 0, .6)), 11); c.fillRect(0, 709, 489 * outCubic(prog(u, .2, .7)), 11); c.fillStyle = C.ink; c.fillRect(0, 44, 60 * outCubic(prog(u, .1, .5)), 3);
  const circ = (x, y, r, t0) => { const k = outBack(prog(u, t0, .55)), yy = y + Math.sin(t * 1.5 + x) * 5; c.fillStyle = '#f8f8fb'; c.beginPath(); c.arc(x, yy, r * k * (1 + .03 * pul), 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(x, yy, r * k, 0, TAU); c.clip(); dots(c, x - r, yy - r - 10, r * 2, r * 2 + 20, 20, 2.8, '#dcdde4', 0, 0); c.restore(); };
  circ(149, 396, 60, .5); circ(1131, 173, 72, .35);
  const ring = (x, y, r, t0, col) => { const k = outElastic(prog(u, t0, .9)); c.strokeStyle = col; c.lineWidth = 6.5; c.beginPath(); c.arc(x, y + Math.sin(t * 2 + x) * 6, r * k * (1 + .08 * pul), 0, TAU); c.stroke(); };
  ring(221, 151, 31, .6, C.red); ring(1083, 567, 49, .75, C.red);
  c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 6; i++) { const x = 340 + i * 150, y = 90 + ((i * 97) % 60) + Math.sin(t + i) * 8, k = prog(u, .9 + i * .08, .4); c.save(); c.translate(x, y); c.rotate(t * .5 + i); c.scale(k, k); c.fillRect(-7, -1.5, 14, 3); c.fillRect(-1.5, -7, 3, 14); c.restore(); }
}
function bgPink(c, u, t, pul) {
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#bfe7f7'); g.addColorStop(.45, '#f1d6ec'); g.addColorStop(1, '#f89fc4'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  halftoneC(c, 'pink', 24, 'rgba(243,92,150,.55)', (x, y) => 1.2 + 4.8 * clamp((x / W * .55 + y / H * .75) - .1), t * 8, t * 4);
  const cx = 640, cy = 380, k1 = outElastic(prog(u, 0, .9)), k2 = outElastic(prog(u, .12, .9));
  c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, 540 * k1 * (1 + .015 * pul), 0, TAU); c.stroke();
  c.strokeStyle = C.red; c.lineWidth = 4.5; c.beginPath(); c.arc(cx, cy, 380 * k2 * (1 + .02 * pul), 0, TAU); c.stroke();
  c.save(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.setLineDash([10, 22]); c.lineDashOffset = -t * 40; c.beginPath(); c.arc(cx, cy, 455 * k1, 0, TAU); c.stroke(); c.restore();
  for (let i = 0; i < 3; i++) { const a = t * .5 + i * TAU / 3; c.fillStyle = i ? C.ink : C.red; c.beginPath(); c.arc(cx + Math.cos(a) * 380 * k2, cy + Math.sin(a) * 380 * k2, 9, 0, TAU); c.fill(); }
  const hs = [[180, 160, 'red', 1.0, .2], [296, 340, 'red', .7, .45], [150, 524, 'blue', 1.15, .3], [1127, 153, 'red', 1.1, .35], [1010, 340, 'red', .75, .55], [1153, 496, 'blue', 1.0, .4], [230, 90, 'yellow', .6, .65], [1060, 640, 'yellow', .7, .6]];
  hs.forEach(([x, y, key, s, t0], i) => { const k = outBack(prog(u, t0, .45)); drawHeart(c, key, x, y + Math.sin(t * 2.2 + i) * 9, s * 1.05 * k * (1 + .06 * pul), Math.sin(t * 1.4 + i) * .12); });
  [[250, 112], [205, 415], [1040, 220], [1114, 590]].forEach(([x, y], i) => { const k = outBack(prog(u, .3 + i * .1, .5)); star4(c, x, y + Math.sin(t * 2 + i) * 6, 22 * k, t * 1.2 + i, null, C.red, 3.5, .1); });
  star4(c, 970, 168, 18 * outBack(prog(u, .7, .4)), -t * 1.5, C.yellow, C.ink, 3, .22);
}
function bgBurst(c, u, t, pul) {
  c.fillStyle = '#f9e9f1'; c.fillRect(0, 0, W, H); const cx = 640, cy = 300, rot = t * .08, n = 28;
  for (let i = 0; i < n; i += 2) { const a0 = rot + i / n * TAU, a1 = rot + (i + 1) / n * TAU; c.fillStyle = '#dcdff2'; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 1200, a0, a1); c.closePath(); c.fill(); }
  halftoneC(c, 'burst', 23, 'rgba(238,108,158,.55)', (x, y) => 1.4 + 3.2 * clamp(Math.hypot(x - 640, y - 300) / 750), t * 5, 0);
  const r = mulberry(5), inten = u < .5 ? lerp(.5, 1, u / .5) : u < 2.3 ? 1 : 1.5;
  for (let i = 0; i < 34; i++) { const a = r() * TAU, len = 140 + r() * 260, sp = 500 + r() * 500, off = (t * sp * inten + r() * 1500) % 1500, r0 = 330 + off, w = 1.5 + r() * 4, col = r() < .5 ? C.ink : r() < .6 ? C.red : '#ff7ea0'; if (r0 > 1000) continue;
    const ca = Math.cos(a), sa = Math.sin(a); c.fillStyle = col; c.beginPath(); c.moveTo(cx + ca * r0, cy + sa * r0); c.lineTo(cx + ca * (r0 + len) - sa * w, cy + sa * (r0 + len) + ca * w); c.lineTo(cx + ca * (r0 + len) + sa * w, cy + sa * (r0 + len) - ca * w); c.closePath(); c.fill(); }
  star4(c, 205, 150, 22 * outBack(prog(u, .85, .4)), t, '#fff', C.ink, 3, .2); star4(c, 1090, 130, 16 * outBack(prog(u, 1.1, .4)), -t * 1.3, C.red, C.ink, 3, .2);
}
function bgStripes(c, u, t, pul) {
  c.fillStyle = '#fbf1f5'; c.fillRect(0, 0, W, H); c.save(); c.translate(W / 2, H / 2); c.rotate(-.62); const bw = 130, cols = ['#f9bfd5', '#fff7fa', '#cdd1eb', '#fff7fa'], off = (t * 110) % (bw * 4);
  for (let i = -16; i < 16; i++) { c.fillStyle = cols[((i % 4) + 4) % 4]; c.fillRect(i * bw + off - bw * 4, -1300, bw, 2600); } c.restore();
  halftoneC(c, 'stripes', 24, 'rgba(240,95,150,.5)', (x, y) => 1.2 + 4.6 * clamp((x / W * .5 + y / H * .8) - .05), -t * 7, t * 4);
  const hs = [[130, 150, 'red', 1.1, .1], [200, 330, 'yellow', .95, .25], [190, 520, 'red', .9, .4], [1095, 140, 'red', 1.15, .2], [1150, 470, 'yellow', 1.0, .35], [1050, 600, 'yellow', 1.1, .5], [990, 330, 'red', .9, .45]];
  hs.forEach(([x, y, key, s, t0], i) => { const k = outBack(prog(u, t0, .45)); drawHeart(c, key, x, y + Math.sin(t * 2.4 + i * 1.3) * 10, s * 1.05 * k * (1 + .07 * pul), Math.sin(t * 1.6 + i) * .14); });
  [[300, 130, C.red, .3], [980, 215, '#47b9ee', .4]].forEach(([x, y, col, t0], i) => { const k = outBack(prog(u, t0, .5)); note(c, x, y + Math.sin(t * 3 + i) * 12, 1.1 * k, Math.sin(t * 2 + i) * .3, col); });
  [[180, 105], [1170, 300], [230, 440], [1040, 520]].forEach(([x, y], i) => star4(c, x, y + Math.sin(t * 2 + i) * 8, 24 * outBack(prog(u, .2 + i * .1, .5)), t * .9 + i, i % 2 ? '#fff' : null, i % 2 ? C.ink : C.red, 3.5, .14));
}
export const drawBg = (c, sc, u, t, pul) => [bgGrey, bgPink, bgBurst, bgStripes][sc](c, u, t, pul);

/* ---------- частицы ---------- */
export const S = { parts: [], pulse: 0, shake: 0, flash: 0, rnd: mulberry(7), beat: -1 };
export function resetParts() { S.parts = []; S.pulse = 0; S.shake = 0; S.flash = 0; S.rnd = mulberry(7); S.beat = -1; }
function spawn(o) { S.parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, s: 1, life: 2, age: 0, kind: 'heart', key: 'red', front: false, bob: 0, ph: S.rnd() * TAU, drag: 1 }, o)); }
export function burst(x, y, n, keys, front = false) {
  for (let i = 0; i < n; i++) { const a = S.rnd() * TAU, v = 160 + S.rnd() * 340; spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 520, drag: .985, s: .4 + S.rnd() * .5, key: keys[i % keys.length], life: 1.3 + S.rnd() * .7, rot: (S.rnd() - .5) * 1.4, vr: (S.rnd() - .5) * 6, front }); }
  for (let i = 0; i < 5; i++) { const a = S.rnd() * TAU, v = 120 + S.rnd() * 260; spawn({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .97, s: .6 + S.rnd() * .6, life: .8 + S.rnd() * .5, vr: (S.rnd() - .5) * 8, front: true, key: ['red', 'white', 'yellow'][i % 3] }); }
}
export function onBeat(b, sc, u, beatLen, anchor) {
  const r = S.rnd; S.pulse = 1;
  if (sc === 1 && b % 2 === 0) for (let i = 0; i < 3; i++) spawn({ x: 120 + r() * 1040, y: 760, vy: -(90 + r() * 90), vx: (r() - .5) * 30, s: .55 + r() * .5, key: ['red', 'pink', 'blue', 'yellow'][r() * 4 | 0], life: 6, bob: 18 + r() * 16, rot: (r() - .5) * .5 });
  if (sc === 3 && b % 2 === 0) for (let i = 0; i < 2; i++) spawn({ kind: r() < .5 ? 'note' : 'heart', x: 100 + r() * 1080, y: 760, vy: -(110 + r() * 80), s: .6 + r() * .5, key: ['red', 'yellow', 'blue'][r() * 3 | 0], life: 6, bob: 20, rot: (r() - .5) * .6 });
  if (sc === 1 && u > .85 && u < .85 + beatLen * 1.2) burst(anchor.x + 40, anchor.y - 20, 14, ['red', 'pink', 'yellow']);
  if (sc === 3 && u > 2.5 && u < 2.5 + beatLen * 1.2) burst(anchor.x + 60, anchor.y, 14, ['red', 'yellow', 'blue']);
  if (sc === 2 && u > 2.2 && u < 2.2 + beatLen * 1.2) burst(anchor.x, anchor.y, 10, ['pink', 'red']);
  if (b % 4 === 0) S.shake = 1;
}
export function stepParts(dt) {
  S.pulse *= .9; S.shake *= .88; S.flash *= .86;
  for (const p of S.parts) { p.age += dt; p.vy += p.g * dt; p.vx *= Math.pow(p.drag, 60 * dt); p.vy *= p.g ? Math.pow(p.drag, 60 * dt) : 1; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
  S.parts = S.parts.filter(p => p.age < p.life && p.y > -120);
}
export function drawParts(c, front) {
  for (const p of S.parts) {
    if (!!p.front !== front) continue; const k = Math.min(1, p.age / .25) * Math.min(1, (p.life - p.age) / .35), x = p.x + (p.bob ? Math.sin(p.age * 2.5 + p.ph) * p.bob : 0);
    c.save(); c.globalAlpha = k;
    if (p.kind === 'heart') drawHeart(c, p.key, x, p.y, p.s * outBack(Math.min(1, p.age / .3)), p.rot);
    else if (p.kind === 'note') note(c, x, p.y, p.s * 1.1, p.rot, p.key === 'blue' ? '#47b9ee' : p.key === 'yellow' ? '#e8a000' : C.red);
    else star4(c, x, p.y, 18 * p.s, p.rot, p.key === 'white' ? '#fff' : p.key === 'yellow' ? C.yellow : C.red, C.ink, 3, .2);
    c.restore();
  }
}
export function drawBubble(c, x, y, k, t) {
  if (k <= 0) return; const s = k * (1 + .03 * Math.sin(t * 14)); c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 6; c.strokeStyle = C.ink; c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(0, 0, 118, 80, -.05, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(92, 98, 17, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(122, 124, 9, 0, TAU); c.fill(); c.stroke();
  c.font = '900 74px "Arial Black", Impact, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = C.red; c.lineJoin = 'round';
  c.save(); c.rotate(-.06); c.fillText('?!', -12, 6); c.restore(); star4(c, 72, -34, 14, t * 2, C.ink, null, 0, .2); c.restore();
}
function drawWipe(c, p) {
  const layers = [[C.red, 0], [C.ink, .06], [C.cream, .12]], N = 9, cw = W / N + 42; c.save(); c.transform(1, 0, .24, 1, -H / 2 * .24, 0);
  for (const [col, dl] of layers) for (let i = 0; i < N; i++) { const d = dl + i * .016, a = inOut(clamp((p - .5 - d) / .3)) * (H + 80) - 40, b = inOut(clamp((p - d) / .3)) * (H + 80) - 40; if (b - a < .5) continue; c.fillStyle = col; c.fillRect(-100 + i * (W / N), a, cw, b - a); }
  c.restore();
}
// зерно + виньетка + переход (в пикселях холста RW×RH, масштаб Q)
export function drawOverlay(c, RW, RH, t, wipeP) {
  if (!grainPat) grainPat = noiseTiles.map(e => c.createPattern(e, 'repeat'));
  c.save(); c.globalAlpha = .07; c.globalCompositeOperation = 'overlay'; c.fillStyle = grainPat[Math.floor(t * 24) % 3]; c.fillRect(0, 0, RW, RH); c.restore();
  const vg = c.createRadialGradient(RW / 2, RH / 2, RH * .55, RW / 2, RH / 2, RH * 1.05); vg.addColorStop(0, 'rgba(30,10,40,0)'); vg.addColorStop(1, 'rgba(30,10,40,.22)'); c.fillStyle = vg; c.fillRect(0, 0, RW, RH);
  if (wipeP >= 0) { c.save(); c.scale(Q, Q); drawWipe(c, wipeP); c.restore(); }
  if (S.flash > .05) { c.fillStyle = `rgba(255,255,255,${S.flash * .35})`; c.fillRect(0, 0, RW, RH); }
}
