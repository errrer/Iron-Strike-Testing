// Tiny procedural sound engine (WebAudio) - no audio files needed.
export class Sound {
  constructor() { this.ctx = null; this.master = null; this.noise = null; }

  init() {
    if (this.ctx) { this.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();         // layered gunshots are loud: a limiter keeps them from clipping
      comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.14;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate; // 1s of noise
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      // a short room tail shared by every gunshot; built a moment after init so the first key press never stalls
      setTimeout(() => { try {
        const c = this.ctx, rl = Math.floor(c.sampleRate * 0.9), ir = c.createBuffer(2, rl, c.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const dd = ir.getChannelData(ch); let e = 1; const k = Math.pow(0.0008, 1 / rl); for (let i = 0; i < rl; i++, e *= k) dd[i] = (Math.random() * 2 - 1) * e; }
        const rv = c.createConvolver(); rv.buffer = ir; const rg = c.createGain(); rg.gain.value = 0.55; rv.connect(rg); rg.connect(this.master); this.rev = rv;
      } catch (e) { /* no reverb */ } }, 400);
    } catch (e) { this.ctx = null; }
  }

  resume() { try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* ignore */ } }

  _bus(vol, pan, wet = 0) {
    const g = this.ctx.createGain(); g.gain.value = vol;
    if (wet > 0 && this.rev) { const sg = this.ctx.createGain(); sg.gain.value = wet; g.connect(sg); sg.connect(this.rev); }
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(this.master); }
    else g.connect(this.master);
    return g;
  }

  _noise(t, dur, freq, vol, bus, type = 'lowpass') {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.1), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  _tone(t, f0, f1, dur, vol, bus, type = 'sine') {
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }

  swish(vol = 0.6) {
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(vol, 0);
    this._noise(t, 0.16, 2600, 0.5, bus); this._tone(t, 900, 240, 0.1, 0.12, bus);
  }

  // every shot is four layers - a sharp crack, the body of the blast, a low thump and a room tail - shaped per weapon class
  shot(w, vol = 1, pan = 0) {
    if (w && w.cls === 'melee') { this.swish(vol * 0.5); return; }
    const quiet = w && w.quiet != null; if (quiet) vol *= w.quiet;                 // suppressed
    if (!this.ctx || vol < 0.04) return;
    const cls = w.cls || 'ar', s = w.snd, t = this.ctx.currentTime, j = 0.92 + Math.random() * 0.16;
    const K = { pistol: [0.7, 0.18, 0.55, 0.15], smg: [0.6, 0.2, 0.4, 0.2], ar: [0.85, 0.3, 0.7, 0.3], lmg: [0.8, 0.35, 1.0, 0.42], dmr: [1.0, 0.42, 0.9, 0.5], sniper: [1.2, 0.6, 1.1, 0.75], shotgun: [0.5, 0.42, 1.2, 0.5] }[cls] || [0.8, 0.28, 0.7, 0.3];
    const [crack, wet, boom, tail] = K, bus = this._bus(vol, pan, quiet ? wet * 0.3 : wet);
    if (!quiet) this._noise(t, 0.03 + crack * 0.025, 7600 * j, crack, bus, 'highpass');       // the crack
    this._noise(t, s.len, s.f * j, 0.9, bus);                                                // the body of the blast
    this._tone(t, 170 * j, 42, 0.12 + boom * 0.06, 0.9 * s.thump * (0.7 + boom * 0.3), bus);  // the thump
    if (boom > 0.85) this._tone(t, 95, 28, 0.3, 0.55 * boom, bus);
    this._noise(t + 0.015, s.len * (1.6 + tail * 2.4), 850, 0.35 * tail + 0.12, bus);       // the tail
    if (!quiet && (cls === 'ar' || cls === 'smg' || cls === 'lmg')) this._noise(t + 0.045, 0.02, 2600, 0.12, this._bus(vol, pan), 'bandpass');      // bolt carrier tick
  }
  step(vol = 0.3, pan = 0) {
    if (!this.ctx || vol < 0.03) return;
    const t = this.ctx.currentTime, bus = this._bus(vol, pan);
    this._noise(t, 0.07, 500, 0.7, bus);
  }
  hit(head = false) {                                       // crisp tick (a harder double-tick for a headshot)
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.34, 0);
    this._noise(t, 0.018, 5200, 0.6, bus, 'highpass'); this._tone(t, head ? 2600 : 1900, head ? 2000 : 1500, 0.035, 0.5, bus, 'square');
    if (head) { this._noise(t + 0.045, 0.02, 6000, 0.5, bus, 'highpass'); this._tone(t + 0.045, 3100, 2400, 0.04, 0.4, bus, 'square'); }
  }
  squelch(v = 1) { try { const t = this.ctx.currentTime, b = this._bus(0.35 * v, 0); this._noise(t, 0.16, 500, 0.5, b, 'lowpass'); this._noise(t + 0.03, 0.12, 260, 0.45, b, 'lowpass'); this._tone(t, 110, 60, 0.12, 0.3, b, 'sine'); } catch (e) {} }
  kill() {                                                  // a dull thud under a short bright ping
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.42, 0);
    this._tone(t, 150, 55, 0.16, 0.9, bus); this._noise(t, 0.05, 1400, 0.4, bus);
    this._tone(t + 0.06, 1500, 1500, 0.16, 0.35, bus, 'triangle'); this._tone(t + 0.06, 2250, 2250, 0.12, 0.18, bus, 'sine');
  }
  hurt() {
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.5, 0);
    this._tone(t, 120, 50, 0.15, 0.9, bus); this._noise(t, 0.1, 900, 0.4, bus);
  }
  reload(stage = 0) {
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.35, 0);
    this._noise(t, 0.05, 3500, 0.8, bus, 'bandpass'); this._tone(t, stage ? 600 : 400, stage ? 500 : 300, 0.05, 0.4, bus, 'square');
  }
  click() {
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.3, 0);
    this._noise(t, 0.03, 4000, 0.7, bus, 'bandpass');
  }
  switchGun() {                                             // cloth rustle, then the gun seats with a clack
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.3, 0);
    this._noise(t, 0.12, 1500, 0.28, bus, 'lowpass'); this._noise(t + 0.13, 0.03, 2400, 0.6, bus, 'bandpass'); this._tone(t + 0.13, 520, 300, 0.05, 0.35, bus, 'square');
  }
  // --- reload cues, played from the viewmodel animation so every click lines up with the hands ---
  cue(name) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    switch (name) {
      case 'release': { const b = this._bus(0.32, 0); this._noise(t, 0.02, 4200, 0.7, b, 'bandpass'); this._tone(t, 2300, 1700, 0.02, 0.3, b, 'square'); break; }            // mag catch
      case 'magout': { const b = this._bus(0.3, 0); this._noise(t, 0.1, 1900, 0.35, b, 'bandpass'); this._tone(t + 0.07, 320, 200, 0.05, 0.3, b); break; }                 // mag slides out
      case 'rustle': { const b = this._bus(0.22, 0); this._noise(t, 0.16, 1100, 0.3, b, 'lowpass'); break; }                                                                // hand in the pouch
      case 'magin': { const b = this._bus(0.4, 0); this._noise(t, 0.045, 1300, 0.75, b, 'bandpass'); this._tone(t, 430, 240, 0.07, 0.5, b); this._noise(t + 0.05, 0.02, 3000, 0.4, b, 'bandpass'); break; }   // mag seats
      case 'tug': { const b = this._bus(0.2, 0); this._noise(t, 0.025, 2600, 0.5, b, 'bandpass'); break; }
      case 'boltback': { const b = this._bus(0.36, 0); this._noise(t, 0.05, 3000, 0.7, b, 'highpass'); this._tone(t, 900, 520, 0.06, 0.3, b, 'square'); this._noise(t + 0.06, 0.04, 800, 0.4, b); break; }
      case 'boltfwd': { const b = this._bus(0.42, 0); this._noise(t, 0.04, 2200, 0.85, b, 'bandpass'); this._tone(t, 520, 260, 0.07, 0.5, b, 'square'); this._noise(t + 0.03, 0.05, 900, 0.5, b); break; }
      case 'shell': { const b = this._bus(0.3, 0); this._noise(t, 0.02, 3500, 0.5, b, 'bandpass'); this._tone(t + 0.03, 380, 240, 0.05, 0.35, b); break; }
      case 'pump': { const b = this._bus(0.45, 0); this._noise(t, 0.05, 1600, 0.8, b, 'bandpass'); this._tone(t, 300, 150, 0.08, 0.5, b, 'square'); this._noise(t + 0.12, 0.05, 2000, 0.8, b, 'bandpass'); this._tone(t + 0.12, 360, 190, 0.08, 0.5, b, 'square'); break; }
    }
  }
  spawn() {
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.3, 0);
    this._tone(t, 400, 800, 0.15, 0.5, bus, 'triangle');
  }
  groan(vol = 0.4, pan = 0, seed = 0) {
    if (!this.ctx || vol < 0.03) return; const t = this.ctx.currentTime, bus = this._bus(vol, pan), f = 70 + (seed % 7) * 9;
    this._tone(t, f * 1.6, f, 0.55, 0.55, bus, 'sawtooth'); this._noise(t, 0.5, 500, 0.25, bus, 'bandpass');
  }
  cash() {
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.35, 0);
    this._tone(t, 1400, 1400, 0.07, 0.5, bus, 'square'); this._tone(t + 0.07, 2100, 2100, 0.14, 0.5, bus, 'square');
  }
  beep(high = false) {
    if (!this.ctx) return; const t = this.ctx.currentTime, bus = this._bus(0.3, 0);
    this._tone(t, high ? 1200 : 700, high ? 1200 : 700, 0.18, 0.6, bus, 'sine');
  }
}
