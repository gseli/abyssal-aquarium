/* ============================================================
   ACUARIO ABISAL — momentos
   La mirada de observador: lo que las criaturas hacen entre
   ellas. Dos por ecosistema: uno que ocurre solo y otro que
   provocas tú. Se completan fotografiándolos mientras ocurren.

   Un momento no toca los update(): actúa después, empujando al
   ejemplar, y le deja propiedades de pose que leen los dibujos.
   Requiere save.js, luz.js, creatures.js, biomes.js y audio.js.
   En ejecución usa state, countOf, spawnArrival y dismiss.
   ============================================================ */
'use strict';

/* clave aparte: una versión anterior del juego reescribe la partida
   solo con los campos que conoce, y aquí no puede borrarlos */
const MOMENTOS_KEY = 'acuario-abisal-momentos-v1';

const momentos = (() => {
  const { halo, css } = luz;
  const POSES = ['tenue', 'enterrada', 'baila', 'mira', 'retumba', 'mapa', 'borrado'];

  let fotos = {};
  try {
    const datos = JSON.parse(localStorage.getItem(MOMENTOS_KEY) || '{}');
    if (datos && typeof datos === 'object') fotos = datos;
  } catch (e) { /* álbum de momentos corrupto: se empieza de cero */ }

  /* ============================================================
     AYUDAS DE PUESTA EN ESCENA
     ============================================================ */
  const suave = v => { const x = clamp(v, 0, 1); return x * x * (3 - 2 * x); };
  const presente = c => !c.dead && !c.leaving;
  const dentro = c => c.x > -20 && c.x < world.W + 20;
  const de = key => world.creatures.filter(c => c.key === key && presente(c));
  const enEscena = key => de(key).filter(dentro);
  const cerca = (lista, x, y) => lista.slice().sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
  const suelo = x => world.floorY(x);

  /* si faltan compañeros vienen invitados, y al terminar se marchan */
  function reunir(m, key, n) {
    const faltan = Math.min(n, SPECIES[key].max) - de(key).length;
    if (faltan > 0) {
      const antes = new Set(world.creatures);
      spawnArrival(key, faltan);
      for (const c of world.creatures) {
        if (antes.has(c)) continue;
        c.invitado = true; // no cuenta como población tuya
        m.invitados.push(c);
      }
      updateCounts();
    }
    return de(key);
  }

  function participa(m, ...cs) {
    for (const c of cs) if (!m.actores.includes(c)) m.actores.push(c);
  }

  /* Acompaña a un ejemplar hacia un punto. El destino avanza a su paso y el
     cuerpo se funde con él según la fuerza: al soltar, sigue su vida desde ahí. */
  function llevar(m, c, tx, ty, vel, fuerza, dt) {
    let q = m.rumbos.get(c);
    if (!q) { q = { x: c.x, y: c.y }; m.rumbos.set(c, q); }
    const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy);
    if (d > 0.01) {
      const paso = Math.min(d, vel * Math.min(1, d / 50 + 0.15) * dt); // frena al llegar
      q.x += dx / d * paso;
      q.y += dy / d * paso;
    }
    c.x = lerp(c.x, q.x, fuerza);
    c.y = lerp(c.y, q.y, fuerza);
    if (c.baseY !== undefined) c.baseY = lerp(c.baseY, q.y, fuerza);
    if (c.spine) {
      if (d > 20) encarar(c, dx, dy, fuerza, dt);
    } else if (d > 14) {
      mirar(c, dx, dy * 0.4);
    }
  }

  /* los de espina giran con su límite, para que no se anuden */
  function encarar(c, dx, dy, fuerza, dt) {
    let da = Math.atan2(dy, dx) - Math.atan2(c.vel.y, c.vel.x);
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    const a = Math.atan2(c.vel.y, c.vel.x) + clamp(da, -1.8 * dt, 1.8 * dt) * fuerza;
    c.vel.x = Math.cos(a);
    c.vel.y = Math.sin(a);
  }

  function mirar(c, dx, dy = 0) {
    if ('dir' in c) c.dir = dx < 0 ? -1 : 1;
    if (!c.vel || c.spine) return;
    const v = norm(dx, dy), rapidez = Math.hypot(c.vel.x, c.vel.y) || 20;
    c.vel.x = v.x * rapidez;
    c.vel.y = v.y * rapidez;
  }

  function anillo(ctx, x, y, r, color, a, ancho = 1.4, achatado = 1) {
    if (a < 0.01 || r <= 0) return;
    ctx.strokeStyle = css(color, a);
    ctx.lineWidth = ancho;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * achatado, 0, 0, TAU);
    ctx.stroke();
  }

  function chispa(x, y, hue, empuje = 8) {
    world.sparks.push({
      x, y, vx: rand(-empuje, empuje), vy: rand(-empuje * 1.6, 0),
      life: rand(1, 2.2), age: 0, hue,
    });
  }

  /* la zona más poblada de la colonia de anguilas jardín */
  function centroColonia(lista) {
    let mejor = lista[0], vecinas = -1;
    for (const a of lista) {
      const n = lista.filter(b => Math.abs(b.x - a.x) < 160).length;
      if (n > vecinas) { vecinas = n; mejor = a; }
    }
    return mejor.x;
  }

  /* las invitadas brotan junto a la colonia, no en la otra punta */
  function juntarColonia(m, x) {
    m.invitados.forEach((c, i) => {
      const lado = i % 2 ? -1 : 1;
      c.x = clamp(x + lado * (Math.floor(i / 2) + 1) * 34, 30, world.W - 30);
      c.emerge = 0;
    });
  }

  /* ============================================================
     LOS DIEZ
     provoca: null (ocurre solo) · 'plancton' | 'luz' (cebo) · 'toque'
     puede()      ¿están quienes hacen falta?
     iniciar(m)   reparte papeles
     actuar(m)    cada fotograma, tras los update(); m.k es la envolvente
     focos(m)     dónde está lo fotografiable ahora mismo ([] = aún no)
     ============================================================ */
  const MOMENTOS = {

    /* ---------- arrecife ---------- */
    rastreo: {
      bioma: 'arrecife', especies: ['martillo', 'raya'], provoca: null, dur: 30,
      nombre: 'El detector de metales',
      pista: 'Algo con la cabeza en T barre la arena. La arena finge que no hay nadie debajo. No hagas nada: es lo que mejor se te da.',
      relato: 'La encontró por el campo eléctrico, la destapó y se marchó sin comérsela. Solo quería que ella supiera que lo sabía. Qué necesidad.',
      puede: () => enEscena('martillo').length && enEscena('raya').length,
      iniciar(m) {
        m.cazador = enEscena('martillo')[0];
        m.raya = cerca(enEscena('raya'), m.cazador.x, m.cazador.y)[0];
        participa(m, m.cazador, m.raya);
        m.sitio = clamp(m.raya.x, 110, world.W - 110);
        m.lado = m.cazador.x < m.sitio ? -1 : 1; // el lado por el que llega
      },
      actuar(m, dt) {
        const { cazador: c, raya: r } = m;
        const x = m.sitio, fl = suelo(x);
        if (m.hallada === undefined) {
          r.enterrada = suave(m.t / 3) * m.k;
          llevar(m, r, x, fl - 6, 70, m.k, dt);
          const barrido = Math.sin(m.t * 1.3) * 26;
          llevar(m, c, x + m.lado * 62 + barrido, fl - 112, 120, m.k * 0.9, dt);
          if (m.t > 5 && Math.abs(c.x - x) < 120 && c.y > fl - 200) m.sobre = (m.sobre || 0) + dt;
          if (m.sobre > 3.5 || m.t > 20) {
            m.hallada = m.t;
            m.dur = m.t + 8;
            for (let i = 0; i < 26; i++) chispa(x + rand(-44, 44), fl - 4, 44, 20);
          }
        } else {
          const p = m.t - m.hallada;
          r.enterrada = (1 - suave(p / 1.4)) * m.k;
          llevar(m, r, x - m.lado * 120, fl - 96, 75, m.k, dt); // se va por el otro lado
          encarar(c, -m.lado, 0.35, m.k, dt);
        }
      },
      pintar(m, ctx) {
        const { cazador: c, raya: r } = m, fl = suelo(m.sitio);
        if (m.hallada !== undefined) {
          const p = (m.t - m.hallada) / 3;
          if (p < 1) luz.nube(ctx, m.sitio, fl - 10 - p * 20, 50 + p * 80, 20 + p * 34, [196, 184, 150], 0.7 * (1 - p));
          return;
        }
        luz.nube(ctx, r.x, fl, 78, 14, [170, 160, 132], 0.7 * (r.enterrada || 0)); // el montículo
        const h = c.head();
        if (dist(h.x, h.y, m.sitio, fl) > 330) return;
        // el campo eléctrico, en pulsos que bajan hasta la arena
        for (let i = 0; i < 3; i++) {
          const f = (m.t * 0.5 + i / 3) % 1;
          anillo(ctx, lerp(h.x, m.sitio, f), lerp(h.y, fl, f), 10 + f * 34, [190, 240, 255], 0.75 * Math.sin(f * Math.PI) * m.k, 1.2, 0.35);
        }
        halo(ctx, m.sitio, fl - 4, 40, [170, 225, 255], 0.3 * m.k);
      },
      focos(m) {
        if (dist(m.cazador.x, m.cazador.y, m.sitio, suelo(m.sitio)) > 260) return [];
        return [{ x: m.raya.x, y: m.raya.y }, { x: m.sitio, y: suelo(m.sitio) - 40 }];
      },
    },

    saludo: {
      bioma: 'arrecife', especies: ['faroluz'], provoca: 'luz', dur: 15,
      nombre: 'La cortesía de los faroles',
      pista: 'Quien vive de su farol sabe de modales. Embotella un poco de luz, déjala cerca y no interrumpas.',
      relato: 'Se cruzaron, bajaron la intensidad y se inclinaron. Nadie les ha enseñado a hacerlo. A ti te lo enseñaron y mira.',
      puede: () => enEscena('faroluz').length >= 1,
      iniciar(m) {
        const x = clamp(m.x, 110, world.W - 110);
        m.centro = { x, y: clamp(m.y, 140, suelo(x) - 70) };
        m.par = cerca(reunir(m, 'faroluz', 2), x, m.y).slice(0, 2).sort((a, b) => a.x - b.x);
        if (m.par.length < 2) return false;
        participa(m, ...m.par);
      },
      actuar(m, dt) {
        const { x, y } = m.centro;
        let juntos = true;
        m.par.forEach((c, i) => {
          const tx = x + (i ? 44 : -44), ty = y + Math.sin(m.t * 1.4) * 4;
          llevar(m, c, tx, ty, 190, m.k, dt);
          if (Math.abs(c.x - x) < 90) mirar(c, x - c.x);
          if (dist(c.x, c.y, tx, ty) > 50) juntos = false;
        });
        if (juntos && m.juntos === undefined) { m.juntos = m.t; m.dur = Math.max(m.dur, m.t + 8); }
        const p = m.juntos === undefined ? 0 : suave((m.t - m.juntos) / 1.5);
        // dos inclinaciones lentas, por si la primera no se notó
        for (const c of m.par) c.tenue = p * m.k * (0.75 + 0.25 * Math.sin(m.t * 1.6));
      },
      pintar(m, ctx) {
        if (m.juntos === undefined) return;
        const p = suave((m.t - m.juntos) / 2) * m.k;
        halo(ctx, m.centro.x, m.centro.y - 10, 100, [255, 170, 180], 0.28 * p);
        for (let i = 0; i < 7; i++) {
          const a = m.t * 0.4 + i / 7 * TAU;
          halo(ctx, m.centro.x + Math.cos(a) * 24, m.centro.y - 22 + Math.sin(a) * 9, 6, [255, 225, 190], 0.8 * p);
        }
      },
      focos: m => (m.juntos === undefined ? [] : [m.centro]),
    },

    /* ---------- mar burbujeante ---------- */
    susto: {
      bioma: 'burbujeante', especies: ['globo', 'jardin'], provoca: null, dur: 28,
      nombre: 'La ola de timidez',
      pista: 'Una esfera con problemas de autoestima se pasea sobre un césped muy nervioso. Espera. Se contagia.',
      relato: 'Él se asustó de ellas, ellas de que él se asustara, y la pradera entera se escondió por orden de cercanía. No había ningún peligro. Precioso.',
      puede: () => enEscena('globo').length && enEscena('jardin').length,
      iniciar(m) {
        m.x = centroColonia(de('jardin'));
        m.colonia = reunir(m, 'jardin', 6);
        juntarColonia(m, m.x);
        m.globo = cerca(enEscena('globo'), m.x, suelo(m.x))[0];
        participa(m, m.globo, ...m.colonia);
      },
      actuar(m, dt) {
        const g = m.globo, y = suelo(m.x) - 88;
        llevar(m, g, m.x, y, 120, m.k, dt);
        if (m.susto === undefined) {
          if ((dist(g.x, g.y, m.x, y) < 34 && m.t > 3.5) || m.t > 17) { m.susto = m.t; m.dur = m.t + 10; }
          return;
        }
        const p = m.t - m.susto;
        g.inflate = Math.max(g.inflate, suave(p * 1.6) * (1 - suave((p - 6) / 3)));
        for (const c of m.colonia) {
          const retraso = Math.abs(c.x - m.x) / 190;
          // se esconden en ola y vuelven a asomar en el mismo orden
          c.shy = Math.max(c.shy, suave((p - retraso) * 2) * (1 - suave((p - 4 - retraso) / 1.6)));
        }
      },
      pintar(m, ctx) {
        if (m.susto === undefined) return;
        const p = m.t - m.susto, fl = suelo(m.x);
        for (const d of [0, 0.7]) {
          const r = (p - d) * 190;
          anillo(ctx, m.x, fl, r, [240, 250, 225], 0.5 * Math.max(0, 1 - (p - d) / 3.2), 1.3, 0.12);
        }
      },
      focos: m => (m.susto === undefined ? [] : [{ x: m.globo.x, y: m.globo.y }, { x: m.x, y: suelo(m.x) - 50 }]),
    },

    baile: {
      bioma: 'burbujeante', especies: ['jardin'], provoca: 'plancton', dur: 14,
      nombre: 'Coreografía para césped',
      pista: 'Los signos de interrogación solo se ponen de acuerdo en una cosa: la cena. Sírvesela encima.',
      relato: 'Una colonia entera moviéndose a la vez por un puñado de plancton. Han ensayado toda la vida, cada una en su agujero, sin verse.',
      puede: () => enEscena('jardin').some(c => Math.abs(c.x - momentoPunto.x) < 220 && momentoPunto.y > world.H * 0.45),
      iniciar(m) {
        const x = cerca(de('jardin'), m.x, m.y)[0].x;
        m.colonia = reunir(m, 'jardin', 7);
        juntarColonia(m, x);
        m.colonia = m.colonia.filter(c => Math.abs(c.x - x) < 340);
        m.centro = x;
        participa(m, ...m.colonia);
      },
      actuar(m) {
        for (const c of m.colonia) {
          c.baila = suave((m.t - Math.abs(c.x - m.centro) / 250) / 1.4) * m.k;
          c.faseBaile = m.t * 2.3;
          c.shy *= 1 - c.baila; // se les olvida que las miras
        }
        if (m.t > 1.5 && Math.random() < 0.25) {
          const c = pick(m.colonia), h = c.head();
          chispa(h.x + rand(-10, 10), h.y - rand(0, 30), 140);
        }
      },
      pintar(m, ctx) {
        for (const c of m.colonia) {
          if (!c.baila) continue;
          const tx = c.x + Math.sin(c.faseBaile - 2.4) * 20 * c.baila;
          halo(ctx, tx, suelo(c.x) - c.h * c.out() * 1.5, 20, [190, 255, 205], 0.35 * c.baila);
        }
      },
      focos: m => (m.t < 1.4 ? [] : m.colonia.map(c => c.head())),
    },

    /* ---------- abismo ---------- */
    contraluz: {
      bioma: 'abismo', especies: ['linterna', 'hacha'], provoca: null, dur: 22,
      nombre: 'El escondite vertical',
      pista: 'Uno vive mirando hacia arriba. El otro vive de que no lo vean desde abajo. Tarde o temprano coinciden.',
      relato: 'El hacha miró justo donde estaba el tiburón y vio agua iluminada. El tiburón pasó siendo agua iluminada. Los dos lo cuentan como victoria.',
      puede: () => enEscena('linterna').length && enEscena('hacha').length,
      iniciar(m) {
        m.sombra = enEscena('linterna')[0];
        m.vigila = cerca(enEscena('hacha'), m.sombra.x, m.sombra.y)[0];
        participa(m, m.sombra, m.vigila);
        const x = clamp(m.vigila.x, 170, world.W - 170);
        m.centro = { x, y: clamp(m.vigila.y, 260, suelo(x) - 90) };
      },
      actuar(m, dt) {
        const { x, y } = m.centro, s = m.sombra;
        llevar(m, m.vigila, x, y, 60, m.k, dt);
        llevar(m, s, x + Math.sin(m.t * 0.5) * 80, y - 100, 125, m.k * 0.9, dt);
        const sobre = Math.abs(s.x - x) < 170 && Math.abs(s.y - (y - 100)) < 70;
        m.encima = clamp((m.encima || 0) + (sobre ? 0.6 : -0.6) * dt, 0, 1);
        s.borrado = m.encima * m.k;
        m.vigila.mira = suave(m.t / 2) * m.k;
      },
      pintar(m, ctx) {
        const p = (m.encima || 0) * m.k;
        if (p < 0.02) return;
        const { x, y } = m.centro;
        // la poca luz que baja: exactamente la que él imita
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, y - 230, 0, y);
        g.addColorStop(0, css([80, 150, 220], 0));
        g.addColorStop(0.55, css([80, 150, 220], 0.16 * p));
        g.addColorStop(1, css([80, 150, 220], 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 4, y); ctx.lineTo(x - 90, y - 230); ctx.lineTo(x + 90, y - 230); ctx.lineTo(x + 4, y);
        ctx.fill();
        ctx.restore();
        halo(ctx, m.sombra.x, m.sombra.y, 90, [100, 190, 250], 0.12 * p);
      },
      focos: m => ((m.encima || 0) < 0.4 ? [] : [{ x: m.centro.x, y: m.centro.y - 50 }]),
    },

    mapa: {
      bioma: 'abismo', especies: ['constelacion'], provoca: 'luz', dur: 17,
      nombre: 'El mapa número 62',
      pista: 'Las estrellas sueltas no llevan a ninguna parte. Dales una luz de referencia y a ver qué dibujan.',
      relato: 'Unieron sus puntos y salió el mapa de esta expedición, con una marca donde estás tú. Se ha decidido no hacer más preguntas.',
      puede: () => enEscena('constelacion').length >= 1,
      iniciar(m) {
        const x = clamp(m.x, 170, Math.max(170, world.W - 170));
        m.centro = { x, y: clamp(m.y, 200, suelo(x) - 170) };
        m.estrellas = reunir(m, 'constelacion', 3).sort((a, b) => a.x - b.x);
        participa(m, ...m.estrellas);
      },
      actuar(m, dt) {
        const { x, y } = m.centro, n = m.estrellas.length;
        m.estrellas.forEach((c, i) => {
          const a = Math.PI + (i / n) * TAU + Math.sin(m.t * 0.2) * 0.1;
          llevar(m, c, x + Math.cos(a) * 112, y + Math.sin(a) * 74, 170, m.k, dt);
          c.mapa = suave((m.t - 2.5) / 2) * m.k;
        });
      },
      pintar(m, ctx) {
        const p = suave((m.t - 3) / 2.5) * m.k;
        if (p < 0.01) return;
        const { x, y } = m.centro;
        anillo(ctx, x, y, 150, [170, 205, 255], 0.22 * p, 0.8, 0.72);
        ctx.save();
        // la ruta, de constelación en constelación
        ctx.setLineDash([2, 6]);
        ctx.strokeStyle = css([200, 225, 255], 0.7 * p);
        ctx.lineWidth = 1;
        ctx.beginPath();
        m.estrellas.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // rosa de los vientos
        ctx.fillStyle = css([215, 232, 255], 0.65 * p);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU - Math.PI / 2, r = i % 2 ? 15 : 34;
          ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          ctx.lineTo(x + Math.cos(a + 1.3) * 4, y + Math.sin(a + 1.3) * 4);
          ctx.lineTo(x + Math.cos(a - 1.3) * 4, y + Math.sin(a - 1.3) * 4);
        }
        ctx.fill();
        ctx.restore();
        halo(ctx, x, y, 80, [140, 190, 255], 0.4 * p);
      },
      focos: m => (m.t < 4 ? [] : [m.centro]),
    },

    /* ---------- naufragio ---------- */
    retumbo: {
      bioma: 'naufragio', especies: ['mero', 'jureles'], provoca: null, dur: 24,
      nombre: 'Derecho de paso',
      pista: 'El dueño del barco tiene algo que decir y un tornado de peces en medio del pasillo. No pienses intervenir.',
      relato: '¡BUM! Lo dijo con la vejiga natatoria, que es como se dicen las cosas importantes. El tornado abrió un pasillo. Nadie discutió.',
      puede: () => enEscena('mero').length && enEscena('jureles').length,
      iniciar(m) {
        m.mero = enEscena('mero')[0];
        m.banco = reunir(m, 'jureles', 10);
        participa(m, m.mero, ...m.banco);
        m.golpes = [];
      },
      actuar(m, dt) {
        const g = m.mero, tx = world.wreck.mast.x + 30, ty = world.wreck.mast.y + 108;
        llevar(m, g, tx, ty, 75, m.k, dt);
        if (m.llega === undefined) {
          if ((dist(g.x, g.y, tx, ty) < 70 && m.t > 3) || m.t > 13) { m.llega = m.t; m.dur = m.t + 10; }
          return;
        }
        const p = m.t - m.llega;
        if (m.golpes.length < 3 && p >= m.golpes.length * 2.4) {
          m.golpes.push(m.t);
          audio.event('retumbo');
        }
        g.retumba = Math.max(0, 1 - (m.t - m.golpes[m.golpes.length - 1]) / 1.2);
        // media vuelta arriba, media abajo: un pasillo limpio
        const abre = suave(p / 1.5) * (1 - suave((p - 8) / 2));
        for (const c of m.banco) {
          const arriba = c.yoff < 18 ? -1 : 1;
          const y = g.y + arriba * (62 + Math.abs(c.yoff - 18) * 0.7);
          c.y = lerp(c.y, y, abre * 0.9);
        }
      },
      pintar(m, ctx) {
        for (const t0 of m.golpes) {
          const p = (m.t - t0) / 2.2;
          if (p < 1) {
            anillo(ctx, m.mero.x, m.mero.y, 40 + p * 190, [230, 214, 170], 0.4 * (1 - p), 2);
            anillo(ctx, m.mero.x, m.mero.y, 20 + p * 140, [230, 214, 170], 0.22 * (1 - p), 1);
          }
        }
      },
      focos: m => (m.llega === undefined ? [] : [{ x: m.mero.x, y: m.mero.y }]),
    },

    guardia: {
      bioma: 'naufragio', especies: ['campana'], provoca: 'toque', dur: 18,
      nombre: 'Cambio de guardia',
      pista: 'Hay una empleada de bronce que sabe contar hasta ocho. Alguien tendría que pedírselo con el dedo.',
      relato: 'Ocho campanadas y acudió el barco entero, como cada guardia desde 1912. No había relevo. Nunca hay relevo. Vinieron igual.',
      puede: () => momentoPunto.criatura?.key === 'campana',
      iniciar(m) {
        m.campana = m.criatura;
        const x = clamp(m.x, 180, Math.max(180, world.W - 180));
        m.centro = { x, y: clamp(m.campana.y, 230, suelo(x) - 190) };
        m.publico = world.creatures.filter(c => c !== m.campana && c.key !== 'vigia' && presente(c) && dentro(c));
        participa(m, m.campana);
        m.toques = 1; // el tuyo
      },
      actuar(m, dt) {
        const { x, y } = m.centro;
        llevar(m, m.campana, x, y, 80, m.k, dt);
        if (m.toques < 8 && m.t >= m.toques * 1.45) {
          m.toques++;
          m.campana.ring = 1;
          audio.event('campana');
        }
        const n = m.publico.length;
        m.publico.forEach((c, i) => {
          if (!presente(c)) return;
          // en corro, en dos filas
          const a = i / n * TAU + m.t * 0.12, r = i % 2 ? 118 : 162;
          const tx = x + Math.cos(a) * r, ty = y + 20 + Math.sin(a) * r * 0.62;
          const fuerza = m.k * suave((m.t - 1 - (i % 5) * 0.3) / 2);
          llevar(m, c, tx, ty, 150, fuerza, dt);
          if (c.hide !== undefined) c.hide *= 1 - fuerza; // hasta las monedas se asoman
          if (fuerza > 0.6 && dist(c.x, c.y, tx, ty) < 50) mirar(c, x - c.x);
        });
      },
      pintar(m, ctx) {
        const { x, y } = m.centro;
        halo(ctx, x, y, 130, [255, 205, 120], 0.2 * m.k);
        // la cuenta, en ocho luces
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU - Math.PI / 2, on = i < m.toques;
          halo(ctx, x + Math.cos(a) * 62, y + Math.sin(a) * 62, on ? 9 : 4, [255, 220, 150], (on ? 0.9 : 0.25) * m.k);
        }
      },
      focos: m => (m.toques < 3 ? [] : [m.centro]),
    },

    /* ---------- jardín imposible ---------- */
    polinizacion: {
      bioma: 'imposible', especies: ['flor'], provoca: null, dur: 34,
      nombre: 'El depredador ápice, trabajando',
      pista: 'El animal más temible del jardín tiene una ronda que hacer. Mira las flores cuando pase. Solo mira.',
      relato: 'Pasó rasante y cada flor se abrió del todo, una detrás de otra. La cadena alimentaria ha vuelto a funcionar sin que muera nadie.',
      puede: () => enEscena('flor').length && world.garden.some(f => f.bloom > 0.7),
      iniciar(m) {
        m.pez = enEscena('flor')[0];
        participa(m, m.pez);
        m.ruta = world.garden.filter(f => f.bloom > 0.7).sort((a, b) => a.fx - b.fx);
        if (m.pez.x > world.W / 2) m.ruta.reverse();
        m.i = 0;
      },
      actuar(m, dt) {
        const c = m.pez;
        if (m.i < m.ruta.length) {
          const p = flowerPos(m.ruta[m.i]);
          llevar(m, c, p.x, p.y - 62, 170, m.k, dt);
          if (dist(c.x, c.y, p.x, p.y - 62) < 55) {
            for (let j = 0; j < 14; j++) chispa(p.x, p.y, rand(310, 345), 18);
            m.i++;
            if (m.i === m.ruta.length) m.dur = m.t + 6;
          }
        } else {
          encarar(c, c.vel.x, -0.4, m.k, dt);
        }
        m.ruta.forEach((f, j) => {
          const meta = j < m.i ? 1 : 0;
          f.abre = Math.min(m.k, lerp(f.abre || 0, meta, Math.min(1, dt * 2)));
        });
      },
      pintar(m, ctx) {
        // un hilo de polen entre lo ya visitado
        for (let j = 0; j < m.i; j++) {
          const a = flowerPos(m.ruta[j]);
          const b = j + 1 < m.i ? flowerPos(m.ruta[j + 1]) : m.pez.head();
          for (let k = 0; k < 12; k++) {
            const f = (k + m.t * 0.7) / 12 % 1;
            halo(ctx, lerp(a.x, b.x, f), lerp(a.y, b.y, f) - Math.sin(f * Math.PI) * 50, 5, [255, 220, 180], 0.6 * Math.sin(f * Math.PI) * m.k);
          }
        }
      },
      focos: m => m.ruta.slice(0, m.i).map(flowerPos),
      fin(m) { for (const f of m.ruta || []) f.abre = 0; },
    },

    siembra: {
      bioma: 'imposible', especies: ['diente'], provoca: 'toque', dur: 18,
      nombre: 'Pedir un deseo',
      pista: 'Hay algo hecho enteramente de deseos ajenos. Un dedo basta para deshacerlo. Luego mira dónde cae.',
      relato: 'Los vilanos que no volvieron eran semillas. Donde cayó cada uno hay una flor. El tuyo también cayó. No diremos dónde.',
      puede: () => momentoPunto.criatura?.key === 'diente',
      iniciar(m) {
        m.origen = { x: m.criatura.x, y: m.criatura.y };
        participa(m, m.criatura);
        const libres = 9 - world.garden.length;
        m.vilanos = Array.from({ length: 4 }, (_, i) => {
          // con el jardín lleno caen sobre flores que ya están
          const flor = i < libres ? null : world.garden[(i * 3) % world.garden.length];
          const x = flor
            ? flor.fx * world.W
            : clamp(m.origen.x + (i - 1.5) * 92 + rand(-18, 18), world.W * 0.08, world.W * 0.92);
          return { tx: x, flor, x: m.origen.x, y: m.origen.y, sale: i * 0.45, llega: false };
        });
      },
      actuar(m, dt) {
        for (const v of m.vilanos) {
          if (!v.llega) {
            const f = clamp((m.t - v.sale) / 6, 0, 1), destino = suelo(v.tx) - 4;
            v.x = lerp(m.origen.x, v.tx, suave(f)) + Math.sin(f * 9) * 22 * (1 - f);
            v.y = lerp(m.origen.y, destino, f * f) - Math.sin(f * Math.PI) * 45;
            if (f < 1) continue;
            v.llega = true;
            for (let i = 0; i < 12; i++) chispa(v.x, v.y, rand(305, 345), 14);
            if (!v.flor) {
              v.flor = {
                fx: v.tx / world.W, h: rand(56, 90), bloom: 0, hue: rand(300, 350),
                phase: rand(TAU), seedAt: world.time + rand(45, 80),
              };
              world.garden.push(v.flor);
            }
          }
          v.flor.bloom = Math.min(1, v.flor.bloom + dt * 0.22); // crece a ojos vista
          v.flor.abre = suave((m.t - v.sale - 7) / 2) * m.k;
        }
      },
      pintar(m, ctx) {
        ctx.strokeStyle = css([255, 246, 225], 0.8 * m.k);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (const v of m.vilanos) {
          if (v.llega) continue;
          const a = -Math.PI / 2 + Math.sin(m.t * 1.2 + v.sale * 4) * 0.4;
          const px = v.x + Math.cos(a) * 14, py = v.y + Math.sin(a) * 14;
          ctx.moveTo(v.x, v.y); ctx.lineTo(px, py);
          for (let j = -3; j <= 3; j++) {
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a + j * 0.36) * 9, py + Math.sin(a + j * 0.36) * 9);
          }
        }
        ctx.stroke();
        for (const v of m.vilanos) if (!v.llega) halo(ctx, v.x, v.y, 13, [255, 225, 170], 0.7 * m.k);
      },
      focos: m => m.vilanos.map(v => (v.llega ? flowerPos(v.flor) : { x: v.x, y: v.y })),
      fin(m) { for (const v of m.vilanos || []) if (v.flor) v.flor.abre = 0; },
    },
  };

  /* ============================================================
     DIRECTOR — uno a la vez y sin avisar
     ============================================================ */
  let activo = null;
  let momentoPunto = { x: 0, y: 0, criatura: null }; // el último gesto: lo consultan los puede()
  let proximo = 24;      // el primer momento espontáneo no se hace esperar
  const reposo = {};     // id → cuándo puede repetirse uno provocado

  function empezar(id, punto = {}) {
    const def = MOMENTOS[id];
    const m = {
      id, def, t: 0, k: 0, dur: def.dur, x: punto.x, y: punto.y, criatura: punto.criatura,
      actores: [], invitados: [], rumbos: new Map(),
    };
    if (def.iniciar(m) === false) { terminar(m); return false; }
    activo = m;
    return true;
  }

  function terminar(m) {
    if (m.def.fin) m.def.fin(m);
    for (const c of m.actores) for (const p of POSES) if (c[p]) c[p] = 0;
    for (const c of m.invitados) {
      if (!presente(c) || !world.creatures.includes(c)) continue;
      if (state.selected === c) deselect();
      dismiss(c);
    }
    if (m.invitados.length) updateCounts();
    if (m.def.provoca) reposo[m.id] = world.time + 20;
    proximo = Math.max(proximo, world.time + (m.def.provoca ? rand(20, 35) : rand(40, 90)));
    if (activo === m) activo = null;
  }

  function cancelar() {
    if (activo) terminar(activo);
  }

  function provocar(que, x, y, criatura) {
    if (!state.mode || (activo && activo.def.provoca)) return false;
    momentoPunto = { x, y, criatura };
    for (const [id, def] of Object.entries(MOMENTOS)) {
      if (def.provoca !== que || def.bioma !== save.biome) continue;
      if (world.time < (reposo[id] || 0) || !def.puede()) continue;
      cancelar(); // lo que provocas manda sobre lo que pasaba solo
      return empezar(id, momentoPunto);
    }
    return false;
  }

  function actualizar(dt) {
    if (!state.mode) return;
    if (!activo) {
      if (world.time < proximo || !albumEl.hidden) return; // con el álbum abierto no hay quien mire
      proximo = world.time + 4; // si hoy no están, se vuelve a mirar enseguida
      for (const [id, def] of Object.entries(MOMENTOS)) {
        if (!def.provoca && def.bioma === save.biome && def.puede()) { empezar(id); break; }
      }
      if (!activo) return;
    }
    const m = activo;
    if (m.actores.some(c => !presente(c) || !world.creatures.includes(c))) { cancelar(); return; }
    m.t += dt;
    m.k = Math.min(suave(m.t / 1.4), suave((m.dur - m.t) / 1.8));
    m.def.actuar(m, dt);
    if (m.t >= m.dur) terminar(m);
  }

  /* ---------- álbum ---------- */
  function totales() {
    const ids = Object.keys(MOMENTOS);
    return { total: ids.length, hechos: ids.filter(id => fotos[id]).length };
  }

  /* @returns el momento completado con esta foto, o null */
  function fotografiar(encuadre, url) {
    if (!activo || activo.k < 0.25) return null;
    const m = activo;
    const visto = m.def.focos(m).some(p => {
      const s = toScreen(p.x, p.y);
      return s.x > encuadre.x && s.x < encuadre.x + encuadre.w && s.y > encuadre.y && s.y < encuadre.y + encuadre.h;
    });
    if (!visto) return null;
    const primera = !fotos[m.id];
    fotos[m.id] = url;
    try { localStorage.setItem(MOMENTOS_KEY, JSON.stringify(fotos)); } catch (e) { /* sin espacio */ }
    return { id: m.id, nombre: m.def.nombre, primera };
  }

  return {
    lista: MOMENTOS,
    actualizar,
    pintar(ctx) { if (activo) activo.def.pintar(activo, ctx); },
    alAlimentar: (cebo, x, y) => provocar(cebo, x, y),
    alTocar: c => provocar('toque', c.x, c.y, c),
    fotografiar,
    cancelar,
    /* al entrar en un ecosistema: un rato de calma y luego lo que toque */
    llegar() { cancelar(); proximo = world.time + rand(22, 34); },
    totales,
    foto: id => fotos[id],
    get activo() { return activo; },
    borrar() { try { localStorage.removeItem(MOMENTOS_KEY); } catch (e) { /* nada */ } },
  };
})();
