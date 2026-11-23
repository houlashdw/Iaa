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
    this.attackHeld = false;
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch {} }
    return () => { const i = this.stack.indexOf(fn); if (i >= 0) this.stack.splice(i, 1); };
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
  /** on-screen controls for touch devices */
  mountTouch(root) {
    const wrap = document.createElement('div');
    wrap.id = 'touch';
    wrap.innerHTML = `<div class="tlook"></div><div class="stick"><div class="knob"></div></div>
      <button class="tb tbatk" data-a="attack" data-hold="1">⚔</button><button class="tb tbdodge" data-a="dodge">⤼</button>
      <button class="tb tbs tbs1" data-a="skill1">1</button><button class="tb tbs tbs2" data-a="skill2">2</button><button class="tb tbs tbs3" data-a="skill3">3</button><button class="tb tbs tbs4" data-a="skill4">4</button><button class="tb tbs tbs5" data-a="skill5">5</button>
      <button class="tb tbburst" data-a="burst">★</button><button class="tb tbsw" data-a="switch">⇄</button>
      <button class="tb ta" data-a="ok">✦</button><button class="tb tbm" data-a="cancel">☰</button>`;
    root.appendChild(wrap);
    const stick = wrap.querySelector('.stick'), knob = wrap.querySelector('.knob');
    let id = null, repeat = null, lastDir = null;
    const setVec = (ev) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (ev.clientX - cx) / (r.width / 2), dy = (ev.clientY - cy) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.pad.x = Math.abs(dx) > 0.2 ? dx : 0; this.pad.y = Math.abs(dy) > 0.2 ? dy : 0;
      knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0.4 ? 'right' : dx < -0.4 ? 'left' : null) : (dy > 0.4 ? 'down' : dy < -0.4 ? 'up' : null);
      if (dir !== lastDir) { lastDir = dir; if (dir && this.modal) this._dispatch(dir); }
    };
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); setVec(e); repeat = setInterval(() => { if (lastDir && this.modal) this._dispatch(lastDir); }, 190); e.preventDefault(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) setVec(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.pad.x = this.pad.y = 0; knob.style.transform = ''; lastDir = null; clearInterval(repeat); };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    // camera: drag anywhere on the right side
    const lookEl = wrap.querySelector('.tlook');
    let lid = null, lx = 0, ly = 0;
    lookEl.addEventListener('pointerdown', (e) => { lid = e.pointerId; lookEl.setPointerCapture(lid); lx = e.clientX; ly = e.clientY; e.preventDefault(); });
    lookEl.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; this.look.x += (e.clientX - lx) * 1.6; this.look.y += (e.clientY - ly) * 1.6; lx = e.clientX; ly = e.clientY; });
    const lend = (e) => { if (e.pointerId === lid) lid = null; };
    lookEl.addEventListener('pointerup', lend); lookEl.addEventListener('pointercancel', lend);
    wrap.querySelectorAll('.tb').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const a = b.dataset.a;
        if (b.dataset.hold) this.attackHeld = true;
        this._dispatch(a === 'cancel' && !this.modal ? 'menu' : (this.modal && a === 'attack' ? 'ok' : a));
      });
      b.addEventListener('pointerup', () => { if (b.dataset.hold) this.attackHeld = false; });
      b.addEventListener('pointerleave', () => { if (b.dataset.hold) this.attackHeld = false; });
    });
    this.touch = true;
    document.body.classList.add('touch');
  }
}
export const input = new Input();
