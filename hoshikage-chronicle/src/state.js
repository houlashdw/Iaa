// The single mutable game state + helpers (stats, equipment, levelling, save/load).
import { CHARS, baseStat, expNeed, MAX_LV } from './data/characters.js';
import { EQUIP, ITEMS, START_EQUIP } from './data/items.js';

const fresh = () => ({
  version: 1,
  roster: {}, party: [], inv: { tonic: 3, leaf: 1 }, gold: 60, flags: {},
  map: { id: 'hinode', x: 21.5, z: 22.5, dir: 'up' }, steps: 0, play: 0, battles: 0, chapter: 0, saveName: '',
});
export const state = fresh();
export function resetState() {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh());
}

// ---------- flags / inventory
export const flag = (k) => state.flags[k];
export const setFlag = (k, v = true) => { state.flags[k] = v; };
export const count = (id) => state.inv[id] || 0;
export function addItem(id, n = 1) { state.inv[id] = (state.inv[id] || 0) + n; if (state.inv[id] <= 0) delete state.inv[id]; }

// ---------- characters
export function addChar(id, { lv, equip } = {}) {
  if (state.roster[id]) return state.roster[id];
  const lvls = state.party.map((p) => state.roster[p].lv);
  const avg = lvls.length ? Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length) : 1;
  const L = lv ?? Math.max(1, avg - 0);
  const r = { lv: L, exp: 0, hp: 1, mp: 1, equip: { ...START_EQUIP[id], ...(equip || {}) } };
  state.roster[id] = r;
  const s = statsOf(id);
  r.hp = s.maxHp; r.mp = s.maxMp;
  if (state.party.length < 4) state.party.push(id);
  return r;
}
export function statsOf(id) {
  const r = state.roster[id];
  const lv = r.lv;
  const s = { maxHp: baseStat(id, 'hp', lv), maxMp: baseStat(id, 'mp', lv), atk: baseStat(id, 'atk', lv), def: baseStat(id, 'def', lv), mag: baseStat(id, 'mag', lv), res: baseStat(id, 'res', lv), spd: baseStat(id, 'spd', lv) };
  for (const slot of ['weapon', 'armor', 'charm']) {
    const e = EQUIP[r.equip[slot]];
    if (!e) continue;
    for (const [k, v] of Object.entries(e.stats)) {
      if (k === 'hp') s.maxHp += v; else if (k === 'mp') s.maxMp += v; else s[k] += v;
    }
  }
  return s;
}
export const learned = (id) => CHARS[id].learn.filter(([lv]) => lv <= state.roster[id].lv).map(([, s]) => s);
export function canEquip(id, itemId) {
  const e = EQUIP[itemId];
  return !!e && (!e.for || e.for.includes(id));
}
export function equip(id, slot, itemId) {
  const r = state.roster[id];
  const cur = r.equip[slot];
  if (cur) addItem(cur, 1);
  if (itemId) addItem(itemId, -1);
  r.equip[slot] = itemId || null;
  const s = statsOf(id);
  r.hp = Math.min(r.hp, s.maxHp); r.mp = Math.min(r.mp, s.maxMp);
}
export function healAll() {
  for (const id of Object.keys(state.roster)) { const s = statsOf(id), r = state.roster[id]; r.hp = s.maxHp; r.mp = s.maxMp; }
}
/** returns array of level-up reports */
export function gainExp(id, amount) {
  const r = state.roster[id];
  const ups = [];
  if (r.lv >= MAX_LV) return ups;
  r.exp += amount;
  while (r.lv < MAX_LV && r.exp >= expNeed(r.lv)) {
    const before = statsOf(id), oldSk = learned(id);
    r.exp -= expNeed(r.lv);
    r.lv++;
    const after = statsOf(id);
    r.hp += after.maxHp - before.maxHp; r.mp += after.maxMp - before.maxMp;
    ups.push({ lv: r.lv, before, after, skills: learned(id).filter((s) => !oldSk.includes(s)) });
  }
  return ups;
}

// ---------- persistence
const KEY = (n) => `hoshikage.save.${n}`;
export function saveSlot(n, label) {
  state.saveName = label || state.saveName;
  const data = JSON.stringify({ ...state, savedAt: Date.now() });
  try { localStorage.setItem(KEY(n), data); return true; } catch { return false; }
}
export function slotInfo(n) {
  try {
    const raw = localStorage.getItem(KEY(n));
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { at: d.savedAt, play: d.play, label: d.saveName, party: d.party, lv: d.roster[d.party[0]]?.lv, gold: d.gold, chapter: d.chapter };
  } catch { return null; }
}
export function loadSlot(n) {
  try {
    const raw = localStorage.getItem(KEY(n));
    if (!raw) return false;
    resetState();
    Object.assign(state, JSON.parse(raw));
    return true;
  } catch { return false; }
}
export function lastSlot() {
  let best = null;
  for (let i = 0; i < 3; i++) { const s = slotInfo(i); if (s && (!best || s.at > best.at)) best = { n: i, ...s }; }
  return best;
}
export const fmtTime = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
