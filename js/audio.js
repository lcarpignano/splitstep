// Sonidos (Web Audio) y voz (Web Speech).

class Sound {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
  }

  ensure() {
    try {
      // Safari 17+: reproducir aunque el iPhone esté en modo silencio.
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {}
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // Un buffer vacío "desbloquea" el audio en iOS dentro del gesto del usuario.
    const b = this.ctx.createBuffer(1, 1, 22050);
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.ctx.destination);
    s.start(0);
  }

  tone(freq, dur = 0.09, { type = 'sine', gain = 1, at = 0 } = {}) {
    if (!this.ctx || this.volume <= 0) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const v = Math.max(0.0001, this.volume * gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.setValueAtTime(v, t + Math.max(0.01, dur - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  play(name) {
    switch (name) {
      case 'cue':
        return this.tone(1320, 0.08, { type: 'triangle' });
      case 'pre':
        return this.tone(760, 0.06, { type: 'square', gain: 0.45 });
      case 'serve':
        this.tone(900, 0.05, { type: 'square', gain: 0.45 });
        return this.tone(900, 0.05, { type: 'square', gain: 0.45, at: 0.09 });
      case 'count':
        return this.tone(640, 0.12, { type: 'sine' });
      case 'go':
        return this.tone(1040, 0.32, { type: 'sine' });
      case 'error':
        return this.tone(196, 0.22, { type: 'square', gain: 0.5 });
      case 'ok':
        return this.tone(1560, 0.06, { type: 'sine', gain: 0.6 });
      case 'end':
        this.tone(880, 0.12);
        this.tone(1100, 0.12, { at: 0.14 });
        return this.tone(1320, 0.3, { at: 0.28 });
    }
  }
}

class Voice {
  constructor() {
    this.supported = 'speechSynthesis' in window;
    this.voices = [];
    this.voiceURI = null;
    this.rate = 1.05;
    this.volume = 1;
    this.listeners = new Set();
    if (this.supported) {
      this.loadVoices();
      speechSynthesis.addEventListener?.('voiceschanged', () => this.loadVoices());
    }
  }

  loadVoices() {
    const all = speechSynthesis.getVoices();
    const es = all.filter((v) => v.lang && v.lang.toLowerCase().startsWith('es'));
    this.voices = es.length ? es : all;
    this.listeners.forEach((fn) => fn(this.voices));
  }

  onVoices(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  current() {
    if (!this.voices.length) return null;
    return (
      this.voices.find((v) => v.voiceURI === this.voiceURI) ||
      this.voices.find((v) => /es[-_](AR|419|US|MX)/i.test(v.lang)) ||
      this.voices.find((v) => /es/i.test(v.lang)) ||
      null
    );
  }

  unlock() {
    if (!this.supported) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  say(text, { interrupt = true } = {}) {
    if (!this.supported || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    const v = this.current();
    if (v) u.voice = v;
    u.lang = v?.lang || 'es-ES';
    u.rate = this.rate;
    u.volume = this.volume;
    if (interrupt && (speechSynthesis.speaking || speechSynthesis.pending)) {
      speechSynthesis.cancel();
      // En Safari, hablar inmediatamente después de cancel() a veces se pierde.
      setTimeout(() => speechSynthesis.speak(u), 30);
    } else {
      speechSynthesis.speak(u);
    }
  }

  stop() {
    if (this.supported) speechSynthesis.cancel();
  }
}

export const sound = new Sound();
export const voice = new Voice();
