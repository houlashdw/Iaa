// UI portraits are rendered from the real 3D character models (no painted images): a full-body 3/4 view for dialogue
// and a head close-up for faces. Renders are cached as blob URLs and patched into <img data-pt> tags when ready.
import * as THREE from 'three';
import { loadChar } from '../core/chars.js';
import { Actor3D } from '../world/actor3d.js';

const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
let gfx = null, scene = null;
const urls = new Map(), jobs = new Map();
let chain = Promise.resolve();

export function initPortraits(g) { gfx = g; }
const keyOf = (key, kind) => `${key}|${kind}`;
export const cachedPortrait = (key, kind) => urls.get(keyOf(key, kind));

function buildScene() {
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa8a8c0, 1.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-2, 4, 6); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbfd0ff, 0.8); rim.position.set(3, 2, -4); scene.add(rim);
}

async function render(key, kind) {
  await loadChar(key);
  if (!scene) buildScene();
  const face = kind === 'face';
  const W = face ? 160 : 512, H = face ? 160 : 768;
  const r = gfx.renderer;
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const a = new Actor3D({ height: 1.8, tex: { front: key }, tint: 0xffffff, shadow: false, facing: 'down' });
  a.update(0.016); a.update(0.016);
  a.group.rotation.y = face ? 0.28 : 0.42;
  scene.add(a.group);
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.group);
  const hh = box.max.y - box.min.y;
  const cam = new THREE.PerspectiveCamera(24, W / H, 0.05, 40);
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  let cx = 0, cy, dist;
  if (face && a.tpl.isVrm && a.bones.head) {
    // frame the head bone, not the bounding box (staffs / hats / swords stick out above the head)
    const hp = a.bones.head.getWorldPosition(new THREE.Vector3());
    const bodyH = (hp.y - box.min.y) / 0.88;
    cx = hp.x; cy = hp.y + bodyH * 0.04; dist = (bodyH * 0.24 * 0.5) / t;
  } else if (face) { cy = box.max.y - hh * 0.27; dist = (hh * 0.56 * 0.5) / t; } // creatures: upper body
  else { cy = box.min.y + hh * 0.5; dist = (hh * 1.07 * 0.5) / t; }
  cam.position.set(cx, cy, dist); cam.lookAt(cx, cy, 0);
  // render with a transparent background
  const prevT = r.getRenderTarget(), prevC = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha();
  r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
  const buf = new Uint8Array(W * H * 4);
  r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  r.setRenderTarget(prevT); r.setClearColor(prevC, prevA);
  scene.remove(a.group); rt.dispose();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  ctx.putImageData(img, 0, 0);
  // PNG encoding finishes in the background; the GPU queue moves on to the next portrait straight away
  return { url: new Promise((res) => cv.toBlob((b) => res(URL.createObjectURL(b)), 'image/png')) };
}

/** Promise of the portrait URL (queued one at a time so the GPU is never flooded) */
export function ensurePortrait(key, kind = 'full') {
  const k = keyOf(key, kind);
  if (urls.has(k)) return Promise.resolve(urls.get(k));
  if (jobs.has(k)) return jobs.get(k);
  const stage = (chain = chain.then(() => render(key, kind).catch((e) => { console.warn('portrait failed', key, e); return { url: Promise.resolve(PLACEHOLDER) }; })));
  const p = stage.then((r) => r.url).then((u) => {
    if (u !== PLACEHOLDER) urls.set(k, u);
    jobs.delete(k);
    document.querySelectorAll(`img[data-pt="${k}"]`).forEach((i) => { i.src = u; });
    return u;
  });
  jobs.set(k, p);
  return p;
}

/** <img> html for a portrait: shows the cached render, or fills itself in when the render is done */
export function ptImg(key, kind = 'face', alt = '') {
  const u = cachedPortrait(key, kind);
  if (!u) ensurePortrait(key, kind);
  return `<img data-pt="${keyOf(key, kind)}" src="${u || PLACEHOLDER}" alt="${alt}">`;
}
export function setPortrait(img, key, kind = 'full') {
  const k = keyOf(key, kind);
  img.dataset.pt = k;
  img.src = urls.get(k) || PLACEHOLDER;
  if (!urls.has(k)) ensurePortrait(key, kind);
}
