// Renderer + HD-2D post-processing (bloom, tilt-shift blur, grade/vignette/fade).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { setMaxAnisotropy } from './assets.js';
import { gfxOptions } from '../world/actor3d.js';

const TiltShift = {
  uniforms: { tDiffuse: { value: null }, focus: { value: 0.5 }, band: { value: 0.22 }, amount: { value: 1.6 }, aspect: { value: 1 }, texel: { value: new THREE.Vector2(1 / 1280, 1 / 720) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float focus, band, amount, aspect; uniform vec2 texel; varying vec2 vUv;
    void main(){
      float d = smoothstep(band, band + 0.38, abs(vUv.y - focus));
      float r = d * amount;
      vec4 c = texture2D(tDiffuse, vUv);
      if (r < 0.05) { gl_FragColor = c; return; }
      vec4 sum = c; float w = 1.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.399963;
        float rad = sqrt((float(i) + 0.5) / 12.0) * r;
        vec2 o = vec2(cos(a), sin(a)) * rad * texel * 3.0;
        sum += texture2D(tDiffuse, vUv + o); w += 1.0;
      }
      gl_FragColor = sum / w;
    }`,
};
const Grade = {
  uniforms: { tDiffuse: { value: null }, vig: { value: 0.32 }, fade: { value: 0 }, fadeColor: { value: new THREE.Color(0x000000) }, tint: { value: new THREE.Color(1, 1, 1) }, sat: { value: 1.08 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vig, fade, sat; uniform vec3 fadeColor, tint; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, sat) * tint;
      vec2 q = vUv - 0.5; float v = 1.0 - smoothstep(0.35, 0.95, length(q * vec2(1.0, 1.15))) * vig * 1.6;
      c.rgb *= v;
      c.rgb = mix(c.rgb, fadeColor, fade);
      gl_FragColor = c;
    }`,
};

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.quality = 'high';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
    this._build();
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  _build() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.quality === 'high' ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.6, 1.0);
    this.tilt = new ShaderPass(TiltShift);
    this.grade = new ShaderPass(Grade);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.tilt);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.setQuality(this.quality);
  }
  setQuality(q) {
    this.quality = q;
    gfxOptions.lowFx = q === 'low';
    const hi = q === 'high';
    this.bloom.enabled = hi;
    this.tilt.enabled = hi;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.composer.renderTarget1.samples = hi ? 4 : 0;
    this.composer.renderTarget2.samples = hi ? 4 : 0;
    this.renderer.setPixelRatio(q === 'low' ? 1 : Math.min(devicePixelRatio || 1, 2));
    this.resize();
  }
  setScene(scene, camera) { this.renderPass.scene = scene; this.renderPass.camera = camera; this.scene = scene; this.camera = camera; this.resize(); }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const px = this.renderer.getPixelRatio();
    this.tilt.uniforms.texel.value.set(1 / (w * px), 1 / (h * px));
    if (this.camera && this.camera.isPerspectiveCamera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.w = w; this.h = h;
  }
  set fade(v) { this.grade.uniforms.fade.value = v; }
  get fade() { return this.grade.uniforms.fade.value; }
  setFadeColor(hex) { this.grade.uniforms.fadeColor.value.set(hex); }
  setGrade({ tint, sat, vig, focus, band, amount } = {}) {
    if (tint !== undefined) this.grade.uniforms.tint.value.set(tint);
    if (sat !== undefined) this.grade.uniforms.sat.value = sat;
    if (vig !== undefined) this.grade.uniforms.vig.value = vig;
    if (focus !== undefined) this.tilt.uniforms.focus.value = focus;
    if (band !== undefined) this.tilt.uniforms.band.value = band;
    if (amount !== undefined) this.tilt.uniforms.amount.value = amount;
  }
  render() { this.composer.render(); }
  /** project world position to CSS pixels */
  project(v3, out = new THREE.Vector3()) {
    out.copy(v3).project(this.camera);
    return { x: (out.x * 0.5 + 0.5) * this.w, y: (-out.y * 0.5 + 0.5) * this.h, z: out.z };
  }
}
