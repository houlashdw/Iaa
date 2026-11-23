// Speakers, shared story helpers, and the prologue.
import * as THREE from 'three';
import { state, setFlag, flag, addItem, addChar } from '../state.js';
import { tween, easeOut, sleep } from '../core/util.js';

const P = (name, sprite, color) => ({ name, sprite, side: 'left', color });
const N = (name, sprite, color = '#ffd36b') => ({ name, sprite, side: 'right', color });
export const SPEAKERS = {
  haru: P('Haru', 'haru', '#ffd36b'), airi: P('Airi', 'airi', '#fff2a8'), ren: P('Ren', 'ren', '#7fa6ff'),
  daigo: P('Daigo', 'daigo', '#7fe0a0'), sylva: P('Sylva', 'sylva', '#9be34f'), zeno: P('Zeno', 'zeno', '#8fd0ff'),
  elder: N('Elder Genzo', 'towns_elder'), guard: N('Guard', 'towns_guard', '#9ad4ff'), farmer: N('Farmer Gohei', 'towns_farmer'),
  herbalist: N('Hanae', 'towns_herbalist', '#8dffb4'), minstrel: N('Minstrel Lute', 'towns_minstrel', '#ff9ac0'), scribe: N('Scribe Fumi', 'towns_scribe'),
  innkeeper: N('Innkeeper Botan', 'towns_innkeeper'), barmaid: N('Mina', 'towns_barmaid', '#ffb38a'), merchant: N('Merchant Kichi', 'towns_merchant', '#ffd36b'),
  smith: N('Tetsu the Smith', 'towns_blacksmith', '#ffb070'), lamp: N('Lamplighter Hoshi', 'towns_lamplighter', '#ffe08a'), stable: N('Taro', 'towns_stable_hand'),
  noble: N('Lord Aoi', 'towns_noble', '#c8b0ff'), fisher: N('Old Umi', 'towns_fisherman', '#7fd0ff'), beggar: N('Beggar', 'towns_beggar', '#bbb'),
  knight: N('Sir Gareth', 'heroes_knight', '#ffd36b'), mage: N('Master Orin', 'heroes_mage', '#8fb0ff'), bard: N('Lute', 'heroes_bard', '#ff9ac0'),
  scout: N('Goblin Scout', 'goblins_scout', '#9be34f'), gob: N('Goblin', 'goblins_grunt', '#9be34f'), goblinelder: N('Goblin Elder', 'goblins_elder', '#9be34f'),
  goblin: N('Goblin', 'goblins_grunt', '#9be34f'), gruk: N('Warchief Gruk', 'goblins_warchief', '#b6d94a'), shaman: N('Goblin Shaman', 'goblins_shaman', '#b6d94a'), prisoner: N('Prisoner', 'goblins_prisoner', '#9be34f'),
  gorou: N('Bandit King Gorou', 'villains_bandit_king', '#ff9a62'), bandit: N('Bandit', 'villains_assassin', '#ff9a62'), monk: N('Fallen Monk', 'villains_dark_monk', '#ff9a62'),
  redtide: N('Captain Redtide', 'pirates_captain', '#ff6a6a'), orlo: N('First Mate Orlo', 'pirates_first_mate', '#ff8a6a'), marisol: N('Marisol', 'pirates_sea_witch', '#6af0d0'),
  pirate: N('Pirate', 'pirates_swashbuckler', '#ff6a6a'), cabin: N('Cabin Kid Pip', 'pirates_cabin_kid', '#ffd36b'), pip: N('Pip', 'pirates_cabin_kid', '#ffd36b'), navigator: N('Navigator', 'pirates_navigator', '#ffd36b'),
  mordo: N('Mordo', 'villains_necromancer', '#b17dff'), stheno: N('Stheno', 'villains_gorgon', '#9be34f'), cultist: N('Cultist', 'pirates_tide_cultist', '#7fd0ff'),
  priest: N('Cult Priest', 'villains_cult_priest', '#ff6a6a'), vael: N('Matriarch Vael', 'villains_dark_elf_matriarch', '#c8a0ff'), kazan: N('Warlord Kazan', 'villains_warlord', '#ff7a5a'),
  kurohane: N('Lord Kurohane', 'villains_vampire_lord', '#ff4a6a'), sovereign: N('The Hollow Sovereign', 'villains_mind_tyrant', '#d890ff'), witch: N('Night Witch', 'villains_witch', '#8fd070'),
  blackguard: N('Black Guard', 'villains_blackguard', '#aaa'), doc: N('Plague Doctor', 'villains_plague_doctor', '#bba'), paladin: N('Fallen Paladin', 'villains_corrupted_paladin', '#ddd'),
  trader: N('Wandering Trader', 'towns_merchant', '#ffd36b'), cook: N('Gobbo the Cook', 'goblins_cook', '#9be34f'),
  voice: { name: '???', sprite: null }, shard: { name: 'The Shard', sprite: null, color: '#9ad4ff' },
};

// ------------------------------------------------------------------ cinematic helpers
export async function camTo(G, { pitch, dist, yaw, look, ms = 1200 }) {
  const w = G.field.world;
  const p0 = w.pitch, d0 = w.dist, y0 = w.yaw, l0 = w.lookUp;
  await tween(ms, (t) => { const k = t * t * (3 - 2 * t); if (pitch !== undefined) w.pitch = p0 + (pitch - p0) * k; if (dist !== undefined) w.dist = d0 + (dist - d0) * k; if (yaw !== undefined) w.yaw = y0 + (yaw - y0) * k; if (look !== undefined) w.lookUp = l0 + (look - l0) * k; });
}
export function streak(world, from, to, ms = 900, color = 0xdfe8ff, size = 0.12) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, 5), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  m.position.copy(from); world.scene.add(m);
  const d = new THREE.Vector3().subVectors(to, from); m.lookAt(to);
  return tween(ms, (t) => { m.position.lerpVectors(from, to, t); m.material.opacity = 1 - t * t; }).then(() => { world.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
}
export async function starfall(G, n = 6) {
  const w = G.field.world, c = w.camTarget;
  for (let i = 0; i < n; i++) {
    const a = new THREE.Vector3(c.x - 30 + Math.random() * 60, 38 + Math.random() * 12, c.z - 50 - Math.random() * 15);
    streak(w, a, a.clone().add(new THREE.Vector3(24, -24, 8)), 1100 + Math.random() * 500);
    await sleep(260 + Math.random() * 300);
  }
}
/** the Moon cracks and its shards rain across the land */
export async function moonShatter(G) {
  const w = G.field.world, moon = w.moon;
  if (!moon) return;
  G.sfx('boss', { vol: 0.8, rate: 0.5 });
  for (let i = 0; i < 6; i++) { moon.material.color.setHex(i % 2 ? 0xff6a6a : 0xffffff); w.shake = 0.35; await sleep(110); }
  G.flash(900, 0xffffff);
  G.sfx('big_kill', { vol: 0.9, rate: 0.6 });
  w.shake = 1.1;
  moon.visible = false; if (w.halo) w.halo.material.opacity = 0.05;
  const shards = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.1 + Math.random() * 0.8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xbfe4ff : 0xfff0c0, fog: false }));
    m.position.copy(moon.position); w.scene.add(m); shards.push(m);
  }
  await tween(2600, (t) => {
    shards.forEach((m, i) => {
      const a = (i / shards.length) * Math.PI * 2 + 0.4, k = easeOut(t);
      m.position.set(moon.position.x + Math.cos(a) * 60 * k, moon.position.y - 70 * t * t - 6 * Math.sin(a * 2) * k, moon.position.z + 40 * k + Math.sin(a) * 20 * k);
      m.rotation.x += 0.1; m.rotation.y += 0.07;
    });
  });
  shards.forEach((m) => { w.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  // the broken moon remains as a pale red wound
  moon.visible = true; moon.scale.setScalar(0.82); moon.material.color.setHex(0xc89aa8);
  setFlag('moon_broken');
}

// ------------------------------------------------------------------ the prologue
export async function intro(G) {
  state.map = { id: 'hinode_night', x: 23.5, z: 28.5, dir: 'up' };
  await G.field.enter('hinode_night', 23.5, 28.5, 'up');
  await G.fadeTo(0, 1400);
  await G.banner('Hinode Village', 'The Night of Falling Stars', 2600);
  G.toast('Walk to the village square (WASD / arrows). Press E near people to talk.', '');
}

export async function prologueScene(G, F) {
  F.player.moving = false;
  const world = F.world;
  await G.say([
    '*: Once every hundred years, the Moon Spirit sheds stardust over the sleepy village of Hinode.',
    'elder: Ah, there you are, Haru! Come closer to the fire. The sky is about to put on its show.',
    'haru: Grandpa Genzo! Is it true that the stars sing on this night?',
    'elder: So the old stories say. And this little amulet of mine has hummed since sunset... as if it were listening.',
    'haru: It\'s glowing!',
  ]);
  await F.walkParty(23.5, 18.8, 2.6);
  F.face('up');
  await G.say(['elder: Look up, my boy. There. The first one.']);
  await Promise.all([camTo(G, { pitch: 0.1, dist: 22, look: 12.5, ms: 1900 }), starfall(G, 5)]);
  G.music(null);
  await G.say(['*: A hush fell over the village. Even the bonfire seemed to lean in.']);
  await G.say(['elder: ...Wait. That sound. The Moon is— no. No, no, no—']);
  await moonShatter(G);
  await sleep(300);
  await G.say(['haru: The Moon... it BROKE?!', 'elder: The Moon Seal has shattered. Haru — stay behind me!']);
  G.music('sad');
  await camTo(G, { pitch: 0.82, dist: 17, look: 0, ms: 1100 });
  // goblins burst through the north road
  const gate = F.npc('gob1');
  G.sfx('dash', { vol: 0.6 });
  F.walkNpc('gob1', 22.3, 15.6, 4.2); F.walkNpc('gob2', 24.8, 15.8, 4.2); F.walkNpc('scout', 23.5, 14.2, 4.6);
  world.shake = 0.6;
  await sleep(1300);
  await G.say([
    'scout: Hehehe! Shiny, shiny! The sky-stone sings to Warchief Gruk!',
    'elder: Don\'t you dare touch that! Haru, RUN!',
    'haru: I\'m not running! Not from goblins!',
  ]);
  G.sfx('hit', { vol: 0.8 });
  await G.say(['scout: Give it here, old man!', '*: The scout snatches the glowing amulet and bolts north. Two goblin pups block the road.']);
  F.walkNpc('scout', 23.5, 0.6, 7);
  const r = await G.startBattle({ enemies: ['gob_pup', 'gob_pup'], stage: 'night', canFlee: false, music: 'battle_theme_a' });
  if (r === 'abort') return;
  F.removeNpc('gob1'); F.removeNpc('gob2'); F.removeNpc('scout');
  G.music('sad');
  await G.say([
    'elder: You... you fought them off. With a wooden sword. Your father would have been proud.',
    'haru: They took your amulet, Grandpa!',
    'elder: Yes. And that amulet is no mere trinket, Haru. It is a sliver of the Moon itself — a Moon Shard. When the Seal broke, the Moon scattered its shards across Tsukiyo. Whoever gathers them can mend the sky... or rule beneath it.',
    'elder: The goblins of the Whispering Woods have taken the first. You must follow, and bring it back before their warchief learns what it can do.',
    'haru: Me? But I\'m just a kid from the village.',
    'elder: Everyone who saved the world was "just" someone, once. Take this. And be careful in those woods.',
  ]);
  G.give('tonic', 3); G.give('leaf', 1); G.gold(100);
  await G.say(['elder: Rest. Prepare. Buy what you need from Kichi and Tetsu in the morning. Then go north, through the village gate.']);
  setFlag('prologue');
  await G.fadeTo(1, 900);
  await G.card(['PROLOGUE', 'The Moon Breaks'], { ms: 2800 });
  await F.enter('hinode', 23.5, 19.5, 'up');
  state.chapter = 1;
  await G.fadeTo(0, 1100);
  await G.banner('Hinode Village', 'Morning', 2200);
  G.toast('Tip: Esc / M opens the menu. Visit the shops, then leave by the north gate.', '');
  G.autosave();
}

// ------------------------------------------------------------------ the ending
export async function epilogue(G, F) {
  await G.fadeTo(1, 1200);
  G.music(null);
  await G.card(['EPILOGUE', 'A Moon Mended'], { ms: 3000 });
  await F.enter('hinode', 23.5, 20.5, 'up');
  F.world.setMood('dusk');
  await G.fadeTo(0, 1600);
  G.music('calm');
  await G.banner('Hinode Village', 'Dawn', 2400);
  await G.say([
    '*: By morning the whole sky had mended itself, seam by silver seam. The Moon hung whole above Hinode — a little brighter than before, and a little warmer.',
    'elder: ...You came home. I told you to come home.',
    'haru: I said I would, Grandpa. I brought some friends. Is that okay? They eat a lot.',
    'daigo: I resent that. I eat a perfectly reasonable amount. For a monk-slash-human-furnace.',
    'ren: The old man makes tea. This village is already better than most kingdoms.',
    'sylva: There are trees here. Real ones. ...I might stay a while.',
    'zeno: And someone must teach this boy proper sorcery before he drops a Shard on his own foot.',
    'airi: The Moon Temple will need rebuilding, and the world will need guardians for the Shards. But that is a story for another day.',
    'elder: Today, there is festival food. And a hero who is, I notice, still a little too short for that sword.',
    'haru: I\'ll grow into it!',
  ]);
  await G.say(['*: And somewhere above the quiet village, a single star streaked across a healed sky — not falling, this time, but dancing.']);
  await G.fadeTo(1, 1600);
  await G.card(['HOSHIKAGE CHRONICLE', 'THE END'], { ms: 4200 });
  await G.card(['Thank you for playing', 'Art: Sprite Foundry · Kenney · Quaternius · Screaming Brain Studios · cynicmusic'], { ms: 5200 });
  state.flags.game_complete = true;
  G.autosave();
  G.toTitle();
}
