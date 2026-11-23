// Exploration mode: third-person free movement, collision, NPCs, chests, exits, triggers; hosts the real-time combat layer.
import * as THREE from 'three';
import { Actor3D as Actor } from './actor3d.js';
import { model } from '../core/assets.js';
import { loadChar } from '../core/chars.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { state, flag, setFlag, addItem } from '../state.js';
import { CHARS } from '../data/characters.js';
import { MAPS } from '../data/maps.js';
import { ZONES } from '../data/enemies.js';
import { rand, clamp, tween, easeInOut, damp } from '../core/util.js';
import { Combat } from '../combat/combat.js';
import { isMobile } from '../core/device.js';
import { h, root } from '../ui/ui.js';
import { itemInfo } from '../data/items.js';

const PR = 0.27; // player radius
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** camera yaw that looks along a compass direction ('up' = toward -z) */
const yawOfDir = (d) => ({ up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[d] ?? 0);
/** nearest compass direction of a facing yaw (actor yaw 0 faces +z) */
const dirOfYaw = (y) => { const x = Math.sin(y), z = Math.cos(y); return Math.abs(x) > Math.abs(z) ? (x > 0 ? 'right' : 'left') : (z > 0 ? 'down' : 'up'); };

const NPC_HEIGHT = { towns: 1.75, heroes: 1.95, villains: 2.0, goblins: 1.45, pirates: 1.9 };

export class Field {
  constructor(G) {
    this.G = G;
    this.world = G.world;
    this.active = false;
    this.busy = false;
    this.def = null;
    this.things = [];
    this.npcs = [];
    this.chests = [];
    this.followers = [];
    this.trail = [];
    this.t = 0;
    this.steps = 0;
    this.prompt = h('div', 'prompt hidden', '✦');
    root.appendChild(this.prompt);
    this.target = null;
    this.party = []; this.ctrl = 0; this.ctrlId = null;
    this.combat = new Combat(G, this);
    input.field = (a) => this.onAction(a);
  }
  get leader() { return this.player; }
  get pos() { return this.player.position; }
  /** facing of the controlled character as a compass direction (used by saves / cutscenes) */
  get dir() { return this._dir || (this.player ? dirOfYaw(this.player.facingYaw) : 'down'); }
  set dir(v) { this._dir = null; }

  // ------------------------------------------------------------ loading
  async enter(mapId, x, z, dir = 'down', { silent = false } = {}) {
    const G = this.G;
    const def = MAPS[mapId];
    if (!def) throw new Error('unknown map ' + mapId);
    this.active = false;
    this.hidePrompt();
    // prepare sprites for NPCs (lazy-loaded)
    const keys = (def.npcs || []).filter((n) => !n.cond || n.cond()).map((n) => n.sprite);
    await Promise.all([...keys, ...state.party.slice(0, 4).map((id) => CHARS[id].sprite)].map((k) => loadChar(k)));
    // remove everything the previous map left in the scene
    for (const n of this.npcs) { this.world.remove(n.actor.group); n.actor.dispose(); }
    for (const c of this.chests) this.world.remove(c.mesh);
    const b = await this.world.load(def);
    this.def = def; this.b = b;
    state.map = { id: mapId, x, z, dir };
    this.things = []; this.npcs = []; this.chests = []; this.trail = [];
    this._spawnNpcs(); this._spawnChests();
    this.buildParty(x, z, dir);
    this.world.yaw = yawOfDir(dir); this.world.camDist = this.world.dist;
    this.world.setFocus(this._focus(), true);
    await this.combat.setupMap(def, b);
    G.gfx.setScene(this.world.scene, this.world.camera);
    G.gfx.setGrade({ focus: 0.5, band: 0.38, amount: 0.7 });
    if (this.world.moon && flag('moon_broken')) { this.world.moon.scale.setScalar(0.82); this.world.moon.material.color.setHex(0xc89aa8); }
    if (def.music !== undefined) audio.playMusic(def.music);
    this.active = true;
    if (def.onEnter) this.runEvent(def.onEnter);
    state.chapter = Math.max(state.chapter, def.chapter || 0);
    return def;
  }
  _spawnNpcs() {
    for (const n of this.def.npcs || []) {
      if (n.cond && !n.cond()) continue;
      const pack = n.sprite.split('_')[0];
      const hgt = n.h || NPC_HEIGHT[pack] || 1.8;
      const a = new Actor({ height: hgt, tex: { front: n.sprite }, tint: this.world.mood.sprite });
      a.position.set(n.x, 0, n.z);
      if (n.flip) a.setFlip(-1);
      this.world.add(a.group);
      const o = { kind: 'npc', def: n, actor: a, x: n.x, z: n.z, r: 0.42, home: [n.x, n.z], wt: Math.random() * 3, tgt: null, ref: n };
      this.npcs.push(o); this.things.push(o);
    }
    for (const s of this.def.spots || []) {
      if (s.cond && !s.cond()) continue;
      this.things.push({ kind: 'spot', def: s, x: s.x, z: s.z, r: s.r || 0.9, ref: s });
    }
  }
  _spawnChests() {
    for (const c of this.def.chests || []) {
      const m = model('chest');
      m.scale.setScalar(0.85);
      m.position.set(c.x, 0, c.z);
      m.rotation.y = c.ry ?? 0;
      this.world.add(m);
      const o = { kind: 'chest', def: c, mesh: m, x: c.x, z: c.z, r: 0.55, ref: c };
      this._chestLook(o);
      this.chests.push(o); this.things.push(o);
    }
  }
  _chestLook(o) {
    const opened = !!flag('chest.' + o.def.id);
    o.mesh.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiplyScalar(opened ? 0.45 : 1); } });
    o.mesh.scale.y = opened ? 0.62 : 0.85;
  }
  buildParty(x, z, dir) {
    for (const a of this.party) this.world.remove(a.group);
    const ids = state.party.slice(0, 4);
    const mk = (id) => {
      const c = CHARS[id];
      const a = new Actor({ height: c.height, tex: { front: c.sprite }, tint: this.world.mood.sprite });
      a.id = id;
      this.world.add(a.group);
      return a;
    };
    this.party = ids.map(mk);
    this.ctrl = Math.max(0, ids.indexOf(this.ctrlId));
    this.ctrlId = ids[this.ctrl];
    this.player = this.party[this.ctrl];
    this.followers = this.party.filter((a) => a !== this.player);
    this.player.position.set(x, 0, z);
    this.player.facingYaw = this.player.yaw = Math.atan2(...(DIRV[dir] || DIRV.down));
    this._dir = dir;
    this.trail = this._initTrail(x, z, dir);
    this._placeFollowers(0);
    this.followers.forEach((f) => { f.facingYaw = f.yaw = this.player.facingYaw; f.moving = false; });
    this.combat.bindParty();
  }
  /** take over another party member (Tab / Q / HUD portrait) */
  setControlled(i) {
    if (i === this.ctrl || !this.party[i]) return false;
    const old = this.player, nw = this.party[i];
    this.ctrl = i; this.ctrlId = nw.id;
    this.player = nw; this.followers = this.party.filter((a) => a !== nw);
    const yaw = nw.facingYaw;
    this.trail = this._initTrail(nw.position.x, nw.position.z, dirOfYaw(yaw));
    for (const f of this.followers) f.catchup = true;
    nw.catchup = false;
    this._dir = null;
    return true;
  }
  /** a short trail behind the leader so followers stand in a neat line */
  _initTrail(x, z, dir) {
    const [vx, vz] = DIRV[dir] || DIRV.down;
    const t = [];
    for (let i = 0; i < 48; i++) t.push({ x: x - vx * 0.12 * i, z: z - vz * 0.12 * i });
    return t;
  }
  _focus() { const p = this.player.position; return new THREE.Vector3(p.x, 0, p.z); }

  // ------------------------------------------------------------ collision
  /** move a position by (dx,dz) with wall sliding; r = body radius; ignoreNpcs for enemies / dashes. Returns distance moved. */
  tryMove(pos, dx, dz, r = PR, ignoreNpcs = false) {
    const b = this.b;
    const hit = (x, z) => {
      for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (b.isBlocked(Math.floor(x + ox), Math.floor(z + oz))) return true;
      if (!ignoreNpcs) for (const t of this.things) {
        if (t.kind !== 'npc' && t.kind !== 'chest') continue;
        if (t.kind === 'npc' && t.def.ghost) continue;
        const rr = t.r + r - 0.1;
        if ((t.x - x) ** 2 + (t.z - z) ** 2 < rr * rr) return true;
      }
      return false;
    };
    const ox = pos.x, oz = pos.z;
    const inside = hit(pos.x, pos.z);   // spawned / pushed into a blocked cell: let it walk out instead of being frozen
    // sub-step long moves so fast dashes never tunnel through a wall cell
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
    for (let i = 0; i < n; i++) {
      const sx = dx / n, sz = dz / n;
      if (inside || !hit(pos.x + sx, pos.z)) pos.x += sx;
      if (inside || !hit(pos.x, pos.z + sz)) pos.z += sz;
    }
    return Math.hypot(pos.x - ox, pos.z - oz);
  }

  // ------------------------------------------------------------ input
  onAction(a) {
    if (!this.active || this.busy || this.G.paused) return false;
    if (a === 'ok') { if (this.target) this.interact(this.target); return true; }
    if (a === 'menu' || a === 'cancel') { this.G.openMenu(); return true; }
    return this.combat.onAction(a);
  }
  async interact(t) {
    if (t.kind === 'chest') return this.openChest(t);
    const run = t.def.talk || t.def.run;
    if (!run) return;
    if (t.kind === 'npc') t.actor.faceToward(this.pos.x, this.pos.z);
    await this.runEvent(run);
  }
  async runEvent(fn) {
    if (this.busy) return;
    this.busy = true;
    this.player.moving = false; this.followers.forEach((f) => (f.moving = false));
    this.hidePrompt();
    try { await fn(this.G, this); } catch (e) { console.error('event error', e); }
    this.G.ui.dialogue.hide();
    this.busy = false;
  }
  async openChest(t) {
    const id = t.def.id;
    if (flag('chest.' + id)) { await this.runEvent(async (G) => { await G.say(['*: The chest is empty.']); }); return; }
    await this.runEvent(async (G) => {
      setFlag('chest.' + id);
      audio.sfx('gem', { vol: 0.8 }); audio.jingle('discover');
      t.mesh.scale.y = 0.95;
      this._chestLook(t);
      if (t.def.gold) { state.gold += t.def.gold; G.ui.toast(`Found <b>${t.def.gold} G</b>`, 'gold'); }
      if (t.def.item) {
        const q = t.def.qty || 1; addItem(t.def.item, q);
        const info = itemInfo(t.def.item);
        G.ui.toast(`Found <b>${info.name}</b>${q > 1 ? ' ×' + q : ''}`, 'good');
      }
      if (t.def.run) await t.def.run(G);
      await new Promise((r) => setTimeout(r, 500));
    });
  }

  // ------------------------------------------------------------ prompt
  hidePrompt() { this.prompt.classList.add('hidden'); this.target = null; document.body.classList.remove('canint'); }
  _updatePrompt() {
    let best = null, bd = 1e9;
    const f = this.player.facingYaw, fx = Math.sin(f), fz = Math.cos(f);
    for (const t of this.things) {
      if (t.kind === 'npc' && (t.def.noTalk || t.hidden)) continue;
      const dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
      const reach = (t.r || 0.5) + 1.25;
      if (d > reach) continue;
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      if (dot < -0.1 && d > 1.2) continue;
      if (d < bd) { bd = d; best = t; }
    }
    this.target = best;
    document.body.classList.toggle('canint', !!best);
    if (!best) { this.prompt.classList.add('hidden'); return; }
    const top = new THREE.Vector3(best.x, (best.actor ? best.actor.height : 1) + 0.35, best.z);
    const p = this.G.gfx.project(top);
    this.prompt.classList.remove('hidden');
    this.prompt.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
    this.prompt.textContent = (best.kind === 'chest' ? '✦ Open' : (best.def.prompt || '✦ Talk'));
  }

  // ------------------------------------------------------------ update
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const cb = this.combat;
    document.body.classList.toggle('uimodal', input.modal);   // touch overlays step aside for menus / dialogue
    const fighting = !!cb.scripted;                       // a story fight runs inside a busy event: the player is in control again
    const free = (!this.busy || fighting) && !input.modal && !this.G.paused && !cb.resultBusy && !cb.eventBusy;
    const world = this.world;
    // ----- camera look (mouse / touch / arrow keys)
    if (!input.modal) {
      const l = input.takeLook(dt);
      world.yaw -= l.x * 0.0042;
      world.pitch = clamp(world.pitch + l.y * 0.0036, 0.06, 1.25);
      if (l.zoom) world.zoomK = clamp(world.zoomK + l.zoom * 0.12, 0.55, 1.8);
    }
    // ----- player movement: camera-relative, free direction
    const p = this.pos;
    const px = p.x, pz = p.z;
    if (free) {
      if (!cb.controlLocked()) {
        const v = input.vec();
        const mod = cb.moveMod();   // attacking slows the player; dodging / stun is driven by the combat code
        if ((v.x || v.y) && !mod.freeze) {
          const sy = Math.sin(world.yaw), cy = Math.cos(world.yaw);
          const mx = cy * v.x + sy * v.y, mz = -sy * v.x + cy * v.y;
          const l = Math.hypot(mx, mz) || 1;
          const mag = Math.min(1, Math.hypot(v.x, v.y));
          const sp = (input.run ? 7.2 : 4.9) * mag * mod.speedMul;
          const moved = this.tryMove(p, (mx / l) * sp * dt, (mz / l) * sp * dt);
          this.player.moving = moved > 0.0005;
          this.player.running = input.run;
          if (!mod.faceLock) this.player.faceVec(mx, mz);
        } else this.player.moving = false;
      }
    } else this.player.moving = false;
    cb.update(dt);
    const moved = Math.hypot(p.x - px, p.z - pz);
    if (moved > 0.0005) this._dir = null;
    // trail for followers
    const last = this.trail[0];
    if (moved > 0 && (this.pos.x - last.x) ** 2 + (this.pos.z - last.z) ** 2 > 0.04) {
      this.trail.unshift({ x: this.pos.x, z: this.pos.z });
      if (this.trail.length > 240) this.trail.length = 240;
    }
    this._placeFollowers(dt);
    if (moved > 0) { this.steps += moved; state.steps += moved; }
    if (free && !fighting) this._checkTriggers(true);
    this._npcs(dt);
    this._finish(dt);
    if (free && !fighting) this._updatePrompt(); else this.hidePrompt();
    state.play += dt;
  }
  _finish(dt) {
    const world = this.world;
    for (const a of this.party) a.update(dt);
    const far = isMobile ? 26 : 44, pp = this.player.position;
    for (const n of this.npcs) {
      const near = Math.hypot(n.x - pp.x, n.z - pp.z) < far;
      n.actor.group.visible = near && !n.hidden; n.actor.frozen = !near;
      n.actor.update(dt);
    }
    for (const c of this.chests) c.mesh.position.y = 0;
    world.setFocus(this._focus());
    world.update(dt);
  }
  _placeFollowers(dt) {
    // followers keep a loose V behind the leader (so the camera never stares at someone's back)
    const FORM = [[0.55, -1.5], [0.75, 1.5], [1.9, -2.8]];   // [distance behind along the trail, sideways offset]
    let acc = 0, ti = 0;
    for (let i = 0; i < this.followers.length; i++) {
      const f = this.followers[i];
      if (f.ai) continue;                       // the combat AI steers this one
      const [need, lat] = FORM[i] || [(i + 1) * 0.95, 0];
      let cur = this.trail[0], tx = 0, tz = 1;
      acc = 0;
      for (ti = 0; ti < this.trail.length - 1; ti++) {
        const p0 = this.trail[ti], p1 = this.trail[ti + 1];
        const seg = Math.hypot(p0.x - p1.x, p0.z - p1.z);
        if (acc + seg >= need) { const k = (need - acc) / (seg || 1); cur = { x: p0.x + (p1.x - p0.x) * k, z: p0.z + (p1.z - p0.z) * k }; tx = (p0.x - p1.x) / (seg || 1); tz = (p0.z - p1.z) / (seg || 1); break; }
        acc += seg; cur = p1;
      }
      if (lat) {
        const ox = -tz * lat, oz = tx * lat;
        if (!this.b.isBlocked(Math.floor(cur.x + ox), Math.floor(cur.z + oz))) cur = { x: cur.x + ox, z: cur.z + oz };
      }
      let dx = cur.x - f.position.x, dz = cur.z - f.position.z;
      let mv = Math.hypot(dx, dz);
      if (dt > 0 && mv > 0.02) {                 // glide into place (also hides the trail's sharp corners)
        const stepLen = Math.min(mv, (f.catchup ? 8.5 : 7.4) * dt + 0.0);
        if (mv > 14) { f.position.x = cur.x; f.position.z = cur.z; f.moving = false; continue; }
        f.position.x += (dx / mv) * stepLen; f.position.z += (dz / mv) * stepLen;
        f.moving = stepLen > 0.004; f.faceVec(dx, dz);
        if (mv - stepLen < 0.05) f.catchup = false;
        continue;
      }
      f.catchup = false;
      f.position.x = cur.x; f.position.z = cur.z;
      f.moving = false;
      if (!this.player.moving) f.facingYaw = this.player.facingYaw;
    }
  }
  _npcs(dt) {
    for (const n of this.npcs) {
      const d = n.def;
      n.actor.moving = false;
      if (n.hidden || !d.wander || this.busy) continue;
      n.wt -= dt;
      if (!n.tgt && n.wt <= 0) {
        n.tgt = [n.home[0] + (Math.random() - 0.5) * 2 * d.wander, n.home[1] + (Math.random() - 0.5) * 2 * d.wander];
        n.wt = 2 + Math.random() * 4;
      }
      if (n.tgt) {
        const dx = n.tgt[0] - n.x, dz = n.tgt[1] - n.z, l = Math.hypot(dx, dz);
        if (l < 0.08) n.tgt = null;
        else {
          const nx = n.x + (dx / l) * 1.0 * dt, nz = n.z + (dz / l) * 1.0 * dt;
          const ok = !this.b.isBlocked(Math.floor(nx), Math.floor(nz)) && Math.hypot(nx - this.pos.x, nz - this.pos.z) > 0.8;
          if (ok) { n.x = nx; n.z = nz; n.actor.position.set(nx, 0, nz); n.actor.moving = true; n.actor.faceVec(dx, dz); } else n.tgt = null;
        }
      }
    }
  }
  _checkTriggers(exitsToo = true) {
    const p = this.pos;
    for (const e of exitsToo ? this.def.exits || [] : []) {
      const [x, z, w, d] = e.rect;
      if (p.x >= x && p.x <= x + w && p.z >= z && p.z <= z + d && (!e.cond || e.cond())) {
        if (e.block) { const r = e.block(this.G); if (r) { this.runEvent(r); return; } }
        this.warp(e.to, e.tx, e.tz, e.dir || 'down', e);
        return;
      }
    }
    for (const t of this.def.triggers || []) {
      const [x, z, w, d] = t.rect;
      if (p.x >= x && p.x <= x + w && p.z >= z && p.z <= z + d) {
        const key = 'trig.' + this.def.id + '.' + t.id;
        if (t.once !== false && flag(key)) continue;
        if (t.cond && !t.cond()) continue;
        if (t.once !== false) setFlag(key);
        this.runEvent(t.run);
        return;
      }
    }
  }

  // ------------------------------------------------------------ transitions
  async warp(to, tx, tz, dir = 'down', opts = {}) {
    if (this.warping) return;
    this.warping = true; this.busy = true;
    this.player.moving = false;
    audio.sfx(opts.sfx || 'land', { vol: 0.35 });
    await this.G.fadeTo(1, 380);
    await this.enter(to, tx, tz, dir);
    this.busy = false; this.warping = false;
    this.G.autosave();
    await this.G.fadeTo(0, 420);
  }

  /** place the party at a new spot without a transition */
  teleportParty(x, z, dir) {
    this.pos.set(x, 0, z);
    const d = dir || this.dir;
    this.player.facingYaw = this.player.yaw = Math.atan2(...(DIRV[d] || DIRV.down));
    this._dir = d;
    this.world.yaw = yawOfDir(d);
    this.trail = this._initTrail(x, z, d);
    for (const f of this.followers) { f.catchup = false; f.ai = false; }
    this._placeFollowers(0);
    this.world.setFocus(this._focus(), true);
  }
  /** make an NPC walk to a point (cutscenes) */
  async walkNpc(id, x, z, speed = 2.2) {
    const n = this.npcs.find((q) => q.def.id === id);
    if (!n) return;
    await this.walkActor(n.actor, x, z, speed, (nx, nz) => { n.x = nx; n.z = nz; });
  }
  async walkActor(actor, x, z, speed = 2.6, onMove) {
    const p = actor.position;
    const dx = x - p.x, dz = z - p.z, len = Math.hypot(dx, dz);
    if (len < 0.02) return;
    const ms = (len / speed) * 1000;
    const sx = p.x, sz = p.z;
    actor.moving = true;
    actor.faceVec(dx, dz);
    await tween(ms, (t) => { const k = t; p.x = sx + dx * k; p.z = sz + dz * k; onMove && onMove(p.x, p.z); });
    actor.moving = false;
  }
  /** move the leader (and followers following the trail) */
  async walkParty(x, z, speed = 3.2) {
    const a = this.player;
    const sx = a.position.x, sz = a.position.z;
    const dx = x - sx, dz = z - sz, len = Math.hypot(dx, dz);
    if (len < 0.02) return;
    a.faceVec(dx, dz); a.moving = true;
    for (const f of this.followers) f.ai = false;
    await tween((len / speed) * 1000, (t) => {
      a.position.x = sx + dx * t; a.position.z = sz + dz * t;
      this.trail.unshift({ x: a.position.x, z: a.position.z }); if (this.trail.length > 240) this.trail.length = 240;
      this._placeFollowers(0);
    });
    a.moving = false;
  }
  face(dir) { this.player.facingYaw = Math.atan2(...(DIRV[dir] || DIRV.down)); this._dir = dir; }
  hideNpc(n, hide) {
    n.hidden = hide;
    n.actor.group.visible = !hide;
  }
  removeNpc(id) {
    const i = this.npcs.findIndex((q) => q.def.id === id);
    if (i < 0) return;
    const n = this.npcs[i];
    this.world.remove(n.actor.group);
    this.npcs.splice(i, 1); this.things.splice(this.things.indexOf(n), 1);
  }
  npc(id) { return this.npcs.find((q) => q.def.id === id); }
}
