/* ============================================================
   ACUARIO ABISAL — dibujo
   Piezas compartidas y las especies de espina (tiburones y
   anguilas). Solo pinta: la simulación vive en creatures.js.
   Requiere luz.js. Cargar antes de creatures.js, que referencia
   estos dibujos desde SPECIES.
   ============================================================ */
'use strict';

const trazo = (() => {
  const { css, tono, mezcla, halo } = luz;

  /* ---------- piezas para peces pequeños (mirando a la derecha) ---------- */
  /* huso de pez: a = media longitud, h = media altura */
  function huso(ctx, a, h, panza = 1) {
    ctx.beginPath();
    ctx.moveTo(a, h * 0.06);
    ctx.bezierCurveTo(a * 0.72, -h * 0.82, a * 0.1, -h * 1.2, -a * 0.46, -h * 0.5);
    ctx.quadraticCurveTo(-a * 0.8, -h * 0.14, -a, -h * 0.14);
    ctx.lineTo(-a, h * 0.14);
    ctx.quadraticCurveTo(-a * 0.8, h * 0.14, -a * 0.46, h * 0.5 * panza);
    ctx.bezierCurveTo(a * 0.1, h * 1.14 * panza, a * 0.76, h * 0.7 * panza, a, h * 0.06);
    ctx.closePath();
  }

  /* aleta caudal: horquilla 0 = redonda · 1 = media luna */
  function cola(ctx, x, largo, alto, bate, color, horquilla = 0.5) {
    const fin = x - largo * (1 - Math.abs(bate) * 0.15); // al batir se ve de canto
    const d = bate * alto * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + largo * 0.15, 0);
    ctx.quadraticCurveTo(x - largo * 0.3, -alto * 0.3, fin, d - alto);
    ctx.quadraticCurveTo(fin + largo * (horquilla * 1.1 - 0.25), d, fin, d + alto);
    ctx.quadraticCurveTo(x - largo * 0.3, alto * 0.3, x + largo * 0.15, 0);
    ctx.fill();
  }

  /* aleta de pez: base (a→b), punta y sus radios */
  function aleta(ctx, ax, ay, bx, by, px, py, color, radios) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(lerp(ax, px, 0.6), lerp(ay, py, 0.95), px, py);
    ctx.quadraticCurveTo(lerp(bx, px, 0.3), lerp(by, py, 0.55), bx, by);
    ctx.closePath();
    ctx.fill();
    if (!radios) return;
    ctx.strokeStyle = radios;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 1; i < 5; i++) {
      const f = i / 5;
      ctx.moveTo(lerp(ax, bx, f), lerp(ay, by, f));
      ctx.lineTo(lerp(px, bx, f * 0.7), lerp(py, by, f * 0.7));
    }
    ctx.stroke();
  }

  /* ojo: iris, pupila y un solo brillo, arriba, de donde viene la luz */
  function ojo(ctx, x, y, r, iris, pupila = '#07111b') {
    if (iris) {
      ctx.fillStyle = iris;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = pupila;
    ctx.beginPath(); ctx.arc(x + (iris ? r * 0.1 : 0), y, iris ? r * 0.58 : r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(x + r * 0.15, y - r * 0.32, r * 0.24, 0, TAU); ctx.fill();
  }

  /* degradado de lomo a vientre */
  function lomoVientre(ctx, h, ...colores) {
    const g = ctx.createLinearGradient(0, -h, 0, h);
    colores.forEach((c, i) => g.addColorStop(i / (colores.length - 1), tono(c)));
    return g;
  }

  /* ---------- cuerpos de espina ---------- */
  /* Una pose de solo lectura a partir de la cadena simulada.
     `s` va de 1 (lomo) a −1 (vientre); `h` mide en medios anchos máximos.
     Al dar la vuelta, el eje lomo-vientre se pliega y el cuerpo rueda. */
  function pose(pez, { rigidez = 0, perfil = null } = {}) {
    const S = pez.spine, n = S.length, a = S[0], z = S[n - 1];
    const P = [], N = [], T = [], U = [], W = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      P.push({
        x: lerp(S[i].x, lerp(a.x, z.x, f), rigidez),
        y: lerp(S[i].y, lerp(a.y, z.y, f), rigidez),
      });
      W.push(perfil ? pez.maxW * perfil(f) : pez.widths[i]);
    }
    const memo = pez._luz || (pez._luz = {});
    const dx = P[0].x - P[n - 1].x;
    if (memo.sentido === undefined) memo.sentido = dx < 0 ? -1 : 1;
    if (Math.abs(dx) > pez.len * 0.16) memo.sentido = dx < 0 ? -1 : 1;
    let lado = luz.seguir(pez, 'lado', -memo.sentido, 2.6);
    /* La vuelta no rueda el cuerpo de una pieza: la cabeza gira primero y
       cada vértebra repite lo que hizo la anterior un instante después, así
       que la torsión baja hacia la cola y nunca queda todo el pez de canto. */
    const hist = memo.ladoHist || (memo.ladoHist = []);
    if (hist.length && hist[hist.length - 1][0] === world.time) hist[hist.length - 1][1] = lado;
    else hist.push([world.time, lado]);
    const retardo = 0.42;
    while (hist.length > 2 && world.time - hist[1][0] > retardo + 0.05) hist.shift();
    const L = new Float32Array(n), Lc = new Float32Array(n); // Lc: sin suelo, para cruzar el eje sin saltos
    let j = hist.length - 1;
    for (let i = 0; i < n; i++) {
      const t = world.time - retardo * i / (n - 1);
      while (j > 0 && hist[j][0] > t) j--;
      const [t0, v0] = hist[j], sig = hist[Math.min(hist.length - 1, j + 1)];
      let v = sig[0] > t0 && t > t0 ? lerp(v0, sig[1], clamp((t - t0) / (sig[0] - t0), 0, 1)) : v0;
      Lc[i] = v;
      if (Math.abs(v) < 0.06) v = v < 0 ? -0.06 : 0.06;
      L[i] = v;
    }
    lado = L[n >> 1];
    for (let i = 0; i < n; i++) {
      const p = P[Math.max(0, i - 1)], q = P[Math.min(n - 1, i + 1)];
      const t = norm(p.x - q.x, p.y - q.y);
      T.push(t);
      N.push({ x: -t.y, y: t.x });
      U.push({ x: -t.y * L[i], y: t.x * L[i] });
    }

    /* punto del cuerpo: t cabeza→cola (se puede salir), s en anchos locales, h absoluto */
    function en(t, s = 0, h = 0) {
      const f = clamp(t, 0, 1) * (n - 1);
      const i = Math.min(n - 2, Math.floor(f)), k = f - i;
      const fuera = (t - clamp(t, 0, 1)) * pez.len;
      const d = lerp(W[i], W[i + 1], k) * s + pez.maxW * h;
      return {
        x: lerp(P[i].x, P[i + 1].x, k) - T[i].x * fuera + lerp(U[i].x, U[i + 1].x, k) * d,
        y: lerp(P[i].y, P[i + 1].y, k) - T[i].y * fuera + lerp(U[i].y, U[i + 1].y, k) * d,
      };
    }
    return { pez, n, P, N, T, U, W, L, Lc, lado, en };
  }

  /* El contorno entero (a = 1, b = −1) o una loncha entre dos alturas, en el eje
     de la normal. Todas convergen en el morro y en la cola, así que ninguna
     necesita recorte (clip por cada pez costaba la mitad del fotograma). */
  function cuerpo(ctx, g, morro, a = 1, b = -1) {
    const { P, N, T, W, n } = g;
    // a y b pueden ser números o depender de la vértebra (la torsión al girar)
    const fa = typeof a === 'function' ? a : () => a, fb = typeof b === 'function' ? b : () => b;
    const I = i => { const k = W[i] * fa(i); return { x: P[i].x + N[i].x * k, y: P[i].y + N[i].y * k }; };
    const D = i => { const k = W[i] * fb(i); return { x: P[i].x + N[i].x * k, y: P[i].y + N[i].y * k }; };
    ctx.beginPath();
    let p = I(0);
    ctx.moveTo(p.x, p.y);
    for (let i = 1; i < n - 1; i++) {
      const u = I(i), v = I(i + 1);
      ctx.quadraticCurveTo(u.x, u.y, (u.x + v.x) / 2, (u.y + v.y) / 2);
    }
    ctx.lineTo(P[n - 1].x, P[n - 1].y);
    for (let i = n - 2; i > 0; i--) {
      const u = D(i), v = D(i - 1);
      ctx.quadraticCurveTo(u.x, u.y, (u.x + v.x) / 2, (u.y + v.y) / 2);
    }
    const d = D(0), e = I(0);
    ctx.lineTo(d.x, d.y);
    const tx = P[0].x + T[0].x * morro, ty = P[0].y + T[0].y * morro;
    const cx = T[0].x * morro * 0.68, cy = T[0].y * morro * 0.68;
    ctx.quadraticCurveTo(d.x + cx, d.y + cy, tx, ty);
    ctx.quadraticCurveTo(e.x + cx, e.y + cy, e.x, e.y);
    ctx.closePath();
  }

  /* franja a lo largo del cuerpo, entre dos alturas */
  function franja(ctx, g, s0, s1, t0 = -0.08, t1 = 1) {
    ctx.beginPath();
    const n = g.n;
    // un cuerpo pide muchas franjas con los mismos puntos: se calculan una vez
    let e = g.ejes;
    if (!e || e.t0 !== t0 || e.t1 !== t1) {
      e = g.ejes = { t0, t1, v: new Float32Array((n + 1) * 4) };
      for (let i = 0; i <= n; i++) {
        const f = lerp(t0, t1, i / n), c = g.en(f, 0), u = g.en(f, 1);
        e.v.set([c.x, c.y, u.x - c.x, u.y - c.y], i * 4);
      }
    }
    const v = e.v, fin = n * 4;
    ctx.moveTo(v[0] + v[2] * s0, v[1] + v[3] * s0);
    for (let i = 4; i <= fin; i += 4) ctx.lineTo(v[i] + v[i + 2] * s0, v[i + 1] + v[i + 3] * s0);
    for (let i = fin; i >= 0; i -= 4) ctx.lineTo(v[i] + v[i + 2] * s1, v[i + 1] + v[i + 3] * s1);
    ctx.closePath();
  }

  /* volumen que sigue la curva del cuerpo */
  function volumen(ctx, g, morro, lomo, vientre, marcas) {
    cuerpo(ctx, g, morro);
    ctx.fillStyle = tono(vientre);
    ctx.fill();
    // el lomo cambia de lado vértebra a vértebra; cerca del cruce se encoge
    // hasta el eje en vez de saltar de un borde al otro
    const { L, Lc, lado } = g, arriba = i => clamp(Lc[i] * 5, -1, 1);
    // a media vuelta se le ve la panza: el lomo se aclara hasta cruzar el eje
    const canto = Math.min(1, Math.abs(lado) * 1.4);
    // solo tantas lonchas como se puedan ver a este tamaño
    const enPantalla = g.pez.maxW * (luz.agua ? view.scale : 1.6);
    const pasos = luz.calidad === 2 ? Math.round(clamp(enPantalla * 0.4, 4, 11)) : 3 + luz.calidad;
    for (let i = 1; i <= pasos; i++) {
      const f = i / pasos;
      const k = lerp(-0.62, 0.5, f);
      cuerpo(ctx, g, morro, arriba, i => k * Lc[i]);
      ctx.fillStyle = tono(mezcla(vientre, lomo, f * f * (3 - 2 * f) * canto));
      ctx.fill();
    }
    if (marcas) marcas();
    // la luz de arriba resbala por el lomo
    cuerpo(ctx, g, morro, arriba, i => 0.72 * Lc[i]);
    ctx.fillStyle = css(luz.agua ? mezcla(luz.agua, '#e8fbff', 0.75) : '#e8fbff', 0.14 * canto);
    ctx.fill();
  }

  /* curva cerrada por puntos {x,y}: los pares son controles */
  function forma(ctx, ...p) {
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i + 1 < p.length; i += 2) ctx.quadraticCurveTo(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y);
    ctx.closePath();
  }

  function linea(ctx, ...p) {
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    if (p.length === 3) ctx.quadraticCurveTo(p[1].x, p[1].y, p[2].x, p[2].y);
    else for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();
  }

  function punto(ctx, p, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
  }

  return { huso, cola, aleta, ojo, lomoVientre, pose, cuerpo, franja, volumen, forma, linea, punto, halo };
})();

/* ============================================================
   TIBURONES
   ============================================================ */
function perfilEscualo(t) {
  if (t < 0.3) return 0.36 + 0.68 * Math.sin((t / 0.3) * Math.PI / 2);
  if (t < 0.4) return 1.04;
  return Math.max(0.1, 1.04 - Math.pow((t - 0.4) / 0.58, 1.15) * 0.94);
}

function pintarEscualo(pez, ctx, o) {
  const { forma, linea, ojo, punto } = trazo;
  const tono = o.fijo ? c => luz.css(c) : luz.tono; // los de luz propia no se tiñen
  const g = trazo.pose(pez, { rigidez: 0.5, perfil: perfilEscualo });
  const { en } = g, w = pez.maxW;
  const bate = Math.sin(pez.phase) * 0.25, rema = Math.sin(pez.phase * 0.35) * 0.12;
  const oscura = tono(luz.mezcla(o.aleta, '#06121f', 0.35));

  // al otro lado del cuerpo: pectoral lejana y pélvica
  ctx.fillStyle = oscura;
  forma(ctx, en(0.24, -0.5), en(0.32, 0, -1.2), en(0.38, 0, -1.55 + rema), en(0.35, 0, -0.9), en(0.36, -0.5));
  ctx.fill();
  forma(ctx, en(0.62, -0.6), en(0.68, 0, -0.9), en(0.71, 0, -0.95), en(0.69, 0, -0.5), en(0.7, -0.5));
  ctx.fill();

  ctx.fillStyle = tono(o.aleta);
  // dorsal en vela, inclinada hacia atrás
  if (!o.sinDorsal) {
    forma(ctx, en(0.26, 0.8), en(0.36, 0, 1.3), en(0.4, 0, 1.75), en(0.45, 0, 2.2), en(0.49, 0, 2.12),
      en(0.43, 0, 1.4), en(0.47, 0.75));
    ctx.fill();
  }
  // segunda dorsal y anal
  forma(ctx, en(0.73, 0.7), en(0.77, 0, 0.75), en(0.8, 0, 0.8), en(0.78, 0, 0.5), en(0.8, 0.5));
  ctx.fill();
  forma(ctx, en(0.76, -0.6), en(0.8, 0, -0.6), en(0.82, 0, -0.65), en(0.81, 0, -0.35), en(0.82, -0.4));
  ctx.fill();
  // caudal, con el lóbulo de arriba mayor
  forma(ctx, en(0.9, 0.4), en(1.02, 0, 0.6 + bate), en(1.17, 0, 1.95 + bate),
    en(1.08, 0, 0.7 + bate), en(1.045, 0, 0.02 + bate * 0.6),
    en(1.06, 0, -0.5 + bate), en(1.11, 0, -1.25 + bate),
    en(1.0, 0, -0.45), en(0.9, -0.4));
  ctx.fill();
  if (o.puntas) {
    ctx.fillStyle = tono(o.puntas);
    forma(ctx, en(0.49, 0, 2.12), en(0.45, 0, 2.2), en(0.415, 0, 1.85), en(0.43, 0, 1.75), en(0.452, 0, 1.72));
    ctx.fill();
    forma(ctx, en(1.17, 0, 1.95 + bate), en(1.12, 0, 1.4 + bate), en(1.1, 0, 1.3 + bate),
      en(1.105, 0, 1.2 + bate), en(1.118, 0, 1.15 + bate));
    ctx.fill();
  }

  const morro = pez.len * (o.morro ?? 0.07);
  if (o.relleno) {
    trazo.cuerpo(ctx, g, morro);
    ctx.fillStyle = o.relleno;
    ctx.fill();
    if (o.filo) { ctx.strokeStyle = o.filo; ctx.lineWidth = 1; ctx.stroke(); }
  } else {
    trazo.volumen(ctx, g, morro, o.lomo, o.vientre, o.marcas && (() => o.marcas(g)));
  }

  // branquias: cinco comas discretas
  ctx.strokeStyle = o.branquia || 'rgba(6,20,34,0.3)';
  ctx.lineWidth = Math.max(0.7, w * 0.045);
  for (let k = 0; k < 5; k++) {
    const t = 0.16 + k * 0.018;
    linea(ctx, en(t, 0.3 - k * 0.03), en(t + 0.012, 0), en(t + 0.004, -0.36 + k * 0.03));
  }
  // boca retrasada, bajo el morro
  ctx.strokeStyle = o.boca || 'rgba(6,18,30,0.5)';
  ctx.lineWidth = Math.max(0.8, w * 0.06);
  linea(ctx, en(-0.025, -0.42), en(0.035, -0.4), en(0.085, -0.66));
  if (o.dientes) {
    ctx.fillStyle = 'rgba(244,251,255,0.8)';
    for (let k = 0; k < 5; k++) {
      const t = k * 0.014;
      forma(ctx, en(t, -0.46), en(t + 0.003, -0.5), en(t + 0.004, -0.58), en(t + 0.006, -0.5), en(t + 0.008, -0.46));
      ctx.fill();
    }
  }
  // pectoral cercana, por delante del cuerpo
  ctx.fillStyle = tono(o.aleta);
  forma(ctx, en(0.25, -0.38), en(0.35, 0, -1.2), en(0.43, 0, -1.8 - rema), en(0.46, 0, -2.05 - rema), en(0.47, 0, -1.98 - rema),
    en(0.39, 0, -1.1), en(0.37, -0.4));
  ctx.fill();
  if (!o.sinOjo) {
    const p = en(0.045, 0.3);
    if (o.brilloOjo) trazo.halo(ctx, p.x, p.y, w * 0.8, o.brilloOjo, 0.8);
    if (o.iris) ojo(ctx, p.x, p.y, w * 0.14, o.iris);
    else {
      punto(ctx, p, w * 0.13, o.pupila || '#07111b');
      punto(ctx, { x: p.x, y: p.y - w * 0.04 }, w * 0.04, 'rgba(255,255,255,0.75)');
    }
  }
  return g;
}

function drawBlanco(pez, ctx) {
  pintarEscualo(pez, ctx, {
    lomo: '#3f5c72', vientre: '#e9f1f1', aleta: '#3b566c', dientes: true, morro: 0.075,
  });
}

function drawMartillo(pez, ctx) {
  const g = pintarEscualo(pez, ctx, { lomo: '#59706b', vientre: '#dfe9df', aleta: '#536a66', sinOjo: true, morro: 0.03 });
  const { en } = g, w = pez.maxW;
  // la cabeza en T, en escorzo: un ala delgada con un ojo en cada punta
  const arriba = en(0.02, 0, 1.12), abajo = en(-0.075, 0, -0.98);
  const ala = ctx.createLinearGradient(arriba.x, arriba.y, abajo.x, abajo.y);
  ala.addColorStop(0, luz.tono('#465c59'));
  ala.addColorStop(0.65, luz.tono('#6d847c'));
  ala.addColorStop(1, luz.tono('#a9bbb0'));
  ctx.fillStyle = ala;
  trazo.forma(ctx, en(0.04, 0, 1.05), en(0.03, 0, 1.3), en(-0.005, 0, 1.12),
    en(-0.055, 0, 0.7), en(-0.07, 0, 0.1),
    en(-0.12, 0, -0.45), en(-0.11, 0, -0.95),
    en(-0.07, 0, -1.22), en(-0.045, 0, -0.95),
    en(-0.02, 0, -0.2), en(0.04, 0, 0.1),
    en(0.04, 0, 0.6), en(0.04, 0, 1.05));
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,245,240,0.22)';
  ctx.lineWidth = 1;
  trazo.linea(ctx, en(-0.005, 0, 1.12), en(-0.075, 0, 0.2), en(-0.11, 0, -0.95));
  trazo.punto(ctx, en(0.018, 0, 1.06), w * 0.11, '#07111b');
  const p = en(-0.078, 0, -0.96);
  trazo.ojo(ctx, p.x, p.y, w * 0.13, '#9fb2a4');
}

function drawPuntasBlancas(pez, ctx) {
  pintarEscualo(pez, ctx, {
    lomo: '#6c776c', vientre: '#e4e8da', aleta: '#667167', puntas: '#f6faf2', morro: 0.045, iris: '#c9cdb0',
  });
}

function drawEspectro(pez, ctx) {
  const t = world.time, h = pez.head();
  const aparece = 0.2 + 0.28 * (0.5 + 0.5 * Math.sin(t * 0.24 + pez.seed)) + world.abyssMix * 0.22;
  ctx.save();
  ctx.globalAlpha *= clamp(aparece, 0.12, 0.75);
  trazo.halo(ctx, h.x, h.y, pez.len * 0.6, [140, 225, 255], 0.3);
  const velo = ctx.createLinearGradient(h.x, h.y - pez.maxW * 1.3, h.x, h.y + pez.maxW * 1.3);
  velo.addColorStop(0, 'rgba(225,250,255,0.75)');
  velo.addColorStop(0.5, 'rgba(160,220,245,0.3)');
  velo.addColorStop(1, 'rgba(235,252,255,0.65)');
  const g = pintarEscualo(pez, ctx, {
    fijo: true, aleta: '#b4e4f6', relleno: velo, filo: 'rgba(220,250,255,0.8)',
    pupila: '#0a3a4a', boca: 'rgba(110,190,220,0.7)', branquia: 'rgba(120,200,230,0.5)',
  });
  // por dentro solo hay corriente
  ctx.strokeStyle = 'rgba(235,253,255,0.5)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const p = g.en(0.2 + i * 0.07, Math.sin(i * 0.7 - t * 0.9 + k * 2) * 0.45);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* tiburón linterna: contrailuminación de bolsillo */
function drawLinterna(pez, ctx) {
  const borrado = pez.borrado || 0; // un momento lo funde con la luz de arriba
  ctx.save();
  ctx.globalAlpha *= 1 - borrado * 0.75;
  const g = pintarEscualo(pez, ctx, {
    lomo: '#3b3438', vientre: '#3f6a7c', aleta: '#383238', morro: 0.04, iris: '#9dffc4', brilloOjo: [120, 255, 180],
  });
  ctx.restore();
  for (let i = 0; i < 13; i++) {
    const p = g.en(0.1 + i * 0.065, -0.82);
    const k = 0.65 + 0.35 * Math.sin(world.time * 0.8 - i * 0.5 + pez.seed);
    trazo.halo(ctx, p.x, p.y, 5 + borrado * 3, [110, 215, 255], 0.75 * k);
    trazo.punto(ctx, p, 0.9, `rgba(200,245,255,${0.8 * k})`);
  }
  const c = g.en(0.35, -0.8);
  trazo.halo(ctx, c.x, c.y, pez.len * (0.4 + borrado * 0.5), [90, 180, 240], 0.17 + borrado * 0.06);
}

/* tiburón carbón (ficticio): más oscuro que el agua que lo rodea */
function drawCarbon(pez, ctx) {
  const g = pintarEscualo(pez, ctx, {
    fijo: true, aleta: '#010204', relleno: '#010204', filo: 'rgba(110,170,255,0.13)',
    sinOjo: true, branquia: 'rgba(90,120,170,0.12)', boca: 'rgba(90,120,170,0.12)',
  });
  // el ojo: una brasa lejana
  const p = g.en(0.045, 0.3), k = 0.6 + 0.3 * Math.sin(world.time * 0.7 + pez.seed);
  trazo.halo(ctx, p.x, p.y, 9, [255, 100, 60], k);
  trazo.punto(ctx, p, 1.4, `rgba(255,150,100,${k})`);
}

/* tiburón flor: aletas de pétalo que muda al nadar */
function drawFlor(pez, ctx) {
  const g = pintarEscualo(pez, ctx, {
    lomo: '#b45c8c', vientre: '#fbe2e8', aleta: '#e49bc0', sinDorsal: true, pupila: '#3a1e30',
    branquia: 'rgba(120,50,90,0.3)', boca: 'rgba(90,30,60,0.45)',
    marcas(pose) {
      // venas de pétalo en el costado
      ctx.strokeStyle = 'rgba(255,225,240,0.3)';
      ctx.lineWidth = 0.9;
      for (let i = 0; i < 7; i++) trazo.linea(ctx, pose.en(0.3 + i * 0.08, 1), pose.en(0.35 + i * 0.08, 0.4), pose.en(0.44 + i * 0.08, -0.1));
    },
  });
  // la corola dorsal: pétalos donde otros llevan aleta
  const { en } = g, t = world.time;
  const gr = ctx.createLinearGradient(en(0.38, 1).x, en(0.38, 1).y, en(0.42, 0, 2.6).x, en(0.42, 0, 2.6).y);
  gr.addColorStop(0, '#d0548f');
  gr.addColorStop(1, '#ffe0ee');
  ctx.fillStyle = gr;
  for (const k of [-2, 2, -1, 1, 0]) {
    const va = Math.sin(t * 0.8 + pez.seed + k) * 0.06;
    const punta = en(0.4 + k * 0.07 + va * 0.2, 0, 2.5 - Math.abs(k) * 0.45);
    trazo.forma(ctx, en(0.38, 0.8), en(0.34 + k * 0.06, 0, 1.6), punta, en(0.44 + k * 0.065, 0, 1.55), en(0.4, 0.8));
    ctx.globalAlpha *= 0.88;
    ctx.fill();
    ctx.globalAlpha /= 0.88;
  }
  const c = en(0.39, 0.85);
  trazo.halo(ctx, c.x, c.y, pez.maxW * 1.4, [255, 220, 150], 0.5);
  trazo.punto(ctx, c, pez.maxW * 0.18, '#ffe8a0');
}

/* ============================================================
   ANGUILAS
   ============================================================ */
function pintarAnguila(pez, ctx, o) {
  const { linea, forma } = trazo, { tono, css } = luz;
  const g = trazo.pose(pez, { rigidez: 0.12 });
  const { en } = g, t = world.time, morro = g.W[0] * 2.5;
  if (o.cinta) {
    // aleta continua con una onda que viaja hacia la cola
    for (const lado of [1, -1]) {
      const t0 = lado > 0 ? 0.1 : 0.45, n = 22, borde = [];
      for (let i = 0; i <= n; i++) {
        const f = lerp(t0, 1.03, i / n);
        const alto = Math.min(1, i / 3) * (0.8 + 0.22 * Math.sin(i * 1.05 - t * 2.4 + pez.seed)) * (lado > 0 ? 1 : 0.55);
        borde.push(en(f, lado * 0.7, lado * alto * (o.altoCinta || 1)));
      }
      ctx.fillStyle = css(luz.mezcla(o.cinta, o.lomo, lado > 0 ? 0 : 0.3), o.opacidad ?? 0.6);
      ctx.beginPath();
      const ini = en(t0, 0);
      ctx.moveTo(ini.x, ini.y);
      for (const p of borde) ctx.lineTo(p.x, p.y);
      for (let i = n; i >= 0; i--) {
        const p = en(lerp(t0, 1, i / n), 0);
        ctx.lineTo(p.x, p.y);
      }
      ctx.fill();
      ctx.strokeStyle = css(o.cinta, 0.35);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 1; i < n; i++) {
        const a = en(lerp(t0, 1, i / n) - 0.015, lado * 0.6);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(borde[i].x, borde[i].y);
      }
      ctx.stroke();
    }
  }
  trazo.volumen(ctx, g, morro, o.lomo, o.vientre, o.marcas && (() => o.marcas(g)));
  if (!o.sinCara) {
    // boca que se abre y cierra: solo está respirando
    const abre = Math.max(0, Math.sin(t * 0.9 + pez.seed)) * 0.5;
    const punta = -morro / pez.len;
    ctx.fillStyle = 'rgba(10,18,22,0.7)';
    forma(ctx, en(punta * 0.96, -0.1), en(0, -0.14), en(0.035, -0.22), en(0.005, -0.3 - abre * 0.5), en(punta * 0.7, -0.22 - abre * 0.8));
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,18,22,0.4)';
    ctx.lineWidth = 0.7;
    linea(ctx, en(0.09, 0.2), en(0.1, 0), en(0.09, -0.2));
    const e = en(0.006, 0.34);
    trazo.ojo(ctx, e.x, e.y, Math.max(1.4, pez.maxW * 0.18), tono(o.iris));
  }
  return g;
}

function drawMorena(pez, ctx) {
  pintarAnguila(pez, ctx, {
    lomo: '#4c6b35', vientre: '#b9c47c', cinta: '#6f8f4a', opacidad: 0.75, iris: '#f2d26a',
    marcas(g) {
      for (let i = 0; i < 64; i++) {
        const p = g.en((i * 0.618) % 1, Math.sin(i * 2.4 + pez.seed) * 0.72);
        trazo.punto(ctx, p, pez.maxW * (0.07 + (i % 4) * 0.04), i % 3 ? 'rgba(36,54,22,0.3)' : 'rgba(220,226,150,0.3)');
      }
    },
  });
}

function drawElectrica(pez, ctx) {
  const g = pintarAnguila(pez, ctx, {
    lomo: '#464b2c', vientre: '#dcae5c', cinta: '#97854a', altoCinta: 0.7, iris: '#ffe9a0',
    marcas(pose) {
      for (let i = 0; i < 26; i++) trazo.punto(ctx, pose.en(0.1 + i * 0.033, -0.15), 0.9, 'rgba(255,226,140,0.55)');
    },
  });
  // la corriente que le queda recorre el costado
  const desde = world.time - pez.lastZap;
  const resto = desde < 1.6 ? 1 - desde / 1.6 : 0;
  for (let i = 0; i < 8; i++) {
    const k = Math.max(0, Math.sin(world.time * 1.4 - i * 0.8 + pez.seed));
    const p = g.en(0.15 + i * 0.1, -0.15);
    trazo.halo(ctx, p.x, p.y, 7 + resto * 18, [180, 230, 255], k * 0.2 + resto * 0.7);
  }
}

function drawCinta(pez, ctx) {
  const g = pintarAnguila(pez, ctx, {
    lomo: '#1747c4', vientre: '#6ab0ff', cinta: '#ffd84f', opacidad: 0.9, altoCinta: 1.2, iris: '#ffe9a0',
    marcas(pose) {
      trazo.franja(ctx, pose, 0.76, 0.98, 0, 0.99);
      ctx.fillStyle = 'rgba(255,220,90,0.7)';
      ctx.fill();
      trazo.punto(ctx, pose.en(-0.015, 0), pose.W[0] * 1.05, '#ffd63c');
    },
  });
  // hocico con apéndices nasales, como dos pétalos
  const va = Math.sin(world.time * 1.3 + pez.seed) * 0.3, { en } = g;
  ctx.fillStyle = '#ffd63c';
  for (const s of [1, -1]) {
    trazo.forma(ctx, en(-0.04, s * 0.2), en(-0.075, 0, s * 0.3), en(-0.095, 0, s * (1.2 + va)), en(-0.05, 0, s * 0.8), en(-0.03, s * 0.2));
    ctx.fill();
  }
}

function drawNeon(pez, ctx) {
  const t = world.time, brillo = 0.45 + world.abyssMix * 0.55;
  const g = trazo.pose(pez, { rigidez: 0.12 });
  const color = f => {
    // iridiscencia contenida: cian → violeta → rosa, y vuelta
    const k = 0.5 + 0.5 * Math.sin(f * 4 - t * 0.5 + pez.seed);
    return k < 0.5 ? luz.mezcla('#7ff5e8', '#86a8ff', k * 2) : luz.mezcla('#86a8ff', '#f0a4e8', (k - 0.5) * 2);
  };
  for (let i = 1; i < g.n; i += 4) trazo.halo(ctx, g.P[i].x, g.P[i].y, pez.maxW * 5, color(i / g.n), brillo * 0.45);
  trazo.cuerpo(ctx, g, g.W[0] * 2.5);
  ctx.fillStyle = 'rgba(12,28,60,0.8)';
  ctx.fill();
  const a = g.P[0], z = g.P[g.n - 1];
  const gr = ctx.createLinearGradient(a.x, a.y, z.x, z.y);
  for (let i = 0; i <= 5; i++) gr.addColorStop(i / 5, luz.css(color(i / 5), 0.9));
  ctx.strokeStyle = gr;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // el filamento de luz que guarda dentro
  trazo.franja(ctx, g, -0.28, 0.28, 0.02, 0.98);
  ctx.fillStyle = gr;
  ctx.fill();
  trazo.franja(ctx, g, -0.07, 0.07, 0.05, 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
  const e = g.en(0, 0.4);
  trazo.punto(ctx, e, 1.6, '#fff');
  trazo.halo(ctx, e.x, e.y, 6, [220, 250, 255], 0.8);
  // la luz que devuelve a plazos
  if (Math.random() < 0.18) {
    world.sparks.push({
      x: z.x, y: z.y,
      vx: rand(-6, 6), vy: rand(-10, 1),
      life: rand(0.9, 1.8), age: 0,
      hue: 175 + (t * 12 + pez.seed * 30) % 140,
    });
  }
}

function drawSacacorchos(pez, ctx) {
  pintarAnguila(pez, ctx, {
    lomo: '#b5825f', vientre: '#fbe9cd', cinta: '#f4d8b4', opacidad: 0.5, iris: '#e8c79a',
    marcas(g) {
      // una hélice de verdad: media vuelta por delante, media escondida
      ctx.fillStyle = 'rgba(128,74,46,0.45)';
      for (let k = 0; k < 13; k++) {
        const f = (k / 12 + world.time * 0.03) % (13 / 12) - 0.04;
        if (f < 0 || f > 0.93) continue;
        trazo.forma(ctx, g.en(f, 0.94), g.en(f + 0.035, 0.1), g.en(f + 0.06, -0.9),
          g.en(f + 0.07, -0.9), g.en(f + 0.085, -0.88), g.en(f + 0.06, 0.1), g.en(f + 0.025, 0.94));
        ctx.fill();
      }
    },
  });
}

/* anguila pelícano: una boca con anguila detrás */
function drawPelicano(pez, ctx) {
  const g = trazo.pose(pez, { rigidez: 0.12 });
  const { en } = g, t = world.time;
  const abre = 0.6 + 0.3 * Math.sin(t * 0.6 + pez.seed);
  // la bolsa, translúcida
  const a = en(-0.1, 0.2), b = en(0.1, 0, -3.6 * abre);
  const bolsa = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  bolsa.addColorStop(0, luz.tono('#1a1022'));
  bolsa.addColorStop(1, luz.tono('#5c3a64', 0.8));
  ctx.fillStyle = bolsa;
  trazo.forma(ctx, en(-0.13, 0.3), en(-0.06, 0, -3.2 * abre), en(0.08, 0, -3.1 * abre), en(0.22, 0, -2.4 * abre), en(0.25, -0.5), en(0.1, 0.2), en(-0.13, 0.3));
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,140,210,0.4)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  for (let k = 1; k < 4; k++) trazo.linea(ctx, en(-0.06 + k * 0.05, 0), en(-0.02 + k * 0.05, 0, -1.4 * abre), en(0.02 + k * 0.06, 0, -2.5 * abre));
  trazo.volumen(ctx, g, pez.len * 0.1, '#33223e', '#120d1a');
  trazo.punto(ctx, en(-0.06, 0.25), 1.3, '#b8d4e0');
  // fotóforo rojo en la punta de la cola
  const z = g.P[g.n - 1], k = 0.6 + 0.4 * Math.sin(t * 1.1 + pez.seed);
  trazo.halo(ctx, z.x, z.y, 18, [255, 100, 110], k);
  trazo.punto(ctx, z, 1.5, `rgba(255,190,180,${k})`);
}

/* congrio: el primo serio de la morena, custodio del casco */
function drawCongrio(pez, ctx) {
  pintarAnguila(pez, ctx, {
    lomo: '#3f545e', vientre: '#c3cfce', cinta: '#8fa6aa', iris: '#d5e2e2',
    marcas(g) {
      trazo.franja(ctx, g, 0.02, 0.1, 0.1, 0.95);
      ctx.fillStyle = 'rgba(230,240,235,0.3)';
      ctx.fill();
    },
  });
}

function drawRaiz(pez, ctx) {
  const g = trazo.pose(pez, { rigidez: 0.12 });
  // raicillas que tantean la arena
  ctx.strokeStyle = luz.tono('#8c6478', 0.8);
  ctx.lineCap = 'round';
  for (let i = 1; i < 10; i++) {
    const f = i / 10, va = Math.sin(world.time * 0.6 + i * 1.7) * 0.02;
    ctx.lineWidth = 1.5 - f * 0.7;
    trazo.linea(ctx, g.en(f, -0.6), g.en(f + 0.02, 0, -1.3), g.en(f + 0.05 + va, 0, -1.9 - (i % 3) * 0.3));
  }
  const pose = pintarAnguila(pez, ctx, {
    lomo: '#55394a', vientre: '#bc9cae', iris: '#ead8e4',
    marcas(p) {
      ctx.strokeStyle = 'rgba(40,22,34,0.3)';
      ctx.lineWidth = 0.9;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const q = p.en(i / 16, -0.6 + k * 0.4 + Math.sin(i * 0.9 + k * 2) * 0.12);
          if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
        }
        ctx.stroke();
      }
    },
  });
  // un brote en la frente: la raíz también quiere su flor
  const { en } = pose;
  ctx.fillStyle = '#f2b4d4';
  trazo.forma(ctx, en(0.05, 0.8), en(0.01, 0, 1.4), en(0.035, 0, 2.1), en(0.075, 0, 1.4), en(0.055, 0.8));
  ctx.fill();
}

/* ---------- la descarga de la anguila eléctrica ---------- */
function pintarDescarga(e, ctx) {
  const f = e.t / e.dur, k = (1 - f) * Math.min(1, f * 6);
  trazo.halo(ctx, e.x, e.y, 50 + f * 130, [130, 210, 255], 0.55 * k);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(150,225,255,${0.3 * k})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, f * 170, 0, TAU); ctx.stroke();
  if (!luz.reducido) {
    // filamentos curvos en lugar de rayos quebrados
    ctx.lineCap = 'round';
    for (const pts of e.bolts) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 1; i < pts.length - 1; i++) {
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
      }
      ctx.strokeStyle = `rgba(160,225,255,${0.2 * k})`;
      ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = `rgba(235,250,255,${0.6 * k})`;
      ctx.lineWidth = 0.9; ctx.stroke();
    }
  }
  ctx.restore();
}
