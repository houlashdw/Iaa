// Процедурная 3D-модель: девушка-волчица, взрослые пропорции (~7 голов), закрытый скромный образ.
// Единицы — метры, +y вверх, она смотрит в +z. «L» = слева на экране (-x), «R» = справа на экране (+x).
import * as THREE from 'three';
import { toon, part, placeSeg, ik, Ribbon, loftGeometry, Chain, clamp, lerp, sm, TAU } from './util.js';
import { FaceTex, FACE_W, FACE_H } from './face.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const COL = {
  skin: 0xf6d3cb, hair: 0x30243f, hairS: 0x1b1325, hairH: 0x9279b4, red: 0xe8254f, dress: 0x332c42, dressS: 0x403852, white: 0xffffff,
  tight: 0x2a2434, boot: 0x2a2434, fur: 0x40313a, furTip: 0x7a6068, earIn: 0xf0a7b4, belt: 0x4a4260
};
const HD = { x: .087, y: .116, z: .092 };          // полуоси головы
const HEAD_C = V(0, .125, .004);                  // центр головы в системе группы головы
const dirOf = (th, al) => V(Math.sin(th) * Math.sin(al), Math.cos(th), Math.sin(th) * Math.cos(al));
function headSurf(d, r) {
  const t = sm(clamp((-.05 - d.y) / .95)), wx = 1 - .38 * Math.pow(t, 1.25), wz = 1 - .22 * t, ch = 1 + .05 * Math.exp(-Math.pow((d.y + .25) / .3, 2)), sy = d.y < 0 ? 1 - .09 * sm(clamp(-d.y)) : 1;
  return V(d.x * HD.x * wx * ch * r, d.y * HD.y * sy * r, d.z * HD.z * wz * r).add(HEAD_C);
}
const thEnd = a => 1.22 + .92 * sm(Math.min(1, Math.abs(a) / Math.PI));

function buildHeadGeo() {
  const g = new THREE.SphereGeometry(1, 72, 54), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const d = V(p.getX(i), p.getY(i), p.getZ(i)), q = headSurf(d, 1).sub(HEAD_C); p.setXYZ(i, q.x, q.y, q.z);
    uv.setXY(i, .5 + q.x / FACE_W, .5 + q.y / FACE_H);
  }
  g.computeVertexNormals(); return g;
}
function buildCapGeo() {
  const R = 28, S = 72, pos = [], idx = [];
  for (let i = 0; i <= R; i++) for (let j = 0; j <= S; j++) {
    const a = j / S * TAU - Math.PI, th = i / R * thEnd(a), d = dirOf(th, a);
    pos.push(d.x * HD.x * 1.095, d.y * HD.y * 1.085 + HEAD_C.y, d.z * HD.z * 1.095 + HEAD_C.z);
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal, pa = g.attributes.position, vi = 3 * (S + 1) + (S >> 1); // верх головы
  if (n.getY(vi) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// прядь, лежащая на голове (в координатах группы головы)
function strandOnHead({ a0, th0, th1, da = 0, r0 = 1.1, bulge = .05, w = .016, n = 9 }) {
  const pts = [], ws = [], ref = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1), th = lerp(th0, th1, t), al = a0 + da * t, d = dirOf(th, al);
    pts.push(headSurf(d, r0 + bulge * Math.sin(Math.PI * Math.min(1, t * 1.15)))); ref.push(d);
    ws.push(k === n - 1 ? 0 : w * (t < .2 ? .55 + t * 2.25 : 1) * Math.pow(1 - t, .7));
  }
  return { pts, w: ws, ref };
}

function mirrorGeo(g) { return g; }
function capsule(r, len, seg = 8) { const g = new THREE.CapsuleGeometry(r, len, 4, seg); g.translate(0, len / 2 + r, 0); return g; }

/* ---------- кисть ---------- */
function buildHand(skin) {
  const grp = new THREE.Group(), fingers = [];
  const pg = new THREE.SphereGeometry(1, 20, 14); pg.scale(.0275, .037, .0150); pg.translate(0, .040, 0); part(grp, pg, skin, .5);
  const defs = [[-.0200, .031, .024, .0092], [-.0067, .034, .026, .0098], [.0067, .032, .025, .0092], [.0200, .026, .020, .0082]];
  for (const [x, l1, l2, r] of defs) {
    const g1 = new THREE.Group(); g1.position.set(x, .074, 0); grp.add(g1); part(g1, capsule(r, l1 - 2 * r), skin, .22);
    const g2 = new THREE.Group(); g2.position.y = l1; g1.add(g2); part(g2, capsule(r * .92, l2 - 2 * r), skin, .22); fingers.push([g1, g2, x]);
  }
  const t1 = new THREE.Group(); t1.position.set(.024, .022, .006); t1.rotation.z = -.75; grp.add(t1); part(t1, capsule(.0108, .014), skin, .22);
  const t2 = new THREE.Group(); t2.position.y = .030; t1.add(t2); part(t2, capsule(.0098, .010), skin, .22);
  return { grp, fingers, thumb: [t1, t2] };
}
function curlHand(h, c, spread = 0) {
  h.fingers.forEach(([a, b, x], i) => { const k = 1 + (i === 3 ? .1 : 0) - (i === 1 ? .05 : 0); a.rotation.x = c * 1.25 * k + .05; b.rotation.x = c * 1.5 * k; a.rotation.z = -x * spread * 14; });
  h.thumb[0].rotation.x = c * .5; h.thumb[1].rotation.x = c * .8; h.thumb[0].rotation.z = -.75 + c * .25;
}

/* ---------- сборка ---------- */
export function createCharacter(scene) {
  const M = {
    skin: toon(COL.skin), dress: toon(COL.dress), dressS: toon(COL.dressS), red: toon(COL.red), white: toon(0xf2edf7), tight: toon(COL.tight), boot: toon(COL.boot),
    hair: toon(COL.hair), hairS: toon(COL.hairS), hairR: toon(COL.red), hairH: toon(COL.hairH), belt: toon(COL.belt), earIn: toon(COL.earIn), bootRed: toon(COL.red),
    fur: toon(0xffffff, { vertexColors: true }), skirt: toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide })
  };
  M.skirt.flatShading = true;   // плоские грани = чёткие складки плиссе
  const face = new FaceTex();
  M.head = toon(0xffffff, { map: face.tex, emissive: 0xffffff, emissiveMap: face.tex, emissiveIntensity: .1 });

  const root = new THREE.Group(); scene.add(root);
  const pelvis = new THREE.Group(); root.add(pelvis);
  const torso = new THREE.Group(); torso.position.y = .12; pelvis.add(torso);
  const head = new THREE.Group(); head.position.y = .412; head.scale.setScalar(1.13); torso.add(head);

  /* торс */
  const bodiceG = loftGeometry([
    { y: -.13, a: .150, b: .108 }, { y: -.06, a: .128, b: .092 }, { y: 0, a: .108, b: .082, cz: .002 }, { y: .08, a: .116, b: .090, cz: .006 },
    { y: .17, a: .134, b: .103, cz: .012 }, { y: .23, a: .143, b: .106, cz: .014 }, { y: .29, a: .152, b: .096, cz: .006 }, { y: .335, a: .160, b: .080 },
    { y: .368, a: .108, b: .062, cz: -.004 }, { y: .395, a: .058, b: .050, cz: -.006 }, { y: .418, a: .044, b: .044, cz: -.004 }
  ], { rings: 36, segs: 44 });
  part(torso, bodiceG, M.dress, 1);
  const beltG = loftGeometry([{ y: -.022, a: .1135, b: .0875 }, { y: .0, a: .1145, b: .0885 }, { y: .028, a: .1135, b: .0875 }], { rings: 4, segs: 44 });
  part(torso, beltG, M.belt, .7);
  const buckleS = new THREE.Shape(); buckleS.moveTo(-.024, -.016); buckleS.lineTo(.024, -.016); buckleS.lineTo(.024, .016); buckleS.lineTo(-.024, .016); buckleS.closePath();
  const bg = new THREE.ExtrudeGeometry(buckleS, { depth: .008, bevelEnabled: true, bevelSize: .004, bevelThickness: .003, bevelSegments: 2 }); bg.translate(0, .003, .0895);
  part(torso, bg, M.white, .6);
  const stripe = new THREE.BoxGeometry(.046, .007, .004); stripe.translate(0, .003, .1055); part(torso, stripe, M.red, 0);
  for (const [by, bz] of [[.215, .127], [.16, .119], [.105, .105], [.05, .097]]) { const bt = new THREE.SphereGeometry(.0078, 12, 10); bt.scale(1, 1, .6); part(torso, bt, M.white, .6).position.set(0, by, bz + .002); }
  // шея и воротник
  const neckG = new THREE.CylinderGeometry(.03, .034, .13, 20); neckG.translate(0, .4, 0); part(torso, neckG, M.skin, .7);
  const collarG = new THREE.TorusGeometry(.049, .0105, 12, 40); collarG.rotateX(Math.PI / 2); collarG.scale(1, 1, .98); collarG.translate(0, .405, -.003);
  part(torso, collarG, M.white, .8);
  const collar2 = new THREE.TorusGeometry(.056, .0075, 10, 40); collar2.rotateX(Math.PI / 2); collar2.translate(0, .391, -.003); part(torso, collar2, M.red, .5);
  // бант
  const bowS = new THREE.Shape(); bowS.moveTo(0, 0); bowS.bezierCurveTo(.025, .035, .085, .02, .075, -.02); bowS.bezierCurveTo(.065, -.042, .022, -.022, 0, -.006); bowS.closePath();
  const bowG = new THREE.ExtrudeGeometry(bowS, { depth: .010, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 2, curveSegments: 14 });
  const bowGrp = new THREE.Group(); bowGrp.position.set(0, .366, .066); bowGrp.rotation.x = -.08; bowGrp.scale.setScalar(1.7); torso.add(bowGrp);
  for (const s of [-1, 1]) { const m = part(bowGrp, bowG, M.white, .7); m.scale.x = s; m.rotation.z = s * .22 * -1; m.position.set(0, 0, -.005); }
  const knot = new THREE.SphereGeometry(.0175, 14, 12); knot.scale(1, .9, .8); part(bowGrp, knot, M.white, .8).position.set(0, -.002, .004);
  const gem = new THREE.SphereGeometry(.0085, 12, 10); part(bowGrp, gem, M.red, .6).position.set(0, -.002, .02);
  const tailS = new THREE.Shape(); tailS.moveTo(-.014, 0); tailS.lineTo(.014, 0); tailS.lineTo(.019, -.095); tailS.lineTo(.0, -.078); tailS.lineTo(-.019, -.095); tailS.closePath();
  const bowTailG = new THREE.ExtrudeGeometry(tailS, { depth: .004, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 1 });
  for (const s of [-1, 1]) { const m = part(bowGrp, bowTailG, M.white, .6); m.position.set(s * .012, -.008, .001); m.rotation.set(.22, 0, s * .09); }

  /* голова */
  const headG = buildHeadGeo(); const headM = part(head, headG, M.head, 1); headM.position.copy(HEAD_C);
  // у головы геометрия центрирована, поэтому сдвиг = HEAD_C
  const capG = buildCapGeo(); const cap = part(head, capG, M.hair, 1);
  // блик-обруч на шапке
  const halo = strandOnHead({ a0: -1.1, th0: .62, th1: .62, da: 2.2, r0: 1.115, w: .010, n: 2 });
  { const pts = [], ws = [], rf = []; for (let k = 0; k < 16; k++) { const t = k / 15, d = dirOf(.7 + .1 * Math.sin(t * Math.PI), -1.15 + 2.3 * t); pts.push(headSurf(d, 1.12)); rf.push(d); ws.push(.0135 * Math.sin(Math.PI * t) + .0008); }
    const r = new Ribbon(head, 16, M.hairH, 0); r.update(pts, ws, .5, rf); }
  // чёлка
  const bangs = [
    [-.98, .55, 1.62, .08, .021, 'hair'], [-.72, .45, 1.44, .12, .021, 'hair'], [-.46, .35, 1.28, .10, .020, 'hairR'], [-.23, .3, 1.40, .04, .019, 'hair'],
    [-.04, .28, 1.22, .02, .018, 'hair'], [.16, .3, 1.34, -.06, .019, 'hair'], [.38, .35, 1.46, -.05, .021, 'hair'], [.62, .45, 1.30, -.09, .021, 'hair'], [.98, .55, 1.66, -.08, .021, 'hair'],
    [-.34, .4, 1.34, .08, .014, 'hairS'], [.5, .4, 1.34, -.07, .014, 'hairS']
  ];
  for (const [a0, th0, th1, da, w, m] of bangs) { const s = strandOnHead({ a0, th0, th1, da, r0: 1.115, w, n: 9 }); new Ribbon(head, 9, M[m], .45).update(s.pts, s.w, .42, s.ref); }
  // боковые пряди, обрамляющие лицо
  const sides = [[-1.40, .85, 2.15, .08, .021, 'hair'], [-1.62, .9, 2.25, .06, .022, 'hairR'], [1.40, .85, 2.15, -.08, .021, 'hair'], [1.62, .9, 2.25, -.06, .022, 'hair']];
  for (const [a0, th0, th1, da, w, m] of sides) { const s = strandOnHead({ a0, th0, th1, da, r0: 1.16, bulge: .08, w, n: 10 }); new Ribbon(head, 10, M[m], .45).update(s.pts, s.w, .45, s.ref); }
  // заколка X
  const pin = new THREE.Group(); pin.position.copy(headSurf(dirOf(.78, .5), 1.17)); pin.lookAt(pin.position.clone().add(V(.6, .2, 1))); head.add(pin);
  for (const k of [-1, 1]) { const bg2 = new THREE.CapsuleGeometry(.0042, .026, 4, 8); bg2.rotateZ(Math.PI / 2); const m = part(pin, bg2, M.white, .8); m.rotation.z = k * Math.PI / 4; }
  // уши
  const earL = new THREE.Group(), earR = new THREE.Group(); head.add(earL, earR);
  const earGeo = (r, h) => { const g = new THREE.ConeGeometry(r, h, 3, 1); g.rotateY(Math.PI); g.scale(1, 1, .5); g.translate(0, h / 2, 0); return g; };
  for (const [g, s] of [[earL, -1], [earR, 1]]) {
    g.position.set(s * .056, .222, -.006); g.userData.base = { z: s * -.30, x: -.14 };
    part(g, earGeo(.056, .138), M.hair, 1); const inn = part(g, earGeo(.036, .1), M.earIn, 0); inn.position.set(0, .006, .012);
    const tuft = part(g, earGeo(.022, .05), M.white, 0); tuft.position.set(0, .004, .019);
  }
  /* волосы-пряди (физика) */
  const hv = [], strands = [];
  const addStrand = (cfg) => {
    const n = cfg.n, rb = new Ribbon(scene, n, M[cfg.mat], .7), ch = new Chain(n); strands.push(Object.assign({ rb, ch }, cfg));
  };
  // задние пряди: два слоя
  for (const [layer, count, mat, r0, w0, lenBase] of [[0, 15, 'hairS', 1.06, .046, .24], [1, 22, 'hair', 1.13, .040, .29]]) {
    for (let j = 0; j < count; j++) {
      const al = 1.42 + (TAU - 2.84) * (j / (count - 1)) + (layer ? .06 : 0), a = al > Math.PI ? al - TAU : al;
      const th = thEnd(a) - (layer ? .28 : .42), n = 7, side = Math.abs(Math.sin(a));
      const len = lenBase + .06 * Math.sin(j * 1.9 + layer) - .05 * side * side;
      addStrand({ kind: 'back', n, mat, a, th, r0, len, w: w0 * (1 - .15 * side), th2: .4 });
    }
  }
  // хвостик (конский хвост сбоку), цвета: тень, основа, красные
  const ponyPts = [V(-.060, .200, -.040), V(-.108, .226, -.058), V(-.160, .215, -.066), V(-.205, .172, -.058), V(-.230, .105, -.044), V(-.243, .025, -.03), V(-.246, -.065, -.014), V(-.238, -.15, .002)];
  [['hairS', 0, .058], ['hair', .8, .046], ['hairR', -.9, .030], ['hair', -.3, .044], ['hairR', 1.4, .024], ['hair', 1.9, .034], ['hairS', -1.7, .04], ['hairR', .3, .018]].forEach(([mat, sp, w], i) =>
    addStrand({ kind: 'pony', n: 8, mat, sp, w, ponyPts, lenScale: 1 - .07 * (i % 3) }));
  const sph = { head: { c: V(), r: .112 }, neck: { c: V(), r: .042 }, chest: { c: V(), r: .125 }, sL: { c: V(), r: .066 }, sR: { c: V(), r: .066 }, back: { c: V(), r: .11 } };

  /* хвост: физика на 9 точках, меш — сглаженная кривая на RN кольцах */
  const TN = 9, RN = 30, TS = 14, tailChain = new Chain(TN), tailCols = new Float32Array(RN * TS * 3), tailPos = new Float32Array(RN * TS * 3), tailG = new THREE.BufferGeometry();
  tailG.setAttribute('position', new THREE.BufferAttribute(tailPos, 3)); tailG.setAttribute('color', new THREE.BufferAttribute(tailCols, 3));
  { const ix = []; for (let i = 0; i < RN - 1; i++) for (let j = 0; j < TS; j++) { const a = i * TS + j, b = i * TS + (j + 1) % TS, c = (i + 1) * TS + j, d = (i + 1) * TS + (j + 1) % TS; ix.push(a, c, b, b, c, d); } tailG.setIndex(ix); }
  const cF = new THREE.Color(COL.fur), cT = new THREE.Color(COL.furTip), cD = new THREE.Color(0x2a1f26), tmpC = new THREE.Color();
  for (let i = 0; i < RN; i++) { const t = i / (RN - 1); tmpC.copy(cD).lerp(cF, clamp(t * 2)).lerp(cT, clamp((t - .62) * 2.6)); for (let j = 0; j < TS; j++) { const o = (i * TS + j) * 3; tailCols[o] = tmpC.r; tailCols[o + 1] = tmpC.g; tailCols[o + 2] = tmpC.b; } }
  const tailMesh = part(scene, tailG, M.fur, 1); tailMesh.frustumCulled = false; tailMesh.children.forEach(c => c.frustumCulled = false);
  let tailWindingFixed = false;
  const tailRestLocal = [V(-.02, .0, -.09), V(-.13, .0, -.15), V(-.28, -.06, -.15), V(-.42, -.17, -.10), V(-.52, -.31, -.06), V(-.55, -.46, -.02), V(-.51, -.60, .03), V(-.45, -.70, .06), V(-.39, -.76, .07)];
  const ssm = (a, b, x) => sm(clamp((x - a) / (b - a)));
  const tailR = t => (.030 + .056 * Math.sin(Math.PI * Math.pow(t, .62))) * (1 - ssm(.86, 1, t) * .95) + .006 * ssm(.86, 1, t);

  /* юбка */
  const SK_S = 96, skS = [0, .06, .14, .24, .36, .48, .6, .72, .83, .92, .96, .96, 1, 1, 1.07], SKN = skS.length;
  const skPos = new Float32Array(SKN * SK_S * 3), skCol = new Float32Array(SKN * SK_S * 3), skG = new THREE.BufferGeometry(); const skIx = [];
  skG.setAttribute('position', new THREE.BufferAttribute(skPos, 3)); skG.setAttribute('color', new THREE.BufferAttribute(skCol, 3));
  for (let r = 0; r < SKN - 1; r++) for (let j = 0; j < SK_S; j++) { const a = r * SK_S + j, b = r * SK_S + (j + 1) % SK_S, c = (r + 1) * SK_S + j, d = (r + 1) * SK_S + (j + 1) % SK_S; skIx.push(a, b, c, b, d, c); }
  skG.setIndex(skIx);
  { const cd = new THREE.Color(COL.dress), cr = new THREE.Color(COL.red), cc = new THREE.Color(0xf6ecf1); for (let r = 0; r < SKN; r++) for (let j = 0; j < SK_S; j++) { const c = r >= 13 ? cc : r >= 11 ? cr : cd, o = (r * SK_S + j) * 3, shade = r >= 11 ? 1 : .86 + .26 * ((2 / Math.PI) * Math.asin(Math.sin(j / SK_S * TAU * 12)) * .5 + .5); skCol[o] = c.r * shade; skCol[o + 1] = c.g * shade; skCol[o + 2] = c.b * shade; } }
  const skirt = part(pelvis, skG, M.skirt, 1); skirt.frustumCulled = false; skirt.children.forEach(c => c.frustumCulled = false);
  const SKY0 = .095, SKY1 = -.60, skLag = V(), skVelPrev = V(), skPrev = V();

  /* руки и ноги */
  const arm = {}, leg = {};
  for (const s of ['L', 'R']) {
    const a = {};
    a.sh = part(scene, new THREE.SphereGeometry(.047, 18, 14), M.dress, .9);
    a.up = part(scene, new THREE.CylinderGeometry(.034, .040, .28, 20), M.dress, .9);
    a.el = part(scene, new THREE.SphereGeometry(.034, 16, 12), M.dress, .9);
    a.fo = part(scene, new THREE.CylinderGeometry(.038, .029, .25, 20), M.dress, .9);
    const cg = new THREE.TorusGeometry(.037, .0075, 10, 28); cg.rotateX(Math.PI / 2); a.cuff = part(scene, cg, M.red, .6);
    a.hand = buildHand(M.skin); scene.add(a.hand.grp); if (s === 'R') a.hand.grp.scale.x = -1;
    a.elbow = V(); a.wrist = V(); arm[s] = a;
    const l = {};
    l.th = part(scene, new THREE.CylinderGeometry(.050, .068, .44, 22), M.tight, .9); l.kn = part(scene, new THREE.SphereGeometry(.05, 16, 12), M.tight, .9);
    l.sh = part(scene, new THREE.CylinderGeometry(.033, .048, .44, 20), M.tight, .9);
    const boot = new THREE.Group(); scene.add(boot); l.boot = boot;
    const shaft = new THREE.CylinderGeometry(.047, .042, .17, 22); shaft.translate(0, .068, 0); part(boot, shaft, M.boot, .9);
    const ft = new THREE.CapsuleGeometry(.041, .11, 6, 18); ft.rotateX(Math.PI / 2); ft.scale(1, .86, 1); ft.translate(0, -.04, .045); part(boot, ft, M.boot, .9);
    const sole = new THREE.CapsuleGeometry(.0445, .115, 4, 18); sole.rotateX(Math.PI / 2); sole.scale(1, .22, 1.02); sole.translate(0, -.071, .045); part(boot, sole, M.bootRed, .5);
    const heel = new THREE.BoxGeometry(.06, .04, .05); heel.translate(0, -.05, -.03); part(boot, heel, M.boot, .6);
    const top = new THREE.TorusGeometry(.0455, .0058, 8, 24); top.rotateX(Math.PI / 2); top.translate(0, .15, 0); part(boot, top, M.bootRed, .5);
    l.knee = V(); l.ankle = V(); leg[s] = l;
  }

  /* ---- состояние ---- */
  const tmp = { a: V(), b: V(), c: V(), d: V(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), x: V(), y: V(), z: V() };
  const hipOff = { L: V(-.088, -.02, 0), R: V(.088, -.02, 0) }, shOff = { L: V(-.165, .322, 0), R: V(.165, .322, 0) };
  let first = true;

  function placeArm(P, s) {
    const a = arm[s], H = P[s], sh = torso.localToWorld(shOff[s].clone()), tgt = torso.localToWorld(V(...H.t)), tq = torso.getWorldQuaternion(tmp.q), pole = V(...H.pole).applyQuaternion(tq);
    ik(sh, tgt, .28, .25, pole, a.elbow, a.wrist);
    a.sh.position.copy(sh); placeSeg(a.up, sh, a.elbow); a.el.position.copy(a.elbow); placeSeg(a.fo, a.elbow, a.wrist);
    const fd = tmp.a.copy(a.wrist).sub(a.elbow).normalize(); a.cuff.position.copy(a.wrist).addScaledVector(fd, -.012); a.cuff.quaternion.setFromUnitVectors(V(0, 1, 0), fd);
    // ориентация кисти
    const hint = V(...H.palm).applyQuaternion(tq).normalize(), y = fd.clone().lerp(V(0, 1, 0), H.up || 0).normalize(), z = hint.addScaledVector(y, -hint.dot(y)).normalize(), x = y.clone().cross(z).normalize();
    tmp.m.makeBasis(x, y, z); a.hand.grp.quaternion.setFromRotationMatrix(tmp.m); a.hand.grp.position.copy(a.wrist).addScaledVector(fd, .004);
    curlHand(a.hand, H.curl, H.spread || 0);
  }
  function placeLeg(P, s) {
    const l = leg[s], F = P['f' + s], hip = pelvis.localToWorld(hipOff[s].clone()), tgt = root.localToWorld(V(F.x, .075 + F.lift, F.z));
    const pq = pelvis.getWorldQuaternion(tmp.q), pole = V((s === 'L' ? -1 : 1) * .25, .1, 1).applyQuaternion(pq);
    ik(hip, tgt, .44, .44, pole, l.knee, l.ankle);
    placeSeg(l.th, hip, l.knee); l.kn.position.copy(l.knee); placeSeg(l.sh, l.knee, l.ankle);
    l.boot.position.copy(l.ankle); l.boot.rotation.set(F.lift * 3.2, P.yaw + F.yaw, 0);
  }

  function update(P, t) {
    root.position.set(P.rootX, 0, P.rootZ || 0); root.rotation.y = P.yaw;
    pelvis.position.set(P.pelvX || 0, .955 + P.bob, 0); pelvis.rotation.set(P.hipPitch, P.hipYaw, P.hipRoll);
    torso.rotation.set(P.lean, P.twist, P.troll); head.rotation.set(P.nod, P.turn, P.tilt);
    earL.rotation.set(earL.userData.base.x, 0, earL.userData.base.z + P.earL); earR.rotation.set(earR.userData.base.x, 0, earR.userData.base.z - P.earR);
    root.updateMatrixWorld(true);
    placeArm(P, 'L'); placeArm(P, 'R'); placeLeg(P, 'L'); placeLeg(P, 'R');
    face.draw(P.face);

    // коллайдеры
    sph.head.c.copy(head.localToWorld(V(0, .125, -.005))); sph.neck.c.copy(torso.localToWorld(V(0, .42, -.005))); sph.chest.c.copy(torso.localToWorld(V(0, .2, -.015)));
    sph.sL.c.copy(arm.L.sh.position); sph.sR.c.copy(arm.R.sh.position); sph.back.c.copy(torso.localToWorld(V(0, .27, -.02)));
    const cols = [sph.neck, sph.chest, sph.sL, sph.sR, sph.back, sph.head];
    const hq = head.getWorldQuaternion(tmp.q).clone();

    for (const s of strands) {
      const n = s.n, rest = [], pts = s.ch.p;
      if (s.kind === 'back') {
        const rootL = headSurf(dirOf(s.th, s.a), s.r0), out = V(Math.sin(s.a), 0, Math.cos(s.a)), rootW = head.localToWorld(rootL.clone()), outW = out.clone().applyQuaternion(hq);
        for (let k = 0; k < n; k++) {
          const f = k / (n - 1), lp = rootL.clone().addScaledVector(out, .014 * k + .02 * Math.pow(f, 1.6) * 3).add(V(0, -s.len * f, 0)), hr = head.localToWorld(lp);
          const hang = rootW.clone().addScaledVector(outW, .014 * k + .02 * Math.pow(f, 1.6) * 3).add(V(0, -s.len * f * (1 - .2 * f), 0));
          rest.push(hr.lerp(hang, clamp((k - 1) / (n - 2)) * .75));
        }
        s.ch.step(rest, [0, .50, .34, .24, .17, .12, .09], .00055, .90, cols, 2);
      } else {
        for (let k = 0; k < n; k++) { const f = k / (n - 1), lp = s.ponyPts[k].clone(); lp.z += s.sp * f * .05; lp.x += s.sp * f * .075 - .004 * f * s.lenScale; lp.y *= 1; rest.push(head.localToWorld(lp)); }
        s.ch.step(rest, [0, .55, .30, .19, .13, .09, .07, .06], .0005, .92, cols, 2);
      }
      const ws = [], ref = [];
      for (let k = 0; k < n; k++) {
        const f = k / (n - 1); ws.push(k === n - 1 ? 0 : s.kind === 'back' ? s.w * (f < .15 ? .6 + f * 2.7 : 1) * Math.pow(1 - f, .55) : s.w * (.28 + .72 * Math.sin(Math.PI * Math.pow(f, .72))) * (1 - .35 * f));
        if (s.kind === 'back') ref.push(V(Math.sin(s.a), 0, Math.cos(s.a)).applyQuaternion(hq)); else ref.push(V(0, 0, 1).applyQuaternion(hq).lerp(V(-1, 0, 0), .25).normalize());
      }
      s.rb.update(pts, ws, s.kind === 'back' ? .3 : .34, ref);
    }

    /* хвост */
    { const rest = [], wag = Math.sin(t * Math.PI * 2 / (P.beat2 || 1)) * (P.wag || 1);
      for (let i = 0; i < TN; i++) { const lp = tailRestLocal[i].clone(); lp.x += wag * i * .008; lp.z += wag * i * .01; rest.push(pelvis.localToWorld(lp)); }
      tailChain.step(rest, [0, .55, .30, .20, .14, .10, .08, .06, .05], .00055, .92, null, 2);
      const curve = new THREE.CatmullRomCurve3(tailChain.p.map(v => v.clone()), false, 'catmullrom', .5), pts = curve.getSpacedPoints(RN - 1), T = tmp.a, B = tmp.b, N = tmp.c;
      for (let i = 0; i < RN; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(RN - 1, i + 1)], tt = i / (RN - 1); T.copy(b).sub(a).normalize();
        B.set(0, 0, 1); B.addScaledVector(T, -B.dot(T)); if (B.lengthSq() < 1e-6) B.set(1, 0, 0); B.normalize(); N.crossVectors(T, B).normalize();
        const r = tailR(tt) * (i ? 1 : .8) * (1 + (tt > .1 && tt < .93 ? (i & 1 ? .11 : -.05) : 0));
        for (let j = 0; j < TS; j++) { const th = j / TS * TAU, c = Math.cos(th), sn = Math.sin(th), o = (i * TS + j) * 3, fur = 1 + (j & 1 ? .05 : 0) * (tt > .25 ? 1 : 0);
          tailPos[o] = pts[i].x + (B.x * c + N.x * sn) * r * fur; tailPos[o + 1] = pts[i].y + (B.y * c + N.y * sn) * r * fur; tailPos[o + 2] = pts[i].z + (B.z * c + N.z * sn) * r * fur; }
      }
      tailG.attributes.position.needsUpdate = true;
      if (!tailWindingFixed) { tailWindingFixed = true; tailG.computeVertexNormals(); const nA = tailG.attributes.normal, vi = 10 * TS, o = V(tailPos[vi * 3] - pts[10].x, tailPos[vi * 3 + 1] - pts[10].y, tailPos[vi * 3 + 2] - pts[10].z);
        if (V(nA.getX(vi), nA.getY(vi), nA.getZ(vi)).dot(o) < 0) { const ix = tailG.index.array; for (let k = 0; k < ix.length; k += 3) { const q = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = q; } tailG.index.needsUpdate = true; } }
      tailG.computeVertexNormals(); tailG.computeBoundingSphere();
    }

    /* юбка: плиссе + инерция */
    { const vel = pelvis.getWorldPosition(tmp.d).clone(); const v = vel.clone().sub(skPrev); skPrev.copy(vel); skLag.lerp(v.multiplyScalar(1), .0);
      const lagTarget = v.clone().multiplyScalar(-9); skLag.lerp(lagTarget, .25); const loc = skLag.clone().applyQuaternion(pelvis.getWorldQuaternion(tmp.q).invert());
      for (let r = 0; r < SKN; r++) {
        const s = skS[r], y = lerp(SKY0, SKY1, s), e = Math.pow(s, .82), a = lerp(.118, .315, e), b = lerp(.096, .29, e), amp = .115 * Math.pow(Math.min(s, 1), .8) * (r >= 13 ? .25 : 1), fr = r >= 13 ? 1 : 0;
        for (let j = 0; j < SK_S; j++) {
          const th = j / SK_S * TAU, tri = (2 / Math.PI) * Math.asin(Math.sin(th * 12)), k = 1 + amp * (tri * .5 + .5) * 1.1 + fr * (.03 * Math.abs(Math.sin(th * 24)) + .02 * (r - 13)), o = (r * SK_S + j) * 3;
          skPos[o] = Math.sin(th) * a * k + loc.x * s * s * .9; skPos[o + 1] = y + loc.y * s * .2 + Math.sin(t * 2.2 + th * 2) * .003 * s; skPos[o + 2] = Math.cos(th) * b * k + loc.z * s * s * .9;
        }
      }
      // коллизия юбки с ногами (капсулы бедро/голень в системе таза)
      { const segs = []; for (const k of ['L', 'R']) { const l = leg[k]; segs.push([pelvis.worldToLocal(pelvis.localToWorld(hipOff[k].clone())), pelvis.worldToLocal(l.knee.clone()), .078], [pelvis.worldToLocal(l.knee.clone()), pelvis.worldToLocal(l.ankle.clone()), .06]); }
        const ab = V(), ap = V(), cp = V(), dv = V();
        for (let i = 0; i < SKN * SK_S; i++) { const px = skPos[i * 3], py = skPos[i * 3 + 1], pz = skPos[i * 3 + 2]; if (pz < -.02) continue; dv.set(px, py, pz);
          for (const [a, b, r] of segs) { ab.copy(b).sub(a); const L2 = ab.lengthSq(); ap.copy(dv).sub(a); const f = clamp(ap.dot(ab) / L2); cp.copy(a).addScaledVector(ab, f); ap.copy(dv).sub(cp); const d = ap.length(), want = r + .024;
            if (d < want && d > 1e-5) { dv.copy(cp).addScaledVector(ap, want / d); } }
          skPos[i * 3] = dv.x; skPos[i * 3 + 1] = dv.y; skPos[i * 3 + 2] = dv.z; } }
      skG.attributes.position.needsUpdate = true; skG.computeVertexNormals(); skG.computeBoundingSphere();
      if (first) { // направление нормалей
        const nA = skG.attributes.normal, vi = 6 * SK_S + 1, o = V(skPos[vi * 3], 0, skPos[vi * 3 + 2]);
        if (V(nA.getX(vi), nA.getY(vi), nA.getZ(vi)).dot(o) < 0) { const ix = skG.index.array; for (let k = 0; k < ix.length; k += 3) { const q = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = q; } skG.index.needsUpdate = true; skG.computeVertexNormals(); }
        first = false;
      }
    }
  }

  return { root, pelvis, torso, head, update, face, M, headWorld: () => head.localToWorld(V(0, .125, 0)) };
}
