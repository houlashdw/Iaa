// Consumables, key items and equipment.
export const ITEMS = {
  tonic:    { name: 'Herbal Tonic', kind: 'heal', amount: 70, price: 28, desc: 'Restores 70 HP.' },
  draught:  { name: 'Spirit Draught', kind: 'heal', amount: 190, price: 90, desc: 'Restores 190 HP.' },
  brew:     { name: 'Elder Brew', kind: 'heal', amount: 460, price: 260, desc: 'Restores 460 HP.' },
  dew:      { name: 'Dew Drop', kind: 'mp', amount: 28, price: 60, desc: 'Restores 28 MP.' },
  moondew:  { name: 'Moon Dew', kind: 'mp', amount: 75, price: 190, desc: 'Restores 75 MP.' },
  elixir:   { name: 'Starlight Elixir', kind: 'both', price: 900, desc: 'Fully restores HP and MP of one ally.' },
  leaf:     { name: 'Bitter Leaf', kind: 'cure', price: 25, desc: 'Cures poison.' },
  phoenix:  { name: 'Phoenix Feather', kind: 'revive', amount: 0.5, price: 160, desc: 'Revives a fallen ally at half HP.' },
  firebomb: { name: 'Fire Bomb', kind: 'bomb', amount: 95, el: 'fire', battleOnly: true, price: 70, desc: 'Burns every enemy.' },
  stardust: { name: 'Star Dust', kind: 'star', amount: 45, battleOnly: true, price: 120, desc: 'Fills the Star Gauge by 45.' },
  // key items
  amulet:   { name: 'Moon Amulet', key: true, desc: 'The Elder\'s amulet. It hums faintly.' },
  shard1:   { name: 'Moon Shard I', key: true, desc: 'A shard of the shattered Moon. Warm, like a heartbeat.' },
  shard2:   { name: 'Moon Shard II', key: true, desc: 'The shard from the Ashen Shrine.' },
  shard3:   { name: 'Moon Shard III', key: true, desc: 'The shard from the Namiji lighthouse.' },
  shard4:   { name: 'Moon Shard IV', key: true, desc: 'The shard from the Crystal Caverns.' },
  lantern:  { name: 'Spirit Lantern', key: true, desc: 'Lights the way through dark caverns.' },
  seal_key: { name: 'Castle Seal Key', key: true, desc: 'Opens the gate of Moonlit Castle.' },
};

const E = (slot, name, stats, price, desc, forWho) => ({ slot, name, stats, price, desc, for: forWho });
export const EQUIP = {
  // Haru - sword
  wood_sword: E('weapon', 'Wooden Sword', { atk: 5 }, 0, 'A child\'s sword. Loved anyway.', ['haru']),
  iron_blade: E('weapon', 'Iron Blade', { atk: 11 }, 170, 'Honest village steel.', ['haru']),
  steel_saber: E('weapon', 'Steel Saber', { atk: 19, spd: 1 }, 520, 'Balanced and bright.', ['haru']),
  moonlit_edge: E('weapon', 'Moonlit Edge', { atk: 29, mag: 6 }, 1250, 'Hums near Moon Shards.', ['haru']),
  starforged: E('weapon', 'Starforged Blade', { atk: 42, mag: 12, spd: 2 }, 0, 'Forged from a fallen star.', ['haru']),
  // Ren - katana
  worn_katana: E('weapon', 'Worn Katana', { atk: 16 }, 0, 'Chipped, but never dull.', ['ren']),
  temper_katana: E('weapon', 'Tempered Katana', { atk: 25 }, 480, 'Folded a thousand times.', ['ren']),
  wave_cutter: E('weapon', 'Wave Cutter', { atk: 36, spd: 2 }, 1150, 'Cuts like a tide.', ['ren']),
  shadow_fang: E('weapon', 'Shadow Fang', { atk: 49, spd: 3 }, 0, 'A blade that drinks the dark.', ['ren']),
  // Daigo - fists
  cloth_wraps: E('weapon', 'Cloth Wraps', { atk: 9 }, 0, 'Prayer-ribbon hand wraps.', ['daigo']),
  iron_knuckles: E('weapon', 'Iron Knuckles', { atk: 17 }, 320, 'Temple-forged.', ['daigo']),
  tiger_gauntlets: E('weapon', 'Tiger Gauntlets', { atk: 28, def: 3 }, 980, 'Striped with brass.', ['daigo']),
  dragon_fists: E('weapon', 'Dragon Fists', { atk: 40, def: 5 }, 0, 'Warm to the touch.', ['daigo']),
  // Sylva - bow
  hunter_bow: E('weapon', 'Hunter\'s Bow', { atk: 12 }, 0, 'Seasoned yew.', ['sylva']),
  long_bow: E('weapon', 'Longbow', { atk: 21, spd: 1 }, 500, 'Reaches far.', ['sylva']),
  elven_bow: E('weapon', 'Elven Bow', { atk: 31, spd: 2 }, 1150, 'Sings when drawn.', ['sylva']),
  star_piercer: E('weapon', 'Star Piercer', { atk: 43, spd: 3 }, 0, 'Its arrows leave comet tails.', ['sylva']),
  // Airi - staff
  oak_staff: E('weapon', 'Oak Staff', { atk: 3, mag: 8 }, 0, 'Blessed by the temple.', ['airi']),
  silver_staff: E('weapon', 'Silver Staff', { mag: 17, res: 3 }, 440, 'Gleams in the dark.', ['airi']),
  moon_staff: E('weapon', 'Moon Staff', { mag: 28, res: 5 }, 1050, 'Crowned with a crescent.', ['airi']),
  seraph_staff: E('weapon', 'Seraph Staff', { mag: 40, res: 8 }, 0, 'Wings of light on a pole.', ['airi']),
  // Zeno - staff
  apprentice_rod: E('weapon', 'Apprentice Rod', { mag: 9 }, 0, 'Scorched at the tip.', ['zeno']),
  storm_rod: E('weapon', 'Storm Rod', { mag: 19, spd: 1 }, 470, 'Crackles with static.', ['zeno']),
  arcane_staff: E('weapon', 'Arcane Staff', { mag: 31, mp: 20 }, 1100, 'Hums with spare power.', ['zeno']),
  cosmos_scepter: E('weapon', 'Cosmos Scepter', { mag: 44, mp: 36 }, 0, 'A little galaxy in a gem.', ['zeno']),
  // Armour (anyone)
  cloak: E('armor', 'Traveler\'s Cloak', { def: 4, res: 3 }, 60, 'Keeps off the rain.'),
  leather: E('armor', 'Leather Armor', { def: 9, res: 4 }, 210, 'Supple and sturdy.'),
  ranger_mail: E('armor', 'Ranger Mail', { def: 14, res: 7, hp: 20 }, 540, 'Light chain links.'),
  knight_plate: E('armor', 'Knight\'s Plate', { def: 22, res: 9, hp: 40, spd: -1 }, 1050, 'Heavy, honest protection.'),
  moon_garb: E('armor', 'Moon Garb', { def: 22, res: 24, hp: 40 }, 1400, 'Woven moonsilk.'),
  star_raiment: E('armor', 'Star Raiment', { def: 33, res: 32, hp: 80 }, 0, 'Light made cloth.'),
  // Charms
  power_band: E('charm', 'Power Band', { atk: 6 }, 260, '+6 ATK.'),
  guard_ring: E('charm', 'Guard Ring', { def: 7 }, 260, '+7 DEF.'),
  mind_pendant: E('charm', 'Mind Pendant', { mag: 7, res: 4 }, 280, '+7 MAG.'),
  swift_boots: E('charm', 'Swift Charm', { spd: 5 }, 300, '+5 SPD.'),
  vital_beads: E('charm', 'Vital Beads', { hp: 70 }, 340, '+70 HP.'),
  mana_stone: E('charm', 'Mana Stone', { mp: 34 }, 340, '+34 MP.'),
  lucky_cat: E('charm', 'Lucky Cat', { atk: 4, def: 4, mag: 4, res: 4 }, 0, 'A maneki-neko. All stats up.'),
  shard_ring: E('charm', 'Shard Ring', { atk: 8, mag: 8, spd: 3 }, 0, 'A ring set with a sliver of moonlight.'),
};
export const itemInfo = (id) => ITEMS[id] || EQUIP[id];
export const isEquip = (id) => !!EQUIP[id];
export const START_EQUIP = {
  haru: { weapon: 'wood_sword', armor: null, charm: null },
  airi: { weapon: 'oak_staff', armor: 'cloak', charm: null },
  ren: { weapon: 'worn_katana', armor: 'cloak', charm: null },
  daigo: { weapon: 'cloth_wraps', armor: null, charm: null },
  sylva: { weapon: 'hunter_bow', armor: 'leather', charm: null },
  zeno: { weapon: 'apprentice_rod', armor: 'cloak', charm: null },
};
