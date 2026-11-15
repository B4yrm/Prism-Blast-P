# Fishing Tycoon — handoff notes

Status as of workers phase A (branch `claude/clever-maxwell-tolun5`). Details and numbers:
`test-results/workers/PHASE-A-REPORT.md`; audit: `test-results/audit/WORKERS-AUDIT.md`.

## Workers phase A — state

- **Conditionally accepted.** Browser regression passed (same seed, 6/6 scenarios identical; save/load 4/4
  identical; project suite 15/15). **Android is not confirmed**: no emulator or real-device run for phase A.
- Dev build only: `.preview/dev.html`. `tycoon/index.html` and `apk/FishingTycoon.apk` are **not** rebuilt and
  do not contain phase A. Building them needs an explicit go-ahead; CI builds the APK from `tycoon/index.html`.
- Commits: `97f4ac2` (code, WIP), `8b28e2e` (tests), `118dd87` (fixes, harness, results, report), `f6716fc`
  (media, report). The comparison baseline is `index.html` at `dc2ed9c`.
- **Accepted visual exception:** the `POSE_MIN = 0.32 s` requirement is not fully met. `LAG_MAX` stays 0.25 s, so
  at the high warehouse level the pick/drop pose shows 0.217–0.267 s (before: 0.05–0.067 s). This is recorded as
  an accepted exception, not a passed test; the check in `tests/pose-sync.cjs` is unchanged.

## Remaining risks

1. **No Android verification of phase A.** The walk-cycle rate, replay layer and slip carts were only measured in
   headless Chromium with a software GPU. On phones (about 8–12 FPS in the last emulator run) the replay catch-up
   and the 0.25 s delay may look different; needs an emulator and, separately, a real-device run.
2. **Render and simulation share one `Math.random`.** A rendering change that draws random numbers at a
   different moment shifts the economy's random path (not its rules). Phase A hit this once (the look-around
   timer) and the regression caught it. Keep `tests/workers-regress.cjs` in the loop for any render change.
3. **Visual delay vs. other render code.** Drawn haulers are up to 0.25 s behind the simulation; `Life.separate`
   and the cars use simulation positions; the stock piles redraw every 250 ms, so a delivered box can appear in
   the pile up to about 0.23 s before the figure sets it down (measured).
4. **Test determinism depends on the harness** (seeded start before `create`, scene step frozen until stepped,
   `loop.delta` set per step, fixed clock start, small 200×100 viewport). Before/after must always use the same
   viewport; 844×390 and 200×100 draw different random streams.
5. **JS heap:** +4.7 MB in one benchmark scene (medium/fleetmax); not confirmed as a real increase (GC timing).
6. Unmoved quay items near walkers/carts: the quay crate pile (x 11.1–12.9, y 22.2–22.46) touches the walkers'
   band; the west jetty cart route (y 22.55) passes the props at x 3.6 / 5.0 / 6.6; the fishbox stack at
   (6.6, 22.45) is close to the quay → rest route. No hauler touched them in the dynamic runs.
7. Old behaviour left as it was (jetties and boat routes are protected): the cranes at slips 1–2 keep working
   0.5 s after their boat has cast off; the jetty carts at the loop berths are shared by two berths and are
   still on their trip up to about 2.4 s after a boat leaves.
8. Barrels at (19.4, 23.55) are partly hidden behind the container stack from the default camera angle.

## Audit findings still waiting for a decision (not touched)

Fish in transit are lost on restart; the simulation slows below 10 FPS; idle haulers commute to the HQ; haulers
never go to the boats. See `test-results/audit/WORKERS-AUDIT.md`.

## Visual polish backlog

- **Option C for the pick/drop pose:** start the bend slightly before the hauler arrives, using the simulation's
  recorded states (no extra delay). Would reach the 0.32 s pose without raising `LAG_MAX`. New code; needs its
  own tests (`tests/pose-sync.cjs` has the check) and a before/after regression.
- Move or remove the unmoved quay props listed in risk 6 if they ever show contact on screen.

## Not started / out of scope until decided

Phase B and later worker phases, new economic systems, APK and production build, Android emulator or device
verification of phase A. Untouched by phase A: `src/sim/*`, `src/core/*` (economy, save/load, offline income),
boat routes and approved berths, multi-sea system, Stage 2 branch, Balıqçı Idle (`fishing/`).

## Eco layer — T1.1 (skeleton) state

- Plan and design: `docs/FISHING-TYCOON-GDD-V1.md`, `docs/ROADMAP-28-DAYS.md`, `docs/ECONOMY-ARCHITECTURE.md`.
- T1.1 done: `src/eco/` (adapter, rng, clock, index), `src/main-eco.js`, `ECO=1` in `build.mjs` (dev only, needs `BUILD_OUT`).
  Every eco system is off; nothing in the economy, save or offline earnings changes. The build without `ECO` is byte-identical
  to before. Report: `test-results/eco/T1.1-REPORT.md`; baseline: `test-results/eco/perf-M0.md`.
- T1.2 done: `src/eco/state-eco.js` (S.eco schema v1, own version; main `SAVE_VERSION` still 1), initialised once on
  `worldReady`. Save matrix 71/71, including rollback to the production `index.html`: S.eco survives value for value.
  A future `S.eco.v` is left untouched and eco stays off. Report: `test-results/eco/T1.2-REPORT.md`.
  Known: `tests/save-compare.cjs` now lists exactly one expected difference (the new `eco` key); `tests/boat-sync.cjs`
  timing checks are flaky on this machine (the unchanged base build also fails them).
- T1.3 done: species tracking (sardine, mackerel, sea bass, salmon, tuna) in `src/eco/species.js`, fed by read-only observers of the four
  `Sim` methods that write `S.stock` (in `adapter.js`). Eco is **off by default**; dev builds switch it on with `?eco=1` or `__eco.setOn(true)`.
  Nothing in `src/sim`, `src/core`, `src/main.js`, `src/render`, the UI or the production build changed. New field `S.eco.omix` (no version bump).
  Exact moves, average-mix moves, assumptions and tests: `test-results/eco/T1.3-REPORT.md`. Catch weights for harbor tiers 2 and 3 are placeholders.
  Known: `tests/boat-sync.cjs` timing checks are noisy (base fails them too); `tests/eco/boat-visual-identity.cjs` is the deterministic check that the boats are drawn identically.
- T1.4 done: species base prices (`src/eco/price.js`): with eco on, `stat.rawPrice()` × one factor = value(shelf mix) / value(start mix),
  limited to [0.4, 2.5]; start mix ×1.000, sardine ×0.764, mackerel ×1.146, sea bass ×1.783, salmon and tuna ×2.5 (limited). Outside a sale
  (steadyRate, shop, UI) the expected catch mix of the harbor tier is used. Products keep their price. Offline at load is unchanged (computed
  before eco switches on). Balance: `tools/balance-sim.mjs` (start mix +0.6 % over 600 s × 8 seeds). Dev switches: `?eco=1` (tracking + prices),
  `?eco=species` (tracking only). Report: `test-results/eco/T1.4-REPORT.md`. Open: tier 2/3 weights make fresh fish worth ×1.14 / ×1.39.

## Q10 — Android performance CI (infrastructure, no Android result yet)

- Added `.github/workflows/android-eco-perf.yml` (manual `workflow_dispatch` only, `contents: read`, artifact only) and `tools/android-perf/` (probe, page and project
  generators, on-device driver, analyzer, Chromium + fake-adb self test, README). It measures BASE / TRACKING (`?eco=species`) / PRICING (`?eco=1`) dev builds, 3+ runs each,
  app data cleared before every run; a surviving save fails the run. FPS comes from page `requestAnimationFrame` intervals; `gfxinfo` is listed separately.
- It builds a perf APK from a temporary **copy** of `android/` (applicationId `az.fishing.tycoon.perf`). Nothing under `android/`, `tycoon/index.html`, `apk/` or `android-apk.yml`
  was changed (hash-checked). Do not edit `android/**` or `tycoon/index.html` for perf work: that triggers the production APK workflow, which commits APKs.
- Local checks: actionlint clean, self test 15/15. **Not verified on Android:** the first Actions run decides. Report: `test-results/android-perf/Q10-REPORT.md`; how to run: `tools/android-perf/README.md`.
- Self test: `cd tycoon && npm ci && bash tools/android-perf/selftest/run-selftest.sh /tmp/q10-selftest` (Chromium numbers, never quote as Android).
- Waiting for approval before T1.5.

## Where things are

- Tests: `tests/workers-regress.cjs`, `pose-sync.cjs`, `walk-anim.cjs`, `decor-check.cjs`, `decor-dynamic.cjs`,
  `unload-show.cjs`, `save-compare.cjs` (results in `test-results/workers/`).
- Dev build: `BUILD_OUT=.preview/dev.html node build.mjs`.
