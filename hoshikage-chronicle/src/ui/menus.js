// Pause menu, shop, save/load, options, credits. All DOM, driven by async flows + pick().
import { state, statsOf, learned, equip, canEquip, addItem, count, saveSlot, slotInfo, fmtTime } from '../state.js';
import { CHARS, expNeed } from '../data/characters.js';
import { ITEMS, EQUIP, itemInfo } from '../data/items.js';
import { SKILLS, ELEMENTS } from '../data/skills.js';
import { h, root, esc, bar, pick, toast } from './ui.js';
import { audio } from '../core/audio.js';
import { input } from '../core/input.js';
import { faceUrl, spriteUrl } from '../core/assets.js';
import { sleep } from '../core/util.js';

const STAT_NAMES = [['maxHp', 'HP'], ['maxMp', 'MP'], ['atk', 'ATK'], ['def', 'DEF'], ['mag', 'MAG'], ['res', 'RES'], ['spd', 'SPD']];

function overlay(cls = '') {
  const el = h('div', 'menu ' + cls);
  root.appendChild(el);
  return el;
}
const card = (id, extra = '') => {
  const r = state.roster[id], s = statsOf(id), c = CHARS[id];
  const hp = (r.hp / s.maxHp) * 100;
  return `<div class="mc" style="--c:${c.color}"><img src="${faceUrl(c.sprite)}" alt=""><div class="mi"><div class="mn">${esc(c.name)} <small>Lv ${r.lv}</small></div><div class="ms">${esc(c.title)}</div>
    ${bar('hp' + (hp < 30 ? ' low' : ''), hp)}<div class="mnum"><b>${r.hp}</b>/${s.maxHp} HP</div>${bar('mp', (r.mp / s.maxMp) * 100)}<div class="mnum">${r.mp}/${s.maxMp} MP</div>${extra}</div></div>`;
};

export class Menus {
  constructor(G) { this.G = G; }

  // =============================================================== pause menu
  async open() {
    const G = this.G;
    G.paused = true;
    audio.sfx('ui', { vol: 0.5 });
    const el = overlay();
    let last = 0;
    for (;;) {
      el.innerHTML = `<div class="mhead panel"><span>${esc(G.field.def?.name || '')}</span><span>◆ ${state.gold} G</span><span>⏱ ${fmtTime(state.play)}</span></div>
        <div class="mbody"><div class="mleft panel"></div><div class="mright"></div></div>`;
      const left = el.querySelector('.mleft'), right = el.querySelector('.mright');
      right.innerHTML = state.party.slice(0, 4).map((id) => card(id)).join('');
      const opts = [['Party', 'party'], ['Items', 'items'], ['Equipment', 'equip'], ['Status & Skills', 'status'], ['Save', 'save'], ['Settings', 'settings'], ['Quit to Title', 'quit']];
      const rows = opts.map(([t]) => { const r = h('div', 'row', esc(t)); left.appendChild(r); return r; });
      const i = await pick(rows, { start: last });
      if (i === null) break;
      last = i;
      const k = opts[i][1];
      if (k === 'party') await this.partyMenu(el);
      else if (k === 'items') await this.itemsMenu(el);
      else if (k === 'equip') await this.equipMenu(el);
      else if (k === 'status') await this.statusMenu(el);
      else if (k === 'save') await this.saveMenu(el);
      else if (k === 'settings') await this.settingsMenu(el);
      else if (k === 'quit') { if (await this.confirm(el, 'Return to the title screen? Unsaved progress will be lost.')) { el.remove(); G.paused = false; await G.toTitle(); return; } }
    }
    el.remove();
    G.paused = false;
  }
  async confirm(el, text) {
    const r = el.querySelector('.mright');
    r.innerHTML = `<div class="panel cpanel"><div class="ctext">${esc(text)}</div><div class="list"></div></div>`;
    const rows = ['Yes', 'No'].map((t) => { const x = h('div', 'row', t); r.querySelector('.list').appendChild(x); return x; });
    return (await pick(rows, { start: 1 })) === 0;
  }
  async chooseMember(el, title, ids = state.party.slice(0, 4)) {
    const right = el.querySelector('.mright');
    right.innerHTML = `<div class="ptitle">${esc(title)}</div><div class="plist"></div>`;
    const lst = right.querySelector('.plist');
    const rows = ids.map((id) => { const d = h('div', 'row mrow'); d.innerHTML = card(id); lst.appendChild(d); return d; });
    const i = await pick(rows);
    return i === null ? null : ids[i];
  }

  // =============================================================== party order
  async partyMenu(el) {
    const roster = Object.keys(state.roster);
    for (;;) {
      const a = await this.chooseMember(el, 'Select a member to swap (first = leader)', roster.filter((id) => true));
      if (!a) return;
      const b = await this.chooseMember(el, `Swap ${CHARS[a].name} with…`, roster.filter((id) => id !== a));
      if (!b) continue;
      const ia = state.party.indexOf(a), ib = state.party.indexOf(b);
      if (ia >= 0 && ib >= 0) { state.party[ia] = b; state.party[ib] = a; }
      else if (ia >= 0) state.party[ia] = b;
      else if (ib >= 0) state.party[ib] = a;
      else { toast('Pick at least one active member.'); continue; }
      state.party = state.party.filter((x, i) => state.party.indexOf(x) === i);
      this.G.field.buildParty(this.G.field.pos.x, this.G.field.pos.z, this.G.field.dir);
      toast('Party updated.', 'good'); audio.sfx('confirm', { vol: 0.5 });
      el.querySelector('.mright').innerHTML = state.party.slice(0, 4).map((id) => card(id)).join('');
    }
  }

  // =============================================================== items
  async itemsMenu(el) {
    const right = el.querySelector('.mright');
    for (;;) {
      const ids = Object.keys(state.inv).filter((id) => ITEMS[id]);
      right.innerHTML = `<div class="panel ipanel"><div class="ptitle">Items</div><div class="list"></div><div class="desc"></div></div>`;
      const lst = right.querySelector('.list'), desc = right.querySelector('.desc');
      if (!ids.length) { desc.textContent = 'You are carrying no items.'; await sleep(700); return; }
      const rows = ids.map((id) => { const it = ITEMS[id]; const r = h('div', 'row', `<span>${it.key ? '🗝 ' : ''}${esc(it.name)}</span><span class="r">×${count(id)}</span>`); if (it.key || it.battleOnly) r.classList.add('off'); lst.appendChild(r); return r; });
      const i = await pick(rows, { onFocus: (k) => (desc.textContent = ITEMS[ids[k]].desc) });
      if (i === null) return;
      const id = ids[i], it = ITEMS[id];
      const mode = it.kind === 'revive';
      const m = await this.chooseMember(el, `Use ${it.name} on…`);
      if (!m) continue;
      const r = state.roster[m], s = statsOf(m);
      let ok = false;
      if (it.kind === 'heal' && r.hp > 0 && r.hp < s.maxHp) { r.hp = Math.min(s.maxHp, r.hp + it.amount); ok = true; }
      else if (it.kind === 'mp' && r.hp > 0 && r.mp < s.maxMp) { r.mp = Math.min(s.maxMp, r.mp + it.amount); ok = true; }
      else if (it.kind === 'both' && r.hp > 0) { r.hp = s.maxHp; r.mp = s.maxMp; ok = true; }
      else if (it.kind === 'revive' && r.hp <= 0) { r.hp = Math.max(1, Math.round(s.maxHp * it.amount)); ok = true; }
      if (ok) { addItem(id, -1); audio.sfx('revive', { vol: 0.6 }); } else audio.sfx('hurt', { vol: 0.3 });
    }
  }

  // =============================================================== equipment
  async equipMenu(el) {
    const right = el.querySelector('.mright');
    for (;;) {
      const id = await this.chooseMember(el, 'Equipment — choose a member', Object.keys(state.roster));
      if (!id) return;
      let slotIdx = 0;
      for (;;) {
        const r = state.roster[id];
        const slots = [['weapon', 'Weapon'], ['armor', 'Armor'], ['charm', 'Charm']];
        const cur = statsOf(id);
        right.innerHTML = `<div class="panel epanel"><div class="ehead"><img src="${faceUrl(CHARS[id].sprite)}" alt=""><div><div class="ptitle">${esc(CHARS[id].name)} <small>Lv ${r.lv}</small></div></div></div>
          <div class="estats">${STAT_NAMES.map(([k, n]) => `<div><span>${n}</span><b>${cur[k]}</b></div>`).join('')}</div><div class="list"></div><div class="desc"></div></div>`;
        const lst = right.querySelector('.list'), desc = right.querySelector('.desc');
        const rows = slots.map(([k, n]) => { const e = EQUIP[r.equip[k]]; const row = h('div', 'row', `<span class="slot">${n}</span><span>${e ? esc(e.name) : '— none —'}</span>`); lst.appendChild(row); return row; });
        const i = await pick(rows, { start: slotIdx, onFocus: (k) => { const e = EQUIP[r.equip[slots[k][0]]]; desc.textContent = e ? `${e.desc}  ${this.statStr(e.stats)}` : 'Nothing equipped.'; } });
        if (i === null) break;
        slotIdx = i;
        await this.pickEquip(el, id, slots[i][0]);
      }
    }
  }
  statStr(stats) { return Object.entries(stats).map(([k, v]) => `${{ hp: 'HP', mp: 'MP', atk: 'ATK', def: 'DEF', mag: 'MAG', res: 'RES', spd: 'SPD' }[k]} ${v > 0 ? '+' : ''}${v}`).join('  '); }
  async pickEquip(el, id, slot) {
    const right = el.querySelector('.mright');
    const r = state.roster[id];
    const cands = Object.keys(state.inv).filter((k) => EQUIP[k] && EQUIP[k].slot === slot && canEquip(id, k));
    right.innerHTML = `<div class="panel ipanel"><div class="ptitle">${slot.toUpperCase()}</div><div class="list"></div><div class="desc"></div></div>`;
    const lst = right.querySelector('.list'), desc = right.querySelector('.desc');
    const entries = [{ id: null, name: '— remove —', e: null }, ...cands.map((k) => ({ id: k, name: EQUIP[k].name, e: EQUIP[k] }))];
    const base = statsOf(id);
    const rows = entries.map((en) => { const row = h('div', 'row', `<span>${esc(en.name)}</span><span class="r">${en.id ? '×' + count(en.id) : ''}</span>`); lst.appendChild(row); return row; });
    const diff = (en) => {
      const cur = r.equip[slot]; const save = r.equip[slot];
      r.equip[slot] = en.id; const after = statsOf(id); r.equip[slot] = save;
      return STAT_NAMES.map(([k, n]) => { const d = after[k] - base[k]; return d ? `<span class="${d > 0 ? 'up' : 'dn'}">${n} ${d > 0 ? '+' : ''}${d}</span>` : ''; }).join(' ');
    };
    const i = await pick(rows, { onFocus: (k) => { const en = entries[k]; desc.innerHTML = `${en.e ? esc(en.e.desc) + '<br>' : ''}${diff(en)}`; } });
    if (i === null) return;
    equip(id, slot, entries[i].id);
    audio.sfx('confirm', { vol: 0.5 });
  }

  // =============================================================== status & skills
  async statusMenu(el) {
    const right = el.querySelector('.mright');
    for (;;) {
      const id = await this.chooseMember(el, 'Status — choose a member', Object.keys(state.roster));
      if (!id) return;
      const c = CHARS[id], r = state.roster[id], s = statsOf(id);
      const known = learned(id);
      right.innerHTML = `<div class="panel spanel"><div class="shead"><img src="${spriteUrl(c.sprite)}" alt=""><div><div class="ptitle">${esc(c.name)} <small>${esc(c.title)}</small></div><div class="bio">${esc(c.bio)}</div>
        <div class="xp">Lv ${r.lv} · EXP ${r.exp}/${expNeed(r.lv)}${bar('xp', (r.exp / expNeed(r.lv)) * 100)}</div></div></div>
        <div class="estats">${STAT_NAMES.map(([k, n]) => `<div><span>${n}</span><b>${s[k]}</b></div>`).join('')}</div>
        <div class="sklist">${c.learn.map(([lv, sk]) => { const S = SKILLS[sk]; const ok = known.includes(sk); return `<div class="sk${ok ? '' : ' lock'}"><b>${esc(S.name)}</b> <span style="color:${ELEMENTS[S.el].color}">${S.el !== 'none' ? '●' : ''}</span> <small>${ok ? S.mp + ' MP' : 'Lv ' + lv}</small><div>${esc(S.desc)}</div></div>`; }).join('')}
        <div class="sk"><b>★ ${esc(SKILLS[c.burst].name)}</b> <small>Star Burst</small><div>${esc(SKILLS[c.burst].desc)}</div></div></div></div>`;
      await new Promise((res) => { const off = input.push((a) => { if (a === 'cancel' || a === 'menu' || a === 'ok') { off(); res(); } return true; }); });
    }
  }

  // =============================================================== save / load
  async saveMenu(el, { onlyLoad = false } = {}) {
    const right = el.querySelector('.mright');
    right.innerHTML = `<div class="panel ipanel"><div class="ptitle">${onlyLoad ? 'Load' : 'Save'}</div><div class="list"></div></div>`;
    const lst = right.querySelector('.list');
    const rows = [0, 1, 2].map((n) => {
      const s = slotInfo(n);
      const r = h('div', 'row slotrow', s ? `<b>Slot ${n + 1}</b><span>${esc(s.label || '')}</span><span class="r">Lv ${s.lv} · ${fmtTime(s.play)} · ${new Date(s.at).toLocaleDateString()}</span>` : `<b>Slot ${n + 1}</b><span class="dim">— empty —</span>`);
      if (onlyLoad && !s) r.classList.add('off');
      lst.appendChild(r); return r;
    });
    const i = await pick(rows);
    if (i === null) return null;
    if (onlyLoad) return i;
    this.G.syncMap();
    if (saveSlot(i, this.G.field.def?.name)) { toast(`Saved to slot ${i + 1}`, 'good'); audio.jingle('discover'); } else toast('Could not save (storage blocked?)');
    return i;
  }

  // =============================================================== settings
  async settingsMenu(el) {
    const G = this.G;
    const right = el.querySelector('.mright');
    const defs = [
      { k: 'master', n: 'Master volume', get: () => audio.vol.master, set: (v) => audio.setVol('master', v), step: 0.1, fmt: (v) => Math.round(v * 100) + '%' },
      { k: 'music', n: 'Music volume', get: () => audio.vol.music, set: (v) => audio.setVol('music', v), step: 0.1, fmt: (v) => Math.round(v * 100) + '%' },
      { k: 'sfx', n: 'Effects volume', get: () => audio.vol.sfx, set: (v) => audio.setVol('sfx', v), step: 0.1, fmt: (v) => Math.round(v * 100) + '%' },
      { k: 'quality', n: 'Graphics', opts: ['high', 'medium', 'low'], get: () => G.gfx.quality, set: (v) => { G.gfx.setQuality(v); G.saveSettings(); } },
      { k: 'diff', n: 'Difficulty', opts: ['easy', 'normal', 'hard'], get: () => ({ 0.8: 'easy', 1: 'normal', 1.25: 'hard' }[G.difficulty] || 'normal'), set: (v) => { G.difficulty = { easy: 0.8, normal: 1, hard: 1.25 }[v]; G.saveSettings(); } },
      { k: 'text', n: 'Text speed', opts: ['slow', 'normal', 'fast'], get: () => ({ 28: 'slow', 46: 'normal', 90: 'fast' }[G.ui.dialogue.speed] || 'normal'), set: (v) => { G.ui.dialogue.speed = { slow: 28, normal: 46, fast: 90 }[v]; G.saveSettings(); } },
    ];
    let start = 0;
    for (;;) {
      right.innerHTML = `<div class="panel ipanel"><div class="ptitle">Settings</div><div class="list"></div><div class="desc">◀ ▶ to change · Esc to go back</div></div>`;
      const lst = right.querySelector('.list');
      const rows = defs.map((d) => { const v = d.get(); const r = h('div', 'row', `<span>${d.n}</span><span class="r">◀ ${d.fmt ? d.fmt(v) : v} ▶</span>`); lst.appendChild(r); return r; });
      let idx = start;
      const i = await new Promise((res) => {
        const p = pick(rows, { start, onFocus: (k) => (idx = k), onSide: (dir) => {
          const d = defs[idx];
          if (d.opts) { const j = (d.opts.indexOf(d.get()) + dir + d.opts.length) % d.opts.length; d.set(d.opts[j]); }
          else d.set(Math.max(0, Math.min(1, +(d.get() + dir * d.step).toFixed(2))));
          audio.sfx('ui', { vol: 0.4 });
          rows[idx].querySelector('.r').textContent = `◀ ${d.fmt ? d.fmt(d.get()) : d.get()} ▶`;
        } });
        p.then(res);
      });
      if (i === null) { G.saveSettings(); return; }
    }
  }

  // =============================================================== shop & inn
  async shop(stock, { name = 'Shop' } = {}) {
    const G = this.G;
    const el = overlay('shop');
    G.paused = true;
    let mode = 'buy';
    el.innerHTML = `<div class="mhead panel"><span>${esc(name)}</span><span class="gold">◆ ${state.gold} G</span></div><div class="mbody"><div class="mleft panel shopl"></div><div class="mright"></div></div>`;
    const left = el.querySelector('.mleft'), right = el.querySelector('.mright');
    const updGold = () => (el.querySelector('.gold').textContent = `◆ ${state.gold} G`);
    for (;;) {
      left.innerHTML = '';
      const tabs = h('div', 'tabs', `<span class="${mode === 'buy' ? 'on' : ''}">BUY</span><span class="${mode === 'sell' ? 'on' : ''}">SELL</span>`);
      left.appendChild(tabs);
      const list = mode === 'buy' ? stock.slice() : Object.keys(state.inv).filter((id) => itemInfo(id) && !itemInfo(id).key && itemInfo(id).price !== 0 && itemInfo(id).price !== undefined);
      right.innerHTML = `<div class="panel ipanel"><div class="desc dd"></div></div>`;
      const desc = right.querySelector('.dd');
      const rows = list.map((id) => {
        const it = itemInfo(id);
        const price = mode === 'buy' ? it.price : Math.floor(it.price / 2);
        const r = h('div', 'row', `<span>${esc(it.name)}</span><span class="r">${mode === 'buy' ? '' : '×' + count(id) + '  '}${price} G${mode === 'buy' && count(id) ? '  (own ' + count(id) + ')' : ''}</span>`);
        if (mode === 'buy' && state.gold < price) r.classList.add('off');
        left.appendChild(r); return r;
      });
      if (!rows.length) { desc.textContent = mode === 'sell' ? 'Nothing to sell.' : ''; }
      const i = await pick(rows, { cancelable: true, sideExit: true,
        onFocus: (k) => { if (!list[k]) return; const it = itemInfo(list[k]); desc.innerHTML = `${esc(it.desc)}${it.slot ? '<br>' + this.statStr(it.stats) + (it.for ? '<br><small>Equippable by: ' + it.for.map((f) => CHARS[f].name).join(', ') + '</small>' : '<br><small>Equippable by anyone</small>') : ''}`; } });
      if (i === null) break;
      if (typeof i === 'object') { mode = mode === 'buy' ? 'sell' : 'buy'; continue; }
      const id = list[i], it = itemInfo(id);
      if (mode === 'buy') { if (state.gold >= it.price) { state.gold -= it.price; addItem(id, 1); audio.sfx('coin', { vol: 0.7 }); } }
      else { state.gold += Math.floor(it.price / 2); addItem(id, -1); audio.sfx('coin', { vol: 0.7, rate: 0.8 }); }
      updGold();
    }
    el.remove(); G.paused = false;
  }
}
