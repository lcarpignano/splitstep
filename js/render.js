// Dibujo de estímulos (pantalla completa y miniaturas) y del diagrama de cancha.
import { COLORS, ARROW_ANGLE } from './drills.js';

const ARROW_PATH = 'M50 5 L92 47 L65 47 L65 95 L35 95 L35 47 L8 47 Z';

export function arrowSVG(dir, fill = 'currentColor') {
  const a = ARROW_ANGLE[dir] ?? 0;
  return `<svg class="glyph arrow" viewBox="0 0 100 100" aria-hidden="true"><path d="${ARROW_PATH}" fill="${fill}" stroke="${fill}" stroke-width="6" stroke-linejoin="round" transform="rotate(${a} 50 50)"/></svg>`;
}

// Devuelve { html, bg } para un estímulo. `bg` es el color de fondo de la escena (o null).
export function cueView(cue) {
  switch (cue.type) {
    case 'color':
      return { html: '', bg: COLORS[cue.color].hex };
    case 'arrow':
      return { html: arrowSVG(cue.dir), bg: null };
    case 'number':
      return { html: `<span class="glyph number">${cue.value}</span>`, bg: null };
    case 'shape':
      return {
        html: `<svg class="glyph shape" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="36" fill="currentColor"/></svg>`,
        bg: null,
      };
    case 'word':
      return {
        html: `<span class="glyph word" style="color:${COLORS[cue.ink].hex}">${cue.text}</span>`,
        bg: null,
      };
    default:
      return { html: '', bg: null };
  }
}

export function cueMini(cue) {
  const v = cueView(cue);
  const style = v.bg ? `style="background:${v.bg}"` : '';
  return `<span class="mini ${cue.type}" ${style}>${v.html}</span>`;
}

// Vista superior de media cancha desde la perspectiva del jugador (red arriba, fondo abajo).
export function courtSVG(highlight = null) {
  const spots = [
    { n: 1, x: 37, y: 28 },
    { n: 2, x: 83, y: 28 },
    { n: 3, x: 37, y: 70 },
    { n: 4, x: 83, y: 70 },
    { n: 5, x: 33, y: 106 },
    { n: 6, x: 87, y: 106 },
  ];
  const dots = spots
    .map(
      (s) => `<g class="spot${highlight === s.n ? ' on' : ''}">
        <circle cx="${s.x}" cy="${s.y}" r="8.5"/>
        <text x="${s.x}" y="${s.y + 3.6}" text-anchor="middle">${s.n}</text>
      </g>`
    )
    .join('');
  return `<svg class="court" viewBox="0 0 120 134" role="img" aria-label="Media cancha con 6 zonas numeradas">
    <rect x="4" y="6" width="112" height="124" rx="4" class="court-bg"/>
    <g class="lines">
      <rect x="10" y="12" width="100" height="108"/>
      <line x1="22.5" y1="12" x2="22.5" y2="120"/>
      <line x1="97.5" y1="12" x2="97.5" y2="120"/>
      <line x1="22.5" y1="70.4" x2="97.5" y2="70.4"/>
      <line x1="60" y1="12" x2="60" y2="70.4"/>
      <line x1="60" y1="120" x2="60" y2="116"/>
    </g>
    <line x1="4" y1="12" x2="116" y2="12" class="net"/>
    <text x="60" y="9" text-anchor="middle" class="label">RED</text>
    ${dots}
    <g class="player"><circle cx="60" cy="125" r="3.4"/></g>
  </svg>`;
}

export function fmtMs(ms) {
  return ms == null ? '—' : `${Math.round(ms)} ms`;
}

export function fmtDuration(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s} s`;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
