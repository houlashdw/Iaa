// Combat visuals built from additive geometry (no textures): slash arcs, projectiles, ground telegraphs.
import * as THREE from 'three';

const sphere = new THREE.SphereGeometry(1, 10, 8);
const box = new THREE.BoxGeometry(1, 1, 1);
const sectorCache = new Map();
function sector(arc) {
  const k = Math.round(arc * 20);
  if (!sectorCache.has(k)) {
    const g = arc >= Math.PI * 2 - 0.01 ? new THREE.CircleGeometry(1, 40) : new THREE.CircleGeometry(1, Math.max(8, Math.round(arc * 8)), -arc / 2, arc);
    g.rotateX(-Math.PI / 2);
    sectorCache.set(k, g);
  }
  return sectorCache.get(k);
}
const ringGeo = new THREE.RingGeometry(0.9, 1, 48); ringGeo.rotateX(-Math.PI / 2);
const arcCache = new Map();
function arcGeo(arc) {
  const k = Math.round(arc * 20);
  if (!arcCache.has(k)) { const g = new THREE.RingGeometry(0.55, 1, Math.max(10, Math.round(arc * 9)), 1, -arc / 2, arc); g.rotateX(-Math.PI / 2); arcCache.set(k, g); }
  return arcCache.get(k);
}
const baseMats = new Map();
export function addMat(color, opacity = 1) {
  const key = color + '|' + opacity;
  if (!baseMats.has(key)) baseMats.set(key, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  return baseMats.get(key);
}
const own = (color, opacity) => addMat(color, opacity).clone();
const yawToRot = (yaw) => Math.atan2(-Math.cos(yaw), Math.sin(yaw)); // maps the sector's +x axis onto the actor facing (sin,cos)

/** transient visual objects that fade on their own (updated by Vfx.update) */
export class Vfx {
  constructor(scene) { this.scene = scene; this.items = []; this.tele = []; }
  _add(mesh, life, fn) { this.scene.add(mesh); this.items.push({ mesh, life, t: 0, fn }); return mesh; }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      it.fn(k, it.mesh);
      if (k >= 1) { this.scene.remove(it.mesh); if (it.mesh.material && it.mesh.material.dispose) it.mesh.material.dispose(); this.items.splice(i, 1); }
    }
  }
  clear() {
    for (const it of this.items) this.scene.remove(it.mesh);
    for (const t of this.tele) this.scene.remove(t.mesh);
    this.items.length = 0; this.tele.length = 0;
  }
  /** crescent slash in front of a character */
  arc(x, y, z, yaw, range, arc, color = 0xfff2c0, life = 0.22) {
    const m = new THREE.Mesh(arcGeo(Math.min(arc, 5.8)), own(color, 0.9));
    m.position.set(x, y, z); m.rotation.y = yawToRot(yaw); m.scale.setScalar(range * 0.55);
    return this._add(m, life, (k, o) => { o.scale.setScalar(range * (0.55 + 0.45 * Math.sqrt(k))); o.material.opacity = 0.9 * (1 - k * k); o.rotation.y += 0.0; });
  }
  /** expanding ground ring (shockwaves, novas, landings) */
  ring(x, z, color, r0, r1, life = 0.4, y = 0.07, op = 0.9) {
    const m = new THREE.Mesh(ringGeo, own(color, op));
    m.position.set(x, y, z); m.scale.setScalar(r0);
    return this._add(m, life, (k, o) => { o.scale.setScalar(r0 + (r1 - r0) * Math.sqrt(k)); o.material.opacity = op * (1 - k); });
  }
  /** filled disc flash */
  disc(x, z, color, r, life = 0.35, y = 0.06) {
    const m = new THREE.Mesh(sector(Math.PI * 2), own(color, 0.7));
    m.position.set(x, y, z); m.scale.setScalar(r * 0.3);
    return this._add(m, life, (k, o) => { o.scale.setScalar(r * (0.3 + 0.7 * Math.sqrt(k))); o.material.opacity = 0.7 * (1 - k); });
  }
  /** vertical light column (heals, lightning landings, revives) */
  column(x, z, color, r = 0.6, h = 8, life = 0.45) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true), own(color, 0.85));
    m.position.set(x, h / 2, z); m.scale.set(r, h, r);
    return this._add(m, life, (k, o) => { const w = r * (1 - k * 0.7); o.scale.set(w, h, w); o.material.opacity = 0.85 * (1 - k); });
  }
  /** projectile body: glowing orb or arrow shaft */
  bolt(color, size = 0.28, arrow = false) {
    const g = new THREE.Group();
    if (arrow) {
      const s = new THREE.Mesh(box, own(color, 1)); s.scale.set(0.05, 0.05, 1.1); g.add(s);
      const h = new THREE.Mesh(box, own(0xffffff, 1)); h.scale.set(0.025, 0.025, 0.7); g.add(h);
    } else {
      const o = new THREE.Mesh(sphere, own(color, 0.95)); o.scale.setScalar(size); g.add(o);
      const c = new THREE.Mesh(sphere, own(0xffffff, 1)); c.scale.setScalar(size * 0.5); g.add(c);
      const halo = new THREE.Mesh(sphere, own(color, 0.28)); halo.scale.setScalar(size * 1.9); g.add(halo);
    }
    this.scene.add(g);
    g.userData.dispose = () => { this.scene.remove(g); g.traverse((o) => { if (o.material && o.material.dispose) o.material.dispose(); }); };
    return g;
  }
  /** ground warning: a sector (or full circle) that fills in over `life` seconds. Returns a handle with .remove() */
  telegraph(x, z, yaw, range, arc, life, color = 0xff3a3a) {
    const base = new THREE.Mesh(sector(arc), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const fill = new THREE.Mesh(sector(arc), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const edge = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const g = new THREE.Group();
    for (const m of [base, fill]) { m.renderOrder = 2; g.add(m); }
    g.position.set(x, 0.08, z); g.rotation.y = arc >= Math.PI * 2 - 0.01 ? 0 : yawToRot(yaw);
    base.scale.setScalar(range); fill.scale.setScalar(0.01);
    if (arc >= Math.PI * 2 - 0.01) { edge.scale.setScalar(range); edge.material.opacity = 0.7; g.add(edge); }
    this.scene.add(g);
    const h = { mesh: g, t: 0, life, x, z, yaw, range, arc, done: false,
      remove: () => { this.scene.remove(g); g.traverse((o) => { if (o.material) o.material.dispose(); }); h.done = true; const i = this.tele.indexOf(h); if (i >= 0) this.tele.splice(i, 1); } };
    h.fn = () => fill.scale.setScalar(Math.max(0.01, range * Math.min(1, h.t / h.life)));
    this.tele.push(h);
    return h;
  }
  updateTele(dt) { for (const t of this.tele) { t.t += dt; t.fn(); } }
}
