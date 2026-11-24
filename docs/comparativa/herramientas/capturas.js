/* Las 15 tomas de la comparativa, iguales para cualquier versión.
   uso: node capturas.js <url> <carpeta de salida> [filtro,filtro] */
'use strict';
const { pw, GPU, abrir, montar, KEYS } = require('./comun');

const [url, out, filtro] = process.argv.slice(2);
const quiero = n => !filtro || filtro.split(',').some(f => n.includes(f));
require('fs').mkdirSync(out, { recursive: true });

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: GPU });
  const toma = async (nombre, o, fn) => {
    if (!quiero(nombre)) return;
    const p = await abrir(url, o, b);
    await fn(p);
    await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    await p.waitForTimeout(1100); // las transiciones de CSS corren con reloj real
    await p.screenshot({ path: `${out}/${nombre}.png`, animations: 'disabled', timeout: 20000 });
    console.log(nombre, p.errores.length ? JSON.stringify(p.errores.slice(0, 4)) : 'ok');
    await p.context().close();
  };
  let n = 2;
  await toma('01-inicio', {}, p => montar(p, 'arrecife', { modo: null }));
  for (const biome of ['arrecife', 'burbujeante', 'abismo', 'naufragio', 'imposible']) {
    await toma(`0${n++}-${biome}`, { biome }, p => montar(p, biome));
  }
  await toma('07-arrecife-abisal', { extra: { abyss: true } }, p => montar(p, 'arrecife'));
  await toma('08-ficha', {}, async p => {
    await montar(p, 'arrecife');
    await p.evaluate(() => { select(world.creatures.find(c => c.key === 'martillo')); __step(1); });
  });
  await toma('09-seguimiento', {}, async p => {
    await montar(p, 'arrecife', { pasos: 1 });
    await p.evaluate(() => { startFollow(world.creatures.find(c => c.key === 'martillo')); __step(150); });
  });
  await toma('10-camara', {}, async p => {
    await montar(p, 'arrecife');
    await p.evaluate(() => {
      const c = world.creatures.find(c => c.key === 'blanco');
      setCamera(true); positionViewfinder(c.x - 70, c.y); __step(1);
    });
  });
  await toma('11-album', {}, async p => {
    await montar(p, 'arrecife');
    await p.evaluate(() => { openAlbum(); showAlbumDetail('blanco'); });
  });
  await toma('12-bitacora', {}, async p => {
    await montar(p, 'arrecife');
    await p.evaluate(() => document.getElementById('menuBtn').click());
  });
  await toma('13-movil-inicio', { w: 390, h: 844, dpr: 2 }, p => montar(p, 'arrecife', { modo: null }));
  await toma('14-movil-juego', { w: 390, h: 844, dpr: 2 }, p => montar(p, 'arrecife'));
  await toma('15-especies', { w: 1760, h: 1080 }, async p => {
    await p.evaluate(keys => {
      world.time = 40;
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;z-index:999;background:#0a2436;display:grid;grid-template-columns:repeat(8,220px);grid-auto-rows:180px';
      keys.forEach((k, i) => {
        __seed(i * 31 + 5);
        const d = document.createElement('div'), cv = renderPortrait(k, 216, 150, false), t = document.createElement('div');
        cv.style.cssText = 'width:216px;height:150px;display:block';
        t.textContent = SPECIES[k].nombre;
        t.style.cssText = 'font:13px sans-serif;color:#cfe;text-align:center';
        d.append(cv, t);
        el.append(d);
      });
      document.body.append(el);
    }, KEYS);
  });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
