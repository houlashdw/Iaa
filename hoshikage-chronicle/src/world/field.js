// Exploration mode: walking, collision, NPCs, chests, exits, triggers and random encounters.
import * as THREE from 'three';
import { Actor } from './actors.js';
import { model, loadSprite } from '../core/assets.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { state, flag, setFlag, addItem } from '../state.js';
import { CHARS } from '../data/characters.js';
import { MAPS } from '../data/maps.js';
import { ZONES } from '../data/enemies.js';
import { rand, clamp, tween, easeInOut } from '../core/util.js';
import { h, root } from '../ui/ui.js';
import { itemInfo } from '../data/items.js';

const PR = 0.27; // player radius
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

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
    this.dir = 'down';
    this.t = 0;
    this.steps = 0;
    this.stepsToEnc = 20;
    this.prompt = h('div', 'prompt hidden', '✦');
    root.appendChild(this.prompt);
    this.target = null;
    input.field = (a) => this.onAction(a);
  }
  get leader() { return this.player; }
  get pos() { return this.player.position; }

  // ------------------------------------------------------------ loading
  async enter(mapId, x, z, dir = 'down', { silent = false } = {}) {
    const G = this.G;
    const def = MAPS[mapId];
    if (!def) throw new Error('unknown map ' + mapId);
    this.active = false;
    this.hidePrompt();
    // prepare sprites for NPCs (lazy-loaded)
    const keys = (def.npcs || []).filter((n) => !n.cond || n.cond()).map((n) => n.sprite);
    await Promise.all(keys.map((k) => loadSprite(k)));
    // remove everything the previous map left in the scene
    for (const n of this.npcs) { this.world.remove(n.actor.group); n.actor.dispose(); }
    for (const c of this.chests) this.world.remove(c.mesh);
    const b = await this.world.load(def);
    this.def = def; this.b = b;
    state.map = { id: mapId, x, z, dir };
    this.things = []; this.npcs = []; this.chests = []; this.trail = [];
    this._spawnNpcs(); this._spawnChests();
    this.buildParty(x, z, dir);
    this.world.setFocus(this._focus(), true);
    this.stepsToEnc = rand(def.encounter?.rate?.[0] || 18, def.encounter?.rate?.[1] || 32) + 8;
    G.gfx.setScene(this.world.scene, this.world.camera);
    G.gfx.setGrade({ focus: 0.5, band: 0.2, amount: 1.5 });
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
    for (const a of [this.player, ...this.followers]) if (a) this.world.remove(a.group);
    const ids = state.party.slice(0, 4);
    const mk = (id) => {
      const c = CHARS[id];
      const a = new Actor({ height: c.height, tex: { front: c.sprite, back: c.sprite + '_back', right: c.sprite + '_right' }, tint: this.world.mood.sprite });
      a.id = id;
      this.world.add(a.group);
      return a;
    };
    this.player = mk(ids[0]);
    this.player.position.set(x, 0, z);
    this.player.setDir(dir);
    this.dir = dir;
    this.followers = ids.slice(1).map(mk);
    this.trail = this._initTrail(x, z, dir);
    this._placeFollowers(0);
    this.followers.forEach((f) => { f.setDir(dir); f.moving = false; });
  }
  /** a short trail behind the leader so followers stand in a neat line */
  _initTrail(x, z, dir) {
    const [vx, vz] = DIRV[dir] || DIRV.down;
    const t = [];
    for (let i = 0; i < 48; i++) t.push({ x: x - vx * 0.12 * i, z: z - vz * 0.12 * i });
    return t;
  }
  _focus() {
    const w = this.b.w, hh = this.b.h, p = this.player.position;
    return new THREE.Vector3(clamp(p.x, Math.min(8.5, w / 2), Math.max(w - 8.5, w / 2)), 0, clamp(p.z, Math.min(5.5, hh / 2), Math.max(hh - 6, hh / 2)));
  }

  // ------------------------------------------------------------ collision
  blockedAt(x, z, ignore) {
    const b = this.b;
    for (const [dx, dz] of [[-PR, -PR], [PR, -PR], [-PR, PR], [PR, PR]]) if (b.isBlocked(Math.floor(x + dx), Math.floor(z + dz))) return true;
    for (const t of this.things) {
      if (t === ignore || (t.kind !== 'npc' && t.kind !== 'chest')) continue;
      if (t.kind === 'npc' && t.def.ghost) continue;
      const r = t.r + PR - 0.1;
      if ((t.x - x) ** 2 + (t.z - z) ** 2 < r * r) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ input
  onAction(a) {
    if (!this.active || this.busy || this.G.paused) return false;
    if (a === 'ok') { if (this.target) this.interact(this.target); return true; }
    if (a === 'menu' || a === 'cancel') { this.G.openMenu(); return true; }
    return false;
  }
  async interact(t) {
    if (t.kind === 'chest') return this.openChest(t);
    const run = t.def.talk || t.def.run;
    if (!run) return;
    if (t.kind === 'npc') { const dx = this.pos.x - t.x; const a = t.actor; if (Math.abs(dx) > 0.2) a.setFlip(dx > 0 ? 1 : -1); }
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
  hidePrompt() { this.prompt.classList.add('hidden'); this.target = null; }
  _updatePrompt() {
    let best = null, bd = 1e9;
    const [fx, fz] = DIRV[this.dir];
    for (const t of this.things) {
      if (t.kind === 'npc' && t.def.noTalk) continue;
      const dx = t.x - this.pos.x, dz = t.z - this.pos.z, d = Math.hypot(dx, dz);
      const reach = (t.r || 0.5) + 0.85;
      if (d > reach) continue;
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      if (dot < 0.15 && d > 0.9) continue;
      if (d < bd) { bd = d; best = t; }
    }
    this.target = best;
    if (!best) { this.prompt.classList.add('hidden'); return; }
    const top = new THREE.Vector3(best.x, (best.actor ? best.actor.height : 1) + 0.35, best.z);
    const p = this.G.gfx.project(top);
    this.prompt.classList.remove('hidden');
    this.prompt.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
    this.prompt.textContent = best.kind === 'chest' ? '✦ Open' : (best.def.prompt || '✦ Talk');
  }

  // ------------------------------------------------------------ update
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const free = !this.busy && !input.modal && !this.G.paused;
    const world = this.world;
    // ----- player movement
    let moved = 0;
    if (free) {
      const v = input.vec();
      if (v.x || v.y) {
        const sp = input.run ? 6.6 : 4.4;
        const p = this.pos;
        let nx = p.x + v.x * sp * dt, nz = p.z + v.y * sp * dt;
        const ox = p.x, oz = p.z;
        if (!this.blockedAt(nx, p.z)) p.x = nx;
        if (!this.blockedAt(p.x, nz)) p.z = nz;
        moved = Math.hypot(p.x - ox, p.z - oz);
        this.player.moving = moved > 0.0005;
        this.dir = Math.abs(v.x) > Math.abs(v.y) * 1.15 ? (v.x > 0 ? 'right' : 'left') : (v.y > 0 ? 'down' : 'up');
        this.player.setDir(this.dir);
      } else this.player.moving = false;
    } else this.player.moving = false;
    // trail for followers
    const last = this.trail[0];
    if (moved > 0 && (this.pos.x - last.x) ** 2 + (this.pos.z - last.z) ** 2 > 0.04) {
      this.trail.unshift({ x: this.pos.x, z: this.pos.z });
      if (this.trail.length > 240) this.trail.length = 240;
    }
    this._placeFollowers(dt);
    // ----- steps / encounters / triggers
    if (moved > 0) {
      this.steps += moved; state.steps += moved;
      if (this.def.encounter && !flag('noenc') && this.steps >= 1) {
        const n = Math.floor(this.steps); this.steps -= n; this.stepsToEnc -= n;
        if (this.stepsToEnc <= 0) { this._encounter(); return this._finish(dt); }
      }
    }
    if (free) this._checkTriggers(moved > 0);
    this._npcs(dt);
    this._finish(dt);
    if (free) this._updatePrompt(); else if (!this.busy) this.hidePrompt();
    state.play += dt;
  }
  _finish(dt) {
    const world = this.world;
    this.player.update(dt); this.followers.forEach((f) => f.update(dt));
    for (const n of this.npcs) n.actor.update(dt);
    for (const c of this.chests) c.mesh.position.y = 0;
    world.setFocus(this._focus());
    world.update(dt);
  }
  _placeFollowers(dt) {
    let acc = 0, ti = 0;
    for (let i = 0; i < this.followers.length; i++) {
      const need = (i + 1) * 0.95;
      let cur = this.trail[0], a = cur, bpt = cur;
      acc = 0;
      for (ti = 0; ti < this.trail.length - 1; ti++) {
        const p0 = this.trail[ti], p1 = this.trail[ti + 1];
        const seg = Math.hypot(p0.x - p1.x, p0.z - p1.z);
        if (acc + seg >= need) { const k = (need - acc) / (seg || 1); a = p0; bpt = p1; cur = { x: p0.x + (p1.x - p0.x) * k, z: p0.z + (p1.z - p0.z) * k }; break; }
        acc += seg; cur = p1; a = p0; bpt = p1;
      }
      const f = this.followers[i];
      const dx = cur.x - f.position.x, dz = cur.z - f.position.z;
      const mv = Math.hypot(dx, dz);
      f.moving = mv > 0.012;
      f.position.x = cur.x; f.position.z = cur.z;
      if (mv > 0.012) {
        const d = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
        f.setDir(d);
      } else if (!this.player.moving) f.setDir(this.dir === 'up' ? 'up' : 'down');
    }
  }
  _npcs(dt) {
    for (const n of this.npcs) {
      const d = n.def;
      n.actor.moving = false;
      if (!d.wander || this.busy) continue;
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
          if (ok) { n.x = nx; n.z = nz; n.actor.position.set(nx, 0, nz); n.actor.moving = true; if (Math.abs(dx) > 0.01) n.actor.setFlip(dx > 0 ? 1 : -1); } else n.tgt = null;
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

  // ------------------------------------------------------------ encounters
  async _encounter() {
    const enc = this.def.encounter;
    this.stepsToEnc = rand(enc.rate?.[0] || 18, enc.rate?.[1] || 32);
    const zoneName = typeof enc.zone === 'function' ? enc.zone() : enc.zone;
    const table = ZONES[zoneName];
    if (!table) return;
    const tot = table.reduce((s, e) => s + e[0], 0);
    let r = Math.random() * tot, group = table[0][1];
    for (const [w, e] of table) { if ((r -= w) <= 0) { group = e; break; } }
    this.busy = true; this.player.moving = false; this.hidePrompt();
    const res = await this.G.startBattle({ enemies: group, stage: enc.stage || this.def.stage || 'field', canFlee: true });
    this.busy = false;
    if (res === 'defeat') return;
  }
  /** place the party at a new spot without a transition */
  teleportParty(x, z, dir) {
    this.pos.set(x, 0, z);
    this.dir = dir || this.dir; this.player.setDir(this.dir);
    this.trail = this._initTrail(x, z, this.dir);
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
    if (actor.keys && actor.keys.right) actor.setDir(Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up'));
    else if (Math.abs(dx) > 0.01) actor.setFlip(dx > 0 ? 1 : -1);
    await tween(ms, (t) => { const k = t; p.x = sx + dx * k; p.z = sz + dz * k; onMove && onMove(p.x, p.z); });
    actor.moving = false;
  }
  /** move the leader (and followers following the trail) */
  async walkParty(x, z, speed = 3.2) {
    const a = this.player;
    const sx = a.position.x, sz = a.position.z;
    const dx = x - sx, dz = z - sz, len = Math.hypot(dx, dz);
    if (len < 0.02) return;
    this.dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
    a.setDir(this.dir); a.moving = true;
    await tween((len / speed) * 1000, (t) => {
      a.position.x = sx + dx * t; a.position.z = sz + dz * t;
      this.trail.unshift({ x: a.position.x, z: a.position.z }); if (this.trail.length > 240) this.trail.length = 240;
      this._placeFollowers(0);
    });
    a.moving = false;
  }
  face(dir) { this.dir = dir; this.player.setDir(dir); }
  removeNpc(id) {
    const i = this.npcs.findIndex((q) => q.def.id === id);
    if (i < 0) return;
    const n = this.npcs[i];
    this.world.remove(n.actor.group);
    this.npcs.splice(i, 1); this.things.splice(this.things.indexOf(n), 1);
  }
  npc(id) { return this.npcs.find((q) => q.def.id === id); }
}
