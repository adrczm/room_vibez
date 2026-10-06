# Handoff: specifications, plan, reports and evidence

**For:** any agent or tool (Claude, Cursor, Perplexity, Codex, a person) that continues the work on this repository. Start with [`fixes/v2-agent-handoff.md`](fixes/v2-agent-handoff.md); it was written for exactly that reader and tells you what to read next for your task.

Everything in this folder was copied from the owner's project folder on 2026-10-06, unchanged, so the documents keep the paths of that folder. Use this table to resolve them here:

| Path in the documents | In this repository |
|---|---|
| `v2/hackathon-3d-viewer/` | `hackathon-3d-viewer/` (repository root) |
| `v2/prototypes/room-vibez-planner-flows/` | `prototypes/room-vibez-planner-flows/` |
| `hackathon-3d-viewer/` with no `v2/` prefix (the **original** app, port 18767) | Not in this repository. Its state at copy time is the "Baseline" commit (`git log --oneline` shows it right after the owner's initial commit) |
| `fixes/…` | `handoff/fixes/…` |
| `docs/…` (all 27 of the project's design notes and reports, from the feasibility studies to the copy deck; `docs/stress-test/` too) | `handoff/docs/…`. The app's own README points here for its design notes |
| `docs/ux-fix.md`, `docs/ux-copy-fix.md` | Never written: the completion report belonged to the skipped wave 8. The handoff files are the record instead |
| `media/ux-fix/` (final screenshots) | `docs/screenshots/` |
| `media/usability-test/`, `media/model-display-fix/`, `media/model-display-deep-qa/` | `handoff/media/…` |
| `media/ux-copy/`, `media/room-floor-fix/`, `media/catalog-room-toggle-fix/`, `media/usability-research/` | Never existed; the documents that name them planned screenshots that were not saved |
| `models/` (the `.glb` + `.mjs` pack "smoke pair" and other sample models the app README names) | **Not included.** They are third-party sample assets whose licence is not recorded anywhere in the project. Test the pack flow with your own files |
| `History/` | **Not included.** The owner's running project log; it names people |
| `screenshots/`, `diagrams/`, `chrome-profile-coohom/`, the `probe-*`, `cdp-*`, `continue-*` and `exploration-*` JSON files | **Not included.** Research captures of a third-party product, and a browser profile with session data. Keep them out of every upload |
| `fixes/v2-evidence/<wave>/shots/` and `…/out/shots/` (about 350 intermediate screenshots, 42 MB) | **Not included**, to keep the repository small. They remain in the owner's project folder. Each wave's `REPORT.md`, `PROGRESS.md`, scripts and measurement files are here |
| `.claude/launch.json` | Not included; it held absolute paths on the owner's machine. Use `npm run dev` |
| The session scratchpad (`/private/tmp/claude-501/…`) | Gone. Everything useful from it is under `fixes/v2-evidence/` |

## What is where

| Folder | Holds |
|---|---|
| `fixes/v2-agent-handoff.md` | The entry point: steps, pointers, state, rules, gotchas, decisions waiting for the owner, suggested skills |
| `fixes/implementation-plan.md` | The wave plan: every item mapped to a wave, defaults taken on open questions, and a status log that ends where this repository's history ends |
| `fixes/v2-wave1-handover.md` | Per-wave detail: what each wave built, exact function signatures, wiring steps, open points |
| `fixes/ux-improvements-handoff.md`, `ux-copy-improvements.md`, `ux-catalog-picker-handoff.md`, `qa-validation-handoff.md` | The four specifications the fix was built from (items UX-01 to UX-16, Copy Phases 0 to 5, QA-01 to QA-19, corrections C1 to C15) |
| `fixes/design-qa-checklist.md`, `validation-report.md`, `usability-test-plan.md` | 72 acceptance gates with "before" values (the "after" column was never filled); the audit of the handoffs' own numbers; the protocol for testing with people (never run) |
| `fixes/qa-evidence/` | The QA session's audit scripts and their "before" results and screenshots |
| `fixes/v2-evidence/` | One folder per agent: final report, running note, scripts, measurements. Its README explains how to reuse a script |
| `docs/ux-copy-deck.md` | Every user-facing string, final copy. The app's `src/copy.ts` transcribes it |
| `docs/usability-research-report.md`, `docs/flow-stress-test-report.md`, `docs/stress-test/` | The expert review and the behavioural audit the specifications cite |
| `media/usability-test/` | The floor-plan image for usability task T3, and the script that drew it |

## Three warnings

1. **Nothing here was validated with users.** Severities, step counts and design defaults are expert judgement. The usability test plan exists; no session has been run.
2. **Measurements were taken in headless Chrome on software rendering** with overlay scrollbars. A real GPU and a real scrollbar change pixel figures by a few percent and can change layout (the room toolbar wraps with a classic scrollbar).
3. **The documents contain the owner's local paths** (`/Users/…/Desktop/Room Vibez/…`). They are references to that machine, not instructions to reproduce it.
