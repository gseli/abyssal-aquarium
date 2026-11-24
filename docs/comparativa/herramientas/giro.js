/* La media vuelta, antes y ahora: una tira de fotogramas y un vídeo a media
   velocidad con las mismas especies girando en las dos versiones.
   uso: node giro.js <url antes> <url ahora> <carpeta de salida> */
'use strict';
const fs = require('fs');
const { execFileSync } = require('child_process');
const { pw, GPU, abrir, montar } = require('./comun');

const [A, N, out] = process.argv.slice(2);
fs.mkdirSync(`${out}/fotogramas`, { recursive: true });
// [especie, bioma, zoom, fotogramas entre instantes de la tira]
const CASOS = [['payaso', 'arrecife', 3.2, 3], ['espejo', 'arrecife', 2.6, 3], ['rape', 'abismo', 2.4, 3],
  ['tortuga', 'burbujeante', 1.4, 7]];
const PASOS = 84, CW = 300, CH = 200;

async function rodar(b, url) {
  const filas = [];
  for (const [k, biome, Z] of CASOS) {
    const p = await abrir(url, { biome }, b);
    await montar(p, biome, { escena: [[k, 0.5, 0.45, 1]], pasos: 30 });
    filas.push(await p.evaluate(({ k, Z, PASOS, CW, CH }) => {
      const c = world.creatures.find(c => c.key === k);
      c.update = () => {};
      c.y = world.H * 0.45;
      const x0 = c.x, y0 = c.y;
      // los de espina giran de verdad, a su ritmo máximo; los demás cambian de sentido
      const pasosEspina = c.spine ? Math.ceil(Math.PI / ((c.sp.maxTurn || 1.6) / 60)) : 0;
      const espina = a => {
        c.vel = { x: Math.cos(a), y: Math.sin(a) };
        c.spine.forEach((s, j) => { const d = c.len / 2 - j * c.segLen; s.x = x0 + Math.cos(a) * d; s.y = y0 + Math.sin(a) * d; });
      };
      if (c.spine) espina(0); else { c.vel = { x: 1.2, y: 0 }; if ('dir' in c) c.dir = 1; }
      view.follow = null; view.scale = view.targetScale = Z; view.x = x0; view.y = y0;
      __step(60);
      if (!c.spine) { c.vel = { x: -1.2, y: 0 }; if ('dir' in c) c.dir = -1; }
      const sea = document.getElementById('sea'), d = sea.width / innerWidth;
      const L = Math.max(c.len || 0, (c.r || 0) * 2, 30) * Z * (c.spine ? 1.5 : 2.4), lh = L * CH / CW;
      const r = [];
      for (let i = 0; i < PASOS; i++) {
        if (c.spine) espina(Math.min(1, i / pasosEspina) * Math.PI);
        __step(1);
        const s = toScreen(x0, y0);
        const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
        cv.getContext('2d').drawImage(sea, (s.x - L / 2) * d, (s.y - lh / 2) * d, L * d, lh * d, 0, 0, CW, CH);
        r.push(cv.toDataURL('image/jpeg', 0.92));
      }
      return r;
    }, { k, Z, PASOS, CW, CH }));
    console.log(url, k, p.errores.join('|') || 'ok');
    await p.context().close();
  }
  return filas;
}

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: GPU });
  const antes = await rodar(b, A), ahora = await rodar(b, N);
  const p = await b.newPage();
  await p.setContent('<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet"><span style="font-family:IBM Plex Mono">.</span>');
  await p.evaluate(() => document.fonts.ready);
  const componer = (celdas, marcos) => p.evaluate(async ({ celdas, marcos, CW, CH }) => {
    const carga = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    // celdas[fila][col]: filas = especie × (antes, ahora)
    const ET = 26, filas = celdas.length, cols = celdas[0].length;
    const cv = document.createElement('canvas'); cv.width = 90 + cols * CW; cv.height = filas * (CH + (marcos ? ET : 0));
    const x = cv.getContext('2d');
    x.fillStyle = '#071722'; x.fillRect(0, 0, cv.width, cv.height);
    x.font = '500 13px "IBM Plex Mono"'; x.textBaseline = 'middle';
    for (let f = 0; f < filas; f++) {
      const y = f * (CH + (marcos ? ET : 0));
      x.fillStyle = f % 2 ? '#9fe3d0' : '#8aa4b4';
      x.fillText(f % 2 ? 'AHORA' : 'ANTES', 18, y + CH / 2);
      for (let c = 0; c < cols; c++) x.drawImage(await carga(celdas[f][c]), 90 + c * CW, y);
      if (marcos && f % 2) {
        x.fillStyle = '#5d7a8a';
        marcos[(f - 1) / 2].forEach((m, c) => x.fillText(m, 90 + c * CW + 8, y + CH + ET / 2));
      }
    }
    return cv.toDataURL('image/jpeg', 0.9);
  }, { celdas, marcos, CW, CH });
  const guardar = (ruta, url) => fs.writeFileSync(ruta, Buffer.from(url.split(',')[1], 'base64'));

  // la tira: diez instantes de cada vuelta, más juntos en los que giran deprisa
  const celdas = [], textos = [];
  CASOS.forEach(([, , , cada], e) => {
    const marcas = Array.from({ length: 10 }, (_, i) => 1 + i * cada);
    celdas.push(marcas.map(m => antes[e][m]), marcas.map(m => ahora[e][m]));
    textos.push(marcas.map(m => `${(m / 60).toFixed(2)} s`));
  });
  guardar(`${out}/giro-tira.jpg`, await componer(celdas, textos));

  // el vídeo: cada fotograma, especies en columnas
  for (let i = 0; i < PASOS; i++) {
    const g = [antes.map(f => f[i]), ahora.map(f => f[i])];
    guardar(`${out}/fotogramas/${String(i).padStart(3, '0')}.jpg`, await componer(g, null));
  }
  await b.close();
  // a media velocidad, y la vuelta se repite tres veces
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-stream_loop', '2', '-framerate', '30', '-i', `${out}/fotogramas/%03d.jpg`,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', `${out}/giro.mp4`]);
  fs.rmSync(`${out}/fotogramas`, { recursive: true });
  console.log('listo');
})().catch(e => { console.error(e); process.exit(1); });
