# Workers — phase A: report

Dev build only (`.preview/dev.html`). `tycoon/index.html` and the APK are unchanged. Every number below comes
from headless Chromium with a software GPU (SwiftShader) in this container. **No emulator and no real
Android device was used for phase A.**

## 1. What changed

| File | Function / place | Change |
|---|---|---|
| `src/scenes/WorldScene.js` | quay props list (`create`) | fishbox stack 16.6,22.45 → 15.3,23.55; parked forklift 18.3,22.5 → 18.4,23.55; barrels 19.4,22.5 → 19.4,23.55 (pier edge, off the haulers' quay → warehouse line). Nothing else on the map moved. |
| `src/scenes/WorldScene.js` | `drawWalkers`, new `replay` | haulers are drawn from a record of the simulation's own states (ring buffer, 64 frames). At a pick-up / drop shorter than `POSE_MIN` (0.32 s) the figure holds the bending pose, then catches up at 1.6× speed; it is never more than `LAG_MAX` (0.25 s) behind, so the delay cannot build up. The simulation is not touched. |
| `src/scenes/WorldScene.js` | `placeWalker` | the walk cycle runs on time and speed (one step per 0.35 tiles, 5–12 steps a second) instead of one step per 7 frames. The customers' look-around timer is exactly as before (see 4.1). |
| `src/scenes/WorldScene.js` | `craneWork`, `update` | slips without a crane (slips 3 and 4) show the new slip cart; the call is gated on `fleet.mooredSite` as before, and the cart is told every frame whether its boat is still moored. |
| `src/render/slipcarts.js` (new) | `SlipCarts` | a small forklift per crane-less slip shuttles between the bow and the quay while the simulation unloads the boat moored there; it turns back and parks the moment the boat is no longer moored; the crate on the forks shows only after the cart reached the boat. |

Unchanged (verified with `git diff`): `src/sim/*` (economy simulation, A*, haulers' task system), `src/core/*`
(economy, save/load, offline income), `src/render/boats.js`, `src/render/boatpaths.js`, `src/render/jetties.js`
(boat routes and approved berths), `fishing/` (Balıqçı Idle), the Stage 2 branch, the multi-sea system.

## 2. Tests — summary

| # | Test | Runs | Result |
|---|---|---|---|
| 1 | Same-seed regression, before vs after (`tests/workers-regress.cjs`) | 6 scenarios (600 s ×4, 300 s at 15 FPS, 300 s at 60 FPS) | **6/6 identical** |
| 2 | The same at the real 844×390 viewport (extra, 120 s, mid) | 1 | **identical** |
| 3 | Static prop check (`tests/decor-check.cjs`) | 11 props | **pass** (moved props clear of every walking line, cranes, bollards, boats, carts) |
| 4 | Props vs drawn haulers, 15/30/60 FPS (`tests/decor-dynamic.cjs`) | 12 (2 scenarios × 3 FPS × 2 builds) | **pass**: 0 frames inside a prop, 0 wrong draw order (after) |
| 5 | Pick-up / drop vs simulation (`tests/pose-sync.cjs`) | 6 (2 scenarios × 3 FPS) | **pass** for sync (0 skipped, never more than one job behind); **FAIL** for the 0.32 s minimum pose at the high warehouse level (0.217–0.267 s), see 4.3 |
| 6 | Walk cycle at 15/30/60 FPS (`tests/walk-anim.cjs`) | 12 | **pass**: 11.8–12.7 steps/s at every frame rate (before: 2.1 / 4.2 / 8.5) |
| 7 | Unloading indicator per boat (`tests/unload-show.cjs`) | 3 scenarios × 2 builds | **pass** (after one fix, 4.2) |
| 8 | Save / load / old saves / offline income, before vs after (`tests/save-compare.cjs`) | 4 saves | **4/4 identical** |
| 9 | Project suite `tests/run-tests.cjs` on the dev build | 15 checks | **15/15** |
| 10 | Outer berths save test `tests/outer-save.cjs` on the dev build | 1 | **pass** |
| 11 | FPS / memory benchmark `tests/bench.cjs`, before vs after, twice each, machine idle | 12 scenes | within run-to-run noise (section 6) |

Count: 10 pass/fail tests, **9 passed, 1 failed in part** (test 5: the 0.32 s pose target at high levels).
Test 11 is a measurement.

## 3. Regression (same start state, same seed)

Every run starts from the same state: `Math.random` is seeded just before the world and its simulation are
created, and the world does not update until the test steps it. Every frame is stepped with the same frame
time and the same clock start, so drawing runs too and shares `Math.random` with the simulation exactly as in
play. Traced every 0.5 s: money, register, all stocks (quay, warehouse, factory output, market raw/product),
every hauler's state / position / timer / load, every boat's state / load / position, customers, caught, sold.
Unload events are compared by frame number and boat.

| Scenario | Seconds | Samples | Unload events | Caught | Sold | Identical | Unloading shown with the boat away |
|---|---|---|---|---|---|---|---|
| start: 1 boat, 1 hauler | 600 | 1200 | 200 | 211 | 102 | yes | 0 |
| mid: 4 boats, 6 haulers, factory | 600 | 1200 | 447 | 505 | 88 | yes | 0 |
| high warehouse level (pick/drop 0.04 s), 10 haulers | 600 | 1200 | 2490 | 2561 | 524 | yes | 0 |
| max 30/30, loop berths, 10 haulers | 600 | 1200 | 2361 | 2371 | 530 | yes | 0 |
| mid at 15 FPS | 300 | 600 | 441 | 505 | 82 | yes | 0 |
| mid at 60 FPS | 300 | 600 | 436 | 505 | 77 | yes | 0 |
| mid, 844×390 viewport (extra) | 120 | 240 | 329 | 393 | 37 | yes | 0 |

Money stays at 500 in these runs because the register is never collected; the register itself is traced and identical.

Viewport: the main runs use a 200×100 viewport, because the pixel fill costs 108 ms a frame at 844×390 in
SwiftShader and 1.8 ms at 200×100, while game logic costs about 0.03 ms. Both builds always run with the same viewport.
A different viewport gives a different, but equally deterministic, random stream (some drawing draws from
`Math.random` depending on what is on screen), so 844×390 and 200×100 are not compared with each other; the
extra 844×390 run compares before vs after at that viewport.

## 4. Failures found, causes and fixes

### 4.1 Game code: the customers' look-around timer (fixed)
First regression after the harness was made deterministic: the trace diverged after 12 s (customer count).
Cause: I had changed the queue look-around timer in `placeWalker` from `game.loop.delta / 1000` to the new `dt`.
It reached zero one frame earlier, and its three `Math.random` draws (purely visual) then came at a different
frame. Because the simulation shares that random stream, every later random event shifted. Fix: the line is
restored exactly as it was. Afterwards every frame makes the same random draws in both builds (checked over
9000 and 11400 frames).

### 4.2 Game code: slip carts after the boat left (fixed)
`unload-show` found 0.7 s episodes (3 per cart in 480 s) in which a slip cart was still driving out after its
boat had cast off (the 1.4 s busy timer). Fix: the cart is told every frame whether its boat is moored; if not,
it turns back and parks at once, and the crate only shows after the cart reached the boat. Afterwards: 0 frames.

### 4.3 Not fixed — the 0.32 s pose minimum at the high warehouse level (decision needed)
| Scenario | FPS | Poses | Skipped | Start delay max / median | Ahead max | Shown pose min / median | Load in hand wrong (max run) | Figure still holds the load after the stock rose (max) |
|---|---|---|---|---|---|---|---|---|
| mid (pick/drop 0.6 s) | 15 | 128 | 0 | 0.067 / 0.067 | 1 | 0.933 / 0.933 | 0 | 0 |
| mid | 30 | 130 | 0 | 0.033 / 0.033 | 1 | 0.933 / 0.933 | 0 | 0 |
| mid | 60 | 129 | 0 | 0.017 / 0.017 | 1 | 0.900 / 0.900 | 0 | 0 |
| high (pick/drop 0.04 s) | 15 | 371 | 0 | 0.067 / 0.067 | 1 | **0.267** / 0.267 | 0 | 0.200 |
| high | 30 | 405 | 0 | 0.067 / 0.033 | 1 | **0.233** / 0.267 | 0 | 0.200 |
| high | 60 | 387 | 0 | 0.083 / 0.017 | 1 | **0.217** / 0.283 | 0.033 | 0.233 |

Before: the pose at the high level lasted 0.05–0.067 s (1–3 frames). After: 0.22–0.28 s, 4–5× longer, but
below the 0.32 s target. Cause: the two limits contradict each other: with a 0.04 s pick-up, a 0.32 s pose
needs the figure to fall 0.28 s behind, while the delay is capped at 0.25 s. Options:
- **A** raise `LAG_MAX` to 0.32 s: the pose reaches 0.32 s, but the figure may lag the simulation by up to
  0.32 s, and the stock count may show a delivered box up to about 0.3 s before the figure sets it down;
- **B** keep the 0.25 s cap and accept 0.22–0.28 s poses;
- **C** start the bend slightly before the hauler arrives, using the simulation's recorded states (no extra
  delay); this is new code and needs its own tests.

"Ahead max 1" in every run: the simulation was never two jobs ahead of the figure, so a drawn pose never overlaps the next task.
The figure's delay never grows (max per 30 s: 0.20–0.25 s throughout).

### 4.4 Test harness bugs (fixed; all results before each fix were discarded and re-run)
- frame name parsed at the wrong position in `walk-anim` (pose and walk frame read from the direction field);
- real-time frames ran between scene creation and the test start (non-deterministic start): now seeded
  before `create` and the whole scene step frozen until the test starts (particles, tweens, clocks too);
- `game.loop.delta` was stale under manual stepping (16.64 vs 16.633 ms between runs): now set per step as
  Phaser's own loop does;
- the stepped clock started at `performance.now()` (different per run; the boats time their moves on it):
  now a fixed start;
- unload events were timestamped with that clock: now frame numbers;
- `decor-dynamic` counted draw order at the same depth line (1/16 tile tie-break) as wrong;
- `walk-anim` dropped steps on frames where the walking direction changed;
- the first regression run was too slow (rendering at 844×390) and hit its time limit without output: each
  scenario is now saved as soon as it finishes; the scenarios were run at their original lengths.

## 5. Animation and visual sync

Walk cycle, steps per second while walking (all haulers, 120 s per run):

| Scenario | Build | 15 FPS | 30 FPS | 60 FPS |
|---|---|---|---|---|
| mid | before | 2.10 | 4.23 | 8.53 |
| mid | after | 11.76 | 12.15 | 12.25 |
| high | before | 2.06 | 4.19 | 8.50 |
| high | after | 11.83 | 12.44 | 12.66 |

Before, the walk cycle ran 4× slower at 15 FPS than at 60 FPS; after, it stays within 7 % at every frame rate.

Props vs drawn haulers (feet position after the delay, the lane offset and the push-apart), moved props:

| Scenario | FPS | Before: frames inside fishbox / forklift / barrels | After: frames inside | After: nearest hauler (tiles) |
|---|---|---|---|---|
| mid | 15 | 152 / 180 / 184 | 0 / 0 / 0 | 0.81 / 0.81 / 0.80 |
| mid | 30 | 310 / 356 / 385 | 0 / 0 / 0 | 0.81 / 0.81 / 0.80 |
| mid | 60 | 650 / 735 / 776 | 0 / 0 / 0 | 0.82 / 0.82 / 0.79 |
| high | 15 | 120 / 170 / 153 | 0 / 0 / 0 | 0.74 / 0.67 / 0.74 |
| high | 30 | 290 / 371 / 379 | 0 / 0 / 0 | 0.79 / 0.75 / 0.75 |
| high | 60 | 589 / 692 / 718 | 0 / 0 / 0 | 0.69 / 0.69 / 0.69 |

The check is made in world coordinates, so it holds at every zoom; draw order is checked in screen space.
The screenshots are at zoom 2.4 (close-up) and 0.72 (all four slips).

Unloading indicator, every unload event of every boat (480 s per scenario, new build):

| Scenario | Slip 1 | Slip 2 | Slip 3 | Slip 4 | Events while not moored | Slip cart frames with no boat moored |
|---|---|---|---|---|---|---|
| slips, mid | crane 135/135 | crane 115/115 | slip cart 106/106 | slip cart 91/91 | 0 | 0 |
| slips, quay often full | crane 121/121 | crane 98/98 | slip cart 42/42 | slip cart 29/29 | 0 | 0 |
| loop berths, max | jetty cart 480/480 | jetty cart 480/480 | jetty cart 460/460 | jetty cart 470/470 | 0 | – |

The cranes and jetty carts behave exactly as in the old build (compared field by field).

## 6. FPS and memory (headless Chromium, SwiftShader, 844×390 at DPR 2.75: compare the runs with each other, not with phones)

| Scene | FPS before (run 1 / 2) | FPS after (run 1 / 2) | Update ms before → after | Texture MB | JS heap MB before → after | Objects |
|---|---|---|---|---|---|---|
| low/fit | 60.1 / 60.1 | 60.1 / 60.1 | 0.32 → 0.35 | 37.5 = | 43.8 → 44.0 | 789 → 792 |
| low/harbour | 60.1 / 60.1 | 60.1 / 60.0 | 0.28 → 0.33 | 37.5 = | 42.3 → 43.5 | 788 → 792 |
| low/fleet | 21.7 / 22.8 | 25.8 / 23.6 | 0.49 → 0.49 | 37.5 = | 45.1 → 45.0 | 804 → 808 |
| low/fleetmax | 24.4 / 21.1 | 25.3 / 19.3 | 0.34 → 0.39 | 37.5 = | 45.5 → 46.2 | 804 → 808 |
| medium/fit | 15.6 / 14.1 | 14.5 / 12.2 | 0.69 → 0.82 | 96.6 = | 56.0 → 55.7 | 866 → 870 |
| medium/harbour | 13.9 / 14.0 | 15.1 / 13.2 | 0.60 → 0.57 | 96.6 = | 55.0 → 56.7 | 866 → 870 |
| medium/fleet | 12.4 / 12.9 | 11.8 / 12.2 | 0.61 → 0.78 | 96.6 = | 58.3 → 60.4 | 886 → 889 |
| medium/fleetmax | 11.9 / 12.8 | 12.9 / 12.1 | 0.74 → 0.69 | 96.6 = | 57.7 → 62.4 | 886 → 890 |
| high/fit | 12.3 / 12.0 | 12.9 / 12.9 | 0.62 → 0.55 | 98.9 = | 57.6 → 57.0 | 797 → 801 |
| high/harbour | 11.2 / 12.6 | 12.3 / 13.1 | 0.67 → 0.50 | 98.9 = | 58.2 → 57.4 | 797 → 801 |
| high/fleet | 10.0 / 10.2 | 10.4 / 11.0 | 0.69 → 0.60 | 98.9 = | 63.8 → 63.2 | 816 → 820 |
| high/fleetmax | 10.1 / 10.6 | 10.3 / 10.2 | 0.80 → 0.67 | 98.9 = | 61.2 → 61.3 | 816 → 820 |

Texture memory unchanged (the slip carts reuse existing sprites); 4 more objects (2 carts, 2 crates). FPS and
update time move both ways within the spread between two runs of the same build. JS heap: −0.6 to +2.1 MB in
most scenes, +4.7 MB in medium/fleetmax (one scene; heap readings depend on garbage-collection timing; not
confirmed as a real increase). Not measured on the emulator or on a real phone in this phase.

## 7. Remaining problems and risks

Outside the A scope, unchanged (not fixed):
1. The crane at slips 1–2 keeps working 0.5 s after its boat has cast off (its 1.2 s wind-down), the same as before.
2. The jetty carts at the loop berths are shared by two berths and are still on their trip after a boat
   leaves (up to about 2.4 s), the same as before (jetties are protected).
3. The west jetty cart route (y 22.55) passes the props at 3.6 / 5.0 / 6.6, x 22.45–22.5 (static check).
4. The unmoved fishbox stack at 6.6,22.45 is close to the haulers' quay → rest route in the static check;
   no hauler touched it in the dynamic runs.
5. The quay crate pile (x 11.1–12.9, y 22.2–22.46) touches the walkers' band (from the audit).
6. `Life.separate` and cars use the simulation's positions, while the drawn haulers are up to 0.25 s behind.
7. The stock piles redraw every 250 ms; together with the figure's delay a delivered box may appear in the pile
   up to about 0.23 s before the figure sets it down (measured, 4.3).
8. Rendering and the simulation share one `Math.random`. Any future drawing change that draws random numbers at
   a different moment changes the economy's random path (not its rules). The regression now catches this.
9. From the angle of the default camera the barrels at 19.4,23.55 are partly hidden behind the container stack.
10. Audit items still waiting for a decision: fish in transit lost on restart, simulation slows below 10 FPS,
    idle haulers commute to the HQ, haulers never go to the boats.

Not done: no APK, no emulator run, no real-device run for phase A.

## 8. Files

- `test-results/workers/regress-<n>.json`, `regress.json`, `regress-1-844x390-120s.json`,
  `regress-viewport.json` (measurement: 844×390 vs 200×100 first differ at 3 s, as explained in section 3)
- `decor-check.json`, `decor-dynamic.json`, `pose-sync.json`, `walk-anim.json`, `unload-show.json`,
  `save-compare.json`, `run-tests-dev.json`, `outer-save-dev.json`, `bench-*.json`, `bench.md`
- `media/quay-before.png`, `media/quay-after.png`: the quay at zoom 2.4, 40 s in (the forklift and the fishbox
  stack stood on the haulers' line; now at the pier edge)
- `media/workers-before-after.mp4` (stacked) and `media/workers-after.mp4`: 10 fps, real time; 10–130 s with
  all four slips in view (zoom 0.72: boats coming in, unloading by crane at slips 1–2 and by slip cart at
  slips 3–4), then 130–150 s close on the quay haulers (zoom 2.4). The two captures do not start from the
  same random state, so the boats are not at the same places at the same moment.
- `media/slipcart-slip3-frames.png`, `media/slipcart-slip4-frames.png`: full-resolution crops every 0.4 s
  (frames 280–348) around the two slip carts; `media/after-contact-sheet.png`: one frame every 10 s.
