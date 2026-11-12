# Loop berths at the outer jetties: feasibility study (no game code changed)

Tools: `tools/boats/thead.cjs` (search) and `tools/boats/thead-report.cjs` (checks, timing, pictures). Data: `search.json`, `layout.json`. Everything was computed on the real map with the real hull (3.93 × 1.22 tiles), piers, jetties, decorative boats, buoys and slips. Browser and Node only: nothing was run on a phone or on the emulator, and nothing was built into the game.

## Result

**Feasible, with an L-shaped head instead of a full T.** Each boat leaves ahead, sails one closed loop with its net out and comes back ahead to the same berth. At ≤ 5 tiles/s and ≤ 90°/s the loop takes 6.7–7.5 s, which fits the simulation's trip at every level from the unlock (nets 18 / engine 14) to 30/30 with sea charts at 3.

## Layout (see `map.png`, `mockup-*.png`, `routes-*.png`)

| Boat | Berth | Position (x, y) | Bow | New deck |
|---|---|---|---|---|
| 1 | west jetty, short head arm, sea face | −2.0, 32.8 | east | arm 2.4 tiles long |
| 2 | east jetty, short head arm, sea face | 28.0, 32.8 | west | arm 3.3 tiles long |
| 3 | west jetty, existing stem, outer (west) face | −5.2, 27.7 | to the sea | none |
| 4 | east jetty, existing stem, outer (east) face | 32.2, 27.7 | to the sea | none |

- The existing jetties stay as they are. Each gets one short arm at its head, towards the harbour side.
- **Why not a symmetric T.** Two loops on one sea face need 7.4 tiles between them, so the T would be 11–13 tiles long per jetty (search result: 13.1 east, 11.3 west), and the west one would reach in front of slip 3. The outer boat fits the existing stem instead, with no new deck.
- One decorative boat (at 34.0, 26.6, east of the east jetty) lies in boat 4's loop and has to be moved.
- Boats lie 0.6 tiles off the pier face. This is the smallest gap at which the stern does not touch the pier when the boat turns away (the stern swings 0.58 tiles out on a 2.8-tile radius). With 0.3 the boat must first run 2–4 tiles straight, which makes the loop longer. Lines hauling the boat the last 0.3 tiles sideways after it stops would close the gap visually; that is a possible refinement, not part of this study.

## Loop, speed and turning

| Boat | Loop (tiles) | Time, brisk / calm (s) | Top speed (tiles/s) | Top turn (°/s) | Nearest other loop (tiles) | Nearest obstacle (tiles) |
|---|---|---|---|---|---|---|
| 1 | 18.6 | 6.67 / 7.45 | 4.51 | 90 | 1.88 | 0.11 (its own arm, while turning away) |
| 2 | 18.6 | 6.67 / 7.45 | 4.51 | 90 | 2.47 | 0.11 (its own arm) |
| 3 | 18.6 | 6.67 / 7.45 | 4.51 | 90 | 1.88 | 0.20 (the stem) |
| 4 | 18.6 | 6.67 / 7.45 | 4.51 | 90 | 2.47 | 0.20 (the stem) |

- "Brisk" = acceleration 2.25 and braking 1.5 tiles/s² (what the game's motion model gives at a 5 tiles/s cruise); "calm" = 1.5 and 1.25 tiles/s².
- The loop is a circle of radius 2.8 tiles (the game's sea turning radius) with a 0.5-tile straight run-in. At 90°/s that radius allows 4.4–4.5 tiles/s, so the 5 tiles/s limit is never reached on the shortest loop.
- The four loops never share water: the swept areas (hull + 0.15 tiles) are disjoint, so no timing can make two boats meet.
- Loop time by radius, for information: 2.4 tiles → 6.36 / 7.03 s (3.9 tiles/s); 2.8 → 6.67 / 7.45 s; 3.2 → 7.00 / 7.89 s; 4.0 → 8.00 / 8.89 s.

## Fit by level

Lateness = loop time − 0.55 s head start − the simulation's trip of that boat. The simulation keeps a boat at its berth at least 3.7 s, so "moored" = 3.15 s − lateness.

| Level | Simulation trip (s) | Late, brisk – calm (s) | Moored before the next trip (s) |
|---|---|---|---|
| Nets 18 / engine 14 (unlock) | 10.6–11.2 | 0 | 3.15 (a longer loop is used) |
| Nets 18 / engine 30 | 7.2–7.6 | 0 | 3.15 |
| Nets 30 / engine 22 | 7.5–8.0 | 0 | 3.15 |
| **Nets 30 / engine 30** | 6.25–6.63 | **0 – 0.65** | **2.5 – 3.15** |
| Nets 18 / engine 30 + sea charts 3 | 5.9–6.2 | 0.2 – 1.0 | 2.2 – 2.9 |
| **Nets 30 / engine 30 + sea charts 3** | 4.96–5.26 | **1.2 – 1.9** | **1.2 – 2.0** |

- A 2 s stop holds everywhere except 30/30 with sea charts at 3, where 1.2–2.0 s is left. A dynamic stop with a 1 s minimum covers every level.
- **Lower levels use longer loops from the same berth** (the loop stretched south for the head berths, outwards for the stem berths). Checked clear, and clear of each other, up to 28.6 tiles (boats 1, 2), 26.6 (boat 3) and 30.6 (boat 4): 8.4–10.1 s. They stop at the edge of the water the game already uses. Where the simulation's trip is longer still (10.6 s at the unlock), the net is simply towed more slowly; slower is always possible.
- **Before the unlock, with the 5 tiles/s limit applied to mid levels**, the full route from the slips only fits up to about engine 5; from about engine 10 the boats would make harbour trips until the jetties open at 18 / 14:

| Nets \ Engine | 0 | 5 | 10 | 14 | 18+ |
|---|---|---|---|---|---|
| 0 | full route | full route | full route, ≤ 0.9 s late | full route, ≤ 1.9 s late | harbour trip |
| 5 | full route | ≤ 1.1 s late | harbour trip | harbour trip | harbour trip |
| 10 | ≤ 0.7 s late | ≤ 1.8 s late | harbour trip | harbour trip | harbour trip |
| 14 | ≤ 1.1 s late | ≤ 2.1 s late | harbour trip | harbour trip | harbour trip |
| 18–30 | ≤ 1.6–2.0 s late / harbour trip | harbour trip | harbour trip | **loops** | **loops** |

  This comes from the speed limit, not from the loop berths. Without it, today's build sails the full route up to about engine 18–22. Ways out: open the jetties earlier (for example at engine 8–10), or apply the limit only from the unlock on.

## Existing routes and the change-over

- **Slips 1 and 2:** none of their 32 checked routes touches a new arm or a boat at a new berth.
- **Slips 3 and 4:** their way out runs where the new arms and head berths would be. So the arms can only be built once these two slips are empty.
- **Order that works:** boats 3 and 4 move first, to the jetty stems (no arm needed); when slips 3 and 4 are empty the arms are built; then boats 1 and 2 move.
- **The one move from a slip to the new berth** (searched, clear of everything of its stage):

| Boat | Route (tiles) | Time at the limits, brisk / calm (s) |
|---|---|---|
| 1 | 38.8 | 13.6 / 14.9 |
| 2 | 38.2 | 13.5 / 14.8 |
| 3 | 33.1 | 12.4 / 13.7 |
| 4 | 33.9 | 12.3 / 13.6 |

  At the unlock level the simulation's trip is 10.6–11.2 s, so the move comes in 0.6–3.8 s late, more than the 2.15 s a 1 s stop allows for boats 1 and 2. In a save already at 30/30 it would be 6–8 s late. The move therefore cannot follow the limits and be on time. Options: let this one trip per boat sail faster (about 7–8 tiles/s at the unlock level), or let the boat arrive late once, with unloading waiting for it as it does now.

## Risks

- **Collisions:** none found on the map data. Not covered: decorative rocks near the west shore are not in the collision map; the loop of boat 3 passes close to them and must be checked against the art.
- **Sync:** 30/30 with sea charts leaves only 1.2–2.0 s moored. A purchase during a trip can shorten the trip under way by up to 3.2 s once (measured earlier); that boat would be late once.
- **Panel and quay:** the lateness is at most 1.9 s, so the panel says "Limanda" at most that long before the boat is in.
- **Timing is a model, not a run of the game.** The loop times come from a speed profile on the searched paths. They have to be confirmed in the game's own motion code and in `tests/boat-sync.cjs` after implementation.
- **Look:** a circle of 5.6 tiles across is 1.4 boat lengths wide. It is the widest turn that fits the time at 30/30; at lower levels the loops are longer.

## Alternatives compared

| Variant | Route | Time at the limits | 30/30 | 30/30 + sea charts | Verdict |
|---|---|---|---|---|---|
| **Loop berths, L-shaped head (this study)** | 18.6 tiles, ahead all the way | 6.7–7.5 s | 0–0.65 s late | 1.2–1.9 s late | fits |
| Symmetric T-head | same loop | 6.7–7.5 s | same | same | fits, but 11–13 tiles of deck per jetty and blocks slip 3 |
| Short circular route from today's outer berths (backing out first) | 22–33 tiles | 13.1–16.9 s | 6–10 s late | 7–11 s late | does not fit |
| Closer fishing zone | shortest clear zone 20–31 tiles + backing out + glide | about 12.5 s or more | about 6 s late | about 7 s late | does not fit |
| Jetty-head trip (today's fallback) | 8.5 tiles straight astern and back | fits | on time | on time | fits, but no sailing |
| Tighter loop, radius 2.4 | 16.1 tiles | 6.4–7.0 s | 0–0.2 s late | 0.85–1.5 s late | fits, tighter than the game's turning radius |

## Conclusion

The loop berths with an L-shaped head are the only variant that shows a real trip (leave, tow the net, come back) at 30/30 and with sea charts within 5 tiles/s and 90°/s. Open decisions: the 0.6-tile gap, the level at which the limit starts (or an earlier unlock), and how the one move from the slips is handled.
