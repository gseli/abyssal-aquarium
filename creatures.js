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
};

/* ---------- fuerzas comunes ---------- */
function wallForce(x, y, f, marginX = 90, marginTop = 90) {
  const k = 5;
  if (x < marginX) f.x += (marginX - x) * k * 0.06;
  if (x > world.W - marginX) f.x -= (x - (world.W - marginX)) * k * 0.06;
  if (y < marginTop) f.y += (marginTop - y) * k * 0.06;
  const fl = world.floorY(x) - 34;
  if (y > fl) f.y -= (y - fl) * k * 0.1;
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

    wallForce(this.x, this.y, f, 100, sp.topMargin || 90);
    sp.behavior && sp.behavior(this, f, dt);

    // interés por la comida (los tiburones curiosean)
    const ft = world.feedTarget;
    if (ft && t < ft.until && sp.curious) {
      const d = norm(ft.x - this.x, ft.y - this.y);
      f.x += d.x * 0.9; f.y += d.y * 0.9;
    }

    let speed = this.speed;
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
    const wig = Math.sin(this.phase) * sp.wiggle;
    const ang = Math.atan2(v.y, v.x) + wig;
    this.x += Math.cos(ang) * speed * dt;
    this.y += Math.sin(ang) * speed * dt;
    this.y = clamp(this.y, 40, world.floorY(this.x) - 10);

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
  const dx = fish.home.x - fish.x, dy = fish.home.y - fish.y;
  const d = Math.hypot(dx, dy);
  if (d > 150) { f.x += (dx / d) * 2; f.y += (dy / d) * 2; }
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
    // buscar comida
    let best = null, bd = 240;
    for (const p of world.food) {
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const to = norm(best.x - this.x, best.y - this.y);
      f.x += to.x * 9; f.y += to.y * 9;
      if (bd < 9) best.eaten = true;
    }
    wallForce(this.x, this.y, f, 60, 70);
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
    this.x = clamp(this.x, 10, world.W - 10);
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
    this.pulse += dt * 1.6;
    const s = Math.sin(this.pulse);
    this.y -= (4 + 13 * Math.max(0, s)) * dt * (this.r / 26);
    this.x += (this.driftX + Math.sin(world.time * 0.4 + this.seed) * 6) * dt;
    if (this.y < 70) { this.y = world.floorY(this.x) - 60; this.x = rand(60, world.W - 60); }
    this.x = clamp(this.x, 30, world.W - 30);
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
    this.x += Math.sin(world.time * 0.05 + this.seed) * 0.4 * dt; // arrastre glacial
    this.y = world.floorY(this.x) - this.r * 0.28;
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
    // busca comida también
    let best = null, bd = 200;
    for (const p of world.food) {
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const to = norm(best.x - this.x, best.y - this.y);
      f.x += to.x * 6; f.y += to.y * 6;
      if (bd < 8) best.eaten = true;
    }
    wallForce(this.x, this.y, f, 80, 100);
    const v = norm(this.vel.x + f.x * dt * 40, this.vel.y + f.y * dt * 40);
    const spd = 26;
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
    this.baseY += Math.sin(t * 0.13 + this.seed) * 4 * dt;
    this.baseY = clamp(this.baseY, world.H * 0.28, world.H * 0.68);
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
   REGISTRO DE ESPECIES
   ============================================================ */
const SPECIES = {
  /* --- reales --- */
  blanco: {
    grupo: 'reales', nombre: 'Tiburón blanco', sci: 'Carcharodon carcharias',
    tipo: 'real', color: '#7ba7c7',
    fact: 'Puede detectar una gota de sangre en 100 litros de agua. Aquí, por suerte, solo le interesan las sardinas — y nunca las alcanza.',
    tam: '4–6 m', prof: '0–1200 m', dieta: 'Sardinas (en teoría)',
    max: 3, inicial: 1, kind: 'spine',
    len: [220, 280], girth: 0.085, segs: 15, wiggle: 0.09, wiggleSpeed: 4.0,
    speed: [42, 62], flatten: 0.06, maxTurn: 0.8, profile: sharkProfile, curious: true,
    behavior: huntBehavior, draw: drawBlanco,
  },
  martillo: {
    grupo: 'reales', nombre: 'Tiburón martillo', sci: 'Sphyrna mokarran',
    tipo: 'real', color: '#8fb8a8',
    fact: 'Su cabeza en forma de T le da visión de casi 360°. Ve absolutamente todo lo que pasa en este acuario, incluido tu cursor.',
    tam: '3–5 m', prof: '1–300 m', dieta: 'Rayas y peces',
    max: 3, inicial: 1, kind: 'spine',
    len: [190, 240], girth: 0.08, segs: 15, wiggle: 0.1, wiggleSpeed: 4.4,
    speed: [46, 66], flatten: 0.06, maxTurn: 0.9, profile: sharkProfile, curious: true,
    behavior: huntBehavior, draw: drawMartillo,
  },
  morena: {
    grupo: 'reales', nombre: 'Morena verde', sci: 'Gymnothorax funebris',
    tipo: 'real', color: '#93a85e',
    fact: 'En realidad es marrón: una mucosa amarilla la hace parecer verde. Abre y cierra la boca para respirar — no te está amenazando. Probablemente.',
    tam: '1.8–2.5 m', prof: '1–50 m', dieta: 'Peces y pulpos',
    max: 3, inicial: 1, kind: 'spine',
    len: [170, 210], girth: 0.055, segs: 24, wiggle: 0.34, wiggleSpeed: 5.2,
    speed: [26, 38], flatten: 0.02, maxTurn: 1.0, profile: eelProfile,
    behavior: lurkBehavior, draw: drawMorena,
  },
  electrica: {
    grupo: 'reales', nombre: 'Anguila eléctrica', sci: 'Electrophorus electricus',
    tipo: 'real', color: '#d8b45a',
    fact: 'Genera descargas de hasta 860 voltios. Haz clic sobre ella para comprobarlo — bajo tu propia responsabilidad.',
    tam: '2–2.5 m', prof: 'Ríos, 0–3 m', dieta: 'Peces aturdidos',
    max: 2, inicial: 1, kind: 'spine',
    len: [150, 190], girth: 0.06, segs: 22, wiggle: 0.3, wiggleSpeed: 4.8,
    speed: [28, 40], flatten: 0.025, maxTurn: 0.9, profile: eelProfile,
    behavior: bottomBehavior, draw: drawElectrica,
  },
  sardina: {
    grupo: 'reales', nombre: 'Sardina esmeralda', sci: 'Sardina pilchardus',
    tipo: 'real', color: '#3ddc84',
    fact: 'Nadan en bancos sincronizados para confundir a los depredadores. Spoiler: el tiburón no se confunde, pero tampoco atina.',
    tam: '15–25 cm', prof: '10–100 m', dieta: 'Plancton',
    max: 90, inicial: 40, paso: 10, kind: 'sardina', ctor: Sardina,
  },
  medusa: {
    grupo: 'reales', nombre: 'Medusa luna', sci: 'Aurelia aurita',
    tipo: 'real', color: '#c5a8ff',
    fact: 'Su linaje flota por los océanos desde hace más de 500 millones de años: existía antes que los dinosaurios y sigue sin tener prisa.',
    tam: '25–40 cm', prof: '0–1000 m', dieta: 'Plancton',
    max: 8, inicial: 3, kind: 'medusa', ctor: Medusa,
  },
  estrella: {
    grupo: 'reales', nombre: 'Estrella de mar', sci: 'Asterias rubens',
    tipo: 'real', color: '#f59f3b',
    fact: 'No tiene cerebro ni sangre, y aun así puede regenerar un brazo entero. La paciencia hecha animal.',
    tam: '10–30 cm', prof: '0–400 m', dieta: 'Moluscos',
    max: 5, inicial: 2, kind: 'estrella', ctor: Estrella,
  },
  /* --- ficticios --- */
  espectro: {
    grupo: 'ficticios', nombre: 'Tiburón espectro', sci: 'Carcharias phantasma',
    tipo: 'ficticio', color: '#9be8ff',
    fact: 'Dicen que solo se deja ver del todo cuando nadie lo está buscando. El buzo lleva tres expediciones intentándolo; el espectro lo observa desde ayer.',
    tam: '5–7 m (estimado)', prof: 'Desconocida', dieta: 'Recuerdos ajenos',
    max: 2, inicial: 1, kind: 'spine',
    len: [240, 290], girth: 0.08, segs: 15, wiggle: 0.08, wiggleSpeed: 3.2,
    speed: [26, 36], flatten: 0.05, maxTurn: 0.9, profile: sharkProfile,
    behavior: null, draw: drawEspectro,
  },
  neon: {
    grupo: 'ficticios', nombre: 'Anguila de neón', sci: 'Anguilla iridis',
    tipo: 'ficticio', color: '#61e4ff',
    fact: 'Brilla con la luz que se tragó de pequeña, cuando el abismo todavía tenía sol. Actívale el modo abisal y verás de lo que es capaz.',
    tam: '1.5 m', prof: '2000–4000 m', dieta: 'Fotones',
    max: 3, inicial: 1, kind: 'spine',
    len: [170, 210], girth: 0.045, segs: 24, wiggle: 0.36, wiggleSpeed: 5.6,
    speed: [34, 46], flatten: 0.03, maxTurn: 1.0, profile: eelProfile,
    behavior: null, draw: drawNeon,
  },
  faroluz: {
    grupo: 'ficticios', nombre: 'Faroluz', sci: 'Lanterna lucida',
    tipo: 'ficticio', color: '#ffb454',
    fact: 'Enciende su farol para leer el fondo del mar. Nadie sabe qué busca, pero lleva siglos sin encontrarlo y no parece molestarle.',
    tam: '20 cm', prof: '800–2600 m', dieta: 'Comida que le eches',
    max: 6, inicial: 2, kind: 'faroluz', ctor: Faroluz,
  },
  /* --- expedición --- */
  buzo: {
    grupo: 'expedicion', nombre: 'Buzo explorador', sci: 'Homo sapiens scaphandrus',
    tipo: 'expedicion', color: '#c8d4dc',
    fact: 'Explorador residente de la expedición Nº7. Lleva tres inmersiones buscando al tiburón espectro. El tiburón espectro lo observa desde ayer.',
    tam: '1.75 m', prof: 'Hasta donde llegue', dieta: 'Bocadillos (en superficie)',
    max: 2, inicial: 1, kind: 'buzo', ctor: Buzo,
  },
};

/* orden de dibujo: del fondo hacia el frente */
const LAYER_ORDER = ['estrella', 'medusa', 'morena', 'electrica', 'neon', 'espectro', 'blanco', 'martillo', 'buzo', 'sardina', 'faroluz'];

/* fabricar una criatura de una especie */
function spawnCreature(key, x, y) {
  const sp = SPECIES[key];
  const px = x ?? rand(world.W * 0.15, world.W * 0.85);
  const py = y ?? rand(world.H * 0.25, world.H * 0.7);
  let c;
  if (sp.kind === 'spine') c = new SpineFish(key, sp, px, py);
  else if (sp.kind === 'estrella') c = new Estrella(key, sp, x);
  else c = new sp.ctor(key, sp, px, py);
  world.creatures.push(c);
  return c;
}
