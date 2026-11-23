// 3D character templates: VRoid anime models (.vrm, cel-shaded MToon) and rigged CC0 creature/human GLBs.
// Templates are parsed once; every on-screen actor is a skeleton-aware clone with its own materials.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { url } from './assets.js';
import { specFor } from '../data/cast.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.register((p) => new VRMLoaderPlugin(p));

export const VRM_BONES = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm',
  'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'];

const cache = new Map(); // file -> Promise<template>

/** make a loaded GLB's materials respond to the scene lights (the packs ship unlit flat materials) */
function litify(scene) {
  scene.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    const conv = (m) => {
      if (m.isMeshBasicMaterial || m.isMeshStandardMaterial) {
        const n = new THREE.MeshToonMaterial({ color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest });
        n.name = m.name; return n;
      }
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}

function measure(scene) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  return { height: Math.max(0.01, box.max.y - box.min.y), minY: box.min.y, box };
}

export function loadTemplate(file) {
  if (cache.has(file)) return cache.get(file);
  const p = (async () => {
    const isVrm = file.endsWith('.vrm');
    const gltf = await loader.loadAsync(url(`chars/${file}`));
    const tpl = { file, isVrm, scene: gltf.scene, animations: gltf.animations || [] };
    if (isVrm) {
      const vrm = gltf.userData.vrm;
      VRMUtils.rotateVRM0(vrm); // VRM 0.x faces -Z; make everything face +Z (towards the camera)
      tpl.bones = {};
      for (const b of VRM_BONES) { const n = vrm.humanoid.getRawBoneNode(b); if (n) tpl.bones[b] = n.name; }
      // hair/skirt physics are not simulated: drop the spring-bone helper objects (they do not survive cloning)
      const junk = [];
      gltf.scene.traverse((o) => { if (/SpringBone/.test(o.constructor.name)) junk.push(o); });
      junk.forEach((o) => o.removeFromParent());
    } else litify(gltf.scene);
    // neutral stance: bounds of the rest pose
    const m = measure(gltf.scene);
    tpl.height = m.height; tpl.minY = m.minY;
    return tpl;
  })();
  cache.set(file, p);
  return p;
}

const tplSync = new Map();
export async function prepareTemplate(file) { const t = await loadTemplate(file); tplSync.set(file, t); return t; }
export const templateSync = (file) => tplSync.get(file);
/** make sure the 3D model behind a character key is parsed and ready */
export const loadChar = (key) => prepareTemplate(specFor(key).file);

/** a fresh, independently posable copy of a template (own materials) */
export function instantiate(tpl, { lowFx = false } = {}) {
  const model = SkeletonUtils.clone(tpl.scene);
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.frustumCulled = false;
    o.castShadow = !tpl.isVrm || true;
    o.receiveShadow = false;
    const one = (m) => {
      const c = m.clone();
      if (c.isOutline && lowFx) c.visible = false; // cheaper rendering on weak GPUs
      if (c.color) mats.push({ m: c, base: c.color.clone() });
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return { model, mats };
}
