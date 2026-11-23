// Keyboard / mouse / touch input.
//  * Modal UIs (menus, dialogue) push a handler onto `stack` and get the classic 'up/down/ok/cancel' actions.
//  * Otherwise events go to the game (`field`): movement vector, camera look, and action buttons
//    (attack, dodge, skill1-4, burst, switch, heal, auto, ok = interact, menu).
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', KeyE: 'ok', KeyZ: 'ok', Escape: 'cancel', Backspace: 'cancel', KeyX: 'cancel', KeyM: 'menu', Tab: 'menu',
};
// while playing (no modal UI open) these keys mean something else
const GAME = {
  KeyJ: 'attack', KeyK: 'attack', Space: 'dodge', Digit1: 'skill1', Digit2: 'skill2', Digit3: 'skill3', Digit4: 'skill4', Digit5: 'skill5',
  KeyR: 'burst', Tab: 'switch', KeyQ: 'switchPrev', KeyH: 'heal', KeyT: 'auto', KeyF: 'ok', KeyZ: 'ok',
};
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

class Input {
  constructor() {
    this.held = new Set();
    this.stack = [];
    this.run = false;
    this.pad = { x: 0, y: 0 };
    this.touch = false;
    this.look = { x: 0, y: 0 };      // accumulated mouse / touch look since the last takeLook()
    this.attackHeld = false;           // LMB / J held (auto-repeat attacks)
    this.canvas = null;
    this.locked = false;
    this.zoom = 0;                     // mouse-wheel zoom accumulated
    addEventListener('keydown', (e) => this._down(e));
    addEventListener('keyup', (e) => this._up(e));
    addEventListener('blur', () => { this.held.clear(); this.run = false; this.attackHeld = false; });
    document.addEventListener('pointerlockchange', () => { this.locked = !!document.pointerLockElement; if (!this.locked) this.attackHeld = false; });
  }
  push(fn) {
    this.stack.push(fn);
    document.body.classList.add('uimodal');
    this.attackHeld = false;
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch {} }
    return () => { const i = this.stack.indexOf(fn); if (i >= 0) this.stack.splice(i, 1); if (!this.stack.length) document.body.classList.remove('uimodal'); };
  }
  get modal() { return this.stack.length > 0; }
  _dispatch(action, ev) {
    const top = this.stack[this.stack.length - 1];
    if (top) { if (top(action, ev) !== false) return true; }
    else if (this.field) return this.field(action, ev);
    return false;
  }
  _down(e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { this.run = true; return; }
    const a = (!this.modal && GAME[e.code]) || KEYMAP[e.code];
    if (!a) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    const first = !this.held.has(e.code);
    this.held.add(e.code);
    if (a === 'attack') this.attackHeld = true;
    // key repeat: allow for directions inside modal menus
    if (first || (this.modal && (a === 'up' || a === 'down' || a === 'left' || a === 'right'))) this._dispatch(a, e);
  }
  _up(e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.run = false;
    this.held.delete(e.code);
    if (GAME[e.code] === 'attack' && !this.held.has('KeyJ') && !this.held.has('KeyK')) this.attackHeld = false;
  }
  /** movement from WASD / touch stick: x = right, y = down(toward the camera) */
  vec() {
    let x = 0, y = 0;
    const h = this.held;
    if (h.has('KeyA')) x -= 1;
    if (h.has('KeyD')) x += 1;
    if (h.has('KeyW')) y -= 1;
    if (h.has('KeyS')) y += 1;
    x += this.pad.x; y += this.pad.y;
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }
  /** camera look this frame (mouse / touch drag in px, arrow keys converted to px/s by the caller's dt) */
  takeLook(dt = 0) {
    const h = this.held;
    let kx = 0, ky = 0;
    if (h.has('ArrowLeft')) kx -= 1;
    if (h.has('ArrowRight')) kx += 1;
    if (h.has('ArrowUp')) ky -= 1;
    if (h.has('ArrowDown')) ky += 1;
    const out = { x: this.look.x + kx * 520 * dt, y: this.look.y + ky * 300 * dt, zoom: this.zoom };
    this.look.x = 0; this.look.y = 0; this.zoom = 0;
    return out;
  }
  anyMoveKey() { for (const k of MOVE_KEYS) if (this.held.has(k)) return true; return this.pad.x !== 0 || this.pad.y !== 0; }

  // ---------------------------------------------------------------- mouse
  mountMouse(canvas) {
    this.canvas = canvas;
    const coarse = matchMedia('(pointer: coarse)').matches;
    let drag = false;
    const onCanvas = (e) => e.target === canvas || document.pointerLockElement === canvas;
    document.addEventListener('mousedown', (e) => {
      if (!onCanvas(e) || this.modal) return;
      if (!this.locked && !coarse) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {} }
      if (e.button === 0) { this.attackHeld = true; this._dispatch('attack', e); }
      else if (e.button === 2) { this._dispatch('dodge', e); drag = true; }
      else if (e.button === 1) { drag = true; }
      e.preventDefault();
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.attackHeld = false;
      if (e.button === 2 || e.button === 1) drag = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.modal) return;
      if (this.locked || (drag && onCanvas(e))) { this.look.x += e.movementX || 0; this.look.y += e.movementY || 0; }
    });
    document.addEventListener('wheel', (e) => { if (!this.modal && onCanvas(e)) this.zoom += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------------------------------------------------------------- touch
  /** phone controls (landscape): floating stick on the left, attack + skill arc on the right, drag the right side to look */
  mountTouch(root) {
    const wrap = document.createElement('div');
    wrap.id = 'touch';
    const sk = (n, cls) => `<button class="tb tbs ${cls}" data-a="skill${n}"><i>${n}</i><u></u></button>`;
    wrap.innerHTML = `<div class="tlook"></div><div class="tmove"></div><div class="stick"><div class="knob"></div></div>
      <div class="tarc">
        <button class="tb tbatk" data-a="attack" data-hold="1">⚔</button>
        <button class="tb tbdodge" data-a="dodge">⤼</button>
        ${sk(1, 'tbs1')}${sk(2, 'tbs2')}${sk(3, 'tbs3')}${sk(4, 'tbs4')}${sk(5, 'tbs5')}
        <button class="tb tbburst" data-a="burst">★</button>
        <button class="tb tbint" data-a="ok">✦</button>
      </div>
      <button class="tb tbm" data-a="cancel">☰</button><button class="tb tbsw" data-a="switch">⇄</button>`;
    root.appendChild(wrap);
    const stick = wrap.querySelector('.stick'), knob = wrap.querySelector('.knob'), zone = wrap.querySelector('.tmove');
    let id = null, cx = 0, cy = 0, R = 60;
    const home = () => { stick.style.left = ''; stick.style.top = ''; stick.style.bottom = ''; stick.classList.remove('on'); };
    const setVec = (ev) => {
      let dx = (ev.clientX - cx) / R, dy = (ev.clientY - cy) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.pad.x = Math.abs(dx) > 0.16 ? dx : 0; this.pad.y = Math.abs(dy) > 0.16 ? dy : 0;
      this.run = l > 0.92;                        // pushing the stick to the rim sprints
      knob.style.transform = `translate(${dx * R * 0.62}px,${dy * R * 0.62}px)`;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId; zone.setPointerCapture(id);
      const r = stick.getBoundingClientRect(); R = r.width / 2;
      cx = e.clientX; cy = e.clientY;
      stick.style.left = cx - R + 'px'; stick.style.top = cy - R + 'px'; stick.style.bottom = 'auto'; stick.classList.add('on');
      setVec(e); e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) setVec(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.pad.x = this.pad.y = 0; this.run = false; knob.style.transform = ''; home(); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    // camera: drag anywhere on the right side that is not a button
    const lookEl = wrap.querySelector('.tlook');
    let lid = null, lx = 0, ly = 0;
    lookEl.addEventListener('pointerdown', (e) => { lid = e.pointerId; lookEl.setPointerCapture(lid); lx = e.clientX; ly = e.clientY; e.preventDefault(); });
    lookEl.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; this.look.x += (e.clientX - lx) * 1.7; this.look.y += (e.clientY - ly) * 1.7; lx = e.clientX; ly = e.clientY; });
    const lend = (e) => { if (e.pointerId === lid) lid = null; };
    lookEl.addEventListener('pointerup', lend); lookEl.addEventListener('pointercancel', lend);
    wrap.querySelectorAll('.tb').forEach((b) => {
      const down = (e) => {
        e.preventDefault(); e.stopPropagation();
        const a = b.dataset.a;
        b.classList.add('press');
        if (b.dataset.hold) this.attackHeld = true;
        try { navigator.vibrate && navigator.vibrate(8); } catch {}
        this._dispatch(a === 'cancel' && !this.modal ? 'menu' : (this.modal && a === 'attack' ? 'ok' : a));
      };
      const up = () => { b.classList.remove('press'); if (b.dataset.hold) this.attackHeld = false; };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    // fullscreen + landscape on the first touch (not every browser allows it; failures are harmless)
    const goFull = () => {
      removeEventListener('pointerdown', goFull, true);
      try { const el = document.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch {}
      try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch {}
    };
    addEventListener('pointerdown', goFull, true);
    this.touch = true;
    document.body.classList.add('touch');
  }
}
export const input = new Input();
