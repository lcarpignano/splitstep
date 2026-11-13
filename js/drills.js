// Catálogo de drills de reacción orientados a tenis.
// Cada estímulo (cue) es un objeto { type, ..., say } que el renderer sabe dibujar.

export const COLORS = {
  rojo: { hex: '#FF3B30', name: 'Rojo' },
  verde: { hex: '#30D158', name: 'Verde' },
  azul: { hex: '#0A84FF', name: 'Azul' },
  amarillo: { hex: '#FFD60A', name: 'Amarillo' },
};

export const ARROW_ANGLE = { up: 0, ur: 45, right: 90, dr: 135, down: 180, dl: 225, left: 270, ul: 315 };

const arrow = (dir, say, extra = {}) => ({ type: 'arrow', dir, say, ...extra });
const color = (c, say, extra = {}) => ({ type: 'color', color: c, say: say ?? COLORS[c].name, ...extra });
const number = (n, say) => ({ type: 'number', value: n, say });
const shape = (shape, say, extra = {}) => ({ type: 'shape', shape, say, ...extra });

const NUM_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];

// Valores por defecto de configuración de un drill (el usuario puede ajustarlos).
export const BASE_CONFIG = {
  mode: 'reps', // 'reps' | 'time'
  reps: 20,
  time: 60, // segundos por serie
  sets: 3,
  rest: 30, // segundos
  intervalMin: 2.5, // segundos entre estímulos (modo sin medición)
  intervalMax: 4.0,
  display: 0, // ms visible; 0 = hasta el próximo estímulo
  voice: true,
  cueBeep: true,
  measure: 'none', // 'none' | 'camera' | 'tap'
  accelerate: false,
};

export const DRILLS = [
  {
    id: 'split-direccion',
    name: 'Split step + dirección',
    category: 'Fondo',
    summary: 'Pique en el beep, leé la flecha y salí.',
    description:
      'Suena un beep: hacés el split step. Una fracción de segundo después aparece la flecha y salís hacia ese lado con desplazamiento lateral, golpe de sombra y recuperación al centro.',
    howto: [
      'Ubicate en el centro de la línea de fondo, en posición de espera.',
      'Split step exactamente con el beep.',
      'Flecha → desplazamiento hacia ese lado + golpe de sombra.',
      'Recuperá al centro con pasos cruzados antes del próximo beep.',
    ],
    pool: [arrow('left', 'Izquierda'), arrow('right', 'Derecha')],
    preCue: { beep: 'pre', delay: [220, 550] },
    camera: false,
    cameraNote: 'El split step previo al estímulo hace que la cámara no pueda medir la reacción en este drill.',
    defaults: { reps: 20, sets: 3, rest: 30, intervalMin: 2.8, intervalMax: 4.2 },
  },
  {
    id: 'drive-reves',
    name: '¿Drive o revés?',
    category: 'Decisión',
    summary: 'Color = golpe. Decidí y ejecutá la sombra.',
    description:
      'La pantalla se pinta de un color y tenés que decidir el golpe: verde es drive, azul es revés. Ejecutá el giro de hombros y el golpe de sombra completo, y volvé a la posición de espera.',
    howto: [
      'Posición de espera frente al teléfono, a 2–4 m.',
      'Verde → drive. Azul → revés.',
      'Golpe de sombra completo y recuperación.',
      'Dejá la voz apagada para entrenar la lectura visual.',
    ],
    legend: [
      { cue: color('verde', 'Drive'), meaning: 'Drive' },
      { cue: color('azul', 'Revés'), meaning: 'Revés' },
    ],
    pool: [color('verde', 'Drive'), color('azul', 'Revés')],
    icon: color('azul', 'Revés'),
    camera: true,
    defaults: { reps: 24, sets: 3, rest: 30, intervalMin: 2.0, intervalMax: 3.2, voice: false },
  },
  {
    id: 'cancha-6',
    name: 'Cubrir la cancha (6 puntos)',
    category: 'Movimiento',
    summary: 'Números 1–6 = zonas de la cancha.',
    description:
      'Cada número es una zona de tu lado de la cancha. Corré a esa zona, ejecutá el golpe de sombra que corresponda y recuperá al centro de la línea de fondo.',
    howto: [
      'Arrancá en la marca central de la línea de fondo.',
      '1–2 junto a la red, 3–4 en la línea de saque, 5–6 en el fondo.',
      'Impares a la izquierda, pares a la derecha.',
      'Golpe de sombra en la zona y recuperación al centro.',
    ],
    court: true,
    pool: [1, 2, 3, 4, 5, 6].map((n) => number(n, NUM_WORDS[n])),
    camera: true,
    defaults: { reps: 18, sets: 3, rest: 45, intervalMin: 4.0, intervalMax: 5.5 },
  },
  {
    id: 'red-reflejos',
    name: 'Reflejos en la red',
    category: 'Red',
    summary: 'Voleas altas y bajas, a ritmo rápido.',
    description:
      'Parado en posición de volea, reaccioná a las flechas diagonales: arriba es volea alta, abajo es volea baja (flexionando piernas), y el lado indica drive o revés.',
    howto: [
      'Posición de volea: raqueta adelante, peso en la punta de los pies.',
      '↗ alta derecha · ↖ alta izquierda.',
      '↘ baja derecha · ↙ baja izquierda (flexioná las piernas).',
      'Paso hacia adelante en cada volea, gesto corto.',
    ],
    legend: [
      { cue: arrow('ul', 'Alta izquierda'), meaning: 'Alta izquierda' },
      { cue: arrow('ur', 'Alta derecha'), meaning: 'Alta derecha' },
      { cue: arrow('dl', 'Baja izquierda'), meaning: 'Baja izquierda' },
      { cue: arrow('dr', 'Baja derecha'), meaning: 'Baja derecha' },
    ],
    pool: [
      arrow('ul', 'Alta izquierda'),
      arrow('ur', 'Alta derecha'),
      arrow('dl', 'Baja izquierda'),
      arrow('dr', 'Baja derecha'),
    ],
    camera: true,
    defaults: { reps: 30, sets: 4, rest: 30, intervalMin: 1.3, intervalMax: 2.1, voice: false },
  },
  {
    id: 'devolucion',
    name: 'Devolución de saque',
    category: 'Devolución',
    summary: 'Flash corto: leé el saque y reaccioná.',
    description:
      'Un beep doble simula el impacto del saque: hacés el split step. La dirección aparece solo un instante, como la lectura de un saque rápido: izquierda, derecha o al cuerpo.',
    howto: [
      'Posición de devolución detrás de la línea de fondo.',
      'Split step con el beep doble (el “impacto” del sacador).',
      '← / → : paso cruzado y bloqueo o devolución corta.',
      '● al cuerpo: paso lateral para despejar el cuerpo.',
    ],
    legend: [
      { cue: arrow('left', 'Izquierda'), meaning: 'Abierto a la izquierda' },
      { cue: shape('dot', 'Al cuerpo'), meaning: 'Al cuerpo' },
      { cue: arrow('right', 'Derecha'), meaning: 'Abierto a la derecha' },
    ],
    pool: [arrow('left', 'Izquierda'), arrow('right', 'Derecha'), shape('dot', 'Al cuerpo')],
    weights: [0.4, 0.4, 0.2],
    preCue: { beep: 'serve', delay: [450, 1000] },
    camera: false,
    cameraNote: 'El split step con el beep previo impide medir con cámara en este drill.',
    defaults: { reps: 16, sets: 3, rest: 40, intervalMin: 4.5, intervalMax: 6.0, display: 350, voice: false },
  },
  {
    id: 'go-nogo',
    name: 'Atacá o esperá (Go / No-Go)',
    category: 'Decisión',
    summary: 'Verde: arrancá. Rojo: no te muevas.',
    description:
      'Entrena el control inhibitorio: en verde arrancás con dos o tres pasos explosivos hacia adelante (como atacando una pelota corta); en rojo te quedás firme. Con la cámara se cuentan los movimientos en rojo como errores.',
    howto: [
      'Posición de espera, activo pero sin desplazarte.',
      'Verde → 2–3 pasos explosivos hacia adelante y volvé.',
      'Rojo → quedate quieto.',
      'Medí con cámara para contar los errores de impulsividad.',
    ],
    legend: [
      { cue: color('verde', 'Ya'), meaning: 'Arrancá' },
      { cue: color('rojo', 'No', { nogo: true }), meaning: 'Quieto' },
    ],
    pool: [color('verde', 'Ya'), color('rojo', 'No', { nogo: true })],
    icon: color('rojo', 'No'),
    weights: [0.65, 0.35],
    camera: true,
    defaults: { reps: 25, sets: 3, rest: 30, intervalMin: 1.8, intervalMax: 3.2, voice: false },
  },
  {
    id: 'cuatro-direcciones',
    name: 'Cuatro direcciones',
    category: 'Movimiento',
    summary: 'Dejada, globo, drive y revés.',
    description:
      'Reaccioná a la flecha con el movimiento del tenis que corresponde: hacia adelante a buscar una dejada, hacia atrás para un globo o smash, y a los costados para drive y revés.',
    howto: [
      '↑ sprint a la red (dejada) y volvé.',
      '↓ retrocedé de costado (globo / smash).',
      '← revés · → drive, con golpe de sombra.',
      'Recuperá siempre al centro.',
    ],
    legend: [
      { cue: arrow('up', 'Adelante'), meaning: 'Dejada' },
      { cue: arrow('down', 'Atrás'), meaning: 'Globo / smash' },
      { cue: arrow('left', 'Izquierda'), meaning: 'Revés' },
      { cue: arrow('right', 'Derecha'), meaning: 'Drive' },
    ],
    pool: [arrow('up', 'Adelante'), arrow('down', 'Atrás'), arrow('left', 'Izquierda'), arrow('right', 'Derecha')],
    camera: true,
    defaults: { reps: 20, sets: 3, rest: 40, intervalMin: 3.0, intervalMax: 4.5 },
  },
  {
    id: 'stroop',
    name: 'Color de la tinta (Stroop)',
    category: 'Cognitivo',
    summary: 'Reaccioná al color, no a la palabra.',
    description:
      'Aparece el nombre de un color escrito con tinta de otro color. Tenés que reaccionar al color de la tinta, ignorando la palabra. Suma carga cognitiva al desplazamiento, como cuando decidís bajo presión.',
    howto: [
      'Mirá el color de la letra, no lo que dice.',
      'Verde → derecha · Azul → izquierda.',
      'Amarillo → adelante · Rojo → atrás.',
      'Movimiento corto y vuelta al centro.',
    ],
    legend: [
      { cue: { type: 'word', text: 'ROJO', ink: 'verde' }, meaning: 'Derecha' },
      { cue: { type: 'word', text: 'VERDE', ink: 'azul' }, meaning: 'Izquierda' },
      { cue: { type: 'word', text: 'AZUL', ink: 'amarillo' }, meaning: 'Adelante' },
      { cue: { type: 'word', text: 'AMARILLO', ink: 'rojo' }, meaning: 'Atrás' },
    ],
    generate: (prev) => {
      const keys = Object.keys(COLORS);
      let ink;
      do ink = keys[Math.floor(Math.random() * keys.length)];
      while (prev && prev.ink === ink && Math.random() < 0.7);
      let wordKey = ink;
      if (Math.random() < 0.75) {
        const others = keys.filter((k) => k !== ink);
        wordKey = others[Math.floor(Math.random() * others.length)];
      }
      return { type: 'word', text: COLORS[wordKey].name.toUpperCase(), ink };
    },
    allowVoice: false,
    camera: true,
    defaults: { reps: 20, sets: 3, rest: 30, intervalMin: 2.5, intervalMax: 3.8, voice: false },
  },
  {
    id: 'peloteo',
    name: 'Peloteo acelerado',
    category: 'Fondo',
    summary: 'Izquierda / derecha cada vez más rápido.',
    description:
      'Simula un peloteo que se acelera: flechas izquierda/derecha con un intervalo que se va acortando hasta el 60% durante cada serie. Golpe de sombra y recuperación en cada estímulo.',
    howto: [
      'Centro de la línea de fondo.',
      '← revés · → drive con golpe de sombra.',
      'El ritmo aumenta a lo largo de la serie.',
      'Priorizá la recuperación al centro.',
    ],
    pool: [arrow('left', 'Izquierda'), arrow('right', 'Derecha')],
    icon: arrow('right', 'Derecha'),
    camera: true,
    defaults: { reps: 30, sets: 2, rest: 45, intervalMin: 3.2, intervalMax: 3.8, accelerate: true },
  },
  {
    id: 'tiempo-reaccion',
    name: 'Test de tiempo de reacción',
    category: 'Test',
    summary: 'Medí tu reacción en milisegundos.',
    description:
      'La pantalla se pone verde en un momento aleatorio: reaccioná lo más rápido posible. Con “Toque” tocás la pantalla; con “Cámara” se mide el inicio de tu movimiento corporal. Si te anticipás, el intento se repite.',
    howto: [
      'Toque: sostené el teléfono y tocá apenas se ponga verde.',
      'Cámara: teléfono apoyado a 2–3 m, cuerpo entero en cuadro.',
      'No te anticipes: los arranques en falso se registran.',
      'Repetilo cada tanto para ver tu evolución.',
    ],
    pool: [color('verde', '')],
    camera: true,
    requiresMeasure: true,
    falseStart: true,
    foreperiod: [1500, 4000],
    defaults: { reps: 10, sets: 1, rest: 0, measure: 'tap', voice: false },
  },
];

export const CATEGORIES = ['Fondo', 'Decisión', 'Movimiento', 'Red', 'Devolución', 'Cognitivo', 'Test'];

export function getDrill(id) {
  return DRILLS.find((d) => d.id === id);
}

export function defaultConfig(drill) {
  return { ...BASE_CONFIG, ...drill.defaults };
}

// Elige el próximo estímulo evitando más de 2 repeticiones seguidas.
export function nextCue(drill, history) {
  if (drill.generate) return drill.generate(history[history.length - 1]);
  const pool = drill.pool;
  if (pool.length === 1) return pool[0];
  const weights = drill.weights || pool.map(() => 1);
  const last2 = history.slice(-2);
  const blocked = last2.length === 2 && last2[0] === last2[1] ? last2[0] : null;
  const candidates = pool.map((c, i) => ({ c, w: c === blocked ? 0 : weights[i] }));
  const total = candidates.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of candidates) {
    r -= x.w;
    if (r <= 0) return x.c;
  }
  return candidates[candidates.length - 1].c;
}

export function estimateMinutes(drill, cfg) {
  const avgInterval = cfg.measure === 'none' ? (cfg.intervalMin + cfg.intervalMax) / 2 : 3;
  const factor = cfg.accelerate ? 0.8 : 1;
  const perSet = cfg.mode === 'time' ? cfg.time : cfg.reps * avgInterval * factor;
  const total = cfg.sets * (perSet + 6) + Math.max(0, cfg.sets - 1) * cfg.rest;
  return Math.max(1, Math.round(total / 60));
}
