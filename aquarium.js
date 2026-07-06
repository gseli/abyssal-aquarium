/* ============================================================
   ACUARIO ABISAL — mundo, atmósfera, bucle e interfaz
   Requiere creatures.js cargado antes.
   ============================================================ */
'use strict';

const canvas = document.getElementById('sea');
const ctx = canvas.getContext('2d');
let DPR = Math.min(window.devicePixelRatio || 1, 2);

/* ---------- escenario ---------- */
const ROCKS = [
  { fx: 0.16, parts: [[0, 0, 46, 26], [-30, 6, 26, 16], [28, 8, 30, 18]] },
  { fx: 0.63, parts: [[0, 0, 54, 30], [-38, 8, 28, 16], [34, 6, 34, 20], [4, -18, 30, 16]] },
  { fx: 0.87, parts: [[0, 2, 36, 20], [24, 8, 22, 13]] },
];
const KELP = [
  { fx: 0.07, h: 150, phase: 0.0 },
  { fx: 0.29, h: 110, phase: 1.7 },
  { fx: 0.56, h: 170, phase: 3.1 },
  { fx: 0.79, h: 120, phase: 4.4 },
  { fx: 0.94, h: 150, phase: 5.2 },
];
const KELP_FRONT = { fx: 0.38, h: 130, phase: 2.3 };
const RAYS = [
  { fx: 0.18, w: 60, phase: 0.0 },
  { fx: 0.38, w: 90, phase: 1.9 },
  { fx: 0.57, w: 55, phase: 3.4 },
  { fx: 0.76, w: 100, phase: 5.0 },
];
const VENT = { fx: 0.63, next: 0 };

world.floorY = x => world.H - 58 + Math.sin(x * 0.012) * 5 + Math.sin(x * 0.027 + 2) * 4;

const snow = [];
function seedSnow() {
  snow.length = 0;
  const n = Math.floor((world.W * world.H) / 26000);
  for (let i = 0; i < n; i++) {
    snow.push({
      x: rand(world.W), y: rand(world.H),
      r: rand(0.6, 1.9), spd: rand(4, 12),
      drift: rand(TAU), far: Math.random() < 0.5,
    });
  }
}

function resize() {
  world.W = window.innerWidth;
  world.H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = world.W * DPR;
  canvas.height = world.H * DPR;
  canvas.style.width = world.W + 'px';
  canvas.style.height = world.H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  seedSnow();
  for (const c of world.creatures) {
    c.x = clamp(c.x, 20, world.W - 20);
    if (c.y !== undefined) c.y = clamp(c.y, 40, world.floorY(c.x) - 12);
    if (c.baseY !== undefined) c.baseY = clamp(c.baseY, world.H * 0.28, world.H * 0.68);
  }
}
window.addEventListener('resize', resize);
resize();

/* ---------- estado ---------- */
const state = {
  abyss: false,
  selected: null,
  leviatan: { active: false, x: 0, y: 0, dir: 1, nextAt: rand(24, 50), sway: 0 },
};

/* ---------- colores de fondo (normal → abisal) ---------- */
const BG = {
  top:    [[13, 56, 86],  [3, 18, 30]],
  mid:    [[7, 30, 50],   [2, 11, 20]],
  bottom: [[2, 11, 22],   [0, 3, 8]],
  sand:   [[46, 70, 92],  [16, 28, 40]],
  sandLo: [[24, 42, 60],  [8, 16, 26]],
};
function mixCol(pair, t) {
  const [a, b] = pair;
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

/* ============================================================
   DIBUJO DEL ENTORNO
   ============================================================ */
function drawBackground() {
  const t = world.abyssMix;
  const g = ctx.createLinearGradient(0, 0, 0, world.H);
  g.addColorStop(0, mixCol(BG.top, t));
  g.addColorStop(0.55, mixCol(BG.mid, t));
  g.addColorStop(1, mixCol(BG.bottom, t));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, world.W, world.H);
}

function drawRays() {
  const strength = (1 - world.abyssMix) * 0.85;
  if (strength < 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const r of RAYS) {
    const x0 = r.fx * world.W;
    const sway = Math.sin(world.time * 0.12 + r.phase) * 70;
    const alpha = (0.05 + 0.035 * Math.sin(world.time * 0.3 + r.phase * 2)) * strength;
    const g = ctx.createLinearGradient(0, 0, 0, world.H * 0.8);
    g.addColorStop(0, `rgba(150, 225, 255, ${alpha})`);
    g.addColorStop(1, 'rgba(150, 225, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - r.w * 0.45, 0);
    ctx.lineTo(x0 + r.w * 0.45, 0);
    ctx.lineTo(x0 + sway + r.w * 1.3, world.H * 0.8);
    ctx.lineTo(x0 + sway - r.w * 1.3, world.H * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSnow(farLayer) {
  ctx.save();
  for (const s of snow) {
    if (s.far !== farLayer) continue;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fillStyle = s.far ? 'rgba(180, 215, 235, 0.16)' : 'rgba(200, 230, 250, 0.3)';
    ctx.fill();
  }
  ctx.restore();
}

function drawLeviatan() {
  const L = state.leviatan;
  if (!L.active) return;
  ctx.save();
  ctx.translate(L.x, L.y + Math.sin(world.time * 0.4) * 10);
  ctx.scale(L.dir, 1);
  ctx.fillStyle = `rgba(2, 8, 16, ${0.32 + world.abyssMix * 0.1})`;
  const s = 2.6;
  const sway = Math.sin(world.time * 1.4) * 12;
  ctx.beginPath();
  ctx.moveTo(120 * s, 0);
  ctx.quadraticCurveTo(50 * s, -26 * s, -40 * s, -12 * s);   // lomo
  ctx.quadraticCurveTo(-90 * s, -6 * s, -118 * s, sway - 30 * s); // lóbulo superior
  ctx.quadraticCurveTo(-100 * s, sway * 0.4, -118 * s, sway + 22 * s); // lóbulo inferior
  ctx.quadraticCurveTo(-80 * s, 8 * s, -30 * s, 12 * s);
  ctx.quadraticCurveTo(50 * s, 24 * s, 120 * s, 0);          // vientre
  ctx.closePath();
  ctx.fill();
  // aleta dorsal
  ctx.beginPath();
  ctx.moveTo(10 * s, -18 * s);
  ctx.quadraticCurveTo(-8 * s, -46 * s, -26 * s, -16 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRock(cx, baseY, parts, t) {
  for (const [ox, oy, rw, rh] of parts) {
    ctx.beginPath();
    ctx.ellipse(cx + ox, baseY + oy - rh * 0.5, rw, rh, 0, 0, TAU);
    ctx.fillStyle = mixCol([[30, 48, 66], [12, 20, 30]], t);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + ox, baseY + oy - rh * 0.5, rw, rh, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.strokeStyle = `rgba(140, 190, 220, ${0.25 * (1 - t * 0.5)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawKelpStrand(k, front) {
  const x0 = k.fx * world.W;
  const baseY = world.floorY(x0) + 4;
  const segs = 7;
  ctx.save();
  ctx.lineCap = 'round';
  for (let strand = 0; strand < 2; strand++) {
    ctx.beginPath();
    let px = x0 + strand * 6 - 3, py = baseY;
    ctx.moveTo(px, py);
    for (let i = 1; i <= segs; i++) {
      const tt = i / segs;
      const sway = Math.sin(world.time * 0.7 + k.phase + strand + i * 0.55) * 15 * tt;
      const nx = x0 + strand * 6 - 3 + sway;
      const ny = baseY - k.h * tt;
      const mx = (px + nx) / 2, my = (py + ny) / 2;
      ctx.quadraticCurveTo(px, py, mx, my);
      px = nx; py = ny;
    }
    ctx.lineWidth = front ? 5 : 6 - strand * 2;
    ctx.strokeStyle = front
      ? `rgba(6, 34, 26, ${0.85 - world.abyssMix * 0.2})`
      : `rgba(14, 77, 58, ${0.75 - world.abyssMix * 0.25})`;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSand() {
  const t = world.abyssMix;
  ctx.beginPath();
  ctx.moveTo(0, world.floorY(0));
  for (let x = 20; x <= world.W; x += 20) ctx.lineTo(x, world.floorY(x));
  ctx.lineTo(world.W, world.H);
  ctx.lineTo(0, world.H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, world.H - 90, 0, world.H);
  g.addColorStop(0, mixCol(BG.sand, t));
  g.addColorStop(1, mixCol(BG.sandLo, t));
  ctx.fillStyle = g;
  ctx.fill();
  // guijarros
  ctx.fillStyle = `rgba(150, 190, 215, ${0.18 * (1 - t * 0.5)})`;
  for (let i = 0; i < 24; i++) {
    const x = ((i * 137.5) % world.W);
    const y = world.floorY(x) + 8 + ((i * 53) % 30);
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + (i % 3), 1.6 + (i % 2), 0, 0, TAU);
    ctx.fill();
  }
  for (const r of ROCKS) drawRock(r.fx * world.W, world.floorY(r.fx * world.W) + 4, r.parts, t);
  for (const k of KELP) drawKelpStrand(k, false);
}

/* ============================================================
   PARTÍCULAS
   ============================================================ */
function updateParticles(dt) {
  // nieve marina
  for (const s of snow) {
    s.y += s.spd * dt * (s.far ? 0.5 : 1);
    s.x += Math.sin(world.time * 0.5 + s.drift) * 4 * dt;
    if (s.y > world.H + 4) { s.y = -4; s.x = rand(world.W); }
  }
  // burbujas
  for (let i = world.bubbles.length - 1; i >= 0; i--) {
    const b = world.bubbles[i];
    b.y -= b.vy * dt;
    b.x += Math.sin(world.time * 3 + b.phase) * 12 * dt;
    if (b.y < 46) world.bubbles.splice(i, 1);
  }
  // respiradero
  if (world.time > VENT.next) {
    world.bubbles.push(makeBubble(VENT.fx * world.W + rand(-10, 10), world.floorY(VENT.fx * world.W) - 14, rand(1.5, 4)));
    VENT.next = world.time + rand(0.7, 2.2);
  }
  // comida
  for (let i = world.food.length - 1; i >= 0; i--) {
    const p = world.food[i];
    p.age += dt;
    const fl = world.floorY(p.x) - 4;
    if (p.y < fl) {
      p.y += p.vy * dt;
      p.x += Math.sin(world.time * 2.2 + p.phase) * 8 * dt;
    }
    if (p.eaten || p.age > 14) world.food.splice(i, 1);
  }
  // chispas de la anguila de neón
  for (let i = world.sparks.length - 1; i >= 0; i--) {
    const s = world.sparks[i];
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 6 * dt;
    if (s.age > s.life) world.sparks.splice(i, 1);
  }
  // efectos (descargas)
  for (let i = world.effects.length - 1; i >= 0; i--) {
    if (!world.effects[i].update(dt)) world.effects.splice(i, 1);
  }
}

function drawParticles() {
  // comida
  ctx.save();
  for (const p of world.food) {
    const a = p.age > 12 ? (14 - p.age) / 2 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, TAU);
    ctx.fillStyle = `rgba(255, 180, 84, ${0.9 * a})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x - 0.8, p.y - 0.8, 0.9, 0, TAU);
    ctx.fillStyle = `rgba(255, 235, 190, ${0.9 * a})`;
    ctx.fill();
  }
  // chispas
  ctx.globalCompositeOperation = 'lighter';
  for (const s of world.sparks) {
    const a = 1 - s.age / s.life;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.6 * a + 0.4, 0, TAU);
    ctx.fillStyle = `hsla(${s.hue}, 95%, 70%, ${0.8 * a})`;
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // burbujas
  for (const b of world.bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.strokeStyle = 'rgba(210, 240, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, 0, TAU);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
  }
  ctx.restore();
  for (const e of world.effects) e.draw(ctx);
}

/* ============================================================
   LEVIATÁN — algo enorme pasa a lo lejos, muy de vez en cuando
   ============================================================ */
function updateLeviatan(dt) {
  const L = state.leviatan;
  if (!L.active) {
    if (world.time > L.nextAt) {
      L.active = true;
      L.dir = pick([-1, 1]);
      L.x = L.dir > 0 ? -420 : world.W + 420;
      L.y = rand(world.H * 0.18, world.H * 0.45);
    }
    return;
  }
  L.x += L.dir * 34 * dt;
  if ((L.dir > 0 && L.x > world.W + 420) || (L.dir < 0 && L.x < -420)) {
    L.active = false;
    L.nextAt = world.time + rand(55, 120);
  }
}

/* ============================================================
   INTERFAZ — panel bitácora
   ============================================================ */
const panel = document.getElementById('panel');
const panelBody = document.getElementById('panelBody');
const GROUP_LABELS = {
  reales: 'ESPECIES REALES',
  ficticios: 'ESPECIES FICTICIAS',
  expedicion: 'EXPEDICIÓN',
};

function buildPanel() {
  let html = '';
  for (const grupo of ['reales', 'ficticios', 'expedicion']) {
    html += `<div class="group-title ${grupo}">${GROUP_LABELS[grupo]}</div>`;
    for (const [key, sp] of Object.entries(SPECIES)) {
      if (sp.grupo !== grupo) continue;
      html += `
        <div class="row">
          <span class="dot" style="--c:${sp.color}"></span>
          <span class="name">${sp.nombre}</span>
          <span class="ctr">
            <button data-key="${key}" data-d="-1" aria-label="Quitar ${sp.nombre}">−</button>
            <span class="cnt" id="cnt-${key}">0</span>
            <button data-key="${key}" data-d="1" aria-label="Añadir ${sp.nombre}">+</button>
          </span>
        </div>`;
    }
  }
  html += `
    <div class="group-title ambiente">AMBIENTE</div>
    <div class="switch-row">
      <span class="name">Modo abisal</span>
      <span class="switch">
        <input type="checkbox" id="abyssToggle">
        <span class="track"></span>
      </span>
    </div>`;
  panelBody.innerHTML = html;

  panelBody.addEventListener('click', e => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    adjustSpecies(btn.dataset.key, parseInt(btn.dataset.d, 10));
  });
  document.getElementById('abyssToggle').addEventListener('change', e => {
    state.abyss = e.target.checked;
  });
}

function countOf(key) {
  let n = 0;
  for (const c of world.creatures) if (c.key === key) n++;
  return n;
}

function adjustSpecies(key, dir) {
  const sp = SPECIES[key];
  const paso = sp.paso || 1;
  if (dir > 0) {
    const room = sp.max - countOf(key);
    for (let i = 0; i < Math.min(paso, room); i++) spawnCreature(key);
  } else {
    let toRemove = Math.min(paso, countOf(key));
    for (let i = world.creatures.length - 1; i >= 0 && toRemove > 0; i--) {
      if (world.creatures[i].key === key) {
        if (state.selected === world.creatures[i]) deselect();
        world.creatures.splice(i, 1);
        toRemove--;
      }
    }
  }
  updateCounts();
}

function updateCounts() {
  let total = 0;
  for (const key of Object.keys(SPECIES)) {
    const n = countOf(key);
    total += n;
    const el = document.getElementById('cnt-' + key);
    if (el) el.textContent = n;
  }
  document.getElementById('pop').textContent = `POBLACIÓN: ${total}`;
}

document.getElementById('menuBtn').addEventListener('click', () => {
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
});
document.getElementById('panelClose').addEventListener('click', closePanel);
function closePanel() {
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

/* ============================================================
   INTERFAZ — ficha de criatura
   ============================================================ */
const card = document.getElementById('card');
const cardEls = {
  badge: document.getElementById('cardBadge'),
  name: document.getElementById('cardName'),
  sci: document.getElementById('cardSci'),
  fact: document.getElementById('cardFact'),
  tam: document.getElementById('statTam'),
  prof: document.getElementById('statProf'),
  dieta: document.getElementById('statDieta'),
};
const BADGE_TEXT = { real: 'REAL', ficticio: 'FICTICIO', expedicion: 'EXPEDICIÓN' };

function select(creature) {
  state.selected = creature;
  const sp = creature.sp;
  cardEls.badge.textContent = BADGE_TEXT[sp.tipo];
  cardEls.badge.className = 'badge ' + sp.tipo;
  cardEls.name.textContent = sp.nombre;
  cardEls.sci.textContent = sp.sci;
  cardEls.fact.textContent = sp.fact;
  cardEls.tam.textContent = sp.tam;
  cardEls.prof.textContent = sp.prof;
  cardEls.dieta.textContent = sp.dieta;
  card.hidden = false;
  positionCard();
}

function deselect() {
  state.selected = null;
  card.hidden = true;
}

function anchorOf(c) {
  if (c.head) { const h = c.head(); return { x: h.x, y: h.y }; }
  return { x: c.x, y: c.y };
}

function positionCard() {
  const c = state.selected;
  if (!c || card.hidden) return;
  const a = anchorOf(c);
  const cw = card.offsetWidth || 264, ch = card.offsetHeight || 200;
  let left = a.x - 38;
  let top = a.y - ch - 26;
  card.classList.remove('tail-right', 'tail-top');
  if (top < 64) {
    top = a.y + 30;
    card.classList.add('tail-top');
  }
  if (left + cw > world.W - 10) {
    left = a.x - cw + 38;
    card.classList.add('tail-right');
  }
  left = clamp(left, 8, world.W - cw - 8);
  top = clamp(top, 60, world.H - ch - 8);
  card.style.left = left + 'px';
  card.style.top = top + 'px';
}

document.getElementById('cardClose').addEventListener('click', e => {
  e.stopPropagation();
  deselect();
});

/* ============================================================
   INTERACCIÓN — puntero
   ============================================================ */
const hint = document.getElementById('hint');

function creatureAt(x, y) {
  for (let li = LAYER_ORDER.length - 1; li >= 0; li--) {
    const key = LAYER_ORDER[li];
    for (let i = world.creatures.length - 1; i >= 0; i--) {
      const c = world.creatures[i];
      if (c.key === key && c.hit(x, y)) return c;
    }
  }
  return null;
}

function feed(x, y) {
  const n = Math.floor(rand(6, 9));
  for (let i = 0; i < n; i++) {
    world.food.push({
      x: x + rand(-16, 16), y: y + rand(-10, 10),
      vy: rand(16, 26), phase: rand(TAU), age: 0, eaten: false,
    });
  }
  for (let i = 0; i < 3; i++) world.bubbles.push(makeBubble(x + rand(-8, 8), y + rand(-6, 6), rand(1.5, 3.5)));
  world.feedTarget = { x, y, until: world.time + 3.5 };
}

canvas.addEventListener('pointerdown', e => {
  const x = e.clientX, y = e.clientY;
  hint.classList.add('gone');
  closePanel();
  const c = creatureAt(x, y);
  if (c) {
    select(c);
    if (c.key === 'electrica') dischargeEel(c);
  } else {
    deselect();
    feed(x, y);
  }
});

canvas.addEventListener('pointermove', e => {
  world.mouse.x = e.clientX;
  world.mouse.y = e.clientY;
  world.mouse.active = true;
});
canvas.addEventListener('pointerleave', () => { world.mouse.active = false; });

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { deselect(); closePanel(); }
});

/* ============================================================
   HUD — profundímetro
   ============================================================ */
const depthEl = document.getElementById('depth');
let depthTimer = 0;
function updateDepth(dt) {
  depthTimer -= dt;
  if (depthTimer > 0) return;
  depthTimer = 0.4;
  const base = lerp(38, 347, world.abyssMix);
  const d = base + Math.sin(world.time * 0.35) * 1.7;
  depthEl.textContent = `−${d.toFixed(1).replace('.', ',')} m`;
}

/* ============================================================
   POBLACIÓN INICIAL
   ============================================================ */
function populate() {
  for (const [key, sp] of Object.entries(SPECIES)) {
    for (let i = 0; i < sp.inicial; i++) {
      const c = spawnCreature(key);
      // las morenas viven junto a las rocas
      if (key === 'morena') {
        const rock = ROCKS[i % ROCKS.length];
        const rx = rock.fx * world.W;
        c.home = { x: rx, y: world.floorY(rx) - 50 };
        c.x = rx + rand(-30, 30);
        c.y = world.floorY(rx) - rand(40, 70);
      }
    }
  }
  updateCounts();
}

/* ============================================================
   BUCLE PRINCIPAL
   ============================================================ */
function drawCreatures() {
  for (const key of LAYER_ORDER) {
    for (const c of world.creatures) {
      if (c.key === key) c.draw(ctx);
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.time += dt;

  // transición de modo abisal
  const target = state.abyss ? 1 : 0;
  world.abyssMix += (target - world.abyssMix) * Math.min(1, dt * 1.4);

  updateLeviatan(dt);
  updateParticles(dt);
  for (const c of world.creatures) c.update(dt);

  drawBackground();
  drawSnow(true);
  drawLeviatan();
  drawRays();
  drawSand();
  drawSnow(false);
  drawCreatures();
  drawParticles();
  drawKelpStrand(KELP_FRONT, true);

  positionCard();
  updateDepth(dt);
  requestAnimationFrame(frame);
}

buildPanel();
populate();
requestAnimationFrame(frame);
