# Fishing Tycoon: final APK test report

- **APK:** `apk/FishingTycoon.apk`. It contains exactly `tycoon/index.html` (game code `406caf6`), checked with `cmp`.
- **Stage 2 backup:** the unfinished Stage 2 code is kept on branch `claude/stage2-wip-backup`. It is not merged and is not being developed.

| Where | Status |
|---|---|
| A. Browser (headless Chromium) | 15/15 passed |
| B. Android emulator (CI) | Every check passed, 0 crashes |
| C. Real phone | **Not tested** |

## A. Browser tests (headless Chromium, CPU slowed 4×, software GPU)

Run the suite with `node tycoon/tests/run-tests.cjs`. Results: **15/15 passed.**

| Test | Result |
|---|---|
| UI elements overlap on 12 screen sizes | None |
| Touch areas | ≥ 40 px |
| Panels on 640×360 and 360×640 | Open, scroll and close work |
| Drag, two-finger zoom, centre button, building tap | Pass |
| Double tap, **low** preset | 10/10 |
| Double tap, **high** preset | 5/10 (see known issue 1) |
| Two slow taps / double tap on a building | Do not zoom / the panel stays open |
| Labels at the zoom threshold | No flicker |
| **Real play → close → reopen** (collect cash, 2 upgrades, hire a worker, level 3) | **All 13 progress fields equal** |
| Save → reload; save from the previous APK; corrupt save | Pass |
| Offline earnings (2 h) | The window appears |
| Simulation (15 simulated minutes); JS errors | Pass; none |

**Economy unchanged:** since the approved animation build `b0a35e5`, the simulation and economy code has **0 changed lines**. In `defs.js` only the icon names changed.

## B. Android emulator (GitHub Actions)

Environment: Android 14, Pixel 6 profile, 1080×2400 at 420 dpi, WebView 113, software GPU. Script: `android/emulator-test.sh`.

Each touch is aimed using the positions the game logs (UIPOS) plus the window offset. Each step is confirmed by the game's own log line.

| Check | Result |
|---|---|
| Display cutout | The app window sits 127 px away from the cutout. The UI is **not under the notch**. |
| Left menu open / close | PASS / PASS |
| Centre button | PASS |
| Dock → panel; panel × button | PASS / PASS |
| Mission chip expand / collapse | PASS / PASS |
| "Topla" (collect) button | PASS |
| Double tap (two adb taps; timing not exact) | Recognised 3/3 |
| **Real play** (collect + 2 upgrades) → HOME → force-stop → restart | **PASS: all 13 fields equal.** Before and after: money 214, cash register 72, gems 15, level 2, XP 42, upgrades 2-0-0-0-0, 76 fish caught, 58 sold |
| Dock icons after the 1st and 2nd restart | Drawn correctly (white blocks no longer appear) |
| Crashes | 0 |

**Memory:**
- total PSS 91 MB, Java heap 8 MB, Native heap 21 MB;
- JS heap 43 MB, textures 38 MB;
- the "Auto" preset chose "Low" on the emulator.

**FPS: 11–12 on the emulator.** The CI machine has no GPU, so this does **not** show real-phone performance.

## Fixes in this round

1. **Dock icons ("Tədqiqat", "Mağaza" and others).**
   - *Problem:* after a restart, inline-SVG stroke paths were drawn as white blocks in the Android WebView.
   - *Fix:* icons are now shown as `<img>` (data-URI SVG), and the glass panels no longer use `backdrop-filter`.
   - *Status:* correct on the emulator after two restarts. Not yet checked on a real phone.
2. **Touch input.** Gestures moved to native Pointer Events, with each finger tracked by its pointerId.
3. **Accidental close.** A double tap on a building no longer closes the panel it just opened.
4. **Progress fingerprint.** On save (SAVED) and load (LOADED) the game logs a progress snapshot, so tests can prove nothing was lost.

## Known issues (not counted as solved)

1. **Double tap at the "High" graphics preset** (not fully solved; still needs a real-device test).
   - *Browser test:* 10/10 at the low preset, 5/10 at the high preset.
   - *Cause found:* at the high preset the software GPU needs about 200 ms per frame, so the browser delivers the test touches late. The measured gap between the two taps grows from 80 ms to 385–500 ms and they are treated as separate taps.
   - *What changed:* the game now measures the gap from the event's own timestamp (finger up → next finger down, < 350 ms). On a phone that timestamp is the hardware touch time, so the problem is expected to disappear. **This is not verified.**
   - *Emulator:* adb cannot send two taps with exact timing, so the emulator's 3/3 is not proof either.
   - *Fallback:* if double tap still fails on a phone at the high preset, the player can still zoom with two fingers and the centre button.
2. **Two-finger zoom on a device.** adb cannot test it on the emulator. It is tested only in the browser.

## C. Real phone

**Nothing was tested on a real phone.** Please check:
- FPS at each preset;
- two-finger zoom;
- double tap, especially at the "High" preset;
- the UI on a phone with a notch;
- the dock icons after closing and reopening the app;
- that progress is kept after the app is closed and reopened.
