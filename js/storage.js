// Persistencia local (localStorage). Una app instalada en la pantalla de inicio conserva sus datos.

const KEYS = {
  settings: 'splitstep.settings',
  drillcfg: 'splitstep.drillcfg',
  history: 'splitstep.history',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const DEFAULT_SETTINGS = {
  voiceURI: null,
  rate: 1.05,
  volume: 0.8,
  announce: true, // anuncios por voz (series, descansos, final)
  threshold: 0.03,
  showPreview: true,
};

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}

export function saveSettings(s) {
  write(KEYS.settings, s);
}

export function loadDrillConfig(id) {
  return read(KEYS.drillcfg, {})[id] || null;
}

export function saveDrillConfig(id, cfg) {
  const all = read(KEYS.drillcfg, {});
  if (cfg) all[id] = cfg;
  else delete all[id];
  write(KEYS.drillcfg, all);
}

export function loadHistory() {
  return read(KEYS.history, []);
}

export function addHistory(entry) {
  const h = loadHistory();
  h.unshift(entry);
  write(KEYS.history, h.slice(0, 1000));
}

export function deleteHistory(id) {
  write(
    KEYS.history,
    loadHistory().filter((e) => e.id !== id)
  );
}

export function clearHistory() {
  write(KEYS.history, []);
}
