import * as THREE from 'three';
import { spriteTex } from '../core/assets.js';

const quad = new THREE.PlaneGeometry(1, 1);
quad.translate(0, 0.5, 0); // pivot at the feet
const shadowGeo = new THREE.CircleGeometry(0.5, 24);
shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });

export const camState = { tilt: 0.55 }; // radians the billboards lean back to face the camera

/** A painted character standing in the 3D world as an upright billboard. */
export class Actor {
  /**
   * @param {object} o
   * @param {number} o.height world height of the figure
   * @param {{front:string,back?:string,right?:string,fl?:string}} o.tex sprite keys
   */
  constructor({ height = 1.8, tex, tint = 0xffffff, shadow = true, name = '' }) {
    this.name = name;
    this.height = height;
    this.keys = tex;
    this.group = new THREE.Group();
    this.tiltGroup = new THREE.Group();
    this.bob = new THREE.Group();
    this.group.add(this.tiltGroup);
    this.tiltGroup.add(this.bob);
    this.mat = new THREE.MeshBasicMaterial({ map: spriteTex(tex.front), transparent: true, alphaTest: 0.38, side: THREE.DoubleSide, color: tint });
    this.baseTint = new THREE.Color(tint);
    this.mesh = new THREE.Mesh(quad, this.mat);
    this.mesh.scale.set(height, height, 1);
    this.mesh.renderOrder = 2;
    this.bob.add(this.mesh);
    if (shadow) {
      this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
      this.shadow.scale.set(height * 0.42, 1, height * 0.2);
      this.shadow.position.y = 0.03;
      this.shadow.renderOrder = 1;
      this.group.add(this.shadow);
    }
    this.dir = 'down';
    this.flip = 1;
    this.moving = false;
    this.t = Math.random() * 10;
    this.flash = 0;
    this.hop = 0; // extra vertical offset (jumps, lunges)
    this.alpha = 1;
    this.group.userData.actor = this;
  }
  get position() { return this.group.position; }
  setTexKey(key) { this.mat.map = spriteTex(key); this.mat.needsUpdate = true; }
  /** direction: down|up|left|right (uses front/back/right textures; left mirrors right) */
  setDir(dir) {
    if (dir === this.dir) return;
    this.dir = dir;
    const k = this.keys;
    let key = k.front, flip = 1;
    if (dir === 'up' && k.back) key = k.back;
    else if (dir === 'right' && k.right) key = k.right;
    else if (dir === 'left' && k.right) { key = k.right; flip = -1; }
    this.flip = flip;
    this.mat.map = spriteTex(key);
    this.mat.needsUpdate = true;
  }
  setFlip(f) { this.flip = f; }
  setTint(color) { this.baseTint.set(color); }
  update(dt) {
    this.t += dt;
    const t = this.t;
    if (this.moving) {
      this.bob.position.y = Math.abs(Math.sin(t * 11)) * 0.09 * (this.height / 1.8);
      this.bob.rotation.z = Math.sin(t * 11) * 0.05;
      this.mesh.scale.set(this.height * this.flip, this.height * (1 + Math.sin(t * 22) * 0.012), 1);
    } else {
      this.bob.position.y = 0;
      this.bob.rotation.z = 0;
      const br = Math.sin(t * 2.1) * 0.012;
      this.mesh.scale.set(this.height * this.flip * (1 - br * 0.5), this.height * (1 + br), 1);
    }
    this.bob.position.y += this.hop;
    this.tiltGroup.rotation.x = -camState.tilt;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      const f = 1 + this.flash * 2.4;
      this.mat.color.setRGB(this.baseTint.r * f, this.baseTint.g * f, this.baseTint.b * f);
    } else this.mat.color.copy(this.baseTint);
    if (this.alpha < 1) { this.mat.opacity = this.alpha; this.mat.transparent = true; }
    if (this.shadow) this.shadow.material.opacity = 0.34;
  }
  dispose() { this.mat.dispose(); }
}
