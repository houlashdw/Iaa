// Chapter 2: the Ashen Shrine (Ren, the Bandit King, Moon Shard II).
import { lanterns, signpost } from './mapkit.js';
import { state, flag, setFlag } from '../state.js';
import { camTo } from './story.js';

const npc = (id, sprite, x, z, talk, o = {}) => ({ id, sprite, x, z, talk, ...o });

export function registerShrine(MAPS) {
  MAPS.shrine = {
    id: 'shrine', name: 'Ashen Shrine', size: [44, 52], mood: 'shrine', seed: 41, music: 'shrine', chapter: 2, stage: 'shrine',
    encounter: { zone: () => (flag('ren_joined') ? 'shrine' : 'woods2'), rate: [14, 25], stage: 'shrine' },
    build(b) {
      b.ground('grass', { tint: 0xc8d4a2, tile: 3.2 });
      b.path([[3, 45], [22, 45], [22, 4]], 4, 'stone', { tint: 0xd8cfe0, tile: 2.2 });
      b.patch('stone', 9, 17, 26, 14, { tint: 0xc9c0d6, tile: 2.2 }); b.reserve(9, 17, 26, 14);
      b.patch('stone', 17, 12, 10, 6, { tint: 0xd8cfe0, tile: 2.2 }); b.reserve(17, 11, 10, 7);
      // the main hall
      b.box(13, 2, 18, 8, 4.2, { tex: 'stone', tint: 0xdcc0b6, tile: 2.4 });
      b.gableRoof(13, 2, 18, 8, 4.2, 2.6, { tint: 0xb5473a, oh: 0.9, gableTex: 'stone', gableTint: 0xdcc0b6 });
      b.box(21, 9.88, 3, 0.14, 2.7, { tex: 'wood', tint: 0x2e2028, solid: false, tile: 1.4 });
      b.box(12, 9.9, 20, 0.6, 0.5, { tex: 'stone', tint: 0xb8b0c4, solid: false, tile: 1.6 });
      b.reserve(12, 10, 20, 8);
      // altar with the shard
      b.box(21.4, 10.7, 2.2, 1.0, 0.9, { tex: 'stone', tint: 0xcfc8d8, tile: 1.4, solid: true });
      if (!flag('shard2')) { b.prop('crystal', 22.5, 11.2, { y: 0.9, s: 0.55, ry: 0.3 }); b.light(22.5, 2.0, 11.4, 0x9ad4ff, 3.2, 10, { flicker: 0.1 }); }
      for (const z of [40, 31.5, 23.5]) b.torii(22, z, { w: 6.6, h: 3.3 });
      lanterns(b, [[19, 43], [25, 43], [19, 35], [25, 35], [19, 27], [25, 27], [19, 14], [25, 14]], 0xffd8b0, false);
      for (const [x, z] of [[19, 43], [25, 35], [19, 27], [25, 14]]) b.light(x, 2.1, z, 0xffc890, 1.6, 9, { flicker: 0.1 });
      b.forestEdge(['tree_autumn', 'tree_autumn', 'tree_dark', 'rock_tall'], 4, { gapRects: [[-3, 41, 6, 8], [40, 19, 6, 8]] });
      for (const [x, z, r] of [[11, 21.5, 0.4], [33, 22.5, -0.5], [12, 28.5, 0.9], [32, 28.5, -0.9]]) b.prop('tent', x, z, { ry: r, solid: 1.1 });
      b.fire(17, 24.2, {}); b.fire(28, 25, { light: false });
      b.prop('crate', 14, 19, { solid: 0.5 }); b.prop('barrels', 30.4, 19.2, { solid: 0.5 }); b.prop('crate', 15.6, 30, { ry: 0.4, solid: 0.5 });
      for (const [x, z] of [[8, 38], [37, 38], [7, 14], [38, 12], [10, 6], [34, 5], [6, 28], [38, 30]]) b.prop(Math.random() < 0.5 ? 'column' : 'column_broken', x, z, { solid: 0.5 });
      b.scatter(['tree_autumn', 'tree_dark'], [1, 1, 42, 50], 60, { solid: 0.42, minDist: 1.7 });
      b.scatter(['rock_small', 'rock_large', 'bush', 'flower_red', 'mushroom_red'], [2, 2, 40, 48], 90);
      signpost(b, 5.4, 43);
    },
    npcs: [
      npc('ren', 'ren', 22.5, 37.6, null, { cond: () => !flag('ren_joined'), noTalk: true, h: 1.95 }),
      npc('gorou', 'villains_bandit_king', 22.5, 14.2, null, { cond: () => !flag('gorou_dead'), noTalk: true, h: 2.4 }),
      npc('b1', 'villains_assassin', 19, 14.8, null, { cond: () => !flag('gorou_dead'), noTalk: true }),
      npc('b2', 'villains_assassin', 26, 14.8, null, { cond: () => !flag('gorou_dead'), noTalk: true }),
      npc('c1', 'villains_reaver', 15, 22.4, async (G) => G.say(['bandit: Don\'t mind me, I\'m just standing here. Menacingly. Guarding. The boss says if we find the glowy rock we get double pay.']), { cond: () => !flag('gorou_dead'), h: 2.2 }),
      npc('c2', 'villains_dark_monk', 29, 29.6, async (G) => G.say(['monk: I took vows once. Silence, humility, no stabbing. ...The pay here is better.']), { cond: () => !flag('gorou_dead') }),
      npc('c3', 'villains_plague_doctor', 12.8, 26.2, async (G) => G.say(['doc: *cough* Not contagious! Mostly. Please stay out of my... what is it you call it... "personal bubble".']), { cond: () => !flag('gorou_dead') }),
      npc('villager', 'towns_beggar', 26.6, 41.6, async (G) => {
        if (!G.flag('gorou_dead')) await G.say(['beggar: The bandits came three weeks ago. Chased out the shrine maidens. If you\'re going up there — mind the one with the sword. He doesn\'t look like he wants to be here.']);
        else await G.say(['beggar: The shrine is quiet again. I can hear the wind chimes. First time in weeks.']);
      }),
    ],
    chests: [
      { id: 'sh1', x: 6.4, z: 47.8, item: 'tonic', qty: 3 }, { id: 'sh2', x: 36.6, z: 19.4, item: 'swift_boots', ry: -0.4 },
      { id: 'sh3', x: 9.6, z: 31.8, item: 'draught', qty: 2 }, { id: 'sh4', x: 36.4, z: 6.2, item: 'temper_katana' },
      { id: 'sh5', x: 7.2, z: 8.2, item: 'power_band' }, { id: 'sh6', x: 38.6, z: 34.6, gold: 220 },
    ],
    exits: [
      { rect: [0, 42, 1.3, 6], to: 'woods2', tx: 31.2, tz: 11.5, dir: 'left' },
      { rect: [42.6, 19, 1.4, 7], to: 'namiji', tx: 3.4, tz: 22.5, dir: 'right', cond: () => flag('ch2_done') },
      { rect: [42.6, 19, 1.4, 7], to: 'shrine', tx: 40.5, tz: 22.5, dir: 'left', cond: () => !flag('ch2_done'), block: (G) => async (G2, F) => { await G.say(['*: The road east is washed out. The Bandit King\'s men have been tearing the shrine apart — better finish this first.']); F.teleportParty(40.8, F.pos.z, 'left'); } },
    ],
    triggers: [
      {
        id: 'ren', rect: [18.5, 36.2, 8, 2.4], once: true, cond: () => !flag('ren_joined'),
        async run(G, F) {
          G.music('shrine');
          await F.walkParty(22.5, 40.2, 3);
          await G.say([
            'ren: ...Stop there.',
            '*: A lone samurai stands beneath the torii, hand resting on a katana worn smooth by years of use.',
            'ren: This shrine belongs to Bandit King Gorou now. I am paid to make sure nobody walks past this gate. Turn back.',
            'airi: A samurai guarding bandits? That is... deeply sad, if I may say so.',
            'ren: You may not. Ren, once of the Kuroda clan. Once of many things. The pay is regular, the excuses are not.',
            'haru: We need the Moon Shard under this shrine! The sky broke, and somebody has to fix it!',
            'ren: A boy with a wooden sword, a priestess with a staff, and a destiny. Ha. ...Very well, boy. Show me you mean it. Draw.',
          ]);
          const r = await G.bossBattle(['ren_duel'], { stage: 'shrine', music: 'battle_theme_a', events: [
            { when: 'hp', enemy: 0, below: 0.5, async run(G, B) { await G.say(['ren: ...You hit harder than that stick should allow.']); B.buffEnemy(B.enemies[0], 'atkUp', 4); } },
          ] });
          if (r === 'abort') return;
          F.removeNpc('ren'); setFlag('ren_joined');
          G.music('calm');
          await G.say([
            'ren: ...Enough. I yield.',
            'ren: You fought like someone who has something to protect. I had forgotten what that looks like.',
            'haru: Then you\'ll stop working for Gorou?',
            'ren: Gorou told me he wanted a relic to sell. He did not tell me he was burning the farms along the coast road to fund the digging. I have been hearing the screams at night, and calling it "none of my business".',
            'ren: My blade has served worse masters. It will serve a better one. If you\'ll have me, little hero.',
            'airi: We would be honoured, Ren.',
          ]);
          await G.join('ren', { equip: { weapon: 'worn_katana', armor: 'cloak' } });
          await G.say(['ren: Gorou holds the courtyard and the hall beyond. Follow the path north through three gates. I will show you the way.']);
        },
      },
      {
        id: 'gorou', rect: [16, 16.4, 12, 2], once: true, cond: () => !flag('gorou_dead') && flag('ren_joined'),
        async run(G, F) {
          G.music('shrine');
          await F.walkParty(22.5, 18.4, 3);
          await G.say([
            'gorou: Hahaha! So the priestess and her puppies finally climb my steps! Where is my ronin? Ren! Cut them down!',
            'ren: I am here, Gorou. And I am no longer your ronin.',
            'gorou: ...You dare? After the gold I gave you? The wine? The — the nice blanket?!',
            'ren: The blanket was nice. It does not make me deaf.',
            'gorou: Boys! Kill the traitor and take the glowing rock from the altar! Whoever brings me the kid\'s head gets a double ration!',
            'haru: Why does everyone want to eat me?!',
          ]);
          const r = await G.bossBattle(['ban_king', 'ban_assassin', 'ban_assassin'], { stage: 'shrine', events: [
            { when: 'hp', enemy: 0, below: 0.5, async run(G, B) {
              B.world.shake = 0.5;
              await G.say(['gorou: Time for the good stuff! *gulp* RAGE TONIC!']);
              B.buffEnemy(B.enemies[0], 'atkUp', 5); B.healEnemy(B.enemies[0], 0.12);
            } },
          ] });
          if (r === 'abort') return;
          setFlag('gorou_dead');
          for (const id of ['gorou', 'b1', 'b2']) F.removeNpc(id);
          G.music('calm');
          await G.say(['gorou: I... I almost had it... the Night Sovereign promised me... a throne...', 'ren: The Sovereign? Who is that?', '*: The Bandit King slumps, unconscious. Whatever he knew will have to wait.']);
          await F.walkParty(22.5, 12.8, 2.6);
          F.face('up');
          await G.say([
            '*: On the altar, a shard of pale light hovers, turning slowly — a second piece of the broken Moon.',
            'shard: ...Haru.',
            'haru: It says my name again. Does it say yours?',
            'airi: It never has. Only his. The Shards chose a Bearer, and that is the whole of what the temple scrolls promised.',
          ]);
          setFlag('shard2'); G.give('shard2'); G.sfx('level_up', { vol: 0.7 });
          await G.flash(700);
          await G.say([
            'ren: Two down. And the pirates of Port Namiji hold the third, if the rumours on the coast road are true.',
            'airi: The Moon Temple\'s lighthouse at Namiji. It was always the next stop. East of here — the road should hold, now that the bandits are gone.',
            'haru: Ren... thanks for coming with us.',
            'ren: Do not thank me yet. I have not met your cooking.',
          ]);
          setFlag('ch2_done');
          G.heal();
          await G.banner('Chapter 2 Complete', 'The Ashen Shrine', 2600);
          G.toast('The road east to Port Namiji is open. Visit Hinode if you need supplies!', 'good');
          G.autosave();
        },
      },
    ],
  };
}
