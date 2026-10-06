# Room Vibez — flow stress-test report

**Date:** 2026-10-05 · **Method:** `system-behavior-shaping:stress-test`, adapted to flows (see §0) · **Rule followed:** facts only; where the folder is silent the item is labeled **Gap** or **Unknown**, not invented.

**Targets**

| Target | What it is | Where |
|---|---|---|
| **Viewer** | Catalog 3D — Three.js viewer + room workspace (scratch / import plan / template), running at `http://127.0.0.1:18767/` | `hackathon-3d-viewer/` |
| **Prototype** | Static click-through: role → project → upload plan → editor → BOM | `prototypes/room-vibez-planner-flows/` |
| Coohom captures | Competitor observation only (README: "not RV spec") — **not stress-tested** | `diagrams/`, `screenshots/` |

---

## 0. How this was run, and one honest adaptation

`stress-test` is written for an **AI persona** (voice, tone rules, a conversational surface). This folder has **no persona or voice spec**, and the only AI-like surface is the prototype's "AI recognition (illustrative)" step, which is a timed animation. So I:

1. Derived the product's **de facto system voice** from its copy and docs (§1) — labeled *derived, not decided*.
2. Mapped each persona step (emotion, tone, culture, errors, consistency) onto the **moments in the flows where that dimension shows up** — failed uploads, lost work, blocked features, confirm gates, error copy.
3. Where possible, **measured** the behavior with scripts instead of reasoning about it. Evidence tags used below:

| Tag | Meaning |
|---|---|
| **M** | Measured by script in an isolated Playwright Chrome profile (ID = result in `docs/stress-test/out/*/results.json` or script output) |
| **C** | Read from code/docs, not executed |
| **D** | Design-only — no surface exists to measure |

**Measured volume:** 52 scripted observations (27 prototype `P*`, 16 viewer `V*`, 9 follow-ups `F*`) plus the existing unit suite — **66/66 Vitest tests pass** (`npx vitest run`, 18 files).

**Corrections made while testing (so you can trust the rest):**
- `V09` first label was wrong: the **`.mjs` enable flag is checked by default**, so the confirm dialog is the real gate, not the flag (`F2` re-test).
- `V10`'s first pass matched unrelated page text; re-tested tightly as `F3`.
- Locale/decimal-comma tests (`F4a`) and text-in-number-field cases in `V01` were **invalid** — `<input type=number>` blocks them in a real browser — and were removed from the scripts.
- A script bug briefly created a stray `Room%20Vibez` folder on the Desktop; it held only generated output, was moved into `docs/stress-test/out/`, and is gone.

**Concurrent edits:** another session changed `hackathon-3d-viewer/src/main.ts` and `src/viewer/RoomVibezViewer.ts` at 13:51 today (cold boot now lands on **Product**; see `docs/model-display-deep-qa-fix.md`). All `V*`/`F*` viewer measurements were taken **after** that edit and `F1` still reproduces; unit tests were re-run afterwards and still pass (66/66). Prototype results are unaffected. If the viewer changes again, re-run the scripts in §8.

**Not done:** the existing Playwright e2e suite (`npm run test:e2e`) was **not run** — its specs write screenshots to hardcoded `~/Library/Application Support/Cursor/AgentStores/...` paths outside this project. Also untested: real GPU WebGL (SwiftShader only), Safari/Firefox, a screen reader, real DWG files, Coohom flows.

---

## 1. Step 1 — The "persona" (derived)

| Dimension | What the folder shows | Source |
|---|---|---|
| **Core traits** | Honest-labeling; engineering-literal; refuses to look more capable than it is | banners `[mock_fixture] ODA available: no`, `(stub)`, `(illustrative delay)`, `Unknown / not in public Planner docs` |
| **Voice** | Two voices: Viewer = terse, technical status lines; Prototype = warm marketing hero ("Plan rooms. Place real products. Own the BOM.") plus research-note labels | `main.ts` status text; prototype `index.html` |
| **Tone rules** | **None documented** (no tone matrix, no error-copy standard) | — |
| **Domain** | 3D furniture catalog, room authoring, DWG/plan ingest, BOM. Roles: consumer, designer, architect, reseller/ops | prototype role cards; `persona-formats-and-planner5d-full-plan.md` |
| **Guardrails** | No native-CAD claim; no fake ODA/APS fidelity; no invented prices/SKUs/SLAs; DWG never furniture or SoT; `.mjs` trusted-local only; human confirm on imports | `ASSUMPTIONS.md` "Explicitly NOT claimed"; `built-vs-left-checklist.md` §C |

**Gaps in the persona itself** (these drive most findings): no owner for voice; no rule for what happens to the user's work when something fails; no localization stance; research jargon and end-user copy share one surface.

---

## 2. Scenario inventory and expected responses

**Result key:** ✅ Pass · 🟡 Partial · ❌ Fail · ⬜ Gap (no surface / undecided), followed by severity **High / Med / Low** where something failed.

### A. Emotional edge cases (emotional-design)

| ID | Scenario (flow moment) | Ev. | Result | Observed | Expected persona-consistent response |
|---|---|---|---|---|---|
| E1 | **Escalating frustration, 3 turns** — three failed uploads in a row | M `V05`, `F5b` | 🟡 Med | Each bad file leaves the app `ready` and unchanged (good) but shows raw parser text — `Unexpected token '\u0000'… is not valid JSON`, `Invalid typed array length: 4` — with no change of approach or exit offered as failures pile up | **T1** "That file isn't a valid GLB, so nothing was added. Try a .glb or .obj, or keep the demo chair." **T2** (different angle) "Still unreadable — compressed GLBs (Draco/Meshopt) may not load here. Re-export uncompressed, or send the .obj." **T3** (offer an exit) "Let's skip the upload: continue with the demo chair, or start from a blank room." |
| E2 | **User in distress** — deadline, work at risk when browser storage is blocked/full | M `F3`, C `roomGraph.ts` | ❌ **High** | `persistRoomGraph` swallows the failure (`// session-only fallback`); no visible warning after creating a room with storage blocked | Calm, specific, one action: "This browser won't let me save. Your room is safe while this tab stays open — **Export project** now." No crisis surface exists; if a free-text assistant is ever added it needs crisis-resource routing (D). |
| E3 | **Anger at the system** — "Start over wiped my project" / "I can't remove the chair I misplaced" | M `P20`, `P17` | ❌ **High** | Prototype `Start over` = `location.reload()`, no confirm, sits next to the primary button; no Delete/Backspace/Undo, no deselect, no move | Prevent, don't apologize after: "Start over discards 3 placed items. Export first?" Plus delete/undo so a misplacement is a one-step fix. |
| E4 | **Manipulation** — a designer with a client waiting pressures the tool to present an import as exact | M `V08`, `P06` | 🟡 Med | Banner is honest (`mock_fixture`, `ODA available: no`), but wall candidates show as **Accepted** by default; prototype always reports "4.2 m × 5.1 m · 2 openings" | Hold the label: "This is a sample extract — ODA isn't available, so I can't mark it measured. Confirm the scale against a known length to continue." Candidates start **Unreviewed**. |
| E5 | **Conflicting signals** — "love the 3D view, but where's my table?" | M `P18`, `P19` | ❌ Med | 3D view always renders one hard-coded chair; a placed table never appears (Three.js and CSS fallback alike) | Acknowledge, then be straight: "3D currently previews one sample chair only; other placed items aren't drawn yet." |

### B. Tone boundaries (tone-calibration)

| ID | Scenario | Ev. | Result | Observed | Expected |
|---|---|---|---|---|---|
| T1 | **Max formality** — BOM handed to a client / reseller | M `P14` | ❌ Med | Totals `€498` with no "illustrative" tag; lede says only "system-of-record demos"; export buttons are stubs; ASSUMPTIONS A6 says no prices anywhere | Formal and exact: SKU, variant (finish per slot), qty, unit price; a visible "Placeholder prices — not a quote" line until a commerce SoR exists. |
| T2 | **Max warmth** — first run, empty states | M `P01`, `P02` | 🟡 Low | Empty states are kind ("No lines yet — place catalog items."); but an email pre-filled with `alex@example.com`, and a status pill that reads "Not signed in" until a role is picked, then "Consumer" — though no sign-in or account exists | Warm and honest: "No account needed for this preview." |
| T3 | **Playful → serious switch** — cycling light/render presets, then an irreversible action | M `P20` | ❌ Med | No transition; destructive button is styled as the primary action | Tone steps down before the irreversible step (confirm dialog, plain wording). |
| T4 | **Ambiguous audience** — disabled buttons read as research notes | M screenshot `P14` | ❌ Med | "Planner official template hub — Unknown / not in public Planner docs", "CAD export IFC/DWG — Partial / beta in public Planner docs", "Live ERP stock — Unknown…" shown to end users | User-facing: "Not available yet". The research label stays in docs. |
| T5 | **Unsupported tone requested** — "make the client copy playful / emoji / luxury" | D | ⬜ Med | No tone settings, nothing to say what's supported | **Decision needed** — define the supported range (see §7). Until then: default formal-plain for client documents. |

### C. Cultural edge cases (cultural-adaptation)

| ID | Scenario | Ev. | Result | Observed | Expected |
|---|---|---|---|---|---|
| C1 | **High-formality-culture user, casual copy** ("Start over", "Studio soft", "Warm loft") | C, D | ⬜ Low | One register, English, casual; no formality control | Plain neutral-formal default in client-facing outputs; avoid slang in UI. |
| C2 | **Idioms / localization** | C `grep` | ❌ Med | **0** i18n/locale references in `src/`; `<html lang="en">`; prototype hard-codes `€` | Externalized strings; currency and units chosen by user, not hard-coded. |
| C3 | **Culturally and personally sensitive content** — room naming/layout assumptions (e.g. prayer rooms, separate kitchens, shoes-off entries) and a home floor plan as personal data | C `README`, D | ⬜ Med | Presets are only Small bedroom / Living / Studio; plans currently stay in-browser ("session only") — **no data policy exists for when recognition becomes server-side** | Neutral room vocabulary, user-editable names, and a plain statement of where an uploaded plan goes and how long it's kept — decided *before* any AI/ODA service exists. |
| C4 | **Language / code-switching** — non-Latin and mixed file names, mixed units | M `F4c`, `P03`, `F8`; screenshot `F1` | 🟡 Med | ✅ `客厅 沙发.obj`, `كرسي.obj`, `café table (final) v2.obj` load and label correctly. ❌ a 300-char project name stretches the prototype page to **2611 px** at 1280. 🟡 form fields show `2,7` (browser locale) while status text always prints `2.70 m`; `ft-in` is actually *decimal feet* (option text says so) | Truncate long names; one number-formatting rule across fields and status lines; label "feet (decimal)" clearly or parse ft-in properly. |

### D. Error recovery (error-personality)

| ID | Scenario | Ev. | Result | Observed | Expected |
|---|---|---|---|---|---|
| R1 | **System states something wrong, user calls it out** | M `V01` | 🟡 Med | A 1 mm room is accepted and reported as `0.00 m × 0.00 m`; a **1,000,000,000 m** room is accepted. Zero/negative/blank are rejected | Reject or ask: "That's 1 mm wide — did you mean cm?" Set min/max room size. |
| R2 | **Misunderstood three times** — recognition keeps giving the same answer | M `P06`, `P05` | ❌ **High** | Any file → "≈ 4.2 m × 5.1 m living room · 2 openings". Re-picking a file keeps **"Dimensions look right" ticked** and the Confirm button enabled | Reset review on every new result; after the 2nd miss, put "Skip AI · manual draw" first (it exists — keep it). |
| R3 | **Asked to do what it can't** (PDF, FBX, USDZ, .blend, IFC) | M `F5a`, `F5b` | 🟡 Med | ✅ PDF: "PDF plan ingest needs a rasterizer (e.g. pdf.js) or a pre-rendered PNG/JPG. Upload PNG/JPG for underlay confirm." ✅ FBX/USDZ/.blend: "Select a .glb, .gltf, or .obj file…". ❌ **`.ifc` through Import plan is accepted** and produces a mock-fixture result | Redirect pattern everywhere: say it's not supported, say what works. Reject unknown types before the mock path. |
| R4 | **Hallucination noticed** — garbage in, plausible plan out | M `V08`, `V08b`, `P07`, `P08` | ❌ **High** | A file of random bytes named `.dwg` yields 3 "Accepted" walls (5.00 m / 4.00 m); a renamed `setup.exe` also gets `source mock_fixture:setup.exe`; prototype runs "Recognizing PNG…" on a `.txt` and "Recognizing DWG…" on a 0-byte file | Validate before mock extract: "This doesn't look like a DWG (no version header). Nothing was imported." Banner stays. |
| R5 | **Wrong/blaming error copy** | M `V01`, `F1` | ❌ Med | "Room size must be positive (length, width, ceiling height, wall thickness)" for a single blank field. A corrupt saved **room** shows "Could not load model: Cannot read properties of undefined (reading 'x')" | Name the field. Own the cause: "Your saved room couldn't be read." |
| R6 | **Poisoned saved state** — corrupt `catalog3d.roomGraph` | M `V02c`, `F1` | ❌ **High** | A graph with `null` coordinates and `ceiling_height:"tall"` passes `normalizeRoomGraph`, then crashes `renderRoomUi` at boot. `data-viewer-status=error` on **both reloads tested**; the bad key is still in storage afterwards; the visible message blames a "model" | Quarantine the key, start empty, and say so: "Your saved room couldn't be read — started fresh. [Download the bad data]". Harden `normalizeRoomGraph` (finite numbers, ≥3 polygon points, positive thickness). |
| R7 | **Bad project import** | M `V04` | ✅ (copy 🟡) | 5/5 bad files (non-JSON, wrong schema, `[]`, empty, NaN walls) rejected; **the existing room survived every time** | Keep the non-destructive behavior; plain-language the message ("room_graph failed normalizeRoomGraph" → "This project file's room data is damaged"). |
| R8 | **Corrupt template list** | M `V03a`, `V03b` | 🟡 Med | `{bad` handled; `[1,null,{"x":1},"str"]` triggers an uncaught `Cannot read properties of undefined (reading 'walls')` while the list renders empty | Validate each entry; skip and report bad ones. |

### E. Consistency (behavioral-consistency)

| ID | Scenario | Ev. | Result | Observed | Expected |
|---|---|---|---|---|---|
| K1 | **Same question, different ways** — a 5 × 4 m room | M `F6`, `F7`, `F8` | ❌ **High** | Preset ≡ custom(m) ≡ fixture-import (identical geometry). But switching units to **cm** leaves *Wall thickness* at `0.12` → read as 0.12 cm → **walls 1.2 mm thick** (`0.0012 m`); length/width/ceiling fields also keep their old numbers | Convert all fields on unit change (or lock units after create). Same input → same room, whatever unit. |
| K2 | **Long session / drift** | M `V06`, `P13`, `P04`, `P15` | 🟡 Med | ✅ 40 rapid toggles: ready, 1 canvas. 🟡 400 placements take 2.4 s (full re-render each time), 2,668 DOM nodes. ❌ Prototype state leaks: create-from-template → Back → "Blank" → **chair still present**; changing a *table's* wood finish changes the next *chair's* default | State resets when the project is re-created; finish defaults per SKU, not global. |
| K3 | **Off-topic input stays in character** | M `V08b`, `F5a`, `P07`, `P08`, `P25` | ❌ Med | Junk files get plausible mock results; picking **Architect** then "Open demo project" silently becomes **Interior designer** | Unknown input → polite rejection; never silently override a user choice. |
| K4 | **Adversarial: break the guardrail** | M `V09`, `F2`, `P03` | ✅ | `.mjs` containing `fetch(...)`: confirm dialog names the flags ("fetch(, absolute http(s) URL"); **dismiss = refuse, nothing runs**; flag off → clear message. `<img onerror>` in a project name renders as text, no script ran | Keep. (Static scan is not a sandbox — already stated in README.) |
| K5 | **Voice across surfaces** | C | 🟡 Med | Viewer is "Catalog 3D" (neutral); prototype is "Room Vibez" (marketing + research labels). History log says brand is "Catalog 3D only" | One voice doc covering both. |
| K6 | **Policy consistency** — "no invented prices" vs UI | M `P14`, C `ASSUMPTIONS A6` | ❌ Med | Prototype shows €249 / €179 / €498; Viewer parts list is `STUB-…` with no prices | Label as placeholder or remove until a commerce SoR exists. |

### F. Platform robustness (found in passing; not a persona step)

| ID | Scenario | Ev. | Result | Observed | Expected |
|---|---|---|---|---|---|
| A1 | Upload zone — keyboard | M `P10` | ❌ Med | `role=button tabindex=0`, but **Enter and Space do not open the picker** | Activate on Enter/Space. |
| A2 | Upload zone — drag & drop | M `P09` | ❌ Med | Says "Drop or click"; **no drag/drop handlers** and `dragover`/`drop` aren't default-prevented, so a real drop will likely make the browser open the file and leave the page | Handle drop, or remove the claim. *(Event-level result; I did not perform a real OS drag.)* |
| A3 | ARIA state | M `P22` | 🟡 Low | `role=listbox/option` with no `aria-selected` after picking; step chips have no `aria-current`; focus is still on the now-hidden Continue button right after the screen change (measured immediately) | Expose selection; move focus to the new screen's heading. |
| A4 | 3D canvas | M `V12` | ❌ Med | Canvas has no `tabindex`, `role`, or label; placement is pointer-raycast only (`onRoomPointer`) | Label the stage; provide a keyboard path to place/move (D). |
| A5 | Mobile 375 px | M `P23`, `V11` | Viewer ✅ / Prototype ❌ | Viewer: 0 px overflow in both workspaces. Prototype: **140 px** (auth) and **153 px** (editor) | Fix prototype layout. |
| A6 | History / deep links | M `P21` | ❌ Low | No URL or history entry per screen (`hash` empty); browser Back leaves the prototype | Route per screen. |
| A7 | Editor tools | M `P11`, `P12`, `P16`, `P17b` | ❌ Med | Items can be placed far **outside the room polygon**; "Draw wall" ignores where you click (same fixed polygon every time); no deselect; no drag-to-move | Either implement or label as demo-only. |
| A8 | BOM carries configuration | M `P14` | ❌ **High** | Two chairs, walnut and ash → **one line "CHAIR-LOFT-01 × 2 €498"**, no finish info anywhere | BOM lines = SKU + slot→material variant. Needs the U9 schema decision. |
| A9 | Repeat actions | M `P24` | 🟡 Low | "Apply starter template" ×5 adds 5 more tables | Idempotent, or say "already applied". |

**Inventory size:** 5 + 5 + 4 + 8 + 6 + 9 = **37 scenarios** (minimum was 20).

---

## 3. Vulnerability assessment — where it is weakest

Ranked by (severity × how likely a real user meets it):

1. **Work-loss paths with no warning** — silent storage failure (E2/F3), poisoned saved state that never clears (R6), `Start over` without confirm and no undo/delete in the prototype (E3), no history per screen (A6). *The product can lose or strand a user's room and say nothing, or say something misleading.*
2. **Results that look real but aren't** — hard-coded 4.2 × 5.1 m detection (R2), stale "Dimensions look right" (R2), junk files → "Accepted" walls (R4), `.ifc`/`.exe` through the mock path, placeholder prices unlabeled (K6, T1). *This runs against the project's own "do not invent" rule, and the confirm gate that is meant to catch it can be passed without reviewing.*
3. **The BOM drops the product's core idea** — material-slot configuration never reaches the BOM (A8).
4. **A silent correctness bug** — cm unit switch yields 1.2 mm walls (K1).
5. **Error copy is raw and sometimes mislabeled** (E1, R5, R7).
6. **Accessibility and input handling** — keyboard, drop, ARIA, canvas (A1–A4); **mobile** in the prototype (A5).
7. **No localization stance** (C2, C4) and **no voice owner** (T4, K5).

**Strengths worth protecting:** failures are *non-destructive* (R7: 5/5 bad imports kept the room; V05: viewer stays `ready` after 5 broken uploads); the `.mjs` guardrail holds (K4); honest banners (`mock_fixture`, PDF-rasterizer message); preset ≡ custom ≡ import parity (K1); Unicode names work (C4); viewer has no mobile overflow; viewer has undo/redo.

---

## 4. Consistency score (1–5)

Rubric: **1** multiple high-severity failures · **2** a high-severity failure or several medium · **3** medium failures only, with good containment · **4** minor issues · **5** none found. Judgment based on the inventory above, not a statistic.

| Category | Viewer | Prototype | Why |
|---|---|---|---|
| Emotional handling | **2** | **1** | Viewer: silent storage failure; but undo/redo + export exist. Prototype: no undo, no confirm, no way to remove an item. |
| Tone calibration | **3** | **2** | Viewer is consistently neutral; prototype leaks research-note copy to users and has no formal mode. |
| Cultural adaptation | **2** | **1** | Units + Unicode names are real strengths; zero i18n, locale/format inconsistency; prototype hard-codes €/English and overflows. |
| Error recovery | **2** | **1** | Viewer contains failures well but has the poisoned-state **H** and raw copy. Prototype has almost no recovery paths. |
| Behavioral consistency | **3** | **2** | Viewer: honest-label policy mostly held; cm bug is the exception. Prototype: state leaks, hard-coded outputs, role overwritten. |
| **Overall** | **2.4** | **1.4** | |

---

## 5. Top 5 recommendations

Effort labels are rough guesses (S ≈ hours, M ≈ days), not estimates from the team.

1. **Make persistence honest and boot safe** *(R6, E2, K-class)* — wrap boot so a bad `catalog3d.roomGraph` is quarantined and the user is told; tighten `normalizeRoomGraph` (finite numbers, ≥3 polygon points, positive thickness/ceiling); show a banner when `localStorage` writes fail, with **Export project** as the action. **M**
2. **Make the confirm gate real** *(R2, R4, E4, K3)* — reset "reviewed" whenever a file or result changes; start candidates **Unreviewed**; reject unknown/corrupt files before the mock path (`.ifc`, `.exe`, garbage `.dwg`); replace the hard-coded "4.2 × 5.1 m" with a labeled **sample** or real computed values. **S–M**
3. **Carry configuration into the BOM and label prices** *(A8, K6, T1)* — variant lines (SKU + slot→material); a visible "placeholder prices" note until commerce exists. Label = **S**; variant model = **M** and needs the U9 schema decision first.
4. **Write the missing voice and error-copy standard** *(E1, R5, T4, K5)* — one page: voice traits, a four-part error template (what happened · what was kept · why · next step), a rule that parser text and research labels never reach users. The golden library in §6 is a starting set. **S**
5. **Edit-safety and accessibility baseline for the editor** *(E3, A1–A7)* — undo/delete/deselect/move, confirm on destructive actions, Enter/Space + drop on the upload zone, `aria-selected`/`aria-current`, a labeled and keyboard-reachable 3D stage, route per screen, min/max room size (R1). **M**

**Two small correctness bugs to fix now, outside the top 5:** unit switch must convert (or reset) the wall-thickness and size fields (K1/`F8`); long project names must not widen the page (C4/`P03`).

---

## 6. Suggested additions to the golden response library

*Target wording for a spec that does not exist yet — not current behavior. "Keep" = already good in the code today.*

| ID | Trigger | Say | Never say |
|---|---|---|---|
| G-01 | Model file unreadable (GLB/OBJ) | "That file couldn't be read as a 3D model, so nothing was added. Try a .glb or .obj." | `Unexpected token '\u0000'… is not valid JSON` |
| G-02 | 2nd failed upload, same file type | "Still not readable. Compressed GLBs (Draco/Meshopt) may not load here — re-export uncompressed." | Repeating G-01 |
| G-03 | 3rd failed upload | "Let's skip the upload for now: use the demo chair or start from a blank room." | Silence / the same error a third time |
| G-04 | Saved room unreadable at start | "Your saved room couldn't be read, so I started fresh. [Download the damaged data]" | `Could not load model: Cannot read properties of undefined (reading 'x')` |
| G-05 | Browser storage blocked/full | "This browser won't save your work. It's safe while this tab stays open — **Export project** now." | (nothing — currently silent) |
| G-06 | Destructive action | "Start over discards 3 placed items. Export first, or discard?" | A primary-styled button that wipes work |
| G-07 | Mock/sample plan extract | **Keep:** "[mock_fixture] ODA available: no — … not entity …" **Add:** "Sample result — confirm the scale against a known length." | "Detected 4.2 m × 5.1 m" as if measured |
| G-08 | Invalid dimension | "Length needs a number above 0 (you entered 0)." | "Room size must be positive (length, width, ceiling height, wall thickness)" for one field |
| G-09 | Implausible size | "That's 1 mm wide — did you mean 1 cm?" / "Over 100 m? Check the unit." | Accepting and printing `0.00 m` |
| G-10 | Unsupported format | **Keep:** "PDF plan ingest needs a rasterizer … Upload PNG/JPG." **Add** same shape for `.ifc`, `.fbx`, `.usdz`. | A mock result for a type that isn't supported |
| G-11 | Disabled / unavailable feature | "Not available yet." | "Unknown / not in public Planner docs" in the UI |
| G-12 | Untrusted `.mjs` | **Keep:** "Load trusted .mjs module…? This executes JavaScript in the page… Static scan flagged: …" | — |
| G-13 | BOM / price display | "Placeholder prices — not a quote." | Totals with no qualifier |
| G-14 | Pressure to present as exact | "I can't mark an import as measured while it's a sample extract." | Removing or softening the banner on request |

---

## 7. Decisions this report cannot make (inputs for `/wayfinder`)

These are *questions*, not tickets. Several already appear as **Unknown** in `ASSUMPTIONS.md` / `built-vs-left-checklist.md` §D.

1. **Voice:** is the Room Vibez voice the viewer's neutral-technical one or the prototype's warmer one — and who owns it? (T4, K5)
2. **Persistence promise** in the browser-only phase: "session only", or "autosaves"? What must happen when it can't? (E2, R6)
3. **What does "reviewed" mean** for an imported plan — per-wall, per-file, scale-only? (R2, R4; relates to U3 ODA vs APS)
4. **Prices before an ERP exists:** show placeholders (labeled) or hide? (K6, T1)
5. **BOM variant model:** how do slot→material choices become purchasable variants? (A8; U9, U13)
6. **Plan data policy:** where uploaded plans are processed and how long they're kept, *before* any server-side recognition. (C3)
7. **Localization scope:** languages, currencies, unit input (decimal feet vs ft-in) for first real users. (C2, C4)
8. **Accessibility target** for the 3D editor and a keyboard path to placement. (A1–A4)
9. **Which UI is canonical** for flows — the prototype or the Catalog 3D room workspace? They disagree (two brands, different capabilities, different bugs). (K5)
10. **Bounds:** min/max room size and whether collisions stay soft (U14, U17). (R1)

---

## 8. Reproducing

Needs Node and the installed Google Chrome (as in the viewer's `playwright.config.ts`). The viewer scripts need the dev server on `:18767`.

```bash
cd "/Users/adrian/Desktop/Room Vibez/docs/stress-test"
node stress-prototype.mjs            # P01–P25, static prototype, no server needed
node stress-viewer.mjs               # V01–V12
node stress-viewer-followup.mjs      # F1–F3
node stress-viewer-followup2.mjs     # F4c–F7
node stress-viewer-units.mjs         # F8
```

Outputs: `docs/stress-test/out/{proto,viewer}/` (screenshots + `results.json`). Scripts use isolated browser profiles and don't touch your Chrome data or any project source.
