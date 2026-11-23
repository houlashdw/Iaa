// Chapter 1: the Whispering Woods and the goblin camp.
import { lanterns, signpost } from './mapkit.js';
import { state, flag, setFlag } from '../state.js';
import { camTo } from './story.js';

const T = ['tree_oak', 'tree_fat', 'tree_pine', 'tree_pine_tall', 'tree_dark'];
const npc = (id, sprite, x, z, talk, o = {}) => ({ id, sprite, x, z, talk, ...o });

export function registerWoods(MAPS) {
  MAPS.woods1 = {
    id: 'woods1', name: 'Whispering Woods', size: [36, 56], mood: 'forest', seed: 31, music: 'forest', chapter: 1, stage: 'forest',
    encounter: { zone: () => (flag('airi_joined') ? 'woods' : 'woods0'), rate: [15, 27], stage: 'forest' },
    build(b) {
      b.ground('grass', { tint: 0xa8d08a, tile: 3 });
      const P = 0xe6cfa6;
      b.path([[17, 55], [17, 46], [9, 46], [9, 36], [24, 36], [24, 26], [13, 26], [13, 16], [13, 6], [13, 1]], 3, 'dirt', { tint: P });
      b.path([[24, 36], [31, 36]], 3, 'dirt', { tint: P }); b.path([[9, 46], [4, 46]], 3, 'dirt', { tint: P });
      b.patch('dirt', 8.5, 10, 10, 8, { tint: 0xd6bf94, tile: 3 }); b.reserve(8, 10, 11, 9);   // Airi's clearing
      b.forestEdge(T, 4, { gapRects: [[15, 51, 5, 6], [11, -3, 5, 6]] });
      b.scatter(T, [1, 1, 34, 54], 230, { solid: 0.42, minDist: 1.5 });
      b.scatter(['mushroom_red', 'bush', 'bush_large', 'flower_red', 'rock_small', 'log', 'stump', 'rock_large'], [3, 3, 30, 50], 160);
      signpost(b, 19.4, 52); signpost(b, 11.4, 5.5);
      lanterns(b, [[11, 20], [15.4, 30], [22.4, 40]], 0x9be34f, true);
    },
    npcs: [
      npc('airi', 'airi', 13.5, 13.6, null, { cond: () => !flag('airi_joined'), noTalk: true, ghost: true, h: 1.95 }),
      npc('g1', 'goblins_grunt', 10.8, 12.4, null, { cond: () => !flag('airi_joined'), noTalk: true, ghost: true }),
      npc('g2', 'goblins_archer', 16.2, 12.6, null, { cond: () => !flag('airi_joined'), noTalk: true, ghost: true }),
      npc('g3', 'goblins_slinger', 13.6, 10.6, null, { cond: () => !flag('airi_joined'), noTalk: true, ghost: true }),
    ],
    chests: [
      { id: 'w1a', x: 3.4, z: 46.8, item: 'tonic', qty: 3 }, { id: 'w1b', x: 32.6, z: 36.8, gold: 140 },
      { id: 'w1c', x: 21.4, z: 30.5, item: 'leaf', qty: 2 }, { id: 'w1d', x: 6.5, z: 21.6, item: 'dew', qty: 2 },
    ],
    exits: [
      { rect: [15.4, 54.6, 4.2, 1.4], to: 'hinode', tx: 23.5, tz: 4.4, dir: 'down' },
      { rect: [11.4, 0.0, 4.2, 1.2], to: 'woods2', tx: 17.5, tz: 40.4, dir: 'up' },
    ],
    triggers: [{
      id: 'airi', rect: [9, 15, 9, 3], once: true, cond: () => !flag('airi_joined'),
      async run(G, F) {
        G.music('sad');
        await G.say(['*: Somewhere ahead, a voice cries out — then falls silent.', 'haru: That sounded like someone in trouble!']);
        await F.walkParty(13.5, 16.6, 3.2);
        await G.say(['goblin: Hehehe! Sky-priestess pretty! Warchief say bring pretty glowing ones!', 'airi: Keep... back. I may be out of strength, but the Moon still listens to me!']);
        await G.say(['haru: Hey! Pick on someone who hits back!']);
        const r = await G.startBattle({ enemies: ['gob_grunt', 'gob_archer', 'gob_slinger'], stage: 'forest', canFlee: false });
        if (r === 'abort') return;
        for (const id of ['g1', 'g2', 'g3']) F.removeNpc(id);
        G.music('calm');
        await G.say([
          'airi: ...Thank you. I\'m Airi, a priestess of the Moon Temple. I felt the Seal break and followed the pull of a Moon Shard into these woods.',
          'haru: A Moon Shard! The goblins stole my grandpa\'s amulet — Elder Genzo says it\'s a piece of the Moon!',
          'airi: Then it is the same shard I have been tracking. It sings, if you listen. And it is singing... to you, I think.',
          'haru: Me? I\'m just a kid with a wooden sword.',
          'airi: Then we shall make that sword matter. Please — let me travel with you. I can heal, and I know what the Shards are for.',
        ]);
        F.removeNpc('airi'); setFlag('airi_joined');
        await G.join('airi');
        await G.say(['airi: The goblin camp lies north, past the clearing. Stay close, Haru. And please — drink your tonics before you\'re at death\'s door.']);
      },
    }],
  };

  MAPS.woods2 = {
    id: 'woods2', name: 'Goblin Warband Camp', size: [34, 44], mood: 'forest', seed: 37, music: 'forest', chapter: 1, stage: 'forest',
    encounter: { zone: 'woods2', rate: [14, 25], stage: 'forest' },
    build(b) {
      b.ground('dirt', { tint: 0xb9a07a, tile: 3.2 });
      b.patch('grass', 0, 28, 34, 16, { tint: 0xa8d08a, tile: 3.2, y: 0.01 });
      b.path([[17, 43], [17, 28]], 3, 'dirt', { tint: 0xe6cfa6 });
      b.patch('dirt', 5.5, 3.5, 23, 24, { tint: 0x9a8260, tile: 3 }); b.reserve(5, 3, 24, 25);
      b.forestEdge(T, 4, { gapRects: [[15, 40, 5, 6], [30, 9, 6, 5]] });
      b.scatter(T, [1, 28, 32, 15], 70, { solid: 0.42, minDist: 1.6 });
      for (const [x, z, r] of [[8.5, 7.5, 0.5], [25.5, 8.5, -0.5], [7.5, 15.5, 0.8], [26.5, 17.5, -0.8], [11, 22.5, 0.2], [23, 23, -0.3]]) { b.prop('tent', x, z, { ry: r, solid: 1.1 }); }
      b.fire(17, 10, {}); b.fire(17, 19.5, {}); b.fire(7, 22, { light: false });
      b.prop('crate', 12.4, 6.0, { solid: 0.5 }); b.prop('crate', 13.4, 6.4, { ry: 0.5, solid: 0.5 }); b.prop('barrels', 21.5, 6.2, { solid: 0.5 }); b.prop('barrels', 29, 12.5, { solid: 0.5 }); b.prop('crate', 5.6, 11.4, { solid: 0.5 });
      b.scatter(['rock_small', 'mushroom_red', 'bush', 'rock_large', 'stump'], [3, 3, 28, 36], 60);
      signpost(b, 19.4, 40);
    },
    npcs: [
      npc('gruk', 'goblins_warchief', 17.5, 7.0, null, { h: 2.5, noTalk: true, cond: () => !flag('gruk_dead') }),
      npc('scout', 'goblins_scout', 20.5, 8.2, null, { noTalk: true, cond: () => !flag('gruk_dead') }),
      npc('gc1', 'goblins_grunt', 13.6, 19.4, async (G) => G.say(['gob: Halt! Who goes... oh. A kid. And a pretty lady. Warchief say no kids.', 'gob: ...Is that a nice hat? Can I have the hat?']), { cond: () => !flag('gruk_dead') }),
      npc('gc2', 'goblins_shieldbearer', 20.6, 20.4, async (G) => G.say(['gob: I am shield! I stop things! ...Mostly things that are not arrows. Arrows are tricky.']), { cond: () => !flag('gruk_dead') }),
      npc('gc3', 'goblins_cook', 7.6, 20.4, async (G) => G.say(['gob: Cooking mushroom stew! Secret ingredient: more mushroom. Want some? ...No? Rude.']), { wander: 0.5 }),
      npc('gc4', 'goblins_prisoner', 27.4, 13.6, async (G) => {
        if (!G.flag('prisoner_hint')) { G.set('prisoner_hint'); await G.say(['prisoner: Psst! I\'m prisoner, not goblin! Okay, I\'m goblin. But a nice one! Warchief keeps the shiny stone by his fire. He says it makes him hear the Moon.']); G.give('tonic', 2); }
        else await G.say(['prisoner: Please beat him. His singing is awful.']);
      }, {}),
    ],
    chests: [
      { id: 'w2a', x: 29.6, z: 6.8, item: 'draught', qty: 2 }, { id: 'w2b', x: 4.6, z: 5.8, item: 'guard_ring' }, { id: 'w2c', x: 30.6, z: 31.6, gold: 160 },
    ],
    exits: [
      { rect: [15.4, 42.6, 4.2, 1.4], to: 'woods1', tx: 13.5, tz: 3.4, dir: 'down' },
      { rect: [33.0, 9.5, 1.2, 4], to: 'shrine', tx: 3.2, tz: 45.2, dir: 'right', cond: () => flag('gruk_dead') },
      { rect: [33.0, 9.5, 1.2, 4], to: 'woods2', tx: 31, tz: 11.5, dir: 'left', cond: () => !flag('gruk_dead'), block: (G) => async (G2, F) => { await G.say(['*: The path east is overgrown. Better deal with the Warchief first.']); F.teleportParty(31.2, F.pos.z, 'left'); } },
    ],
    triggers: [{
      id: 'gruk', rect: [10, 12, 14, 2.5], once: true, cond: () => !flag('gruk_dead'),
      async run(G, F) {
        G.music('sad');
        await F.walkParty(17.5, 13.5, 3.4);
        await G.say([
          'gruk: HAH! Who dares walk into Gruk\'s camp? Little boy! Pretty lady! You come to be my breakfast?',
          'haru: We\'ve come for the amulet you stole from Hinode!',
          'gruk: This? This is no amulet. This is a piece of the sky! It whispers to Gruk! It says: "Gruk the greatest! Gruk the king of goblins!"',
          'airi: It says nothing of the sort. A Moon Shard only amplifies what the holder already wants. You are hearing your own ego, Warchief.',
          'gruk: ...Gruk does not know word "ego". Gruk will smash you for saying it!',
        ]);
        G.sfx('boss', { vol: 0.8 });
        const r = await G.bossBattle(['gob_chief', 'gob_grunt', 'gob_archer'], { stage: 'forest', events: [
          { when: 'hp', enemy: 0, below: 0.5, async run(G, B) {
            B.world.shake = 0.5;
            await G.say(['gruk: The stone — it SINGS! Gruk feels strong! Bring the boys!']);
            B.buffEnemy(B.enemies[0], 'atkUp', 5);
            await B.addEnemy('gob_shaman');
          } },
        ] });
        if (r === 'abort') return;
        setFlag('gruk_dead');
        F.removeNpc('gruk'); F.removeNpc('scout');
        G.music('calm');
        await G.say([
          'gruk: Gruk... lost? To a boy... with a stick...',
          '*: The Warchief collapses. The glowing amulet rolls from his grip into Haru\'s hands — and for a heartbeat, the whole forest holds its breath.',
          'shard: ...Haru.',
          'haru: It spoke! Did you hear that, Airi? It said my name!',
          'airi: It is a Moon Shard — the first of the Seal\'s four keys. The Shard has chosen you, Haru. You are its Bearer.',
        ]);
        G.give('shard1');
        await G.say([
          'airi: The Moon Temple\'s records speak of four Shards. One rests in the Ashen Shrine to the east, where the Bandit King Gorou has been digging. One in the lighthouse of Port Namiji. One beneath the Crystal Caverns. And the Night Sovereign\'s servants are already hunting them.',
          'haru: Then we\'d better find them first!',
          'airi: Yes. But first — Elder Genzo should know his amulet is safe. And you should rest. Heroes who skip sleep become very grumpy heroes.',
        ]);
        setFlag('ch1_done');
        G.heal();
        await G.banner('Chapter 1 Complete', 'The Whispering Woods', 2600);
        G.toast('Path east to the Ashen Shrine is open. Elder Genzo has a gift for you in Hinode.', 'good');
        G.autosave();
      },
    }],
  };
}
