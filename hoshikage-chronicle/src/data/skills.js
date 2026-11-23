// Skill table. target: enemy | enemies | ally | allies | self | fallen | random
// kind: phys | mag | heal | buff | debuff | cleanse | revive | drain
export const ELEMENTS = {
  none: { name: '—', color: '#ffffff' }, fire: { name: 'Fire', color: '#ff7a3a' }, ice: { name: 'Ice', color: '#8fe3ff' },
  thunder: { name: 'Thunder', color: '#ffe35c' }, light: { name: 'Light', color: '#fff3b0' }, dark: { name: 'Dark', color: '#b17dff' },
};
export const STATUS = {
  poison: { name: 'Poison', icon: '☠', color: '#9be34f', bad: true }, stun: { name: 'Stun', icon: '✦', color: '#ffe35c', bad: true },
  atkUp: { name: 'ATK Up', icon: '⚔', color: '#ff9a62' }, atkDown: { name: 'ATK Down', icon: '⚔', color: '#8a6a6a', bad: true },
  defUp: { name: 'DEF Up', icon: '⛨', color: '#7ec4ff' }, defDown: { name: 'DEF Down', icon: '⛨', color: '#7a6a8a', bad: true },
  regen: { name: 'Regen', icon: '✚', color: '#7dffb0' }, guard: { name: 'Guard', icon: '⛉', color: '#bfe0ff' },
  focus: { name: 'Focus', icon: '◎', color: '#ffd36b' },
};

const S = {};
const def = (id, o) => { S[id] = { id, mp: 0, target: 'enemy', kind: 'phys', power: 100, el: 'none', hits: 1, fx: 'slash', ...o }; };

// ---- Haru
def('crescent', { name: 'Crescent Slash', mp: 4, power: 135, el: 'light', fx: 'slash', desc: 'A moonlit arc of the blade.' });
def('brave_heart', { name: 'Brave Heart', mp: 9, target: 'allies', kind: 'buff', buff: { atkUp: 3 }, fx: 'buff', desc: 'Raises the whole party\'s ATK.' });
def('twin_fang', { name: 'Twin Fang', mp: 7, power: 82, hits: 2, fx: 'slash', desc: 'Two quick strikes.' });
def('shard_surge', { name: 'Shard Surge', mp: 14, target: 'enemies', kind: 'mag', power: 105, el: 'light', fx: 'light', desc: 'Moon-shard energy sweeps all foes.' });
def('full_moon', { name: 'Full Moon Cleave', mp: 20, power: 235, el: 'light', fx: 'slash', big: true, desc: 'A devastating overhead cut.' });
// ---- Airi
def('heal', { name: 'Healing Light', mp: 5, target: 'ally', kind: 'heal', power: 110, fx: 'heal', desc: 'Restores one ally\'s HP.' });
def('holy_spark', { name: 'Holy Spark', mp: 4, kind: 'mag', power: 115, el: 'light', fx: 'light', desc: 'A bolt of pure light.' });
def('cleanse', { name: 'Cleanse', mp: 6, target: 'ally', kind: 'cleanse', power: 60, fx: 'heal', desc: 'Removes ailments and heals a little.' });
def('blessing', { name: 'Blessing', mp: 10, target: 'allies', kind: 'buff', buff: { defUp: 3 }, fx: 'buff', desc: 'Raises the party\'s DEF.' });
def('radiant_rain', { name: 'Radiant Rain', mp: 16, target: 'allies', kind: 'heal', power: 85, fx: 'heal', desc: 'Heals the whole party.' });
def('raise', { name: 'Raise', mp: 18, target: 'fallen', kind: 'revive', power: 45, fx: 'heal', desc: 'Returns a fallen ally to the fight.' });
def('sanctify', { name: 'Sanctify', mp: 22, target: 'enemies', kind: 'mag', power: 130, el: 'light', fx: 'light', desc: 'Holy radiance scours all enemies.' });
// ---- Ren
def('iai', { name: 'Iai Draw', mp: 5, power: 145, fx: 'slash', status: { id: 'stun', chance: 0.25, turns: 1 }, desc: 'A lightning draw. May stun.' });
def('blade_dance', { name: 'Blade Dance', mp: 9, power: 68, hits: 3, fx: 'slash', desc: 'Three flowing cuts.' });
def('mist_cutter', { name: 'Mist Cutter', mp: 13, target: 'enemies', power: 98, fx: 'slash', desc: 'A wide slash through every foe.' });
def('focus', { name: 'Bushido Focus', mp: 8, target: 'self', kind: 'buff', buff: { atkUp: 4, focus: 4 }, fx: 'buff', desc: 'ATK up and sure crits for a while.' });
def('moon_exec', { name: 'Moonlit Execution', mp: 22, power: 270, el: 'dark', fx: 'slash', big: true, desc: 'A single, perfect finishing cut.' });
// ---- Daigo
def('palm', { name: 'Palm Strike', mp: 3, power: 118, fx: 'impact', status: { id: 'stun', chance: 0.2, turns: 1 }, desc: 'A rattling palm. May stun.' });
def('inner_peace', { name: 'Inner Peace', mp: 8, target: 'self', kind: 'heal', power: 160, buff: { regen: 3 }, fx: 'heal', desc: 'Heals himself and grants regen.' });
def('tiger_claw', { name: 'Tiger Claw', mp: 8, power: 78, hits: 2, fx: 'impact', desc: 'Two raking strikes.' });
def('iron_body', { name: 'Iron Body', mp: 11, target: 'allies', kind: 'buff', buff: { defUp: 3, regen: 2 }, fx: 'buff', desc: 'Hardens and invigorates the party.' });
def('dragon_kick', { name: 'Dragon Kick', mp: 18, power: 225, fx: 'impact', big: true, desc: 'A soaring kick that shakes the ground.' });
// ---- Sylva
def('pierce', { name: 'Piercing Shot', mp: 4, power: 128, fx: 'arrow', pierce: 0.4, desc: 'Ignores part of the target\'s DEF.' });
def('poison_arrow', { name: 'Poison Arrow', mp: 6, power: 92, fx: 'arrow', status: { id: 'poison', chance: 0.85, turns: 4 }, desc: 'Coated tip. Poisons.' });
def('volley', { name: 'Volley', mp: 12, target: 'enemies', power: 82, fx: 'arrow', desc: 'A rain of arrows on all foes.' });
def('mark_prey', { name: 'Mark Prey', mp: 7, kind: 'debuff', power: 0, fx: 'debuff', status: { id: 'defDown', chance: 0.95, turns: 3 }, desc: 'Lowers a target\'s DEF.' });
def('snipe', { name: 'Snipe', mp: 20, power: 255, fx: 'arrow', big: true, pierce: 0.5, desc: 'One breathless, perfect shot.' });
// ---- Zeno
def('spark', { name: 'Spark', mp: 4, kind: 'mag', power: 122, el: 'thunder', fx: 'thunder', desc: 'A crackling bolt.' });
def('flame_lance', { name: 'Flame Lance', mp: 6, kind: 'mag', power: 135, el: 'fire', fx: 'fire', desc: 'A lance of fire.' });
def('frost_nova', { name: 'Frost Nova', mp: 11, target: 'enemies', kind: 'mag', power: 92, el: 'ice', fx: 'ice', desc: 'Freezing burst on all foes.' });
def('chain_lightning', { name: 'Chain Lightning', mp: 15, target: 'enemies', kind: 'mag', power: 112, el: 'thunder', fx: 'thunder', desc: 'Lightning arcs between enemies.' });
def('meteor_rain', { name: 'Meteor Rain', mp: 24, target: 'enemies', kind: 'mag', power: 145, el: 'fire', fx: 'fire', big: true, desc: 'Fire falls from the sky.' });
def('arcane_rift', { name: 'Arcane Rift', mp: 30, kind: 'mag', power: 310, el: 'dark', fx: 'dark', big: true, desc: 'Tears the world open on one target.' });

// ---- Star Burst ultimates (cost the full Star Gauge)
def('burst_haru', { name: 'Hoshikage Slash', target: 'enemies', kind: 'mag', power: 340, el: 'light', fx: 'light', big: true, burst: true, desc: 'The Moon Shard answers Haru\'s will.' });
def('burst_airi', { name: 'Celestial Sanctuary', target: 'allies', kind: 'heal', power: 400, revive: 0.5, buff: { defUp: 4, regen: 4 }, fx: 'heal', big: true, burst: true, desc: 'Fully restores and revives the party.' });
def('burst_ren', { name: 'Tsukikage Zan', target: 'random', hits: 7, power: 170, fx: 'slash', big: true, burst: true, desc: 'Seven shadow-cuts at the speed of moonlight.' });
def('burst_daigo', { name: 'Hundred Fists', hits: 10, power: 78, fx: 'impact', big: true, burst: true, desc: 'A blinding flurry on one target.' });
def('burst_sylva', { name: 'Rain of Stars', target: 'enemies', hits: 3, power: 150, fx: 'arrow', big: true, burst: true, desc: 'Three star-bright volleys.' });
def('burst_zeno', { name: 'Thunderstorm', target: 'enemies', kind: 'mag', power: 460, el: 'thunder', fx: 'thunder', big: true, burst: true, desc: 'The sky itself obeys the sorcerer.' });

// ---- enemy skills
def('e_bash', { name: 'Bash', power: 125, fx: 'impact' });
def('e_slash', { name: 'Savage Slash', power: 120, fx: 'slash' });
def('e_arrow', { name: 'Arrow Shot', power: 115, fx: 'arrow' });
def('e_stone', { name: 'Sling Stone', power: 105, fx: 'impact', status: { id: 'stun', chance: 0.12, turns: 1 } });
def('e_bomb', { name: 'Bomb Toss', target: 'enemies', kind: 'mag', power: 80, el: 'fire', fx: 'fire' });
def('e_fireball', { name: 'Fireball', kind: 'mag', power: 130, el: 'fire', fx: 'fire' });
def('e_hex', { name: 'Hex', kind: 'debuff', power: 0, fx: 'debuff', status: { id: 'atkDown', chance: 0.85, turns: 3 } });
def('e_curse', { name: 'Weakening Curse', kind: 'debuff', power: 0, fx: 'debuff', status: { id: 'defDown', chance: 0.85, turns: 3 } });
def('e_poison', { name: 'Venom Strike', power: 95, fx: 'slash', status: { id: 'poison', chance: 0.7, turns: 4 } });
def('e_mend', { name: 'Mend', target: 'ally', kind: 'heal', power: 130, fx: 'heal' });
def('e_rally', { name: 'War Cry', target: 'allies', kind: 'buff', buff: { atkUp: 3 }, fx: 'buff' });
def('e_guardup', { name: 'Brace', target: 'self', kind: 'buff', buff: { defUp: 3 }, fx: 'buff' });
def('e_smash', { name: 'Crushing Blow', power: 190, fx: 'impact', big: true });
def('e_cleave', { name: 'Cleave', target: 'enemies', power: 90, fx: 'slash' });
def('e_triple', { name: 'Flurry', power: 62, hits: 3, fx: 'slash' });
def('e_wave', { name: 'Tidal Wave', target: 'enemies', kind: 'mag', power: 100, el: 'ice', fx: 'ice' });
def('e_storm', { name: 'Thunderclap', target: 'enemies', kind: 'mag', power: 105, el: 'thunder', fx: 'thunder' });
def('e_dark', { name: 'Shadow Bolt', kind: 'mag', power: 135, el: 'dark', fx: 'dark' });
def('e_darkall', { name: 'Night Fall', target: 'enemies', kind: 'mag', power: 100, el: 'dark', fx: 'dark', big: true });
def('e_drain', { name: 'Blood Drain', kind: 'drain', power: 120, el: 'dark', fx: 'dark' });
def('e_stunning', { name: 'Petrifying Gaze', kind: 'debuff', power: 0, fx: 'debuff', status: { id: 'stun', chance: 0.55, turns: 1 } });
def('e_holy', { name: 'Judgement', kind: 'mag', power: 140, el: 'light', fx: 'light' });
def('e_pulse', { name: 'Mind Crush', target: 'enemies', kind: 'mag', power: 120, el: 'dark', fx: 'dark', status: { id: 'atkDown', chance: 0.5, turns: 3 } });
def('e_ultimate', { name: 'Eclipse', target: 'enemies', kind: 'mag', power: 175, el: 'dark', fx: 'dark', big: true });
def('e_selfheal', { name: 'Regenerate', target: 'self', kind: 'heal', power: 220, fx: 'heal' });

export const SKILLS = S;
