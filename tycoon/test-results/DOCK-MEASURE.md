# Elastic window: measurement (no game code changed)

Script: `tests/dock-measure.cjs` → `test-results/dock-measure.json`. The simulation is stepped alone at 30 FPS with a seeded random, 10 minutes per scenario. Browser only; nothing here was run on a phone or on the emulator.

## How the simulation keeps a boat at its berth (`src/sim/sim.js`, read only)

- Unloading always takes 2.5 s, whatever the hold size: the rate is hold / 2.5 per second.
- Then a fixed 1.2 s wait, and the boat leaves. **The shortest stay is 3.7 s at every level.**
- A stay is longer only while the quay is full ("iskələ dolub!"). Then it lasts until the workers have made room: 10 s to several minutes in these runs.
- The quay holds 120 fish at harbour tier 3. With the hold at 30 a boat brings 100 (145 with the nets research), so a full quay is the normal case there. With a small hold and a strong economy it never happens.

## Results

"Visual trip at the cap" is an **estimate**: the game's own motion model on the real routes with the cruise limited to 5 tiles/s (lower figure) and 4.4 tiles/s (upper figure; 5 tiles/s cannot be held at 90°/s in turns of radius 2.8). "Visual late" = visual trip − 0.55 s head start − simulation trip. "Moored before next trip" = stay − late − 0.55 s; negative means the boat would still be at sea when the simulation leaves again.

| Scenario | Trips | Sim trip (s) | Stay at berth: min / median / p90 (s) | Stays at the 3.7 s minimum | Stays with a full quay | Visual trip at the cap (s) | Visual late (s) | Moored before next trip: min / median (s) | Trips with ≥ 2 s / ≥ 1 s moored |
|---|---|---|---|---|---|---|---|---|---|
| start: no upgrades, 1 boat, 2 workers | 20 | 25.07 | 3.7 / 3.7 / 3.7 | 100 % | 0 % | 24.46–24.46 | 0–0 | 3.15 / 3.15 | 100 % / 100 % |
| start: no upgrades, 4 boats, 6 workers | 66 | 25.07 | 3.7 / 3.7 / 31.47 | 77 % | 23 % | 23.74–24.46 | 0–0 | 3.15 / 3.15 | 100 % / 100 % |
| mid: engine 10 / nets 8 / hold 6, 6 workers | 22 | 13.9 | 3.73 / 118.9 / 148.07 | 18 % | 82 % | 16.39–17.23 | 1.75–2.66 | 0.52 / 115.69 | 73 % / 95 % |
| unlock: engine 14 / nets 18 / hold 10, 6 workers | 14 | 10.6 | 3.73 / 169.63 / 229.1 | 14 % | 86 % | 13.08–16.92 | 1.76–5.64 | -0.02 / 166.07 | 86 % / 100 % |
| unlock: engine 14 / nets 18 / hold 10, strong economy | 62 | 10.6 | 3.7 / 3.7 / 118.83 | 84 % | 16 % | 13.08–16.92 | 1.76–5.64 | -2.49 / 0.14 | 16 % / 79 % |
| max 30/30, hold 30, 2 workers, small warehouse | 3 | 6.27 | 11.03 / 444.67 / 445.53 | 0 % | 100 % | 13.08–16.92 | 6.26–7.5 | 3.14 / 436.62 | 100 % / 100 % |
| max 30/30, hold 30, 6 workers, mid warehouse | 5 | 6.27 | 10.63 / 221.57 / 461.57 | 0 % | 100 % | 13.08–16.92 | 6.05–7.5 | 2.74 / 213.52 | 100 % / 100 % |
| max 30/30, hold 30, 10 workers, everything maxed | 23 | 6.27 | 3.7 / 4 / 163.43 | 39 % | 61 % | 13.08–16.92 | 6.05–10 | -6.85 / -4.19 | 17 % / 17 % |
| max 30/30, hold 0, 10 workers, everything maxed | 235 | 6.27 | 3.7 / 3.7 / 3.7 | 100 % | 0 % | 13.08–16.92 | 6.05–10 | -6.85 / -4.32 | 0 % / 0 % |
| max 30/30, hold 0, 6 workers, mid warehouse | 64 | 6.27 | 3.7 / 31.47 / 55.3 | 41 % | 59 % | 13.08–16.92 | 6.05–10 | -6.85 / 23.58 | 53 % / 53 % |
| max 30/30 + sea charts 3, hold 30, 6 workers, mid warehouse | 3 | 5 | 30.97 / 322.87 / 405.6 | 0 % | 100 % | 13.08–16.92 | 7.53–8.8 | 21.81 / 313.71 | 100 % / 100 % |
| max 30/30 + sea charts 3, hold 30, 10 workers, everything maxed | 17 | 5 | 3.7 / 6.3 / 170.2 | 6 % | 94 % | 13.08–16.92 | 7.38–11.3 | -6.12 / -3.63 | 24 % / 24 % |
| max 30/30 + sea charts 3, hold 0, 10 workers, everything maxed | 164 | 5 | 3.7 / 3.7 / 3.7 | 91 % | 9 % | 13.08–16.92 | 7.38–11.3 | -8.15 / -5.55 | 9 % / 9 % |
| upgrade during play: engine 14 → 30 and nets 18 → 30 bought at 200 s — before the purchase | 54 | 10.6 | 3.7 / 3.7 / 3.73 | 96 % | 4 % | 13.08–16.92 | 1.76–5.64 | -2.49 / 0.14 | 4 % / 76 % |
| upgrade during play: engine 14 → 30 and nets 18 → 30 bought at 200 s — trips under way at the purchase | 2 | 8.83 | 208.3 / 267 / 267 | 0 % | 100 % | 13.08–16.92 | 5.25–7.54 | 201.18 / 258.91 | 100 % / 100 % |
| upgrade during play: engine 14 → 30 and nets 18 → 30 bought at 200 s — after the purchase | 5 | 6.27 | 107.9 / 126.13 / 147.4 | 0 % | 100 % | 13.08–16.92 | 6.26–7.5 | 100.01 / 118.24 | 100 % / 100 % |

## Findings

1. **The stay is not something to borrow from.** It is 3.7 s whenever the quay has room, and only that much is guaranteed at the moment a boat leaves.
2. **A 2 s stop is possible only if the boat is at most 1.15 s late** (3.7 − 0.55 − 2). With a 1 s stop: 2.15 s late.
3. **A full sector trip at 5 tiles/s and 90°/s takes 13.1–14.5 s** (boat 3: 15.5–16.9 s). The simulation's trip is 6.27 s at 30/30 and 5.0 s with sea charts. The boat would be 6–10 s late (7.4–11.3 s with sea charts): longer than the whole stay when the quay has room.
4. **At 30/30 with a strong economy the whole simulation cycle is 10.0 s** (8.7 s with sea charts). A sector trip at the cap plus a stop needs at least 14 s. One visual sector trip per simulation trip cannot be shown there at these limits.
5. **The short trips already meet the limits** with no lateness: the jetty-head trip peaked at 4.3 tiles/s and the harbour trip at 4.8 tiles/s in `tests/boat-sync.cjs`, with no turning.
6. **Buying upgrades during a trip** shortened the two trips under way from 10.6 s to 7.4 and 8.8 s. A boat planned for the longer trip would be up to 3.2 s later than planned, once.
7. **The move from a slip to an outer berth** takes 13.6–18.1 s at the cap, so it has the same limit as the sector trip.
