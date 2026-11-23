// A real 3D character in the world: VRoid anime model (procedurally posed) or a rigged GLB creature (AnimationMixer).
// Same interface as the old billboard Actor so field / battle / title code is unchanged.
import * as THREE from 'three';
import { templateSync, instantiate } from '../core/chars.js';
import { specFor } from '../data/cast.js';

const shadowGeo = new THREE.CircleGeometry(0.5, 24);
shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
const YAW = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2, left34: -0.95, right34: 0.95 };
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const gfxOptions = { lowFx: false };

export class Actor3D {
  constructor({ height = 1.8, tex, tint = 0xffffff, shadow = true, name = '', facing }) {
    const front = tex.front.replace(/_(fl|back|right)$/, '');
    this.key = front;
    this.name = name;
    this.height = height;
    this.keys = { front, back: front, right: front }; // field.walkActor looks at keys.right to decide how to face
    const spec = this.spec = specFor(front);
    const tpl = templateSync(spec.file);
    if (!tpl) throw new Error('character model not loaded: ' + spec.file + ' for ' + front);
    this.tpl = tpl;
    this.group = new THREE.Group();
    this.bob = new THREE.Group();
    this.mesh = new THREE.Group(); // rotated for the "knocked out" pose
    this.group.add(this.bob); this.bob.add(this.mesh);
    const inst = instantiate(tpl, { lowFx: gfxOptions.lowFx });
    this.model = inst.model; this.mats = inst.mats;
    const sc = (height * (spec.hMul || 1)) / tpl.height;
    this.model.rotation.order = 'YXZ';
    this.model.scale.set(sc * (spec.wMul || 1), sc, sc * (spec.wMul || 1));
    this.model.position.y = -tpl.minY * sc;
    this.mesh.add(this.model);
    if (spec.tint) this._applyTint(spec);
    if (spec.hideHair) this._hide(/HAIR/i);
    this.baseTint = new THREE.Color(tint);
    if (shadow) {
      this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
      this.shadow.scale.set(height * 0.5, 1, height * 0.3);
      this.shadow.position.y = 0.03; this.shadow.renderOrder = 1;
      this.group.add(this.shadow);
    }
    // bones for procedural posing (VRM) / mixer for creatures
    this.bones = {}; this.rest = {};
    if (tpl.isVrm) {
      for (const [b, n] of Object.entries(tpl.bones)) {
        const node = this.model.getObjectByName(n);
        if (node) { this.bones[b] = node; this.rest[b] = node.quaternion.clone(); }
      }
      this._props(spec);
      const pt = (spec.props || []).map((q) => q.type);
      this.attackKind = pt.includes('bow') ? 'shoot' : pt.includes('staff') ? 'staff' : pt.some((x) => x === 'katana' || x === 'sword' || x === 'spear') ? 'swing' : 'punch';
    } else this._setupMixer(tpl);
    this.facingYaw = YAW[facing || (tex.front.endsWith('_fl') ? 'left' : 'down')] ?? 0;
    this.yaw = this.facingYaw;
    this.dir = 'down';
    this.moving = false; this.flash = 0; this.hop = 0; this.alpha = 1; this.dead = false;
    this.t = Math.random() * 10; this.attackT = 0; this.hitT = 0; this.castT = 0; this.walkPhase = 0; this.walkBlend = 0;
    this.group.userData.actor = this;
    this._mat = null;
  }
  get position() { return this.group.position; }

  // ---------------------------------------------------------------- appearance
  _applyTint(spec) {
    for (const rule of spec.tint) {
      const [re, color] = rule;
      for (const r of this.mats) if (re.test(r.m.name || '')) r.base.multiply(new THREE.Color(color));
    }
  }
  _hide(re) { for (const r of this.mats) if (re.test(r.m.name || '')) r.m.visible = false; }
  /** small flat-coloured props attached to bones (straw hat, katana, bow, staff) */
  _props(spec) {
    for (const p of spec.props || []) {
      const bone = this.bones[p.bone]; if (!bone) continue;
      const g = new THREE.Group();
      const mk = (geo, col, pos, rot) => { const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: col })); m.position.set(...(pos || [0, 0, 0])); if (rot) m.rotation.set(...rot); m.castShadow = true; g.add(m); return m; };
      if (p.type === 'hat') { mk(new THREE.CylinderGeometry(0.17, 0.21, 0.02, 24), 0xe0c070, [0, 0.07, 0]); mk(new THREE.CylinderGeometry(0.09, 0.12, 0.09, 20), 0xd8b45c, [0, 0.12, 0]); mk(new THREE.TorusGeometry(0.1, 0.008, 6, 20), 0xa8421f, [0, 0.085, 0], [Math.PI / 2, 0, 0]); g.position.set(0, 0.06, 0.01); }
      else if (p.type === 'katana') { mk(new THREE.BoxGeometry(0.03, 0.9, 0.012), 0xdfe6f2, [0, 0.55, 0]); mk(new THREE.BoxGeometry(0.035, 0.26, 0.03), 0x2b2236, [0, -0.1, 0]); mk(new THREE.BoxGeometry(0.1, 0.02, 0.07), 0xc8a24a, [0, 0.03, 0]); }
      else if (p.type === 'staff') { mk(new THREE.CylinderGeometry(0.018, 0.022, 1.45, 8), 0x8a5a38, [0, 0.35, 0]); mk(new THREE.OctahedronGeometry(0.07), p.color || 0x9ad4ff, [0, 1.12, 0]); const l = mk(new THREE.SphereGeometry(0.11, 12, 8), p.color || 0x9ad4ff, [0, 1.12, 0]); l.material = new THREE.MeshBasicMaterial({ color: p.color || 0x9ad4ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }); }
      else if (p.type === 'bow') { mk(new THREE.TorusGeometry(0.42, 0.012, 6, 24, Math.PI), 0x7a4a28, [0, 0.1, 0], [0, 0, Math.PI / 2]); mk(new THREE.BoxGeometry(0.004, 0.84, 0.004), 0xf0ead8, [0.0, 0.1, 0]); }
      else if (p.type === 'spear') { mk(new THREE.CylinderGeometry(0.014, 0.014, 1.7, 8), 0x8a5a38, [0, 0.45, 0]); mk(new THREE.ConeGeometry(0.04, 0.22, 8), 0xdfe6f2, [0, 1.4, 0]); }
      else if (p.type === 'sword') { mk(new THREE.BoxGeometry(0.05, 0.7, 0.012), 0xcfd6e2, [0, 0.4, 0]); mk(new THREE.BoxGeometry(0.15, 0.025, 0.04), 0xc8a24a, [0, 0.04, 0]); mk(new THREE.BoxGeometry(0.03, 0.14, 0.03), 0x5a3a28, [0, -0.04, 0]); }
      if (p.pos) g.position.set(...p.pos);
      if (p.rot) g.rotation.set(...p.rot);
      if (p.scale) g.scale.setScalar(p.scale);
      // bone space is scaled by the model; cancel it so props keep real-world size
      const inv = 1 / (this.model.scale.y || 1);
      const holder = new THREE.Group(); holder.scale.setScalar(inv); holder.add(g); bone.add(holder);
    }
  }
  _setupMixer(tpl) {
    this.mixer = new THREE.AnimationMixer(this.model);
    const find = (re, not) => tpl.animations.find((a) => re.test(a.name) && !(not && not.test(a.name)));
    const mk = (clip, loop = true) => { if (!clip) return null; const a = this.mixer.clipAction(clip); if (!loop) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } return a; };
    this.act = {
      idle: mk(find(/idle/i, /gun|shoot|attack/i) || find(/idle/i) || tpl.animations[0]),
      walk: mk(find(/walk|run|gallop|fly/i, /jump|idle/i)),
      attack: mk(find(/attack|punch|headbutt|bite|stab/i, /idle|receive|hit/i), false),
      hit: mk(find(/hit/i, /attack/i), false),
    };
    this.cur = null;
    this._play('idle');
  }
  _play(name, fade = 0.2) {
    const a = this.act[name] || this.act.idle;
    if (!a || a === this.cur) return;
    a.reset().fadeIn(fade).play();
    if (this.cur && this.cur !== a) this.cur.fadeOut(fade);
    this.cur = a;
  }

  // ---------------------------------------------------------------- facing / state
  setDir(dir) { if (YAW[dir] !== undefined) { this.dir = dir; this.facingYaw = YAW[dir]; } }
  setFacing(dir) { this.setDir(dir); }
  setFlip(f) { this.setDir(f > 0 ? 'right' : 'left'); }
  faceToward(x, z) { this.facingYaw = Math.atan2(x - this.group.position.x, z - this.group.position.z); }
  faceVec(dx, dz) { if (Math.abs(dx) + Math.abs(dz) > 1e-4) this.facingYaw = Math.atan2(dx, dz); }
  setTint(c) { this.baseTint.set(c); }
  setTexKey() {}
  attack(d = 0.42) { this.attackT = 0.001; this.attackDur = d; this.hand = !this.hand; if (this.act && this.act.attack) { this.act.attack.reset().play(); setTimeout(() => this.cur && this.cur.play(), 0); } }
  cast() { this.castT = 0.7; this.castDur = 0.7; }
  hit() { this.hitT = 0.4; if (this.act && this.act.hit) this.act.hit.reset().play(); }
  /** proxy used by battle code to fade enemies out */
  get mat() {
    if (!this._mat) {
      const self = this;
      this._mat = { set opacity(v) { self.alpha = v; }, get opacity() { return self.alpha; }, set transparent(v) { self._transparent = v; }, get transparent() { return !!self._transparent; } };
    }
    return this._mat;
  }

  // ---------------------------------------------------------------- per frame
  _bone(name, x, y, z, k = 1) {
    const n = this.bones[name]; if (!n) return;
    _e.set(x * k, y * k, z * k); _q.setFromEuler(_e);
    n.quaternion.copy(this.rest[name]).multiply(_q);
  }
  update(dt) {
    if (this.frozen) return;
    this.t += dt; const t = this.t;
    // smooth turning
    this.yaw += wrap(this.facingYaw - this.yaw) * Math.min(1, dt * 12);
    // yaw + (dodge roll: tuck and lean forward); all three components are set so a template's baked rotation can't leak in
    this.model.rotation.set((this.roll || 0) * 1.1, this.yaw, 0);
    this.mesh.scale.y = 1 - (this.roll || 0) * 0.28;
    this.walkBlend += ((this.moving ? 1 : 0) - this.walkBlend) * Math.min(1, dt * 10);
    if (this.moving) this.walkPhase += dt * (this.running ? 12.5 : 9.5);
    const w = this.walkBlend;
    if (this.tpl.isVrm) this._poseVrm(t, w, dt); else this._poseMixer(dt);
    // bob / hop
    this.bob.position.y = (this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.035 * (this.height / 1.8) : 0) + this.hop;
    // tint, flash, alpha: only touch the materials when something changed (a VRM has ~30 of them)
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
    const bt = this.baseTint, transparent = this.alpha < 1;
    const sig = bt.r + '|' + bt.g + '|' + bt.b + '|' + this.flash.toFixed(2) + '|' + this.alpha.toFixed(2);
    if (sig !== this._sig) {
      this._sig = sig;
      const f = 1 + this.flash * 2.2;
      for (const r of this.mats) {
        r.m.color.setRGB(r.base.r * bt.r * f, r.base.g * bt.g * f, r.base.b * bt.b * f);
        if (transparent) { r.m.transparent = true; r.m.opacity = this.alpha; r.m.depthWrite = this.alpha > 0.5; }
      }
    }
  }
  _poseMixer(dt) {
    const moving = this.moving && this.act.walk;
    this._play(moving ? 'walk' : 'idle');
    this.mixer.update(dt);
  }
  /** Procedural pose. Bone frames are the VRM rest (T-pose) frames: +x swings a hanging limb FORWARD, a forward lean is -x,
   *  arms are lowered with z (left +, right -), elbows bend about y (left -, right +), knees bend with -x. */
  _poseVrm(t, w, dt = 1 / 60) {
    const arm = 1.2;
    const run = this.running ? 1 : 0;
    const ph = this.walkPhase;
    const s = Math.sin(ph) * w, c = Math.cos(ph) * w;
    const br = Math.sin(t * 2.1) * (1 - w);
    let atk = 0, cast = 0, hit = 0;
    if (this.attackT > 0) { this.attackT += dt; const k = this.attackT / (this.attackDur || 0.42); atk = k < 1 ? Math.sin(Math.min(1, k) * Math.PI * 0.95) : 0; if (k >= 1) this.attackT = 0; }
    if (this.castT > 0) { this.castT -= dt; const cd = this.castDur || 0.7; cast = Math.min(1, Math.sin(Math.min(1, (cd - this.castT) / cd) * Math.PI) * 1.5); }
    if (this.hitT > 0) { this.hitT -= dt; hit = Math.sin(Math.max(0, this.hitT / 0.4) * Math.PI); }
    const roll = this.roll || 0;
    const kind = this.attackKind;
    const swing = kind === 'swing' || kind === 'punch';
    const side = kind === 'punch' && this.hand ? -1 : 1;          // punches alternate hands
    // ---- torso
    this._bone('hips', 0.04 * roll, -s * 0.16, 0);
    this._bone('spine', -0.06 * w - 0.1 * run * w - 0.9 * roll * 0.5 + 0.03 * br + 0.28 * hit - 0.08 * atk, s * 0.12 + atk * 0.35 * side * (swing ? 1 : 0), 0);
    this._bone('chest', 0.02 * br - 0.04 * w - 0.3 * roll + 0.1 * hit, -s * 0.14 - atk * 0.7 * side * (swing ? 1 : 0.2), 0);
    this._bone('head', -0.03 * br - 0.2 * hit + 0.05 * roll - cast * 0.12 + 0.04 * run * w, s * 0.06, 0);
    // ---- arms
    const sw = 0.5 + 0.3 * run;
    let lx = -s * sw, rx = s * sw;                                   // opposite to the legs
    let lz = arm, rz = -arm;
    let ly = 0, ry = 0;
    let le = 0.22 + 0.5 * run * w + 0.25 * Math.max(0, c) * w, re = 0.22 + 0.5 * run * w + 0.25 * Math.max(0, -c) * w; // elbow bend
    if (kind === 'shoot') { lx += atk * 1.55; lz -= atk * 0.45; rx += atk * 0.9; rz += atk * 0.3; re += atk * 0.9; }
    else if (swing) {
      const R = side > 0 ? 1 : 0, L = 1 - R;
      rx += atk * R * 2.3 - atk * L * 0.5; rz += atk * R * 0.7; re += atk * R * 0.2; ry += atk * R * 0.4;
      lx += atk * L * 2.3 - atk * R * 0.3; lz -= atk * L * 0.7; le += atk * L * 0.2; ly -= atk * L * 0.4;
    }
    const up = Math.max(cast, kind === 'staff' ? atk : 0);          // casting / staff: both arms up and forward
    lx += up * 1.7; rx += up * 1.7; lz -= up * 0.55; rz += up * 0.55; le += up * 0.5; re += up * 0.5;
    lx += roll * 1.3; rx += roll * 1.3; le += roll * 0.9; re += roll * 0.9;
    lx -= hit * 0.5; rx -= hit * 0.5;
    this._bone('leftUpperArm', lx, ly, lz + 0.04 * br);
    this._bone('rightUpperArm', rx, ry, rz - 0.04 * br);
    this._bone('leftLowerArm', 0, -le, 0);
    this._bone('rightLowerArm', 0, re, 0);
    // ---- legs: thighs swing, knees flex while the leg travels forward
    const crouch = roll * 1.25;
    const kneeL = Math.max(0, c) * 0.95 * (0.6 + 0.4 * run), kneeR = Math.max(0, -c) * 0.95 * (0.6 + 0.4 * run);
    this._bone('leftUpperLeg', s * (0.62 + 0.18 * run) + crouch, 0, 0);
    this._bone('rightUpperLeg', -s * (0.62 + 0.18 * run) + crouch, 0, 0);
    this._bone('leftLowerLeg', -(kneeL + roll * 1.7), 0, 0);
    this._bone('rightLowerLeg', -(kneeR + roll * 1.7), 0, 0);
    this._bone('leftFoot', Math.max(0, -c) * 0.3 * w, 0, 0);
    this._bone('rightFoot', Math.max(0, c) * 0.3 * w, 0, 0);
  }
  dispose() { this.model.traverse((o) => { if (o.geometry && !o.userData.shared) { /* geometry is shared with the template */ } }); }
}
