/* ============================================================
   Herramientas de la comparativa — piezas comunes
   Reloj y azar controlados: la página solo avanza cuando el
   script lo pide, así «antes» y «ahora» se fotografían en la
   misma situación exacta.

   Requiere Playwright (el de playwright-cli global sirve) y
   Chrome. Variable PLAYWRIGHT para usar otra instalación.
   ============================================================ */
'use strict';

const pw = require(process.env.PLAYWRIGHT ||
  `${process.env.HOME}/.nvm/versions/node/v24.12.0/lib/node_modules/@playwright/cli/node_modules/playwright`);

// la GPU de verdad: sin estas banderas Chrome usa un rasterizador por software
const GPU = ['--use-angle=vulkan', '--enable-gpu', '--enable-features=Vulkan'];

const KEYS = ('blanco martillo puntasblancas morena cinta electrica sardina payaso pulpo raya medusa estrella ermitano '
  + 'jardin caballito globo tortuga rape pelicano linterna vampiro hacha congrio mero jureles dumbo espectro neon '
  + 'faroluz espejo sacacorchos copa sifon constelacion carbon vigia moneda campana semilla raiz flor colibri diente buzo').split(' ');

function control({ reloj, partida, idioma }) {
  let a = 7;
  window.__seed = s => { a = s >>> 0; };
  Math.random = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  if (reloj) {
    let now = 0, q = [];
    performance.now = () => now;
    window.requestAnimationFrame = cb => q.push(cb);
    window.__step = (n = 1) => {
      for (let i = 0; i < n; i++) { now += 1000 / 60; const r = q; q = []; r.forEach(cb => cb(now)); }
    };
  }
  // las herramientas comparan con la versión española; la prueba de idioma pide null
  if (idioma && !sessionStorage.getItem('idioma-fijado')) {
    localStorage.setItem('acuario-abisal-idioma', idioma);
    sessionStorage.setItem('idioma-fijado', '1');
  }
  if (partida && !sessionStorage.getItem('sembrada')) {
    localStorage.setItem('acuario-abisal-v1', JSON.stringify(partida));
    sessionStorage.setItem('sembrada', '1');
  }
}

const partida = (biome = 'arrecife', extra = {}) => ({
  seen: Object.fromEntries(KEYS.map(k => [k, 1])), photos: {}, counts: {},
  biome, abyss: false, muted: true, bait: 'pellet', ...extra,
});

/* abre una página en un perfil limpio (nunca toca la partida de quien juega) */
async function abrir(url, o = {}, browser) {
  const { w = 1440, h = 900, dpr = 1, biome = 'arrecife', extra = {}, reloj = true, reducido = false, vacia = false, antes, idioma = 'es' } = o;
  const c = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: dpr,
    reducedMotion: reducido ? 'reduce' : 'no-preference',
  });
  await c.addInitScript(control, { reloj, partida: vacia ? null : partida(biome, extra), idioma });
  if (antes) await c.addInitScript(antes);
  const p = await c.newPage();
  p.errores = [];
  p.on('pageerror', e => p.errores.push(String(e)));
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) p.errores.push(m.text()); });
  await p.goto(url);
  await p.evaluate(() => document.fonts.ready);
  return p;
}

/* puesta en escena idéntica en ambas versiones: [especie, x, y, sentido] en fracciones de pantalla */
const ESCENAS = {
  arrecife: [
    ['blanco', .60, .30, 1], ['martillo', .34, .45, -1], ['puntasblancas', .80, .67, 1], ['morena', .24, .75, 1],
    ['cinta', .50, .62, -1], ['electrica', .70, .80, 1],
    ...Array.from({ length: 42 }, (_, i) => ['sardina', .22 + ((i * 37) % 42) / 42 * .17 + Math.sin(i) * .012,
      .25 + ((i * 17) % 42) / 42 * .10 + Math.cos(i * 2) * .01, 1]),
    ['payaso', .17, .83, 1], ['payaso', .21, .80, -1], ['pulpo', .40, 0, 1], ['raya', .54, .84, 1],
    ['medusa', .11, .42, 1], ['medusa', .90, .36, 1], ['medusa', .74, .50, 1], ['estrella', .31, 0, 1], ['estrella', .92, 0, 1],
    ['ermitano', .48, 0, 1], ['espectro', .86, .22, -1], ['neon', .58, .50, 1], ['faroluz', .09, .62, 1], ['faroluz', .65, .70, -1],
    ['espejo', .44, .34, 1], ['buzo', .79, .38, -1],
  ],
  burbujeante: [
    ...[.18, .21, .24, .27, .70, .73, .76].map(x => ['jardin', x, 0, 1]), ['caballito', .36, .62, 1], ['caballito', .84, .55, -1],
    ['globo', .62, .34, 1], ['tortuga', .40, .36, 1], ['sacacorchos', .54, .64, 1], ['copa', .22, .47, 1], ['copa', .74, .44, -1],
    ['copa', .48, .50, 1], ['sifon', .13, .30, 1], ['sifon', .88, .32, 1],
  ],
  abismo: [
    ['rape', .30, .60, 1], ['rape', .80, .64, -1], ['pelicano', .60, .44, 1], ['linterna', .36, .30, 1], ['linterna', .86, .36, -1],
    ['vampiro', .15, .44, 1], ['hacha', .50, .60, 1], ['hacha', .54, .64, 1], ['hacha', .47, .67, -1],
    ['constelacion', .70, .24, 1], ['constelacion', .20, .24, 1], ['carbon', .66, .74, -1],
  ],
  naufragio: [
    ['congrio', .62, .84, 1], ['mero', .56, .68, 1], ...Array.from({ length: 18 }, () => ['jureles', .38, .66, 1]),
    ['dumbo', .16, .46, 1], ['dumbo', .82, .40, 1], ['vigia', .37, .68, 1], ...Array.from({ length: 7 }, () => ['moneda', .70, .8, 1]),
    ['campana', .58, .36, 1],
  ],
  imposible: [
    ['semilla', .24, .60, 1], ['semilla', .56, .50, -1], ['semilla', .70, .64, 1], ['raiz', .40, .90, 1], ['flor', .56, .30, 1],
    ['flor', .26, .40, -1], ['colibri', .17, .74, 1], ['colibri', .48, .70, 1], ['colibri', .80, .76, -1],
    ['diente', .84, .36, 1], ['diente', .10, .34, 1], ['diente', .70, .46, 1],
  ],
};

async function montar(p, biome, { modo = 'acuario', pasos = 120, escena = ESCENAS[biome] } = {}) {
  await p.evaluate(({ escena, modo }) => {
    __seed(1234);
    world.time = 40; // antes de entrar al modo: así el primer momento no llega a mitad de la foto
    if (modo) applyMode(modo);
    world.creatures.length = world.bubbles.length = world.sparks.length = world.food.length = world.effects.length = 0;
    world.time = 40; state.leviatan.active = false; state.leviatan.nextAt = 1e9; nextVisitor = 1e9;
    let i = 0;
    for (const [k, fx, fy, d] of escena) {
      __seed(++i * 997);
      const x = fx * world.W, y = fy * world.H, c = spawnCreature(k, x, y);
      c.alpha = 1; c.entering = false;
      if ('dir' in c) c.dir = d;
      if (c.spine) {
        c.vel = { x: d, y: 0 }; c.home = { x, y };
        c.spine.forEach((s, j) => { s.x = x - d * c.segLen * j; s.y = y; });
      } else if (c.vel && c.vel.x) c.vel.x = Math.abs(c.vel.x) * d;
      if (k === 'payaso') { c.x = x; c.y = y; }
    }
    updateCounts();
    __seed(4321);
  }, { escena, modo });
  await p.evaluate(n => __step(n), pasos);
}

module.exports = { pw, GPU, KEYS, partida, abrir, montar, ESCENAS };
