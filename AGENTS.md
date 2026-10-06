# For agents working in this repository

This is **v2** of the Room Vibez "Catalog 3D" viewer: a Three.js app with a large, tested UX fix applied in waves. You are continuing that work. Everything below is a pointer; the material behind it is in `handoff/`.

## Read, in this order

1. `handoff/README.md`: how the handoff is laid out and how its paths map onto this repository.
2. `handoff/fixes/v2-agent-handoff.md`: the steps to take, the state, the rules and the gotchas. Written for you.
3. Only then, the file its pointer table sends you to for your task.

## Rules that held for every wave (details in the handoff)

- Build only what a specification in `handoff/fixes/` asks for. Where something is unknown or unchecked, write that down instead of guessing.
- Every user-facing word comes from `hackathon-3d-viewer/src/copy.ts`; the copy deck (`handoff/docs/ux-copy-deck.md`) is the source of truth for wording.
- Element ids, `data-*` attributes and aria states are a test contract; move elements, keep their ids.
- Existing unit tests stay unedited. An e2e spec changes only where the user's own steps changed.
- A cold boot lands on the Product workspace with the demo chair visible.
- Run e2e with `hackathon-3d-viewer/scripts/run-e2e-scratch.sh --workers=1`, never `npm run test:e2e` (it writes outside the project).

## Commands

```bash
cd hackathon-3d-viewer
npm install && npm run dev                 # http://127.0.0.1:18777/
npm run typecheck && npm test              # 340 unit tests
scripts/run-e2e-scratch.sh --workers=1     # 74 e2e tests; needs Google Chrome installed
```

## State

`git log --oneline` is the truth: one commit per wave on top of a baseline of the untouched app. The status log at the end of `handoff/fixes/implementation-plan.md` §3 says what is done, what was skipped on the owner's instruction (waves 6b, 7, 8), and what nobody has verified.
