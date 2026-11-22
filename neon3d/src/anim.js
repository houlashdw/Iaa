// Таймлайн: 4 сцены × 8 битов (128 BPM) = 15 с. Позы задаются целями рук/ног, дальше работает IK.
import { clamp, lerp, sm } from './util.js';

export const BPM = 128, BEAT = 60 / BPM, SLEN = 8 * BEAT, LOOP = 4 * SLEN;
export const sceneOf = t => { const ph = t % LOOP, sc = Math.floor(ph / SLEN) % 4; return [sc, ph - sc * SLEN]; };
const blinkF = t => { const b = (t + 1.3) % 3.4; return b < .16 ? Math.abs(b / .08 - 1) : 1; };
export function track(u, keys) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u < keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, sm((u - t0) / (t1 - t0))); }
  return keys[keys.length - 1][1];
}
const prog = (u, t0, d) => clamp((u - t0) / d);

// позы рук (координаты в системе торса: x вправо по экрану, y вверх, z вперёд)
const H = (t, pole, palm, curl = .3, spread = 0, up = 0) => ({ t, pole, palm, curl, spread, up });
const HAND = {
  hipL: H([-.168, .0, .04], [-1, -.25, -.55], [1, 0, -.1], .35),
  hangR: H([.205, -.165, .02], [.25, 0, -1], [-1, 0, .12], .32),
  hangL: H([-.205, -.165, .02], [-.25, 0, -1], [1, 0, .12], .32),
  waveR: H([.30, .585, .11], [.65, -.55, -.5], [-.15, 0, 1], .05, .6, .35),
  upL: H([-.29, .64, .10], [-.6, -.45, -.6], [.15, 0, 1], .06, .6, .45),
  upR: H([.29, .64, .10], [.6, -.45, -.6], [-.15, 0, 1], .06, .6, .45),
  scaredL: H([-.14, .335, .245], [-1, -.75, -.05], [.35, 0, 1], .1, .6, .9),
  scaredR: H([.14, .335, .245], [1, -.75, -.05], [-.35, 0, 1], .1, .6, .9),
  salute: H([.105, .625, .13], [.75, -.3, -.25], [-.55, 0, .8], .1, .3, .5)
};
const mixH = (a, b, k) => ({ t: a.t.map((v, i) => lerp(v, b.t[i], k)), pole: a.pole.map((v, i) => lerp(v, b.pole[i], k)), palm: a.palm.map((v, i) => lerp(v, b.palm[i], k)), curl: lerp(a.curl, b.curl, k), spread: lerp(a.spread, b.spread, k), up: lerp(a.up, b.up, k) });

export function getPose(sc, u, t) {
  const bt = t / BEAT, pul = Math.exp(-(bt % 1) * 6), sw = Math.sin(bt * Math.PI / 2), side = Math.sin(bt * Math.PI), blink = blinkF(t);
  const P = {
    rootX: 0, rootZ: 0, yaw: 0, bob: 0, hipRoll: 0, hipYaw: 0, hipPitch: 0, pelvX: 0, twist: 0, lean: 0, troll: 0, nod: 0, turn: 0, tilt: 0,
    L: HAND.hipL, R: HAND.hangR,
    fL: { x: -.125, z: .0, lift: 0, yaw: -.14 }, fR: { x: .115, z: .035, lift: 0, yaw: .14 },
    face: { emL: 'normal', emR: 'normal', oL: 1, oR: 1, brow: 0, mouth: 'smile', blush: .65, lx: 0, ly: 0 },
    earL: 0, earR: 0, wag: 1, pul, bt, beat2: BEAT * 2
  };
  const F = P.face;
  if (sc === 0) {                                       // серый: стоит, рука на бедре; в конце поднимает руку
    P.hipRoll = .035 + sw * .012; P.troll = -.05 + sw * .01; P.bob = -.004 * pul; P.pelvX = sw * .006; P.twist = sw * .05; P.yaw = sw * .05;
    P.tilt = .05 + Math.sin(bt * Math.PI / 2 + 1.2) * .025; P.nod = .02;
    const op = track(u, [[0, 0], [.85, 0], [1.1, 1]]); F.oL = F.oR = op * (u > 1.3 ? blink : 1);
    F.lx = track(u, [[0, 0], [1.25, 0], [1.5, -.9], [2.1, -.9], [2.4, .8], [2.9, .8], [3.15, 0]]); F.ly = track(u, [[1.2, 0], [1.5, .1], [2.4, -.15], [3.1, 0]]);
    P.turn = track(u, [[1.2, 0], [1.55, .22], [2.1, .22], [2.45, -.2], [2.95, -.2], [3.2, 0]]);
    const k = track(u, [[3.0, 0], [3.65, 1]]); P.R = mixH(HAND.hangR, HAND.waveR, k);
    P.R.t = [...P.R.t]; P.R.t[0] += Math.sin(t * 2.2) * .008 * (1 - k);
    if (u > 3.15) { F.mouth = 'o'; F.brow = .6; F.blush = 1; }
    P.earL = Math.sin(t * 7) * .06 * (u > 2.4 ? 1 : 0); P.wag = .7;
  } else if (sc === 1) {                                // розовая: машет, подмигивает
    P.hipRoll = sw * .035; P.troll = -sw * .035; P.twist = sw * .1; P.bob = -.009 * pul; P.pelvX = sw * .025; P.yaw = -sw * .08;
    P.tilt = .1 + Math.sin(bt * Math.PI) * .03; P.turn = -.08; P.nod = -.02;
    P.R = mixH(HAND.waveR, HAND.waveR, 0); P.R = { ...P.R, t: [P.R.t[0] + Math.sin(bt * Math.PI * 2) * .06, P.R.t[1] + Math.cos(bt * Math.PI * 2) * .012, P.R.t[2]] };
    P.fR.lift = 0;
    if (u < .85) { F.emL = F.emR = 'cross'; F.mouth = 'o'; F.brow = .6; } else { F.emL = 'cross'; F.emR = 'happy'; F.mouth = 'open'; F.brow = .35; }
    F.blush = 1; P.wag = 1.5; P.earR = Math.sin(t * 9) * .08;
  } else if (sc === 2) {                                // лучи: крупный план, «?!»
    const shk = Math.sin(t * 41) * .008 * (u < 2.3 ? 1 : .3);
    P.L = HAND.scaredL; P.R = HAND.scaredR; P.L = { ...P.L, t: [P.L.t[0] + shk, P.L.t[1], P.L.t[2]] }; P.R = { ...P.R, t: [P.R.t[0] - shk, P.R.t[1], P.R.t[2]] };
    P.bob = -.004 * pul; P.hipRoll = -.02; P.troll = .03; P.yaw = track(u, [[0, 0], [.55, .1], [1.7, .1], [2.3, -.1], [3.75, -.12]]);
    P.tilt = track(u, [[0, .02], [.55, -.17], [1.7, -.17], [2.3, .14], [3.75, .12]]); P.turn = track(u, [[0, 0], [.55, .1], [1.7, .1], [2.3, -.08], [3.75, -.08]]);
    P.nod = track(u, [[0, 0], [.5, .06], [2.2, .06], [2.5, -.03]]);
    F.lx = track(u, [[0, 0], [.5, 0], [.75, -.9], [1.7, -.9], [2.1, 0]]); F.ly = track(u, [[.5, 0], [.75, -.7], [1.7, -.7], [2.1, 0]]);
    if (u < 2.25) { F.brow = 1; F.mouth = 'pout'; F.blush = 1; F.oL = F.oR = blink; P.earL = shk * 8; P.earR = -shk * 8; }
    else { F.brow = -.45; F.mouth = 'fang'; F.blush = 1; F.oL = F.oR = .62; P.earL = Math.sin(t * 8) * .05; }
    P.wag = .6;
  } else {                                              // полосы: танец
    P.bob = -.035 * pul - .004; P.hipRoll = side * .06; P.troll = -side * .05; P.twist = -side * .16; P.pelvX = side * .035; P.yaw = side * .1;
    P.tilt = -side * .1; P.turn = side * .12;
    P.fL.x = -.15; P.fR.x = .15; P.fL.lift = Math.max(0, side) * .055; P.fR.lift = Math.max(0, -side) * .055;
    const up = 1 - track(u, [[2.15, 0], [2.7, 1]]), yw = Math.sin(bt * Math.PI * 2) * .035;
    P.L = mixH(HAND.hipL, HAND.upL, up); P.R = mixH(HAND.salute, HAND.upR, up);
    P.L = { ...P.L, t: [P.L.t[0] + yw * up, P.L.t[1] + Math.abs(yw) * up, P.L.t[2]] }; P.R = { ...P.R, t: [P.R.t[0] - yw * up, P.R.t[1] + Math.abs(yw) * up, P.R.t[2]] };
    if (u < 2.5) { F.emL = F.emR = 'cross'; F.mouth = 'open'; F.brow = .4; } else { F.emL = 'cross'; F.emR = 'happy'; F.mouth = 'open'; F.brow = .3; }
    F.blush = 1; P.wag = 2; P.earL = side * .08; P.earR = -side * .08;
  }
  return P;
}

// камера: положение, цель, FOV, крен
export function getCam(sc, u, t) {
  const k = u / SLEN, orb = Math.sin(t * .55) * .12, pul = Math.exp(-((t / BEAT) % 1) * 6), Y = .055;
  if (sc === 0) return { pos: [orb * 2.2, 1.0 + Y, 4.3 - sm(k) * .35], look: [0, .88 + Y, 0], fov: 28, roll: 0 };
  if (sc === 1) return { pos: [.25 + orb * 1.6, 1.32 + Y, 2.85 - sm(k) * .2], look: [0, 1.17 + Y, 0], fov: 28, roll: 0 };
  if (sc === 2) { const d = track(u, [[0, 1.5], [2.2, 1.38], [2.4, 1.18], [3.75, 1.1]]); return { pos: [.12 + orb * .6, 1.54 + Y, d], look: [-.02, 1.5 + Y, 0], fov: 28, roll: -.05 + .02 * pul }; }
  return { pos: [orb * 1.8, 1.34 + Y, 3.15 - sm(k) * .12], look: [0, 1.14 + Y, 0], fov: 28, roll: Math.sin(bt(t) * Math.PI) * .012 };
}
const bt = t => t / BEAT;
