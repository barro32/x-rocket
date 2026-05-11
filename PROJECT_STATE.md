# Project State

Last updated: 2026-05-11

## Current Slice

X Rocket is a playable Phaser prototype with an Electron shell. The player launches a crude rocket, earns `+1` meta knowledge per launch, chooses modest lesson cards after launches, and eventually enters bankruptcy review to spend meta knowledge on a spider graph before starting the next company.

## Core Loop

1. Start with `$100`.
2. Launch costs `$50` before discounts.
3. Launch resolves from simplified rocket stats.
4. Launch grants `+1` meta knowledge.
5. Post-launch lesson cards appear only if the company can afford another launch. Early cards are modest; meta upgrades strengthen card effects and draft behavior.
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

These live in `src/sim/rocketStats.ts` and now start at `0`. Lesson effects rebuild the current rocket through `rebuildRocketStats(...)` in `src/sim/lessons.ts`, with stats clamped to `0..99`. Launch rolls keep zero stats at `0`, while nonzero stats can roll above or below their built value within the reliability-driven variance band.

A perfect launch roll with all performance stats at `99` reaches the altitude cap of `500 km`.

Launch score is now a simple even sum of the five performance stats, with no hidden per-stat weight multipliers.

Launch failure checks now use the built rocket stats plus reliability instead of the already-rolled performance stats, so a weak performance roll does not also double-count as a higher explosion chance. Reliability directly reduces catastrophic failure odds and still tightens the launch variance band. If multiple systems fail in the same launch, the failed phase is selected by weighted chance instead of fixed stat order. Any effective failure blocks orbit, even when Safety Review Board vetoes the explosion.

Thrust and fuel now gate how much raw performance score turns into altitude and orbit eligibility. A rocket with strong fuel, aero, lightness, and guidance but no thrust cannot leave the pad. A high-thrust rocket with no fuel can make a short ballistic hop, but it cannot sustain enough altitude score for orbit. A rocket can have a high raw score and still fail orbit if its thrust lift or fuel sustain factor is too low.

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

- Main HUD is now a DOM overlay above Phaser, with responsive layout for narrow and short windows.
- DOM overlay styles are split by owner: global base styles and design tokens live in `src/styles/base.css`, while `DomUiView`, `DomMetaProgressView`, and `DevLaunchPanelView` import their own adjacent CSS files. Shared tokens now cover palette, UI states, graph colors, lesson card accents/art backgrounds, radii, shadows, fonts, and layer order.
- Rocket rolls from hangar to pad, launches upward, and the camera follows. Launch animation now uses rolled stats for clearer physical presentation: thrust affects acceleration/flame size, fuel affects burn duration/cutoff/sputter, aerodynamics/guidance/reliability affect wobble and drift, and failed systems add phase-specific instability. Takeoff now has a slower ignition/ascent ramp, body-centered shake, flame alignment that follows rocket tilt, and a thrust-sensitive ascent curve where weak thrust lingers on ignition/climbs sluggishly while strong thrust lifts faster.
- Launch summary and lesson cards are DOM overlays with CSS-driven responsive grid/stack behavior. Phaser still handles world, rocket, camera, and effects.
- Lesson cards show exact current effect values from active meta upgrades instead of vague scaling labels.
- Meta upgrades are displayed as a DOM/SVG bankruptcy review overlay with an authored compass graph: root centered, economy west, flight east, and review/knowledge south. Node details and purchase actions now open in a concise node-local popover, with a mobile bottom-sheet layout and purchase/unlock feedback animations.
- Dev stats toggle with `D`.
- `D` also opens a launch tuning panel with stat sliders. When override is enabled, launches use the slider stats for testing while saved rocket stats remain unchanged. Dev stats show raw score, thrust lift factor, fuel sustain factor, and combined altitude score.
- Global menu is a DOM modal and includes reset game.

## Known Near-Term Work

- Continue tuning DOM/SVG meta graph readability, especially small-window graph scrolling and node spacing.
- Continue tuning meta upgrade wording so every popover stays short and action-focused.
- Replace placeholder procedural art with a cohesive pixel art direction.
- Orbit unlock exists, but orbit gameplay is not implemented.

## Verification Baseline

Before handoff, these should pass:

```sh
npm test
npm run build
npm audit
```
