// Title screen: a night scene in the real 3D engine (campfire, party, falling stars) + menu.
import * as THREE from 'three';
import { World } from '../world/world.js';
import { Actor3D as Actor } from '../world/actor3d.js';
import { loadChar } from '../core/chars.js';
import { h, root, pick, esc } from './ui.js';
import { audio } from '../core/audio.js';
import { lastSlot } from '../state.js';

const CREDITS = `
<h2>HOSHIKAGE CHRONICLE</h2>
<p>An HD-2D anime JRPG built with three.js. Every character, prop, texture, song and sound effect is a real file
from the open sources below &mdash; nothing visual is drawn by code.</p>
<h3>Characters (3D, cel-shaded)</h3>
<p><b>VRoid Studio CC0 models</b> by the <b>VRoid Project / pixiv</b> (CC0) &mdash; base avatars, AvatarSample D&ndash;G, Sakurada Fumiriya, Sendagaya Shino. Loader: <code>@pixiv/three-vrm</code> (MIT).</p>
<h3>Creatures, props, textures &amp; sound effects (CC0)</h3>
<p><b>Quaternius</b> (rigged creatures, low-poly props), <b>Kenney</b> (sound packs), <b>Screaming Brain Studios</b> (texture packs), as bundled and licence-verified by
<code>@netforge/asset-library-files</code>.</p>
<h3>Music (CC0, OpenGameArt)</h3>
<p><i>The Field Of Dreams</i> (anonymous) &middot; <i>Town Theme RPG</i> by Bonsaiheldin &middot; <i>Crystal Cave</i> by messersm &middot; <i>Doomed</i> &amp; <i>Waking the devil</i> by Alexander Ehlers &middot;
<i>Epic Boss Battle</i> by Juhani Junkala &middot; <i>Battle Theme A</i> by cynicmusic. Forest, shrine and port themes are generated live by the in-game score engine.</p>
<h3>Fonts</h3>
<p>Zen Maru Gothic and Cinzel via Fontsource (SIL Open Font Licence 1.1).</p>
<h3>Engine</h3>
<p><a>three.js</a> (MIT). Game design, story, systems and code: this project.</p>
<p style="opacity:.6;margin-top:30px">Press Esc / click to close</p>`;

export class Title {
  constructor(G) {
    this.G = G;
    this.world = new World(G.gfx);
    this.world.pitch = 0.2; this.world.dist = 16;
    this.el = h('div', 'title hidden');
    root.appendChild(this.el);
    this.built = false;
    this.stars = [];
    this.t = 0;
  }
  async build() {
    const def = { size: [30, 24], mood: 'night', seed: 3, bright: 1.6, build(b) {
      b.ground('grass', { tint: 0xa8d890, tile: 3 });
      b.patch('dirt', 10, 9, 10, 8, { tint: 0xd0b890 });
      b.forestEdge(['tree_pine', 'tree_pine_tall', 'tree_oak', 'tree_dark'], 5);
      b.scatter(['tree_pine', 'tree_pine_tall'], [1, 1, 28, 8], 14);
      b.scatter(['bush', 'flower_red', 'mushroom_red', 'rock_small'], [4, 4, 22, 16], 30);
      b.fire(15, 13, {});
      b.prop('tent', 20.5, 11.5, { ry: -0.6 }); b.prop('log', 11.2, 14.6, { ry: 0.3 }); b.prop('log', 17.8, 15.3, { ry: -0.4 });
      b.glowCrystal(5, 7, { color: 0xb8a0ff, s: 1.1, lightOn: false });
    } };
    await this.world.load(def);
    await Promise.all(['ren', 'haru', 'airi', 'daigo'].map(loadChar));
    const mk = (key, x, z, hh, ex = {}) => { const a = new Actor({ height: hh, tex: { front: key, ...ex }, tint: this.world.mood.sprite }); a.position.set(x, 0, z); this.world.add(a.group); return a; };
    this.actors = [
      mk('ren', 12.8, 14.4, 1.95), mk('haru', 14.2, 15.6, 1.5), mk('airi', 16.4, 15.4, 1.95), mk('daigo', 17.8, 14.2, 1.9),
    ];
    this.actors[0].setDir('right'); this.actors[1].setDir('right'); this.actors[3].setDir('left'); this.actors[2].setDir('down');
    this.world.setFocus(new THREE.Vector3(15, -0.3, 13), true);
    this.starMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.built = true;
  }
  async show() {
    if (!this.built) await this.build();
    const G = this.G;
    G.gfx.setScene(this.world.scene, this.world.camera);
    G.mode = 'title';
    this.el.classList.remove('hidden');
    const last = lastSlot();
    this.el.innerHTML = `<div class="logo"><div class="l1">HOSHIKAGE</div><div class="l2">CHRONICLE</div><div class="l3">星影 &nbsp;·&nbsp; SHARDS OF THE MOON</div></div>
      <div class="tmenu panel"></div><div class="ver">v1.0 · click or press Enter</div>`;
    const menu = this.el.querySelector('.tmenu');
    const opts = [];
    if (last) opts.push(['Continue', 'continue']);
    opts.push(['New Game', 'new']);
    if (last) opts.push(['Load Game', 'load']);
    opts.push(['Credits', 'credits']);
    audio.playMusic('title');
    for (;;) {
      menu.innerHTML = '';
      const rows = opts.map(([t]) => { const r = h('div', 'row', esc(t)); menu.appendChild(r); return r; });
      const i = await pick(rows, { cancelable: false });
      const k = opts[i][1];
      audio.unlock();
      if (k === 'credits') { await this.credits(); continue; }
      if (k === 'new') { this.el.classList.add('hidden'); await G.newGame(); return; }
      if (k === 'continue') { this.el.classList.add('hidden'); await G.loadGame(last.n); return; }
      if (k === 'load') {
        const n = await G.menus.loadPicker();
        if (n !== null) { this.el.classList.add('hidden'); await G.loadGame(n); return; }
      }
    }
  }
  async credits() {
    const c = h('div', 'creditsp', CREDITS);
    root.appendChild(c);
    const { input } = await import('../core/input.js');
    await new Promise((res) => { const off = input.push((a) => { if (a === 'cancel' || a === 'ok' || a === 'menu') { off(); res(); } return true; }); c.addEventListener('click', () => { off(); res(); }, { once: true }); });
    c.remove();
  }
  update(dt) {
    this.t += dt;
    const w = this.world;
    w.yaw = Math.sin(this.t * 0.16) * 0.28;
    w.setFocus(new THREE.Vector3(15, -0.3, 13));
    w.update(dt);
    this.actors.forEach((a) => a.update(dt));
    // falling stars
    if (Math.random() < dt * 0.9) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 4), this.starMat);
      m.position.set(-10 + Math.random() * 40, 16 + Math.random() * 8, -6 - Math.random() * 14);
      m.rotation.set(0.5, -0.9, 0); m.userData.v = new THREE.Vector3(14, -9, 4).multiplyScalar(0.7 + Math.random() * 0.8); m.userData.life = 1.6;
      this.world.add(m); this.stars.push(m);
    }
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.position.addScaledVector(s.userData.v, dt); s.userData.life -= dt;
      s.lookAt(s.position.clone().add(s.userData.v));
      if (s.userData.life <= 0) { this.world.remove(s); s.geometry.dispose(); this.stars.splice(i, 1); }
    }
  }
  hide() { this.el.classList.add('hidden'); }
}
