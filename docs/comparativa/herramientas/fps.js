/* Fotogramas por segundo con la población máxima de cada bioma, reloj real.
   uso: node fps.js <url> [dpr,dpr] */
'use strict';
const { pw, GPU, abrir } = require('./comun');

const url = process.argv[2];
const dprs = (process.argv[3] || '1,2').split(',').map(Number);

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: GPU });
  for (const dpr of dprs) {
    for (const biome of ['arrecife', 'burbujeante', 'abismo', 'naufragio', 'imposible']) {
      const p = await abrir(url, { biome, dpr, reloj: false }, b);
      await p.evaluate(() => {
        applyMode('acuario');
        for (const k of biomeSpeciesKeys(save.biome)) while (countOf(k) < SPECIES[k].max) spawnCreature(k);
      });
      await p.waitForTimeout(5000);
      const r = await p.evaluate(() => new Promise(res => {
        const d = []; let l = performance.now(); const ini = l;
        (function f() {
          requestAnimationFrame(() => {
            const n = performance.now(); d.push(n - l); l = n;
            if (n - ini < 4000) return f();
            d.sort((a, b) => a - b);
            res({
              calidad: typeof luz === 'undefined' ? '-' : luz.calidad,
              fps: +(1000 * d.length / (n - ini)).toFixed(1),
              p95: +d[Math.floor(d.length * 0.95)].toFixed(1),
            });
          });
        })();
      }));
      console.log(`dpr${dpr}`, biome.padEnd(12), JSON.stringify(r), p.errores.join(' | ').slice(0, 200));
      await p.context().close();
    }
  }
  await b.close();
})();
