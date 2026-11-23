// Turn-based battle scene: 3D stage + DOM interface. Rules live in core.js.
import * as THREE from 'three';
import { World } from '../world/world.js';
import { Actor } from '../world/actors.js';
import { FX } from './fx.js';
import { STAGES } from '../data/stages.js';
import { SKILLS, ELEMENTS, STATUS } from '../data/skills.js';
import { ITEMS, itemInfo } from '../data/items.js';
import { CHARS } from '../data/characters.js';
import { state, statsOf, gainExp, addItem, count, loadSlot, lastSlot } from '../state.js';
import { loadSprite, faceUrl, spriteUrl } from '../core/assets.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { sleep, tween, easeOut, easeInOut, rand } from '../core/util.js';
import { h, root, esc, bar, pick } from '../ui/ui.js';
import { partyCombatant, enemyCombatant, computeHit, computeHeal, applyStatus, startTurn, endTurn, turnOrder, alive, aiPlan, rewards, lowestHp } from './core.js';

const PARTY_SLOTS = [[19.4, 11.8], [20.8, 13.6], [19.4, 15.4], [20.8, 17.2]];
const ENEMY_SLOTS = {
  1: [[12.4, 14.0]],
  2: [[12.8, 12.6], [12.8, 15.4]],
  3: [[13.4, 11.4], [11.9, 14.0], [13.4, 16.6]],
  4: [[13.6, 11.0], [12.1, 12.9], [12.1, 15.3], [13.6, 17.2]],
  5: [[13.8, 10.8], [12.3, 12.5], [10.8, 14.2], [12.3, 16.0], [13.8, 17.6]],
};

export class Battle {
  constructor(G) {
    this.G = G;
    this.world = new World(G.gfx);
    this.world.pitch = 0.4; this.world.dist = 15.5;
    this.fx = new FX(this.world);
    this.active = false;
    this.party = []; this.enemies = [];
    this.el = h('div', 'bt hidden');
    this.el.innerHTML = `
      <div class="bt-top"><div class="bt-turns"></div><div class="bt-star"><span class="lbl">STAR</span><div class="sbar"><div class="sfill"></div></div><span class="sready">BURST READY</span></div></div>
      <div class="bt-msg hidden"></div>
      <div class="bt-boss hidden"><div class="bn"></div>${bar('boss', 100)}</div>
      <div class="bt-pops"></div><div class="bt-marks"></div><div class="bt-ebars"></div>
      <div class="bt-cmd panel hidden"></div>
      <div class="bt-party panel"></div>`;
    root.appendChild(this.el);
    this.q = (s) => this.el.querySelector(s);
  }

  // ====================================================================== setup
  async run(opts) {
    const G = this.G;
    this.opts = { canFlee: true, stage: 'field', music: 'battle_theme_a', events: [], ...opts };
    this.fled = false; this.round = 0; this.star = 0; this.eventsDone = new Set();
    this.snapshot = JSON.parse(JSON.stringify(state.roster));
    this.snapInv = { ...state.inv }; // "Try again" gives back anything used during a lost attempt
    this.party = state.party.slice(0, 4).map(partyCombatant);
    this.enemies = this.opts.enemies.map((e, i) => enemyCombatant(e, i));
    if (G.cheat) { if (G.cheat.hp) for (const e of this.enemies) e.maxHp = e.hp = Math.min(e.hp, G.cheat.hp); if (G.cheat.atk) for (const p of this.party) { p.atk *= G.cheat.atk; p.mag *= G.cheat.atk; } }
    const diff = G.difficulty || 1;
    if (diff !== 1) for (const e of this.enemies) { e.maxHp = e.hp = Math.round(e.hp * diff); e.atk = Math.round(e.atk * (0.85 + diff * 0.15)); e.mag = Math.round(e.mag * (0.85 + diff * 0.15)); }
    this.active = true;
    await G.battleTransition(async () => {
      await this.buildStage();
      G.gfx.setScene(this.world.scene, this.world.camera);
    });
    audio.playMusic(this.opts.music);
    this.el.classList.remove('hidden');
    this.refreshParty(); this.updateTurnBar([]);
    await this.intro();
    await this.runEvents('start');
    let result = await this.loop();
    if (result === 'victory') await this.victory();
    else if (result === 'defeat') {
      const again = await this.defeat();
      if (again === 'retry') { await this.teardown(false); return this.run(opts); }
    }
    await this.teardown(true);
    return result;
  }
  async buildStage() {
    const st = STAGES[this.opts.stage] || STAGES.field;
    const w = this.world;
    // clear previous actors / fx
    for (const c of [...this.party, ...this.enemies]) if (c.actor) w.remove(c.actor.group);
    await w.load({ ...st, size: st.size, build: st.build });
    w.setFocus(new THREE.Vector3(16.2, 0, 14.0), true);
    w.pitch = 0.4; w.dist = 15.5;
    this.fx = new FX(w);
    await Promise.all(this.enemies.map((e) => loadSprite(e.sprite + '_fl')));
    const slots = ENEMY_SLOTS[Math.min(5, this.enemies.length)];
    this.enemies.forEach((e, i) => {
      const a = new Actor({ height: e.height, tex: { front: e.sprite + '_fl' }, tint: w.mood.sprite });
      a.setFlip(-1);
      e.home = { x: slots[i][0], z: slots[i][1] };
      a.position.set(e.home.x - 8, 0, e.home.z);
      w.add(a.group); e.actor = a;
    });
    this.party.forEach((p, i) => {
      const a = new Actor({ height: p.height, tex: { front: p.sprite + '_fl' }, tint: w.mood.sprite });
      p.home = { x: PARTY_SLOTS[i][0], z: PARTY_SLOTS[i][1] };
      a.position.set(p.home.x + 8, 0, p.home.z);
      w.add(a.group); p.actor = a;
      if (!p.alive) this.fall(p, true);
    });
    // enemy hp bars
    const eb = this.q('.bt-ebars'); eb.innerHTML = '';
    this.enemies.forEach((e) => {
      const d = h('div', 'ebar' + (e.boss ? ' isboss' : ''), `<div class="en">${esc(e.name)}</div>${bar('hp', 100)}<div class="est"></div>`);
      eb.appendChild(d); e.bar = d;
    });
    this.q('.bt-pops').innerHTML = ''; this.q('.bt-marks').innerHTML = '';
  }
  async intro() {
    const G = this.G;
    G.gfx.setFadeColor(0xffffff);
    const boss = this.enemies.find((e) => e.boss);
    this.world.shake = 0.1;
    await tween(650, (t) => {
      const k = easeOut(t);
      for (const e of this.enemies) e.actor.position.x = e.home.x - 8 * (1 - k);
      for (const p of this.party) p.actor.position.x = p.home.x + 8 * (1 - k);
      G.gfx.fade = Math.max(0, 0.9 * (1 - t * 1.6));
    });
    G.gfx.fade = 0;
    G.gfx.setFadeColor(0x000000);
    if (boss) { audio.sfx('boss', { vol: 0.8 }); await this.msg(`— ${boss.name} —`, 1500); }
    else { const names = {}; this.enemies.forEach((e) => (names[e.name] = (names[e.name] || 0) + 1)); await this.msg(Object.entries(names).map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(',  ') + ' appear!', 1200); }
  }
  async teardown(restoreField) {
    const G = this.G;
    this.hideCmd(); this.clearMarks();
    this.q('.bt-boss').classList.add('hidden');
    if (restoreField) {
      // sync HP/MP back; KO'd members wake with 1 HP
      for (const p of this.party) { const r = state.roster[p.id]; r.hp = Math.max(1, Math.min(p.hp, statsOf(p.id).maxHp)); r.mp = Math.min(p.mp, statsOf(p.id).maxMp); }
      state.battles++;
      await G.fadeTo(1, 350);
      this.el.classList.add('hidden');
      this.active = false;
      for (const c of [...this.party, ...this.enemies]) if (c.actor) this.world.remove(c.actor.group);
      G.gfx.setScene(G.field.world.scene, G.field.world.camera);
      audio.playMusic(G.field.def?.music ?? null);
      await G.fadeTo(0, 400);
    } else {
      for (const c of [...this.party, ...this.enemies]) if (c.actor) this.world.remove(c.actor.group);
      state.roster = JSON.parse(JSON.stringify(this.snapshot));
      state.inv = { ...this.snapInv };
    }
  }

  // ====================================================================== main loop
  over() {
    if (!alive(this.party).length) return 'defeat';
    if (!alive(this.enemies).length) return 'victory';
    return null;
  }
  async loop() {
    for (;;) {
      this.round++;
      const order = turnOrder([...this.party, ...this.enemies]);
      for (let i = 0; i < order.length; i++) {
        const c = order[i];
        if (!c.alive) continue;
        if (this.over() || this.fled) break;
        this.updateTurnBar(order.slice(i));
        await this.turn(c);
        await this.checkEvents();
        if (this.over() || this.fled) break;
      }
      if (this.fled) return 'fled';
      const o = this.over();
      if (o) return o;
      await this.runEvents('round');
    }
  }
  async turn(c) {
    this.cur = c; this.refreshParty();
    c.actor.hop = 0;
    const st = startTurn(c);
    if (st.poison) { await this.damageRaw(c, st.poison, 'poison'); if (!c.alive) { this.cur = null; return; } }
    if (st.regen) { c.hp = Math.min(c.maxHp, c.hp + st.regen); this.popup(c, '+' + st.regen, 'heal'); this.syncBars(); }
    if (st.skip) { this.popup(c, 'Stunned!', 'status'); audio.sfx('hurt', { vol: 0.3 }); await sleep(600); endTurn(c); this.cur = null; this.refreshParty(); return; }
    if (c.side === 'party') c.actor.hop = 0.18;
    let plan;
    if (c.side === 'party') plan = await this.commandPhase(c);
    else { await sleep(250); plan = aiPlan(c, this.enemies, this.party); plan.kind = plan.skill ? 'skill' : 'attack'; }
    await this.execute(c, plan);
    endTurn(c);
    c.actor.hop = 0;
    this.cur = null; this.refreshParty();
    await sleep(130);
  }

  // ====================================================================== commands
  hideCmd() { this.q('.bt-cmd').classList.add('hidden'); }
  showCmd() { this.q('.bt-cmd').classList.remove('hidden'); return this.q('.bt-cmd'); }
  async commandPhase(c) {
    for (;;) {
      const box = this.showCmd();
      const rows = [['Attack', 'attack'], ['Skills', 'skill'], ['Items', 'item'], ['Guard', 'guard']];
      if (this.star >= 100) rows.splice(1, 0, ['★ Burst', 'burst']);
      rows.push(['Flee', 'flee']);
      box.innerHTML = `<div class="cmdname" style="color:${c.color}">${esc(c.name)}</div>`;
      const els = rows.map(([t, k]) => { const r = h('div', 'row' + (k === 'burst' ? ' burst' : ''), esc(t)); if (k === 'flee' && !this.opts.canFlee) r.classList.add('off'); box.appendChild(r); return r; });
      const i = await pick(els, { cancelable: false, start: this._lastCmd || 0 });
      const kind = rows[i][1];
      this._lastCmd = i;
      if (kind === 'attack') {
        const t = await this.selectTargets('enemy', c);
        if (!t) continue;
        this.hideCmd(); return { kind: 'attack', skill: null, targets: t };
      }
      if (kind === 'guard') { this.hideCmd(); return { kind: 'guard', targets: [c] }; }
      if (kind === 'flee') { this.hideCmd(); return { kind: 'flee', targets: [c] }; }
      if (kind === 'burst') {
        const sk = SKILLS[c.burst];
        const t = sk.revive ? this.party.slice() : await this.selectTargets(sk.target, c, sk);
        if (!t) continue;
        this.hideCmd(); return { kind: 'skill', skill: sk, targets: t, burst: true };
      }
      if (kind === 'skill') {
        const r = await this.skillMenu(c);
        if (r) { this.hideCmd(); return r; }
        continue;
      }
      if (kind === 'item') {
        const r = await this.itemMenu(c);
        if (r) { this.hideCmd(); return r; }
        continue;
      }
    }
  }
  async skillMenu(c) {
    for (;;) {
      const box = this.showCmd();
      const list = c.skills.map((id) => SKILLS[id]);
      box.innerHTML = `<div class="cmdname" style="color:${c.color}">Skills</div><div class="list"></div><div class="desc"></div>`;
      const lst = box.querySelector('.list'), desc = box.querySelector('.desc');
      const rows = list.map((s) => {
        const el = ELEMENTS[s.el];
        const r = h('div', 'row', `<span>${esc(s.name)}</span><span class="r"><span style="color:${el.color}">${s.el !== 'none' ? '●' : ''}</span> ${s.mp} MP</span>`);
        if (c.mp < s.mp) r.classList.add('off');
        lst.appendChild(r); return r;
      });
      const i = await pick(rows, { onFocus: (k) => (desc.textContent = list[k].desc), start: this._lastSkill || 0 });
      if (i === null) return null;
      this._lastSkill = i;
      const s = list[i];
      const t = await this.selectTargets(s.target, c, s);
      if (!t) continue;
      return { kind: 'skill', skill: s, targets: t };
    }
  }
  usableItems() {
    return Object.keys(state.inv).filter((id) => ITEMS[id] && !ITEMS[id].key && ['heal', 'mp', 'both', 'cure', 'revive', 'bomb', 'star'].includes(ITEMS[id].kind));
  }
  async itemMenu(c) {
    for (;;) {
      const box = this.showCmd();
      const ids = this.usableItems();
      box.innerHTML = `<div class="cmdname">Items</div><div class="list"></div><div class="desc"></div>`;
      const lst = box.querySelector('.list'), desc = box.querySelector('.desc');
      if (!ids.length) { desc.textContent = 'No usable items.'; await sleep(600); return null; }
      const rows = ids.map((id) => { const r = h('div', 'row', `<span>${esc(ITEMS[id].name)}</span><span class="r">×${count(id)}</span>`); lst.appendChild(r); return r; });
      const i = await pick(rows, { onFocus: (k) => (desc.textContent = ITEMS[ids[k]].desc) });
      if (i === null) return null;
      const it = ITEMS[ids[i]];
      const mode = it.kind === 'bomb' ? 'enemies' : it.kind === 'star' ? 'self' : it.kind === 'revive' ? 'fallen' : 'ally';
      const t = await this.selectTargets(mode, c);
      if (!t) continue;
      return { kind: 'item', item: ids[i], targets: t };
    }
  }
  /** Returns an array of combatants or null if cancelled. */
  selectTargets(mode, actor, skill) {
    if (mode === 'self') return Promise.resolve([actor]);
    if (mode === 'random') return Promise.resolve([alive(this.enemies)[0]]);
    const all = mode === 'enemies' || mode === 'allies';
    let cands = mode === 'enemy' || mode === 'enemies' ? alive(this.enemies) : mode === 'fallen' ? this.party.filter((p) => !p.alive) : alive(this.party);
    if (!cands.length) { audio.sfx('hurt', { vol: 0.3 }); return Promise.resolve(null); }
    cands = cands.slice().sort((a, b) => a.home.z - b.home.z);
    return new Promise((resolve) => {
      let idx = 0;
      const render = () => {
        const sel = all ? cands : [cands[idx]];
        this.setMarks(sel, all);
        this.q('.bt-msg').classList.add('hidden');
      };
      const off = input.push((a) => {
        if (a === 'up' || a === 'left') { if (!all) { idx = (idx - 1 + cands.length) % cands.length; audio.sfx('ui', { vol: 0.3 }); render(); } }
        else if (a === 'down' || a === 'right') { if (!all) { idx = (idx + 1) % cands.length; audio.sfx('ui', { vol: 0.3 }); render(); } }
        else if (a === 'ok') { off(); const r = all ? cands.slice() : [cands[idx]]; this.clearMarks(); audio.sfx('confirm', { vol: 0.5 }); resolve(r); }
        else if (a === 'cancel' || a === 'menu') { off(); this.clearMarks(); audio.sfx('ui', { vol: 0.3, rate: 0.8 }); resolve(null); }
        return true;
      });
      // mouse / touch: tap a marker target
      this._tapPick = (c) => { const k = cands.indexOf(c); if (k < 0) return; if (all || k === idx) { off(); this.clearMarks(); audio.sfx('confirm', { vol: 0.5 }); resolve(all ? cands.slice() : [c]); } else { idx = k; render(); } };
      this._tapOff = off;
      render();
    });
  }
  setMarks(list, all) {
    this.clearMarks();
    const m = this.q('.bt-marks');
    this.marks = list.map((c) => {
      const d = h('div', 'tmark', `<div class="arr">▼</div>${all && list.length > 1 ? '' : `<div class="tn">${esc(c.name)} <small>${Math.max(0, c.hp)}/${c.maxHp}</small></div>`}`);
      d.addEventListener('click', () => this._tapPick && this._tapPick(c));
      m.appendChild(d); return { c, d };
    });
    this.positionOverlays();
  }
  clearMarks() { this.q('.bt-marks').innerHTML = ''; this.marks = []; this._tapPick = null; }

  // ====================================================================== execution
  async execute(c, plan) {
    const kind = plan.kind;
    if (kind === 'guard') {
      c.status.guard = 1; c.mp = Math.min(c.maxMp, c.mp + Math.round(c.maxMp * 0.08));
      this.popup(c, 'Guard', 'status'); audio.sfx('confirm', { vol: 0.4, rate: 0.7 });
      this.fx.vring(this.pos(c), 0x9ad0ff, 500, 1.6, 0.7);
      await sleep(450); this.refreshParty(); return;
    }
    if (kind === 'flee') {
      const ok = this.opts.canFlee && Math.random() < 0.62;
      await this.msg(ok ? `${c.name} leads the escape!` : (this.opts.canFlee ? 'Couldn\'t get away!' : 'There\'s no escape from this fight!'), 900);
      if (ok) { this.fled = true; audio.sfx('dash', { vol: 0.7 }); this.party.forEach((p) => (p.actor.moving = true)); await tween(450, (t) => this.party.forEach((p) => (p.actor.position.x = p.home.x + 9 * t))); }
      return;
    }
    if (kind === 'item') return this.useItem(c, plan);
    return this.useSkill(c, plan.skill, plan.targets, plan);
  }
  pos(c, y = 1.0) { const p = c.actor.position; return new THREE.Vector3(p.x, y * (c.height / 1.9) + 0.2, p.z); }
  async lunge(c, t, ms = 200) {
    const a = c.actor, sx = a.position.x, sz = a.position.z;
    const dir = c.side === 'party' ? -1 : 1;
    const tz = t.actor.position.z + 0.15;
    const ex = t.actor.position.x + (c.side === 'party' ? 1.5 : -1.5) * (t.height > 2.2 ? 1.25 : 1);
    audio.sfx('dash', { vol: 0.25, rate: 1.2 });
    a.moving = true;
    await tween(ms, (k) => { const e = easeOut(k); a.position.x = sx + (ex - sx) * e; a.position.z = sz + (tz - sz) * e; });
    a.moving = false;
    return () => tween(ms * 1.1, (k) => { const e = easeInOut(k); a.position.x = ex + (c.home.x - ex) * e; a.position.z = tz + (c.home.z - tz) * e; });
  }
  async useSkill(c, sk, targets, plan = {}) {
    const melee = sk && (sk.fx === 'slash' || sk.fx === 'impact') && sk.kind === 'phys' && sk.target !== 'enemies' && sk.target !== 'random';
    if (sk) {
      await this.msg(sk.name, 700, c.side === 'party' ? '#ffe9a8' : '#ffb0b0');
      if (c.side === 'party') { c.mp -= sk.mp; this.addStar(4); this.refreshParty(); }
      if (plan.burst) { this.star = 0; this.updateStar(); await this.burstCutIn(c, sk); }
    } else await sleep(120);
    c.actor.hop = 0;
    let back = null;
    const first = targets[0];
    if (!sk || melee) {
      back = await this.lunge(c, first);
    } else {
      // cast pose: little hop + glow
      c.actor.flash = 0.5;
      this.fx.rise(this.pos(c, 0.2), sk.kind === 'heal' ? 0x9dffc0 : (ELEMENTS[sk.el]?.color ? new THREE.Color(ELEMENTS[sk.el].color).getHex() : 0xffffff), 8, 0.8, 0.07, 0.7);
      await tween(260, (k) => (c.actor.hop = Math.sin(k * Math.PI) * 0.35));
    }
    const kind = sk ? sk.kind : 'phys';
    if (kind === 'heal' || kind === 'cleanse' || kind === 'revive') await this.healEffect(c, sk, targets);
    else if (kind === 'buff') await this.buffEffect(c, sk, targets);
    else if (kind === 'debuff') await this.debuffEffect(c, sk, targets);
    else await this.damageEffect(c, sk, targets, plan);
    if (back) await back();
    if (plan.burst && sk.buff) for (const t of targets) for (const [k, v] of Object.entries(sk.buff)) applyStatus(t, k, v);
    this.refreshParty();
  }
  fxFor(sk, to, c) {
    const f = sk ? sk.fx : 'slash';
    const big = sk && sk.big;
    const from = this.pos(c, 1.1);
    switch (f) {
      case 'slash': return this.fx.slash(to, c.side === 'party' ? 0xfff2c0 : 0xffb8a0, big, (Math.random() - 0.5) * 1.6);
      case 'impact': return this.fx.impact(to, 0xffd9a0, big);
      case 'arrow': return this.fx.arrow(from, to, 0xffffff);
      case 'thunder': return this.fx.bolt(to, 0xffec6a, big);
      case 'fire': return this.fx.fire(to, big);
      case 'ice': return this.fx.ice(to, big);
      case 'light': return this.fx.light(to, big);
      case 'dark': return this.fx.dark(to, big);
      default: return this.fx.impact(to, 0xffffff, big);
    }
  }
  async damageEffect(c, sk, targets, plan) {
    const hits = sk ? sk.hits : 1;
    const multi = sk && (sk.target === 'enemies' || sk.target === 'allies');
    const rnd = sk && sk.target === 'random';
    const foes = c.side === 'party' ? this.enemies : this.party;
    for (let hi = 0; hi < hits; hi++) {
      let ts = targets;
      if (rnd) { const a = alive(foes); if (!a.length) break; ts = [a[Math.floor(Math.random() * a.length)]]; }
      else { ts = ts.filter((t) => t.alive); if (!ts.length) { const a = alive(foes); if (!a.length) break; ts = multi ? a : [a[Math.floor(Math.random() * a.length)]]; } }
      await Promise.all(ts.map(async (t, i) => {
        await sleep(multi ? i * 90 : 0);
        const to = this.pos(t, 1.0);
        const fxp = this.fxFor(sk, to, c);
        await sleep(sk && (sk.fx === 'thunder' || sk.fx === 'ice' || sk.fx === 'dark') ? 220 : 90);
        await this.hit(c, t, sk, hi);
        await fxp;
      }));
      if (hits > 1) await sleep(sk && sk.burst ? 90 : 150);
    }
  }
  async hit(c, t, sk, hitIndex = 0) {
    if (!t.alive) return;
    const r = computeHit(c, t, sk);
    let dmg = r.dmg;
    if (sk && sk.kind === 'drain') { const g = Math.round(dmg * 0.5); c.hp = Math.min(c.maxHp, c.hp + g); this.popup(c, '+' + g, 'heal'); }
    await this.damageRaw(t, dmg, 'hit', r);
    if (sk && sk.status && t.alive) {
      const ok = applyStatus(t, sk.status.id, sk.status.turns, sk.status.chance);
      if (ok) this.popup(t, STATUS[sk.status.id].name + '!', 'status');
    }
    if (c.side === 'party') this.addStar(r.weak ? 7 : 4);
  }
  async damageRaw(t, dmg, type, r = {}) {
    t.hp = Math.max(0, t.hp - dmg);
    const big = r.crit || r.weak || dmg > t.maxHp * 0.25;
    const cls = type === 'poison' ? 'poison' : (t.side === 'party' ? 'hurt' : (r.crit ? 'crit' : r.weak ? 'weak' : 'dmg'));
    this.popup(t, String(dmg), cls + (big ? ' big' : ''), r.crit ? 'CRITICAL!' : r.weak ? 'WEAK!' : r.resist ? 'resist' : '');
    audio.sfx(t.side === 'party' ? 'hurt' : (r.crit || big ? 'impact' : 'hit'), { vol: 0.55, rate: 0.9 + Math.random() * 0.25 });
    t.actor.flash = 1;
    if (big) this.world.shake = Math.max(this.world.shake, r.crit ? 0.5 : 0.3);
    const a = t.actor, kx = t.side === 'party' ? 0.45 : -0.45, bx = a.position.x;
    tween(200, (k) => { a.position.x = bx - kx * Math.sin(k * Math.PI) * (type === 'poison' ? 0 : 1); });
    if (t.side === 'party') this.addStar(6);
    this.syncBars();
    if (t.hp <= 0) await this.kill(t);
    else await sleep(type === 'poison' ? 350 : 60);
  }
  async kill(t) {
    t.alive = false; t.status = {};
    if (t.side === 'enemy') {
      audio.sfx(t.boss ? 'big_kill' : 'kill', { vol: 0.7 });
      this.fx.spark(this.pos(t, 1), 0xffffff, 18, 5, 0.1, 0.7);
      const a = t.actor;
      await tween(520, (k) => { a.alpha = 1 - k; a.mat.opacity = 1 - k; a.mat.transparent = true; a.position.y = -k * 0.4; a.flash = 0.8; });
      a.group.visible = false;
      if (t.bar) t.bar.classList.add('hidden');
    } else {
      audio.sfx('downed', { vol: 0.6 });
      await this.fall(t);
    }
    this.syncBars(); this.refreshParty();
  }
  async fall(p, instant) {
    const a = p.actor;
    const set = (k) => { a.mesh.rotation.z = -1.35 * k; a.bob.position.y = 0; a.hop = -0.55 * k; a.baseTint.setRGB(1 - 0.55 * k, 1 - 0.55 * k, 1 - 0.5 * k); };
    if (instant) set(1); else await tween(420, (k) => set(easeOut(k)));
    a.dead = true;
  }
  rise(p) {
    const a = p.actor; a.dead = false; a.mesh.rotation.z = 0; a.hop = 0; a.baseTint.set(this.world.mood.sprite);
  }
  async healEffect(c, sk, targets) {
    for (const t of targets) {
      let amount = 0;
      if (sk.kind === 'revive') {
        if (t.alive) continue;
        t.alive = true; t.hp = Math.max(1, Math.round(t.maxHp * sk.power / 100)); amount = t.hp; this.rise(t);
      } else if (sk.kind === 'cleanse') {
        delete t.status.poison; delete t.status.stun; delete t.status.atkDown; delete t.status.defDown;
        amount = Math.round(computeHeal(c, sk) * 0.5); t.hp = Math.min(t.maxHp, t.hp + amount);
      } else {
        if (!t.alive && sk.revive) { t.alive = true; t.hp = Math.round(t.maxHp * sk.revive); this.rise(t); }
        if (t.alive) { amount = computeHeal(c, sk); t.hp = Math.min(t.maxHp, t.hp + amount); }
        if (sk.buff && t.alive) for (const [k, v] of Object.entries(sk.buff)) applyStatus(t, k, v);
      }
      this.fx.heal(this.pos(t, 0.8));
      this.popup(t, '+' + amount, 'heal'); audio.sfx('revive', { vol: 0.55 });
      if (sk.burst) this.fx.light(this.pos(t, 0.5));
      await sleep(sk.target === 'allies' ? 110 : 0);
    }
    this.syncBars(); await sleep(520);
  }
  async buffEffect(c, sk, targets) {
    for (const t of targets) {
      for (const [k, v] of Object.entries(sk.buff || {})) { if (t.alive) { applyStatus(t, k, v); } }
      this.fx.buff(this.pos(t, 0.6), t.side === 'party' ? 0xffd36b : 0xff7a7a);
      const names = Object.keys(sk.buff || {}).map((k) => STATUS[k]?.name).filter(Boolean);
      if (names.length) this.popup(t, names[0], 'status');
      audio.sfx('confirm', { vol: 0.4, rate: 1.4 });
      await sleep(80);
    }
    await sleep(600); this.refreshParty();
  }
  async debuffEffect(c, sk, targets) {
    for (const t of targets) {
      if (!t.alive) continue;
      this.fx.debuff(this.pos(t, 0.8));
      if (sk.status) { const ok = applyStatus(t, sk.status.id, sk.status.turns, sk.status.chance); this.popup(t, ok ? STATUS[sk.status.id].name + '!' : 'Resisted', 'status'); }
      audio.sfx('hurt', { vol: 0.35, rate: 0.7 });
      await sleep(100);
    }
    await sleep(500); this.refreshParty();
  }
  async useItem(c, plan) {
    const it = ITEMS[plan.item];
    await this.msg(`${c.name} uses ${it.name}`, 650);
    addItem(plan.item, -1);
    for (const t of plan.targets) {
      if (it.kind === 'heal') { if (!t.alive) continue; const a = Math.min(it.amount, t.maxHp - t.hp); t.hp += a; this.popup(t, '+' + a, 'heal'); this.fx.heal(this.pos(t, 0.8)); }
      else if (it.kind === 'mp') { if (!t.alive) continue; const a = Math.min(it.amount, t.maxMp - t.mp); t.mp += a; this.popup(t, '+' + a + ' MP', 'mp'); this.fx.heal(this.pos(t, 0.8)); }
      else if (it.kind === 'both') { if (!t.alive) continue; t.hp = t.maxHp; t.mp = t.maxMp; this.popup(t, 'Full!', 'heal'); this.fx.heal(this.pos(t, 0.8)); }
      else if (it.kind === 'cure') { delete t.status.poison; this.popup(t, 'Cured', 'status'); this.fx.heal(this.pos(t, 0.8)); }
      else if (it.kind === 'revive') { if (t.alive) continue; t.alive = true; t.hp = Math.max(1, Math.round(t.maxHp * it.amount)); this.rise(t); this.popup(t, '+' + t.hp, 'heal'); this.fx.light(this.pos(t, 0.6)); }
      else if (it.kind === 'star') { this.addStar(it.amount); this.popup(t, 'STAR +' + it.amount, 'status'); this.fx.buff(this.pos(t, 0.6), 0xffe36a); }
      else if (it.kind === 'bomb') {
        const fake = { kind: 'mag', power: it.amount, el: it.el };
        this.fx.fire(this.pos(t, 1), false);
        await sleep(200);
        const r = computeHit({ mag: 40 + c.lv * 3, atk: 1, spd: 1, status: {} }, t, fake);
        await this.damageRaw(t, r.dmg, 'hit', r);
      }
      audio.sfx('revive', { vol: 0.4 });
    }
    this.syncBars(); this.refreshParty(); await sleep(500);
  }

  // ====================================================================== star gauge + cut-in
  addStar(n) { this.star = Math.min(100, this.star + n); this.updateStar(); }
  updateStar() {
    this.q('.sfill').style.width = this.star + '%';
    this.q('.bt-star').classList.toggle('ready', this.star >= 100);
  }
  async burstCutIn(c, sk) {
    audio.sfx('level_up', { vol: 0.7, rate: 0.9 }); audio.sfx('boss', { vol: 0.6, rate: 1.4 });
    const d = h('div', 'cutin');
    d.innerHTML = `<div class="cb"></div><img src="${spriteUrl(CHARS[c.id].sprite)}" alt=""><div class="ct1">${esc(sk.name)}</div><div class="ct2">${esc(c.name.toUpperCase())}</div>`;
    d.style.setProperty('--c', c.color);
    this.el.appendChild(d);
    this.G.gfx.setFadeColor(0xffffff);
    await sleep(1250);
    d.classList.add('out'); await sleep(250); d.remove();
    this.G.gfx.setFadeColor(0x000000);
  }

  // ====================================================================== events (boss scripts)
  async runEvents(when) {
    for (const e of this.opts.events) {
      if (e.when !== when) continue;
      if (when === 'round' && e.round !== undefined && e.round !== this.round) continue;
      if (e.once && this.eventsDone.has(e)) continue;
      this.eventsDone.add(e);
      this.hideCmd();
      await e.run(this.G, this);
      this.G.ui.dialogue.hide();
    }
  }
  async checkEvents() {
    for (const e of this.opts.events) {
      if (e.when !== 'hp' || this.eventsDone.has(e)) continue;
      const en = this.enemies[e.enemy || 0];
      if (!en || en.hp / en.maxHp > e.below) continue;
      this.eventsDone.add(e);
      if (!en.alive && !e.onDeath) continue;
      this.hideCmd();
      await e.run(this.G, this);
      this.G.ui.dialogue.hide();
    }
  }
  // helpers for scripts
  async addEnemy(id) {
    if (this.enemies.length >= 5) return;
    const e = enemyCombatant(id, this.enemies.length + 10);
    await loadSprite(e.sprite + '_fl');
    const slots = ENEMY_SLOTS[Math.min(5, alive(this.enemies).length + 1)];
    e.home = { x: slots[slots.length - 1][0] - 1, z: slots[slots.length - 1][1] };
    const a = new Actor({ height: e.height, tex: { front: e.sprite + '_fl' }, tint: this.world.mood.sprite }); a.setFlip(-1);
    a.position.set(e.home.x - 6, 0, e.home.z); this.world.add(a.group); e.actor = a;
    const d = h('div', 'ebar', `<div class="en">${esc(e.name)}</div>${bar('hp', 100)}<div class="est"></div>`); this.q('.bt-ebars').appendChild(d); e.bar = d;
    this.enemies.push(e);
    audio.sfx('dash', { vol: 0.5 });
    await tween(500, (k) => (a.position.x = e.home.x - 6 * (1 - easeOut(k))));
    this.reflow();
  }
  reflow() {
    const al = alive(this.enemies); const slots = ENEMY_SLOTS[Math.min(5, al.length)] || ENEMY_SLOTS[5];
    al.forEach((e, i) => { e.home = { x: slots[i][0], z: slots[i][1] }; tween(400, (k) => { e.actor.position.x += (e.home.x - e.actor.position.x) * k * 0.3; e.actor.position.z += (e.home.z - e.actor.position.z) * k * 0.3; }); });
  }
  buffEnemy(e, k, turns = 4) { applyStatus(e, k, turns); this.fx.buff(this.pos(e, 0.8), 0xff7a7a); this.popup(e, STATUS[k].name, 'status'); }
  healEnemy(e, pct) { const a = Math.round(e.maxHp * pct); e.hp = Math.min(e.maxHp, e.hp + a); this.popup(e, '+' + a, 'heal'); this.fx.heal(this.pos(e, 1)); this.syncBars(); }
  async cameraPunch(dist = 15, ms = 500) { const w = this.world; const d0 = w.dist; await tween(ms, (k) => (w.dist = d0 + (dist - d0) * Math.sin(k * Math.PI))); w.dist = d0; }

  // ====================================================================== victory / defeat
  async victory() {
    const G = this.G;
    this.hideCmd(); this.clearMarks();
    audio.stopMusic(0.3);
    await sleep(500);
    audio.fanfare();
    for (const p of this.party) if (p.alive) { p.actor.moving = false; tween(500, (k) => (p.actor.hop = Math.abs(Math.sin(k * Math.PI * 2)) * 0.35)); }
    await runEventsEnd(this);
    const rw = rewards(this.enemies);
    state.gold += rw.gold;
    for (const d of rw.drops) addItem(d, 1);
    const members = state.party.slice(0, 4);
    const share = (id) => (members.includes(id) ? rw.exp : Math.round(rw.exp * 0.5));
    // sync current hp/mp first so level-ups add on top
    for (const p of this.party) { const r = state.roster[p.id]; r.hp = Math.max(1, p.hp); r.mp = p.mp; }
    const reports = [];
    for (const id of Object.keys(state.roster)) { const ups = gainExp(id, share(id)); if (members.includes(id)) reports.push({ id, ups, gain: share(id) }); }
    const panel = h('div', 'results panel');
    const drops = rw.drops.map((d) => esc(itemInfo(d).name));
    panel.innerHTML = `<div class="rt">VICTORY</div>
      <div class="rsum"><span>EXP <b>+${rw.exp}</b></span><span>Gold <b>+${rw.gold} G</b></span></div>
      ${drops.length ? `<div class="rdrop">Found: ${drops.join(', ')}</div>` : ''}
      <div class="rmem">${reports.map((r) => `<div class="rm" data-id="${r.id}"><img src="${faceUrl(CHARS[r.id].sprite)}" alt=""><div class="rn">${esc(CHARS[r.id].name)} <small>Lv ${state.roster[r.id].lv}</small>${r.ups.length ? '<span class="lvup">LEVEL UP!</span>' : ''}</div>${bar('xp', 100)}</div>`).join('')}</div>
      <div class="rhint">▼</div>`;
    this.el.appendChild(panel);
    await sleep(350);
    await new Promise((res) => { const off = input.push((a) => { if (a === 'ok' || a === 'cancel') { off(); res(); } return true; }); panel.addEventListener('click', () => { off(); res(); }, { once: true }); });
    panel.remove();
    for (const r of reports) {
      for (const up of r.ups) {
        audio.jingle('levelup'); audio.sfx('level_up', { vol: 0.6 });
        const c = CHARS[r.id];
        const keys = [['maxHp', 'HP'], ['maxMp', 'MP'], ['atk', 'ATK'], ['def', 'DEF'], ['mag', 'MAG'], ['res', 'RES'], ['spd', 'SPD']];
        const lp = h('div', 'results panel lvl');
        lp.innerHTML = `<div class="lvh"><img src="${spriteUrl(c.sprite)}" alt=""><div><div class="rt">${esc(c.name)}</div><div class="lvn">Level ${up.lv - 1} → <b>${up.lv}</b></div></div></div>
          <div class="stats">${keys.map(([k, n]) => `<div><span>${n}</span><span>${up.before[k]} → <b>${up.after[k]}</b></span></div>`).join('')}</div>
          ${up.skills.length ? `<div class="newsk">Learned: ${up.skills.map((s) => esc(SKILLS[s].name)).join(', ')}</div>` : ''}<div class="rhint">▼</div>`;
        this.el.appendChild(lp);
        await sleep(300);
        await new Promise((res) => { const off = input.push((a) => { if (a === 'ok' || a === 'cancel') { off(); res(); } return true; }); lp.addEventListener('click', () => { off(); res(); }, { once: true }); });
        lp.remove();
      }
    }
    await this.runEvents('end');
  }
  async defeat() {
    audio.stopMusic(0.5); audio.jingle('defeat');
    await this.G.fadeTo(0.85, 900);
    const panel = h('div', 'results panel defeat');
    panel.innerHTML = `<div class="rt">THE PARTY HAS FALLEN</div><div class="rdrop">…but the moonlight isn't done with you yet.</div><div class="list"></div>`;
    this.el.appendChild(panel);
    const lst = panel.querySelector('.list');
    const opts = [['Try again', 'retry']];
    if (lastSlot()) opts.push(['Load last save', 'load']);
    opts.push(['Return to title', 'title']);
    const rows = opts.map(([t]) => { const r = h('div', 'row', esc(t)); lst.appendChild(r); return r; });
    const i = await pick(rows, { cancelable: false });
    panel.remove();
    const k = opts[i][1];
    this.G.gfx.fade = 0;
    if (k === 'retry') { await this.G.fadeTo(1, 10); return 'retry'; }
    this.hideCmd(); this.el.classList.add('hidden'); this.active = false;
    if (k === 'load') { const s = lastSlot(); await this.G.loadGame(s.n); } else { await this.G.toTitle(); }
    throw new BattleAbort();
  }

  // ====================================================================== overlays / UI
  async msg(text, ms = 800, color = '#fff') {
    const m = this.q('.bt-msg');
    m.textContent = text; m.style.color = color; m.classList.remove('hidden');
    await sleep(ms);
    m.classList.add('hidden');
  }
  popup(c, text, cls = '', tag = '') {
    const d = h('div', 'pop ' + cls, `${esc(text)}${tag ? `<small>${tag}</small>` : ''}`);
    const p = this.G.gfx.project(new THREE.Vector3(c.actor.position.x, c.height * 0.8, c.actor.position.z));
    d.style.left = p.x + (Math.random() - 0.5) * 36 + 'px'; d.style.top = p.y + 'px';
    this.q('.bt-pops').appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }
  syncBars() {
    for (const e of this.enemies) {
      if (!e.bar) continue;
      const pct = (e.hp / e.maxHp) * 100;
      const f = e.bar.querySelector('.fill'); f.style.width = pct + '%';
      e.bar.querySelector('.bar').classList.toggle('low', pct < 30);
      e.bar.querySelector('.est').textContent = Object.keys(e.status).filter((k) => STATUS[k]).map((k) => STATUS[k].icon).join(' ');
    }
    const boss = this.enemies.find((e) => e.boss);
    const bb = this.q('.bt-boss');
    if (boss) { bb.classList.remove('hidden'); bb.querySelector('.bn').textContent = boss.name; bb.querySelector('.fill').style.width = (boss.hp / boss.maxHp) * 100 + '%'; }
    this.refreshParty();
  }
  refreshParty() {
    const box = this.q('.bt-party');
    box.innerHTML = this.party.map((p) => {
      const st = Object.keys(p.status).filter((k) => STATUS[k]).map((k) => `<span style="color:${STATUS[k].color}" title="${STATUS[k].name}">${STATUS[k].icon}</span>`).join('');
      const pct = (p.hp / p.maxHp) * 100;
      return `<div class="pm${this.cur === p ? ' cur' : ''}${p.alive ? '' : ' ko'}" style="--c:${p.color}">
        <img src="${faceUrl(CHARS[p.id].sprite)}" alt="">
        <div class="pi"><div class="pn">${esc(p.name)} <span class="st">${st}</span></div>
          ${bar('hp' + (pct < 30 ? ' low' : ''), pct)}<div class="num"><b>${Math.max(0, p.hp)}</b>/${p.maxHp}</div>
          ${bar('mp', (p.mp / p.maxMp) * 100)}<div class="num mpn">${p.mp} MP</div></div></div>`;
    }).join('');
    this.updateStar();
  }
  updateTurnBar(order) {
    const box = this.q('.bt-turns');
    const next = turnOrder([...this.party, ...this.enemies].filter((c) => c.alive)).slice(0, 4);
    const list = [...order.filter((c) => c.alive).slice(0, 7), ...next].slice(0, 8);
    box.innerHTML = list.map((c, i) => `<div class="tc ${c.side}${i === 0 ? ' now' : ''}"><img src="${faceUrl(c.sprite)}" alt=""></div>`).join('');
  }
  positionOverlays() {
    const G = this.G;
    for (const m of this.marks || []) {
      const p = G.gfx.project(new THREE.Vector3(m.c.actor.position.x, m.c.height + 0.45, m.c.actor.position.z));
      m.d.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
    }
    for (const e of this.enemies) {
      if (!e.bar || !e.alive) continue;
      const p = G.gfx.project(new THREE.Vector3(e.actor.position.x, e.height + 0.15, e.actor.position.z));
      e.bar.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-100%)`;
      const targeted = (this.marks || []).some((m) => m.c === e);
      e.bar.classList.toggle('show', targeted || this.cur === e || e.hp < e.maxHp);
    }
  }
  update(dt) {
    if (!this.active) return;
    const w = this.world;
    w.update(dt); this.fx.update(dt);
    for (const c of [...this.party, ...this.enemies]) if (c.actor) {
      if (c.actor.dead) c.actor.moving = false;
      c.actor.update(dt);
      if (this.cur === c && c.alive && c.side === 'party') c.actor.hop = 0.12 + Math.sin(performance.now() / 180) * 0.04;
    }
    this.positionOverlays();
  }
}
export class BattleAbort extends Error {}
async function runEventsEnd(B) { /* hook for scripts that want a victory line before rewards */
  for (const e of B.opts.events) if (e.when === 'victory') await e.run(B.G, B);
}
