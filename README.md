# X Rocket

A TypeScript + Phaser incremental rocket launch game, packaged for desktop with Electron.

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
- Failed launches and explosions award knowledge.
- Each launch drafts lesson choices; the player picks one lesson to shape the current company run.
- Money gates launches; bankruptcy gives one meta knowledge and restarts with the next company name.
- Orbit unlock exists in the save model and simulation, but orbit gameplay is intentionally deferred.

The simulation lives under `src/sim` and is intentionally separate from Phaser rendering so balancing and save migration work can be tested without canvas/runtime coupling.
