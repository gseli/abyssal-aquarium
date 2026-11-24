/* La pestaña Momentos del álbum, con fotos de verdad: recorta cuatro
   capturas que dejó momentos.js y las guarda como si las hubieras hecho.
   uso: node album-momentos.js <url> <carpeta con las capturas de momentos.js> */
'use strict';
const fs = require('fs');
const { pw, GPU, abrir, montar } = require('./comun');

const [url, dir] = process.argv.slice(2);

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: GPU });
  const t = await b.newPage();
  const fotos = {};
  for (const id of ['mapa', 'guardia', 'saludo', 'polinizacion']) {
    const f = fs.readdirSync(dir).find(f => f.endsWith(`momento-${id}.png`));
    const png = 'data:image/png;base64,' + fs.readFileSync(`${dir}/${f}`).toString('base64');
    fotos[id] = await t.evaluate(async png => {
      const i = new Image(); i.src = png; await i.decode();
      const c = document.createElement('canvas'); c.width = 320; c.height = 213;
      // el centro de la toma, como lo encuadraría el visor
      c.getContext('2d').drawImage(i, i.width / 2 - 260, i.height * 0.42 - 173, 520, 346, 0, 0, 320, 213);
      return c.toDataURL('image/jpeg', 0.8);
    }, png);
  }
  for (const [n, w, h, dpr] of [['26-album-momentos', 1440, 900, 1], ['27-album-momentos-movil', 390, 844, 2]]) {
    const p = await abrir(url, { w, h, dpr }, b);
    await p.evaluate(f => localStorage.setItem(MOMENTOS_KEY, JSON.stringify(f)), fotos);
    await p.reload();
    await p.evaluate(() => document.fonts.ready);
    await montar(p, 'arrecife');
    await p.evaluate(() => { openAlbum(); document.getElementById('tabMomentos').click(); });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${dir}/${n}.png`, animations: 'disabled' });
    console.log(n, p.errores.join('|') || 'ok');
    await p.context().close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
