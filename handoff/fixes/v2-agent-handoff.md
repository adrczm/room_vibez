# Room Vibez v2: handoff for an agent (Claude, Cursor or Perplexity)

**Reader:** a fresh agent with no memory of the session that wrote this. Written for agents, not for Adrian (the owner).
**Written:** 2026-10-06 by the Claude session that orchestrated the fix; last updated 10:10 EEST, after the final commit.
**Project root:** `~/Desktop/Room Vibez` on Adrian's Mac. All paths below are relative to it.

**v2** is a separate copy of the "Catalog 3D" furniture viewer (Three.js, Vite, TypeScript) with one large, tested UX fix applied. The **original** app stays untouched until Adrian has tested v2.

| | Original (leave as is) | v2 (the work) |
|---|---|---|
| Viewer | `hackathon-3d-viewer/`, port 18767 | `v2/hackathon-3d-viewer/`, port 18777 |
| Prototype (static HTML) | `prototypes/room-vibez-planner-flows/` | `v2/prototypes/room-vibez-planner-flows/` |

---

## 1. Steps

Do these in order. Each ends on a check.

1. **Find out which state v2 is in.** Read the last three entries of the status log in `fixes/implementation-plan.md` §3, then run `git -C v2 log --oneline`, `git -C v2 status --short` and `git -C v2 fetch origin && git -C v2 status -sb` (the repository is inside `v2/` only, with `origin` = https://github.com/adrczm/room_vibez; the project root has none).
   *Done when* you can name the last finished wave, its test counts, and whether the working tree has uncommitted changes.
2. **Read the pointers in §2 that match your task**, and nothing more.
   *Done when* every pointer whose condition matches your task has been read.
3. **Measure before you change anything.** In `v2/hackathon-3d-viewer`: typecheck and unit tests (scripts are in `package.json`), then the e2e suite by the scratch-copy method with one worker (§5, "E2E").
   *Done when* your counts equal the status log's, or you have written down each difference and its cause.
4. **Do the task Adrian gave you, inside v2.** Reproduce a defect before you fix it. Take every user-facing word from `src/copy.ts`. Keep each change small enough that the app loads and typechecks after it.
   *Done when* each item is one of: verified (say how, with the measured value) · implemented, not verified (say why) · not done (say why).
5. **Leave the record current.** Add one line to the status log in `fixes/implementation-plan.md` §3 and a section to `fixes/v2-wave1-handover.md` in the shape of its §10 to §13.
   *Done when* a fresh agent could repeat step 1 from those two files alone.

**If your tool cannot read that folder or reach `127.0.0.1`:** you can review and advise only. Ask Adrian to attach `fixes/implementation-plan.md` and `fixes/v2-wave1-handover.md`, and say plainly that you did not run anything.

## 2. Pointers: what to read, and when

| Read | When |
|---|---|
| `fixes/implementation-plan.md` | Always. §2 is the rule set every agent followed. §5 maps every item id to a wave. §6 lists the defaults taken on open decisions. §3 ends with the status log |
| `fixes/v2-wave1-handover.md` | Before touching any code. §1 to §8: what wave 1 built, with exact signatures and wiring steps. §9: decisions and copy-deck problems raised. §10 to §13: one section per later wave, each with "open points". The sections are numbered in the order they were added, not top to bottom: §13, §12, §11 sit after §10 |
| `fixes/ux-improvements-handoff.md` | You touch behaviour, layout or flow (items UX-01 to UX-13). Its §3 is the **test contract**: the ids and selectors that must survive |
| `fixes/ux-copy-improvements.md` and `docs/ux-copy-deck.md` | You touch any word on screen. The deck is the source of truth for wording |
| `fixes/ux-catalog-picker-handoff.md` | You touch the product or material pickers, thumbnails, or finishes on placed products (UX-14 to UX-16) |
| `fixes/qa-validation-handoff.md` | Before planning anything. §2 corrects the other three handoffs (C1 to C15). §3 holds QA-01 to QA-19. §8 explains the scratch-copy e2e method and the audit scripts |
| `fixes/design-qa-checklist.md` | You are asked to verify v2. 72 gates with "before" values; the "After" column is empty |
| `fixes/usability-test-plan.md` | You are asked about testing with people. No such test has been run |
| `v2/hackathon-3d-viewer/ARCHITECTURE.md`, `ASSUMPTIONS.md`, `README.md` | You need to know how the viewer is built or what it deliberately does not claim |
| `fixes/v2-evidence/README.md` | You need to check how a claim was verified, see an agent's full report, or reuse a measurement script |
| `git -C v2 log` and `git -C v2 diff <a> <b>` | You need to see exactly what one wave changed |

## 3. State

**Waves** (a wave is one agent's slice of the plan; ids are in the plan's §5):

| Wave | Scope | Status | Checks after it |
|---|---|---|---|
| 0 | Clone, own ports, baseline | done | tsc 0 · unit 66/66 · e2e 9/9 |
| 1 | Seven parallel slices: 3D engine, data engine, `src/copy.ts` + `src/errors.ts`, dialogs and toast, picker component, prototype, host trust fixes | done | tsc 0 · unit 315/315 · e2e 26/26 |
| 2 | Confirm dialogs, feedback on the stage, empty Room state | done | e2e 32/32 |
| 3 | Panel split by workspace, Room as four steps, Add to room, toolbar | done | e2e 41/41 |
| 4 | Finishes on placed products; select, move, rotate, delete | done | unit 336/336 · e2e 48/48 |
| 5 | Thumbnail and list pickers mounted; swatch names | done | e2e 60/60 |
| 6a | Visible wording from the deck; the **?** help pop-up; QA-10, QA-14 | done | unit 340/340 · e2e 74/74 |
| 6b | Status and error messages (Copy Phase 3), the behaviour they need (Copy Phase 4, host side), QA-12, QA-17 | **skipped on Adrian's instruction** | |
| 7 | Target sizes, keyboard and focus, contrast, sticky stage on phones, tokens (UX-12, UX-13, QA-09, QA-11, QA-13, QA-15 CSS, QA-16, QA-19) | **skipped on Adrian's instruction** | |
| 8 | The 72 gates, audit scripts, independent review, completion doc `docs/ux-fix.md`, `History/` entry, screenshots in `media/ux-fix/` | **skipped on Adrian's instruction** | |

**Closing steps the orchestrating session still owed when this was written:**

| Step | Status at 10:10 |
|---|---|
| Git repository **inside `v2/` only** (Adrian's choice of scope) | **done**: a baseline commit of the untouched copy, then one commit per wave for waves 1 to 5 |
| Wave 6a | **done and committed** ("Wave 6a: visible copy from the deck and the help pop-up", tip `262d64f` after the rebase below) |
| Typecheck, unit tests and a production build on v2 | **done**: `tsc` 0 · unit 340/340 · build OK; `dist/` built in place (ignored by git). E2E 74/74 as reported by the wave 6a agent; the orchestrating session did not re-run the suite |
| Final-state screenshots in `media/ux-fix/` | **done**: ten views at 1440×900 and 375×812, 0 page errors (`_capture-log.txt` beside them) |

`git -C v2 log --oneline` is the truth: eight commits (GitHub's "Initial commit" with a README, then the baseline and six waves), clean working tree, pushed to **https://github.com/adrczm/room_vibez** (public, remote `origin`, branch `main`) at the time of writing. Anything uncommitted you find there was done after this session.

**What "skipped 6b" leaves in the app.** The engine side of Copy Phase 4 is in v2 and unit-tested, and `src/errors.ts` maps engine errors to the deck's wording, but most of the host does not call them yet. So today: many error messages are still raw engine text; nothing tells the user when the browser blocks saving; an unreadable saved room is dropped without a message; a random file named `.dwg` still gets a sample result; the `.mjs` confirm is the browser's native dialog; long unbroken names can push row buttons off-screen. The wiring steps for each are in the handover §3 and §4.

**What "skipped 7" leaves.** Controls under 32 px remain (segmented buttons at 31 px, one summary at 17 px); the canvas has no `tabindex` or label; radio groups have no arrow-key support; two focus-ring styles; input borders at 1.61:1; 33 px overflow at 320 px wide; on a phone the 3D view scrolls away while you use Add to room.

**Nobody has verified:** anything with people; screen readers; Safari, Firefox, Windows, real phones. All interaction tests ran in headless Chrome on software rendering. One look on a real GPU (Apple M1 Pro) after wave 3 is recorded in the handover §11.

## 4. Rules that held for every wave

1. **Build only what a handoff specifies.** Product data (images, categories, makers, prices, SKUs) stays exactly what the catalog holds. Where something is unknown or unchecked, write that down.
2. **Honesty labels stay visible** ("sample", "placeholder", "simulated").
3. **Words come from the deck through `src/copy.ts`.** A string the deck lacks goes in the `notInDeck` section, in the deck's voice, with a comment naming the item that asked for it.
4. **The test contract is binding** (UX handoff §3, Picker handoff §6): moving an element is fine; its id, `data-*` and aria state stay.
5. **Existing unit tests stay as they are.** A failing one means the code is wrong. An e2e spec changes only where the user's own steps changed, and each such edit is listed.
6. **A cold boot lands on Product with the demo chair visible.**
7. **One writer at a time** on the three host files (`index.html`, `src/main.ts`, `src/styles.css`). Use targeted edits.
8. **"Merge" means into `v2/`.** Copying v2 over the original is called "promote", and happens only when Adrian says that word. With no git in the project root, the original is the only rollback.
9. **Keep these at the project root out of every upload, context window and commit:** `chrome-profile-coohom/`, `session-state.json`, and the `probe-*.json`, `cdp-*.json`, `continue-*.json`, `exploration-*.json` reports. They hold a logged-in browser profile and session data from another site.

## 5. Gotchas the files will not tell you

**E2E**
- Six of the original specs write screenshots to hard-coded Cursor agent-store paths under `~/Library/Application Support/Cursor/…`. Run the suite with `v2/hackathon-3d-viewer/scripts/run-e2e-scratch.sh --workers=1`, which runs a copy in the OS temp folder with those paths redirected, not with `npm run test:e2e` in place.
- **One worker.** With the default five, tests time out under software rendering and look like regressions.
- Edit `src/main.ts` or `index.html` only when no e2e run is in progress: Vite reloads the page under the running test.
- The Room workspace is a stepper. A script opens a step (`.step[data-step=place] .step-toggle`) before it uses that step's controls.
- The camera keeps drifting for seconds after a drag (damping). Let it settle before reading it.
- The audit scripts in `fixes/qa-evidence/` are wired to the original (port 18767, `../../hackathon-3d-viewer`) and to the old DOM. Against v2 they need retargeting, a step opened before each tool button, the new placement rows (`li.placement-row`), and the picker trigger in place of `#product-select` (handover §11, §12, §13).

**Measuring**
- Headless Chrome has overlay scrollbars; the Claude desktop browser has a 15 px classic one. Panel heights differ by 2 to 6 %, and the room toolbar wraps to two rows with the classic one. State the mode with every pixel figure.
- Each port is its own browser origin. A room saved at 18767 does not exist at 18777, and the reverse.

**Writing files (Claude sessions on this machine)**
- The shell's write access to the project folder comes and goes within a session. Test with one `touch` and one `mkdir` before relying on it; the Write and Edit tools always work.
- Bringing a file in with a write tool can silently decode escapes such as `̀`. Compare `shasum -a 256` on both sides.

**Running it**
- The dev server uses `--strictPort`. "Port in use" on 18777 means it is already running.

## 6. Decisions waiting for Adrian (an index; details at the pointer)

Each was taken provisionally so the work could continue, and each is reversible.

| Decision | Where |
|---|---|
| Promote v2 over the original? Not requested yet | this file §4 rule 8 |
| Run the skipped waves 6b, 7, 8? | plan §3 |
| Prototype: a disabled control removed where the deck relabels it; one button's reachability; three small fixes beyond the brief | handover §9 |
| The key guard is narrower than the handoff's "any input" | handover §1, §9 |
| **?** button at 28 px against a 32 px minimum; confirm dialogs focus Cancel first | handover §6 |
| Floor colour `#766b5e` and the 45° arrival camera are an agent's design defaults | handover §7 |
| After Create room the stepper opens Openings, so the first chair takes four clicks against a target of three | handover §11 |
| Arrow keys move a product along the room's axes, not the screen's; no on-screen move buttons for touch; a move that would leave the room is refused | handover §12 |
| Uploads and packs get very tall Materials cards; on a phone the bottom of Materials sits at 1.59 screens against "about 1.5" | handover §13 |
| About thirty strings written by agents in the deck's voice, reviewed by nobody | `src/copy.ts`, section `notInDeck` |
| Fifteen places where the copy deck is ambiguous, contradicts itself, or was made false by the fix | handover §9 |
| The defaults taken on the handoffs' own open questions (D1 to D5, DT3 to DT8, D-QA1 to D-QA6) | plan §6 |

## 7. Where the working material lives

On 2026-10-06 Adrian asked for everything useful to be moved out of the session's temporary folder. Nothing in the project depends on a temp folder any more.

| Material | Now at |
|---|---|
| v2's source after each wave | git history in `v2/` (baseline, then one commit per wave) |
| Each agent's final report, running note, probe scripts, measurements and screenshots | `fixes/v2-evidence/<wave>/` (index: `fixes/v2-evidence/README.md`) |
| The e2e runner | `v2/hackathon-3d-viewer/scripts/run-e2e-scratch.sh` |
| The audit runner and the final-screenshot script | `fixes/v2-evidence/tools/` |
| The two component test pages | `fixes/v2-evidence/harness/` |
| The T3 floor-plan image and its source | `media/usability-test/` |
| This handoff | `fixes/v2-agent-handoff.md` (a first copy was written to `/tmp`; this one is current) |

Left behind on purpose, because they can be regenerated: the agents' isolated working copies of the app, build outputs, and the throwaway folder of each e2e run.

## 8. Suggested skills

For a Claude Code session, call the Skill tool with these. Cursor and Perplexity have no Skill tool; read each line as the kind of pass to make.

| Skill | Call it when |
|---|---|
| `writing-for-agents` | Before you write any brief, handoff or instruction file for another agent |
| `run` | You need to launch v2 and drive it in a browser |
| `diagnosing-bugs` | A test fails or behaviour differs from the status log |
| `tdd` | You add behaviour (waves 6b and 7 are mostly this) |
| `design:ux-copy` | Wave 6b: status, error and confirmation wording. The deck came from this skill |
| `design:accessibility-review` | Wave 7: keyboard, focus, contrast, target sizes |
| `design-ops:design-qa-checklist` | Wave 8: filling the "After" column of the 72 gates. The checklist came from this skill |
| `code-review` | Wave 8: the independent review of the whole fix. Once `v2/.git` exists, review the diff between its first and last commit |
| `designpowers:usability-testing` | Preparing sessions with people. The sessions themselves need Adrian |

`/wayfinder` exists on this machine but only Adrian can invoke it; ask him to send it as its own message.
