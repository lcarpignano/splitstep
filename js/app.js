import { DRILLS, CATEGORIES, getDrill, defaultConfig, estimateMinutes } from './drills.js';
import { cueMini, courtSVG, fmtMs, fmtDuration, esc } from './render.js';
import { sound, voice } from './audio.js';
import { motion } from './motion.js';
import { runSession } from './session.js';
import * as store from './storage.js';

const APP_VERSION = '1.0.0';
const app = document.getElementById('app');
let settings = store.loadSettings();
applySettings();

function applySettings() {
  sound.volume = settings.volume;
  voice.voiceURI = settings.voiceURI;
  voice.rate = settings.rate;
  motion.threshold = settings.threshold;
}

function updateSettings(patch) {
  settings = { ...settings, ...patch };
  store.saveSettings(settings);
  applySettings();
}

// ---------------- Router ----------------
function route() {
  stopCalibration();
  const hash = location.hash || '#/';
  const [, view, param] = hash.split('/');
  if (view === 'drill' && getDrill(param)) renderDrill(getDrill(param));
  else if (view === 'history') renderHistory();
  else if (view === 'settings') renderSettings();
  else renderHome();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

function tabBar(active) {
  const tab = (href, key, label, icon) =>
    `<a href="${href}" class="tab${active === key ? ' on' : ''}">${icon}<span>${label}</span></a>`;
  return `<nav class="tabbar">
    ${tab('#/', 'home', 'Drills', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M5.2 7.5c3.2 1.4 5 4.4 5 8.3M18.8 16.5c-3.2-1.4-5-4.4-5-8.3"/></svg>')}
    ${tab('#/history', 'history', 'Historial', '<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>')}
    ${tab('#/settings', 'settings', 'Ajustes', '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>')}
  </nav>`;
}

function isStandalone() {
  return navigator.standalone || matchMedia('(display-mode: standalone)').matches;
}

// ---------------- Home ----------------
function drillConfig(drill) {
  return { ...defaultConfig(drill), ...(store.loadDrillConfig(drill.id) || {}) };
}

function renderHome() {
  const showTip = !isStandalone() && !localStorage.getItem('splitstep.tipDismissed');
  const groups = CATEGORIES.map((cat) => {
    const drills = DRILLS.filter((d) => d.category === cat);
    if (!drills.length) return '';
    return `<h2 class="section-title">${cat}</h2>
      <div class="cards">${drills
        .map((d) => {
          const cfg = drillConfig(d);
          const preview = d.icon || (d.generate ? d.legend[0].cue : d.pool[0]);
          const vol = cfg.mode === 'time' ? `${cfg.sets}×${fmtDuration(cfg.time)}` : `${cfg.sets}×${cfg.reps}`;
          return `<a class="card" href="#/drill/${d.id}">
            <div class="card-icon">${cueMini(preview)}</div>
            <div class="card-body">
              <h3>${esc(d.name)}</h3>
              <p>${esc(d.summary)}</p>
              <span class="meta">~${estimateMinutes(d, cfg)} min · ${vol}${cfg.measure !== 'none' ? ` · ${cfg.measure === 'camera' ? 'cámara' : 'toque'}` : ''}</span>
            </div>
            <svg class="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
          </a>`;
        })
        .join('')}</div>`;
  });
  app.innerHTML = `
    <main class="page">
      <header class="masthead">
        <img src="icons/icon-192.png" alt="" class="logo">
        <div><h1>SplitStep</h1><p>Entrenamiento de reacción para tenis</p></div>
      </header>
      ${
        showTip
          ? `<div class="tip"><p><b>Instalala en el iPhone:</b> en Safari tocá <b>Compartir</b> → <b>Agregar a inicio</b>. Así se abre a pantalla completa y funciona sin conexión.</p><button class="tip-x" data-act="dismiss-tip" aria-label="Cerrar">✕</button></div>`
          : ''
      }
      ${groups.join('')}
    </main>
    ${tabBar('home')}`;
  app.querySelector('[data-act="dismiss-tip"]')?.addEventListener('click', () => {
    localStorage.setItem('splitstep.tipDismissed', '1');
    renderHome();
  });
}

// ---------------- Drill ----------------
const FIELDS = {
  reps: { label: 'Repeticiones por serie', min: 5, max: 100, step: 1, fmt: (v) => v },
  time: { label: 'Tiempo por serie', min: 20, max: 600, step: 10, fmt: (v) => fmtDuration(v) },
  sets: { label: 'Series', min: 1, max: 10, step: 1, fmt: (v) => v },
  rest: { label: 'Descanso entre series', min: 0, max: 180, step: 5, fmt: (v) => (v ? fmtDuration(v) : 'sin descanso') },
  intervalMin: { label: 'Intervalo mínimo', min: 0.8, max: 10, step: 0.1, fmt: (v) => `${v.toFixed(1)} s` },
  intervalMax: { label: 'Intervalo máximo', min: 0.8, max: 12, step: 0.1, fmt: (v) => `${v.toFixed(1)} s` },
};

function stepper(key, cfg) {
  const f = FIELDS[key];
  return `<div class="row">
    <span class="row-label">${f.label}</span>
    <div class="stepper">
      <button data-step="${key}" data-dir="-1" ${cfg[key] <= f.min ? 'disabled' : ''} aria-label="Menos">−</button>
      <output>${f.fmt(cfg[key])}</output>
      <button data-step="${key}" data-dir="1" ${cfg[key] >= f.max ? 'disabled' : ''} aria-label="Más">+</button>
    </div>
  </div>`;
}

function toggle(key, label, cfg, hint = '') {
  return `<label class="row toggle-row">
    <span class="row-label">${label}${hint ? `<small>${hint}</small>` : ''}</span>
    <input type="checkbox" class="switch" data-toggle="${key}" ${cfg[key] ? 'checked' : ''}>
  </label>`;
}

function segmented(key, options, value) {
  return `<div class="segmented">${options
    .map(
      (o) =>
        `<button data-seg="${key}" data-val="${o.value}" class="${o.value === value ? 'on' : ''}" ${o.disabled ? 'disabled' : ''}>${o.label}</button>`
    )
    .join('')}</div>`;
}

function renderDrill(drill) {
  let cfg = drillConfig(drill);
  if (!drill.camera && cfg.measure === 'camera') cfg.measure = 'none';

  const legend = drill.court
    ? `<div class="court-wrap">${courtSVG()}</div>`
    : drill.legend
      ? `<div class="legend">${drill.legend
          .map((l) => `<div class="legend-item">${cueMini(l.cue)}<span>${esc(l.meaning)}</span></div>`)
          .join('')}</div>`
      : '';

  app.innerHTML = `
    <main class="page detail">
      <header class="navbar"><a href="#/" class="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>Drills</a></header>
      <section class="hero">
        <span class="pill">${drill.category}</span>
        <h1>${esc(drill.name)}</h1>
        <p>${esc(drill.description)}</p>
      </section>
      ${legend}
      <section class="panel">
        <h2>Cómo se hace</h2>
        <ol class="howto">${drill.howto.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>
      </section>
      <section class="panel" id="config"></section>
      <div class="start-bar"><button class="btn primary big" id="start"></button></div>
    </main>`;

  const configEl = app.querySelector('#config');
  const startBtn = app.querySelector('#start');

  const draw = () => {
    const measureOpts = [
      ...(drill.requiresMeasure ? [] : [{ value: 'none', label: 'Sin medir' }]),
      { value: 'camera', label: 'Cámara', disabled: !drill.camera },
      { value: 'tap', label: 'Toque' },
    ];
    const timed = cfg.measure === 'none';
    configEl.innerHTML = `
      <h2>Configuración</h2>
      <div class="row col">
        <span class="row-label">Medir reacción</span>
        ${segmented('measure', measureOpts, cfg.measure)}
        <small class="note">${
          cfg.measure === 'camera'
            ? 'Apoyá el teléfono a 2–3 m con tu cuerpo entero en cuadro. Cada estímulo espera a que estés quieto y mide cuándo arrancás.'
            : cfg.measure === 'tap'
              ? 'Tocá la pantalla en cuanto reacciones. Ideal con el teléfono en la mano.'
              : drill.cameraNote || 'Los estímulos salen a intervalos aleatorios, sin medir tiempos.'
        }</small>
      </div>
      <div class="row col">
        <span class="row-label">Duración de cada serie</span>
        ${segmented('mode', [
          { value: 'reps', label: 'Repeticiones' },
          { value: 'time', label: 'Tiempo' },
        ], cfg.mode)}
      </div>
      ${stepper(cfg.mode === 'time' ? 'time' : 'reps', cfg)}
      ${stepper('sets', cfg)}
      ${cfg.sets > 1 ? stepper('rest', cfg) : ''}
      ${timed ? stepper('intervalMin', cfg) + stepper('intervalMax', cfg) : ''}
      <div class="row">
        <span class="row-label">Estímulo visible</span>
        <select data-select="display">
          ${[
            [0, 'Hasta el siguiente'],
            [250, '0,25 s (flash)'],
            [350, '0,35 s (flash)'],
            [500, '0,5 s'],
            [800, '0,8 s'],
            [1200, '1,2 s'],
          ]
            .map(([v, l]) => `<option value="${v}" ${cfg.display === v ? 'selected' : ''}>${l}</option>`)
            .join('')}
        </select>
      </div>
      ${drill.allowVoice === false ? '' : toggle('voice', 'Voz que nombra el estímulo', cfg, 'Útil si no podés ver la pantalla')}
      ${toggle('cueBeep', 'Beep con cada estímulo', cfg)}
      ${timed ? toggle('accelerate', 'Acelerar el ritmo', cfg, 'El intervalo baja hasta el 60% en cada serie') : ''}
      <button class="link" data-act="reset">Restablecer valores del drill</button>`;
    startBtn.textContent = `Empezar · ~${estimateMinutes(drill, cfg)} min`;
  };

  const save = () => {
    store.saveDrillConfig(drill.id, cfg);
    draw();
  };

  configEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.step) {
      const key = b.dataset.step;
      const f = FIELDS[key];
      let v = Math.round((cfg[key] + f.step * Number(b.dataset.dir)) * 10) / 10;
      v = Math.min(f.max, Math.max(f.min, v));
      cfg[key] = v;
      if (key === 'intervalMin' && cfg.intervalMax < v) cfg.intervalMax = v;
      if (key === 'intervalMax' && cfg.intervalMin > v) cfg.intervalMin = v;
      save();
    } else if (b.dataset.seg) {
      cfg[b.dataset.seg] = b.dataset.val;
      save();
    } else if (b.dataset.act === 'reset') {
      store.saveDrillConfig(drill.id, null);
      cfg = defaultConfig(drill);
      draw();
    }
  });
  configEl.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.toggle) cfg[t.dataset.toggle] = t.checked;
    if (t.dataset.select) cfg[t.dataset.select] = Number(t.value);
    save();
  });

  startBtn.addEventListener('click', () => startSession(drill, cfg));
  draw();
}

async function startSession(drill, cfg) {
  // Debe ejecutarse dentro del gesto del usuario para desbloquear audio y voz en iOS.
  sound.ensure();
  voice.unlock();
  const useCamera = cfg.measure === 'camera' && drill.camera;
  if (useCamera) {
    try {
      await motion.start();
    } catch (err) {
      alert(`No se pudo abrir la cámara: ${err.message || err.name}. Revisá el permiso de cámara para esta app.`);
      return;
    }
  }
  document.body.classList.add('in-session');
  const result = await runSession(drill, { ...cfg }, settings);
  document.body.classList.remove('in-session');
  if (useCamera) motion.stop();
  if (result) {
    store.addHistory(result);
    showSummary(result, { onRepeat: () => startSession(drill, cfg) });
  }
}

// ---------------- Resumen ----------------
function stats(rts) {
  if (!rts.length) return null;
  const sorted = [...rts].sort((a, b) => a - b);
  const avg = rts.reduce((s, x) => s + x, 0) / rts.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const sd = Math.sqrt(rts.reduce((s, x) => s + (x - avg) ** 2, 0) / rts.length);
  return { avg, median, best: sorted[0], worst: sorted[sorted.length - 1], sd };
}

function showSummary(r, { onRepeat, onDelete } = {}) {
  const s = stats(r.rts);
  const when = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(r.ts);
  const tile = (label, value) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`;
  const measuredTiles =
    r.measure !== 'none'
      ? `<h3>Tiempo de reacción · ${r.measure === 'camera' ? 'cámara' : 'toque'}</h3>
        <div class="stats">
          ${tile('Promedio', fmtMs(s?.avg))}
          ${tile('Mejor', fmtMs(s?.best))}
          ${tile('Mediana', fmtMs(s?.median))}
          ${tile('Variabilidad', s ? `±${Math.round(s.sd)} ms` : '—')}
          ${tile('Sin respuesta', r.misses)}
          ${r.nogoCount ? tile('Errores en rojo', `${r.commissions}/${r.nogoCount}`) : ''}
          ${r.falseStarts ? tile('Anticipaciones', r.falseStarts) : ''}
        </div>
        ${
          r.rts.length
            ? `<div class="rt-chips">${r.rts
                .map((x) => `<span class="${x <= s.median * 0.92 ? 'fast' : x >= s.median * 1.12 ? 'slow' : ''}">${x}</span>`)
                .join('')}</div>`
            : ''
        }`
      : '';
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  sheet.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grip"></div>
      <p class="sheet-kicker">${r.completed ? 'Sesión completa' : 'Sesión interrumpida'} · ${when}</p>
      <h2>${esc(r.drillName)}</h2>
      <div class="stats">
        ${tile('Duración', fmtDuration(r.durationSec))}
        ${tile('Estímulos', r.cues)}
        ${tile('Series', `${r.setsDone}/${r.setsPlanned}`)}
      </div>
      ${measuredTiles}
      <div class="sheet-actions">
        ${onRepeat ? '<button class="btn primary" data-act="repeat">Repetir</button>' : ''}
        ${onDelete ? '<button class="btn danger" data-act="delete">Eliminar</button>' : ''}
        <button class="btn ghost" data-act="close">Cerrar</button>
      </div>
    </div>`;
  const close = () => {
    sheet.remove();
    route();
  };
  sheet.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (e.target === sheet || act === 'close') close();
    if (act === 'repeat') {
      sheet.remove();
      onRepeat();
    }
    if (act === 'delete' && confirm('¿Eliminar esta sesión del historial?')) {
      onDelete();
      close();
    }
  });
  document.body.appendChild(sheet);
}

// ---------------- Historial ----------------
function renderHistory() {
  const hist = store.loadHistory();
  const weekAgo = Date.now() - 7 * 864e5;
  const week = hist.filter((h) => h.ts >= weekAgo);
  const minutes = Math.round(week.reduce((s, h) => s + h.durationSec, 0) / 60);
  const cues = week.reduce((s, h) => s + h.cues, 0);
  const rtTests = hist.filter((h) => h.drillId === 'tiempo-reaccion' && h.rts.length >= 3);
  const lastTest = rtTests[0] ? stats(rtTests[0].rts) : null;

  const dayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });
  const dayKey = (ts) => new Date(ts).toDateString();
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 864e5);
  const groups = [];
  for (const h of hist) {
    const k = dayKey(h.ts);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) groups.push((g = { key: k, label: k === today ? 'Hoy' : k === yesterday ? 'Ayer' : dayFmt.format(h.ts), items: [] }));
    g.items.push(h);
  }

  app.innerHTML = `
    <main class="page">
      <header class="masthead plain"><h1>Historial</h1></header>
      <div class="stats wide">
        <div class="stat"><span>Sesiones · 7 días</span><b>${week.length}</b></div>
        <div class="stat"><span>Minutos · 7 días</span><b>${minutes}</b></div>
        <div class="stat"><span>Estímulos · 7 días</span><b>${cues}</b></div>
        <div class="stat"><span>Último test de reacción</span><b>${lastTest ? fmtMs(lastTest.avg) : '—'}</b></div>
      </div>
      ${
        hist.length
          ? groups
              .map(
                (g) => `<h2 class="section-title">${g.label}</h2>
            <div class="list">${g.items
              .map((h) => {
                const s = stats(h.rts);
                return `<button class="hrow" data-id="${h.id}">
                  <div><b>${esc(h.drillName)}</b><span>${timeFmt.format(h.ts)} · ${fmtDuration(h.durationSec)} · ${h.cues} estímulos${h.completed ? '' : ' · incompleta'}</span></div>
                  <span class="hrt">${s ? fmtMs(s.avg) : ''}</span>
                </button>`;
              })
              .join('')}</div>`
              )
              .join('') +
            `<div class="history-actions">
              <button class="btn ghost" data-act="export">Exportar (JSON)</button>
              <button class="btn ghost danger-text" data-act="clear">Borrar todo</button>
            </div>`
          : `<div class="empty"><p>Todavía no hay sesiones.</p><a class="btn primary" href="#/">Elegir un drill</a></div>`
      }
    </main>
    ${tabBar('history')}`;

  app.querySelector('.page').addEventListener('click', async (e) => {
    const row = e.target.closest('.hrow');
    if (row) {
      const h = hist.find((x) => x.id === row.dataset.id);
      if (h) showSummary(h, { onDelete: () => store.deleteHistory(h.id) });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'clear' && confirm('¿Borrar todo el historial? No se puede deshacer.')) {
      store.clearHistory();
      renderHistory();
    }
    if (act === 'export') exportHistory(hist);
  });
}

async function exportHistory(hist) {
  const name = `splitstep-historial-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(hist, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Historial SplitStep' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------- Ajustes ----------------
let calibrationOff = null;

function stopCalibration() {
  if (calibrationOff) {
    calibrationOff();
    calibrationOff = null;
    motion.stop();
  }
}

function renderSettings() {
  const voiceOptions = () =>
    voice.voices.length
      ? voice.voices
          .map(
            (v) =>
              `<option value="${esc(v.voiceURI)}" ${voice.current()?.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`
          )
          .join('')
      : '<option>Voz del sistema</option>';

  app.innerHTML = `
    <main class="page">
      <header class="masthead plain"><h1>Ajustes</h1></header>

      <section class="panel">
        <h2>Voz</h2>
        <div class="row col">
          <span class="row-label">Voz</span>
          <div class="inline">
            <select id="voice-select">${voiceOptions()}</select>
            <button class="btn ghost small" data-act="test-voice">Probar</button>
          </div>
        </div>
        <div class="row col">
          <span class="row-label">Velocidad <output id="rate-out">${settings.rate.toFixed(2)}×</output></span>
          <input type="range" id="rate" min="0.8" max="1.5" step="0.05" value="${settings.rate}">
        </div>
        <label class="row toggle-row">
          <span class="row-label">Anuncios por voz<small>Series, descansos y final de sesión</small></span>
          <input type="checkbox" class="switch" id="announce" ${settings.announce ? 'checked' : ''}>
        </label>
      </section>

      <section class="panel">
        <h2>Sonido</h2>
        <div class="row col">
          <span class="row-label">Volumen de beeps <output id="vol-out">${Math.round(settings.volume * 100)}%</output></span>
          <div class="inline">
            <input type="range" id="volume" min="0" max="1" step="0.05" value="${settings.volume}">
            <button class="btn ghost small" data-act="test-beep">Probar</button>
          </div>
        </div>
        <small class="note">Si no oís nada, subí el volumen del iPhone y revisá el modo silencio.</small>
      </section>

      <section class="panel">
        <h2>Cámara</h2>
        <div class="row col">
          <span class="row-label">Umbral de movimiento <output id="thr-out">${(settings.threshold * 100).toFixed(1)}%</output></span>
          <input type="range" id="threshold" min="0.005" max="0.15" step="0.0025" value="${settings.threshold}">
          <small class="note">Más bajo = más sensible. Subilo si los rebotes en posición de espera cuentan como reacción.</small>
        </div>
        <label class="row toggle-row">
          <span class="row-label">Vista de cámara en la sesión</span>
          <input type="checkbox" class="switch" id="preview" ${settings.showPreview ? 'checked' : ''}>
        </label>
        <div id="calib"></div>
        <button class="btn ghost" data-act="calib">Probar cámara</button>
      </section>

      <section class="panel">
        <h2>Instalar en el iPhone</h2>
        <ol class="howto">
          <li>Abrí esta página en Safari.</li>
          <li>Tocá <b>Compartir</b> y después <b>Agregar a inicio</b>.</li>
          <li>Abrila desde el ícono: pantalla completa y funciona sin conexión.</li>
          <li>En la cancha: brillo alto y teléfono apoyado en el bolso o la valla.</li>
        </ol>
      </section>

      <p class="about">SplitStep ${APP_VERSION} · app personal · los datos quedan solo en este teléfono.</p>
    </main>
    ${tabBar('settings')}`;

  const offVoices = voice.onVoices(() => {
    const sel = app.querySelector('#voice-select');
    if (sel) sel.innerHTML = voiceOptions();
  });
  const page = app.querySelector('.page');

  page.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'rate') {
      updateSettings({ rate: Number(t.value) });
      app.querySelector('#rate-out').textContent = `${settings.rate.toFixed(2)}×`;
    }
    if (t.id === 'volume') {
      updateSettings({ volume: Number(t.value) });
      app.querySelector('#vol-out').textContent = `${Math.round(settings.volume * 100)}%`;
    }
    if (t.id === 'threshold') {
      updateSettings({ threshold: Number(t.value) });
      app.querySelector('#thr-out').textContent = `${(settings.threshold * 100).toFixed(1)}%`;
    }
  });
  page.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'voice-select') updateSettings({ voiceURI: t.value });
    if (t.id === 'announce') updateSettings({ announce: t.checked });
    if (t.id === 'preview') updateSettings({ showPreview: t.checked });
  });
  page.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'test-voice') {
      voice.unlock();
      voice.say('Derecha. Izquierda. Tres.');
    }
    if (act === 'test-beep') {
      sound.ensure();
      sound.play('pre');
      setTimeout(() => sound.play('cue'), 350);
    }
    if (act === 'calib') {
      const btn = e.target.closest('button');
      if (calibrationOff) {
        stopCalibration();
        btn.textContent = 'Probar cámara';
        app.querySelector('#calib').innerHTML = '';
        return;
      }
      try {
        await motion.start();
      } catch (err) {
        alert(`No se pudo abrir la cámara: ${err.message || err.name}`);
        return;
      }
      btn.textContent = 'Cerrar cámara';
      startCalibration(app.querySelector('#calib'));
    }
  });
  window.addEventListener('hashchange', offVoices, { once: true });
}

function startCalibration(container) {
  container.innerHTML = `<div class="calib">
      <video playsinline muted autoplay></video>
      <div class="calib-meter"><i></i><b></b></div>
      <div class="calib-info"><span class="calib-state">Quieto</span><span class="calib-fps"></span></div>
      <small class="note">Ponete en posición de espera y hacé tus rebotes normales: la barra no debería pasar la marca. Al salir lateralmente, sí.</small>
    </div>`;
  container.querySelector('video').srcObject = motion.stream;
  const bar = container.querySelector('.calib-meter i');
  const mark = container.querySelector('.calib-meter b');
  const state = container.querySelector('.calib-state');
  const fps = container.querySelector('.calib-fps');
  let peak = 0;
  // Igual que en la sesión: se compara contra un cuadro de referencia (aquí, renovado cada 250 ms).
  motion.setReference();
  const refTimer = setInterval(() => motion.setReference(), 250);
  const offFrame = motion.onFrame((f) => {
    const scale = (v) => Math.min(100, (v / 0.2) * 100);
    peak = Math.max(f.refMotion, peak * 0.93);
    bar.style.width = `${scale(peak)}%`;
    mark.style.left = `${scale(motion.threshold)}%`;
    const moving = peak > motion.threshold;
    bar.classList.toggle('over', moving);
    state.textContent = moving ? 'Movimiento' : 'Quieto';
    state.classList.toggle('on', moving);
    fps.textContent = `${Math.round(motion.fps)} fps`;
  });
  calibrationOff = () => {
    clearInterval(refTimer);
    offFrame();
    motion.clearReference();
  };
}

// ---------------- Arranque ----------------
route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
