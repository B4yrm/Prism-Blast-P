# Fishing Tycoon

Isometric fishing-company tycoon for Android. It is built with Phaser 3.90 and plain ES modules.

## Build

```bash
cd tycoon && npm install && npm run build
```

The build writes `index.html`, a single file with Phaser and the game inlined so it runs offline. The `tycoon` Android flavour packs this file as `apk/FishingTycoon.apk`. CI builds the APK.

## Layout

| Folder | Role |
|---|---|
| `src/config.js` | Map layout: island, roads, buildings, berths, iso projection |
| `src/data/defs.js` | Balance and content: upgrades, tiers, missions, research, shop |
| `src/core/` | State with versioned saves, economy formulas, event bus, audio |
| `src/sim/` | Simulation of boats, haulers, conveyor, factory, customers and the cash register, plus A* on the walk grid |
| `src/render/` | Atlas registry (`atlas.js`), ground composed from atlas tiles, small effect textures |
| `tools/bake/` | three.js bake of the 3D models into sprite atlases (see `ASSETS.md`) |
| `assets/` | Baked atlases (`atlas/`) and CC0 Kenney source models (`kenney/`) |
| `src/scenes/` | `BootScene` loads the atlases; `WorldScene` renders, runs the camera and handles taps |
| `src/ui/` | DOM HUD, side rail, dock, building labels, sheets and modals |

## Milestones

1. **Done.** Stage 1 vertical slice with the full production loop, building upgrades, workers, missions, daily reward, research, shop and offline earnings.
2. Stage 2: trucks and forklifts, more boat types, worker roles and a second factory line.
3. Stage 3: fish farm, island expansion plots and automated logistics.
4. Events, deeper achievements and a richer notification feed.
5. Art pass: replace the procedural placeholder art with a sprite atlas.
6. Android performance tuning: adaptive quality and memory checks.

See `ASSETS.md` for the art pipeline and how to replace sprites.
