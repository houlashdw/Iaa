// Общие утилиты: toon-материалы, контуры, ленты (волосы), лофтинг, IK, цепочки Верле.
import * as THREE from 'three';

export const INK = 0x1b1522;
export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sm = t => t * t * (3 - 2 * t);

/* ---------- toon ---------- */
const rampData = new Uint8Array([
  120, 112, 140, 255,   // тень
  176, 168, 196, 255,   // полутень
  222, 216, 234, 255,   // свет
  246, 244, 252, 255    // блик
]);
export const RAMP = new THREE.DataTexture(rampData, 4, 1, THREE.RGBAFormat);
RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter; RAMP.needsUpdate = true;
export const toon = (color, o = {}) => new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: RAMP }, o));

/* ---------- контуры (inverted hull) ---------- */
const OUTS = new Map();
export function outlineMat(mult = 1) {
  const key = Math.round(mult * 100);
  if (OUTS.has(key)) return OUTS.get(key).mat;
  const uni = { value: 0 }, mat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uThick = uni;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uThick;')
      .replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * uThick;');
  };
  OUTS.set(key, { mat, uni, mult });
  return mat;
}
export function setOutline(base) { for (const o of OUTS.values()) o.uni.value = base * o.mult; }

export function part(parent, geom, mat, outline = 1) {
  const m = new THREE.Mesh(geom, mat); if (parent) parent.add(m);
  if (outline) { const o = new THREE.Mesh(geom, outlineMat(outline)); o.name = 'outline'; m.add(o); }
  return m;
}

/* ---------- сегменты между точками ---------- */
const Y = new THREE.Vector3(0, 1, 0), tmpD = new THREE.Vector3();
export function placeSeg(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  tmpD.copy(b).sub(a).normalize(); mesh.quaternion.setFromUnitVectors(Y, tmpD);
}

/* ---------- двухзвенный IK ---------- */
const _d = new THREE.Vector3(), _p = new THREE.Vector3();
export function ik(root, target, l1, l2, pole, out = new THREE.Vector3(), tgtOut = null) {
  _d.copy(target).sub(root); let dist = _d.length(); const max = l1 + l2 - 1e-4;
  if (dist > max) { _d.setLength(max); dist = max; if (tgtOut) tgtOut.copy(root).add(_d); } else if (tgtOut) tgtOut.copy(target);
  if (dist < 1e-4) { out.copy(root); return out; }
  const dir = _d.clone().multiplyScalar(1 / dist);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _p.copy(pole).addScaledVector(dir, -pole.dot(dir)); if (_p.lengthSq() < 1e-8) _p.set(0, 0, 1); _p.normalize();
  return out.copy(root).addScaledVector(dir, a).addScaledVector(_p, h);
}

/* ---------- ленты (прядь: ромбовидное сечение) ---------- */
export class Ribbon {
  constructor(parent, n, mat, outline = .8) {
    this.n = n; this.pos = new Float32Array(n * 4 * 3); this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.idx = []; for (let i = 0; i < n - 1; i++) for (let j = 0; j < 4; j++) {
      const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = (i + 1) * 4 + j, d = (i + 1) * 4 + (j + 1) % 4; this.idx.push(a, c, b, b, c, d);
    }
    this.geo.setIndex(this.idx); this.checked = false;
    this.mesh = part(parent, this.geo, mat, outline); this.mesh.frustumCulled = false; this.mesh.children.forEach(c => c.frustumCulled = false);
    this._T = new THREE.Vector3(); this._B = new THREE.Vector3(); this._N = new THREE.Vector3();
  }
  // pts: Vector3[], w: ширина по точкам, th: толщина (доля ширины), ref: опорные нормали (наружу)
  update(pts, w, th, ref) {
    const n = this.n, P = this.pos, T = this._T, B = this._B, N = this._N;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      T.copy(b).sub(a).normalize(); const r = Array.isArray(ref) ? ref[i] : ref;
      B.crossVectors(T, r); if (B.lengthSq() < 1e-8) B.set(1, 0, 0); B.normalize(); N.crossVectors(B, T).normalize();
      const p = pts[i], ww = w[i], hh = ww * th, o = i * 12;
      P[o] = p.x + B.x * ww; P[o + 1] = p.y + B.y * ww; P[o + 2] = p.z + B.z * ww;
      P[o + 3] = p.x + N.x * hh; P[o + 4] = p.y + N.y * hh; P[o + 5] = p.z + N.z * hh;
      P[o + 6] = p.x - B.x * ww; P[o + 7] = p.y - B.y * ww; P[o + 8] = p.z - B.z * ww;
      P[o + 9] = p.x - N.x * hh; P[o + 10] = p.y - N.y * hh; P[o + 11] = p.z - N.z * hh;
    }
    this.geo.attributes.position.needsUpdate = true;
    if (!this.checked) { this.checked = true; this._fixWinding(pts[0], ref); }
    this.geo.computeVertexNormals(); this.geo.computeBoundingSphere();
  }
  _fixWinding(p0) {
    const P = this.pos, i = this.idx, va = new THREE.Vector3(P[i[0] * 3], P[i[0] * 3 + 1], P[i[0] * 3 + 2]), vb = new THREE.Vector3(P[i[1] * 3], P[i[1] * 3 + 1], P[i[1] * 3 + 2]), vc = new THREE.Vector3(P[i[2] * 3], P[i[2] * 3 + 1], P[i[2] * 3 + 2]);
    const nrm = vb.clone().sub(va).cross(vc.clone().sub(va)), cen = va.clone().add(vb).add(vc).multiplyScalar(1 / 3).sub(p0);
    if (nrm.dot(cen) < 0) { for (let k = 0; k < i.length; k += 3) { const t = i[k + 1]; i[k + 1] = i[k + 2]; i[k + 2] = t; } this.geo.setIndex(i); }
  }
}

/* ---------- лофт (торс) ---------- */
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
export function loftGeometry(sec, { rings = 30, segs = 40, pw = 2.4 } = {}) {
  const N = sec.length, pos = [], idx = [], keys = ['y', 'a', 'b', 'cz', 'cx'];
  const get = (i, k) => (sec[clamp(i, 0, N - 1)][k] ?? 0);
  for (let r = 0; r <= rings; r++) {
    const s = r / rings * (N - 1), i = Math.min(N - 2, Math.floor(s)), t = s - i, v = {};
    for (const k of keys) v[k] = cr(get(i - 1, k), get(i, k), get(i + 1, k), get(i + 2, k), t);
    for (let j = 0; j < segs; j++) {
      const th = j / segs * TAU, c = Math.cos(th), sn = Math.sin(th);
      pos.push(v.cx + v.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / pw), v.y, v.cz + v.b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / pw));
    }
  }
  for (let r = 0; r < rings; r++) for (let j = 0; j < segs; j++) {
    const a = r * segs + j, b = r * segs + (j + 1) % segs, c = (r + 1) * segs + j, d = (r + 1) * segs + (j + 1) % segs; idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // проверка направления нормалей (наружу)
  const nA = g.attributes.normal, pA = g.attributes.position, ci = (rings >> 1) * segs; let sum = 0;
  for (let j = 0; j < segs; j++) { const vi = ci + j; sum += nA.getX(vi) * pA.getX(vi) + nA.getZ(vi) * pA.getZ(vi); }
  if (sum < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
  return g;
}

/* ---------- цепочка Верле (мировое пространство) ---------- */
export class Chain {
  constructor(n) { this.n = n; this.p = Array.from({ length: n }, () => new THREE.Vector3()); this.q = Array.from({ length: n }, () => new THREE.Vector3()); this.init = false; this.len = []; }
  step(rest, stiff, grav, damp, cols = null, colFrom = 2) {
    const p = this.p, q = this.q, n = this.n;
    if (!this.init) { for (let i = 0; i < n; i++) { p[i].copy(rest[i]); q[i].copy(rest[i]); if (i) this.len[i] = rest[i].distanceTo(rest[i - 1]); } this.init = true; return; }
    p[0].copy(rest[0]); q[0].copy(rest[0]);
    for (let i = 1; i < n; i++) {
      const v = _d.copy(p[i]).sub(q[i]).multiplyScalar(damp); q[i].copy(p[i]); p[i].add(v); p[i].y -= grav; p[i].lerp(rest[i], stiff[i]);
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < n; i++) {
        const a = p[i - 1], b = p[i]; _d.copy(b).sub(a); const d = _d.length() || 1e-6, e = (d - this.len[i]) / d;
        if (i === 1) b.addScaledVector(_d, -e); else { a.addScaledVector(_d, e * .5); b.addScaledVector(_d, -e * .5); }
      }
      if (cols) for (let i = colFrom; i < n; i++) for (const c of cols) {
        _d.copy(p[i]).sub(c.c); const l = _d.length(); if (l < c.r && l > 1e-6) p[i].copy(c.c).addScaledVector(_d, c.r / l);
      }
    }
  }
}
