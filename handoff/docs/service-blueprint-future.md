# Room Vibez — service blueprints (as-is → future)

**Date:** 2026-10-05 · **Method:** `ux-strategy:service-blueprint` — as-is first, future second; one narrow scenario per blueprint.
**Rule followed:** nothing invented. Every cell carries an evidence tag; future-state cells are **proposals** and name the decision that gates them.

| Tag | Meaning |
|---|---|
| **[B]** | Built — works in the local MVP (README, `built-vs-left-checklist.md` §A) |
| **[S]** | Stub / mock / placeholder (e.g. `STUB-…` SKUs, `mock_fixture` extract, prototype `(stub)` buttons) |
| **[N]** | Not built (checklist §B) |
| **[U]** | Unknown / undecided — cited by its `U#` from `ASSUMPTIONS.md` |
| **⚠** | Defect or gap found by the stress test — IDs refer to [`flow-stress-test-report.md`](./flow-stress-test-report.md) |
| **▲** | Proposal for the future state (not a decision) |

**Swim lanes (top → bottom):** Physical evidence · User actions · *— line of interaction —* · Frontstage · *— line of visibility —* · Backstage · *— line of internal interaction —* · Support processes.

**Not yet validated with anyone.** The skill's last step is to review with operations, engineering and support. The folder doesn't say who owns ops or support for Room Vibez, so this has been checked against the repo's docs and the running app only — **Unknown who should review** (see §5).

---

## Blueprint A — Room to BOM

**Scenario:** *An interior designer builds a room, furnishes it with configurable catalog pieces, and hands a bill of materials to a client.* Designer is the primary role; consumer, architect and reseller variants differ at steps 1–3 and 6 (the prototype has role cards, but the roles change almost nothing downstream).

**Sources:** `hackathon-3d-viewer/README.md` + `ARCHITECTURE.md`, `docs/built-vs-left-checklist.md`, `docs/missing-features-blocked.md`, `prototypes/room-vibez-planner-flows/`, stress-test results.

### A1. As-is (what exists today)

| | **1 Arrive** | **2 Bring a room** | **3 Confirm the room** | **4 Furnish & configure** | **5 Review the BOM** | **6 Hand off** | **7 Come back later** |
|---|---|---|---|---|---|---|---|
| **Physical evidence** | Role cards + email field (prototype) [S]. Catalog 3D has no sign-in screen | Room workspace tabs: From scratch / Import plan / From template; unit + preset pickers [B] | Import review list + SVG overlay; banner `[mock_fixture] ODA available: no` [B] | 3D stage; per-slot swatches; parts-list panel [B] | Parts list with `STUB-…` SKUs, no prices [B]. Prototype BOM with € totals [S] | PNG plan download; project JSON file [B]. PDF / GLB buttons say "(stub)" [S] | Nothing — only the same browser profile |
| **User actions** | Opens the local viewer, or picks a role | Chooses an ingress; types a size, or uploads DWG/DXF/JPG/PNG/JSON | Accepts or rejects wall/opening candidates; confirms scale against a known length | Places GLBs on the floor, adds door/window cutouts, swaps finishes per slot | Reads the parts list | Downloads the plan PNG / exports project JSON | Reopens the app and hopes the room is still there |
| ─ *line of interaction* ─ | | | | | | | |
| **Frontstage** | None — no auth [N] | Field validation + status line [B]. "PDF plan ingest needs a rasterizer…" message [B] | Honest "mock" banner [B]. ⚠ candidates default to **Accepted** (R4, E4) | Soft collision warning, wall-snap, undo/redo [B]. ⚠ keyboard path to place: none (A4) | `rv:partlistupdate` event → panel [S] | Download buttons [B] | Restores the room from `localStorage` if present [B]. ⚠ no notice if it can't save or can't read (E2, R6) |
| ─ *line of visibility* ─ | | | | | | | |
| **Backstage** | — | `createRectangularRoom` → RoomGraph [B]. DWG "extract" = labeled mock [S]; real ODA/APS [N] | Candidates → `normalizeRoomGraph` → RoomGraph; uploaded DWG kept as SourceAsset (sha256) [B]. DWG furniture blocks ignored [B] | Slot binding (extras → sidecar → `slot_<id>__` name), COLOR_0 split for MJS packs, library category filter [B] | `buildPartsList` [S]. ⚠ slot→material choices are **not** in the BOM (A8) | SVG→PNG; JSON serializer [B] | `persistRoomGraph` → `localStorage` (+ IndexedDB best-effort) [B]. ⚠ write errors are swallowed (E2) |
| ─ *line of internal interaction* ─ | | | | | | | |
| **Support processes** | No auth service [N] | `localStorage` templates [B]. ODA SDK / APS: unavailable here [N, U3] | `normalizeRoomGraph` is lenient — accepts `null` coordinates ⚠ (R6) | `catalog.json` / `materials.json` stand-ins [S]. Demo GLBs pre-baked by `build-assets.mjs` [S]. Slot convention in production [U2] | No pricing, ERP or SKU/material_slot DB [N, U9] | No PDF renderer, share link or order flow [N] | No projects backend, auth or multi-user [N / U] |

### A2. Failure points in the as-is blueprint

Reading across the lanes, where the front stage promises more than the back stage delivers:

| # | Where | Gap | Evidence |
|---|---|---|---|
| 1 | Step 7 | Frontstage implies "your room is kept"; backstage can silently fail to save, and a bad saved room strands the app on every reload with a message about a *model* | E2, R6 (`F1`, `F3`) |
| 2 | Step 3 | Frontstage "confirm" is a one-tick gate; backstage has no real extraction behind it (mock), and the tick survives a new file | R2, R4, E4 (`P05`, `V08`) |
| 3 | Step 4 → 5 | A central feature (per-slot finishes) is collected on stage and **dropped** before the BOM | A8 (`P14`) |
| 4 | Step 5 | Prototype totals show € prices while the repo's own policy says no invented prices | K6 |
| 5 | Step 2 | Same 5 × 4 m room gives different walls depending on the unit selected (thickness 1.2 mm in cm) | K1 (`F8`) |
| 6 | Step 6 | Hand-off to a client has no durable artifact — PDF/share are stubs; the BOM is a panel | A8, T1 |

**Fragility — one support dependency carrying a lot:** `localStorage` is the only persistence for the room, the templates and recovery (steps 2, 7); `catalog.json` + `materials.json` define every SKU and slot (steps 4, 5); ODA/APS availability gates every *real* plan import (step 3).

**Long stretches with no user touchpoint:** the prototype's recognition step is a timed animation with no real work behind it; any real recognition or conversion in the future will make the user wait — step 3 and Blueprint B step 2 need an explicit "what's happening / how long / what if it fails" design.

### A3. Future state (proposal)

Drawn from the repo's own "left to build" list (checklist §B) plus fixes from the stress test. **▲ = proposal.** Gating decisions are named in each cell.

| | **1 Arrive** | **2 Bring a room** | **3 Confirm the room** | **4 Furnish & configure** | **5 Review the BOM** | **6 Hand off** | **7 Come back later** |
|---|---|---|---|---|---|---|---|
| **Physical evidence** | Sign-in / account screen; role-aware start ▲ | Same three ingress tabs; progress + failure states for uploads ▲ | Review screen showing **provenance** (sample vs measured) per wall ▲ | 3D stage + a keyboard path to place and move ▲ | BOM table: SKU · variant (slot → material) · qty · price ▲ | PDF / plan PNG / share link / GLB package ▲ | "Your projects" list; autosave status ▲ |
| **User actions** | Signs in or continues as guest | Picks ingress; uploads | Reviews per wall; confirms scale; can't skip on a new file | Places, snaps, configures finishes | Checks lines and totals | Sends to client / orders | Opens a project from any device |
| ─ *interaction* ─ | | | | | | | |
| **Frontstage** | Auth UI [N → ▲] | Specific, recoverable errors (golden library G-01…G-11) ▲ | "Reviewed" resets on every new result ▲ | Soft/hard collision per U17; opening SKUs per U15 | Placeholder-price label until commerce exists ▲ | Branded, formal client document ▲ | Honest save state; "saved / not saved / read-only" ▲ |
| ─ *visibility* ─ | | | | | | | |
| **Backstage** | Identity + session | Ingest job queue; SourceAsset storage | Extract with confidence/provenance; human-confirm records | Slot binding + configurator rules (beyond "allowed categories") | BOM snapshot (immutable per share) ▲; variant resolution | Document render; email/share service | Projects API; conflict handling; versioned room graph |
| ─ *internal* ─ | | | | | | | |
| **Support processes** | Own auth backend [N] | Object storage + job runner; ODA vs APS vs hybrid [U3]; PDF rasterizer decision | ODA Drawings/Architecture SDK entity extract [N, U3]; strict `normalizeRoomGraph` ▲ | Production SKU / material_slot / materials DB [N, U9]; CDN, Draco/Meshopt/KTX2/LOD [N, U10] | Commerce / ERP / pricing SoR [N] | PDF renderer; share-link service | Projects backend [N]; multi-user is **Unknown** as a requirement |

---

## Blueprint B — Catalog supply: a furniture SKU becomes configurable and purchasable

**Scenario:** *A catalog operator takes a supplier's furniture asset and turns it into a SKU a customer can place and re-finish.* This is the backstage-heavy half of the service — Blueprint A's step 4 and 5 depend on it. **Who performs this today is Unknown** (the prototype's "Reseller / ops" role is the nearest match; U1 covers DCC export quality).

**Sources:** `README.md` (scripts), `ARCHITECTURE.md` §4–5, `docs/glb-mjs-pack-conversion-approach.md`, `docs/obj-upload-catalog-3d-pipeline.md`, `docs/final-supported-file-formats.md`, `missing-features-blocked.md`.

### B1. As-is

| | **1 Receive the asset** | **2 Validate & normalize** | **3 Tag material slots** | **4 Register SKU & bind materials** | **5 QA in the viewer** | **6 Publish** |
|---|---|---|---|---|---|---|
| **Physical evidence** | Files on disk: `.glb` / `.gltf` / `.obj`+`.mtl`+maps / Polyfork-style `.mjs`+`.glb` pack | Upload status line in the viewer | Slot swatches; parts list; slot warnings panel | Edits to `catalog.json` / `materials.json` by hand [S] | 3D turntable; light presets | Nothing — session-only Object URLs |
| **User actions** | Drops files onto **Add 3D model** / **Load pack** | Reads status; retries | Adds `extras.material_slot_id`, a `*.slots.json` sidecar, or `slot_<id>__` names | Adds a catalog row + slot definitions | Spins, swaps finishes, checks warnings | Refreshes the page → upload is gone |
| ─ *interaction* ─ | | | | | | |
| **Frontstage** | Accepts GLB/glTF/OBJ; rejects FBX/USDZ/.blend with an alternatives message [B] | Raw parser errors for bad files ⚠ (E1, `V05`) | Fallback `surface` slot for untagged meshes [B] | — | `slot-warnings`: missing / unknown / untagged [B] | None [N] |
| ─ *visibility* ─ | | | | | | |
| **Backstage** | In-browser parse; OBJ → session GLB [B]; `.mjs` runs only after confirm + static scan [B] | Missing normals computed; missing UVs warned [B] | Slot resolution: extras → sidecar → name; MJS COLOR_0 zones split into real slot meshes [B] | Catalog reconciliation (`bindSlots`) [B] | Category rules enforced per slot [B] | `npm run assets / farm / stub-mjs / bake-color0` are **local scripts**, not a service [S] |
| ─ *internal* ─ | | | | | | |
| **Support processes** | Supplier's DCC export quality [U1] | No Draco/Meshopt decoders [N] | Production slot convention [U2]; farm-bake vs runtime split [U13] | Schema is a guess in `types.ts` [U9] | — | No server farm, object storage, catalog DB or CDN [N] |

### B2. Future state (proposal)

| | **1 Receive** | **2 Validate & normalize** | **3 Tag slots** | **4 Register & bind** | **5 QA** | **6 Publish** |
|---|---|---|---|---|---|---|
| **Physical evidence** | Upload with job status ▲ | Validation report (what passed / what to fix) ▲ | Slot map preview | SKU record form ▲ | QA checklist + preview | Live in catalog; version history ▲ |
| **User actions** | Uploads a supplier package | Fixes or re-uploads | Confirms slot map | Confirms SKU, categories, defaults | Signs off | Publishes / retires |
| ─ *interaction* ─ | | | | | | |
| **Frontstage** | Accepted formats stated up front; others redirected (G-10) ▲ | Plain-language results, never parser text (G-01) ▲ | Slot proposals the operator can edit | Warnings for slots not in catalog | Pass/fail with reasons | "Published" with what changed |
| ─ *visibility* ─ | | | | | | |
| **Backstage** | Intake queue | Normalize, validate, compress, LODs | Auto-tag + bake zones (or keep runtime split — U13) | SKU + `material_slot` + materials write | Automated preview render | Register to catalog DB; push to CDN |
| ─ *internal* ─ | | | | | | |
| **Support processes** | Object storage; supplier format policy (FBX/BLEND/… "later") | Server conversion farm [N]; Draco/Meshopt/KTX2 pipeline [N, U10] | Slot SoR decision: extras vs sidecar vs name [U2, open] | Production SKU/material DB [N, U9]; sandbox or review policy for user `.mjs` [U11]; legal review of Polyfork `.mjs` in a cloud pipeline [open] | AR (USDZ) toolchain if wanted [U8] | Catalog persistence + CDN [N]; commerce link for price/stock [N] |

**Not to build as a fake** (from checklist §C): `.mjs` generated from OBJ, DWG as furniture, fake ODA/APS fidelity.

---

## 3. Reading both blueprints

- **Frontstage promises backstage can't keep:** the six gaps in A2.
- **Dense backstage clusters:** slot binding + COLOR_0 split + MJS guardrails (Blueprint B, steps 3–5) concentrate the hardest logic in a few files (`slots.ts`, `packs.ts`, `splitZones.ts`, `modules.ts`); worth automating and testing first as they move server-side.
- **Single points of failure:** `localStorage` (A, steps 2 and 7); `catalog.json`/`materials.json` (A4–5, B4); ODA/APS access (A3); the person running `npm run farm` (B6).
- **Waiting without a touchpoint:** recognition/conversion jobs (A3, B2) — design status, time expectation and failure path before building them.

## 4. Decision gates for the future state

| Future-state item | Blocked by | Existing ID |
|---|---|---|
| Real plan extraction (A3) | ODA vs APS vs hybrid; ODA membership | U3 |
| BOM variants (A5) | slot / SKU / material schema | U9 |
| Durable catalog + CDN (A4, B6) | texture/compression targets; storage | U10 |
| Slot tagging in production (B3) | extras vs sidecar vs name; farm bake vs runtime split | U2, U13 |
| Opening SKUs, collision (A4) | door/window SKUs required?; hard vs soft | U15, U17 |
| Untrusted `.mjs` (B4) | production policy; sandbox; legal review | U11, open |
| AR (B5) | USDZ pipeline | U8 |
| Auth, projects, multi-user (A1, A7) | product decision — multi-user is **Unknown** as a requirement | checklist §B.3 |
| Plan data handling (A2–3) | where plans are processed, retention | **new** — see report §7 Q6 |
| Voice, localization, accessibility target | not decided anywhere | **new** — report §7 Q1, Q7, Q8 |

## 5. Suggested build order (recommendation, not a decision)

Ordered by blueprint dependency — each step unblocks the next and the first three need **no** new infrastructure:

1. **Make the existing steps truthful** — save-state honesty and safe boot (A7), real confirm gate (A3), unit-switch fix (A2). These are the code-only fixes among the A2 gaps (1, 2, 5, and the price label in 4); gap 3 needs a decision and gap 6 needs new services.
2. **Put configuration into the BOM** (A4 → A5) — needs the U9 decision, not new services.
3. **Voice + error-copy standard and accessibility baseline** — cheap now, expensive after more screens exist.
4. **Auth + projects backend** (A1, A7) — unlocks real persistence and everything per-user.
5. **Conversion farm + catalog DB + CDN** (Blueprint B) — unlocks real SKUs; depends on U1, U2, U9, U10, U13.
6. **Commerce link and real prices** (A5, A6) — depends on 5 for SKUs.
7. **Real DWG extraction** (A3) — depends on U3 and a corpus of real client DWGs (Unknown).

**Validate with (owners Unknown):** whoever runs catalog ops, whoever would build the farm/ingest, whoever handles customer support, and one real designer and one reseller. The blueprint should be corrected by them before it's used to plan work.

*Next:* turn the gating questions here and in the report's §7 into a decision map with `/wayfinder` (it's user-invoked, so send it as its own message).
