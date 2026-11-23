// Builds a 3D area from a small imperative description. Everything visible is either a CC0 3D prop (instanced),
// or geometry textured with one of the real surface images (grass/stone/wood/...). Also owns the collision grid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { model, surface, tiled } from '../core/assets.js';
import { mulberry32 } from '../core/util.js';

const MODEL_SCALE = {
  tree_oak: 2.7, tree_pine: 2.9, tree_pine_tall: 3.1, tree_autumn: 2.6, tree_dark: 2.6, tree_fat: 2.8, tree_palm: 2.7,
  bush: 2.4, bush_large: 3, rock_large: 2.8, rock_small: 2.6, rock_tall: 2.8, log: 2.3, stump: 2.5, flower_red: 2.8,
  mushroom_red: 3.2, pumpkin: 2.1, fence: 1.5, tent: 3.4, campfire: 2.7, crate: 2.3, barrel: 2.1, barrels: 2.0,
  chest: 0.8, column: 3.7, column_broken: 3.7, obelisk: 4, crystal: 1.9, crystal_rock: 2.5, gem_pink: 1.3, fish: 2.2,
  cargo_ship: 6.5,
};

/** BoxGeometry whose UVs are scaled to world size so a surface texture keeps a constant density. */
function boxGeo(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order in BoxGeometry: +x, -x, +y, -y, +z, -z, 4 verts each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  }
  return g;
}

/** Gable roof (ridge along X) + gable end triangles; returns {roof, gable} geometries centred on x/z, base at y=0. */
function roofGeo(w, d, rise, oh, tile) {
  const x0 = -w / 2 - oh * 0.6, x1 = w / 2 + oh * 0.6;
  const zE = d / 2 + oh, yE = -rise * (oh / (d / 2));
  const pos = [], uv = [];
  const slopeLen = Math.hypot(zE, rise - yE);
  const quad = (a, b, c, e) => { pos.push(...a, ...b, ...c, ...a, ...c, ...e); };
  // front slope (+z) and back slope (-z)
  quad([x0, yE, zE], [x1, yE, zE], [x1, rise, 0], [x0, rise, 0]);
  quad([x1, yE, -zE], [x0, yE, -zE], [x0, rise, 0], [x1, rise, 0]);
  const U = (x1 - x0) / tile, V = slopeLen / tile;
  for (let k = 0; k < 2; k++) uv.push(0, 0, U, 0, U, V, 0, 0, U, V, 0, V);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const gp = [], gu = [];
  for (const [x, s] of [[-w / 2, -1], [w / 2, 1]]) {
    gp.push(x, 0, -d / 2 * s, x, 0, d / 2 * s, x, rise * 0.98, 0);
    gu.push(0, 0, d / tile, 0, d / 2 / tile, rise / tile);
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gg.setAttribute('uv', new THREE.Float32BufferAttribute(gu, 2));
  gg.computeVertexNormals();
  return { roof: g, gable: gg };
}

export class MapBuilder {
  constructor(def) {
    this.def = def;
    this.w = def.size[0];
    this.h = def.size[1];
    this.group = new THREE.Group();
    this.blocked = new Uint8Array(this.w * this.h);
    this.reserved = new Uint8Array(this.w * this.h);
    this.rng = mulberry32(def.seed || 7);
    this.boxes = new Map(); // material key -> {mat, geos[]}
    this.placements = new Map(); // model -> matrices[]
    this.lights = []; // {x,y,z,color,intensity,dist,flicker,phase}
    this.updaters = [];
    this.waters = [];
    this.matCache = new Map();
    this.bright = def.bright ?? 1.75; // the surface textures are dull grey tiles; lift them so tints read as painted colour
  }
  _col(tint, k = 1) { return new THREE.Color(tint).multiplyScalar(this.bright * k); }

  // ---------------- collision / reservation
  inb(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h; }
  isBlocked(cx, cz) { return !this.inb(cx, cz) || this.blocked[cz * this.w + cx] === 1; }
  solid(x, z, w = 1, d = 1) {
    for (let cz = Math.floor(z); cz < Math.ceil(z + d - 1e-6); cz++) for (let cx = Math.floor(x); cx < Math.ceil(x + w - 1e-6); cx++) if (this.inb(cx, cz)) this.blocked[cz * this.w + cx] = 1;
  }
  free(x, z, w = 1, d = 1) {
    for (let cz = Math.floor(z); cz < Math.ceil(z + d - 1e-6); cz++) for (let cx = Math.floor(x); cx < Math.ceil(x + w - 1e-6); cx++) if (this.inb(cx, cz)) this.blocked[cz * this.w + cx] = 0;
  }
  reserve(x, z, w = 1, d = 1) {
    for (let cz = Math.floor(z); cz < Math.ceil(z + d - 1e-6); cz++) for (let cx = Math.floor(x); cx < Math.ceil(x + w - 1e-6); cx++) if (this.inb(cx, cz)) this.reserved[cz * this.w + cx] = 1;
  }
  isReserved(cx, cz) { return !this.inb(cx, cz) || this.reserved[cz * this.w + cx] === 1; }
  canPlace(x, z) { const cx = Math.floor(x), cz = Math.floor(z); return this.inb(cx, cz) && !this.blocked[cz * this.w + cx] && !this.reserved[cz * this.w + cx]; }

  // ---------------- materials
  _mat(texName, tint = 0xffffff, opts = {}) {
    const key = `${texName}|${tint}|${opts.double ? 'd' : 's'}|${opts.emissive || 0}|${opts.opacity || 1}`;
    if (this.matCache.has(key)) return this.matCache.get(key);
    const m = new THREE.MeshToonMaterial({ map: texName ? surface(texName) : null, color: this._col(tint), side: opts.double ? THREE.DoubleSide : THREE.FrontSide });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
    if (opts.opacity !== undefined && opts.opacity < 1) { m.transparent = true; m.opacity = opts.opacity; }
    this.matCache.set(key, m);
    return m;
  }
  _addGeo(geo, texName, tint, opts) {
    const m = this._mat(texName, tint, opts);
    if (!this.boxes.has(m)) this.boxes.set(m, { mat: m, geos: [] });
    this.boxes.get(m).geos.push(geo);
  }

  // ---------------- surfaces
  ground(tex, { tint = 0xffffff, tile = 2.4, margin = 40 } = {}) {
    const W = this.w + margin * 2, H = this.h + margin * 2;
    const g = new THREE.PlaneGeometry(W, H);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshToonMaterial({ map: tiled(surface(tex), W / tile, H / tile), color: this._col(tint) });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(this.w / 2, 0, this.h / 2);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
  patch(tex, x, z, w, d, { tint = 0xffffff, tile = 2, y = 0.012 } = {}) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshToonMaterial({ map: tiled(surface(tex), w / tile, d / tile), color: this._col(tint), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x + w / 2, y, z + d / 2);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
  /** polyline made of axis-aligned segments, `width` cells wide */
  path(points, width, tex = 'dirt', opts = {}) {
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z0 = Math.min(az, bz), z1 = Math.max(az, bz);
      const hw = width / 2;
      const px = x0 - hw + 0.5, pz = z0 - hw + 0.5, pw = x1 - x0 + width, pd = z1 - z0 + width;
      this.patch(tex, px, pz, pw, pd, { ...opts, y: 0.012 + (opts.y || 0) });
      this.reserve(Math.floor(px), Math.floor(pz), Math.ceil(pw), Math.ceil(pd));
    }
  }
  water(x, z, w, d, { color = 0x3d8fc4, opacity = 0.82, y = -0.04, blockedCells = true } = {}) {
    const g = new THREE.PlaneGeometry(w, d, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.25, metalness: 0.1, emissive: color, emissiveIntensity: 0.18 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x + w / 2, y, z + d / 2);
    this.group.add(mesh);
    this.waters.push(mesh);
    if (blockedCells) this.solid(x, z, w, d);
    return mesh;
  }

  // ---------------- solid geometry
  /** textured box; (x,z) = north-west corner in cells */
  box(x, z, w, d, h, { tex = 'stone', y = 0, tint = 0xffffff, tile = 2, solid = true, emissive = 0, opacity = 1 } = {}) {
    const g = boxGeo(w, h, d, tile);
    g.translate(x + w / 2, y + h / 2, z + d / 2);
    this._addGeo(g, tex, tint, { emissive, opacity });
    if (solid) this.solid(x, z, w, d);
  }
  /** flat coloured box without texture (windows, flames, crystals ...) */
  glow(x, y, z, w, h, d, color, { opacity = 1 } = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, fog: true });
    const mesh = new THREE.Mesh(g, m);
    this.group.add(mesh);
    return mesh;
  }
  gableRoof(x, z, w, d, baseY, rise, { tex = 'wood', tint = 0xb5473a, gableTex = 'concrete', gableTint = 0xf0e6d0, tile = 1.6, oh = 0.55 } = {}) {
    const alongX = w >= d;
    const W = alongX ? w : d, D = alongX ? d : w;
    const { roof, gable } = roofGeo(W, D, rise, oh, tile);
    for (const g of [roof, gable]) {
      if (!alongX) g.rotateY(Math.PI / 2);
      g.translate(x + w / 2, baseY, z + d / 2);
    }
    this._addGeo(roof, tex, tint, { double: true });
    this._addGeo(gable, gableTex, gableTint, { double: true });
  }
  /** a small cottage / building. Returns the door cell. */
  house({ x, z, w, d, h = 2.7, wall = 'concrete', wallTint = 0xf6ecd6, roof = 'wood', roofTint = 0xb5473a, rise = 1.7, doorAt, lit = true, door = true, base = true }) {
    this.box(x, z, w, d, h, { tex: wall, tint: wallTint, tile: 2.4 });
    if (base) this.box(x - 0.05, z - 0.05, w + 0.1, d + 0.1, 0.45, { tex: 'stone', tint: 0xb8b4c2, solid: false, tile: 2 });
    this.gableRoof(x, z, w, d, h, rise, { tint: roofTint });
    const dx = doorAt !== undefined ? doorAt : Math.floor(w / 2);
    const doorCell = [Math.floor(x + dx), Math.floor(z + d)];
    if (door) {
      this.box(x + dx + 0.12, z + d - 0.02, 0.76, 0.06, 1.7, { tex: 'wood', tint: 0x8a5a3a, solid: false, tile: 1.2 });
      this.box(x + dx + 0.05, z + d - 0.04, 0.9, 0.05, 1.82, { tex: 'wood', tint: 0x3b2a22, solid: false, tile: 1.2 });
    }
    if (lit) {
      for (let wx = 1; wx < w - 0.5; wx += 2) {
        if (Math.floor(x + wx) === Math.floor(x + dx)) continue;
        this.glow(x + wx + 0.5, 1.5, z + d + 0.02, 0.55, 0.55, 0.05, 0xffd98a);
        this.glow(x + wx + 0.5, 1.5, z + d + 0.01, 0.7, 0.7, 0.04, 0x4a3326);
      }
    }
    this.reserve(Math.floor(x) - 1, Math.floor(z) - 1, Math.ceil(w) + 2, Math.ceil(d) + 3);
    this.reserve(doorCell[0] - 1, doorCell[1], 3, 2);
    return { doorCell, doorX: x + dx + 0.5, doorZ: z + d };
  }
  /** red torii gate */
  torii(x, z, { w = 4.2, h = 3.1, tint = 0xc13a2c } = {}) {
    const t = 0.34;
    this.box(x - w / 2, z, t, t, h, { tex: 'wood', tint, solid: false, tile: 1 });
    this.box(x + w / 2 - t, z, t, t, h, { tex: 'wood', tint, solid: false, tile: 1 });
    this.box(x - w / 2 - 0.5, z - 0.05, w + 1, 0.42, 0.36, { tex: 'wood', tint, y: h - 0.2, solid: false, tile: 1 });
    this.box(x - w / 2 + 0.2, z, w - 0.4, 0.28, 0.26, { tex: 'wood', tint, y: h - 0.95, solid: false, tile: 1 });
    this.box(x - w / 2 - 0.6, z - 0.08, w + 1.2, 0.5, 0.18, { tex: 'wood', tint: 0x2b2325, y: h + 0.16, solid: false, tile: 1 });
    this.solid(x - w / 2, z, 1, 1);
    this.solid(x + w / 2 - 1, z, 1, 1);
  }
  stairs(x, z, w, steps, { tex = 'stone', tint = 0xb9b6c8, dir = 'north', stepH = 0.22, depth = 0.7 } = {}) {
    for (let i = 0; i < steps; i++) {
      const zz = dir === 'north' ? z - i * depth : z + i * depth;
      this.box(x, zz, w, depth, stepH * (steps - i), { tex, tint, solid: false, tile: 1.4 });
    }
  }

  // ---------------- props (instanced)
  prop(name, x, z, { s = 1, ry = null, y = 0, solid = 0, tintScale = 1 } = {}) {
    const m = new THREE.Matrix4();
    const rot = ry === null ? this.rng() * Math.PI * 2 : ry;
    const sc = (MODEL_SCALE[name] || 1) * s * (1 + (this.rng() - 0.5) * 0.12 * tintScale);
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(sc, sc, sc));
    if (!this.placements.has(name)) this.placements.set(name, []);
    this.placements.get(name).push(m);
    if (solid > 0) this.solid(x - solid, z - solid, solid * 2, solid * 2);
  }
  /** random props inside a rectangle of cells (never on reserved/blocked cells) */
  scatter(names, rect, count, { solid = 0, s = 1, minDist = 0.9, tries = 12, ry = null } = {}) {
    const [rx, rz, rw, rd] = rect;
    const placed = [];
    let n = 0;
    for (let i = 0; i < count * tries && n < count; i++) {
      const x = rx + this.rng() * rw, z = rz + this.rng() * rd;
      if (!this.canPlace(x, z)) continue;
      if (placed.some((p) => (p[0] - x) ** 2 + (p[1] - z) ** 2 < minDist * minDist)) continue;
      placed.push([x, z]);
      const name = names[Math.floor(this.rng() * names.length)];
      this.prop(name, x, z, { solid, s: s * (0.85 + this.rng() * 0.4), ry });
      n++;
    }
    return n;
  }
  /** dense wall of trees around the map edge (blocked) */
  forestEdge(names, thick = 3, { gapRects = [] } = {}) {
    for (let cz = -2; cz < this.h + 2; cz++) {
      for (let cx = -2; cx < this.w + 2; cx++) {
        const dEdge = Math.min(cx, cz, this.w - 1 - cx, this.h - 1 - cz);
        if (dEdge >= thick) continue;
        if (gapRects.some(([gx, gz, gw, gd]) => cx >= gx && cx < gx + gw && cz >= gz && cz < gz + gd)) continue;
        if (dEdge >= 1 && this.rng() < 0.18 * dEdge) continue;
        // the camera sits to the south: keep the near edge low so it never hides the party
        const south = cz >= this.h - thick;
        const pool = south ? ['bush_large', 'bush_large', 'rock_large', 'bush', 'flower_red'] : names;
        const name = pool[Math.floor(this.rng() * pool.length)];
        this.prop(name, cx + 0.5 + (this.rng() - 0.5) * 0.7, cz + 0.5 + (this.rng() - 0.5) * 0.7, { s: south ? 0.9 + this.rng() * 0.4 : 0.95 + this.rng() * 0.5 });
        if (this.inb(cx, cz)) this.blocked[cz * this.w + cx] = 1;
      }
    }
  }
  fence(x0, z0, x1, z1, { gap = [] } = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(len / 1.5);
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (gap.some(([gx, gz]) => Math.abs(gx - x) < 1.1 && Math.abs(gz - z) < 1.1)) continue;
      this.prop('fence', x, z, { ry: alongX ? 0 : Math.PI / 2, s: 1 });
      this.solid(x - 0.5, z - 0.5, 1, 1);
    }
  }

  /** build walls from a '#'/'.' grid (dungeons). Merges runs into boxes. Returns nothing; collision is updated. */
  ascii(rows, { x = 0, z = 0, tex = 'stone', tint = 0x8890b0, h = 1.9, tile = 2, topTex = null } = {}) {
    for (let j = 0; j < rows.length; j++) {
      let i = 0;
      const row = rows[j];
      while (i < row.length) {
        if (row[i] !== '#') { i++; continue; }
        let k = i;
        while (k < row.length && row[k] === '#') k++;
        // only build geometry for walls that touch a floor cell (the rest is never seen)
        let touch = false;
        for (let a = i; a < k && !touch; a++) for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const r = rows[j + dz]; if (r && r[a + dx] === '.') { touch = true; break; } }
        this.solid(x + i, z + j, k - i, 1);
        if (touch) this.box(x + i, z + j, k - i, 1, h, { tex, tint, tile, solid: false });
        i = k;
      }
    }
    // decorative solid crystals
    let n = 0;
    const cols = [0x6fe8ff, 0xb08aff, 0x7affd0, 0x6fe8ff];
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === 'c') {
      this.solid(x + i, z + j, 1, 1);
      this.glowCrystal(x + i + 0.5, z + j + 0.5, { color: cols[n % cols.length], s: 0.7 + this.rng() * 0.7, lightOn: n % 5 === 0 }); n++;
    }
    // floor cells are walkable; everything outside the grid is blocked by the map bounds
  }

  // ---------------- light & fx
  light(x, y, z, color = 0xffaa55, intensity = 2.2, dist = 9, { flicker = 0 } = {}) {
    this.lights.push({ x, y, z, color, intensity, dist, flicker, phase: this.rng() * 10 });
  }
  /** campfire / brazier with animated flame cones and a light */
  fire(x, z, { scale = 1, model: withModel = true, color = 0xff8a2a, light = true, y = 0 } = {}) {
    if (withModel) this.prop('campfire', x, z, { ry: 0, y });
    const cone = (r, h, col, op) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.position.set(x, y + h / 2 + 0.12, z);
      this.group.add(m);
      return m;
    };
    const a = cone(0.2 * scale, 0.62 * scale, color, 0.7), b = cone(0.11 * scale, 0.42 * scale, 0xffe39a, 0.8);
    const ph = this.rng() * 9;
    this.updaters.push((t) => {
      const f = 1 + Math.sin(t * 13 + ph) * 0.12 + Math.sin(t * 7.3 + ph) * 0.08;
      a.scale.set(1, f, 1); b.scale.set(1, 1.1 - (f - 1), 1);
      a.rotation.y = t * 2; b.rotation.y = -t * 3;
    });
    if (light) this.light(x, y + 1.1, z, color, 3.4, 11, { flicker: 0.35 });
  }
  /** glowing crystal cluster with light */
  glowCrystal(x, z, { color = 0x6fe8ff, s = 1, lightOn = true } = {}) {
    s *= 0.62;
    this.prop('crystal', x, z, { s, ry: this.rng() * 6 });
    if (lightOn) this.light(x, 1.2 * s, z, color, 2.2, 8, { flicker: 0.1 });
  }

  // ---------------- finalize
  async finalize() {
    for (const { mat, geos } of this.boxes.values()) {
      const merged = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.boxes.clear();
    for (const [name, mats] of this.placements) {
      const src = model(name);
      src.updateMatrixWorld(true);
      const meshes = [];
      src.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const sm of meshes) {
        const im = new THREE.InstancedMesh(sm.geometry, sm.material, mats.length);
        const local = sm.matrixWorld.clone();
        const tmp = new THREE.Matrix4();
        mats.forEach((pm, i) => im.setMatrixAt(i, tmp.multiplyMatrices(pm, local)));
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = true; im.receiveShadow = true;
        im.frustumCulled = false;
        this.group.add(im);
      }
    }
    this.placements.clear();
    return this;
  }
  update(t) {
    for (const u of this.updaters) u(t);
    for (const w of this.waters) w.position.y = -0.04 + Math.sin(t * 1.3 + w.position.x) * 0.012;
  }
}
