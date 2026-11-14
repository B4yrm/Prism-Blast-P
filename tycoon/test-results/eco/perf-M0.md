# Performance baseline M0 (T1.1)

Date: 2026-11-14. Branch `claude/clever-maxwell-tolun5`. Measurement point M0 of `docs/ROADMAP-28-DAYS.md` §1.

**Builds measured**

| Build | How | SHA-256 |
|---|---|---|
| `base` | `BUILD_OUT=.preview/base.html node build.mjs` at `87831c6` (before T1.1) | `8566e4e25306fc480ab28e2b159e894836f9fa22443f2646c5faab6d287a6be7` |
| `eco` | `ECO=1 BUILD_OUT=.preview/eco.html node build.mjs` (T1.1, every eco system off) | `a24df6e6dc2865dc44e2335476d3508801284a2eb2f02b276854e3dfe6e838bf` |
| `index.html` (production, not rebuilt, not used here) | committed file, unchanged | `571a987722b4616c4f4f65e5aee2ac2b8169193ef56c61024bc56c868f610ff6` |

Both measured builds contain workers phase A. The production `index.html` does not (HANDOFF.md), so its numbers are
not comparable with these.

## 1. Earlier Android emulator results (kept, not re-measured)

These come from CI runs of the production `index.html` **before** workers phase A. CI has no GPU (SwiftShader), so
they do not show real-phone performance.

| Source | Preset | FPS | Memory | Other |
|---|---|---|---|---|
| CI #44 (audit, `test-results/audit/WORKERS-AUDIT.md` §5) | Medium | 11.9 | total PSS 131 MB | — |
| CI #44 | High | 8.8 | | |
| Last emulator log, commit `9d73180` (`test-results/android/summary.txt`) | High | 8.7–8.8 | total PSS 130.5 MB, Java heap 8.6 MB, native heap 21.3 MB, JS heap 42.6 MB, textures 98.9 MB | 1,607 frames, 98.8 % janky, p50 150 ms, p90 250 ms |
| `test-results/TEST-REPORT.md` (earlier round, Auto → Low) | Low | 11–12 | total PSS 91 MB, JS heap 43 MB, textures 38 MB | — |

**No new Android measurement was made for T1.1.** This container has no emulator and no device. The CI emulator job
(`.github/workflows/android-apk.yml`) only starts when `tycoon/index.html` changes and commits the APK, so it cannot
measure a dev build without a production build or a workflow change. Both need your approval (roadmap Q10). The
workflow was not changed.

## 2. Browser benchmark (new, `tests/bench.cjs`)

Headless Chromium, software GPU (SwiftShader), 844×390 at DPR 2.75, 5 s per scene. Runs interleaved base → eco →
base → eco, with nothing else running. Raw data: `t1.1/bench-{base,eco}-run{1,2}.json`.

| scene | FPS base (1 / 2) | FPS eco (1 / 2) | frame p90 ms base → eco (run 1) | update ms base → eco (avg of 2) | draw calls | texture MB | heap MB base → eco (avg of 2) | objects |
|---|---|---|---|---|---|---|---|---|
| low/fit | 51.7 / 31.3 | 37.7 / 48.9 | 33.3 → 50 | 0.41 → 0.40 | 1.3 → 1.6 | 37.5 → 37.5 | 43.6 → 43.0 | 792 → 792 |
| low/harbour | 60.2 / 60.1 | 60.1 / 60.1 | 16.7 → 16.7 | 0.35 → 0.41 | 1.1 → 1.1 | 37.5 → 37.5 | 43.3 → 43.1 | 792 → 792 |
| low/fleet | 20.4 / 19 | 17.9 / 18.1 | 100 → 100.1 | 0.56 → 0.73 | 2.2 → 2.6 | 37.5 → 37.5 | 45.8 → 46.8 | 808 → 808 |
| low/fleetmax | 19.7 / 20.2 | 19.3 / 17.8 | 116.6 → 116.6 | 0.53 → 0.37 | 2.4 → 2.4 | 37.5 → 37.5 | 44.8 → 46.0 | 808 → 808 |
| medium/fit | 13.2 / 11.5 | 10.5 / 12.1 | 133.3 → 183.2 | 0.70 → 0.81 | 5 → 5 | 96.6 → 96.6 | 56.8 → 57.3 | 870 → 870 |
| medium/harbour | 12.6 / 11.5 | 11.3 / 12.2 | 150 → 183.3 | 0.69 → 0.73 | 5 → 5 | 96.6 → 96.6 | 56.1 → 56.5 | 870 → 870 |
| medium/fleet | 10.1 / 11.3 | 10.4 / 9.2 | 150 → 149.9 | 0.87 → 0.84 | 5 → 5 | 96.6 → 96.6 | 59.6 → 58.9 | 889 → 890 |
| medium/fleetmax | 10.7 / 10.6 | 9.6 / 10.3 | 150 → 183.4 | 0.56 → 0.74 | 5 → 5 | 96.6 → 96.6 | 60.8 → 58.3 | 889 → 890 |
| high/fit | 9.6 / 9.9 | 9.6 / 9.7 | 199.9 → 183.3 | 0.73 → 0.77 | 5 → 5 | 98.9 → 98.9 | 58.5 → 57.2 | 801 → 801 |
| high/harbour | 8.8 / 10.4 | 7.5 / 8.8 | 200 → 233.4 | 0.66 → 0.74 | 5 → 5 | 98.9 → 98.9 | 58.7 → 59.3 | 801 → 801 |
| high/fleet | 8.8 / 9.6 | 7.9 / 9 | 183.3 → 199.9 | 0.64 → 0.65 | 5 → 5 | 98.9 → 98.9 | 62.5 → 62.8 | 820 → 820 |
| high/fleetmax | 8.9 / 8.5 | 8.4 / 9.5 | 183.4 → 199.9 | 0.52 → 0.51 | 5 → 5 | 98.9 → 98.9 | 63.1 → 65.6 | 821 → 821 |

**Reading:**
- The **run-to-run noise is larger than any difference** between the builds. The same base build scored 51.7 and
  31.3 FPS on low/fit, and base/eco ranges overlap in every scene. These numbers cannot show whether T1.1 costs
  FPS. The microbenchmark below can.
- Texture memory and draw calls are the same in both builds. Display-list objects vary by ±1–2 in the fleet scenes
  in both builds (medium/fleetmax: base 889 / 890, eco 890 / 891), depending on what is on screen at the moment of
  sampling. This is not caused by eco: the eco layer creates no objects.
- This machine runs slower than the one used for workers phase A (e.g. medium/fit 15.6/14.1 FPS there, 13.2/11.5
  here for the same base code: `test-results/workers/bench.md`). Compare only runs taken on the same machine at the same time.
- Heap differences of ±2.5 MB in both directions are GC timing (same as the phase A finding).

## 3. Cost of the eco layer itself (new, `tests/eco/micro-overhead.cjs`)

Node 22, the real `Sim` and `stat` modules, mid save (4 boats, 6 haulers, factory). Plain versus the adapter installed
with eco off, interleaved, 7 rounds, median. Raw data: `t1.1/micro-overhead.json`.

| Measure | plain | eco installed (off) |
|---|---|---|
| 18,000 `Sim.update` calls (600 s at 30 FPS) | 74.6 ms | 78.0 ms |
| per `Sim.update` | 4.15 µs | 4.33 µs |
| 2,000,000 wrapped `stat` calls | 194.6 ms | 193.7 ms |

A second run gave the opposite order (sim 84.6 vs 77.4 ms, stat 196.3 vs 211.7 ms), so the difference is within
noise: **at most about 0.2–0.4 µs a frame.** At 9–12 FPS one frame takes 80–110 ms, so the eco layer in T1.1 costs well
under 0.001 % of a frame. This meets the roadmap target (`eco.tick` ≤ 0.02 ms a frame, architecture §11).

## 4. Targets for later measurement points (unchanged from the roadmap)

- Emulator: at most 0.5 FPS below M0 on the same preset. M0 for the emulator is still the old CI #44 value until a dev-build
  emulator run is approved (Q10).
- Heap at most +3 MB; `eco.tick` at most 0.02 ms a frame; no DOM writes from eco while its panels are closed.
- Browser benchmark: always run base and the new build interleaved, at least twice each, machine idle.
