# Project State

Last updated: 2026-05-09

## Current Slice

X Rocket is a playable Phaser prototype with an Electron shell. The player launches a crude rocket, earns `+1` meta knowledge per launch, chooses modest lesson cards after launches, and eventually enters bankruptcy review to spend meta knowledge on a spider graph before starting the next company.

## Core Loop

1. Start with `$100`.
2. Launch costs `$50` before discounts.
3. Launch resolves from simplified rocket stats.
4. Launch grants `+1` meta knowledge.
5. Post-launch lesson cards appear. Early cards are modest; meta upgrades strengthen card effects and draft behavior.
6. Player picks one lesson for the current company.
7. If money is below launch cost, open bankruptcy review.
8. Spend meta knowledge, then start the next company.

## Simplified Rocket Stats

- `thrust`
- `fuel`
- `aerodynamics`
- `lightness`
- `guidance`
- `reliability`

These live in `src/sim/rocketStats.ts`. Lesson effects rebuild the current rocket through `rebuildRocketStats(...)` in `src/sim/lessons.ts`.

Lesson cards now cover every simplified rocket stat directly:

- `Tune the Engine Mix`: thrust
- `Improve Fuel Flow`: fuel
- `Fair the Nose Cone`: aerodynamics
- `Cut Dead Weight`: lightness
- `Stabilize the Fins`: guidance
- `Reinforce the Frame`: reliability

## Meta Upgrade Graph

Root node:
- `Black Box Recovery`

Current branches:
- Salvage/economy: `Scrapyard Engineering`, `Recovery Program`, `Supplier Contracts`
- Funding/knowledge: `Questionable Investors`, `Failure Review Board`, `Prototype Archive`, `Mission Control`, `Safety Review Board`, `Crash Lab`
- Flight capability: `Basic Stabilizers`, `Guidance Program`, `Advanced Aerodynamics`

Some nodes have multiple levels with scaled costs via `metaUpgradeCost(...)`.

Meta upgrades no longer grant broad permanent flight stat boosts or simply add larger lesson hands. Current progression emphasis:

- `Black Box Recovery` unlocks risky core lessons and improves them.
- `Prototype Archive` starts new companies with archived `Tune the Engine Mix` stacks instead of startup draft choices.
- `Mission Control` steers failed launch drafts toward a card that addresses the failed stat when possible.
- `Crash Lab`, `Guidance Program`, `Advanced Aerodynamics`, and `Failure Review Board` improve related lesson card strength.
- `Advanced Aerodynamics` unlocks `Fair the Nose Cone` for direct aerodynamics coverage.

## UI State

- Main HUD is camera-fixed and minimal.
- Rocket rolls from hangar to pad, launches upward, and the camera follows.
- Launch summary and cards are camera-fixed overlays.
- Meta upgrades are displayed as an authored compass graph: root centered, economy west, flight east, and review/knowledge south.
- Meta graph text renders at higher text resolution and opens at 1:1 zoom to avoid blurry scaled labels.
- Dev stats toggle with `D`.
- Global menu includes reset game.

## Known Near-Term Work

- Continue tuning meta graph readability, especially branch labels and link colors.
- Improve card presentation to show upgraded effect values instead of static `+` shorthand.
- Add clearer feedback when a meta node is unaffordable or locked.
- Replace placeholder procedural art with a cohesive pixel art direction.
- Orbit unlock exists, but orbit gameplay is not implemented.

## Verification Baseline

Before handoff, these should pass:

```sh
npm test
npm run build
```
