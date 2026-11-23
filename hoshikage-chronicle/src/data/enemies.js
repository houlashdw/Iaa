// Enemy roster. Stats are derived from a level and a role template so the whole game scales consistently.
// late-game enemies scale a little faster than the party's raw growth so gear/levels never trivialise fights
const TUNE = { hp: 0.034, off: 0.036, def: 0.02 };
const base = (lv) => ({ hp: (34 + lv * 20) * (1 + lv * TUNE.hp), atk: (10 + lv * 3.0) * (1 + lv * TUNE.off), def: (6 + lv * 1.7) * (1 + lv * TUNE.def), mag: (8 + lv * 2.7) * (1 + lv * TUNE.off), res: (6 + lv * 1.5) * (1 + lv * TUNE.def), spd: 9 + lv * 1.05 });
const ROLES = {
  grunt:   { hp: 1, atk: 1, def: 1, mag: 0.7, res: 0.8, spd: 1 },
  tank:    { hp: 1.45, atk: 0.9, def: 1.45, mag: 0.5, res: 0.9, spd: 0.7 },
  caster:  { hp: 0.75, atk: 0.55, def: 0.7, mag: 1.35, res: 1.2, spd: 1 },
  fast:    { hp: 0.75, atk: 1.05, def: 0.8, mag: 0.6, res: 0.8, spd: 1.45 },
  brute:   { hp: 1.75, atk: 1.3, def: 1.1, mag: 0.5, res: 0.7, spd: 0.7 },
  support: { hp: 0.85, atk: 0.6, def: 0.8, mag: 1.1, res: 1.1, spd: 1.05 },
  boss:    { hp: 7, atk: 1.5, def: 1.2, mag: 1.5, res: 1.3, spd: 1.0 },
};
export const ENEMIES = {};
function en(id, sprite, name, lv, role, o = {}) {
  const b = base(lv), r = ROLES[role], boss = role === 'boss' || o.boss;
  const hpMul = o.hpMul || 1;
  ENEMIES[id] = {
    id, sprite, name, lv, role, boss: !!boss,
    hp: Math.round(b.hp * r.hp * hpMul), mp: 999,
    atk: Math.round(b.atk * r.atk * (o.atkMul || 1)), def: Math.round(b.def * r.def), mag: Math.round(b.mag * r.mag * (o.atkMul || 1)), res: Math.round(b.res * r.res), spd: Math.round(b.spd * r.spd),
    exp: Math.round((6 + lv * 5.4) * 1.7 * (boss ? 5 : 1) * (o.expMul || 1)), gold: Math.round((5 + lv * 3.4) * (boss ? 7 : 1)),
    skills: o.skills || [['attack', 3]], weak: o.weak || [], resist: o.resist || [], drops: o.drops || [],
    height: o.height || (sprite.startsWith('goblins') ? 1.5 : 1.95), immune: o.immune || (boss ? ['stun'] : []),
  };
}
const A = 'attack';
// ---- Whispering Woods (lv 2-5)
en('gob_pup', 'goblins_pup', 'Goblin Pup', 1, 'grunt', { hpMul: 0.62, atkMul: 0.82, skills: [[A, 3], ['e_stone', 1]], height: 1.4, drops: [['tonic', 0.15]] });
en('gob_grunt', 'goblins_grunt', 'Goblin Grunt', 2, 'grunt', { skills: [[A, 3], ['e_slash', 2]], drops: [['tonic', 0.18]] });
en('gob_slinger', 'goblins_slinger', 'Goblin Slinger', 2, 'fast', { skills: [['e_stone', 3], [A, 1]], drops: [['leaf', 0.12]] });
en('gob_archer', 'goblins_archer', 'Goblin Archer', 3, 'grunt', { skills: [['e_arrow', 3], [A, 1]], drops: [['tonic', 0.18]] });
en('gob_scout', 'goblins_scout', 'Goblin Scout', 3, 'fast', { skills: [['e_triple', 2], [A, 2]], weak: ['light'] });
en('gob_shaman', 'goblins_shaman', 'Goblin Shaman', 4, 'caster', { skills: [['e_mend', 2], ['e_hex', 2], ['e_fireball', 2]], weak: ['thunder'], drops: [['dew', 0.2]] });
en('gob_bomber', 'goblins_bomber', 'Goblin Bomber', 4, 'grunt', { skills: [['e_bomb', 3], [A, 1]], weak: ['ice'], resist: ['fire'] });
en('gob_brute', 'goblins_brute', 'Goblin Brute', 5, 'brute', { skills: [['e_smash', 2], [A, 3]], height: 2.2, drops: [['draught', 0.12]] });
en('gob_shield', 'goblins_shieldbearer', 'Shieldbearer', 5, 'tank', { skills: [[A, 3], ['e_guardup', 1]], weak: ['thunder'], height: 1.7 });
en('gob_rider', 'goblins_wolf_rider', 'Wolf Rider', 5, 'fast', { skills: [['e_triple', 2], ['e_slash', 2]], height: 1.75 });
en('gob_chief', 'goblins_warchief', 'Warchief Gruk', 7, 'boss', { skills: [['e_cleave', 2], ['e_smash', 2], [A, 2], ['e_rally', 1]], height: 2.5, hpMul: 0.3, drops: [['brew', 1]], atkMul: 0.6 });
// ---- Ashen Shrine (lv 6-9)
en('ban_assassin', 'villains_assassin', 'Shrine Bandit', 7, 'fast', { skills: [['e_triple', 2], ['e_poison', 2]], weak: ['light'] });
en('ban_ranger', 'villains_dread_ranger', 'Bandit Archer', 7, 'grunt', { skills: [['e_arrow', 3], ['e_poison', 1]], drops: [['leaf', 0.2]] });
en('ban_reaver', 'villains_reaver', 'Bandit Reaver', 8, 'brute', { skills: [['e_smash', 2], [A, 3]], height: 2.2, weak: ['ice'] });
en('ban_monk', 'villains_dark_monk', 'Fallen Monk', 8, 'grunt', { skills: [[A, 3], ['e_stunning', 1], ['e_guardup', 1]], weak: ['light'] });
en('ban_doc', 'villains_plague_doctor', 'Plague Doctor', 8, 'support', { skills: [['e_poison', 2], ['e_mend', 2], ['e_curse', 1]], weak: ['fire'], drops: [['phoenix', 0.1]] });
en('gob_firebrand', 'goblins_firebrand', 'Goblin Firebrand', 7, 'caster', { skills: [['e_fireball', 3], ['e_bomb', 1]], weak: ['ice'], resist: ['fire'] });
en('gob_duelist', 'goblins_duelist', 'Goblin Duelist', 7, 'fast', { skills: [['e_triple', 3], [A, 1]] });
en('ren_duel', 'ren', 'Ren the Ronin', 8, 'fast', { boss: true, skills: [['e_triple', 2], ['e_slash', 2], ['e_guardup', 1]], hpMul: 2.1, atkMul: 0.8, height: 1.95, immune: ['stun'] });
en('ban_king', 'villains_bandit_king', 'Bandit King Gorou', 11, 'boss', { skills: [['e_triple', 3], ['e_cleave', 2], [A, 1], ['e_rally', 1]], height: 2.4, hpMul: 0.4, drops: [['draught', 1]], atkMul: 0.8 });
// ---- Port Namiji (lv 10-13)
en('pir_swash', 'pirates_swashbuckler', 'Swashbuckler', 10, 'fast', { skills: [['e_triple', 3], [A, 1]] });
en('pir_cannon', 'pirates_cannoneer', 'Cannoneer', 11, 'brute', { skills: [['e_bomb', 2], ['e_smash', 1], [A, 1]], height: 2.2, weak: ['ice'] });
en('pir_marks', 'pirates_marksman', 'Pirate Marksman', 10, 'grunt', { skills: [['e_arrow', 3], [A, 1]], height: 1.6 });
en('pir_harp', 'pirates_harpooner', 'Harpooner', 11, 'grunt', { skills: [['e_slash', 2], ['e_smash', 1]], height: 2.2 });
en('pir_zerk', 'pirates_berserker', 'Anchor Berserker', 12, 'brute', { skills: [['e_smash', 2], [A, 2]], height: 2.3, weak: ['light'] });
en('pir_pois', 'pirates_poisoner', 'Toad Poisoner', 11, 'support', { skills: [['e_poison', 3], ['e_curse', 1]], height: 1.6, weak: ['fire'] });
en('pir_saw', 'pirates_sawbones', 'Sawbones', 11, 'support', { skills: [['e_mend', 2], [A, 2], ['e_curse', 1]], drops: [['draught', 0.2]] });
en('pir_storm', 'pirates_stormcaller', 'Stormcaller', 12, 'caster', { skills: [['e_storm', 3], ['e_hex', 1]], weak: ['ice'], resist: ['thunder'] });
en('pir_rigger', 'pirates_rigger', 'Rat Rigger', 10, 'fast', { skills: [['e_triple', 2], [A, 2]], height: 1.6 });
en('pir_marine', 'pirates_marine', 'Reef Marine', 12, 'tank', { skills: [[A, 3], ['e_guardup', 1]], weak: ['thunder'] });
en('pir_first', 'pirates_first_mate', 'First Mate Orlo', 13, 'brute', { skills: [['e_smash', 2], ['e_cleave', 2], [A, 1]], height: 2.3, boss: true, hpMul: 1.0 });
en('pir_capt', 'pirates_captain', 'Captain Redtide', 16, 'boss', { skills: [['e_triple', 3], ['e_cleave', 2], ['e_bomb', 1], ['e_rally', 1]], height: 2.3, hpMul: 0.42, drops: [['brew', 1]], atkMul: 0.7 });
// ---- Crystal Caverns (lv 14-18)
en('cav_cultist', 'pirates_tide_cultist', 'Tide Cultist', 15, 'caster', { skills: [['e_wave', 3], ['e_hex', 1], ['e_mend', 1]], weak: ['thunder'], resist: ['ice'], height: 2.0 });
en('cav_priest', 'villains_cult_priest', 'Cult Priest', 15, 'support', { skills: [['e_mend', 2], ['e_curse', 2], ['e_dark', 1]], weak: ['light'], drops: [['moondew', 0.12]] });
en('cav_witch', 'villains_witch', 'Cave Witch', 16, 'caster', { skills: [['e_fireball', 2], ['e_hex', 2], ['e_dark', 1]], weak: ['ice'] });
en('cav_diver', 'pirates_diver', 'Cave Lizard', 15, 'tank', { skills: [[A, 3], ['e_poison', 1]], weak: ['fire'], height: 1.8 });
en('cav_ranger', 'villains_dread_ranger', 'Dread Ranger', 16, 'fast', { skills: [['e_arrow', 3], ['e_poison', 1]] });
en('cav_doc', 'villains_plague_doctor', 'Plague Doctor', 15, 'support', { skills: [['e_poison', 3], ['e_mend', 1], ['e_curse', 1]], weak: ['fire'] });
en('cav_necro', 'villains_necromancer', 'Necromancer Mordo', 19, 'boss', { skills: [['e_dark', 3], ['e_drain', 2], ['e_darkall', 1], ['e_curse', 1]], hpMul: 0.5, weak: ['light'], drops: [['phoenix', 1]], atkMul: 1.35 });
en('cav_gorgon', 'villains_gorgon', 'Gorgon Queen Stheno', 21, 'boss', { skills: [['e_stunning', 2], ['e_arrow', 2], ['e_poison', 2], [A, 1], ['e_darkall', 1]], hpMul: 0.5, weak: ['ice'], height: 2.4, drops: [['moondew', 2]], atkMul: 1.45 });
// ---- Moonlit Castle (lv 19-25)
en('cas_guard', 'villains_blackguard', 'Black Guard', 20, 'tank', { skills: [[A, 3], ['e_smash', 1], ['e_guardup', 1]], weak: ['light'], height: 2.1 });
en('cas_paladin', 'villains_corrupted_paladin', 'Fallen Paladin', 21, 'tank', { skills: [['e_holy', 2], [A, 2], ['e_mend', 1]], weak: ['dark'], resist: ['light'] });
en('cas_warlord', 'villains_warlord', 'Crimson Warlord', 22, 'brute', { skills: [['e_cleave', 2], ['e_smash', 2], ['e_rally', 1]], height: 2.2, weak: ['ice'] });
en('cas_monk', 'villains_dark_monk', 'Shadow Monk', 20, 'fast', { skills: [['e_triple', 3], [A, 1], ['e_stunning', 1]], weak: ['light'] });
en('cas_witch', 'villains_witch', 'Night Witch', 21, 'caster', { skills: [['e_fireball', 2], ['e_darkall', 1], ['e_hex', 1], ['e_dark', 2]], weak: ['ice'] });
en('cas_assassin', 'villains_assassin', 'Night Assassin', 21, 'fast', { skills: [['e_triple', 3], ['e_poison', 2]], weak: ['light'] });
en('cas_matriarch', 'villains_dark_elf_matriarch', 'Matriarch Vael', 25, 'boss', { skills: [['e_darkall', 2], ['e_dark', 2], ['e_curse', 1], ['e_mend', 1]], hpMul: 0.55, weak: ['light'], drops: [['elixir', 1]] });
en('cas_warlord_boss', 'villains_warlord', 'Warlord Kazan', 25, 'boss', { skills: [['e_cleave', 2], ['e_smash', 2], ['e_rally', 1], [A, 1]], hpMul: 0.5, height: 2.4, weak: ['ice'], atkMul: 1.15 });
en('boss_vampire', 'villains_vampire_lord', 'Lord Kurohane', 28, 'boss', { skills: [['e_drain', 3], ['e_dark', 2], ['e_triple', 2], ['e_darkall', 1], ['e_stunning', 1]], hpMul: 0.62, weak: ['light'], height: 2.3, atkMul: 1.4 });
en('boss_tyrant', 'villains_mind_tyrant', 'The Hollow Sovereign', 32, 'boss', { skills: [['e_pulse', 2], ['e_dark', 2], ['e_darkall', 2], ['e_stunning', 1], ['e_ultimate', 1]], hpMul: 0.58, weak: ['light'], height: 2.7, resist: ['dark'], atkMul: 1.05 });

/** Encounter tables per zone id: [weight, [enemy ids]] */
export const ZONES = {
  woods0: [[3, ['gob_pup', 'gob_pup']], [2, ['gob_grunt']], [2, ['gob_slinger', 'gob_pup']], [1, ['gob_pup', 'gob_pup', 'gob_pup']]],
  woods: [[4, ['gob_grunt', 'gob_grunt']], [3, ['gob_slinger', 'gob_grunt', 'gob_slinger']], [3, ['gob_archer', 'gob_grunt']], [2, ['gob_scout', 'gob_scout', 'gob_archer']], [2, ['gob_shaman', 'gob_grunt', 'gob_grunt']], [1, ['gob_bomber', 'gob_slinger']]],
  woods2: [[3, ['gob_brute', 'gob_slinger']], [3, ['gob_shield', 'gob_archer', 'gob_scout']], [3, ['gob_rider', 'gob_rider']], [2, ['gob_bomber', 'gob_shaman', 'gob_grunt']], [2, ['gob_shield', 'gob_shield', 'gob_shaman']]],
  shrine: [[3, ['ban_assassin', 'ban_ranger']], [3, ['ban_monk', 'ban_ranger', 'gob_duelist']], [2, ['ban_reaver', 'ban_assassin']], [2, ['ban_doc', 'ban_monk', 'ban_monk']], [2, ['gob_firebrand', 'gob_duelist', 'ban_ranger']], [1, ['ban_reaver', 'ban_doc']]],
  port: [[3, ['pir_swash', 'pir_marks', 'pir_rigger']], [3, ['pir_harp', 'pir_saw']], [2, ['pir_cannon', 'pir_swash']], [2, ['pir_zerk', 'pir_pois']], [2, ['pir_marine', 'pir_storm', 'pir_marks']], [1, ['pir_zerk', 'pir_cannon', 'pir_saw']]],
  cave: [[3, ['cav_cultist', 'cav_diver', 'cav_diver']], [3, ['cav_priest', 'cav_ranger', 'cav_cultist']], [2, ['cav_witch', 'cav_diver']], [2, ['cav_doc', 'cav_doc', 'cav_ranger']], [2, ['cav_witch', 'cav_priest', 'cav_cultist']], [1, ['cav_diver', 'cav_diver', 'cav_diver']]],
  castle: [[3, ['cas_guard', 'cas_monk', 'cas_witch']], [3, ['cas_paladin', 'cas_assassin']], [2, ['cas_warlord', 'cas_monk']], [2, ['cas_witch', 'cas_witch', 'cas_guard']], [2, ['cas_assassin', 'cas_assassin', 'cas_paladin']], [1, ['cas_warlord', 'cas_paladin', 'cas_witch']]],
};
