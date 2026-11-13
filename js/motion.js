// Detección de movimiento con la cámara frontal.
// Reduce cada cuadro a 64x48 en escala de grises y mide qué fracción de píxeles cambió.
// Se compensa el brillo medio para que los ajustes automáticos de exposición no disparen falsos positivos.

const W = 64;
const H = 48;
const N = W * H;
const PIX_THRESHOLD = 24; // diferencia mínima de gris (0–255) para contar un píxel como "cambiado"

export class MotionDetector {
  constructor() {
    this.stream = null;
    this.video = null;
    this.threshold = 0.03; // fracción de píxeles que cuenta como "movimiento"
    this.listeners = new Set();
    this.running = false;
    this.frameMotion = 0;
    this.refMotion = 0;
    this.lastTs = 0;
    this.fps = 0;
    this.cur = new Uint8Array(N);
    this.prev = new Uint8Array(N);
    this.ref = null;
    this.curMean = 0;
    this.prevMean = 0;
    this.refMean = 0;
    this.hasPrev = false;
  }

  get active() {
    return !!this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  async start() {
    if (this.active) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no permite usar la cámara (se necesita HTTPS).');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60, min: 24 } },
      audio: false,
    });
    if (!this.video) {
      const v = document.createElement('video');
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.muted = true;
      v.autoplay = true;
      v.className = 'motion-source';
      document.body.appendChild(v);
      this.video = v;
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
    this.video.srcObject = this.stream;
    await this.video.play();
    this.hasPrev = false;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.ref = null;
  }

  loop() {
    if (!this.running) return;
    const v = this.video;
    if ('requestVideoFrameCallback' in v) {
      v.requestVideoFrameCallback((now, meta) => {
        // captureTime (si existe y está en la misma base temporal) elimina la latencia de procesamiento.
        const ct = meta && meta.captureTime;
        const ts = ct && ct <= now && now - ct < 300 ? ct : now;
        this.process(ts);
        this.loop();
      });
    } else {
      requestAnimationFrame((now) => {
        this.process(now);
        this.loop();
      });
    }
  }

  process(ts) {
    const v = this.video;
    if (!v.videoWidth) return;
    this.ctx.drawImage(v, 0, 0, W, H);
    const d = this.ctx.getImageData(0, 0, W, H).data;
    const cur = this.cur;
    let sum = 0;
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      const g = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
      cur[i] = g;
      sum += g;
    }
    this.curMean = sum / N;
    this.frameMotion = this.hasPrev ? diffFraction(cur, this.curMean, this.prev, this.prevMean) : 0;
    this.refMotion = this.ref ? diffFraction(cur, this.curMean, this.ref, this.refMean) : 0;
    if (this.lastTs) {
      const dt = ts - this.lastTs;
      if (dt > 0) this.fps = this.fps ? this.fps * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
    }
    this.lastTs = ts;
    // swap
    const tmp = this.prev;
    this.prev = cur;
    this.cur = tmp;
    this.prevMean = this.curMean;
    this.hasPrev = true;
    const frame = { ts, frameMotion: this.frameMotion, refMotion: this.refMotion };
    this.listeners.forEach((fn) => fn(frame));
  }

  onFrame(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // Toma el último cuadro como referencia (momento en que aparece el estímulo).
  setReference() {
    this.ref = new Uint8Array(this.prev);
    this.refMean = this.prevMean;
  }

  clearReference() {
    this.ref = null;
  }

  get stillThreshold() {
    return Math.max(0.004, this.threshold * 0.35);
  }

  // Espera a que el atleta esté quieto `hold` ms seguidos (o hasta `timeout`).
  waitForStill({ hold = 300, timeout = 5000, signal } = {}) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      let stillSince = null;
      const off = this.onFrame((f) => {
        if (f.frameMotion < this.stillThreshold) {
          stillSince ??= f.ts;
          if (f.ts - stillSince >= hold) done(true);
        } else stillSince = null;
        if (performance.now() - start > timeout) done(false);
      });
      const onAbort = () => {
        off();
        reject(new DOMException('cancelado', 'AbortError'));
      };
      const done = (ok) => {
        off();
        signal?.removeEventListener('abort', onAbort);
        resolve(ok);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  // Resuelve con el timestamp del primer cuadro con movimiento respecto de la referencia
  // (2 cuadros seguidos sobre el umbral), o null si no hubo movimiento antes de `timeout`.
  waitForOnset({ since, timeout = 2000, signal } = {}) {
    return new Promise((resolve, reject) => {
      let candidate = null;
      const deadline = performance.now() + timeout;
      const off = this.onFrame((f) => {
        if (f.ts >= since && f.refMotion > this.threshold) {
          if (candidate !== null) return done(candidate);
          candidate = f.ts;
        } else candidate = null;
        if (performance.now() > deadline) done(null);
      });
      const timer = setTimeout(() => done(null), timeout + 120);
      const onAbort = () => {
        off();
        clearTimeout(timer);
        reject(new DOMException('cancelado', 'AbortError'));
      };
      const done = (v) => {
        off();
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(v);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

function diffFraction(a, ma, b, mb) {
  const offset = ma - mb;
  let count = 0;
  for (let i = 0; i < N; i++) {
    const d = a[i] - b[i] - offset;
    if (d > PIX_THRESHOLD || d < -PIX_THRESHOLD) count++;
  }
  return count / N;
}

export const motion = new MotionDetector();
