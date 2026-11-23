// Battle visual effects built from additive geometry (no textures): slashes, bolts, rings, sparks, beams.
import * as THREE from 'three';
import { tween, easeOut } from '../core/util.js';

const sphere = new THREE.SphereGeometry(1, 8, 6);
const box = new THREE.BoxGeometry(1, 1, 1);
const cone = new THREE.ConeGeometry(0.5, 1, 6);
const ring = new THREE.RingGeometry(0.82, 1, 40);
ring.rotateX(-Math.PI / 2);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);

const mats = new Map();
function mat(color, opacity = 1) {
  const k = color + '|' + opacity;
  if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  return mats.get(k);
}
const own = (color, opacity) => { const m = mat(color, opacity).clone(); return m; };

export class FX {
  constructor(world) {
    this.world = world; this.scene = world.scene;
    this.parts = [];
    this.lamp = new THREE.PointLight(0xffffff, 0, 14, 1.4);
    this.scene.add(this.lamp);
    this.lightT = 0;
  }
  add(o) { this.scene.add(o); return o; }
  remove(o) { this.scene.remove(o); if (o.material && o.material.dispose && o.userData.own) o.material.dispose(); }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t < 0) { p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      if (p.t >= p.life) { this.remove(p.mesh); this.parts.splice(i, 1); continue; }
      const k = p.t / p.life;
      p.mesh.position.x += p.vel.x * dt; p.mesh.position.y += p.vel.y * dt; p.mesh.position.z += p.vel.z * dt;
      p.vel.y -= p.grav * dt;
      const s = p.size * (p.shrink ? 1 - k : 1 + (p.grow || 0) * k);
      p.mesh.scale.setScalar(Math.max(0.001, s));
      p.mesh.material.opacity = p.op * (1 - k * k);
    }
    if (this.lightT > 0) { this.lightT -= dt; this.lamp.intensity = Math.max(0, this.lamp.intensity - dt * 90); }
  }
  flash(pos, color = 0xffffff, power = 40) { this.lamp.position.copy(pos); this.lamp.color.set(color); this.lamp.intensity = power; this.lightT = 0.3; }
  spark(pos, color = 0xffe08a, n = 14, speed = 4, size = 0.09, life = 0.6, grav = 6) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sphere, own(color, 1)); m.userData.own = true;
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.1;
      const v = new THREE.Vector3(Math.cos(a) * speed * (0.3 + Math.random()), e * speed * 0.6 * Math.random() + 1, Math.sin(a) * speed * (0.3 + Math.random()));
      this.add(m);
      this.parts.push({ mesh: m, vel: v, t: 0, life: life * (0.6 + Math.random() * 0.6), grav, size: size * (0.6 + Math.random() * 0.8), shrink: true, op: 1 });
    }
  }
  rise(pos, color, n = 16, spread = 0.9, size = 0.08, life = 1.1) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sphere, own(color, 1)); m.userData.own = true;
      m.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * spread);
      this.add(m);
      this.parts.push({ mesh: m, vel: new THREE.Vector3(0, 1.2 + Math.random() * 1.4, 0), t: -Math.random() * 0.4, life, grav: 0, size: size * (0.6 + Math.random()), shrink: true, op: 1 });
    }
  }
  async ring(pos, color, r0 = 0.2, r1 = 2.2, ms = 450, y = 0.06, thick = 1) {
    const m = new THREE.Mesh(ring, own(color, 0.95)); m.userData.own = true;
    m.position.set(pos.x, y, pos.z); this.add(m);
    await tween(ms, (t) => { const k = easeOut(t); m.scale.setScalar(r0 + (r1 - r0) * k); m.material.opacity = 0.95 * (1 - t); });
    this.remove(m);
  }
  async vring(pos, color, ms = 600, rise = 2.2, r = 0.8) { // rising ring (buffs)
    const m = new THREE.Mesh(ring, own(color, 0.9)); m.userData.own = true;
    m.position.set(pos.x, 0.1, pos.z); m.scale.setScalar(r); this.add(m);
    await tween(ms, (t) => { m.position.y = 0.1 + rise * easeOut(t); m.material.opacity = 0.9 * (1 - t); });
    this.remove(m);
  }
  async slash(pos, color = 0xfff2c0, big = false, angle = 0.8) {
    const g = new THREE.Group(); g.position.copy(pos);
    const s = big ? 3.2 : 2.0;
    const m = new THREE.Mesh(box, own(color, 1)); m.userData.own = true;
    m.scale.set(s, 0.07, 0.07); m.rotation.z = angle; g.add(m);
    const m2 = m.clone(); m2.material = own(0xffffff, 1); m2.userData.own = true; m2.scale.set(s * 0.8, 0.03, 0.04); g.add(m2);
    this.add(g);
    this.spark(pos, color, big ? 18 : 9, 4.5, 0.08, 0.5);
    await tween(220, (t) => { const k = easeOut(t); g.scale.set(0.2 + k * 0.9, 1 + k * 3, 1); m.material.opacity = 1 - t * t; m2.material.opacity = 1 - t; });
    this.remove(g); m.material.dispose(); m2.material.dispose();
  }
  async impact(pos, color = 0xffd9a0, big = false) {
    this.flash(pos, color, big ? 60 : 30);
    this.spark(pos, color, big ? 20 : 11, 5, 0.1, 0.5);
    await this.ring(pos, color, 0.2, big ? 3 : 1.7, 360, pos.y);
  }
  async arrow(from, to, color = 0xffffff) {
    const m = new THREE.Mesh(box, own(color, 1)); m.userData.own = true; m.scale.set(0.9, 0.05, 0.05);
    this.add(m);
    const dir = new THREE.Vector3().subVectors(to, from);
    m.rotation.z = Math.atan2(dir.y, dir.x) + (dir.x < 0 ? Math.PI : 0);
    if (dir.x < 0) m.rotation.y = Math.PI * 0;
    const len = dir.length(), ms = Math.max(160, len * 28);
    await tween(ms, (t) => { m.position.lerpVectors(from, to, t); });
    this.remove(m);
    this.spark(to, color, 8, 3.5, 0.07, 0.4);
  }
  async bolt(to, color = 0xffec6a, big = false) {
    const g = new THREE.Group();
    const top = 11;
    let p = new THREE.Vector3(to.x + (Math.random() - 0.5) * 2, top, to.z + (Math.random() - 0.5) * 1);
    const segs = 9;
    for (let i = 0; i < segs; i++) {
      const t1 = (i + 1) / segs;
      const q = i === segs - 1 ? to.clone() : new THREE.Vector3(to.x + (Math.random() - 0.5) * 1.6 * (1 - t1), top + (to.y - top) * t1, to.z + (Math.random() - 0.5) * 0.6);
      const len = p.distanceTo(q);
      const m = new THREE.Mesh(box, own(color, 1)); m.userData.own = true;
      m.position.copy(p).add(q).multiplyScalar(0.5);
      m.scale.set(big ? 0.14 : 0.09, len, big ? 0.14 : 0.09);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(q, p).normalize());
      g.add(m); p = q;
    }
    this.add(g);
    this.flash(to, color, 80);
    this.spark(to, color, 14, 5, 0.09, 0.5);
    await tween(260, (t) => { g.visible = ((t * 14) | 0) % 2 === 0 || t < 0.3; g.children.forEach((m) => (m.material.opacity = 1 - t)); });
    g.children.forEach((m) => m.material.dispose()); this.remove(g);
  }
  async fire(to, big = false) {
    this.flash(to, 0xff8a3a, 70);
    for (let i = 0; i < (big ? 18 : 10); i++) {
      const m = new THREE.Mesh(sphere, own(i % 3 ? 0xff8a2a : 0xffd060, 0.9)); m.userData.own = true;
      m.position.set(to.x + (Math.random() - 0.5) * 1.1, to.y - 0.4 + Math.random() * 0.4, to.z + (Math.random() - 0.5) * 0.8);
      this.add(m);
      this.parts.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 2 + Math.random() * 3, 0), t: -Math.random() * 0.15, life: 0.8, grav: 0, size: 0.3 + Math.random() * 0.35, shrink: true, op: 0.9 });
    }
    this.ring(to, 0xff7a3a, 0.2, big ? 3 : 1.8, 420, 0.06);
    await new Promise((r) => setTimeout(r, 380));
  }
  async ice(to, big = false) {
    this.flash(to, 0x9fe8ff, 50);
    const grp = [];
    const n = big ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(cone, own(i % 2 ? 0xbff3ff : 0x7cd6ff, 0.9)); m.userData.own = true;
      const a = (i / n) * Math.PI * 2, r = i === 0 ? 0 : 0.5 + Math.random() * 0.5;
      m.position.set(to.x + Math.cos(a) * r, 0, to.z + Math.sin(a) * r * 0.6);
      m.scale.set(0.3, 0.1, 0.3); this.add(m); grp.push([m, 1.2 + Math.random() * 1.2]);
    }
    this.ring(to, 0x9fe8ff, 0.2, 2.2, 420, 0.06);
    await tween(420, (t) => { grp.forEach(([m, h]) => { m.scale.set(0.34, h * easeOut(t), 0.34); m.position.y = (h * easeOut(t)) / 2; m.material.opacity = 0.9; }); });
    this.spark(to, 0xdff8ff, 16, 4, 0.08, 0.6);
    await tween(240, (t) => grp.forEach(([m]) => (m.material.opacity = 0.9 * (1 - t))));
    grp.forEach(([m]) => this.remove(m));
  }
  async light(to, big = false) {
    this.flash(to, 0xfff0b0, 90);
    const m = new THREE.Mesh(cyl, own(0xfff2b8, 0.9)); m.userData.own = true;
    m.position.set(to.x, 5, to.z); m.scale.set(0.2, 10, 0.2); this.add(m);
    const m2 = new THREE.Mesh(cyl, own(0xffffff, 0.9)); m2.userData.own = true; m2.position.copy(m.position); m2.scale.set(0.08, 10, 0.08); this.add(m2);
    this.rise(to, 0xfff0a8, big ? 26 : 14, 1.2, 0.1);
    this.ring(to, 0xfff2b8, 0.2, big ? 3.4 : 2, 500, 0.06);
    await tween(420, (t) => { const w = (big ? 1.5 : 0.9) * (1 - Math.abs(t - 0.25) * 1.2); m.scale.x = m.scale.z = Math.max(0.05, w); m2.scale.x = m2.scale.z = Math.max(0.03, w * 0.35); m.material.opacity = 0.9 * (1 - t); m2.material.opacity = 1 - t; });
    this.remove(m); this.remove(m2);
  }
  async dark(to, big = false) {
    this.flash(to, 0xa060ff, 60);
    const n = big ? 14 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const m = new THREE.Mesh(sphere, own(i % 2 ? 0x9a5cff : 0x4a1a7a, 0.9)); m.userData.own = true;
      m.position.set(to.x + Math.cos(a) * 1.6, to.y + Math.sin(a * 2) * 0.5, to.z + Math.sin(a) * 1.0);
      this.add(m);
      const sx = m.position.x, sy = m.position.y, sz = m.position.z;
      tween(420, (t) => { const k = easeOut(t); m.position.set(sx + (to.x - sx) * k, sy + (to.y - sy) * k, sz + (to.z - sz) * k); m.scale.setScalar(0.3 * (1 - t) + 0.05); }).then(() => this.remove(m));
    }
    await new Promise((r) => setTimeout(r, 420));
    this.spark(to, 0xc088ff, 18, 5, 0.1, 0.6);
    await this.ring(to, 0x9a5cff, 0.2, big ? 3 : 2, 380, to.y);
  }
  async heal(to) {
    this.rise(to, 0x8dffb4, 18, 1.0, 0.09, 1.2);
    this.rise(to, 0xffffff, 8, 0.8, 0.06, 1.0);
    this.flash(to, 0x9dffc0, 30);
    await this.vring(to, 0x8dffb4, 700, 2.0, 0.9);
  }
  async buff(to, color = 0xffd36b) {
    this.rise(to, color, 14, 0.9, 0.08, 1.0);
    this.vring(to, color, 650, 2.1, 0.85);
    await new Promise((r) => setTimeout(r, 120));
    await this.vring(to, color, 600, 2.1, 0.85);
  }
  async debuff(to) {
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(cone, own(0xa060d0, 0.9)); m.userData.own = true;
      m.position.set(to.x + (Math.random() - 0.5) * 1.0, to.y + 1.6 + Math.random(), to.z + (Math.random() - 0.5) * 0.6);
      m.rotation.x = Math.PI; m.scale.set(0.18, 0.4, 0.18);
      this.add(m);
      this.parts.push({ mesh: m, vel: new THREE.Vector3(0, -2.2, 0), t: -Math.random() * 0.3, life: 0.9, grav: 0, size: 0.4, shrink: false, op: 0.9 });
    }
    await this.ring(to, 0xa060d0, 1.8, 0.2, 520, 0.08);
  }
}
