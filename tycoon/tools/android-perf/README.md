# Q10: Android emulator performance (BASE / TRACKING / PRICING)

Workflow: `.github/workflows/android-eco-perf.yml`, **manual only** (`workflow_dispatch`). It measures the *development*
builds, never the production page. It commits nothing, pushes nothing, writes only the Actions artifact
`android-eco-perf-<run id>`.

## Start it

**Prerequisite:** GitHub only offers (and accepts API dispatch for) a `workflow_dispatch` workflow whose file is on the default branch. Until `.github/workflows/android-eco-perf.yml`
is on `main`, dispatch answers 404 (seen on 2026-11-15). The run itself uses the workflow file and tools of the branch you pick.

GitHub: Actions, "Android eco performance (manual)", Run workflow on branch `claude/clever-maxwell-tolun5`.
Inputs: `runs` (3-6, default 3), `warmup` (s, default 30), `duration` (s, default 90), `preset` (default medium), `save`
(`save-mid` default, from `tycoon/tests/fixtures`). With `gh`:

```bash
gh workflow run android-eco-perf.yml --ref claude/clever-maxwell-tolun5 -f runs=3 -f duration=90 -f preset=medium -f save=save-mid
```

Expected time: about 10 min build and emulator boot, then about 4 min per run, so about 50 min for 3 runs x 3 modes.

## What the workflow does

1. Builds `base.raw.html` (`BUILD_OUT=... node build.mjs`) and `eco.raw.html` (`ECO=1 BUILD_OUT=... node build.mjs`). `tycoon/index.html` is never written.
2. `make-perf-pages.mjs` injects the probe (`probe.js`) and the start save (a fixture, hash checked) into both pages.
3. `make-perf-project.mjs` copies `android/` to `$PERF/android` and patches the **copy** (applicationId `az.fishing.tycoon.perf`; pages `base.html` and `eco.html`
   instead of `../tycoon/index.html`; `MainActivity` loads the page and query given by the launch intent). Gradle 8.9, AGP 8.5.2, Java 17, compileSdk 34 as in production.
4. Builds one perf APK, starts one emulator (API 34, google_apis, x86_64, pixel_6, swiftshader_indirect, same options as `android-apk.yml`).
5. `run-device.mjs`: for each run 1..N and each mode (order rotates: ABC, BCA, CAB) it force-stops and **clears the app data** (`pm clear`), verifies nothing survived,
   starts the page, follows the probe in logcat, takes `gfxinfo` / `meminfo` / CPU times around the window, and checks crashes and JS errors.
6. `analyze.mjs` writes `REPORT.md` and `summary.json`; then the protected files are checked again and the artifact is uploaded (`if: always()`).

## Modes

| mode | page | address query | eco state the driver verifies |
|---|---|---|---|
| BASE | `base.html` (plain build) | none | `window.__eco` absent |
| TRACKING | `eco.html` (ECO=1) | `eco=species` | on, species true, price false |
| PRICING | `eco.html` (ECO=1) | `eco=1` | on, species true, price true |

All pages also get `mode=`, `run=` and `seed=` (seed = 1000 + run number, same in every mode). The probe replaces `Math.random` with a seeded generator and
seeds the same start save into an empty `localStorage`. If `localStorage` is **not** empty at boot (a save or cache survived), the run is marked FAILED ("state leak").

## What is measured, and from which source

| quantity | source | note |
|---|---|---|
| FPS mean / median, frame time median / P95 / P99, janky %, slow % | `requestAnimationFrame` intervals logged inside the page | raw intervals are in the artifact (`logcat-full.txt`, `PROBE_RAW` lines); the analyzer recomputes everything from them |
| scene steps per second, JS ms per frame in the scene update and in `Sim.update` | wrapper around `sys.sceneUpdate` and `sim.update` in the page | constant probe overhead, same in all modes |
| simulation time / real time | sum of the `dt` given to `Sim.update` over the window / window time | below 1 when the game runs under 10 FPS (the game clamps dt to 0.1 s) |
| PSS | `dumpsys meminfo <pkg>` (app process) and the full `dumpsys meminfo` (app + WebView/sandboxed processes), start and end of the window | the app process alone does not contain the renderer |
| JS heap | `performance.memory.usedJSHeapSize` every 5 s | **used only if the values move** (at least 3 distinct values per run); WebView quantizes it, the old PERF logs showed 42.6 MB constantly |
| gfxinfo janky % and percentiles | `dumpsys gfxinfo <pkg>` read within about 1 s after the window (reset at its start) | the Android window compositor's view, **not** the page's JS frame rate |
| process CPU | `/proc/<pid>/stat` of the app and WebView processes | best effort |
| eco adapter CPU | (a) `Sim.update` ms per frame in the window, (b) micro benchmark after the window: interleaved eco off / tracking / prices blocks in the ECO pages | (b) paired inside each run |
| JS exceptions, crashes | `ERR` / `ECOERR` lines, probe error counter, `FATAL EXCEPTION` / ANR / process death in the full logcat | any of them fails the run |

If a number could not be measured reliably it appears as `n/a`. No value is estimated.

## Evidence the driver keeps (added after the first CI run)

- **Every `PROBE_BOOT`** of a run with logcat pid and time; the clean-start check applies to the **first** boot only. A second boot is a failure of its own ("page booted N times"),
  described as a second load inside the same run when the later boots find the save the first boot seeded. `logcat -b events` is kept too (`am_create_activity` / `am_destroy_activity` /
  `am_relaunch_activity`), so an activity re-creation shows as such.
- **A discarded warm-up launch** runs once before run 1 with the same checks. It is not in any statistic; its findings are reported as an observation. It exists because the first start of an app after the emulator boots
  is not representative; no check of the measured runs is relaxed.
- **Leftover renderer processes** (`sandboxed_process`) are looked for before every run. If any survive `am force-stop`, the WebView provider package is force-stopped (kills only its own service processes);
  what was found and done is recorded; if something still survives, the run is failed and not measured.
- **Memory** is one `dumpsys meminfo <pid>` per process of the run (app, renderer), reported separately and summed. The full dump is read only from its "Total PSS by process" section with duplicate pids dropped and
  shown as a cross-check. A total above 80 % of the device RAM is rejected as implausible; a multiprocess WebView with no renderer process found is reported as a problem.
- The analyzer's whole report is printed in the job log (the artifact is not always reachable).

## Comparison rules

Per mode: mean, standard deviation, min, max, CV over the valid runs. TRACKING - BASE and PRICING - BASE: difference of means with a Welch 95 % interval
(small-sample t values); "not distinguishable" means smaller than the run-to-run noise, not zero. The old M0 Android numbers
(`tycoon/test-results/android/`, production page before workers phase A) are printed as history only; a direct FPS comparison is never made (different build,
protocol and frame source).

## Files

`probe.js` (in-page probe), `make-perf-pages.mjs`, `make-perf-project.mjs`, `run-device.mjs` (on-device driver), `logparse.mjs`, `analyze.mjs`,
`selftest/` (Chromium + fake adb check of the pipeline, **not** Android).

## Self test (no Android)

```bash
cd tycoon && npm ci && bash tools/android-perf/selftest/run-selftest.sh /tmp/q10-selftest
```

It runs the real pages in headless Chromium with a fake `adb`: a happy path with 3 runs per mode (analyzer exit 0, rotating order, n=3 in the report) and three
failure paths that must fail (a save that survives `pm clear`, a page that never reports, no driver output). Its numbers are Chromium numbers and must never be
quoted as Android results.
