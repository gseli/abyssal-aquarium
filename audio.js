/* ============================================================
   ACUARIO ABISAL — sonido generativo (Web Audio, sin archivos)
   Pad grave + notas pentatónicas esporádicas + hidrófono,
   y eventos puntuales (descubrimiento, foto, descarga…).
   Requiere save.js y creatures.js (rand/pick). Cargar antes
   de aquarium.js.
   ============================================================ */
'use strict';

const audio = (() => {
  let ctx = null;
  let master = null;
  let delaySend = null;
  let padFilter = null;
  let muted = !!save.muted;
  let noteTimer = 4;

  // Re pentatónica menor, registro medio-grave: contemplativa sin ser triste
  const PENTA = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66];

  function init() {
    if (ctx) { ctx.resume && ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);

    /* ---- pad: tres senos graves desafinados, filtrados ---- */
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 320;
    padFilter.Q.value = 0.7;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.055;
    padFilter.connect(padGain);
    padGain.connect(master);
    for (const [freq, det] of [[73.42, 0], [110.0, 4], [146.83, -5]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.value = 0.33;
      o.connect(g);
      g.connect(padFilter);
      o.start();
    }
    // respiración lenta del filtro
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain);
    lfoGain.connect(padFilter.frequency);
    lfo.start();

    /* ---- hidrófono: ruido grave en bucle ---- */
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.value = 210;
    const nGain = ctx.createGain();
    nGain.gain.value = 0.028;
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(master);
    noise.start();

    /* ---- eco para las notas ---- */
    delaySend = ctx.createDelay(1.2);
    delaySend.delayTime.value = 0.46;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    delaySend.connect(feedback);
    feedback.connect(delaySend);
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    delaySend.connect(wet);
    wet.connect(master);
  }

  function note(freq, vol = 0.07, dur = 3.5, pan = 0) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const oh = ctx.createOscillator(); // armónico suave
    oh.type = 'sine';
    oh.frequency.value = freq * 2;
    const gh = ctx.createGain();
    gh.gain.value = 0.22;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    oh.connect(gh);
    gh.connect(g);
    let out = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    out.connect(master);
    g.connect(delaySend);
    o.start(t); oh.start(t);
    o.stop(t + dur + 0.2); oh.stop(t + dur + 0.2);
  }

  function thump(freq, vol, dur) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.5), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  function hiss(vol, dur, freq = 1800, type = 'highpass') {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  /* llamado cada frame: notas espontáneas + color según el modo abisal */
  function update(dt, abyssMix) {
    if (!ctx) return;
    noteTimer -= dt;
    if (noteTimer <= 0) {
      noteTimer = rand(4.5, 10) + abyssMix * 4;
      const f = pick(PENTA) * (Math.random() < 0.3 ? 2 : 1);
      note(f, 0.055 + rand(0.025), rand(3, 5.5), rand(-0.6, 0.6));
    }
    // el abismo oscurece el pad
    padFilter.frequency.value = lerp(320, 150, abyssMix) + Math.sin(world.time * 0.045) * 0;
  }

  function event(name) {
    if (!ctx || muted) return;
    switch (name) {
      case 'descubrimiento': // campanita ascendente
        note(440, 0.1, 2.2, -0.15);
        setTimeout(() => note(659.25, 0.09, 2.8, 0.15), 170);
        break;
      case 'foto': // obturador
        hiss(0.12, 0.05, 2400);
        thump(220, 0.06, 0.07);
        break;
      case 'zap':
        thump(55, 0.22, 0.5);
        hiss(0.1, 0.3, 1200);
        break;
      case 'burbuja':
        note(rand(500, 850), 0.035, 0.5, rand(-0.4, 0.4));
        break;
      case 'bite':
        thump(90, 0.18, 0.25);
        break;
      case 'retumbo': // el mero: grave y blando, se siente más que se oye
        thump(82, 0.16, 1.1);
        thump(54, 0.12, 1.6);
        break;
      case 'geiser':
        hiss(0.14, 1.1, 500, 'lowpass');
        thump(45, 0.12, 0.9);
        break;
      case 'campana': // la campana del naufragio: parcial no armónico = bronce
        note(392, 0.12, 5, 0);
        note(392 * 2.42, 0.045, 3.6, 0.12);
        note(392 * 1.19, 0.03, 4.2, -0.12);
        break;
      case 'vilano': // la medusa diente de león se deshace: un soplo y poco más
        hiss(0.06, 0.5, 2600);
        note(880, 0.03, 2.2, rand(-0.3, 0.3));
        break;
      case 'leviatan': // algo enorme, muy lejos
        thump(36, 0.14, 5);
        setTimeout(() => thump(30, 0.1, 6), 1200);
        break;
    }
  }

  function setMuted(m) {
    muted = m;
    if (ctx && master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(m ? 0 : 0.55, ctx.currentTime + 0.4);
    }
  }

  return {
    init, update, event, setMuted,
    get muted() { return muted; },
    get started() { return !!ctx; },
  };
})();
