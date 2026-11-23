// Chapter 3: Port Namiji, the lighthouse, Daigo and Captain Redtide.
import { room, counter, table, shelf, rug, lanterns, well, signpost } from './mapkit.js';
import { dungeon } from './dungeon.js';
import { state, flag, setFlag } from '../state.js';

const npc = (id, sprite, x, z, talk, o = {}) => ({ id, sprite, x, z, talk, ...o });
const PORT_ITEMS = ['tonic', 'draught', 'dew', 'leaf', 'phoenix', 'firebomb', 'stardust'];
const PORT_GEAR = ['steel_saber', 'temper_katana', 'iron_knuckles', 'long_bow', 'storm_rod', 'silver_staff', 'ranger_mail', 'guard_ring', 'swift_boots', 'mind_pendant', 'vital_beads'];

const LH = dungeon({
  w: 24, h: 36, seed: 5, organic: 0, corridor: 3,
  rooms: [{ x: 7, z: 29, w: 10, h: 5 }, { x: 2, z: 21, w: 7, h: 5 }, { x: 15, z: 20, w: 7, h: 6 }, { x: 5, z: 11, w: 14, h: 6 }, { x: 8, z: 3, w: 8, h: 5 }],
  links: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
});

export function registerPort(MAPS) {
  MAPS.namiji = {
    id: 'namiji', name: 'Port Namiji', size: [52, 38], mood: 'port', seed: 51, music: 'port', chapter: 3, stage: 'port', bright: 1.6,
    encounter: { zone: 'port', rate: [16, 28], stage: 'port' },
    build(b) {
      b.water(-30, -34, 112, 46, { color: 0x3b8cc2, blockedCells: false, y: 0.0 });
      b.patch('concrete', -2, 11.4, 56, 30, { tint: 0xf4e2bc, tile: 3, y: 0.02 });
      b.solid(0, 0, 52, 11);
      b.patch('wood', 6, 9, 42, 3, { tint: 0xe2b27a, tile: 2.6, y: 0.04 }); b.free(6, 9, 42, 2);
      for (const [px, pz, pw, pd] of [[14, 2.5, 6, 7], [28, 1, 6, 9], [40, 4.5, 6, 5]]) {
        b.patch('wood', px, pz, pw, pd, { tint: 0xe2b27a, tile: 2.6, y: 0.04 }); b.free(px, pz, pw, pd);
        for (const [dx, dz] of [[0, 0], [pw - 0.3, 0], [0, pd - 0.3], [pw - 0.3, pd - 0.3]]) b.box(px + dx, pz + dz, 0.3, 0.3, 1.1, { tex: 'wood', tint: 0x6a4a30, solid: false, tile: 1 });
      }
      b.prop('cargo_ship', 24, -1, { ry: Math.PI / 2, s: 1, solid: 0 }); b.prop('cargo_ship', 44, 0.2, { ry: 0.25, s: 0.85 });
      b.prop('barrels', 15.2, 5, { solid: 0.5 }); b.prop('crate', 18.4, 7.4, { ry: 0.3, solid: 0.5 }); b.prop('barrels', 33, 3.2, { solid: 0.5 }); b.prop('crate', 29, 8.2, { solid: 0.5 }); b.prop('barrel', 43, 6, { solid: 0.3 });
      b.path([[1, 22], [50, 22]], 3, 'dirt', { tint: 0xe8c898, tile: 2.4 });
      b.patch('wall', 19, 19.5, 11, 5, { tint: 0xd8d0e4, tile: 2.4 }); b.reserve(19, 19, 11, 6);
      b.house({ x: 4, z: 14, w: 7, d: 5, wall: 'stone', wallTint: 0xf0e8dc, roofTint: 0x3f8f9f, doorAt: 3 });
      b.house({ x: 14, z: 14, w: 7, d: 5, wall: 'stone', wallTint: 0xf0e8dc, roofTint: 0xc2503f, doorAt: 3 });
      b.house({ x: 28, z: 14, w: 8, d: 5, wall: 'stone', wallTint: 0xf0e8dc, roofTint: 0x4a6fa5, doorAt: 3 });
      b.house({ x: 40, z: 14, w: 6, d: 5, wall: 'stone', wallTint: 0xf0e8dc, roofTint: 0x8f6a4a, door: true });
      b.house({ x: 4, z: 28, w: 6, d: 4, wall: 'stone', wallTint: 0xece4d8, roofTint: 0x7f9f4a });
      b.house({ x: 15, z: 29, w: 6, d: 4, wall: 'stone', wallTint: 0xece4d8, roofTint: 0xb5673a });
      b.house({ x: 30, z: 29, w: 8, d: 4, wall: 'stone', wallTint: 0xece4d8, roofTint: 0x3f8f9f });
      // lighthouse
      b.box(46, 22, 4, 4, 9.5, { tex: 'concrete', tint: 0xfff4e6, tile: 2.4 });
      b.box(45.6, 21.6, 4.8, 4.8, 0.7, { tex: 'stone', tint: 0xb8b0c4, solid: false, tile: 2 });
      b.box(45.7, 21.7, 4.6, 4.6, 0.6, { tex: 'concrete', tint: 0xc2503f, y: 9.5, solid: false, tile: 2 });
      b.glow(48, 10.6, 24, 2.4, 1.5, 2.4, 0xfff0a8); b.light(48, 10.2, 24, 0xffe9a0, 3.2, 18, { flicker: 0.05 });
      b.box(47, 25.9, 2, 0.14, 2.2, { tex: 'wood', tint: 0x3a2a24, solid: false, tile: 1.2 });
      b.reserve(46, 26, 4, 2);
      lanterns(b, [[4, 21], [18, 20.5], [31, 20.5], [44, 20.5], [12, 24], [36, 24]], 0xffd890, false);
      well(b, 24.5, 20.8);
      b.forestEdge(['tree_palm', 'tree_palm', 'rock_large', 'bush_large'], 3, { gapRects: [[-3, 19, 6, 7], [-4, -4, 60, 16]] });
      b.scatter(['tree_palm'], [1, 12, 50, 25], 16, { solid: 0.4, minDist: 2.5 });
      b.scatter(['flower_red', 'bush', 'rock_small', 'bush_large'], [1, 12, 50, 25], 40);
      signpost(b, 2.5, 24.5); signpost(b, 33.4, 11.2);
    },
    npcs: [
      npc('pw1', 'pirates_swashbuckler', 22.2, 22.2, null, { cond: () => !flag('daigo_joined'), noTalk: true, ghost: true }),
      npc('pw2', 'pirates_marksman', 25.6, 21.6, null, { cond: () => !flag('daigo_joined'), noTalk: true, ghost: true, h: 1.7 }),
      npc('pw3', 'pirates_rigger', 24, 24.2, null, { cond: () => !flag('daigo_joined'), noTalk: true, ghost: true, h: 1.7 }),
      npc('daigo', 'daigo', 23.6, 22.6, null, { cond: () => !flag('daigo_joined'), noTalk: true, ghost: true }),
      npc('p1', 'pirates_cannoneer', 40.4, 19.6, async (G) => G.say(['pirate: Lighthouse is closed! Captain says so! ...Don\'t ask me why. I just carry the cannonballs.']), { cond: () => !flag('ch3_done'), h: 2.1 }),
      npc('p2', 'pirates_poisoner', 9, 24.6, async (G) => G.say(['pirate: Ribbit— I mean, ahoy! Fine day for being threatening. Ribbit.']), { cond: () => !flag('ch3_done'), h: 1.6 }),
      npc('p3', 'pirates_berserker', 34, 24.6, async (G) => G.say(['pirate: Grr. I punch anchors for a living. You want to be next? ...No? Smart.']), { cond: () => !flag('ch3_done'), h: 2.2 }),
      npc('pip', 'pirates_cabin_kid', 20.4, 26.2, async (G) => {
        if (!G.flag('ch3_done')) await G.say(['pip: Shh! I\'m supposed to be a pirate, but I\'m mostly a cabin kid. Captain Redtide has the shiny thing in the lighthouse. He talks to it at night. It talks back.', 'pip: ...I don\'t like how it talks back.']);
        else await G.say(['pip: The captain is gone and nobody told me what to do! I think I\'ll... be a fisherman. Old Umi says I can start tomorrow.']);
      }),
      npc('umi', 'towns_fisherman', 17.4, 6.2, async (G, F) => {
        if (!G.flag('ch3_done')) { await G.say(['fisher: Pirates took half the harbour. I\'m keeping my boat ready for the day somebody makes them regret it.']); return; }
        await G.say(['fisher: You beat the Captain?! Then my boat is yours. Where to?', 'airi: The Crystal Caverns on Hanari Isle. The next Moon Shard lies beneath it.']);
        const c = await G.choice(['Set sail to Hanari Isle', 'Not yet'], { title: 'Sail now?' });
        if (c === 0) await sail(G, F);
      }, { h: 1.75 }),
      npc('woman', 'towns_herbalist', 12, 25.4, async (G) => G.say(['herbalist: These sea herbs cure poison — if you can stomach the taste. Which you can\'t. Keep a few Bitter Leaves anyway.']), { wander: 0.6 }),
    ],
    chests: [
      { id: 'n1', x: 2.4, z: 33.4, item: 'draught', qty: 2 }, { id: 'n2', x: 49, z: 14, gold: 260 }, { id: 'n3', x: 47, z: 30.4, item: 'vital_beads' }, { id: 'n4', x: 22, z: 4.6, item: 'dew', qty: 2 },
    ],
    exits: [
      { rect: [0, 20, 1.3, 5], to: 'shrine', tx: 40.8, tz: 22.5, dir: 'left' },
      { rect: [7, 18.9, 1, 1.1], to: 'namiji_inn', tx: 6.5, tz: 9.2, dir: 'up' },
      { rect: [17, 18.9, 1, 1.1], to: 'namiji_shop', tx: 6.5, tz: 9.2, dir: 'up' },
      { rect: [31, 18.9, 1, 1.1], to: 'tavern', tx: 6.5, tz: 9.2, dir: 'up' },
      { rect: [46.6, 25.2, 2.8, 1.2], to: 'lighthouse', tx: 11.5, tz: 31.2, dir: 'up', cond: () => flag('daigo_joined') },
      { rect: [46.6, 25.2, 2.8, 1.2], to: 'namiji', tx: 48, tz: 27.8, dir: 'down', cond: () => !flag('daigo_joined'), block: (G) => async (G2, F) => { await G.say(['*: The lighthouse door is barred from the inside, and two pirates glare from the window. Maybe the townsfolk know a way in.']); F.teleportParty(48, 27.8, 'down'); } },
    ],
    triggers: [{
      id: 'daigo', rect: [13, 20.2, 7, 4], once: true, cond: () => !flag('daigo_joined'),
      async run(G, F) {
        G.music('sad');
        await F.walkParty(17, 22.4, 3);
        await G.say([
          'pirate: Oi, monk! Where\'s the second lock-key to the lighthouse? Hand it over or we\'ll fold you like a sail!',
          'daigo: I told you three times. I don\'t have a key. Also I\'m a very flexible man, you\'ll find folding me takes effort.',
          'pirate: Captain wants every Kagari monk tied up in knots by sundown!',
          'haru: Hey! Three on one isn\'t fair!',
          'daigo: Oh, wonderful! Spectators! Quick — whoever wants a lesson in unfair odds, now\'s the moment!',
        ]);
        const r = await G.startBattle({ enemies: ['pir_swash', 'pir_marks', 'pir_rigger'], stage: 'port', canFlee: false });
        if (r === 'abort') return;
        for (const id of ['pw1', 'pw2', 'pw3']) F.removeNpc(id);
        G.music('port');
        await G.say([
          'daigo: Phew! Thank you, friends. Daigo of Kagari Temple, humble monk and recent victim of rope.',
          'airi: Kagari Temple... the Moon Shard! It was kept in your lighthouse shrine, wasn\'t it?',
          'daigo: Aye. Captain Redtide stormed the temple three days ago with forty men. He wanted the Shard — said it whispers sea-songs only he can hear. I tried reasoning. Then I tried punching. Neither scaled well.',
          'ren: Forty men. You walked away from forty men?',
          'daigo: I ran away from forty men. That\'s different, and a recognised monastic technique.',
          'haru: We\'re collecting the Moon Shards to repair the sky! Come with us, and we\'ll get yours back!',
          'daigo: A quest to fix the heavens, with a priestess, a samurai and a boy with a straw hat. How could a monk say no?',
        ]);
        F.removeNpc('daigo'); setFlag('daigo_joined');
        await G.join('daigo', { equip: { weapon: 'iron_knuckles', armor: 'leather' } });
        await G.say(['daigo: The lighthouse door is open from the east end of the street now — they moved the guards to chase me. Shall we?']);
      },
    }],
  };

  // ------------------------------------------------------------------ interiors
  MAPS.namiji_inn = {
    id: 'namiji_inn', name: 'The Salty Anchor', size: [14, 11], mood: 'indoor', seed: 52, music: 'calm', dist: 13, pitch: 0.9,
    build(b) { room(b, { doorX: 5.5, wall: 'stone', wallTint: 0xe8dcc8 }); counter(b, 3.5, 3.2, 6.5); table(b, 1.6, 6.2, 2.2, 1.4); table(b, 10, 6.4, 2.2, 1.4); b.prop('barrels', 12, 2.2, { solid: 0.5 }); rug(b, 5.2, 6.2, 3.6, 3, 0x3a7a8a); },
    npcs: [
      npc('keeper', 'towns_innkeeper', 6.8, 2.4, async (G) => { await G.say(['innkeeper: A room is 60 gold — pirates have driven up the price of everything, including my nerves.']); await G.inn(60, 'Salty Anchor'); }),
      npc('maid', 'towns_barmaid', 11.2, 4.8, async (G) => G.say(['barmaid: If you\'re really going to the lighthouse, you\'ll need to get past the guards. They\'re all drunk on stolen rum. Wait for the right moment.']), { wander: 0.4 }),
    ],
    chests: [], exits: [{ rect: [5.5, 9.9, 3, 1.1], to: 'namiji', tx: 7.5, tz: 20.4, dir: 'down' }],
  };
  MAPS.namiji_shop = {
    id: 'namiji_shop', name: 'Harbour Outfitters', size: [14, 11], mood: 'indoor', seed: 53, music: 'calm', dist: 13, pitch: 0.9,
    build(b) { room(b, { doorX: 5.5, wall: 'stone', wallTint: 0xe8dcc8 }); counter(b, 2.2, 3.4, 4.2); counter(b, 7.8, 3.4, 4.2); shelf(b, 1.2, 1.1, 3); shelf(b, 9.8, 1.1, 3); rug(b, 5, 6, 4, 3, 0xa8403a); b.prop('crate', 12, 7.2, { solid: 0.5 }); },
    npcs: [
      npc('merch', 'towns_merchant', 4.2, 2.6, async (G) => { await G.say(['merchant: Fresh stock from the last ship that wasn\'t robbed!']); await G.shop(PORT_ITEMS, { name: 'Harbour Outfitters — Supplies' }); }),
      npc('smith', 'towns_blacksmith', 10, 2.6, async (G) => { await G.say(['smith: Steel from the mainland, tempered in sea salt. You break it, you keep both halves.']); await G.shop(PORT_GEAR, { name: 'Harbour Outfitters — Arms & Armor' }); }),
    ],
    chests: [], exits: [{ rect: [5.5, 9.9, 3, 1.1], to: 'namiji', tx: 17.5, tz: 20.4, dir: 'down' }],
  };
  MAPS.tavern = {
    id: 'tavern', name: 'The Drowned Rat Tavern', size: [14, 11], mood: 'indoor', seed: 54, music: 'town', dist: 13, pitch: 0.9,
    build(b) { room(b, { doorX: 5.5, wall: 'stone', wallTint: 0xd8c8b4 }); counter(b, 3, 3.2, 8); table(b, 1.4, 6.4, 2.2, 1.4); table(b, 5.8, 6.8, 2.2, 1.4); table(b, 10, 6.2, 2.2, 1.4); b.prop('barrels', 12, 2.2, { solid: 0.5 }); b.prop('barrels', 1.8, 2.2, { solid: 0.5 }); },
    npcs: [
      npc('bard', 'heroes_bard', 11.8, 4.4, async (G) => {
        await G.say(['bard: Ahoy, traveller! Care for a shanty? "Oh, the Moon went crack and the stars went POP, and the pirates all shouted: our rum won\'t stop!"', 'bard: Needs work. But the crowd loves it.']);
      }),
      npc('tender', 'towns_barmaid', 7, 2.6, async (G) => G.say(['barmaid: The captain drinks here when he comes ashore. Won\'t say a word about the glowing thing — but Marisol, his sea-witch friend, hums in the corner like it\'s a lullaby.']), {}),
      npc('drinker', 'pirates_quartermaster', 2.6, 8.4, async (G) => G.say(['pirate: Shhh! I\'m on break. Don\'t tell the captain I\'m drinking juice.']), { h: 1.9 }),
    ],
    chests: [{ id: 'tv1', x: 12.4, z: 8.6, item: 'phoenix', ry: -0.5 }],
    exits: [{ rect: [5.5, 9.9, 3, 1.1], to: 'namiji', tx: 31.5, tz: 20.4, dir: 'down' }],
  };

  // ------------------------------------------------------------------ lighthouse dungeon
  MAPS.lighthouse = {
    id: 'lighthouse', name: 'Namiji Lighthouse', size: [24, 36], mood: 'indoor', seed: 55, music: 'shrine', chapter: 3, stage: 'indoor',
    dist: 14, pitch: 0.86, bright: 1.7, grid: LH, checkFrom: [11, 31],
    encounter: { zone: 'port', rate: [13, 22], stage: 'indoor' },
    build(b) {
      b.ground('wood', { tint: 0xd8a870, tile: 2.2, margin: 0 });
      b.ascii(LH.rows, { tex: 'stone', tint: 0xb8a898, h: 2.4 });
      b.prop('barrels', 8.5, 30.4, { solid: 0.5 }); b.prop('crate', 15, 30.6, { ry: 0.2, solid: 0.5 }); b.prop('crate', 3.4, 22.8, { solid: 0.5 });
      b.prop('barrels', 20.6, 21.4, { solid: 0.5 }); b.prop('barrels', 6, 12.4, { solid: 0.5 }); b.prop('crate', 17.6, 12.6, { solid: 0.5 });
      for (const [x, z] of [[6.5, 29.6], [16.5, 29.6], [3, 21.6], [20, 20.6], [6, 11.6], [18, 11.6], [8.6, 3.6], [15.4, 3.6]]) b.fire(x, z, { model: false, scale: 0.7, y: 1.0, color: 0xffa040 });
      b.fire(12, 5.0, { model: false, scale: 1.1, y: 0.2, color: 0xfff0a0 });
    },
    npcs: [
      npc('redtide', 'pirates_captain', 12, 5.2, null, { cond: () => !flag('redtide_dead'), noTalk: true, h: 2.3 }),
      npc('orlo', 'pirates_first_mate', 9.8, 6, null, { cond: () => !flag('redtide_dead'), noTalk: true, h: 2.3 }),
      npc('mark', 'pirates_marksman', 14.4, 6, null, { cond: () => !flag('redtide_dead'), noTalk: true, h: 1.7 }),
    ],
    chests: [
      { id: 'lh1', x: 4.4, z: 23.5, item: 'draught', qty: 2 }, { id: 'lh2', x: 19.6, z: 23.5, gold: 280 },
      { id: 'lh3', x: 7, z: 14.4, item: 'mind_pendant' }, { id: 'lh4', x: 17.4, z: 14.4, item: 'moondew', qty: 1 },
    ],
    exits: [{ rect: [10, 32.3, 3, 1.2], to: 'namiji', tx: 48, tz: 27.8, dir: 'down' }],
    triggers: [{
      id: 'redtide', rect: [9, 8.6, 6, 2.4], once: true, cond: () => !flag('redtide_dead'),
      async run(G, F) {
        G.music('shrine');
        await F.walkParty(12, 10.4, 3);
        await G.say([
          'redtide: Well, well, well! The famous "kid with a stick" and his merry band! I\'ve been expecting you since the monk wriggled out of my ropes!',
          'daigo: Technically I wriggled very gracefully.',
          'redtide: I am Captain Redtide, terror of the Silver Coast, scourge of — ',
          'orlo: Cap\'n, you\'re doing the speech again.',
          'redtide: A captain\'s speech is sacred, Orlo! ...Where was I? Ah! The Moon Shard sings to me of sea and storm. And I do not intend to give it back.',
          'airi: Captain, listen. Every moment you hold it, it eats at your will. That voice is not the sea — it is the Night Sovereign.',
          'redtide: The Night Sovereign pays well. The sea-witch told me. And what the sea-witch tells me is always right!',
          'haru: Then we\'ll take it back the hard way!',
        ]);
        const r = await G.bossBattle(['pir_capt', 'pir_first', 'pir_marks'], { stage: 'indoor', events: [
          { when: 'hp', enemy: 0, below: 0.55, async run(G, B) {
            B.world.shake = 0.45;
            await G.say(['redtide: BROADSIDE! All hands — FIRE!']);
            B.buffEnemy(B.enemies[0], 'atkUp', 4);
            const e = B.enemies[0];
            e.ai = [['e_bomb', 3], ['e_triple', 2], ['e_cleave', 2]];
          } },
        ] });
        if (r === 'abort') return;
        setFlag('redtide_dead');
        for (const id of ['redtide', 'orlo', 'mark']) F.removeNpc(id);
        G.music('sad');
        await G.say([
          'redtide: Aye... the kid has more bite than the bite of a... of a very biting thing...',
          'orlo: Captain! Captain, I told you, never trust a witch with a smile!',
          '*: The captain and his first mate slump against the wall. The lamp in the pedestal flares — and the Moon Shard drifts down into Haru\'s hands.',
        ]);
        await F.walkParty(12, 6.4, 2.6);
        G.give('shard3'); setFlag('shard3'); G.sfx('level_up', { vol: 0.7 }); await G.flash(700);
        await G.say(['*: A cold laugh drifts through the lighthouse.']);
        // Marisol appears on the balcony
        await G.say([
          'marisol: Bravo, little Bearer! Bravo! The Sovereign did say you were adorable.',
          'airi: Who are you?',
          'marisol: Marisol. Sea-witch, shepherd of lost captains, and a very faithful servant of the Night Sovereign. Do keep the Shard warm for us, dears.',
          'marisol: Hanari Isle, where the crystals sing, holds the fourth. My sisters of the tide-cult are digging there as we speak. Hurry, or they\'ll have finished before you arrive!',
          'ren: A warning from the enemy? Suspicious.',
          'marisol: Not a warning, darling. A scheduled event. Ta-ta!',
          '*: A wave of dark water rises — and where it recedes, the sea-witch is gone.',
          'daigo: ...She was kind of a lot, wasn\'t she.',
        ]);
        setFlag('ch3_done');
        G.heal();
        await G.banner('Chapter 3 Complete', 'Port Namiji', 2600);
        G.toast('Talk to Old Umi on the pier to sail for Hanari Isle.', 'good');
        G.autosave();
      },
    }],
  };
}

async function sail(G, F) {
  await G.fadeTo(1, 800);
  G.music('calm');
  await G.card(['SAILING THE SILVER SEA', 'Toward Hanari Isle'], { ms: 3200 });
  await F.enter('cavern1', 6.5, 30.5, 'up');
  await G.fadeTo(0, 900);
}
