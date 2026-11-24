/* ============================================================
   ACUARIO ABISAL — luz
   Color, halos, giros suaves y vigilancia del rendimiento.
   Sin estado de juego: solo ayuda a pintar. Cargar antes de
   dibujo.js (en ejecución usa world, TAU, clamp y lerp).
   ============================================================ */
'use strict';

const luz = (() => {
  const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducido = preferencia.matches;
  preferencia.addEventListener?.('change', e => { reducido = e.matches; });

  /* ---------- color ---------- */
  const _rgb = new Map();
  function rgb(color) {
    if (Array.isArray(color)) return color;
    let v = _rgb.get(color);
    if (!v) {
      const n = parseInt(color.slice(1), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      _rgb.set(color, v);
    }
    return v;
  }

  function mezcla(a, b, t) {
    const p = rgb(a), q = rgb(b);
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  }

  function css(color, a = 1) {
    const c = rgb(color);
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  }

  /* El agua tiñe lo que vive en ella: más cuanto más hondo y más oscuro.
     aquarium.js actualiza `agua` cada fotograma; los retratos la anulan. */
  let agua = null;   // [r, g, b] del agua a media altura
  let hondura = 0;   // 0 arriba → 1 en la arena, del ejemplar que se está pintando

  function tono(color, a = 1) {
    if (!agua) return css(color, a);
    return css(mezcla(color, agua, 0.03 + hondura * 0.12 + world.abyssMix * 0.2), a);
  }

  /* ---------- halos ---------- */
  // un sprite por color: mucho más barato que un degradado radial por halo
  const _halos = new Map();
  function spriteHalo(c) {
    const r = Math.min(255, Math.round(c[0] / 8) * 8);
    const g = Math.min(255, Math.round(c[1] / 8) * 8);
    const b = Math.min(255, Math.round(c[2] / 8) * 8);
    const clave = (r << 16) | (g << 8) | b;
    let cv = _halos.get(clave);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const x = cv.getContext('2d');
    const gr = x.createRadialGradient(48, 48, 0, 48, 48, 48);
    // caída casi gaussiana: llega a cero sin que se vea el borde
    for (let i = 0; i <= 10; i++) {
      const d = i / 10;
      gr.addColorStop(d, `rgba(${r},${g},${b},${Math.exp(-d * d * 5) * (1 - d)})`);
    }
    x.fillStyle = gr;
    x.fillRect(0, 0, 96, 96);
    _halos.set(clave, cv);
    return cv;
  }

  function halo(ctx, x, y, r, color, a = 1) {
    if (a <= 0.004 || r <= 0) return;
    // a media vuelta las luces no se doblan con el cuerpo: viajan con él, redondas
    if (captura && ctx === captura.ctx) {
      const T = ctx.getTransform();
      captura.luces.push({
        x: T.a * x + T.c * y + T.e, y: T.b * x + T.d * y + T.f,
        r: r * Math.hypot(T.a, T.b), color, a: ctx.globalAlpha * Math.min(1, a),
      });
      return;
    }
    const alfa = ctx.globalAlpha, modo = ctx.globalCompositeOperation;
    ctx.globalAlpha = alfa * Math.min(1, a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(spriteHalo(rgb(color)), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = alfa;
    ctx.globalCompositeOperation = modo;
  }

  /* igual que halo, pero tapa en lugar de sumar: humo, sombras, bruma */
  function nube(ctx, x, y, rx, ry, color, a = 1) {
    if (a <= 0.004) return;
    const alfa = ctx.globalAlpha;
    ctx.globalAlpha = alfa * Math.min(1, a);
    ctx.drawImage(spriteHalo(rgb(color)), x - rx, y - ry, rx * 2, ry * 2);
    ctx.globalAlpha = alfa;
  }

  /* ---------- movimiento ---------- */
  /* Persigue un valor con el reloj del mundo. Vive en el dibujo a propósito:
     suaviza lo que se ve sin tocar la simulación. */
  function seguir(c, campo, objetivo, ritmo) {
    const memo = c._luz || (c._luz = {});
    let m = memo[campo];
    if (!m) m = memo[campo] = { v: objetivo, t: world.time };
    const dt = Math.min(0.1, Math.max(0, world.time - m.t));
    m.t = world.time;
    m.v += (objetivo - m.v) * (1 - Math.exp(-ritmo * dt));
    return m.v;
  }

  /* media vuelta gradual: −1 mira a la izquierda · 1 a la derecha.
     Un muelle sin rebote: la vuelta arranca despacio, como un pez que
     decide girar, en vez de saltar de golpe y frenar al final. */
  let captura = null; // el ejemplar que se está pintando a media vuelta
  function giro(c, sentido, ritmo = 4.5) {
    const memo = c._luz || (c._luz = {});
    const obj = sentido < 0 ? -1 : 1;
    let m = memo.giro;
    if (!m) m = memo.giro = { v: obj, vel: 0, obj, t: world.time };
    let dt = Math.min(0.1, Math.max(0, world.time - m.t));
    m.t = world.time;
    m.obj = obj;
    const w = ritmo * 1.7;
    while (dt > 1e-6) {
      const h = Math.min(dt, 1 / 120);
      m.vel += (w * w * (obj - m.v) - 2 * w * m.vel) * h;
      m.v += m.vel * h;
      dt -= h;
    }
    if (Math.abs(m.v) > 1) { m.v = Math.sign(m.v); m.vel = 0; }
    if (captura && captura.c === c && !captura.listo) return fijar(m);
    // nunca cero exacto: un cuerpo de canto sigue teniendo grosor
    return Math.abs(m.v) < 0.08 ? (m.v < 0 ? -0.08 : 0.08) : m.v;
  }

  /* coloca el lienzo mirando hacia donde nada, siempre boca arriba */
  function orientar(ctx, c, vx, vy, inclinacion = 1) {
    const memo = c._luz || (c._luz = {});
    // zona muerta: una velocidad que tiembla en torno a cero no es una vuelta
    if (memo.sentido === undefined) memo.sentido = vx < 0 ? -1 : 1;
    if (Math.abs(vx) > 0.3 * Math.hypot(vx, vy)) memo.sentido = vx < 0 ? -1 : 1;
    const g = giro(c, memo.sentido);
    const cabeceo = seguir(c, 'cabeceo', clamp(Math.atan2(vy, Math.abs(vx) + 1e-3) * inclinacion, -0.75, 0.75), 5);
    if (captura && captura.c === c) { captura.cabeceo = cabeceo; return 1; }
    ctx.scale(g, 1);
    ctx.rotate(cabeceo);
    return g;
  }

  /* ---------- la vuelta con volumen ----------
     Escalar el dibujo de 1 a −1 lo hacía girar como un naipe. Ahora, mientras
     dura la vuelta, el pez se pinta de perfil en un lienzo aparte y se vuelve
     a componer en lonchas verticales: cada loncha gira según su sitio en el
     cuerpo, la cabeza primero y la cola después, siguiendo la curva que traza
     un cuerpo de verdad. Las lonchas que quedan de canto se oscurecen y las
     que se acercan crecen un poco: así se lee la hondura. */
  // A: el perfil · B: la vuelta compuesta · C: el perfil en sombra
  let lienzosV = null, cupo = 0, cupoT = -1;
  function lienzos(S) {
    if (!lienzosV || lienzosV[0].canvas.width < S) {
      const L = Math.min(1600, Math.max(S, lienzosV ? lienzosV[0].canvas.width * 1.5 : 256) | 0);
      lienzosV = [0, 1, 2].map(() => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = L;
        return cv.getContext('2d');
      });
    }
    return lienzosV;
  }

  function fijar(m) {
    // el perfil se pinta siempre mirando a la derecha y sin cabeceo
    const x = captura.ctx, T = x.getTransform();
    captura.k = Math.hypot(T.a, T.b);
    captura.rho = Math.atan2(T.b, T.a);
    captura.e = T.e; captura.f = T.f;
    captura.v = m.v; captura.obj = m.obj;
    captura.listo = true;
    x.setTransform(captura.k, 0, 0, captura.k, T.e, T.f);
    return 1;
  }

  const enVuelta = m => m && (Math.abs(m.obj - m.v) > 0.02 || Math.abs(m.vel) > 0.05);

  /* Cuánto mide cada especie de perfil, en unidades de su tamaño. Se mide
     una vez, leyendo los píxeles de su primera vuelta: el cuerpo (lo opaco)
     decide qué parte gira primero; el todo (con halos) el tamaño del lienzo. */
  const medidas = new Map();
  const tam = c => c.len || c.r || 1;
  let medidor = null;
  function medirPerfil(c, A, cap, S) {
    // se lee en un lienzo propio, de CPU: leer el de la GPU la frenaría
    if (!medidor) medidor = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (medidor.canvas.width < S) medidor.canvas.width = medidor.canvas.height = S;
    medidor.clearRect(0, 0, S, S);
    medidor.drawImage(A.canvas, 0, 0, S, S, 0, 0, S, S);
    const d = medidor.getImageData(0, 0, S, S).data, u = cap.k * tam(c);
    let cx0 = S, cx1 = -1, tx0 = S, tx1 = -1, ty0 = S, ty1 = -1;
    for (let y = 0; y < S; y++) {
      for (let x = 0, i = y * S * 4 + 3; x < S; x++, i += 4) {
        const al = d[i];
        if (al > 4) { if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y; }
        if (al > 140) { if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; }
      }
    }
    // casi transparente (una constelación): el cuerpo es todo lo que se ve
    if (cx1 < 0) { cx0 = tx0; cx1 = tx1; }
    if (cx1 < 0) { cx0 = cap.e - u; cx1 = cap.e + u; tx0 = cx0; tx1 = cx1; ty0 = ty1 = cap.f; }
    const m = {
      cola: (cap.e - cx0) / u, cabeza: (cx1 - cap.e) / u,
      todo: Math.max(cap.e - tx0, tx1 - cap.e, cap.f - ty0, ty1 - cap.f) / u,
    };
    medidas.set(c.key, m);
    return m;
  }

  function vuelta(c, ctx, pintar) {
    const m = c._luz && c._luz.giro;
    if (world.time !== cupoT) { cupoT = world.time; cupo = calidad === 2 ? 48 : 20; }
    if (!enVuelta(m) || calidad === 0 || cupo <= 0) return pintar(c, ctx);
    const T = ctx.getTransform(), k = Math.hypot(T.a, T.b);
    const med = medidas.get(c.key);
    // lo diminuto (una sardina del banco) no deja ver la diferencia: vuelta sencilla
    // (sin medir aún no se sabe: se mide primero; el mero no tiene len ni r)
    if (med && (med.cola + med.cabeza) * tam(c) * k < 44) return pintar(c, ctx);
    // sin medida aún: un lienzo holgado, que se mide al acabar
    const radio = med ? med.todo * tam(c) * 1.15 + 3 : Math.max(c.len || 0, (c.r || 0) * 2, 40) * 2.5;
    const S = 2 * Math.ceil(radio * k + 2);
    if (S < 16 || S > 1600) return pintar(c, ctx);
    cupo--;
    const [A, B, C] = lienzos(S);
    const px = T.a * c.x + T.c * c.y + T.e, py = T.b * c.x + T.d * c.y + T.f;
    const ox = Math.round(px - S / 2), oy = Math.round(py - S / 2);
    for (const x of [A, B, C]) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, S, S);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
    }
    A.setTransform(T.a, T.b, T.c, T.d, T.e - ox, T.f - oy);
    captura = { c, ctx: A, listo: false, cabeceo: 0, luces: [] };
    let cap;
    try { pintar(c, A); } finally { cap = captura; captura = null; }
    const cuerpo = cap.listo && (med || medirPerfil(c, A, cap, S));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let lugar = (x, y) => [x, y];
    if (cuerpo) {
      const u = cap.k * tam(c);
      lugar = doblar(c, cap, A.canvas, B, C, S, cuerpo.cola * u, cuerpo.cabeza * u);
      ctx.drawImage(B.canvas, 0, 0, S, S, ox, oy, S, S);
    } else {
      ctx.drawImage(A.canvas, 0, 0, S, S, ox, oy, S, S);
    }
    for (const l of cap.luces) {
      const [x, y] = lugar(l.x, l.y);
      halo(ctx, ox + x, oy + y, l.r, l.color, l.a);
    }
    ctx.restore();
  }

  /* cola y cabeza: hasta dónde llega el cuerpo a cada lado del eje, en píxeles */
  function doblar(c, cap, fuente, B, C, S, cola, cabeza) {
    const F0 = -cap.obj;                       // hacia donde miraba
    const p = clamp((1 + cap.v * cap.obj) / 2, 0, 1); // 0 al empezar · 1 al acabar
    const retraso = 0.55;                      // lo que tarda la cola en seguir a la cabeza
    // la cabeza viene hacia quien mira: alejándose, el cuerpo la taparía y
    // la vuelta volvería a leerse plana
    const hacia = 1;
    const largo = Math.max(4, cola + cabeza);
    // lonchas por todo el lienzo (los halos también giran): finas en el cuerpo
    // y nunca más de unos pocos píxeles de pantalla, o se verían escalones
    const n = Math.round(clamp(S / Math.min(Math.max(3, largo / 14), 5), 8, 120)), du = S / n;
    const u = i => -cap.e + i * du;            // borde izquierdo de la loncha i, desde el eje
    const phi = new Float32Array(n), X = new Float32Array(n + 1), Z = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) {
      const w = clamp((u(i) + du / 2 + cola) / largo, 0, 1); // 0 cola · 1 cabeza
      const q = clamp(p * (1 + retraso) - retraso * (1 - w), 0, 1);
      phi[i] = Math.PI * q * q * (3 - 2 * q);
    }
    // la curva del cuerpo: se recorre de punta a punta y se ancla en el eje
    for (let j = 1; j <= n; j++) {
      X[j] = X[j - 1] + Math.cos(phi[j - 1]) * du;
      Z[j] = Z[j - 1] + Math.sin(phi[j - 1]) * du;
    }
    const j0 = clamp(Math.floor(cap.e / du), 0, n - 1), r0 = cap.e - j0 * du;
    const X0 = X[j0] + Math.cos(phi[j0]) * r0, Z0 = Z[j0] + Math.sin(phi[j0]) * r0;
    for (let j = 0; j <= n; j++) { X[j] -= X0; Z[j] -= Z0; }
    const th = cap.rho + cap.v * cap.cabeceo, co = Math.cos(th), si = Math.sin(th);
    /* Cada loncha se coloca por su centro. De canto no se queda en nada:
       un cuerpo tiene grosor, y esa franja estirada se lee como su costado
       redondo en vez de como el filo de un papel doblado. */
    const grosor = largo * 0.09 / du;
    // solo el cuerpo tiene grosor: un haz de luz o una aleta suelta, no
    const dentro = i => { const x = u(i) + du / 2; return x > -cola && x < cabeza; };
    const ancho = i => {
      const c0 = Math.cos(phi[i]), s0 = Math.sin(phi[i]);
      const a = Math.max(Math.abs(c0), dentro(i) ? grosor * s0 : 0, 0.03);
      return (F0 * c0 < 0 ? -a : a);
    };
    const tira = (i, sx, sy) => {
      const uc = u(i) + du / 2, tx = F0 * (X[i] + X[i + 1]) / 2 - sx * uc;
      B.setTransform(co * sx, si * sx, -si * sy, co * sy, cap.e + co * tx, cap.f + si * tx);
    };
    const orden = [];
    for (let i = 0; i < n; i++) orden.push(hacia > 0 ? i : n - 1 - i); // lo lejano primero
    // lo que se acerca crece un poco
    // y lo que queda de canto se recoge un poco: el borde se redondea
    const escala = i => (1 + 0.2 * hacia * (Z[i] + Z[i + 1]) / largo) * (0.86 + 0.14 * Math.abs(Math.cos(phi[i])));
    // un pelo de solape: sin costuras entre lonchas
    const solape = sx => Math.min(du * 0.5, 0.6 / Math.abs(sx));
    // la misma figura en sombra: de canto se ve menos luz. Cada loncha se
    // oscurece con su propia copia, así las que se solapan no se suman
    C.setTransform(1, 0, 0, 1, 0, 0);
    C.drawImage(fuente, 0, 0, S, S, 0, 0, S, S);
    C.globalCompositeOperation = 'source-atop';
    C.fillStyle = 'rgb(6,16,26)';
    C.fillRect(0, 0, S, S);
    C.globalCompositeOperation = 'source-over';
    for (const i of orden) {
      const sx = ancho(i), o = solape(sx);
      tira(i, sx, escala(i));
      const x0 = Math.max(0, cap.e + u(i) - o), x1 = Math.min(S, cap.e + u(i) + du + o);
      B.drawImage(fuente, x0, 0, x1 - x0, S, x0 - cap.e, -cap.f, x1 - x0, S);
      const sombra = (1 - Math.abs(Math.cos(phi[i]))) * 0.32;
      if (sombra > 0.01) {
        B.globalAlpha = sombra;
        B.drawImage(C.canvas, x0, 0, x1 - x0, S, x0 - cap.e, -cap.f, x1 - x0, S);
        B.globalAlpha = 1;
      }
    }
    // dónde acaba un punto del perfil después de la vuelta
    return (x, y) => {
      const i = clamp(Math.floor(x / du), 0, n - 1), sx = ancho(i), sy = escala(i);
      const lx = F0 * (X[i] + X[i + 1]) / 2 + sx * (x - cap.e - u(i) - du / 2), ly = sy * (y - cap.f);
      return [cap.e + co * lx - si * ly, cap.f + si * lx + co * ly];
    };
  }

  /* respiración lenta de toda la luz: un ciclo cada diez segundos */
  function respira(fase = 0) {
    return reducido ? 0.5 : 0.5 + 0.5 * Math.sin(world.time * TAU / 10 + fase);
  }

  /* ---------- azar propio del decorado ---------- */
  // el decorado no consume Math.random: así es siempre el mismo paisaje
  function azar(semilla) {
    let s = semilla >>> 0;
    const f = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.entre = (a, b) => a + (b - a) * f();
    f.de = arr => arr[Math.floor(f() * arr.length)];
    return f;
  }

  /* ---------- calidad adaptativa ---------- */
  // 2 completa · 1 agua más pequeña · 0 agua 2D y sin adornos caros
  let calidad = 2, media = 1 / 60, lento = 0;
  function medir(dt) {
    if (document.hidden || dt <= 0) return;
    media += (dt - media) * 0.03;
    // margen bajo 60: un bache suelto no cuenta, un sostenido sí
    lento = media > 1 / 53 ? lento + dt : Math.max(0, lento - dt * 2);
    if (lento > 1.5 && calidad > 0 && (calidad === 2 || media > 1 / 36)) {
      calidad--;
      lento = 0;
      media = 1 / 60;
    }
  }

  return {
    rgb, mezcla, css, tono, halo, nube, seguir, giro, orientar, vuelta, respira, azar, medir,
    get reducido() { return reducido; },
    get vaiven() { return reducido ? 0.2 : 1; }, // amplitud del decorado que se mece
    get calidad() { return calidad; },
    get agua() { return agua; },
    set agua(v) { agua = v; },
    set hondura(v) { hondura = v; },
  };
})();
