# Plan (not built yet): fishing zones by level and outer berths

**Mockups** (drawn over the live game, not game code):
- `mockup-outer-berths.jpg`: the two outer jetties, the carts and the cart route;
- `mockup-sectors.jpg`: fishing sectors and the nearer zones.

## Trip types by level

The model uses efficient harbour manoeuvres and natural limits:
- sea speed up to 1.5 × the simulation's cruise;
- harbour speed up to 0.8 ×;
- turns up to 90 °/s;
- net at least 1 s.

| Trip | Used when | Route |
|---|---|---|
| Full | nets level 0–8 | today's slips → today's fishing grounds and buoys |
| Nearer zone | nets level 9 and higher, while the slip trip still fits | slips → a zone about 7 tiles beyond the slip mouth, net cast during a wide turn |
| Outer berths | once built **and** the slip trip no longer fits | outer jetty → own sector (about 5–6 tiles out), net cast during the turn, back alongside |

**Outer berths are built** automatically, with no new currency and no extra payment, when **nets ≥ 18 and engine ≥ 14**. Both levels are only reachable with harbour level 3. The model says outer berths are needed:
- without sea-charts research: from nets 24 / engine 28, nets 27 / engine 24, or nets 30 / engine 22;
- with sea-charts at 3: from nets 18 / engine 28 up to nets 30 / engine 14.

The unlock threshold covers every one of these cases.

## Outer berths
- **East jetty:** at x≈28, south from the quay, 8 tiles, 2 boats alongside.
- **West jetty:** at x≈−0.4, 2 boats alongside.
- Timber deck on piles, bollards and fenders in the existing pier style.
- The decorative moored boats move away.

**Carts** are visual only. While the simulation unloads, a cart shuttles crates along the jetty to the existing crate pile on the quay. The pile, the unloading speed and the economy stay as they are in the simulation; the crane is not used for outer berths.

## Sectors
Each boat has its own sea sector: 1 west, 2 south-west, 3 south-east, 4 east. The routes will be checked automatically:
- against each other, at the same level and at neighbouring levels;
- against land, piers and buoys.

| Expected at the top level | Outer jetty out | Net turn | In | Top speed | Turn |
|---|---|---|---|---|---|
| Engine 30, nets 30 | ~1.5 s | ~3.1 s | ~1.8 s | ~0.9 × sim | ~58 °/s |
| Same + sea charts 3 | ~1.4 s | ~2.1 s | ~1.6 s | ~0.9 × sim | ~85 °/s |

The simulation is not touched: trip time, catch, income and saves stay the same.
