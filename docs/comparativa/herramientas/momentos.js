/* Cada momento con interacción real: se provoca con el ratón (o se espera),
   se fotografía con la cámara del juego y se comprueba tras recargar.
   Dos pasadas: población llena y la mínima que deja el modo descubrimiento.
   uso: node momentos.js <url> <carpeta de salida> [id,id] */
'use strict';
const { pw, GPU, abrir, montar, ESCENAS } = require('./comun');

const [url, out, filtro] = process.argv.slice(2);
require('fs').mkdirSync(out, { recursive: true });
const CASOS = [
  ['rastreo', 'arrecife'], ['saludo', 'arrecife', 'luz'], ['susto', 'burbujeante'], ['baile', 'burbujeante', 'plancton'],
  ['contraluz', 'abismo'], ['mapa', 'abismo', 'luz'], ['retumbo', 'naufragio'], ['guardia', 'naufragio', 'campana'],
  ['polinizacion', 'imposible'], ['siembra', 'imposible', 'diente'],
];

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: GPU });
  let i = 15, fallos = 0;
  for (const [id, biome, gesto] of CASOS) {
    i++;
    if (filtro && !filtro.split(',').includes(id)) continue;
    for (const pob of ['llena', 'minima']) {
      const p = await abrir(url, { biome }, b);
      let escena = ESCENAS[biome];
      if (pob === 'minima') escena = [...new Map(escena.map(e => [e[0], e])).values()];
      await montar(p, biome, { modo: pob === 'minima' ? 'descubrimiento' : 'acuario', escena });
      const pobAntes = await p.evaluate(() => world.creatures.filter(c => !c.leaving).length);
      if (!gesto) {
        // espera natural, sin llamar a nada interno
        await p.evaluate(() => { for (let s = 0; s < 70 && !momentos.activo; s++) __step(60); });
      } else {
        const pt = await p.evaluate(g => {
          if (g === 'campana' || g === 'diente') { const c = world.creatures.find(c => c.key === g); return toScreen(c.x, c.y); }
          setBait(g);
          const x0 = g === 'plancton' ? world.creatures.find(c => c.key === 'jardin').x : world.W * 0.5;
          for (let r = 0; r < 260; r += 14) {
            for (const s of [1, -1]) {
              const x = x0 + r * s, y = g === 'plancton' ? world.floorY(x) - 100 : world.H * 0.44;
              if (!creatureAt(x, y) && document.elementFromPoint(x, y) === canvas) return { x, y };
            }
          }
        }, gesto);
        await p.mouse.click(pt.x, pt.y);
        await p.mouse.move(700, 120); // que el cursor no asuste a los actores
        await p.evaluate(() => { world.mouse.active = false; });
      }
      const empezo = await p.evaluate(() => momentos.activo && momentos.activo.id);
      let foco = null;
      for (let s = 0; s < 34 && !foco; s++) {
        foco = await p.evaluate(() => {
          __step(60);
          const m = momentos.activo;
          if (!m) return null;
          const f = m.def.focos(m);
          return f.length && m.k > 0.5 ? f : null;
        });
      }
      if (foco) { // un poco más, hasta que el gesto se lea
        await p.evaluate(() => __step(150));
        foco = await p.evaluate(() => { const m = momentos.activo; return m && m.def.focos(m).map(f => toScreen(f.x, f.y)); });
      }
      await p.screenshot({ path: `${out}/${i}-momento-${id}${pob === 'minima' ? '-minima' : ''}.png`, animations: 'disabled' });
      let hecho = false;
      if (foco && foco.length) {
        const f = foco[Math.min(foco.length - 1, Math.floor(foco.length / 2))];
        await p.keyboard.press('c');
        await p.mouse.move(f.x, f.y);
        await p.mouse.down(); await p.mouse.up();
        hecho = await p.evaluate(id => !!momentos.foto(id), id);
      }
      const fin = await p.evaluate(() => {
        setCamera(false); world.mouse.active = false;
        for (let s = 0; s < 45 && momentos.activo; s++) __step(60);
        const r = {
          acabado: !momentos.activo,
          poses: world.creatures.filter(c => c.tenue || c.enterrada || c.baila || c.mira || c.retumba || c.mapa || c.borrado).length,
        };
        for (let s = 0; s < 22; s++) __step(60);
        r.invitadosQueQuedan = world.creatures.filter(c => c.invitado && !c.leaving).length;
        r.pob = world.creatures.filter(c => !c.leaving).length;
        return r;
      });
      await p.waitForTimeout(500);
      await p.reload();
      const persiste = await p.evaluate(id => !!momentos.foto(id), id);
      const bien = empezo === id && hecho && persiste && fin.acabado && !fin.poses && !fin.invitadosQueQuedan && !p.errores.length;
      if (!bien) fallos++;
      console.log(bien ? 'OK   ' : 'FALLO', id.padEnd(13), pob.padEnd(7),
        JSON.stringify({ empezo, hecho, persiste, ...fin, pobAntes }), p.errores.join('|').slice(0, 300));
      await p.context().close();
    }
  }
  await b.close();
  console.log('FALLOS:', fallos);
})().catch(e => { console.error(e); process.exit(1); });
