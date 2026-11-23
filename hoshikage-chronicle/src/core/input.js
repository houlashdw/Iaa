// Keyboard + touch input. Modal UIs push a handler; otherwise events go to the field.
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', KeyE: 'ok', KeyZ: 'ok', Escape: 'cancel', Backspace: 'cancel', KeyX: 'cancel', KeyM: 'menu', Tab: 'menu',
};
class Input {
  constructor() {
    this.held = new Set();
    this.stack = [];
    this.run = false;
    this.pad = { x: 0, y: 0 };
    this.touch = false;
    this._rep = new Map();
    addEventListener('keydown', (e) => this._down(e));
    addEventListener('keyup', (e) => this._up(e));
    addEventListener('blur', () => { this.held.clear(); this.run = false; });
  }
  push(fn) { this.stack.push(fn); return () => { const i = this.stack.indexOf(fn); if (i >= 0) this.stack.splice(i, 1); }; }
  get modal() { return this.stack.length > 0; }
  _dispatch(action, ev) {
    const top = this.stack[this.stack.length - 1];
    if (top) { if (top(action, ev) !== false) return true; }
    else if (this.field) return this.field(action, ev);
    return false;
  }
  _down(e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { this.run = true; return; }
    const a = KEYMAP[e.code];
    if (!a) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    const first = !this.held.has(e.code);
    this.held.add(e.code);
    // key repeat: allow for directions inside modal menus
    if (first || (this.modal && (a === 'up' || a === 'down' || a === 'left' || a === 'right'))) this._dispatch(a, e);
  }
  _up(e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.run = false;
    this.held.delete(e.code);
  }
  /** movement vector from held keys / touch pad */
  vec() {
    let x = 0, y = 0;
    const h = this.held;
    if (h.has('ArrowLeft') || h.has('KeyA')) x -= 1;
    if (h.has('ArrowRight') || h.has('KeyD')) x += 1;
    if (h.has('ArrowUp') || h.has('KeyW')) y -= 1;
    if (h.has('ArrowDown') || h.has('KeyS')) y += 1;
    x += this.pad.x; y += this.pad.y;
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }
  /** on-screen controls for touch devices */
  mountTouch(root) {
    const wrap = document.createElement('div');
    wrap.id = 'touch';
    wrap.innerHTML = `<div class="stick"><div class="knob"></div></div><button class="tb ta" data-a="ok">A</button><button class="tb tbm" data-a="cancel">☰</button>`;
    root.appendChild(wrap);
    const stick = wrap.querySelector('.stick'), knob = wrap.querySelector('.knob');
    let id = null, repeat = null, lastDir = null;
    const setVec = (ev) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (ev.clientX - cx) / (r.width / 2), dy = (ev.clientY - cy) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.pad.x = Math.abs(dx) > 0.28 ? dx : 0; this.pad.y = Math.abs(dy) > 0.28 ? dy : 0;
      knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0.4 ? 'right' : dx < -0.4 ? 'left' : null) : (dy > 0.4 ? 'down' : dy < -0.4 ? 'up' : null);
      if (dir !== lastDir) { lastDir = dir; if (dir && this.modal) this._dispatch(dir); }
    };
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); setVec(e); repeat = setInterval(() => { if (lastDir && this.modal) this._dispatch(lastDir); }, 190); e.preventDefault(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) setVec(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.pad.x = this.pad.y = 0; knob.style.transform = ''; lastDir = null; clearInterval(repeat); };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    wrap.querySelectorAll('.tb').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); const a = b.dataset.a; this._dispatch(a === 'cancel' && !this.modal ? 'menu' : a); }));
    this.touch = true;
  }
}
export const input = new Input();
