// Small generative score engine (WebAudio). Used for field / town / dungeon themes because only one CC0 music file
// (the battle theme) was available. Each theme = scale + chord loop + seeded melody, played with plucks, bells and pads.
const THEMES = {
  title:  { bpm: 66,  root: 57, scale: [0, 2, 3, 7, 8, 10], chords: [[0, 7, 15], [-4, 3, 8], [-2, 5, 10], [-5, 2, 7]], arp: 'slow', melody: 0.55, pad: 0.16, bell: 0.5, bass: 0.0, seed: 3 },
  town:   { bpm: 96,  root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], arp: 'bounce', melody: 0.6, pad: 0.1, bell: 0.15, bass: 0.35, shaker: 0.45, seed: 11 },
  night:  { bpm: 60,  root: 55, scale: [0, 2, 3, 7, 9], chords: [[0, 7, 15], [-4, 3, 8], [-7, 0, 5], [-5, 2, 7]], arp: 'slow', melody: 0.4, pad: 0.18, bell: 0.6, bass: 0.0, seed: 5 },
  forest: { bpm: 72,  root: 62, scale: [0, 2, 3, 7, 9], chords: [[0, 7, 15], [-2, 5, 10], [-4, 3, 8], [-5, 2, 7]], arp: 'slow', melody: 0.5, pad: 0.15, bell: 0.2, bass: 0.18, seed: 21 },
  shrine: { bpm: 58,  root: 57, scale: [0, 2, 3, 7, 8], chords: [[0, 7, 12], [-4, 3, 7], [2, 7, 12], [-5, 2, 8]], arp: 'koto', melody: 0.5, pad: 0.12, bell: 0.7, bass: 0.0, drum: 0.5, seed: 8 },
  port:   { bpm: 112, root: 55, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [-2, 2, 5], [-5, -1, 2], [0, 4, 9]], arp: 'bounce', melody: 0.65, pad: 0.08, bell: 0.1, bass: 0.45, shaker: 0.7, seed: 17 },
  cave:   { bpm: 54,  root: 52, scale: [0, 3, 5, 7, 10], chords: [[0, 7, 15], [-5, 2, 7], [-2, 5, 10], [-7, 0, 5]], arp: 'sparse', melody: 0.2, pad: 0.2, bell: 0.85, bass: 0.2, seed: 29 },
  castle: { bpm: 80,  root: 49, scale: [0, 2, 3, 5, 7, 8, 11], chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], arp: 'sparse', melody: 0.35, pad: 0.22, bell: 0.3, bass: 0.55, drum: 0.6, seed: 13 },
  sad:    { bpm: 56,  root: 57, scale: [0, 2, 3, 7, 8], chords: [[0, 7, 15], [-4, 3, 8], [-5, 2, 7], [-7, 0, 5]], arp: 'slow', melody: 0.45, pad: 0.18, bell: 0.5, bass: 0.0, seed: 33 },
  calm:   { bpm: 70,  root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], arp: 'slow', melody: 0.5, pad: 0.14, bell: 0.3, bass: 0.0, seed: 41 },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Music {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.bus = ctx.createGain(); this.bus.gain.value = 1;
    // cheap reverb: decaying noise impulse
    const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.32;
    this.bus.connect(out); this.bus.connect(this.verb); this.verb.connect(this.wet); this.wet.connect(out);
    const nl = ctx.sampleRate * 0.3; this.noise = ctx.createBuffer(1, nl, ctx.sampleRate);
    const nd = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
  }
  _env(g, t, a, peak, dur, rel = 0.1) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.05) + rel);
  }
  pluck(m, t, dur, v, bus, type = 'triangle') {
    bus = bus || this.cur || this.bus;
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o2.type = 'sine'; o.frequency.value = mtof(m); o2.frequency.value = mtof(m + 12);
    f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(500, t + dur);
    this._env(g, t, 0.006, v, dur);
    const g2 = c.createGain(); g2.gain.value = 0.25;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(bus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }
  bell(m, t, v) {
    const c = this.ctx;
    for (const [k, vv, d] of [[1, 1, 2.2], [2.76, 0.35, 1.2], [5.4, 0.12, 0.6]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = mtof(m) * k;
      this._env(g, t, 0.004, v * vv, d, 0.3); o.connect(g); g.connect(this.cur || this.bus); o.start(t); o.stop(t + d + 0.5);
    }
  }
  pad(ms, t, dur, v) {
    const c = this.ctx;
    for (const m of ms) for (const det of [-6, 7]) {
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      f.type = 'lowpass'; f.frequency.value = 760; f.Q.value = 0.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v / (ms.length * 2), t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
      o.connect(f); f.connect(g); g.connect(this.cur || this.bus); o.start(t); o.stop(t + dur + 0.8);
    }
  }
  bass(m, t, dur, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = mtof(m);
    this._env(g, t, 0.01, v, dur, 0.1); o.connect(g); g.connect(this.cur || this.bus); o.start(t); o.stop(t + dur + 0.3);
  }
  hat(t, v) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000; this._env(g, t, 0.002, v, 0.04, 0.02);
    s.connect(f); f.connect(g); g.connect(this.cur || this.bus); s.start(t); s.stop(t + 0.1);
  }
  drum(t, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    this._env(g, t, 0.003, v, 0.28, 0.05); o.connect(g); g.connect(this.cur || this.bus); o.start(t); o.stop(t + 0.5);
  }

  play(name) {
    const th = THEMES[name] || THEMES.calm;
    const R = rng(th.seed * 977 + 13);
    const ctx = this.ctx, beat = 60 / th.bpm;
    const out = ctx.createGain(); out.gain.value = 0; out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    // each theme has its own bus so it can fade independently
    const local = ctx.createGain(); local.connect(out); out.connect(this.bus);
    let stopped = false, bar = 0, next = ctx.currentTime + 0.25;
    const sc = th.scale, nsc = sc.length;
    const note = (deg, oct = 0) => th.root + sc[((deg % nsc) + nsc) % nsc] + 12 * (Math.floor(deg / nsc) + oct);
    let mdeg = nsc * 1 + 2;
    const patterns = [[0, 2, 3, 4], [0, 1.5, 2, 3.5], [0, 0.5, 1, 2.5, 3], [1, 2, 3], [0, 3]];
    const schedule = () => {
      if (stopped) return;
      this.cur = local;
      while (next < ctx.currentTime + 1.4) {
        const chord = th.chords[bar % th.chords.length];
        const t0 = next, dur = beat * 4;
        this.pad(chord.map((c) => th.root - 12 + c), t0, dur, th.pad);
        if (th.bass) { this.bass(th.root - 24 + chord[0], t0, beat * 1.8, th.bass * 0.55); this.bass(th.root - 24 + chord[0] + (R() < 0.5 ? 7 : 0), t0 + beat * 2, beat * 1.6, th.bass * 0.45); }
        // arpeggio
        const tones = chord.map((c) => th.root + c + 12);
        const steps = th.arp === 'bounce' ? 8 : th.arp === 'koto' ? 6 : th.arp === 'sparse' ? 3 : 4;
        for (let i = 0; i < steps; i++) {
          if (th.arp === 'sparse' && R() < 0.3) continue;
          const st = th.arp === 'bounce' ? beat * 0.5 * i : th.arp === 'koto' ? beat * (i * 0.66 + (R() < 0.3 ? 0.17 : 0)) : th.arp === 'sparse' ? beat * (i * 1.4) : beat * i;
          const m = tones[th.arp === 'bounce' ? [0, 1, 2, 1, 0, 1, 2, 1][i] : i % tones.length];
          this.pluck(m, t0 + st, beat * (th.arp === 'koto' ? 1.4 : 0.9), 0.07, local);
        }
        // melody
        if (R() < th.melody) {
          const pat = patterns[Math.floor(R() * patterns.length)];
          for (const p of pat) {
            if (R() < 0.18) continue;
            mdeg += Math.floor(R() * 5) - 2; mdeg = Math.max(nsc - 1, Math.min(nsc * 2 + 2, mdeg));
            this.pluck(note(mdeg), t0 + p * beat, beat * 1.5, 0.11, local, 'sine');
          }
        }
        if (th.bell && R() < th.bell) { const b0 = Math.floor(R() * 4); this.bell(note(nsc + Math.floor(R() * nsc), 1), t0 + b0 * beat + (R() < 0.5 ? 0 : beat * 0.5), 0.07 * (0.6 + th.bell * 0.5)); }
        if (th.shaker) for (let i = 0; i < 8; i++) if (R() < th.shaker) this.hat(t0 + i * beat * 0.5, i % 2 ? 0.035 : 0.05);
        if (th.drum && (bar % 2 === 0)) { this.drum(t0, 0.35 * th.drum); this.drum(t0 + beat * 2.5, 0.22 * th.drum); }
        next += dur; bar++;
      }
      timer = setTimeout(schedule, 220);
    };
    let timer = setTimeout(schedule, 0);
    return {
      stop: (fade = 0.8) => {
        stopped = true; clearTimeout(timer);
        out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
        out.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
        setTimeout(() => { try { out.disconnect(); } catch {} }, (fade + 4) * 1000);
      },
    };
  }
  /** short musical stings */
  fanfare() {
    this.cur = null;
    const t = this.ctx.currentTime + 0.05, b = 0.16, r = 60;
    const seq = [[0, 0], [4, 1], [7, 2], [12, 3], [7, 4.5], [12, 5], [16, 6.5], [19, 8]];
    seq.forEach(([n, i]) => this.pluck(r + n, t + i * b, b * 3, 0.18, null, 'triangle'));
    this.pad([r - 12, r - 5, r + 4, r + 7], t, b * 12, 0.5);
    this.bell(r + 31, t + b * 8, 0.12);
  }
  jingle(kind) {
    this.cur = null;
    const t = this.ctx.currentTime + 0.02;
    if (kind === 'levelup') [0, 4, 7, 12, 16].forEach((n, i) => this.pluck(72 + n, t + i * 0.09, 0.5, 0.14));
    else if (kind === 'defeat') [0, -2, -5, -9, -12].forEach((n, i) => this.pluck(60 + n, t + i * 0.32, 1.2, 0.16, null, 'triangle'));
    else if (kind === 'discover') { this.bell(84, t, 0.13); this.bell(91, t + 0.12, 0.1); }
    else if (kind === 'sparkle') [0, 7, 12, 19].forEach((n, i) => this.bell(84 + n, t + i * 0.07, 0.08));
  }
}
