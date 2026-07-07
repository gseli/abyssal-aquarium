/* ============================================================
   ACUARIO ABISAL — partida guardada (localStorage)
   Cargar antes que el resto de scripts.
   ============================================================ */
'use strict';

const SAVE_KEY = 'acuario-abisal-v1';

const save = {
  seen: {},        // key -> timestamp de registro (observado)
  photos: {},      // key -> dataURL de la última foto
  counts: {},      // key -> población elegida en el panel
  biome: 'arrecife',
  abyss: false,
  muted: false,
  bait: 'pellet',
};

(function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      for (const k of Object.keys(save)) {
        if (data[k] !== undefined) save[k] = data[k];
      }
    }
  } catch (e) { /* partida corrupta: se empieza de cero */ }
})();

let _saveTimer = null;
function persistSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* sin espacio */ }
  }, 400);
}

const isSeen = key => !!save.seen[key];
const hasPhoto = key => !!save.photos[key];
