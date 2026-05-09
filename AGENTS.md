# Agent Notes

## Project

X Rocket is a TypeScript + Phaser incremental rocket launch game packaged with Electron.

The current priority is fast iteration on the core loop: launch, fail, choose a lesson, bankrupt, spend meta knowledge, start the next company.

## Commands

```sh
npm install
npm run dev
npm run electron:dev
npm test
npm run build
npm audit
```

Use Node 25. The repo has `.nvmrc` and `.node-version` pinned to `25`.

## Architecture

- `src/sim`: deterministic game rules, save data, balancing, upgrades, and tests.
- `src/game`: Phaser scenes and rendering.
- `src/game/views`: Phaser view classes. Keep UI animation and drawing here instead of bloating `GameScene`.
- `tests`: Vitest tests for simulation, save migration, and naming.
- `electron`: desktop shell.

Keep simulation independent from Phaser. If a gameplay mechanic can be tested without a canvas, implement it in `src/sim` first and cover it with Vitest.

## Current Game Model

- Starting money is `$100`.
- Base launch cost is `$50`.
- Each launch grants `+1` meta knowledge.
- Bankruptcy does not grant base knowledge; it only grants bonus knowledge from effects such as `Document Everything` and `Failure Review Board`.
- The starting lesson pool is only `Tune the Engine Mix`.
- Other cards and stronger systems unlock through the meta upgrade graph.
- Rocket stats are simplified to `thrust`, `fuel`, `aerodynamics`, `lightness`, `guidance`, and `reliability`.
- The meta tree is a spider graph with one initial root: `Black Box Recovery`.

## Design Direction

- Permanent UI should stay minimal: money, primary action, menu.
- Momentary UI can be loud: launch motion, explosions, cards, summary panels, meta graph interactions.
- Meta upgrades should change run rules and player options, not only add flat stat bonuses.
- Lesson cards are tactical per-company upgrades. Meta upgrades are strategic permanent systems.

## Coding Expectations

- Prefer small, focused changes.
- Update `PROJECT_STATE.md` after meaningful design or mechanic changes.
- Add or update tests when changing `src/sim`.
- Run `npm test` and `npm run build` before considering a coding task complete.
- Run `npm audit` when dependency or package metadata changes.
- Avoid large context-heavy documents; keep handoff notes short and current.

## Session Workflow

- Start new sessions by reading `AGENTS.md` and `PROJECT_STATE.md`.
- Treat repo docs and code as source of truth, not previous chat history.
- Keep each session focused: one mechanic, one UI pass, one balance pass, or one review/cleanup pass.
- For gameplay changes, implement deterministic simulation behavior first, then Phaser presentation.
- Before ending a substantial session, update `PROJECT_STATE.md` with any changed mechanics, UI state, known work, or verification baseline.

## Common Pitfalls

- Do not reintroduce part-level rocket data unless there is a clear reason. The project intentionally moved back to simplified rocket stats.
- Do not put game logic into Phaser views.
- Do not make every meta upgrade a stat boost. Favor unlocks, draft changes, economy rules, failure handling, and new player choices.
- Keep save compatibility in mind. Current save version is `2`.
