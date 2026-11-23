// Balance simulator: runs auto-battles with a simple player AI against each encounter zone / boss.
// usage: node tools/sim.mjs [zone|boss ...]
import { state, resetState, addChar, statsOf } from '../src/state.js';
import { ENEMIES, ZONES } from '../src/data/enemies.js';
import { SKILLS } from '../src/data/skills.js';
import { partyCombatant, enemyCombatant, computeHit, computeHeal, applyStatus, startTurn, endTurn, turnOrder, alive, aiPlan, lowestHp } from '../src/battle/core.js';

const G = (w, a, c) => ({ weapon: w, armor: a, charm: c });
const SETUPS = {
  woods:  { ids: ['haru', 'airi'], lv: 3, eq: { haru: G('wood_sword', 'cloak'), airi: G('oak_staff', 'cloak') } },
  woods2: { ids: ['haru', 'airi'], lv: 5, eq: { haru: G('iron_blade', 'leather'), airi: G('oak_staff', 'cloak') } },
  shrine: { ids: ['haru', 'airi', 'ren'], lv: 8, eq: { haru: G('iron_blade', 'leather'), airi: G('silver_staff', 'cloak'), ren: G('temper_katana', 'leather') } },
  port:   { ids: ['haru', 'airi', 'ren', 'daigo'], lv: 12, eq: { haru: G('steel_saber', 'ranger_mail'), airi: G('silver_staff', 'leather'), ren: G('temper_katana', 'ranger_mail'), daigo: G('iron_knuckles', 'leather') } },
  cave:   { ids: ['haru', 'airi', 'ren', 'sylva'], lv: 16, eq: { haru: G('moonlit_edge', 'ranger_mail'), airi: G('moon_staff', 'ranger_mail'), ren: G('wave_cutter', 'ranger_mail'), sylva: G('long_bow', 'ranger_mail') } },
  keep:   { ids: ['haru', 'airi', 'ren', 'zeno'], lv: 24, eq: { haru: G('moonlit_edge', 'knight_plate', 'power_band'), airi: G('moon_staff', 'moon_garb', 'mind_pendant'), ren: G('wave_cutter', 'knight_plate', 'swift_boots'), zeno: G('arcane_staff', 'moon_garb', 'mana_stone') } },
  final:  { ids: ['haru', 'airi', 'ren', 'zeno'], lv: 26, eq: { haru: G('starforged', 'star_raiment', 'shard_ring'), airi: G('seraph_staff', 'moon_garb', 'mind_pendant'), ren: G('shadow_fang', 'knight_plate', 'power_band'), zeno: G('cosmos_scepter', 'moon_garb', 'mana_stone') } },
  castle: { ids: ['haru', 'airi', 'ren', 'zeno'], lv: 21, eq: { haru: G('moonlit_edge', 'knight_plate', 'power_band'), airi: G('moon_staff', 'moon_garb'), ren: G('wave_cutter', 'knight_plate'), zeno: G('arcane_staff', 'moon_garb') } },
};
const BOSSES = {
  ren_duel: ['woods2', ['ren_duel']], gob_chief: ['woods2', ['gob_chief', 'gob_grunt', 'gob_archer']], ban_king: ['shrine', ['ban_king', 'ban_assassin', 'ban_assassin']],
  pir_capt: ['port', ['pir_capt', 'pir_first', 'pir_marks']], cav_necro: ['cave', ['cav_necro', 'cav_cultist', 'cav_cultist']],
  cav_gorgon: ['cave', ['cav_gorgon', 'cav_priest']], cas_matriarch: ['castle', ['cas_matriarch', 'cas_witch']],
  cas_warlord_boss: ['castle', ['cas_warlord_boss', 'cas_guard']], boss_vampire: ['keep', ['boss_vampire']], boss_tyrant: ['final', ['boss_tyrant']],
};

function setup(name, lvAdd = 0) {
  const s = SETUPS[name];
  resetState();
  for (const id of s.ids) { addChar(id, { lv: s.lv + lvAdd, equip: s.eq[id] }); }
  for (const id of s.ids) { const st = statsOf(id); state.roster[id].hp = st.maxHp; state.roster[id].mp = st.maxMp; }
  return s.ids.map(partyCombatant);
}

function playerAct(a, party, foes, gauge) {
  const af = alive(foes);
  const ws = a.skills.map((id) => SKILLS[id]);
  if (gauge.v >= 100 && Math.random() < 0.9) { gauge.v = 0; const sk = SKILLS[a.burst]; return { skill: sk, targets: tgt(sk, a, party, foes) }; }
  const hurt = alive(party).filter((p) => p.hp / p.maxHp < 0.5);
  const heal = ws.find((s) => s.kind === 'heal' && s.target === 'ally' && a.mp >= s.mp);
  if (hurt.length && heal) return { skill: heal, targets: [lowestHp(party)] };
  const healAll = ws.find((s) => s.kind === 'heal' && s.target === 'allies' && a.mp >= s.mp);
  if (healAll && alive(party).filter((p) => p.hp / p.maxHp < 0.6).length >= 2) return { skill: healAll, targets: alive(party) };
  const raise = ws.find((s) => s.kind === 'revive' && a.mp >= s.mp);
  if (raise && party.some((p) => !p.alive)) return { skill: raise, targets: [party.find((p) => !p.alive)] };
  const dmg = ws.filter((s) => (s.kind === 'phys' || s.kind === 'mag') && a.mp >= s.mp && !(a.id === 'airi' && a.mp < 12));
  const pick = (af.length >= 3 ? dmg.filter((s) => s.target === 'enemies') : []).concat(dmg).sort((x, y) => x.power * x.hits * (x.target === 'enemies' ? af.length : 1) / (1 + x.mp * 0.02) - y.power * y.hits * (y.target === 'enemies' ? af.length : 1) / (1 + y.mp * 0.02)).pop();
  if (pick && Math.random() < 0.85) return { skill: pick, targets: tgt(pick, a, party, foes) };
  return { skill: null, targets: [lowestHp(af) && Math.random() < 0.5 ? lowestHp(af) : af[Math.floor(Math.random() * af.length)]] };
}
function tgt(sk, a, party, foes) {
  const af = alive(foes);
  if (sk.target === 'enemies') return af;
  if (sk.target === 'allies') return alive(party);
  if (sk.target === 'random') return [af[Math.floor(Math.random() * af.length)]];
  if (sk.target === 'self') return [a];
  return [af.sort((x, y) => x.hp - y.hp)[0]];
}
function execute(a, plan, party, foes, gauge) {
  const sk = plan.skill;
  if (sk && a.side === 'party') { a.mp -= sk.mp; gauge.v = Math.min(100, gauge.v + 4); }
  const hits = sk ? sk.hits : 1;
  const own = a.side === 'party' ? party : foes;
  for (const t0 of plan.targets) {
    let t = t0;
    if (sk && (sk.kind === 'heal')) { if (!t.alive) continue; t.hp = Math.min(t.maxHp, t.hp + computeHeal(a, sk)); if (sk.revive) { /* burst revive */ } if (sk.buff) for (const [k, v] of Object.entries(sk.buff)) applyStatus(t, k, v); continue; }
    if (sk && sk.kind === 'revive') { t.alive = true; t.hp = Math.round(t.maxHp * sk.power / 100); continue; }
    if (sk && sk.kind === 'cleanse') { delete t.status.poison; t.hp = Math.min(t.maxHp, t.hp + 40); continue; }
    if (sk && sk.kind === 'buff') { for (const [k, v] of Object.entries(sk.buff)) applyStatus(t, k, v); continue; }
    if (sk && sk.kind === 'debuff') { if (sk.status) applyStatus(t, sk.status.id, sk.status.turns, sk.status.chance); continue; }
    for (let h = 0; h < hits; h++) {
      if (!t.alive) { const alt = alive(a.side === 'party' ? foes : party); if (!alt.length) break; t = alt[Math.floor(Math.random() * alt.length)]; }
      const r = computeHit(a, t, sk);
      t.hp -= r.dmg; if (sk && sk.kind === 'drain') a.hp = Math.min(a.maxHp, a.hp + Math.round(r.dmg * 0.5));
      if (t.side === 'party') gauge.v = Math.min(100, gauge.v + 8); else if (a.side === 'party') gauge.v = Math.min(100, gauge.v + 5);
      if (sk && sk.status && t.hp > 0) applyStatus(t, sk.status.id, sk.status.turns, sk.status.chance);
      if (t.hp <= 0) { t.hp = 0; t.alive = false; t.status = {}; }
    }
  }
}
function fight(setupName, enemyIds, lvAdd = 0) {
  const party = setup(setupName, lvAdd), foes = enemyIds.map((e, i) => enemyCombatant(e, i));
  const gauge = { v: 0 };
  let rounds = 0;
  const startHp = party.reduce((s, p) => s + p.hp, 0);
  while (alive(party).length && alive(foes).length && rounds < 60) {
    rounds++;
    for (const c of turnOrder([...party, ...foes])) {
      if (!c.alive || !alive(party).length || !alive(foes).length) continue;
      const st = startTurn(c);
      if (st.poison) { c.hp -= st.poison; if (c.hp <= 0) { c.hp = 0; c.alive = false; continue; } }
      if (st.regen) c.hp = Math.min(c.maxHp, c.hp + st.regen);
      if (!st.skip) {
        const plan = c.side === 'party' ? playerAct(c, party, foes, gauge) : aiPlan(c, foes, party);
        if (plan.targets.every((t) => !t)) continue;
        execute(c, { skill: plan.skill, targets: plan.targets.filter(Boolean) }, party, foes, gauge);
      }
      endTurn(c);
    }
  }
  const win = alive(foes).length === 0 && alive(party).length > 0;
  const endHp = party.reduce((s, p) => s + Math.max(0, p.hp), 0);
  return { win, rounds, lost: (startHp - endHp) / party.reduce((s, p) => s + p.maxHp, 0), dead: party.filter((p) => !p.alive).length };
}
function pickZone(tbl) { const tot = tbl.reduce((s, e) => s + e[0], 0); let r = Math.random() * tot; for (const [w, e] of tbl) { if ((r -= w) <= 0) return e; } return tbl[0][1]; }

const N = 150;
const args = process.argv.slice(2);
const lvAdd = Number((args.find((a) => a.startsWith('lv=')) || 'lv=0').slice(3));
const zoneMap = { woods: 'woods', woods2: 'woods2', shrine: 'shrine', port: 'port', cave: 'cave', castle: 'castle' };
console.log(`zone/boss         win%  rounds  hp-lost%  deaths   (lv ${lvAdd >= 0 ? '+' : ''}${lvAdd})`);
for (const [z, setupName] of Object.entries(zoneMap)) {
  if (args.length && !args.includes(z) && !args.some((a) => !a.startsWith('lv='))) continue;
  if (args.filter((a) => !a.startsWith('lv=')).length && !args.includes(z)) continue;
  let w = 0, r = 0, l = 0, d = 0;
  for (let i = 0; i < N; i++) { const res = fight(setupName, pickZone(ZONES[z]), lvAdd); w += res.win; r += res.rounds; l += res.lost; d += res.dead; }
  console.log(`${z.padEnd(16)} ${(100 * w / N).toFixed(0).padStart(4)}  ${(r / N).toFixed(1).padStart(6)}  ${(100 * l / N).toFixed(0).padStart(8)}  ${(d / N).toFixed(2).padStart(6)}`);
}
for (const [b, [setupName, ids]] of Object.entries(BOSSES)) {
  if (args.filter((a) => !a.startsWith('lv=')).length && !args.includes(b)) continue;
  let w = 0, r = 0, l = 0, d = 0; const M = 80;
  for (let i = 0; i < M; i++) { const res = fight(setupName, ids, lvAdd); w += res.win; r += res.rounds; l += res.lost; d += res.dead; }
  console.log(`${b.padEnd(16)} ${(100 * w / M).toFixed(0).padStart(4)}  ${(r / M).toFixed(1).padStart(6)}  ${(100 * l / M).toFixed(0).padStart(8)}  ${(d / M).toFixed(2).padStart(6)}`);
}
