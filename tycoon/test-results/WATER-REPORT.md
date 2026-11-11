# Graphics phase 1: water and shore. Test report

**Scope:** visual changes only. Untouched: boat movement logic, the economy, missions, save/load, the multi-sea system, the Stage 2 backup and Balıqçı Idle.

## What changed

The water is drawn from one shared "distance to shore" field, computed from the land and the surf rocks.

| Preset | Water rendering |
|---|---|
| **High** | WebGL shader: depth-based colour (shallow turquoise → deep blue), two long swells plus two layers of small chop, soft sky light, sun glitter in patches, light patterns on the shallow sand, a broken foam line along the shore and round the rocks, and wash lines rolling in |
| **Medium** | No shader: a depth-gradient image, 3 moving wave layers, foam strips that wash in and out, foam rings round rocks, sun glints |
| **Low** | Depth-gradient image, 2 wave layers, a static foam line |

- **Fallback:** if the shader cannot be created (no WebGL, compile error), the game draws the Medium version instead.
- **Boat wakes:** the dotted wake is replaced by a V-shaped (Kelvin) wake that starts at the stern of the hull. It has two arms that spread out and fade, plus a churned strip in the middle. Arm length and fade time depend on the preset.
- **Open sea beyond the map edge:** deep blue on every preset.

## Performance before / after

Script: `tycoon/tests/bench.cjs`. Headless Chromium with a software GPU, 844×390 at DPR 2.75, 5 s per scene. Both runs used the same two scenes: the opening view and a close-up of the harbour.

| Preset/scene | FPS | Frame time p90 (ms) | Update (ms) | Draw calls/frame | Textures (MB) | JS heap (MB) |
|---|---|---|---|---|---|---|
| low/fit | 58.1 → **54.5** | 16.7 → 16.8 | 0.21 → 0.32 | 1.2 → 1.3 | 37.8 → 35.7 | 41.5 → 41.4 |
| low/harbour | 59.9 → **60.1** | 16.7 → 16.7 | 0.2 → 0.23 | 1.2 → 1.1 | 37.8 → 35.7 | 41.4 → 39.7 |
| medium/fit | 16.1 → **14.7** | 116.6 → 116.7 | 0.41 → 0.44 | 5 → 5 | 88.7 → 89.2 | 51.9 → 52.9 |
| medium/harbour | 15.9 → **14.3** | 116.6 → 116.6 | 0.29 → 0.45 | 5 → 5 | 88.7 → 89.2 | 54.1 → 52.6 |
| high/fit | 9.9 → **8.3** | 183.3 → 216.6 | 0.45 → 0.46 | 5 → 5 | 101.6 → 91.5 | 65.6 → 55.1 |
| high/harbour | 9.8 → **8.4** | 166.7 → 200.1 | 0.39 → 0.44 | 5 → 5 | 101.6 → 91.5 | 66.7 → 56.7 |

**Reading the numbers:**
- Low: the same 54–60 FPS; textures dropped by 2 MB.
- Medium: about 9 % slower in this software renderer.
- High: about 16 % slower, because the shader computes every water pixel on the CPU here. On a phone the GPU does this work, so the impact should be much smaller, **but it has not been measured on a real phone.**
- On High, textures fell by 10 MB and JS heap by about 10 MB, because the large wave tiles are no longer used.

## Tests

- **Browser suite:** **15/15** passed: layout, touch (double tap 10/10 on Low), real play → close → reopen with all 13 fields equal, old-save compatibility, offline earnings, simulation, presets.
- **Android 14 emulator (CI):**
  - every touch and save/load check passed, 0 crashes;
  - Medium preset: `water mode=layers`;
  - High preset: `water mode=shader`, so **the shader compiles and runs in the Android WebView**;
  - emulator FPS (software GPU, not indicative): Medium 12.6, High 8.0.
- **Real phone:** **not tested.** On a real phone, check FPS on High, how natural the sea looks, and whether wakes and foam are distracting.

## Files

- Screenshots: `test-results/water/`
- Emulator screenshots: `test-results/android/water-medium.png` and `water-high.png`
- Benchmark results: `test-results/bench-before-water.json` and `bench-after-water.json`
