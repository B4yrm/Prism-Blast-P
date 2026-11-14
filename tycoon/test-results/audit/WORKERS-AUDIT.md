# Fishing Tycoon: audit of workers, logistics and automation

**Scope.** Analysis only. No game file was changed for this audit. The evidence is the source code (file and function names below) and two read-only probes (`probes/`). The probes open the shipped `index.html` in headless Chromium, step the game at 30 FPS with a seeded random, and only *wrap* the page's own functions to time and count them.

**Labels used below**
- **[code]** read in the source;
- **[measured]** measured by a probe in headless desktop Chromium (not a phone);
- **[emulator]** from the CI Android emulator logs;
- **[assumption]** not verified.

---

## 1. Map of the current system

### Files and responsibilities

| File | What it does for workers and logistics |
|---|---|
| `src/sim/sim.js` | **The economy.** Class `Sim`: boats (`updBoat`), haulers (`pickJob`, `updWorker`, `walk`), factory (`updFactory`, conveyor queue `convey`), customers (`updCustomers`, `spawnCustomer`, `serve`, `leave`). Class `Mover`: position, path following, `step(dt)`, `remaining()`. |
| `src/sim/path.js` | Walkable grid (roads, pavements, building doors, the customer spawn tile), A* `findPath` with a cache, `simplify`, `pathLen`. |
| `src/core/economy.js` | `stat.*` values: `workerSpeed`, `carry`, `loadTime`, capacities, rates. `hire()`, `hireCost()`, `steadyRate()` (used by offline income). |
| `src/core/state.js` | Save format: worker **count** only (`S.workers`), stocks (`S.stock`), no worker or boat state. `save()` / `load()`. |
| `src/main.js` | Offline income: `steadyRate() × seconds × 0.5`, capped. Quality presets. |
| `src/scenes/WorldScene.js` | Drawing: `drawWalkers`, `placeWalker` (worker and customer sprites), `drawConveyor`, `drawCranes`, `craneWork` (on the `unload` event), `syncStocks` (stock piles every 250 ms). Its `update()` steps the simulation with `dt = min(0.1, delta)`. |
| `src/scenes/life.js` | Render-only: cars, one shuttling forklift, `separate()` (visual push-apart of people), shore effects. |
| `src/render/jetties.js` | Render-only: the two jetty carts (`unloading(i)`, `moveCart`) for boats at the loop berths. |
| `src/render/boats.js` | Render-only boats; `mooredSite(b)` gates the crane / cart animation. |

### Kinds of worker that exist

| Kind | Exists? | Where |
|---|---|---|
| **Haulers** (carry fish between stocks) | **Yes**, the only worker type | `sim.js` `updWorker` |
| Harbour / dock workers at the boats | No | – |
| Warehouse workers | No (the warehouse is a stock number) | – |
| Factory workers | No (`updFactory` moves stock by itself via the conveyor queue) | – |
| Sales staff | No (customers are served by a timer at the head of the queue) | `serve()` |
| Crane operators | No; the cranes are animated props | `drawCranes`, `craneWork` |
| Forklift / cart drivers | No; one ambient forklift and two jetty carts, none tied to stock | `life.js` `stepLift`, `jetties.js` `moveCart` |
| Customers | Yes (not workers) | `sim.js` |

### Hauler state machine [code: `Sim.updWorker`]

```
idle ──(pickJob() finds a job; reserve res[src], inc[dst])──▶ toSrc ──(path end)──▶ pick (loadTime)
  │                                                                                     │ take = min(n, stock[src]); stock[src] -= take
  │ no job: wait 1 s; if > 1.5 tiles from HQ ──▶ toRest ──(path end)──▶ idle            ▼
  ◀──────────────────────── drop (loadTime): stock[dst] += carry ◀──(path end)── toDst
```

- **Jobs** (`pickJob`), chosen by score = priority × fill ratio of the source + load / carry:
  - quay → warehouse (raw), priority 1.2;
  - factory output → market (product), priority 1.4, only with a factory;
  - warehouse → market (raw), priority 1, or 0.6 with a factory when the warehouse is over 70 % full.
- **Places** (`PLACES`): quay = tile (10, 22); warehouse door (19, 19); factory door (17, 9); market door (10, 19); rest = HQ door (6, 9).

### Animation flow [code: `WorldScene.drawWalkers` / `placeWalker`]

- **Walking:** 4 directions × 4 frames (`p/worker/{none|raw|prod}/{dir}/{k}`). The frame advances every 7 *rendered frames* (`walkT`), not by time.
- **Pick / drop:** bend poses `none/b0` and `{raw|prod}/b1`, switched at half of `loadTime`.
- **Carrying:** the carried kind is shown (`raw` or `prod` sprite) while `carry > 0`.
- **Idle:** a sine "breathing" bob.
- **Depth:** `depthAt(x, y) + 1`, the same rule as props and buildings.
- The atlas also has `can` frames that the code never uses.

---

## 2. What exists

### Works and is part of the economy (the simulation is the source of truth)

- Haulers are **simulation agents**: their walking time is part of the economy. Fish only move from the quay to the warehouse or market when a hauler has walked there. `steadyRate()` models exactly this ("two legs share the haulers"). [code]
- Reservations (`res` for sources, `inc` for destinations) stop two haulers taking the same fish and stop overfilling a destination. [code]
- Path following on a tile grid with A*, cached per start/goal pair; collinear points are dropped (`simplify`). [code]
- A random lane offset per hauler (±0.25 tiles) spreads walkers sideways. [code]
- Conveyor boxes are drawn from `sim.convey`, so the visual is the true state of the factory queue. [code]
- Stock piles are drawn from `S.stock` every 250 ms (`syncStocks`). [code]
- Cars yield to walkers standing in their lane (`Life.blocked`). [code]

### Visual only (no effect on the economy)

- **Cranes:** `craneWork(b)` on every `unload` event starts the hook cycle for 1.2 s, only if the crane is within 1.5 tiles of the boat's slip and the boat is moored (`fleet.mooredSite(b) >= 0`). The crate on the hook is not linked to how many fish are unloaded. [code]
- **Jetty carts** (boats at the loop berths): kept busy while `unloading(i)` is called. [code]
- **The forklift on the warehouse apron** (`Life.makeForklift`): shuttles between two fixed points forever and toggles its load each run. [code]
- **Visual separation of people** (`Life.separate`): pushes sprites apart; simulation positions are untouched. [code]

### Does not exist

- Workers going to the boats, a worker per boat, or dock workers on the piers. Haulers always pick up at the single quay tile (10, 22), whichever boat unloaded. [code]
- Unloading by people. The boat's fish go straight into `S.stock.quay` in `updBoat` (rate = hold ÷ 2.5 s). [code]
- Warehouse, factory, sales, crane or forklift workers. [code]
- Worker-to-worker collision avoidance or giving way in the simulation. [code]
- Obstacle avoidance beyond the walkable tile grid: props on walkable tiles are ignored. [code]
- Saving worker, boat or reservation state. [code]
- A listener for the `drop` event (`bus.emit('drop')` in `updWorker`, nobody handles it). [code]
- Off-screen culling or level of detail for walkers. [code]

---

## 3. Logistics chain: what is really shown

| Step | Status | Evidence |
|---|---|---|
| Boat comes in | Yes (approved boat system) | `render/boats.js` |
| Unloading starts | Simulation: the boat's load drips into `stock.quay`. Visual: a crane hook cycle (slips 1–2 only) or a jetty cart (loop berths). | `updBoat`, `craneWork` |
| Unloading animation before the boat is in? | **No** for the crane and carts: gated on `mooredSite`. [measured: 0 of 390 / 2,689 unload events with the boat away] **But** haulers may take the new fish from the quay stock while a late boat is still arriving, because they only see the stock. | `craneWork`, `pickJob` |
| A worker goes to the boat? | **No.** Pick-up is at quay tile (10, 22). Boats lie at x = 4.3, 9.6, 16.6 and 22.6 (slips) or at the jetties (x −5 … 33). | `PLACES.quay` |
| A load is visible in the hands? | **Yes:** a `raw` / `prod` carry sprite while carrying. [measured: raw and prod both seen] | `placeWalker` |
| Delivery animation? | Bend pose for `loadTime`, then the stock pile grows (up to 250 ms later). No hand-over effect; the `drop` event is not used. | `drawWalkers`, `syncStocks` |
| Crane tied to the boat? | Only by the `unload` event, and only for slips 1 and 2. **Slips 3 and 4 (x = 4.3, 22.6) have no crane:** 0 crane cycles for their boats. [measured: crane cycles per boat = 100, 100, 0, 0] | `CRANES = [[9,23],[16,23]]` |
| Several boats at once? | All haulers go to the same quay tile. [measured, 10 haulers, 4 boats: up to **9 haulers** at the quay tile at once; 48 s of 600 s with two or more there] | `PLACES.quay` |
| No job? | Wait 1 s, then walk to the HQ door (6, 9): 25 tiles from the quay and back. [measured: 12–13 % of hauler time is spent in `toRest`] | `updWorker` idle branch |
| Same load shown twice? | No. One carry per reserved job; the reservations prevent double pick-up. [code] | `res`, `inc` |
| Mismatch between visual and economy | (a) Haulers walk through props on the quay row: the quay → warehouse route `[(10.5,22.5),(19.5,22.5),(19.5,19.5)]` passes within 0.05 tiles of the fish-box stack at (16.6, 22.45) and straight through the parked forklift (18.3, 22.5) and the barrels (19.4, 22.5). (b) The crane crate does not match the amount unloaded. (c) Cranes are missing for 2 of 4 slips. (d) The ambient forklift is not tied to anything. | [code + geometry check] |

**Important for the plan:** the haulers are not visual logistics; they are the economy. Changing where they wait, which routes they take or how they queue changes throughput and therefore income. The requirement "visual logistics must not be the source of the economy" is already reversed for haulers in the existing design. Any change to their behaviour that is more than drawing needs your decision (§6).

---

## 4. Technical audit

### State machine and job management [code]

- Six states, no stuck state found. [measured: longest time without moving in a walking state = 1 frame, 10 haulers × 15 min]
- **No deadlock:** jobs are reserved at start and released at pick and drop; a job whose source became empty is cancelled (`take <= 0`).
- **Risk:** `pickJob` scans every job type for every idle hauler each time; cheap at ≤ 10 haulers.
- **Priorities** are static numbers plus fill ratios: there is no "nearest worker" choice, so a hauler at the far market can be sent to the quay while one stands next to it.

### Pathfinding [code]

- A* with a linear open list and `open.includes`, which is O(n²) per search; this is irrelevant because results are cached per (start, goal) pair in an unbounded `Map`.
- The number of distinct keys is bounded by walkable start tiles × destinations (a few thousand at most). [assumption: not measured]
- If no path is found, `walk()` **teleports** the worker to the target. [measured: 0 teleports in the probes]
- Paths are on tile centres plus the lane offset, so walkers can stand a quarter tile off the pavement edge.

### Collision avoidance and giving way

- **Simulation:** none. [measured: two haulers' simulation positions closer than 0.3 tiles for 253 s of 600 s; up to 45 such pairs in one frame (10 haulers)]
- **Visual:** `Life.separate` pushes people apart within 0.42 tiles, eased by 20 % per frame. This is O(n²) over haulers + customers (≤ 24 people). It never stops anyone, so people slide around each other instead of waiting.
- Cars wait for people in their lane; people never wait for cars or each other.

### Idle behaviour

- The commute to the HQ door (see §3) is the main "meaningless movement".
- At the door, haulers stand with the idle bob; customers in the queue look around (`lookDir`).

### Animation transitions

- The walk cycle depends on the frame rate (7 rendered frames per step). At 60 FPS feet move 2× faster than at 30 FPS; on the emulator (~9–12 FPS) they move very slowly. [code + emulator FPS]
- No turn transitions (four directions snap). The bend pose switches at 50 % of `loadTime`. With the warehouse "load" upgrade, `loadTime` is 0.9 × 0.9^level s, about 0.04 s at level 30, so pick and drop flash by in about a frame. [code]

### Movement speed

- `workerSpeed` = 3 × (1 + 0.08·train) × (1 + 0.1·ergo) tiles/s: 3 at level 0, 10.2 at train 30. At high levels haulers sprint unnaturally fast. [code] This is the same concern the boats had. Capping it visually would change throughput, because the speed is economic.

### Drawing order

- Walkers use `depthAt(x, y) + 1`, props use `depthAt(x, y)`, buildings use the depth of their centre.
- Walkers behind tall buildings sort correctly. Walkers passing *through* a prop (§3) are drawn in front of it at one moment and behind it the next as they cross its tile. [code; not captured on video]

### Zoom

- Walkers are always updated and drawn, whatever the zoom; there is no culling or level of detail. [code]
- Sprite size does not change with zoom level beyond the camera zoom. No issue found. [assumption: not looked at on a device]

### Save / load [code + measured]

- Saved: the worker count and the stocks. Not saved: hauler states, carried fish, boat loads, reservations.
- On load, haulers start at the HQ door (`addWorker`), boats start docked and empty.
- **Fish in transit are lost on a restart** (simulation fish, not just visuals):
  - fish already taken from a stock by a hauler (`stock[src] -= take` in `pick`);
  - fish aboard a returning boat (already counted in `stats.caught`).
  - [measured, mid save, 10 haulers: up to 48 fish carried and up to 73 aboard boats at a 10-second sample]
- This is existing save behaviour; changing it is a save-format change (§6).
- Offline income does not simulate workers: it is the closed form `steadyRate()`. That formula assumes a 2 × 20-tile hauling loop; the real quay → warehouse → quay loop is 24 tiles, and warehouse → market is 9 tiles. [measured with `findPath`] It is a different model from the live simulation, by design, and stays unchanged.

### Frame-rate dependence of the whole simulation (outside the worker code, but it drives the workers)

- `WorldScene.update` clamps `dt` to 0.1 s. Below 10 FPS the simulation runs slower than real time: at the emulator's 8.8 FPS on High it runs at about 0.88× (fewer fish and less income per real minute). [code + emulator]
- On a real mid-range phone this depends on its FPS. [not measured]

### Risks found

| Risk | Status |
|---|---|
| Deadlock / endless waiting | None found [measured] |
| Repeated job / double carry | Prevented by reservations [code] |
| Walking through objects | **Yes:** three props on the main quay route [code + geometry] |
| Teleport | Only if no path exists (fallback in `walk()`); not seen [measured] |
| Stuck animation | None; but pick/drop shorter than one frame at high warehouse levels [code] |
| Overlap | Simulation positions overlap often; only the visual push-apart hides it [measured] |

---

## 5. Android performance

**Measured** (headless desktop Chromium, software GPU, per call, averages over 15 game minutes; a phone CPU is several times slower [assumption]):

| Part | 6 haulers, mid save | 10 haulers, everything maxed |
|---|---|---|
| `sim.update` (whole economy) | 0.012 ms | 0.006 ms |
| `drawWalkers` | 0.012 ms | 0.015 ms |
| `Life.separate` | 0.003 ms | 0.005 ms |
| `Life.update` (cars, forklift) | 0.003 ms | 0.003 ms |
| `drawCranes` + `drawConveyor` | 0.001 ms | 0.003 ms |
| *for comparison: `fleet.update` (boats)* | *0.15 ms* | *0.06 ms* |

- **Heap** (after forced GC every game minute, 15 minutes): 55.2 → 60.4 MB, growing ever more slowly (+0.1 MB in the last 5 minutes). Not a clear leak; a 60-minute run is needed to be sure.
- **Display list:** 1,256 objects, stable. Hauler sprites: one per hauler. Customer sprites are pooled (`custPool`).

**From code (not measured):**
- Two temporary arrays of all people are built every frame (`[...workers.map, ...customers.map]` in `update` and `drawWalkers`), plus `path.map` in `Mover.go` per trip. This is small garbage-collection pressure.
- `findPath` runs only on cache misses.
- No off-screen culling for walkers; with ≤ 24 people this costs little in this measurement.
- Draw calls: all people share the atlas pages. Earlier benchmarks measured 5 draw calls per frame for the whole scene on Medium and High.

**Emulator (CI #44):** Medium 11.9 FPS, High 8.8 FPS, total PSS 131 MB. This is the whole game; the worker share cannot be separated there.

**Conclusion:** in these measurements the worker system is not a performance problem; the boats and the renderer cost far more. Real-device numbers are missing.

| Optimisation | Benefit | Effort | Risk |
|---|---|---|---|
| Reuse the two per-frame people arrays | small (less GC) | very low | none |
| Skip `drawWalkers` sprite updates off screen | small at ≤ 24 people | low | low (pop-in at the edge) |
| Time-based walk cycle instead of frame-based | visual correctness at any FPS | very low | none |
| Spatial grid for `separate` | negligible now; only matters with many more people | medium | low |
| A* binary heap | none (cached) | medium | low |

---

## 6. Problems by priority

**Critical:** none found that breaks the game.

**High**
1. Haulers walk through the fish-box stack, the parked forklift and the barrels on the quay route. [code + geometry]
2. Haulers never go to the boats: one shared pick-up tile, far from three of the four slips and from both jetties. The core "boat → people → warehouse" story is not shown. [code]
3. Slips 3 and 4 have no crane: their unloading has no animation at all; boats at the loop berths get only the cart. [code + measured]
4. Fish in transit (carried, or aboard returning boats) are lost on a restart. This is economic, not visual. [code + measured]
5. Simulation slows below 10 FPS (`dt` clamp); High on slow devices earns less per real minute. [code + emulator]

**Medium**
6. Idle haulers walk 25 tiles to the HQ door and back (12–13 % of their time). [measured]
7. Up to 9 haulers stack on one tile; people slide through each other instead of waiting. [measured]
8. Walk animation speed depends on FPS. [code]
9. Pick and drop poses become sub-frame at high warehouse "load" levels. [code]
10. Hauler speed reaches about 10 tiles/s at train 30 and looks like sprinting. [code]
11. Haulers can carry fish "from" a late boat that is still arriving (they see only the stock). [code]

**Low**
12. Unused `drop` event and unused `can` sprites. [code]
13. Crane crate and jetty-cart crates are not linked to quantities. [code]
14. The ambient forklift loops forever, tied to nothing. [code]
15. No turn or hand-over animation. [code]

---

## 7. Recommended improvements and phased plan

Guiding rule: **the simulation (`src/sim/sim.js`, `src/core/economy.js`) stays the source of truth and is not edited** in phases A–C. Everything is done in a new render-side layer (like the boats in `render/boats.js`), unless you choose otherwise in §8.

### Phase A: fix real faults (render only)

- **Changes**
  - Visual walker paths avoid the quay props: a render-side detour around them, while the simulation keeps its tile path and timing. Alternative: move the three props off the walking line (a decor change: your choice).
  - Time-based walk cycle.
  - Minimum visible duration of the pick and drop poses (drawn shorter or longer, the simulation untouched).
  - A crane-like unloading cue for slips 3 and 4 (an existing crane sprite placed at those slips, or a cart).
- **Files:** `src/scenes/WorldScene.js` (`placeWalker`, crane set-up), possibly a new `src/render/walkers.js`; `config.js` only for decor positions if chosen.
- **Uses:** atlas, `depthAt`, `mooredSite`, `findPath` results.
- **Risk:** low. **Performance cost:** negligible.
- **Tests:** a static check that no visual walker route enters a prop footprint; a timeline test proving the simulation is unchanged (as for the boats); screenshots at 30 and 60 FPS.
- **Acceptance**
  - 0 walker/prop intersections;
  - simulation legs identical to a run without the change;
  - every slip shows an unloading cue only while its boat is moored.

### Phase B: more natural hauler behaviour (render only, unless you choose otherwise)

- **Changes**
  - Visual "waiting" instead of sliding: when two walkers would meet, the lower-priority one is *drawn* pausing. The simulation position runs on and the visual catches up within a bounded lag (≤ 0.3 s), the same principle as the boats' elastic window.
  - Turn easing between directions.
  - A pick-up and hand-over effect (the box handed onto the pile, the pile pulses).
  - Idle: stand in a small "break area" near the HQ instead of all on one tile.
- **Files:** a new `src/render/walkers.js`, `WorldScene.drawWalkers`, `life.js` (`separate` replaced or limited).
- **Risk:** medium (visual lag must not show a load arriving after the pile grew). **Performance:** small (≤ 24 people).
- **Tests:** long runs with 10 haulers (overlap time, worst visual lag, no pile growth without a visible delivery), simulation timeline identical.
- **Acceptance**
  - no two drawn walkers closer than 0.3 tiles;
  - visual lag ≤ 0.3 s;
  - simulation unchanged.

### Phase C: logistics shown end to end (render only)

- **Changes**
  - Per-boat dock workers on the pier next to each slip and jetty berth: purely visual figures that carry boxes from the boat to a pile at the quay *while the simulation unloads that boat* (driven by the `unload` events and `mooredSite`, like the cranes and carts).
  - Haulers then pick up from that pile. Their simulation pick-up point stays (10, 22); the drawn pile is placed there.
  - Crates on cranes and carts scaled to the unload rate.
  - The ambient forklift tied to warehouse → factory movements (conveyor pushes).
- **Files:** new `src/render/dockers.js`, `WorldScene.js`, `jetties.js`.
- **Risk:** medium (more figures on narrow piers; must not cross boats or other figures). **Performance:** low to medium (up to 8 extra figures).
- **Tests:** four boats unloading at once; unloading never shown without a moored boat; no dock worker on water or inside a boat.
- **Acceptance:** 0 dock-worker figures off the walkable pier area; 0 unloading figures active without the boat; simulation unchanged.

### Phase D: performance and long-term stability

- **Changes**
  - Reuse per-frame arrays.
  - Off-screen skip for walker sprite updates.
  - A 60-minute soak test with heap sampling.
  - Device measurements (real phone).
  - Optionally the economic decisions below (save of in-transit fish, `dt` clamp), only if you approve them.
- **Files:** `WorldScene.js`, `life.js`, tests.
- **Risk:** low.
- **Tests:** heap after GC flat over 60 minutes (± 2 MB); FPS on a mid-range phone not lower than before.

**Dependencies:** A before B (B builds on the visual path layer); C after B (dock workers use the same giving way); D can run alongside.

---

## 8. Decisions that need your approval

| # | Question | Option 1 | Option 2 | My recommendation |
|---|---|---|---|---|
| 1 | Should haulers' **behaviour** (where they wait, how they queue, giving way) change in the **simulation**? | Yes: more natural, but it changes throughput and income (an economic change). | No: all improvements are visual, with a bounded visual lag; the economy stays identical. | **Option 2.** It fits "the economy must not change". |
| 2 | Quay props in the way | Render-side detour for walkers (props stay). | Move three props off the walking line (a small decor change). | **Option 2**: simpler and cheaper, and it looks cleaner. The map design otherwise stays. |
| 3 | Dock workers at the boats (phase C) | Add visual dock workers per berth. | Only crane / cart cues per berth. | **Option 1** if you want the full "boat → people → warehouse" story; it is the largest visual gain. |
| 4 | Fish lost on restart (carried and aboard) | Save them (save-format change, needs migration and tests). | Keep as now (existing behaviour, small amounts). | **Keep for now** (option 2). It touches save/load, which is protected; it can be a separate approved task. |
| 5 | Simulation slows below 10 FPS | Raise the clamp or sub-step the simulation (economic timing change on slow devices). | Keep as now. | **Keep** until real-device FPS is measured; then decide. |
| 6 | Hauler sprint speed at high training levels | Visual cap with lag (cannot stay in step at about 10 tiles/s). | Keep the fast movement. | **Keep for now.** A visual cap cannot stay in step with an economic speed of 10 tiles/s without the walker visibly lagging behind deliveries. |

---

## 9. Test plan for the implementation phases (planned, not yet run)

| Scenario | How | Status |
|---|---|---|
| One boat comes in | Unloading cue only while moored; haulers deliver; pile grows | planned |
| Four boats at once | 4 boats, 10 haulers, 30 min: overlaps, worst visual lag, cue gating | planned |
| Overlapping unloads | Two boats moored in the same second | planned |
| Narrow passages | Haulers meeting on the quay row and at doors | planned |
| Crane and workers together | Crane cycle vs. dock workers on the same pier | planned |
| Interrupted job | Save during `pick` / `toDst` and reload | planned (today: fish lost, see §6) |
| Upgrade during play | Worker speed, carry and load bought mid-run | planned |
| Close and reopen | Save/load, 13-field snapshot | existing test (`tests/run-tests.cjs`): passes today |
| Old save | Saves without new fields | existing test pattern (`tests/outer-save.cjs`) |
| 30–60 min continuous play | Heap, FPS, stuck walkers | 15 min done in this audit (probe); 60 min planned |
| Low and high zoom | Screenshots, depth sorting, culling edges | planned |
| Mid-range Android device | FPS, PSS, touch | **not possible here**: needs a real phone; emulator only |

**Run during this audit:** the two probes in `probes/` (headless Chromium, read-only) and the emulator data of CI #44. **Nothing was run on a real phone.**
