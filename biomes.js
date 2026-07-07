/* ============================================================
   ACUARIO ABISAL — biomas
   Paletas, flora y reglas de desbloqueo por ecosistema.
   Requiere save.js y creatures.js. Cargar antes de aquarium.js.
   ============================================================ */
'use strict';

const BIOMES = {
  arrecife: {
    orden: 0,
    nombre: 'EL ARRECIFE',
    profundidad: 38,
    bg: {
      top: [13, 56, 86], mid: [7, 30, 50], bottom: [2, 11, 22],
      sand: [46, 70, 92], sandLo: [24, 42, 60],
    },
    kelp: true, vent: true, fizz: false,
  },
  burbujeante: {
    orden: 1,
    nombre: 'EL MAR BURBUJEANTE',
    profundidad: 96,
    // luminoso y somero: champán al sol, nada que ver con el abismo
    bg: {
      top: [92, 172, 166], mid: [48, 122, 126], bottom: [22, 74, 84],
      sand: [132, 138, 112], sandLo: [88, 96, 78],
    },
    kelp: false, vent: false, fizz: true, rayBoost: 1.7,
  },
  abismo: {
    orden: 2,
    nombre: 'EL ABISMO',
    profundidad: 2847,
    // oscuridad casi total: aquí solo existe lo que brilla
    bg: {
      top: [4, 10, 18], mid: [2, 6, 12], bottom: [0, 2, 5],
      sand: [11, 15, 22], sandLo: [4, 7, 11],
    },
    kelp: false, vent: false, fizz: false,
    rayBoost: 0, snowMul: 2.2, biolum: true, spires: true,
  },
  naufragio: {
    orden: 3,
    nombre: 'EL NAUFRAGIO',
    profundidad: 3800,
    // penumbra verdosa y óxido: el barco de 1912
    bg: {
      top: [15, 38, 35], mid: [8, 25, 24], bottom: [3, 12, 12],
      sand: [32, 40, 35], sandLo: [17, 23, 20],
    },
    kelp: false, vent: false, fizz: false,
    rayBoost: 0.35, snowMul: 1.4, wreck: true,
  },
  imposible: {
    orden: 4,
    nombre: 'EL JARDÍN IMPOSIBLE',
    profundidad: null, // el profundímetro se rinde aquí: «???»
    // claridad rosada-lavanda que no viene de ninguna parte
    bg: {
      top: [106, 74, 122], mid: [64, 44, 92], bottom: [30, 22, 52],
      sand: [116, 88, 108], sandLo: [74, 54, 76],
    },
    kelp: false, vent: false, fizz: false,
    rayBoost: 0.8, snowMul: 0.5, garden: true,
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
