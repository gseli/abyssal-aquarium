/* La imagen de vista previa al compartir el enlace (og:image), 1200×630.
   uso: node portada.js <url> <salida.jpg> */
'use strict';
const { pw, GPU, abrir, montar } = require('./comun');
const [url, out] = process.argv.slice(2);

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: GPU });
  const p = await abrir(url, { w: 1200, h: 630, idioma: 'en' }, b);
  await montar(p, 'arrecife', { modo: null });
  // solo el título sobre el acuario: las tarjetas no se leen en una miniatura
  await p.evaluate(() => document.querySelectorAll('.modes, .start-foot').forEach(e => e.remove()));
  await p.waitForTimeout(1100); // las transiciones de CSS corren con reloj real
  await p.screenshot({ path: out, type: 'jpeg', quality: 88, animations: 'disabled' });
  console.log(out, p.errores.length ? JSON.stringify(p.errores.slice(0, 4)) : 'ok');
  await b.close();
})();
