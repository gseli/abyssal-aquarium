# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Acuario Abisal" — a contemplative discovery game: a procedurally-rendered 2D canvas aquarium where real and fictional species arrive, get observed, photographed (Pokémon Snap-style) and collected into an expedition album. Vanilla JavaScript, no build system, no dependencies, no tests. Code, comments and the source texts (UI strings, species and moment data) are written in Spanish; keep new code and comments in Spanish to match. The game ships bilingual and **English is the main, default version** (see *Languages* below). Tone references: thatgamecompany visuals (restful, luminous, never cartoon; no Splatoon), Katamari deadpan humor in album texts, and Pokémon Snap only as a *stance* (you are an observer; creatures relate to each other; some of your actions provoke unique moments), never its characters, art or names. Roadmap and status live in `ROADMAP.md`.

## Running

No build step. Serve the directory (the `file:` protocol is blocked by some tooling):

```bash
python3 -m http.server 8000
```

The only network dependency is Google Fonts; everything else works offline. Local assets are versioned with a query string (`style.css?v=14`) — bump the number in `index.html` after edits if the browser serves stale files.

## Architecture

Scripts loaded as plain globals — **load order matters** (wired in `index.html`): `save.js` → `ingles.js` → `idioma.js` → `luz.js` → `dibujo.js` → `pintores.js` → `creatures.js` → `biomes.js` → `audio.js` → `momentos.js` → `album.js` → `agua.js` → `entorno.js` → `aquarium.js`. There is no module system; everything communicates through top-level globals and the shared `world` object.

- **save.js** — persistent state in localStorage (`save`): `seen` (registered species), `photos` (dataURLs), `counts`, `biome`, `abyss`, `muted`, `bait`, `mode`. Helpers `isSeen`/`hasPhoto`/`persistSave` (debounced).
- **ingles.js** — `INGLES`: the English texts (`ui` keyed by the exact Spanish string, plus `especies`, `biomas`, `momentos` overlays).
- **idioma.js** — `idioma` (current language, own localStorage key `acuario-abisal-idioma`, not part of the save) and the global `tr(texto, vars)`.
- **luz.js** — rendering helpers with no game state: color mixing, water tint (`tono`), cached halo sprites (`halo`/`nube`; use these instead of per-frame radial gradients), eased turns (`giro`/`orientar`/`seguir`), the volumetric half-turn `vuelta` (every `PINTAR` painter is wrapped by it: mid-turn, the creature is painted in profile offscreen and recomposed in vertical strips so the head turns first and the tail follows; halos are deferred and travel unwarped), seeded scenery RNG (`azar`), `reducido` (prefers-reduced-motion) and adaptive `calidad`.
- **dibujo.js** — shared drawing pieces (`trazo`) and every spine species' draw function (referenced from `SPECIES[key].draw`).
- **pintores.js** — `PINTAR[key](c, ctx)` for every non-spine species. Painters only read the creature.
- **agua.js** — WebGL2 water (surface, rays, haze) on an offscreen canvas composited into `#sea` (photos read that canvas), with a 2D fallback.
- **entorno.js** — all scenery: baked parallax layers per biome, sand, caustics, flora, wreck, chimneys, garden, leviathan, vignette.
- **momentos.js** — the 10 observer moments (`MOMENTOS`, two per biome: spontaneous or provoked), their director and their own localStorage key. A moment acts *after* the `update()` calls and only leaves pose properties (`tenue`, `enterrada`, `baila`, `mira`, `retumba`, `mapa`, `borrado`) for painters. Guests it spawns carry `c.invitado` and must not be persisted as population (use `poblacion(key)`, not `countOf`, when saving).
- **creatures.js** — utilities (`rand`, `clamp`, `lerp`, `pick`, `TAU`, `norm`, `hexToRgb`/`mixRgb`), the shared `world` object, the simulation of every creature, and the `SPECIES` registry. No drawing code lives here.
- **biomes.js** — `BIOMES`/`BIOME_ORDER` (palette, `clima` of light, depth, flora flags per ecosystem) and unlock rules: a biome opens when ~70% of the previous one is registered (`biomeUnlocked`, `biomeThreshold`). Every registration path (observe, click, photo) must call `comprobarDesbloqueo()`.
- **audio.js** — fully generative Web Audio (`audio` singleton): low pad + sporadic pentatonic notes + filtered-noise hydrophone, and one-shot events (`audio.event('descubrimiento'|'foto'|'zap'|'burbuja'|'bite'|'geiser'|'leviatan')`). Starts on first user gesture; abyss mode darkens the pad filter.
- **album.js** — expedition album UI and `renderPortrait(key, w, h, silhouette)`, which poses a throwaway specimen (`makeSpecimen`) and draws it to an offscreen canvas (cached). Unseen species show as silhouettes.
- **aquarium.js** — world setup, marine snow, particles (`bubbles`/`food` by bait type/`sparks`/`effects`), the view transform (zoom + follow camera), all DOM UI (start screen & modes, bitácora panel, creature card, camera mode, bait dock, biome travel, toasts), pointer interaction, and the `requestAnimationFrame` main loop.

### Shared `world` global

Defined in `creatures.js`, mutated everywhere. Holds canvas size (`W`/`H`), `time`, `abyssMix`, `mouse` (in **world** coordinates), `feedTarget`, `floorY(x)`, `anemone`, and entity arrays: `creatures`, `food`, `sparks`, `effects`, `bubbles`.

### View transform (zoom / follow)

`view` in aquarium.js. All world drawing happens under `ctx.setTransform` built from `viewTransform()`; pointer events are converted with `toWorld(px, py)` and UI anchors back with `toScreen(wx, wy)`. Anything positioned on screen (card, viewfinder) uses screen coords; anything simulated uses world coords.

### Species registry

Each species is an entry in `SPECIES` carrying display metadata (Spanish `nombre`, `sci`, Katamari-tone `fact`, verifiable `curioso`, stats, `grupo`: reales/ficticios/expedicion, `bioma`) and simulation parameters. The `kind` field selects the implementation:

- `kind: 'spine'` → `SpineFish`, a segment-chain body shared by all sharks and eels. Per-species tuning via `len`, `girth`, `segs`, `wiggle`, `speed`, `maxTurn` (turn-rate cap — prevents body knots), `profile`, `behavior`, `draw`, plus flags (`curious`, `luz`, `floorK`).
- Other kinds → dedicated classes referenced via `ctor`.

Every creature implements `update(dt)`, `draw(ctx)`, `hit(x, y)`, optionally `head()`. Organic stage entrances/exits are driven by flags the classes honor: `entering`, `leaving` + `exitX` (set by `dismiss()`), `alpha`/`fade`/`emerge`, `dead` (culled by the main loop). Spawn through `spawnArrival(key, n)` (never bare `spawnCreature` for visible arrivals — creatures must not pop in).

To add a species: `SPECIES` entry (with `bioma`), a painter (`PINTAR` or a draw function in dibujo.js), key in `LAYER_ORDER`, spine params or a class honoring the flags above, a `portraitBox` entry in album.js (plus `makeSpecimen` pose tweaks if it depends on `floorY`), a case in `spawnArrival` if it doesn't swim in from an edge, and its English texts in `INGLES.especies` (`nombre`, `fact`, `curioso`, plus `tam`/`prof`/`dieta` when they contain words).

### Game modes and discovery

`state.mode`: `null` (start screen — gameplay gated), `'descubrimiento'` (director spawns unseen visitors with conditions — espectro needs an idle mouse, morena needs food; hovering ~2s registers, photographing completes the album entry), `'acuario'` (free tank: seen species only, director/observation off).

### Abyss mode

A global 0→1 transition (`world.abyssMix`) eased each frame. Environment colors interpolate in `entorno.escena()` (biome palette → `DARK`); creatures read `abyssMix` for glow. New visuals should interpolate on `abyssMix`, not branch on the boolean.

## Rendering rules

- Keep 60 fps with max population on an integrated GPU in power saving. `ctx.clip()` per creature is very expensive: build the shape instead.
- Nothing flickers: glow oscillations stay at or below ~1.5 rad/s, entrances and exits fade, turns go through `luz.giro`/`orientar` (never a hand-rolled `scale(-1, 1)`, or the painter misses the volumetric turn). Glows inside a painter go through `luz.halo` so they don't get folded with the body. Spine bodies twist head→tail through the per-vertebra roll in `trazo.pose` (`L`/`Lc`).
- No text below 11 px. HUD must fit at 320 px wide.

## Languages

English is the default (first visit, no stored choice); Spanish is picked from the start screen (`.idiomas`, live switch via `cambiarIdioma`, only offered there because nothing else is open). How it works:

- Every user-facing string in JS goes through `tr('texto en español', {vars})` with `{name}` placeholders; the English goes in `INGLES.ui` under the same Spanish key. Strings in a lookup table (`GROUP_LABELS`, `BADGE_TEXT`) are wrapped in `tr()` where painted.
- `index.html` is written **in English** (no flash of Spanish for the main version). `idioma.documento()` walks text nodes, `aria-label`/`title`/`alt` and `<title>`, mapping through the same dictionary in either direction, so any new static text needs its pair in `INGLES.ui`.
- `SPECIES`, `BIOMES` and `momentos.lista` keep their Spanish originals in `_es` and get the English overlaid in place by `idioma.aplicar()` (first line of aquarium.js). Code that reads `sp.nombre` etc. needs no changes.
- Numbers: `idioma.decimal(n)` (comma in Spanish, point in English). Units stay metric.
- English tone is the same Katamari deadpan, rewritten rather than translated literally; US spelling.

## Verifying changes

Serve + drive with `playwright-cli` (screenshots, `console`, and `run-code` for atomic interactions — creatures move, so compute positions and click in the same evaluate). Clear state with `localStorage.clear()`. `docs/comparativa/herramientas/idioma.js` checks that every `tr()` literal has its English, that nothing visible stays in Spanish in English mode (and vice versa), the live switch, persistence and 320/390 px fit; the other tools there pin Spanish (`abrir(..., { idioma })`) to compare with the original. Useful globals for tests: `world`, `save`, `state`, `SPECIES`, `spawnArrival`, `adjustSpecies`, `momentos`, `showAlbumDetail`, `travel`, `biomeSpeciesKeys`.
