// Which 3D model plays which character. Keys are the character keys used all over the game (party ids and
// "<pack>_<name>" for everyone else).
//
// Style rule: every humanoid is a VRoid anime avatar (cel-shaded .vrm, CC0) re-coloured / re-sized / re-armed per
// role, so the whole cast shares one art style. Rigged CC0 GLBs are used only for true creatures (skeleton, ghost,
// demon, ogre, frog, wolf).
const HAIR = /HAIR/;
const CLOTH = /CLOTH/;
const SKIN = /SKIN/;

const V = (file, o = {}) => ({ file: file + '.vrm', ...o });
const G = (file, o = {}) => ({ file: file + '.glb', ...o });
const t = (re, c) => [re, c];
const SW = (p = {}) => ({ type: 'sword', bone: 'rightHand', rot: [0, 0, 1.18], ...p });
const ST = (color, p = {}) => ({ type: 'staff', bone: 'rightHand', color, rot: [0, 0, 1.18], ...p });

const EXPLICIT = {
  // ---- the party
  haru: V('sakurada', { props: [{ type: 'hat', bone: 'head' }] }),
  airi: V('sample_g', { props: [ST(0xffe9a0)] }),
  ren: V('base_male', { tint: [t(HAIR, 0x303848), t(CLOTH, 0x3a4a8a)], props: [{ type: 'katana', bone: 'hips', pos: [0.22, -0.02, -0.02], rot: [-1.25, 0, 0.35] }] }),
  daigo: V('base_male', { hideHair: true, wMul: 1.12, tint: [t(CLOTH, 0xf4f0e0)] }),
  sylva: V('sample_e', { props: [{ type: 'bow', bone: 'leftHand', rot: [0, 0, -1.18] }] }),
  zeno: V('sample_f', { props: [ST(0x7ad0ff)] }),
};

const TOWNS = {
  barmaid: V('sample_e'),
  herbalist: V('sendagaya', { tint: [t(CLOTH, 0x7ac078)] }),
  beggar: V('base_male', { hMul: 0.94, tint: [t(HAIR, 0x6a5a4a), t(CLOTH, 0x7a7466)] }),
  blacksmith: V('base_male', { wMul: 1.22, tint: [t(CLOTH, 0x7a4a38), t(HAIR, 0x201810), t(SKIN, 0xd09a78)] }),
  elder: V('sakurada', { hMul: 0.93, wMul: 0.96, tint: [t(HAIR, 0xf4f4f4), t(CLOTH, 0x9a7650)], props: [ST(0xb8e0ff, { color: 0xb8e0ff })] }),
  farmer: V('base_male', { tint: [t(CLOTH, 0xc8b078), t(HAIR, 0x80602e)] }),
  fisherman: V('sakurada', { tint: [t(CLOTH, 0xe8d06a), t(HAIR, 0x6a3a20)] }),
  guard: V('base_male', { tint: [t(CLOTH, 0x9ab0c8), t(HAIR, 0x404858)], props: [{ type: 'spear', bone: 'rightHand', rot: [0, 0, 1.18] }] }),
  innkeeper: V('base_male', { wMul: 1.5, tint: [t(CLOTH, 0xf0e4c8), t(HAIR, 0x8a5a30)] }),
  lamplighter: V('sakurada', { tint: [t(CLOTH, 0x6a6a88), t(HAIR, 0x3a3048)] }),
  merchant: V('base_male', { tint: [t(HAIR, 0x6a3020), t(CLOTH, 0xa8403a)] }),
  minstrel: V('sample_d', { tint: [t(CLOTH, 0xe87aa0), t(HAIR, 0x4a2a30)] }),
  noble: V('sakurada', { tint: [t(CLOTH, 0x6a7ae0), t(HAIR, 0xe8d890)] }),
  scribe: V('sendagaya', { tint: [t(CLOTH, 0x9a7a58), t(HAIR, 0x6a4a30)] }),
  stable_hand: V('base_male', { tint: [t(HAIR, 0x8a5a30), t(CLOTH, 0x8a7a58)] }),
  child: V('sakurada'),
};
const HEROES = { knight: V('base_male', { tint: [t(CLOTH, 0xc8ccd8)], props: [SW()] }), mage: V('sample_f'), bard: V('sample_d', { tint: [t(CLOTH, 0xd8587a)] }) };

let goblinN = 0; // goblin variants rotate through several anime bases so a camp is not one face repeated
const GOBLIN_BASES = ['sample_e', 'sample_d', 'sample_f', 'sample_e', 'sample_g']; // light-skinned bases so the green goblin tint reads
const goblin = (cloth, o = {}) => V(GOBLIN_BASES[goblinN++ % GOBLIN_BASES.length], { hMul: 0.8, tint: [t(SKIN, 0x8ed060), t(HAIR, 0x3a5028), t(CLOTH, cloth)], props: [SW({ scale: 0.55 })], ...o });
const GOBLINS = {
  default: goblin(0x7a5a3a),
  grunt: goblin(0x7a5a3a), slinger: goblin(0x6a7a4a, { props: [] }), archer: goblin(0x4a6a3a, { props: [{ type: 'bow', bone: 'leftHand', rot: [0, 0, -1.18], scale: 0.7 }] }),
  scout: goblin(0x586878), shaman: goblin(0x8a4ac8, { props: [ST(0xc090ff, { scale: 0.75 })] }), bomber: goblin(0xc88a3a, { props: [] }),
  firebrand: goblin(0xd05a2a, { props: [] }), alchemist: goblin(0x7ac048, { props: [] }), shieldbearer: goblin(0x808890), duelist: goblin(0xa05a5a),
  crossbowman: goblin(0x5a5a3a, { props: [] }), cutpurse: goblin(0x5a4a68), pup: goblin(0x9ac870, { hMul: 0.62 }), cook: goblin(0xf4f0e0, { props: [] }),
  elder: goblin(0xc8c8b0, { hMul: 0.7, tint: [t(SKIN, 0xa8c880), t(HAIR, 0xf0f0f0), t(CLOTH, 0xc8c8b0)], props: [ST(0xb0e090, { scale: 0.6 })] }),
  prisoner: goblin(0x7a7a70, { props: [] }), merchant: goblin(0x7a5a98, { props: [] }), slaver: goblin(0x583838), ratcatcher: goblin(0x68583a), trap_maker: goblin(0x6a6a48),
  spore_tender: goblin(0x8a6a98), tunneler: goblin(0x786858), banner_bearer: goblin(0xa84a3a, { props: [] }),
  warchief: V('sakurada', { hMul: 1.15, wMul: 1.4, tint: [t(SKIN, 0x78b84a), t(HAIR, 0x30401c), t(CLOTH, 0x6a4a30)], props: [SW({ scale: 1.5 })] }),
  brute: G('orc_brute', { tint: [t(/./, 0x9ad060)] }), wolf_rider: G('wolf_cartoon', { tint: [t(/./, 0xb0a890)] }),
};
const pirate = (cloth, o = {}) => V('base_male', { tint: [t(CLOTH, cloth), t(HAIR, 0x4a3020)], props: [SW()], ...o });
const brute = (cloth, o = {}) => V('sakurada', { hMul: 1.1, wMul: 1.3, tint: [t(CLOTH, cloth), t(SKIN, 0xc89870), t(HAIR, 0x3a2418)], props: [SW({ scale: 1.3 })], ...o });
const PIRATES = {
  default: pirate(0xc8c0a0), swashbuckler: pirate(0xe8d0a8), smuggler: pirate(0xb8a888, { props: [] }), marine: pirate(0x9ab0c8),
  berserker: brute(0x8a8a8a), bosun: brute(0x6a8a6a), breaker: brute(0x8a7a6a), harpooner: brute(0x5a7a8a, { props: [{ type: 'spear', bone: 'rightHand', rot: [0, 0, 1.18] }] }),
  juggernaut: brute(0xb86a3a), first_mate: brute(0x8a6a4a, { tint: [t(CLOTH, 0x8a6a4a), t(SKIN, 0xb88a64), t(HAIR, 0x9a3a1a)] }),
  reaver: brute(0x7a6a5a), brig_keeper: brute(0x6a5a4a, { props: [] }), cannoneer: brute(0xe0a070, { props: [] }), sawbones: pirate(0xe8e0d0, { props: [] }),
  quartermaster: pirate(0xb88a60, { wMul: 1.2, props: [] }),
  bombardier: V('sample_e', { hMul: 0.85, tint: [t(SKIN, 0xc8d870), t(CLOTH, 0xe8c850), t(HAIR, 0x6a5a20)], props: [] }),
  marksman: V('sample_e', { hMul: 0.9, tint: [t(CLOTH, 0xe8d0a0), t(HAIR, 0x5a3a20)], props: [{ type: 'bow', bone: 'leftHand', rot: [0, 0, -1.18], scale: 0.8 }] }),
  rigger: V('sample_e', { hMul: 0.85, tint: [t(SKIN, 0xc8b0b0), t(CLOTH, 0xb0a8b0), t(HAIR, 0x8a7a8a)], props: [SW({ scale: 0.6 })] }),
  cook: G('frog', { tint: [t(/./, 0xb8c880)] }), diver: G('frog', { tint: [t(/./, 0x78b898)] }), poisoner: G('frog', { tint: [t(/./, 0xa0d870)] }),
  captain: V('sakurada', { tint: [t(CLOTH, 0xc03a30), t(HAIR, 0x7a2a18)], props: [SW()] }),
  navigator: V('base_male', { tint: [t(CLOTH, 0xe0d0a0), t(HAIR, 0x8a4a28)] }), cabin_kid: V('sample_e', { hMul: 0.85, tint: [t(CLOTH, 0xb8a888)] }),
  sea_witch: V('sendagaya', { tint: [t(CLOTH, 0x28c8a8), t(HAIR, 0x20a0a0)], props: [ST(0x6af0d0)] }),
  stormcaller: V('sample_f', { tint: [t(CLOTH, 0x555a78), t(HAIR, 0x4a5a78)], props: [ST(0xffe35c)] }), tide_cultist: V('sendagaya', { tint: [t(CLOTH, 0x2a88b8), t(HAIR, 0x205870)], props: [ST(0x7ad0ff, { scale: 0.8 })] }),
};
const VILLAINS = {
  assassin: V('base_male', { tint: [t(CLOTH, 0x403850), t(HAIR, 0x202028)], props: [SW({ scale: 0.8 })] }), bandit_king: brute(0x7a5a3a, { hMul: 1.2, tint: [t(CLOTH, 0x7a5a3a), t(SKIN, 0xc89870), t(HAIR, 0x8a2a18)] }),
  blackguard: G('demon', { tint: [t(/./, 0x504860)] }), corrupted_paladin: V('base_male', { tint: [t(CLOTH, 0xe8d8a0), t(HAIR, 0xd8d0b0)], props: [SW()] }),
  cult_priest: V('sample_d', { tint: [t(CLOTH, 0xc83a3a), t(HAIR, 0x401818)], props: [ST(0xff6a6a, { scale: 0.85 })] }),
  dark_elf_matriarch: V('sample_d_dark', { props: [ST(0xc090ff)] }), dark_monk: V('base_male', { hideHair: true, tint: [t(CLOTH, 0x403848)] }),
  dread_ranger: V('sample_e', { tint: [t(CLOTH, 0x3a5a3a), t(HAIR, 0x2a3a20)], props: [{ type: 'bow', bone: 'leftHand', rot: [0, 0, -1.18] }] }),
  gorgon: V('sendagaya', { hMul: 1.25, tint: [t(SKIN, 0xa8e090), t(HAIR, 0x70c050), t(CLOTH, 0x60a050)], props: [ST(0x9ae060)] }), mind_tyrant: G('ghost', { hMul: 1.2, tint: [t(/./, 0xc080f0)] }),
  necromancer: G('skeleton', { tint: [t(/./, 0x907898)] }), plague_doctor: V('sakurada', { tint: [t(CLOTH, 0x6a5a48), t(HAIR, 0x403830)], props: [ST(0x8a8a58, { scale: 0.9 })] }),
  reaver: brute(0x7a6a5a), vampire_lord: V('sakurada', { hMul: 1.1, tint: [t(CLOTH, 0x7a1830), t(HAIR, 0x383040), t(SKIN, 0xe8dcdc)] }),
  warlord: brute(0xc84a30, { hMul: 1.2, props: [SW({ scale: 1.6 })] }), witch: V('sample_d', { tint: [t(CLOTH, 0x2a6a38), t(HAIR, 0x405830)], props: [ST(0x9ae060)] }),
};
const PACKS = { towns: TOWNS, heroes: HEROES, goblins: GOBLINS, pirates: PIRATES, villains: VILLAINS };

export function specFor(key) {
  if (EXPLICIT[key]) return EXPLICIT[key];
  const i = key.indexOf('_');
  const pack = key.slice(0, i), name = key.slice(i + 1);
  const table = PACKS[pack];
  if (table && table[name]) return table[name];
  if (table && table.default) return table.default;
  return goblin(0x7a5a3a);
}
/** every model file the game can ask for */
export const allModelFiles = () => {
  const s = new Set();
  const add = (o) => Object.values(o).forEach((v) => s.add(v.file));
  add(EXPLICIT); Object.values(PACKS).forEach(add); s.add('sample_e.vrm');
  return [...s];
};
