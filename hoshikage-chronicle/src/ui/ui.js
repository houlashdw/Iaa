// DOM UI core: dialogue (visual-novel style), choices, banners, toasts and a generic keyboard/mouse list picker.
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { setPortrait } from './portraits.js';
import { sleep } from '../core/util.js';

export const root = document.getElementById('ui');
export const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
export const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const bar = (cls, pct) => `<div class="bar ${cls}"><div class="fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;

/**
 * Keyboard/mouse list picker. `rows` are elements already placed in the DOM. Resolves with the chosen index
 * (or null when cancelled). `cols` > 1 enables left/right grid movement.
 */
export function pick(rows, { onFocus, onSide, sideExit = false, cancelable = true, cols = 1, start = 0, sound = true } = {}) {
  return new Promise((resolve) => {
    let idx = Math.min(Math.max(0, start), rows.length - 1);
    const set = (i, snd = true) => {
      if (!rows.length) return;
      rows[idx]?.classList.remove('sel');
      idx = (i + rows.length) % rows.length;
      rows[idx].classList.add('sel');
      rows[idx].scrollIntoView({ block: 'nearest' });
      if (snd && sound) audio.sfx('ui', { vol: 0.35 });
      onFocus && onFocus(idx);
    };
    const done = (v) => { off(); rows.forEach((r) => { r.removeEventListener('click', r._pk); r.removeEventListener('mouseenter', r._pe); r.classList.remove('sel'); }); resolve(v); };
    const off = input.push((a) => {
      if (a === 'up') set(idx - cols);
      else if (a === 'down') set(idx + cols);
      else if (a === 'left') { if (cols > 1) set(idx - 1); else if (sideExit) done({ side: -1 }); else onSide && onSide(-1); }
      else if (a === 'right') { if (cols > 1) set(idx + 1); else if (sideExit) done({ side: 1 }); else onSide && onSide(1); }
      else if (a === 'ok') { if (rows[idx] && !rows[idx].classList.contains('off')) { if (sound) audio.sfx('confirm', { vol: 0.5 }); done(idx); } else audio.sfx('hurt', { vol: 0.25 }); }
      else if ((a === 'cancel' || a === 'menu') && cancelable) { if (sound) audio.sfx('ui', { vol: 0.35, rate: 0.8 }); done(null); }
      return true;
    });
    rows.forEach((r, i) => {
      r._pk = () => { set(i, false); if (r.classList.contains('off')) return; if (sound) audio.sfx('confirm', { vol: 0.5 }); done(i); };
      r._pe = () => { if (i !== idx) set(i); };
      r.addEventListener('click', r._pk); r.addEventListener('mouseenter', r._pe);
    });
    set(idx, false);
  });
}

class Dialogue {
  constructor() {
    this.el = h('div', 'dlg hidden');
    this.el.innerHTML = `<div class="dim"></div><img class="port left" alt=""><img class="port right" alt="">
      <div class="box panel"><div class="nameplate"></div><div class="text"></div><div class="next">▼</div></div>`;
    root.appendChild(this.el);
    this.pl = this.el.querySelector('.port.left'); this.pr = this.el.querySelector('.port.right');
    this.name = this.el.querySelector('.nameplate'); this.text = this.el.querySelector('.text'); this.next = this.el.querySelector('.next');
    this.box = this.el.querySelector('.box');
    this.visible = false;
    this.speed = 46;
    this.box.addEventListener('click', () => this._click && this._click());
  }
  show() { if (!this.visible) { this.el.classList.remove('hidden'); this.visible = true; } }
  hide() { this.el.classList.add('hidden'); this.visible = false; this.pl.classList.remove('in'); this.pr.classList.remove('in'); this.pl.dataset.key = this.pr.dataset.key = ''; }
  _port(side, key, active) {
    const img = side === 'left' ? this.pl : this.pr;
    if (key && img.dataset.key !== key) { img.dataset.key = key; setPortrait(img, key, 'full'); img.classList.remove('in'); void img.offsetWidth; img.classList.add('in'); }
    if (key) img.classList.toggle('dim', !active);
  }
  /** sp: {name, sprite, side, color} ; text: string */
  async say(sp, text, { noPortrait = false } = {}) {
    this.show();
    const side = sp.side || 'right';
    if (sp.sprite && !noPortrait) {
      this._port(side, sp.sprite, true);
      const other = side === 'left' ? this.pr : this.pl;
      if (other.dataset.key) other.classList.add('dim');
    } else if (!sp.sprite) { this.pl.classList.add('dim'); this.pr.classList.add('dim'); }
    this.box.classList.toggle('narr', !sp.name);
    this.name.style.display = sp.name ? '' : 'none';
    this.name.textContent = sp.name || '';
    this.name.style.setProperty('--c', sp.color || '#ffd36b');
    this.text.textContent = '';
    this.next.style.visibility = 'hidden';
    const full = text;
    let shown = 0, finished = false, resolveFn;
    const p = new Promise((r) => (resolveFn = r));
    const t0 = performance.now();
    let lastBlip = 0;
    const tick = () => {
      if (finished) return;
      const n = Math.min(full.length, Math.floor(((performance.now() - t0) / 1000) * this.speed));
      if (n !== shown) {
        shown = n; this.text.textContent = full.slice(0, n);
        if (sp.name && performance.now() - lastBlip > 70 && /\S/.test(full[n - 1] || '')) { lastBlip = performance.now(); audio.sfx('step', { vol: 0.05, rate: 1.8 + Math.random() * 0.5 }); }
      }
      if (shown >= full.length) { finished = true; this.next.style.visibility = 'visible'; return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const advance = () => {
      if (!finished) { finished = true; shown = full.length; this.text.textContent = full; this.next.style.visibility = 'visible'; return; }
      resolveFn();
    };
    this._click = advance;
    const off = input.push((a) => { if (a === 'ok' || a === 'cancel') advance(); return true; });
    await p;
    off(); this._click = null;
    audio.sfx('ui', { vol: 0.25, rate: 1.3 });
  }
  async choice(options, { title } = {}) {
    this.show();
    const wrap = h('div', 'choices panel');
    if (title) wrap.appendChild(h('div', 'ctitle', esc(title)));
    const rows = options.map((o) => { const r = h('div', 'row', esc(typeof o === 'string' ? o : o.label)); if (o.off) r.classList.add('off'); wrap.appendChild(r); return r; });
    this.el.appendChild(wrap);
    const i = await pick(rows, { cancelable: false });
    wrap.remove();
    return i;
  }
}

export const dialogue = new Dialogue();

// ---------- banners, toasts, cards
const bannerEl = h('div', 'banner hidden'); root.appendChild(bannerEl);
export async function banner(title, sub = '', ms = 2800) {
  bannerEl.innerHTML = `<div class="bt">${esc(title)}</div>${sub ? `<div class="bs">${esc(sub)}</div>` : ''}`;
  bannerEl.classList.remove('hidden'); bannerEl.classList.remove('out'); void bannerEl.offsetWidth; bannerEl.classList.add('in');
  await sleep(ms);
  bannerEl.classList.add('out'); bannerEl.classList.remove('in');
  await sleep(700);
  bannerEl.classList.add('hidden');
}
const toastBox = h('div', 'toasts'); root.appendChild(toastBox);
export function toast(text, kind = '') {
  const t = h('div', 'toast panel ' + kind, text);
  toastBox.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3200);
}
/** full-screen title card (chapter titles, "To be continued"...) */
export async function card(lines, { ms = 3400, color = '#05050c' } = {}) {
  const c = h('div', 'card'); c.style.background = color;
  c.innerHTML = lines.map((l, i) => `<div class="cl l${i}">${esc(l)}</div>`).join('');
  root.appendChild(c);
  await sleep(50); c.classList.add('in');
  await sleep(ms);
  c.classList.remove('in');
  await sleep(900);
  c.remove();
}
export const mount = (el) => { root.appendChild(el); return el; };
