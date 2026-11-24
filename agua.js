/* ============================================================
   ACUARIO ABISAL — agua
   Superficie, rayos y bruma en WebGL2, en un lienzo fuera de
   pantalla que se compone sobre #sea (así las fotos lo incluyen).
   Sin WebGL2 hay una versión 2D con la misma paleta.
   Requiere luz.js. Cargar antes de aquarium.js.
   ============================================================ */
'use strict';

const agua = (() => {
  const VERTICE = `#version 300 es
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const FRAGMENTO = `#version 300 es
  precision highp float;
  uniform vec2 uTam;
  uniform float uT;
  uniform float uPulso;
  uniform vec3 uTop, uMid, uBajo, uLuz, uVelo;
  uniform float uSolX;
  uniform float uRayos, uSuperficie, uResplandor, uNebulosa;
  out vec4 color;

  float azar(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float ruido(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(azar(i), azar(i + vec2(1, 0)), f.x),
               mix(azar(i + vec2(0, 1)), azar(i + vec2(1, 1)), f.x), f.y);
  }
  float capas(vec2 p) {
    return ruido(p) * 0.55 + ruido(p * 2.03 + 7.1) * 0.3 + ruido(p * 4.1 + 3.3) * 0.15;
  }

  void main() {
    vec2 uv = vec2(gl_FragCoord.x / uTam.x, 1.0 - gl_FragCoord.y / uTam.y);
    float aspecto = uTam.x / uTam.y;
    vec2 p = vec2((uv.x - uSolX) * aspecto, uv.y);

    // degradado de tres tonos, sin costura a media altura
    vec3 c = mix(mix(uTop, uMid, smoothstep(0.0, 0.62, uv.y)), uBajo, smoothstep(0.38, 1.0, uv.y));

    // masas de agua que derivan muy despacio
    vec2 q = vec2(uv.x * aspecto, uv.y) * 1.7;
    float masa = capas(q + vec2(uT * 0.012, -uT * 0.006));
    c *= 0.9 + 0.2 * masa;
    if (uNebulosa > 0.001) {
      float n = capas(q * 1.3 + vec2(masa * 1.6, uT * 0.01));
      c += uVelo * smoothstep(0.42, 0.9, n) * uNebulosa;
    }

    // resplandor de la luz que entra
    float lejos = length(p * vec2(0.62, 1.0) - vec2(0.0, -0.12));
    c += uLuz * exp(-lejos * lejos * 3.2) * uResplandor * (0.88 + 0.12 * uPulso);

    // rayos: abanico desde un sol que está por encima del agua
    if (uRayos > 0.001) {
      float a = p.x / (uv.y + 0.75);
      float anchos = smoothstep(0.3, 0.95, ruido(vec2(a * 5.0 + sin(uT * 0.06) * 0.35, uT * 0.07)));
      float finos = smoothstep(0.4, 1.0, ruido(vec2(a * 17.0 - uT * 0.05, uT * 0.11 + 4.0)));
      float haz = anchos * 0.65 + anchos * finos * 0.7;
      float caida = pow(max(0.0, 1.0 - uv.y * 0.93), 1.7) * exp(-a * a * 0.75);
      c += uLuz * haz * caida * uRayos * (0.8 + 0.2 * uPulso);
    }

    // la superficie vista desde abajo: ondas en perspectiva
    if (uSuperficie > 0.001 && uv.y < 0.24) {
      float z = 1.0 / (uv.y + 0.045);
      vec2 s = vec2(p.x * z * 0.75, z * 0.8);
      vec2 w = vec2(ruido(s * 0.7 + uT * 0.16), ruido(s * 0.7 - uT * 0.13 + 9.0));
      float n = ruido(s + w * 1.8 + vec2(0.0, uT * 0.22));
      float brillo = pow(1.0 - abs(n * 2.0 - 1.0), 7.0);
      float banda = pow(1.0 - uv.y / 0.24, 2.0);
      c += uLuz * banda * (brillo * 0.5 + 0.13) * uSuperficie * exp(-p.x * p.x * 0.45);
    }

    // tramado mínimo: los degradados oscuros no deben hacer escalones
    c += (azar(gl_FragCoord.xy) - 0.5) / 255.0;
    color = vec4(c, 1.0);
  }`;

  const lienzo = document.createElement('canvas');
  let gl = null, programa = null, u = {};

  function compilar(tipo, fuente) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fuente);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function iniciar() {
    programa = null;
    try {
      gl = lienzo.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
      if (!gl) return;
      const p = gl.createProgram();
      gl.attachShader(p, compilar(gl.VERTEX_SHADER, VERTICE));
      gl.attachShader(p, compilar(gl.FRAGMENT_SHADER, FRAGMENTO));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      u = {};
      for (const n of ['uTam', 'uT', 'uPulso', 'uTop', 'uMid', 'uBajo', 'uLuz', 'uVelo',
        'uSolX', 'uRayos', 'uSuperficie', 'uResplandor', 'uNebulosa']) {
        u[n] = gl.getUniformLocation(p, n);
      }
      gl.useProgram(p);
      programa = p;
    } catch (e) {
      programa = null; // el plan B pinta el mismo mar, con menos poesía
    }
  }
  lienzo.addEventListener('webglcontextlost', e => { e.preventDefault(); programa = null; });
  lienzo.addEventListener('webglcontextrestored', iniciar);
  iniciar();

  const unidad = c => [c[0] / 255, c[1] / 255, c[2] / 255];

  function pintarGL(ctx, e, W, H) {
    const k = luz.calidad === 2 ? 0.5 : 0.3;
    const w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.uTam, w, h);
    gl.uniform1f(u.uT, (luz.reducido ? world.time * 0.15 : world.time) % 3600);
    gl.uniform1f(u.uPulso, luz.respira());
    gl.uniform3fv(u.uTop, unidad(e.top));
    gl.uniform3fv(u.uMid, unidad(e.mid));
    gl.uniform3fv(u.uBajo, unidad(e.bottom));
    gl.uniform3fv(u.uLuz, unidad(e.luz));
    gl.uniform3fv(u.uVelo, unidad(e.velo));
    gl.uniform1f(u.uSolX, e.solX);
    gl.uniform1f(u.uRayos, e.rayos);
    gl.uniform1f(u.uSuperficie, e.superficie);
    gl.uniform1f(u.uResplandor, e.resplandor);
    gl.uniform1f(u.uNebulosa, e.nebulosa);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.drawImage(lienzo, 0, 0, W, H);
  }

  /* ---------- haz de luz 2D, para el plan B ---------- */
  const haces = new Map();
  function spriteHaz(color) {
    const clave = luz.rgb(color).map(Math.round).join(',');
    let cv = haces.get(clave);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = 64; cv.height = 256;
    const x = cv.getContext('2d');
    const lados = x.createLinearGradient(0, 0, 64, 0);
    for (let i = 0; i <= 8; i++) {
      const s = Math.sin((i / 8) * Math.PI);
      lados.addColorStop(i / 8, `rgba(${clave},${s * s})`);
    }
    x.fillStyle = lados;
    x.fillRect(0, 0, 64, 256);
    x.globalCompositeOperation = 'destination-in';
    const abajo = x.createLinearGradient(0, 0, 0, 256);
    abajo.addColorStop(0, 'rgba(0,0,0,1)');
    abajo.addColorStop(0.45, 'rgba(0,0,0,0.45)');
    abajo.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = abajo;
    x.fillRect(0, 0, 64, 256);
    haces.set(clave, cv);
    if (haces.size > 24) haces.delete(haces.keys().next().value);
    return cv;
  }

  function pintarHaces(ctx, e, W, H, fuerza, n) {
    if (fuerza < 0.004) return;
    const cv = spriteHaz(e.colorHaz);
    const t = luz.reducido ? 0 : world.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const x = W * (e.solX + (f - 0.5) * 0.85 + Math.sin(t * 0.07 + i * 2.1) * 0.025);
      const ancho = Math.max(70, W * (0.07 + 0.05 * ((i * 0.618) % 1)));
      ctx.save();
      ctx.translate(x, -20);
      ctx.rotate(-(f - 0.5) * 0.75);
      ctx.globalAlpha = fuerza * (0.55 + 0.45 * Math.sin(t * 0.21 + i * 1.7) ** 2);
      ctx.drawImage(cv, -ancho / 2, 0, ancho, H * 0.95);
      ctx.restore();
    }
    ctx.restore();
  }

  function pintar2D(ctx, e, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, luz.css(e.top));
    g.addColorStop(0.5, luz.css(e.mid));
    g.addColorStop(1, luz.css(e.bottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    luz.halo(ctx, W * e.solX, -H * 0.12, H * 1.1, e.colorHaz, e.resplandor * 0.75);
    pintarHaces(ctx, e, W, H, e.rayos * 0.3, 6);
    if (e.nebulosa > 0.01) luz.halo(ctx, W * 0.7, H * 0.5, H * 0.6, e.velo, e.nebulosa * 0.5);
  }

  return {
    pintar(ctx, e, W, H) {
      if (programa && luz.calidad > 0 && !gl.isContextLost()) pintarGL(ctx, e, W, H);
      else pintar2D(ctx, e, W, H);
    },
    get conWebGL() { return !!programa && luz.calidad > 0; },
  };
})();
