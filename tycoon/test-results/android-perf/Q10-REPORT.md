# Q10: Android performance CI (infrastructure and pipeline check)

Date: 2026-11-15. Branch `claude/clever-maxwell-tolun5`, from `f5c1ca1` (T1.4). Scope: CI infrastructure and measurement tooling only.
No gameplay task was started (T1.5 waits for approval).

**No Android measurement exists yet.** This container has no KVM, no emulator and no adb. The workflow was written and checked locally; whether it
runs on a real emulator is shown only by a GitHub Actions run (status in section 6). This report contains **no Android FPS figure**.

## 1. What exists today (findings)

- The APK is built by `.github/workflows/android-apk.yml` with Gradle 8.9, AGP 8.5.2, Java 17, compileSdk 34, three flavors; the tycoon flavor packs
  `tycoon/index.html` as its only asset and loads `file:///android_asset/index.html` in a plain `WebView` (JS and DOM storage on, console lines forwarded to
  logcat tag `FishingTycoon`, immersive full screen). That workflow runs on **any push touching `android/**` or `tycoon/index.html`**, hides emulator failures
  with `continue-on-error` and commits `apk/*.apk` back to the branch. So nothing under `android/` may be edited for Q10; the new workflow works on a temporary copy.
- Earlier emulator numbers (`tycoon/test-results/android/`): API 34 google_apis x86_64, pixel_6, `swiftshader_indirect`, WebView 113.0.5672.136, 1080x2400 at 420 dpi.
  FPS was the game's own `actualFps` from the 5-second `PERF` log line (8.7-8.8 at high); `gfxinfo` and `meminfo` were read once at the end of a UI test script.
  Weaknesses: `meminfo` covers only the app process (the WebView renderer is not included), `heapMB` showed 42.6 on every line (quantized), the window was not defined.
- A dev HTML cannot run inside the existing APK: the page name is fixed and there is no way to pass `?eco=...`.

## 2. What was added (all new files; nothing existing was edited)

| File | Purpose |
|---|---|
| `.github/workflows/android-eco-perf.yml` | The manual workflow (section 3) |
| `tycoon/tools/android-perf/probe.js` | In-page probe, injected into the CI pages only |
| `tycoon/tools/android-perf/make-perf-pages.mjs` | Injects probe + start save into the two dev builds |
| `tycoon/tools/android-perf/make-perf-project.mjs` | Isolated, patched copy of `android/` (every replacement must match exactly once) |
| `tycoon/tools/android-perf/run-device.mjs` | On-device driver (adb) |
| `tycoon/tools/android-perf/logparse.mjs`, `analyze.mjs` | Log and dump parsers; statistics and `REPORT.md` |
| `tycoon/tools/android-perf/selftest/*` | Chromium + fake adb check of the whole pipeline (not Android) |
| `tycoon/tools/android-perf/README.md` | How to run, what is measured and from which source |
| `tycoon/test-results/android-perf/Q10-REPORT.md` | This report |
| `tycoon/HANDOFF.md` | Q10 section appended (documentation only) |

Not changed (checked by hash and `git diff`): `tycoon/index.html`, `.github/workflows/android-apk.yml`, everything under `android/`, `apk/`, `idle/`, `fishing/`,
`tycoon/src/**` (sim, core, main.js, eco, render, UI), `tycoon/build.mjs`, `tycoon/tests/**`, the T1.x reports.

## 3. How the workflow works

- Trigger: `workflow_dispatch` only (inputs: runs 3-6, warm-up, window, preset, `save-mid`/`save-max`). `permissions: contents: read`. Inputs go through `env`, are validated, never interpolated into shell.
  `actions/checkout` with `persist-credentials: false`; no push, no commit, no release; results only as artifact `android-eco-perf-<run id>`.
- It cannot trigger `android-apk.yml`: it pushes nothing, and the files it adds (`.github/workflows/android-eco-perf.yml`, `tycoon/tools/**`, `tycoon/test-results/android-perf/**`)
  match none of that workflow's path filters (`idle/**`, `fishing/**`, `tycoon/index.html`, `android/**`, `android/emulator-test.sh`, `android-apk.yml`).
- Steps: fingerprint protected files (`index.html`, `android-apk.yml`, all of `android/` and `apk/`); `npm ci --ignore-scripts`; check the fixture hashes; build `base.raw.html` and
  `eco.raw.html` with `BUILD_OUT` (so `index.html` is never written); inject probe and save; copy `android/` to `perf/android` and patch the copy (applicationId
  `az.fishing.tycoon.perf`, pages `base.html`/`eco.html`, `MainActivity` loads the page and query from the launch intent; AGP, Gradle, SDK levels unchanged); `gradle assembleTycoonDebug`;
  one emulator with the same options as `android-apk.yml`; `run-device.mjs`; then, always, `analyze.mjs`, the protected-file check (fails if anything tracked changed) and the artifact upload.
- Failure handling: no `continue-on-error` on the measurement; the driver exits 1 if any run has a problem; the analyzer exits 1 on any problem or missing runs; both still write their files and the
  artifact is uploaded with `if: always()`. The analyzer step uses `bash -eo pipefail` so `tee`/`tail` cannot hide its exit code.

## 4. Methodology (what a run measures)

Three modes in the same APK, emulator, preset and start save (fixture, SHA-256 checked): BASE (plain dev build), TRACKING (`?eco=species`), PRICING (`?eco=1`).
Each of N runs (default 3) starts the app after `am force-stop` + `pm clear`; the driver checks the result of `pm clear` and that no `app_webview` directory survived, and the page reports whether
`localStorage` was empty at boot. **A surviving save is a failed run.** Mode order rotates per run (ABC, BCA, CAB). Seeds: `Math.random` is replaced by a seeded generator, seed 1000 + run number, the same in every mode.
Per run: wait for the world, 30 s warm-up, 12 s gap (gfxinfo reset, meminfo and CPU snapshot), 90 s window, 25 s gap (gfxinfo, meminfo, CPU), then the micro benchmark.

Metrics and their source are in `tycoon/tools/android-perf/README.md`. The important ones:

- **FPS, frame-time median/P95/P99 and janky % come from `requestAnimationFrame` intervals logged inside the page.** `gfxinfo` is listed separately as the Android compositor's view, not as the JS frame rate.
- PSS is the sum of the app process and the WebView sandboxed renderer (from the full `dumpsys meminfo`), with the app process alone also shown.
- JS heap is shown only for runs whose samples move (>= 3 distinct values); otherwise `n/a`. Nothing is estimated.
- Eco adapter CPU: `Sim.update` ms per frame in the window, plus an interleaved on-device micro benchmark (eco off / tracking / prices, paired inside each run).
- Statistics: per mode mean, sd, min, max, CV; TRACKING - BASE and PRICING - BASE as difference of means with Welch 95 % intervals. The old M0 Android numbers are printed as history; **a direct comparison is never made** (different build, protocol and frame source).

## 5. Local verification (this container, headless Chromium, no Android)

| Check | Result |
|---|---|
| Workflow YAML | parses (PyYAML); `actionlint` 1.7.12 with shellcheck: **clean** (it flagged `ls` use in one step; fixed) |
| `shellcheck` on the self-test scripts | clean (after two fixes) |
| `node --check` on every script | pass |
| Build commands | `BUILD_OUT=... node build.mjs` and `ECO=1 BUILD_OUT=... node build.mjs` run; `index.html` hash unchanged afterwards |
| Pages open in all three modes | BASE: `__eco` absent; TRACKING: eco on, species true, price false; PRICING: eco on, species true, price true (checked by the driver in every run); start save seeded; preset medium; boats 4, workers 6 (`save-mid`) or 10 (`save-max`) |
| Perf project differs from `android/` only as intended | `diff` shows 3 lines in `app/build.gradle` and 1 statement in `MainActivity.java` |
| **Pipeline self test** (`selftest/run-selftest.sh`) | **15/15**: 3 runs x 3 modes through the real driver, parser and analyzer (exit 0, rotating order, n=3, frame source stated, M0 comparison refused); a surviving save fails the run and the job (exit 1, "state leak"); a page that never reports fails with a timeout and no FPS is given; no driver output makes the analyzer fail |
| `save-max` through the pipeline | 3/3 modes ok |
| Production unchanged | `index.html` SHA-256 `571a9877...610ff6` and `android-apk.yml` SHA-256 `016bc0c9...068f285` identical before and after; `git diff` over `android/ apk/ idle/ fishing/ tycoon/index.html tycoon/src tycoon/tests tycoon/build.mjs android-apk.yml` empty |

First self-test run: 14 of 15 checks passed; the one failure was a wrong `grep` pattern in the test (the report text was right). Fixed, whole test re-run: 15/15.

What the self test does **not** show: that the emulator, the Gradle build of the perf copy, `adb` commands on a real device, `dumpsys` parsing against real output, the WebView console bridge with `file:///android_asset/eco.html?...`
or the CPU/PSS collection work. Those are only known after an Actions run. The self test's numbers are Chromium numbers (fake `dumpsys` text) and are not included here.

## 6. GitHub Actions run

Workflow registered on `main` through [PR #1](https://github.com/B4yrm/Prism-Blast-P/pull/1) (squash `1bd9b5e`, workflow file only), then started with ref `claude/clever-maxwell-tolun5`
(head `6837523`): [run 43755355349](https://github.com/B4yrm/Prism-Blast-P/actions/runs/43755355349), inputs runs=3, warm-up 30, window 90, preset medium, `save-mid`.

**Conclusion: `failure`. This is the tooling's own verdict, not a crash:** 9 of 9 runs executed, **8 valid, 1 failed a check** (run 1 BASE, "state leak"). All build steps passed
(including the Gradle build of the perf copy, 40 s), the emulator booted (API 34 google_apis x86_64, WebView 113.0.5672.136, 1080x2400 at 420 dpi, 2 cores, 2.5 GB, multiprocess WebView), the analyzer
and the protected-file check ran (`protected files identical`, `tracked tree clean`), and the artifact was uploaded: **`android-eco-perf-43755355349`** (artifact id 14179575233, 1.25 MB, 80 files, 30 days).

What this section is based on: the job log. The artifact itself could not be downloaded from this sandbox (the network policy blocks the blob host, HTTP 403), so only the last 120 lines of the analyzer
output that the workflow prints (per-run table, difference table, micro benchmark, error table) were read. The per-mode means table and the raw files were not seen. Means below are computed
from the per-run table and agree with the difference table.

### Valid-run numbers (rAF frame source; BASE has n=2 because run 1 BASE is excluded)

| | BASE (n=2) | TRACKING (n=3) | PRICING (n=3) |
|---|---|---|---|
| FPS mean per run | 10.73, 10.81 | 10.69, 10.79, 10.66 | 10.62, 10.75, 10.78 |
| FPS mean of runs | 10.77 | 10.71 | 10.72 |
| frame time median / P95 / P99, ms | 100 (83.3 in one run) / 150 / 183.3 | 100 / 150 / 183.3 | 100 / 150 / 183.3 |
| janky frames (> 25 ms) | 97.0, 97.3 % | 97.3, 97.3, 97.6 % | 97.7, 97.6, 98.4 % |
| simulation time / real time | 0.992, 0.997 | 0.996, 0.992, 0.996 | 0.991, 0.993, 0.995 |
| JS / Android crashes, ECOERR | 0 | 0 | 0 |

Differences against BASE (Welch 95 %): FPS **-0.06 [-0.30, +0.18]** (TRACKING) and **-0.05 [-0.32, +0.22]** (PRICING), both "not distinguishable". Frame-time P95 and P99 identical;
jank +0.2 / +0.8 points (not distinguishable); simulation/real +0.000 / -0.002; JS time in `Sim.update` +0.25 ms [-0.19, +0.70] and +0.09 ms [-0.58, +0.77] (not distinguishable, intervals about 0.5 ms wide
against a 93 ms frame); scene update +0.23 / +0.16 ms (not distinguishable); process CPU -0.02 / -0.00 cores; gfxinfo janky % +0.3 / +0.1 (not distinguishable).
**The roadmap target "at most 0.5 FPS below the same preset without eco" is met within the 95 % interval** (the worst lower bound is -0.32), with the caveat of n=2 for BASE.

Micro benchmark on the device (paired inside each run, `Sim.update` per call): tracking minus off **+0.79 µs** (runs +0.69, +0.79, +0.90), prices minus off **+0.80 µs** (+0.71, +0.93, +0.76),
i.e. about 0.0008 ms per frame against the roadmap target of 0.02 ms (about 25 times below). The absolute values differ between pages (BASE page 3.61 µs, eco page with eco off 2.63 µs); only the paired deltas mean anything.

The game runs at **about 10.7 FPS in this emulator in every mode** (preset medium, save-mid); nearly every frame exceeds 25 ms. This is the software-GPU emulator, not a phone.

### What is not trustworthy or not known

1. **Run 1 BASE failed: "state leak: localStorage had data at boot (hadSave=true, keys=1) | start save was not seeded".** `pm clear` reported success and `run-as` showed no `app_webview`, yet the page saw a save at boot.
   The cause is **not known**. Hypothesis (unverified): in this first cold start the page was loaded twice and the analyzer kept the second `PROBE_BOOT` (it overwrites repeated lines). This run was also the slowest
   (8.80 FPS, 793 frames; it was excluded). The check did its job; the raw `logcat-full.txt` in the artifact decides.
2. **The PSS "app + WebView processes" figures (1.36 to 1.82 GB) must not be used.** They are implausible for a 2.5 GB emulator and rise with run order (1361, then 1547-1555, then about 1815), which does not follow the mode.
   Suspected causes (unverified): the parser also counts the same processes in the second section of the full `dumpsys meminfo` ("by OOM adjustment"), and/or sandboxed renderer processes of earlier runs survive `am force-stop`.
   The app-process-only PSS differences (-1.6 / -1.0 MB, not distinguishable) are measured correctly but exclude the renderer, so **no valid renderer-inclusive memory comparison exists yet**.
3. **JS heap is `n/a`** in every run (one distinct value, as predicted).
4. gfxinfo percentiles are coarse (150 ms bucket for the median) and read about 1 s after the window; they agree with the page's view (98.7-99.1 % janky) and are not an independent confirmation of anything else.
5. n=2 for BASE and n=3 for the others: absence of a difference is weak evidence; 24 metrics x 2 comparisons were tested, none marked "differs" in the visible part of the table.
6. M0 comparison: not performed. The emulator configuration (API 34, pixel_6 profile, WebView 113.0.5672.136, 1080x2400 at 420 dpi) now matches the old runs, but the build (production before workers phase A against dev builds with phase A and eco) and the protocol still differ.

### Proposed follow-up (not done; waiting for approval)

(a) keep the first and every `PROBE_BOOT` and report the boot count, so a double load is visible; (b) parse only the "Total PSS by process" section and, per run, kill leftover `sandboxed_process` processes
or list their pids before the window; (c) re-run with `runs=5`. These touch only `tycoon/tools/android-perf/`.

## 7. Open risks

1. **Resolved by run 43755355349:** the Gradle build, `am start --es page/query`, the `?query` on the asset URL, `run-as`, CPU and gfxinfo collection and the analyzer all worked on the emulator. **Still open:** the two problems in section 6. Originally listed as unverified: `am start --es page/query` into the patched `MainActivity`; `?query` on an `android_asset` URL; `run-as` listing after `pm clear`; `ps -A -o PID,NAME` and `/proc/<pid>/stat` as shell user (CPU is best effort and becomes `n/a`); the `Total PSS by process` format; Gradle accepting `from(...) { include ... }`.
2. **Emulator noise.** No GPU (`swiftshader_indirect`), shared CI machine: absolute numbers are not phone numbers; with 3 runs per mode the intervals are wide and a missing difference is weak evidence. Use `runs=5` for a firmer answer.
3. **Multiple comparisons:** about 24 metrics x 2 comparisons at 95 %; one or two "differs" marks are expected by chance (stated in the report).
4. **Probe overhead** (a rAF callback, two wrapper calls per frame, a seeded `Math.random`) is the same in all modes but is not in production. Absolute FPS is therefore slightly lower than the same page without the probe.
5. **Micro benchmark state drift:** `Sim.update` runs 4,000 steps per block without a reset; the paired design limits, not removes, the effect. In the Chromium self test the in-window `Sim.update` difference (about +0.05 ms) was far larger than the micro delta (about +0.3 µs); the two views can disagree, so neither is a conclusion on its own.
6. **JS heap** will probably be `n/a` on Android (quantized values).
7. **Action versions** use the same tags as `android-apk.yml` (`@v4`, `@v2`), not commit SHAs.
8. **M0 is not re-based.** The roadmap target "at most 0.5 FPS below M0 on the same preset" can be judged against BASE of this workflow, not against CI #44.
