# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Acuario Abisal" — a contemplative discovery game: a procedurally-rendered 2D canvas aquarium where real and fictional species arrive, get observed, photographed (Pokémon Snap-style) and collected into an expedition album. Vanilla JavaScript, no build system, no dependencies, no tests. All code, comments, UI text, and species data are in Spanish; keep new code and comments in Spanish to match. Tone references: thatgamecompany × Splatoon visuals, Katamari deadpan humor in album texts. Roadmap and status live in `ROADMAP.md`.

## Running

No build step. Serve the directory (the `file:` protocol is blocked by some tooling):

```bash
python3 -m http.server 8000
```

The only network dependency is Google Fonts; everything else works offline. Local assets are versioned with a query string (`style.css?v=5`) — bump the number in `index.html` after edits if the browser serves stale files.

## Architecture

Six scripts loaded as plain globals — **load order matters** (wired in `index.html`): `save.js` → `creatures.js` → `biomes.js` → `audio.js` → `album.js` → `aquarium.js`. There is no module system; everything communicates through top-level globals and the shared `world` object.

- **save.js** — persistent state in localStorage (`save`): `seen` (registered species), `photos` (dataURLs), `counts`, `biome`, `abyss`, `muted`, `bait`, `mode`. Helpers `isSeen`/`hasPhoto`/`persistSave` (debounced).
- **creatures.js** — utilities (`rand`, `clamp`, `lerp`, `pick`, `TAU`, `norm`, `hexToRgb`/`mixRgb`), the shared `world` object, all creature classes, and the `SPECIES` registry.
- **biomes.js** — `BIOMES`/`BIOME_ORDER` (palette, depth, flora flags per ecosystem) and unlock rules: a biome opens when ~70% of the previous one is registered (`biomeUnlocked`, `biomeThreshold`).
- **audio.js** — fully generative Web Audio (`audio` singleton): low pad + sporadic pentatonic notes + filtered-noise hydrophone, and one-shot events (`audio.event('descubrimiento'|'foto'|'zap'|'burbuja'|'bite'|'geiser'|'leviatan')`). Starts on first user gesture; abyss mode darkens the pad filter.
- **album.js** — expedition album UI and `renderPortrait(key, w, h, silhouette)`, which poses a throwaway specimen (`makeSpecimen`) and draws it to an offscreen canvas (cached). Unseen species show as silhouettes.
- **aquarium.js** — environment rendering (per-biome background via `bgMix`, rays, sand, kelp, fizz, marine snow, leviathan), particles (`bubbles`/`food` by bait type/`sparks`/`effects`), the view transform (zoom + follow camera), all DOM UI (start screen & modes, bitácora panel, creature card, camera mode, bait dock, biome travel, toasts), pointer interaction, and the `requestAnimationFrame` main loop.

### Shared `world` global

Defined in `creatures.js`, mutated everywhere. Holds canvas size (`W`/`H`), `time`, `abyssMix`, `mouse` (in **world** coordinates), `feedTarget`, `floorY(x)`, `anemone`, and entity arrays: `creatures`, `food`, `sparks`, `effects`, `bubbles`.

### View transform (zoom / follow)

`view` in aquarium.js. All world drawing happens under `ctx.setTransform` built from `viewTransform()`; pointer events are converted with `toWorld(px, py)` and UI anchors back with `toScreen(wx, wy)`. Anything positioned on screen (card, viewfinder) uses screen coords; anything simulated uses world coords.

### Species registry

Each species is an entry in `SPECIES` carrying display metadata (Spanish `nombre`, `sci`, Katamari-tone `fact`, verifiable `curioso`, stats, `grupo`: reales/ficticios/expedicion, `bioma`) and simulation parameters. The `kind` field selects the implementation:

- `kind: 'spine'` → `SpineFish`, a segment-chain body shared by all sharks and eels. Per-species tuning via `len`, `girth`, `segs`, `wiggle`, `speed`, `maxTurn` (turn-rate cap — prevents body knots), `profile`, `behavior`, `draw`, plus flags (`curious`, `luz`, `floorK`).
- Other kinds → dedicated classes referenced via `ctor`.

Every creature implements `update(dt)`, `draw(ctx)`, `hit(x, y)`, optionally `head()`. Organic stage entrances/exits are driven by flags the classes honor: `entering`, `leaving` + `exitX` (set by `dismiss()`), `alpha`/`fade`/`emerge`, `dead` (culled by the main loop). Spawn through `spawnArrival(key, n)` (never bare `spawnCreature` for visible arrivals — creatures must not pop in).

To add a species: `SPECIES` entry (with `bioma`), key in `LAYER_ORDER`, spine params or a class honoring the flags above, a `portraitBox` entry in album.js (plus `makeSpecimen` pose tweaks if it depends on `floorY`), and a case in `spawnArrival` if it doesn't swim in from an edge.

### Game modes and discovery

`state.mode`: `null` (start screen — gameplay gated), `'descubrimiento'` (director spawns unseen visitors with conditions — espectro needs an idle mouse, morena needs food; hovering ~2s registers, photographing completes the album entry), `'acuario'` (free tank: seen species only, director/observation off).

### Abyss mode

A global 0→1 transition (`world.abyssMix`) eased each frame. Environment colors interpolate via `bgMix(name, t)` (biome palette → `DARK`); creatures read `abyssMix` for glow. New visuals should interpolate on `abyssMix`, not branch on the boolean.

## Verifying changes

Serve + drive with `playwright-cli` (screenshots, `console`, and `run-code` for atomic interactions — creatures move, so compute positions and click in the same evaluate). Clear state with `localStorage.clear()`. Useful globals for tests: `world`, `save`, `state`, `SPECIES`, `spawnArrival`, `adjustSpecies`, `showAlbumDetail`, `travel`, `biomeSpeciesKeys`.
