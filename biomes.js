/* ============================================================
   ACUARIO ABISAL — biomas
   Paletas, clima de luz, flora y reglas de desbloqueo por ecosistema.
   Requiere save.js y creatures.js. Cargar antes de aquarium.js.
   ============================================================ */
'use strict';

const BIOMES = {
  arrecife: {
    orden: 0,
    nombre: 'EL ARRECIFE',
    profundidad: 38,
    // mañana turquesa: la luz todavía llega entera
    bg: {
      top: [28, 132, 160], mid: [10, 74, 110], bottom: [5, 34, 62],
      sand: [150, 146, 128], sandLo: [52, 76, 88],
    },
    clima: {
      luz: [150, 240, 232], velo: [40, 120, 130], solX: 0.4,
      rayos: 0.32, superficie: 0.62, resplandor: 0.17, nebulosa: 0,
      lejos: [22, 98, 124], medio: [12, 66, 90], roca: [52, 84, 98], mota: [200, 245, 240],
    },
    kelp: true, vent: true, fizz: false,
  },
  burbujeante: {
    orden: 1,
    nombre: 'EL MAR BURBUJEANTE',
    profundidad: 96,
    // luminoso y somero: champán al sol, nada que ver con el abismo
    bg: {
      top: [108, 184, 170], mid: [54, 146, 148], bottom: [24, 92, 108],
      sand: [214, 200, 158], sandLo: [110, 128, 112],
    },
    clima: {
      luz: [255, 240, 190], velo: [160, 200, 160], solX: 0.56,
      rayos: 0.22, superficie: 0.44, resplandor: 0.14, nebulosa: 0,
      lejos: [84, 164, 158], medio: [50, 126, 126], roca: [120, 140, 124], mota: [255, 250, 225],
    },
    kelp: false, vent: false, fizz: true,
  },
  abismo: {
    orden: 2,
    nombre: 'EL ABISMO',
    profundidad: 2847,
    // oscuridad casi total: aquí solo existe lo que brilla
    bg: {
      top: [4, 11, 28], mid: [3, 8, 22], bottom: [1, 3, 10],
      sand: [30, 38, 54], sandLo: [7, 11, 20],
    },
    clima: {
      luz: [90, 150, 230], velo: [52, 64, 140], solX: 0.5,
      rayos: 0, superficie: 0, resplandor: 0.025, nebulosa: 0.2,
      lejos: [11, 20, 42], medio: [7, 13, 28], roca: [24, 32, 50], mota: [150, 200, 255],
    },
    kelp: false, vent: false, fizz: false,
    snowMul: 2.2, biolum: true, spires: true,
  },
  naufragio: {
    orden: 3,
    nombre: 'EL NAUFRAGIO',
    profundidad: 3800,
    // penumbra verdosa y óxido: el barco de 1912
    bg: {
      top: [34, 92, 80], mid: [14, 52, 52], bottom: [5, 22, 26],
      sand: [86, 98, 80], sandLo: [22, 36, 34],
    },
    clima: {
      luz: [170, 230, 180], velo: [30, 70, 55], solX: 0.34,
      rayos: 0.27, superficie: 0.12, resplandor: 0.14, nebulosa: 0.1,
      lejos: [24, 72, 66], medio: [15, 48, 47], roca: [44, 62, 56], mota: [205, 230, 200],
    },
    kelp: false, vent: false, fizz: false,
    snowMul: 1.4, wreck: true,
  },
  imposible: {
    orden: 4,
    nombre: 'EL JARDÍN IMPOSIBLE',
    profundidad: null, // el profundímetro se rinde aquí: «???»
    // claridad rosada-lavanda que no viene de ninguna parte
    bg: {
      top: [218, 146, 150], mid: [126, 86, 138], bottom: [54, 40, 92],
      sand: [196, 144, 160], sandLo: [88, 62, 108],
    },
    clima: {
      luz: [255, 220, 180], velo: [190, 120, 190], solX: 0.62,
      rayos: 0.2, superficie: 0.12, resplandor: 0.2, nebulosa: 0.1,
      lejos: [150, 102, 146], medio: [106, 70, 124], roca: [100, 74, 120], mota: [255, 226, 235],
    },
    kelp: false, vent: false, fizz: false,
    snowMul: 0.5, garden: true,
  },
};

const BIOME_ORDER = ['arrecife', 'burbujeante', 'abismo', 'naufragio', 'imposible'];

function biomeSpeciesKeys(bk) {
  return Object.keys(SPECIES).filter(k => SPECIES[k].bioma === bk);
}
function biomeSeenCount(bk) {
  return biomeSpeciesKeys(bk).filter(isSeen).length;
}
function biomeThreshold(bk) {
  return Math.ceil(biomeSpeciesKeys(bk).length * 0.7);
}
/* un bioma se abre al registrar ~70% del anterior */
function biomeUnlocked(bk) {
  const idx = BIOME_ORDER.indexOf(bk);
  if (idx <= 0) return true;
  const prev = BIOME_ORDER[idx - 1];
  return biomeUnlocked(prev) && biomeSeenCount(prev) >= biomeThreshold(prev);
}
