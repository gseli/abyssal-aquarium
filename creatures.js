/* ============================================================
   ACUARIO ABISAL — criaturas
   Utilidades, registro de especies y clases con dibujo
   procedural sobre canvas 2D. Cargar antes de aquarium.js.
   ============================================================ */
'use strict';

/* ---------- utilidades ---------- */
const TAU = Math.PI * 2;
const rand  = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const dist  = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];

function norm(x, y) {
  const m = Math.hypot(x, y);
  return m > 1e-6 ? { x: x / m, y: y / m } : { x: 1, y: 0 };
}

/* Mundo compartido — aquarium.js rellena estos valores cada frame. */
const world = {
  W: 800, H: 600, time: 0, abyssMix: 0,
  mouse: { x: -999, y: -999, active: false },
  feedTarget: null,          // {x, y, until}
  floorY: x => world.H - 60, // redefinida en aquarium.js
  creatures: [],
  food: [],
  sparks: [],
  effects: [],
  bubbles: [],
  garden: [], // flores-coral del Jardín Imposible: {fx, h, bloom, hue, phase, seedAt}
};

/* ---------- fuerzas comunes ---------- */
function wallForce(x, y, f, marginX = 90, marginTop = 90, floorK = 0.5) {
  const k = 5;
  if (x < marginX) f.x += (marginX - x) * k * 0.06;
  if (x > world.W - marginX) f.x -= (x - (world.W - marginX)) * k * 0.06;
  if (y < marginTop) f.y += (marginTop - y) * k * 0.06;
  const fl = world.floorY(x) - 34;
  if (y > fl) f.y -= (y - fl) * floorK;
}

/* ---------- color ---------- */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a, b, t) {
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

/* ============================================================
   PEZ DE ESPINA — tiburones y anguilas
   Cadena de segmentos que sigue a la cabeza; el meneo del rumbo
   propaga una onda natural por todo el cuerpo.
   ============================================================ */
class SpineFish {
  constructor(key, sp, x, y) {
    this.key = key;
    this.sp = sp;
    this.len = rand(sp.len[0], sp.len[1]);
    this.maxW = this.len * sp.girth;
    this.segs = sp.segs;
    this.segLen = this.len / this.segs;
    this.x = x; this.y = y;
    const a = rand(TAU);
    this.vel = { x: Math.cos(a), y: Math.sin(a) * 0.2 };
    this.speed = rand(sp.speed[0], sp.speed[1]);
    this.phase = rand(TAU);
    this.seed = rand(100);
    this.huntUntil = 0; this.nextHunt = world.time + rand(14, 30);
    this.lastZap = -99;
    this.home = { x, y };
    this.spine = [];
    for (let i = 0; i < this.segs; i++) {
      this.spine.push({ x: x - this.vel.x * this.segLen * i, y: y - this.vel.y * this.segLen * i });
    }
    // perfil de anchos precalculado
    this.widths = [];
    for (let i = 0; i < this.segs; i++) this.widths.push(this.maxW * sp.profile(i / (this.segs - 1)));
  }

  head() { return this.spine[0]; }

  update(dt) {
    const sp = this.sp;
    const f = { x: 0, y: 0 };
    const t = world.time;

    // deambular: ruido suave de senos sobre la perpendicular
    const n = norm(-this.vel.y, this.vel.x);
    const wob = Math.sin(t * 0.33 + this.seed) + 0.6 * Math.sin(t * 0.71 + this.seed * 2.3);
    f.x += n.x * wob * 0.8;
    f.y += n.y * wob * 0.8;

    // amortiguar la vertical: nadan casi en horizontal
    // (vel es unitaria, así que se escala para competir con el deambular)
    f.y += -this.vel.y * sp.flatten * 30;

    if (this.leaving) {
      // rumbo firme hacia el borde por el que se marcha
      f.x += this.exitX > this.x ? 3.5 : -3.5;
    } else {
      wallForce(this.x, this.y, f, 100, sp.topMargin || 90, sp.floorK ?? 0.5);
      sp.behavior && sp.behavior(this, f, dt);

      // interés por la comida (los tiburones curiosean)
      const ft = world.feedTarget;
      if (ft && t < ft.until && sp.curious) {
        const d = norm(ft.x - this.x, ft.y - this.y);
        f.x += d.x * 0.9; f.y += d.y * 0.9;
      }

      // las criaturas de luz persiguen la luz embotellada
      if (sp.luz) {
        let orb = null, od = 400;
        for (const p of world.food) {
          if (p.type !== 'luz') continue;
          const d = dist(this.x, this.y, p.x, p.y);
          if (d < od) { od = d; orb = p; }
        }
        if (orb) {
          const dl = norm(orb.x - this.x, orb.y - this.y);
          f.x += dl.x * 2.4; f.y += dl.y * 2.4;
          if (od < 18) {
            orb.eaten = true; // se bebe la luz
            for (let i = 0; i < 16; i++) {
              world.sparks.push({
                x: orb.x, y: orb.y,
                vx: rand(-26, 26), vy: rand(-26, 26),
                life: rand(0.5, 1.2), age: 0, hue: rand(160, 320),
              });
            }
          }
        }
      }
    }

    let speed = this.speed * (this.speedMul ?? 1);
    if (t < this.huntUntil) speed *= 1.75;

    // dirección nueva = velocidad + fuerzas, con giro limitado
    // para que el cuerpo no se pliegue en horquillas
    const des = norm(this.vel.x + f.x * dt * 2.4, this.vel.y + f.y * dt * 2.4);
    const curA = Math.atan2(this.vel.y, this.vel.x);
    let dA = Math.atan2(des.y, des.x) - curA;
    while (dA > Math.PI) dA -= TAU;
    while (dA < -Math.PI) dA += TAU;
    const maxTurn = (sp.maxTurn || 1.6) * dt;
    const newA = curA + clamp(dA, -maxTurn, maxTurn);
    const v = { x: Math.cos(newA), y: Math.sin(newA) };
    this.vel = v;
    this.phase += sp.wiggleSpeed * dt * (0.6 + speed / sp.speed[1]);
    const wig = Math.sin(this.phase) * sp.wiggle * (this.wiggleMul ?? 1);
    const ang = Math.atan2(v.y, v.x) + wig;
    this.x += Math.cos(ang) * speed * dt;
    this.y += Math.sin(ang) * speed * dt;
    this.y = clamp(this.y, 40, world.floorY(this.x) - 10);
    if (this.leaving && (this.x < -140 || this.x > world.W + 140)) this.dead = true;

    // la espina sigue a la cabeza
    let px = this.x, py = this.y;
    for (const p of this.spine) {
      const d = norm(p.x - px, p.y - py);
      p.x = px + d.x * this.segLen;
      p.y = py + d.y * this.segLen;
      px = p.x; py = p.y;
    }
  }

  /* geometría: tangentes, normales y bordes */
  geom() {
    const P = this.spine, n = P.length;
    const T = [], N = [], L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      const t = norm(a.x - b.x, a.y - b.y); // apunta hacia la cabeza
      T.push(t);
      const nn = { x: -t.y, y: t.x };
      N.push(nn);
      const w = this.widths[i];
      L.push({ x: P[i].x + nn.x * w, y: P[i].y + nn.y * w });
      R.push({ x: P[i].x - nn.x * w, y: P[i].y - nn.y * w });
    }
    return { P, T, N, L, R };
  }

  bodyPath(ctx, g) {
    const { P, T, L, R } = g, n = P.length;
    ctx.beginPath();
    ctx.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < n - 1; i++) {
      const mx = (L[i].x + L[i + 1].x) / 2, my = (L[i].y + L[i + 1].y) / 2;
      ctx.quadraticCurveTo(L[i].x, L[i].y, mx, my);
    }
    ctx.lineTo(P[n - 1].x, P[n - 1].y);
    for (let i = n - 2; i > 0; i--) {
      const mx = (R[i].x + R[i - 1].x) / 2, my = (R[i].y + R[i - 1].y) / 2;
      ctx.quadraticCurveTo(R[i].x, R[i].y, mx, my);
    }
    // redondear el morro
    const snout = { x: P[0].x + T[0].x * this.widths[0] * 1.8, y: P[0].y + T[0].y * this.widths[0] * 1.8 };
    ctx.quadraticCurveTo(snout.x, snout.y, L[0].x, L[0].y);
    ctx.closePath();
  }

  bodyGradient(ctx, top, belly) {
    const h = this.head();
    const gr = ctx.createLinearGradient(h.x, h.y - this.maxW * 2.2, h.x, h.y + this.maxW * 2.2);
    gr.addColorStop(0, top);
    gr.addColorStop(1, belly);
    return gr;
  }

  /* normal que apunta "hacia arriba" en pantalla */
  up(g, i) {
    const nn = g.N[i];
    return nn.y < 0 ? nn : { x: -nn.x, y: -nn.y };
  }

  draw(ctx) { this.sp.draw(this, ctx, this.geom()); }

  hit(mx, my) {
    for (let i = 0; i < this.spine.length; i++) {
      if (dist(mx, my, this.spine[i].x, this.spine[i].y) < this.widths[i] + 9) return true;
    }
    return false;
  }
}

/* ---------- piezas de dibujo compartidas ---------- */
function drawFin(ctx, base1, apex, base2, color) {
  ctx.beginPath();
  ctx.moveTo(base1.x, base1.y);
  ctx.quadraticCurveTo(apex.x, apex.y, apex.x, apex.y);
  ctx.lineTo(apex.x, apex.y);
  ctx.quadraticCurveTo((apex.x + base2.x) / 2, (apex.y + base2.y) / 2, base2.x, base2.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function sharkFins(fish, ctx, g, color) {
  const { P, T } = g;
  const w = fish.maxW;
  // aleta dorsal
  const di = 4;
  const U = fish.up(g, di);
  const back = { x: -T[di].x, y: -T[di].y };
  drawFin(ctx,
    { x: P[di - 1].x + U.x * fish.widths[di - 1] * 0.8, y: P[di - 1].y + U.y * fish.widths[di - 1] * 0.8 },
    { x: P[di].x + U.x * w * 2.1 + back.x * w * 0.9, y: P[di].y + U.y * w * 2.1 + back.y * w * 0.9 },
    { x: P[di + 2].x + U.x * fish.widths[di + 2] * 0.6, y: P[di + 2].y + U.y * fish.widths[di + 2] * 0.6 },
    color);
  // aleta pectoral
  const pi = 3;
  const D = { x: -fish.up(g, pi).x, y: -fish.up(g, pi).y };
  const backP = { x: -T[pi].x, y: -T[pi].y };
  const flap = Math.sin(fish.phase * 0.7) * 0.15 + 1;
  drawFin(ctx,
    { x: P[pi].x + D.x * fish.widths[pi] * 0.5, y: P[pi].y + D.y * fish.widths[pi] * 0.5 },
    { x: P[pi].x + D.x * w * 1.7 * flap + backP.x * w * 1.3, y: P[pi].y + D.y * w * 1.7 * flap + backP.y * w * 1.3 },
    { x: P[pi + 2].x + D.x * fish.widths[pi + 2] * 0.4, y: P[pi + 2].y + D.y * fish.widths[pi + 2] * 0.4 },
    color);
  // cola heterocerca (lóbulo superior mayor)
  const nn = P.length - 1;
  const tip = P[nn];
  const td = { x: -T[nn].x, y: -T[nn].y }; // hacia atrás
  const tailLen = w * 2.7;
  const rot = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
  let lobeA = rot(td, -0.55), lobeB = rot(td, 0.5);
  if (lobeA.y > lobeB.y) { const tmp = lobeA; lobeA = lobeB; lobeB = tmp; }
  const baseT = P[nn - 1];
  ctx.beginPath();
  ctx.moveTo(baseT.x, baseT.y);
  ctx.quadraticCurveTo(tip.x + lobeA.x * tailLen * 0.5, tip.y + lobeA.y * tailLen * 0.5,
                       tip.x + lobeA.x * tailLen, tip.y + lobeA.y * tailLen);
  ctx.quadraticCurveTo(tip.x + td.x * tailLen * 0.28, tip.y + td.y * tailLen * 0.28, tip.x, tip.y);
  ctx.quadraticCurveTo(tip.x + lobeB.x * tailLen * 0.4, tip.y + lobeB.y * tailLen * 0.4,
                       tip.x + lobeB.x * tailLen * 0.62, tip.y + lobeB.y * tailLen * 0.62);
  ctx.quadraticCurveTo(tip.x + lobeB.x * tailLen * 0.3, tip.y + lobeB.y * tailLen * 0.3, baseT.x, baseT.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function sharkFace(fish, ctx, g, opts = {}) {
  const { P, T } = g;
  const U = fish.up(g, 1);
  // ojo
  const eye = { x: P[1].x + U.x * fish.widths[1] * 0.32, y: P[1].y + U.y * fish.widths[1] * 0.32 };
  ctx.beginPath(); ctx.arc(eye.x, eye.y, fish.maxW * 0.16, 0, TAU);
  ctx.fillStyle = opts.eye || '#0b1520'; ctx.fill();
  ctx.beginPath(); ctx.arc(eye.x - 0.8, eye.y - 0.8, fish.maxW * 0.05, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  // branquias
  ctx.strokeStyle = opts.gill || 'rgba(10, 25, 40, 0.45)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    const gi = 2;
    const gx = P[gi].x - T[gi].x * k * 4, gy = P[gi].y - T[gi].y * k * 4;
    const un = fish.up(g, gi);
    ctx.beginPath();
    ctx.moveTo(gx + un.x * fish.widths[gi] * 0.5, gy + un.y * fish.widths[gi] * 0.5);
    ctx.lineTo(gx - un.x * fish.widths[gi] * 0.35, gy - un.y * fish.widths[gi] * 0.35);
    ctx.stroke();
  }
  // boca con dientes (como en el boceto)
  const D = { x: -U.x, y: -U.y };
  const m0 = { x: P[0].x + T[0].x * fish.widths[0] * 1.2 + D.x * fish.widths[0] * 0.55,
               y: P[0].y + T[0].y * fish.widths[0] * 1.2 + D.y * fish.widths[0] * 0.55 };
  const m1 = { x: P[1].x + D.x * fish.widths[1] * 0.8, y: P[1].y + D.y * fish.widths[1] * 0.8 };
  ctx.strokeStyle = opts.mouth || 'rgba(8, 18, 30, 0.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(m0.x, m0.y);
  ctx.quadraticCurveTo((m0.x + m1.x) / 2, (m0.y + m1.y) / 2 + 2, m1.x, m1.y);
  ctx.stroke();
  if (opts.teeth) {
    ctx.fillStyle = '#f4fbff';
    const steps = 4;
    for (let k = 0; k <= steps; k++) {
      const tt = k / steps;
      const tx = lerp(m0.x, m1.x, tt), ty = lerp(m0.y, m1.y, tt) + 1;
      ctx.beginPath();
      ctx.moveTo(tx - 1.6, ty); ctx.lineTo(tx + 1.6, ty); ctx.lineTo(tx, ty + 3.4);
      ctx.closePath(); ctx.fill();
    }
  }
}

/* ---------- comportamientos ---------- */
function huntBehavior(fish, f, dt) {
  const t = world.time;
  // la carnada despierta al cazador de verdad
  let bait = null, bd = 460;
  const h = fish.head();
  for (const p of world.food) {
    if (p.type !== 'carnada') continue;
    const d = dist(h.x, h.y, p.x, p.y);
    if (d < bd) { bd = d; bait = p; }
  }
  if (bait) {
    fish.huntUntil = Math.max(fish.huntUntil, t + 0.4);
    const dir = norm(bait.x - fish.x, bait.y - fish.y);
    f.x += dir.x * 3.5; f.y += dir.y * 3.5;
    if (bd < fish.maxW * 1.7) {
      bait.eaten = true;
      for (let i = 0; i < 12; i++) {
        world.sparks.push({
          x: bait.x, y: bait.y,
          vx: rand(-32, 32), vy: rand(-30, 12),
          life: rand(0.4, 0.9), age: 0, hue: 353,
        });
      }
      if (typeof audio !== 'undefined') audio.event('bite');
    }
    return;
  }
  if (t > fish.nextHunt) {
    const prey = world.creatures.filter(c => c.key === 'sardina');
    if (prey.length) {
      fish.prey = pick(prey);
      fish.huntUntil = t + 4.5;
    }
    fish.nextHunt = t + rand(18, 36);
  }
  if (t < fish.huntUntil && fish.prey && fish.prey.alive !== false) {
    const d = norm(fish.prey.x - fish.x, fish.prey.y - fish.y);
    f.x += d.x * 2.2; f.y += d.y * 2.2;
  }
}

function lurkBehavior(fish, f) {
  const peeking = world.time < (fish.peekUntil || 0);
  const dx = fish.home.x - fish.x, dy = fish.home.y - fish.y;
  const d = Math.hypot(dx, dy);
  if (d > 150 || (peeking && d > 30)) {
    const k = peeking ? 4.5 : 2;
    f.x += (dx / (d || 1)) * k;
    f.y += (dy / (d || 1)) * k;
  }
  fish.speedMul = peeking ? 1.7 : 1;
  // quedarse cerca del fondo
  const fl = world.floorY(fish.x) - 46;
  f.y += clamp((fl - fish.y) * 0.02, -1.1, 1.1);
}

function bottomBehavior(fish, f) {
  const target = world.floorY(fish.x) - 90;
  f.y += clamp((target - fish.y) * 0.012, -1.1, 1.1);
  // autodefensa: descarga si un tiburón se acerca
  if (world.time - fish.lastZap > 9) {
    for (const c of world.creatures) {
      if ((c.key === 'blanco' || c.key === 'martillo') && dist(c.x, c.y, fish.x, fish.y) < 85) {
        dischargeEel(fish);
        break;
      }
    }
  }
}

function dischargeEel(fish) {
  if (world.time - fish.lastZap < 4) return;
  fish.lastZap = world.time;
  const h = fish.head();
  world.effects.push(makeZap(h.x, h.y));
  if (typeof audio !== 'undefined') audio.event('zap');
  for (const c of world.creatures) {
    if (c.key === 'sardina' && dist(c.x, c.y, h.x, h.y) < 260) {
      const d = norm(c.x - h.x, c.y - h.y);
      c.vel.x = d.x * 240; c.vel.y = d.y * 240;
    }
  }
}

function makeZap(x, y) {
  const bolts = [];
  for (let b = 0; b < 8; b++) {
    const a = rand(TAU), len = rand(55, 135);
    const pts = [{ x: 0, y: 0 }];
    const steps = Math.floor(len / 12);
    for (let s = 1; s <= steps; s++) {
      const along = (s / steps) * len;
      pts.push({
        x: Math.cos(a) * along + Math.cos(a + Math.PI / 2) * rand(-9, 9),
        y: Math.sin(a) * along + Math.sin(a + Math.PI / 2) * rand(-9, 9),
      });
    }
    bolts.push(pts);
  }
  return {
    x, y, t: 0, dur: 0.45, bolts,
    update(dt) { this.t += dt; return this.t < this.dur; },
    draw(ctx) {
      const k = 1 - this.t / this.dur;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalCompositeOperation = 'lighter';
      // anillo expansivo
      ctx.beginPath();
      ctx.arc(0, 0, (this.t / this.dur) * 170, 0, TAU);
      ctx.strokeStyle = `rgba(150, 230, 255, ${0.4 * k})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (const pts of this.bolts) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(190, 240, 255, ${0.35 * k})`;
        ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * k})`;
        ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.restore();
    },
  };
}

/* ---------- perfiles de anchura ---------- */
function sharkProfile(t) {
  if (t < 0.16) return lerp(0.34, 1, t / 0.16);
  if (t < 0.34) return 1;
  return Math.max(0.06, 1 - Math.pow((t - 0.34) / 0.66, 1.12) * 0.95);
}
function eelProfile(t) {
  if (t < 0.07) return lerp(0.55, 1, t / 0.07);
  if (t < 0.55) return 1 - (t - 0.07) * 0.2;
  return Math.max(0.05, 0.9 - Math.pow((t - 0.55) / 0.45, 1.05) * 0.86);
}

/* ============================================================
   dibujos por especie (tiburones)
   ============================================================ */
function drawBlanco(fish, ctx, g) {
  const body = fish.bodyGradient(ctx, '#4a6b85', '#c9dbe6');
  const finC = '#41607a';
  sharkFins(fish, ctx, g, finC);
  fish.bodyPath(ctx, g);
  ctx.fillStyle = body; ctx.fill();
  ctx.strokeStyle = 'rgba(180, 220, 240, 0.25)'; ctx.lineWidth = 1; ctx.stroke();
  sharkFace(fish, ctx, g, { teeth: true });
}

function drawMartillo(fish, ctx, g) {
  const body = fish.bodyGradient(ctx, '#587a6e', '#cfe3d8');
  const finC = '#4a6a60';
  sharkFins(fish, ctx, g, finC);
  fish.bodyPath(ctx, g);
  ctx.fillStyle = body; ctx.fill();
  // cabeza en T (estilizada, como el boceto)
  const { P, T, N } = g;
  const w0 = fish.widths[0];
  const cx = P[0].x + T[0].x * w0 * 1.1, cy = P[0].y + T[0].y * w0 * 1.1;
  const hw = fish.maxW * 1.55, hh = w0 * 0.7;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(N[0].y, N[0].x));
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, hw * 2, hh * 2, hh);
  ctx.fillStyle = '#587a6e'; ctx.fill();
  // ojos en los extremos del martillo
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(s * (hw - hh * 0.8), 0, hh * 0.42, 0, TAU);
    ctx.fillStyle = '#0b1520'; ctx.fill();
    ctx.beginPath(); ctx.arc(s * (hw - hh * 0.8) - 0.7, -0.7, hh * 0.15, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  }
  ctx.restore();
  sharkFace(fish, ctx, g, { teeth: false, eye: 'rgba(0,0,0,0)' });
}

function drawEspectro(fish, ctx, g) {
  const pulse = 0.16 + 0.3 * (0.5 + 0.5 * Math.sin(world.time * 0.24 + fish.seed)) + world.abyssMix * 0.22;
  const h = fish.head();
  ctx.save();
  ctx.globalAlpha = clamp(pulse, 0.08, 0.75);
  // halo
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, fish.len * 0.7);
  halo.addColorStop(0, 'rgba(140, 235, 255, 0.16)');
  halo.addColorStop(1, 'rgba(140, 235, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(h.x - fish.len, h.y - fish.len, fish.len * 2, fish.len * 2);
  ctx.globalCompositeOperation = 'source-over';
  const body = fish.bodyGradient(ctx, 'rgba(150, 220, 245, 0.55)', 'rgba(235, 252, 255, 0.75)');
  sharkFins(fish, ctx, g, 'rgba(160, 225, 250, 0.5)');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = body; ctx.fill();
  ctx.strokeStyle = 'rgba(200, 245, 255, 0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
  sharkFace(fish, ctx, g, { teeth: true, eye: '#0a3a4a', mouth: 'rgba(120, 200, 230, 0.8)' });
  ctx.restore();
}

/* ============================================================
   dibujos por especie (anguilas)
   ============================================================ */
function eelDorsalRibbon(fish, ctx, g, color) {
  const { P } = g, n = P.length;
  ctx.beginPath();
  for (let i = 1; i < n - 1; i++) {
    const U = fish.up(g, i);
    const ext = fish.widths[i] * (1 + 0.9 * Math.sin(world.time * 6 + i * 0.7 + fish.seed));
    const px = P[i].x + U.x * ext, py = P[i].y + U.y * ext;
    if (i === 1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  for (let i = n - 2; i >= 1; i--) {
    const U = fish.up(g, i);
    ctx.lineTo(P[i].x + U.x * fish.widths[i] * 0.4, P[i].y + U.y * fish.widths[i] * 0.4);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function eelFace(fish, ctx, g, eyeColor) {
  const { P, T } = g;
  const U = fish.up(g, 1);
  const eye = { x: P[1].x + U.x * fish.widths[1] * 0.3, y: P[1].y + U.y * fish.widths[1] * 0.3 };
  ctx.beginPath(); ctx.arc(eye.x, eye.y, 2.2, 0, TAU);
  ctx.fillStyle = eyeColor; ctx.fill();
  ctx.beginPath(); ctx.arc(eye.x, eye.y, 1, 0, TAU);
  ctx.fillStyle = '#0a1018'; ctx.fill();
  // boca que se abre y cierra (respiración de morena)
  const jaw = Math.max(0, Math.sin(world.time * 1.1 + fish.seed)) * 0.45;
  const D = { x: -U.x, y: -U.y };
  const tip = { x: P[0].x + T[0].x * fish.widths[0] * 1.6, y: P[0].y + T[0].y * fish.widths[0] * 1.6 };
  ctx.strokeStyle = 'rgba(10, 20, 25, 0.75)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - T[0].x * 8 + D.x * jaw * 7, tip.y - T[0].y * 8 + D.y * jaw * 7);
  ctx.stroke();
}

function drawMorena(fish, ctx, g) {
  eelDorsalRibbon(fish, ctx, g, 'rgba(78, 110, 60, 0.55)');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#5d7a3f', '#a8b86a');
  ctx.fill();
  // moteado
  ctx.fillStyle = 'rgba(46, 62, 30, 0.5)';
  for (let i = 2; i < g.P.length - 2; i += 2) {
    const off = Math.sin(i * 2.7 + fish.seed) * fish.widths[i] * 0.35;
    ctx.beginPath();
    ctx.arc(g.P[i].x + g.N[i].x * off, g.P[i].y + g.N[i].y * off, fish.widths[i] * 0.32, 0, TAU);
    ctx.fill();
  }
  eelFace(fish, ctx, g, '#ffd94a');
}

function drawElectrica(fish, ctx, g) {
  eelDorsalRibbon(fish, ctx, g, 'rgba(160, 140, 60, 0.4)');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#5c6136', '#d8b45a');
  ctx.fill();
  // chispas residuales si acaba de descargar
  const since = world.time - fish.lastZap;
  if (since < 1.2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(190, 240, 255, ${0.6 * (1 - since / 1.2)})`;
    ctx.lineWidth = 1;
    for (let i = 2; i < g.P.length - 2; i += 3) {
      ctx.beginPath();
      ctx.moveTo(g.P[i].x, g.P[i].y);
      ctx.lineTo(g.P[i].x + rand(-8, 8), g.P[i].y + rand(-8, 8));
      ctx.stroke();
    }
    ctx.restore();
  }
  eelFace(fish, ctx, g, '#ffe9a0');
}

function drawNeon(fish, ctx, g) {
  const { P } = g, n = P.length;
  const h = fish.head();
  ctx.save();
  // halo
  ctx.globalCompositeOperation = 'lighter';
  const glow = 0.25 + world.abyssMix * 0.5;
  const halo = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, fish.len * 0.55);
  halo.addColorStop(0, `rgba(97, 228, 255, ${glow * 0.35})`);
  halo.addColorStop(1, 'rgba(97, 228, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(h.x - fish.len, h.y - fish.len, fish.len * 2, fish.len * 2);
  // cuerpo: trazo con degradado iridiscente a lo largo de la espina
  const tail = P[n - 1];
  const gr = ctx.createLinearGradient(h.x, h.y, tail.x, tail.y);
  const hue0 = (world.time * 40 + fish.seed * 60) % 360;
  for (let s = 0; s <= 4; s++) {
    gr.addColorStop(s / 4, `hsla(${(hue0 + s * 46) % 360}, 95%, 65%, 0.95)`);
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // estela ancha tenue
  ctx.strokeStyle = gr; ctx.globalAlpha = 0.22 + world.abyssMix * 0.2;
  ctx.lineWidth = fish.maxW * 3.4;
  ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(P[i].x, P[i].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // núcleo del cuerpo
  fish.bodyPath(ctx, g);
  ctx.fillStyle = '#0d1b2e'; ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = gr;
  ctx.lineWidth = fish.maxW * 1.15;
  ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(P[i].x, P[i].y);
  ctx.stroke();
  ctx.restore();
  // ojo brillante
  ctx.beginPath(); ctx.arc(P[1].x, P[1].y - 2, 2, 0, TAU);
  ctx.fillStyle = '#fff'; ctx.fill();
  // chispas de la cola
  if (Math.random() < 0.35) {
    world.sparks.push({
      x: tail.x, y: tail.y,
      vx: rand(-8, 8), vy: rand(-14, 2),
      life: rand(0.6, 1.3), age: 0,
      hue: (hue0 + 180) % 360,
    });
  }
}

/* ============================================================
   SARDINA — cardumen (boids)
   ============================================================ */
class Sardina {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    const a = rand(TAU);
    this.vel = { x: Math.cos(a) * 70, y: Math.sin(a) * 70 };
    this.seed = rand(100);
    this.hue = 150 + rand(-14, 14);
    this.len = rand(10, 14);
  }
  update(dt) {
    const flock = world.creatures;
    let cx = 0, cy = 0, ax = 0, ay = 0, sx = 0, sy = 0, cn = 0;
    for (const o of flock) {
      if (o === this || o.key !== 'sardina') continue;
      const d = dist(this.x, this.y, o.x, o.y);
      if (d < 52) {
        cx += o.x; cy += o.y;
        ax += o.vel.x; ay += o.vel.y;
        cn++;
        if (d < 15 && d > 0.01) {
          sx += (this.x - o.x) / d;
          sy += (this.y - o.y) / d;
        }
      }
    }
    const f = { x: 0, y: 0 };
    if (cn) {
      f.x += ((cx / cn) - this.x) * 0.025;          // cohesión
      f.y += ((cy / cn) - this.y) * 0.025;
      f.x += ((ax / cn) - this.vel.x) * 0.035;       // alineación
      f.y += ((ay / cn) - this.vel.y) * 0.035;
      f.x += sx * 4.5; f.y += sy * 4.5;              // separación
    }
    // huir de depredadores y del cursor
    let panic = 0;
    for (const o of flock) {
      if (o.key === 'blanco' || o.key === 'martillo' || o.key === 'espectro') {
        const h = o.head();
        const d = dist(this.x, this.y, h.x, h.y);
        if (d < 140) {
          const away = norm(this.x - h.x, this.y - h.y);
          const k = (140 - d) / 140;
          f.x += away.x * k * 30; f.y += away.y * k * 30;
          panic = Math.max(panic, k);
        }
      }
    }
    const m = world.mouse;
    if (m.active) {
      const d = dist(this.x, this.y, m.x, m.y);
      if (d < 90) {
        const away = norm(this.x - m.x, this.y - m.y);
        f.x += away.x * 14; f.y += away.y * 14;
      }
    }
    // buscar comida (pellets y plancton); la carnada les da pavor
    let best = null, bd = 240;
    for (const p of world.food) {
      const d = dist(this.x, this.y, p.x, p.y);
      if (p.type === 'carnada') {
        if (d < 150) {
          const away = norm(this.x - p.x, this.y - p.y);
          const k = (150 - d) / 150;
          f.x += away.x * k * 22; f.y += away.y * k * 22;
          panic = Math.max(panic, k * 0.8);
        }
        continue;
      }
      if (p.type === 'luz') continue;
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const to = norm(best.x - this.x, best.y - this.y);
      f.x += to.x * 9; f.y += to.y * 9;
      if (bd < 9) best.eaten = true;
    }
    if (this.leaving) {
      f.x += this.exitX > this.x ? 26 : -26; // rompe la formación y se va
    } else {
      wallForce(this.x, this.y, f, 60, 70);
    }
    this.vel.x += f.x * dt * 60;
    this.vel.y += f.y * dt * 60;
    const spd = Math.hypot(this.vel.x, this.vel.y);
    const target = lerp(70, 150, panic);
    const ns = lerp(spd, target, clamp(dt * 3, 0, 1)) || target;
    const v = norm(this.vel.x, this.vel.y);
    this.vel.x = v.x * ns; this.vel.y = v.y * ns;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 50, world.floorY(this.x) - 16);
    if (this.leaving) {
      if (this.x < -100 || this.x > world.W + 100) this.dead = true;
    } else {
      // margen amplio: las recién llegadas entran nadando desde fuera
      this.x = clamp(this.x, -80, world.W + 80);
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vel.y, this.vel.x));
    const L = this.len;
    const flap = Math.sin(world.time * 13 + this.seed * 7);
    // cola
    ctx.beginPath();
    ctx.moveTo(-L * 0.4, 0);
    ctx.lineTo(-L * 0.8, flap * L * 0.28 - L * 0.18);
    ctx.lineTo(-L * 0.8, flap * L * 0.28 + L * 0.18);
    ctx.closePath();
    ctx.fillStyle = `hsl(${this.hue}, 65%, 38%)`;
    ctx.fill();
    // cuerpo
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.5, L * 0.21, 0, 0, TAU);
    ctx.fillStyle = `hsl(${this.hue}, 70%, 48%)`;
    ctx.fill();
    // vientre claro
    ctx.beginPath();
    ctx.ellipse(L * 0.05, L * 0.06, L * 0.36, L * 0.1, 0, 0, TAU);
    ctx.fillStyle = `hsla(${this.hue}, 60%, 72%, 0.7)`;
    ctx.fill();
    // ojo
    ctx.beginPath(); ctx.arc(L * 0.3, -L * 0.04, 1.3, 0, TAU);
    ctx.fillStyle = '#081018'; ctx.fill();
    // punto bioluminiscente en modo abisal
    if (world.abyssMix > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, TAU);
      ctx.fillStyle = `rgba(120, 255, 200, ${0.7 * world.abyssMix})`;
      ctx.fill();
    }
    ctx.restore();
  }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 14; }
}

/* ============================================================
   MEDUSA LUNA
   ============================================================ */
class Medusa {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.r = rand(20, 34);
    this.seed = rand(100);
    this.pulse = rand(TAU);
    this.driftX = rand(-6, 6);
  }
  update(dt) {
    this.fade = this.fade ?? 1;
    if (this.leaving) {
      this.fade -= dt * 0.7;
      if (this.fade <= 0) { this.dead = true; return; }
    } else if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt * 0.45);
    }
    this.pulse += dt * 1.6;
    const s = Math.sin(this.pulse);
    this.y -= (4 + 13 * Math.max(0, s)) * dt * (this.r / 26);
    this.x += (this.driftX + Math.sin(world.time * 0.4 + this.seed) * 6) * dt;
    // el plancton la tienta, sin ninguna prisa
    for (const p of world.food) {
      if (p.type !== 'plancton') continue;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < 220) { this.x += ((p.x - this.x) / (d || 1)) * 12 * dt; break; }
    }
    // cerca de la superficie se desvanece y reaparece fundiéndose al fondo
    if (this.y < 72) {
      this.y = world.floorY(this.x) - 60;
      this.x = rand(60, world.W - 60);
      this.fade = 0;
    }
    this.x = clamp(this.x, 30, world.W - 30);
    this.alpha = this.fade * clamp((this.y - 66) / 60, 0, 1);
  }
  draw(ctx) {
    const s = Math.sin(this.pulse);
    const rw = this.r * (1 + 0.13 * s), rh = this.r * (0.7 - 0.12 * s);
    ctx.save();
    ctx.translate(this.x, this.y);
    // tentáculos
    ctx.strokeStyle = `rgba(190, 160, 255, ${0.35 + world.abyssMix * 0.2})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const ox = (i - 2) * rw * 0.4;
      const sway = Math.sin(world.time * 1.3 + this.seed + i) * 10;
      ctx.beginPath();
      ctx.moveTo(ox, rh * 0.4);
      ctx.bezierCurveTo(ox + sway * 0.3, rh + this.r * 0.8,
                        ox + sway, rh + this.r * 1.6,
                        ox + sway * 1.4, rh + this.r * 2.2);
      ctx.stroke();
    }
    // campana
    const glow = 0.5 + world.abyssMix * 0.3;
    const gr = ctx.createRadialGradient(0, -rh * 0.2, 0, 0, 0, rw);
    gr.addColorStop(0, `rgba(230, 210, 255, ${0.5 * glow})`);
    gr.addColorStop(0.7, `rgba(180, 150, 250, ${0.3 * glow})`);
    gr.addColorStop(1, `rgba(150, 120, 240, ${0.12 * glow})`);
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, Math.PI, 0);
    ctx.quadraticCurveTo(rw * 0.6, rh * 0.55, 0, rh * 0.5);
    ctx.quadraticCurveTo(-rw * 0.6, rh * 0.55, -rw, 0);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = `rgba(220, 200, 255, ${0.5 * glow})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // órganos en trébol
    ctx.fillStyle = `rgba(255, 170, 220, ${0.4 * glow})`;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * rw * 0.25, -rh * 0.15 + Math.sin(a) * rh * 0.2, rw * 0.13, rh * 0.16, a, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.r + 8; }
}

/* ============================================================
   ESTRELLA DE MAR — naranja, sobre la arena (como el boceto)
   ============================================================ */
class Estrella {
  constructor(key, sp, x) {
    this.key = key; this.sp = sp;
    this.x = x ?? rand(60, world.W - 60);
    this.y = 0; // se asienta en draw según el suelo
    this.r = rand(16, 24);
    this.rot = rand(TAU);
    this.seed = rand(100);
  }
  update(dt) {
    // emerge de la arena al llegar; se entierra al marcharse
    this.emerge = this.emerge ?? 1;
    if (this.leaving) {
      this.emerge -= dt / 1.8;
      if (this.emerge <= 0) { this.dead = true; return; }
    } else if (this.emerge < 1) {
      this.emerge = Math.min(1, this.emerge + dt / 2.5);
      if (Math.random() < 0.1) {
        world.bubbles.push(makeBubble(this.x + rand(-10, 10), world.floorY(this.x) - 4, rand(1, 2.5)));
      }
    }
    this.alpha = this.emerge;
    this.x += Math.sin(world.time * 0.05 + this.seed) * 0.4 * dt; // arrastre glacial
    this.y = world.floorY(this.x) - this.r * 0.28 + (1 - this.emerge) * this.r * 0.6;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot + Math.sin(world.time * 0.3 + this.seed) * 0.03);
    const R = this.r, r = R * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a0 = (i / 5) * TAU - Math.PI / 2;
      const a1 = a0 + TAU / 10;
      const ox = Math.cos(a0) * R, oy = Math.sin(a0) * R;
      const ix = Math.cos(a1) * r, iy = Math.sin(a1) * r;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.quadraticCurveTo(ix * 1.15, iy * 1.15,
        Math.cos(a1 + TAU / 10) * R, Math.sin(a1 + TAU / 10) * R);
    }
    ctx.closePath();
    ctx.fillStyle = '#f59f3b';
    ctx.fill();
    ctx.strokeStyle = '#b06a1e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // textura de bultitos
    ctx.fillStyle = 'rgba(255, 220, 160, 0.65)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath();
        ctx.arc(Math.cos(a) * R * 0.3 * k, Math.sin(a) * R * 0.3 * k, 1.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.r + 6; }
}

/* ============================================================
   FAROLUZ — pececillo ficticio con farol (rape de fantasía)
   ============================================================ */
class Faroluz {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    const a = rand(TAU);
    this.vel = { x: Math.cos(a) * 28, y: Math.sin(a) * 10 };
    this.seed = rand(100);
    this.len = rand(24, 32);
  }
  update(dt) {
    const f = { x: 0, y: 0 };
    const n = norm(-this.vel.y, this.vel.x);
    const wob = Math.sin(world.time * 0.5 + this.seed * 3);
    f.x += n.x * wob * 1.2; f.y += n.y * wob * 1.2;
    f.y += -this.vel.y * 0.02;
    // busca comida también (todo menos la carnada, que le queda grande)
    let best = null, bd = 200;
    for (const p of world.food) {
      if (p.type === 'carnada') continue;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const to = norm(best.x - this.x, best.y - this.y);
      f.x += to.x * 6; f.y += to.y * 6;
      if (bd < 8) best.eaten = true;
    }
    if (this.leaving) {
      f.x += this.exitX > this.x ? 6 : -6;
      if (this.x < -80 || this.x > world.W + 80) { this.dead = true; return; }
    } else {
      wallForce(this.x, this.y, f, 80, 100);
    }
    const v = norm(this.vel.x + f.x * dt * 40, this.vel.y + f.y * dt * 40);
    const spd = this.leaving ? 40 : 26;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 60, world.floorY(this.x) - 20);
  }
  draw(ctx) {
    const dir = this.vel.x >= 0 ? 1 : -1;
    const L = this.len;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    ctx.rotate(Math.atan2(this.vel.y, Math.abs(this.vel.x)) * 0.5);
    // farol
    const bx = L * 0.62, by = -L * 0.55;
    const flick = 0.72 + 0.28 * Math.sin(world.time * 11 + this.seed * 9);
    const glowR = (11 + world.abyssMix * 16) * flick;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(bx, by, 0, bx, by, glowR);
    gl.addColorStop(0, `rgba(255, 230, 150, ${0.85 * flick})`);
    gl.addColorStop(0.4, `rgba(255, 190, 90, ${0.35 * flick})`);
    gl.addColorStop(1, 'rgba(255, 180, 84, 0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(bx, by, glowR, 0, TAU); ctx.fill();
    ctx.restore();
    // antena
    ctx.strokeStyle = '#2a2f55';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(L * 0.25, -L * 0.16);
    ctx.quadraticCurveTo(L * 0.3, -L * 0.72, bx, by);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, TAU);
    ctx.fillStyle = '#ffe9a0'; ctx.fill();
    // cola
    const flap = Math.sin(world.time * 9 + this.seed * 5);
    ctx.beginPath();
    ctx.moveTo(-L * 0.4, 0);
    ctx.lineTo(-L * 0.72, flap * L * 0.2 - L * 0.2);
    ctx.lineTo(-L * 0.72, flap * L * 0.2 + L * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#232850';
    ctx.fill();
    // cuerpo regordete
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.46, L * 0.34, 0, 0, TAU);
    ctx.fillStyle = '#1b1f42';
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 160, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // ojo enorme
    ctx.beginPath(); ctx.arc(L * 0.2, -L * 0.06, L * 0.13, 0, TAU);
    ctx.fillStyle = '#eef6ff'; ctx.fill();
    ctx.beginPath(); ctx.arc(L * 0.23, -L * 0.06, L * 0.06, 0, TAU);
    ctx.fillStyle = '#0a1020'; ctx.fill();
    // dientecillos
    ctx.fillStyle = '#eef6ff';
    ctx.beginPath();
    ctx.moveTo(L * 0.42, L * 0.1); ctx.lineTo(L * 0.36, L * 0.2); ctx.lineTo(L * 0.3, L * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.len * 0.7; }
}

/* ============================================================
   BUZO — explorador residente
   ============================================================ */
class Buzo {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.baseY = y;
    this.dir = pick([-1, 1]);
    this.seed = rand(100);
    this.nextBubble = 0;
    this.nextTurn = world.time + rand(6, 14);
    this.vel = { x: 0, y: 0 }; // para uniformidad
  }
  update(dt) {
    const t = world.time;
    if (t > this.nextTurn || this.x < 90 && this.dir < 0 || this.x > world.W - 90 && this.dir > 0) {
      this.dir *= -1;
      this.nextTurn = t + rand(7, 16);
    }
    this.x += this.dir * 13 * dt;
    if (this.entering) {
      // desciende desde la superficie entre burbujas
      this.baseY += 42 * dt;
      if (this.baseY >= world.H * 0.34) this.entering = false;
    } else if (this.leaving) {
      // asciende y se despide
      this.baseY -= 46 * dt;
      if (this.baseY < -90) { this.dead = true; return; }
    } else {
      this.baseY += Math.sin(t * 0.13 + this.seed) * 4 * dt;
      this.baseY = clamp(this.baseY, world.H * 0.28, world.H * 0.68);
    }
    this.y = this.baseY + Math.sin(t * 0.8 + this.seed) * 7;
    if (t > this.nextBubble) {
      world.bubbles.push(makeBubble(this.x + this.dir * 16, this.y - 26, rand(2, 5)));
      if (Math.random() < 0.5) world.bubbles.push(makeBubble(this.x + this.dir * 14, this.y - 24, rand(1.5, 3)));
      this.nextBubble = t + rand(1.2, 2.8);
    }
  }
  draw(ctx) {
    const t = world.time;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir * 1.35, 1.35);
    ctx.rotate(Math.sin(t * 0.8 + this.seed) * 0.05);
    const kick = Math.sin(t * 3.2 + this.seed);
    ctx.lineCap = 'round';
    // tanque
    ctx.beginPath(); ctx.roundRect(-15, -12, 9, 24, 4);
    ctx.fillStyle = '#d8a03c'; ctx.fill();
    ctx.strokeStyle = '#8a621f'; ctx.lineWidth = 1; ctx.stroke();
    // piernas con aletas
    ctx.strokeStyle = '#14293e'; ctx.lineWidth = 5;
    for (const s of [-1, 1]) {
      const ky = 20 + kick * 3 * s;
      ctx.beginPath(); ctx.moveTo(-2, 12); ctx.lineTo(-13, ky); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-13, ky - 2); ctx.lineTo(-24, ky + kick * 2 * s); ctx.lineTo(-13, ky + 3);
      ctx.closePath(); ctx.fillStyle = '#0e1e30'; ctx.fill();
    }
    // cuerpo
    ctx.beginPath(); ctx.roundRect(-9, -14, 20, 28, 9);
    ctx.fillStyle = '#16324a'; ctx.fill();
    ctx.strokeStyle = '#2c5a7a'; ctx.lineWidth = 1.2; ctx.stroke();
    // brazo
    ctx.strokeStyle = '#16324a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(4, -3);
    ctx.lineTo(15, 5 + Math.sin(t * 1.7 + this.seed) * 3);
    ctx.stroke();
    // casco
    ctx.beginPath(); ctx.arc(7, -20, 9.5, 0, TAU);
    ctx.fillStyle = '#c8d4dc'; ctx.fill();
    ctx.strokeStyle = '#7e929e'; ctx.lineWidth = 1.2; ctx.stroke();
    // visor
    ctx.beginPath(); ctx.arc(10, -20, 6.5, -1.1, 1.4);
    ctx.lineTo(10, -20);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120, 220, 255, 0.85)'; ctx.fill();
    // brillo del visor
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(10, -20, 4.5, -0.9, -0.2); ctx.stroke();
    // manguera
    ctx.strokeStyle = '#3d5568'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(2, -24);
    ctx.bezierCurveTo(-6, -28, -12, -20, -11, -12);
    ctx.stroke();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y - 22 }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y - 8) < 36; }
}

/* ---------- burbujas ---------- */
function makeBubble(x, y, r) {
  return { x, y, r, phase: rand(TAU), vy: 22 + r * 7 };
}

/* ============================================================
   AMPLIACIÓN DEL ARRECIFE — especies nuevas
   ============================================================ */

/* tiburón de puntas blancas: alterna nadar y descansar en el fondo */
function restBehavior(fish, f, dt) {
  const t = world.time;
  if (fish.restState === undefined) {
    fish.restState = 'swim';
    fish.stateUntil = t + rand(8, 16);
  }
  if (t > fish.stateUntil) {
    fish.restState = fish.restState === 'swim' ? 'rest' : 'swim';
    fish.stateUntil = t + (fish.restState === 'rest' ? rand(7, 14) : rand(10, 20));
  }
  if (fish.restState === 'rest') {
    fish.speedMul = 0.14;
    fish.wiggleMul = 0.3;
    const fl = world.floorY(fish.x) - 18;
    f.y += clamp((fl - fish.y) * 0.06, -1.5, 2.5);
    f.x *= 0.3; // deja de deambular, se acomoda
  } else {
    fish.speedMul = 1;
    fish.wiggleMul = 1;
  }
}

function drawPuntasBlancas(fish, ctx, g) {
  const finC = '#6a7a64';
  sharkFins(fish, ctx, g, finC);
  // puntas blancas: manchas en el ápice dorsal y el lóbulo de la cola
  const { P, T } = g;
  const w = fish.maxW;
  const di = 4;
  const U = fish.up(g, di);
  const back = { x: -T[di].x, y: -T[di].y };
  ctx.fillStyle = 'rgba(240, 248, 240, 0.95)';
  ctx.beginPath();
  ctx.arc(P[di].x + U.x * w * 2.0 + back.x * w * 0.9, P[di].y + U.y * w * 2.0 + back.y * w * 0.9, w * 0.42, 0, TAU);
  ctx.fill();
  const nn = P.length - 1;
  const td = { x: -T[nn].x, y: -T[nn].y };
  const rot = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
  let lobe = rot(td, -0.55);
  if (lobe.y > 0) lobe = rot(td, 0.5);
  ctx.beginPath();
  ctx.arc(P[nn].x + lobe.x * w * 2.5, P[nn].y + lobe.y * w * 2.5, w * 0.36, 0, TAU);
  ctx.fill();
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#7d8a75', '#dde3d6');
  ctx.fill();
  sharkFace(fish, ctx, g, { teeth: false });
}

/* anguila cinta azul */
function drawCinta(fish, ctx, g) {
  eelDorsalRibbon(fish, ctx, g, 'rgba(255, 214, 60, 0.8)');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#1d4fd8', '#5b9bff');
  ctx.fill();
  // hocico amarillo con apéndices nasales
  const { P, T } = g;
  const tip = { x: P[0].x + T[0].x * fish.widths[0] * 1.5, y: P[0].y + T[0].y * fish.widths[0] * 1.5 };
  ctx.fillStyle = '#ffd63c';
  ctx.beginPath(); ctx.arc(tip.x, tip.y, fish.widths[0] * 0.9, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffd63c'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  const U0 = fish.up(g, 0);
  const flare = Math.sin(world.time * 2.4 + fish.seed) * 2;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + T[0].x * 7 + U0.x * (5 + flare), tip.y + T[0].y * 7 + U0.y * (5 + flare));
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + T[0].x * 7 - U0.x * (5 - flare), tip.y + T[0].y * 7 - U0.y * (5 - flare));
  ctx.stroke();
  eelFace(fish, ctx, g, '#ffe9a0');
}

/* ---------- PULPO DE ARRECIFE — se camufla ---------- */
class Pulpo {
  constructor(key, sp, x) {
    this.key = key; this.sp = sp;
    this.home = x ?? rand(world.W * 0.2, world.W * 0.8);
    this.x = this.home;
    this.y = 0;
    this.r = rand(15, 21);
    this.seed = rand(100);
    this.tx = this.home;
    this.nextMove = 0;
    this.calm = 1;
    this.vel = { x: 0, y: 0 };
    this.baseRgb = hexToRgb('#b5563f');
    this.sandRgb = hexToRgb('#3a5470');
  }
  update(dt) {
    const t = world.time;
    if (this.leaving) {
      // propulsión a chorro hacia la salida
      this.tx = this.exitX;
      this.home = this.exitX;
      if (this.x < -70 || this.x > world.W + 70) { this.dead = true; return; }
    } else if (t > this.nextMove) {
      this.tx = clamp(this.home + rand(-140, 140), 40, world.W - 40);
      this.nextMove = t + rand(5, 11);
    }
    const dx = this.tx - this.x;
    const moving = Math.abs(dx) > 5;
    if (moving) this.x += Math.sign(dx) * (this.leaving ? 48 : 15) * dt;
    this.y = world.floorY(this.x) - this.r * 0.85 + Math.sin(t * 1.1 + this.seed) * 1.5;
    const m = world.mouse;
    const scared = m.active && dist(m.x, m.y, this.x, this.y) < 75;
    this.calm = clamp(this.calm + ((moving || scared) ? -2.2 : 0.45) * dt, 0, 1);
  }
  draw(ctx) {
    const t = world.time;
    const body = mixRgb(this.baseRgb, this.sandRgb, this.calm * 0.8);
    ctx.save();
    ctx.translate(this.x, this.y);
    // tentáculos
    ctx.strokeStyle = body;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const spread = (i - 2) * 0.5;
      const curl = Math.sin(t * 1.8 + this.seed + i * 1.7) * 6;
      ctx.lineWidth = 3.4 - Math.abs(spread);
      ctx.beginPath();
      ctx.moveTo(spread * 4, this.r * 0.4);
      ctx.bezierCurveTo(
        spread * this.r * 0.9, this.r * 0.9,
        spread * this.r * 1.3 + curl, this.r * 1.05,
        spread * this.r * 1.5 + curl * 1.6, this.r * 0.8 + Math.abs(spread) * 2);
      ctx.stroke();
    }
    // manto
    ctx.beginPath();
    ctx.ellipse(0, -this.r * 0.25, this.r * 0.95, this.r * 0.8, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    // ojos con pupila horizontal
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(s * this.r * 0.42, -this.r * 0.6, this.r * 0.2, 0, TAU);
      ctx.fillStyle = '#e8dfc8'; ctx.fill();
      ctx.fillStyle = '#20140e';
      ctx.fillRect(s * this.r * 0.42 - this.r * 0.13, -this.r * 0.63, this.r * 0.26, this.r * 0.09);
    }
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y - this.r * 0.5 }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.r + 12; }
}

/* ---------- RAYA LÁTIGO — planea sobre la arena ---------- */
class Raya {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.dir = pick([-1, 1]);
    this.hover = rand(30, 60);
    this.seed = rand(100);
    this.y = y;
    this.vel = { x: this.dir, y: 0 };
  }
  update(dt) {
    const t = world.time;
    if (this.leaving) {
      this.dir = this.exitX > this.x ? 1 : -1;
      if (this.x < -150 || this.x > world.W + 150) { this.dead = true; return; }
    } else if ((this.x < 100 && this.dir < 0) || (this.x > world.W - 100 && this.dir > 0)) this.dir *= -1;
    this.x += this.dir * 26 * dt;
    this.hover += Math.sin(t * 0.23 + this.seed) * 3 * dt;
    this.hover = clamp(this.hover, 18, 80);
    this.y = world.floorY(this.x) - this.hover + Math.sin(t * 1.4 + this.seed) * 4;
    this.vel.x = this.dir;
  }
  draw(ctx) {
    const t = world.time;
    const L = 62;
    const flap = Math.sin(t * 2.6 + this.seed);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);
    // cola látigo
    ctx.strokeStyle = '#5d6b78';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-L * 0.45, 0);
    ctx.bezierCurveTo(-L * 0.9, -2, -L * 1.15, flap * 5 - 4, -L * 1.45, flap * 9);
    ctx.stroke();
    // ala que ondula (vista de perfil)
    const g1 = ctx.createLinearGradient(0, -L * 0.35, 0, L * 0.2);
    g1.addColorStop(0, '#79878f');
    g1.addColorStop(1, '#c9d4d4');
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.quadraticCurveTo(L * 0.15, -L * 0.42 - flap * 6, -L * 0.3, -L * 0.06);
    ctx.quadraticCurveTo(-L * 0.45, 0, -L * 0.3, L * 0.05);
    ctx.quadraticCurveTo(L * 0.05, L * 0.22 + flap * 3, L * 0.5, 0);
    ctx.closePath();
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 55, 65, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // ojo saltón
    ctx.beginPath(); ctx.arc(L * 0.3, -L * 0.1, 2.6, 0, TAU);
    ctx.fillStyle = '#0b1520'; ctx.fill();
    ctx.beginPath(); ctx.arc(L * 0.3 - 0.8, -L * 0.11, 0.9, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x + this.dir * 20, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 42; }
}

/* ---------- PEZ PAYASO — orbita su anémona ---------- */
class PezPayaso {
  constructor(key, sp) {
    this.key = key; this.sp = sp;
    const a = world.anemone || { x: world.W * 0.16, y: world.floorY(world.W * 0.16) - 26 };
    this.homeX = a.x; this.homeY = a.y - 14;
    this.x = this.homeX + rand(-30, 30);
    this.y = this.homeY + rand(-24, 6);
    const ang = rand(TAU);
    this.vel = { x: Math.cos(ang) * 30, y: Math.sin(ang) * 12 };
    this.seed = rand(100);
    this.len = rand(13, 17);
  }
  update(dt) {
    // aparece y desaparece dentro de su anémona
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.9);
      if (this.alpha >= 1) this.entering = false;
    }
    const f = { x: 0, y: 0 };
    const n = norm(-this.vel.y, this.vel.x);
    const wob = Math.sin(world.time * 1.3 + this.seed * 3);
    f.x += n.x * wob * 1.6; f.y += n.y * wob * 1.6;
    // querencia por la anémona
    const dx = this.homeX - this.x, dy = this.homeY - this.y;
    const d = Math.hypot(dx, dy);
    if (this.leaving) {
      f.x += (dx / (d || 1)) * 9; f.y += (dy / (d || 1)) * 9;
      if (d < 24) {
        this.alpha = (this.alpha ?? 1) - dt * 1.6;
        if (this.alpha <= 0) { this.dead = true; return; }
      }
    } else if (d > 55) { f.x += (dx / d) * 4.5; f.y += (dy / d) * 4.5; }
    // el cursor lo mete en la anémona
    const m = world.mouse;
    if (m.active && dist(m.x, m.y, this.x, this.y) < 70) {
      f.x += (dx / (d || 1)) * 8; f.y += (dy / (d || 1)) * 8;
    }
    const v = norm(this.vel.x + f.x * dt * 50, this.vel.y + f.y * dt * 50);
    const spd = 34;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 60, world.floorY(this.x) - 8);
  }
  draw(ctx) {
    const L = this.len;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vel.y, this.vel.x));
    if (this.vel.x < 0) ctx.scale(1, -1); // no nadar boca abajo
    const flap = Math.sin(world.time * 11 + this.seed * 7);
    // cola
    ctx.beginPath();
    ctx.moveTo(-L * 0.35, 0);
    ctx.lineTo(-L * 0.72, flap * L * 0.22 - L * 0.22);
    ctx.lineTo(-L * 0.72, flap * L * 0.22 + L * 0.22);
    ctx.closePath();
    ctx.fillStyle = '#e8641f';
    ctx.fill();
    // cuerpo
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.52, L * 0.3, 0, 0, TAU);
    ctx.fillStyle = '#f47a2b';
    ctx.fill();
    // bandas blancas con borde negro
    ctx.lineWidth = 0.8;
    for (const bx of [L * 0.2, -L * 0.18]) {
      ctx.beginPath();
      ctx.ellipse(bx, 0, L * 0.09, L * 0.3, 0, 0, TAU);
      ctx.fillStyle = '#f6f2e8';
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 20, 10, 0.55)';
      ctx.stroke();
    }
    // ojo
    ctx.beginPath(); ctx.arc(L * 0.34, -L * 0.05, 1.6, 0, TAU);
    ctx.fillStyle = '#170f08'; ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 16; }
}

/* ---------- CANGREJO ERMITAÑO ---------- */
class Ermitano {
  constructor(key, sp, x) {
    this.key = key; this.sp = sp;
    this.x = x ?? rand(80, world.W - 80);
    this.y = 0;
    this.dir = pick([-1, 1]);
    this.seed = rand(100);
    this.nextTurn = world.time + rand(6, 14);
    this.hide = 0; // 0 fuera — 1 escondido
    this.vel = { x: 0, y: 0 };
  }
  update(dt) {
    const t = world.time;
    if (this.leaving) {
      this.dir = this.exitX > this.x ? 1 : -1;
      this.hide = 0;
      this.x += this.dir * 16 * dt; // prisa, para ser un ermitaño
      this.y = world.floorY(this.x) - 5;
      if (this.x < -40 || this.x > world.W + 40) this.dead = true;
      return;
    }
    const m = world.mouse;
    const scared = m.active && dist(m.x, m.y, this.x, this.y) < 60;
    this.hide = clamp(this.hide + (scared ? 4 : -1.2) * dt, 0, 1);
    if (t > this.nextTurn || this.x < 50 || this.x > world.W - 50) {
      this.dir = this.x < 50 ? 1 : this.x > world.W - 50 ? -1 : -this.dir;
      this.nextTurn = t + rand(6, 14);
    }
    // entra con paso ligero desde fuera de la pantalla
    const walk = (this.x < 20 || this.x > world.W - 20) ? 16 : 7;
    if (this.hide < 0.5) this.x += this.dir * walk * dt;
    this.y = world.floorY(this.x) - 5;
  }
  draw(ctx) {
    const t = world.time;
    const out = 1 - this.hide;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);
    // patas
    if (out > 0.1) {
      ctx.strokeStyle = '#c26a3a';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const step = Math.sin(t * 9 + i * 2.1 + this.seed) * 2.5 * out;
        ctx.beginPath();
        ctx.moveTo(4 + i * 2.5, 0);
        ctx.lineTo(7 + i * 3.5 + step, 5);
        ctx.stroke();
      }
      // ojos con pedúnculo
      ctx.beginPath(); ctx.moveTo(8, -3 * out); ctx.lineTo(9, -8 * out);
      ctx.moveTo(11, -3 * out); ctx.lineTo(12.5, -7.5 * out);
      ctx.stroke();
      ctx.fillStyle = '#20140e';
      ctx.beginPath(); ctx.arc(9, -8.5 * out, 1.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(12.5, -8 * out, 1.3, 0, TAU); ctx.fill();
      // pinza
      ctx.fillStyle = '#d1793f';
      ctx.beginPath();
      ctx.ellipse(11 + out * 2, 2, 3.4, 2.2, 0.4, 0, TAU);
      ctx.fill();
    }
    // concha en espiral
    const g1 = ctx.createLinearGradient(0, -12, 0, 2);
    g1.addColorStop(0, '#c9a878');
    g1.addColorStop(1, '#8a6a48');
    ctx.beginPath();
    ctx.ellipse(-2, -5.5, 9.5, 7.5, -0.2, 0, TAU);
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 48, 28, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-3.5, -6, 4, 0.4, TAU * 0.85);
    ctx.stroke();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y - 8 }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y - 4) < 16; }
}

/* ---------- PEZ ESPEJO (ficticio) — refleja al vecino ---------- */
class PezEspejo {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    const a = rand(TAU);
    this.vel = { x: Math.cos(a) * 30, y: Math.sin(a) * 10 };
    this.seed = rand(100);
    this.len = rand(22, 28);
    this.tint = hexToRgb('#9fb8cc');
  }
  update(dt) {
    const f = { x: 0, y: 0 };
    const n = norm(-this.vel.y, this.vel.x);
    const wob = Math.sin(world.time * 0.6 + this.seed * 3);
    f.x += n.x * wob * 1.3; f.y += n.y * wob * 1.3;
    f.y += -this.vel.y * 0.03;
    // como buen ficticio, la luz embotellada lo hipnotiza
    for (const p of world.food) {
      if (p.type !== 'luz') continue;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < 320) {
        const dl = norm(p.x - this.x, p.y - this.y);
        f.x += dl.x * 5; f.y += dl.y * 5;
        break;
      }
    }
    if (this.leaving) {
      f.x += this.exitX > this.x ? 6 : -6;
      if (this.x < -80 || this.x > world.W + 80) { this.dead = true; return; }
    } else {
      wallForce(this.x, this.y, f, 80, 90);
    }
    const v = norm(this.vel.x + f.x * dt * 40, this.vel.y + f.y * dt * 40);
    const spd = this.leaving ? 44 : 32;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 60, world.floorY(this.x) - 20);
    // adopta el color de la criatura más cercana
    let best = null, bd = 200;
    for (const c of world.creatures) {
      if (c === this || c.key === 'espejo') continue;
      const d = dist(this.x, this.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) {
      const target = hexToRgb(best.sp.color);
      const k = Math.min(1, dt * 1.5);
      this.tint = this.tint.map((v0, i) => lerp(v0, target[i], k));
    }
  }
  draw(ctx) {
    const L = this.len;
    const t = world.time;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vel.y, this.vel.x));
    if (this.vel.x < 0) ctx.scale(1, -1);
    const flap = Math.sin(t * 10 + this.seed * 5);
    // cola
    ctx.beginPath();
    ctx.moveTo(-L * 0.38, 0);
    ctx.lineTo(-L * 0.75, flap * L * 0.2 - L * 0.22);
    ctx.lineTo(-L * 0.75, flap * L * 0.2 + L * 0.22);
    ctx.closePath();
    ctx.fillStyle = mixRgb(this.tint, [235, 245, 250], 0.3);
    ctx.fill();
    // cuerpo cromado: barrido especular animado
    const sweep = (Math.sin(t * 1.7 + this.seed) + 1) / 2;
    const g1 = ctx.createLinearGradient(-L * 0.5, -L * 0.3, L * 0.5, L * 0.3);
    g1.addColorStop(0, mixRgb(this.tint, [255, 255, 255], 0.15));
    g1.addColorStop(clamp(sweep, 0.05, 0.95), '#f4fbff');
    g1.addColorStop(1, mixRgb(this.tint, [30, 45, 60], 0.35));
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.52, L * 0.3, 0, 0, TAU);
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // ojo
    ctx.beginPath(); ctx.arc(L * 0.32, -L * 0.05, 1.8, 0, TAU);
    ctx.fillStyle = '#0a1018'; ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.len * 0.7; }
}

/* ============================================================
   EL MAR BURBUJEANTE — especies
   ============================================================ */

/* anguila jardín: un signo de interrogación tímido asomando de la arena */
class AnguilaJardin {
  constructor(key, sp, x) {
    this.key = key; this.sp = sp;
    this.x = x ?? rand(70, world.W - 70);
    this.h = rand(38, 56);
    this.seed = rand(100);
    this.emerge = 1;
    this.shy = 0;
    this.y = 0;
    this.vel = { x: 0, y: 0 };
  }
  update(dt) {
    if (this.leaving) {
      this.emerge -= dt / 1.2;
      if (this.emerge <= 0) { this.dead = true; return; }
    } else if (this.emerge < 1) {
      this.emerge = Math.min(1, this.emerge + dt / 2.2);
    }
    const m = world.mouse;
    const scared = m.active && dist(m.x, m.y, this.x, world.floorY(this.x) - this.h * 0.6) < 80;
    this.shy = clamp(this.shy + (scared ? 3.5 : -1.1) * dt, 0, 1);
    this.y = world.floorY(this.x) - this.h * 0.5;
  }
  out() { return this.emerge * (1 - this.shy * 0.92); }
  draw(ctx) {
    const out = this.out();
    const base = (this.baseY ?? world.floorY(this.x)) + 2; // baseY: pose de retrato
    if (out < 0.03) {
      // solo el hocico asomando, vigilante
      ctx.fillStyle = '#cfc8b2';
      ctx.beginPath(); ctx.arc(this.x, base - 2, 1.6, 0, TAU); ctx.fill();
      return;
    }
    const t = world.time;
    const H = this.h * out;
    const segs = 8;
    ctx.save();
    ctx.lineCap = 'round';
    let px = this.x, py = base;
    const pts = [{ x: px, y: py }];
    for (let i = 1; i <= segs; i++) {
      const tt = i / segs;
      pts.push({
        x: this.x + Math.sin(t * 1.15 + this.seed + tt * 2.6) * 7 * tt,
        y: base - H * tt,
      });
    }
    // el último tramo se curva: el signo de interrogación
    const tip = pts[segs];
    tip.x += 4;
    for (let i = 1; i <= segs; i++) {
      ctx.strokeStyle = i > segs - 2 ? '#b8b09a' : '#d6cfba';
      ctx.lineWidth = lerp(3.6, 2.2, i / segs);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    // moteado
    ctx.fillStyle = 'rgba(90, 84, 62, 0.5)';
    for (let i = 1; i < segs; i += 2) {
      ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.1, 0, TAU); ctx.fill();
    }
    // ojos
    ctx.fillStyle = '#20180e';
    ctx.beginPath(); ctx.arc(tip.x - 1.2, tip.y - 0.5, 1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(tip.x + 1.4, tip.y - 0.5, 1, 0, TAU); ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: world.floorY(this.x) - this.h * this.out() }; }
  hit(mx, my) {
    const base = world.floorY(this.x);
    return Math.abs(mx - this.x) < 12 && my > base - this.h - 8 && my < base + 4;
  }
}

/* caballito de mar: vertical, digno, sin prisa */
class Caballito {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.holdX = x;
    this.dir = pick([-1, 1]);
    this.seed = rand(100);
    this.len = rand(24, 32);
    this.nextDrift = 0;
    this.vel = { x: 0, y: 0 };
  }
  update(dt) {
    const t = world.time;
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.8);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 0.9;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    if (t > this.nextDrift) {
      this.holdX = clamp(this.x + rand(-90, 90), 60, world.W - 60);
      this.nextDrift = t + rand(6, 14);
    }
    const dx = this.holdX - this.x;
    this.x += clamp(dx, -12, 12) * dt;
    if (Math.abs(dx) > 8) this.dir = dx > 0 ? 1 : -1;
    this.y += Math.sin(t * 0.85 + this.seed) * 7 * dt;
    this.y = clamp(this.y, 100, world.floorY(this.x) - 26);
  }
  draw(ctx) {
    const L = this.len;
    const t = world.time;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);
    ctx.rotate(Math.sin(t * 0.85 + this.seed) * 0.08);
    ctx.lineCap = 'round';
    // aleta dorsal que revolotea
    const flut = Math.sin(t * 16 + this.seed);
    ctx.fillStyle = 'rgba(240, 196, 110, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.26, 0, L * 0.12, L * 0.24, flut * 0.3, 0, TAU);
    ctx.fill();
    // cuerpo en S: cabeza arriba, cola en espiral abajo
    ctx.strokeStyle = '#e0aa4a';
    ctx.lineWidth = L * 0.24;
    ctx.beginPath();
    ctx.moveTo(L * 0.3, -L * 0.42);                       // nuca
    ctx.quadraticCurveTo(-L * 0.18, -L * 0.28, -L * 0.08, 0);   // pecho
    ctx.quadraticCurveTo(L * 0.02, L * 0.3, -L * 0.12, L * 0.42); // vientre
    ctx.stroke();
    // cola en espiral
    ctx.lineWidth = L * 0.12;
    ctx.beginPath();
    ctx.arc(-L * 0.16, L * 0.44, L * 0.13, -0.6, Math.PI * 1.5);
    ctx.stroke();
    ctx.lineWidth = L * 0.07;
    ctx.beginPath();
    ctx.arc(-L * 0.14, L * 0.42, L * 0.06, 0.5, Math.PI * 1.8);
    ctx.stroke();
    // hocico de trompeta
    ctx.lineWidth = L * 0.1;
    ctx.beginPath();
    ctx.moveTo(L * 0.3, -L * 0.42);
    ctx.lineTo(L * 0.52, -L * 0.36);
    ctx.stroke();
    // corona
    ctx.lineWidth = L * 0.08;
    ctx.beginPath();
    ctx.moveTo(L * 0.24, -L * 0.52);
    ctx.lineTo(L * 0.3, -L * 0.62);
    ctx.stroke();
    // crestas del cuerpo
    ctx.fillStyle = 'rgba(150, 100, 30, 0.55)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-L * 0.06 + Math.sin(i * 1.8) * L * 0.08, -L * 0.2 + i * L * 0.16, 1.2, 0, TAU);
      ctx.fill();
    }
    // ojo
    ctx.fillStyle = '#241505';
    ctx.beginPath(); ctx.arc(L * 0.26, -L * 0.4, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y - this.len * 0.4 }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.len * 0.75; }
}

/* pez globo: de pez a problema geométrico en un segundo */
class PezGlobo {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    const a = rand(TAU);
    this.vel = { x: Math.cos(a) * 24, y: Math.sin(a) * 8 };
    this.seed = rand(100);
    this.len = rand(28, 36);
    this.inflate = 0;
  }
  update(dt) {
    const f = { x: 0, y: 0 };
    const n = norm(-this.vel.y, this.vel.x);
    const wob = Math.sin(world.time * 0.55 + this.seed * 3);
    f.x += n.x * wob * 1.2; f.y += n.y * wob * 1.2;
    f.y += -this.vel.y * 0.03;
    // sustos: el cursor o un tiburón cerca
    const m = world.mouse;
    let scared = m.active && dist(m.x, m.y, this.x, this.y) < 90;
    if (!scared) {
      for (const c of world.creatures) {
        if ((c.key === 'blanco' || c.key === 'martillo' || c.key === 'puntasblancas') &&
            dist(c.x, c.y, this.x, this.y) < 140) { scared = true; break; }
      }
    }
    this.inflate = clamp(this.inflate + (scared ? 4 : -0.7) * dt, 0, 1);
    if (this.leaving) {
      f.x += this.exitX > this.x ? 6 : -6;
      if (this.x < -80 || this.x > world.W + 80) { this.dead = true; return; }
    } else {
      wallForce(this.x, this.y, f, 80, 100);
    }
    const v = norm(this.vel.x + f.x * dt * 40, this.vel.y + f.y * dt * 40);
    const spd = lerp(this.leaving ? 40 : 24, 7, this.inflate);
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 70, world.floorY(this.x) - 24);
  }
  draw(ctx) {
    const L = this.len;
    const k = this.inflate;
    const r = L * (0.34 + 0.34 * k);
    const dir = this.vel.x >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    // cola (se esconde al inflarse)
    const flap = Math.sin(world.time * 9 + this.seed * 5);
    ctx.fillStyle = '#b9a25e';
    ctx.globalAlpha = 1 - k * 0.7;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.lineTo(-r * 1.5, flap * 4 - L * 0.16);
    ctx.lineTo(-r * 1.5, flap * 4 + L * 0.16);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // púas
    if (k > 0.2) {
      ctx.strokeStyle = `rgba(120, 100, 50, ${(k - 0.2) * 1.1})`;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx * (1 + 0.22 * k), sy * (1 + 0.22 * k));
        ctx.stroke();
      }
    }
    // cuerpo
    const g1 = ctx.createLinearGradient(0, -r, 0, r);
    g1.addColorStop(0, '#c9b573');
    g1.addColorStop(1, '#f2ead0');
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.06, r, 0, 0, TAU);
    ctx.fillStyle = g1;
    ctx.fill();
    // motas
    ctx.fillStyle = 'rgba(140, 116, 58, 0.5)';
    for (let i = 0; i < 6; i++) {
      const a = i * 1.7 + this.seed;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.4 - r * 0.15, r * 0.09, 0, TAU);
      ctx.fill();
    }
    // ojos grandes (más grandes cuanto más asustado)
    const er = L * (0.09 + k * 0.05);
    ctx.fillStyle = '#f8fbff';
    ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.28, er, 0, TAU); ctx.fill();
    ctx.fillStyle = '#191007';
    ctx.beginPath(); ctx.arc(r * 0.54, -r * 0.28, er * 0.55, 0, TAU); ctx.fill();
    // boquita
    ctx.strokeStyle = 'rgba(90, 70, 30, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(r * 0.92, r * 0.06, L * 0.07, -0.7, 0.7);
    ctx.stroke();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.len * (0.4 + this.inflate * 0.35) + 8; }
}

/* tortuga verde: 110 millones de años de no tener prisa */
class Tortuga {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y ?? rand(world.H * 0.3, world.H * 0.6);
    this.dir = pick([-1, 1]);
    this.seed = rand(100);
    this.vel = { x: this.dir, y: 0 };
  }
  update(dt) {
    if (this.leaving) {
      this.dir = this.exitX > this.x ? 1 : -1;
      if (this.x < -170 || this.x > world.W + 170) { this.dead = true; return; }
    } else if ((this.x < 120 && this.dir < 0) || (this.x > world.W - 120 && this.dir > 0)) {
      this.dir *= -1;
    }
    this.x += this.dir * 20 * dt;
    this.y += Math.sin(world.time * 0.35 + this.seed) * 7 * dt;
    this.y = clamp(this.y, 95, world.floorY(this.x) - 60);
    this.vel.x = this.dir;
  }
  draw(ctx) {
    const t = world.time;
    const stroke = Math.sin(t * 1.7 + this.seed);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);
    ctx.rotate(Math.sin(t * 0.35 + this.seed) * 0.06);
    // aleta trasera
    ctx.fillStyle = '#5c8a5e';
    ctx.beginPath();
    ctx.ellipse(-30, 8, 11, 5, -0.5 + stroke * 0.15, 0, TAU);
    ctx.fill();
    // aleta delantera (remada amplia)
    ctx.save();
    ctx.translate(10, 6);
    ctx.rotate(0.5 + stroke * 0.5);
    ctx.fillStyle = '#67976a';
    ctx.beginPath();
    ctx.ellipse(0, 14, 7, 17, 0.15, 0, TAU);
    ctx.fill();
    ctx.restore();
    // caparazón
    const g1 = ctx.createLinearGradient(0, -22, 0, 14);
    g1.addColorStop(0, '#4f7d54');
    g1.addColorStop(1, '#3a5c44');
    ctx.beginPath();
    ctx.ellipse(0, -4, 34, 19, 0, 0, TAU);
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.strokeStyle = '#2c4736';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // placas
    ctx.strokeStyle = 'rgba(32, 54, 40, 0.55)';
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 14, -5, 7, 9, 0, 0, TAU);
      ctx.stroke();
    }
    // vientre
    ctx.fillStyle = '#d9d2ae';
    ctx.beginPath();
    ctx.ellipse(2, 12, 26, 6, 0, 0, Math.PI);
    ctx.fill();
    // cabeza y cuello
    ctx.fillStyle = '#6d9c72';
    ctx.beginPath();
    ctx.ellipse(38, -6, 11, 8, -0.15, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(30, -4, 8, 6, 0, 0, TAU);
    ctx.fill();
    // ojo y boca
    ctx.fillStyle = '#1b2416';
    ctx.beginPath(); ctx.arc(42, -8, 1.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(27, 36, 22, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(46, -4); ctx.lineTo(41, -2); ctx.stroke();
    ctx.restore();
  }
  head() { return { x: this.x + this.dir * 38, y: this.y - 6 }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 44; }
}

/* pez copa (ficticio): bebe burbujas y flota con dignidad */
class PezCopa {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.vel = { x: rand(-14, 14), y: 0 };
    this.seed = rand(100);
    this.len = rand(22, 28);
    this.fill = rand(0.1, 0.4);
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.8);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 0.9;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    const f = { x: 0, y: 0 };
    f.x += Math.sin(world.time * 0.5 + this.seed) * 1.4;
    // busca la burbuja más cercana y se la bebe
    let best = null, bd = 180, bi = -1;
    for (let i = 0; i < world.bubbles.length; i++) {
      const b = world.bubbles[i];
      const d = dist(this.x, this.y, b.x, b.y);
      if (d < bd) { bd = d; best = b; bi = i; }
    }
    if (best) {
      const to = norm(best.x - this.x, best.y - this.y);
      f.x += to.x * 5; f.y += to.y * 5;
      if (bd < 10) {
        world.bubbles.splice(bi, 1);
        this.fill = Math.min(1, this.fill + 0.16);
      }
    }
    // la gaseosa interior lo hace flotar
    f.y += -this.fill * 4.2;
    this.fill = Math.max(0, this.fill - dt * 0.03);
    wallForce(this.x, this.y, f, 70, 90);
    const v = norm(this.vel.x + f.x * dt * 40, this.vel.y + f.y * dt * 40);
    const spd = 20 + this.fill * 8;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 74, world.floorY(this.x) - 18);
  }
  draw(ctx) {
    // un pez de cristal: silueta de pez, cuerpo translúcido,
    // y la gaseosa que ha bebido visible en la barriga
    const L = this.len;
    const t = world.time;
    const dir = this.vel.x >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    ctx.rotate(Math.atan2(this.vel.y, Math.abs(this.vel.x)) * 0.4);
    const flap = Math.sin(t * 8 + this.seed * 3);
    // cola de vidrio
    ctx.fillStyle = 'rgba(215, 240, 250, 0.4)';
    ctx.strokeStyle = 'rgba(240, 250, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-L * 0.42, 0);
    ctx.lineTo(-L * 0.72, flap * L * 0.18 - L * 0.2);
    ctx.lineTo(-L * 0.72, flap * L * 0.18 + L * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // aleta dorsal de cristal
    ctx.fillStyle = 'rgba(220, 242, 252, 0.4)';
    ctx.beginPath();
    ctx.moveTo(-L * 0.08, -L * 0.28);
    ctx.quadraticCurveTo(L * 0.02, -L * 0.52, L * 0.2, -L * 0.28);
    ctx.closePath();
    ctx.fill();
    // cuerpo rechoncho translúcido
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.48, L * 0.33, 0, 0, TAU);
    ctx.fillStyle = 'rgba(210, 238, 250, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(238, 250, 255, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // la gaseosa interior sube de nivel según lo bebido
    if (this.fill > 0.03) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, L * 0.48, L * 0.33, 0, 0, TAU);
      ctx.clip();
      const lvl = lerp(L * 0.3, -L * 0.24, this.fill);
      ctx.fillStyle = 'rgba(255, 205, 110, 0.5)';
      ctx.fillRect(-L * 0.5, lvl, L, L);
      ctx.fillStyle = 'rgba(255, 246, 225, 0.75)';
      for (let i = 0; i < 5; i++) {
        const bx = Math.sin(i * 2.1 + this.seed) * L * 0.3;
        const span = L * 0.3 - lvl + 6;
        const by = L * 0.3 - ((t * 12 + i * 13) % Math.max(6, span));
        if (by > lvl) { ctx.beginPath(); ctx.arc(bx, by, 0.9, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    }
    // brillo del vidrio
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(-L * 0.08, -L * 0.08, L * 0.26, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    // ojo
    ctx.fillStyle = '#12303e';
    ctx.beginPath(); ctx.arc(L * 0.28, -L * 0.07, 1.8, 0, TAU); ctx.fill();
    // boquita, siempre lista para el siguiente sorbo
    ctx.strokeStyle = 'rgba(130, 170, 190, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(L * 0.47, 0, L * 0.05, -0.8, 0.8);
    ctx.stroke();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.len * 0.7; }
}

/* medusa sifón (ficticia): gas con ambición de globo */
class MedusaSifon {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.r = rand(13, 20);
    this.seed = rand(100);
    this.pulse = rand(TAU);
    this.fade = 1;
  }
  update(dt) {
    this.fade = this.fade ?? 1;
    if (this.leaving) {
      this.fade -= dt * 0.9;
      if (this.fade <= 0) { this.dead = true; return; }
    } else if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt * 0.5);
    }
    this.pulse += dt * 2.3;
    const s = Math.sin(this.pulse);
    this.y -= (10 + 26 * Math.max(0, s)) * dt;
    this.x += Math.sin(world.time * 0.7 + this.seed) * 9 * dt;
    // estela de gas
    if (Math.random() < dt * 5) {
      world.bubbles.push(makeBubble(this.x + rand(-6, 6), this.y + this.r, rand(0.8, 1.8)));
    }
    // arriba revienta: burbujas y a empezar de nuevo
    if (this.y < 84) {
      for (let i = 0; i < 8; i++) {
        world.bubbles.push(makeBubble(this.x + rand(-10, 10), this.y + rand(-6, 6), rand(1.5, 3.5)));
      }
      this.y = world.floorY(this.x) - 50;
      this.x = rand(60, world.W - 60);
      this.fade = 0;
    }
    this.x = clamp(this.x, 30, world.W - 30);
    this.alpha = this.fade * clamp((this.y - 74) / 50, 0, 1);
  }
  draw(ctx) {
    const s = Math.sin(this.pulse);
    const rw = this.r * (1 + 0.18 * s), rh = this.r * (0.75 - 0.16 * s);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';
    // campana de gas
    const gr = ctx.createRadialGradient(0, -rh * 0.2, 0, 0, 0, rw);
    gr.addColorStop(0, 'rgba(200, 250, 255, 0.4)');
    gr.addColorStop(0.75, 'rgba(160, 230, 250, 0.16)');
    gr.addColorStop(1, 'rgba(160, 230, 250, 0)');
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, Math.PI, 0);
    ctx.quadraticCurveTo(rw * 0.5, rh * 0.5, 0, rh * 0.42);
    ctx.quadraticCurveTo(-rw * 0.5, rh * 0.5, -rw, 0);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 250, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // burbujas atrapadas dentro
    ctx.fillStyle = 'rgba(240, 252, 255, 0.5)';
    for (let i = 0; i < 3; i++) {
      const a = i * 2.2 + this.seed;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rw * 0.35, -rh * 0.25 + Math.sin(a + world.time) * rh * 0.2, 1.4, 0, TAU);
      ctx.fill();
    }
    // colita de sifón
    ctx.strokeStyle = 'rgba(190, 240, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, rh * 0.42);
    ctx.quadraticCurveTo(Math.sin(world.time * 1.6 + this.seed) * 6, rh + this.r * 0.9, 0, rh + this.r * 1.4);
    ctx.stroke();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.r + 9; }
}

/* anguila sacacorchos (ficticia): nada en hélice */
function sacacorchosBehavior(fish, f) {
  f.y += Math.sin(world.time * 2.6 + fish.seed) * 2.4; // la hélice
}

function drawSacacorchos(fish, ctx, g) {
  eelDorsalRibbon(fish, ctx, g, 'rgba(244, 216, 180, 0.5)');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#c9a183', '#f2e2c8');
  ctx.fill();
  // franja en espiral: gira a lo largo del cuerpo
  ctx.fillStyle = 'rgba(150, 96, 60, 0.55)';
  for (let i = 1; i < g.P.length - 1; i++) {
    const roll = Math.sin(i * 0.9 - world.time * 4 + fish.seed);
    ctx.beginPath();
    ctx.arc(
      g.P[i].x + g.N[i].x * fish.widths[i] * 0.55 * roll,
      g.P[i].y + g.N[i].y * fish.widths[i] * 0.55 * roll,
      fish.widths[i] * 0.3, 0, TAU);
    ctx.fill();
  }
  eelFace(fish, ctx, g, '#5c3a20');
}

/* ============================================================
   EL ABISMO — especies (aquí solo existe lo que brilla)
   ============================================================ */

/* rape abisal: lo que el faroluz ve en sus pesadillas */
class Rape {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    const a = rand(TAU);
    this.vel = { x: Math.cos(a) * 16, y: Math.sin(a) * 6 };
    this.seed = rand(100);
    this.len = rand(40, 50);
  }
  update(dt) {
    const f = { x: 0, y: 0 };
    const n = norm(-this.vel.y, this.vel.x);
    const wob = Math.sin(world.time * 0.4 + this.seed * 3);
    f.x += n.x * wob * 1.1; f.y += n.y * wob * 1.1;
    f.y += -this.vel.y * 0.03;
    // ronda la mitad baja del agua
    const target = world.H * 0.62;
    f.y += clamp((target - this.y) * 0.006, -0.8, 0.8);
    // come lo que caiga
    let best = null, bd = 220;
    for (const p of world.food) {
      if (p.type === 'luz') continue;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const to = norm(best.x - this.x, best.y - this.y);
      f.x += to.x * 6; f.y += to.y * 6;
      if (bd < 12) best.eaten = true;
    }
    if (this.leaving) {
      f.x += this.exitX > this.x ? 6 : -6;
      if (this.x < -80 || this.x > world.W + 80) { this.dead = true; return; }
    } else {
      wallForce(this.x, this.y, f, 80, 110);
    }
    const v = norm(this.vel.x + f.x * dt * 40, this.vel.y + f.y * dt * 40);
    const spd = this.leaving ? 38 : 17;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 80, world.floorY(this.x) - 18);
  }
  draw(ctx) {
    const L = this.len;
    const t = world.time;
    const dir = this.vel.x >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    // señuelo: luz verdosa de bacterias
    const bx = L * 0.5, by = -L * 0.5;
    const flick = 0.7 + 0.3 * Math.sin(t * 7 + this.seed * 9);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(bx, by, 0, bx, by, 20 * flick);
    gl.addColorStop(0, `rgba(190, 255, 216, ${0.9 * flick})`);
    gl.addColorStop(0.4, `rgba(130, 240, 190, ${0.3 * flick})`);
    gl.addColorStop(1, 'rgba(130, 240, 190, 0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(bx, by, 20 * flick, 0, TAU); ctx.fill();
    ctx.restore();
    // caña
    ctx.strokeStyle = '#3a2634';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(L * 0.14, -L * 0.24);
    ctx.quadraticCurveTo(L * 0.2, -L * 0.66, bx, by);
    ctx.stroke();
    ctx.fillStyle = '#d8ffe8';
    ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, TAU); ctx.fill();
    // cola
    const flap = Math.sin(t * 6 + this.seed * 5);
    ctx.fillStyle = '#241a25';
    ctx.beginPath();
    ctx.moveTo(-L * 0.36, 0);
    ctx.lineTo(-L * 0.64, flap * L * 0.16 - L * 0.18);
    ctx.lineTo(-L * 0.64, flap * L * 0.16 + L * 0.18);
    ctx.closePath(); ctx.fill();
    // cuerpo: globo malhumorado
    const g1 = ctx.createLinearGradient(0, -L * 0.36, 0, L * 0.36);
    g1.addColorStop(0, '#33222f');
    g1.addColorStop(1, '#1d141d');
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.5, L * 0.38, 0, 0, TAU);
    ctx.fillStyle = g1;
    ctx.fill();
    // bocaza con colmillos
    const gape = 0.5 + 0.2 * Math.sin(t * 1.3 + this.seed);
    ctx.fillStyle = '#0c070c';
    ctx.beginPath();
    ctx.moveTo(L * 0.48, -L * 0.04);
    ctx.quadraticCurveTo(L * 0.2, L * 0.1 * gape + L * 0.08, L * 0.44, L * 0.26 * gape);
    ctx.quadraticCurveTo(L * 0.52, L * 0.12, L * 0.48, -L * 0.04);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8f4f0';
    for (let i = 0; i < 4; i++) {
      const tx = L * (0.44 - i * 0.07);
      ctx.beginPath();
      ctx.moveTo(tx, -L * 0.02 + i * L * 0.008);
      ctx.lineTo(tx - 1.4, L * 0.09);
      ctx.lineTo(tx - 2.8, -L * 0.02 + i * L * 0.008);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - 1, L * 0.24 * gape);
      ctx.lineTo(tx - 2.4, L * 0.1);
      ctx.lineTo(tx - 3.8, L * 0.24 * gape);
      ctx.closePath(); ctx.fill();
    }
    // ojito diminuto y desproporcionado
    ctx.fillStyle = '#cfe8dd';
    ctx.beginPath(); ctx.arc(L * 0.22, -L * 0.16, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath(); ctx.arc(L * 0.23, -L * 0.16, 1, 0, TAU); ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.len * 0.6; }
}

/* calamar vampiro: paraguas rojizo que se abraza a sí mismo */
class Vampiro {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.seed = rand(100);
    this.r = rand(17, 23);
    this.scared = 0;
    this.driftX = rand(-5, 5);
    this.vel = { x: 0, y: 0 };
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.7);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 0.8;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    const t = world.time;
    const m = world.mouse;
    const threatened = m.active && dist(m.x, m.y, this.x, this.y) < 85;
    this.scared = clamp(this.scared + (threatened ? 3 : -0.9) * dt, 0, 1);
    this.x += (this.driftX + Math.sin(t * 0.3 + this.seed) * 7) * dt;
    this.y += Math.sin(t * 0.5 + this.seed * 2) * 9 * dt - 2.5 * dt * (1 - this.scared);
    this.x = clamp(this.x, 40, world.W - 40);
    this.y = clamp(this.y, 100, world.floorY(this.x) - 40);
  }
  draw(ctx) {
    const R = this.r;
    const t = world.time;
    const k = this.scared; // 0 = paraguas abierto · 1 = envuelto en su capa
    ctx.save();
    ctx.translate(this.x, this.y);
    // orejas (aletas)
    ctx.fillStyle = '#5a2c36';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * R * 0.7, -R * 0.75, R * 0.32, R * 0.16, s * (0.5 + Math.sin(t * 2 + this.seed) * 0.2), 0, TAU);
      ctx.fill();
    }
    // manto
    const g1 = ctx.createLinearGradient(0, -R, 0, R);
    g1.addColorStop(0, '#6b3440');
    g1.addColorStop(1, '#41202b');
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.3, R * 0.85, R * 0.85, 0, Math.PI, 0);
    ctx.quadraticCurveTo(R * 0.85, R * 0.2, R * 0.7, R * 0.3);
    ctx.lineTo(-R * 0.7, R * 0.3);
    ctx.quadraticCurveTo(-R * 0.85, R * 0.2, -R * 0.85, -R * 0.3);
    ctx.closePath();
    ctx.fillStyle = g1;
    ctx.fill();
    // capa de brazos con membrana: se voltea al asustarse
    const flip = 1 - 2 * k; // 1 abajo → -1 cubriéndose
    ctx.fillStyle = k > 0.5 ? '#31161f' : '#4a2530';
    ctx.beginPath();
    ctx.moveTo(-R * 0.7, R * 0.28);
    for (let i = 0; i <= 6; i++) {
      const ax = lerp(-R * 0.7, R * 0.7, i / 6);
      const sway = Math.sin(t * 2.2 + this.seed + i) * 2;
      const tipY = R * 0.28 + (R * (0.75 + 0.15 * Math.sin(i * 2)) * flip) + sway * flip;
      const midX = ax - R * 0.1;
      if (i > 0) ctx.quadraticCurveTo(midX, tipY, ax, R * 0.28 + R * 0.4 * flip * 0.4);
      else ctx.lineTo(ax, R * 0.28);
    }
    ctx.closePath();
    ctx.fill();
    // ojazos azules (los más grandes del reino animal, en proporción)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      const gl = ctx.createRadialGradient(s * R * 0.34, -R * 0.28, 0, s * R * 0.34, -R * 0.28, R * 0.26);
      gl.addColorStop(0, 'rgba(140, 220, 255, 0.9)');
      gl.addColorStop(1, 'rgba(140, 220, 255, 0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(s * R * 0.34, -R * 0.28, R * 0.26, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#0a1420';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(s * R * 0.34, -R * 0.28, R * 0.1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y - this.r * 0.4 }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.r + 10; }
}

/* pez hacha: plata con cara de preocupación permanente */
class Hacha {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.vel = { x: rand(-16, 16), y: 0 };
    this.seed = rand(100);
    this.len = rand(16, 21);
    this.nextDart = 0;
  }
  update(dt) {
    const t = world.time;
    const f = { x: 0, y: 0 };
    f.x += Math.sin(t * 0.45 + this.seed) * 1.3;
    f.y += Math.sin(t * 0.3 + this.seed * 2) * 0.7;
    if (t > this.nextDart) {
      // pequeño respingo nervioso
      this.vel.x += rand(-30, 30);
      this.vel.y += rand(-16, 16);
      this.nextDart = t + rand(3, 8);
    }
    if (this.leaving) {
      f.x += this.exitX > this.x ? 6 : -6;
      if (this.x < -60 || this.x > world.W + 60) { this.dead = true; return; }
    } else {
      wallForce(this.x, this.y, f, 70, 100);
    }
    const v = norm(this.vel.x + f.x * dt * 40, this.vel.y + f.y * dt * 40);
    const spd = this.leaving ? 40 : 16;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 80, world.floorY(this.x) - 30);
  }
  draw(ctx) {
    const L = this.len;
    const dir = this.vel.x >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    // colita fina
    const flap = Math.sin(world.time * 10 + this.seed * 4);
    ctx.strokeStyle = '#9fb4be';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-L * 0.4, 0);
    ctx.lineTo(-L * 0.75, flap * L * 0.14);
    ctx.stroke();
    // cuerpo de hacha: alto y comprimido
    const g1 = ctx.createLinearGradient(0, -L * 0.5, 0, L * 0.5);
    g1.addColorStop(0, '#c4d6de');
    g1.addColorStop(0.6, '#eef6fa');
    g1.addColorStop(1, '#8fa6b2');
    ctx.beginPath();
    ctx.moveTo(L * 0.45, -L * 0.1);
    ctx.quadraticCurveTo(L * 0.2, -L * 0.55, -L * 0.15, -L * 0.3);
    ctx.quadraticCurveTo(-L * 0.42, -L * 0.05, -L * 0.35, L * 0.15);
    ctx.quadraticCurveTo(-L * 0.1, L * 0.52, L * 0.25, L * 0.35);
    ctx.quadraticCurveTo(L * 0.48, L * 0.1, L * 0.45, -L * 0.1);
    ctx.closePath();
    ctx.fillStyle = g1;
    ctx.fill();
    // fotóforos ventrales
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(150, 230, 255, 0.85)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-L * 0.25 + i * L * 0.13, L * 0.34 - Math.abs(i - 2) * L * 0.03, 1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // ojo tubular mirando hacia arriba
    ctx.fillStyle = '#f4fbff';
    ctx.beginPath(); ctx.arc(L * 0.18, -L * 0.18, L * 0.13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a1018';
    ctx.beginPath(); ctx.arc(L * 0.18, -L * 0.26, L * 0.06, 0, TAU); ctx.fill();
    // boca de preocupación
    ctx.strokeStyle = 'rgba(70, 90, 100, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(L * 0.42, L * 0.08, L * 0.06, Math.PI * 1.2, Math.PI * 1.9); ctx.stroke();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.len * 0.7; }
}

/* pez constelación (ficticio): el hueco donde estuvo un pez, señalado con estrellas */
class Constelacion {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.vel = { x: rand(-10, 10), y: 0 };
    this.seed = rand(100);
    // su propia constelación, fija de por vida
    this.pts = [];
    const n = 6 + Math.floor(rand(4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.4, 0.4);
      this.pts.push({
        x: Math.cos(a) * rand(14, 34),
        y: Math.sin(a) * rand(8, 18),
        r: rand(1, 2.2),
        ph: rand(TAU),
      });
    }
    this.flash = 0;
    this.nextFlash = world.time + rand(4, 10);
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.6);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 0.7;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    const t = world.time;
    const f = { x: 0, y: 0 };
    f.x += Math.sin(t * 0.3 + this.seed) * 1;
    f.y += Math.sin(t * 0.22 + this.seed * 2) * 0.6;
    wallForce(this.x, this.y, f, 80, 110);
    const v = norm(this.vel.x + f.x * dt * 30, this.vel.y + f.y * dt * 30);
    const spd = 11;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 90, world.floorY(this.x) - 40);
    if (t > this.nextFlash) {
      this.flash = 1;
      this.nextFlash = t + rand(6, 13);
    }
    this.flash = Math.max(0, this.flash - dt * 0.5);
  }
  draw(ctx) {
    const t = world.time;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';
    // al parpadear, une sus propios puntos
    if (this.flash > 0.02) {
      ctx.strokeStyle = `rgba(180, 220, 255, ${0.35 * this.flash})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(this.pts[0].x, this.pts[0].y);
      for (let i = 1; i < this.pts.length; i++) ctx.lineTo(this.pts[i].x, this.pts[i].y);
      ctx.closePath();
      ctx.stroke();
    }
    for (const p of this.pts) {
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.1 + p.ph));
      const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      gl.addColorStop(0, `rgba(235, 245, 255, ${0.9 * tw})`);
      gl.addColorStop(0.4, `rgba(160, 210, 255, ${0.3 * tw})`);
      gl.addColorStop(1, 'rgba(160, 210, 255, 0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 38; }
}

/* anguila pelícano: una boca con anguila detrás */
function drawPelicano(fish, ctx, g) {
  const { P, T } = g;
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#221826', '#141019');
  ctx.fill();
  // fotóforo rojo en la punta de la cola
  const tail = P[P.length - 1];
  const pulse = 0.6 + 0.4 * Math.sin(world.time * 3 + fish.seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(tail.x, tail.y, 0, tail.x, tail.y, 9 * pulse);
  gl.addColorStop(0, `rgba(255, 120, 110, ${0.85 * pulse})`);
  gl.addColorStop(1, 'rgba(255, 120, 110, 0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(tail.x, tail.y, 9 * pulse, 0, TAU); ctx.fill();
  ctx.restore();
  // la bocaza: bolsa de pelícano bajo la cabeza
  const U = fish.up(g, 1);
  const D = { x: -U.x, y: -U.y };
  const gape = 0.55 + 0.35 * Math.sin(world.time * 0.9 + fish.seed);
  const tip = { x: P[0].x + T[0].x * fish.widths[0] * 2.2, y: P[0].y + T[0].y * fish.widths[0] * 2.2 };
  const back = P[3];
  ctx.fillStyle = 'rgba(16, 10, 18, 0.95)';
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo(
    (tip.x + back.x) / 2 + D.x * fish.maxW * 5 * gape,
    (tip.y + back.y) / 2 + D.y * fish.maxW * 5 * gape,
    back.x + D.x * fish.widths[3], back.y + D.y * fish.widths[3]);
  ctx.lineTo(P[1].x + D.x * fish.widths[1] * 0.4, P[1].y + D.y * fish.widths[1] * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 60, 80, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // ojito perdido en tanta boca
  ctx.fillStyle = '#b8d4e0';
  ctx.beginPath(); ctx.arc(P[0].x + U.x * fish.widths[0] * 0.3, P[0].y + U.y * fish.widths[0] * 0.3, 1.4, 0, TAU); ctx.fill();
}

/* tiburón linterna: contrailuminación de bolsillo */
function drawLinterna(fish, ctx, g) {
  sharkFins(fish, ctx, g, '#221c1c');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#2b2422', '#453a35');
  ctx.fill();
  // fotóforos ventrales: borra su silueta desde abajo
  const { P, R } = g;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i < P.length - 2; i++) {
    const tw = 0.5 + 0.5 * Math.sin(world.time * 2.4 + i * 0.8 + fish.seed);
    ctx.fillStyle = `rgba(120, 220, 255, ${0.55 * tw})`;
    ctx.beginPath();
    ctx.arc(R[i].x, R[i].y, 1.1, 0, TAU);
    ctx.fill();
  }
  // halo ventral suave
  const h = fish.head();
  const gl = ctx.createRadialGradient(h.x, h.y + fish.maxW, 0, h.x, h.y + fish.maxW, fish.len * 0.5);
  gl.addColorStop(0, 'rgba(100, 200, 255, 0.08)');
  gl.addColorStop(1, 'rgba(100, 200, 255, 0)');
  ctx.fillStyle = gl;
  ctx.fillRect(h.x - fish.len, h.y - fish.len * 0.4, fish.len * 2, fish.len);
  ctx.restore();
  sharkFace(fish, ctx, g, { teeth: false, eye: '#0f2418' });
  // ojo verde brillante
  const U = fish.up(g, 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(140, 255, 190, 0.8)';
  ctx.beginPath();
  ctx.arc(g.P[1].x + U.x * fish.widths[1] * 0.32, g.P[1].y + U.y * fish.widths[1] * 0.32, fish.maxW * 0.14, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* tiburón carbón (ficticio): más oscuro que el agua que lo rodea */
function drawCarbon(fish, ctx, g) {
  sharkFins(fish, ctx, g, 'rgba(0, 2, 4, 0.95)');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = 'rgba(0, 2, 4, 0.96)';
  ctx.fill();
  // un borde apenas insinuado, para saber que está
  ctx.strokeStyle = 'rgba(97, 228, 255, 0.09)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // el ojo: una brasa lejana
  const U = fish.up(g, 1);
  const ember = 0.5 + 0.3 * Math.sin(world.time * 1.1 + fish.seed);
  ctx.fillStyle = `rgba(255, 90, 60, ${ember})`;
  ctx.beginPath();
  ctx.arc(g.P[1].x + U.x * fish.widths[1] * 0.3, g.P[1].y + U.y * fish.widths[1] * 0.3, 1.6, 0, TAU);
  ctx.fill();
}

/* ============================================================
   EL NAUFRAGIO — especies (el barco de 1912)
   ============================================================ */

/* congrio: el primo serio de la morena, custodio del casco */
function drawCongrio(fish, ctx, g) {
  eelDorsalRibbon(fish, ctx, g, 'rgba(140, 160, 165, 0.45)');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#4e6068', '#aebcc0');
  ctx.fill();
  eelFace(fish, ctx, g, '#c8d8dc');
}

/* mero guasa: del tamaño de una nevera, con cara de ir a decirte algo */
class Mero {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.dir = pick([-1, 1]);
    this.seed = rand(100);
    this.vel = { x: this.dir, y: 0 };
    this.homeX = (world.wreck ? world.wreck.cx : world.W * 0.5);
  }
  update(dt) {
    const t = world.time;
    if (this.leaving) {
      this.dir = this.exitX > this.x ? 1 : -1;
      this.x += this.dir * 34 * dt;
      if (this.x < -140 || this.x > world.W + 140) { this.dead = true; return; }
    } else {
      // patrulla lenta alrededor de SU barco
      const target = this.homeX + Math.sin(t * 0.11 + this.seed) * 190;
      const dx = target - this.x;
      if (Math.abs(dx) > 10) this.dir = dx > 0 ? 1 : -1;
      this.x += clamp(dx, -9, 9) * dt;
    }
    this.y = world.floorY(this.x) - 84 + Math.sin(t * 0.5 + this.seed) * 9;
    this.vel.x = this.dir;
  }
  draw(ctx) {
    const t = world.time;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.dir, 1);
    // cola redondeada
    const flap = Math.sin(t * 2.6 + this.seed);
    ctx.fillStyle = '#4e4232';
    ctx.beginPath();
    ctx.moveTo(-38, 0);
    ctx.quadraticCurveTo(-54, flap * 5 - 16, -58, flap * 6);
    ctx.quadraticCurveTo(-54, flap * 5 + 16, -38, 0);
    ctx.closePath();
    ctx.fill();
    // aletas redondas
    ctx.fillStyle = '#57493a';
    ctx.beginPath();
    ctx.ellipse(-6, -26, 15, 8, -0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2, 22, 10, 6, 0.5 + Math.sin(t * 1.8 + this.seed) * 0.2, 0, TAU);
    ctx.fill();
    // cuerpo enorme
    const g1 = ctx.createLinearGradient(0, -26, 0, 26);
    g1.addColorStop(0, '#6b5a46');
    g1.addColorStop(1, '#8f7c60');
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 27, 0, 0, TAU);
    ctx.fillStyle = g1;
    ctx.fill();
    // moteado
    ctx.fillStyle = 'rgba(58, 46, 32, 0.45)';
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4 + this.seed;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 30, Math.sin(a * 1.3) * 16, 3.4, 0, TAU);
      ctx.fill();
    }
    // bocaza con labios: siempre a punto de hablar
    const gape = 0.3 + 0.18 * Math.sin(t * 0.7 + this.seed);
    ctx.fillStyle = '#3a2e22';
    ctx.beginPath();
    ctx.ellipse(40, 6, 7, 9 * gape + 3, -0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#2c2318';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(40, 2, 8, 0.5, Math.PI - 0.4);
    ctx.stroke();
    // ojo pequeño para tanto cuerpo
    ctx.fillStyle = '#f0e8d8';
    ctx.beginPath(); ctx.arc(28, -12, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#191007';
    ctx.beginPath(); ctx.arc(29, -12, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x + this.dir * 34, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 52; }
}

/* jurel: orbita el mástil en el tornado de siempre */
class Jurel {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.ang = rand(TAU);
    this.rad = rand(58, 132);
    this.spd = rand(0.45, 0.75);
    this.yoff = rand(-34, 66);
    this.seed = rand(100);
    this.len = rand(15, 19);
    this.vel = { x: 0, y: 0 };
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.8);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.x += (this.exitX > this.x ? 64 : -64) * dt;
      if (this.x < -80 || this.x > world.W + 80) this.dead = true;
      return;
    }
    const m = world.wreck ? world.wreck.mast : { x: world.W * 0.4, y: world.H * 0.4 };
    this.ang += this.spd * dt;
    const cx = m.x + 10, cy = m.y + 96 + this.yoff;
    const tx = cx + Math.cos(this.ang) * this.rad;
    const ty = cy + Math.sin(this.ang) * this.rad * 0.3;
    this.vel.x = (tx - this.x) * 4;
    this.vel.y = (ty - this.y) * 4;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
  }
  draw(ctx) {
    const L = this.len;
    const depth = Math.sin(this.ang); // −1 detrás · 1 delante
    const s = 1 + depth * 0.16;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha *= 0.7 + 0.3 * (depth * 0.5 + 0.5);
    ctx.rotate(Math.atan2(this.vel.y, this.vel.x));
    ctx.scale(s, s);
    const flap = Math.sin(world.time * 12 + this.seed * 7);
    ctx.beginPath();
    ctx.moveTo(-L * 0.4, 0);
    ctx.lineTo(-L * 0.78, flap * L * 0.24 - L * 0.2);
    ctx.lineTo(-L * 0.78, flap * L * 0.24 + L * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#d8c25a'; // cola amarilla de jurel
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.5, L * 0.2, 0, 0, TAU);
    ctx.fillStyle = '#c2ced6';
    ctx.fill();
    // línea lateral oscura
    ctx.strokeStyle = 'rgba(60, 75, 85, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-L * 0.38, -L * 0.02);
    ctx.quadraticCurveTo(0, L * 0.06, L * 0.42, -L * 0.02);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(L * 0.3, -L * 0.03, 1.4, 0, TAU);
    ctx.fillStyle = '#0a1018'; ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 15; }
}

/* pulpo dumbo: el abismo también tiene ternura */
class Dumbo {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.seed = rand(100);
    this.r = rand(13, 17);
    this.vel = { x: rand(-8, 8), y: 0 };
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.7);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 0.8;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    const t = world.time;
    const f = { x: 0, y: 0 };
    f.x += Math.sin(t * 0.3 + this.seed) * 1.1;
    f.y += Math.sin(t * 0.4 + this.seed * 2) * 0.9;
    wallForce(this.x, this.y, f, 80, 110);
    const v = norm(this.vel.x + f.x * dt * 30, this.vel.y + f.y * dt * 30);
    const spd = 12;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 100, world.floorY(this.x) - 30);
  }
  draw(ctx) {
    const R = this.r;
    const t = world.time;
    ctx.save();
    ctx.translate(this.x, this.y);
    // orejas aleteando: su forma de nadar
    const flapL = Math.sin(t * 3.1 + this.seed);
    const flapR = Math.sin(t * 3.1 + this.seed + 0.6);
    ctx.fillStyle = '#c98fa4';
    ctx.beginPath();
    ctx.ellipse(-R * 0.75, -R * 0.55, R * 0.42, R * 0.2, -0.7 + flapL * 0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * 0.75, -R * 0.55, R * 0.42, R * 0.2, 0.7 - flapR * 0.4, 0, TAU);
    ctx.fill();
    // manto redondito
    const g1 = ctx.createLinearGradient(0, -R, 0, R);
    g1.addColorStop(0, '#dfa8ba');
    g1.addColorStop(1, '#b57d92');
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.1, R * 0.9, R * 0.85, 0, 0, TAU);
    ctx.fillStyle = g1;
    ctx.fill();
    // faldita de brazos con membrana
    ctx.fillStyle = '#a86e84';
    ctx.beginPath();
    ctx.moveTo(-R * 0.8, R * 0.3);
    for (let i = 0; i <= 5; i++) {
      const ax = lerp(-R * 0.8, R * 0.8, i / 5);
      const sway = Math.sin(t * 2 + this.seed + i * 1.2) * 2;
      ctx.quadraticCurveTo(ax - R * 0.12, R * 0.85 + sway, ax, R * 0.55);
    }
    ctx.closePath();
    ctx.fill();
    // ojazos amables
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fbf4f6';
      ctx.beginPath(); ctx.arc(s * R * 0.34, -R * 0.15, R * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#241820';
      ctx.beginPath(); ctx.arc(s * R * 0.34, -R * 0.12, R * 0.1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y - this.r * 0.4 }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < this.r + 10; }
}

/* el Vigía (ficticio): subió a la cofa en 1912; el turno sigue */
class Vigia {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    const m = world.wreck ? world.wreck.mast : { x: x, y: y };
    this.x = m.x; this.y = m.y - 8;
    this.seed = rand(100);
    this.blink = 0;
    this.nextBlink = world.time + rand(3, 7);
    this.vel = { x: 0, y: 0 };
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.6);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 0.7;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    if (world.wreck) { this.x = world.wreck.mast.x; this.y = world.wreck.mast.y - 8; }
    if (world.time > this.nextBlink) {
      this.blink = 1;
      this.nextBlink = world.time + rand(3, 8);
    }
    this.blink = Math.max(0, this.blink - dt * 5);
  }
  draw(ctx) {
    const t = world.time;
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(t * 0.9 + this.seed) * 1.2);
    // cuerpecillo asomado de la cofa
    ctx.fillStyle = '#3c4a44';
    ctx.beginPath();
    ctx.ellipse(0, 4, 11, 9, 0, Math.PI, 0);
    ctx.fill();
    // EL ojo
    const er = 8;
    const blinkK = 1 - Math.min(1, this.blink * 1.6); // 1 abierto → 0 cerrado
    ctx.fillStyle = '#e8f2ea';
    ctx.beginPath();
    ctx.ellipse(0, -2, er, er * Math.max(0.08, blinkK), 0, 0, TAU);
    ctx.fill();
    if (blinkK > 0.25) {
      // el iris sigue al visitante, siempre
      const m = world.mouse;
      const d = norm((m.active ? m.x : this.x + 40) - this.x, (m.active ? m.y : this.y) - this.y);
      const px = d.x * 3.2, py = d.y * 2.2 * blinkK;
      ctx.fillStyle = '#5c8a72';
      ctx.beginPath(); ctx.arc(px, -2 + py, 4 * blinkK + 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#101a14';
      ctx.beginPath(); ctx.arc(px, -2 + py, 2 * blinkK + 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(px - 1, -3.4, 0.9, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#2c3a32';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, -2, er, er * Math.max(0.08, blinkK), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y - 4 }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 20; }
}

/* pez moneda (ficticio): el tesoro aprendió a nadar */
class Moneda {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    const ch = world.wreck ? world.wreck.chest : { x: world.W * 0.7, y: world.floorY(world.W * 0.7) - 10 };
    this.homeX = ch.x; this.homeY = ch.y - 14;
    this.x = this.homeX + rand(-40, 40);
    this.y = this.homeY - rand(10, 60);
    const a = rand(TAU);
    this.vel = { x: Math.cos(a) * 22, y: Math.sin(a) * 10 };
    this.seed = rand(100);
    this.hide = 0;
    this.shine = 0; // el flash de la cámara las delata: son oro
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.9);
      if (this.alpha >= 1) this.entering = false;
    }
    const m = world.mouse;
    const scared = m.active && dist(m.x, m.y, this.x, this.y) < 90;
    this.hide = clamp(this.hide + ((scared || this.leaving) ? 2.6 : -0.7) * dt, 0, 1);
    if (!this.entering && !this.leaving) this.alpha = 1 - this.hide * 0.92;
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 1.2;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    const f = { x: 0, y: 0 };
    const n = norm(-this.vel.y, this.vel.x);
    f.x += n.x * Math.sin(world.time * 1.6 + this.seed * 3) * 1.4;
    f.y += n.y * Math.sin(world.time * 1.6 + this.seed * 3) * 1.4;
    // el instinto de una moneda es volver al cofre
    const k = 3 + this.hide * 14;
    const dx = this.homeX - this.x, dy = this.homeY - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 46 - this.hide * 40) { f.x += (dx / d) * k; f.y += (dy / d) * k; }
    const v = norm(this.vel.x + f.x * dt * 50, this.vel.y + f.y * dt * 50);
    const spd = 26 + this.hide * 30;
    this.vel.x = v.x * spd; this.vel.y = v.y * spd;
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
    this.y = clamp(this.y, 90, world.floorY(this.x) - 6);
    this.shine = Math.max(0, this.shine - dt * 0.9);
    // destello ocasional
    if (Math.random() < dt * (0.5 + this.shine * 6) && this.hide < 0.4) {
      world.sparks.push({
        x: this.x, y: this.y, vx: rand(-4, 4), vy: rand(-6, 2),
        life: rand(0.3, 0.7), age: 0, hue: 46,
      });
    }
  }
  draw(ctx) {
    const t = world.time;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.shine > 0.02) {
      const gs = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
      gs.addColorStop(0, `rgba(255, 232, 150, ${0.55 * this.shine})`);
      gs.addColorStop(1, 'rgba(255, 232, 150, 0)');
      ctx.fillStyle = gs;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    }
    // colita
    const flap = Math.sin(t * 11 + this.seed * 5);
    const dir = this.vel.x >= 0 ? 1 : -1;
    ctx.fillStyle = '#b8923a';
    ctx.beginPath();
    ctx.moveTo(-dir * 4.5, 0);
    ctx.lineTo(-dir * 8.5, flap * 2 - 2.6);
    ctx.lineTo(-dir * 8.5, flap * 2 + 2.6);
    ctx.closePath();
    ctx.fill();
    // el disco
    const g1 = ctx.createLinearGradient(-5, -5, 5, 5);
    g1.addColorStop(0, '#f2d270');
    g1.addColorStop(1, '#a8842a');
    ctx.beginPath();
    ctx.arc(0, 0, 5.4, 0, TAU);
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.strokeStyle = '#7c5e1c';
    ctx.lineWidth = 1;
    ctx.stroke();
    // acuñado: un pececito grabado
    ctx.strokeStyle = 'rgba(124, 94, 28, 0.8)';
    ctx.beginPath(); ctx.arc(0, 0, 3.4, 0.5, 2.4); ctx.stroke();
    // reflejo que gira
    const sw = (t * 1.4 + this.seed) % TAU;
    ctx.strokeStyle = 'rgba(255, 240, 190, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 4.4, sw, sw + 0.9);
    ctx.stroke();
    // ojito
    ctx.fillStyle = '#3c2c0c';
    ctx.beginPath(); ctx.arc(dir * 2.2, -1, 0.9, 0, TAU); ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 10; }
}

/* medusa de bronce (ficticia): la campana del barco sigue de guardia */
class MedusaBronce {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.seed = rand(100);
    this.pulse = rand(TAU);
    this.ring = 0;
    this.vel = { x: 0, y: 0 };
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.7);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 0.8;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    const t = world.time;
    this.pulse += dt * 1.1;
    const s = Math.sin(this.pulse);
    this.y -= (2 + 7 * Math.max(0, s)) * dt;
    this.x += Math.sin(t * 0.34 + this.seed) * 7 * dt;
    // deriva cerca del barco, sin alejarse de su puesto
    const hx = world.wreck ? world.wreck.cx : world.W * 0.5;
    this.x += clamp(hx - this.x, -14, 14) * dt * 0.06;
    if (this.y < 110) this.y = world.floorY(this.x) - 70;
    this.ring = Math.max(0, this.ring - dt * 0.55);
  }
  draw(ctx) {
    const t = world.time;
    const s = Math.sin(this.pulse);
    const R = 15;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.ring > 0) ctx.rotate(Math.sin(t * 26) * 0.08 * this.ring);
    // la onda de la campanada
    if (this.ring > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(230, 200, 130, ${0.4 * this.ring})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 4, (1 - this.ring) * 130 + 14, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    // tentáculos finos
    ctx.strokeStyle = 'rgba(160, 140, 90, 0.5)';
    ctx.lineWidth = 1.1;
    for (let i = -1; i <= 1; i++) {
      const sway = Math.sin(t * 1.4 + this.seed + i) * 7;
      ctx.beginPath();
      ctx.moveTo(i * R * 0.4, R * 0.75);
      ctx.quadraticCurveTo(i * R * 0.4 + sway * 0.5, R * 1.6, i * R * 0.4 + sway, R * 2.3);
      ctx.stroke();
    }
    // campana de bronce (con hombros y boca acampanada)
    const g1 = ctx.createLinearGradient(-R, -R, R, R * 0.8);
    g1.addColorStop(0, '#b08b46');
    g1.addColorStop(0.55, '#7c5f2e');
    g1.addColorStop(1, '#54401e');
    ctx.beginPath();
    ctx.moveTo(0, -R * (1 + 0.08 * s));
    ctx.quadraticCurveTo(R * 0.85, -R * 0.75, R * 0.62, R * 0.3);
    ctx.quadraticCurveTo(R * 0.62, R * 0.6, R * 0.95, R * 0.78);
    ctx.lineTo(-R * 0.95, R * 0.78);
    ctx.quadraticCurveTo(-R * 0.62, R * 0.6, -R * 0.62, R * 0.3);
    ctx.quadraticCurveTo(-R * 0.85, -R * 0.75, 0, -R * (1 + 0.08 * s));
    ctx.closePath();
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 45, 20, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // verdín
    ctx.fillStyle = 'rgba(96, 150, 118, 0.35)';
    ctx.beginPath();
    ctx.ellipse(-R * 0.3, -R * 0.2, R * 0.28, R * 0.4, 0.5, 0, TAU);
    ctx.fill();
    // el badajo, que también es su ojo
    const swing = Math.sin(t * (this.ring > 0 ? 14 : 1.6) + this.seed) * (3 + this.ring * 5);
    ctx.strokeStyle = '#4c3a1c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, R * 0.2);
    ctx.lineTo(swing, R * 0.95);
    ctx.stroke();
    ctx.fillStyle = '#e8d8a8';
    ctx.beginPath(); ctx.arc(swing, R * 0.98, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#241c08';
    ctx.beginPath(); ctx.arc(swing, R * 0.98, 1.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 22; }
}

/* ============================================================
   EL JARDÍN IMPOSIBLE — especies (el final, todo inventado)
   ============================================================ */

/* posición en mundo de una flor-coral del jardín */
function flowerPos(fl) {
  const x = fl.fx * world.W;
  return { x, y: world.floorY(x) - fl.h * (0.2 + 0.8 * fl.bloom) };
}

/* pez semilla: nada hasta que encuentra un sitio que le gusta, y se planta */
class PezSemilla {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.vel = { x: pick([-1, 1]) * rand(20, 30), y: 0 };
    this.seed = rand(100);
    this.plantAt = world.time + rand(26, 55);
    this.fase = 'nada'; // nada → baja → siembra
    this.entierro = 0;
  }
  update(dt) {
    const t = world.time;
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.9);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.vel.x = this.exitX > this.x ? 46 : -46;
      this.x += this.vel.x * dt;
      if (this.x < -60 || this.x > world.W + 60) this.dead = true;
      return;
    }
    if (this.fase === 'nada') {
      // deriva con vaivén de semilla que aún no pesa
      this.vel.y = Math.sin(t * 1.3 + this.seed) * 14;
      this.x += this.vel.x * dt;
      this.y += this.vel.y * dt;
      if (this.x < 60 || this.x > world.W - 60) this.vel.x *= -1;
      this.y = clamp(this.y, 90, world.floorY(this.x) - 30);
      const hermanos = world.creatures.filter(c => c.key === 'semilla' && !c.dead && !c.leaving).length;
      if (t > this.plantAt && !this.entering &&
          save.biome === 'imposible' && world.garden.length < 9 && hermanos > 1) {
        this.fase = 'baja';
        this.tx = clamp(this.x + rand(-40, 40), world.W * 0.08, world.W * 0.92);
      }
    } else if (this.fase === 'baja') {
      this.x += clamp(this.tx - this.x, -18, 18) * dt;
      this.y += 22 * dt;
      this.vel.x = clamp(this.tx - this.x, -18, 18);
      this.vel.y = 22;
      if (this.y >= world.floorY(this.x) - 10) this.fase = 'siembra';
    } else {
      // enterrarse: cada vez menos pez, cada vez más jardín
      this.entierro = Math.min(1, this.entierro + dt * 0.8);
      this.y = world.floorY(this.x) - 10 + this.entierro * 9;
      this.alpha = 1 - this.entierro * 0.65;
      if (this.entierro >= 1) {
        world.garden.push({
          fx: this.x / world.W, h: rand(52, 86), bloom: 0,
          hue: rand(300, 350), phase: rand(TAU),
          seedAt: world.time + rand(35, 70),
        });
        for (let i = 0; i < 8; i++) {
          world.sparks.push({
            x: this.x, y: this.y, vx: rand(-14, 14), vy: rand(-18, -4),
            life: rand(0.5, 1.1), age: 0, hue: rand(305, 345),
          });
        }
        this.dead = true;
      }
    }
  }
  draw(ctx) {
    const t = world.time;
    const dir = this.vel.x >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.fase !== 'nada') ctx.rotate(dir * lerp(0, Math.PI / 2, Math.min(1, this.entierro + (this.fase === 'baja' ? 0.3 : 0))));
    // cuerpo: una pipa con planes
    const g1 = ctx.createLinearGradient(0, -6, 0, 6);
    g1.addColorStop(0, '#d8b06a');
    g1.addColorStop(1, '#8a6432');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.moveTo(dir * 7, 0);
    ctx.quadraticCurveTo(dir * 2, -5.5, -dir * 6, -1.5);
    ctx.quadraticCurveTo(-dir * 8, 0, -dir * 6, 1.5);
    ctx.quadraticCurveTo(dir * 2, 5.5, dir * 7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 48, 20, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // el brote dorsal: dos hojitas que ya no disimulan
    const sway = Math.sin(t * 2.2 + this.seed) * 0.25;
    ctx.fillStyle = 'rgba(150, 214, 160, 0.9)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(-dir * 1 + s * 2.4, -6.5, 2.2, 4, sway + s * 0.65, 0, TAU);
      ctx.fill();
    }
    // ojito decidido
    ctx.fillStyle = '#2c1e08';
    ctx.beginPath(); ctx.arc(dir * 4, -1, 1, 0, TAU); ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 12; }
}

/* anguila raíz: medio enterrada, conecta las flores por debajo */
function raizBehavior(fish, f) {
  // vivir pegada a la arena
  const target = world.floorY(fish.x) - 22;
  f.y += clamp((target - fish.y) * 0.035, -1.1, 1.1);
  fish.speedMul = 0.5;
  // tender hacia la flor más lejana de otra: alguien tiene que conectarlas
  let best = null, bd = 1e9;
  for (const fl of world.garden) {
    const p = flowerPos(fl);
    const d = Math.abs(p.x - fish.x);
    if (d > 70 && d < bd) { bd = d; best = p; }
  }
  if (best) f.x += Math.sign(best.x - fish.x) * 0.6;
}

function drawRaiz(fish, ctx, g) {
  const { P } = g;
  // raicillas que tantean la arena
  ctx.strokeStyle = 'rgba(120, 88, 96, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (let i = 4; i < P.length - 3; i += 4) {
    const U = fish.up(g, i);
    const w = fish.widths[i];
    const sway = Math.sin(world.time * 0.8 + i * 1.7) * 2;
    ctx.beginPath();
    ctx.moveTo(P[i].x - U.x * w * 0.7, P[i].y - U.y * w * 0.7);
    ctx.quadraticCurveTo(P[i].x - U.x * (w + 4), P[i].y - U.y * (w + 4) + 3,
                         P[i].x - U.x * (w + 8) + sway, P[i].y - U.y * (w + 8) + 7);
    ctx.stroke();
  }
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#54404c', '#a8889c');
  ctx.fill();
  // nudos de madera a lo largo del lomo
  ctx.fillStyle = 'rgba(52, 36, 44, 0.55)';
  for (let i = 5; i < P.length - 4; i += 6) {
    ctx.beginPath();
    ctx.arc(P[i].x, P[i].y, Math.max(1, fish.widths[i] * 0.3), 0, TAU);
    ctx.fill();
  }
  // un brote en la frente: la raíz también quiere su flor
  const U0 = fish.up(g, 1);
  const bx = P[1].x + U0.x * (fish.widths[1] + 2);
  const by = P[1].y + U0.y * (fish.widths[1] + 2);
  ctx.fillStyle = 'rgba(238, 172, 210, 0.9)';
  ctx.beginPath();
  ctx.ellipse(bx, by, 2.2, 3.6, Math.atan2(U0.x, -U0.y), 0, TAU);
  ctx.fill();
  eelFace(fish, ctx, g, '#ead8e4');
}

/* tiburón flor: aletas de pétalo que muda al nadar */
function florBehavior(fish, f, dt) {
  // pasea sobre el jardín, nunca demasiado bajo
  const min = world.H * 0.62;
  if (fish.y > min) f.y -= (fish.y - min) * 0.02;
  // muda pétalos; el agua se los queda
  if (Math.random() < dt * 1.6) {
    const i = Math.floor(rand(3, fish.spine.length - 2));
    const p = fish.spine[i];
    world.sparks.push({
      x: p.x, y: p.y, vx: rand(-6, 6), vy: rand(3, 12),
      life: rand(1.4, 2.8), age: 0, hue: rand(310, 345),
    });
  }
}

function drawFlor(fish, ctx, g) {
  const { P } = g;
  sharkFins(fish, ctx, g, 'rgba(238, 160, 198, 0.85)');
  fish.bodyPath(ctx, g);
  ctx.fillStyle = fish.bodyGradient(ctx, '#b46088', '#f2cade');
  ctx.fill();
  // la corola dorsal: pétalos donde otros llevan aleta
  const di = 5;
  const U = fish.up(g, di);
  const cx = P[di].x + U.x * fish.widths[di] * 0.9;
  const cy = P[di].y + U.y * fish.widths[di] * 0.9;
  const base = Math.atan2(U.y, U.x);
  for (let k = -2; k <= 2; k++) {
    const a = base + k * 0.42 + Math.sin(world.time * 1.1 + fish.seed + k) * 0.06;
    ctx.fillStyle = `hsla(${325 + k * 8}, 70%, ${74 - Math.abs(k) * 6}%, 0.9)`;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * fish.maxW * 0.9, cy + Math.sin(a) * fish.maxW * 0.9,
                fish.maxW * 0.7, fish.maxW * 0.3, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe8a0';
  ctx.beginPath(); ctx.arc(cx, cy, fish.maxW * 0.22, 0, TAU); ctx.fill();
  sharkFace(fish, ctx, g, { eye: '#3a1e30', gill: 'rgba(120, 50, 90, 0.4)', mouth: 'rgba(90, 30, 60, 0.6)' });
}

/* pez colibrí: liba las flores-coral sin posarse jamás */
class PezColibri {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = y;
    this.vel = { x: 0, y: 0 };
    this.seed = rand(100);
    this.tx = x; this.ty = y;
    this.nextMove = 0;
    this.sip = 0; // 1 = está libando
  }
  retarget() {
    this.nextMove = world.time + rand(2.5, 6);
    const flores = world.garden.filter(f => f.bloom > 0.7);
    if (flores.length && Math.random() < 0.75) {
      const p = flowerPos(pick(flores));
      this.tx = p.x + rand(-6, 6);
      this.ty = p.y - rand(14, 22);
    } else {
      this.tx = rand(world.W * 0.15, world.W * 0.85);
      this.ty = rand(world.H * 0.3, world.H * 0.65);
    }
  }
  update(dt) {
    const t = world.time;
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.9);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.tx = this.exitX; this.ty = this.y;
      this.alpha = (this.alpha ?? 1) - dt * 0.6;
      if (this.alpha <= 0) { this.dead = true; return; }
    } else if (t > this.nextMove) this.retarget();
    // dardo hacia el objetivo, y quedarse clavado en el sitio
    const dx = this.tx - this.x, dy = this.ty - this.y;
    this.vel.x = lerp(this.vel.x, dx * 3.2, dt * 4);
    this.vel.y = lerp(this.vel.y, dy * 3.2, dt * 4);
    this.x += this.vel.x * dt + Math.sin(t * 9 + this.seed) * 12 * dt;
    this.y += this.vel.y * dt + Math.cos(t * 8 + this.seed * 2) * 10 * dt;
    this.y = clamp(this.y, 80, world.floorY(this.x) - 16);
    const cerca = Math.hypot(dx, dy) < 26;
    this.sip = clamp(this.sip + (cerca ? 1.4 : -2) * dt, 0, 1);
    // polen al libar
    if (this.sip > 0.6 && Math.random() < dt * 4) {
      world.sparks.push({
        x: this.x, y: this.y + 8, vx: rand(-8, 8), vy: rand(-2, 6),
        life: rand(0.4, 0.9), age: 0, hue: 48,
      });
    }
  }
  draw(ctx) {
    const t = world.time;
    const dir = (this.tx - this.x) >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(this.x, this.y);
    // alas-aleta: un borrón de tanto batir
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = '#cfe8f0';
    for (const ph of [0, 2.1, 4.2]) {
      const a = Math.sin(t * 26 + ph) * 0.9;
      ctx.beginPath();
      ctx.ellipse(-dir * 1, -3, 8, 2.6, a * 0.6 - dir * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha /= 0.55;
    // cuerpo tornasolado
    const g1 = ctx.createLinearGradient(0, -5, 0, 6);
    g1.addColorStop(0, '#5ad0a8');
    g1.addColorStop(0.6, '#3a9a90');
    g1.addColorStop(1, '#e478a8');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 5, 0, 0, TAU);
    ctx.fill();
    // cola timón
    const flap = Math.sin(t * 12 + this.seed) * 2;
    ctx.fillStyle = 'rgba(90, 208, 168, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-dir * 6, 0);
    ctx.lineTo(-dir * 13, flap - 4);
    ctx.lineTo(-dir * 13, flap + 4);
    ctx.closePath();
    ctx.fill();
    // pico-hocico para libar
    ctx.strokeStyle = '#e8d090';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    const tilt = this.sip * 0.5;
    ctx.beginPath();
    ctx.moveTo(dir * 6, -1);
    ctx.lineTo(dir * 15, -1 + tilt * 6);
    ctx.stroke();
    // ojo
    ctx.fillStyle = '#10241c';
    ctx.beginPath(); ctx.arc(dir * 3.4, -1.6, 1.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return dist(mx, my, this.x, this.y) < 14; }
}

/* medusa diente de león: tócala y se deshace en vilanos; luego se rearma */
class MedusaDiente {
  constructor(key, sp, x, y) {
    this.key = key; this.sp = sp;
    this.x = x; this.y = Math.min(y, world.H * 0.6);
    this.seed = rand(100);
    this.scatter = 0; // 1 = deshecha en vilanos
    this.vel = { x: 0, y: 0 };
    this.fil = [];
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.1, 0.1);
      this.fil.push({ a, len: rand(14, 20), dx: rand(-70, 70), dy: rand(-70, 30), spin: rand(-2, 2) });
    }
  }
  puff() {
    if (this.scatter > 0.15) return;
    this.scatter = 1;
    for (let i = 0; i < 14; i++) {
      world.sparks.push({
        x: this.x, y: this.y, vx: rand(-30, 30), vy: rand(-34, 6),
        life: rand(0.8, 1.8), age: 0, hue: rand(40, 70),
      });
    }
  }
  update(dt) {
    if (this.entering) {
      this.alpha = Math.min(1, (this.alpha ?? 0) + dt * 0.7);
      if (this.alpha >= 1) this.entering = false;
    }
    if (this.leaving) {
      this.alpha = (this.alpha ?? 1) - dt * 0.7;
      if (this.alpha <= 0) { this.dead = true; return; }
    }
    const t = world.time;
    this.scatter = Math.max(0, this.scatter - dt * 0.3);
    // deriva de semilla que no tiene prisa por caer
    this.x += Math.sin(t * 0.3 + this.seed) * 9 * dt;
    this.y += Math.sin(t * 0.45 + this.seed * 2) * 7 * dt - 1.5 * dt;
    if (this.y < 100) this.y = 100;
    if (this.y > world.floorY(this.x) - 60) this.y = world.floorY(this.x) - 60;
    if (this.x < 50) this.x = 50;
    if (this.x > world.W - 50) this.x = world.W - 50;
  }
  draw(ctx) {
    const t = world.time;
    const s = this.scatter;
    const ease = s * s * (3 - 2 * s); // los vilanos salen y vuelven con calma
    ctx.save();
    ctx.translate(this.x, this.y);
    // núcleo: se queda esperando a que todos vuelvan
    ctx.fillStyle = `rgba(238, 228, 190, ${0.85 - ease * 0.5})`;
    ctx.beginPath(); ctx.arc(0, 0, 4.4 - ease * 1.5, 0, TAU); ctx.fill();
    // vilanos
    for (const f of this.fil) {
      const a = f.a + Math.sin(t * 0.8 + f.a * 3 + this.seed) * 0.05 + ease * f.spin;
      const bx = Math.cos(a) * f.len + f.dx * ease;
      const by = Math.sin(a) * f.len + f.dy * ease;
      ctx.strokeStyle = `rgba(240, 234, 210, ${0.5 - ease * 0.25})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4 * (1 - ease), Math.sin(a) * 4 * (1 - ease));
      ctx.lineTo(bx, by);
      ctx.stroke();
      // el penacho
      ctx.fillStyle = `rgba(250, 246, 228, ${0.8 - ease * 0.3})`;
      ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, TAU); ctx.fill();
      for (let k = 0; k < 3; k++) {
        const pa = a + (k - 1) * 0.5;
        ctx.strokeStyle = `rgba(250, 246, 228, ${0.35 - ease * 0.15})`;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(pa) * 4, by + Math.sin(pa) * 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  head() { return { x: this.x, y: this.y }; }
  hit(mx, my) { return this.scatter < 0.3 && dist(mx, my, this.x, this.y) < 24; }
}

/* ============================================================
   REGISTRO DE ESPECIES
   ============================================================ */
const SPECIES = {
  /* ================= REALES ================= */
  blanco: {
    grupo: 'reales', nombre: 'Tiburón blanco', sci: 'Carcharodon carcharias',
    tipo: 'real', color: '#7ba7c7', bioma: 'arrecife',
    fact: 'Ah, el tiburón blanco. Seis metros de músculo y determinación al servicio de no atrapar jamás una sardina. Nos conmueve profundamente. Sigue intentándolo, campeón.',
    curioso: 'Detecta una gota de sangre en 100 litros de agua y percibe los campos eléctricos de sus presas con unos sensores llamados ampollas de Lorenzini. También puede saltar fuera del agua. Aquí ha decidido no hacerlo, de momento.',
    tam: '4–6 m', prof: '0–1200 m', dieta: 'Sardinas (en teoría)',
    max: 3, inicial: 1, kind: 'spine',
    len: [220, 280], girth: 0.085, segs: 15, wiggle: 0.09, wiggleSpeed: 4.0,
    speed: [42, 62], flatten: 0.06, maxTurn: 0.8, profile: sharkProfile, curious: true,
    behavior: huntBehavior, draw: drawBlanco,
  },
  martillo: {
    grupo: 'reales', nombre: 'Tiburón martillo', sci: 'Sphyrna mokarran',
    tipo: 'real', color: '#8fb8a8', bioma: 'arrecife',
    fact: 'Le pusimos los ojos lo más lejos posible el uno del otro, por probar. Ahora lo ve absolutamente todo y no se calla nada. No admitimos preguntas sobre el proceso.',
    curioso: 'Su cabeza en T (cefalofoil) le da visión de casi 360° y funciona como un detector de metales biológico: encuentra rayas enterradas en la arena siguiendo su campo eléctrico.',
    tam: '3–5 m', prof: '1–300 m', dieta: 'Rayas y peces',
    max: 3, inicial: 1, kind: 'spine',
    len: [190, 240], girth: 0.08, segs: 15, wiggle: 0.1, wiggleSpeed: 4.4,
    speed: [46, 66], flatten: 0.06, maxTurn: 0.9, profile: sharkProfile, curious: true,
    behavior: huntBehavior, draw: drawMartillo,
  },
  puntasblancas: {
    grupo: 'reales', nombre: 'Tiburón de puntas blancas', sci: 'Triaenodon obesus',
    tipo: 'real', color: '#9aab8e', bioma: 'arrecife',
    fact: 'El único tiburón de este acuario que entendió que no hace falta nadar sin parar para respirar. Se echa en el fondo y descansa. Los demás tiburones no se lo perdonan.',
    curioso: 'De verdad descansa: bombea agua por las branquias activamente, así que puede quedarse quieto en cuevas durante horas. Caza de noche, metiendo el hocico en grietas donde otros no caben.',
    tam: '1.5–2 m', prof: '8–40 m', dieta: 'Peces de grieta',
    max: 3, inicial: 1, kind: 'spine',
    len: [140, 175], girth: 0.075, segs: 15, wiggle: 0.1, wiggleSpeed: 4.2,
    speed: [30, 44], flatten: 0.05, maxTurn: 0.9, profile: sharkProfile, floorK: 0.08,
    behavior: restBehavior, draw: drawPuntasBlancas,
  },
  morena: {
    grupo: 'reales', nombre: 'Morena verde', sci: 'Gymnothorax funebris',
    tipo: 'real', color: '#93a85e', bioma: 'arrecife',
    fact: 'Parece verde. Es marrón con una mucosa amarilla encima. Lleva décadas sin corregir el malentendido porque le da exactamente igual. Respetable.',
    curioso: 'Tiene una segunda mandíbula dentro de la garganta (faríngea) que lanza hacia adelante para arrastrar presas. Sí, como en Alien. Abre y cierra la boca solo para respirar; lo amenazante es gratis.',
    tam: '1.8–2.5 m', prof: '1–50 m', dieta: 'Peces y pulpos',
    max: 3, inicial: 1, kind: 'spine',
    len: [170, 210], girth: 0.055, segs: 24, wiggle: 0.34, wiggleSpeed: 5.2,
    speed: [26, 38], flatten: 0.02, maxTurn: 1.0, profile: eelProfile,
    behavior: lurkBehavior, draw: drawMorena,
  },
  cinta: {
    grupo: 'reales', nombre: 'Anguila cinta azul', sci: 'Rhinomuraena quaesita',
    tipo: 'real', color: '#4a8cff', bioma: 'arrecife',
    fact: 'Empieza negra, se vuelve azul eléctrico, termina amarilla, y por el camino cambia de sexo. Un compromiso con la reinvención personal que ya quisieran tus artistas favoritos.',
    curioso: 'Es real, aunque no lo parezca: hermafrodita protándrica — todos los machos (azules) acaban convirtiéndose en hembras (amarillas). Los apéndices del hocico le sirven para detectar vibraciones.',
    tam: '65–130 cm', prof: '1–60 m', dieta: 'Peces pequeños',
    max: 3, inicial: 1, kind: 'spine',
    len: [130, 165], girth: 0.032, segs: 26, wiggle: 0.4, wiggleSpeed: 6.0,
    speed: [30, 42], flatten: 0.025, maxTurn: 1.1, profile: eelProfile,
    behavior: null, draw: drawCinta,
  },
  electrica: {
    grupo: 'reales', nombre: 'Anguila eléctrica', sci: 'Electrophorus electricus',
    tipo: 'real', color: '#d8b45a', bioma: 'arrecife',
    fact: 'En sentido estricto no es una anguila, ni falta que le hace: es un cuchillo eléctrico con opiniones. 860 voltios de opiniones. Haz clic sobre ella para conocerlas.',
    curioso: 'Es un pez cuchillo (Gymnotiformes), pariente de los peces que "ven" con electricidad. Usa pulsos débiles como radar y descargas fuertes para cazar. Y sí: puede saltar del agua para electrocutar amenazas. Está documentado.',
    tam: '2–2.5 m', prof: 'Ríos, 0–3 m', dieta: 'Peces aturdidos',
    max: 2, inicial: 1, kind: 'spine',
    len: [150, 190], girth: 0.06, segs: 22, wiggle: 0.3, wiggleSpeed: 4.8,
    speed: [28, 40], flatten: 0.025, maxTurn: 0.9, profile: eelProfile,
    behavior: bottomBehavior, draw: drawElectrica,
  },
  sardina: {
    grupo: 'reales', nombre: 'Sardina esmeralda', sci: 'Sardina pilchardus',
    tipo: 'real', color: '#3ddc84', bioma: 'arrecife',
    fact: 'Cuarenta sardinas nadando en formación para parecer un solo pez grande. No funciona. Nunca ha funcionado. Que lo sigan intentando con ese entusiasmo nos parece hermoso.',
    curioso: 'El banco no tiene líder: cada sardina reacciona solo a sus vecinas inmediatas, y de esas reglas simples emerge la coreografía entera. Los matemáticos siguen tomando notas.',
    tam: '15–25 cm', prof: '10–100 m', dieta: 'Plancton',
    max: 90, inicial: 40, paso: 10, kind: 'sardina', ctor: Sardina,
  },
  payaso: {
    grupo: 'reales', nombre: 'Pez payaso', sci: 'Amphiprion ocellaris',
    tipo: 'real', color: '#f47a2b', bioma: 'arrecife',
    fact: 'Vive dentro de un animal urticante y lo llama hogar. Así está el mercado inmobiliario del arrecife. Acércale el cursor y verás lo rápido que vuelve a su anémona.',
    curioso: 'Una capa de mucosa lo hace inmune al veneno de la anémona: él consigue refugio y ella, limpieza y defensa. Y como la cinta azul, cambia de sexo: el macho dominante se convierte en hembra si la hembra falta.',
    tam: '8–11 cm', prof: '1–15 m', dieta: 'Algas y plancton',
    max: 4, inicial: 2, kind: 'payaso', ctor: PezPayaso,
  },
  pulpo: {
    grupo: 'reales', nombre: 'Pulpo de arrecife', sci: 'Octopus cyanea',
    tipo: 'real', color: '#b5563f', bioma: 'arrecife',
    fact: 'Tres corazones, sangre azul, nueve cerebros, y aun así se esconde de ti. Saca tus propias conclusiones. Quédate quieta y quizá vuelva a su color de verdad.',
    curioso: 'Cambia de color y de textura en menos de un segundo usando células llamadas cromatóforos — y es daltónico, que es lo verdaderamente desconcertante. Dos tercios de sus neuronas están en los brazos: cada brazo piensa un poco por su cuenta.',
    tam: '80 cm (brazos incl.)', prof: '1–45 m', dieta: 'Cangrejos',
    max: 2, inicial: 1, kind: 'pulpo', ctor: Pulpo,
  },
  raya: {
    grupo: 'reales', nombre: 'Raya látigo', sci: 'Dasyatis pastinaca',
    tipo: 'real', color: '#8b9aa4', bioma: 'arrecife',
    fact: 'Vuela sin despegarse nunca del suelo. Elegancia estrictamente horizontal. El leviatán asegura que le copió el estilo; no lo confirmaremos ni lo desmentiremos.',
    curioso: 'Nada ondulando los bordes del disco como una bandera, y pasa el día enterrada en la arena con solo los ojos fuera. El aguijón de la cola es defensivo: jamás lo usa si no la pisan.',
    tam: '1–1.4 m de disco', prof: '5–60 m', dieta: 'Moluscos enterrados',
    max: 2, inicial: 1, kind: 'raya', ctor: Raya,
  },
  medusa: {
    grupo: 'reales', nombre: 'Medusa luna', sci: 'Aurelia aurita',
    tipo: 'real', color: '#c5a8ff', bioma: 'arrecife',
    fact: 'Flota desde antes de los dinosaurios sin cerebro, sin sangre y sin prisa. Ha sobrevivido a cinco extinciones masivas haciendo exactamente nada. Toma nota.',
    curioso: 'Su linaje lleva más de 500 millones de años en los océanos. Es 95% agua y digiere con el mismo orificio por el que come, detalle que preferimos no desarrollar.',
    tam: '25–40 cm', prof: '0–1000 m', dieta: 'Plancton',
    max: 8, inicial: 3, kind: 'medusa', ctor: Medusa,
  },
  estrella: {
    grupo: 'reales', nombre: 'Estrella de mar', sci: 'Asterias rubens',
    tipo: 'real', color: '#f59f3b', bioma: 'arrecife',
    fact: 'Sin cerebro, sin sangre, sin excusas. Le arrancas un brazo y fabrica otro. Tú te quejas de los lunes. No diremos más.',
    curioso: 'Para comer, saca el estómago fuera del cuerpo, envuelve a la presa y la digiere ahí mismo. Algunas especies regeneran un cuerpo entero a partir de un solo brazo.',
    tam: '10–30 cm', prof: '0–400 m', dieta: 'Moluscos',
    max: 5, inicial: 2, kind: 'estrella', ctor: Estrella,
  },
  ermitano: {
    grupo: 'reales', nombre: 'Cangrejo ermitaño', sci: 'Pagurus bernhardus',
    tipo: 'real', color: '#c9a878', bioma: 'arrecife',
    fact: 'Vive en conchas heredadas de moluscos que ya no las necesitaban. Economía circular con pinzas. Si te acercas mucho, cierra la puerta. Entendible.',
    curioso: 'Cuando una concha buena queda libre, los ermitaños hacen fila por tamaño y se intercambian las casas en cadena, todos a la vez. Se llama "cadena de vacantes" y los economistas lo estudian en serio.',
    tam: '3–10 cm', prof: '0–140 m', dieta: 'Restos (no pregunta)',
    max: 4, inicial: 2, kind: 'ermitano', ctor: Ermitano,
  },
  /* --- reales · mar burbujeante --- */
  jardin: {
    grupo: 'reales', nombre: 'Anguila jardín', sci: 'Heteroconger hassi',
    tipo: 'real', color: '#d6cfba', bioma: 'burbujeante',
    fact: 'Una colonia de signos de interrogación asomando de la arena. Se esconden si te acercas y vuelven a asomar cuando te vas. La timidez convertida en césped.',
    curioso: 'Son reales: viven en colonias de cientos, cada una en su madriguera de por vida, comiendo el plancton que pasa flotando. Se doblan con la corriente exactamente como la hierba con el viento.',
    tam: '35–40 cm', prof: '7–45 m', dieta: 'Plancton que pase',
    max: 10, inicial: 5, paso: 2, kind: 'jardin', ctor: AnguilaJardin,
  },
  caballito: {
    grupo: 'reales', nombre: 'Caballito de mar', sci: 'Hippocampus kuda',
    tipo: 'real', color: '#e0aa4a', bioma: 'burbujeante',
    fact: 'Cola prensil, papá gestante y cero prisa. El único pez que nada en vertical, presumiblemente porque le pareció más digno.',
    curioso: 'El macho incuba las crías en su bolsa ventral: el embarazo es suyo. Y nadan tan mal que figuran entre los peces más lentos del mundo — el caballito enano avanza metro y medio por hora.',
    tam: '15–30 cm', prof: '1–20 m', dieta: 'Copépodos',
    max: 4, inicial: 2, kind: 'caballito', ctor: Caballito,
  },
  globo: {
    grupo: 'reales', nombre: 'Pez globo', sci: 'Arothron hispidus',
    tipo: 'real', color: '#d9c47f', bioma: 'burbujeante',
    fact: 'Su plan de defensa es convertirse en un problema geométrico: de pez a esfera con pinchos en un segundo. Acércale el cursor y lo verás. Luego fingirá que no pasó nada.',
    curioso: 'Traga agua para triplicar su volumen. La tetrodotoxina de sus órganos es cientos de veces más letal que el cianuro, y aun así en Japón es un manjar (fugu) que solo pueden preparar cocineros con licencia.',
    tam: '30–50 cm', prof: '3–30 m', dieta: 'Moluscos y erizos',
    max: 3, inicial: 1, kind: 'globo', ctor: PezGlobo,
  },
  tortuga: {
    grupo: 'reales', nombre: 'Tortuga verde', sci: 'Chelonia mydas',
    tipo: 'real', color: '#5c8a5e', bioma: 'burbujeante',
    fact: 'Lleva 110 millones de años haciendo el mismo viaje con la misma calma. El leviatán la respeta. Nosotros también. Tú deberías.',
    curioso: 'Vuelve a poner huevos a la playa exacta donde nació, orientándose por el campo magnético de la Tierra. Dormida puede pasar horas sin subir a respirar.',
    tam: '1–1.5 m', prof: '0–40 m', dieta: 'Algas y medusas',
    max: 2, inicial: 1, kind: 'tortuga', ctor: Tortuga,
  },
  /* --- reales · abismo --- */
  rape: {
    grupo: 'reales', nombre: 'Rape abisal', sci: 'Melanocetus johnsonii',
    tipo: 'real', color: '#9fe8c4', bioma: 'abismo',
    fact: 'Es lo que el faroluz ve cuando tiene pesadillas. La naturaleza tuvo la misma idea que nosotros, pero sin el cariño.',
    curioso: 'Su señuelo brilla gracias a bacterias simbióticas. Y el macho es tan pequeño que vive fusionado a la hembra como un apéndice: literalmente se convierte en parte de ella. El abismo no perdona a los románticos.',
    tam: '18 cm (la hembra)', prof: '1000–4500 m', dieta: 'Lo que quepa',
    max: 3, inicial: 1, kind: 'rape', ctor: Rape,
  },
  pelicano: {
    grupo: 'reales', nombre: 'Anguila pelícano', sci: 'Eurypharynx pelecanoides',
    tipo: 'real', color: '#5a4468', bioma: 'abismo',
    fact: 'Una boca con anguila detrás. Traga cosas de su propio tamaño porque a esa profundidad nadie le ha dicho que no.',
    curioso: 'Su boca ocupa una cuarta parte del cuerpo y lleva un fotóforo rojo encendido en la punta de la cola — probablemente un cebo, aunque a saber. Se han filmado tan pocas que cada avistamiento es noticia.',
    tam: '75 cm', prof: '500–3000 m', dieta: 'Sorpresas',
    max: 3, inicial: 1, kind: 'spine',
    len: [160, 200], girth: 0.045, segs: 26, wiggle: 0.34, wiggleSpeed: 4.6,
    speed: [22, 32], flatten: 0.02, maxTurn: 1.0, profile: eelProfile,
    behavior: null, draw: drawPelicano,
  },
  linterna: {
    grupo: 'reales', nombre: 'Tiburón linterna', sci: 'Etmopterus spinax',
    tipo: 'real', color: '#78dcff', bioma: 'abismo',
    fact: 'Un tiburón de bolsillo que brilla por debajo. En la oscuridad total, ser invisible visto desde abajo es de listos. Los tiburones grandes toman nota; él no se la presta.',
    curioso: 'Se llama contrailuminación: sus fotóforos ventrales imitan la poca luz que baja de arriba, borrando su silueta para quien mire desde abajo. Su primo el tiburón linterna enano cabe en una mano.',
    tam: '45 cm', prof: '200–2500 m', dieta: 'Krill y calamares',
    max: 4, inicial: 2, kind: 'spine',
    len: [85, 115], girth: 0.08, segs: 14, wiggle: 0.1, wiggleSpeed: 4.6,
    speed: [30, 44], flatten: 0.05, maxTurn: 1.0, profile: sharkProfile,
    behavior: null, draw: drawLinterna,
  },
  vampiro: {
    grupo: 'reales', nombre: 'Calamar vampiro', sci: 'Vampyroteuthis infernalis',
    tipo: 'real', color: '#8c5464', bioma: 'abismo',
    fact: 'Ni calamar, ni vampiro, ni del infierno, a pesar del nombre científico. Cuando algo lo asusta se envuelve en su propia capa — que es exactamente lo que haríamos todos.',
    curioso: 'Vive donde casi no hay oxígeno y ni siquiera caza: come nieve marina, la lluvia de restos que baja del mundo de arriba. Sus ojos son de los más grandes del reino animal en proporción al cuerpo.',
    tam: '30 cm', prof: '600–900 m', dieta: 'Nieve marina',
    max: 3, inicial: 1, kind: 'vampiro', ctor: Vampiro,
  },
  hacha: {
    grupo: 'reales', nombre: 'Pez hacha', sci: 'Argyropelecus gigas',
    tipo: 'real', color: '#c4d6de', bioma: 'abismo',
    fact: 'Un hacha de plata con cara de preocupación permanente. Mira siempre hacia arriba, esperando algo que nunca termina de bajar.',
    curioso: 'Sus ojos tubulares apuntan al cielo para detectar siluetas a contraluz, y sus fotóforos ventrales lo borran para quien lo busque desde abajo. Todo el abismo juega al mismo juego de escondite vertical.',
    tam: '10 cm', prof: '200–1500 m', dieta: 'Plancton',
    max: 6, inicial: 3, kind: 'hacha', ctor: Hacha,
  },
  /* --- reales · naufragio --- */
  congrio: {
    grupo: 'reales', nombre: 'Congrio', sci: 'Conger conger',
    tipo: 'real', color: '#8ea4ac', bioma: 'naufragio',
    fact: 'La morena tiene un primo del norte: más gris, más serio, igual de poco partidario de salir de su tubería. Lleva un siglo custodiando la brecha del casco. Nadie se lo pidió. Precisamente por eso.',
    curioso: 'Los congrios reales pasan años en el mismo agujero de un pecio y superan los dos metros. De jóvenes son larvas transparentes (leptocéfalos) que cruzan el océano a la deriva antes de elegir su agujero para siempre.',
    tam: '2–2.7 m', prof: '0–500 m', dieta: 'Lo que pase por su puerta',
    max: 2, inicial: 1, kind: 'spine',
    len: [180, 220], girth: 0.055, segs: 24, wiggle: 0.32, wiggleSpeed: 5.0,
    speed: [24, 34], flatten: 0.02, maxTurn: 1.0, profile: eelProfile,
    behavior: lurkBehavior, draw: drawCongrio,
  },
  mero: {
    grupo: 'reales', nombre: 'Mero guasa', sci: 'Epinephelus itajara',
    tipo: 'real', color: '#8f7c60', bioma: 'naufragio',
    fact: 'Del tamaño de una nevera y con cara de estar a punto de decirte algo. Nunca lo dice. El barco es suyo; tú estás de visita, y lo sabes.',
    curioso: 'El mero guasa real supera los 2,5 metros y los 400 kilos, y retumba con la vejiga natatoria (¡BUM!) para marcar territorio. Estuvo a punto de extinguirse por exceso de confianza: no huía de nadie.',
    tam: '2–2.5 m', prof: '0–100 m', dieta: 'Crustáceos (enteros)',
    max: 2, inicial: 1, kind: 'mero', ctor: Mero,
  },
  jureles: {
    grupo: 'reales', nombre: 'Jurel de pecio', sci: 'Caranx sexfasciatus',
    tipo: 'real', color: '#c2ced6', bioma: 'naufragio',
    fact: 'Giran alrededor del mástil desde antes de que nadie recuerde. Quizá esperan órdenes. Quizá son las órdenes.',
    curioso: 'Los tornados de jureles alrededor de pecios son reales y llegan a miles de ejemplares. Nadie sabe del todo por qué orbitan estructuras hundidas; las teorías van de la protección al puro gusto.',
    tam: '60–85 cm', prof: '0–150 m', dieta: 'Peces menores',
    max: 24, inicial: 12, paso: 6, kind: 'jureles', ctor: Jurel,
  },
  dumbo: {
    grupo: 'reales', nombre: 'Pulpo dumbo', sci: 'Grimpoteuthis abyssicola',
    tipo: 'real', color: '#dfa8ba', bioma: 'naufragio',
    fact: 'Un pulpo con orejas que aletea en vez de nadar. El abismo también tiene ternura; le cuesta admitirlo, pero aquí está la prueba.',
    curioso: 'Grimpoteuthis es el pulpo más profundo conocido: se ha visto a 7.000 metros. Nada aleteando sus aletas auriculares — sí, exactamente como el elefante de la película, pero en versión que sí funciona.',
    tam: '20–30 cm', prof: '1000–7000 m', dieta: 'Gusanos y copépodos',
    max: 3, inicial: 1, kind: 'dumbo', ctor: Dumbo,
  },
  /* ================= FICTICIOS ================= */
  espectro: {
    grupo: 'ficticios', nombre: 'Tiburón espectro', sci: 'Carcharias phantasma',
    tipo: 'ficticio', color: '#9be8ff', bioma: 'arrecife',
    fact: 'No aparece cuando lo buscas. Aparece cuando te rindes. Es su única gracia y la administra con una crueldad admirable. Deja el cursor quieto un rato y ya veremos.',
    curioso: 'Los datos de esta entrada no han podido ser verificados por nadie que estuviera mirando en ese momento. La expedición Nº4 afirmó haberlo fotografiado; la foto salió movida. La Nº5 no volvió a hablar del tema.',
    tam: '5–7 m (estimado)', prof: 'Desconocida', dieta: 'Recuerdos ajenos',
    max: 2, inicial: 1, kind: 'spine',
    len: [240, 290], girth: 0.08, segs: 15, wiggle: 0.08, wiggleSpeed: 3.2,
    speed: [26, 36], flatten: 0.05, maxTurn: 0.9, profile: sharkProfile, luz: true,
    behavior: null, draw: drawEspectro,
  },
  neon: {
    grupo: 'ficticios', nombre: 'Anguila de neón', sci: 'Anguilla iridis',
    tipo: 'ficticio', color: '#61e4ff', bioma: 'arrecife',
    fact: 'Se tragó la última luz del abismo cuando era pequeña y desde entonces la va devolviendo a plazos. Generosa, a su manera. En modo abisal se luce de verdad.',
    curioso: 'Su brillo no es bioluminiscencia sino, según sus propias declaraciones, "luz de segunda mano en perfecto estado". Ningún instrumento de la expedición ha logrado medirla sin ponerse sentimental.',
    tam: '1.5 m', prof: '2000–4000 m', dieta: 'Fotones',
    max: 3, inicial: 1, kind: 'spine',
    len: [170, 210], girth: 0.045, segs: 24, wiggle: 0.36, wiggleSpeed: 5.6,
    speed: [34, 46], flatten: 0.03, maxTurn: 1.0, profile: eelProfile, luz: true,
    behavior: null, draw: drawNeon,
  },
  faroluz: {
    grupo: 'ficticios', nombre: 'Faroluz', sci: 'Lanterna lucida',
    tipo: 'ficticio', color: '#ffb454', bioma: 'arrecife',
    fact: 'Lleva siglos leyendo el fondo del mar con su farol. No ha encontrado nada. No parece un problema para él. Hay una lección ahí, pero no pensamos dártela masticada.',
    curioso: 'El farol funciona con una reserva de paciencia aparentemente inagotable. Cuando dos faroluces se cruzan, bajan la intensidad en señal de respeto. Nadie les ha enseñado a hacerlo.',
    tam: '20 cm', prof: '800–2600 m', dieta: 'Comida que le eches',
    max: 6, inicial: 2, kind: 'faroluz', ctor: Faroluz,
  },
  espejo: {
    grupo: 'ficticios', nombre: 'Pez espejo', sci: 'Speculum timidum',
    tipo: 'ficticio', color: '#bcd8e8', bioma: 'arrecife',
    fact: 'Refleja el color de lo que tiene más cerca, sobre todo si le da miedo. Si te acercas mucho y ves algo horrible, disculpa las molestias: es el espejo, no tú. Probablemente.',
    curioso: 'La expedición Nº2 intentó catalogarlo poniéndolo frente a otro pez espejo. El informe resultante ocupa 400 páginas y no concluye nada. Ambos peces parecían satisfechos.',
    tam: '25 cm', prof: '5–500 m', dieta: 'Apariencias',
    max: 4, inicial: 1, kind: 'espejo', ctor: PezEspejo,
  },
  /* --- ficticios · mar burbujeante --- */
  sacacorchos: {
    grupo: 'ficticios', nombre: 'Anguila sacacorchos', sci: 'Anguilla spiralis',
    tipo: 'ficticio', color: '#d8b28e', bioma: 'burbujeante',
    fact: 'Nada en espiral porque una vez le salió bien y ya no supo parar. Abre botellas hundidas por pura cortesía.',
    curioso: 'La expedición Nº3 la usó para descorchar un champán del naufragio de 1912. Burbujeaba perfecto. El informe oficial la describe como "herramienta y amiga".',
    tam: '1.2 m', prof: '10–80 m', dieta: 'Corchos (presuntamente)',
    max: 3, inicial: 1, kind: 'spine',
    len: [150, 185], girth: 0.05, segs: 24, wiggle: 0.34, wiggleSpeed: 5.4,
    speed: [30, 42], flatten: 0.02, maxTurn: 1.0, profile: eelProfile,
    behavior: sacacorchosBehavior, draw: drawSacacorchos,
  },
  copa: {
    grupo: 'ficticios', nombre: 'Pez copa', sci: 'Poculum bibens',
    tipo: 'ficticio', color: '#cfe8f4', bioma: 'burbujeante',
    fact: 'Bebe burbujas y las guarda dentro. Cuando está lleno, flota hacia arriba con la dignidad de quien no planeó absolutamente nada de esto.',
    curioso: 'Su nivel de gaseosa interior es visible a simple vista. La expedición sigue votando si es un pez o una copa con opiniones. La última votación quedó en empate; el pez copa se abstuvo.',
    tam: '18 cm', prof: '5–60 m', dieta: 'Burbujas',
    max: 5, inicial: 2, kind: 'copa', ctor: PezCopa,
  },
  sifon: {
    grupo: 'ficticios', nombre: 'Medusa sifón', sci: 'Physalia bullarum',
    tipo: 'ficticio', color: '#bdf0ff', bioma: 'burbujeante',
    fact: 'Una medusa hecha de gas con ambición de globo. Sube, revienta en burbujas, se rearma en el fondo y vuelve a intentarlo. Sísifo, pero flotante y contenta.',
    curioso: 'Nadie sabe si revienta por accidente o por gusto. La expedición dejó de contar sus intentos en el número 4.048. Ella no ha dejado de contar.',
    tam: '20–30 cm', prof: '0–100 m', dieta: 'Aire disuelto',
    max: 6, inicial: 2, kind: 'sifon', ctor: MedusaSifon,
  },
  /* --- ficticios · abismo --- */
  constelacion: {
    grupo: 'ficticios', nombre: 'Pez constelación', sci: 'Astrum natans',
    tipo: 'ficticio', color: '#bcd4ff', bioma: 'abismo',
    fact: 'No es un pez: es el hueco donde estuvo un pez, señalado con estrellas. De vez en cuando las une, por si quieres leerlo. Nadie lo ha conseguido dos veces.',
    curioso: 'Cada ejemplar dibuja una constelación distinta y la mantiene toda la vida. La expedición catalogó 61 patrones; el número 62 resultó ser el mapa de la propia expedición. Se decidió no seguir contando.',
    tam: 'Indeterminable', prof: '2000–4000 m', dieta: 'Oscuridad sobrante',
    max: 4, inicial: 1, kind: 'constelacion', ctor: Constelacion,
  },
  carbon: {
    grupo: 'ficticios', nombre: 'Tiburón carbón', sci: 'Umbra carbonis',
    tipo: 'ficticio', color: '#20262c', bioma: 'abismo',
    fact: 'Más oscuro que el agua que lo rodea. No refleja la luz: la guarda. Si lo miras fijamente un rato, él también.',
    curioso: 'Los instrumentos lo registran como un error de medición con aletas. Persigue la luz embotellada, lo que sugiere hambre o nostalgia; la expedición ha preferido no averiguar cuál de las dos.',
    tam: '4 m (por descarte)', prof: 'Donde no mires', dieta: 'Luz',
    max: 2, inicial: 1, kind: 'spine',
    len: [200, 250], girth: 0.08, segs: 15, wiggle: 0.08, wiggleSpeed: 3.4,
    speed: [24, 34], flatten: 0.05, maxTurn: 0.8, profile: sharkProfile, luz: true,
    behavior: null, draw: drawCarbon,
  },
  /* --- ficticios · naufragio --- */
  vigia: {
    grupo: 'ficticios', nombre: 'El Vigía', sci: 'Custos perpetuus',
    tipo: 'ficticio', color: '#5c8a72', bioma: 'naufragio',
    fact: 'Subió a la cofa en 1912 a hacer su turno. El barco se hundió; el turno, no. Te está mirando ahora mismo. Y ahora también.',
    curioso: 'Su ojo sigue al visitante con una precisión del cien por cien. La expedición organizó turnos para intentar aburrirlo. Se aburrieron ellos, en 1988. Él sigue.',
    tam: 'Un ojo', prof: 'La cofa', dieta: 'Horizontes',
    max: 1, inicial: 1, kind: 'vigia', ctor: Vigia,
  },
  moneda: {
    grupo: 'ficticios', nombre: 'Pez moneda', sci: 'Nummus fugax',
    tipo: 'ficticio', color: '#e8c04a', bioma: 'naufragio',
    fact: 'El tesoro del barco aprendió a nadar. Cuando algo se acerca, vuelve al cofre a toda prisa: el instinto más profundo de una moneda es que no la gasten.',
    curioso: 'Cada pez moneda tiene cara y cruz. La expedición lanzó uno al aire cien veces: las cien veces se fue nadando. Estadísticamente irreprochable.',
    tam: '3 cm de diámetro', prof: 'El cofre', dieta: 'Intereses',
    max: 12, inicial: 6, paso: 3, kind: 'moneda', ctor: Moneda,
  },
  campana: {
    grupo: 'ficticios', nombre: 'Medusa de bronce', sci: 'Aurelia aenea',
    tipo: 'ficticio', color: '#b08b46', bioma: 'naufragio',
    fact: 'La campana del barco decidió seguir trabajando por su cuenta. Tócala y tañe — el agua se queda el sonido del metal y deja solo la onda. Da la hora de un huso horario que ya no existe.',
    curioso: 'Tañe ocho campanadas al final de cada guardia, como manda la tradición naval. Que no haya guardias desde 1912 no es asunto suyo.',
    tam: '33 cm de bronce', prof: 'Junto a su barco', dieta: 'Horas en punto',
    max: 3, inicial: 1, kind: 'campana', ctor: MedusaBronce,
  },
  /* --- ficticios · jardín imposible --- */
  semilla: {
    grupo: 'ficticios', nombre: 'Pez semilla', sci: 'Semen natans',
    tipo: 'ficticio', color: '#d8b06a', bioma: 'imposible',
    fact: 'Nada hasta que encuentra un sitio que le gusta, se planta y germina en una flor-coral. La flor suelta más peces semilla. El jardín entero es este pez sin saber parar.',
    curioso: 'La expedición intentó llevarse uno de muestra. Se plantó en el bolsillo del uniforme. El uniforme floreció. Ahora es política oficial no llevar bolsillos.',
    tam: '4 cm (fase pez)', prof: '???', dieta: 'Paciencia',
    max: 8, inicial: 3, paso: 2, kind: 'semilla', ctor: PezSemilla,
  },
  raiz: {
    grupo: 'ficticios', nombre: 'Anguila raíz', sci: 'Anguilla radix',
    tipo: 'ficticio', color: '#a8889c', bioma: 'imposible',
    fact: 'Vive medio enterrada, conectando las flores por debajo. Nadie sabe qué les dice. Las flores del lado por donde ha pasado crecen mejor, así que algo será.',
    curioso: 'Tiene nudos de madera y un brote en la frente que no termina de abrirse. La expedición le desea lo mejor. En voz baja, para no presionarla.',
    tam: '2 m (la parte visible)', prof: '???', dieta: 'Minerales y cotilleos',
    max: 2, inicial: 1, kind: 'spine',
    len: [180, 220], girth: 0.05, segs: 26, wiggle: 0.3, wiggleSpeed: 4.2,
    speed: [22, 30], flatten: 0.02, maxTurn: 1.0, profile: eelProfile, floorK: 0.12,
    behavior: raizBehavior, draw: drawRaiz,
  },
  flor: {
    grupo: 'ficticios', nombre: 'Tiburón flor', sci: 'Carcharhinus floralis',
    tipo: 'ficticio', color: '#eea0c6', bioma: 'imposible',
    fact: 'Un depredador ápice con corola dorsal. Muda pétalos al nadar y no caza nada: poliniza. La cadena alimentaria del jardín es, técnicamente, un ramo.',
    curioso: 'Sus pétalos vuelven a crecer cada noche. La expedición guardó uno prensado en la bitácora; la bitácora huele a mar y a cumpleaños. No se ha vuelto a abrir por miedo a estropearlo.',
    tam: '3 m con pétalos', prof: '???', dieta: 'Luz (polinizando)',
    max: 2, inicial: 1, kind: 'spine', curious: true,
    len: [190, 230], girth: 0.075, segs: 15, wiggle: 0.09, wiggleSpeed: 3.0,
    speed: [22, 32], flatten: 0.05, maxTurn: 0.85, profile: sharkProfile,
    behavior: florBehavior, draw: drawFlor,
  },
  colibri: {
    grupo: 'ficticios', nombre: 'Pez colibrí', sci: 'Trochilus aquaticus',
    tipo: 'ficticio', color: '#5ad0a8', bioma: 'imposible',
    fact: 'Bate las aletas ochenta veces por segundo para quedarse exactamente donde ya estaba. Liba las flores-coral y a cambio les cuenta lo que hay fuera del jardín. Las flores no le creen.',
    curioso: 'Es el único pez conocido que puede nadar hacia atrás, hacia delante y hacia ninguna parte. Prefiere la tercera opción.',
    tam: '6 cm', prof: '???', dieta: 'Néctar de coral',
    max: 6, inicial: 2, paso: 2, kind: 'colibri', ctor: PezColibri,
  },
  diente: {
    grupo: 'ficticios', nombre: 'Medusa diente de león', sci: 'Taraxacum medusae',
    tipo: 'ficticio', color: '#f0ead2', bioma: 'imposible',
    fact: 'Tócala y se deshace en vilanos. Pide un deseo si quieres; ella se rearma exactamente igual, con la serenidad de quien ya pidió el suyo y le salió bien.',
    curioso: 'La expedición sopló una y contó los vilanos que volvieron: todos. Siempre vuelven todos. El informe lo describe como "profundamente tranquilizador por motivos que preferimos no analizar".',
    tam: '5 cm (esférica)', prof: '???', dieta: 'Deseos ajenos',
    max: 5, inicial: 2, kind: 'diente', ctor: MedusaDiente,
  },
  /* ================= EXPEDICIÓN ================= */
  buzo: {
    grupo: 'expedicion', nombre: 'Buzo explorador', sci: 'Homo sapiens scaphandrus',
    tipo: 'expedicion', color: '#c8d4dc', bioma: 'arrecife',
    fact: 'Homo sapiens con tanque. Tres inmersiones buscando al tiburón espectro. El tiburón espectro redacta informes sobre él desde la segunda. Ninguno de los dos lo sabe.',
    curioso: 'Notas de su bitácora: "Día 47. Las sardinas ya me saludan. La morena sigue sin saludarme. El presupuesto de bocadillos está agotado desde el día 12."',
    tam: '1.75 m', prof: 'Hasta donde llegue', dieta: 'Bocadillos (en superficie)',
    max: 2, inicial: 1, kind: 'buzo', ctor: Buzo,
  },
};

/* orden de dibujo: del fondo hacia el frente */
const LAYER_ORDER = [
  'estrella', 'jardin', 'raiz', 'ermitano', 'pulpo', 'raya', 'medusa', 'sifon', 'vampiro',
  'vigia', 'jureles', 'congrio', 'morena', 'cinta', 'electrica', 'neon',
  'sacacorchos', 'pelicano', 'espectro', 'carbon', 'flor', 'puntasblancas', 'blanco',
  'martillo', 'linterna', 'mero', 'tortuga', 'buzo', 'campana', 'dumbo',
  'payaso', 'sardina', 'globo', 'caballito', 'rape', 'espejo', 'copa',
  'hacha', 'constelacion', 'diente', 'moneda', 'semilla', 'colibri', 'faroluz',
];

/* fabricar una criatura de una especie */
function spawnCreature(key, x, y) {
  const sp = SPECIES[key];
  const px = x ?? rand(world.W * 0.15, world.W * 0.85);
  const py = y ?? rand(world.H * 0.25, world.H * 0.7);
  let c;
  if (sp.kind === 'spine') c = new SpineFish(key, sp, px, py);
  else if (['estrella', 'pulpo', 'ermitano', 'jardin'].includes(sp.kind)) c = new sp.ctor(key, sp, x);
  else c = new sp.ctor(key, sp, px, py);
  world.creatures.push(c);
  return c;
}
