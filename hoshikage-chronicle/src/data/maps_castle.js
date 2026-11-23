// Chapter 5: the road to Moonlit Castle, Zeno, Vael, Kazan, Lord Kurohane and the Hollow Sovereign.
import { room, lanterns, signpost, rug, counter } from './mapkit.js';
import { dungeon } from './dungeon.js';
import { state, flag, setFlag } from '../state.js';
import { epilogue, camTo } from './story.js';

const npc = (id, sprite, x, z, talk, o = {}) => ({ id, sprite, x, z, talk, ...o });
const CAMP_GEAR = ['moonlit_edge', 'wave_cutter', 'tiger_gauntlets', 'elven_bow', 'moon_staff', 'arcane_staff', 'knight_plate', 'moon_garb', 'mana_stone', 'vital_beads', 'swift_boots'];
const CAMP_ITEMS = ['draught', 'brew', 'moondew', 'elixir', 'phoenix', 'firebomb', 'stardust', 'leaf'];

const K1 = dungeon({
  w: 44, h: 40, seed: 3, organic: 0, corridor: 3,
  rooms: [{ x: 15, z: 31, w: 14, h: 6 }, { x: 3, z: 22, w: 10, h: 7 }, { x: 31, z: 22, w: 10, h: 7 }, { x: 12, z: 11, w: 20, h: 10 }, { x: 18, z: 2, w: 8, h: 6 }],
  links: [[0, 1], [0, 2], [0, 3], [3, 4]],
});
const K2 = dungeon({
  w: 40, h: 40, seed: 4, organic: 0, corridor: 3,
  rooms: [{ x: 15, z: 31, w: 10, h: 6 }, { x: 3, z: 21, w: 10, h: 8 }, { x: 27, z: 21, w: 10, h: 8 }, { x: 10, z: 9, w: 20, h: 10 }, { x: 15, z: 2, w: 10, h: 5 }],
  links: [[0, 1], [0, 2], [0, 3], [3, 4]],
});
const ctr = (g, i) => g.centers[i];

export function registerCastle(MAPS) {
  // ------------------------------------------------------------------ the approach
  MAPS.castle_gate = {
    id: 'castle_gate', name: 'The Moon Bridge', size: [40, 32], mood: 'night', seed: 71, music: 'castle', chapter: 5, stage: 'castle', bright: 1.8,
    encounter: { zone: 'castle', rate: [18, 30], stage: 'castle' },
    build(b) {
      b.ground('stone', { tint: 0x7a7ca8, tile: 2.6 });
      b.path([[20, 31], [20, 11]], 5, 'plate', { tint: 0x9c8cc0, tile: 2 });
      b.patch('plate', 7, 17, 11, 9, { tint: 0x8a80b0, tile: 2 }); b.reserve(7, 16, 12, 10);
      // castle wall, towers, gate
      b.box(4, 2, 32, 7, 9, { tex: 'stone', tint: 0x7e7aa8, tile: 2.6 });
      for (const x of [2, 31]) { b.box(x, 1, 7, 8, 14, { tex: 'stone', tint: 0x6c6898, tile: 2.6 }); b.gableRoof(x, 1, 7, 8, 14, 5, { tint: 0x4a3a78, oh: 0.8, gableTex: 'stone', gableTint: 0x6c6898 }); }
      b.gableRoof(14, 2, 12, 7, 9, 3.2, { tint: 0x4a3a78, oh: 0.7, gableTex: 'stone', gableTint: 0x7e7aa8 });
      b.box(17.5, 8.8, 5, 0.3, 4.6, { tex: 'wood', tint: 0x241830, solid: false, tile: 1.4 }); b.reserve(16, 9, 8, 3);
      for (const x of [9, 13, 27, 31]) b.glow(x, 6.2, 9.05, 0.8, 1.4, 0.08, 0xc0a0ff);
      for (const z of [14, 20, 26]) { b.fire(16.8, z, { model: false, scale: 0.8, y: 1.0, color: 0xa060ff }); b.fire(23.2, z, { model: false, scale: 0.8, y: 1.0, color: 0xa060ff }); b.box(16.55, z - 0.25, 0.5, 0.5, 1.0, { tex: 'stone', tint: 0x9a96c0, tile: 1 }); b.box(22.95, z - 0.25, 0.5, 0.5, 1.0, { tex: 'stone', tint: 0x9a96c0, tile: 1 }); }
      // camp
      b.prop('tent', 10.5, 21, { ry: 0.4, solid: 1.1 }); b.prop('tent', 14.5, 24, { ry: -0.3, solid: 1.1 }); b.fire(11.5, 18.2, {}); b.prop('crate', 8.6, 18.6, { solid: 0.5 }); b.prop('barrels', 16, 19.2, { solid: 0.5 });
      b.forestEdge(['tree_dark', 'rock_tall', 'tree_dark', 'column_broken'], 4, { gapRects: [[16, 28, 8, 6]] });
      b.scatter(['tree_dark', 'rock_tall', 'column_broken'], [1, 1, 38, 28], 24, { solid: 0.42, minDist: 2 });
      b.scatter(['rock_small', 'mushroom_red', 'rock_large', 'crystal_rock'], [2, 2, 36, 28], 40);
      signpost(b, 17.2, 29);
    },
    npcs: [
      npc('trader', 'towns_merchant', 11.5, 22.6, async (G) => { await G.say(['trader: A shop at the edge of doom! Best location I ever had. Walk-in traffic is... mostly heroes, honestly.']); await G.shop([...CAMP_ITEMS, ...CAMP_GEAR], { name: 'Wandering Trader' }); }),
      npc('cook', 'goblins_cook', 13.6, 19.4, async (G) => {
        await G.say(['cook: Hrrk! Is Gobbo! Quit the warband after boss-boy lost to you. Now cook for heroes! Stew is free. Rest is free. Bad jokes also free.']);
        const c = await G.choice(['Rest by the fire (free)', 'Not now'], { title: 'Gobbo\'s stew?' });
        if (c === 0) { await G.fadeTo(1, 700); G.music(null); G.sfx('revive', { vol: 0.6 }); await G.sleep(1100); G.heal(); await G.fadeTo(0, 700); G.music('castle'); G.toast('HP and MP fully restored.', 'good'); G.autosave(); }
      }, { h: 1.5 }),
    ],
    chests: [{ id: 'cg1', x: 6.4, z: 28.6, item: 'moondew', qty: 2 }, { id: 'cg2', x: 33.6, z: 24, item: 'brew' }, { id: 'cg3', x: 30, z: 14.4, gold: 500 }],
    exits: [
      { rect: [18, 9.2, 4, 1.4], to: 'castle1', tx: 22, tz: 34.4, dir: 'up' },
    ],
    triggers: [{
      id: 'arrive', rect: [14, 24, 12, 3], once: true,
      async run(G, F) {
        G.music('castle');
        await camTo(G, { pitch: 0.55, dist: 22, ms: 1400 });
        await G.say([
          '*: The bridge to Moonlit Castle hangs over a gulf of darkness — and above its towers, the broken Moon bleeds pale light across the cliffs.',
          'daigo: Is it just me, or is that the most dramatic entrance I\'ve ever seen?',
          'ren: Every castle thinks it\'s the main character.',
          'airi: Lord Kurohane keeps the Moon\'s heart inside. And behind him — the Sovereign. Whatever happens in there, we do it together.',
          'haru: Together. Right. Then let\'s go fix the sky.',
        ]);
        await camTo(G, { pitch: 0.82, dist: 17, ms: 1100 });
        G.toast('A friendly camp is set up to the west: a shop and a free rest by the fire.', 'good');
        G.autosave();
      },
    }],
  };

  // ------------------------------------------------------------------ castle floor 1
  const [a0, a1, a2, a3, a4] = [0, 1, 2, 3, 4].map((i) => ctr(K1, i));
  MAPS.castle1 = {
    id: 'castle1', name: 'Moonlit Castle — Great Hall', size: [44, 40], mood: 'castle', seed: 72, music: 'castle', chapter: 5, stage: 'castle',
    dist: 15.5, pitch: 0.88, bright: 2.0, grid: K1, checkFrom: [a0[0], a0[1]],
    encounter: { zone: 'castle', rate: [14, 24], stage: 'castle' },
    build(b) {
      b.ground('plate', { tint: 0x8a7ab0, tile: 2.4, margin: 0 });
      b.ascii(K1.rows, { tex: 'stone', tint: 0x7a7aa8, h: 2.6 });
      b.patch('plate', 20, 11, 4, 20, { tint: 0xa8304a, tile: 2.2, y: 0.03 });
      for (let i = 0; i < 4; i++) { b.prop('column', 15, 13 + i * 2.4, { solid: 0.45 }); b.prop('column', 29, 13 + i * 2.4, { solid: 0.45 }); }
      b.fire(a0[0] - 5, a0[1] - 2, { model: false, scale: 0.8, y: 0.0, color: 0xa060ff }); b.fire(a0[0] + 5, a0[1] - 2, { model: false, scale: 0.8, y: 0.0, color: 0xa060ff });
      b.fire(a3[0] - 8, a3[1] - 3, { model: false, scale: 0.8, color: 0xa060ff }); b.fire(a3[0] + 8, a3[1] - 3, { model: false, scale: 0.8, color: 0xa060ff });
      b.glowCrystal(a4[0], a4[1] - 1.5, { color: 0xc090ff, s: 1.4 });
      b.prop('obelisk', a2[0], a2[1] - 2.5, { solid: 0.5 }); b.prop('obelisk', a1[0] + 2, a1[1] - 2.5, { solid: 0.5 });
    },
    npcs: [
      npc('zeno', 'zeno', a1[0], a1[1] + 1, null, { cond: () => !flag('zeno_joined'), noTalk: true, h: 2.0 }),
      npc('g1', 'villains_blackguard', a1[0] - 2.5, a1[1] + 0.5, null, { cond: () => !flag('zeno_joined'), noTalk: true, h: 2.1 }),
      npc('g2', 'villains_blackguard', a1[0] + 2.5, a1[1] + 0.5, null, { cond: () => !flag('zeno_joined'), noTalk: true, h: 2.1 }),
      npc('vael', 'villains_dark_elf_matriarch', a3[0], a3[1] - 3.5, null, { cond: () => !flag('vael_dead'), noTalk: true, h: 2.1 }),
      npc('pal', 'villains_corrupted_paladin', a3[0] - 3.5, a3[1] - 2.5, null, { cond: () => !flag('vael_dead'), noTalk: true }),
    ],
    chests: [
      { id: 'k1a', x: a2[0] - 2.5, z: a2[1] + 1.5, item: 'brew', qty: 2 }, { id: 'k1b', x: a2[0] + 2.5, z: a2[1] + 1.5, item: 'mana_stone' },
      { id: 'k1c', x: a1[0] - 3.5, z: a1[1] + 2.5, item: 'moondew', qty: 2 }, { id: 'k1d', x: a0[0] + 5.5, z: a0[1] + 1.5, gold: 600 },
    ],
    exits: [
      { rect: [a0[0] - 1.5, 36.2, 3, 1.2], to: 'castle_gate', tx: 20, tz: 11.2, dir: 'down' },
      { rect: [a4[0] - 1.5, a4[1] - 2.8, 3, 1], to: 'castle2', tx: ctr(K2, 0)[0], tz: ctr(K2, 0)[1], dir: 'up', cond: () => flag('vael_dead') },
    ],
    triggers: [
      {
        id: 'zeno', rect: [a1[0] - 3, a1[1] - 2, 6, 2.4], once: true, cond: () => !flag('zeno_joined'),
        async run(G, F) {
          G.music('shrine');
          await G.say([
            '*: In the cell at the end of the corridor, a tall man in singed blue robes sits glaring at two guards through iron bars. Sparks crawl across his fingers.',
            'zeno: Oh, splendid. More heroes. Do tell me you have a key. Or a sense of humour. I\'ll take either.',
            'airi: You\'re the court sorcerer. Zeno! They said you died in the fire at the east wing.',
            'zeno: I was framed for it, imprisoned for it, and told it was a promotion. Kurohane needed a scapegoat for his little... shard-heist.',
            'blackguard: Silence, prisoner! Intruders — cut them down!',
          ]);
          const r = await G.startBattle({ enemies: ['cas_guard', 'cas_guard', 'cas_witch'], stage: 'castle', canFlee: false });
          if (r === 'abort') return;
          for (const id of ['g1', 'g2']) F.removeNpc(id);
          await G.say([
            '*: The cell door melts into slag with a crack of thunder.',
            'zeno: Ahh. Fresh air. Stale, castle-flavoured air, but still. I am Zeno, Storm Sorcerer of Moonlit Castle — former. You have my gratitude and, for the next several hours, my staff.',
            'haru: You\'ll fight with us?',
            'zeno: I intend to personally set Kurohane\'s curtains on fire. The rest is incidental.',
          ]);
          F.removeNpc('zeno'); setFlag('zeno_joined');
          await G.join('zeno', { equip: { weapon: 'storm_rod', armor: 'moon_garb' } });
          if (state.party.length >= 4) await G.say(['*: Your party is full. Use the menu → Party to bring Zeno along, if you like.']);
          await G.say(['zeno: The great hall lies north. Vael the Matriarch guards the stair to the upper floors. She dislikes me. The feeling is mutual.']);
        },
      },
      {
        id: 'vael', rect: [a3[0] - 3, a3[1] + 3.6, 6, 2], once: true, cond: () => !flag('vael_dead'),
        async run(G, F) {
          G.music('shrine');
          await F.walkParty(a3[0], a3[1] + 5, 3);
          await G.say([
            'vael: How wonderful. The little vermin have found the good china.',
            'airi: Matriarch Vael. You were a priestess of the Moon once. I have read your hymns.',
            'vael: And I was very good at hymns. Then I learned what the Moon is: a locked door, and a prisoner behind it. The Sovereign only wishes to be free. Is that so terrible?',
            'haru: It\'s terrible when everyone else has to suffer for it!',
            'vael: Children have such simple morals. Paladin — dismiss our guests.',
          ]);
          const r = await G.bossBattle(['cas_matriarch', 'cas_witch', 'cas_paladin'], { stage: 'castle', events: [
            { when: 'hp', enemy: 0, below: 0.5, async run(G, B) { B.world.shake = 0.5; await G.say(['vael: Let the night take you!']); B.buffEnemy(B.enemies[0], 'atkUp', 4); } },
          ] });
          if (r === 'abort') return;
          setFlag('vael_dead'); F.removeNpc('vael'); F.removeNpc('pal');
          G.music('castle');
          await G.say(['vael: ...He said... the Moon would... listen...', 'airi: The Moon always listens, Vael. You simply never asked it the right questions.', '*: With the Matriarch down, the sealed stair at the north end of the hall grinds open.']);
          G.heal(); G.autosave();
        },
      },
    ],
  };

  // ------------------------------------------------------------------ castle floor 2
  const [b0, b1, b2, b3, b4] = [0, 1, 2, 3, 4].map((i) => ctr(K2, i));
  MAPS.castle2 = {
    id: 'castle2', name: 'Moonlit Castle — Upper Keep', size: [40, 40], mood: 'castle', seed: 73, music: 'castle', chapter: 5, stage: 'castle',
    dist: 15.5, pitch: 0.88, bright: 2.0, grid: K2, checkFrom: [b0[0], b0[1]],
    encounter: { zone: 'castle', rate: [14, 23], stage: 'castle' },
    build(b) {
      b.ground('plate', { tint: 0x7f70a8, tile: 2.4, margin: 0 });
      b.ascii(K2.rows, { tex: 'stone', tint: 0x72709e, h: 2.6 });
      b.patch('plate', b3[0] - 2, b3[1] - 4, 4, 9, { tint: 0xa8304a, tile: 2.2, y: 0.03 });
      for (const [x, z] of [[b3[0] - 7, b3[1] - 3], [b3[0] + 7, b3[1] - 3], [b3[0] - 7, b3[1] + 2], [b3[0] + 7, b3[1] + 2]]) b.prop('column', x, z, { solid: 0.45 });
      b.fire(b4[0] - 3, b4[1] - 1, { model: false, scale: 0.8, y: 0.0, color: 0xb070ff }); b.fire(b4[0] + 3, b4[1] - 1, { model: false, scale: 0.8, y: 0.0, color: 0xb070ff });
      b.glowCrystal(b1[0], b1[1] - 2, { color: 0xb08aff, s: 1.0 }); b.glowCrystal(b2[0], b2[1] - 2, { color: 0x6fe8ff, s: 1.0 });
    },
    npcs: [npc('kazan', 'villains_warlord', b3[0], b3[1] - 2.5, null, { cond: () => !flag('kazan_dead'), noTalk: true, h: 2.4 }), npc('kg', 'villains_blackguard', b3[0] - 3, b3[1] - 1.5, null, { cond: () => !flag('kazan_dead'), noTalk: true, h: 2.1 })],
    chests: [
      { id: 'k2a', x: b1[0] - 3, z: b1[1] + 2, item: 'starforged' }, { id: 'k2b', x: b1[0] + 3, z: b1[1] + 2, item: 'seraph_staff' }, { id: 'k2c', x: b1[0], z: b1[1] + 2.5, item: 'star_raiment' }, { id: 'k2d', x: b1[0] - 3, z: b1[1] - 2.5, item: 'dragon_fists' },
      { id: 'k2e', x: b2[0] - 3, z: b2[1] + 2, item: 'shadow_fang' }, { id: 'k2f', x: b2[0] + 3, z: b2[1] + 2, item: 'star_piercer' }, { id: 'k2g', x: b2[0], z: b2[1] + 2.5, item: 'cosmos_scepter' }, { id: 'k2h', x: b2[0] + 3, z: b2[1] - 2.5, item: 'shard_ring' },
    ],
    exits: [
      { rect: [b0[0] - 1.5, 36.2, 3, 1.2], to: 'castle1', tx: a4[0], tz: a4[1] - 1.2, dir: 'down' },
      { rect: [b4[0] - 1.5, b4[1] - 2.2, 3, 1], to: 'throne', tx: 15, tz: 24, dir: 'up', cond: () => flag('kazan_dead') },
    ],
    triggers: [{
      id: 'kazan', rect: [b3[0] - 3, b3[1] + 3.4, 6, 2], once: true, cond: () => !flag('kazan_dead'),
      async run(G, F) {
        G.music('shrine');
        await F.walkParty(b3[0], b3[1] + 5, 3);
        await G.say([
          'kazan: Hold! Hold, I say! None pass the War Room of Moonlit Castle!',
          'ren: Warlord Kazan. I fought your cavalry at Kuroda Pass. You were running then, too.',
          'kazan: That was a strategic repositioning, ronin! And you — priestess! Little hero! Your adventure ends at my axe!',
          'zeno: Kazan, you owe me forty gold for the lute you broke.',
          'kazan: Forty— that was SEVEN YEARS AGO! You can\'t just— fine! I\'ll collect it from your corpse!',
        ]);
        const r = await G.bossBattle(['cas_warlord_boss', 'cas_guard', 'cas_assassin'], { stage: 'castle', events: [
          { when: 'hp', enemy: 0, below: 0.5, async run(G, B) { B.world.shake = 0.5; await G.say(['kazan: WARLORD\'S FURY!']); B.buffEnemy(B.enemies[0], 'atkUp', 5); } },
        ] });
        if (r === 'abort') return;
        setFlag('kazan_dead'); F.removeNpc('kazan'); F.removeNpc('kg');
        G.music('castle');
        await G.say(['kazan: ...The seven-year-old lute... was not... even... *thud*', 'zeno: Forty gold. I\'ll take it from his purse.']);
        await G.say(['*: Beyond the war room, an antechamber lit by violet flames leads toward a pair of colossal doors. The heart of the Moon beats beyond them.', 'airi: This is the last place to rest, Haru. Spend your gold. Use your tonics. Whatever happens next... it ends tonight.']);
        G.heal(); G.autosave();
      },
    }],
  };

  // ------------------------------------------------------------------ throne room
  MAPS.throne = {
    id: 'throne', name: 'The Throne of Night', size: [30, 28], mood: 'castle', seed: 74, music: 'sad', chapter: 5, stage: 'throne',
    dist: 15, pitch: 0.86, bright: 2.0,
    build(b) {
      b.ground('plate', { tint: 0x6a5a94, tile: 2.4, margin: 0 });
      b.patch('plate', 12, 4, 6, 22, { tint: 0xa8304a, tile: 2.2, y: 0.03 });
      b.box(0, 0, 30, 1, 5, { tex: 'stone', tint: 0x65608e }); b.box(0, 0, 1, 28, 5, { tex: 'stone', tint: 0x65608e }); b.box(29, 0, 1, 28, 5, { tex: 'stone', tint: 0x65608e });
      b.solid(0, 27, 30, 1);
      for (let i = 0; i < 5; i++) { b.prop('column', 5, 6 + i * 4, { solid: 0.5 }); b.prop('column', 25, 6 + i * 4, { solid: 0.5 }); }
      // throne dais
      b.box(10.5, 1, 9, 3.2, 0.5, { tex: 'stone', tint: 0x8a84b4, solid: false, tile: 1.6 }); b.box(13.4, 1.4, 3.2, 1.2, 2.6, { tex: 'stone', tint: 0x5a4a88 }); b.box(13.4, 1.2, 3.2, 0.3, 4.4, { tex: 'stone', tint: 0x4a3a78 });
      b.glowCrystal(15, 2.3, { color: 0xc090ff, s: 2.0 });
      for (const [x, z] of [[8, 4], [22, 4], [8, 14], [22, 14], [8, 22], [22, 22]]) b.fire(x, z, { model: false, scale: 0.8, y: 0.0, color: 0xb070ff });
      b.reserve(10, 1, 10, 25);
    },
    npcs: [npc('kuro', 'villains_vampire_lord', 15, 6.4, null, { cond: () => !flag('kurohane_dead'), noTalk: true, h: 2.3 })],
    chests: [],
    exits: [{ rect: [13, 26.2, 4, 1.2], to: 'castle2', tx: b4[0], tz: b4[1] - 1, dir: 'down' }],
    triggers: [{
      id: 'kurohane', rect: [11, 12, 8, 3], once: true, cond: () => !flag('kurohane_dead'),
      async run(G, F) {
        G.music('sad');
        await F.walkParty(15, 13.5, 3);
        await G.say([
          'kurohane: At last. The Bearer, and the four wandering lights. Do you know how long I have waited to see the Moon bleed like that?',
          'haru: You\'re Lord Kurohane. You started all this.',
          'kurohane: I opened a door, little boy. Others will walk through it. I carved the Seal\'s weak point with my own hands — a century of patient tapping — and then, on the Night of Falling Stars, I did what no one thought to do: I asked politely.',
          'airi: The Moon would never have broken for a man like you!',
          'kurohane: She did not break for me. She broke for the Hollow One who sleeps beneath her. And all I wanted was eternal night — a long, silent castle on a long, silent hill. Is that too much for a lonely man?',
          'zeno: You imprisoned me for a hundred and one unpaid sick days.',
          'kurohane: Ah. And that was lovely. Now. The Shards, please.',
          'haru: Over my dead body!',
          'kurohane: That is the entire plan, child.',
        ]);
        G.sfx('boss', { vol: 0.9, rate: 0.8 });
        const r = await G.bossBattle(['boss_vampire'], { stage: 'throne', events: [
          { when: 'hp', enemy: 0, below: 0.5, async run(G, B) {
            B.world.shake = 0.6;
            await G.say(['kurohane: Enough play. Taste the night — the REAL night!']);
            B.buffEnemy(B.enemies[0], 'atkUp', 5);
            await B.addEnemy('cas_assassin'); await B.addEnemy('cas_assassin');
          } },
        ] });
        if (r === 'abort') return;
        setFlag('kurohane_dead'); F.removeNpc('kuro');
        await G.say([
          'kurohane: Impressive... but you have made a grave... mistake...',
          '*: Lord Kurohane laughs, falling to his knees. Shadows rise from his chest — not his own — and tear him open like a curtain.',
          'kurohane: It never needed me... to open the door... only to hold it ajar...',
        ]);
        G.music(null);
        G.shake(1.2);
        await G.flash(900, 0x000000);
        await G.say([
          'sovereign: ...Thank you, little hands. For gathering the lights so patiently.',
          '*: From the vampire\'s fading body unfolds a tall, hollow figure — veils of violet starlight and crowns of bone, with a face like an empty mirror.',
          'airi: The Hollow Sovereign...',
          'sovereign: I am the quiet between the stars. The thing that remains when every wish has been spent. The Moon Spirit built a cage for me from her own heart, and four small pieces of it are right there in your pockets.',
          'haru: We\'re going to put the Moon back!',
          'sovereign: And I am going to eat it. Come then, small hero. Be brave one more time.',
        ]);
        const r2 = await G.bossBattle(['boss_tyrant'], { stage: 'throne', music: 'final_boss', events: [
          { when: 'hp', enemy: 0, below: 0.66, async run(G, B) {
            B.world.shake = 0.7;
            await G.say(['sovereign: Your Shards hum so loudly. Do they want to go home? Or to me?', 'haru: ...Hang on, everybody. I can feel them. They\'re — they\'re answering ME.']);
            B.addStar(60);
          } },
          { when: 'hp', enemy: 0, below: 0.33, async run(G, B) {
            B.world.shake = 0.9;
            await G.say([
              'sovereign: Impossible. I am the hollow, the end of wishing—',
              'airi: But a wish is not the end of things, Sovereign. A wish is the beginning!',
              'ren: Strike true, Haru!', 'daigo: Hit him with everything!', 'zeno: And please do it dramatically!',
            ]);
            B.addStar(100); B.buffEnemy(B.enemies[0], 'atkUp', 3);
          } },
        ] });
        if (r2 === 'abort') return;
        await G.say([
          'sovereign: ...Ah. It stings... so warm... Is this what it is... to be wished for?',
          'haru: You\'re not just a monster, are you? You were just alone.',
          'sovereign: ...Perhaps. Mend the Moon, little Bearer. Leave a window open for me. I should like to look at it, from the dark, and not be afraid.',
          '*: The four Shards rise from Haru\'s hands, ringing like bells — and the Hollow Sovereign dissolves into a rain of quiet silver.',
        ]);
        await G.flash(1400, 0xffffff);
        await G.say([
          '*: Light pours from the shattered ceiling. The Shards fly upward, knitting the cracked Moon together — seam by seam, note by note.',
          'airi: It is... complete. The Seal is whole.',
          'haru: Did we do it?',
          'ren: We did, little hero.',
        ]);
        setFlag('ch5_done'); setFlag('game_complete');
        await epilogue(G, F);
      },
    }],
  };
}
