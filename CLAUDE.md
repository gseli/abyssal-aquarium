# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Acuario Abisal" — an interactive deep-sea aquarium rendered procedurally on a 2D canvas. Vanilla JavaScript, no build system, no dependencies, no tests. All code, comments, UI text, and species data are in Spanish; keep new code and comments in Spanish to match.

## Running

No build step. Open `index.html` directly in a browser, or serve the directory:

```bash
python3 -m http.server 8000
```

The only network dependency is Google Fonts (Fraunces, IBM Plex Mono); everything else works offline.

## Architecture

Two scripts loaded as plain globals — **load order matters** (`creatures.js` must come before `aquarium.js`, as wired in `index.html`):

- **creatures.js** — utilities (`rand`, `clamp`, `lerp`, `pick`, `TAU`), the shared `world` object, creature classes, and the `SPECIES` registry.
- **aquarium.js** — environment rendering (background, rays, sand, kelp, marine snow, leviathan), particle systems, all DOM UI (bitácora panel, creature card, depth HUD), pointer interaction, and the `requestAnimationFrame` main loop.

### Shared `world` global

Defined in `creatures.js`, mutated everywhere. Holds canvas size (`W`/`H`), `time`, `abyssMix`, `mouse`, `feedTarget`, `floorY(x)` (seafloor height function, redefined by `aquarium.js`), and the entity arrays: `creatures`, `food`, `sparks`, `effects`, `bubbles`. There is no module system — everything communicates through this object and top-level globals.

### Species registry

Each species is an entry in `SPECIES` (creatures.js) carrying both display metadata (Spanish name, `sci`, `fact`, stats, `grupo`: reales/ficticios/expedicion) and simulation parameters. The `kind` field selects the implementation:

- `kind: 'spine'` → `SpineFish`, a segment-chain body shared by all sharks and eels. Per-species tuning via `len`, `girth`, `segs`, `wiggle`, `speed`, `profile` (width function), `behavior` (e.g. `huntBehavior`, `lurkBehavior`, `bottomBehavior`), and a `draw` function.
- Other kinds → dedicated classes (`Sardina` school, `Medusa`, `Estrella`, `Faroluz`, `Buzo`) referenced via `ctor`.

Every creature implements `update(dt)`, `draw(ctx)`, `hit(x, y)`, and optionally `head()` (used to anchor the info card).

To add a species: add its `SPECIES` entry, add its key to `LAYER_ORDER` (back-to-front draw order), and provide either spine parameters + draw function or a class. The bitácora panel and population counts are generated from the registry automatically.

### Abyss mode

A global 0→1 transition (`world.abyssMix`), eased each frame toward the toggle state. Environment colors interpolate through `mixCol` color pairs in `aquarium.js` (`BG`), and creatures read `abyssMix` for glow/bioluminescence effects. New visuals should interpolate on `abyssMix` rather than branching on the boolean.
