// Asset access. Every texture / model / sound is a real file produced by tools/prepare-assets.py.
// In the single-file build the files are embedded as data URIs (window.__EMBED__), otherwise they are fetched.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// organic props are smooth-shaded so trees / bushes / rocks read as rounded, stylised shapes instead of faceted low-poly
const SMOOTH = /^(tree_|bush|rock_|mushroom|stump|log|flower|pumpkin|crystal|gem|fish)/;

const EMBED = window.__EMBED__ || null;
const BASE = window.__ASSET_BASE__ || 'assets/';
export const url = (p) => (EMBED ? EMBED[p] : BASE + p);

const texCache = new Map();
const imgLoader = new THREE.ImageLoader();
let maxAniso = 4;
export function setMaxAnisotropy(n) { maxAniso = n; }

export function loadTexture(path, opts = {}) {
  const k = path + (opts.repeat ? '|r' : '') + (opts.nearest ? '|n' : '');
  if (texCache.has(k)) return texCache.get(k);
  const p = new Promise((res, rej) => {
    imgLoader.load(url(path), (img) => {
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = opts.nearest ? THREE.NearestFilter : THREE.LinearFilter;
      if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      res(t);
    }, undefined, rej);
  });
  texCache.set(k, p);
  return p;
}

/** Tiled surface texture clone with its own repeat (shares the GPU upload). */
const surfaceBase = {};
export async function loadSurface(name) {
  if (!surfaceBase[name]) surfaceBase[name] = await loadTexture(`tex/${name}.webp`, { repeat: true });
  return surfaceBase[name];
}
export function tiled(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

// ---- models
const gltf = new GLTFLoader();
gltf.setMeshoptDecoder(MeshoptDecoder);
// The props ship with an odd (teal / salmon) palette; recolour them by material name to a natural painterly one.
const PALETTE = {
  leafsGreen: 0x62b85a, leafsDark: 0x2f7d55, leafsFall: 0xe5883a, woodBirch: 0xebe4d2, woodBark: 0x8a5a3c,
  woodBarkDark: 0x5c4030, woodInner: 0xe6cc9c, grass: 0x66b055, dirt: 0x8c8d98, stone: 0xcfd0dc, stoneDark: 0xa3a6b8,
  metalRed: 0xa84a3a, metal: 0xc09060, metalDark: 0x6a4a30, dark: 0x3b2c24, wood: 0xb98351, woodDark: 0x8c5e3a,
  colorRed: 0xd9505a, crystal: 0x66f0d0, rock: 0x8f8998, rockTrack: 0xa49ca8,
};
/** Weld coincident vertices and recompute normals so flat-shaded low-poly shapes read as rounded.
 *  The meshopt-quantised sources use interleaved Int16 buffers, so they are unpacked to plain floats first;
 *  on any failure the original geometry (with its own normals) is returned untouched. */
function smoothed(src) {
  try {
    const pos = src.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { arr[i * 3] = pos.getX(i); arr[i * 3 + 1] = pos.getY(i); arr[i * 3 + 2] = pos.getZ(i); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    if (src.index) g.setIndex(new THREE.BufferAttribute(new Uint32Array(src.index.array), 1));
    const m = mergeVertices(g, 1e-3);
    m.computeVertexNormals();
    return m;
  } catch (e) { console.warn('smooth failed', e); return src; }
}
const modelCache = new Map();
const loadedModels = {};
export function loadModel(name) {
  if (modelCache.has(name)) return modelCache.get(name);
  const p = new Promise((res, rej) => {
    gltf.load(url(`models/${name}.glb`), (g) => {
      // the props ship as flat-colour "unlit" materials; relight them so shadows and the sun shape them
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        if (SMOOTH.test(name) && o.geometry && !o.isSkinnedMesh) o.geometry = smoothed(o.geometry);
        const conv = (m) => {
          const n = new THREE.MeshToonMaterial({ color: m.color ? m.color.clone() : 0xffffff, map: m.map || null,
            transparent: m.transparent, opacity: m.opacity, side: m.side });
          if (m.name) n.name = m.name;
          if (PALETTE[m.name] !== undefined) n.color.setHex(PALETTE[m.name]);
          if (m.name === 'crystal') { n.emissive = new THREE.Color(0x2fc9a8); n.emissiveIntensity = 0.7; }
          if (m.name === 'Wood' || m.name === 'DarkWood') n.color.multiplyScalar(2.6);
          if (name === 'crate') n.color.setHex(0xc89a66);
          if (m.name === 'Atlas') { n.emissive = new THREE.Color(0x8a70ff); n.emissiveIntensity = 0.55; }
          if (m.emissive && m.emissive.getHex() > 0) { n.emissive = m.emissive.clone(); }
          return n;
        };
        o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
      });
      loadedModels[name] = { scene: g.scene, animations: g.animations };
      res(loadedModels[name]);
    }, undefined, rej);
  });
  modelCache.set(name, p);
  return p;
}
/** Synchronous clone of a model that preload() already fetched. */
export function model(name) {
  const m = loadedModels[name];
  if (!m) throw new Error('model not preloaded: ' + name);
  const c = SkeletonUtils.clone(m.scene);
  c.userData.animations = m.animations;
  return c;
}
export const surface = (name) => {
  if (!surfaceBase[name]) throw new Error('surface not preloaded: ' + name);
  return surfaceBase[name];
};

export async function loadBuffer(path) {
  const r = await fetch(url(path));
  return r.arrayBuffer();
}

/** Preload everything the game always needs. */
export async function preload(manifest, onProgress) {
  const jobs = [];
  for (const t of manifest.textures) jobs.push(loadSurface(t));
  for (const m of manifest.models) jobs.push(loadModel(m));
  let done = 0;
  await Promise.all(jobs.map((j) => j.then(() => onProgress && onProgress(++done / jobs.length))));
}
