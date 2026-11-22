// Опциональный chiptune 128 BPM (WebAudio): kick / clap / hat / bass / arp. Синхронизирован с анимационными часами.
import { BEAT } from './anim.js';

export const Snd = {
  ctx: null, on: false, next: 0, noise: null,
  init() {
    if (this.ctx) return; const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    this.ctx = new A(); this.master = this.ctx.createGain(); this.master.gain.value = .5; this.master.connect(this.ctx.destination);
    const n = this.ctx.sampleRate * .5, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noise = b;
    this.wave = this.ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, .5, .33, .25, .2, .16, .14]));
  },
  env(g, t0, a, d, peak) { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(.0008, t0 + a + d); },
  kick(t0) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.frequency.setValueAtTime(160, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + .12); this.env(g, t0, .003, .22, 1); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + .3); },
  hat(t0, v = .22, len = .04) { const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000; this.env(g, t0, .001, len, v); s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + len + .02); },
  clap(t0) { const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = .8; this.env(g, t0, .002, .14, .6); s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + .2); },
  tone(t0, freq, dur, type, vol, wave) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); if (wave) o.setPeriodicWave(this.wave); else o.type = type; o.frequency.value = freq; this.env(g, t0, .004, dur, vol); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + .05); },
  sched(animT) {
    if (!this.on || !this.ctx) return; const lookahead = .25, step16 = BEAT / 4, base = this.ctx.currentTime - animT;
    while (this.next * step16 < animT + lookahead) {
      const k = this.next++, at = base + k * step16 + .03; if (at < this.ctx.currentTime - .02) continue;
      const bar = Math.floor(k / 16) % 8, i16 = k % 16, chord = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]][bar % 4], f = m => 440 * Math.pow(2, (m - 69) / 12);
      if (i16 % 4 === 0) this.kick(at); if (i16 % 8 === 4) this.clap(at); if (i16 % 2 === 0) this.hat(at, i16 % 4 === 2 ? .26 : .1, .035); if (i16 % 4 === 3 && k % 3 === 0) this.hat(at, .15, .06);
      if (i16 % 4 === 2 || i16 === 0 || i16 === 7 || i16 === 10) this.tone(at, f(chord[0] - 24 + (i16 === 7 ? 12 : 0)), .16, 'sawtooth', .22);
      const arp = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 12][i16 % 4] + (bar >= 4 && i16 % 8 > 3 ? 12 : 0); this.tone(at, f(arp), .11, 'square', .09, true);
      if (i16 === 0 && bar % 2 === 0) this.tone(at, f(chord[2] + 24), .5, 'triangle', .1);
    }
  },
  toggle(on, animT) { this.init(); if (!this.ctx) return; this.on = on; if (on) { this.ctx.resume(); this.next = Math.floor(animT / (BEAT / 4)) + 1; } else this.ctx.suspend(); }
};
