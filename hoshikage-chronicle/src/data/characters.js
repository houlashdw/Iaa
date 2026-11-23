// Playable characters. Stat entries are [level-1 value, gain per level].
export const CHARS = {
  haru: {
    name: 'Haru', title: 'Shard Bearer', sprite: 'haru', height: 1.55, bHeight: 1.7, color: '#ffd36b', weapon: 'sword',
    hp: [105, 26], mp: [26, 4.6], atk: [15, 3.3], def: [9, 2.1], mag: [11, 2.4], res: [9, 2.0], spd: [12, 0.9],
    learn: [[1, 'crescent'], [4, 'brave_heart'], [7, 'twin_fang'], [11, 'shard_surge'], [16, 'full_moon']], burst: 'burst_haru',
    bio: 'A village boy with a straw hat, a wooden sword and an unreasonable amount of courage.',
  },
  airi: {
    name: 'Airi', title: 'Moon Priestess', sprite: 'airi', height: 1.95, bHeight: 2.0, color: '#fff2a8', weapon: 'staff',
    hp: [84, 20], mp: [48, 7.4], atk: [9, 1.5], def: [7, 1.7], mag: [18, 3.3], res: [14, 2.6], spd: [13, 0.9],
    learn: [[1, 'heal'], [1, 'holy_spark'], [5, 'cleanse'], [8, 'blessing'], [12, 'radiant_rain'], [15, 'raise'], [20, 'sanctify']], burst: 'burst_airi',
    bio: 'A priestess of the Moon Temple who walked out of the Whispering Woods looking for a missing sister-light.',
  },
  ren: {
    name: 'Ren', title: 'Wandering Ronin', sprite: 'ren', height: 1.95, bHeight: 2.0, color: '#7fa6ff', weapon: 'blade',
    hp: [118, 25], mp: [24, 4], atk: [19, 3.7], def: [11, 2.3], mag: [8, 1.4], res: [8, 1.8], spd: [15, 1.1],
    learn: [[1, 'iai'], [5, 'blade_dance'], [9, 'mist_cutter'], [13, 'focus'], [17, 'moon_exec']], burst: 'burst_ren',
    bio: 'A masterless samurai who swore never to draw his sword again. Then the sky cracked.',
  },
  daigo: {
    name: 'Daigo', title: 'Mountain Monk', sprite: 'daigo', height: 1.9, bHeight: 2.0, color: '#7fe0a0', weapon: 'fist',
    hp: [135, 29], mp: [20, 3.6], atk: [17, 3.4], def: [13, 2.6], mag: [8, 1.5], res: [11, 2.1], spd: [14, 1.0],
    learn: [[1, 'palm'], [4, 'inner_peace'], [8, 'tiger_claw'], [13, 'iron_body'], [18, 'dragon_kick']], burst: 'burst_daigo',
    bio: 'A cheerful monk of Kagari Temple. Believes every problem can be solved by a good stretch, then a good punch.',
  },
  sylva: {
    name: 'Sylva', title: 'Forest Ranger', sprite: 'sylva', height: 1.9, bHeight: 2.0, color: '#9be34f', weapon: 'bow',
    hp: [100, 22], mp: [30, 5], atk: [17, 3.2], def: [9, 1.9], mag: [10, 1.8], res: [10, 1.9], spd: [17, 1.2],
    learn: [[1, 'pierce'], [4, 'poison_arrow'], [8, 'mark_prey'], [12, 'volley'], [17, 'snipe']], burst: 'burst_sylva',
    bio: 'A ranger who tracks the cult that burned her forest. Speaks little. Misses less.',
  },
  zeno: {
    name: 'Zeno', title: 'Storm Sorcerer', sprite: 'zeno', height: 2.0, bHeight: 2.1, color: '#8fd0ff', weapon: 'staff',
    hp: [82, 19], mp: [56, 8.4], atk: [8, 1.3], def: [6, 1.5], mag: [21, 3.7], res: [13, 2.4], spd: [12, 0.8],
    learn: [[1, 'spark'], [3, 'flame_lance'], [6, 'frost_nova'], [10, 'chain_lightning'], [14, 'meteor_rain'], [18, 'arcane_rift']], burst: 'burst_zeno',
    bio: 'The court sorcerer of Moonlit Castle, framed, imprisoned, and extremely annoyed about it.',
  },
};
export const PARTY_ORDER = ['haru', 'airi', 'ren', 'daigo', 'sylva', 'zeno'];

export const expNeed = (lv) => Math.round(14 * Math.pow(lv, 1.55) + 6);
export const MAX_LV = 40;

export function baseStat(id, stat, lv) {
  const c = CHARS[id];
  const [a, g] = c[stat];
  return Math.round(a + g * (lv - 1));
}
