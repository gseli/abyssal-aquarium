/* ============================================================
   ACUARIO ABISAL — mundo, partículas, bucle e interfaz
   El paisaje lo pintan agua.js y entorno.js. Cargar el último.
   ============================================================ */
'use strict';

// textos al idioma elegido antes de construir ninguna interfaz
idioma.aplicar();

const canvas = document.getElementById('sea');
const ctx = canvas.getContext('2d');
// si el equipo no llega a 60, se cede resolución antes que suavidad
const densidad = () => Math.min(window.devicePixelRatio || 1, luz.calidad === 2 ? 2 : 1.35);
let DPR = densidad();

/* bioma activo — declarado antes que resize(), que ya lo consulta */
if (!BIOMES[save.biome]) save.biome = 'arrecife';
let biomeDef = BIOMES[save.biome];

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
const VENT = { fx: 0.63, next: 0 };

world.floorY = x => world.H - 58 + Math.sin(x * 0.012) * 5 + Math.sin(x * 0.027 + 2) * 4;

const snow = [];
const motas = [];
function seedSnow() {
  snow.length = 0;
  motas.length = 0;
  const n = Math.floor((world.W * world.H) / 26000 * (biomeDef.snowMul || 1));
  for (let i = 0; i < n; i++) {
    snow.push({
      x: rand(world.W), y: rand(world.H),
      r: rand(0.6, 1.9), spd: rand(4, 12),
      drift: rand(TAU), far: Math.random() < 0.5,
    });
  }
  // unas pocas motas muy cerca del ojo, desenfocadas
  for (let i = 0; i < Math.ceil(world.W / 220); i++) {
    motas.push({ fx: i * 0.618 % 1, fy: i * 0.377 % 1, r: 7 + (i * 5) % 11 });
  }
}

function resize() {
  world.W = window.innerWidth;
  world.H = window.innerHeight;
  ajustarLienzo();
  seedSnow();
  const ax = ROCKS[0].fx * world.W;
  world.anemone = { x: ax + 46, y: world.floorY(ax + 46) - 18 };
  // geometría del naufragio: la usan también sus especies
  const hx = 0.52 * world.W;
  const fl = world.floorY(hx);
  world.wreck = {
    cx: hx,
    deckY: fl - 104,
    mast: { x: 0.37 * world.W, y: Math.max(120, fl - 268) },
    hole: { x: 0.61 * world.W, y: fl - 38 },
    chest: { x: 0.7 * world.W, y: fl - 10 },
  };
  for (const c of world.creatures) {
    c.x = clamp(c.x, 20, world.W - 20);
    if (c.y !== undefined) c.y = clamp(c.y, 40, world.floorY(c.x) - 12);
    if (c.baseY !== undefined) c.baseY = clamp(c.baseY, world.H * 0.28, world.H * 0.68);
  }
}
function ajustarLienzo() {
  DPR = densidad();
  canvas.width = world.W * DPR;
  canvas.height = world.H * DPR;
  canvas.style.width = world.W + 'px';
  canvas.style.height = world.H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  entorno.invalidar();
}
window.addEventListener('resize', resize);
resize();

/* ---------- estado ---------- */
const state = {
  abyss: save.abyss,
  camera: false,
  mode: null, // null = pantalla de inicio · 'descubrimiento' · 'acuario'
  unlockToasted: {},
  selected: null,
  leviatan: { active: false, x: 0, y: 0, dir: 1, nextAt: rand(24, 50), sway: 0 },
};
if (save.abyss) world.abyssMix = 1;
let mouseIdle = 0; // segundos sin mover el ratón (lo vigila el espectro)

/* ---------- colores de fondo (bioma actual → abisal) ---------- */
const DARK = {
  top: [4, 22, 42], mid: [2, 12, 27], bottom: [1, 4, 12],
  luz: [100, 170, 240], velo: [40, 70, 140],
};

/* ============================================================
   NIEVE MARINA — tres distancias
   ============================================================ */
function drawSnow(farLayer) {
  const c = biomeDef.clima.mota, t = world.time;
  ctx.fillStyle = luz.css(c, farLayer ? 0.2 : 0.4);
  ctx.beginPath();
  for (const s of snow) {
    if (s.far !== farLayer) continue;
    // lo lejano se mueve menos al acompañar a una criatura
    const x = farLayer ? s.x + (view.x - world.W / 2) * 0.3 : s.x;
    const r = s.r * (farLayer ? 0.7 : 1);
    ctx.moveTo(x + r, s.y);
    ctx.arc(x, s.y, r, 0, TAU);
  }
  ctx.fill();
  if (farLayer || luz.reducido) return;
  for (const m of motas) {
    const x = ((m.fx * world.W + t * m.r * 0.5) % (world.W + 80)) - 40;
    const y = ((m.fy * world.H + t * m.r * 0.25) % (world.H + 80)) - 40;
    luz.halo(ctx, x, y, m.r, c, 0.12);
  }
}

/* ============================================================
   EL JARDÍN IMPOSIBLE — flores-coral que crecen de verdad
   ============================================================ */
function seedGarden() {
  if (world.garden.length) return;
  for (const [fx, h] of [[0.16, 74], [0.47, 92], [0.8, 66]]) {
    world.garden.push({
      fx, h, bloom: 1, hue: rand(300, 350), phase: rand(TAU),
      seedAt: world.time + rand(20, 45),
    });
  }
}

function updateGarden(dt) {
  for (const fl of world.garden) {
    fl.bloom = Math.min(1, fl.bloom + dt * 0.06);
    // una flor madura suelta, de vez en cuando, un pez semilla nuevo
    if (fl.bloom >= 1 && world.time > fl.seedAt) {
      fl.seedAt = world.time + rand(50, 100);
      const sp = SPECIES.semilla;
      if (countOf('semilla') < sp.max &&
          (isSeen('semilla') || state.mode === 'descubrimiento')) {
        const p = flowerPos(fl);
        const c = spawnCreature('semilla', p.x, p.y - 6);
        c.alpha = 0;
        c.entering = true;
        c.plantAt = world.time + rand(40, 80);
        for (let i = 0; i < 6; i++) {
          world.sparks.push({
            x: p.x, y: p.y, vx: rand(-12, 12), vy: rand(-16, -4),
            life: rand(0.5, 1), age: 0, hue: fl.hue,
          });
        }
      }
    }
  }
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
  // humo mineral de las chimeneas: burbujas muy de vez en cuando
  if (biomeDef.spires) {
    for (const s of entorno.SPIRES) {
      if (Math.random() < dt * 1.2) {
        const x = s.fx * world.W;
        world.bubbles.push(makeBubble(x + rand(-5, 5), world.floorY(x) - s.h, rand(1, 2.4)));
      }
    }
  }
  // burbujas: suben hasta salir, deshaciéndose por el camino
  for (let i = world.bubbles.length - 1; i >= 0; i--) {
    const b = world.bubbles[i];
    b.age = (b.age || 0) + dt;
    b.y -= b.vy * dt;
    b.x += Math.sin(world.time * 1.8 + b.phase) * 9 * dt;
    if (b.y < -8) world.bubbles.splice(i, 1);
  }
  // respiradero (solo en el arrecife)
  if (biomeDef.vent && world.time > VENT.next) {
    world.bubbles.push(makeBubble(VENT.fx * world.W + rand(-10, 10), world.floorY(VENT.fx * world.W) - 14, rand(1.5, 4)));
    VENT.next = world.time + rand(0.7, 2.2);
  }
  // plancton bioluminiscente: motas que se encienden en la negrura
  if (biomeDef.biolum && Math.random() < dt * 9) {
    world.sparks.push({
      x: rand(world.W), y: rand(world.H * 0.88),
      vx: rand(-3, 3), vy: rand(-4, 2),
      life: rand(1.2, 2.6), age: 0, hue: rand(150, 215),
    });
  }
  // polen a la deriva: el jardín también respira
  if (biomeDef.garden && Math.random() < dt * 2.5) {
    world.sparks.push({
      x: rand(world.W), y: rand(world.H * 0.3, world.H * 0.9),
      vx: rand(-5, 5), vy: rand(-7, -2),
      life: rand(1.5, 3), age: 0, hue: rand(300, 350),
    });
  }
  // efervescencia: el mar con gas burbujea entero
  if (biomeDef.fizz && world.bubbles.length < 220) {
    if (Math.random() < dt * 26) {
      const fx = rand(world.W);
      world.bubbles.push(makeBubble(fx, world.floorY(fx) - rand(0, world.H * 0.45), rand(0.7, 2)));
    }
    for (const colFx of [0.16, 0.38, 0.62, 0.84]) {
      if (Math.random() < dt * 7) {
        const cx = colFx * world.W + rand(-9, 9);
        world.bubbles.push(makeBubble(cx, world.floorY(cx) - rand(0, 16), rand(1, 2.6)));
      }
    }
  }
  // comida — cada cebo con su física
  for (let i = world.food.length - 1; i >= 0; i--) {
    const p = world.food[i];
    p.age += dt;
    const fl = world.floorY(p.x) - 4;
    switch (p.type) {
      case 'plancton': // deriva y se dispersa
        p.x += Math.sin(world.time * 1.1 + p.phase) * 9 * dt;
        p.y += Math.sin(world.time * 0.8 + p.phase * 2) * 6 * dt + p.vy * dt * 0.4;
        break;
      case 'luz': // sube despacio y se queda flotando
        p.y += p.vy * dt;
        p.x += Math.sin(world.time * 1.4 + p.phase) * 10 * dt;
        if (p.y < 84) p.vy = 2;
        break;
      default: // pellets y carnada se hunden
        if (p.y < fl) {
          p.y += p.vy * dt;
          p.x += Math.sin(world.time * 2.2 + p.phase) * 8 * dt;
        }
        if (p.type === 'carnada' && Math.random() < dt * 6) {
          world.sparks.push({
            x: p.x + rand(-3, 3), y: p.y + rand(-2, 2),
            vx: rand(-4, 4), vy: rand(2, 10),
            life: rand(0.6, 1.2), age: 0, hue: 353,
          });
        }
    }
    if (p.eaten || p.age > (p.life || 14)) world.food.splice(i, 1);
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
  const { halo, css } = luz;
  // comida
  for (const p of world.food) {
    const life = p.life || 14;
    const a = clamp(p.age * 3, 0, 1) * (p.age > life - 2 ? Math.max(0, (life - p.age) / 2) : 1);
    switch (p.type) {
      case 'plancton':
        halo(ctx, p.x, p.y, 8, [150, 255, 190], 0.5 * a);
        ctx.fillStyle = css([205, 255, 215], 0.75 * a);
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, TAU); ctx.fill();
        break;
      case 'carnada':
        luz.nube(ctx, p.x, p.y, 14, 12, [140, 50, 70], 0.5 * a);
        ctx.fillStyle = css([150, 60, 74], 0.95 * a);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 5, 3.8, p.phase, 0, TAU); ctx.fill();
        ctx.fillStyle = css([205, 110, 112], 0.8 * a);
        ctx.beginPath(); ctx.ellipse(p.x - 1, p.y - 1.4, 2.4, 1.3, p.phase, 0, TAU); ctx.fill();
        break;
      case 'luz': {
        const k = 0.85 + 0.15 * Math.sin(world.time * 1.2 + p.phase);
        halo(ctx, p.x, p.y, 70 * k, [255, 200, 120], 0.5 * a);
        halo(ctx, p.x, p.y, 20, [255, 240, 200], 0.9 * a);
        ctx.fillStyle = css([255, 250, 236], 0.95 * a);
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill();
        break;
      }
      default: // pellet
        halo(ctx, p.x, p.y, 7, [255, 196, 120], 0.35 * a);
        ctx.fillStyle = css([238, 190, 128], 0.95 * a);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.5, 1.9, p.phase, 0, TAU); ctx.fill();
    }
  }
  // chispas: nacen y se van con fundido
  for (const s of world.sparks) {
    const k = s.age / s.life;
    const a = Math.min(1, k * 5) * (1 - k);
    if (a <= 0.01) continue;
    halo(ctx, s.x, s.y, 3 + 5 * a, colorDeTono(s.hue), a);
  }
  // burbujas
  for (const b of world.bubbles) {
    const a = Math.min(1, (b.age || 0) * 2.5) * clamp((b.y + 4) / 150, 0, 1);
    if (a < 0.02) continue;
    const r = b.r * (1 + Math.max(0, 1 - b.y / world.H) * 0.25); // crecen al subir
    const d = r * 2.5;
    ctx.globalAlpha = a;
    ctx.drawImage(spriteBurbuja(), b.x - d / 2, b.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
  for (const e of world.effects) e.draw(ctx);
}

/* tono de una chispa → color, en escalones para reutilizar halos */
const _tonos = [];
function colorDeTono(hue) {
  const i = ((Math.round((hue || 0) / 12) % 30) + 30) % 30;
  if (!_tonos[i]) {
    const f = n => {
      const k = (n + i * 12 / 30) % 12;
      return 255 * (0.78 - 0.2 * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    _tonos[i] = [f(0), f(8), f(4)];
  }
  return _tonos[i];
}

let _burbuja = null;
function spriteBurbuja() {
  if (_burbuja) return _burbuja;
  _burbuja = document.createElement('canvas');
  _burbuja.width = _burbuja.height = 40;
  const x = _burbuja.getContext('2d');
  const g = x.createRadialGradient(20, 20, 4, 20, 20, 18);
  g.addColorStop(0, 'rgba(220,250,255,0.02)');
  g.addColorStop(0.75, 'rgba(220,250,255,0.14)');
  g.addColorStop(0.92, 'rgba(230,252,255,0.75)');
  g.addColorStop(1, 'rgba(230,252,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 40, 40);
  x.fillStyle = 'rgba(255,255,255,0.9)';
  x.beginPath(); x.ellipse(13.5, 13, 4, 2.6, -0.7, 0, TAU); x.fill();
  return _burbuja;
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
      audio.event('leviatan');
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
}; // se traducen al pintarlas

function buildPanel() {
  panelBody.innerHTML = `
    <div id="speciesList"></div>
    <div class="group-title ambiente">${tr('AMBIENTE')}</div>
    <div class="switch-row">
      <span class="name">${tr('Modo abisal')}</span>
      <span class="switch">
        <input type="checkbox" id="abyssToggle">
        <span class="track"></span>
      </span>
    </div>`;
  rebuildSpeciesList();

  panelBody.addEventListener('click', e => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    adjustSpecies(btn.dataset.key, parseInt(btn.dataset.d, 10));
  });
  const abyssToggle = document.getElementById('abyssToggle');
  abyssToggle.checked = state.abyss;
  abyssToggle.addEventListener('change', e => {
    state.abyss = e.target.checked;
    save.abyss = state.abyss;
    persistSave();
  });
}

/* solo las especies registradas muestran nombre y controles */
function rebuildSpeciesList() {
  let html = '';
  for (const grupo of ['reales', 'ficticios', 'expedicion']) {
    let any = false;
    for (const [key, sp] of Object.entries(SPECIES)) {
      if (sp.grupo === grupo && sp.bioma === save.biome) { any = true; break; }
    }
    if (!any) continue;
    html += `<div class="group-title ${grupo}">${tr(GROUP_LABELS[grupo])}</div>`;
    for (const [key, sp] of Object.entries(SPECIES)) {
      if (sp.grupo !== grupo || sp.bioma !== save.biome) continue;
      if (!isSeen(key)) {
        html += `
          <div class="row unknown">
            <span class="dot"></span>
            <span class="name">???</span>
          </div>`;
        continue;
      }
      html += `
        <div class="row">
          <span class="dot" style="--c:${sp.color}"></span>
          <span class="name">${sp.nombre}</span>
          <span class="ctr">
            <button data-key="${key}" data-d="-1" aria-label="${tr('Quitar {nombre}', sp)}">−</button>
            <span class="cnt" id="cnt-${key}">0</span>
            <button data-key="${key}" data-d="1" aria-label="${tr('Añadir {nombre}', sp)}">+</button>
          </span>
        </div>`;
    }
  }
  document.getElementById('speciesList').innerHTML = html;
  updateCounts();
}

function countOf(key) {
  let n = 0;
  for (const c of world.creatures) if (c.key === key && !c.leaving) n++;
  return n;
}

/* lo que es tuyo: los invitados de un momento no se guardan */
function poblacion(key) {
  let n = 0;
  for (const c of world.creatures) if (c.key === key && !c.leaving && !c.invitado) n++;
  return n;
}

/* ============================================================
   LLEGADAS Y DESPEDIDAS — nadie aparece de la nada
   ============================================================ */
function spawnArrival(key, n = 1) {
  const sp = SPECIES[key];
  const fromLeft = Math.random() < 0.5;
  const ex = fromLeft ? -60 : world.W + 60;
  const ey = rand(world.H * 0.25, world.H * 0.65);
  for (let i = 0; i < n; i++) {
    let c;
    switch (sp.kind) {
      case 'estrella': // emerge de la arena
        c = spawnCreature(key);
        c.emerge = 0;
        break;
      case 'pulpo': // entra caminando por el fondo
        c = spawnCreature(key, fromLeft ? -40 : world.W + 40);
        c.home = rand(world.W * 0.2, world.W * 0.8);
        c.tx = c.home;
        break;
      case 'ermitano':
        c = spawnCreature(key, fromLeft ? -30 : world.W + 30);
        c.dir = fromLeft ? 1 : -1;
        break;
      case 'payaso': // se asoma desde su anémona
        c = spawnCreature(key);
        c.alpha = 0;
        c.entering = true;
        break;
      case 'buzo': // desciende desde la superficie
        c = spawnCreature(key);
        c.entering = true;
        c.baseY = -80;
        break;
      case 'medusa': // se funde en la penumbra del fondo
      case 'sifon':
        c = spawnCreature(key);
        c.fade = 0;
        break;
      case 'jardin': // brota de la arena
        c = spawnCreature(key);
        c.emerge = 0;
        break;
      case 'caballito': // se materializan con la calma que los caracteriza
      case 'copa':
      case 'vampiro':
      case 'constelacion':
      case 'dumbo':
      case 'jureles':
      case 'campana':
      case 'vigia':
      case 'moneda':
      case 'colibri':
      case 'diente':
        c = spawnCreature(key);
        c.alpha = 0;
        c.entering = true;
        break;
      case 'semilla': // brota de una flor madura, si la hay
        if (world.garden.length) {
          const p = flowerPos(pick(world.garden));
          c = spawnCreature(key, p.x, p.y - 6);
        } else {
          c = spawnCreature(key);
        }
        c.alpha = 0;
        c.entering = true;
        break;
      case 'sardina':
        c = spawnCreature(key, ex + rand(-40, 40), ey + rand(-25, 25));
        break;
      default: { // nadadores: entran por un lateral
        c = spawnCreature(key, ex, ey + (n > 1 ? rand(-30, 30) : 0));
        if (c.vel) {
          const vx = Math.abs(c.vel.x) || 1;
          c.vel.x = fromLeft ? vx : -vx;
        }
        if ('dir' in c) c.dir = fromLeft ? 1 : -1;
      }
    }
    if (key === 'morena') {
      const rock = pick(ROCKS);
      const rx = rock.fx * world.W;
      c.home = { x: rx, y: world.floorY(rx) - 50 };
    }
    if (key === 'congrio' && world.wreck) {
      c.home = { x: world.wreck.hole.x, y: world.wreck.hole.y };
    }
    if (key === 'raiz') {
      // la raíz llega arrastrándose, pegada a la arena
      c.y = world.floorY(clamp(c.x, 0, world.W)) - 26;
    }
  }
}

function dismiss(c) {
  c.leaving = true;
  c.exitX = c.x < world.W / 2 ? -170 : world.W + 170;
}

function adjustSpecies(key, dir) {
  const sp = SPECIES[key];
  const paso = sp.paso || 1;
  if (dir > 0) {
    const room = sp.max - countOf(key);
    const n = Math.min(paso, room);
    if (n > 0) spawnArrival(key, n);
  } else {
    let toRemove = Math.min(paso, poblacion(key));
    for (let i = world.creatures.length - 1; i >= 0 && toRemove > 0; i--) {
      const c = world.creatures[i];
      if (c.key === key && !c.leaving && !c.invitado) {
        if (state.selected === c) deselect();
        dismiss(c);
        toRemove--;
      }
    }
  }
  save.counts[key] = poblacion(key);
  persistSave();
  updateCounts();
}

/* ============================================================
   DESCUBRIMIENTO — avisos, registro y fotos
   ============================================================ */
const toastsEl = document.getElementById('toasts');
function toast(txt, cls = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.textContent = txt;
  toastsEl.appendChild(el);
  setTimeout(() => el.remove(), 5400);
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
}

function registerSpecies(key) {
  if (isSeen(key)) return;
  save.seen[key] = Date.now();
  save.counts[key] = poblacion(key) || SPECIES[key].inicial || 1;
  persistSave();
  toast(tr('✦ Especie registrada — {nombre}', SPECIES[key]));
  audio.event('descubrimiento');
  rebuildSpeciesList();
  refreshAlbumUI();
  const t = albumTotals();
  if (t.seen === t.total) toast(tr('✧ Bitácora completa. La expedición Nº7 hace historia.'), 'hito');
  comprobarDesbloqueo();
}

/* Toda vía de registro (observar, clic, foto) pasa por aquí */
function comprobarDesbloqueo() {
  const nk = BIOME_ORDER[BIOME_ORDER.indexOf(save.biome) + 1];
  if (nk && biomeUnlocked(nk) && !state.unlockToasted[nk]) {
    state.unlockToasted[nk] = true;
    toast(tr('✧ Nuevo ecosistema al alcance: {bioma}. Usa la flecha ▸ de arriba.', { bioma: BIOMES[nk].nombre }), 'hito');
    audio.event('descubrimiento');
  }
  refreshBiomeUI();
}

function photographSpecies(key, url) {
  const first = !hasPhoto(key);
  const wasSeen = isSeen(key);
  save.photos[key] = url;
  if (!wasSeen) {
    save.seen[key] = Date.now();
    save.counts[key] = poblacion(key) || SPECIES[key].inicial || 1;
    rebuildSpeciesList();
  }
  persistSave();
  toast(tr(first ? '◉ Entrada completa en el álbum — {nombre}' : '◉ Foto actualizada — {nombre}', SPECIES[key]), 'foto');
  refreshAlbumUI();
  if (!wasSeen) comprobarDesbloqueo();
  if (first) {
    const t = albumTotals();
    if (t.shot === t.total) toast(tr('✧ Álbum fotográfico completo. Nadie te lo pidió y aun así lo hiciste.'), 'hito');
  }
}

/* observar de cerca registra la especie (solo en modo descubrimiento) */
function updateObservation(dt) {
  if (state.mode !== 'descubrimiento') return;
  const m = world.mouse;
  if (!m.active || state.camera) return;
  for (const c of world.creatures) {
    if (isSeen(c.key)) continue;
    const a = c.head ? c.head() : c;
    if (dist(m.x, m.y, a.x, a.y) < 100) {
      c.observeT = (c.observeT || 0) + dt;
      if (c.observeT > 2.2) registerSpecies(c.key);
    } else if (c.observeT) {
      c.observeT = Math.max(0, c.observeT - dt * 0.5);
    }
  }
}

/* ============================================================
   DIRECTOR — las especies sin registrar llegan de visita
   ============================================================ */
let nextVisitor = 6; // la primera visita llega pronto

function updateDirector() {
  if (state.mode !== 'descubrimiento') return;
  if (world.time < nextVisitor) return;
  nextVisitor = world.time + rand(13, 24);
  const unseenSpeciesPresent = new Set(world.creatures.filter(c => !isSeen(c.key)).map(c => c.key)).size;
  if (unseenSpeciesPresent >= 4) return;
  const candidates = Object.keys(SPECIES).filter(k => {
    const sp = SPECIES[k];
    if (isSeen(k) || sp.bioma !== save.biome) return false;
    if (world.creatures.some(c => c.key === k)) return false; // ya hay uno nadando
    if (k === 'espectro') return mouseIdle > 14;               // solo si nadie lo busca
    if (k === 'morena') return world.food.length > 0;          // la atrae la comida
    return true;
  });
  if (!candidates.length) return;
  const key = pick(candidates);
  spawnArrival(key, SPECIES[key].kind === 'sardina' ? 12 : 1);
}

function updateCounts() {
  let total = 0;
  for (const key of Object.keys(SPECIES)) {
    const n = poblacion(key);
    total += n;
    const el = document.getElementById('cnt-' + key);
    if (el) el.textContent = n;
  }
  document.getElementById('pop').textContent = tr('POBLACIÓN: {n}', { n: total });
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
  if (state.mode === 'descubrimiento') registerSpecies(creature.key); // mirarla de cerca cuenta
  const shot = hasPhoto(creature.key);
  cardEls.badge.textContent = tr(BADGE_TEXT[sp.tipo]);
  cardEls.badge.className = 'badge ' + sp.tipo;
  cardEls.name.textContent = sp.nombre;
  cardEls.sci.textContent = sp.sci;
  cardEls.fact.textContent = shot
    ? sp.fact
    : tr('Entrada sin fotografiar. Pulsa C, enfócala y dispara: la expedición completará su informe en el álbum.');
  cardEls.fact.classList.toggle('locked', !shot);
  cardEls.tam.textContent = sp.tam;
  cardEls.prof.textContent = sp.prof;
  cardEls.dieta.textContent = sp.dieta;
  document.getElementById('cardFollow').classList.toggle('on', view.follow === creature);
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
  const aw = anchorOf(c);
  const a = toScreen(aw.x, aw.y);
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

document.getElementById('cardFollow').addEventListener('click', e => {
  e.stopPropagation();
  if (!state.selected) return;
  if (view.follow === state.selected) stopFollow();
  else startFollow(state.selected);
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
  const bait = state.bait;
  if (bait === 'plancton') {
    // nube que se dispersa: sardinas y medusas acuden
    for (let i = 0; i < 22; i++) {
      world.food.push({
        type: 'plancton',
        x: x + rand(-30, 30), y: y + rand(-22, 22),
        vy: rand(-3, 5), phase: rand(TAU), age: 0, life: 10, eaten: false,
      });
    }
    world.feedTarget = { x, y, until: world.time + 3.5 };
  } else if (bait === 'carnada') {
    // un solo trozo que sangra: despierta al cazador
    world.food.push({ type: 'carnada', x, y, vy: 11, phase: rand(TAU), age: 0, life: 26, eaten: false });
  } else if (bait === 'luz') {
    // orbe que flota: solo lo persiguen las criaturas ficticias
    world.food.push({ type: 'luz', x, y, vy: -7, phase: rand(TAU), age: 0, life: 14, eaten: false });
  } else {
    const n = Math.floor(rand(6, 9));
    for (let i = 0; i < n; i++) {
      world.food.push({
        type: 'pellet',
        x: x + rand(-16, 16), y: y + rand(-10, 10),
        vy: rand(16, 26), phase: rand(TAU), age: 0, life: 14, eaten: false,
      });
    }
    world.feedTarget = { x, y, until: world.time + 3.5 };
  }
  for (let i = 0; i < 3; i++) world.bubbles.push(makeBubble(x + rand(-8, 8), y + rand(-6, 6), rand(1.5, 3.5)));
  audio.event('burbuja');
  momentos.alAlimentar(bait, x, y);
}

canvas.addEventListener('pointerdown', e => {
  hint.classList.add('gone');
  closePanel();
  if (state.camera) { shoot(e.clientX, e.clientY); return; }
  const { x, y } = toWorld(e.clientX, e.clientY);
  const c = creatureAt(x, y);
  if (c) {
    select(c);
    if (c.key === 'electrica') dischargeEel(c);
    if (c.key === 'campana') { c.ring = 1; audio.event('campana'); }
    if (c.key === 'diente') { c.puff(); audio.event('vilano'); }
    if (momentos.alTocar(c)) deselect(); // la ficha no debe tapar lo que acaba de empezar
  } else {
    deselect();
    if (!touchEnvironment(x, y)) feed(x, y);
  }
});

canvas.addEventListener('dblclick', e => {
  if (state.camera || !state.mode) return;
  const { x, y } = toWorld(e.clientX, e.clientY);
  const c = creatureAt(x, y);
  if (c) startFollow(c);
  else stopFollow();
});

let lastPointer = null;
canvas.addEventListener('pointermove', e => {
  const w = toWorld(e.clientX, e.clientY);
  world.mouse.x = w.x;
  world.mouse.y = w.y;
  world.mouse.active = true;
  mouseIdle = 0;
  // velocidad del puntero → corriente de agua (en coordenadas de mundo)
  const now = performance.now();
  if (lastPointer) {
    const dtm = Math.max(8, now - lastPointer.t) / 1000;
    const vx = (w.x - lastPointer.x) / dtm;
    const vy = (w.y - lastPointer.y) / dtm;
    const spd = Math.hypot(vx, vy);
    if (spd > 260) {
      current.vx = lerp(current.vx, clamp(vx, -900, 900), 0.35);
      current.vy = lerp(current.vy, clamp(vy, -900, 900), 0.35);
      current.power = Math.min(1, current.power + spd / 9000);
      current.x = w.x;
      current.y = w.y;
    }
  }
  lastPointer = { x: w.x, y: w.y, t: now };
  if (state.camera) positionViewfinder(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => { world.mouse.active = false; });

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (state.camera) { setCamera(false); return; }
    if (!albumEl.hidden) { closeAlbum(); return; }
    if (view.follow) { stopFollow(); return; }
    deselect();
    closePanel();
  }
  if (!state.mode) return; // en la pantalla de inicio no hay atajos de juego
  if (e.key === 'c' || e.key === 'C') {
    hint.classList.add('gone');
    setCamera(!state.camera);
  }
  const baitKeys = { 1: 'plancton', 2: 'pellet', 3: 'carnada', 4: 'luz' };
  if (baitKeys[e.key]) setBait(baitKeys[e.key]);
});

/* ============================================================
   CEBOS Y SONIDO — controles
   ============================================================ */
const baitDock = document.getElementById('baitDock');
function setBait(b) {
  state.bait = b;
  save.bait = b;
  persistSave();
  for (const btn of baitDock.querySelectorAll('.bait')) {
    btn.classList.toggle('active', btn.dataset.bait === b);
  }
}
baitDock.addEventListener('click', e => {
  const btn = e.target.closest('.bait');
  if (btn) setBait(btn.dataset.bait);
});
setBait(save.bait || 'pellet');

const soundBtn = document.getElementById('soundBtn');
function refreshSoundBtn() {
  soundBtn.classList.toggle('off', audio.muted);
  soundBtn.innerHTML = `<i>♪</i><span>${tr(audio.muted ? 'MUDO' : 'SONIDO')}</span>`;
}
soundBtn.addEventListener('click', () => {
  audio.init();
  audio.setMuted(!audio.muted);
  save.muted = audio.muted;
  persistSave();
  refreshSoundBtn();
});
refreshSoundBtn();

// el audio solo puede arrancar tras el primer gesto (política de autoplay)
const startAudio = () => audio.init();
window.addEventListener('pointerdown', startAudio, { once: true });
window.addEventListener('keydown', startAudio, { once: true });

/* ============================================================
   VISTA — zoom y cámara que sigue a una criatura
   ============================================================ */
const view = { x: 0, y: 0, scale: 1, targetScale: 1, follow: null };
const followTag = document.getElementById('followTag');

function viewTransform() {
  const s = view.scale;
  return { s, tx: world.W / 2 - view.x * s, ty: world.H / 2 - view.y * s };
}
function toWorld(px, py) {
  const { s, tx, ty } = viewTransform();
  return { x: (px - tx) / s, y: (py - ty) / s };
}
function toScreen(wx, wy) {
  const { s, tx, ty } = viewTransform();
  return { x: wx * s + tx, y: wy * s + ty };
}

function creatureSize(c) {
  if (c.key === 'raya') return 130;
  if (c.key === 'buzo') return 95;
  if (c.len) return c.len;
  if (c.r) return c.r * 2.6;
  return 60;
}

function startFollow(c) {
  view.follow = c;
  view.targetScale = clamp(320 / creatureSize(c), 1.4, 3);
  followTag.hidden = false;
  document.getElementById('followName').textContent = c.sp.nombre;
  const btn = document.getElementById('cardFollow');
  if (btn) btn.classList.add('on');
}

function stopFollow() {
  view.follow = null;
  view.targetScale = 1;
  followTag.hidden = true;
  const btn = document.getElementById('cardFollow');
  if (btn) btn.classList.remove('on');
}

function updateView(dt) {
  if (view.follow) {
    if (view.follow.dead || !world.creatures.includes(view.follow)) {
      stopFollow();
    } else {
      const a = anchorOf(view.follow);
      view.x = lerp(view.x, a.x, Math.min(1, dt * 2.4));
      view.y = lerp(view.y, a.y, Math.min(1, dt * 2.6));
    }
  } else {
    view.x = lerp(view.x, world.W / 2, Math.min(1, dt * 2));
    view.y = lerp(view.y, world.H / 2, Math.min(1, dt * 2));
  }
  view.scale = lerp(view.scale, view.targetScale, Math.min(1, dt * 2.6));
  if (Math.abs(view.scale - 1) < 0.002 && !view.follow) view.scale = 1;
  // no asomarse fuera del mundo
  const halfW = world.W / (2 * view.scale);
  const halfH = world.H / (2 * view.scale);
  view.x = clamp(view.x, halfW, world.W - halfW);
  view.y = clamp(view.y, halfH, world.H - halfH);
}

/* ============================================================
   CORRIENTE — arrastrar el cursor mueve el agua
   ============================================================ */
const current = { x: 0, y: 0, vx: 0, vy: 0, power: 0 };
const CURRENT_KEYS = new Set(['sardina', 'payaso', 'espejo', 'faroluz']);

function applyCurrent(dt) {
  if (current.power < 0.04) return;
  const R = 140;
  for (const c of world.creatures) {
    if (!CURRENT_KEYS.has(c.key) || !c.vel) continue;
    const d = dist(c.x, c.y, current.x, current.y);
    if (d < R) {
      const k = (1 - d / R) * current.power * dt * 1.6;
      c.vel.x += current.vx * k;
      c.vel.y += current.vy * k;
    }
  }
  for (const s of snow) {
    const d = dist(s.x, s.y, current.x, current.y);
    if (d < R) {
      const k = (1 - d / R) * current.power * dt * 0.7;
      s.x += current.vx * k;
      s.y += current.vy * k;
    }
  }
  for (const b of world.bubbles) {
    const d = dist(b.x, b.y, current.x, current.y);
    if (d < R) {
      const k = (1 - d / R) * current.power * dt * 0.5;
      b.x += current.vx * k;
      b.y += current.vy * k;
    }
  }
  for (const p of world.food) {
    const d = dist(p.x, p.y, current.x, current.y);
    if (d < R) {
      const k = (1 - d / R) * current.power * dt * 0.45;
      p.x += current.vx * k;
      p.y += current.vy * k;
    }
  }
  // remolino visible
  if (current.power > 0.2 && Math.random() < current.power * 0.6) {
    world.sparks.push({
      x: current.x + rand(-16, 16), y: current.y + rand(-16, 16),
      vx: current.vx * 0.05, vy: current.vy * 0.05,
      life: rand(0.4, 0.9), age: 0, hue: 197,
    });
  }
  // el kelp cercano se agita
  for (const k of KELP.concat([KELP_FRONT])) {
    const kx = k.fx * world.W;
    if (Math.abs(current.x - kx) < 55 && current.y > world.floorY(kx) - k.h - 20) {
      k.energy = Math.min(1, (k.energy || 0) + current.power * 0.06);
    }
  }
}

/* ============================================================
   AMBIENTE — respiradero, algas y rocas responden al tacto
   ============================================================ */
let ventReady = 0;

function touchEnvironment(x, y) {
  // géiser del respiradero
  const vx = VENT.fx * world.W;
  const vyF = world.floorY(vx);
  if (biomeDef.vent && dist(x, y, vx, vyF) < 48 && world.time > ventReady) {
    ventReady = world.time + 8;
    world.effects.push({
      t: 0, x: vx,
      update(dt) {
        this.t += dt;
        if (Math.random() < 0.85) {
          world.bubbles.push(makeBubble(this.x + rand(-14, 14), world.floorY(this.x) - 10, rand(2, 6)));
        }
        return this.t < 1.6;
      },
      draw() {},
    });
    // el chorro empuja hacia arriba a quien pase por encima
    for (const c of world.creatures) {
      if (Math.abs(c.x - vx) < 70 && c.y < vyF - 10 && c.y > vyF - 280 && c.vel) {
        if (c.spine) c.vel.y -= 0.9; // velocidad unitaria en los de espina
        else c.vel.y -= 70;
      }
    }
    audio.event('geiser');
    return true;
  }
  // algas: se agitan y sueltan burbujas
  for (const k of biomeDef.kelp ? KELP.concat([KELP_FRONT]) : []) {
    const kx = k.fx * world.W;
    const top = world.floorY(kx) - k.h;
    if (Math.abs(x - kx) < 26 && y > top - 14 && y < world.floorY(kx)) {
      k.energy = 1;
      for (let i = 0; i < 3; i++) {
        world.bubbles.push(makeBubble(kx + rand(-8, 8), y - rand(0, 20), rand(1, 2.5)));
      }
      audio.event('burbuja');
      return true;
    }
  }
  // rocas: la morena que viva ahí se asoma
  for (const r of ROCKS) {
    const rx = r.fx * world.W;
    const ry = world.floorY(rx) - 8;
    if (dist(x, y, rx, ry) < 60) {
      let called = false;
      for (const c of world.creatures) {
        if (c.key === 'morena' && c.home && Math.abs(c.home.x - rx) < 130) {
          c.peekUntil = world.time + 4;
          called = true;
        }
      }
      if (called) {
        for (let i = 0; i < 2; i++) {
          world.bubbles.push(makeBubble(rx + rand(-14, 14), ry - rand(4, 14), rand(1.5, 3)));
        }
        return true;
      }
      return false; // roca sin inquilina: cae el cebo normal
    }
  }
  return false;
}

/* ============================================================
   MODO CÁMARA
   ============================================================ */
const viewfinderEl = document.getElementById('viewfinder');
const flashEl = document.getElementById('flash');
const VF_W = 300, VF_H = 200;

function positionViewfinder(mx, my) {
  const left = clamp(mx - VF_W / 2, 0, world.W - VF_W);
  const top = clamp(my - VF_H / 2, 0, world.H - VF_H);
  viewfinderEl.style.left = left + 'px';
  viewfinderEl.style.top = top + 'px';
}

function setCamera(on) {
  state.camera = on;
  document.body.classList.toggle('camera', on);
  viewfinderEl.hidden = !on;
  if (on) {
    deselect();
    closePanel();
    closeAlbum();
    // el ratón vive en el mundo y el visor en la pantalla
    const p = world.mouse.active
      ? toScreen(world.mouse.x, world.mouse.y)
      : { x: world.W / 2, y: world.H / 2 };
    positionViewfinder(p.x, p.y);
  }
}

function shoot(mx, my) {
  const rx = clamp(mx - VF_W / 2, 0, world.W - VF_W);
  const ry = clamp(my - VF_H / 2, 0, world.H - VF_H);
  // fogonazo
  flashEl.hidden = false;
  flashEl.style.animation = 'none';
  void flashEl.offsetWidth;
  flashEl.style.animation = '';
  setTimeout(() => { flashEl.hidden = true; }, 760);
  audio.event('foto');
  // el flash delata a los peces moneda: el oro no sabe ser discreto
  for (const c of world.creatures) {
    if (c.key === 'moneda') { c.shine = 1; c.hide = Math.min(c.hide, 0.3); }
  }
  // recorte de la foto (el lienzo conserva el último fotograma)
  const outW = 320, outH = Math.round(outW * VF_H / VF_W);
  const tmp = document.createElement('canvas');
  tmp.width = outW; tmp.height = outH;
  tmp.getContext('2d').drawImage(canvas, rx * DPR, ry * DPR, VF_W * DPR, VF_H * DPR, 0, 0, outW, outH);
  const url = tmp.toDataURL('image/jpeg', 0.72);
  const momento = momentos.fotografiar({ x: rx, y: ry, w: VF_W, h: VF_H }, url);
  if (momento) {
    toast(tr(momento.primera ? '❋ Momento en el álbum — {nombre}' : '❋ Momento actualizado — {nombre}', momento), 'momento');
    if (momento.primera) {
      audio.event('descubrimiento');
      const t = momentos.totales();
      if (t.hechos === t.total) toast(tr('✧ Los diez momentos. Has mirado de verdad. No se lo digas a nadie.'), 'hito');
    }
    refreshAlbumUI();
  }
  // qué especies salen en el encuadre
  const captured = new Set();
  for (const c of world.creatures) {
    const aw = c.head ? c.head() : c;
    const a = toScreen(aw.x, aw.y); // el encuadre es de pantalla; la fauna, de mundo
    if (a.x > rx + 8 && a.x < rx + VF_W - 8 && a.y > ry + 8 && a.y < ry + VF_H - 8) {
      captured.add(c.key);
    }
  }
  if (!captured.size) {
    if (momento) return;
    toast(tr('◉ Solo agua. Bonita, eso sí.'), 'foto');
    return;
  }
  for (const key of captured) photographSpecies(key, url);
}

document.getElementById('cameraBtn').addEventListener('click', () => {
  if (!state.mode) return;
  hint.classList.add('gone');
  setCamera(!state.camera);
});

/* ============================================================
   VIAJE ENTRE BIOMAS
   ============================================================ */
const biomeNameEl = document.getElementById('biomeName');
const biomePrevBtn = document.getElementById('biomePrev');
const biomeNextBtn = document.getElementById('biomeNext');
const descendEl = document.getElementById('descend');

function refreshBiomeUI() {
  biomeNameEl.textContent = biomeDef.nombre;
  const idx = BIOME_ORDER.indexOf(save.biome);
  biomePrevBtn.disabled = idx <= 0;
  const nk = BIOME_ORDER[idx + 1];
  // cerrada sigue admitiendo clic: tiene que poder decir cuánto falta
  const cerrado = !!nk && !biomeUnlocked(nk);
  biomeNextBtn.disabled = !nk;
  biomeNextBtn.classList.toggle('cerrado', cerrado);
  biomeNextBtn.title = cerrado
    ? avisoBloqueo()
    : nk ? tr('Descender a {bioma}', { bioma: BIOMES[nk].nombre }) : tr('No hay nada más abajo. Todavía.');
  biomeNextBtn.setAttribute('aria-label', biomeNextBtn.title);
}

function avisoBloqueo() {
  const van = biomeSeenCount(save.biome), piden = biomeThreshold(save.biome);
  const base = tr('Para descender: {piden} especies registradas aquí. Llevas {van}.', { piden, van });
  return state.mode === 'acuario' ? `${base} ${tr('Se registran en modo Descubrimiento.')}` : base;
}

let traveling = false;
function travel(dir) {
  if (traveling || !state.mode) return;
  const idx = BIOME_ORDER.indexOf(save.biome);
  const nk = BIOME_ORDER[idx + dir];
  if (!nk) return;
  if (!biomeUnlocked(nk)) {
    if (!toastsEl.querySelector('.bloqueo')) toast(avisoBloqueo(), 'bloqueo');
    return;
  }
  traveling = true;
  document.getElementById('descendDir').textContent = tr(dir > 0 ? 'DESCENDIENDO' : 'ASCENDIENDO');
  document.getElementById('descendName').textContent = BIOMES[nk].nombre;
  descendEl.classList.add('on');
  setCamera(false);
  stopFollow();
  deselect();
  closePanel();
  setTimeout(() => {
    // cambio de ecosistema con la pantalla a oscuras
    momentos.cancelar();
    world.creatures.length = 0;
    world.food.length = 0;
    world.sparks.length = 0;
    world.effects.length = 0;
    world.bubbles.length = 0;
    save.biome = nk;
    persistSave();
    biomeDef = BIOMES[nk];
    seedSnow(); // cada bioma tiene su densidad de nieve marina
    if (biomeDef.garden) seedGarden();
    populate();
    rebuildSpeciesList();
    refreshBiomeUI();
    nextVisitor = world.time + 5;
    momentos.llegar();
    updateCounts();
  }, 950);
  setTimeout(() => {
    descendEl.classList.remove('on');
    traveling = false;
  }, 1900);
}

biomePrevBtn.addEventListener('click', () => travel(-1));
biomeNextBtn.addEventListener('click', () => travel(1));
refreshBiomeUI();

/* ============================================================
   PANTALLA DE INICIO Y MODOS
   ============================================================ */
const startEl = document.getElementById('start');
const subtitleEl = document.querySelector('.subtitle');

function showStart() {
  momentos.cancelar();
  state.mode = null;
  setCamera(false);
  stopFollow();
  deselect();
  closePanel();
  closeAlbum();
  document.body.classList.add('start');
  startEl.classList.remove('gone');
  textosInicio();
}

function textosInicio() {
  const t = albumTotals();
  document.getElementById('mcDesc').textContent =
    t.seen ? tr('ÁLBUM {seen}/{total} · CONTINUAR', t) : tr('NUEVA EXPEDICIÓN');
  document.getElementById('mcAcua').textContent =
    t.seen ? tr('{n} ESPECIES DISPONIBLES', { n: t.seen }) : tr('AÚN SIN ESPECIES — DESCUBRE PRIMERO');
  for (const b of startEl.querySelectorAll('[data-idioma]')) {
    b.setAttribute('aria-pressed', String(b.dataset.idioma === idioma.actual));
  }
}

/* cambiar de idioma solo desde el inicio: aquí no hay ficha, álbum ni
   pista abiertos, y lo demás se repinta */
function cambiarIdioma(nuevo) {
  if (nuevo === idioma.actual) return;
  idioma.cambiar(nuevo);
  resetBtn.textContent = tr('reiniciar expedición');
  resetBtn.classList.remove('armed');
  resetArmed = 0;
  rebuildSpeciesList();
  refreshBiomeUI();
  refreshSoundBtn();
  refreshAlbumHud();
  updateDepth(1);
  textosInicio();
}

function applyMode(mode) {
  state.mode = mode;
  momentos.llegar();
  save.mode = mode;
  persistSave();
  document.body.classList.remove('start');
  startEl.classList.add('gone');
  subtitleEl.textContent = tr(mode === 'acuario'
    ? 'MODO ACUARIO · PECERA LIBRE'
    : 'MODO DESCUBRIMIENTO');
  hint.innerHTML = tr(mode === 'acuario'
    ? 'Gestiona tus especies en la bitácora&nbsp;·&nbsp;elige cebo abajo&nbsp;·&nbsp;la cámara (<b>C</b>) es para el recuerdo'
    : 'Observa para registrar&nbsp;·&nbsp;pulsa <b>C</b> para fotografiar&nbsp;·&nbsp;toca el agua para dar de comer<br>Y quédate un rato: algunas cosas solo pasan si hay alguien mirando.');
  hint.classList.remove('gone', 'show');
  void hint.offsetWidth; // reiniciar la animación de la pista
  hint.classList.add('show');
  if (mode === 'acuario') {
    // solo lo descubierto: los visitantes sin registrar se despiden
    for (const c of world.creatures) {
      if (!isSeen(c.key) && !c.leaving) dismiss(c);
    }
  } else if (!isSeen('sardina') && countOf('sardina') === 0) {
    // el banco guía vuelve nadando si hiciera falta
    spawnArrival('sardina', 25);
  }
  updateCounts();
}

startEl.addEventListener('click', e => {
  const card = e.target.closest('.mode-card');
  if (card) applyMode(card.dataset.mode);
  const lengua = e.target.closest('[data-idioma]');
  if (lengua) cambiarIdioma(lengua.dataset.idioma);
});
document.getElementById('homeBtn').addEventListener('click', showStart);

/* reiniciar expedición: doble clic de confirmación */
const resetBtn = document.getElementById('resetBtn');
let resetArmed = 0;
resetBtn.addEventListener('click', () => {
  if (resetArmed && performance.now() - resetArmed < 4000) {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* nada */ }
    momentos.borrar();
    location.reload();
    return;
  }
  resetArmed = performance.now();
  resetBtn.textContent = tr('¿seguro? se borrará todo el álbum');
  resetBtn.classList.add('armed');
  setTimeout(() => {
    resetBtn.textContent = tr('reiniciar expedición');
    resetBtn.classList.remove('armed');
    resetArmed = 0;
  }, 4000);
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
  if (biomeDef.profundidad == null) {
    // el profundímetro lo intenta, de verdad que lo intenta
    depthEl.textContent = Math.random() < 0.06 ? `−${idioma.decimal(rand(1000, 9999))} m` : '−??? m';
    return;
  }
  const base = lerp(biomeDef.profundidad, biomeDef.profundidad + 310, world.abyssMix);
  const d = base + Math.sin(world.time * 0.35) * 1.7;
  depthEl.textContent = `−${idioma.decimal(d)} m`;
}

/* ============================================================
   POBLACIÓN INICIAL
   ============================================================ */
function populate() {
  // las sardinas del arrecife son la guía del descubrimiento
  if (save.biome === 'arrecife' && !isSeen('sardina')) {
    for (let i = 0; i < 25; i++) spawnCreature('sardina');
  }
  // lo ya registrado de este bioma vuelve con la población que dejaste
  for (const [key, sp] of Object.entries(SPECIES)) {
    if (sp.bioma !== save.biome || !isSeen(key)) continue;
    const n = clamp(save.counts[key] ?? sp.inicial, 0, sp.max);
    for (let i = 0; i < n; i++) {
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
  refreshAlbumHud();
}

/* ============================================================
   BUCLE PRINCIPAL
   ============================================================ */
/* con zoom, lo que queda fuera del encuadre no se pinta */
function fueraDeVista(c) {
  if (view.scale <= 1.02) return false;
  const m = (c.len || 110) * 1.4 + 90;
  return Math.abs(c.x - view.x) > world.W / (2 * view.scale) + m
    || Math.abs(c.y - view.y) > world.H / (2 * view.scale) + m;
}

function drawCreatures() {
  for (const key of LAYER_ORDER) {
    for (const c of world.creatures) {
      if (c.key !== key) continue;
      const a = c.alpha ?? 1;
      if (a <= 0.01 || fueraDeVista(c)) continue;
      luz.hondura = clamp(c.y / world.H, 0, 1);
      if (a >= 1) {
        c.draw(ctx);
      } else {
        ctx.save();
        ctx.globalAlpha = a;
        c.draw(ctx);
        ctx.restore();
      }
    }
  }
}

let last = performance.now();
function frame(now) {
  luz.medir(Math.min(0.2, (now - last) / 1000));
  if (DPR !== densidad()) ajustarLienzo();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.time += dt;

  // transición de modo abisal
  const target = state.abyss ? 1 : 0;
  world.abyssMix += (target - world.abyssMix) * Math.min(1, dt * 1.4);

  mouseIdle += dt;
  if (audio.started) audio.update(dt, world.abyssMix);
  current.power = Math.max(0, current.power - dt * 1.5);
  for (const k of KELP) k.energy = (k.energy || 0) * Math.max(0, 1 - dt * 1.1);
  KELP_FRONT.energy = (KELP_FRONT.energy || 0) * Math.max(0, 1 - dt * 1.1);
  updateLeviatan(dt);
  updateParticles(dt);
  if (biomeDef.garden) updateGarden(dt);
  updateDirector();
  updateObservation(dt);
  applyCurrent(dt);
  for (const c of world.creatures) c.update(dt);
  momentos.actualizar(dt);
  // retirar a quienes ya salieron de escena
  for (let i = world.creatures.length - 1; i >= 0; i--) {
    if (world.creatures[i].dead) world.creatures.splice(i, 1);
  }

  updateView(dt);
  const vt = viewTransform();
  ctx.setTransform(DPR * vt.s, 0, 0, DPR * vt.s, DPR * vt.tx, DPR * vt.ty);

  // del fondo hacia el ojo
  const esc = entorno.escena();
  luz.agua = esc.mid;
  agua.pintar(ctx, esc, world.W, world.H);
  entorno.lejos(ctx);
  drawSnow(true);
  entorno.fondo(ctx);
  drawCreatures();
  momentos.pintar(ctx);
  drawParticles();
  drawSnow(false);
  entorno.frente(ctx);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  entorno.vineta(ctx);
  luz.agua = null; // lo que se pinte fuera del mundo (retratos) va sin tinte
  positionCard();
  updateDepth(dt);
  requestAnimationFrame(frame);
}

buildPanel();
if (biomeDef.garden) seedGarden();
populate();
showStart();
requestAnimationFrame(frame);
