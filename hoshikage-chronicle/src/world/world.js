import * as THREE from 'three';
import { MapBuilder } from './mapbuilder.js';
import { damp } from '../core/util.js';

export const MOODS = {
  day:    { bg: 0xc4e6f7, fog: [0xc4e6f7, 34, 80], hemi: [0xe8f6ff, 0x8a9a62, 1.35], sun: [0xfff0d2, 2.3], dir: [-0.5, 0.8, 0.6], grade: { tint: 0xffffff, sat: 1.12, vig: 0.26 }, sprite: 0xffffff },
  forest: { bg: 0xa9d0bf, fog: [0xa9d0bf, 18, 52], hemi: [0xd8f2e0, 0x4d6a45, 1.15], sun: [0xf4f0c8, 1.7], dir: [-0.4, 0.8, 0.5], grade: { tint: 0xf4fff4, sat: 1.1, vig: 0.38 }, sprite: 0xf4fff0 },
  dusk:   { bg: 0xf0b48a, fog: [0xf0b48a, 24, 64], hemi: [0xffd9b8, 0x7a5a6a, 1.1], sun: [0xffb070, 2.2], dir: [-0.8, 0.45, 0.4], grade: { tint: 0xfff0e4, sat: 1.15, vig: 0.34 }, sprite: 0xffeede },
  night:  { bg: 0x0e1534, fog: [0x0e1534, 16, 46], hemi: [0x8ea2ff, 0x1c2240, 0.85], sun: [0x9db8ff, 1.1], dir: [-0.5, 0.9, 0.4], grade: { tint: 0xc8d4ff, sat: 1.0, vig: 0.5 }, sprite: 0xaebdf0 },
  shrine: { bg: 0xcdbfc9, fog: [0xcdbfc9, 20, 54], hemi: [0xf1e4f4, 0x7d6a78, 1.1], sun: [0xffe2e0, 1.6], dir: [-0.4, 0.7, 0.6], grade: { tint: 0xfff0f6, sat: 1.0, vig: 0.4 }, sprite: 0xf6e8f0 },
  port:   { bg: 0xaedcf2, fog: [0xaedcf2, 34, 84], hemi: [0xeaf8ff, 0x7aa3a8, 1.35], sun: [0xfff4dc, 2.4], dir: [-0.6, 0.85, 0.5], grade: { tint: 0xffffff, sat: 1.15, vig: 0.26 }, sprite: 0xffffff },
  cave:   { bg: 0x0a0f1c, fog: [0x0a0f1c, 10, 38], hemi: [0x9ab0f0, 0x2a3060, 1.7], sun: [0x9ab0ff, 1.0], dir: [-0.3, 1, 0.3], grade: { tint: 0xb8c8ff, sat: 1.05, vig: 0.62 }, sprite: 0xa8b8e8 },
  castle: { bg: 0x120a1e, fog: [0x120a1e, 12, 40], hemi: [0xc0a8f0, 0x34244a, 1.45], sun: [0xb4a0f0, 0.9], dir: [-0.3, 1, 0.5], grade: { tint: 0xd6c8ff, sat: 1.05, vig: 0.58 }, sprite: 0xc2b4ec },
  indoor: { bg: 0x161018, fog: [0x161018, 16, 40], hemi: [0xffe8d0, 0x6a5040, 1.5], sun: [0xffe0b8, 1.1], dir: [-0.2, 1, 0.8], grade: { tint: 0xfff2e2, sat: 1.1, vig: 0.5 }, sprite: 0xfff0e0 },
};

export class World {
  constructor(gfx) {
    this.gfx = gfx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 260);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888866, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.pool = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); this.scene.add(l); this.pool.push(l); }
    this.mapGroup = null;
    this.builder = null;
    this.pitch = 0.76; this.dist = 14.5; this.yaw = 0; this.lookUp = 0;
    this.thirdDefault = false;      // field worlds: third-person orbit camera; the title screen keeps the cinematic orbit
    this.third = false;
    this.camDist = 6;               // collision-adjusted distance actually used
    this.zoomK = 1;                 // player zoom (mouse wheel)
    this.focus = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.mood = MOODS.day;
    this.time = 0;
    this.shake = 0;
  }
  /** stars + moon dome for night scenes (plain additive geometry, no textures) */
  _sky(on) {
    if (this.sky) { this.scene.remove(this.sky); this.sky.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.sky = null; this.moon = null; }
    if (!on) return;
    const g = new THREE.Group();
    const starGeo = new THREE.SphereGeometry(0.22, 4, 3);
    const sm = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false });
    const inst = new THREE.InstancedMesh(starGeo, sm, 170);
    const m4 = new THREE.Matrix4(), rnd = (() => { let a = 77; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < 170; i++) {
      const th = rnd() * Math.PI * 2, ph = 0.12 + rnd() * 1.2, r = 90;
      m4.makeScale(0.5 + rnd() * 1.2, 0.5 + rnd() * 1.2, 0.5 + rnd() * 1.2).setPosition(Math.cos(th) * Math.cos(ph) * r, Math.sin(ph) * r * 0.9 + 6, Math.sin(th) * Math.cos(ph) * r);
      inst.setMatrixAt(i, m4);
    }
    g.add(inst);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(5.5, 32, 20), new THREE.MeshBasicMaterial({ color: 0xf2f6ff, fog: false }));
    moon.position.set(8, 26, -62); g.add(moon);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(8.5, 24, 16), new THREE.MeshBasicMaterial({ color: 0x8fa8ff, transparent: true, opacity: 0.16, depthWrite: false, fog: false }));
    halo.position.copy(moon.position); g.add(halo);
    this.moon = moon; this.halo = halo; this.sky = g;
    this.scene.add(g);
  }
  setMood(name) {
    const m = (this.moodName = name, MOODS[name] || MOODS.day);
    this._sky(name === 'night');
    this.mood = m;
    this.scene.background = new THREE.Color(m.bg);
    this.scene.fog = new THREE.Fog(m.fog[0], m.fog[1], m.fog[2]);
    this.hemi.color.set(m.hemi[0]); this.hemi.groundColor.set(m.hemi[1]); this.hemi.intensity = m.hemi[2];
    this.sun.color.set(m.sun[0]); this.sun.intensity = m.sun[1];
    this.sunDir = new THREE.Vector3(...m.dir).normalize();
    this.gfx.setGrade({ ...m.grade, focus: 0.5, band: 0.2, amount: 1.5 });
  }
  /** build the static scene of a map definition; returns the builder (collision grid etc.) */
  async load(def) {
    if (this.mapGroup) { this.scene.remove(this.mapGroup); this._dispose(this.mapGroup); }
    this.setMood(def.mood || 'day');
    this.third = this.thirdDefault && def.third !== false;
    if (this.third) {
      const indoor = (def.mood || 'day') === 'indoor';
      this.pitch = def.tpPitch ?? (indoor ? 0.44 : 0.34); this.dist = def.tpDist ?? (indoor ? 4.8 : 7.0);
      this.camera.fov = 56;
      this.baseCam = { pitch: this.pitch, dist: this.dist };
    } else { this.pitch = def.pitch || 0.76; this.dist = def.dist || 14.5; this.camera.fov = 30; }
    this.camera.updateProjectionMatrix();
    this.lookUp = 0; this.yaw = 0; this.zoomK = 1;
    const b = new MapBuilder(def);
    def.build(b);
    await b.finalize();
    this.scene.add(b.group);
    this.mapGroup = b.group;
    this.builder = b;
    return b;
  }
  _dispose(g) {
    g.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); });
  }
  /** how far the third-person camera can back away from (x,y,z) along (dx,dy,dz) before it would sit inside a wall / tree */
  _clearDist(x, y, z, dx, dy, dz, want) {
    const b = this.builder;
    if (!b || !b.hgt) return want;
    const MIN = 1.6;
    for (let t = 0.5; t <= want; t += 0.35) {
      const px = x + dx * t, py = y + dy * t, pz = z + dz * t;
      const cx = Math.floor(px), cz = Math.floor(pz);
      if (cx < 0 || cz < 0 || cx >= b.w || cz >= b.h) continue;
      if (b.hgt[cz * b.w + cx] > py - 0.2) return Math.max(MIN, t - 0.45);
    }
    return want;
  }
  add(o) { this.scene.add(o); }
  remove(o) { this.scene.remove(o); }
  setFocus(v, snap = false) {
    if (snap) this.camTarget.copy(v);
    this.focus.copy(v);
  }
  update(dt) {
    this.time += dt;
    const b = this.builder;
    if (b) {
      b.update(this.time);
      const cand = b.lights.map((l) => ({ l, d: (l.x - this.focus.x) ** 2 + (l.z - this.focus.z) ** 2 })).sort((a, c) => a.d - c.d);
      this.pool.forEach((p, i) => {
        const c = cand[i];
        if (!c) { p.intensity = 0; return; }
        const l = c.l;
        const fl = l.flicker ? 1 + Math.sin(this.time * 11 + l.phase) * l.flicker * 0.4 + Math.sin(this.time * 23 + l.phase * 2) * l.flicker * 0.3 : 1;
        p.position.set(l.x, l.y, l.z);
        p.color.set(l.color);
        p.distance = l.dist;
        p.intensity = l.intensity * fl * 2.2;
      });
    }
    // camera
    const k = this.third ? 14 : 6;
    this.camTarget.x = damp(this.camTarget.x, this.focus.x, k, dt);
    this.camTarget.y = damp(this.camTarget.y, this.focus.y, k, dt);
    this.camTarget.z = damp(this.camTarget.z, this.focus.z, k, dt);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    if (this.third) {
      // third-person: orbit around the character's shoulders; pull in when a wall / tree is in the way
      const th = this.camTarget.y + 1.45;
      const dx = Math.sin(this.yaw) * cp, dy = sp, dz = Math.cos(this.yaw) * cp;
      const want = this.dist * this.zoomK;
      const free = this._clearDist(this.camTarget.x, th, this.camTarget.z, dx, dy, dz, want);
      this.camDist = free < this.camDist ? free : damp(this.camDist, free, 5, dt);
      this.camera.position.set(this.camTarget.x + dx * this.camDist + sx, th + dy * this.camDist + sy, this.camTarget.z + dz * this.camDist);
      this.camera.lookAt(this.camTarget.x, th + 0.12 + this.lookUp - sp * 0.6, this.camTarget.z);
    } else {
      this.camera.position.set(this.camTarget.x + sx + Math.sin(this.yaw) * cp * this.dist, this.camTarget.y + sp * this.dist + sy, this.camTarget.z + Math.cos(this.yaw) * cp * this.dist);
      this.camera.lookAt(this.camTarget.x, this.camTarget.y + 0.9 + this.lookUp, this.camTarget.z);
    }
    if (this.sky) this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
    // sun follows the focus so the shadow box stays on screen
    this.sun.position.copy(this.camTarget).addScaledVector(this.sunDir, 36);
    this.sun.target.position.copy(this.camTarget);
  }
}
