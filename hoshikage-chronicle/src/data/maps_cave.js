// Chapter 4: the Crystal Caverns of Hanari Isle (Sylva, Mordo, Stheno, Moon Shard IV).
import { room } from './mapkit.js';
import { dungeon } from './dungeon.js';
import { state, flag, setFlag } from '../state.js';

const npc = (id, sprite, x, z, talk, o = {}) => ({ id, sprite, x, z, talk, ...o });
const C1 = dungeon({
  w: 40, h: 34, seed: 7, organic: 0.45, decor: 0.2,
  rooms: [{ x: 3, z: 26, w: 8, h: 7, round: true }, { x: 13, z: 23, w: 9, h: 8, round: true }, { x: 24, z: 25, w: 11, h: 7, round: true }, { x: 28, z: 13, w: 9, h: 8, round: true }, { x: 13, z: 10, w: 11, h: 9, round: true }, { x: 3, z: 12, w: 8, h: 9, round: true }, { x: 14, z: 1, w: 11, h: 7, round: true }],
  links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6]],
});
const C2 = dungeon({
  w: 38, h: 36, seed: 9, organic: 0.45, decor: 0.2,
  rooms: [{ x: 3, z: 28, w: 9, h: 7, round: true }, { x: 14, z: 24, w: 9, h: 8, round: true }, { x: 25, z: 24, w: 10, h: 7, round: true }, { x: 26, z: 11, w: 9, h: 9, round: true }, { x: 11, z: 12, w: 11, h: 9, round: true }, { x: 2, z: 12, w: 7, h: 9, round: true }, { x: 12, z: 1, w: 13, h: 8, round: true }],
  links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6]],
});
const cv = (g, i) => g.centers[i];

export function registerCave(MAPS) {
  const [c0, c1, c2, c3, c4, c5, c6] = [0, 1, 2, 3, 4, 5, 6].map((i) => cv(C1, i));
  MAPS.cavern1 = {
    id: 'cavern1', name: 'Crystal Caverns — Upper Depths', size: [40, 34], mood: 'cave', seed: 61, music: 'cave', chapter: 4, stage: 'cave',
    dist: 15, pitch: 0.88, bright: 2.1, grid: C1, checkFrom: [c0[0], c0[1]],
    encounter: { zone: 'cave', rate: [14, 24], stage: 'cave' },
    build(b) {
      b.ground('stone', { tint: 0x9aa6d8, tile: 2.4, margin: 0 });
      b.ascii(C1.rows, { tex: 'wall', tint: 0x7c80b8, h: 2.3 });
      b.scatter(['rock_small', 'rock_large', 'mushroom_red'], [1, 1, 38, 32], 30);
      b.glowCrystal(c0[0] - 1, c0[1] - 2, { color: 0x6fe8ff, s: 1.2 }); b.glowCrystal(c4[0] + 2, c4[1] - 2, { color: 0xb08aff, s: 1.5 });
      b.glowCrystal(c6[0] - 3, c6[1], { color: 0x7affd0, s: 1.4 }); b.glowCrystal(c6[0] + 3, c6[1], { color: 0x7affd0, s: 1.4 });
    },
    npcs: [
      npc('sylva', 'sylva', c1[0] + 1, c1[1] - 1, null, { cond: () => !flag('sylva_found'), noTalk: true, ghost: true, h: 1.9 }),
      npc('cu1', 'pirates_tide_cultist', c1[0] - 2.5, c1[1] - 2, null, { cond: () => !flag('sylva_found'), noTalk: true, ghost: true }),
      npc('cu2', 'pirates_tide_cultist', c1[0] + 3, c1[1] + 1.6, null, { cond: () => !flag('sylva_found'), noTalk: true, ghost: true }),
      npc('mordo', 'villains_necromancer', c6[0], c6[1] - 1, null, { cond: () => !flag('mordo_dead'), noTalk: true, h: 2.1 }),
    ],
    chests: [
      { id: 'c1a', x: c5[0] + 0.5, z: c5[1] + 0.5, item: 'moondew', qty: 2 }, { id: 'c1b', x: c3[0] + 0.5, z: c3[1] + 1.5, item: 'ranger_mail' },
      { id: 'c1c', x: c2[0] + 3.5, z: c2[1] + 1.5, gold: 340 }, { id: 'c1d', x: c4[0] - 3.5, z: c4[1] + 2.5, item: 'brew' },
    ],
    exits: [
      { rect: [c0[0] - 2, c0[1] + 2.6, 4, 1], to: 'cavern1', tx: c0[0], tz: c0[1], dir: 'up', block: (G) => async (G2, F) => { await G.say(['*: The boat has already sailed back to Namiji. There is only one way out — forward.']); F.teleportParty(c0[0], c0[1], 'up'); } },
      { rect: [c6[0] - 1.5, c6[1] - 3.5, 3, 1], to: 'cavern2', tx: cv(C2, 0)[0], tz: cv(C2, 0)[1], dir: 'up', cond: () => flag('mordo_dead') },
    ],
    triggers: [
      {
        id: 'sylva', rect: [c1[0] - 2, c1[1] - 1, 5, 3], once: true, cond: () => !flag('sylva_found'),
        async run(G, F) {
          G.music('sad');
          await G.say([
            '*: Arrows hiss through the crystal light. A hooded ranger fights back-to-back against two robed cultists.',
            'cultist: Surrender, forest-child! The Tide demands your bow!',
            'sylva: The Tide can have my arrows. One at a time. Through the throat.',
            'ren: She\'s outnumbered. Haru?',
            'haru: On it!',
          ]);
          const r = await G.startBattle({ enemies: ['cav_cultist', 'cav_cultist', 'cav_diver'], stage: 'cave', canFlee: false });
          if (r === 'abort') return;
          for (const id of ['cu1', 'cu2']) F.removeNpc(id);
          G.music('cave');
          await G.say([
            'sylva: ...I had that.',
            'daigo: You had two arrows left and one cultist on your tail. We call that "a close shave".',
            'sylva: Sylva. Ranger of the Greenhollow. The Tidebound cult burned my forest to open a path to this cave. I have followed them for three months.',
            'airi: Then you know what they dig for. A Moon Shard.',
            'sylva: I know their leader keeps a dead man at the cave\'s heart. A necromancer who whispers to crystals. I\'m going to put an arrow in him. You\'re welcome to watch.',
            'haru: Come with us! We\'re going the same way anyway.',
            'sylva: ...Fine. But I lead the way through anything with eight legs.',
          ]);
          F.removeNpc('sylva'); setFlag('sylva_found');
          await G.join('sylva', { equip: { weapon: 'long_bow', armor: 'ranger_mail' } });
          if (state.party.length >= 4) await G.say(['*: Sylva joined, but your party is full. Open the menu (Esc / M) → Party to swap members in and out any time.']);
        },
      },
      {
        id: 'mordo', rect: [c6[0] - 3, c6[1] + 1, 6, 2], once: true, cond: () => !flag('mordo_dead'),
        async run(G, F) {
          G.music('shrine');
          await F.walkParty(c6[0], c6[1] + 2.5, 3);
          await G.say([
            'mordo: Footsteps in the dead man\'s hall. How rude. How... alive.',
            'sylva: Mordo. I told you I\'d find you.',
            'mordo: The little ranger! You\'ve brought friends. More bones for my collection!',
            'airi: There are Moon Shard whispers in these crystals. You are using the Shard\'s power to raise the dead!',
            'mordo: I am merely... borrowing it. The Hollow Sovereign gave me a purpose, you see — to make something of those who have none.',
            'haru: Nobody gets to be "made something of" by a stolen Shard! We\'re taking it back!',
          ]);
          const r = await G.bossBattle(['cav_necro', 'cav_cultist', 'cav_cultist'], { stage: 'cave', events: [
            { when: 'hp', enemy: 0, below: 0.5, async run(G, B) { B.world.shake = 0.5; await G.say(['mordo: Rise, my little ones! RISE!']); await B.addEnemy('cav_diver'); B.buffEnemy(B.enemies[0], 'defUp', 4); } },
          ] });
          if (r === 'abort') return;
          setFlag('mordo_dead'); F.removeNpc('mordo');
          G.music('cave');
          await G.say(['mordo: The Sovereign... will not be... pleased... *crumbles into dust and a faint violet mist*', 'sylva: One down. One cult to go.', '*: Behind the dead man\'s throne, a passage descends deeper into the crystal dark.']);
          G.heal(); G.autosave();
        },
      },
    ],
  };

  const [d0, d1, d2, d3, d4, d5, d6] = [0, 1, 2, 3, 4, 5, 6].map((i) => cv(C2, i));
  MAPS.cavern2 = {
    id: 'cavern2', name: 'Crystal Caverns — The Singing Deep', size: [38, 36], mood: 'cave', seed: 62, music: 'cave', chapter: 4, stage: 'cave',
    dist: 15, pitch: 0.88, bright: 2.1, grid: C2, checkFrom: [d0[0], d0[1]],
    encounter: { zone: 'cave', rate: [13, 22], stage: 'cave' },
    build(b) {
      b.ground('stone', { tint: 0x8a96d0, tile: 2.4, margin: 0 });
      b.ascii(C2.rows, { tex: 'wall', tint: 0x74709f, h: 2.3 });
      b.scatter(['rock_small', 'rock_large', 'mushroom_red'], [1, 1, 36, 34], 26);
      b.glowCrystal(d6[0], d6[1] - 3, { color: 0xc090ff, s: 2.4 }); b.glowCrystal(d6[0] - 4, d6[1] + 1, { color: 0x6fe8ff, s: 1.5 }); b.glowCrystal(d6[0] + 4, d6[1] + 1, { color: 0x6fe8ff, s: 1.5 });
      b.glowCrystal(d4[0] + 3, d4[1] - 2, { color: 0xb08aff, s: 1.4 }); b.glowCrystal(d1[0] - 2, d1[1] - 2, { color: 0x7affd0, s: 1.1 });
    },
    npcs: [
      npc('stheno', 'villains_gorgon', d6[0], d6[1] - 1.5, null, { cond: () => !flag('stheno_dead'), noTalk: true, h: 2.4 }),
      npc('pr1', 'villains_cult_priest', d6[0] - 3, d6[1] - 0.5, null, { cond: () => !flag('stheno_dead'), noTalk: true }),
      npc('pr2', 'villains_cult_priest', d6[0] + 3, d6[1] - 0.5, null, { cond: () => !flag('stheno_dead'), noTalk: true }),
      npc('lost', 'towns_scribe', d5[0] + 1, d5[1] + 1, async (G) => G.say(['scribe: I came to document the singing crystals. They sang, I wrote. Then the cultists came and the singing stopped. Mostly I\'ve been hiding behind this rock. It is a good rock.']), {}),
    ],
    chests: [
      { id: 'c2a', x: d5[0] + 0.5, z: d5[1] - 1.5, item: 'elven_bow' }, { id: 'c2b', x: d3[0] + 0.5, z: d3[1] + 1.5, item: 'moondew', qty: 2 },
      { id: 'c2c', x: d2[0] + 2.5, z: d2[1] + 1.5, gold: 420 }, { id: 'c2d', x: d4[0] - 3.5, z: d4[1] + 2.5, item: 'elixir' },
    ],
    exits: [
      { rect: [d0[0] - 2, d0[1] + 2.6, 4, 1], to: 'cavern1', tx: c6[0], tz: c6[1] - 1.5, dir: 'up' },
      { rect: [d6[0] - 2, d6[1] - 3.6, 4, 1], to: 'castle_gate', tx: 20, tz: 27, dir: 'up', cond: () => flag('stheno_dead') },
    ],
    triggers: [{
      id: 'stheno', rect: [d6[0] - 3, d6[1] + 1.2, 6, 2], once: true, cond: () => !flag('stheno_dead'),
      async run(G, F) {
        G.music('shrine');
        await F.walkParty(d6[0], d6[1] + 3, 3);
        await G.say([
          'stheno: Sssssomeone walks on the Singing Deep. Take care, children — my sssongs are not for ssstone-hearted listeners.',
          'airi: The Shard is behind her. That towering crystal.',
          'stheno: The Sovereign promised me a world where nothing moves unless I wish it. Ssso still. Sso quiet.',
          'ren: You sound lonely.',
          'stheno: Lonely is for those who still have hearts to break. Ssstay, little ones. Ssstay forever.',
          'sylva: Don\'t look into her eyes!',
        ]);
        const r = await G.bossBattle(['cav_gorgon', 'cav_priest', 'cav_priest'], { stage: 'cave', events: [
          { when: 'hp', enemy: 0, below: 0.5, async run(G, B) { B.world.shake = 0.5; await G.say(['stheno: Enough! Look at me, little hero— LOOK!']); B.buffEnemy(B.enemies[0], 'atkUp', 4); } },
        ] });
        if (r === 'abort') return;
        setFlag('stheno_dead');
        for (const id of ['stheno', 'pr1', 'pr2']) F.removeNpc(id);
        G.music('sad');
        await G.say(['stheno: ...You didn\'t stop moving. Why... did you keep moving?', 'haru: Because somebody had to. And because nobody should be alone in the dark.']);
        await F.walkParty(d6[0], d6[1] - 1.8, 2.6);
        G.give('shard4'); setFlag('shard4'); G.sfx('level_up', { vol: 0.7 }); await G.flash(700);
        await G.say([
          '*: The great crystal sings one last, clear note — and the fourth Moon Shard comes to rest in Haru\'s hands.',
          'airi: Four Shards. The Moon\'s Seal is whole except for one thing: its heart, which Lord Kurohane keeps in Moonlit Castle.',
          'sylva: The vampire lord who rules the northern cliffs. The cult served him.',
          'daigo: And behind him, the Sovereign. The one the witch kept naming.',
          'ren: Then that is where this ends. A castle, a lord, and a long night.',
          '*: At the cave\'s peak, a stair of moonlight unfolds — leading up through the rock, toward a bridge beneath a cracked sky.',
        ]);
        setFlag('ch4_done'); G.heal();
        await G.banner('Chapter 4 Complete', 'The Crystal Caverns', 2600);
        G.autosave();
      },
    }],
  };
}
