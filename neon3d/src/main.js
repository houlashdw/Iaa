// NEON 3D — склейка: 2D-фон → 3D-персонаж (Three.js, toon + контур) → 2D-передний план/переходы/зерно.
import * as THREE from 'three';
import { createCharacter } from './character.js';
import { getPose, getCam, sceneOf, BEAT, SLEN, LOOP } from './anim.js';
import { setOutline, lerp, clamp } from './util.js';
import * as Pop from './pop2d.js';
import { Snd } from './audio.js';

const W = Pop.W, H = Pop.H, DT = 1 / 60, PARAMS = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let Q = +(PARAMS.get('q') || 1.5), RW = 0, RH = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
const glc = renderer.domElement, scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, W / H, .1, 60);
scene.add(new THREE.AmbientLight(0xffffff, 1.7));
const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(.7, 1.5, 4.2); scene.add(key);
const rim = new THREE.DirectionalLight(0xffb0d0, 1.1); rim.position.set(-2.5, 1.6, -2.2); scene.add(rim);
const chr = createCharacter(scene);

const Sc = document.createElement('canvas'), Sx = Sc.getContext('2d');
function setQuality(q) {
  Q = q; RW = Math.round(W * Q); RH = Math.round(H * Q); cv.width = RW; cv.height = RH; Sc.width = RW >> 1; Sc.height = RH >> 1;
  renderer.setSize(RW, RH, false); Pop.setQ(Q, ctx);
}

/* ---------- состояние ---------- */
const S = { t: 0, beat: -1, sc: 0, u: 0, ptr: { x: .5, y: .5, last: -99 }, ptrW: 0, lk: { x: 0, y: 0 }, anchor: { x: 640, y: 300 }, camDist: 4 };
const _v = new THREE.Vector3();
function applyCam(sc, u, t) {
  const c = getCam(sc, u, t); camera.fov = c.fov; camera.position.set(...c.pos); camera.up.set(0, 1, 0); camera.lookAt(...c.look); if (c.roll) camera.rotateZ(c.roll);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); S.camDist = camera.position.distanceTo(_v.set(...c.look));
}
function project(v3) { _v.copy(v3).project(camera); return { x: (_v.x * .5 + .5) * W, y: (-_v.y * .5 + .5) * H }; }

function step() {
  S.t += DT; const t = S.t, [sc, u] = sceneOf(t); S.sc = sc; S.u = u;
  applyCam(sc, u, t); S.anchor = project(chr.headWorld());
  const b = Math.floor(t / BEAT); if (b !== S.beat) { S.beat = b; Pop.onBeat(b, sc, u, BEAT, S.anchor); }
  const P = getPose(sc, u, t); S.P = P;
  // взгляд за курсором
  const act = (t - S.ptr.last) < 2.2 ? 1 : 0; S.ptrW += (act - S.ptrW) * .08;
  const px = clamp((S.ptr.x * W - S.anchor.x) / 320, -1, 1), py = clamp((S.ptr.y * H - S.anchor.y) / 260, -1, 1), w = S.ptrW;
  P.face.lx = lerp(P.face.lx, px, w); P.face.ly = lerp(P.face.ly, py, w); P.turn += w * px * .32; P.nod += w * py * .14;
  chr.update(P, t); Pop.stepParts(DT);
  const ph = t % LOOP, db = ph - Math.round(ph / SLEN) * SLEN; if (Math.abs(db) < DT * .6) Pop.S.flash = 1;
}
function reset() { S.t = 0; S.beat = -1; S.ptr.last = -99; S.ptrW = 0; Pop.resetParts(); step(); }

/* ---------- рендер ---------- */
function render() {
  const t = S.t, sc = S.sc, u = S.u, c = ctx, pul = Pop.S.pulse;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, RW, RH);
  const sh = Pop.S.shake * (sc === 2 ? 5 : 2.2), shx = Math.sin(t * 91) * sh, shy = Math.cos(t * 77) * sh;
  c.save(); c.scale(Q, Q); c.translate(shx, shy); Pop.drawBg(c, sc, u, t, pul); Pop.drawParts(c, false); c.restore();
  // 3D
  setOutline(S.camDist * .0016); renderer.render(scene, camera);
  Sx.setTransform(1, 0, 0, 1, 0, 0); Sx.globalCompositeOperation = 'source-over'; Sx.clearRect(0, 0, Sc.width, Sc.height); Sx.drawImage(glc, 0, 0, Sc.width, Sc.height);
  Sx.globalCompositeOperation = 'source-in'; Sx.fillStyle = sc === 0 ? 'rgba(25,18,40,.30)' : 'rgba(224,36,100,.30)'; Sx.fillRect(0, 0, Sc.width, Sc.height); Sx.globalCompositeOperation = 'source-over';
  const k = sc === 2 ? 1.4 : 1;
  c.save(); c.translate(shx * Q, shy * Q); c.drawImage(Sc, 16 * Q * k, 12 * Q * k, RW, RH); c.drawImage(glc, 0, 0, RW, RH); c.restore();
  c.save(); c.scale(Q, Q); c.translate(shx, shy); Pop.drawParts(c, true);
  if (sc === 2) Pop.drawBubble(c, 215, 150, Pop.outElastic(Pop.prog(u, .62, .55)) * (1 - Pop.prog(u, 2.2, .2)), t);
  c.restore();
  const ph = t % LOOP, db = ph - Math.round(ph / SLEN) * SLEN, hw = .3;
  Pop.drawOverlay(c, RW, RH, t, Math.abs(db) < hw ? (db + hw) / (2 * hw) : -1);
}

/* ---------- цикл / UI ---------- */
let running = true, last = 0, acc = 0, slow = 0, nfr = 0;
function frame(ts) {
  if (!last) last = ts; const dt = Math.min(.1, (ts - last) / 1000); last = ts;
  if (!PARAMS.has('q') && running && !document.hidden && ++nfr > 30) { slow = dt > .021 ? slow + 1 : Math.max(0, slow - 2); if (slow > 30 && Q > .75) { setQuality(Q > 1 ? 1 : .75); slow = 0; nfr = 0; } }
  if (running) { acc += dt; while (acc >= DT) { step(); acc -= DT; } Snd.sched(S.t); }
  render(); requestAnimationFrame(frame);
}
function setPause(p) { running = !p; $('bPause').textContent = p ? '▶ Играть' : '⏸ Пауза'; if (Snd.on && Snd.ctx) p ? Snd.ctx.suspend() : Snd.ctx.resume(); }
function setSound(on) { Snd.toggle(on, S.t); $('bSnd').classList.toggle('on', on); $('bSnd').textContent = on ? '🔊 Звук вкл' : '🔊 Звук'; }
$('bPause').onclick = () => setPause(running); $('bSnd').onclick = () => setSound(!Snd.on);
$('bFs').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); setPause(running); } else if (e.key === 'm' || e.key === 'M') setSound(!Snd.on); else if (e.key === 'f' || e.key === 'F') $('bFs').onclick(); });
const ptrPos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
cv.addEventListener('pointermove', e => { const [x, y] = ptrPos(e); S.ptr.x = x; S.ptr.y = y; S.ptr.last = S.t; $('hint').style.opacity = 0; });
cv.addEventListener('pointerdown', e => { const [x, y] = ptrPos(e); S.ptr.x = x; S.ptr.y = y; S.ptr.last = S.t; Pop.burst(x * W, y * H, 16, ['red', 'pink', 'blue', 'yellow'], true); });
setTimeout(() => { $('hint').style.opacity = 0; }, 9000);

window.NEON = { LOOP, BEAT, reset, step, render, advanceTo(t) { while (S.t < t - 1e-6) step(); render(); }, get time() { return S.t; }, three: { scene, camera, chr, renderer } };
setQuality(Q); reset();
if (!PARAMS.has('manual')) requestAnimationFrame(frame);
