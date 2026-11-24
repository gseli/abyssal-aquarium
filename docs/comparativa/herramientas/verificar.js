/* Verificación completa de la rama frente a la versión anterior.
   uso: node verificar.js <url antes> <url ahora> [grupo,grupo]
   grupos: regresiones, juego, partidas, suavidad, responsive, robustez */
'use strict';
const { pw, GPU, abrir, montar, partida, KEYS } = require('./comun');

const [A, N, solo] = process.argv.slice(2);
let fallos = 0;
const ok = (n, v, extra = '') => { if (!v) fallos++; console.log(`${v ? 'OK   ' : 'FALLO'} ${n} ${extra}`); };

const grupos = {

  /* la simulación no cambió: mismo código de update, mismos datos */
  async regresiones(b) {
    const extraer = () => {
      const r = { orden: LAYER_ORDER.join(','), especies: {}, metodos: {}, comp: {} };
      const limpio = f => String(f).replace(/\s+/g, ' ');
      const vistos = new Set();
      for (const [k, s] of Object.entries(SPECIES)) {
        const o = {};
        // _es: la copia del original que guarda idioma.js para volver del inglés
        for (const [p, v] of Object.entries(s)) if (typeof v !== 'function' && p !== '_es') o[p] = v;
        r.especies[k] = JSON.stringify(o);
        if (s.behavior) r.comp[k] = limpio(s.behavior);
        if (s.profile) r.comp[k + '.profile'] = limpio(s.profile);
        const C = s.kind === 'spine' ? SpineFish : s.ctor;
        if (vistos.has(C)) continue;
        vistos.add(C);
        for (const m of Object.getOwnPropertyNames(C.prototype)) {
          if (['draw', 'geom', 'bodyPath', 'bodyGradient', 'up'].includes(m)) continue; // solo dibujo
          if (m === 'constructor') {
            const t = String(C), i = t.indexOf('constructor(');
            r.metodos[C.name + '.constructor'] = limpio(t.slice(i, t.indexOf('\n  }', i)));
          } else r.metodos[C.name + '.' + m] = limpio(C.prototype[m]);
        }
      }
      for (const f of [dischargeEel, makeBubble, wallForce, spawnCreature, huntBehavior, lurkBehavior]) r.comp[f.name] = limpio(f);
      return r;
    };
    const a = await abrir(A, {}, b), n = await abrir(N, {}, b);
    const ra = await a.evaluate(extraer), rn = await n.evaluate(extraer);
    ok('LAYER_ORDER idéntico', ra.orden === rn.orden);
    for (const g of ['especies', 'metodos', 'comp']) {
      const mal = Object.keys(ra[g]).filter(k => ra[g][k] !== rn[g][k]);
      ok(`${g} idénticos (${Object.keys(ra[g]).length})`, !mal.length, mal.join(','));
    }
    const rotos = await n.evaluate(keys => keys.filter(k => {
      const c = document.createElement('canvas').getContext('2d');
      try { for (const t of [0, 3, 9]) { world.time = t; makeSpecimen(k).draw(c); } return false; } catch (e) { return true; }
    }), KEYS);
    ok('44 retratos se pintan sin excepción', !rotos.length, rotos.join(','));
    await a.context().close(); await n.context().close();
  },

  /* jugar con ratón y teclado */
  async juego(b) {
    let p = await abrir(N, { vacia: true }, b);
    await p.click('.mode-card[data-mode="descubrimiento"]');
    ok('empieza con el banco guía', await p.evaluate(() => (__step(30), countOf('sardina') >= 25)));
    const sardina = () => p.evaluate(() => {
      const c = world.creatures.filter(c => c.key === 'sardina');
      const m = c.find(c => document.elementFromPoint(c.x, c.y) === canvas) || c[0];
      return toScreen(m.x, m.y);
    });
    for (let i = 0; i < 80 && !(await p.evaluate(() => isSeen('sardina'))); i++) {
      const q = await sardina(); await p.mouse.move(q.x, q.y); await p.evaluate(() => __step(8));
    }
    ok('observar registra', await p.evaluate(() => isSeen('sardina')));
    await p.evaluate(() => { world.mouse.active = false; __step(20); });
    let q = await sardina();
    await p.keyboard.press('c'); await p.mouse.move(q.x, q.y);
    ok('C abre el visor', await p.isVisible('#viewfinder'));
    await p.mouse.click(q.x, q.y);
    ok('fotografiar completa la entrada', await p.evaluate(() => hasPhoto('sardina')));
    const media = await p.evaluate(() => new Promise(r => {
      const i = new Image();
      i.onload = () => {
        const c = document.createElement('canvas'); c.width = 32; c.height = 20;
        const x = c.getContext('2d'); x.drawImage(i, 0, 0, 32, 20);
        const d = x.getImageData(0, 0, 32, 20).data; let s = 0;
        for (let j = 0; j < d.length; j += 4) s += d[j + 1] + d[j + 2];
        r(s / (d.length / 4) / 2);
      };
      i.src = save.photos.sardina;
    }));
    ok('la foto incluye el agua WebGL', media > 40, media.toFixed(0));
    await p.keyboard.press('Escape');
    for (const [t, c] of [['1', 'plancton'], ['2', 'pellet'], ['3', 'carnada'], ['4', 'luz']]) {
      await p.keyboard.press(t);
      const h = await p.evaluate(() => { for (let x = 300; x < 1200; x += 37) if (!creatureAt(x, 430)) return x; });
      await p.mouse.click(h, 430);
      ok(`cebo ${c}`, await p.evaluate(c => world.food.some(f => f.type === c), c));
      await p.evaluate(() => { deselect(); __step(5); });
    }
    const visitas = await p.evaluate(() => { for (let i = 0; i < 60; i++) __step(60); return new Set(world.creatures.map(c => c.key)).size; });
    ok('el director trae visitas', visitas > 1, visitas);
    await p.click('#biomeNext');
    ok('la flecha cerrada explica cuánto falta', /Llevas \d+/.test(await p.locator('.toast.bloqueo').textContent({ timeout: 3000 }).catch(() => '')));
    await p.click('#albumBtn');
    ok('álbum con 44 tarjetas', await p.locator('.album-card').count() === 44);
    await p.click('#tabMomentos');
    const pistas = await p.locator('.momento p').allTextContents();
    ok('10 momentos', pistas.length === 10);
    ok('pistas ocultas en biomas cerrados', pistas.filter(t => t.startsWith('Este ecosistema')).length === 8);
    ok('sin nombres revelados', (await p.locator('.momento h3').allTextContents()).every(t => t === '???'));
    await p.keyboard.press('Escape');
    ok('Escape cierra el álbum', !(await p.isVisible('#album')));
    ok('sin errores (partida nueva)', !p.errores.length, p.errores.join('|'));
    await p.context().close();

    // registrar la especie del umbral con una FOTO enciende la flecha sin recargar
    p = await abrir(N, { reloj: false, extra: { seen: {} } }, b);
    const umbral = await p.evaluate(() => {
      const keys = biomeSpeciesKeys('arrecife'), u = biomeThreshold('arrecife');
      for (const k of keys.slice(0, u - 1)) save.seen[k] = 1;
      applyMode('descubrimiento');
      photographSpecies(keys[u - 1], 'data:,');
      return !biomeNextBtn.classList.contains('cerrado');
    });
    await p.click('#biomeNext'); await p.waitForTimeout(2300);
    ok('el umbral cruzado con foto abre el bioma', umbral && await p.evaluate(() => save.biome === 'burbujeante'));
    await p.context().close();

    p = await abrir(N, {}, b);
    await montar(p, 'arrecife');
    q = await p.evaluate(() => {
      for (const c of world.creatures) {
        const h = c.head ? c.head() : c;
        if (c.spine && document.elementFromPoint(h.x, h.y) === canvas && creatureAt(h.x, h.y) === c) return { x: h.x, y: h.y };
      }
    });
    await p.mouse.dblclick(q.x, q.y);
    ok('doble clic sigue', await p.evaluate(() => !!view.follow));
    await p.evaluate(() => __step(200));
    await p.mouse.move(400, 300); await p.evaluate(() => __step(1));
    const raton = await p.evaluate(() => toScreen(world.mouse.x, world.mouse.y));
    await p.keyboard.press('c');
    const r = await p.evaluate(() => {
      const v = document.getElementById('viewfinder').getBoundingClientRect();
      return { x: v.x + v.width / 2, y: v.y + v.height / 2 };
    });
    ok('visor bajo el cursor con zoom', Math.hypot(r.x - raton.x, r.y - raton.y) < 4);
    await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
    ok('Escape suelta', await p.evaluate(() => !view.follow));
    await p.click('#biomeNext'); await p.waitForTimeout(2300);
    ok('viajar', await p.evaluate(() => (__step(30), save.biome === 'burbujeante')));
    const inv = await p.evaluate(() => {
      world.creatures.length = 0;
      const c = spawnCreature('jardin', 500); save.counts.jardin = 1; __step(2);
      momentos.alAlimentar('plancton', c.x, world.floorY(c.x) - 90); __step(60);
      const total = countOf('jardin'); adjustSpecies('jardin', 1);
      return { total, guardado: save.counts.jardin };
    });
    ok('los invitados no se guardan como población', inv.total > 1 && inv.guardado <= 3, JSON.stringify(inv));
    await p.click('#biomePrev'); await p.waitForTimeout(2300);
    ok('viajar cancela el momento', await p.evaluate(() => (__step(5), !momentos.activo)));
    await p.click('#homeBtn'); await p.waitForTimeout(1500);
    ok('volver al inicio', await p.evaluate(() => state.mode === null));
    await p.evaluate(() => localStorage.setItem(MOMENTOS_KEY, '{"mapa":"x"}'));
    await p.click('#resetBtn');
    const nav = p.waitForEvent('framenavigated');
    await p.click('#resetBtn'); await nav; await p.waitForLoadState('load');
    ok('reiniciar borra ambas claves', await p.evaluate(() => !localStorage.getItem(MOMENTOS_KEY) && !Object.keys(save.seen).length));
    await p.context().close();

    p = await abrir(N, { extra: { seen: { sardina: 1 } } }, b);
    const fuera = await p.evaluate(() => {
      spawnCreature('blanco'); applyMode('acuario');
      return world.creatures.find(c => c.key === 'blanco').leaving;
    });
    ok('modo acuario despide lo no descubierto', fuera);
    await p.context().close();
  },

  /* la partida va y vuelve entre versiones en el mismo origen */
  async partidas(b) {
    const mia = partida('naufragio', { counts: { jureles: 18 }, photos: { blanco: 'data:,' }, bait: 'luz' });
    const pasar = async (url, datos) => {
      const c = await b.newContext();
      const p = await c.newPage();
      await p.goto(url + 'save.js');
      await p.evaluate(d => { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); }, datos);
      await p.goto(url);
      await p.evaluate(() => persistSave());
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => Object.assign({}, localStorage));
      await c.close();
      return r;
    };
    const K = 'acuario-abisal-v1', M = 'acuario-abisal-momentos-v1';
    const en = await pasar(N, { [K]: JSON.stringify(mia), [M]: '{"mapa":"data:,"}' });
    const fin = await pasar(N, await pasar(A, en));
    const f = JSON.parse(fin[K]);
    ok('partida antigua → nueva → antigua → nueva',
      f.biome === 'naufragio' && f.counts.jureles === 18 && f.bait === 'luz' && 'blanco' in f.photos && Object.keys(f.seen).length === 44);
    ok('los momentos sobreviven a la versión antigua', !!fin[M] && !!JSON.parse(fin[M]).mapa);
  },

  /* salto máximo entre fotogramas al dar la vuelta, como % del cambio total */
  async suavidad(b) {
    const medir = keys => keys.map(k => {
      world.time = 100; __seed(9);
      const c = spawnCreature(k, 150, 150);
      const poner = d => {
        c.x = 150; c.y = 150;
        if ('dir' in c) c.dir = d;
        if (c.spine) { c.vel = { x: d, y: 0 }; c.spine.forEach((s, i) => { s.x = 150 + d * (c.len / 2 - i * c.segLen); s.y = 150; }); }
        else if (c.vel) { c.vel.x = 30 * d; c.vel.y = 0; }
      };
      const cv = document.createElement('canvas'); cv.width = cv.height = 300;
      const x = cv.getContext('2d', { willReadFrequently: true });
      const foto = () => { x.clearRect(0, 0, 300, 300); Math.random = () => 0.99; c.draw(x); return x.getImageData(0, 0, 300, 300).data.slice(); };
      const dif = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s; };
      poner(1);
      let antes = foto(), max = 0, fin;
      const ini = antes;
      // los de espina no se teletransportan: giran a su maxTurn real
      const pasos = c.spine ? Math.ceil(Math.PI / ((c.sp.maxTurn || 1.6) / 60)) : 0;
      if (!c.spine) poner(-1);
      for (let i = 0; i < Math.max(100, pasos + 90); i++) {
        if (c.spine && i < pasos + 1) {
          const a = Math.min(1, i / pasos) * Math.PI;
          c.vel = { x: Math.cos(a), y: Math.sin(a) };
          c.spine.forEach((s, j) => { const d = c.len / 2 - j * c.segLen; s.x = 150 + Math.cos(a) * d; s.y = 150 + Math.sin(a) * d; });
        }
        const f = foto();
        max = Math.max(max, dif(antes, f));
        antes = fin = f;
        world.time += 1 / 60;
      }
      world.creatures.length = 0;
      return [k, Math.round(100 * max / Math.max(1, dif(ini, fin)))];
    });
    const K = ['blanco', 'raya', 'buzo', 'tortuga', 'mero', 'caballito', 'faroluz', 'rape', 'espejo', 'payaso', 'copa', 'hacha'];
    const a = await abrir(A, {}, b), n = await abrir(N, {}, b);
    const ra = await a.evaluate(medir, K), rn = await n.evaluate(medir, K);
    console.log('      salto máximo por fotograma al girar (% del cambio): antes → ahora');
    ra.forEach(([k, v], i) => console.log(`      ${k.padEnd(10)} ${v} → ${rn[i][1]}`));
    ok('los giros saltan menos', ra.every(([, v], i) => rn[i][1] < v));
    await a.context().close(); await n.context().close();
  },

  /* nada se sale, nada se solapa, ningún texto menor de 11 px */
  async responsive(b) {
    for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1024, 700], [1280, 720], [1440, 900], [1920, 1080]]) {
      const p = await abrir(N, { w, h, biome: 'imposible' }, b);
      await montar(p, 'imposible');
      await p.waitForTimeout(1200);
      const r = await p.evaluate(() => {
        const W = innerWidth, mal = [], caja = {};
        for (const s of ['.hud-left', '.hud-right', '#baitDock']) {
          const e = document.querySelector(s), q = e.getBoundingClientRect();
          caja[s] = q;
          if (q.left < -0.5 || q.right > W + 0.5 || e.scrollWidth > e.clientWidth + 1) mal.push('desborda ' + s);
          for (const c of e.children) {
            const z = c.getBoundingClientRect();
            if (z.width && (z.left < q.left - 1 || z.right > q.right + 1)) mal.push('hijo fuera ' + s + ' ' + (c.id || c.className));
          }
        }
        const L = caja['.hud-left'], R = caja['.hud-right'];
        if (L.right > R.left && L.bottom > R.top && R.right > L.left) mal.push('HUD solapado');
        const t = document.querySelector('.title-block');
        if (getComputedStyle(t).display !== 'none') {
          const q = t.getBoundingClientRect();
          if (q.left < L.right + 4 || q.right > R.left - 4) mal.push('modo solapado');
        }
        openAlbum();
        let min = 99, quien = '';
        for (const e of document.querySelectorAll('body *')) {
          if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') continue;
          if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          const f = parseFloat(getComputedStyle(e).fontSize);
          if (f < min) { min = f; quien = e.id || e.className || e.tagName; }
        }
        if (min < 11) mal.push(`texto ${min}px ${quien}`);
        return mal;
      });
      ok(`${w}×${h}`, !r.length && !p.errores.length, r.join(', ') + p.errores.join('|'));
      await p.context().close();
    }
  },

  async robustez(b) {
    let p = await abrir(N, {
      antes: () => {
        const g = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : g.call(this, t, ...a); };
      },
    }, b);
    await montar(p, 'arrecife');
    ok('sin WebGL2: plan B', await p.evaluate(() => !agua.conWebGL && canvas.getContext('2d').getImageData(700, 200, 1, 1).data[2] > 40)
      && !p.errores.length, p.errores.join('|'));
    await p.context().close();

    p = await abrir(N, {
      antes: () => {
        const g = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (t, ...a) {
          const r = g.call(this, t, ...a);
          if (t === 'webgl2' && r) window.__gl = r;
          return r;
        };
      },
    }, b);
    await montar(p, 'arrecife');
    await p.evaluate(() => { window.__lose = __gl.getExtension('WEBGL_lose_context'); __lose.loseContext(); });
    await p.waitForTimeout(300);
    ok('contexto perdido: plan B', await p.evaluate(() => (__step(5), !agua.conWebGL)));
    await p.evaluate(() => __lose.restoreContext());
    await p.waitForTimeout(600);
    ok('contexto recuperado', await p.evaluate(() => (__step(5), agua.conWebGL)));
    await p.setViewportSize({ width: 700, height: 500 });
    await p.waitForTimeout(300);
    ok('resize', await p.evaluate(() => (__step(5), world.W === 700 && canvas.width === 700)));
    const errs = p.errores.filter(e => !/CONTEXT_LOST|context lost/i.test(e));
    ok('sin errores', !errs.length, errs.join('|'));
    await p.context().close();

    p = await abrir(N, { reducido: true }, b);
    await montar(p, 'arrecife');
    ok('movimiento reducido', await p.evaluate(() => luz.reducido && luz.vaiven < 0.5) && !p.errores.length);
    await p.context().close();

    for (const biome of ['arrecife', 'burbujeante', 'abismo', 'naufragio', 'imposible']) {
      p = await abrir(N, { biome }, b);
      await montar(p, biome);
      await p.evaluate(() => { for (let i = 0; i < 180; i++) __step(60); });
      ok(`3 min simulados en ${biome}`, !p.errores.length, p.errores.join('|').slice(0, 200));
      await p.context().close();
    }
  },
};

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: GPU });
  for (const [n, f] of Object.entries(grupos)) {
    if (solo && !solo.split(',').includes(n)) continue;
    console.log('##', n);
    try { await f(b); } catch (e) { ok(n + ' (excepción)', false, e.message.slice(0, 400)); }
  }
  await b.close();
  console.log('FALLOS:', fallos);
})();
