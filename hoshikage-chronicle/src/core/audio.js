// WebAudio manager: CC0 sound effects + the CC0 battle theme (real files) and generative field music (music.js).
import { loadBuffer } from './assets.js';
import { Music } from './music.js';

class AudioMgr {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.7, sfx: 0.8 };
    try { Object.assign(this.vol, JSON.parse(localStorage.getItem('hoshikage.vol') || '{}')); } catch {}
    this.buffers = new Map();
    this.current = null;
    this.musicName = null;
    this.ready = false;
  }
  unlock() {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    this.musicBus.connect(comp); this.sfxBus.connect(comp); comp.connect(this.master); this.master.connect(this.ctx.destination);
    this.music = new Music(this.ctx, this.musicBus);
    this.ready = true;
    this.applyVol();
    if (this.pendingMusic) this.playMusic(this.pendingMusic);
  }
  applyVol() {
    if (!this.ready) return;
    this.master.gain.value = this.vol.master;
    this.musicBus.gain.value = this.vol.music * 0.9;
    this.sfxBus.gain.value = this.vol.sfx;
  }
  setVol(k, v) { this.vol[k] = v; this.applyVol(); try { localStorage.setItem('hoshikage.vol', JSON.stringify(this.vol)); } catch {} }
  async _buf(name, ext = 'mp3') {
    if (this.buffers.has(name)) return this.buffers.get(name);
    const p = loadBuffer(`audio/${name}.${ext}`).then((ab) => this.ctx.decodeAudioData(ab)).catch(() => null);
    this.buffers.set(name, p);
    return p;
  }
  async sfx(name, { vol = 1, rate = 1, delay = 0 } = {}) {
    if (!this.ready) return;
    const b = await this._buf(name);
    if (!b) return;
    const s = this.ctx.createBufferSource();
    s.buffer = b; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.sfxBus);
    s.start(this.ctx.currentTime + delay);
  }
  async playMusic(name) {
    if (!this.ready) { this.pendingMusic = name; return; }
    if (name === this.musicName) return;
    this.musicName = name;
    this._stopCurrent(0.8);
    if (!name) return;
    if (name === 'battle_theme_a') {
      const b = await this._buf('battle_theme_a', 'mp3');
      if (!b || this.musicName !== name) return;
      const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.loopStart = 0; s.loopEnd = b.duration;
      const g = this.ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.85, this.ctx.currentTime + 0.6);
      s.connect(g); g.connect(this.musicBus); s.start();
      this.current = { stop: (fade) => { g.gain.cancelScheduledValues(this.ctx.currentTime); g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime); g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fade); s.stop(this.ctx.currentTime + fade + 0.05); } };
    } else {
      this.current = this.music.play(name);
    }
  }
  _stopCurrent(fade) { if (this.current) { this.current.stop(fade); this.current = null; } }
  stopMusic(fade = 0.8) { this.musicName = null; this.pendingMusic = null; this._stopCurrent(fade); }
  fanfare() { if (this.ready) this.music.fanfare(); }
  jingle(kind) { if (this.ready) this.music.jingle(kind); }
}
export const audio = new AudioMgr();
