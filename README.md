# X Rocket

A TypeScript + Phaser incremental rocket launch game, packaged for desktop with Electron.

## Agent Handoff

Start with [AGENTS.md](./AGENTS.md) and [PROJECT_STATE.md](./PROJECT_STATE.md) before making changes in a new coding session.

## Commands

```sh
npm install
npm run dev
npm run electron:dev
npm test
npm run build
npm run desktop
```

## Current Slice

- Launch rockets from the ground layer.
- Each launch awards one meta knowledge.
- Each launch drafts lesson choices; the player picks one lesson to shape the current company run.
- Money gates launches; bankruptcy opens a meta progress screen and restarts with the next company name.
- Meta upgrades are shown as a spider graph and unlock new cards, run rules, and permanent systems.
- Rocket performance uses simplified stats: thrust, fuel, aerodynamics, lightness, guidance, and reliability.
- Orbit unlock exists in the save model and simulation, but orbit gameplay is intentionally deferred.

The simulation lives under `src/sim` and is intentionally separate from Phaser rendering so balancing and save migration work can be tested without canvas/runtime coupling.
