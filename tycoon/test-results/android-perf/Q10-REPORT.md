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

**Not run.** After pushing `0f8006f`, a manual dispatch was attempted through the GitHub API
(`POST /actions/workflows/android-eco-perf.yml/dispatches`, ref `claude/clever-maxwell-tolun5`, inputs runs=3, warm-up 30, window 90, preset medium, `save-mid`) and was refused with
**404 Not Found**. `list_workflows` shows only "Build Android APK" and "pages-build-deployment": GitHub registers a `workflow_dispatch` workflow only once its file exists on the
**default branch** (`main`), and this one exists only on the feature branch. Pushing to `main` is outside this task's branch permission, so nothing else was tried.

| Item | State |
|---|---|
| Run id / status | none (not started) |
| Artifact `android-eco-perf-<run id>` | does not exist yet |
| Production APK workflow | not triggered by the push (latest run is still #44 of 2026-11-14) |

To start it (needs your decision, since it means putting the workflow file on `main`):

1. Put `.github/workflows/android-eco-perf.yml` on `main` (merge or cherry-pick that one file; it is manual-only and cannot run by itself).
2. Actions, "Android eco performance (manual)", Run workflow, **branch `claude/clever-maxwell-tolun5`** (the run uses the file and tools from the chosen ref), defaults runs=3, warm-up 30, window 90, preset medium, `save-mid`. Or:
   `gh workflow run android-eco-perf.yml --ref claude/clever-maxwell-tolun5 -f runs=3 -f duration=90 -f preset=medium -f save=save-mid`
3. About 50 minutes. Artifact `android-eco-perf-<run id>`: `out/REPORT.md`, `out/summary.json`, `out/device.json`, `out/driver.json`, `out/raw/run<N>-<mode>/` (`logcat-full.txt` with every raw frame interval, `probe-lines.txt`, `gfxinfo.txt`,
   `meminfo-*.txt`, `run.json`), `assets/manifest.json` (hashes of the exact pages measured), `protected.sha256` / `protected-after.sha256`, `analyze.log`.
4. If the first run fails on one of the unverified points in section 7, the failing step's log and the artifact (uploaded even on failure) say which; fix the tooling and re-run. Do not read a failed run's partial numbers as a result.

## 7. Open risks

1. **First real run may need a fix.** Unverified on Android: `am start --es page/query` into the patched `MainActivity`; `?query` on an `android_asset` URL; `run-as` listing after `pm clear`; `ps -A -o PID,NAME` and `/proc/<pid>/stat` as shell user (CPU is best effort and becomes `n/a`); the `Total PSS by process` format; Gradle accepting `from(...) { include ... }`.
2. **Emulator noise.** No GPU (`swiftshader_indirect`), shared CI machine: absolute numbers are not phone numbers; with 3 runs per mode the intervals are wide and a missing difference is weak evidence. Use `runs=5` for a firmer answer.
3. **Multiple comparisons:** about 24 metrics x 2 comparisons at 95 %; one or two "differs" marks are expected by chance (stated in the report).
4. **Probe overhead** (a rAF callback, two wrapper calls per frame, a seeded `Math.random`) is the same in all modes but is not in production. Absolute FPS is therefore slightly lower than the same page without the probe.
5. **Micro benchmark state drift:** `Sim.update` runs 4,000 steps per block without a reset; the paired design limits, not removes, the effect. In the Chromium self test the in-window `Sim.update` difference (about +0.05 ms) was far larger than the micro delta (about +0.3 µs); the two views can disagree, so neither is a conclusion on its own.
6. **JS heap** will probably be `n/a` on Android (quantized values).
7. **Action versions** use the same tags as `android-apk.yml` (`@v4`, `@v2`), not commit SHAs.
8. **M0 is not re-based.** The roadmap target "at most 0.5 FPS below M0 on the same preset" can be judged against BASE of this workflow, not against CI #44.
