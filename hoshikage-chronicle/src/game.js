// Game orchestrator: wires renderer, field, battle, UI, audio and the story-script API (`G`).
import * as THREE from 'three';
import { Gfx } from './core/gfx.js';
import { preload, loadSprite } from './core/assets.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { World } from './world/world.js';
import { Field } from './world/field.js';
import { Battle, BattleAbort } from './battle/battle.js';
import { Menus } from './ui/menus.js';
import { Title } from './ui/title.js';
import * as UI from './ui/ui.js';
import { state, resetState, addChar, setFlag, flag, addItem, healAll, saveSlot, loadSlot, statsOf } from './state.js';
import { CHARS } from './data/characters.js';
import { itemInfo } from './data/items.js';
import { SPEAKERS, intro } from './data/story.js';
import { sleep, tween } from './core/util.js';

export const G = {
  mode: 'boot', paused: false, difficulty: 1, ui: UI, state, audio, input,
};
G.toast = UI.toast; G.banner = UI.banner; G.card = UI.card;

/** Say lines. Each line: 'speakerId: text' or '*: narration'. Multiple strings = multiple pages. */
G.say = async (lines, opts = {}) => {
  if (typeof lines === 'string') lines = [lines];
  for (const raw of lines) {
    const m = /^([a-z0-9_*?]+)\s*:\s*([\s\S]*)$/i.exec(raw);
    let who = null, text = raw;
    if (m) { who = m[1]; text = m[2]; }
    let sp;
    if (!who || who === '*') sp = { name: '', sprite: null };
    else sp = SPEAKERS[who] || { name: who, sprite: null, side: 'right' };
    if (sp.sprite) await loadSprite(sp.sprite).catch(() => {});
    await UI.dialogue.say(sp, text, opts);
  }
};
G.choice = (options, o) => UI.dialogue.choice(options, o);
G.fadeTo = (v, ms = 400) => { const a = G.gfx.fade; return tween(ms, (t) => (G.gfx.fade = a + (v - a) * t)); };
G.flag = flag; G.set = setFlag;
G.give = (id, n = 1) => { addItem(id, n); const it = itemInfo(id); UI.toast(`Received <b>${it.name}</b>${n > 1 ? ' ×' + n : ''}`, 'good'); audio.sfx('gem', { vol: 0.6 }); };
G.gold = (n) => { state.gold += n; UI.toast(`${n >= 0 ? '+' : ''}${n} G`, 'gold'); if (n > 0) audio.sfx('coin', { vol: 0.6 }); };
G.join = async (id, o = {}) => {
  await loadSprite(CHARS[id].sprite);
  addChar(id, o);
  if (!state.party.includes(id) && state.party.length < 4) state.party.push(id);
  audio.jingle('levelup');
  UI.toast(`<b>${CHARS[id].name}</b> joined the party!`, 'good');
  if (G.field && G.field.active) G.field.buildParty(G.field.pos.x, G.field.pos.z, G.field.dir);
};
G.heal = () => { healAll(); audio.sfx('revive', { vol: 0.7 }); };
G.shake = (n = 0.5) => { (G.mode === 'battle' ? G.battle.world : G.world).shake = n; };
G.flash = async (ms = 500, color = 0xffffff) => { G.gfx.setFadeColor(color); G.gfx.fade = 0.95; await tween(ms, (t) => (G.gfx.fade = 0.95 * (1 - t))); G.gfx.fade = 0; G.gfx.setFadeColor(0x000000); };
G.music = (name) => audio.playMusic(name);
G.sfx = (n, o) => audio.sfx(n, o);
G.sleep = sleep;
/** record the party's current position so a save resumes exactly where the player stands */
G.syncMap = () => { const F = G.field; if (F && F.active && F.def) state.map = { id: F.def.id, x: F.pos.x, z: F.pos.z, dir: F.dir }; };
G.autosave = () => { if (G.mode === 'field') { G.syncMap(); saveSlot(0, (G.field.def?.name || '') + ' (auto)'); } };
G.openMenu = () => G.menus.open();
G.shop = (stock, o) => G.menus.shop(stock, o);
G.inn = async (price, name = 'Inn') => {
  const c = await G.choice([`Rest (${price} G)`, 'Leave'], { title: `Stay at the ${name}?` });
  if (c !== 0) return false;
  if (state.gold < price) { await G.say(['*: You can\'t afford it.']); return false; }
  state.gold -= price;
  await G.fadeTo(1, 700); audio.stopMusic(0.5); audio.jingle('sparkle'); await sleep(1100);
  G.heal(); await G.fadeTo(0, 700); audio.playMusic(G.field.def.music);
  UI.toast('HP and MP fully restored.', 'good');
  return true;
};

// ---------------------------------------------------------------- battles
G.battleTransition = async (prepare) => {
  audio.stopMusic(0.2);
  audio.sfx('boss', { vol: 0.5, rate: 1.6 });
  G.gfx.setFadeColor(0xffffff);
  await tween(260, (t) => (G.gfx.fade = t));
  await prepare();
  G.mode = 'battle';
};
G.startBattle = async (opts) => {
  UI.dialogue.hide();
  try {
    const r = await G.battle.run(opts);
    G.mode = 'field';
    return r;
  } catch (e) {
    if (e instanceof BattleAbort) return 'abort';
    throw e;
  }
};
G.bossBattle = (enemies, o = {}) => G.startBattle({ enemies, stage: o.stage || G.field.def.stage || 'field', canFlee: false, music: o.music || 'battle_theme_a', events: o.events || [], ...o });

// ---------------------------------------------------------------- settings / save
G.saveSettings = () => {
  try { localStorage.setItem('hoshikage.settings', JSON.stringify({ quality: G.gfx.quality, difficulty: G.difficulty, speed: UI.dialogue.speed })); } catch {}
};
G.loadSettings = () => {
  try {
    const s = JSON.parse(localStorage.getItem('hoshikage.settings') || '{}');
    if (s.quality) G.gfx.setQuality(s.quality);
    if (s.difficulty) G.difficulty = s.difficulty;
    if (s.speed) UI.dialogue.speed = s.speed;
  } catch {}
};
G.toTitle = async () => {
  G.mode = 'title'; G.field.active = false;
  await G.fadeTo(1, 400);
  UI.dialogue.hide();
  G.battle.el.classList.add('hidden'); G.battle.active = false;
  audio.stopMusic(0.5);
  await G.fadeTo(0, 400);
  G.title.show();
};
G.newGame = async () => {
  resetState();
  addChar('haru', { lv: 1 });
  G.title.hide();
  await G.fadeTo(1, 500);
  G.mode = 'field';
  await intro(G);
};
G.loadGame = async (n) => {
  if (!loadSlot(n)) { UI.toast('Could not load that save.'); return; }
  G.title.hide();
  await G.fadeTo(1, 400);
  await Promise.all(Object.keys(state.roster).map((id) => loadSprite(CHARS[id].sprite)));
  G.mode = 'field';
  await G.field.enter(state.map.id, state.map.x, state.map.z, state.map.dir);
  await G.fadeTo(0, 500);
  UI.toast('Game loaded.', 'good');
};

// developer helper: jump straight into a map with a given party (used by tools/play.mjs)
G.debugStart = async (mapId, x, z, { party = ['haru'], lv = 1, flags = {}, items = {}, gold = 0 } = {}) => {
  resetState();
  for (const id of party) { addChar(id, { lv }); }
  for (const [k, v] of Object.entries(flags)) setFlag(k, v);
  for (const [k, v] of Object.entries(items)) addItem(k, v);
  state.gold += gold;
  await Promise.all(party.map((id) => loadSprite(CHARS[id].sprite)));
  input.stack.length = 0; G.title.hide(); G.mode = 'field';
  await G.field.enter(mapId, x, z, 'up');
  G.gfx.fade = 0; audio.unlock();
};

// ---------------------------------------------------------------- boot
export async function boot() {
  const loading = UI.h('div', 'loading', `<div>HOSHIKAGE CHRONICLE</div><div class="lbar"><div class="lfill"></div></div><small>Gathering moonlight…</small>`);
  document.body.appendChild(loading);
  const canvas = document.getElementById('gl');
  G.gfx = new Gfx(canvas);
  G.loadSettings();
  if (matchMedia('(pointer: coarse)').matches) input.mountTouch(UI.root);
  let man;
  if (window.__EMBED__) man = JSON.parse(atob(window.__EMBED__['manifest.json'].split(',')[1]));
  else man = await (await fetch((window.__ASSET_BASE__ || 'assets/') + 'manifest.json')).json();
  const fill = loading.querySelector('.lfill');
  await preload(man, (p) => (fill.style.width = Math.round(p * 100) + '%'));
  G.world = new World(G.gfx);
  G.field = new Field(G);
  G.battle = new Battle(G);
  G.menus = new Menus(G);
  G.title = new Title(G);
  G.menus.loadPicker = async () => {
    const el = UI.h('div', 'menu'); el.innerHTML = '<div class="mbody" style="grid-template-columns:1fr"><div class="mright"></div></div>'; UI.root.appendChild(el);
    const n = await G.menus.saveMenu(el, { onlyLoad: true });
    el.remove(); return n;
  };
  // unlock audio on first interaction
  const unlock = () => { audio.unlock(); };
  addEventListener('pointerdown', unlock, { once: false, capture: true });
  addEventListener('keydown', unlock, { capture: true });
  // main loop
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.mode === 'field') G.field.update(dt);
    else if (G.mode === 'battle') G.battle.update(dt);
    else if (G.mode === 'title') G.title.update(dt);
    G.gfx.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  loading.classList.add('hidden');
  await G.title.show();
}
window.__G = G;
