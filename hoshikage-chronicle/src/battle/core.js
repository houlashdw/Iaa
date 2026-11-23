// Pure battle rules (no DOM, no three.js): used by the real battle scene and by tools/sim.mjs for balancing.
import { SKILLS } from '../data/skills.js';
import { ENEMIES } from '../data/enemies.js';
import { CHARS } from '../data/characters.js';
import { state, statsOf, learned } from '../state.js';

export function partyCombatant(id) {
  const r = state.roster[id], s = statsOf(id), c = CHARS[id];
  return {
    id, side: 'party', name: c.name, sprite: c.sprite, height: c.bHeight, lv: r.lv, hp: r.hp, maxHp: s.maxHp, mp: r.mp, maxMp: s.maxMp,
    atk: s.atk, def: s.def, mag: s.mag, res: s.res, spd: s.spd, status: {}, weak: [], resist: [], immune: [], skills: learned(id), alive: r.hp > 0,
    burst: c.burst, color: c.color,
  };
}
export function enemyCombatant(eid, idx) {
  const e = ENEMIES[eid];
  return {
    id: eid, uid: eid + idx, side: 'enemy', name: e.name, sprite: e.sprite, height: e.height, lv: e.lv, hp: e.hp, maxHp: e.hp, mp: 999, maxMp: 999,
    atk: e.atk, def: e.def, mag: e.mag, res: e.res, spd: e.spd, status: {}, weak: e.weak, resist: e.resist, immune: e.immune || [], alive: true,
    ai: e.skills, boss: e.boss, exp: e.exp, gold: e.gold, drops: e.drops,
  };
}

const mod = (c, k) => {
  let v = c[k];
  if (k === 'atk') { if (c.status.atkUp) v *= 1.35; if (c.status.atkDown) v *= 0.7; }
  if (k === 'def' || k === 'res') { if (c.status.defUp) v *= 1.35; if (c.status.defDown) v *= 0.7; if (c.status.guard) v *= 1.8; }
  return v;
};
export const DEF_K = 70;

/** damage of one hit. skill may be null (normal attack). */
export function computeHit(a, t, skill, rng = Math.random) {
  const kind = skill ? skill.kind : 'phys';
  const power = skill ? skill.power : 100;
  const el = skill ? skill.el : 'none';
  const magic = kind === 'mag' || kind === 'drain';
  const off = magic ? a.mag * (a.status.atkUp ? 1.15 : 1) * (a.status.atkDown ? 0.85 : 1) : mod(a, 'atk');
  let defv = magic ? mod(t, 'res') : mod(t, 'def');
  if (skill && skill.pierce) defv *= 1 - skill.pierce;
  let dmg = ((off * power) / 100) * (DEF_K / (DEF_K + defv));
  dmg *= 0.92 + rng() * 0.16;
  let crit = false, weak = false, resist = false;
  if (!magic) {
    const cc = a.status.focus ? 1 : 0.06 + a.spd / 1200;
    if (rng() < cc) { crit = true; dmg *= 1.5; }
  }
  if (el !== 'none') {
    if (t.weak.includes(el)) { dmg *= 1.5; weak = true; } else if (t.resist.includes(el)) { dmg *= 0.5; resist = true; }
  }
  return { dmg: Math.max(1, Math.round(dmg)), crit, weak, resist };
}
export function computeHeal(a, skill) { return Math.round((a.mag * skill.power) / 100 * 3 * (0.95 + Math.random() * 0.1)); }

export function applyStatus(t, id, turns, chance = 1, rng = Math.random) {
  if (!t.alive || t.immune.includes(id)) return false;
  if (rng() > chance) return false;
  t.status[id] = Math.max(t.status[id] || 0, turns);
  return true;
}
/** start-of-turn processing. returns {skip, poisonDmg, regen} */
export function startTurn(c) {
  const out = { skip: false, poison: 0, regen: 0 };
  if (c.status.guard) delete c.status.guard;
  if (c.status.poison) out.poison = Math.max(1, Math.round(c.maxHp * 0.06));
  if (c.status.regen) out.regen = Math.max(1, Math.round(c.maxHp * 0.07));
  if (c.status.stun) out.skip = true;
  return out;
}
export function endTurn(c) {
  for (const k of Object.keys(c.status)) {
    if (k === 'guard') continue;
    c.status[k]--;
    if (c.status[k] <= 0) delete c.status[k];
  }
}
export function turnOrder(list, rng = Math.random) {
  return list.filter((c) => c.alive).map((c) => ({ c, k: c.spd * (0.9 + rng() * 0.22) })).sort((a, b) => b.k - a.k).map((x) => x.c);
}
export const alive = (arr) => arr.filter((c) => c.alive);
export const lowestHp = (arr) => alive(arr).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];

/** enemy decision */
export function aiPlan(actor, allies, foes, rng = Math.random) {
  const opts = [];
  for (const [id, w] of actor.ai) {
    const sk = id === 'attack' ? null : SKILLS[id];
    if (sk) {
      if (sk.kind === 'heal' && !allies.some((a) => a.alive && a.hp / a.maxHp < 0.6)) continue;
      if (sk.kind === 'buff' && sk.buff && Object.keys(sk.buff).every((b) => actor.status[b])) continue;
      if (sk.kind === 'debuff' && sk.status && foes.every((f) => !f.alive || f.status[sk.status.id])) continue;
    }
    opts.push([sk, w]);
  }
  if (!opts.length) opts.push([null, 1]);
  let r = rng() * opts.reduce((s, o) => s + o[1], 0), sk = opts[0][0];
  for (const [s, w] of opts) { if ((r -= w) <= 0) { sk = s; break; } }
  const tg = sk ? sk.target : 'enemy';
  let targets;
  const af = alive(foes), aa = alive(allies);
  if (tg === 'enemies') targets = af;
  else if (tg === 'allies') targets = aa;
  else if (tg === 'self') targets = [actor];
  else if (tg === 'ally') targets = [lowestHp(allies)];
  else if (tg === 'random') targets = [af[Math.floor(rng() * af.length)]];
  else targets = [rng() < 0.3 ? lowestHp(foes) : af[Math.floor(rng() * af.length)]];
  return { skill: sk, targets };
}
export function rewards(enemies) {
  let exp = 0, gold = 0; const drops = [];
  for (const e of enemies) {
    exp += e.exp; gold += Math.round(e.gold * (0.85 + Math.random() * 0.3));
    for (const [item, ch] of e.drops || []) if (Math.random() < ch) drops.push(item);
  }
  return { exp, gold, drops };
}
export const ENEMY_ZONES = ENEMIES;
