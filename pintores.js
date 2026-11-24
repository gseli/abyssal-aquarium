/* ============================================================
   ACUARIO ABISAL — pintores
   Cómo se ve cada especie que no es de espina. Cada pintor
   recibe el ejemplar y solo lo lee. Las propiedades de pose
   (tenue, enterrada, baila, mira, retumba, mapa) las dejan los
   momentos; sin ellas valen 0.
   Requiere luz.js y dibujo.js. Cargar antes de creatures.js.
   ============================================================ */
'use strict';

const PINTAR = (() => {
  const { css, tono, mezcla, halo, giro, orientar } = luz;
  const { huso, cola, aleta, ojo, lomoVientre } = trazo;

  function elipse(ctx, x, y, rx, ry, color, ang = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, ang, 0, TAU);
    ctx.fill();
  }

  /* tentáculo que se afila: curva cuadrática con ancho */
  function brazo(ctx, ax, ay, cx, cy, bx, by, w) {
    const d = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / d * w, ny = (bx - ax) / d * w;
    ctx.moveTo(ax + nx, ay + ny);
    ctx.quadraticCurveTo(cx + nx * 0.5, cy + ny * 0.5, bx, by);
    ctx.quadraticCurveTo(cx - nx * 0.5, cy - ny * 0.5, ax - nx, ay - ny);
    ctx.closePath();
  }

  /* campana de medusa con borde festoneado */
  function campana(ctx, rw, rh, ondas, fase) {
    ctx.beginPath();
    ctx.moveTo(-rw, rh * 0.2);
    ctx.bezierCurveTo(-rw * 1.02, -rh * 1.25, rw * 1.02, -rh * 1.25, rw, rh * 0.2);
    for (let i = ondas; i > 0; i--) {
      const a = (i / ondas) * 2 - 1, b = ((i - 1) / ondas) * 2 - 1, m = (a + b) / 2;
      ctx.quadraticCurveTo(m * rw, rh * (0.52 - m * m * 0.2) + Math.sin(fase + i) * 1.2, b * rw, rh * (0.36 - b * b * 0.16));
    }
    ctx.closePath();
  }

  /* El banco llega a 90: cada sardina es una imagen ya pintada, una por tono
     y tinte del agua. Solo la cola y el destello se dibujan en vivo. */
  const sardinas = new Map();
  function spriteSardina(matiz) {
    const lomo = tono(mezcla('#1f9a72', '#157486', matiz)), panza = tono('#cdeee0');
    const clave = lomo + panza;
    let cv = sardinas.get(clave);
    if (cv) return cv;
    if (sardinas.size > 400) sardinas.clear();
    cv = document.createElement('canvas');
    cv.width = 120; cv.height = 60;
    const x = cv.getContext('2d'), a = 58, h = a * 0.36;
    x.translate(60, 30);
    huso(x, a, h);
    x.fillStyle = panza;
    x.fill();
    x.fillStyle = lomo; // lomo esmeralda
    x.beginPath();
    x.moveTo(a, 0);
    x.bezierCurveTo(a * 0.72, -h * 0.82, a * 0.1, -h * 1.2, -a * 0.46, -h * 0.5);
    x.quadraticCurveTo(-a * 0.8, -h * 0.14, -a, -h * 0.1);
    x.quadraticCurveTo(0, -h * 0.2, a, 0);
    x.fill();
    x.fillStyle = '#081018';
    x.beginPath(); x.arc(a * 0.64, -h * 0.14, h * 0.2, 0, TAU); x.fill();
    sardinas.set(clave, cv);
    return cv;
  }

  const pintores = {

    /* ==================== ARRECIFE ==================== */

    sardina(c, ctx) {
      const a = c.len * 0.68, h = a * 0.36, t = world.time;
      const matiz = Math.round((c.hue - 136) / 7) / 4;
      // el tinte va por escalones de hondura, para que las imágenes se compartan
      luz.hondura = Math.round(clamp(c.y / world.H, 0, 1) * 5) / 5;
      ctx.save();
      ctx.translate(c.x, c.y);
      orientar(ctx, c, c.vel.x, c.vel.y);
      const bate = Math.sin(t * 6 + c.seed * 7);
      cola(ctx, -a * 0.88, a * 0.5, h * 0.85, bate, tono(mezcla('#3c9c86', '#1c5c5c', matiz)), 0.8);
      const k = a / 58;
      ctx.drawImage(spriteSardina(matiz), -60 * k, -30 * k, 120 * k, 60 * k);
      // el destello de plata recorre el banco como una ola
      const destello = Math.max(0, Math.sin(t * 1.3 - c.x * 0.012 + c.seed * 0.02)) ** 6;
      ctx.fillStyle = css([190, 255, 225], 0.35 + destello * 0.65);
      ctx.fillRect(-a * 0.72, -h * 0.18, a * 1.3, h * 0.22);
      if (world.abyssMix > 0.05) halo(ctx, 0, 0, 7, [120, 255, 200], 0.6 * world.abyssMix);
      ctx.restore();
    },

    payaso(c, ctx) {
      const a = c.len * 0.72, h = a * 0.56, t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      orientar(ctx, c, c.vel.x, c.vel.y, 0.8);
      const bate = Math.sin(t * 5 + c.seed * 7), naranja = tono('#ee7a32'), filo = 'rgba(40,20,12,0.55)';
      cola(ctx, -a * 0.85, a * 0.5, h * 0.7, bate, naranja, 0.05);
      aleta(ctx, a * 0.35, -h * 0.75, -a * 0.6, -h * 0.4, -a * 0.35, -h * 1.45, naranja, filo);
      aleta(ctx, a * 0.05, h * 0.7, -a * 0.55, h * 0.4, -a * 0.35, h * 1.3, naranja, filo);
      huso(ctx, a, h);
      ctx.fillStyle = lomoVientre(ctx, h, '#c9501f', '#f58a3c', '#ffc078');
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (const [x, w, curva] of [[a * 0.4, a * 0.16, a * 0.1], [-a * 0.14, a * 0.17, a * 0.22], [-a * 0.8, a * 0.1, 0]]) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2, -h * 1.2);
        ctx.quadraticCurveTo(x - w / 2 + curva, 0, x - w / 2, h * 1.2);
        ctx.lineTo(x + w / 2, h * 1.2);
        ctx.quadraticCurveTo(x + w / 2 + curva, 0, x + w / 2, -h * 1.2);
        ctx.closePath();
        ctx.fillStyle = '#f8f4ea';
        ctx.fill();
        ctx.strokeStyle = filo;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
      ctx.restore();
      aleta(ctx, a * 0.2, h * 0.05, a * 0.12, h * 0.4, -a * 0.2, h * (0.35 + bate * 0.1), 'rgba(255,160,90,0.8)');
      ojo(ctx, a * 0.64, -h * 0.12, h * 0.18, '#c8601e');
      ctx.restore();
    },

    pulpo(c, ctx) {
      const t = world.time, R = c.r, k = c.calm * 0.8;
      const base = mezcla(c.baseRgb, mezcla(c.sandRgb, '#8f8c80', 0.5), k);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(giro(c, c.tx - c.x < 0 ? -1 : 1, 1.5), 1);
      // ocho brazos, los de atrás más oscuros
      for (const atras of [1, 0]) {
        ctx.fillStyle = tono(mezcla(base, '#1c0e14', atras ? 0.35 : 0.08));
        for (let i = 0; i < 4; i++) {
          const f = i - 1.5 + (atras ? 0.4 : 0);
          const riza = Math.sin(t * 1.1 + c.seed + i * 1.7 + atras * 2);
          ctx.beginPath();
          brazo(ctx, f * R * 0.3, R * 0.2, f * R * 0.9, R * (0.95 + riza * 0.12), f * R * 1.2 + riza * R * 0.35, R * (0.8 - Math.abs(f) * 0.1 + riza * 0.15), R * 0.2);
          ctx.fill();
        }
      }
      // manto echado hacia atrás
      const g = ctx.createRadialGradient(-R * 0.1, -R * 0.9, 1, -R * 0.3, -R * 0.4, R * 1.4);
      g.addColorStop(0, tono(mezcla(base, '#ffe2c8', 0.35)));
      g.addColorStop(1, tono(mezcla(base, '#2a1018', 0.3)));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(R * 0.55, R * 0.45);
      ctx.bezierCurveTo(R * 0.85, -R * 0.2, R * 0.7, -R * 0.7, R * 0.2, -R * 0.7);
      ctx.bezierCurveTo(-R * 0.1, -R * 1.35, -R * 1.4, -R * 1.25, -R * 1.3, -R * 0.45);
      ctx.bezierCurveTo(-R * 1.25, 0, -R * 0.65, 0, -R * 0.55, R * 0.45);
      ctx.quadraticCurveTo(0, R * 0.62, R * 0.55, R * 0.45);
      ctx.fill();
      // cromatóforos: solo se notan cuando vuelve a su color
      ctx.fillStyle = css([255, 214, 180], 0.4 * (1 - k) + 0.08);
      ctx.beginPath();
      for (let i = 0; i < 22; i++) {
        const a = i * 2.4 + c.seed, d = Math.sqrt(i / 22) * R * 0.5;
        const px = -R * 0.65 + Math.cos(a) * d, py = -R * 0.55 + Math.sin(a) * d * 0.8;
        ctx.moveTo(px + 0.9, py);
        ctx.arc(px, py, 0.9, 0, TAU);
      }
      ctx.fill();
      // ojos elevados, pupila horizontal
      for (const [x, s] of [[R * 0.02, 0.8], [R * 0.46, 1]]) {
        elipse(ctx, x, -R * 0.62, R * 0.19 * s, R * 0.16 * s, tono(mezcla(base, '#ffd9b0', 0.2)));
        elipse(ctx, x, -R * 0.64, R * 0.13 * s, R * 0.09 * s, '#e8d9a8');
        elipse(ctx, x, -R * 0.64, R * 0.11 * s, R * 0.03 * s, '#20140e');
      }
      ctx.restore();
    },

    raya(c, ctx) {
      const t = world.time, L = 62, oculta = c.enterrada || 0;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(giro(c, c.dir, 2.5), 1 - oculta * 0.55);
      ctx.globalAlpha *= 1 - oculta * 0.75;
      const onda = f => Math.sin(t * 1.9 + c.seed - f * 3);
      const gris = tono('#5c6c74');
      // ala lejana
      ctx.fillStyle = tono('#46545e');
      ctx.beginPath();
      ctx.moveTo(L * 0.4, -2);
      ctx.bezierCurveTo(L * 0.2, -L * 0.2, L * 0.02, -L * 0.3 - onda(0) * 8, -L * 0.1, -L * 0.36 - onda(0.5) * 10);
      ctx.bezierCurveTo(-L * 0.14, -L * 0.18, -L * 0.3, -L * 0.1, -L * 0.42, 0);
      ctx.fill();
      // cola látigo
      ctx.fillStyle = gris;
      ctx.beginPath();
      brazo(ctx, -L * 0.34, 0, -L * 0.9, onda(1) * 5, -L * 1.45, onda(1.6) * 9, 2.6);
      ctx.fill();
      // disco y ala cercana, con el borde que ondula como una bandera
      const g = ctx.createLinearGradient(0, -L * 0.2, 0, L * 0.3);
      g.addColorStop(0, tono('#6b7b7e'));
      g.addColorStop(0.55, tono('#9aa69c'));
      g.addColorStop(1, tono('#dfe4d4'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L * 0.56, 2);
      ctx.bezierCurveTo(L * 0.4, -L * 0.16, -L * 0.1, -L * 0.2, -L * 0.44, 0);
      ctx.quadraticCurveTo(-L * 0.36, L * 0.14 + onda(0.9) * 6, -L * 0.14, L * 0.25 + onda(0.6) * 8);
      ctx.quadraticCurveTo(L * 0.16, L * 0.22 + onda(0.2) * 6, L * 0.56, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,250,245,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // lunares azules de su familia
      ctx.fillStyle = 'rgba(120,200,230,0.55)';
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const x = -L * 0.22 + (i % 6) * L * 0.1, y = (i < 6 ? -1 : 6) + Math.sin(i * 2) * 2;
        ctx.moveTo(x + 1.2, y);
        ctx.arc(x, y, 1.2, 0, TAU);
      }
      ctx.fill();
      elipse(ctx, L * 0.28, -L * 0.1, 4, 2.6, gris);
      ojo(ctx, L * 0.29, -L * 0.115, 1.9, '#c8c09a');
      ctx.restore();
    },

    medusa(c, ctx) {
      const s = Math.sin(c.pulse), t = world.time, R = c.r;
      const rw = R * (1 + 0.13 * s), rh = R * (0.78 - 0.12 * s);
      const brillo = 0.75 + world.abyssMix * 0.35;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.sin(t * 0.3 + c.seed) * 0.12);
      halo(ctx, 0, 0, R * 2.4, [190, 170, 255], 0.14 * brillo + world.abyssMix * 0.2);
      // hilos: la onda baja por ellos con retraso
      ctx.strokeStyle = css([215, 205, 255], 0.3 * brillo);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 0; i < 15; i++) {
        const f = i / 14 * 2 - 1;
        ctx.moveTo(f * rw * 0.9, rh * 0.3);
        for (let j = 1; j <= 7; j++) {
          ctx.lineTo(f * rw * (0.9 - j * 0.04) + Math.sin(c.pulse - j * 0.8 + i * 0.35) * j * 1.2,
            rh * 0.3 + j * R * (0.27 + ((i * 7) % 5) * 0.02));
        }
      }
      ctx.stroke();
      // brazos orales, como encaje
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * rw * 0.22, va = Math.sin(c.pulse - 1.2 + i) * R * 0.22;
        ctx.fillStyle = css([240, 200, 240], 0.22 * brillo);
        ctx.beginPath();
        brazo(ctx, x, rh * 0.2, x + va * 1.6, rh + R * 0.5, x * 1.8 - va, rh + R * 1.3, R * 0.17);
        ctx.fill();
      }
      const g = ctx.createRadialGradient(0, -rh * 0.5, 0, 0, 0, rw * 1.1);
      g.addColorStop(0, css([250, 240, 255], 0.5 * brillo));
      g.addColorStop(0.65, css([190, 170, 250], 0.26 * brillo));
      g.addColorStop(1, css([215, 220, 255], 0.5 * brillo));
      campana(ctx, rw, rh, 8, c.pulse);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = css([238, 232, 255], 0.55 * brillo);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      // el trébol
      ctx.strokeStyle = css([255, 160, 215], 0.75 * brillo);
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * rw * 0.22, -rh * 0.22 + Math.sin(a) * rh * 0.16, rw * 0.15, rh * 0.12, a, 0.7, TAU - 0.7);
        ctx.stroke();
      }
      ctx.restore();
    },

    estrella(c, ctx) {
      const R = c.r, t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot + Math.sin(t * 0.3 + c.seed) * 0.03);
      const puntas = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2, d = Math.sin(t * 0.22 + c.seed + i * 1.3) * 0.12;
        puntas.push([a, d]);
      }
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, R);
      g.addColorStop(0, tono('#ffc27a'));
      g.addColorStop(0.55, tono('#e98a45'));
      g.addColorStop(1, tono('#b85c3c'));
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const [a, d] = puntas[i], a0 = a - TAU / 10, a1 = a + TAU / 10;
        const pt = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r];
        if (!i) ctx.moveTo(...pt(a0, R * 0.36));
        ctx.quadraticCurveTo(...pt(a - 0.24, R * 0.6), ...pt(a + d - 0.07, R * 0.95));
        ctx.quadraticCurveTo(...pt(a + d, R * 1.08), ...pt(a + d + 0.07, R * 0.95));
        ctx.quadraticCurveTo(...pt(a + 0.24, R * 0.6), ...pt(a1, R * 0.36));
      }
      ctx.closePath();
      ctx.fill();
      // espinitas en hilera por cada brazo
      ctx.fillStyle = 'rgba(255,232,190,0.75)';
      ctx.beginPath();
      for (const [a, d] of puntas) {
        for (let k = 1; k <= 5; k++) {
          const aa = a + d * (k / 5), r = R * 0.17 * k, s = 1.4 - k * 0.14;
          ctx.moveTo(Math.cos(aa) * r + s, Math.sin(aa) * r);
          ctx.arc(Math.cos(aa) * r, Math.sin(aa) * r, s, 0, TAU);
        }
      }
      ctx.fill();
      ctx.restore();
    },

    ermitano(c, ctx) {
      const t = world.time, fuera = 1 - c.hide;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(giro(c, c.dir, 4) * 1.25, 1.25);
      if (fuera > 0.1) {
        ctx.strokeStyle = tono('#b65f3c');
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const paso = Math.sin(t * 4.5 + i * 2.1 + c.seed) * 2.2 * fuera;
          ctx.moveTo(3 + i * 2, 0);
          ctx.quadraticCurveTo(7 + i * 3 + paso * 0.5, -3 * fuera, 8 + i * 3.4 + paso, 5);
        }
        ctx.moveTo(7, -2); ctx.quadraticCurveTo(8, -6, 9, -8.5 * fuera);
        ctx.moveTo(9, -2); ctx.quadraticCurveTo(11, -5, 12.5, -7.5 * fuera);
        ctx.stroke();
        ojo(ctx, 9, -9 * fuera, 1.3, null);
        ojo(ctx, 12.6, -8 * fuera, 1.2, null);
        ctx.fillStyle = tono('#d98250');
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.bezierCurveTo(9, -4, 15 + fuera * 2, -2, 14 + fuera * 2, 3.5);
        ctx.quadraticCurveTo(12.5, 1, 11.5, 1.4);
        ctx.quadraticCurveTo(10, 4.6, 6, 0);
        ctx.fill();
      }
      // concha en espiral, con su pico
      const g = ctx.createLinearGradient(-6, -14, 2, 4);
      g.addColorStop(0, tono('#f0d8b0'));
      g.addColorStop(0.55, tono('#b88c62'));
      g.addColorStop(1, tono('#6c4a38'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(8, 2);
      ctx.bezierCurveTo(10, -10, 0, -15, -6, -11);
      ctx.quadraticCurveTo(-11, -11, -17, -8);
      ctx.quadraticCurveTo(-12, -5, -11, -2);
      ctx.bezierCurveTo(-9, 4, 4, 5, 8, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,48,30,0.5)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const [x, h] of [[-13, 3], [-9, 6], [-3, 9]]) {
        ctx.moveTo(x + 1, -7 - h * 0.6);
        ctx.quadraticCurveTo(x - 3, -4, x + 2, -7 + h);
      }
      ctx.stroke();
      ctx.restore();
    },

    faroluz(c, ctx) {
      const L = c.len, a = L * 0.55, h = L * 0.3, t = world.time, tenue = c.tenue || 0;
      ctx.save();
      ctx.translate(c.x, c.y);
      orientar(ctx, c, c.vel.x, c.vel.y, 0.5);
      const luzK = (0.88 + 0.12 * Math.sin(t * 1.4 + c.seed * 9)) * (1 - tenue * 0.55);
      const bx = L * 0.68, by = -L * 0.56 + Math.sin(t * 1.1 + c.seed) * 1.5 + tenue * L * 0.22; // al saludar, lo inclina
      const color = mezcla([255, 196, 110], [255, 150, 170], tenue);
      halo(ctx, bx, by, (26 + world.abyssMix * 26) * luzK, color, 0.7 * luzK);
      const bate = Math.sin(t * 4.5 + c.seed * 5);
      cola(ctx, -a * 0.8, a * 0.7, h * 0.9, bate, 'rgba(100,110,190,0.6)', 0.25);
      aleta(ctx, a * 0.1, -h * 0.75, -a * 0.6, -h * 0.4, -a * 0.6, -h * 1.45, 'rgba(90,100,180,0.6)', 'rgba(190,200,255,0.3)');
      huso(ctx, a, h, 1.15);
      ctx.fillStyle = lomoVientre(ctx, h, '#151a3c', '#2c3468', '#6c5c78');
      ctx.fill();
      // el farol le ilumina la cara
      halo(ctx, a * 0.7, -h * 0.4, h * 1.5, color, 0.22 * luzK);
      aleta(ctx, a * 0.16, h * 0.1, a * 0.05, h * 0.45, -a * 0.35, h * (0.5 + bate * 0.12), 'rgba(140,150,220,0.45)');
      ctx.strokeStyle = '#4a5080';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(a * 0.4, -h * 0.75);
      ctx.bezierCurveTo(a * 0.4, -L * 0.6, bx - 6, by - 8, bx, by - 3.5);
      ctx.stroke();
      // farolillo de papel
      elipse(ctx, bx, by, 3, 4, css(mezcla(color, '#fff6d8', 0.6), 0.5 + 0.5 * luzK));
      ctx.fillStyle = '#6a5040';
      ctx.fillRect(bx - 1.6, by - 4.6, 3.2, 1.2);
      ctx.fillRect(bx - 1.2, by + 3.4, 2.4, 1);
      ojo(ctx, a * 0.58, -h * 0.12, h * 0.21, '#e8c98a');
      ctx.restore();
    },

    espejo(c, ctx) {
      const a = c.len * 0.55, h = a * 0.72, t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      orientar(ctx, c, c.vel.x, c.vel.y, 0.8);
      const bate = Math.sin(t * 4 + c.seed * 5);
      const velo = css(mezcla(c.tint, '#eef8ff', 0.35), 0.6), radios = 'rgba(255,255,255,0.35)';
      aleta(ctx, a * 0.2, -h * 0.75, -a * 0.6, -h * 0.4, -a * 0.95, -h * 1.75, velo, radios);
      aleta(ctx, a * 0.1, h * 0.75, -a * 0.6, h * 0.4, -a * 0.9, h * 1.6, velo, radios);
      cola(ctx, -a * 0.85, a * 0.65, h * 0.7, bate, velo, 0.7);
      huso(ctx, a, h);
      // cromo: arriba la superficie, abajo el fondo, y en medio el vecino
      const g = ctx.createLinearGradient(0, -h, 0, h);
      g.addColorStop(0, '#eafaff');
      g.addColorStop(0.36, css(mezcla(c.tint, '#ffffff', 0.35)));
      g.addColorStop(0.52, css(mezcla(c.tint, '#16283a', 0.5)));
      g.addColorStop(0.75, css(c.tint));
      g.addColorStop(1, css(mezcla(c.tint, '#ffffff', 0.5)));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      const x = Math.sin(t * 0.8 + c.seed) * a * 1.4; // reflejo que resbala
      const b = ctx.createLinearGradient(x - a * 0.4, 0, x + a * 0.4, a * 0.2);
      b.addColorStop(0, 'rgba(255,255,255,0)');
      b.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      b.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = b;
      ctx.fillRect(-a, -h * 1.3, a * 2, h * 2.6);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ojo(ctx, a * 0.62, -h * 0.14, h * 0.15, '#cfe2ea');
      ctx.restore();
    },

    buzo(c, ctx) {
      const t = world.time, patada = Math.sin(t * 2 + c.seed);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(giro(c, c.dir, 2.5) * 1.25, 1.25);
      ctx.rotate(Math.sin(t * 0.8 + c.seed) * 0.04);
      ctx.lineCap = ctx.lineJoin = 'round';
      // linterna: un cono muy suave
      const haz = ctx.createLinearGradient(22, -4, 120, 24);
      haz.addColorStop(0, 'rgba(255,236,190,0.2)');
      haz.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = haz;
      ctx.beginPath();
      ctx.moveTo(23, -4); ctx.lineTo(124, 0); ctx.lineTo(108, 50);
      ctx.fill();
      const traje = tono('#1c3d56'), sombra = tono('#122a3e');
      for (const s of [-1, 1]) {
        const p = patada * s * 3.5;
        ctx.strokeStyle = s < 0 ? sombra : traje;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-6, 5);
        ctx.quadraticCurveTo(-13, 10 + p * 0.4, -22, 14 + p);
        ctx.stroke();
        ctx.fillStyle = tono(s < 0 ? '#a8843c' : '#d8ac54');
        ctx.beginPath();
        ctx.moveTo(-20, 12 + p);
        ctx.quadraticCurveTo(-31, 12 + p * 1.5, -40, 19 + p * 2.2);
        ctx.quadraticCurveTo(-30, 20 + p * 1.5, -22, 16.5 + p);
        ctx.fill();
      }
      ctx.save(); // botella a la espalda
      ctx.translate(-4, -13);
      ctx.rotate(-0.45);
      const bot = ctx.createLinearGradient(0, -5, 0, 5);
      bot.addColorStop(0, tono('#f4d48c'));
      bot.addColorStop(1, tono('#a8762c'));
      ctx.fillStyle = bot;
      ctx.beginPath(); ctx.roundRect(-12, -4.5, 22, 9, 4.5); ctx.fill();
      ctx.restore();
      const g = ctx.createLinearGradient(0, -16, 4, 10);
      g.addColorStop(0, tono('#3c7392'));
      g.addColorStop(1, tono('#143246'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, 2);
      ctx.bezierCurveTo(-4, -8, 2, -14, 9, -14);
      ctx.bezierCurveTo(14, -8, 8, 4, -4, 9);
      ctx.quadraticCurveTo(-11, 10, -10, 2);
      ctx.fill();
      ctx.strokeStyle = traje;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(7, -8);
      ctx.quadraticCurveTo(9, 4, 20, -3 + Math.sin(t + c.seed) * 1.5);
      ctx.stroke();
      elipse(ctx, 22, -4, 3.4, 2.4, '#8296a0');
      halo(ctx, 24, -4, 10, [255, 240, 200], 0.8);
      // casco de latón
      const cas = ctx.createRadialGradient(10, -25, 1, 13, -20, 11);
      cas.addColorStop(0, tono('#fbe6b0'));
      cas.addColorStop(0.6, tono('#c8985c'));
      cas.addColorStop(1, tono('#7c5434'));
      elipse(ctx, 13, -20, 9.5, 9, cas);
      const vis = ctx.createLinearGradient(13, -26, 21, -15);
      vis.addColorStop(0, '#c9f6ff');
      vis.addColorStop(0.4, '#4aa6c4');
      vis.addColorStop(1, '#123c54');
      elipse(ctx, 17.2, -20, 5, 5.8, vis, 0.2);
      ctx.strokeStyle = '#8c6438';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.strokeStyle = '#40586a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(6, -24);
      ctx.bezierCurveTo(-2, -28, -9, -20, -8, -13);
      ctx.stroke();
      ctx.restore();
    },

    /* ==================== MAR BURBUJEANTE ==================== */

    jardin(c, ctx) {
      const fuera = c.out(), base = (c.baseY ?? world.floorY(c.x)) + 4, t = world.time;
      const crema = '#e6dcc0';
      elipse(ctx, c.x, base, 6, 2, 'rgba(50,50,40,0.3)'); // la madriguera
      if (fuera < 0.03) {
        elipse(ctx, c.x, base - 2, 2, 2, tono(crema)); // solo el hocico, vigilante
        return;
      }
      const baile = c.baila || 0, fase = c.faseBaile || 0;
      const H = c.h * fuera * (1.15 + baile * 0.35), n = 12, pts = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const propio = Math.sin(t * 0.8 + c.seed + f * 2.6) * 7;
        const juntas = Math.sin(fase - f * 2.4) * 20;
        pts.push([c.x + lerp(propio, juntas, baile) * f, base - H * f]);
      }
      const [ux, uy] = pts[n];
      const d = Math.sin(t * 0.3 + c.seed) < 0 ? -1 : 1;
      const g = luz.seguir(c, 'mira', d, 2);
      pts.push([ux + g * 3.5, uy - 2.5], [ux + g * 7, uy - 0.5]); // el signo de interrogación
      ctx.save();
      ctx.lineCap = ctx.lineJoin = 'round';
      for (const [color, w, dx] of [[tono('#a89c7c'), 4.6, 0], [tono(crema), 2.6, -0.7]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] + dx, pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + dx, pts[i][1]);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(84,70,48,0.6)';
      ctx.beginPath();
      for (let i = 1; i < n; i++) {
        const r = i % 4 ? 0.7 : 1.6;
        ctx.moveTo(pts[i][0] + r, pts[i][1]);
        ctx.arc(pts[i][0], pts[i][1], r, 0, TAU);
      }
      ctx.fill();
      ojo(ctx, ux + g * 4.5, uy - 2.6, 1.2, null);
      ctx.restore();
    },

    caballito(c, ctx) {
      const L = c.len, t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(giro(c, c.dir, 2.5) * L, L);
      ctx.rotate(Math.sin(t * 0.85 + c.seed) * 0.08);
      ctx.lineCap = 'round';
      const abre = Math.sin(t * 4 + c.seed) * 0.03;
      aleta(ctx, -0.14, -0.14, -0.14, 0.14, -0.38, 0.02 + abre, 'rgba(255,224,160,0.55)');
      const g = ctx.createLinearGradient(-0.2, -0.4, 0.2, 0.4);
      g.addColorStop(0, tono('#c9822f'));
      g.addColorStop(0.5, tono('#eeb450'));
      g.addColorStop(1, tono('#f8dc94'));
      // cuerpo en S, de una pieza, con cola que se enrolla
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0.5, -0.4);
      ctx.quadraticCurveTo(0.36, -0.46, 0.27, -0.55);
      ctx.lineTo(0.21, -0.65); ctx.lineTo(0.17, -0.57); ctx.lineTo(0.1, -0.62);
      ctx.quadraticCurveTo(0.02, -0.56, 0, -0.45);
      ctx.bezierCurveTo(-0.04, -0.34, -0.2, -0.22, -0.19, 0);
      ctx.bezierCurveTo(-0.18, 0.2, -0.06, 0.3, -0.12, 0.44);
      ctx.lineTo(-0.03, 0.46);
      ctx.bezierCurveTo(0.06, 0.3, 0.18, 0.12, 0.17, -0.02);
      ctx.bezierCurveTo(0.16, -0.18, 0.06, -0.24, 0.14, -0.32);
      ctx.quadraticCurveTo(0.28, -0.3, 0.34, -0.36);
      ctx.quadraticCurveTo(0.42, -0.34, 0.5, -0.35);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = g;
      let w = 0.1, px = -0.075, py = 0.43;
      for (let i = 1; i <= 16; i++) {
        const a = 0.2 + i * 0.33, r = 0.16 * (1 - i / 22);
        const x = -0.02 + Math.cos(Math.PI + a) * -r - 0.02, y = 0.5 + Math.sin(a) * r;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
        px = x; py = y; w = Math.max(0.025, w - 0.006);
      }
      // placas óseas
      ctx.strokeStyle = 'rgba(130,74,20,0.3)';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const y = -0.22 + i * 0.1;
        ctx.moveTo(-0.16 + Math.max(0, i - 3) * 0.02, y);
        ctx.quadraticCurveTo(0, y + 0.05, 0.13 - Math.max(0, i - 2) * 0.03, y - 0.01);
      }
      ctx.stroke();
      ojo(ctx, 0.19, -0.45, 0.045, '#fbe6b0');
      ctx.restore();
    },

    globo(c, ctx) {
      const L = c.len, k = c.inflate, t = world.time;
      const rx = L * (0.5 + 0.18 * k), ry = L * (0.29 + 0.37 * k);
      ctx.save();
      ctx.translate(c.x, c.y);
      // inflado no manda sobre su rumbo (gira como una pelota): conserva el frente
      orientar(ctx, c, k > 0.2 ? 0 : c.vel.x, k > 0.2 ? 0 : c.vel.y, 0.35);
      const bate = Math.sin(t * 4.5 + c.seed * 5), velo = tono('#b9a56a', 0.85);
      cola(ctx, -rx * 0.88, L * 0.3 * (1 - k * 0.5), L * 0.2 * (1 - k * 0.4), bate, velo, 0.1);
      aleta(ctx, -rx * 0.3, -ry * 0.8, -rx * 0.6, -ry * 0.6, -rx * 0.75, -ry - L * 0.12, velo);
      if (k > 0.05) {
        ctx.fillStyle = tono('#d8c48c', Math.min(1, k * 1.6));
        ctx.beginPath();
        for (let i = 0; i < 30; i++) {
          const a = (i / 30) * TAU, ca = Math.cos(a), sa = Math.sin(a);
          ctx.moveTo(ca * rx - sa * 1.6, sa * ry + ca * 1.6);
          ctx.lineTo(ca * rx * (1 + 0.22 * k), sa * ry * (1 + 0.22 * k));
          ctx.lineTo(ca * rx + sa * 1.6, sa * ry - ca * 1.6);
        }
        ctx.fill();
      }
      const g = ctx.createRadialGradient(rx * 0.15, -ry * 0.6, 1, 0, 0, rx * 1.25);
      g.addColorStop(0, tono('#d8c684'));
      g.addColorStop(1, tono('#94804c'));
      ctx.beginPath();
      ctx.moveTo(rx * 1.02, ry * 0.08);
      ctx.bezierCurveTo(rx * 0.9, -ry * 1.12, -rx * 0.6, -ry * 1.2, -rx * 0.96, -ry * 0.1);
      ctx.bezierCurveTo(-rx * 0.9, ry * 0.95, rx * 0.6, ry * 1.3, rx * 1.02, ry * 0.08);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      elipse(ctx, rx * 0.1, ry * 0.75, rx * 1.1, ry * 0.65, tono('#f6efd6', 0.85));
      ctx.fillStyle = 'rgba(250,250,225,0.6)';
      ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const a = i * 2.4 + c.seed, d = Math.sqrt(i / 26);
        const x = Math.cos(a) * d * rx - rx * 0.1, y = Math.sin(a) * d * ry * 0.7 - ry * 0.3;
        ctx.moveTo(x + 1, y);
        ctx.arc(x, y, 1, 0, TAU);
      }
      ctx.fill();
      ctx.restore();
      aleta(ctx, rx * 0.08, 0, rx * 0.02, ry * 0.25, -rx * 0.3, ry * (0.2 + bate * 0.15), 'rgba(240,225,170,0.65)');
      ojo(ctx, rx * 0.58, -ry * 0.28, L * (0.075 + k * 0.025), '#e4bc5c');
      elipse(ctx, rx * 0.99, ry * 0.1, 1.8, 2.2, '#7c6238');
      ctx.restore();
    },

    tortuga(c, ctx) {
      const t = world.time, rema = Math.sin(t * 1.3 + c.seed);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(giro(c, c.dir, 1.8) * 1.15, 1.15);
      ctx.rotate(Math.sin(t * 0.35 + c.seed) * 0.06 + rema * 0.025);
      const piel = tono('#7c9c70'), lejos = tono('#4c6c58');
      function remo(x, y, ang, largo, ancho, color, escamas) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(2, -ancho * 0.4);
        ctx.bezierCurveTo(-largo * 0.3, -ancho, -largo * 0.8, -ancho * 0.6, -largo, ancho * 0.5);
        ctx.bezierCurveTo(-largo * 0.6, ancho * 0.3, -largo * 0.2, ancho * 0.7, 2, ancho * 0.5);
        ctx.fill();
        if (escamas) {
          ctx.fillStyle = 'rgba(40,64,44,0.4)';
          ctx.beginPath();
          for (let i = 1; i < 7; i++) {
            const px = -largo * i / 8, py = -ancho * 0.2 + (i % 2) * 2;
            ctx.moveTo(px + 1.7, py);
            ctx.ellipse(px, py, 1.7, 1.2, 0, 0, TAU);
          }
          ctx.fill();
        }
        ctx.restore();
      }
      remo(16, -4, 0.75 - rema * 0.5, 36, 7, lejos);
      remo(-25, 4, -0.35 + rema * 0.12, 16, 6, lejos);
      // cuello y cabeza
      const cab = ctx.createLinearGradient(0, -16, 0, 6);
      cab.addColorStop(0, tono('#5c8060'));
      cab.addColorStop(1, tono('#c9cca0'));
      ctx.fillStyle = cab;
      ctx.beginPath();
      ctx.moveTo(18, -6);
      ctx.bezierCurveTo(28, -7, 32, -15, 41, -13);
      ctx.bezierCurveTo(49, -12, 51, -7, 50, -4);
      ctx.bezierCurveTo(44, 1, 36, 2, 22, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(40,64,44,0.4)';
      for (const [x, y] of [[37, -10], [41, -11.5], [45, -10], [35, -6]]) {
        ctx.beginPath(); ctx.ellipse(x, y, 1.6, 1.1, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = tono('#d9d2ae'); // plastrón
      ctx.beginPath();
      ctx.moveTo(-30, 3);
      ctx.quadraticCurveTo(0, 17, 30, 3);
      ctx.fill();
      const cap = ctx.createLinearGradient(0, -22, 0, 8);
      cap.addColorStop(0, tono('#93a968'));
      cap.addColorStop(0.5, tono('#50724c'));
      cap.addColorStop(1, tono('#2c4838'));
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.moveTo(-36, 4);
      ctx.bezierCurveTo(-24, -24, 18, -26, 31, 2);
      ctx.quadraticCurveTo(0, 10, -36, 4);
      ctx.fill();
      ctx.save();
      ctx.clip();
      // escudos con su veta radiada
      ctx.strokeStyle = 'rgba(225,220,160,0.4)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-34, -3); ctx.quadraticCurveTo(0, -20, 30, -3);
      for (const x of [-20, -6, 8, 21]) {
        ctx.moveTo(x, -22); ctx.lineTo(x + 2, -10); ctx.lineTo(x - 2, 9);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(30,50,32,0.35)';
      ctx.beginPath();
      for (const x of [-26, -13, 1, 14, 25]) {
        for (let k = -2; k <= 2; k++) { ctx.moveTo(x, 1); ctx.lineTo(x + k * 3, -7); }
      }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(225,245,210,0.3)';
      ctx.stroke();
      remo(18, 4, -0.8 + rema * 0.55, 40, 8, piel, true);
      ojo(ctx, 43, -8, 1.8, null);
      ctx.strokeStyle = 'rgba(27,36,22,0.5)';
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(50, -4.5); ctx.lineTo(44, -3.4); ctx.stroke();
      ctx.restore();
    },

    copa(c, ctx) {
      const a = c.len * 0.56, h = a * 0.66, t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      orientar(ctx, c, c.vel.x, c.vel.y, 0.4);
      const bate = Math.sin(t * 4 + c.seed * 3);
      const vidrio = 'rgba(222,246,252,0.4)', radios = 'rgba(255,255,255,0.5)';
      cola(ctx, -a * 0.85, a * 0.6, h * 0.75, bate, vidrio, 0.5);
      aleta(ctx, a * 0.2, -h * 0.8, -a * 0.5, -h * 0.5, -a * 0.6, -h * 1.5, vidrio, radios);
      huso(ctx, a, h);
      const g = ctx.createLinearGradient(0, -h, 0, h);
      g.addColorStop(0, 'rgba(240,252,255,0.45)');
      g.addColorStop(0.5, 'rgba(200,235,248,0.12)');
      g.addColorStop(1, 'rgba(230,250,255,0.4)');
      ctx.fillStyle = g;
      ctx.fill();
      // la gaseosa, con el nivel según lo bebido
      if (c.fill > 0.03) {
        ctx.save();
        ctx.clip();
        const n = lerp(h, -h * 0.6, c.fill), ola = Math.sin(t * 2 + c.seed) * 1.2;
        const s = ctx.createLinearGradient(0, n, 0, h);
        s.addColorStop(0, 'rgba(255,226,150,0.8)');
        s.addColorStop(1, 'rgba(236,160,70,0.65)');
        ctx.fillStyle = s;
        ctx.beginPath();
        ctx.moveTo(-a, n + ola);
        ctx.bezierCurveTo(-a * 0.3, n - ola * 2, a * 0.3, n + ola * 2, a, n - ola);
        ctx.lineTo(a, h * 2); ctx.lineTo(-a, h * 2);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          const f = (t * 0.5 + i / 6) % 1;
          elipse(ctx, Math.sin(i * 2.1 + c.seed) * a * 0.5, lerp(h, n, f), 0.9, 0.9, css([255, 250, 230], 1 - f));
        }
        ctx.restore();
        huso(ctx, a, h);
      }
      ctx.strokeStyle = 'rgba(240,252,255,0.75)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(a * 0.5, -h * 0.55);
      ctx.quadraticCurveTo(0, -h * 0.9, -a * 0.4, -h * 0.38);
      ctx.stroke();
      ojo(ctx, a * 0.62, -h * 0.1, h * 0.14, null, '#12303e');
      ctx.restore();
    },

    sifon(c, ctx) {
      const s = Math.sin(c.pulse), t = world.time, R = c.r;
      const rw = R * (1 + 0.18 * s), rh = R * (0.95 - 0.16 * s);
      ctx.save();
      ctx.translate(c.x, c.y);
      halo(ctx, 0, 0, R * 2.2, [170, 240, 255], 0.22);
      // rosarios de burbujas en lugar de tentáculos
      ctx.fillStyle = 'rgba(220,250,255,0.6)';
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        for (let j = 1; j < 8; j++) {
          const x = i * rw * 0.3 + Math.sin(t * 1.4 + c.seed + i - j * 0.6) * j * 0.8, y = rh * 0.2 + j * R * 0.24;
          const r = 1.6 - j * 0.15;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
      }
      ctx.fill();
      const g = ctx.createRadialGradient(0, -rh * 0.3, 0, 0, -rh * 0.1, rw * 1.1);
      g.addColorStop(0, 'rgba(225,252,255,0.08)');
      g.addColorStop(0.75, 'rgba(175,238,250,0.3)');
      g.addColorStop(1, 'rgba(240,255,255,0.65)');
      campana(ctx, rw, rh, 6, c.pulse);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(235,253,255,0.65)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = i * 2.2 + c.seed, r = 1.5 + (i % 3);
        const x = Math.cos(a) * rw * 0.45, y = -rh * 0.3 + Math.sin(a + t * 0.6) * rh * 0.2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      }
      elipse(ctx, -rw * 0.4, -rh * 0.42, rw * 0.22, rh * 0.09, 'rgba(255,255,255,0.65)', -0.6);
      ctx.restore();
    },

    /* ==================== ABISMO ==================== */

    rape(c, ctx) {
      const L = c.len, t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      orientar(ctx, c, c.vel.x, c.vel.y, 0.3);
      const bx = L * 0.66, by = -L * 0.5 + Math.sin(t * 0.9 + c.seed) * 2.5;
      const k = 0.85 + 0.15 * Math.sin(t * 1.3 + c.seed * 9);
      const bate = Math.sin(t * 2.6 + c.seed * 5);
      cola(ctx, -L * 0.42, L * 0.24, L * 0.2, bate, 'rgba(96,66,92,0.75)', 0.1);
      aleta(ctx, -L * 0.2, -L * 0.24, -L * 0.4, -L * 0.12, -L * 0.46, -L * 0.4, 'rgba(96,66,92,0.6)', 'rgba(200,170,200,0.3)');
      const abre = 0.6 + 0.2 * Math.sin(t * 0.8 + c.seed);
      const g = ctx.createRadialGradient(L * 0.4, -L * 0.3, 2, 0, 0, L * 0.8);
      g.addColorStop(0, tono('#5a4a58'));
      g.addColorStop(0.5, tono('#35232f'));
      g.addColorStop(1, tono('#160f19'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L * 0.44, -L * 0.12);
      ctx.bezierCurveTo(L * 0.36, -L * 0.42, -L * 0.2, -L * 0.44, -L * 0.46, -L * 0.06);
      ctx.bezierCurveTo(-L * 0.5, L * 0.06, -L * 0.3, L * 0.34, L * 0.08, L * 0.38);
      ctx.quadraticCurveTo(L * 0.44, L * 0.4, L * 0.52, L * 0.22 * abre);
      ctx.quadraticCurveTo(L * 0.2, L * 0.16, L * 0.12, L * 0.02);
      ctx.quadraticCurveTo(L * 0.3, -L * 0.04, L * 0.44, -L * 0.12);
      ctx.fill();
      // el hueco de la boca
      ctx.fillStyle = '#08040a';
      ctx.beginPath();
      ctx.moveTo(L * 0.44, -L * 0.11);
      ctx.quadraticCurveTo(L * 0.2, -L * 0.04, L * 0.12, L * 0.02);
      ctx.quadraticCurveTo(L * 0.2, L * 0.17, L * 0.51, L * 0.22 * abre);
      ctx.quadraticCurveTo(L * 0.4, L * 0.04, L * 0.44, -L * 0.11);
      ctx.fill();
      // dientes de aguja, de cristal
      ctx.fillStyle = 'rgba(215,240,232,0.8)';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const x = L * (0.43 - i * 0.052), y0 = -L * 0.1 + i * L * 0.02, y1 = L * (0.22 * abre - i * 0.018);
        const l = L * (i % 2 ? 0.05 : 0.085);
        ctx.moveTo(x, y0); ctx.lineTo(x - 1.1, y0 + l); ctx.lineTo(x - 2, y0 + 0.4);
        ctx.moveTo(x + 1.5, y1); ctx.lineTo(x, y1 - l); ctx.lineTo(x - 0.8, y1 + 0.4);
      }
      ctx.fill();
      ctx.fillStyle = 'rgba(200,170,200,0.2)'; // verrugas
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4 + c.seed, d = Math.sqrt(i / 16) * L * 0.25;
        ctx.moveTo(-L * 0.14 + Math.cos(a) * d + 1, Math.sin(a) * d);
        ctx.arc(-L * 0.14 + Math.cos(a) * d, Math.sin(a) * d, 1, 0, TAU);
      }
      ctx.fill();
      ojo(ctx, L * 0.22, -L * 0.18, L * 0.032, '#cfe8dd');
      ctx.strokeStyle = '#6a4a64';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(L * 0.16, -L * 0.28);
      ctx.bezierCurveTo(L * 0.18, -L * 0.66, bx - 6, by - 12, bx, by);
      ctx.stroke();
      halo(ctx, bx, by, 44, [100, 230, 180], 0.5 * k);
      halo(ctx, bx, by, 12, [200, 255, 225], 0.9 * k);
      elipse(ctx, bx, by, 2.2, 2.6, '#e4fff0');
      ctx.restore();
    },

    vampiro(c, ctx) {
      const R = c.r, t = world.time, k = c.scared, flip = 1 - 2 * k;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.sin(t * 0.35 + c.seed) * 0.12);
      const oreja = Math.sin(t * 1.6 + c.seed) * 0.2;
      for (const s of [-1, 1]) elipse(ctx, s * R * 0.72, -R * 0.82, R * 0.42, R * 0.15, tono('#7c3c4c'), s * (-0.5 + oreja));
      const g = ctx.createLinearGradient(0, -R * 1.2, 0, R * 0.4);
      g.addColorStop(0, tono('#a8505c'));
      g.addColorStop(1, tono('#4c1e30'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-R * 0.62, R * 0.2);
      ctx.bezierCurveTo(-R * 0.95, -R * 0.9, -R * 0.4, -R * 1.25, 0, -R * 1.25);
      ctx.bezierCurveTo(R * 0.4, -R * 1.25, R * 0.95, -R * 0.9, R * 0.62, R * 0.2);
      ctx.closePath();
      ctx.fill();
      const ojos = () => {
        for (const s of [-1, 1]) {
          halo(ctx, s * R * 0.4, -R * 0.1, R * 0.5, [120, 205, 255], 0.8);
          elipse(ctx, s * R * 0.4, -R * 0.1, R * 0.15, R * 0.11, '#a9e2f4', s * 0.3);
          elipse(ctx, s * R * 0.4, -R * 0.1, R * 0.07, R * 0.08, '#0a1420');
        }
      };
      if (flip > 0) ojos(); // la capa, al voltearse, los tapa
      // paraguas de brazos con membrana
      const puntas = [];
      for (let i = 0; i <= 7; i++) {
        const f = i / 7 * 2 - 1;
        puntas.push([f * R * (1 + 0.1 * Math.sin(t * 0.9 + c.seed)) * (0.65 + 0.4 * Math.abs(flip)),
          R * 0.15 + (R * (1.15 - f * f * 0.5) + Math.sin(t * 1.2 + i + c.seed) * 2) * flip]);
      }
      const m = ctx.createLinearGradient(0, 0, 0, R * 1.3 * (flip || 0.01));
      m.addColorStop(0, tono('#6c2c40', 0.95));
      m.addColorStop(1, tono('#2c101e', 0.9));
      ctx.fillStyle = m;
      ctx.beginPath();
      ctx.moveTo(-R * 0.62, R * 0.15);
      ctx.lineTo(puntas[0][0], puntas[0][1]);
      for (let i = 1; i < 8; i++) {
        const [x, y] = puntas[i], [px, py] = puntas[i - 1];
        ctx.quadraticCurveTo((x + px) / 2, (y + py) / 2 - R * 0.28 * flip, x, y);
      }
      ctx.lineTo(R * 0.62, R * 0.15);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,150,160,0.4)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      puntas.forEach(([x, y], i) => {
        ctx.moveTo((i / 7 * 2 - 1) * R * 0.5, R * 0.1);
        ctx.quadraticCurveTo(x * 0.9, y * 0.5, x, y);
      });
      ctx.stroke();
      for (const [x, y] of puntas) halo(ctx, x, y, 5, [140, 210, 255], 0.55);
      ctx.restore();
    },

    hacha(c, ctx) {
      const L = c.len * 1.2, t = world.time, mira = c.mira || 0;
      ctx.save();
      ctx.translate(c.x, c.y);
      orientar(ctx, c, c.vel.x, c.vel.y, 0.3);
      ctx.rotate(-mira * 0.55); // todo él apunta hacia arriba
      cola(ctx, -L * 0.5, L * 0.22, L * 0.14, Math.sin(t * 4 + c.seed * 4), tono('#9fb4be', 0.7), 0.7);
      const g = ctx.createLinearGradient(0, -L * 0.4, 0, L * 0.42);
      g.addColorStop(0, tono('#3c5466'));
      g.addColorStop(0.35, tono('#a9c0c8'));
      g.addColorStop(0.65, tono('#d9e8ec'));
      g.addColorStop(1, tono('#56707c'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L * 0.46, -L * 0.08);
      ctx.quadraticCurveTo(L * 0.3, -L * 0.34, 0, -L * 0.3);
      ctx.quadraticCurveTo(-L * 0.26, -L * 0.14, -L * 0.52, -L * 0.04);
      ctx.lineTo(-L * 0.52, L * 0.04);
      ctx.quadraticCurveTo(-L * 0.26, L * 0.04, -L * 0.16, L * 0.2);
      ctx.bezierCurveTo(0, L * 0.46, L * 0.3, L * 0.44, L * 0.36, L * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,40,52,0.25)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(L * (0.2 - i * 0.11), -L * 0.2);
        ctx.lineTo(L * (0.16 - i * 0.1), L * (0.3 - i * 0.04));
      }
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const x = -L * 0.16 + i * L * 0.09, y = L * (0.2 + Math.sin((i + 1) / 7 * Math.PI) * 0.16);
        halo(ctx, x, y, 4, [130, 220, 255], 0.8);
      }
      // ojo tubular, hacia arriba
      elipse(ctx, L * 0.25, -L * 0.15, L * 0.1, L * 0.13, '#26404c');
      elipse(ctx, L * 0.25, -L * (0.21 + mira * 0.03), L * 0.085, L * 0.06, '#d9f4c8');
      elipse(ctx, L * 0.25, -L * (0.23 + mira * 0.03), L * 0.04, L * 0.03, '#0a1018');
      ctx.restore();
    },

    constelacion(c, ctx) {
      const t = world.time, n = Math.max(c.flash, c.mapa || 0);
      ctx.save();
      ctx.translate(c.x, c.y);
      // el hueco donde estuvo el pez
      ctx.save();
      ctx.scale(giro(c, c.vel.x, 1.2), 1);
      huso(ctx, 36, 17);
      ctx.fillStyle = css([0, 3, 14], 0.22);
      ctx.fill();
      ctx.strokeStyle = css([170, 205, 255], 0.05 + n * 0.22);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
      if (n > 0.02) {
        ctx.strokeStyle = css([190, 222, 255], 0.6 * n);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(c.pts[0].x, c.pts[0].y);
        for (let i = 1; i < c.pts.length; i++) ctx.lineTo(c.pts[i].x, c.pts[i].y);
        ctx.closePath();
        ctx.stroke();
      }
      for (const p of c.pts) {
        const k = Math.max(n, 0.62 + 0.38 * Math.sin(t * 0.9 + p.ph));
        halo(ctx, p.x, p.y, p.r * 7, [140, 190, 255], 0.5 * k);
        halo(ctx, p.x, p.y, p.r * 2.6, [235, 245, 255], k);
        elipse(ctx, p.x, p.y, p.r * 0.45, p.r * 0.45, css([255, 255, 255], k));
      }
      ctx.restore();
    },

    /* ==================== NAUFRAGIO ==================== */

    mero(c, ctx) {
      const t = world.time, bum = c.retumba || 0;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(giro(c, c.dir, 1.6) * (1.2 + bum * 0.06), 1.2 + bum * 0.1);
      const bate = Math.sin(t * 1.6 + c.seed), fina = tono('#58503e', 0.92), rayo = 'rgba(220,200,150,0.35)';
      cola(ctx, -42, 20, 15, bate, fina, -0.05);
      aleta(ctx, 14, -20, -30, -14, -28, -34, fina, rayo);
      aleta(ctx, -16, 16, -32, 10, -30, 28, fina, rayo);
      aleta(ctx, 8, 20, 0, 21, -6, 32, fina, rayo);
      const g = ctx.createLinearGradient(0, -26, 0, 26);
      g.addColorStop(0, tono('#55503c'));
      g.addColorStop(0.55, tono('#96825c'));
      g.addColorStop(1, tono('#d2bc8c'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(46, 4);
      ctx.bezierCurveTo(40, -16, 14, -27, -8, -23);
      ctx.bezierCurveTo(-28, -20, -38, -7, -45, -6);
      ctx.lineTo(-45, 6);
      ctx.bezierCurveTo(-32, 10, -20, 24, 6, 25 + bum * 5);
      ctx.bezierCurveTo(26, 25 + bum * 4, 40, 18, 46, 9);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(44,36,24,0.3)';
      for (let i = 0; i < 44; i++) {
        ctx.beginPath();
        ctx.ellipse(44 - ((i * 0.618) % 1) * 92, Math.sin(i * 2.4 + c.seed) * 22, 1.2 + (i % 4), 1 + (i % 3), 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(40,30,18,0.4)'; // opérculo
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(18, -16);
      ctx.quadraticCurveTo(8, 0, 16, 18);
      ctx.stroke();
      aleta(ctx, 14, 2, 12, 10, -6, 12 + Math.sin(t * 1.4 + c.seed) * 3, 'rgba(120,104,72,0.85)', rayo);
      // labios: a punto de decir algo
      const abre = 1.5 + Math.max(0, Math.sin(t * 0.7 + c.seed)) * 2.5 + bum * 4;
      ctx.fillStyle = '#241c14';
      ctx.beginPath();
      ctx.moveTo(46, 4);
      ctx.quadraticCurveTo(40, 4, 30, 10);
      ctx.quadraticCurveTo(40, 10 + abre, 46, 6 + abre);
      ctx.fill();
      ctx.strokeStyle = tono('#b09c74');
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(46, 4); ctx.quadraticCurveTo(39, 4, 31, 9);
      ctx.moveTo(46, 7 + abre); ctx.quadraticCurveTo(39, 12 + abre, 30, 12);
      ctx.stroke();
      ojo(ctx, 29, -10, 3, '#d6b868');
      ctx.restore();
    },

    jureles(c, ctx) {
      const a = c.len * 0.7, h = a * 0.38, fondo = Math.sin(c.ang); // −1 detrás · 1 delante
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha *= 0.62 + 0.38 * (fondo * 0.5 + 0.5);
      orientar(ctx, c, c.vel.x, c.vel.y, 0.8);
      ctx.scale(1 + fondo * 0.18, 1 + fondo * 0.18);
      const bate = Math.sin(world.time * 5 + c.seed * 7), oro = tono('#d8c25a');
      cola(ctx, -a * 0.9, a * 0.5, h * 1.1, bate, oro, 0.9);
      aleta(ctx, 0, -h * 0.8, -a * 0.6, -h * 0.35, -a * 0.35, -h * 1.5, oro);
      huso(ctx, a, h);
      ctx.fillStyle = lomoVientre(ctx, h, '#3c6474', '#c9dce0', '#f2f6ee');
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-a * 0.7, -h * 0.12, a * 1.1, h * 0.16);
      ojo(ctx, a * 0.64, -h * 0.14, h * 0.22, '#e8d48c');
      ctx.restore();
    },

    dumbo(c, ctx) {
      const R = c.r * 1.15, t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(luz.seguir(c, 'ladeo', clamp(c.vel.x / 12, -1, 1) * 0.22, 1.5));
      // orejas: su forma de nadar
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * R * 0.55, -R * 0.6);
        ctx.scale(s, 1);
        ctx.rotate(Math.sin(t * 1.9 + c.seed + (s > 0 ? 0.5 : 0)) * 0.4);
        const o = ctx.createLinearGradient(0, 0, R * 0.8, -R * 0.2);
        o.addColorStop(0, tono('#c48aa0'));
        o.addColorStop(1, tono('#f2c4d2'));
        ctx.fillStyle = o;
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.1);
        ctx.bezierCurveTo(R * 0.4, -R * 0.5, R * 0.85, -R * 0.4, R * 0.8, -R * 0.1);
        ctx.bezierCurveTo(R * 0.7, R * 0.12, R * 0.2, R * 0.1, 0, R * 0.12);
        ctx.fill();
        ctx.restore();
      }
      const g = ctx.createRadialGradient(-R * 0.25, -R * 0.7, 1, 0, -R * 0.1, R * 1.4);
      g.addColorStop(0, tono('#f8d4de'));
      g.addColorStop(0.6, tono('#d496ac'));
      g.addColorStop(1, tono('#8c5470'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-R * 0.68, R * 0.2);
      ctx.bezierCurveTo(-R * 0.8, -R * 0.7, -R * 0.45, -R * 1.1, 0, -R * 1.1);
      ctx.bezierCurveTo(R * 0.45, -R * 1.1, R * 0.8, -R * 0.7, R * 0.68, R * 0.2);
      // faldón de brazos con membrana
      const abre = 1 + Math.sin(t * 1.1 + c.seed) * 0.12;
      ctx.quadraticCurveTo(R * 0.9, R * 0.5, R * 1.05 * abre, R * 0.8);
      for (let i = 6; i >= 0; i--) {
        const f = i / 6 * 2 - 1, va = Math.sin(t * 1.3 + i + c.seed) * 1.4;
        ctx.quadraticCurveTo((f + 1 / 6) * R * abre, R * 0.58, f * R * 1.02 * abre, R * (0.96 - f * f * 0.18) + va);
      }
      ctx.quadraticCurveTo(-R * 0.9, R * 0.5, -R * 0.68, R * 0.2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,235,0.3)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const f = i / 5 * 2 - 1;
        ctx.moveTo(f * R * 0.4, R * 0.2);
        ctx.quadraticCurveTo(f * R * 0.7, R * 0.5, f * R * 0.9, R * 0.8);
      }
      ctx.stroke();
      for (const s of [-1, 1]) ojo(ctx, s * R * 0.42, -R * 0.1, R * 0.11, null, '#2c1826');
      ctx.restore();
    },

    vigia(c, ctx) {
      const t = world.time, abre = 1 - Math.min(1, c.blink * 1.6);
      ctx.save();
      ctx.translate(c.x, c.y + Math.sin(t * 0.9 + c.seed) * 1.2);
      // capucha de algas
      const g = ctx.createLinearGradient(0, -16, 0, 12);
      g.addColorStop(0, '#5c7c64');
      g.addColorStop(1, '#1c2c28');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-14, 12);
      ctx.bezierCurveTo(-14, -6, -10, -16, 0, -17);
      ctx.bezierCurveTo(10, -16, 14, -6, 14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,160,120,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const x = -12 + i * 4;
        ctx.moveTo(x, 4);
        ctx.quadraticCurveTo(x + 1, 11, x + Math.sin(t * 0.7 + i) * 2, 15 + (i % 3) * 2);
      }
      ctx.stroke();
      elipse(ctx, 0, -3, 10, 9, '#101c1a');
      // EL ojo, con el párpado cansado de un siglo de guardia
      halo(ctx, 0, -3, 22, [190, 240, 200], 0.3 * abre);
      ctx.beginPath();
      ctx.moveTo(-9, -3);
      ctx.quadraticCurveTo(0, -3 - 10 * abre, 9, -3);
      ctx.quadraticCurveTo(0, -3 + 10 * abre + 0.6, -9, -3);
      ctx.fillStyle = '#d9e6d2';
      ctx.fill();
      if (abre > 0.15) {
        ctx.save();
        ctx.clip();
        const m = world.mouse;
        const d = norm((m.active ? m.x : c.x + 40) - c.x, (m.active ? m.y : c.y) - c.y);
        const px = d.x * 3.4, py = -3 + d.y * 2;
        elipse(ctx, px, py, 4.4, 4.4, '#6c9c74');
        elipse(ctx, px, py, 3, 3, '#3c6450');
        elipse(ctx, px, py, 1.9, 1.9, '#08120c');
        elipse(ctx, px - 1.2, py - 1.4, 0.9, 0.9, 'rgba(255,255,255,0.9)');
        ctx.fillStyle = 'rgba(16,28,26,0.35)';
        ctx.fillRect(-9, -9, 18, 3.4);
        ctx.restore();
      }
      ctx.restore();
    },

    moneda(c, ctx) {
      const t = world.time, R = 6;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (c.shine > 0.02) halo(ctx, 0, 0, 26, [255, 226, 140], c.shine);
      orientar(ctx, c, c.vel.x, c.vel.y, 0.6);
      const bate = Math.sin(t * 5 + c.seed * 5);
      cola(ctx, -R * 0.75, 5.5, 4, bate, 'rgba(235,200,110,0.75)', 0.5);
      aleta(ctx, 2, -R * 0.85, -3, -R * 0.7, -4, -R * 1.6, 'rgba(235,200,110,0.6)');
      // la moneda se ve un poco de canto al nadar
      const canto = 0.86 + 0.14 * Math.sin(t * 1.1 + c.seed);
      const g = ctx.createLinearGradient(-R, -R, R, R);
      g.addColorStop(0, '#fff0b0');
      g.addColorStop(0.45, '#d9ac48');
      g.addColorStop(1, '#8c641c');
      elipse(ctx, 0, 0, R * canto, R, g);
      ctx.strokeStyle = 'rgba(96,68,16,0.6)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * canto * 0.76, R * 0.76, 0, 0, TAU);
      // escamas acuñadas
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(-1.5 + i * 0.3, -2.4 + i * 2.4);
        ctx.arc(-2.8 + i * 0.3, -2.4 + i * 2.4, 1.3, 0, 1.2);
      }
      ctx.stroke();
      ojo(ctx, R * 0.4 * canto, -1.4, 1, null, '#3c2c0c');
      ctx.restore();
    },

    campana(c, ctx) {
      const t = world.time, s = Math.sin(c.pulse), R = 17, suena = c.ring;
      ctx.save();
      ctx.translate(c.x, c.y);
      if (suena > 0) ctx.rotate(Math.sin(t * 7) * 0.12 * suena);
      if (suena > 0.02) {
        halo(ctx, 0, 4, R * 3, [255, 214, 140], 0.4 * suena);
        ctx.strokeStyle = css([236, 206, 140], 0.45 * suena);
        ctx.lineWidth = 1.4;
        for (const d of [0, 30]) {
          const r = (1 - suena) * 160 + 14 - d;
          if (r > 14) { ctx.beginPath(); ctx.arc(0, 4, r, 0, TAU); ctx.stroke(); }
        }
      }
      // tentáculos como cabos deshilachados
      ctx.fillStyle = 'rgba(170,190,140,0.4)';
      for (let i = -2; i <= 2; i++) {
        const va = Math.sin(c.pulse - 1 + i) * 7;
        ctx.beginPath();
        brazo(ctx, i * R * 0.3, R * 0.6, i * R * 0.35 + va, R * 1.4, i * R * 0.45 - va * 0.6, R * (2.5 - Math.abs(i) * 0.2), 1.6);
        ctx.fill();
      }
      const g = ctx.createLinearGradient(-R, 0, R, 0);
      g.addColorStop(0, tono('#5c4424'));
      g.addColorStop(0.3, tono('#e4bc72'));
      g.addColorStop(0.55, tono('#9c7438'));
      g.addColorStop(1, tono('#48341c'));
      ctx.fillStyle = g;
      ctx.beginPath();
      const alto = R * (1 + 0.08 * s);
      ctx.moveTo(0, -alto);
      ctx.bezierCurveTo(R * 0.7, -alto, R * 0.62, -R * 0.1, R * 0.7, R * 0.3);
      ctx.quadraticCurveTo(R * 0.76, R * 0.6, R * (1.02 - 0.06 * s), R * 0.76);
      ctx.quadraticCurveTo(0, R * 0.98, -R * (1.02 - 0.06 * s), R * 0.76);
      ctx.quadraticCurveTo(-R * 0.76, R * 0.6, -R * 0.7, R * 0.3);
      ctx.bezierCurveTo(-R * 0.62, -R * 0.1, -R * 0.7, -alto, 0, -alto);
      ctx.fill();
      ctx.save();
      ctx.clip();
      luz.nube(ctx, -R * 0.4, 0, R * 0.6, R * 0.9, [96, 170, 130], 0.6);
      luz.nube(ctx, R * 0.6, R * 0.6, R * 0.4, R * 0.4, [96, 170, 130], 0.5);
      ctx.strokeStyle = 'rgba(255,230,160,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const y of [-0.5, 0.38, 0.52]) {
        ctx.moveTo(-R, R * y);
        ctx.quadraticCurveTo(0, R * (y + 0.18), R, R * y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.beginPath(); // asa
      ctx.ellipse(0, -alto - 1.5, 3, 3.6, 0, Math.PI, 0);
      ctx.strokeStyle = tono('#a8844c');
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // el badajo, que también es su ojo
      const bad = Math.sin(t * (suena > 0 ? 6 : 1.6) + c.seed) * (3 + suena * 5);
      halo(ctx, bad, R * 0.96, 10, [255, 224, 160], 0.5);
      ojo(ctx, bad, R * 0.96, 2.6, '#ecd9a4', '#241c08');
      ctx.restore();
    },

    /* ==================== JARDÍN IMPOSIBLE ==================== */

    semilla(c, ctx) {
      const t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      orientar(ctx, c, c.vel.x, c.fase === 'nada' ? c.vel.y : Math.abs(c.vel.y) + c.entierro * 60, 0.7);
      ctx.scale(1.4, 1.4);
      const va = Math.sin(t * 1.6 + c.seed) * 2;
      cola(ctx, -6, 4, 3, Math.sin(t * 4 + c.seed), 'rgba(170,225,175,0.75)', 0.3);
      ctx.fillStyle = 'rgba(160,220,166,0.92)';
      ctx.beginPath();
      brazo(ctx, 0, -2.5, -4, -8, -7 + va, -10, 1.8);
      brazo(ctx, 0, -2.5, 4, -8, 3 + va, -12, 1.8);
      ctx.fill();
      huso(ctx, 7.5, 4.2);
      ctx.fillStyle = lomoVientre(ctx, 4.2, '#7c542c', '#c99c5c', '#f2d89c');
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,50,20,0.4)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (const y of [-1.6, 1.4]) { ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-1, y * 1.6, 3, y * 0.4); }
      ctx.stroke();
      ojo(ctx, 4.5, -0.8, 0.9, null, '#2c1e08');
      ctx.restore();
    },

    colibri(c, ctx) {
      const t = world.time;
      ctx.save();
      ctx.translate(c.x, c.y);
      const dx = c.tx - c.x; // clavado en su sitio conserva el sentido
      orientar(ctx, c, Math.abs(dx) > 8 ? dx : 0, c.sip * 8, 0.5);
      ctx.scale(1.4, 1.4);
      // ochenta batidos por segundo se ven como un velo quieto
      const tiembla = Math.sin(t * 5 + c.seed) * 0.12;
      for (let i = 0; i < 4; i++) {
        elipse(ctx, -3, -5, 8, 2.2, 'rgba(215,245,250,0.2)', 0.2 + i * 0.4 + tiembla);
      }
      ctx.fillStyle = 'rgba(90,208,168,0.8)';
      ctx.beginPath();
      const v = Math.sin(t * 2.4 + c.seed) * 2;
      brazo(ctx, -5, 0, -10, -1, -16, -5 + v, 1.8);
      brazo(ctx, -5, 0, -10, 2, -14, 5 + v, 1.8);
      ctx.fill();
      huso(ctx, 8, 4.6);
      ctx.fillStyle = lomoVientre(ctx, 4.6, '#2c7c94', '#58d4a8', '#f4a0c4');
      ctx.fill();
      ctx.strokeStyle = '#f0d898';
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.quadraticCurveTo(11, 0, 16, 1 + c.sip * 2);
      ctx.stroke();
      halo(ctx, 2, 1.5, 6, [255, 130, 190], 0.4);
      ojo(ctx, 4.4, -1.1, 1, null, '#10241c');
      ctx.restore();
    },

    diente(c, ctx) {
      const t = world.time, s = c.scatter, k = s * s * (3 - 2 * s); // salen y vuelven con calma
      ctx.save();
      ctx.translate(c.x, c.y);
      halo(ctx, 0, 0, 42, [255, 235, 190], 0.28 * (1 - k * 0.7));
      ctx.strokeStyle = css([230, 200, 190], 0.5 * (1 - k)); // el hilo del que cuelga
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.quadraticCurveTo(Math.sin(t * 0.9 + c.seed) * 8, 24, Math.sin(t * 0.7 + c.seed) * 6, 42);
      ctx.stroke();
      elipse(ctx, 0, 0, 4.6 - k * 1.5, 4.6 - k * 1.5, css([244, 218, 160], 0.95 - k * 0.5));
      ctx.lineWidth = 0.65;
      ctx.strokeStyle = css([255, 248, 232], 0.55 - k * 0.15);
      ctx.beginPath();
      const puntas = [];
      c.fil.forEach((f, i) => {
        const a = f.a + Math.sin(t * 0.7 + f.a * 3 + c.seed) * 0.05 + k * f.spin;
        const largo = f.len * (i % 3 === 0 ? 0.68 : 1.15); // dos coronas dan volumen
        const bx = Math.cos(a) * largo + f.dx * k, by = Math.sin(a) * largo + f.dy * k;
        ctx.moveTo(bx - Math.cos(a) * largo * 0.8, by - Math.sin(a) * largo * 0.8);
        ctx.lineTo(bx, by);
        for (let j = -3; j <= 3; j++) {
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a + j * 0.36) * 5.5, by + Math.sin(a + j * 0.36) * 5.5);
        }
        puntas.push([bx, by]);
      });
      ctx.stroke();
      ctx.fillStyle = css([255, 244, 214], 0.85);
      ctx.beginPath();
      for (const [x, y] of puntas) { ctx.moveTo(x + 1, y); ctx.arc(x, y, 1, 0, TAU); }
      ctx.fill();
      ctx.restore();
    },
  };

  // a media vuelta, cada pintor pasa por la vuelta con volumen (luz.vuelta)
  for (const k of Object.keys(pintores)) {
    const pintar = pintores[k];
    pintores[k] = (c, ctx) => luz.vuelta(c, ctx, pintar);
  }
  return pintores;
})();
