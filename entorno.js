/* ============================================================
   ACUARIO ABISAL — entorno
   Todo el paisaje: planos lejanos, arena, flora y lo propio de
   cada ecosistema. Lo quieto se hornea en capas; lo que se mece
   se pinta cada fotograma.
   Requiere luz.js y agua.js. En ejecución usa biomeDef, view,
   state y las tablas ROCKS / KELP de aquarium.js.
   ============================================================ */
'use strict';

const entorno = (() => {
  const { css, mezcla, halo, nube, azar } = luz;
  const MARGEN = 90;       // lo que sobresale cada capa, para el paralaje
  const ALTO_CERCA = 260;  // franja del fondo que se hornea a resolución completa
  const NOCHE = [2, 8, 18];
  const BLANCO = [255, 255, 255];

  let capas = null;  // se rehornean al cambiar de tamaño o de bioma
  let e = null;      // la luz de este fotograma

  /* ---------- luz del fotograma ---------- */
  function escena() {
    const t = world.abyssMix, bg = biomeDef.bg, c = biomeDef.clima;
    e = {
      t, clima: c,
      top: mezcla(bg.top, DARK.top, t),
      mid: mezcla(bg.mid, DARK.mid, t),
      bottom: mezcla(bg.bottom, DARK.bottom, t),
      luz: mezcla(c.luz, DARK.luz, t),
      colorHaz: c.luz,
      velo: mezcla(c.velo, DARK.velo, t),
      solX: c.solX + (luz.reducido ? 0 : Math.sin(world.time * 0.025) * 0.03),
      rayos: c.rayos * (1 - t),
      superficie: c.superficie * (1 - t),
      resplandor: c.resplandor * (1 - t * 0.85),
      nebulosa: lerp(c.nebulosa, Math.max(0.14, c.nebulosa), t),
    };
    return e;
  }

  /* ============================================================
     FORMAS
     ============================================================ */
  /* curva suave que pasa por los puntos medios */
  function curva(x, pts) {
    x.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      x.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    const u = pts[pts.length - 1];
    x.lineTo(u[0], u[1]);
  }

  function cordillera(x, r, W, base, alto, paso, color) {
    const pts = [];
    for (let px = -MARGEN - paso; px <= W + MARGEN + paso * 2; px += paso * r.entre(0.6, 1.3)) {
      // las orillas suben y el centro queda despejado: ahí vive la fauna
      const orilla = 0.55 + 0.75 * Math.abs(px / W - 0.5) * 2;
      pts.push([px, base - alto * r.entre(0.25, 1) * orilla]);
    }
    x.beginPath();
    x.moveTo(-MARGEN - paso, world.H + 60);
    curva(x, pts);
    x.lineTo(pts[pts.length - 1][0], world.H + 60);
    x.closePath();
    x.fillStyle = color;
    x.fill();
  }

  function pilar(x, r, cx, base, alto, ancho) {
    const izq = [], der = [];
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      const w = ancho * (1 - 0.45 * Math.sin(f * 2.6)) * r.entre(0.85, 1.15);
      izq.push([cx - w, base - alto * f]);
      der.unshift([cx + w * r.entre(0.8, 1.1), base - alto * f]);
    }
    x.beginPath();
    x.moveTo(cx - ancho, base);
    curva(x, izq.concat([[cx, base - alto - ancho * 0.35]], der));
    x.closePath();
    x.fill();
  }

  function mesa(x, cx, y, rx) {
    x.beginPath();
    x.moveTo(cx - rx, y);
    x.bezierCurveTo(cx - rx * 0.7, y - rx * 0.34, cx + rx * 0.7, y - rx * 0.3, cx + rx, y - rx * 0.04);
    x.quadraticCurveTo(cx + rx * 0.2, y + rx * 0.1, cx + rx * 0.12, y + rx * 0.4);
    x.lineTo(cx - rx * 0.14, y + rx * 0.4);
    x.quadraticCurveTo(cx - rx * 0.2, y + rx * 0.1, cx - rx, y);
    x.fill();
  }

  function rama(x, r, px, py, largo, ang, grosor, nivel) {
    const fx = px + Math.cos(ang) * largo, fy = py + Math.sin(ang) * largo;
    x.lineWidth = grosor;
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo((px + fx) / 2 + r.entre(-0.18, 0.18) * largo, (py + fy) / 2, fx, fy);
    x.stroke();
    if (nivel <= 0) return;
    const n = r() < 0.4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      rama(x, r, fx, fy, largo * r.entre(0.6, 0.82), ang + (i - (n - 1) / 2) * 0.6 + r.entre(-0.15, 0.15), grosor * 0.68, nivel - 1);
    }
  }

  function coralRama(x, r, cx, base, alto, color) {
    x.strokeStyle = color;
    x.lineCap = 'round';
    for (let i = -1; i <= 1; i++) rama(x, r, cx + i * alto * 0.08, base, alto * 0.4, -Math.PI / 2 + i * 0.5, alto * 0.1, 2);
  }

  function abanico(x, r, cx, base, radio, color) {
    const bordes = [];
    for (let i = 0; i <= 14; i++) {
      const a = -Math.PI / 2 + (i / 14 - 0.5) * 2.3, d = radio * r.entre(0.86, 1.05);
      bordes.push([cx + Math.cos(a) * d, base + Math.sin(a) * d]);
    }
    x.fillStyle = css(color, 0.28);
    x.beginPath();
    x.moveTo(cx, base);
    curva(x, bordes);
    x.closePath();
    x.fill();
    x.strokeStyle = css(color, 0.8);
    x.lineWidth = Math.max(0.8, radio * 0.022);
    x.beginPath();
    for (const [bx, by] of bordes) {
      x.moveTo(cx, base);
      x.quadraticCurveTo(lerp(cx, bx, 0.45), lerp(base, by, 0.7), bx, by);
    }
    x.stroke();
    // las nervaduras que cruzan
    x.strokeStyle = css(color, 0.4);
    for (const k of [0.45, 0.66, 0.84]) {
      x.beginPath();
      x.moveTo(lerp(cx, bordes[0][0], k), lerp(base, bordes[0][1], k));
      curva(x, bordes.map(([bx, by]) => [lerp(cx, bx, k), lerp(base, by, k)]));
      x.stroke();
    }
  }

  function tubos(x, r, cx, base, alto, color) {
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const tx = cx + (i - (n - 1) / 2) * alto * 0.26, h = alto * r.entre(0.45, 1), w = alto * 0.11;
      const ap = tx + (tx - cx) * 0.4;
      const g = x.createLinearGradient(0, base - h, 0, base);
      g.addColorStop(0, css(mezcla(color, BLANCO, 0.2)));
      g.addColorStop(1, css(mezcla(color, NOCHE, 0.5)));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(tx - w * 0.7, base);
      x.quadraticCurveTo(tx - w * 0.5, base - h * 0.6, ap - w, base - h);
      x.lineTo(ap + w, base - h);
      x.quadraticCurveTo(tx + w * 0.5, base - h * 0.6, tx + w * 0.7, base);
      x.fill();
      x.fillStyle = css(mezcla(color, NOCHE, 0.7));
      x.beginPath();
      x.ellipse(ap, base - h, w * 0.8, w * 0.3, 0, 0, TAU);
      x.fill();
    }
  }

  function cerebro(x, r, cx, base, radio, color) {
    const g = x.createRadialGradient(cx - radio * 0.3, base - radio * 0.7, 1, cx, base - radio * 0.2, radio * 1.1);
    g.addColorStop(0, css(mezcla(color, BLANCO, 0.22)));
    g.addColorStop(1, css(mezcla(color, NOCHE, 0.5)));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(cx, base, radio, radio * 0.75, 0, Math.PI, 0);
    x.fill();
    x.strokeStyle = css(mezcla(color, NOCHE, 0.45), 0.5);
    x.lineWidth = 1.3;
    x.beginPath();
    for (let i = 1; i < 5; i++) {
      for (let k = 0; k <= 12; k++) {
        const a = Math.PI + (k / 12) * Math.PI, d = (i / 5) * radio + Math.sin(k * 2.1 + i * 1.7) * 1.6;
        const px = cx + Math.cos(a) * d, py = base + Math.sin(a) * d * 0.75;
        if (k) x.lineTo(px, py); else x.moveTo(px, py);
      }
    }
    x.stroke();
  }

  function florGigante(x, r, cx, base, alto, color) {
    const tx = cx + r.entre(-0.18, 0.18) * alto, ty = base - alto, R = alto * r.entre(0.14, 0.22);
    x.strokeStyle = x.fillStyle = color;
    x.lineWidth = Math.max(2, alto * 0.018);
    x.beginPath();
    x.moveTo(cx, base);
    x.bezierCurveTo(cx - alto * 0.06, base - alto * 0.4, tx + alto * 0.1, ty + alto * 0.35, tx, ty);
    x.stroke();
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      x.beginPath();
      x.ellipse(tx + Math.cos(a) * R * 0.55, ty + Math.sin(a) * R * 0.3, R * 0.6, R * 0.23, a, 0, TAU);
      x.fill();
    }
  }

  function roca(x, r, cx, base, rx, ry, color, luzC) {
    const pts = [], n = 11;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const k = (i === 0 || i === n) ? 1 : r.entre(0.86, 1.1);
      pts.push([cx + Math.cos(a) * rx * k, base + Math.sin(a) * ry * k]);
    }
    const g = x.createLinearGradient(cx - rx * 0.3, base - ry * 1.1, cx + rx * 0.2, base + 6);
    g.addColorStop(0, css(mezcla(color, luzC, 0.3)));
    g.addColorStop(0.45, css(color));
    g.addColorStop(1, css(mezcla(color, NOCHE, 0.5)));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(cx - rx * 0.85, base + 5);
    curva(x, pts);
    // asentada en la arena, sin base recta
    x.quadraticCurveTo(cx + rx * 0.75, base + 9, cx, base + 10);
    x.quadraticCurveTo(cx - rx * 0.75, base + 10, cx - rx * 0.85, base + 5);
    x.closePath();
    x.fill();
    // poros y líquenes
    x.save();
    x.clip();
    for (let i = 0; i < rx; i++) {
      x.fillStyle = r() < 0.5 ? css(NOCHE, 0.12) : css(luzC, 0.07);
      x.beginPath();
      x.arc(cx + r.entre(-rx, rx), base - r() * ry, r.entre(0.6, 2.8), 0, TAU);
      x.fill();
    }
    x.restore();
  }

  /* ============================================================
     PLANOS LEJANOS — uno por bioma
     ============================================================ */
  const PAISAJE = {
    arrecife: {
      lejos(x, r, W, H, col) {
        cordillera(x, r, W, H * 0.88, H * 0.22, 52, col);
        x.fillStyle = col;
        for (const f of [-0.02, 0.08, 0.15, 0.82, 0.92, 1.02]) {
          // en pantallas estrechas adelgazan, o se juntan en un muro
          const h = H * r.entre(0.24, 0.5) * clamp(W / 700, 0.7, 1), w = r.entre(34, 70) * clamp(W / 1000, 0.4, 1);
          pilar(x, r, f * W, H * 0.94, h, w);
          // coronados de coral, no de sombreros
          coralRama(x, r, f * W, H * 0.94 - h, w * 1.3, col);
          mesa(x, f * W + w * 0.8, H * 0.94 - h * 0.55, w * 0.9);
          coralRama(x, r, f * W - w * 0.8, H * 0.94 - h * 0.4, w, col);
        }
      },
      medio(x, r, W, H, col) {
        cordillera(x, r, W, H - 30, H * 0.13, 70, col);
        x.fillStyle = col;
        for (let i = 0; i < Math.max(6, W / 90); i++) {
          const cx = r() * W, b = H - 50 - r() * 30, h = r.entre(40, 100);
          if (r() < 0.4) mesa(x, cx, b - h * 0.5, h * 0.6);
          else coralRama(x, r, cx, b, h, col);
        }
      },
    },
    burbujeante: {
      lejos(x, r, W, H, col) {
        cordillera(x, r, W, H * 0.9, H * 0.16, 150, col);
        // terrazas apiladas como copas de una torre de champán
        x.fillStyle = col;
        for (const f of [0.0, 0.09, 0.2, 0.83, 0.95]) {
          const niveles = 2 + Math.floor(r() * 4), w = r.entre(44, 76);
          for (let k = 0; k < niveles; k++) {
            const y = H * 0.82 - k * w * 0.62, wk = w * (1 - k * 0.12);
            mesa(x, f * W, y, wk);
            x.fillRect(f * W - wk * 0.13, y + wk * 0.3, wk * 0.26, w * 0.7);
          }
          x.fillRect(f * W - w * 0.2, H * 0.82, w * 0.4, H * 0.18);
        }
      },
      medio(x, r, W, H, col) {
        cordillera(x, r, W, H - 30, H * 0.1, 130, col);
        x.fillStyle = x.strokeStyle = col;
        for (let i = 0; i < Math.max(5, W / 120); i++) {
          const cx = r() * W, h = r.entre(30, 90);
          if (r() < 0.5) pilar(x, r, cx, H - 50, h, h * 0.16);
          else coralRama(x, r, cx, H - 54, h * 0.8, col);
        }
      },
    },
    abismo: {
      lejos(x, r, W, H, col, c) {
        cordillera(x, r, W, H * 0.9, H * 0.36, 64, col);
        x.fillStyle = col;
        for (const f of [0.02, 0.12, 0.7, 0.93]) pilar(x, r, f * W, H * 0.95, H * r.entre(0.35, 0.62), r.entre(22, 50));
        // colonias diminutas encendidas en la ladera
        for (let i = 0; i < W / 9; i++) {
          x.fillStyle = css(r() < 0.8 ? c.mota : [190, 150, 255], r.entre(0.1, 0.45));
          x.beginPath();
          x.arc(r() * W, H * r.entre(0.7, 0.96), r.entre(0.5, 1.5), 0, TAU);
          x.fill();
        }
      },
      medio(x, r, W, H, col) {
        cordillera(x, r, W, H - 24, H * 0.16, 54, col);
        x.fillStyle = col;
        for (let i = 0; i < Math.max(4, W / 200); i++) pilar(x, r, r() * W, H - 40, r.entre(50, 150), r.entre(10, 22));
      },
    },
    naufragio: {
      lejos(x, r, W, H, col) {
        cordillera(x, r, W, H * 0.93, H * 0.1, 120, col);
        // las costillas de otros barcos: una catedral sin techo
        x.strokeStyle = col;
        x.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const f = i / 7, cx = W * lerp(-0.04, 1.04, f);
          const h = H * (0.3 + 0.34 * Math.abs(f - 0.5) * 2) * r.entre(0.85, 1.1), s = f < 0.5 ? 1 : -1;
          x.lineWidth = r.entre(12, 20);
          x.beginPath();
          x.moveTo(cx, H * 0.96);
          x.quadraticCurveTo(cx - s * 20, H * 0.94 - h * 0.7, cx + s * h * 0.36, H * 0.94 - h);
          x.stroke();
          x.lineWidth = 4;
          x.beginPath();
          x.moveTo(cx + s * 4, H * 0.8);
          x.lineTo(cx + s * 60, H * 0.78);
          x.stroke();
        }
        // mástiles rendidos
        for (const f of [0.18, 0.86]) {
          const cx = f * W, top = H * r.entre(0.26, 0.36);
          x.lineWidth = 7;
          x.beginPath();
          x.moveTo(cx, H * 0.95);
          x.lineTo(cx + 26, top);
          x.moveTo(cx - 34, top + 64);
          x.lineTo(cx + 74, top + 48);
          x.stroke();
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(cx + 24, top + 4);
          x.quadraticCurveTo(cx + 70, top + 190, cx + 190, H * 0.86);
          x.moveTo(cx - 30, top + 64);
          x.quadraticCurveTo(cx - 20, top + 160, cx - 100, H * 0.84);
          x.stroke();
        }
      },
      medio(x, r, W, H, col) {
        cordillera(x, r, W, H - 26, H * 0.09, 90, col);
        x.strokeStyle = col;
        x.lineCap = 'round';
        for (let i = 0; i < Math.max(5, W / 130); i++) {
          const cx = r() * W, h = r.entre(30, 100);
          x.lineWidth = r.entre(3, 8);
          x.beginPath();
          x.moveTo(cx, H - 44);
          x.quadraticCurveTo(cx - 8, H - 50 - h * 0.6, cx + h * 0.3, H - 50 - h);
          x.stroke();
        }
      },
    },
    imposible: {
      lejos(x, r, W, H, col) {
        cordillera(x, r, W, H * 0.92, H * 0.2, 160, col);
        for (const f of [-0.01, 0.08, 0.19, 0.31, 0.74, 0.84, 0.97]) {
          florGigante(x, r, f * W, H * 0.94, H * r.entre(0.28, 0.6) * (Math.abs(f - 0.5) > 0.3 ? 1.1 : 0.8), col);
        }
      },
      medio(x, r, W, H, col) {
        cordillera(x, r, W, H - 24, H * 0.12, 100, col);
        for (let i = 0; i < Math.max(7, W / 80); i++) florGigante(x, r, r() * W, H - 40, r.entre(50, 130), col);
      },
    },
  };

  // por encima de esto cada plano está vacío: ni se hornea ni se compone
  const TECHO = { lejos: 0.12, medio: 0.55 };
  function techo(nombre) { return Math.max(0, Math.min(world.H * TECHO[nombre], world.H - 300)); }

  function hornearPlano(nombre, desenfoque) {
    const W = world.W, H = world.H, k = 0.5, c = biomeDef.clima;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((W + MARGEN * 2) * k);
    cv.height = Math.ceil((H + MARGEN - techo(nombre)) * k);
    const x = cv.getContext('2d');
    x.filter = `blur(${desenfoque}px)`;
    x.scale(k, k);
    x.translate(MARGEN, -techo(nombre));
    const base = c[nombre];
    const g = x.createLinearGradient(0, H * 0.3, 0, H);
    g.addColorStop(0, css(mezcla(base, biomeDef.bg.mid, 0.25)));
    g.addColorStop(1, css(mezcla(base, biomeDef.bg.bottom, 0.55)));
    PAISAJE[save.biome][nombre](x, azar(biomeDef.orden * 100 + nombre.length), W, H, g, c);
    return cv;
  }

  /* la misma capa, de noche: se funde encima según abyssMix */
  function nocturna(cv, a) {
    const n = document.createElement('canvas');
    n.width = cv.width; n.height = cv.height;
    const x = n.getContext('2d');
    x.drawImage(cv, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = css(NOCHE, a);
    x.fillRect(0, 0, n.width, n.height);
    return n;
  }

  /* ============================================================
     PRIMER PLANO QUIETO — arena, rocas y corales
     ============================================================ */
  function contornoArena(x) {
    const W = world.W;
    x.moveTo(-MARGEN, world.floorY(-MARGEN));
    for (let px = -MARGEN + 12; px < W + MARGEN + 12; px += 12) x.lineTo(px, world.floorY(px));
    x.lineTo(W + MARGEN + 12, world.H + 60);
    x.lineTo(-MARGEN, world.H + 60);
    x.closePath();
  }

  const CORALES = ['#e58f7b', '#d9a36a', '#c97fa6', '#8f86c9', '#e0bd78', '#6fb3a4'];

  function pintarCerca(x) {
    const W = world.W, H = world.H, bg = biomeDef.bg, c = biomeDef.clima, bio = save.biome;
    const r = azar(biomeDef.orden * 31 + 9);
    const suelo = px => world.floorY(px);

    // lo que crece detrás de las rocas
    for (const [i, rk] of ROCKS.entries()) {
      const cx = rk.fx * W, b = suelo(cx) + 2;
      if (bio === 'arrecife') {
        abanico(x, r, cx + (i === 0 ? -34 : 30), b - 14, r.entre(44, 62), luz.rgb(i === 1 ? '#c97fa6' : '#e58f7b'));
        coralRama(x, r, cx + (i === 1 ? -44 : 22), b - 12, r.entre(44, 60), css(mezcla(CORALES[i + 1], bg.mid, 0.22)));
      } else if (bio === 'burbujeante') {
        tubos(x, r, cx + (i === 0 ? -24 : 18), b - 16, r.entre(44, 64), luz.rgb('#d8c47c'));
      } else if (bio === 'imposible') {
        abanico(x, r, cx + 12, b - 16, r.entre(36, 54), luz.rgb('#dca0c8'));
      }
    }

    // la arena
    const g = x.createLinearGradient(0, H - 72, 0, H + 6);
    g.addColorStop(0, css(bg.sand));
    g.addColorStop(0.45, css(mezcla(bg.sand, bg.sandLo, 0.65)));
    g.addColorStop(1, css(mezcla(bg.sandLo, NOCHE, 0.2)));
    x.fillStyle = g;
    x.beginPath();
    contornoArena(x);
    x.fill();
    x.save();
    x.clip();
    // ondas que deja la marea
    x.lineWidth = 1.4;
    for (let fila = 0; fila < 6; fila++) {
      const d = 6 + fila * fila * 1.8 + fila * 4;
      x.strokeStyle = css(fila % 2 ? NOCHE : c.luz, fila % 2 ? 0.1 : 0.09);
      x.beginPath();
      let dentro = false;
      for (let px = -MARGEN; px < W + MARGEN; px += 10) {
        const py = suelo(px) + d + Math.sin(px * 0.035 + fila * 1.9) * 2.4;
        if (Math.sin(px * 0.011 + fila * 2.4) > -0.5) {
          if (dentro) x.lineTo(px, py); else x.moveTo(px, py);
          dentro = true;
        } else dentro = false;
      }
      x.stroke();
    }
    // granos, guijarros y conchitas
    for (let i = 0; i < W * 0.45; i++) {
      const px = r.entre(-MARGEN, W + MARGEN), d = r() ** 1.6 * 70;
      x.fillStyle = r() < 0.5 ? css(NOCHE, 0.16) : css(c.luz, 0.14);
      x.beginPath();
      x.ellipse(px, suelo(px) + d + 2, r.entre(0.6, 1.8) * (1 + d / 50), r.entre(0.4, 1) * (1 + d / 70), 0, 0, TAU);
      x.fill();
    }
    x.restore();

    // las rocas (la del centro, en el naufragio, quedó bajo el casco)
    for (const [i, rk] of ROCKS.entries()) {
      if (bio === 'naufragio' && i === 1) continue;
      const cx = rk.fx * W, b = suelo(cx) + 10;
      nube(x, cx, b + 5, 100, 14, NOCHE, 0.5); // su sombra
      const partes = [...rk.parts].sort((p, q) => p[1] - q[1]); // las altas, detrás
      for (const [ox, oy, rw, rh] of partes) roca(x, r, cx + ox, b + oy * 0.5, rw, rh * 1.65 - oy * 0.4, c.roca, c.luz);
      if (bio === 'arrecife') {
        cerebro(x, r, cx + (i === 1 ? 46 : -30), b + 4, r.entre(15, 21), luz.rgb(CORALES[i + 2]));
        tubos(x, r, cx + (i === 1 ? -58 : 40), b + 2, r.entre(22, 32), luz.rgb(CORALES[(i + 3) % CORALES.length]));
      } else if (bio === 'abismo') {
        // gusanos de tubo con su penacho
        for (let k = 0; k < 9; k++) {
          const tx = cx + r.entre(-48, 48), h = r.entre(12, 30), ap = tx + r.entre(-4, 4);
          x.strokeStyle = 'rgba(150,156,160,0.4)';
          x.lineWidth = 2.6;
          x.beginPath();
          x.moveTo(tx, b);
          x.quadraticCurveTo(tx + 2, b - h * 0.5, ap, b - h);
          x.stroke();
          x.fillStyle = 'rgba(196,82,84,0.7)';
          x.beginPath();
          x.ellipse(ap, b - h - 3, 2.2, 4.4, 0, 0, TAU);
          x.fill();
        }
      } else if (bio === 'naufragio') {
        // anémonas blancas: las primeras vecinas de todo pecio
        for (let k = 0; k < 6; k++) {
          const tx = cx + r.entre(-34, 34), ty = b - r.entre(12, 30);
          x.strokeStyle = css([200, 214, 196], 0.45);
          x.lineWidth = 1;
          x.beginPath();
          for (let j = 0; j < 9; j++) {
            const a = Math.PI + (j / 8) * Math.PI;
            x.moveTo(tx, ty);
            x.lineTo(tx + Math.cos(a) * 6, ty + Math.sin(a) * 7);
          }
          x.stroke();
        }
      }
    }

    // matas pequeñas repartidas
    if (bio === 'arrecife' || bio === 'imposible') {
      for (let i = 0; i < W / 85; i++) {
        const px = r() * W, b = suelo(px) + r.entre(4, 16);
        const col = mezcla(r.de(CORALES), bg.mid, bio === 'imposible' ? 0.3 : 0.12);
        const tipo = r();
        if (tipo < 0.35) tubos(x, r, px, b, r.entre(10, 22), col);
        else if (tipo < 0.65) coralRama(x, r, px, b, r.entre(14, 28), css(col));
        else cerebro(x, r, px, b, r.entre(6, 12), col);
      }
    }
  }

  function hornearCerca() {
    const k = DPR;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((world.W + MARGEN * 2) * k);
    cv.height = Math.ceil((ALTO_CERCA + 20) * k);
    const x = cv.getContext('2d');
    x.scale(k, k);
    x.translate(MARGEN, -(world.H - ALTO_CERCA));
    pintarCerca(x);
    return cv;
  }

  /* red de cáusticas sin costuras: los bordes entre celdas de Voronoi */
  let caustica = null;
  function hornearCaustica() {
    const N = 192, CELDAS = 6, r = azar(77);
    const centros = Array.from({ length: CELDAS * CELDAS }, () => [r(), r()]);
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const x = cv.getContext('2d'), img = x.createImageData(N, N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const px = (i / N) * CELDAS + Math.sin((j / N) * TAU * 3) * 0.16;
        const py = (j / N) * CELDAS + Math.sin((i / N) * TAU * 2) * 0.16;
        const ix = Math.floor(px), iy = Math.floor(py);
        let d1 = 9, d2 = 9;
        for (let a = -1; a <= 1; a++) {
          for (let b = -1; b <= 1; b++) {
            const cx = ix + a, cy = iy + b;
            const p = centros[((cy + CELDAS) % CELDAS) * CELDAS + ((cx + CELDAS) % CELDAS)];
            const d = Math.hypot(cx + p[0] - px, cy + p[1] - py);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
        }
        const o = (j * N + i) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
        img.data[o + 3] = 255 * Math.max(0, 1 - (d2 - d1) * 4.5) ** 3;
      }
    }
    x.putImageData(img, 0, 0);
    return cv;
  }

  function asegurar() {
    if (capas && capas.bioma === save.biome) return;
    capas = {
      bioma: save.biome,
      lejos: hornearPlano('lejos', 2.2),
      medio: hornearPlano('medio', 0.8),
      cerca: hornearCerca(),
      noche: {},
      hierba: sembrarHierba(),
    };
  }

  function deNoche(nombre, a) {
    return capas.noche[nombre] || (capas.noche[nombre] = nocturna(capas[nombre], a));
  }

  /* de día a noche. Al final solo queda la capa oscura: con la clara debajo,
     los bordes desenfocados se encendían como un neón. */
  function fundido(ctx, nombre, oscuro, x, y, w, h) {
    const alfa = ctx.globalAlpha, dia = Math.min(1, (1 - e.t) * 2), noche = Math.min(1, e.t * 2);
    if (dia > 0.01) {
      ctx.globalAlpha = alfa * dia;
      ctx.drawImage(capas[nombre], x, y, w, h);
    }
    if (noche > 0.01) {
      ctx.globalAlpha = alfa * noche;
      ctx.drawImage(deNoche(nombre, oscuro), x, y, w, h);
    }
    ctx.globalAlpha = alfa;
  }

  function pintarPlano(ctx, nombre, prof, oleaje) {
    const dx = (view.x - world.W / 2) * prof + Math.sin(world.time * 0.045 + prof * 9) * oleaje * luz.vaiven;
    const dy = Math.max(0, view.y - world.H / 2) * prof * 0.4;
    const w = world.W + MARGEN * 2, y0 = techo(nombre), h = world.H + MARGEN - y0, x = clamp(dx, -MARGEN + 2, MARGEN - 2) - MARGEN;
    fundido(ctx, nombre, 0.78, x, dy + y0, w, h);
  }

  /* ---------- cardúmenes que solo son silueta ---------- */
  const LEJANOS = Array.from({ length: 34 }, (_, i) => {
    const r = azar(i + 400);
    return { ox: r.entre(-90, 90), oy: r.entre(-22, 22), s: r.entre(3, 5.5), f: r() * TAU, g: i % 2 };
  });
  function pintarLejanos(ctx) {
    if (biomeDef.biolum) return;
    const t = world.time, W = world.W, ancho = W + 500;
    ctx.fillStyle = css(mezcla(e.clima.lejos, NOCHE, 0.25 + e.t * 0.5), 0.5);
    ctx.beginPath();
    for (const p of LEJANOS) {
      const v = p.g ? -7 : 9;
      const cx = ((((t * v + (p.g ? W * 0.8 : W * 0.45) + 250) % ancho) + ancho) % ancho) - 250;
      const cy = world.H * (p.g ? 0.46 : 0.3) + Math.sin(t * 0.12 + p.g) * 18;
      const px = cx + p.ox + Math.sin(t * 0.4 + p.f) * 7, py = cy + p.oy + Math.sin(t * 0.55 + p.f) * 4;
      const d = Math.sign(v), s = p.s;
      ctx.moveTo(px + d * s, py);
      ctx.quadraticCurveTo(px, py - s * 0.6, px - d * s, py);
      ctx.lineTo(px - d * s * 1.6, py - s * 0.4);
      ctx.lineTo(px - d * s * 1.6, py + s * 0.4);
      ctx.lineTo(px - d * s, py);
      ctx.quadraticCurveTo(px, py + s * 0.6, px + d * s, py);
    }
    ctx.fill();
  }

  /* ============================================================
     LO QUE SE MECE
     ============================================================ */
  const HIERBA = {
    arrecife: { tonos: ['#1d6a62', '#2b8674', '#4aa383'], cada: 15, alto: [10, 40] },
    burbujeante: { tonos: ['#5f9f74', '#86b97c', '#b4cf8c'], cada: 11, alto: [12, 52] },
    abismo: { tonos: ['#13243a', '#1b3450', '#24456a'], cada: 34, alto: [8, 26] },
    naufragio: { tonos: ['#1f4a3c', '#2c5c46', '#3f7152'], cada: 22, alto: [8, 30] },
    imposible: { tonos: ['#8a5c9a', '#a874a8', '#d39ab6'], cada: 9, alto: [10, 44] },
  };

  function sembrarHierba() {
    const def = HIERBA[save.biome], r = azar(biomeDef.orden + 60), W = world.W, hojas = [];
    for (let i = 0; i < W / def.cada; i++) {
      const x = r() * W;
      // en manchas, no como un cepillo
      const mata = 0.5 + 0.5 * Math.sin(x * 0.017 + biomeDef.orden);
      if (r() > mata + 0.12) continue;
      hojas.push({
        x, y: world.floorY(x) + r.entre(2, 14), h: r.entre(...def.alto) * (0.5 + mata * 0.6),
        f: x * 0.012 + r() * 0.8, tono: Math.floor(r() * 3), flor: save.biome === 'imposible' && r() < 0.22,
      });
    }
    return hojas;
  }

  function pintarHierba(ctx) {
    const def = HIERBA[save.biome], t = world.time, v = luz.vaiven;
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = css(mezcla(def.tonos[k], NOCHE, e.t * 0.55));
      ctx.beginPath();
      for (const h of capas.hierba) {
        if (h.tono !== k) continue;
        // una ola que recorre la pradera, no un temblor de cada hoja
        const s = (Math.sin(t * 0.55 - h.f) * 0.26 + Math.sin(t * 0.23 + h.f * 2) * 0.1) * h.h * v;
        ctx.moveTo(h.x - 1.8, h.y);
        ctx.quadraticCurveTo(h.x - 1 + s * 0.2, h.y - h.h * 0.6, h.x + s, h.y - h.h);
        ctx.quadraticCurveTo(h.x + 1.4 + s * 0.2, h.y - h.h * 0.55, h.x + 1.8, h.y);
      }
      ctx.fill();
    }
    if (save.biome !== 'imposible') return;
    ctx.fillStyle = css([255, 214, 228], 0.8 - e.t * 0.3);
    ctx.beginPath();
    for (const h of capas.hierba) {
      if (!h.flor) continue;
      const fx = h.x + (Math.sin(t * 0.55 - h.f) * 0.26 + Math.sin(t * 0.23 + h.f * 2) * 0.1) * h.h * v;
      ctx.moveTo(fx + 2.2, h.y - h.h);
      ctx.arc(fx, h.y - h.h, 2.2, 0, TAU);
    }
    ctx.fill();
  }

  function pintarKelp(ctx, k, delante) {
    const t = world.time, x0 = k.fx * world.W, base = world.floorY(x0) + 8, v = luz.vaiven;
    const agitado = k.energy || 0;
    for (let tallo = 0; tallo < 3; tallo++) {
      const h = k.h * [1.25, 0.95, 0.7][tallo], ox = [0, -9, 10][tallo], n = 10;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const vaiven = Math.sin(t * 0.45 + k.phase + tallo * 0.8 - f * 2.4) * 22 * f * v
          + Math.sin(t * 2.4 + f * 6 + tallo) * 20 * agitado * f;
        pts.push([x0 + ox * (1 + f) + vaiven, base - h * f]);
      }
      const tinte = delante
        ? mezcla([5, 40, 44], NOCHE, e.t * 0.5)
        : mezcla(['#2f8a66', '#1f6f5c', '#47a06c'][tallo], NOCHE, e.t * 0.6);
      ctx.strokeStyle = css(mezcla(tinte, NOCHE, 0.25));
      ctx.lineWidth = delante ? 3 : 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0 + ox, base);
      curva(ctx, pts);
      ctx.stroke();
      const g = ctx.createLinearGradient(0, base, 0, base - h);
      g.addColorStop(0, css(mezcla(tinte, NOCHE, 0.3), 0.9));
      g.addColorStop(1, css(delante ? tinte : mezcla(tinte, e.luz, 0.28), 0.9));
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 1; i <= n; i++) {
        const [px, py] = pts[i], [ax, ay] = pts[i - 1];
        const lado = (i + tallo) % 2 ? 1 : -1;
        const onda = Math.sin(t * 0.5 + i * 0.9 + k.phase) * 0.18 * v;
        const a = Math.atan2(py - ay, px - ax) + (i === n ? 0 : lado * (0.62 + onda));
        const L = (delante ? 34 : 28) * (1 - (i / n) * 0.3) * (tallo ? 0.82 : 1);
        const ca = Math.cos(a), sa = Math.sin(a), w = L * 0.2;
        ctx.moveTo(px, py);
        ctx.bezierCurveTo(px + ca * L * 0.3 - sa * w, py + sa * L * 0.3 + ca * w,
          px + ca * L * 0.7 - sa * w * 0.8, py + sa * L * 0.7 + ca * w * 0.8, px + ca * L, py + sa * L);
        ctx.bezierCurveTo(px + ca * L * 0.6 + sa * w, py + sa * L * 0.6 - ca * w,
          px + ca * L * 0.3 + sa * w * 0.6, py + sa * L * 0.3 - ca * w * 0.6, px, py);
      }
      ctx.fill();
    }
  }

  let trama = null;
  function pintarCausticas(ctx) {
    const f = e.clima.rayos * (1 - e.t);
    if (f < 0.01 || luz.calidad === 0) return;
    if (!caustica) caustica = hornearCaustica();
    if (!trama) trama = ctx.createPattern(caustica, 'repeat');
    const t = luz.reducido ? 0 : world.time;
    ctx.save();
    ctx.beginPath();
    contornoArena(ctx);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      ctx.save();
      // aplastada: la arena se ve en perspectiva
      ctx.translate(t * (i ? -5 : 7) % 1152, Math.sin(t * 0.17 + i * 3) * 5);
      ctx.scale(i ? 1.3 : 2, i ? 0.3 : 0.42);
      ctx.globalAlpha = f * (i ? 0.11 : 0.16) * (0.8 + 0.2 * luz.respira(i * 2));
      ctx.fillStyle = trama;
      ctx.fillRect(-1300, 0, world.W + 2700, (world.H + 60) * 4);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ============================================================
     EL NAUFRAGIO
     ============================================================ */
  function pintarBarco(ctx) {
    const w = world.wreck, W = world.W, t = world.time;
    const x1 = 0.31 * W, x2 = 0.74 * W, L = x2 - x1;
    const fl = world.floorY(w.cx), proa = Math.min(90, L * 0.2);
    const dia = 1 - e.t * 0.55;
    const tinte = (c, a = 1) => css(mezcla(c, NOCHE, 1 - dia), a);
    const cubierta = px => lerp(w.deckY + 14, w.deckY - 6, clamp((px - x1 - proa) / (L - proa - 40), 0, 1));

    // casetas y chimenea, detrás de la borda
    const ca = x1 + L * 0.5, cb = x1 + L * 0.82;
    ctx.fillStyle = tinte([22, 50, 46]);
    ctx.beginPath();
    ctx.moveTo(ca, cubierta(ca) + 4);
    ctx.lineTo(ca + 5, cubierta(ca) - 40);
    ctx.lineTo(cb - 14, cubierta(cb) - 36);
    ctx.lineTo(cb, cubierta(cb) + 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ca + L * 0.1, cubierta(ca) - 38);
    ctx.lineTo(ca + L * 0.12, cubierta(ca) - 92);
    ctx.lineTo(ca + L * 0.17, cubierta(ca) - 84); // rota en diagonal
    ctx.lineTo(ca + L * 0.18, cubierta(ca) - 38);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const px = lerp(ca + 22, cb - 34, i / 3);
      ctx.fillStyle = css([255, 200, 130], 0.12 + 0.1 * luz.respira(i * 1.9));
      ctx.beginPath();
      ctx.roundRect(px - 4, cubierta(px) - 28, 8, 12, 3);
      ctx.fill();
    }

    // casco escorado
    const casco = new Path2D();
    casco.moveTo(x1 + proa * 0.5, fl + 26);
    casco.quadraticCurveTo(x1 + proa * 0.1, w.deckY + 50, x1 - proa * 0.18, w.deckY - 16);
    casco.quadraticCurveTo(x1 + proa * 0.45, w.deckY + 10, x1 + proa, w.deckY + 14);
    casco.lineTo(x2 - 40, w.deckY - 6);
    casco.quadraticCurveTo(x2 + 4, w.deckY - 8, x2 + 10, w.deckY - 18);
    casco.quadraticCurveTo(x2 + 24, w.deckY + 44, x2 - 8, fl + 26);
    casco.closePath();
    const g = ctx.createLinearGradient(0, w.deckY - 16, 0, fl + 20);
    g.addColorStop(0, tinte([62, 92, 76]));
    g.addColorStop(0.35, tinte([36, 60, 54]));
    g.addColorStop(1, tinte([12, 24, 26]));
    ctx.fillStyle = g;
    ctx.fill(casco);
    ctx.save();
    ctx.clip(casco);
    const r = azar(1912); // siempre el mismo óxido
    ctx.strokeStyle = css([5, 14, 14], 0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let d = 18; d < 130; d += 19) {
      ctx.moveTo(x1 - 20, w.deckY + d + 4);
      ctx.quadraticCurveTo(w.cx, w.deckY + d + 12, x2 + 20, w.deckY + d - 12);
    }
    ctx.stroke();
    // chorretones de óxido y verdín
    for (let i = 0; i < 26; i++) {
      const px = x1 + r() * L, py = cubierta(px) + r() * 36;
      nube(ctx, px, py + 16, r.entre(4, 11), r.entre(16, 40), r() < 0.55 ? [150, 88, 52] : [84, 150, 110], 0.28 * dia);
    }
    ctx.fillStyle = css([170, 200, 170], 0.2 * dia);
    ctx.beginPath();
    for (let px = x1 + proa; px < x2 - 20; px += 14) { // remaches
      ctx.moveTo(px + 1.2, cubierta(px) + 13);
      ctx.arc(px, cubierta(px) + 13, 1.2, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
    // filo de luz en la borda
    ctx.strokeStyle = css([176, 222, 180], 0.4 * dia);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1 - proa * 0.18, w.deckY - 16);
    ctx.quadraticCurveTo(x1 + proa * 0.45, w.deckY + 10, x1 + proa, w.deckY + 14);
    ctx.lineTo(x2 - 40, w.deckY - 6);
    ctx.quadraticCurveTo(x2 + 4, w.deckY - 8, x2 + 10, w.deckY - 18);
    ctx.stroke();

    // algas que cuelgan de la borda
    ctx.strokeStyle = tinte([58, 112, 78], 0.75);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const px = lerp(x1 + proa, x2 - 44, i / 17) + Math.sin(i * 7) * 6, py = cubierta(px);
      const h = 8 + (Math.sin(i * 4.7) * 0.5 + 0.5) * 22, s = Math.sin(t * 0.5 + i) * 4 * luz.vaiven;
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 2, py + h * 0.5, px + s, py + h);
    }
    ctx.stroke();

    // barandilla con su hueco: por ahí se fue algo
    const n = Math.max(5, Math.round(L / 48));
    ctx.strokeStyle = tinte([104, 140, 112], 0.6);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = lerp(x1 + proa + 8, x2 - 50, i / (n - 1));
      if (i === Math.floor(n / 2)) continue;
      ctx.moveTo(px, cubierta(px));
      ctx.lineTo(px, cubierta(px) - 14);
      if (i + 1 < n && i + 1 !== Math.floor(n / 2)) {
        const sig = lerp(x1 + proa + 8, x2 - 50, (i + 1) / (n - 1));
        ctx.moveTo(px, cubierta(px) - 13);
        ctx.quadraticCurveTo((px + sig) / 2, cubierta(px) - 10, sig, cubierta(sig) - 13);
      }
    }
    ctx.stroke();

    // brecha del casco (la casa del congrio)
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * TAU, k = 1 + Math.sin(a * 3 + 0.6) * 0.08 + Math.sin(a * 7) * 0.05;
      const px = w.hole.x + Math.cos(a) * 30 * k, py = w.hole.y + 6 + Math.sin(a) * 19 * k;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    const gb = ctx.createRadialGradient(w.hole.x, w.hole.y + 10, 2, w.hole.x, w.hole.y + 6, 32);
    gb.addColorStop(0, 'rgb(1,5,7)');
    gb.addColorStop(1, 'rgb(8,18,18)');
    ctx.fillStyle = gb;
    ctx.fill();
    ctx.strokeStyle = css([140, 110, 70], 0.35 * dia);
    ctx.stroke();

    // ojos de buey: faroles que aún resisten
    const pa = x1 + Math.min(110, L * 0.22), pb = x2 - Math.min(90, L * 0.18);
    for (let i = 0; i < 4; i++) {
      const px = lerp(pa, pb, i / 3), py = lerp(w.deckY + 44, w.deckY + 30, i / 3);
      const k = 0.65 + 0.35 * luz.respira(i * 2.2);
      ctx.fillStyle = css(mezcla([60, 50, 30], [255, 206, 138], k * 0.85));
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = tinte([128, 142, 104], 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
      halo(ctx, px, py, 42, [255, 186, 100], 0.36 * k);
    }

    // mástil, jarcias y cofa (el puesto del Vigía)
    const mx = w.mast.x, my = w.mast.y, bx = 0.47 * W, by = w.deckY + 10;
    const madera = ctx.createLinearGradient(mx, my, mx + 14, my + 8);
    madera.addColorStop(0, tinte([86, 100, 78]));
    madera.addColorStop(1, tinte([30, 44, 38]));
    ctx.fillStyle = madera;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by);
    ctx.lineTo(mx - 3, my + 12);
    ctx.lineTo(mx + 4, my + 10);
    ctx.lineTo(bx + 8, by);
    ctx.fill();
    const va = Math.sin(t * 0.3) * 5 * luz.vaiven;
    ctx.strokeStyle = tinte([104, 128, 100], 0.55);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const [rx, ry] of [[x1 + proa * 0.2, w.deckY - 4], [x1 + proa + 20, w.deckY + 12], [ca + L * 0.12, cubierta(ca) - 80]]) {
      ctx.moveTo(mx, my + 10);
      ctx.quadraticCurveTo((mx + rx) / 2 + va, Math.max(my, ry) - 6 + va, rx, ry);
    }
    ctx.stroke();
    ctx.fillStyle = tinte([52, 70, 58]);
    ctx.beginPath();
    ctx.moveTo(mx - 18, my + 2);
    ctx.lineTo(mx + 18, my + 2);
    ctx.lineTo(mx + 13, my + 18);
    ctx.quadraticCurveTo(mx, my + 23, mx - 13, my + 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css([170, 205, 160], 0.35 * dia);
    ctx.stroke();
  }

  /* el cofre va delante de la arena */
  function pintarCofre(ctx) {
    const c = world.wreck.chest, k = luz.respira(1);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = css(mezcla([62, 46, 30], NOCHE, e.t * 0.4));
    ctx.beginPath();
    ctx.roundRect(-18, -9, 36, 17, 3);
    ctx.fill();
    ctx.save(); // tapa entreabierta
    ctx.translate(-18, -10);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(2, -12, 34, -12, 36, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css([180, 148, 84], 0.8);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = css([255, 210, 110], 0.85);
    ctx.beginPath();
    ctx.ellipse(0, -9, 14, 3, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = css([170, 138, 76], 0.8);
    ctx.fillRect(-11, -9, 3, 17);
    ctx.fillRect(8, -9, 3, 17);
    halo(ctx, 2, -13, 48, [255, 200, 96], 0.2 + 0.25 * k);
    ctx.restore();
  }

  /* ============================================================
     EL ABISMO — chimeneas hidrotermales
     ============================================================ */
  const SPIRES = [
    { fx: 0.2, h: 150, w: 28, phase: 0 },
    { fx: 0.54, h: 215, w: 36, phase: 2.1 },
    { fx: 0.83, h: 120, w: 23, phase: 4.4 },
  ];

  function pintarChimeneas(ctx) {
    const t = world.time;
    for (const s of SPIRES) {
      const x = s.fx * world.W, base = world.floorY(x) + 24, top = base - 18 - s.h, h = base - top;
      const k = 0.6 + 0.4 * luz.respira(s.phase);
      // humo mineral: volutas que suben y se deshacen
      for (let i = 0; i < 9; i++) {
        const f = ((luz.reducido ? 0 : t * 0.045) + i / 9 + s.phase) % 1;
        nube(ctx, x + Math.sin(f * 5 + s.phase + t * 0.15) * 22 * f, top - f * 210,
          12 + f * 42, 18 + f * 50, mezcla([88, 72, 92], [24, 30, 52], f), Math.sin(f * Math.PI) * 0.32);
      }
      const r = azar(Math.round(s.h)), izq = [], der = [];
      for (let i = 0; i <= 12; i++) {
        const f = i / 12, w = lerp(s.w * 1.2, s.w * 0.3, Math.sqrt(f));
        izq.push([x - w * r.entre(0.8, 1.18), base - h * f]);
        der.unshift([x + w * r.entre(0.8, 1.18), base - h * f]);
      }
      const g = ctx.createLinearGradient(0, top, 0, base);
      g.addColorStop(0, css(mezcla([30, 28, 40], [150, 62, 42], k * 0.6)));
      g.addColorStop(0.22, 'rgb(22,25,38)');
      g.addColorStop(1, 'rgb(10,14,24)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - s.w, base);
      curva(ctx, izq.concat(der));
      ctx.closePath();
      ctx.fill();
      // grietas encendidas y costras de vida
      ctx.strokeStyle = css([255, 128, 72], 0.3 * k);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x - 2, top + 6);
      for (let i = 1; i < 6; i++) ctx.lineTo(x + r.entre(-5, 5), top + i * h * 0.08);
      ctx.stroke();
      ctx.fillStyle = css([120, 210, 220], 0.22);
      ctx.beginPath();
      for (let i = 0; i < 22; i++) {
        const py = top + h * r.entre(0.35, 0.95), px = x + r.entre(-0.55, 0.55) * s.w;
        ctx.moveTo(px + 1.2, py);
        ctx.arc(px, py, 1.2, 0, TAU);
      }
      ctx.fill();
      halo(ctx, x, top + 2, 60, [255, 112, 60], 0.45 * k);
      halo(ctx, x, top + 2, 12, [255, 205, 150], 0.6 * k);
    }
  }

  /* ============================================================
     EL JARDÍN IMPOSIBLE
     ============================================================ */
  function pintarJardin(ctx) {
    const t = world.time;
    for (const fl of world.garden) {
      const x = fl.fx * world.W, base = world.floorY(x) + 6, b = fl.bloom;
      const h = fl.h * (0.2 + 0.8 * b) + 6;
      const sway = Math.sin(t * 0.5 + fl.phase) * 6 * b * luz.vaiven;
      const tx = x + sway, ty = base - h;
      const fiesta = fl.abre || 0; // un momento puede abrirla del todo
      const g = ctx.createLinearGradient(0, ty, 0, base);
      g.addColorStop(0, '#9fc7a8');
      g.addColorStop(1, '#5c4a78');
      ctx.strokeStyle = ctx.fillStyle = g;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.bezierCurveTo(x - 4, base - h * 0.35, tx + 5, ty + h * 0.35, tx, ty);
      ctx.stroke();
      for (const s of [-1, 1]) {
        const by = base - h * (s > 0 ? 0.32 : 0.48), L = 18 * b;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.quadraticCurveTo(x + s * L * 0.3, by - L * 0.6, x + s * L, by - L * 0.7);
        ctx.quadraticCurveTo(x + s * L * 0.7, by, x, by);
        ctx.fill();
      }
      // dos corolas: la de atrás más ancha, la de delante más clara
      const R = (9 + 13 * b) * (1 + 0.05 * Math.sin(t * 0.63 + fl.phase) + fiesta * 0.7);
      halo(ctx, tx, ty, R * (2.6 + fiesta), [255, 190, 205], (0.22 + fiesta * 0.35) * b);
      for (let capa = 0; capa < 2; capa++) {
        const n = capa ? 6 : 8, rr = R * (capa ? 0.68 : 1);
        ctx.fillStyle = `hsla(${fl.hue + capa * 18},${68 + capa * 12}%,${(capa ? 82 : 68) - e.t * 14}%,${(capa ? 0.95 : 0.8) * b})`;
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + fl.phase + capa * 0.4 + Math.sin(t * 0.2 + fl.phase) * 0.15;
          const ca = Math.cos(a), sa = Math.sin(a) * 0.85, w = rr * 0.36;
          ctx.moveTo(tx, ty);
          ctx.bezierCurveTo(tx + ca * rr * 0.5 - sa * w, ty + sa * rr * 0.5 + ca * w,
            tx + ca * rr - sa * w, ty + sa * rr + ca * w, tx + ca * rr * 1.1, ty + sa * rr * 1.1);
          ctx.bezierCurveTo(tx + ca * rr + sa * w, ty + sa * rr - ca * w,
            tx + ca * rr * 0.5 + sa * w, ty + sa * rr * 0.5 - ca * w, tx, ty);
        }
        ctx.fill();
      }
      ctx.fillStyle = css([255, 232, 160], 0.95 * b);
      ctx.beginPath();
      ctx.arc(tx, ty, R * 0.18, 0, TAU);
      ctx.fill();
      halo(ctx, tx, ty, R * 0.8, [255, 226, 150], 0.5 * b);
    }
  }

  /* anémona del pez payaso, junto a la primera roca */
  function pintarAnemona(ctx) {
    if (!world.creatures.some(c => c.key === 'payaso')) return;
    const a = world.anemone, t = world.time, base = a.y + 18;
    ctx.save();
    ctx.lineCap = 'round';
    for (let fila = 0; fila < 2; fila++) {
      const n = fila ? 14 : 17;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1) - 0.5;
        const s = Math.sin(t * 0.8 - i * 0.45 + fila) * 5 * luz.vaiven;
        const tx = a.x + f * 56 + s, ty = base - (fila ? 22 : 32) + Math.abs(f) * 22;
        ctx.strokeStyle = css(mezcla(fila ? '#e7a0c4' : '#a8689c', NOCHE, e.t * 0.4), 0.9);
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(a.x + f * 26, base);
        ctx.quadraticCurveTo(a.x + f * 46, base - 14, tx, ty);
        ctx.stroke();
        ctx.fillStyle = fila ? '#fff0d8' : '#e8b8d0';
        ctx.beginPath();
        ctx.arc(tx, ty, 2.1, 0, TAU);
        ctx.fill();
      }
    }
    halo(ctx, a.x, base - 18, 46, [255, 170, 210], 0.14);
    ctx.restore();
  }

  /* ---------- algo enorme, muy lejos ---------- */
  function pintarLeviatan(ctx) {
    const L = state.leviatan;
    if (!L.active) return;
    const t = world.time, cola = Math.sin(t * 0.7) * 16;
    ctx.save();
    ctx.translate(L.x, L.y + Math.sin(t * 0.4) * 10);
    ctx.scale(L.dir * 2.6, 2.6);
    const g = ctx.createLinearGradient(0, -24, 0, 30);
    g.addColorStop(0, css(mezcla(e.mid, NOCHE, 0.25), 0.55));
    g.addColorStop(1, css(mezcla(e.mid, NOCHE, 0.6), 0.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(124, 4);
    ctx.bezierCurveTo(112, -22, 30, -28, -36, -12);
    ctx.quadraticCurveTo(-76, -6, -100, cola * 0.5);
    ctx.quadraticCurveTo(-116, cola - 16, -140, cola - 12);
    ctx.quadraticCurveTo(-126, cola, -118, cola * 0.8 + 3);
    ctx.quadraticCurveTo(-128, cola + 8, -134, cola + 18);
    ctx.quadraticCurveTo(-110, cola + 16, -96, cola * 0.5 + 6);
    ctx.quadraticCurveTo(-56, 10, 0, 20);
    ctx.bezierCurveTo(60, 28, 116, 22, 124, 4);
    ctx.fill();
    ctx.beginPath(); // la aleta larga, de planear
    ctx.moveTo(58, 14);
    ctx.quadraticCurveTo(34, 46, -8, 52 + Math.sin(t * 0.5) * 5);
    ctx.quadraticCurveTo(24, 30, 36, 14);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- viñeta: en el lienzo, para que salga en las fotos ---------- */
  let vineta = null;
  function pintarVineta(ctx) {
    const W = world.W, H = world.H;
    if (!vineta) {
      vineta = document.createElement('canvas');
      vineta.width = 256;
      vineta.height = Math.max(64, Math.round(256 * H / W));
      const x = vineta.getContext('2d'), w = vineta.width, h = vineta.height;
      x.scale(w, h);
      const g = x.createRadialGradient(0.5, 0.4, 0.3, 0.5, 0.46, 0.8);
      g.addColorStop(0, 'rgba(1,8,18,0)');
      g.addColorStop(0.6, 'rgba(1,8,18,0.12)');
      g.addColorStop(1, 'rgba(1,8,18,0.42)');
      x.fillStyle = g;
      x.fillRect(0, 0, 1, 1);
    }
    ctx.drawImage(vineta, 0, 0, W, H);
  }

  /* ============================================================
     API
     ============================================================ */
  return {
    SPIRES,
    invalidar() { capas = null; vineta = null; },
    escena,

    lejos(ctx) {
      asegurar();
      pintarPlano(ctx, 'lejos', 0.45, 14);
      pintarLejanos(ctx);
      pintarLeviatan(ctx);
      pintarPlano(ctx, 'medio', 0.22, 6);
    },

    fondo(ctx) {
      asegurar();
      const bio = save.biome;
      if (biomeDef.wreck) pintarBarco(ctx);
      if (biomeDef.spires) pintarChimeneas(ctx);
      if (biomeDef.kelp) for (const k of KELP) pintarKelp(ctx, k, false);
      if (view.scale > 1.02) {
        // de cerca se pinta vectorial: hornearlo se notaría borroso
        pintarCerca(ctx);
        if (e.t > 0.01) {
          ctx.fillStyle = css(NOCHE, 0.62 * e.t);
          ctx.beginPath();
          contornoArena(ctx);
          ctx.fill();
        }
      } else {
        const w = world.W + MARGEN * 2, h = ALTO_CERCA + 20, y = world.H - ALTO_CERCA;
        fundido(ctx, 'cerca', 0.62, -MARGEN, y, w, h);
      }
      pintarCausticas(ctx);
      pintarHierba(ctx);
      if (biomeDef.wreck) pintarCofre(ctx);
      if (biomeDef.garden) pintarJardin(ctx);
      if (bio === 'arrecife') pintarAnemona(ctx);
    },

    frente(ctx) {
      if (biomeDef.kelp) pintarKelp(ctx, KELP_FRONT, true);
    },

    vineta: pintarVineta,
  };
})();
