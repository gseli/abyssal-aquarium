/* ============================================================
   ACUARIO ABISAL — álbum de la expedición
   Siluetas para lo no visto, retratos para lo registrado,
   entrada completa para lo fotografiado.
   Requiere save.js y creatures.js. Cargar antes de aquarium.js.
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
    sardina:  { w: 24, h: 14, oy: 0 },
    medusa:   { w: 80, h: 130, oy: -0.32 },
    estrella: { w: 52, h: 52, oy: 0 },
    faroluz:  { w: 40, h: 36, oy: 0.06 },
    payaso:   { w: 26, h: 16, oy: 0 },
    pulpo:    { w: 60, h: 52, oy: 0 },
    raya:     { w: 170, h: 70, oy: 0 },
    ermitano: { w: 34, h: 26, oy: 0.1 },
    espejo:   { w: 38, h: 22, oy: 0 },
    buzo:     { w: 80, h: 96, oy: 0.04 },
    jardin:   { w: 30, h: 62, oy: 0 },
    rape:     { w: 56, h: 46, oy: 0.04 },
    vampiro:  { w: 48, h: 52, oy: 0 },
    hacha:    { w: 34, h: 26, oy: 0 },
    constelacion: { w: 78, h: 46, oy: 0 },
    mero:     { w: 120, h: 66, oy: 0 },
    jureles:  { w: 26, h: 14, oy: 0 },
    dumbo:    { w: 42, h: 40, oy: 0 },
    vigia:    { w: 34, h: 32, oy: 0.05 },
    moneda:   { w: 18, h: 14, oy: 0 },
    campana:  { w: 42, h: 58, oy: -0.06 },
    semilla:  { w: 24, h: 22, oy: 0 },
    colibri:  { w: 34, h: 22, oy: 0 },
    diente:   { w: 52, h: 52, oy: 0 },
    caballito:{ w: 40, h: 42, oy: 0 },
    globo:    { w: 46, h: 34, oy: 0 },
    tortuga:  { w: 104, h: 56, oy: 0 },
    copa:     { w: 44, h: 28, oy: 0 },
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
  if (silhouette) {
    c2.globalCompositeOperation = 'source-in';
    c2.fillStyle = '#132638';
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
  albumCount.textContent = `${t.seen} registradas · ${t.shot} fotografiadas · ${t.total} en total`;
}

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
    card.appendChild(thumb);
    const name = document.createElement('div');
    name.className = 'ac-name';
    name.textContent = seen ? sp.nombre : '???';
    card.appendChild(name);
    const state = document.createElement('div');
    state.className = 'ac-state' + (shot ? ' done' : seen ? ' pend' : '');
    state.textContent = shot ? '✦ COMPLETA' : seen ? 'SIN FOTOGRAFIAR' : 'NO REGISTRADA';
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
  const badgeText = { real: 'REAL', ficticio: 'FICTICIO', expedicion: 'EXPEDICIÓN' }[sp.tipo];
  albumDetail.innerHTML = `
    <div class="card-head"><span class="badge ${sp.tipo}">${badgeText}</span></div>
    <h3>${sp.nombre}</h3>
    <p class="sci">${sp.sci}</p>
    <div class="ad-portrait-slot"></div>
    ${shot && save.photos[key] ? `
      <span class="ad-photo-label">TU FOTO · EXPEDICIÓN Nº7</span>
      <img class="ad-photo" src="${save.photos[key]}" alt="Foto de ${sp.nombre}">` : ''}
    ${shot
      ? `<p class="fact">${sp.fact}</p>
         <div class="curioso"><label>PARA CURIOSOS</label><p>${sp.curioso}</p></div>`
      : `<p class="fact locked">Entrada incompleta. Fotografíala (tecla C) para que la expedición redacte su informe.</p>`}
    <div class="stats">
      <div><label>TAMAÑO</label><span>${sp.tam}</span></div>
      <div><label>PROFUNDIDAD</label><span>${sp.prof}</span></div>
      <div><label>DIETA</label><span>${sp.dieta}</span></div>
    </div>`;
  const slot = albumDetail.querySelector('.ad-portrait-slot');
  const portrait = renderPortrait(key, 348, 170, false);
  portrait.className = 'ad-portrait';
  slot.replaceWith(portrait);
  // marcar tarjeta seleccionada
  for (const el of albumGrid.children) {
    el.classList.toggle('selected', el.dataset.key === key);
  }
}

function openAlbum() {
  albumEl.hidden = false;
  refreshAlbumHud();
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
