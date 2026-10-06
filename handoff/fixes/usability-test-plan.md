# Usability test plan: Catalog 3D viewer

**For:** the Claude session that applies the combined fix (to prepare the assets in §9), and through it Adrian, who has to run the sessions. Reached from `fixes/qa-validation-handoff.md` §1 step 7.
**Skills:** `design-research:usability-test-plan`, `designpowers:usability-testing`, run 2026-10-05.

> **No usability test has been run.** Zero participants. Every table that would hold participant data says so. The "what the build does" column and §8 come from this session's scripted walkthrough of the tasks, which is an expert check, not user evidence.

**Relation to the existing plan.** `docs/usability-research-report.md` §7 already sketches a validation plan (seven tasks, a thumbnails-versus-list probe, a 50-minute guide). This document is the full protocol for it. It keeps that plan's question, tasks and probe, and changes four things, each with its reason in §3.

---

## 1. Objectives and research questions

**Objective:** find out whether people can do the app's core jobs unaided on the fixed build, and where they still stall.

| # | Research question | Tasks |
|---|---|---|
| RQ1 | Can a first-time user find a product and change its finish without help? | T1 |
| RQ2 | Can they get a room of the size they intend, from numbers and from a plan image, and do they understand what they got? | T2, T3 |
| RQ3 | Can they furnish the room: place, stop placing, correct a mistake, and get the finish they chose? | T4, T5, T6 |
| RQ4 | Do they understand where their work lives and how to get it back? | T7 |
| RQ5 | Do the segmented sidebar and the picker reduce wrong-place clicks and scrolling, and which picker view do people use? (the question in the research report §7) | T1, T4, T6, T8, view probe |

---

## 2. When to run it, and on which build

**Recommendation: after the fix, on the fixed build only.** Decision D-UT1 is Adrian's.

- Today's build has blockers already established without participants: the floor is not visible on arrival (0 % of the canvas), tools can't be switched off, the chosen finish never reaches the room, and Import project is unreachable on a fresh profile. Sessions on this build would spend their time rediscovering them.
- The research report §7 proposes each participant uses both builds, order alternated. That answers RQ5 directly, but on today's build T4 can't succeed at all and T2, T5 and T7 succeed only through workarounds the UI doesn't suggest, so much of each session would go to known failures, and five to eight people can't separate a learning effect from a design effect.
- The "before" side of RQ5 can come from measurements instead: panel scroll distances, step counts and wrong-workspace exposure on today's build are already recorded (handoff §2 and checklist). They are objective and cost no participant time.
- **If Adrian wants the comparison with people anyway:** run only T1 and T6 on both builds (they are completable on both) and everything else on the fixed build.

**Minimum before the first session:** QA-01 to QA-04, UX-01 to UX-06, Picker UX-16 steps 1 and 2. Without those, T4 fails by construction and T2 and T7 depend on a workaround. T5 needs UX-09; without it, expect delete-and-place-again.

---

## 3. Changes to the research report's plan, and why

| Research report §7 | Here | Why |
|---|---|---|
| Task 1: "see the side table with a **marble** top" | **walnut** top | Marble is the table's default (`catalog.json`: `top` → `stone-marble`). Selecting the table already satisfies the task, so it wouldn't test changing a finish |
| Task 2: "Make a **5 × 4 m** room" | **5.5 × 4 m** | 5 × 4 is the "Living" preset. A size with no preset is the only way to exercise typed dimensions (UX-01) |
| Each participant uses both builds | Fixed build only (§2) | See §2 |
| A 1-to-5 confidence rating after each task | The 7-point Single Ease Question | A standard item, so results can be compared with later rounds |
| (not present) | T5 "move the chair", and a second half to T7 "get it back on another computer" | They cover UX-09 and QA-04, which the seven tasks don't reach |

Everything else in §7 stands, including the view probe: don't tell participants a list view exists; note whether they find the toggle, which view they use first and whether they switch.

---

## 4. Method

| | |
|---|---|
| Format | Moderated, think-aloud, one person per session, 50 minutes |
| Where | In person on the machine that runs the app, or remote with the participant controlling the facilitator's screen. **The app only runs at `127.0.0.1:18767`; there is no hosted copy.** Hosting one is a decision for Adrian (it publishes the build) |
| Browser and screen | Google Chrome, window at least 1280 px wide. Chromium is the only engine this build has been checked in |
| Phone-size sessions | Not in round 1. Add one only after QA-03 is fixed and checked |
| Roles | One facilitator, one note-taker if available. Record screen and voice with consent |
| Rounds | Round 1: five to eight sessions, then fix, then repeat. Report counts, not percentages or statistics, at this size |

---

## 5. Participants

**Five to eight per round.** The project's docs name four roles (consumer, interior designer, architect, reseller or ops; `persona-formats-and-planner5d-full-plan.md`, the prototype's role cards) and the service blueprint treats the designer as primary. **Which roles the first real users are is undecided** (stress test §7 Q7; research report §7). D-UT2.

**Proposed mix for round 1 (a proposal, not a decision):** three or four people who furnish rooms for clients, two or three who have furnished their own home with an online planner or would. Leave architects and resellers for a later round, since their distinguishing flows (DWG import, parts list hand-off) are sample-only or placeholders today.

**Across the round, include at least** (the inclusion floor from `designpowers:usability-testing`):

- one person who uses a screen reader. Until UX-13 and "Add to room" land, that session can cover the Product workspace and the panel only; the canvas has no keyboard path;
- one person over 60;
- one person whose first language is not English (the UI is English only);
- one person with low confidence using new software.

**Screener (draft)**

1. Which describes you: I plan or furnish rooms as part of my job / I have planned or furnished my own home / neither. *(Neither: exclude.)*
2. Which tools have you used for it? *(Open. Record; don't exclude.)*
3. How often do you use a new web app without instructions: often / sometimes / rarely.
4. Do you use a screen reader, magnifier, voice control or keyboard-only navigation?
5. Age band. First language.
6. Do you work for a furniture-planning software company? *(Yes: exclude.)*

**Unknown, and needed before recruiting:** the recruiting channel, incentives, consent wording, how recordings are stored and for how long. The research report lists the same gaps.

---

## 6. Tasks

Read each task aloud exactly as written. Say nothing about how. Time limits are cut-offs for the facilitator, **not benchmarks**: no completion-time data exists, so expected times come from the pilot.

**Start state for every session:** a fresh browser profile, Product workspace, demo chair on screen. Reset between participants.

| # | Say this | Success is | Stop after | What today's build does on the shortest path (walkthrough, not user data) |
|---|---|---|---|---|
| T1 | "You're choosing a side table for a client. Find it and see how it looks with a walnut top." | Product is the side table and its Top is walnut | 4 min | Works. The first row of swatches needs 159 px of panel scroll to come fully into view at 1440×900 (measured with the chair selected) |
| T2 | "The client's living room is 5.5 metres by 4, with a normal ceiling. Set that room up." | A room 5.5 × 4 m | 5 min | Typing 5.5 and 4 and pressing Create room gives a **3 × 3 m** room while a preset is selected; the fields still read 5.5 and 4. Choosing "Custom…" first works |
| T3 | "Here is the client's floor plan as an image *(hand over the file)*. Use it to start the room instead." | A room whose size matches the one printed on the image | 6 min | Works: Import plan → choose file → "Upload & derive candidates" → type the size → "Confirm underlay → room". The app does not read walls from the image; the result is a rectangle of the size typed |
| T4 | "Put two lounge chairs in the room. One of them should have a walnut frame." | Two chairs inside the room, one with a walnut frame, no extras | 7 min | Chairs can be placed only after orbiting, and only in the order tool-then-orbit. Placing can't be switched off. **No placed chair shows any finish**, so the walnut half can't succeed |
| T5 | "That chair is in the way. Move it to the opposite side of the room." | Still two chairs; the chosen one is on the other side | 4 min | No move or select exists. Delete and place again is the only route |
| T6 | "The client wants a marble floor. Change it." | The room's floor material is white marble | 3 min | Not exercised by this session with a real pointer. The control is a text select under "Shell materials" |
| T7 | "You have to stop for today. Make sure you can carry on tomorrow." Then, on a fresh profile: "It's tomorrow and you're on a different computer. Get your room back." | A project file is saved; the room, with its chairs, is back in the fresh profile | 6 min | Export works (`catalog3d-project.json`). Nothing on screen says the room is also kept in the browser. On a fresh profile **Import project is not visible** until a room exists |
| T8 | "You have a 3D model of the client's own lamp *(hand over the file)*. Add it so you could use it in this room." | The model appears in the product list | 4 min | Upload works. The control lives in the Product card |

**If time runs short, drop T3, then T8.** An optional ninth task if a session runs fast: "The room has a door on one short wall and a window opposite. Add them." (Works today with real clicks; confirmation appears off-screen.)

**Files to hand over:** for T3, a PNG floor plan with its size printed on it (§9 item 1; none exists in the project, only an SVG preview the importer doesn't accept). For T8, any of the `.glb` files in `models/` at the project root.

---

## 7. Measures

| Measure | How |
|---|---|
| Outcome per task | One of four: **completed easily** (no hesitation, no errors) · **completed with difficulty** (hesitated or erred, then recovered) · **failed** · **completed wrong** (believed they succeeded and hadn't). Check with the snippet below; don't judge by eye |
| Time on task | From the end of the read-out to the participant saying they're done |
| Errors | Count per task: a click on a control of the other workspace; a product placed outside the room or by accident; a room of the wrong size; a destructive action taken unintentionally |
| Panel scrolling and wrong-workspace clicks | The logger below |
| Ease | Single Ease Question after each task: "Overall, how difficult or easy was that?" 1 (very difficult) to 7 (very easy) |
| Overall | System Usability Scale after the last task. With five to eight people it is a rough indicator only |
| View probe | First view used, whether the toggle was found, whether they switched (research report §7) |

**There are no target values.** The project has no prior round to compare with. Round 1 sets the baseline.

**Logger** (paste in the console before the participant starts; tested for syntax on today's build):

```js
window.__ut = { scrollPx: 0, last: 0, wrongWorkspaceClicks: [] };
const p = document.querySelector('.panel'); __ut.last = p.scrollTop;
p.addEventListener('scroll', () => { __ut.scrollPx += Math.abs(p.scrollTop - __ut.last); __ut.last = p.scrollTop; }, { passive: true });
document.addEventListener('click', (e) => {
  const card = e.target.closest('[data-workspace-panel]');
  if (card && card.dataset.workspacePanel !== document.body.dataset.workspace)
    __ut.wrongWorkspaceClicks.push(e.target.id || e.target.textContent.trim().slice(0, 30));
}, true);
```

**Outcome check** (paste after each task, out of the participant's sight; uses the existing test hook `window.__rv`):

```js
(() => { const v = __rv.viewer(), g = __rv.roomGraph(), r = g?.rooms[0];
  const xs = r?.floor_polygon.map(q => q.x) ?? [0], zs = r?.floor_polygon.map(q => q.z) ?? [0];
  const b = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  return { product: document.getElementById('product-select').value,
    slots: Object.fromEntries(v.getSlots().map(s => [s.def.id, s.materialId])),
    room: r ? { size: [+(b.maxX - b.minX).toFixed(2), +(b.maxZ - b.minZ).toFixed(2)], floor: r.floor_material_id ?? null, source: g.provenance?.kind } : null,
    openings: g ? g.openings.map(o => o.type) : [],
    placements: g ? g.placements.map(q => ({ product: q.product_id, x: +q.position.x.toFixed(2), z: +q.position.z.toFixed(2),
      inside: q.position.x > b.minX && q.position.x < b.maxX && q.position.z > b.minZ && q.position.z < b.maxZ, finish: q.slot_bindings })) : [],
    uploads: __rv.catalog().products.filter(q => q.userAdded).map(q => q.name),
    tool: v.getInteractionMode(), log: window.__ut }; })()
```

Expected values: T1 `product: "demo-side-table"`, `slots.top: "wood-walnut"` · T2 `room.size` `[5.5, 4]` or `[4, 5.5]` · T4 two placements with `product: "demo-lounge-chair"`, both `inside: true`, one with `finish.frame: "wood-walnut"` · T6 `room.floor: "stone-marble"` · T8 `uploads` has one entry. After the fix moves the picker or the test hook, re-check that both snippets still run.

---

## 8. Facilitation guide

**Before the participant arrives (2 min):** fresh profile, app loaded, logger pasted, recording ready, files for T3 and T8 on the desktop.

**Welcome (3 min).** Say:
> "Thanks for coming. We're testing a piece of software, not you. Nothing you do can be wrong, and if something is confusing, that's what we need to see. Please think out loud as you go: what you're looking for, what you expect to happen. I'll mostly stay quiet and I won't be able to help during a task, because we need to learn what happens when nobody is there to help. You can stop a task or the session at any time. Is it all right if I record the screen and your voice? Only the team will see it."

**Background (7 min).**
- "Tell me about the last time you planned or furnished a room. What did you use?"
- "Do you ever get floor plans as files? What kind?"
- "When you choose furniture, how do you decide on colours and materials?"

**Tasks (25 min).** One at a time. Read the task; hand it over on a card as well. Then stay silent.
- If they go quiet: "What are you thinking?" or "What are you looking for?"
- If they ask you how: "What would you try if I weren't here?"
- If they ask whether it worked: "What do you think happened?"
- At the cut-off: "Let's leave that one there. That was useful." Don't show the answer.
- After each task: the Single Ease Question, then "What made you give it that number?"
- Never point, never name a control, never react to a wrong turn.

**Probes for specific moments** (only after the task ends):
- After T2, if the room came out a different size: "What size is the room you made? How do you know?"
- After T3: "Where did the room's walls come from?" (listens for whether they think the app read the image)
- After T4: "How would you stop adding chairs?" and "Is this the chair you chose earlier?"
- After T7: "If you closed this window now, what would happen to your room?"
- Anywhere a label like "sample" or "placeholder" was on screen: "What does that tell you?"

**Debrief (10 min).**
- "What was the hardest part?" "What did you expect that didn't happen?" "What would you change first?"
- The System Usability Scale (ten items).
- The view probe's reaction question from the research report §7.
- "Is there anything you expected this to do that it didn't?"

**After (3 min):** run the outcome check one last time, save the logger output, reset the profile.

---

## 9. What Claude can prepare, and what needs people

**Claude can prepare (do these in handoff step 7):**

1. **The T3 file.** A PNG floor plan with its dimensions printed on it, for example a single room labelled 6.0 m × 4.5 m. Draw it as SVG and render it to PNG with Playwright; `walkthrough-tasks.mjs` section W6 shows the import path working with a generated PNG. Save it under `media/usability-test/`.
2. **The two snippets in §7,** re-checked against the fixed build. If `window.__rv` or `[data-workspace-panel]` changes, update them here.
3. **A reset recipe:** a fresh browser profile is the safe one. Otherwise clear the `localStorage` keys `catalog3d.roomGraph`, `catalog3d.roomTemplates` and `catalog3d.mjsEnabled`, **and** the IndexedDB database `catalog3d-local` (`projectIO.ts:10`). The IndexedDB copy is written on Export and read at boot when `localStorage` has no room (`main.ts:628`, `:1632-1639`, *code-read*), so clearing only `localStorage` may bring the last exported room back.

**Needs Adrian or another person:** recruiting, consent, facilitating, note-taking, the decisions D-UT1 to D-UT3, and whether to host the build for remote sessions.

---

## 10. Data collection

**Record:** screen and voice; the logger output per task; the outcome-check output per task; the two ratings.

**Observation sheet, one per participant:**

| Task | Outcome (1 of 4) | Time | Errors (what, where) | First place they looked | Quote | Ease (1 to 7) | Scroll px | Wrong-workspace clicks |
|---|---|---|---|---|---|---|---|---|
| T1 | | | | | | | | |
| … | | | | | | | | |

**Note-taking rule:** write what the person did and said, in their words. Keep interpretation in a separate column and add it after the session.

---

## 11. Analysis

1. **Per task, count the four outcomes.** Report "4 of 6 completed easily", never a percentage.
2. **List each problem once** with the participants who hit it. Severity: **critical** blocks two or more participants · **major** causes significant difficulty · **minor** was noticed and didn't impede.
3. **Check "completed wrong" first.** A person who leaves believing they succeeded is the costliest outcome for this product, whose own rule is not to look more capable than it is.
4. **Tie each problem to an item id** (UX-nn, QA-nn, Copy phase, Picker item) or mark it new.
5. **Turn each problem into one action:** "[severity] what happened → the change → who takes it".
6. **View probe:** decide the picker's default view and whether the toggle stays. Five to eight sessions show what people did, not what people prefer.
7. **Decide:** iterate, ship or rethink. Then re-run the round after the next fix.

---

## 12. Pilot checklist

Run one pilot with someone outside the project before the first real session.

- [ ] Every task can be completed on the build being tested. If one can't, fix the build or drop the task.
- [ ] The eight tasks fit in 25 minutes. If not, drop T3, then T8.
- [ ] No task wording names a control or a workspace.
- [ ] The T3 image and the T8 model load.
- [ ] Both snippets run and return the expected fields.
- [ ] Recording captures the canvas (WebGL) and the voice.
- [ ] The profile reset really clears the saved room.
- [ ] The consent wording is agreed.
- [ ] The note-taker can fill the sheet at speaking pace.
- [ ] Time limits come from the pilot, not from §6.

---

## 13. Results

### Task success

| Task | Completed easily | With difficulty | Failed | Completed wrong | n |
|---|---|---|---|---|---|
| T1 to T8 | **not run** | **not run** | **not run** | **not run** | 0 |

### Findings ranked by severity

**None from participants.** What follows is the expert walkthrough of the same tasks on today's build, turned into the actions the `designpowers` format asks for. Treat the outcomes as predictions to test, not results.

| Task | What the build does today | Predicted outcome if tested today | Action | Who takes it (`designpowers` agent) |
|---|---|---|---|---|
| T2 | Typed size ignored under a preset; fields keep showing the typed numbers | Completed wrong | UX-01 | design-builder |
| T4 | Floor not visible on arrival; camera resets when a tool is chosen; placing can't be stopped; a click outside the room places a product and reports success | Failed, or completed wrong | UX-05 with the cutaway, QA-01, QA-02, UX-04 | design-builder; design-lead for floor and wall contrast |
| T4 | The chosen finish never appears in the room | Failed | Picker UX-16 | design-builder |
| T7 | No visible way to open a project on a fresh profile | Failed (second half) | QA-04 | design-strategist for placement in the empty state; design-builder |
| T5 | Nothing can be selected or moved | Failed, or completed with difficulty by delete and re-place | UX-09 | design-builder; design-lead for the selection state |
| T7 | Nothing says where the room is kept | Completed with difficulty | Copy, **?** dialog "Files & saving", Phase 4 item 1 | content-writer |
| T1 | Materials below the fold; picker is a two-item text select | Completed with difficulty | UX-07, Picker UX-14 | design-strategist, design-builder |
| T3 | Developer wording ("derive candidates", "underlay") | Completed with difficulty | Copy Phase 1 | content-writer |
| All | Keyboard and screen-reader paths to the canvas don't exist | Failed for a keyboard-only participant in T4 and T5 | UX-08 "Add to room", UX-13, QA-09 | design-builder, then accessibility-reviewer |
| All | Feedback lands outside the visible panel | Adds hesitation everywhere | UX-04 | design-builder; motion-designer for the toast under reduced motion |

### Recommendation

**Iterate before testing.** This rests on inspection and scripted checks, not on participants: on today's build one of the eight tasks (T4) can't succeed at all, and three more (T2, T5, T7) succeed only through a workaround the UI doesn't suggest. Fix the minimum set in §2, run the pilot, then run round 1.

---

## 14. Decisions for Adrian

| ID | Question | Default taken here |
|---|---|---|
| D-UT1 | Test the fixed build only, or both builds per participant? | Fixed build only (§2) |
| D-UT2 | Which roles in round 1? | Designers and home users (§5) |
| D-UT3 | In person, remote by shared control, or host the build? | In person or shared control. Hosting publishes the build and needs a yes |

**Sources used for method:** the two skills' own references (Krug, *Rocket Surgery Made Easy*; Tullis and Albert, *Measuring the User Experience*) and the research report §7. No statistics from them are quoted here.
