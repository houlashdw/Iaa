// Текстура лица: глаза, брови, рот, румянец. Рисуется на Canvas 2D и натягивается на 3D-голову (планарная проекция).
import * as THREE from 'three';

export const FACE_W = .2, FACE_H = .25;          // размер проекции в метрах (относительно центра головы)
const PW = 960, PH = 1200, PX = PW / FACE_W;       // пиксели на метр
const X = m => PW / 2 + m * PX, Y = m => PH / 2 - m * PX;
const INK = '#1b1522', TAU = Math.PI * 2, K = 6.5;

function eye(c, x, y, mode, open, lx, ly, side) {
  c.save(); c.translate(x, y); c.scale(K, K); c.lineCap = c.lineJoin = 'round';
  if (mode === 'happy') {
    c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(-16, 5); c.quadraticCurveTo(0, -16, 16, 5); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(side * 15, 3); c.lineTo(side * 24, -3); c.stroke(); c.restore(); return;
  }
  if (open < .13) {
    c.strokeStyle = INK; c.lineWidth = 5.5; c.beginPath(); c.moveTo(-16, -2); c.quadraticCurveTo(0, 9, 16, -2); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(side * 15, 0); c.lineTo(side * 23, -5); c.stroke(); c.restore(); return;
  }
  c.translate(0, 15); c.scale(1, Math.min(1, Math.max(.13, open))); c.translate(0, -15);
  c.beginPath(); c.ellipse(0, 0, 17, 22, 0, 0, TAU); c.fillStyle = '#fff'; c.fill();
  c.save(); c.clip(); c.translate(lx * 5, ly * 4 + 2);
  const gr = c.createLinearGradient(0, -20, 0, 21); gr.addColorStop(0, '#2c0816'); gr.addColorStop(.32, '#c91c46'); gr.addColorStop(.7, '#ee3a62'); gr.addColorStop(1, '#ff9db4');
  c.fillStyle = gr; c.beginPath(); c.ellipse(0, 0, 14.5, 19.5, 0, 0, TAU); c.fill();
  c.fillStyle = '#2a0614'; c.beginPath(); c.ellipse(0, -1, 7.2, 11, 0, 0, TAU); c.fill();
  if (mode === 'cross') {
    c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-9, -1); c.lineTo(9, -1); c.moveTo(0, -11); c.lineTo(0, 9); c.stroke();
    c.lineWidth = 1.6; c.beginPath(); c.arc(0, -1, 10.5, 0, TAU); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-6, -9, 2.4, 0, TAU); c.fill();
  } else {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-5, -8, 5, 6, -.3, 0, TAU); c.fill(); c.beginPath(); c.arc(6, 8, 2.8, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(0, 13, 8, 3, 0, 0, TAU); c.fill();
  }
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 17, 22, 0, .2, Math.PI - .2); c.stroke();
  c.lineWidth = 6.5; c.beginPath(); c.ellipse(0, 0, 17.5, 22.5, 0, Math.PI + .25, TAU - .12); c.stroke();
  c.lineWidth = 3.4; c.beginPath(); c.moveTo(side * 15.5, -13); c.quadraticCurveTo(side * 22, -16, side * 27, -22); c.stroke();
  // нижние ресницы
  c.lineWidth = 1.6; c.beginPath(); c.moveTo(-9, 21); c.lineTo(-12, 24); c.moveTo(9, 21); c.lineTo(12, 24); c.stroke();
  c.restore();
}
function mouth(c, type, x, y) {
  c.save(); c.translate(x, y); c.scale(K * .95, K * .95); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 3;
  if (type === 'o') { c.fillStyle = '#6b1730'; c.beginPath(); c.ellipse(0, 1, 5.5, 7.5, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#ff7f9c'; c.beginPath(); c.ellipse(0, 4, 3.4, 2.6, 0, 0, TAU); c.fill(); }
  else if (type === 'open') {
    c.beginPath(); c.moveTo(-12, -4); c.quadraticCurveTo(0, 18, 12, -4); c.quadraticCurveTo(0, -1, -12, -4); c.closePath(); c.fillStyle = '#6b1730'; c.fill(); c.stroke();
    c.save(); c.clip(); c.fillStyle = '#ff7f9c'; c.beginPath(); c.ellipse(0, 9, 7, 5, 0, 0, TAU); c.fill(); c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-9, -3.5); c.lineTo(-3, -2.5); c.lineTo(-6, 2); c.closePath(); c.fill();
  } else if (type === 'pout') { c.beginPath(); c.moveTo(-8, 1); c.quadraticCurveTo(-4, -4, 0, 1); c.quadraticCurveTo(4, 6, 8, 0); c.stroke(); }
  else if (type === 'fang') {
    c.beginPath(); c.moveTo(-10, -2); c.quadraticCurveTo(-5, 5, 0, -1); c.quadraticCurveTo(5, 5, 10, -2); c.stroke();
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-7, 0); c.lineTo(-2.5, 1); c.lineTo(-5, 6.5); c.closePath(); c.fill(); c.stroke();
  } else { c.beginPath(); c.moveTo(-10, -1); c.quadraticCurveTo(-5, 6, 0, -1); c.quadraticCurveTo(5, 6, 10, -1); c.stroke(); }
  c.restore();
}

export class FaceTex {
  constructor() {
    this.cv = document.createElement('canvas'); this.cv.width = PW; this.cv.height = PH; this.c = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping; this.key = '';
  }
  draw(f) {
    const r = v => Math.round(v * 40) / 40, key = [f.emL, f.emR, r(f.oL), r(f.oR), r(f.lx), r(f.ly), Math.round(f.brow * 10), f.mouth, Math.round(f.blush * 10)].join('|');
    if (key === this.key) return; this.key = key;
    const c = this.c; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, PW, PH);
    c.fillStyle = '#fbded6'; c.fillRect(0, 0, PW, PH);
    // объём лица: боковое затемнение к краям
    let sg = c.createLinearGradient(X(-.087), 0, X(-.05), 0); sg.addColorStop(0, 'rgba(214,146,162,.55)'); sg.addColorStop(1, 'rgba(214,146,162,0)'); c.fillStyle = sg; c.fillRect(X(-.1), 0, X(-.05) - X(-.1), PH);
    sg = c.createLinearGradient(X(.087), 0, X(.05), 0); sg.addColorStop(0, 'rgba(214,146,162,.55)'); sg.addColorStop(1, 'rgba(214,146,162,0)'); c.fillStyle = sg; c.fillRect(X(.05), 0, X(.1) - X(.05), PH);
    // мягкая форма лица: тень под чёлкой, под подбородком, румяные щёки
    let g = c.createLinearGradient(0, Y(.075), 0, Y(.022)); g.addColorStop(0, 'rgba(222,150,170,.85)'); g.addColorStop(1, 'rgba(222,150,170,0)'); c.fillStyle = g; c.fillRect(0, Y(.14), PW, Y(.022) - Y(.14));
    g = c.createLinearGradient(0, Y(-.075), 0, Y(-.118)); g.addColorStop(0, 'rgba(232,160,176,0)'); g.addColorStop(1, 'rgba(232,160,176,.65)'); c.fillStyle = g; c.fillRect(0, Y(-.075), PW, Y(-.2) - Y(-.075));
    for (const s of [-1, 1]) {
      const rg = c.createRadialGradient(X(s * .056), Y(-.046), 0, X(s * .056), Y(-.046), .030 * PX); rg.addColorStop(0, `rgba(255,112,146,${.5 * f.blush})`); rg.addColorStop(1, 'rgba(255,112,146,0)');
      c.fillStyle = rg; c.fillRect(X(s * .056) - .035 * PX, Y(-.046) - .03 * PX, .07 * PX, .06 * PX);
      c.strokeStyle = `rgba(232,60,100,${.5 * f.blush})`; c.lineWidth = 6; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(X(s * (.047 + i * .007)), Y(-.043)); c.lineTo(X(s * (.05 + i * .007)), Y(-.05)); c.stroke(); }
    }
    // нос
    c.strokeStyle = '#d98a95'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(X(-.003), Y(-.05)); c.quadraticCurveTo(X(0), Y(-.0465), X(.003), Y(-.05)); c.stroke();
    // глаза, брови, рот
    eye(c, X(-.040), Y(-.016), f.emL, f.oL, f.lx, f.ly, -1); eye(c, X(.040), Y(-.016), f.emR, f.oR, f.lx, f.ly, 1);
    c.strokeStyle = '#2a1c2a'; c.lineWidth = 17; c.lineCap = 'round'; const br = f.brow;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(X(s * .013), Y(.0415 + br * .006 + (br > .5 ? .004 : 0))); c.quadraticCurveTo(X(s * .035), Y(.047 + br * .004), X(s * .061), Y(.0405 - (br > .5 ? .005 : 0) + (br < 0 ? br * .006 : 0))); c.stroke(); }
    mouth(c, f.mouth, X(0), Y(-.079));
    this.tex.needsUpdate = true;
  }
}
