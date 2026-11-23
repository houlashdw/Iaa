// Combat HUD (DOM): party cards, hotbar with cooldowns, star gauge, boss bar, enemy bars, damage numbers.
import * as THREE from 'three';
import { h, root, esc, bar } from '../ui/ui.js';
import { ptImg } from '../ui/portraits.js';
import { STATUS } from '../data/skills.js';
import { CHARS } from '../data/characters.js';
import { hotbar } from './moves.js';
import { SKILLS } from '../data/skills.js';
import { sleep } from '../core/util.js';

const GLYPH = { slash: '⚔', impact: '✊', arrow: '➶', light: '✦', fire: '♨', ice: '❄', thunder: 'ϟ', dark: '☾', heal: '✚', buff: '▲', debuff: '▼' };
const v3 = new THREE.Vector3();

export class Hud {
  constructor(combat) {
    this.cb = combat;
    this.el = h('div', 'hud hidden');
    this.el.innerHTML = `
      <div class="bt-boss hidden"><div class="bn"></div>${bar('boss', 100)}</div>
      <div class="bt-star"><span class="lbl">STAR</span><div class="sbar"><div class="sfill"></div></div><span class="sready">BURST READY · R</span></div>
      <div class="bt-msg hidden"></div>
      <div class="bt-pops"></div><div class="bt-ebars"></div>
      <div class="bt-party panel"></div>
      <div class="hud-skills"></div>
      <div class="hud-hint"></div>`;
    root.appendChild(this.el);
    this.q = (s) => this.el.querySelector(s);
    this.partyKey = ''; this.skillKey = '';
    this.cards = []; this.slots = [];
    this.ebars = new Map();
    this.shown = false;
    this.el.querySelector('.hud-skills').addEventListener('pointerdown', (e) => {
      const s = e.target.closest('.sk'); if (!s) return;
      e.preventDefault();
      const a = s.dataset.a; if (a) this.cb.onAction(a);
    });
    this.el.querySelector('.bt-party').addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.pm'); if (!c) return;
      e.preventDefault(); this.cb.F.setControlled(Number(c.dataset.i)); this.cb.onSwitched();
    });
  }
  show(v) { if (v !== this.shown) { this.shown = v; this.el.classList.toggle('hidden', !v); } }

  // ---------------------------------------------------------------- party cards
  buildParty() {
    const cb = this.cb, box = this.q('.bt-party');
    this.partyKey = cb.party.map((p) => p.id + p.lv).join(',');
    box.innerHTML = cb.party.map((p, i) => `<div class="pm" data-i="${i}" style="--c:${p.color}">${ptImg(CHARS[p.id].sprite, 'face')}
      <div class="pi"><div class="pn">${esc(p.name)} <small>Lv ${p.lv}</small> <span class="st"></span><kbd>${i + 1 <= 4 ? '' : ''}</kbd></div>
      ${bar('hp', 100)}<div class="num"><b></b></div>${bar('mp', 100)}</div></div>`).join('');
    this.cards = [...box.querySelectorAll('.pm')].map((el) => ({ el, hp: el.querySelector('.bar.hp .fill'), mp: el.querySelector('.bar.mp .fill'), num: el.querySelector('.num b'), st: el.querySelector('.st'), hpBar: el.querySelector('.bar.hp'), last: '' }));
  }
  syncParty() {
    const cb = this.cb;
    if (cb.party.map((p) => p.id + p.lv).join(',') !== this.partyKey) this.buildParty();
    cb.party.forEach((p, i) => {
      const c = this.cards[i]; if (!c) return;
      const pct = (p.hp / p.maxHp) * 100;
      const sig = `${Math.round(p.hp)}|${Math.round(p.mp)}|${p.maxHp}|${p.alive}|${cb.ctrl === p}|${Object.keys(p.status).join('')}`;
      if (sig === c.last) return;
      c.last = sig;
      c.hp.style.width = pct + '%'; c.mp.style.width = (p.mp / p.maxMp) * 100 + '%';
      c.num.textContent = `${Math.max(0, Math.round(p.hp))}/${p.maxHp}`;
      c.hpBar.classList.toggle('low', pct < 30);
      c.el.classList.toggle('cur', cb.ctrl === p); c.el.classList.toggle('ko', !p.alive);
      c.st.innerHTML = Object.keys(p.status).filter((k) => STATUS[k]).map((k) => `<span style="color:${STATUS[k].color}" title="${STATUS[k].name}">${STATUS[k].icon}</span>`).join('');
    });
  }

  // ---------------------------------------------------------------- hotbar
  syncSkills() {
    const cb = this.cb, p = cb.ctrl;
    if (!p) return;
    const hb = hotbar(p.id);
    const key = p.id + '|' + hb.map((b) => (b.locked ? 'x' : 'o')).join('') + '|' + p.lv + '|' + (cb.autoLeader ? 'A' : '');
    const box = this.q('.hud-skills');
    if (key !== this.skillKey) {
      this.skillKey = key;
      const mk = (a, k, name, glyph, extra = '', cls = '') => `<div class="sk ${cls}" data-a="${a}"><b>${k}</b><i class="ic">${glyph}</i><span class="nm">${esc(name)}</span>${extra}<div class="cd"></div></div>`;
      box.innerHTML = mk('attack', 'LMB', 'Attack', '⚔', '', 'atk') +
        hb.map((s, i) => {
          if (s.locked) return `<div class="sk locked"><b>${i + 1}</b><i class="ic">🔒</i><span class="nm">Lv ${s.lv}</span></div>`;
          const sk = SKILLS[s.id];
          return mk('skill' + (i + 1), i + 1, sk.name, GLYPH[sk.kind === 'heal' ? 'heal' : sk.kind === 'buff' ? 'buff' : sk.kind === 'debuff' ? 'debuff' : sk.fx] || '✦', `<em>${sk.mp}</em>`);
        }).join('') + mk('dodge', 'Space', 'Dodge', '⤼', '', 'dodge') + mk('burst', 'R', 'Burst', '★', '', 'burst');
      this.slots = [...box.querySelectorAll('.sk')].map((el) => ({ el, a: el.dataset.a, cd: el.querySelector('.cd') }));
      this.tbtn = {}; document.querySelectorAll('#touch [data-a^=skill],#touch .tbburst').forEach((b) => (this.tbtn[b.dataset.a] = b));
      hb.forEach((sk2, i) => { const b = this.tbtn['skill' + (i + 1)]; if (!b) return; const u = b.querySelector('u'); if (sk2.locked) { u.textContent = '🔒'; b.classList.add('locked'); } else { b.classList.remove('locked'); const sd = SKILLS[sk2.id]; u.textContent = GLYPH[sd.kind === 'heal' ? 'heal' : sd.kind === 'buff' ? 'buff' : sd.kind === 'debuff' ? 'debuff' : sd.fx] || '✦'; } });
    }
    for (const s of this.slots) {
      if (!s.a) continue;
      let k = 0, off = false;
      if (s.a.startsWith('skill')) {
        const i = Number(s.a.slice(5)) - 1; const sid = hb[i] && hb[i].id;
        k = sid ? cb.cdFrac(p, sid) : 0; off = !!sid && p.mp < SKILLS[sid].mp;
      } else if (s.a === 'dodge') k = Math.min(1, Math.max(0, p.dodgeCd / 0.7));
      else if (s.a === 'burst') { k = cb.star >= 100 ? 0 : 1 - cb.star / 100; s.el.classList.toggle('ready', cb.star >= 100); }
      s.cd.style.transform = `scaleY(${k})`;
      s.el.classList.toggle('off', off);
      const tb = this.tbtn && this.tbtn[s.a];
      if (tb) { tb.style.setProperty('--cd', k); tb.classList.toggle('off', off); if (s.a === 'burst') tb.classList.toggle('ready', cb.star >= 100); }
    }
    this.q('.bt-star .sfill').style.width = cb.star + '%';
    this.q('.bt-star').classList.toggle('ready', cb.star >= 100);
  }

  // ---------------------------------------------------------------- floating things
  popup(c, text, cls = '', tag = '') {
    if (!this.shown && !this.cb.scripted) return;
    const d = h('div', 'pop ' + cls, `${esc(text)}${tag ? `<small>${tag}</small>` : ''}`);
    const pp = c.actor.position;
    const p = this.cb.G.gfx.project(v3.set(pp.x, c.height * 0.85, pp.z));
    if (p.z > 1) return;
    d.style.left = p.x + (Math.random() - 0.5) * 40 + 'px'; d.style.top = p.y + 'px';
    this.q('.bt-pops').appendChild(d);
    setTimeout(() => d.remove(), 950);
  }
  syncEnemies() {
    const cb = this.cb, G = cb.G, boss = cb.bossEnt();
    const bb = this.q('.bt-boss');
    if (boss) { bb.classList.remove('hidden'); bb.querySelector('.bn').textContent = boss.name; bb.querySelector('.fill').style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + '%'; } else bb.classList.add('hidden');
    for (const e of cb.mobs) {
      let b = this.ebars.get(e);
      if (!e.alive || e.boss || !e.engaged) { if (b) { b.remove(); this.ebars.delete(e); } continue; }
      if (!b) { b = h('div', 'ebar show', `<div class="en">${esc(e.name)}</div>${bar('hp', 100)}<div class="est"></div>`); this.q('.bt-ebars').appendChild(b); this.ebars.set(e, b); }
      const pp = e.actor.position;
      const p = G.gfx.project(v3.set(pp.x, e.height + 0.2, pp.z));
      b.style.display = p.z > 1 ? 'none' : '';
      b.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
      const pct = (e.hp / e.maxHp) * 100;
      b.querySelector('.fill').style.width = pct + '%';
      b.querySelector('.bar').classList.toggle('low', pct < 30);
      b.querySelector('.est').textContent = Object.keys(e.status).filter((k) => STATUS[k]).map((k) => STATUS[k].icon).join(' ');
    }
    for (const [e, b] of this.ebars) if (!cb.mobs.includes(e)) { b.remove(); this.ebars.delete(e); }
  }
  clearEnemyBars() { for (const b of this.ebars.values()) b.remove(); this.ebars.clear(); }
  async msg(text, ms = 900, color = '#fff') {
    const m = this.q('.bt-msg');
    m.textContent = text; m.style.color = color; m.classList.remove('hidden');
    await sleep(ms);
    m.classList.add('hidden');
  }
  hint(text) { this.q('.hud-hint').textContent = text || ''; }
}
