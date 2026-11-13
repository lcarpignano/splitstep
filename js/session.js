// Motor de sesión: series, descansos, estímulos aleatorios y medición de reacción.
import { nextCue } from './drills.js';
import { cueView, fmtMs, fmtDuration } from './render.js';
import { sound, voice } from './audio.js';
import { motion } from './motion.js';

class Cancelled extends Error {}

const rand = (a, b) => a + Math.random() * (b - a);

// Reloj pausable: los wait() se congelan durante la pausa y se cancelan al terminar.
class Clock {
  constructor(signal) {
    this.signal = signal;
    this.paused = false;
    this.pausedTotal = 0;
    this.pauseStart = 0;
    this.pauseCount = 0;
    this.timers = new Set();
    signal.addEventListener('abort', () => {
      for (const t of this.timers) {
        clearTimeout(t.id);
        t.reject(new Cancelled());
      }
      this.timers.clear();
    });
  }

  now() {
    const p = this.paused ? performance.now() - this.pauseStart : 0;
    return performance.now() - this.pausedTotal - p;
  }

  wait(ms) {
    if (this.signal.aborted) return Promise.reject(new Cancelled());
    return new Promise((resolve, reject) => {
      const t = { remaining: Math.max(0, ms), start: 0, id: null, resolve, reject };
      t.arm = () => {
        t.start = performance.now();
        t.id = setTimeout(() => {
          this.timers.delete(t);
          resolve();
        }, t.remaining);
      };
      this.timers.add(t);
      if (!this.paused) t.arm();
    });
  }

  waitUntil(clockTime) {
    return this.wait(clockTime - this.now());
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.pauseCount++;
    this.pauseStart = performance.now();
    for (const t of this.timers) {
      clearTimeout(t.id);
      t.remaining = Math.max(0, t.remaining - (performance.now() - t.start));
    }
  }

  resume() {
    if (!this.paused) return;
    this.pausedTotal += performance.now() - this.pauseStart;
    this.paused = false;
    for (const t of this.timers) t.arm();
  }
}

export function runSession(drill, cfg, settings) {
  return new Promise((resolve) => new SessionRunner(drill, cfg, settings, resolve).run());
}

class SessionRunner {
  constructor(drill, cfg, settings, done) {
    this.drill = drill;
    this.cfg = cfg;
    this.settings = settings;
    this.done = done;
    this.abort = new AbortController();
    this.clock = new Clock(this.abort.signal);
    this.cueHistory = [];
    this.camera = cfg.measure === 'camera' && drill.camera && motion.active;
    this.tap = cfg.measure === 'tap';
    this.measured = this.camera || this.tap;
    this.voiceOn = cfg.voice && drill.allowVoice !== false;
    this.tapWaiters = new Set();
    this.set = 0;
    this.rep = 0;
    this.result = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ts: Date.now(),
      drillId: drill.id,
      drillName: drill.name,
      category: drill.category,
      measure: this.measured ? cfg.measure : 'none',
      setsPlanned: cfg.sets,
      setsDone: 0,
      cues: 0,
      rts: [],
      misses: 0,
      nogoCount: 0,
      commissions: 0,
      falseStarts: 0,
      completed: false,
      durationSec: 0,
    };
    this.buildDom();
  }

  // ---------- DOM ----------
  buildDom() {
    const el = document.createElement('div');
    el.className = 'session';
    el.innerHTML = `
      <div class="stage neutral"><span class="fix"></span></div>
      <div class="hud hud-top">
        <div class="hud-left"><span class="hud-name"></span><span class="hud-set"></span></div>
        <div class="hud-progress"></div>
        <button class="hud-btn" data-act="pause" aria-label="Pausa">
          <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        </button>
      </div>
      <div class="hud hud-bottom">
        <span class="hud-status"></span>
        <span class="hud-rt"></span>
      </div>
      <div class="cam-wrap" hidden><video class="cam-preview" playsinline muted autoplay></video><div class="cam-meter"><i></i><b></b></div></div>
      <div class="pause-overlay" hidden>
        <div class="pause-card">
          <h2>Pausa</h2>
          <p class="pause-info"></p>
          <button class="btn primary" data-act="resume">Continuar</button>
          <button class="btn ghost" data-act="finish">Terminar sesión</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    this.stage = el.querySelector('.stage');
    this.hudName = el.querySelector('.hud-name');
    this.hudSet = el.querySelector('.hud-set');
    this.hudProgress = el.querySelector('.hud-progress');
    this.hudStatus = el.querySelector('.hud-status');
    this.hudRt = el.querySelector('.hud-rt');
    this.pauseEl = el.querySelector('.pause-overlay');
    this.hudName.textContent = this.drill.name;

    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'pause') this.pause();
      else if (act === 'resume') this.resume();
      else if (act === 'finish') this.cancel();
      else if (act === 'skip') this.skipRest?.();
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-act]') || this.clock.paused) return;
      const now = performance.now();
      const ts = e.timeStamp > 0 && Math.abs(now - e.timeStamp) < 500 ? e.timeStamp : now;
      for (const w of this.tapWaiters) w(ts);
      this.tapWaiters.clear();
    });

    if (this.camera) {
      const wrap = el.querySelector('.cam-wrap');
      if (this.settings.showPreview) {
        wrap.hidden = false;
        el.querySelector('.cam-preview').srcObject = motion.stream;
      }
      const bar = wrap.querySelector('.cam-meter i');
      const mark = wrap.querySelector('.cam-meter b');
      const scale = (v) => Math.min(100, (v / (motion.threshold * 3)) * 100);
      mark.style.left = `${scale(motion.threshold)}%`;
      this.offFrame = motion.onFrame((f) => {
        const v = motion.ref ? f.refMotion : f.frameMotion;
        bar.style.width = `${scale(v)}%`;
        bar.classList.toggle('over', v > motion.threshold);
      });
    }

    this.onVisibility = () => {
      if (document.hidden) this.pause();
      else this.requestWakeLock();
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.hudTimer = setInterval(() => this.updateHud(), 250);
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !document.hidden) this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {}
  }

  showNeutral() {
    this.currentCue = null;
    this.stage.style.background = '';
    this.stage.className = 'stage neutral';
    this.stage.innerHTML = '<span class="fix"></span>';
  }

  showText(text, cls = '') {
    this.currentCue = null;
    this.stage.style.background = '';
    this.stage.className = 'stage text';
    this.stage.innerHTML = `<span class="txt ${cls}">${text}</span>`;
  }

  showCue(cue) {
    const v = cueView(cue);
    this.currentCue = cue;
    this.stage.style.background = v.bg || '';
    this.stage.className = `stage cue ${cue.type}`;
    this.stage.innerHTML = v.html;
    // Momento del estímulo. No esperamos a requestAnimationFrame: si se retrasa, el tiempo de reacción saldría subestimado.
    return performance.now();
  }

  status(text) {
    this.hudStatus.textContent = text;
  }

  updateHud() {
    const { cfg } = this;
    this.hudSet.textContent = this.set ? `Serie ${this.set}/${cfg.sets}` : '';
    if (this.phase === 'set') {
      if (cfg.mode === 'time') {
        const left = Math.max(0, cfg.time - (this.clock.now() - this.setStart) / 1000);
        this.hudProgress.textContent = fmtDuration(Math.ceil(left));
      } else {
        this.hudProgress.textContent = `${this.rep}/${cfg.reps}`;
      }
    } else this.hudProgress.textContent = '';
  }

  // ---------- Control ----------
  pause() {
    if (this.clock.paused || this.abort.signal.aborted) return;
    this.clock.pause();
    voice.stop();
    const r = this.result;
    this.pauseEl.querySelector('.pause-info').textContent = `${r.cues} estímulos · serie ${this.set || 1} de ${this.cfg.sets}`;
    this.pauseEl.hidden = false;
  }

  resume() {
    this.pauseEl.hidden = true;
    this.requestWakeLock();
    this.clock.resume();
  }

  cancel() {
    this.pauseEl.hidden = true;
    this.abort.abort();
  }

  waitTap(timeout) {
    return new Promise((resolve, reject) => {
      const timer = timeout == null ? null : setTimeout(() => finish(null), timeout);
      const w = (ts) => finish(ts);
      const finish = (v) => {
        clearTimeout(timer);
        this.tapWaiters.delete(w);
        this.abort.signal.removeEventListener('abort', onAbort);
        resolve(v);
      };
      const onAbort = () => {
        clearTimeout(timer);
        this.tapWaiters.delete(w);
        reject(new Cancelled());
      };
      this.tapWaiters.add(w);
      this.abort.signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  // Respuesta al estímulo: timestamp del movimiento/toque o null si no hubo.
  awaitResponse(onset, timeout) {
    if (this.camera) {
      motion.setReference();
      return motion.waitForOnset({ since: onset, timeout, signal: this.abort.signal });
    }
    return this.waitTap(timeout);
  }

  // Durante el período previo: ¿se movió/tocó antes de tiempo?
  async watchFalseStart(ms) {
    if (this.camera) {
      motion.setReference();
      const ts = await motion.waitForOnset({ since: performance.now(), timeout: ms, signal: this.abort.signal });
      motion.clearReference();
      if (ts != null) return true;
      return false;
    }
    return (await this.waitTap(ms)) != null;
  }

  // ---------- Flujo ----------
  async run() {
    this.requestWakeLock();
    this.startClock = this.clock.now();
    try {
      for (let s = 1; s <= this.cfg.sets; s++) {
        this.set = s;
        await this.countdown(s);
        await this.runSet();
        this.result.setsDone = s;
        if (s < this.cfg.sets && this.cfg.rest > 0) await this.restPhase(s);
      }
      this.result.completed = true;
      this.finish();
    } catch (e) {
      if (!(e instanceof Cancelled) && e?.name !== 'AbortError') console.error(e);
      this.finish();
    }
  }

  async countdown(s) {
    const { cfg, clock } = this;
    this.phase = 'countdown';
    this.status('');
    this.hudRt.textContent = '';
    if (this.settings.announce) voice.say(cfg.sets > 1 ? `Serie ${s}` : 'Preparado');
    this.showText(cfg.sets > 1 ? `Serie ${s}<small>de ${cfg.sets}</small>` : 'Preparado', 'title');
    await clock.wait(1300);
    for (const n of [3, 2, 1]) {
      this.showText(String(n), 'count');
      sound.play('count');
      await clock.wait(800);
    }
    this.showText('¡YA!', 'count go');
    sound.play('go');
    await clock.wait(650);
    this.showNeutral();
  }

  async runSet() {
    const { cfg, drill, clock } = this;
    this.phase = 'set';
    this.rep = 0;
    this.setStart = clock.now();
    let lastOnset = null;
    let lastInterval = 0;

    while (true) {
      const elapsed = clock.now() - this.setStart;
      if (cfg.mode === 'reps' && this.rep >= cfg.reps) break;
      if (cfg.mode === 'time' && elapsed >= cfg.time * 1000) break;
      const progress = cfg.mode === 'reps' ? this.rep / cfg.reps : elapsed / (cfg.time * 1000);
      const preDelay = drill.preCue ? rand(...drill.preCue.delay) : 0;

      // 1) Espera hasta el próximo estímulo
      if (this.measured) {
        if (this.camera) {
          this.status('Quieto…');
          await motion.waitForStill({ hold: 300, timeout: 5000, signal: this.abort.signal });
          this.status('');
        }
        const fp = drill.foreperiod ? rand(...drill.foreperiod) : rand(800, 2000);
        if (drill.falseStart) {
          if (await this.watchFalseStart(fp)) {
            this.result.falseStarts++;
            sound.play('error');
            this.showText('¡Antes de tiempo!', 'msg bad');
            await clock.wait(1300);
            this.showNeutral();
            await clock.wait(600);
            continue;
          }
        } else await clock.wait(fp);
      } else {
        let interval = rand(cfg.intervalMin, cfg.intervalMax) * 1000;
        if (cfg.accelerate) interval *= 1 - 0.4 * progress;
        lastInterval = interval;
        if (lastOnset == null) await clock.wait(900);
        else await clock.waitUntil(lastOnset + interval - preDelay);
        if (cfg.mode === 'time' && clock.now() - this.setStart >= cfg.time * 1000) break;
      }

      // 2) Señal previa (split step) + pantalla neutra breve para separar estímulos iguales
      if (drill.preCue) {
        this.showNeutral();
        sound.play(drill.preCue.beep);
        await clock.wait(preDelay);
      } else if (this.currentCue) {
        this.showNeutral();
        await clock.wait(180);
      }

      // 3) Estímulo
      const cue = nextCue(drill, this.cueHistory);
      this.cueHistory.push(cue);
      if (this.cueHistory.length > 10) this.cueHistory.shift();
      const onset = this.showCue(cue);
      lastOnset = clock.now();
      // La escucha de la respuesta arranca ya, antes de cualquier otra cosa.
      const response = this.measured ? this.awaitResponse(onset, drill.responseTimeout || 2000) : null;
      if (cfg.cueBeep) sound.play('cue');
      if (this.voiceOn && cue.say) voice.say(cue.say);
      this.rep++;
      this.result.cues++;
      if (cue.nogo) this.result.nogoCount++;
      this.updateHud();

      if (cfg.display > 0) {
        clock
          .wait(cfg.display)
          .then(() => {
            if (this.currentCue === cue) this.showNeutral();
          })
          .catch(() => {});
      }

      // 4) Respuesta
      if (this.measured) {
        const pauses = clock.pauseCount;
        const ts = await response;
        if (this.camera) motion.clearReference();
        if (clock.pauseCount !== pauses) {
          this.showNeutral();
          continue; // se pausó en medio de la medición: descartamos la muestra
        }
        const rt = ts == null ? null : ts - onset;
        await this.feedback(cue, rt);
      }
    }

    // dejar visible el último estímulo un momento
    if (!this.measured) await clock.wait(Math.min(1500, lastInterval || 1500));
    this.showNeutral();
    this.phase = 'between';
  }

  async feedback(cue, rt) {
    const { clock, drill, result } = this;
    if (cue.nogo) {
      if (rt != null) {
        result.commissions++;
        sound.play('error');
        this.hudRt.textContent = '✗ era rojo';
      } else this.hudRt.textContent = '✓ bien quieto';
      await clock.wait(rt == null ? 200 : 600);
      this.showNeutral();
      return;
    }
    if (rt == null) {
      result.misses++;
      this.hudRt.textContent = 'sin respuesta';
      this.showNeutral();
      return;
    }
    if (drill.falseStart && rt < 100) {
      // demasiado rápido para ser una reacción: anticipación
      result.falseStarts++;
      result.cues--;
      this.rep--;
      sound.play('error');
      this.showText('¡Antes de tiempo!', 'msg bad');
      await clock.wait(1300);
      this.showNeutral();
      return;
    }
    result.rts.push(Math.round(rt));
    this.hudRt.textContent = fmtMs(rt);
    if (drill.falseStart) {
      this.showText(`${Math.round(rt)}<small>ms</small>`, 'rt');
      sound.play('ok');
      await clock.wait(1200);
    } else {
      await clock.wait(600);
    }
    this.showNeutral();
  }

  async restPhase(s) {
    const { cfg, clock } = this;
    this.phase = 'rest';
    this.status('');
    if (this.settings.announce) voice.say(`Descanso, ${cfg.rest} segundos`);
    let skipped = false;
    let skipResolve;
    const skipP = new Promise((r) => (skipResolve = r));
    this.skipRest = () => {
      skipped = true;
      skipResolve();
    };
    this.stage.style.background = '';
    this.stage.className = 'stage rest';
    this.stage.innerHTML = `<div class="rest-box">
        <span class="rest-label">Descanso</span>
        <span class="rest-time"></span>
        <span class="rest-next">Sigue la serie ${s + 1} de ${cfg.sets}</span>
        <button class="btn ghost small" data-act="skip">Saltar descanso</button>
      </div>`;
    const timeEl = this.stage.querySelector('.rest-time');
    for (let left = cfg.rest; left > 0 && !skipped; left--) {
      timeEl.textContent = fmtDuration(left);
      if (left === 10 && this.settings.announce && cfg.rest > 15) voice.say('Diez segundos');
      if (left <= 3) sound.play('count');
      await Promise.race([clock.wait(1000), skipP]);
    }
    this.skipRest = null;
  }

  finish() {
    clearInterval(this.hudTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.offFrame?.();
    this.wakeLock?.release?.().catch(() => {});
    if (!this.abort.signal.aborted) this.abort.abort();
    const r = this.result;
    r.durationSec = Math.round((this.clock.now() - this.startClock) / 1000);
    voice.stop();
    if (r.completed) {
      sound.play('end');
      if (this.settings.announce) voice.say('Terminado. Buen trabajo.');
    }
    motion.clearReference();
    this.el.remove();
    this.done(r.cues > 0 ? r : null);
  }
}
