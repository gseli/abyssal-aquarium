/* ============================================================
   ACUARIO ABISAL — álbum de la expedición
   Siluetas para lo no visto, retratos para lo registrado,
   entrada completa para lo fotografiado. Los momentos, con pista.
   Requiere save.js, creatures.js, biomes.js y momentos.js.
   Cargar antes de aquarium.js.
   ============================================================ */
'use strict';

/* caja aproximada de cada especie para encuadrar el retrato */
function portraitBox(key) {
  const sp = SPECIES[key];
  if (sp.kind === 'spine') {
    const len = (sp.len[0] + sp.len[1]) / 2;
    return { w: len * 1.15, h: len * 0.5, oy: 0 };
  }
  const boxes = {
    sardina:  { w: 24, h: 12, oy: 0 },
    medusa:   { w: 80, h: 100, oy: -0.2 },
    estrella: { w: 52, h: 52, oy: 0 },
    faroluz:  { w: 58, h: 46, oy: 0.12 },
    payaso:   { w: 34, h: 23, oy: 0 },
    pulpo:    { w: 60, h: 52, oy: 0 },
    raya:     { w: 170, h: 70, oy: 0 },
    ermitano: { w: 52, h: 32, oy: 0.12 },
    espejo:   { w: 48, h: 34, oy: 0 },
    buzo:     { w: 120, h: 78, oy: 0.02 },
    jardin:   { w: 30, h: 62, oy: 0 },
    rape:     { w: 76, h: 62, oy: 0.12 },
    vampiro:  { w: 56, h: 60, oy: 0 },
    hacha:    { w: 34, h: 26, oy: 0 },
    constelacion: { w: 78, h: 46, oy: 0 },
    mero:     { w: 150, h: 84, oy: 0 },
    jureles:  { w: 36, h: 18, oy: 0 },
    dumbo:    { w: 54, h: 46, oy: 0 },
    vigia:    { w: 42, h: 40, oy: 0 },
    moneda:   { w: 26, h: 20, oy: 0.08 },
    campana:  { w: 46, h: 72, oy: -0.12 },
    semilla:  { w: 36, h: 30, oy: 0.16 },
    colibri:  { w: 56, h: 30, oy: 0.1 },
    diente:   { w: 64, h: 60, oy: 0 },
    caballito:{ w: 40, h: 42, oy: 0 },
    globo:    { w: 56, h: 48, oy: 0 },
    tortuga:  { w: 104, h: 56, oy: 0 },
    copa:     { w: 46, h: 32, oy: 0.05 },
    sifon:    { w: 50, h: 66, oy: -0.1 },
  };
  return boxes[sp.kind] || { w: 60, h: 40, oy: 0 };
}

/* ejemplar posado para el retrato — NO se añade al mundo */
function makeSpecimen(key) {
  const sp = SPECIES[key];
  let c;
  if (sp.kind === 'spine') {
    c = new SpineFish(key, sp, 0, 0);
    c.vel = { x: 1, y: 0 };
    for (let i = 0; i < c.spine.length; i++) {
      c.spine[i].x = c.len * 0.5 - i * c.segLen;
      c.spine[i].y = Math.sin(i * 0.55) * c.maxW * 0.4;
    }
  } else {
    c = new sp.ctor(key, sp, 0, 0);
    c.x = 0; c.y = 0;
    if (c.vel) { c.vel = { x: 30, y: 0 }; }
    if (key === 'raya' || key === 'ermitano' || key === 'buzo' || key === 'tortuga') c.dir = 1;
    if (key === 'ermitano') c.hide = 0;
    if (key === 'pulpo') c.calm = 0.15;
    if (key === 'jardin') { c.baseY = c.h * 0.5; c.shy = 0; }
    if (key === 'globo') c.inflate = 0.55; // que pose inflado, que es su gracia
    if (key === 'copa') c.fill = 0.6;
  }
  return c;
}

const _portraitCache = new Map();

function renderPortrait(key, cw, ch, silhouette) {
  const cacheKey = `${key}|${cw}x${ch}|${silhouette ? 's' : 'n'}`;
  if (_portraitCache.has(cacheKey)) return _portraitCache.get(cacheKey);
  const cv = document.createElement('canvas');
  cv.width = cw * 2; cv.height = ch * 2;
  luz.agua = null;
  const c2 = cv.getContext('2d');
  c2.scale(2, 2);
  const box = portraitBox(key);
  const s = Math.min((cw - 24) / box.w, (ch - 18) / box.h);
  c2.save();
  c2.translate(cw / 2, ch / 2 + (box.oy || 0) * ch);
  c2.scale(s, s);
  const keepSparks = world.sparks;
  const keepMix = world.abyssMix;
  world.sparks = []; // que el retrato no ensucie el acuario
  if (SPECIES[key].tipo === 'ficticio') world.abyssMix = 0.85; // los ficticios posan brillando
  try {
    makeSpecimen(key).draw(c2);
  } catch (e) { /* un retrato fallido no debe tumbar el álbum */ }
  world.sparks = keepSparks;
  world.abyssMix = keepMix;
  c2.restore();
  // los halos se apagan antes del borde, para que el lienzo no los corte en cuadro
  c2.globalCompositeOperation = 'destination-in';
  for (const [x1, y1, borde] of [[cw, 0, 12 / cw], [0, ch, 12 / ch]]) {
    const g = c2.createLinearGradient(0, 0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(borde, 'rgba(0,0,0,1)');
    g.addColorStop(1 - borde, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = g;
    c2.fillRect(0, 0, cw, ch);
  }
  c2.globalCompositeOperation = 'source-over';
  if (silhouette) {
    c2.globalCompositeOperation = 'source-in';
    c2.fillStyle = '#03111c';
    c2.fillRect(0, 0, cw, ch);
    c2.globalCompositeOperation = 'source-over';
  }
  _portraitCache.set(cacheKey, cv);
  return cv;
}

/* ---------- interfaz del álbum ---------- */
const albumEl = document.getElementById('album');
const albumGrid = document.getElementById('albumGrid');
const albumDetail = document.getElementById('albumDetail');
const albumCount = document.getElementById('albumCount');
const albumProgress = document.getElementById('albumProgress');
let albumSelected = null;

/* cada retrato lleva el agua de su ecosistema */
function fondoRetrato(bioma, visto) {
  const { bg, clima } = BIOMES[bioma];
  if (!visto) return `linear-gradient(${luz.css(luz.mezcla(bg.mid, [8, 30, 44], 0.75))}, ${luz.css(luz.mezcla(bg.bottom, [8, 30, 44], 0.75))})`;
  return `radial-gradient(ellipse at 45% -10%, ${luz.css(clima.luz, 0.22)}, transparent 70%),`
    + `linear-gradient(${luz.css(luz.mezcla(bg.top, bg.mid, 0.4))}, ${luz.css(bg.bottom)})`;
}

function albumTotals() {
  const keys = Object.keys(SPECIES);
  let seen = 0, shot = 0;
  for (const k of keys) {
    if (isSeen(k)) seen++;
    if (hasPhoto(k)) shot++;
  }
  return { total: keys.length, seen, shot };
}

function refreshAlbumHud() {
  const t = albumTotals();
  albumProgress.textContent = `${t.seen}/${t.total}`;
  const m = momentos.totales();
  momentosProgress.textContent = `${m.hechos}/${m.total}`;
  albumCount.textContent = pestana === 'momentos'
    ? tr('{hechos} de {total} momentos · se fotografían mientras ocurren', m)
    : tr('{seen} registradas · {shot} fotografiadas · {total} en total', t);
}

/* ---------- pestaña de momentos ---------- */
const momentosGrid = document.getElementById('momentosGrid');
const momentosProgress = document.getElementById('momentosProgress');
const tabEspecies = document.getElementById('tabEspecies');
const tabMomentos = document.getElementById('tabMomentos');
let pestana = 'especies';

function buildMomentosGrid() {
  momentosGrid.innerHTML = '';
  for (const [id, m] of Object.entries(momentos.lista)) {
    const bioma = BIOMES[m.bioma];
    const foto = momentos.foto(id), abierto = biomeUnlocked(m.bioma);
    const el = document.createElement('article');
    el.className = 'momento' + (foto ? ' hecho' : '');
    el.innerHTML = `
      <div class="momento-marco"><span class="incognita">···</span></div>
      <div class="momento-texto">
        <span class="momento-donde"></span>
        <h3></h3>
        <p></p>
      </div>`;
    const marco = el.querySelector('.momento-marco');
    marco.style.background = fondoRetrato(m.bioma, !!foto || abierto);
    if (foto) {
      const img = document.createElement('img');
      img.src = foto;
      img.alt = tr('Tu foto: {nombre}', m);
      marco.replaceChildren(img);
    }
    el.querySelector('.momento-donde').textContent = foto || abierto
      ? `${bioma.nombre} · ${tr(m.provoca ? 'LO PROVOCAS' : 'OCURRE SOLO')}`
      : tr('MÁS ABAJO');
    el.querySelector('h3').textContent = foto ? m.nombre : '???';
    el.querySelector('p').textContent = foto ? m.relato
      : abierto ? m.pista : tr('Este ecosistema todavía no te conoce. Baja primero y luego hablamos.');
    momentosGrid.appendChild(el);
  }
}

function setPestana(nombre) {
  pestana = nombre;
  const m = nombre === 'momentos';
  albumGrid.hidden = albumDetail.hidden = m;
  momentosGrid.hidden = !m;
  tabEspecies.setAttribute('aria-selected', String(!m));
  tabMomentos.setAttribute('aria-selected', String(m));
  if (m) buildMomentosGrid();
  refreshAlbumHud();
}
tabEspecies.addEventListener('click', () => setPestana('especies'));
tabMomentos.addEventListener('click', () => setPestana('momentos'));

function buildAlbumGrid() {
  albumGrid.innerHTML = '';
  for (const key of Object.keys(SPECIES)) {
    const sp = SPECIES[key];
    const seen = isSeen(key), shot = hasPhoto(key);
    const card = document.createElement('div');
    card.className = 'album-card' + (seen ? '' : ' locked') + (key === albumSelected ? ' selected' : '');
    card.dataset.key = key;
    const thumb = renderPortrait(key, 150, 84, !seen);
    thumb.style.width = '100%';
    thumb.style.background = fondoRetrato(sp.bioma, seen);
    card.appendChild(thumb);
    const name = document.createElement('div');
    name.className = 'ac-name';
    name.textContent = seen ? sp.nombre : '???';
    card.appendChild(name);
    const state = document.createElement('div');
    state.className = 'ac-state' + (shot ? ' done' : seen ? ' pend' : '');
    state.textContent = tr(shot ? '✦ COMPLETA' : seen ? 'SIN FOTOGRAFIAR' : 'NO REGISTRADA');
    card.appendChild(state);
    albumGrid.appendChild(card);
  }
}

function showAlbumDetail(key) {
  const sp = SPECIES[key];
  const seen = isSeen(key), shot = hasPhoto(key);
  if (!seen) return;
  albumSelected = key;
  albumDetail.classList.remove('empty');
  const badgeText = tr({ real: 'REAL', ficticio: 'FICTICIO', expedicion: 'EXPEDICIÓN' }[sp.tipo]);
  albumDetail.innerHTML = `
    <div class="card-head"><span class="badge ${sp.tipo}">${badgeText}</span></div>
    <h3>${sp.nombre}</h3>
    <p class="sci">${sp.sci}</p>
    <div class="ad-portrait-slot"></div>
    ${shot && save.photos[key] ? `
      <span class="ad-photo-label">${tr('TU FOTO · EXPEDICIÓN Nº7')}</span>
      <img class="ad-photo" src="${save.photos[key]}" alt="${tr('Foto de {nombre}', sp)}">` : ''}
    ${shot
      ? `<p class="fact">${sp.fact}</p>
         <div class="curioso"><label>${tr('PARA CURIOSOS')}</label><p>${sp.curioso}</p></div>`
      : `<p class="fact locked">${tr('Entrada incompleta. Fotografíala (tecla C) para que la expedición redacte su informe.')}</p>`}
    <div class="stats">
      <div><label>${tr('TAMAÑO')}</label><span>${sp.tam}</span></div>
      <div><label>${tr('PROFUNDIDAD')}</label><span>${sp.prof}</span></div>
      <div><label>${tr('DIETA')}</label><span>${sp.dieta}</span></div>
    </div>`;
  const slot = albumDetail.querySelector('.ad-portrait-slot');
  const portrait = renderPortrait(key, 348, 170, false);
  portrait.className = 'ad-portrait';
  portrait.style.background = fondoRetrato(sp.bioma, true);
  slot.replaceWith(portrait);
  // marcar tarjeta seleccionada
  for (const el of albumGrid.children) {
    el.classList.toggle('selected', el.dataset.key === key);
  }
}

function openAlbum() {
  albumEl.hidden = false;
  refreshAlbumHud();
  if (pestana === 'momentos') buildMomentosGrid();
  buildAlbumGrid();
  if (albumSelected && isSeen(albumSelected)) showAlbumDetail(albumSelected);
}

function closeAlbum() {
  albumEl.hidden = true;
}

/* refresco tras registrar/fotografiar (llamado desde aquarium.js) */
function refreshAlbumUI() {
  refreshAlbumHud();
  if (!albumEl.hidden) {
    if (pestana === 'momentos') buildMomentosGrid();
    buildAlbumGrid();
    if (albumSelected && isSeen(albumSelected)) showAlbumDetail(albumSelected);
  }
}

albumGrid.addEventListener('click', e => {
  const card = e.target.closest('.album-card');
  if (card && !card.classList.contains('locked')) showAlbumDetail(card.dataset.key);
});
document.getElementById('albumBtn').addEventListener('click', openAlbum);
document.getElementById('albumClose').addEventListener('click', closeAlbum);
