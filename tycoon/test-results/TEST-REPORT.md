# Fishing Tycoon: APK test report

- **APK:** `apk/FishingTycoon.apk` (2.4 MB). It contains exactly `tycoon/index.html`, checked with `cmp`.
- **Code version:** commit `0a74c0b`.

## Summary

| Where | Status |
|---|---|
| A. Browser (headless Chromium) | 14/14 tests passed |
| B. Android emulator (CI) | All 8 checks passed, 0 crashes |
| C. Real phone | **Not tested** |

## A. Browser tests (headless Chromium, CPU slowed 4×, software GPU)

Run the suite with `node tycoon/tests/run-tests.cjs`. Results: 14/14 passed.

| Test | Result |
|---|---|
| UI elements overlap on 12 screen sizes (640×360 … 1280×720, portrait 360×640 … 768×1024) | No overlap, no horizontal scroll |
| Touch areas | Every control ≥ 40 px, most 44–56 px |
| Panels on 640×360 and 360×640: open, scroll, close; mission card | Pass |
| Drag, two-finger zoom, centre button, building tap | Pass |
| Double tap, **low** preset, 10 tries | 10/10 (an earlier run gave 9/10) |
| Double tap, **high** preset, 10 tries | 5/10 (see note 1) |
| Two slow taps (> 350 ms apart) | Do not zoom, as intended |
| Double tap on a building | The panel opens and stays open |
| Building labels around the zoom threshold | No flicker (≤ 1 switch) |
| Save → reload | Money, level, catch and upgrades unchanged |
| Save from the previous APK | Money, gems, level, buildings, upgrades, workers, missions, research and settings all kept |
| Offline earnings after 2 hours away | The "+$5.93K" window appears |
| Corrupt save | Starts fresh, no error |
| Simulation, 15 simulated minutes | Boat and worker go through every state; fish caught and sold; money earned |
| JS errors | None |

**Note 1.** At the high preset the software GPU needs about 200 ms per frame, so the browser delivers the test touches late. The real gap between the two taps then becomes 385–500 ms, so they are correctly treated as two separate taps. On a phone, an event's timestamp is the hardware touch time, so this artefact should not occur. That still needs checking on a real phone.

### Graphics presets (browser, 844×390 at DPR 2.75)

| Preset | Canvas | Textures | JS heap | Update per frame (CPU ×4 slower) |
|---|---|---|---|---|
| High | 1688×780 | 101.6 MB | 65 MB | 2.7 ms |
| Medium | 1266×585 | 88.7 MB | 51 MB | 1.8 ms |
| Low | 844×390 | 37.8 MB | 40 MB | 1.9 ms |

### Economy unchanged

`git diff b0a35e5` (the approved animation build), limited to `core/economy.js`, `sim/` and `data/defs.js`:

- simulation and economy code: **0 changed lines**;
- `defs.js`: only the icon names changed;
- `state.js`: only the default settings for new players (quality `auto`, mission card closed).

## B. Android emulator (GitHub Actions)

Environment: Android 14, Pixel 6 profile, 1080×2400 at 420 dpi, WebView 113, software GPU (swiftshader). Script: `android/emulator-test.sh`.

Each touch is aimed using the positions the game itself logs (UIPOS). Each step is confirmed by the game's own log line in logcat.

| Check | Result |
|---|---|
| App window vs. display cutout | Inset 127 px from the cutout. The UI is **not under the notch**. |
| Left menu opens / closes | PASS / PASS |
| Centre button | PASS |
| Dock button opens a panel; × closes it | PASS / PASS |
| Mission chip expands / collapses | PASS / PASS |
| Double tap (adb sends two taps; timing not exact) | Recognised 3/3 |
| Save/load after force-stop | PASS (see note 3) |
| Crashes | 0 |

**Memory:**
- total PSS 91 MB, Java heap 8 MB, Native heap 21 MB;
- JS heap 43 MB, textures 38 MB;
- the "Auto" preset chose "Low" on the emulator.

**FPS: 9–10 on the emulator.** The CI machine has no GPU, so the emulator draws in software. This number does **not** show real-phone performance.

**Note 2.** One screenshot taken after the restart shows two dock icons ("Tədqiqat", "Mağaza") as white blocks. It is unclear whether this is a capture artefact or a real rendering problem. It needs checking on a phone.

**Note 3.** The save/load check after force-stop ran on a fresh game, so it compared starting values (money 120, level 1). The cash-register amount was also kept across the restart. The browser test checks save/load with changed values.

## C. Real phone

**Nothing was tested on a real phone.** Please check:

1. smoothness (FPS) on High / Medium / Low;
2. two-finger zoom (adb cannot test this on the emulator);
3. double tap;
4. the HUD and left menu on a phone with a notch;
5. note 2: the dock icons after restarting the app.

If the game is slow, choose **Settings → Graphics → Low**.
