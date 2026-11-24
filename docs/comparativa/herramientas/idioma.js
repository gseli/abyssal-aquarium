/* ============================================================
   Prueba de idiomas: que el inglés (por defecto) no deje nada en
   español, que el español vuelva exacto y que la elección dure.
   uso: node idioma.js <url> [carpeta para capturas]
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { pw, GPU, KEYS, abrir, montar } = require('./comun');

const [url, out] = process.argv.slice(2);
if (out) fs.mkdirSync(out, { recursive: true });
let fallos = 0;
const ok = (nombre, bien, detalle = '') => {
  console.log(`${bien ? '✓' : '✗'} ${nombre}${bien ? '' : '  → ' + detalle}`);
  if (!bien) fallos++;
};
const foto = async (p, nombre) => { if (out) await p.screenshot({ path: path.join(out, nombre + '.png') }); };

/* 1 · estático: todo literal que pasa por tr() tiene traducción */
const raiz = path.join(__dirname, '../../..');
const ctx = {};
new Function('ctx', fs.readFileSync(path.join(raiz, 'ingles.js'), 'utf8') + ';ctx.INGLES = INGLES;')(ctx);
const plano = s => s.replace(/\s+/g, ' ').trim();
const claves = new Set(Object.keys(ctx.INGLES.ui).map(plano));
const faltan = [];
for (const f of ['aquarium.js', 'album.js']) {
  const src = fs.readFileSync(path.join(raiz, f), 'utf8').split('\n');
  src.forEach((linea, i) => {
    // las líneas con tr( y las dos que siguen (ternarios partidos), más las tablas que se traducen al pintar
    const zona = src.slice(Math.max(0, i - 2), i + 1).join(' ');
    if (!/\btr\(/.test(zona) && !/GROUP_LABELS = |BADGE_TEXT = /.test(src.slice(Math.max(0, i - 3), i + 1).join(' '))) return;
    for (const [, lit] of linea.matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
      if (/^[a-z][A-Za-z_-]*$/.test(lit.trim()) || !/[A-Za-zÁ-ú]{2}/.test(lit)) continue;
      if (/^(true|false)$|^\.|^#|^\[/.test(lit)) continue;
      if (!claves.has(plano(lit))) faltan.push(`${f}:${i + 1} ${lit}`);
    }
  });
}
ok('cada texto de tr() tiene su traducción', !faltan.length, faltan.join(' | '));
const sinEspecie = KEYS.filter(k => !ctx.INGLES.especies[k]?.nombre || !ctx.INGLES.especies[k]?.fact || !ctx.INGLES.especies[k]?.curioso);
ok('las 44 especies traducidas', !sinEspecie.length, sinEspecie.join(' '));

/* lo que se ve o se lee en voz alta, con trazas de español */
function espanolVisible() {
  const ES = /[áéíóúñ¿¡]|\b(de|del|la|las|los|el|que|y|en|con|para|una|sin|solo|más|pulsa|toca)\b/i;
  const vistos = [];
  const visible = el => {
    if (!el || el.closest('.sci, [lang="es"], script, noscript, style')) return false;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' && !el.closest('[hidden]');
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue.trim();
    if (t && ES.test(t) && visible(n.parentElement)) vistos.push(t);
  }
  for (const el of document.querySelectorAll('[aria-label],[title],[alt]')) {
    if (el.closest('[lang="es"]')) continue;
    for (const at of ['aria-label', 'title', 'alt']) {
      const v = el.getAttribute(at);
      if (v && ES.test(v)) vistos.push(`@${at}: ${v}`);
    }
  }
  if (ES.test(document.title)) vistos.push('<title> ' + document.title);
  return vistos;
}

const MOMENTOS = ['rastreo', 'saludo', 'susto', 'baile', 'contraluz', 'mapa', 'retumbo', 'guardia', 'polinizacion', 'siembra'];
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const fotos = Object.fromEntries(KEYS.map(k => [k, PIXEL]));

(async () => {
  const b = await pw.chromium.launch({ channel: 'chrome', args: GPU });
  const sinTraducir = p => p.errores.filter(e => e.includes('[idioma]'));

  /* 2 · primera visita: inglés sin que nadie lo pida */
  {
    const p = await abrir(url, { vacia: true, idioma: null }, b);
    await p.evaluate(() => __step(30));
    const r = await p.evaluate(() => ({
      lang: document.documentElement.lang, titulo: document.querySelector('.start-title').textContent,
      pulsado: document.querySelector('[data-idioma="en"]').getAttribute('aria-pressed'),
      estado: document.getElementById('mcDesc').textContent,
    }));
    ok('primera visita en inglés', r.lang === 'en' && r.titulo === 'ABYSSAL AQUARIUM' && r.pulsado === 'true', JSON.stringify(r));
    ok('inicio sin español (vacío)', r.estado === 'NEW EXPEDITION', r.estado);
    const es = await p.evaluate(espanolVisible);
    ok('pantalla de inicio sin español', !es.length, es.join(' | '));
    await foto(p, 'en-inicio');
    await p.context().close();
  }

  /* 3 · el juego entero en inglés, con todo registrado y fotografiado */
  {
    const momentosHechos = JSON.stringify(Object.fromEntries(MOMENTOS.map(m => [m, PIXEL])));
    const p = await abrir(url, {
      idioma: null, extra: { photos: fotos },
      antes: `localStorage.setItem('acuario-abisal-momentos-v1', ${JSON.stringify(momentosHechos)})`,
    }, b);
    const visto = [];
    const revisar = async (donde) => {
      const es = await p.evaluate(espanolVisible);
      if (es.length) visto.push(`${donde}: ${es.slice(0, 4).join(' | ')}`);
    };
    await p.evaluate(() => __step(10));
    ok('inicio con partida', await p.evaluate(() => document.getElementById('mcDesc').textContent === 'ALBUM 44/44 · CONTINUE'
      && document.getElementById('mcAcua').textContent === '44 SPECIES AVAILABLE'));
    await revisar('inicio');
    await montar(p, 'arrecife', { modo: 'descubrimiento', pasos: 60 });
    await revisar('juego');
    ok('profundidad con punto decimal', await p.evaluate(() => /^−\d+\.\d m$/.test(document.getElementById('depth').textContent)),
      await p.evaluate(() => document.getElementById('depth').textContent));
    await foto(p, 'en-juego');

    await p.evaluate(() => document.getElementById('menuBtn').click());
    await p.evaluate(() => __step(60));
    await revisar('bitácora');
    await foto(p, 'en-bitacora');
    await p.evaluate(() => { closePanel(); select(world.creatures.find(c => c.key === 'martillo')); __step(2); });
    await revisar('ficha');
    ok('ficha en inglés', await p.evaluate(() => document.getElementById('cardName').textContent === 'Great hammerhead'
      && document.getElementById('cardBadge').textContent === 'REAL'));
    await foto(p, 'en-ficha');
    await p.evaluate(() => { startFollow(state.selected); __step(30); });
    await revisar('siguiendo');
    await p.evaluate(() => { stopFollow(); deselect(); setCamera(true); __step(30); });
    await revisar('cámara');
    await p.evaluate(() => { setCamera(false); openAlbum(); __step(2); });
    for (const k of KEYS) {
      await p.evaluate(k => showAlbumDetail(k), k);
      await revisar('álbum · ' + k);
    }
    await p.evaluate(() => showAlbumDetail('electrica'));
    await foto(p, 'en-album');
    await p.evaluate(() => { document.getElementById('tabMomentos').click(); __step(2); });
    await revisar('momentos');
    ok('momentos en inglés', await p.evaluate(() => document.querySelector('.momento h3').textContent === 'The metal detector'));
    await foto(p, 'en-momentos');
    await p.evaluate(() => { closeAlbum(); });

    // los avisos
    await p.evaluate(() => {
      document.getElementById('toasts').innerHTML = '';
      photographSpecies('blanco', save.photos.blanco);
      toast(avisoBloqueo(), 'bloqueo');
      state.unlockToasted = {};
      save.seen = {}; registerSpecies('sardina');
      refreshBiomeUI();
      __step(2);
    });
    const avisos = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent));
    ok('avisos en inglés', avisos.some(t => t.startsWith('◉ Photo updated — Great white shark'))
      && avisos.some(t => t.startsWith('To descend:')) && avisos.some(t => t === '✦ Species logged — Emerald sardine'), avisos.join(' | '));
    await revisar('avisos');

    // los cinco biomas por la flecha
    const nombres = [];
    await p.evaluate(() => { save.seen = Object.fromEntries(Object.keys(SPECIES).map(k => [k, 1])); refreshBiomeUI(); });
    for (let i = 0; i < 5; i++) {
      nombres.push(await p.evaluate(() => document.getElementById('biomeName').textContent));
      await p.evaluate(() => travel(1));
      await p.waitForTimeout(2100);
      await p.evaluate(() => __step(5));
    }
    ok('los cinco biomas en inglés', nombres.join(',') === 'THE REEF,THE FIZZING SEA,THE ABYSS,THE WRECK,THE IMPOSSIBLE GARDEN', nombres.join(','));
    ok('título del botón de bajar en el último', await p.evaluate(() => document.getElementById('biomeNext').title === 'There is nothing further down. Yet.'));
    await revisar('jardín');
    ok('nada en español en todo el recorrido', !visto.length, visto.join('\n    '));
    ok('ningún texto pidió traducción', !sinTraducir(p).length, sinTraducir(p).join(' | '));

    /* 4 · al español desde el inicio, en vivo, y que dure */
    await p.evaluate(() => { showStart(); __step(5); });
    await p.click('[data-idioma="es"]');
    await p.evaluate(() => __step(5));
    const es = await p.evaluate(() => ({
      lang: document.documentElement.lang, titulo: document.querySelector('.start-title').textContent,
      sub: document.querySelector('.start-sub').textContent.replace(/ /g, ' '),
      modo: document.querySelector('.mode-card .mc-desc').textContent,
      estado: document.getElementById('mcDesc').textContent,
      reset: document.getElementById('resetBtn').textContent,
      sp: SPECIES.blanco.nombre + '|' + SPECIES.vigia.prof + '|' + SPECIES.pulpo.tam,
      bioma: document.getElementById('biomeName').textContent,
      momento: momentos.lista.rastreo.nombre, doc: document.title,
      hud: document.querySelector('#albumBtn span').textContent + '|' + document.getElementById('albumBtn').getAttribute('aria-label'),
      prof: document.getElementById('depth').textContent,
    }));
    const esperado = {
      lang: 'es', titulo: 'ACUARIO ABISAL', sub: 'CRIATURAS REALES · & · FICTICIAS',
      modo: 'Observa, fotografía y completa el álbum. Las especies llegan solas — y algunas tienen sus condiciones.',
      estado: 'ÁLBUM 44/44 · CONTINUAR', reset: 'reiniciar expedición',
      sp: 'Tiburón blanco|La cofa|80 cm (brazos incl.)',
      bioma: 'EL JARDÍN IMPOSIBLE', momento: 'El detector de metales', doc: 'Acuario Abisal — criaturas reales & ficticias',
      hud: 'ÁLBUM|Abrir álbum',
    };
    const dif = Object.keys(esperado).filter(k => es[k] !== esperado[k]).map(k => `${k}: «${es[k]}»`);
    ok('el español vuelve exacto', !dif.length, dif.join(' | '));
    ok('profundidad con coma en español', /^−(\?\?\?|\d+,\d) m$/.test(es.prof), es.prof);
    const restos = await p.evaluate(() => {
      const ingles = new Set(Object.entries(INGLES.ui).filter(([a, b]) => a !== b).map(([, b]) => b.replace(/\s+/g, ' ').trim()));
      const r = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.nodeValue.replace(/\s+/g, ' ').trim();
        if (ingles.has(t) && !n.parentElement.closest('[lang="en"], noscript')) r.push(t);
      }
      return r;
    });
    ok('no queda inglés en el HTML', !restos.length, restos.join(' | '));
    await foto(p, 'es-inicio');
    await p.evaluate(() => { applyMode('descubrimiento'); openAlbum(); showAlbumDetail('vigia'); __step(2); });
    ok('álbum en español tras cambiar', await p.evaluate(() => albumDetail.querySelector('h3').textContent === 'El Vigía'
      && albumDetail.querySelector('.curioso label').textContent === 'PARA CURIOSOS'
      && /^El tesoro|^Subió a la cofa/.test(albumDetail.querySelector('.fact').textContent)));
    await p.reload();
    await p.evaluate(() => document.fonts.ready);
    ok('el español sigue tras recargar', await p.evaluate(() => document.documentElement.lang === 'es'
      && document.querySelector('.start-title').textContent === 'ACUARIO ABISAL'
      && document.querySelector('[data-idioma="es"]').getAttribute('aria-pressed') === 'true'));
    await p.click('[data-idioma="en"]');
    await p.evaluate(() => __step(5));
    const vuelta = await p.evaluate(espanolVisible);
    ok('y de vuelta al inglés, limpio', !vuelta.length && await p.evaluate(() => document.querySelector('.start-title').textContent === 'ABYSSAL AQUARIUM'), vuelta.join(' | '));
    ok('reiniciar pide confirmación en inglés', await p.evaluate(() => {
      const r = document.getElementById('resetBtn'); r.click();
      return r.textContent === 'sure? the whole album will be erased';
    }));
    ok('consola limpia', !p.errores.length, p.errores.join(' | '));
    await Promise.all([p.waitForNavigation(), p.evaluate(() => { __step(30); document.getElementById('resetBtn').click(); })]);
    ok('reiniciar borra la partida pero no el idioma', await p.evaluate(() =>
      localStorage.getItem('acuario-abisal-idioma') === 'en' && !Object.keys(save.seen).length && document.documentElement.lang === 'en'));
    await p.context().close();
  }

  /* 5 · móvil: que el inglés quepa */
  for (const w of [320, 390]) {
    const p = await abrir(url, { w, h: 720, dpr: 2, idioma: null }, b);
    await p.evaluate(() => __step(10));
    await foto(p, `en-inicio-${w}`);
    await montar(p, 'imposible', { modo: 'descubrimiento', pasos: 30 });
    await p.evaluate(() => { biomeDef = BIOMES.imposible; save.biome = 'imposible'; refreshBiomeUI(); __step(2); });
    const desborde = await p.evaluate(() => {
      const r = [];
      for (const el of document.querySelectorAll('.hud *, #baitDock *, #start *')) {
        const b = el.getBoundingClientRect();
        if (b.width && (b.right > innerWidth + 0.5 || b.left < -0.5)) r.push(el.id || el.className || el.tagName);
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'hidden') r.push('recortado:' + (el.id || el.className));
      }
      return [...new Set(r)];
    });
    ok(`a ${w} px nada se sale`, !desborde.length && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), desborde.join(' '));
    await foto(p, `en-juego-${w}`);
    await p.context().close();
  }

  await b.close();
  console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
