// Real-time action combat, running inside the exploration world (no separate battle screen).
//  * roaming enemy groups spawn on every map that has an `encounter` table and attack when you come near
//  * you control one hero (attack combo, 5 skills, dodge roll, Star Burst); the other heroes fight by AI; Tab / Q switches hero
//  * scripted fights (`G.startBattle` / `G.bossBattle`) keep their old API so every story scene works unchanged
// Damage / stats / status rules are still the pure functions in battle/core.js.
import * as THREE from 'three';
import { Actor3D } from '../world/actor3d.js';
import { FX } from '../battle/fx.js';
import { Vfx } from './vfx.js';
import { Hud } from './hud.js';
import { moveOf, hotbar, BASIC, STAFF_ELEMENT, elColor } from './moves.js';
import { SKILLS, STATUS } from '../data/skills.js';
import { ITEMS, itemInfo } from '../data/items.js';
import { CHARS } from '../data/characters.js';
import { ENEMIES, ZONES } from '../data/enemies.js';
import { state, statsOf, gainExp, addItem, count, lastSlot, flag } from '../state.js';
import { computeHit, computeHeal, rewards, enemyCombatant } from '../battle/core.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { loadChar } from '../core/chars.js';
import { rand, clamp, sleep } from '../core/util.js';
import { h, root, esc, bar, pick } from '../ui/ui.js';
import { ptImg } from '../ui/portraits.js';

export const TUNE = {
  aggro: 9.5, leash: 32,
  eHp: 1.15, eDmg: 1.0, eCd: 2.3, eSpeed: 1.0,
  mpRegen: [0.7, 0.012], dodgeCd: 0.7, dodgeTime: 0.38, dodgeSpeed: 11.5, invuln: 0.32,
  aiCadence: 0.8, healKey: 1.0,
};
const ROLE = { haru: 'melee', ren: 'melee', daigo: 'melee', sylva: 'ranged', airi: 'healer', zeno: 'caster' };
const PREF = { melee: 1.7, ranged: 8, healer: 7, caster: 7 };
const RANGED_SHAPES = ['bolt', 'arrow', 'ground', 'rain', 'chain'];
// enemies' plain attack, expressed as a skill so the same casting code handles it
const ATK_SK = { id: 'attack', name: 'Attack', mp: 0, target: 'enemy', kind: 'phys', power: 100, el: 'none', hits: 1, fx: 'slash' };
const BASIC_MELEE = { shape: 'melee', range: 2.1, arc: 1.9, windup: 0.5, recover: 0.55, id: 'attack', sk: ATK_SK, hits: 1, cd: 0 };
const BASIC_SHOT = { shape: 'arrow', speed: 15, range: 17, windup: 0.65, recover: 0.5, id: 'attack', sk: ATK_SK, hits: 1, cd: 0 };
const BASIC_BOLT = { shape: 'bolt', speed: 11, range: 16, windup: 0.7, recover: 0.5, id: 'attack', sk: { ...ATK_SK, kind: 'mag', fx: 'impact' }, hits: 1, cd: 0 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const v3 = new THREE.Vector3();

export class Combat {
  constructor(G, F) {
    this.G = G; this.F = F;
    this.world = null;
    this.party = []; this.mobs = [];
    this.ctrl = null;
    this.projs = []; this.later = [];
    this.fx = null; this.vfx = null;
    this.hud = new Hud(this);
    this.star = 0;
    this.engaged = false; this.scripted = null;
    this.autoToggle = false;
    this.timeScale = 1; this.slowT = 0; this.hitstop = 0;
    this.time = 0; this.uid = 1;
    this.eventBusy = false; this.resultBusy = false;
    this.spawnDefs = [];
    this.fightMusic = 'battle_theme_a';
    this.spoils = [];
    this.snap = null;
    this.quickCd = 0;
  }
  get autoLeader() { return this.autoToggle || !!(this.G.cheat && this.G.cheat.auto); }
  hudVisible() { return this.F.active && (!this.F.busy || !!this.scripted) && !this.G.paused && !input.modal && !this.eventBusy && !this.resultBusy && (this.mobs.length > 0 || !!this.scripted); }
  bossEnt() { const m = this.mobs.find((e) => e.boss && e.alive && e.engaged); return m || null; }
  alive(list) { return list.filter((e) => e.alive); }

  // ===================================================================== setup / map
  /** called by Field.enter after the party was built; spawns the roaming enemy groups of the map */
  async setupMap(def, b) {
    const F = this.F;
    this.world = F.world; this.b = b;
    this.clearAll();
    if (!this.fx) { this.fx = new FX(F.world); this.vfx = new Vfx(F.world.scene); }
    this.vfx.clear();
    this.star = 0; this.engaged = false; this.scripted = null; this.ending = false;
    this.spoils = []; this.snap = null;
    const enc = def.encounter;
    if (!enc || flag('noenc')) return;
    const zone = typeof enc.zone === 'function' ? enc.zone() : enc.zone;
    const table = ZONES[zone];
    if (!table) return;
    await Promise.all([...new Set(table.flatMap(([, ids]) => ids.map((id) => ENEMIES[id].sprite)))].map((k) => loadChar(k)));
    const cells = this._reachable();
    const n = clamp(Math.round(cells.length / 120), 2, 5);
    const spots = [];
    const ex = (def.exits || []).map((e) => [e.rect[0] + e.rect[2] / 2, e.rect[1] + e.rect[3] / 2]);
    const trg = (def.triggers || []).map((t) => t.rect);
    const near = (x, z, list, r) => list.some(([a, c]) => Math.hypot(a - x, c - z) < r);
    const npcs = F.npcs.map((q) => [q.x, q.z]);
    const p = F.pos;
    let guard = 0;
    while (spots.length < n && guard++ < 400 && cells.length) {
      const [cx, cz] = cells[Math.floor(Math.random() * cells.length)];
      const x = cx + 0.5, z = cz + 0.5;
      if (Math.hypot(x - p.x, z - p.z) < 13 || near(x, z, ex, 5) || near(x, z, npcs, 4.5) || near(x, z, spots, 9)) continue;
      if (trg.some(([a, c, w, d]) => x > a - 2.5 && x < a + w + 2.5 && z > c - 2.5 && z < c + d + 2.5)) continue;
      spots.push([x, z]);
    }
    const tot = table.reduce((s, e) => s + e[0], 0);
    this.spawnDefs = spots.map(([x, z], gi) => {
      let r = Math.random() * tot, ids = table[0][1];
      for (const [w, e] of table) { if ((r -= w) <= 0) { ids = e; break; } }
      return { gi, x, z, ids };
    });
    for (const d of this.spawnDefs) this._spawnGroup(d);
  }
  _reachable() {
    const b = this.b, F = this.F;
    const seen = new Uint8Array(b.w * b.h);
    const sx = Math.floor(F.pos.x), sz = Math.floor(F.pos.z);
    const out = [], q = [[sx, sz]];
    seen[sz * b.w + sx] = 1;
    while (q.length) {
      const [x, z] = q.pop();
      out.push([x, z]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (b.isBlocked(nx, nz) || seen[nz * b.w + nx]) continue;
        seen[nz * b.w + nx] = 1; q.push([nx, nz]);
      }
    }
    // keep cells with some breathing room
    return out.filter(([x, z]) => ![[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].some(([dx, dz]) => b.isBlocked(x + dx, z + dz)));
  }
  _spawnGroup(d, engaged = false) {
    const members = [];
    d.ids.forEach((id, i) => {
      const a = (i / d.ids.length) * Math.PI * 2 + Math.random();
      let x = d.x + (i ? Math.cos(a) * 1.7 : 0), z = d.z + (i ? Math.sin(a) * 1.7 : 0);
      if (this.b.isBlocked(Math.floor(x), Math.floor(z))) { x = d.x; z = d.z; }
      members.push(this.makeEnemy(id, x, z, 'g' + d.gi, engaged));
    });
    return members;
  }
  clearAll() {
    for (const e of this.mobs) { if (e.actor) this.F.world.remove(e.actor.group); }
    this.mobs = []; this.projs = []; this.later = [];
    if (this.vfx) this.vfx.clear();
    this.hud.clearEnemyBars();
    for (const f of this.F.followers || []) f.ai = false;
  }

  // ===================================================================== entities
  _base(o) {
    return Object.assign({ status: {}, weak: [], resist: [], immune: [], act: null, cd: {}, stun: 0, hitstun: 0, invuln: 0, kvx: 0, kvz: 0, thinkCd: 0, dodgeCd: 0, comboI: 0, comboT: 0, atkCd: 0, radius: 0.35, aiT: 0, tick: 0, buffed: false }, o);
  }
  /** wrap the party's field actors as combatants (HP / MP live in state.roster so menus and combat never disagree) */
  bindParty() {
    const F = this.F;
    this.party = F.party.map((a) => this.makeParty(a.id, a));
    this.ctrl = this.party[F.ctrl];
    this.hud.partyKey = '';
    this.hud.skillKey = '';
  }
  makeParty(id, actor) {
    const c = CHARS[id];
    const e = this._base({ id, side: 'party', name: c.name, sprite: c.sprite, height: c.height, color: c.color, actor, weapon: c.weapon, role: ROLE[id] || 'melee', radius: 0.32, burst: c.burst });
    Object.defineProperties(e, {
      hp: { get: () => state.roster[id].hp, set: (v) => { state.roster[id].hp = v; }, enumerable: true },
      mp: { get: () => state.roster[id].mp, set: (v) => { state.roster[id].mp = v; }, enumerable: true },
      lv: { get: () => state.roster[id].lv, enumerable: true },
      alive: { get: () => state.roster[id].hp > 0, enumerable: true },
    });
    this.refreshStats(e);
    actor.ent = e; actor.ai = false;
    return e;
  }
  refreshStats(e) {
    const s = statsOf(e.id), k = (this.G.cheat && this.G.cheat.atk) || 1;
    e.maxHp = s.maxHp; e.maxMp = s.maxMp; e.atk = s.atk * k; e.mag = s.mag * k; e.def = s.def; e.res = s.res; e.spd = s.spd;
  }
  makeEnemy(eid, x, z, group, engaged = false) {
    const c = enemyCombatant(eid, this.uid++);
    const info = ENEMIES[eid];
    const e = this._base({ ...c, status: {}, group, home: { x, z }, engaged, armor: !!c.boss || ['brute', 'tank'].includes(info.role) });
    const G = this.G, diff = G.difficulty || 1;
    e.maxHp = e.hp = Math.max(1, Math.round(c.hp * TUNE.eHp * diff));
    if (G.cheat && G.cheat.hp) e.maxHp = e.hp = Math.min(e.hp, G.cheat.hp);
    e.atk = Math.round(c.atk * TUNE.eDmg * (0.85 + diff * 0.15)); e.mag = Math.round(c.mag * TUNE.eDmg * (0.85 + diff * 0.15));
    e.actor = new Actor3D({ height: c.height, tex: { front: c.sprite }, tint: this.F.world.mood.sprite });
    e.actor.position.set(x, 0, z);
    e.actor.facingYaw = e.actor.yaw = Math.random() * Math.PI * 2;
    this.F.world.add(e.actor.group);
    e.radius = clamp(c.height * 0.17 + 0.12, 0.35, 0.95);
    e.speed = clamp(2.2 + c.spd * 0.07, 2.4, 4.6) * TUNE.eSpeed * (c.boss ? 0.92 : 1) * (info.role === 'brute' ? 0.85 : 1);
    e.moves = this._movesOf(e, info);
    e.thinkCd = 0.4 + Math.random() * 0.8;
    e.wanderT = Math.random() * 3; e.wander = null;
    e.ranged = e.moves.every((m) => RANGED_SHAPES.includes(m.shape) || m.shape === 'support');
    this.mobs.push(e);
    return e;
  }
  _movesOf(e, info) {
    const others = info.skills.filter(([id]) => id !== 'attack').map(([id]) => moveOf(id)).filter(Boolean);
    const rangedBasic = others.length && others.filter((m) => m.shape !== 'support').every((m) => RANGED_SHAPES.includes(m.shape));
    const basic = rangedBasic ? (others.some((m) => m.sk && m.sk.kind === 'mag') ? BASIC_BOLT : BASIC_SHOT) : BASIC_MELEE;
    return info.skills.map(([id, w]) => {
      const m = id === 'attack' ? { ...basic } : moveOf(id);
      return m ? Object.assign(m, { w }) : null;
    }).filter(Boolean);
  }

  // ===================================================================== helpers
  hostiles(e) { return e.side === 'party' ? this.mobs.filter((m) => m.alive) : this.party.filter((p) => p.alive); }
  friends(e) { return e.side === 'party' ? this.party : this.mobs.filter((m) => m.alive); }
  nearest(e, list, maxD = 1e9) {
    let best = null, bd = maxD;
    const p = e.actor.position;
    for (const t of list) { if (t === e) continue; const d = Math.hypot(t.actor.position.x - p.x, t.actor.position.z - p.z); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  cone(att, list, x, z, yaw, range, arc) {
    return list.filter((t) => {
      const dx = t.actor.position.x - x, dz = t.actor.position.z - z, d = Math.hypot(dx, dz);
      if (d > range + t.radius) return false;
      if (d < t.radius + 0.35) return true;
      return Math.abs(wrap(Math.atan2(dx, dz) - yaw)) <= arc / 2 + Math.atan2(t.radius, d);
    });
  }
  circle(list, x, z, r) { return list.filter((t) => Math.hypot(t.actor.position.x - x, t.actor.position.z - z) < r + t.radius); }
  hand(e, k = 0.62) { const p = e.actor.position, y = e.actor.facingYaw; return v3.set(p.x + Math.sin(y) * 0.5, e.height * k, p.z + Math.cos(y) * 0.5).clone(); }
  chest(e, k = 0.6) { const p = e.actor.position; return new THREE.Vector3(p.x, e.height * k, p.z); }
  sfx(n, o) { audio.sfx(n, o); }
  popup(e, text, cls, tag) { this.hud.popup(e, text, cls, tag); }
  addStar(n) { this.star = clamp(this.star + n, 0, 100); }
  cdFrac(e, id) { const m = moveOf(id); const c = e.cd[id] || 0; return m && m.cd ? clamp(c / m.cd, 0, 1) : 0; }
  later_(t, fn) { this.later.push({ t, fn }); }

  // ===================================================================== acts (timed action scripts)
  startAct(e, a) {
    this.cancelAct(e);
    a.t = 0; a.ev = (a.ev || []).map((x) => ({ ...x, done: false })); e.act = a; return a;
  }
  cancelAct(e) {
    const a = e.act; if (!a) return;
    (a.tele || []).forEach((t) => t.remove());
    if (a.onCancel) a.onCancel();
    e.act = null;
  }
  tickAct(e, dt) {
    const a = e.act; if (!a) return false;
    const t0 = a.t; a.t += dt;
    if (a.dash && a.t > a.dash.t0 && t0 < a.dash.t1) {
      const k = (Math.min(a.t, a.dash.t1) - Math.max(t0, a.dash.t0)) / (a.dash.t1 - a.dash.t0);
      this.F.tryMove(e.actor.position, a.dash.dx * k, a.dash.dz * k, Math.min(e.radius, 0.4), e.side !== 'party');
      e.actor.moving = true;
    }
    for (const ev of a.ev) if (!ev.done && a.t >= ev.at) { ev.done = true; ev.fn(a); if (e.act !== a) return true; }
    if (a.t >= a.dur) {
      (a.tele || []).forEach((t) => t.remove());
      e.act = null; e.actor.moving = false;
      if (a.onEnd) a.onEnd();
    }
    return true;
  }
  dashTo(a, e, yaw, dist, t0, t1) { a.dash = { t0, t1, dx: Math.sin(yaw) * dist, dz: Math.cos(yaw) * dist }; }

  // ===================================================================== damage
  strike(att, tgt, sk, o = {}) {
    if (!tgt.alive) return false;
    if (tgt.invuln > 0) {
      if (tgt.side === 'party' && tgt.act && tgt.act.type === 'dodge' && !tgt.perfect) this.perfectDodge(tgt);
      return false;
    }
    if (sk && sk.kind === 'debuff') { this.applyStatusFrom(att, tgt, sk); this.popup(tgt, sk.name, 'status'); return true; }
    let r;
    if (o.pseudo) r = computeHit(att, tgt, o.pseudo);
    else r = computeHit(att, tgt, sk);
    let dmg = Math.max(1, Math.round(r.dmg * (o.mul ?? 1) * (att.side === 'party' ? 1 : 1)));
    this.damage(tgt, dmg, { ...r, from: att, kb: o.kb || 0, big: !!(o.big || (sk && sk.big)), sk, hitIdx: o.hitIdx });
    if (sk && sk.status) this.applyStatusFrom(att, tgt, sk);
    if (sk && sk.kind === 'drain') this.healEnt(att, Math.round(dmg * 0.5), true);
    return true;
  }
  applyStatusFrom(att, tgt, sk) {
    const s = sk.status; if (!s || !tgt.alive || tgt.immune.includes(s.id)) return;
    let ch = s.chance ?? 1;
    if (tgt.side === 'party' && s.id === 'stun') ch = Math.min(ch, 0.4);
    if (Math.random() > ch) return;
    this.addStatus(tgt, s.id, s.turns || 2);
    this.popup(tgt, STATUS[s.id].name, 'status');
  }
  addStatus(t, id, turns) {
    const dur = id === 'stun' ? (t.side === 'party' ? 0.95 : 1.4) : id === 'poison' ? 2.3 * turns : 4.5 * turns;
    t.status[id] = Math.max(t.status[id] || 0, dur);
    if (id === 'stun') { t.stun = Math.max(t.stun, dur); this.cancelAct(t); }
  }
  damage(t, dmg, info = {}) {
    const from = info.from;
    t.hp = Math.max(0, t.hp - dmg);
    const cls = t.side === 'party' ? 'hurt' : info.crit ? 'crit' : info.weak ? 'weak' : 'dmg';
    this.popup(t, String(dmg), cls + (info.big ? ' big' : ''), info.weak ? 'WEAK' : info.resist ? 'RESIST' : info.crit ? 'CRIT' : '');
    t.actor.flash = 1; t.actor.hit();
    this.sfx(t.side === 'party' ? 'hurt' : info.crit || info.big ? 'impact' : 'hit', { vol: t.side === 'party' ? 0.5 : 0.45, rate: 0.9 + Math.random() * 0.25 });
    if (from) {
      const dx = t.actor.position.x - from.actor.position.x, dz = t.actor.position.z - from.actor.position.z, l = Math.hypot(dx, dz) || 1;
      const kb = (info.kb || 0) * (t.armor ? 0.25 : 1) + (t.side === 'party' ? 1.2 : 0.4);
      t.kvx += (dx / l) * kb; t.kvz += (dz / l) * kb;
    }
    if (t.side === 'enemy') {
      if (from && from.side === 'party') this.addStar(0.9 + (info.sk ? 2.2 : 0) + Math.min(3, dmg / t.maxHp * 12));
      this.alertGroup(t, from);
      if (!t.armor && (info.big || info.crit || (info.sk && info.sk.kind !== 'heal')) && t.alive) { t.hitstun = Math.max(t.hitstun, info.big ? 0.5 : 0.3); if (t.act && !t.act.firm) this.cancelAct(t); }
      if (this.hitstop < 0.05 && (info.big || info.crit)) this.hitstop = 0.06;
      if (info.big) this.world.shake = Math.max(this.world.shake, 0.12);
    } else {
      this.addStar(1.6);
      if (t.alive && dmg >= t.maxHp * 0.07 && !(t.act && t.act.firm)) { t.hitstun = 0.28; this.cancelAct(t); }
      this.world.shake = Math.max(this.world.shake, 0.08);
    }
    if (t.hp <= 0) this.kill(t, from);
  }
  healEnt(t, amount, quiet) {
    if (!t.alive || amount <= 0) return 0;
    const a = Math.min(amount, t.maxHp - t.hp);
    t.hp += a;
    if (!quiet || a > 0) this.popup(t, '+' + a, 'heal');
    return a;
  }
  kill(t, from) {
    t.hp = 0; if (t.side === 'enemy') t.alive = false;
    this.cancelAct(t);
    t.stun = 0; t.hitstun = 0;
    if (t.side === 'enemy') {
      this.spoils.push(t);
      if (!this.mobs.some((m) => m.alive && m.group === t.group)) this.spawnDefs = this.spawnDefs.filter((d) => 'g' + d.gi !== t.group);
      this.sfx(t.boss ? 'big_kill' : 'kill', { vol: 0.65 });
      this.addStar(2);
      t.deadT = 0;
      this._fall(t, 1.2);
      this.fx.spark(this.chest(t, 0.5), 0xffe8b0, 10, 3.5, 0.08, 0.6);
      if (t.boss) { this.hitstop = 0.25; this.slowT = 0.9; this.world.shake = 0.4; }
    } else {
      this.sfx('downed', { vol: 0.6 });
      this._fall(t, 0.35);
      t.actor.ai = false;
      this.popup(t, 'KO', 'status');
      if (t === this.ctrl) this.autoSwitch();
    }
  }
  _fall(t, dur) {
    const a = t.actor; a.moving = false; a.dead = true;
    let k = 0;
    const step = () => { k += 1 / 60 / dur; const c = Math.min(1, k); a.mesh.rotation.x = -Math.PI / 2 * c * 0.92; a.mesh.position.y = 0.12 * c; if (c < 1 && a.dead) requestAnimationFrame(step); };
    step();
  }
  _rise(t) {
    const a = t.actor; a.dead = false; a.mesh.rotation.x = 0; a.mesh.position.y = 0;
    this.fx.rise(this.chest(t, 0.4), 0xfff2a0, 14, 0.8, 0.08, 1.0);
    this.vfx.column(a.position.x, a.position.z, 0xfff2b8, 0.7, 7, 0.55);
  }
  perfectDodge(t) {
    t.perfect = true; this.slowT = 0.45; this.addStar(7);
    this.popup(t, 'Perfect!', 'crit');
    this.sfx('level_up', { vol: 0.35, rate: 1.5 });
  }
  alertGroup(e, from) {
    if (e.side !== 'enemy') return;
    for (const m of this.mobs) if (m.alive && m.group === e.group && !m.engaged) this.engage(m, from);
    if (!e.engaged) this.engage(e, from);
    if (from) e.thr = from;
  }
  engage(m, from) { m.engaged = true; m.thinkCd = 0.35 + Math.random() * 0.5; if (from && from.side === 'party') m.thr = from; }

  // ===================================================================== player actions
  onAction(a) {
    const F = this.F, p = this.ctrl;
    if (!F.active || (F.busy && !this.scripted) || this.resultBusy || this.eventBusy || !p) return false;
    if (a === 'attack') { if (p.alive && !this.autoLeader) this.tryBasic(p); return true; }
    if (a === 'dodge') { if (!this.autoLeader) this.tryDodge(p); return true; }
    if (/^skill[1-5]$/.test(a)) { if (!this.autoLeader) this.trySkill(p, Number(a.slice(5)) - 1); return true; }
    if (a === 'burst') { if (!this.autoLeader) this.tryBurst(p); return true; }
    if (a === 'switch' || a === 'switchPrev') { this.switchChar(a === 'switch' ? 1 : -1); return true; }
    if (a === 'heal') { this.quickHeal(); return true; }
    if (a === 'auto') { this.autoToggle = !this.autoToggle; this.G.toast(this.autoToggle ? 'Auto-battle ON' : 'Auto-battle OFF'); return true; }
    return false;
  }
  switchChar(dir) {
    const F = this.F, n = F.party.length;
    for (let k = 1; k <= n; k++) {
      const i = (F.ctrl + dir * k + n * 4) % n;
      if (this.party[i] && this.party[i].alive) { if (F.setControlled(i)) { this.onSwitched(); this.sfx('confirm', { vol: 0.4, rate: 1.3 }); } return; }
    }
  }
  autoSwitch() { const i = this.party.findIndex((p) => p.alive); if (i >= 0 && this.F.setControlled(i)) this.onSwitched(); }
  onSwitched() {
    const old = this.ctrl;
    this.ctrl = this.party[this.F.ctrl];
    this.hud.skillKey = '';
    if (old && old !== this.ctrl) { old.actor.ai = this.engaged; old.thinkCd = 0.2; }
    this.ctrl.actor.ai = false;
    this.fx.rise(this.chest(this.ctrl, 0.3), this.ctrl.color ? parseInt(this.ctrl.color.slice(1), 16) : 0xffffff, 10, 0.7, 0.07, 0.8);
  }
  moveMod() {
    const p = this.ctrl;
    if (!p || !p.alive) return { freeze: true, speedMul: 0, faceLock: true };
    const a = p.act;
    if (!a) return { speedMul: 1, freeze: false, faceLock: false };
    return { speedMul: a.speedMul ?? 0.3, freeze: !!a.freeze, faceLock: a.faceLock ?? true };
  }
  controlLocked() {
    const p = this.ctrl;
    return (this.autoLeader && (this.engaged || !!this.scripted)) || !p || !p.alive || p.stun > 0 || p.hitstun > 0 || !!(p.act && p.act.lock);
  }
  /** point the character at the nearest foe in front, else keep the facing it has */
  aim(e, maxD = 7, wide = 1.5) {
    const list = this.hostiles(e);
    const p = e.actor.position, f = e.actor.facingYaw;
    let best = null, bs = 1e9;
    for (const t of list) {
      const dx = t.actor.position.x - p.x, dz = t.actor.position.z - p.z, d = Math.hypot(dx, dz);
      if (d > maxD) continue;
      const ang = Math.abs(wrap(Math.atan2(dx, dz) - f));
      if (ang > wide) continue;
      const s = d + ang * 2.5;
      if (s < bs) { bs = s; best = t; }
    }
    if (best) e.actor.facingYaw = Math.atan2(best.actor.position.x - p.x, best.actor.position.z - p.z);
    return best;
  }
  canAct(e) { return e.alive && e.stun <= 0 && e.hitstun <= 0 && !(e.act && e.act.lock); }
  tryDodge(p) {
    if (!p.alive || p.dodgeCd > 0 || p.stun > 0 || (p.act && p.act.type === 'burst')) return;
    const F = this.F, w = this.world;
    let yaw;
    const v = input.vec();
    if (!this.isAI(p) && (v.x || v.y)) { const sy = Math.sin(w.yaw), cy = Math.cos(w.yaw); yaw = Math.atan2(cy * v.x + sy * v.y, -sy * v.x + cy * v.y); }
    else yaw = p.actor.facingYaw + Math.PI;           // no direction held: hop backwards
    if (this.isAI(p) && p.dodgeYaw !== undefined) yaw = p.dodgeYaw;
    p.perfect = false;
    p.dodgeCd = TUNE.dodgeCd; p.invuln = TUNE.invuln;
    const keepFace = p.actor.facingYaw;
    const a = this.startAct(p, { type: 'dodge', dur: TUNE.dodgeTime, lock: true, freeze: true, firm: true, ev: [], onEnd: () => { p.actor.roll = 0; p.actor.facingYaw = p.actor.facingYaw; } });
    a.dodgeYaw = yaw;
    a.update = true;
    p.actor.facingYaw = yaw; p.actor.yaw = yaw;
    this.sfx('dash', { vol: 0.35, rate: 1.3 });
    this.vfx.ring(p.actor.position.x, p.actor.position.z, 0xcfe8ff, 0.3, 1.4, 0.3);
  }
  isAI(e) { return e.side !== 'party' || e !== this.ctrl || this.autoLeader; }
  tryBasic(p) {
    if (!this.canAct(p) || (p.act && p.act.type !== 'attack')) return false;
    if (p.act && p.act.type === 'attack' && p.act.t < p.act.dur * 0.55) return false;   // can chain near the end of a swing
    const W = BASIC[p.weapon] || BASIC.sword;
    const slow = this.isAI(p) && p !== this.ctrl;
    if (W.kind === 'melee') {
      const i = p.comboT > 0 ? p.comboI % W.combo.length : 0;
      const c = W.combo[i];
      p.comboI = i + 1; p.comboT = c.t + 0.45;
      this.aim(p, 6, 2.2);
      const yaw = p.actor.facingYaw;
      const a = this.startAct(p, { type: 'attack', dur: c.t, speedMul: 0.3, faceLock: true, ev: [{ at: c.hit, fn: () => this.meleeHit(p, null, c, yaw) }] });
      this.dashTo(a, p, yaw, c.lunge, 0, c.hit + 0.04);
      p.actor.attack();
      this.sfx('dash', { vol: 0.18, rate: 1.4 + i * 0.1 });
      if (i === W.combo.length - 1) p.comboI = 0;
      p.atkCd = slow ? TUNE.aiCadence : 0;
      return true;
    }
    this.aim(p, 22, 1.2);
    const yaw = p.actor.facingYaw;
    p.actor.attack();
    this.startAct(p, { type: 'attack', dur: W.t, speedMul: 0.4, faceLock: true, ev: [{ at: 0.1, fn: () => {
      if (W.kind === 'shoot') this.spawnProj(p, null, { speed: W.speed, range: W.range, arrow: true, color: W.fx, mul: W.mul, yaw, pseudo: { kind: 'phys', power: 100, el: 'none' } });
      else {
        const [el, col] = STAFF_ELEMENT[p.id] || ['light', 0xfff0a8];
        this.spawnProj(p, null, { speed: W.speed, range: W.range, color: col, mul: W.mul, yaw, homing: true, pseudo: { kind: 'mag', power: 100, el }, size: 0.24 });
      }
      this.sfx('shoot', { vol: 0.3, rate: W.kind === 'bolt' ? 1.4 : 1 });
    } }] });
    p.atkCd = slow ? TUNE.aiCadence : 0;
    return true;
  }
  meleeHit(p, mv, c, yaw) {
    const x = p.actor.position.x, z = p.actor.position.z;
    const list = this.hostiles(p);
    const hit = this.cone(p, list, x, z, yaw, c.range, c.arc);
    const W = BASIC[p.weapon];
    this.vfx.arc(x, p.height * 0.55, z, yaw, c.range, c.arc, mv ? elColor(mv.sk.el) : (W && W.fx) || 0xfff2c0);
    for (const t of hit) {
      this.strike(p, t, mv ? mv.sk : null, { mul: c.mul ?? 1, kb: c.kb || 1.2, hitIdx: 0 });
      this.fx.spark(this.chest(t, 0.6), 0xffe8b0, 6, 3.5, 0.07, 0.35);
    }
    if (hit.length) this.sfx('hit', { vol: 0.1 });
  }
  trySkill(p, slot) {
    const bar = hotbar(p.id)[slot];
    if (!bar || bar.locked) { this.sfx('hurt', { vol: 0.2 }); return false; }
    return this.useSkill(p, bar.id);
  }
  useSkill(p, id) {
    const mv = moveOf(id);
    if (!mv || !this.canAct(p) || (p.act && p.act.type !== 'attack')) return false;
    const sk = mv.sk;
    if ((p.cd[id] || 0) > 0) { this.sfx('hurt', { vol: 0.15 }); return false; }
    if (p.mp < sk.mp) { this.popup(p, 'No MP', 'status'); this.sfx('hurt', { vol: 0.2 }); return false; }
    p.mp -= sk.mp; p.cd[id] = mv.cd;
    this.castMove(p, mv);
    return true;
  }
  quickHeal() {
    if (this.quickCd > 0) return;
    const p = this.party.filter((x) => x.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!p || p.hp >= p.maxHp) { this.G.toast('Everyone is healthy.'); return; }
    const need = p.maxHp - p.hp;
    const heals = Object.keys(state.inv).filter((i) => ITEMS[i] && ITEMS[i].kind === 'heal' && count(i) > 0).sort((a, b) => ITEMS[a].amount - ITEMS[b].amount);
    if (!heals.length) { this.G.toast('No healing items.'); return; }
    const id = heals.find((i) => ITEMS[i].amount >= need) || heals[heals.length - 1];
    addItem(id, -1);
    this.healEnt(p, ITEMS[id].amount);
    this.fx.heal(this.chest(p, 0.7));
    this.sfx('revive', { vol: 0.5 });
    this.G.toast(`${p.name}: ${ITEMS[id].name}`, 'good');
    this.quickCd = TUNE.healKey;
  }
  /** an item chosen in the pause menu while enemies are around (bombs / star dust) */
  useBattleItem(id) {
    const it = ITEMS[id]; if (!it) return false;
    if (it.kind === 'star') { this.addStar(it.amount); this.popup(this.ctrl, 'STAR +' + it.amount, 'status'); addItem(id, -1); return true; }
    if (it.kind === 'bomb') {
      const c = this.ctrl;
      for (const t of this.hostiles(c)) {
        const r = computeHit({ mag: 40 + c.lv * 3, atk: 1, spd: 1, status: {} }, t, { kind: 'mag', power: it.amount, el: it.el });
        this.damage(t, r.dmg, { ...r, from: c, big: true });
        this.fx.fire(this.chest(t, 0.8), false);
      }
      addItem(id, -1); return true;
    }
    return false;
  }

  // ===================================================================== casting (shared by players, allies, enemies)
  castMove(e, mv, target) {
    const sk = mv.sk, ally = e.side === 'party';
    const w = mv.windup ?? 0.25, rec = mv.recover ?? 0.25;
    const foes = this.hostiles(e);
    if (!target && mv.shape !== 'support') { target = ally ? this.aim(e, mv.range || 24, 1.6) : null; }
    const p = e.actor.position;
    if (target) e.actor.facingYaw = Math.atan2(target.actor.position.x - p.x, target.actor.position.z - p.z);
    const yaw = e.actor.facingYaw;
    const tele = [];
    const act = { type: 'cast', dur: w + rec + (mv.hitGap ? mv.hitGap * (mv.hits - 1) : 0) + (mv.delay && !ally ? mv.delay : 0), speedMul: ally ? 0.35 : 0, faceLock: true, firm: !ally && e.armor, tele, ev: [] };
    const big = !!sk.big;
    if (mv.shape === 'melee') e.actor.attack(0.45); else e.actor.cast();
    const col = elColor(sk.el);
    const telegraph = (x, z, y2, range, arc, life) => { if (!ally) tele.push(this.vfx.telegraph(x, z, y2, range, arc, life, big ? 0xff2a2a : 0xff5a3a)); };
    switch (mv.shape) {
      case 'melee': {
        telegraph(p.x, p.z, yaw, mv.range, mv.arc, w);
        const hits = mv.hits || 1;
        for (let i = 0; i < hits; i++) act.ev.push({ at: w + i * (mv.hitGap || 0), fn: () => {
          const y2 = e.actor.facingYaw;
          const hit = this.cone(e, this.hostiles(e), e.actor.position.x, e.actor.position.z, ally ? y2 : yaw, mv.range, mv.arc);
          this.vfx.arc(e.actor.position.x, e.height * 0.55, e.actor.position.z, ally ? y2 : yaw, mv.range, mv.arc, col, 0.24);
          for (const t of hit) {
            this.strike(e, t, sk, { mul: ally ? 1 / Math.sqrt(hits) : 1, kb: big ? 4 : 1.6, hitIdx: i, big: big && i === hits - 1 });
            this.skillFx(sk, this.chest(t, 0.6), big);
          }
          if (mv.shock && i === hits - 1) { this.vfx.ring(e.actor.position.x + Math.sin(yaw) * mv.range * 0.6, e.actor.position.z + Math.cos(yaw) * mv.range * 0.6, col, 0.4, mv.range * 0.9, 0.35); this.world.shake = Math.max(this.world.shake, 0.18); }
          this.sfx(big ? 'impact' : 'hit', { vol: 0.3 });
        } });
        if (mv.lunge) this.dashTo(act, e, yaw, mv.lunge, 0, w + 0.05); else if (!ally) this.dashTo(act, e, yaw, 0.7, w - 0.12, w + 0.04);
        break;
      }
      case 'nova': {
        telegraph(p.x, p.z, 0, mv.radius, Math.PI * 2, w);
        act.ev.push({ at: w, fn: () => {
          const x = e.actor.position.x, z = e.actor.position.z;
          this.vfx.ring(x, z, col, 0.5, mv.radius, 0.45); this.vfx.disc(x, z, col, mv.radius, 0.4);
          this.skillFx(sk, new THREE.Vector3(x, 0.6, z), big, true);
          for (const t of this.circle(this.hostiles(e), x, z, mv.radius)) { this.strike(e, t, sk, { mul: 1, kb: 3, big }); }
          this.sfx(big ? 'impact' : 'hit', { vol: 0.35 }); this.world.shake = Math.max(this.world.shake, big ? 0.3 : 0.12);
        } });
        break;
      }
      case 'bolt': case 'arrow': {
        const n = mv.count || 1;
        act.ev.push({ at: w, fn: () => {
          const y2 = ally ? e.actor.facingYaw : yaw;
          for (let i = 0; i < n; i++) {
            const off = n > 1 ? (i / (n - 1) - 0.5) * (mv.spread || 0.5) : 0;
            this.spawnProj(e, mv, { yaw: y2 + off, speed: mv.speed, range: mv.range, arrow: mv.shape === 'arrow', color: col === 0xffffff ? 0xf0ead8 : col, mul: mv.hitMul || (ally ? 0.9 : 1), boom: mv.boom, through: mv.through, homing: ally && mv.shape === 'bolt', size: big ? 0.38 : 0.3 });
          }
          this.sfx('shoot', { vol: 0.35, rate: mv.shape === 'bolt' ? 0.9 : 1.1 });
        } });
        break;
      }
      case 'ground': {
        const tp = target ? target.actor.position : { x: p.x + Math.sin(yaw) * Math.min(mv.range || 8, 7), z: p.z + Math.cos(yaw) * Math.min(mv.range || 8, 7) };
        const gx = tp.x, gz = tp.z, delay = mv.delay || 0.7;
        act.dur = w + (ally ? 0.1 : 0) + rec;
        act.ev.push({ at: w, fn: () => {
          const tl = this.vfx.telegraph(gx, gz, 0, mv.radius, Math.PI * 2, delay, ally ? col : 0xff2a2a);
          this.later_(delay, () => {
            tl.remove();
            this.vfx.ring(gx, gz, col, 0.4, mv.radius, 0.5); this.vfx.disc(gx, gz, col, mv.radius, 0.45);
            this.skillFx(sk, new THREE.Vector3(gx, 0.4, gz), big, true);
            if (!e.alive && !ally) return;
            for (const t of this.circle(this.hostiles(e), gx, gz, mv.radius)) this.strike(e, t, sk, { mul: 1, kb: 3, big });
            this.sfx('impact', { vol: 0.4 }); this.world.shake = Math.max(this.world.shake, big ? 0.35 : 0.15);
          });
          if (mv.lob) this.lobFx(e, gx, gz, delay, col);
        } });
        break;
      }
      case 'rain': {
        const tp = target ? target.actor.position : { x: p.x + Math.sin(yaw) * 6, z: p.z + Math.cos(yaw) * 6 };
        act.dur = w + 0.2 * mv.count + rec;
        for (let i = 0; i < mv.count; i++) act.ev.push({ at: w + i * 0.2, fn: () => {
          const a = Math.random() * Math.PI * 2, r = Math.random() * mv.area;
          const gx = tp.x + Math.cos(a) * r, gz = tp.z + Math.sin(a) * r;
          const tl = this.vfx.telegraph(gx, gz, 0, mv.radius, Math.PI * 2, 0.5, col);
          this.later_(0.5, () => {
            tl.remove(); this.vfx.ring(gx, gz, col, 0.3, mv.radius, 0.4); this.fx.fire(new THREE.Vector3(gx, 0.6, gz), false);
            for (const t of this.circle(this.hostiles(e), gx, gz, mv.radius)) this.strike(e, t, sk, { mul: mv.hitMul || 0.55, kb: 2.5 });
            this.sfx('impact', { vol: 0.25, rate: 1.1 }); this.world.shake = Math.max(this.world.shake, 0.1);
          });
        } });
        break;
      }
      case 'chain': {
        act.ev.push({ at: w, fn: () => {
          const used = new Set();
          let from = e.actor.position, cur = this.nearest(e, this.hostiles(e), mv.reach * 1.7);
          let delay = 0;
          for (let i = 0; i < mv.jumps && cur; i++) {
            const t = cur, fp = new THREE.Vector3(from.x, e.height * 0.7, from.z);
            this.later_(delay, () => { if (!t.alive) return; this.fx.bolt(this.chest(t, 0.7), 0xffe35c, false); this.vfx.ring(t.actor.position.x, t.actor.position.z, 0xffe35c, 0.3, 1.2, 0.3); this.strike(e, t, sk, { mul: 0.9 }); });
            used.add(t); delay += 0.13; from = t.actor.position;
            let nb = null, bd = mv.reach;
            for (const o of this.hostiles(e)) { if (used.has(o)) continue; const d = dist(o.actor.position, from); if (d < bd) { bd = d; nb = o; } }
            cur = nb;
          }
          this.sfx('shoot', { vol: 0.3, rate: 1.6 });
        } });
        act.dur = w + 0.6 + rec;
        break;
      }
      case 'support': {
        act.ev.push({ at: w, fn: () => this.supportEffect(e, mv) });
        break;
      }
    }
    this.startAct(e, act);
    return true;
  }
  lobFx(e, gx, gz, delay, col) {
    const m = this.vfx.bolt(col === 0xffffff ? 0xff8a3a : col, 0.22);
    const sx = e.actor.position.x, sz = e.actor.position.z, sy = e.height * 0.8;
    let t = 0;
    const tick = () => { t += 1 / 60; const k = Math.min(1, t / delay); m.position.set(sx + (gx - sx) * k, sy * (1 - k) + Math.sin(k * Math.PI) * 3.5, sz + (gz - sz) * k); if (k < 1) requestAnimationFrame(tick); else m.userData.dispose(); };
    tick();
  }
  supportEffect(e, mv) {
    const sk = mv.sk, ally = e.side === 'party';
    const friends = this.friends(e).filter((f) => f.alive);
    let targets = [];
    if (sk.target === 'self') targets = [e];
    else if (sk.target === 'allies') targets = friends.filter((f) => dist(f.actor.position, e.actor.position) < 16);
    else if (sk.target === 'fallen') { const d = this.friends(e).filter((f) => !f.alive && f.side === 'party').sort((a, b) => dist(a.actor.position, e.actor.position) - dist(b.actor.position, e.actor.position))[0]; targets = d ? [d] : []; }
    else targets = [friends.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || e];
    for (const t of targets) {
      const pos = this.chest(t, 0.5);
      if (sk.kind === 'heal' || sk.kind === 'cleanse') {
        const amt = computeHeal(e, sk);
        this.healEnt(t, Math.round(amt * (sk.id === 'e_selfheal' ? 1 : 1)));
        if (sk.kind === 'cleanse') delete t.status.poison;
        delete t.status.poison;
        this.fx.heal(pos); this.sfx('revive', { vol: 0.4 });
      } else if (sk.kind === 'revive' && !t.alive) {
        t.hp = Math.max(1, Math.round(t.maxHp * sk.power / 100)); this._rise(t); this.popup(t, '+' + t.hp, 'heal'); this.sfx('revive', { vol: 0.6 });
      }
      if (sk.buff) for (const [k, turns] of Object.entries(sk.buff)) { this.addStatus(t, k, turns); this.popup(t, STATUS[k].name, 'status'); }
      if (sk.kind === 'buff') { this.fx.buff(pos, ally ? 0xffd36b : 0xff7a7a); this.sfx('confirm', { vol: 0.3, rate: 1.4 }); }
    }
  }
  skillFx(sk, pos, big, area) {
    switch (sk.fx) {
      case 'light': this.fx.light(pos, big); break;
      case 'fire': this.fx.fire(pos, big); break;
      case 'ice': this.fx.ice(pos, big); break;
      case 'thunder': this.fx.bolt(pos, 0xffec6a, big); break;
      case 'dark': this.fx.dark(pos, big); break;
      case 'impact': if (!area) this.fx.impact(pos, 0xffd9a0, big); break;
      default: if (!area) this.fx.spark(pos, 0xfff2c0, big ? 12 : 6, 4, 0.08, 0.4);
    }
  }

  // ===================================================================== projectiles
  spawnProj(owner, mv, o) {
    const p = owner.actor.position, y = o.yaw ?? owner.actor.facingYaw;
    const mesh = this.vfx.bolt(o.color ?? 0xffffff, o.size || 0.3, !!o.arrow);
    const pr = { owner, mv, sk: mv ? mv.sk : null, x: p.x + Math.sin(y) * 0.6, z: p.z + Math.cos(y) * 0.6, y: owner.height * 0.62, yaw: y, speed: o.speed || 18, range: o.range || 18, travelled: 0,
      r: o.arrow ? 0.22 : 0.3, mul: o.mul ?? 1, boom: o.boom, through: o.through, homing: o.homing, hit: new Set(), mesh, pseudo: o.pseudo, color: o.color, mag: !!o.size && !o.arrow };
    this.projs.push(pr);
    mesh.position.set(pr.x, pr.y, pr.z);
    return pr;
  }
  updateProjs(dt) {
    const b = this.b;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const q = this.projs[i];
      const foes = this.hostiles(q.owner);
      if (q.homing && foes.length) {
        let best = null, bd = 1e9;
        for (const t of foes) { const dx = t.actor.position.x - q.x, dz = t.actor.position.z - q.z; const d = Math.hypot(dx, dz); const ang = Math.abs(wrap(Math.atan2(dx, dz) - q.yaw)); if (ang < 0.9 && d < bd) { bd = d; best = t; } }
        if (best) { const want = Math.atan2(best.actor.position.x - q.x, best.actor.position.z - q.z); q.yaw += clamp(wrap(want - q.yaw), -3.2 * dt, 3.2 * dt); }
      }
      const step = q.speed * dt;
      q.x += Math.sin(q.yaw) * step; q.z += Math.cos(q.yaw) * step; q.travelled += step;
      q.mesh.position.set(q.x, q.y, q.z);
      if (q.mesh.children.length === 2) q.mesh.rotation.y = q.yaw; // arrow shaft points along +z
      let done = q.travelled >= q.range;
      const cx = Math.floor(q.x), cz = Math.floor(q.z);
      if (b.inb(cx, cz) && b.hgt[cz * b.w + cx] > 1.3) { done = true; this.fx.spark(new THREE.Vector3(q.x, q.y, q.z), 0xffe8b0, 6, 3, 0.07, 0.3); }
      if (!done) for (const t of foes) {
        if (q.hit.has(t)) continue;
        const dx = t.actor.position.x - q.x, dz = t.actor.position.z - q.z;
        if (Math.hypot(dx, dz) < t.radius + q.r) {
          if (t.invuln > 0) { if (t.side === 'party' && t.act && t.act.type === 'dodge' && !t.perfect) this.perfectDodge(t); q.hit.add(t); continue; }
          q.hit.add(t);
          this.projHit(q, t);
          if (!q.through) { done = true; break; }
        }
      }
      if (done) { q.mesh.userData.dispose(); this.projs.splice(i, 1); }
    }
  }
  projHit(q, t) {
    const o = q.owner, sk = q.sk;
    const at = new THREE.Vector3(q.x, q.y, q.z);
    if (q.boom) {
      this.vfx.ring(q.x, q.z, elColor(sk && sk.el), 0.3, q.boom, 0.35); this.vfx.disc(q.x, q.z, elColor(sk && sk.el), q.boom, 0.3);
      for (const f of this.circle(this.hostiles(o), q.x, q.z, q.boom)) this.strike(o, f, sk, { mul: q.mul, kb: 2.5 });
      if (sk) this.skillFx(sk, at, sk.big, true);
    } else {
      this.strike(o, t, sk, { mul: q.mul, kb: 1.5, pseudo: q.pseudo });
      if (sk) this.skillFx(sk, at, false); else this.fx.spark(at, q.color || 0xffe8b0, 7, 3.5, 0.07, 0.35);
    }
  }

  // ===================================================================== burst
  tryBurst(p) {
    if (this.star < 100 || !this.canAct(p) || (p.act && p.act.type !== 'attack')) { if (this.star < 100) this.sfx('hurt', { vol: 0.2 }); return false; }
    const sk = SKILLS[p.burst]; if (!sk) return false;
    this.star = 0;
    this.runBurst(p, sk);
    return true;
  }
  async runBurst(p, sk) {
    audio.sfx('level_up', { vol: 0.7, rate: 0.9 }); audio.sfx('boss', { vol: 0.5, rate: 1.4 });
    p.invuln = 3;
    this.cancelAct(p);
    this.startAct(p, { type: 'burst', dur: 99, lock: true, freeze: true, firm: true, ev: [] });
    this.slowT = 99; this.timeScale = 0.12;
    const d = h('div', 'cutin');
    d.innerHTML = `<div class="cb"></div>${ptImg(CHARS[p.id].sprite, 'full')}<div class="ct1">${esc(sk.name)}</div><div class="ct2">${esc(p.name.toUpperCase())}</div>`;
    d.style.setProperty('--c', p.color);
    root.appendChild(d);
    this.G.gfx.setFadeColor(0xffffff);
    await sleep(1000);
    d.classList.add('out'); await sleep(220); d.remove();
    this.G.gfx.setFadeColor(0x000000);
    this.slowT = 0; this.timeScale = 1;
    p.actor.cast();
    this.executeBurst(p, sk);
  }
  executeBurst(p, sk) {
    const foes = this.hostiles(p).filter((t) => dist(t.actor.position, p.actor.position) < 24);
    const col = elColor(sk.el);
    const finish = (t) => this.later_(t, () => { if (p.act && p.act.type === 'burst') { p.act = null; } p.invuln = Math.max(p.invuln, 0.4); });
    this.world.shake = 0.5;
    if (sk.kind === 'heal') {
      for (const f of this.party) {
        if (!f.alive) { f.hp = Math.max(1, Math.round(f.maxHp * (sk.revive || 0.5))); this._rise(f); }
        this.healEnt(f, computeHeal(p, sk)); this.fx.heal(this.chest(f, 0.6)); delete f.status.poison;
        if (sk.buff) for (const [k, n] of Object.entries(sk.buff)) this.addStatus(f, k, n);
      }
      this.vfx.ring(p.actor.position.x, p.actor.position.z, 0xfff2b8, 0.5, 9, 0.8); this.vfx.column(p.actor.position.x, p.actor.position.z, 0xfff2b8, 1.4, 12, 0.9);
      finish(0.9); return;
    }
    if (!foes.length) { finish(0.3); return; }
    const hits = sk.hits || 1;
    if (sk.target === 'enemies') {
      for (let k = 0; k < hits; k++) this.later_(k * 0.35, () => {
        this.world.shake = 0.4;
        this.vfx.ring(p.actor.position.x, p.actor.position.z, col, 0.5, 14, 0.7);
        for (const t of foes) { if (!t.alive) continue; this.skillFx(sk, this.chest(t, 0.7), true); this.strike(p, t, sk, { mul: 1 / Math.sqrt(hits), big: true, kb: 3 }); }
        this.sfx('impact', { vol: 0.5 });
      });
      finish(0.35 * hits + 0.4);
    } else if (sk.target === 'random') {
      for (let k = 0; k < hits; k++) this.later_(k * 0.14, () => {
        const live = this.hostiles(p); if (!live.length) return;
        const t = live[Math.floor(Math.random() * live.length)];
        const ang = Math.random() * Math.PI * 2;
        p.actor.position.set(t.actor.position.x + Math.cos(ang) * 1.4, 0, t.actor.position.z + Math.sin(ang) * 1.4);
        p.actor.facingYaw = Math.atan2(t.actor.position.x - p.actor.position.x, t.actor.position.z - p.actor.position.z);
        this.vfx.arc(t.actor.position.x, 1.0, t.actor.position.z, ang, 2.6, 2.4, 0xcfd8ff, 0.2);
        this.fx.spark(this.chest(t, 0.7), col, 8, 4, 0.08, 0.4);
        this.strike(p, t, sk, { mul: 1, kb: 1.5, big: k === hits - 1 });
        this.sfx('hit', { vol: 0.3, rate: 1.2 });
      });
      finish(0.14 * hits + 0.4);
    } else {
      const t = this.nearest(p, foes) || foes[0];
      const ang = Math.atan2(p.actor.position.x - t.actor.position.x, p.actor.position.z - t.actor.position.z);
      p.actor.position.set(t.actor.position.x + Math.sin(ang) * 1.5, 0, t.actor.position.z + Math.cos(ang) * 1.5);
      p.actor.facingYaw = ang + Math.PI;
      for (let k = 0; k < hits; k++) this.later_(k * 0.12, () => {
        if (!t.alive) return;
        p.actor.attack();
        this.fx.spark(this.chest(t, 0.6), col, 6, 4, 0.08, 0.3);
        this.strike(p, t, sk, { mul: 1, kb: 0.4, big: k === hits - 1 });
        this.sfx('hit', { vol: 0.25, rate: 1 + (k % 3) * 0.1 });
      });
      finish(0.12 * hits + 0.4);
    }
  }

  // ===================================================================== update
  update(rdt) {
    const F = this.F, G = this.G;
    if (!F.active || !this.world) return;
    this.fx.update(rdt); this.vfx.update(rdt);
    // sync HUD
    const vis = this.hudVisible();
    this.hud.show(vis);
    if (vis) { this.hud.syncParty(); this.hud.syncSkills(); this.hud.syncEnemies(); }
    if ((F.busy && !this.scripted) || input.modal || G.paused || this.eventBusy || this.resultBusy) return;
    this.step(rdt);
  }
  /** one simulation step (also used directly by tools that fast-forward fights) */
  step(rdt) {
    const F = this.F;
    if (this.hitstop > 0) { this.hitstop -= rdt; rdt *= 0.04; }
    if (this.slowT > 0) { this.slowT -= rdt; this.timeScale = this.slowT > 90 ? this.timeScale : 0.35; if (this.slowT <= 0) this.timeScale = 1; }
    const dt = Math.min(0.05, rdt) * this.timeScale;
    this.time += dt;
    this.quickCd = Math.max(0, this.quickCd - dt);
    // delayed callbacks
    for (let i = this.later.length - 1; i >= 0; i--) { const l = this.later[i]; l.t -= dt; if (l.t <= 0) { this.later.splice(i, 1); l.fn(); } }
    this.vfx.updateTele(dt);
    // party
    for (const p of this.party) this.updateParty(p, dt);
    // enemies
    for (const e of this.mobs) this.updateEnemy(e, dt);
    this.updateProjs(dt);
    this.separate();
    // knock-back impulses
    for (const e of [...this.party, ...this.mobs]) {
      if (e.kvx || e.kvz) {
        F.tryMove(e.actor.position, e.kvx * dt * 6, e.kvz * dt * 6, Math.min(e.radius, 0.4), e.side !== 'party');
        const k = Math.pow(0.02, dt); e.kvx *= k; e.kvz *= k; if (Math.abs(e.kvx) + Math.abs(e.kvz) < 0.05) e.kvx = e.kvz = 0;
      }
    }
    this.bookkeeping(dt);
    if (this.scripted) this.checkEvents();
  }
  separate() {
    const all = [...this.party.filter((p) => p.alive), ...this.mobs.filter((m) => m.alive)];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const pa = a.actor.position, pb = b.actor.position;
      const dx = pb.x - pa.x, dz = pb.z - pa.z, d = Math.hypot(dx, dz), min = (a.radius + b.radius) * 0.85;
      if (d < min && d > 1e-4) {
        const push = (min - d) * 0.5;
        const same = a.side === b.side;
        if (!(a === this.ctrl && !this.autoLeader)) this.F.tryMove(pa, -(dx / d) * push * (same ? 1 : 0.6), -(dz / d) * push * (same ? 1 : 0.6), 0.3, true);
        if (!(b === this.ctrl && !this.autoLeader)) this.F.tryMove(pb, (dx / d) * push * (same ? 1 : 0.6), (dz / d) * push * (same ? 1 : 0.6), 0.3, true);
      }
    }
  }
  // ---- timers, statuses, regen, engagement
  tickStatus(e, dt) {
    for (const k of Object.keys(e.status)) {
      e.status[k] -= dt;
      if (e.status[k] <= 0) delete e.status[k];
    }
    e.tick += dt;
    if (e.tick >= 1) {
      e.tick -= 1;
      if (e.status.poison) { const d = Math.max(1, Math.round(e.maxHp * 0.02)); e.hp = Math.max(e.side === 'party' ? 1 : 0, e.hp - d); this.popup(e, String(d), 'poison'); if (e.hp <= 0 && e.alive) this.kill(e); }
      if (e.status.regen) this.healEnt(e, Math.max(1, Math.round(e.maxHp * 0.023)), true);
    }
    for (const k of Object.keys(e.cd)) { e.cd[k] -= dt; if (e.cd[k] <= 0) delete e.cd[k]; }
    if (e.stun > 0) e.stun -= dt;
    if (e.hitstun > 0) e.hitstun -= dt;
    if (e.invuln > 0) e.invuln -= dt;
    if (e.dodgeCd > 0) e.dodgeCd -= dt;
    if (e.comboT > 0) e.comboT -= dt; else e.comboI = 0;
    if (e.atkCd > 0) e.atkCd -= dt;
  }
  bookkeeping(dt) {
    // engagement bookkeeping
    const live = this.scripted ? this.scripted.enemies.filter((m) => m.alive) : this.mobs.filter((m) => m.alive && m.engaged);
    const was = this.engaged;
    this.engaged = live.length > 0;
    if (this.engaged && !was) this.onEngage();
    if (!this.engaged && was && !this.ending) this.onClear();
    // remove corpses after a while
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if (m.alive) continue;
      m.deadT = (m.deadT || 0) + dt;
      m.actor.alpha = clamp(1.6 - m.deadT, 0, 1);
      if (m.deadT > 1.6 && !(this.scripted && this.scripted.enemies.includes(m))) { this.F.world.remove(m.actor.group); this.mobs.splice(i, 1); this.hud.ebars.get(m)?.remove(); }
    }
    // KO'd heroes that got revived (items) stand back up
    for (const p of this.party) {
      if (p.alive && p.actor.dead) this._rise(p);
      if (!p.alive && !p.actor.dead) { this._fall(p, 0.3); if (p === this.ctrl) this.autoSwitch(); }
    }
    // everyone down?
    if (!this.ending && this.party.length && this.party.every((p) => !p.alive)) this.onWipe();
  }
  onEngage() {
    const F = this.F;
    this.ending = false;
    this.snap = { roster: JSON.parse(JSON.stringify(state.roster)), inv: { ...state.inv }, pos: this.party.map((p) => [p.actor.position.x, p.actor.position.z]), defs: this.spawnDefs.map((d) => ({ ...d })), play: state.play };
    this.spoils = this.spoils.filter(() => false);
    for (const p of this.party) { p.actor.ai = p !== this.ctrl || this.autoLeader; p.thinkCd = 0.2 + Math.random() * 0.3; p.buffed = false; }
    if (!this.scripted) audio.playMusic(this.fightMusic);
  }
  onClear() {
    // all engaged foes are gone: victory (or they lost track of us)
    this.endFight();
  }

  // ===================================================================== party update (player + AI)
  updateParty(p, dt) {
    this.tickStatus(p, dt);
    const a = p.actor;
    if (!p.alive) return;
    // MP regen
    if (p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + (TUNE.mpRegen[0] + TUNE.mpRegen[1] * p.maxMp) * dt);
    if (p.act && p.act.type === 'dodge') { this.dodgeMove(p, dt); this.tickAct(p, dt); a.roll = Math.sin(Math.min(1, p.act ? p.act.t / TUNE.dodgeTime : 1) * Math.PI); return; }
    a.roll = 0;
    if (p.act) this.tickAct(p, dt);
    if (p.stun > 0 || p.hitstun > 0) { a.moving = false; return; }
    const player = p === this.ctrl && !this.autoLeader;
    if (player) { if (input.attackHeld && (!p.act || p.act.type === 'attack')) this.tryBasic(p); return; }
    if (!p.act) this.aiParty(p, dt);
  }
  dodgeMove(p, dt) {
    const a = p.act; if (!a) return;
    const k = 1 - a.t / TUNE.dodgeTime;
    const sp = TUNE.dodgeSpeed * (0.35 + 0.65 * Math.max(0, k));
    this.F.tryMove(p.actor.position, Math.sin(a.dodgeYaw) * sp * dt, Math.cos(a.dodgeYaw) * sp * dt, 0.3, true);
    p.actor.moving = true;
  }
  // ---- movement for AI-driven characters: straight line when clear, grid A* around trees / walls otherwise
  /** NPCs and chests are solid for heroes (not for enemies) */
  solidThings() { return this.F.things.filter((t) => (t.kind === 'chest' || (t.kind === 'npc' && !t.def.ghost && !t.hidden))); }
  los(x0, z0, x1, z1, r = 0.34, things = null) {
    const b = this.b, d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 0.4));
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      if (b.isBlocked(Math.floor(x - r), Math.floor(z - r)) || b.isBlocked(Math.floor(x + r), Math.floor(z - r)) || b.isBlocked(Math.floor(x - r), Math.floor(z + r)) || b.isBlocked(Math.floor(x + r), Math.floor(z + r))) return false;
      if (things) for (const t of things) { const rr = t.r + r + 0.05; if ((t.x - x) ** 2 + (t.z - z) ** 2 < rr * rr) return false; }
    }
    return true;
  }
  _freeCellNear(cx, cz) {
    const b = this.b;
    if (!b.isBlocked(cx, cz)) return [cx, cz];
    for (let r = 1; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r && !b.isBlocked(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    return null;
  }
  /** A* on the collision grid; returns cell-centre waypoints or null */
  findPath(x0, z0, x1, z1, things = null) {
    const b = this.b, W = b.w, H = b.h;
    const blockedAt = (cx, cz) => b.isBlocked(cx, cz) || (things && things.some((t) => (t.x - cx - 0.5) ** 2 + (t.z - cz - 0.5) ** 2 < (t.r + 0.55) ** 2));
    const s = this._freeCellNear(Math.floor(x0), Math.floor(z0)), g = this._freeCellNear(Math.floor(x1), Math.floor(z1));  // (start / goal cells may be blocked by a thing: they are still allowed)
    if (!s || !g) return null;
    const idx = (x, z) => z * W + x;
    const gScore = new Float32Array(W * H).fill(1e9), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
    const open = [[0, s[0], s[1]]];
    gScore[idx(s[0], s[1])] = 0;
    const hf = (x, z) => { const dx = Math.abs(x - g[0]), dz = Math.abs(z - g[1]); return Math.max(dx, dz) + 0.41 * Math.min(dx, dz); };
    let guard = 0;
    while (open.length && guard++ < 5000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, x, z] = open.splice(bi, 1)[0];
      const ci = idx(x, z);
      if (closed[ci]) continue;
      closed[ci] = 1;
      if (x === g[0] && z === g[1]) {
        const out = [];
        for (let c = ci; c >= 0; c = from[c]) out.push({ x: (c % W) + 0.5, z: Math.floor(c / W) + 0.5 });
        return out.reverse();
      }
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        if (blockedAt(nx, nz)) continue;
        if (dx && dz && (blockedAt(x + dx, z) || blockedAt(x, z + dz))) continue;
        const ni = idx(nx, nz);
        if (closed[ni]) continue;
        const ng = gScore[ci] + (dx && dz ? 1.41 : 1);
        if (ng < gScore[ni]) { gScore[ni] = ng; from[ni] = ci; open.push([ng + hf(nx, nz), nx, nz]); }
      }
    }
    return null;
  }
  /** where to walk next to reach (tx,tz): the goal itself when visible, else along a cached A* path */
  waypoint(e, tx, tz) {
    const p = e.actor.position, r = Math.min(e.radius, 0.4);
    const things = e.side === 'party' ? this.solidThings() : null;
    if (this.los(p.x, p.z, tx, tz, r, things)) { e.path = null; return [tx, tz]; }
    if (!e.path || e.pathT <= 0 || Math.hypot(e.pathGoal[0] - tx, e.pathGoal[1] - tz) > 2.5) {
      e.path = this.findPath(p.x, p.z, tx, tz, things); e.pathGoal = [tx, tz]; e.pathT = 0.7;
    }
    if (!e.path) return [tx, tz];
    // farthest waypoint we can see (look-ahead of a few cells keeps the movement smooth)
    let pick = null;
    for (let i = Math.min(e.path.length - 1, 12); i >= 0; i--) { const w = e.path[i]; if (Math.hypot(w.x - p.x, w.z - p.z) > 0.6 && this.los(p.x, p.z, w.x, w.z, r, things)) { pick = w; break; } }
    if (!pick) pick = e.path.find((w) => Math.hypot(w.x - p.x, w.z - p.z) > 0.5) || e.path[e.path.length - 1];
    return [pick.x, pick.z];
  }
  /** keeps an AI character steering through the field; returns true if it moved */
  steer(e, tx, tz, speed, dt, stop = 0, faceMove = true, direct = false) {
    const p = e.actor.position;
    const fd = Math.hypot(tx - p.x, tz - p.z);
    if (fd <= stop || fd < 1e-4) { e.actor.moving = false; e.stuckT = 0; return false; }
    if (e.pathT > 0) e.pathT -= dt; else if (e.pathT === undefined) e.pathT = 0;
    let gx = tx, gz = tz;
    if (e.unstick && e.unstick.t > 0) { e.unstick.t -= dt; gx = p.x + Math.sin(e.unstick.a) * 3; gz = p.z + Math.cos(e.unstick.a) * 3; }
    else if (!direct) [gx, gz] = this.waypoint(e, tx, tz);
    const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz) || 1;
    const step = Math.min(speed * dt, direct || (gx === tx && gz === tz) ? fd - stop : speed * dt);
    const moved = this.F.tryMove(p, (dx / d) * step, (dz / d) * step, Math.min(e.radius, 0.42), e.side !== 'party');
    e.actor.moving = moved > 0.002;
    if (faceMove) e.actor.facingYaw = Math.atan2(dx, dz);
    // wedged against something? re-plan, then shuffle sideways for a moment
    if (moved < step * 0.25) {
      e.stuckT = (e.stuckT || 0) + dt; e.stuckTot = (e.stuckTot || 0) + dt;
      if (e.stuckT > 0.45) { e.stuckT = 0; e.pathT = 0; e.path = null; e.unstick = { t: 0.5, a: Math.atan2(dx, dz) + (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 1.2) }; }
      if (e.stuckTot > 2.2 && !direct) {          // still wedged: hop a few cells along the A* route (nobody notices, and fights never deadlock)
        e.stuckTot = 0;
        const route = this.findPath(p.x, p.z, tx, tz, e.side === 'party' ? this.solidThings() : null);
        const hop = route && route[Math.min(route.length - 1, 3)];
        if (hop) { p.x = hop.x; p.z = hop.z; e.path = null; e.pathT = 0; }
      }
    } else { e.stuckT = 0; if (moved > step * 0.6) e.stuckTot = Math.max(0, (e.stuckTot || 0) - dt * 2); }
    return moved > 0.002;
  }
  /** steps out of any telegraphed danger zone */
  dodgeZones(e, dt) {
    for (const t of this.vfx.tele) {
      const dx = e.actor.position.x - t.x, dz = e.actor.position.z - t.z, d = Math.hypot(dx, dz);
      if (t.arc >= Math.PI * 2 - 0.01) {
        if (d < t.range + 0.8 && t.t < t.life + 0.3) { this.steer(e, t.x + (dx / (d || 1)) * (t.range + 2.5), t.z + (dz / (d || 1)) * (t.range + 2.5), 5.4, dt, 0, true, true); return true; }
      } else if (d < t.range + 0.8 && Math.abs(wrap(Math.atan2(dx, dz) - t.yaw)) < t.arc / 2 + 0.3) {
        const side = wrap(Math.atan2(dx, dz) - t.yaw) > 0 ? 1 : -1;
        const ang = t.yaw + side * (Math.PI / 2);
        this.steer(e, e.actor.position.x + Math.sin(ang) * 4, e.actor.position.z + Math.cos(ang) * 4, 5.4, dt, 0, true, true);
        return true;
      }
    }
    return false;
  }
  aiParty(p, dt) {
    const F = this.F, a = p.actor;
    const foes = this.hostiles(p);
    const lead = this.ctrl;
    const leader = F.player.position;
    // nothing to fight: let the field's formation code walk us along (or the auto leader walks to the next foe)
    const scan = this.scripted ? 60 : 16;
    const target = this.engaged || this.scripted ? this.nearest(p, foes, scan) : null;
    if (!target && !(p === this.ctrl)) { a.ai = false; return; }
    if (!target && p === this.ctrl) { return; }
    a.ai = true;
    if (this.dodgeZones(p, dt)) { p.thinkCd = Math.max(p.thinkCd, 0.1); return; }
    p.thinkCd -= dt;
    const d = dist(a.position, target.actor.position);
    const role = p.role;
    const pref = PREF[role] || 2;
    // tether to the leader unless we are the leader
    if (p !== this.ctrl && dist(a.position, leader) > 14) { this.steer(p, leader.x, leader.z, 5.5, dt, 3); return; }
    // healer duty
    if (role === 'healer' || p.id === 'airi') {
      const hurt = this.party.filter((x) => x.alive && x.hp / x.maxHp < 0.55);
      if (hurt.length && p.thinkCd <= 0) {
        const bar = hotbar(p.id);
        const heal = bar.find((s) => s.id === 'heal' && !s.locked), rain = bar.find((s) => s.id === 'radiant_rain' && !s.locked);
        const pick1 = hurt.length >= 2 && rain && !(p.cd.radiant_rain > 0) && p.mp >= SKILLS.radiant_rain.mp ? 'radiant_rain' : heal && !(p.cd.heal > 0) && p.mp >= SKILLS.heal.mp ? 'heal' : null;
        if (pick1) { this.useSkill(p, pick1); p.thinkCd = 0.5; return; }
      }
    }
    // opening buff once per fight
    if (!p.buffed && p.thinkCd <= 0) {
      p.buffed = true;
      for (const s of hotbar(p.id)) {
        const sk = SKILLS[s.id];
        if (!s.locked && sk && sk.kind === 'buff' && p.mp >= sk.mp + 8 && !(p.cd[s.id] > 0) && (sk.target === 'self' || sk.target === 'allies')) { this.useSkill(p, s.id); p.thinkCd = 0.6; return; }
      }
    }
    // burst when the auto leader has a full gauge
    if (p === this.ctrl && this.autoLeader && this.star >= 100 && this.canAct(p)) { this.tryBurst(p); return; }
    // movement relative to our preferred distance
    const strafe = Math.sin(this.time * 0.9 + p.id.length) * 0.5;
    if (role === 'melee') {
      if (d > pref + 0.4) this.steer(p, target.actor.position.x, target.actor.position.z, 5.2, dt, pref);
      else { a.moving = false; a.facingYaw = Math.atan2(target.actor.position.x - a.position.x, target.actor.position.z - a.position.z); }
    } else {
      if (d < pref - 2.5) this.steer(p, a.position.x - (target.actor.position.x - a.position.x), a.position.z - (target.actor.position.z - a.position.z), 4.8, dt, 0, false, true);
      else if (d > pref + 2) this.steer(p, target.actor.position.x, target.actor.position.z, 5, dt, pref);
      else { a.moving = false; }
      if (d < pref + 3) a.facingYaw = Math.atan2(target.actor.position.x - a.position.x, target.actor.position.z - a.position.z);
    }
    if (p.thinkCd > 0 || !this.canAct(p)) return;
    // attack: sometimes a skill, otherwise the basic combo
    const reach = role === 'melee' ? 2.8 : 14;
    if (d <= reach) {
      if (Math.random() < 0.5) {
        const opts = hotbar(p.id).filter((s) => { if (s.locked) return false; const sk = SKILLS[s.id]; return sk && !['heal', 'buff', 'revive', 'cleanse'].includes(sk.kind) && !(p.cd[s.id] > 0) && p.mp >= sk.mp + p.maxMp * 0.12; });
        if (opts.length) { const pick2 = opts[Math.floor(Math.random() * opts.length)]; if (this.useSkill(p, pick2.id)) { p.thinkCd = 0.8 + Math.random() * 0.6; return; } }
      }
      if (p.atkCd <= 0 && this.tryBasic(p)) { p.thinkCd = 0.04; }
    }
  }

  // ===================================================================== enemy update
  updateEnemy(e, dt) {
    if (!e.alive) return;
    this.tickStatus(e, dt);
    const a = e.actor, F = this.F;
    if (e.stun > 0 || e.hitstun > 0) { a.moving = false; return; }
    if (e.act) { this.tickAct(e, dt); return; }
    if (F.busy && !this.scripted) { a.moving = false; return; }
    // ---- not yet fighting: stand around, notice heroes
    if (!e.engaged) {
      const t = this.nearest(e, this.party.filter((p) => p.alive), TUNE.aggro);
      if (t && !this.F.busy && !(this.G.cheat && this.G.cheat.peace)) { this.alertGroup(e, null); return; }
      e.wanderT -= dt;
      if (!e.wander && e.wanderT <= 0) { e.wander = [e.home.x + (Math.random() - 0.5) * 4, e.home.z + (Math.random() - 0.5) * 4]; e.wanderT = 3 + Math.random() * 4; }
      if (e.wander) { if (!this.steer(e, e.wander[0], e.wander[1], 1.1, dt, 0.2)) e.wander = null; } else a.moving = false;
      return;
    }
    // ---- fighting
    const foes = this.party.filter((p) => p.alive);
    if (!foes.length) { a.moving = false; return; }
    e.aiT -= dt;
    if (!e.tgt || !e.tgt.alive || e.aiT <= 0) {
      e.aiT = 1.5 + Math.random();
      const thr = e.thr && e.thr.alive && Math.random() < 0.55 ? e.thr : null;
      e.tgt = thr || this.nearest(e, foes) || foes[0];
    }
    const t = e.tgt;
    const tp = t.actor.position;
    const d = dist(a.position, tp);
    // leash: lose interest when everyone ran far away
    if (!this.scripted && d > TUNE.leash) { e.engaged = false; e.hp = e.maxHp; return; }
    if (this.dodgeAllyZones(e, dt)) return;
    e.thinkCd -= dt;
    if (!e.plan || e.plan.dead) e.plan = this.pickMove(e);
    const mv = e.plan;
    if (!mv) { a.moving = false; return; }
    const reach = mv.shape === 'melee' ? mv.range * 0.8 : mv.shape === 'nova' ? mv.radius * 0.7 : mv.shape === 'support' ? 99 : Math.min(mv.range || 12, 13) * 0.8;
    // ranged enemies keep their distance
    if (e.ranged && d < 4.5) { this.steer(e, a.position.x - (tp.x - a.position.x), a.position.z - (tp.z - a.position.z), e.speed, dt, 0, false, true); a.facingYaw = Math.atan2(tp.x - a.position.x, tp.z - a.position.z); return; }
    if (d > reach && mv.shape !== 'support') { this.steer(e, tp.x, tp.z, e.speed, dt, Math.max(0.5, reach * 0.7)); return; }
    a.moving = false;
    a.facingYaw = Math.atan2(tp.x - a.position.x, tp.z - a.position.z);
    if (e.thinkCd > 0) return;
    e.plan = null;
    const tgt = mv.shape === 'support' ? null : t;
    this.castMove(e, mv, tgt);
    e.thinkCd = TUNE.eCd * (e.boss ? 0.65 : 1) * (0.85 + Math.random() * 0.4) * (1.2 - Math.min(0.4, e.spd / 100));
  }
  dodgeAllyZones() { return false; }
  pickMove(e) {
    const allies = this.mobs.filter((m) => m.alive);
    const opts = [];
    for (const m of e.moves) {
      const sk = m.sk;
      if (sk) {
        if (sk.kind === 'heal' && !allies.some((a) => a.hp / a.maxHp < 0.6) ) continue;
        if (sk.kind === 'buff' && sk.buff && Object.keys(sk.buff).every((b) => e.status[b])) continue;
        if (sk.kind === 'debuff' && sk.status && e.tgt && e.tgt.status[sk.status.id]) continue;
      }
      opts.push(m);
    }
    if (!opts.length) return e.moves[0];
    let r = Math.random() * opts.reduce((s, o) => s + o.w, 0), pick1 = opts[0];
    for (const o of opts) { if ((r -= o.w) <= 0) { pick1 = o; break; } }
    return pick1;
  }

  // ===================================================================== scripted fights (story)
  /** G.startBattle / G.bossBattle */
  async fight(opts) {
    for (;;) {
      const r = await this._fightOnce(opts);
      if (r !== 'retry') return r;
    }
  }
  async _fightOnce(opts) {
    const F = this.F, G = this.G;
    G.ui.dialogue.hide();
    this.ending = false;
    const o = { canFlee: false, music: 'battle_theme_a', events: [], ...opts };
    await Promise.all(o.enemies.map((id) => loadChar(ENEMIES[id].sprite)));
    // roaming mobs of the map stay where they are; the scripted foes are spawned around the party
    const sc = { opts: o, enemies: [], done: null, eventsDone: new Set(), resolve: null, npcs: [] };
    this.scripted = sc;
    this.snap = { roster: JSON.parse(JSON.stringify(state.roster)), inv: { ...state.inv }, pos: this.party.map((p) => [p.actor.position.x, p.actor.position.z]), defs: this.spawnDefs.map((d) => ({ ...d })), play: state.play };
    this.spoils = [];
    this.fightMusic = o.music;
    const base = F.pos, yaw = this.world.yaw;
    const fwd = [-Math.sin(yaw), -Math.cos(yaw)];
    o.enemies.forEach((id, i) => {
      const info = ENEMIES[id];
      // a boss that stands in the scene as an NPC fights from where it stands
      const npc = F.npcs.find((n) => !n.hidden && n.def.sprite === info.sprite && Math.hypot(n.x - base.x, n.z - base.z) < 16);
      let x, z;
      if (npc) { x = npc.x; z = npc.z; F.hideNpc(npc, true); sc.npcs.push(npc); }
      else { [x, z] = this._ringSpot(base, fwd, i, o.enemies.length); }
      const e = this.makeEnemy(id, x, z, 's' + i, true);
      e.scripted = true;
      sc.enemies.push(e);
    });
    for (const p of this.party) { p.actor.ai = p !== this.ctrl || this.autoLeader; p.buffed = false; p.thinkCd = 0.4; }
    if (this.autoLeader) this.ctrl.actor.ai = true;
    this.engaged = true;
    audio.stopMusic(0.2); audio.sfx('boss', { vol: 0.5, rate: 1.6 });
    audio.playMusic(o.music);
    const boss = sc.enemies.find((e) => e.boss);
    this.hud.show(true);
    this.world.shake = 0.15;
    if (boss) { audio.sfx('boss', { vol: 0.8 }); this.hud.msg(`— ${boss.name} —`, 1500); }
    else this.hud.msg(this._names(sc.enemies) + ' appear!', 1300);
    await this.runEvents('start');
    const res = await new Promise((resolve) => { sc.resolve = resolve; });
    // cleanup of the scripted foes
    for (const n of sc.npcs) F.hideNpc(n, false);
    for (const e of sc.enemies) { F.world.remove(e.actor.group); const i = this.mobs.indexOf(e); if (i >= 0) this.mobs.splice(i, 1); }
    this.hud.clearEnemyBars();
    this.scripted = null;
    this.projs.forEach((q) => q.mesh.userData.dispose()); this.projs = []; this.later = [];
    this.vfx.clear();
    for (const p of this.party) { p.actor.ai = false; p.act = null; p.invuln = 0; }
    this.engaged = this.mobs.some((m) => m.alive && m.engaged);
    if (!this.engaged) audio.playMusic(F.def?.music ?? null);
    return res;
  }
  _names(list) { const n = {}; list.forEach((e) => (n[e.name] = (n[e.name] || 0) + 1)); return Object.entries(n).map(([k, c]) => (c > 1 ? `${k} ×${c}` : k)).join(',  '); }
  _ringSpot(base, fwd, i, n) {
    const b = this.b;
    for (let k = 0; k < 40; k++) {
      const spread = n > 1 ? (i / (n - 1) - 0.5) * 1.9 : 0;
      const ang = Math.atan2(fwd[0], fwd[1]) + spread + (k > 12 ? (Math.random() - 0.5) * 4 : 0);
      const r = 6.5 + (i % 2) * 1.6 + k * 0.12;
      const x = base.x + Math.sin(ang) * r, z = base.z + Math.cos(ang) * r;
      if (!b.isBlocked(Math.floor(x), Math.floor(z))) return [x, z];
    }
    return [base.x + 3, base.z + 3];
  }
  // ---- boss script events
  async runEvents(when) {
    const sc = this.scripted; if (!sc) return;
    for (const e of sc.opts.events) {
      if (e.when !== when || sc.eventsDone.has(e)) continue;
      sc.eventsDone.add(e);
      await this._runEvent(e);
    }
  }
  checkEvents() {
    const sc = this.scripted;
    if (!sc || this.eventBusy) return;
    for (const e of sc.opts.events) {
      if (e.when !== 'hp' || sc.eventsDone.has(e)) continue;
      const en = sc.enemies[e.enemy || 0];
      if (!en || en.hp / en.maxHp > e.below) continue;
      sc.eventsDone.add(e);
      if (!en.alive && !e.onDeath) continue;
      this._runEvent(e);
      return;
    }
  }
  async _runEvent(e) {
    this.eventBusy = true;
    this.hud.show(false);
    try { await e.run(this.G, this); } catch (err) { console.error('battle event error', err); }
    this.G.ui.dialogue.hide();
    this.eventBusy = false;
  }
  // helpers for scripts (same names the turn-based battle offered)
  get enemies() { return this.scripted ? this.scripted.enemies : this.mobs; }
  buffEnemy(e, k, turns = 4) { this.addStatus(e, k, turns); this.fx.buff(this.chest(e, 0.8), 0xff7a7a); this.popup(e, STATUS[k].name, 'status'); }
  healEnemy(e, pct) { const a = Math.round(e.maxHp * pct); this.healEnt(e, a); this.fx.heal(this.chest(e, 1)); }
  async addEnemy(id) {
    const sc = this.scripted; if (!sc) return;
    await loadChar(ENEMIES[id].sprite);
    const base = sc.enemies[0] ? sc.enemies[0].actor.position : this.F.pos;
    const [x, z] = this._ringSpot({ x: base.x, z: base.z }, [Math.random() - 0.5, Math.random() - 0.5], 0, 1);
    const e = this.makeEnemy(id, x, z, 'a' + this.uid, true);
    e.scripted = true; sc.enemies.push(e);
    audio.sfx('dash', { vol: 0.5 });
    this.fx.spark(this.chest(e, 0.5), 0xc0a0ff, 14, 4, 0.1, 0.6);
  }
  async cameraPunch() { this.world.shake = 0.3; }

  // ===================================================================== victory / defeat
  async endFight() {
    if (this.ending) return;
    this.ending = true;
    const sc = this.scripted;
    const F = this.F, G = this.G;
    this.resultBusy = true;
    for (const p of this.party) { p.act = null; p.actor.moving = false; }
    audio.stopMusic(0.3);
    await sleep(sc ? 650 : 350);
    audio.fanfare();
    for (const p of this.party) if (p.alive) { const a = p.actor; const t0 = performance.now(); const hop = () => { const k = (performance.now() - t0) / 500; if (k < 1) { a.hop = Math.abs(Math.sin(k * Math.PI * 2)) * 0.3; requestAnimationFrame(hop); } else a.hop = 0; }; hop(); }
    if (sc) await this.runEvents('victory');
    const fallen = this.spoils.slice();
    const rw = rewards(fallen);
    state.gold += rw.gold;
    for (const d of rw.drops) addItem(d, 1);
    const members = state.party.slice(0, 4);
    const share = (id) => (members.includes(id) ? rw.exp : Math.round(rw.exp * 0.5));
    const reports = [];
    for (const id of Object.keys(state.roster)) { const ups = gainExp(id, share(id)); if (members.includes(id)) reports.push({ id, ups, gain: share(id) }); }
    for (const p of this.party) this.refreshStats(p);
    state.battles++;
    this.spoils = [];
    if (sc) await this.resultsPanel(rw, reports);
    else this.quickResults(rw, reports);
    // fallen heroes get back on their feet
    for (const p of this.party) if (!p.alive) { p.hp = Math.max(1, Math.round(p.maxHp * 0.25)); }
    await this.runEvents('end');
    for (const p of this.party) { p.actor.ai = false; p.cd = {}; }
    this.resultBusy = false;
    this.ending = false;
    if (sc) { this.engaged = false; sc.resolve('victory'); }
    else audio.playMusic(F.def?.music ?? null);
  }
  quickResults(rw, reports) {
    const G = this.G;
    const drops = rw.drops.map((d) => itemInfo(d).name);
    G.toast(`<b>Victory!</b> &nbsp;EXP +${rw.exp} &nbsp;·&nbsp; ${rw.gold} G${drops.length ? ' &nbsp;·&nbsp; ' + drops.map(esc).join(', ') : ''}`, 'gold');
    for (const r of reports) for (const up of r.ups) {
      audio.jingle('levelup'); audio.sfx('level_up', { vol: 0.5 });
      const sk = up.skills.length ? ` &nbsp;New skill: ${up.skills.map((s) => esc(SKILLS[s].name)).join(', ')}` : '';
      G.toast(`<b>${esc(CHARS[r.id].name)}</b> reached <b>Lv ${up.lv}</b>!  HP ${up.before.maxHp}→${up.after.maxHp}  ATK ${up.before.atk}→${up.after.atk}${sk}`, 'good');
      const p = this.party.find((x) => x.id === r.id); if (p) this.fx.rise(this.chest(p, 0.3), 0xffe08a, 18, 0.9, 0.09, 1.2);
    }
  }
  async resultsPanel(rw, reports) {
    const panel = h('div', 'results panel');
    const drops = rw.drops.map((d) => esc(itemInfo(d).name));
    panel.innerHTML = `<div class="rt">VICTORY</div>
      <div class="rsum"><span>EXP <b>+${rw.exp}</b></span><span>Gold <b>+${rw.gold} G</b></span></div>
      ${drops.length ? `<div class="rdrop">Found: ${drops.join(', ')}</div>` : ''}
      <div class="rmem">${reports.map((r) => `<div class="rm" data-id="${r.id}">${ptImg(CHARS[r.id].sprite, 'face')}<div class="rn">${esc(CHARS[r.id].name)} <small>Lv ${state.roster[r.id].lv}</small>${r.ups.length ? '<span class="lvup">LEVEL UP!</span>' : ''}</div>${bar('xp', 100)}</div>`).join('')}</div>
      <div class="rhint">▼</div>`;
    root.appendChild(panel);
    await sleep(350);
    await new Promise((res) => { const off = input.push((a) => { if (a === 'ok' || a === 'cancel') { off(); res(); } return true; }); panel.addEventListener('click', () => { off(); res(); }, { once: true }); });
    panel.remove();
    for (const r of reports) {
      for (const up of r.ups) {
        audio.jingle('levelup'); audio.sfx('level_up', { vol: 0.6 });
        const c = CHARS[r.id];
        const keys = [['maxHp', 'HP'], ['maxMp', 'MP'], ['atk', 'ATK'], ['def', 'DEF'], ['mag', 'MAG'], ['res', 'RES'], ['spd', 'SPD']];
        const lp = h('div', 'results panel lvl');
        lp.innerHTML = `<div class="lvh">${ptImg(c.sprite, 'full')}<div><div class="rt">${esc(c.name)}</div><div class="lvn">Level ${up.lv - 1} → <b>${up.lv}</b></div></div></div>
          <div class="stats">${keys.map(([k, n]) => `<div><span>${n}</span><span>${up.before[k]} → <b>${up.after[k]}</b></span></div>`).join('')}</div>
          ${up.skills.length ? `<div class="newsk">Learned: ${up.skills.map((s) => esc(SKILLS[s].name)).join(', ')}</div>` : ''}<div class="rhint">▼</div>`;
        root.appendChild(lp);
        await sleep(300);
        await new Promise((res) => { const off = input.push((a) => { if (a === 'ok' || a === 'cancel') { off(); res(); } return true; }); lp.addEventListener('click', () => { off(); res(); }, { once: true }); });
        lp.remove();
      }
    }
  }
  async onWipe() {
    if (this.ending) return;
    this.ending = true; this.resultBusy = true;
    const G = this.G, F = this.F, sc = this.scripted;
    audio.stopMusic(0.5); audio.jingle('defeat');
    await G.fadeTo(0.85, 900);
    const panel = h('div', 'results panel defeat');
    panel.innerHTML = `<div class="rt">THE PARTY HAS FALLEN</div><div class="rdrop">…but the moonlight isn't done with you yet.</div><div class="list"></div>`;
    root.appendChild(panel);
    const lst = panel.querySelector('.list');
    const opts = [['Try again', 'retry']];
    if (lastSlot()) opts.push(['Load last save', 'load']);
    opts.push(['Return to title', 'title']);
    const rows = opts.map(([t]) => { const r = h('div', 'row', esc(t)); lst.appendChild(r); return r; });
    const i = await pick(rows, { cancelable: false });
    panel.remove();
    const k = opts[i][1];
    G.gfx.fade = 0;
    if (k === 'retry') {
      await G.fadeTo(1, 10);
      this.restoreSnapshot();
      await G.fadeTo(0, 300);
      this.resultBusy = false; this.ending = false;
      if (sc) { this.engaged = false; sc.resolve('retry'); } else audio.playMusic(F.def?.music ?? null);
      return;
    }
    this.resultBusy = false; this.ending = false;
    if (k === 'load') { const s = lastSlot(); await G.loadGame(s.n); } else { await G.toTitle(); }
    if (sc) { this.scripted = null; sc.resolve('abort'); }
  }
  restoreSnapshot() {
    const F = this.F, s = this.snap;
    if (!s) { for (const p of this.party) { p.hp = p.maxHp; } return; }
    state.roster = JSON.parse(JSON.stringify(s.roster));
    state.inv = { ...s.inv };
    for (const p of this.party) { this.refreshStats(p); p.status = {}; p.cd = {}; p.act = null; p.stun = p.hitstun = 0; p.invuln = 0; if (p.actor.dead) this._rise(p); }
    this.party.forEach((p, i) => { if (s.pos[i]) p.actor.position.set(s.pos[i][0], 0, s.pos[i][1]); });
    this.star = 0;
    this.ctrl = this.party[F.ctrl];
    if (!this.ctrl.alive) this.autoSwitch();
    // roaming groups come back to where they were
    if (!this.scripted) {
      for (const e of this.mobs) F.world.remove(e.actor.group);
      this.mobs = []; this.hud.clearEnemyBars();
      this.spawnDefs = s.defs;
      for (const d of this.spawnDefs) this._spawnGroup(d);
    } else {
      for (const e of this.scripted.enemies) { F.world.remove(e.actor.group); const i = this.mobs.indexOf(e); if (i >= 0) this.mobs.splice(i, 1); }
      for (const n of this.scripted.npcs) F.hideNpc(n, false);
    }
    this.projs.forEach((q) => q.mesh.userData.dispose()); this.projs = []; this.later = [];
    this.vfx.clear();
    this.engaged = false;
  }
}
