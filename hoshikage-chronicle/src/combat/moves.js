// Real-time move definitions. The skill table (data/skills.js) still owns power / element / status / MP;
// this file decides how each skill *plays*: its shape (melee cone, nova, bolt, arrow volley, ground target...),
// wind-up, range and cooldown. Used by both the player party and the enemies.
import { SKILLS } from '../data/skills.js';
import { CHARS } from '../data/characters.js';
import { state, learned } from '../state.js';

// five hotbar slots per hero (keys 1-5); a slot unlocks when the hero learns the skill
export const KITS = {
  haru: ['crescent', 'twin_fang', 'brave_heart', 'shard_surge', 'full_moon'],
  airi: ['holy_spark', 'heal', 'blessing', 'radiant_rain', 'sanctify'],
  ren: ['iai', 'blade_dance', 'mist_cutter', 'focus', 'moon_exec'],
  daigo: ['palm', 'inner_peace', 'tiger_claw', 'iron_body', 'dragon_kick'],
  sylva: ['pierce', 'poison_arrow', 'mark_prey', 'volley', 'snipe'],
  zeno: ['flame_lance', 'frost_nova', 'chain_lightning', 'meteor_rain', 'arcane_rift'],
};
export function hotbar(id) {
  const L = state.roster[id] ? learned(id) : [];
  return (KITS[id] || []).map((s) => {
    const lv = (CHARS[id].learn.find(([, k]) => k === s) || [99])[0];
    return { id: s, locked: !L.includes(s), lv };
  });
}

// basic attack per weapon. t = total time of a swing, hit = when the damage lands, mul = fraction of a full attack
export const BASIC = {
  sword: { kind: 'melee', combo: [
    { t: 0.40, hit: 0.12, range: 2.3, arc: 2.1, mul: 0.62, lunge: 0.8 },
    { t: 0.40, hit: 0.12, range: 2.3, arc: 2.1, mul: 0.62, lunge: 0.8 },
    { t: 0.60, hit: 0.20, range: 2.6, arc: 2.6, mul: 0.95, lunge: 1.2, kb: 3.5 }], gap: 0.30, fx: 0xfff2c0 },
  blade: { kind: 'melee', combo: [
    { t: 0.32, hit: 0.09, range: 2.6, arc: 1.7, mul: 0.55, lunge: 1.0 },
    { t: 0.32, hit: 0.09, range: 2.6, arc: 1.7, mul: 0.55, lunge: 1.0 },
    { t: 0.50, hit: 0.15, range: 3.0, arc: 2.2, mul: 0.9, lunge: 1.6, kb: 3 }], gap: 0.26, fx: 0xdfe8ff },
  fist: { kind: 'melee', combo: [
    { t: 0.30, hit: 0.09, range: 1.9, arc: 2.4, mul: 0.46, lunge: 0.5 },
    { t: 0.30, hit: 0.09, range: 1.9, arc: 2.4, mul: 0.46, lunge: 0.5 },
    { t: 0.30, hit: 0.09, range: 1.9, arc: 2.4, mul: 0.46, lunge: 0.5 },
    { t: 0.55, hit: 0.18, range: 2.3, arc: 2.6, mul: 0.95, lunge: 1.0, kb: 4 }], gap: 0.25, fx: 0xffd9a0 },
  bow: { kind: 'shoot', t: 0.52, speed: 30, range: 26, mul: 0.88, el: 'none', fx: 0xe8f0d0 },
  staff: { kind: 'bolt', t: 0.62, speed: 22, range: 20, mul: 0.78 },
};
export const STAFF_ELEMENT = { airi: ['light', 0xfff0a8], zeno: ['thunder', 0xffe35c] };

const E = { none: 0xffffff, fire: 0xff8a3a, ice: 0x9fe8ff, thunder: 0xffe35c, light: 0xfff0b0, dark: 0xa060ff };
export const elColor = (el) => E[el] ?? 0xffffff;

// ---- per-skill play style. Anything not listed falls back to a sensible default derived from its data.
const M = {
  // --- Haru
  crescent: { shape: 'melee', range: 3.0, arc: 2.0, windup: 0.16, lunge: 2.0, recover: 0.25 },
  twin_fang: { shape: 'melee', range: 2.6, arc: 2.2, windup: 0.12, hitGap: 0.14, lunge: 1.4, recover: 0.25 },
  shard_surge: { shape: 'nova', radius: 5.2, windup: 0.4, recover: 0.3 },
  full_moon: { shape: 'melee', range: 3.6, arc: 3.0, windup: 0.5, lunge: 2.6, recover: 0.5, shock: true },
  // --- Airi
  holy_spark: { shape: 'bolt', speed: 24, range: 20, windup: 0.18, recover: 0.2 },
  sanctify: { shape: 'nova', radius: 6.2, windup: 0.5, recover: 0.4 },
  // --- Ren
  iai: { shape: 'melee', range: 3.4, arc: 1.4, windup: 0.14, lunge: 4.2, recover: 0.3 },
  blade_dance: { shape: 'melee', range: 2.8, arc: 4.4, windup: 0.1, hitGap: 0.1, lunge: 0.6, recover: 0.3 },
  mist_cutter: { shape: 'nova', radius: 4.4, windup: 0.22, recover: 0.3 },
  moon_exec: { shape: 'melee', range: 3.8, arc: 1.6, windup: 0.45, lunge: 5.0, recover: 0.5, shock: true },
  // --- Daigo
  palm: { shape: 'melee', range: 2.3, arc: 1.8, windup: 0.12, lunge: 1.0, recover: 0.22 },
  tiger_claw: { shape: 'melee', range: 2.4, arc: 2.2, windup: 0.1, hitGap: 0.12, lunge: 1.2, recover: 0.25 },
  dragon_kick: { shape: 'melee', range: 3.4, arc: 3.4, windup: 0.42, lunge: 4.0, recover: 0.5, shock: true },
  // --- Sylva
  pierce: { shape: 'arrow', speed: 36, range: 28, windup: 0.18, recover: 0.2 },
  poison_arrow: { shape: 'arrow', speed: 32, range: 26, windup: 0.18, recover: 0.2 },
  mark_prey: { shape: 'arrow', speed: 34, range: 26, windup: 0.16, recover: 0.2 },
  volley: { shape: 'arrow', speed: 30, range: 24, count: 5, spread: 0.62, hitMul: 0.62, windup: 0.3, recover: 0.3 },
  snipe: { shape: 'arrow', speed: 60, range: 36, through: true, windup: 0.55, recover: 0.4 },
  // --- Zeno
  flame_lance: { shape: 'bolt', speed: 20, range: 22, boom: 1.6, windup: 0.22, recover: 0.2 },
  frost_nova: { shape: 'nova', radius: 5.4, windup: 0.35, recover: 0.3 },
  chain_lightning: { shape: 'chain', jumps: 4, reach: 9, windup: 0.3, recover: 0.3 },
  meteor_rain: { shape: 'rain', radius: 2.2, count: 6, area: 4.2, hitMul: 0.55, windup: 0.45, recover: 0.5 },
  arcane_rift: { shape: 'ground', radius: 3.4, delay: 0.85, windup: 0.4, recover: 0.5, range: 16 },
  spark: { shape: 'bolt', speed: 28, range: 22, windup: 0.15, recover: 0.2 },
  // --- enemy
  e_bash: { shape: 'melee', range: 2.1, arc: 1.7, windup: 0.55, recover: 0.5 },
  e_slash: { shape: 'melee', range: 2.2, arc: 2.0, windup: 0.5, recover: 0.5 },
  e_arrow: { shape: 'arrow', speed: 17, range: 20, windup: 0.7, recover: 0.5, tele: 'line' },
  e_stone: { shape: 'bolt', speed: 15, range: 16, windup: 0.6, recover: 0.5 },
  e_bomb: { shape: 'ground', radius: 2.3, delay: 1.1, windup: 0.5, recover: 0.5, range: 12, lob: true },
  e_fireball: { shape: 'bolt', speed: 11, range: 18, boom: 1.5, windup: 0.8, recover: 0.5 },
  e_hex: { shape: 'bolt', speed: 12, range: 14, windup: 0.7, recover: 0.5 },
  e_curse: { shape: 'bolt', speed: 12, range: 14, windup: 0.7, recover: 0.5 },
  e_poison: { shape: 'melee', range: 2.1, arc: 1.7, windup: 0.5, recover: 0.5 },
  e_smash: { shape: 'melee', range: 2.8, arc: 1.9, windup: 0.95, recover: 0.8, shock: true },
  e_cleave: { shape: 'nova', radius: 3.4, windup: 0.8, recover: 0.6 },
  e_triple: { shape: 'melee', range: 2.2, arc: 1.9, windup: 0.45, hitGap: 0.26, recover: 0.6 },
  e_wave: { shape: 'ground', radius: 3.6, delay: 1.0, windup: 0.5, recover: 0.6, range: 14 },
  e_storm: { shape: 'ground', radius: 3.4, delay: 1.0, windup: 0.5, recover: 0.6, range: 14 },
  e_dark: { shape: 'bolt', speed: 13, range: 20, windup: 0.8, recover: 0.5 },
  e_darkall: { shape: 'ground', radius: 4.8, delay: 1.2, windup: 0.5, recover: 0.7, range: 14 },
  e_drain: { shape: 'bolt', speed: 14, range: 18, windup: 0.7, recover: 0.5 },
  e_stunning: { shape: 'melee', range: 7.5, arc: 0.9, windup: 1.0, recover: 0.6, gaze: true },
  e_holy: { shape: 'bolt', speed: 13, range: 20, windup: 0.8, recover: 0.5 },
  e_pulse: { shape: 'ground', radius: 4.2, delay: 1.1, windup: 0.5, recover: 0.6, range: 14 },
  e_ultimate: { shape: 'ground', radius: 7.0, delay: 1.7, windup: 0.6, recover: 0.8, range: 16 },
  e_mend: { shape: 'support', windup: 0.5, recover: 0.4 },
  e_rally: { shape: 'support', windup: 0.5, recover: 0.4 },
  e_guardup: { shape: 'support', windup: 0.4, recover: 0.4 },
  e_selfheal: { shape: 'support', windup: 0.8, recover: 0.5 },
};
/** how fast a skill can be used again (seconds) */
const cdOf = (sk) => (sk.burst ? 0 : Math.min(15, 2.2 + sk.mp * 0.42 + (sk.big ? 2.5 : 0)));

export function moveOf(id) {
  if (id === 'attack' || !SKILLS[id]) return null;
  const sk = SKILLS[id];
  const o = M[id];
  let m;
  if (['heal', 'buff', 'cleanse', 'revive'].includes(sk.kind) || (sk.kind === 'heal')) m = { shape: 'support', windup: 0.3, recover: 0.3 };
  else if (o) m = { ...o };
  else if (sk.target === 'enemies') m = { shape: 'nova', radius: sk.big ? 6.5 : 4.5, windup: 0.4, recover: 0.4 };
  else if (sk.fx === 'arrow') m = { shape: 'arrow', speed: 30, range: 24, windup: 0.2, recover: 0.25 };
  else if (['light', 'fire', 'ice', 'thunder', 'dark'].includes(sk.fx)) m = { shape: 'bolt', speed: 20, range: 20, windup: 0.25, recover: 0.25 };
  else m = { shape: 'melee', range: 2.8, arc: 2.0, windup: 0.2, recover: 0.3 };
  if (o && ['heal', 'buff', 'cleanse', 'revive'].includes(sk.kind)) Object.assign(m, o);
  m.id = id; m.sk = sk;
  m.cd = cdOf(sk);
  m.hits = sk.hits || 1;
  return m;
}
