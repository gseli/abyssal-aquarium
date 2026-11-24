/* ============================================================
   ACUARIO ABISAL — idioma
   Inglés por defecto (la versión que se publica); español a
   elección desde la pantalla de inicio. El código y los datos se
   escriben en español y tr() los traduce con ingles.js. El HTML
   de index.html está escrito en inglés y se pasa al español
   recorriéndolo con el mismo diccionario, al revés.
   La elección vive en su propia clave: no es parte de la partida
   y «reiniciar expedición» no la borra.
   Requiere ingles.js. Cargar justo después de save.js.
   ============================================================ */
'use strict';

const IDIOMA_KEY = 'acuario-abisal-idioma';

const idioma = (() => {
  let actual = 'en';
  try { if (localStorage.getItem(IDIOMA_KEY) === 'es') actual = 'es'; } catch (e) { /* sin almacenamiento */ }

  // \s incluye el espacio duro: las claves se comparan sin él
  const plano = s => s.replace(/\s+/g, ' ').trim();
  const aIngles = new Map(Object.entries(INGLES.ui).map(([es, en]) => [plano(es), en]));
  const alEspanol = new Map(Object.entries(INGLES.ui).map(([es, en]) => [plano(en), es]));
  const avisadas = new Set();

  /* tr('texto en español', {variables}) → el texto en el idioma actual */
  function tr(texto, vars) {
    let s = texto;
    if (actual === 'en') {
      s = aIngles.get(plano(texto));
      if (s == null) {
        if (!avisadas.has(texto)) { avisadas.add(texto); console.warn('[idioma] sin traducir:', texto); }
        s = texto;
      }
    }
    return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s;
  }

  /* 38,0 en español; 38.0 en inglés */
  const decimal = (n, d = 1) => {
    const s = n.toFixed(d);
    return actual === 'es' ? s.replace('.', ',') : s;
  };

  /* espacios duros donde el HTML original los tenía: alrededor de «·» y
     «&», tras el símbolo inicial y en «No. 7» */
  const fino = s => s
    .replace(/ (?=[·&])|(?<=[·&]) /g, ' ')
    .replace(/^([✦◉✧❋⌂☰♪]) /u, '$1 ')
    .replace(/No\. (\d)/g, 'No. $1');

  /* el contenido: especies, biomas y momentos, guardando el original */
  function contenido() {
    const ing = actual === 'en';
    for (const [k, sp] of Object.entries(SPECIES)) {
      if (!sp._es) sp._es = { nombre: sp.nombre, fact: sp.fact, curioso: sp.curioso, tam: sp.tam, prof: sp.prof, dieta: sp.dieta };
      const en = INGLES.especies[k];
      if (ing && !en) console.warn('[idioma] especie sin traducir:', k);
      Object.assign(sp, sp._es, ing ? en : null);
    }
    for (const [k, b] of Object.entries(BIOMES)) {
      if (!b._es) b._es = { nombre: b.nombre };
      Object.assign(b, b._es, ing ? { nombre: INGLES.biomas[k] ?? b._es.nombre } : null);
    }
    for (const [k, m] of Object.entries(momentos.lista)) {
      if (!m._es) m._es = { nombre: m.nombre, pista: m.pista, relato: m.relato };
      Object.assign(m, m._es, ing ? INGLES.momentos[k] : null);
    }
  }

  /* el HTML estático, en cualquiera de las dos direcciones */
  function documento(raiz = document.body) {
    const mapa = actual === 'en' ? aIngles : alEspanol;
    const salto = /^(SCRIPT|NOSCRIPT|STYLE)$/;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode: n => salto.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const otro = mapa.get(plano(n.nodeValue));
      if (otro == null) continue;
      const [, antes, , despues] = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.nodeValue);
      n.nodeValue = antes + fino(otro) + despues;
    }
    for (const at of ['aria-label', 'title', 'alt']) {
      for (const el of raiz.querySelectorAll(`[${at}]`)) {
        const otro = mapa.get(plano(el.getAttribute(at)));
        if (otro != null) el.setAttribute(at, otro);
      }
    }
    const titulo = mapa.get(plano(document.title));
    if (titulo != null) document.title = titulo;
    document.documentElement.lang = actual;
  }

  function aplicar() {
    contenido();
    documento();
  }

  function cambiar(nuevo) {
    if (nuevo !== 'en' && nuevo !== 'es') return;
    actual = nuevo;
    try { localStorage.setItem(IDIOMA_KEY, nuevo); } catch (e) { /* sin almacenamiento */ }
    aplicar();
  }

  return { get actual() { return actual; }, tr, decimal, aplicar, cambiar };
})();

const tr = idioma.tr;
