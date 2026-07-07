# Changelog — Acuario Abisal

Formato: [Keep a Changelog](https://keepachangelog.com/es/). El proyecto aún
no usa git; las versiones marcan hitos de sesión.

## [0.3.0] — 2026-07-06 · "Fase 2: sonido y ambiente vivo"

### Added
- Sonido generativo con Web Audio (`audio.js`): pad grave, notas pentatónicas
  con eco, hidrófono de ruido filtrado; eventos de descubrimiento, foto,
  descarga, mordisco, géiser y leviatán. Botón ♪ SONIDO persistente.
- Cuatro tipos de cebo (teclas 1–4): plancton (sardinas y medusas), pellets,
  carnada (despierta la caza real de los tiburones; sangra partículas), luz
  embotellada (solo la persiguen las criaturas ficticias, espectro incluido).
- Corrientes al arrastrar el cursor: desvían nieve marina, burbujas, comida y
  pececillos, agitan el kelp y dejan un remolino de chispas.
- Ambiente interactivo: kelp que se sacude al tocarlo, géiser del respiradero
  con empuje ascendente, la morena se asoma al tocar su roca.
- Versionado de assets (`?v=2`) para evitar CSS/JS cacheados.

### Changed
- Movimiento orgánico: todas las especies entran y salen de escena a su manera
  (bordes, caminando por la arena, emergiendo, anémona, superficie, fundido).
  Quitar especies del panel las despide en lugar de esfumarlas.
- La medusa ya no se teletransporta al llegar a la superficie: se desvanece y
  reaparece fundiéndose en el fondo.

## [0.2.0] — 2026-07-06 · "Fase 1: descubrimiento y álbum"

### Added
- Sistema de descubrimiento: el acuario empieza solo con sardinas; un director
  trae especies visitantes con condiciones (el espectro exige ratón quieto, a
  la morena la atrae la comida). Observar de cerca registra; fotografiar
  completa la entrada.
- Modo cámara (tecla C): visor estilo Pokémon Snap, fogonazo, recorte del
  canvas a JPEG guardado en la partida.
- Álbum de expedición: siluetas de misterio, retratos renderizados por el
  propio motor, tu foto, textos deadpan estilo Katamari y sección "para
  curiosos" con datos reales verificables.
- 7 especies nuevas del arrecife (18 en total): tiburón de puntas blancas (que
  de verdad descansa en el fondo), anguila cinta azul, pulpo que se camufla,
  raya látigo, pez payaso con anémona, cangrejo ermitaño y pez espejo
  (ficticio: adopta el color del vecino más cercano).
- Persistencia completa en localStorage (`save.js`): registros, fotos,
  poblaciones, ajustes.
- Panel bitácora condicionado: solo lo registrado muestra nombre y controles.

### Changed
- Los 11 textos originales reescritos en tono Katamari, con dato real añadido.

## [0.1.0] — 2026-07-06 · "El acuario"

### Added
- Acuario canvas 2D con 11 especies procedurales: tiburones y anguilas con
  espina de segmentos (`SpineFish`), cardumen de sardinas (boids), medusas,
  estrellas, faroluz, buzo explorador.
- Atmósfera: rayos de luz, nieve marina, kelp, rocas, burbujas, viñeta y grano.
- Fichas de criatura tipo globo de diálogo que siguen al ejemplar.
- Alimentación con clic, descarga de la anguila eléctrica, modo abisal,
  leviatán ocasional al fondo.
- Panel bitácora con población por especie (+/−) y profundímetro decorativo.
