// Hinode Village (night prologue + day), and its interiors.
import { room, counter, table, shelf, rug, lanterns, well, signpost } from './mapkit.js';
import { state, flag, setFlag, addItem } from '../state.js';
import { prologueScene } from './story.js';

const HOUSES = [
  { id: 'elder', x: 8, z: 3, w: 7, d: 5, roofTint: 0x6a8f5a, doorAt: 3 },
  { id: 'inn', x: 32, z: 3, w: 8, d: 5, roofTint: 0x4a6fa5, doorAt: 3 },
  { id: 'store', x: 8, z: 11, w: 7, d: 5, roofTint: 0xc2503f, doorAt: 3 },
  { id: 'smith', x: 32, z: 11, w: 7, d: 5, roofTint: 0x8a5a48, doorAt: 3 },
];
const SMITH_STOCK = ['iron_blade', 'silver_staff', 'cloak', 'leather', 'power_band', 'guard_ring'];
const STORE_STOCK = ['tonic', 'leaf', 'dew', 'phoenix', 'firebomb', 'stardust'];

function hinodeBuild(b, night) {
  b.ground('grass', { tint: night ? 0xb4d89c : 0xdcf5a0, tile: 3.2 });
  const road = night ? 0xe0c8a0 : 0xf4e0bc;
  b.path([[23, 33], [23, 2]], 3, 'dirt', { tint: road });
  b.path([[9, 18], [37, 18]], 2, 'dirt', { tint: road });
  b.path([[11, 9], [35, 9]], 2, 'dirt', { tint: road });
  b.patch('wall', 17.5, 13.5, 11, 9, { tint: night ? 0xc0b8d8 : 0xdad2e6, tile: 2.4 }); b.reserve(17, 13, 12, 10);
  for (const hs of HOUSES) b.house({ ...hs, lit: night || true });
  b.house({ x: 5, z: 22, w: 6, d: 4, roofTint: 0xa86a3a, door: true });
  b.house({ x: 35, z: 22, w: 6, d: 4, roofTint: 0x7a8f4a, door: true });
  b.torii(23.5, 2.8, { w: 4.8, h: 3.2 });
  b.reserve(21, 0, 5, 4);
  well(b, 18.6, 16.6);
  b.fire(24.2, 17.6, {});
  lanterns(b, [[21, 11], [26, 11], [21, 23], [26, 23], [21, 29], [26, 29], [16.5, 18.5], [30, 18.5], [19, 9.5], [30, 9.5]], night ? 0xffc870 : 0xffe0a0, night);
  b.forestEdge(['tree_oak', 'tree_fat', 'tree_pine', 'tree_autumn'], 4, { gapRects: [[21, -3, 5, 6]] });
  b.fence(12, 21, 17, 21, {}); b.fence(30, 21, 34, 21, {});
  for (let i = 0; i < 7; i++) b.prop('pumpkin', 6 + (i % 4) * 1.4, 28 + (i / 4 | 0) * 1.3, { s: 1 + Math.random() * 0.3 });
  b.prop('barrels', 7.2, 16.9, { ry: 0.3, solid: 0.45 }); b.prop('crate', 15.8, 16.8, { ry: 0.2, solid: 0.45 });
  b.prop('barrel', 31.2, 16.9, { solid: 0.3 }); b.prop('crate', 39.6, 16.9, { ry: -0.2, solid: 0.45 });
  b.scatter(['tree_oak', 'tree_fat'], [3, 4, 40, 28], 14, { solid: 0.4 });
  b.scatter(['flower_red', 'bush', 'rock_small', 'mushroom_red'], [3, 4, 40, 28], 70);
  b.scatter(['flower_red'], [17, 12, 12, 10], 0);
}

const villager = (id, sprite, x, z, talk, o = {}) => ({ id, sprite, x, z, talk, ...o });

export function registerVillage(MAPS) {
  const exitsOutside = [
    { rect: [11, 8.0, 1, 1.0], to: 'elder_house', tx: 6, tz: 8.2, dir: 'up' },
    { rect: [35, 8.0, 1, 1.0], to: 'inn', tx: 6.5, tz: 9.2, dir: 'up' },
    { rect: [11, 16.0, 1, 1.0], to: 'store', tx: 6.5, tz: 9.2, dir: 'up' },
    { rect: [35, 16.0, 1, 1.0], to: 'smith', tx: 6.5, tz: 9.2, dir: 'up' },
  ];
  MAPS.hinode_night = {
    id: 'hinode_night', name: 'Hinode Village', size: [46, 34], mood: 'night', seed: 21, music: 'night', chapter: 0, stage: 'night',
    build: (b) => hinodeBuild(b, true),
    npcs: [
      villager('elder', 'towns_elder', 23.5, 16.3, async (G) => G.say(['elder: Come closer to the fire, Haru. The sky will begin any moment.']), { h: 1.8 }),
      villager('farmer', 'towns_farmer', 20.5, 20.2, async (G) => G.say(['farmer: Hundred years since the last Night of Falling Stars! My grandfather saw it, you know. Said it smelled like rain.']), { wander: 0.6 }),
      villager('barmaid', 'towns_barmaid', 27.6, 17.2, async (G) => G.say(['barmaid: Mina\'s honey buns, hot from the oven! ...Only one per customer, Haru!']), { wander: 0.5 }),
      villager('minstrel', 'towns_minstrel', 21, 15.6, async (G) => G.say(['minstrel: I\'ve written a song for tonight. It\'s called "Ode to Something Falling From The Sky". Needs work.']), {}),
      villager('herbalist', 'towns_herbalist', 27.2, 20.6, async (G) => G.say(['herbalist: Wish on the first star, dear. Wish for something small. The big ones never come true.']), {}),
      villager('guard', 'towns_guard', 22, 5.6, async (G) => G.say(['guard: All quiet at the north gate. Quiet is good.']), {}),
      { id: 'gob1', sprite: 'goblins_grunt', x: 21.5, z: -4, noTalk: true, ghost: true },
      { id: 'gob2', sprite: 'goblins_grunt', x: 25.5, z: -4, noTalk: true, ghost: true },
      { id: 'scout', sprite: 'goblins_scout', x: 23.5, z: -6, noTalk: true, ghost: true },
    ],
    triggers: [{ id: 'prologue', rect: [19, 19.6, 9, 2], once: true, run: (G, F) => prologueScene(G, F) }],
    exits: [], chests: [],
  };

  MAPS.hinode = {
    id: 'hinode', name: 'Hinode Village', size: [46, 34], mood: 'day', seed: 21, music: 'town', chapter: 1,
    build: (b) => hinodeBuild(b, false),
    npcs: [
      villager('guard', 'towns_guard', 21.8, 5.2, async (G) => {
        if (!G.flag('ch1_done')) await G.say(['guard: The Whispering Woods lie north of here. Goblins, mostly. Mind the forks in the road — they love ambushes.', 'guard: Stock up at Kichi\'s store and Tetsu\'s forge first, lad. A tonic in the pocket beats a hero in the grave.']);
        else await G.say(['guard: The Warchief is down? Haru... the whole village owes you. Don\'t tell Tetsu, he\'ll raise his prices out of jealousy.']);
      }),
      villager('herbalist', 'towns_herbalist', 14.2, 20.3, async (G) => {
        if (!G.flag('herb_gift')) { G.set('herb_gift'); await G.say(['herbalist: Haru! I heard about last night. Here — chamomile and honey. It doesn\'t fix broken moons, but it fixes bruises.']); G.give('tonic', 2); G.give('leaf', 2); }
        else await G.say(['herbalist: Bitter Leaf cures poison. Spirit Draughts heal more, but cost more. Everything costs more, lately.']);
      }),
      villager('farmer', 'towns_farmer', 9, 29.4, async (G) => G.say(['farmer: My pumpkins glowed last night. Glowed! Pumpkins don\'t do that. ...Do you think it\'s the Moon thing?']), { wander: 1.2 }),
      villager('minstrel', 'towns_minstrel', 27.4, 20.8, async (G) => G.say(['minstrel: The Moon Spirit sealed the Night Sovereign in the sky, long ago. Four Moon Shards held the Seal shut, and one fifth— the Moon\'s own heart. At least, that\'s verse three.', 'minstrel: Verse four is where it gets sad.']), {}),
      villager('scribe', 'towns_scribe', 19.4, 21.6, async (G) => {
        await G.say(['scribe: Ah, the hero! Let me share what I\'ve written down about adventuring:',
          '*: ◆ Move: WASD / Arrow keys (hold Shift to run)\n◆ Talk / Open / Confirm: E, Enter or Space\n◆ Menu (party, items, equipment, save): Esc or M\n◆ In battle: pick actions with the arrows and Enter. Hit and be hit to fill the STAR gauge — when it is full, ★ Burst unleashes a hero\'s ultimate!',
          'scribe: Also: equip new gear in the menu after buying it! I once forgot. For a week. Don\'t ask.']);
      }),
      villager('lamp', 'towns_lamplighter', 29.6, 19.6, async (G) => G.say(['lamp: I light every lantern in Hinode at dusk. Last night they flickered blue when the sky cracked. I\'m not paid enough for blue.']), { wander: 0.6 }),
      villager('noble', 'towns_noble', 16, 23.8, async (G) => G.say(['noble: I came from the capital for the festival, and now there are goblins. The brochure said nothing about goblins.']), {}),
    ],
    chests: [
      { id: 'hin1', x: 5.6, z: 9.2, item: 'tonic', qty: 2 },
      { id: 'hin2', x: 41.2, z: 27.6, gold: 90, ry: -0.5 },
      { id: 'hin3', x: 13.4, z: 30.6, item: 'dew', qty: 2 },
    ],
    exits: [
      ...exitsOutside,
      { rect: [21.5, 0.2, 4, 1.4], to: 'woods1', tx: 17.5, tz: 52.2, dir: 'up' },
    ],
    triggers: [], spots: [],
  };

  // ------------------------------------------------------------------ interiors
  const out = (x, z) => ({ rect: [5.5, 10.1, 3, 1], to: 'hinode', tx: x, tz: z, dir: 'down' });
  MAPS.elder_house = {
    id: 'elder_house', name: 'Elder Genzo\'s House', size: [12, 10], mood: 'indoor', seed: 2, music: 'calm', dist: 12.5, pitch: 0.9,
    build(b) {
      room(b, { doorX: 4.5 });
      shelf(b, 1.6, 1.1, 3.2); shelf(b, 7.2, 1.1, 3.2); rug(b, 3.5, 3.3, 5, 3.5, 0x8a3a4a);
      table(b, 4.5, 4.6, 3, 1.4); b.prop('barrels', 10.2, 2.0, { ry: 0.3, solid: 0.5 }); b.prop('crate', 1.8, 7.4, { ry: 0.1, solid: 0.5 });
    },
    npcs: [villager('elder', 'towns_elder', 6, 3.2, async (G) => {
      if (G.flag('ch1_done') && !G.flag('elder_reward')) {
        G.set('elder_reward');
        await G.say(['elder: You\'re back, and in one piece! And you carry the Moon Shard... Haru, listen. Priestess Airi told me what it means.',
          'elder: The Seal had five keys: four Shards, and the Moon itself. Three Shards are still out there. The Night Sovereign\'s servants are hunting them, too.',
          'elder: Take this. It was your father\'s lucky charm. May it be luckier for you than it was for him.']);
        G.give('lucky_cat'); await G.say(['elder: Go on. The Ashen Shrine lies east of the woods. And Haru...  come home when it\'s over.']);
      } else if (G.flag('ch1_done')) await G.say(['elder: The Ashen Shrine, east of the woods road. Go with friends, Haru. A hero who travels alone is only a lonely person with a sword.']);
      else await G.say(['elder: The goblins went north to the Whispering Woods. Don\'t go in unprepared, my boy. The Warchief is no ordinary goblin.']);
    }, { h: 1.8 })],
    chests: [{ id: 'eld1', x: 10.4, z: 6.4, item: 'brew', ry: -1.3 }],
    exits: [{ rect: [4.5, 9.0, 3, 1], to: 'hinode', tx: 11.5, tz: 9.6, dir: 'down' }],
  };
  MAPS.inn = {
    id: 'inn', name: 'The Sleepy Lantern Inn', size: [14, 11], mood: 'indoor', seed: 3, music: 'calm', dist: 13, pitch: 0.9,
    build(b) {
      room(b, { doorX: 5.5 });
      counter(b, 4.5, 3.2, 5.2); table(b, 1.6, 6, 2.2, 1.4); table(b, 10, 6.2, 2.2, 1.4); table(b, 10, 3.6, 2.2, 1.2);
      b.prop('barrels', 12, 2.2, { solid: 0.5 }); b.prop('barrel', 1.9, 2.0, { solid: 0.4 }); rug(b, 5.2, 6.2, 3.6, 3, 0x3a5a8a);
      b.fire(7, 1.7, { model: false, scale: 0.6, y: 0.3, light: true });
    },
    npcs: [
      villager('innkeeper', 'towns_innkeeper', 7.1, 2.3, async (G) => { await G.say(['innkeeper: Welcome to the Sleepy Lantern! A bed, a bath, and breakfast for 20 gold.']); await G.inn(20, 'Sleepy Lantern'); }),
      villager('barmaid', 'towns_barmaid', 11.3, 4.9, async (G) => G.say(['barmaid: My honey buns are sold out, but I can tell you this: everyone in the inn heard the sky crack last night. Old Botan dropped an entire barrel.']), { wander: 0.5 }),
      villager('minstrel', 'towns_minstrel', 2.8, 8.4, async (G) => G.say(['minstrel: Ah, a customer! ...No? A critic? Even worse.']), {}),
    ],
    chests: [], exits: [{ rect: [5.5, 9.9, 3, 1.1], to: 'hinode', tx: 35.5, tz: 9.6, dir: 'down' }],
  };
  MAPS.store = {
    id: 'store', name: 'Kichi\'s General Store', size: [14, 11], mood: 'indoor', seed: 4, music: 'calm', dist: 13, pitch: 0.9,
    build(b) {
      room(b, { doorX: 5.5 });
      counter(b, 3.5, 3.4, 7); shelf(b, 1.4, 1.1, 3.4); shelf(b, 9, 1.1, 3.4); rug(b, 5, 6, 4, 3, 0xa8403a);
      b.prop('barrels', 12, 5.6, { solid: 0.5 }); b.prop('crate', 1.8, 7.6, { solid: 0.5 }); b.prop('crate', 2.9, 8.0, { ry: 0.4, solid: 0.5 });
    },
    npcs: [villager('merchant', 'towns_merchant', 7, 2.6, async (G) => { await G.say(['merchant: Welcome, welcome! Potions, tonics, and the occasional bomb. What\'ll it be?']); await G.shop(STORE_STOCK, { name: 'Kichi\'s General Store' }); await G.say(['merchant: Come again!']); })],
    chests: [{ id: 'sto1', x: 12, z: 8.2, item: 'dew', qty: 1, ry: -0.6 }],
    exits: [{ rect: [5.5, 9.9, 3, 1.1], to: 'hinode', tx: 11.5, tz: 17.4, dir: 'down' }],
  };
  MAPS.smith = {
    id: 'smith', name: 'Tetsu\'s Forge', size: [14, 11], mood: 'indoor', seed: 5, music: 'calm', dist: 13, pitch: 0.9,
    build(b) {
      room(b, { doorX: 5.5, wallTint: 0xd8c8b8 });
      counter(b, 4, 3.4, 5); b.prop('crate', 1.8, 2.2, { solid: 0.5 }); b.prop('barrels', 11.6, 2.4, { solid: 0.5 });
      b.box(9.6, 4.6, 2.2, 1.6, 0.9, { tex: 'stone', tint: 0x9a8a88, tile: 1.4 }); b.fire(10.7, 5.4, { model: false, scale: 0.8, y: 0.9, color: 0xff7a3a });
      b.prop('sword', 3.6, 1.6, { s: 1, ry: 1.2, y: 1.6 }); b.prop('greatsword', 12.4, 6.5, { s: 0.35, ry: 0.6, y: 0.3 });
    },
    npcs: [villager('smith', 'towns_blacksmith', 6.6, 2.7, async (G) => { await G.say(['smith: Hah! Haru! Heard you fought off goblins with that kindling you call a sword. Let me sell you something that hits back.']); await G.shop(SMITH_STOCK, { name: 'Tetsu\'s Forge' }); await G.say(['smith: Equip it from the menu. Do not use it as a fire poker. I\'ve seen it.']); })],
    chests: [], exits: [{ rect: [5.5, 9.9, 3, 1.1], to: 'hinode', tx: 35.5, tz: 17.4, dir: 'down' }],
  };
}
