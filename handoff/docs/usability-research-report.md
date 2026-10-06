# Room Vibez — usability research: flow segmentation, catalog browsing, Roomle and Planner 5D patterns

**Date:** 2026-10-05 · **Requested by:** Adrian · **Skill:** `/design:user-research`
**Rule held:** nothing invented. Where I have no evidence the item says **Unknown**.

---

## 0. What this is, and what it is not

| | |
|---|---|
| **This is** | An **expert usability review** of the live Catalog 3D viewer (browser at 1024×768, `http://127.0.0.1:18767/`) and its code, plus **first-hand observation of Roomle's public editor** and a **documentation reading of Planner 5D**. |
| **This is not** | Research with users. **No participants, interviews, surveys or analytics were used.** There are no user quotes here and no claim about what users prefer. The flows in §3 are derived from what the app can do and from the personas already in the project docs. They are **not validated**. §7 is the plan to validate them. |

**Evidence tags used throughout**

| Tag | Meaning |
|---|---|
| **M** | Measured in the live app this session (script or screenshot) |
| **C** | Read from code or project docs, not executed |
| **O** | Observed first-hand on a competitor's real product this session |
| **D** | Documented on a competitor's official page (fetched this session) |
| **S** | Search-result snippet only; I could not open the source page |
| **U** | Unknown |

**Related documents (read these with this one)**

- `fixes/ux-improvements-handoff.md` — another session's handoff (items **UX-01 to UX-13**). It already specifies workspace segmentation (UX-07), a task-ordered Room workspace (UX-08), selecting placed products (UX-09) and a "verify first" item on finishes (UX-10). **I did not duplicate it.** This report uses its IDs where it agrees and adds **UX-14 to UX-16**.
- `fixes/ux-copy-improvements.md` + `docs/ux-copy-deck.md` — the wording.
- `docs/flow-stress-test-report.md` — behaviour and error audit. Not repeated here.
- The handoff for this report: `fixes/ux-catalog-picker-handoff.md`.

---

## 1. Your three asks, and the short answer

| Ask | Short answer |
|---|---|
| **Segment options by user flow. Room creation or upload only in the Room workspace.** | **Supported by the evidence, and already specified** by the sibling's UX-07. Today both workspaces share one 3,106 px column and the inactive one is only dimmed (M, C). I checked UX-07 against your rule and found **one gap**: a persistent "Import project" toolbar (UX-08) would show in Product. See handoff §4 A1. |
| **Browsing the object catalog should be a thumbnail drop-down with texture options.** | **Not covered anywhere yet.** Today it is a plain `<select>` with two text options, the product data has no thumbnail field, and the engine cannot make thumbnails (M, C). Roomle (O) uses thumbnail tiles. For Planner 5D, thumbnails are **Unknown**. This becomes **UX-14** (objects, with a thumbnail or list view) and **UX-15** (texture options). |
| **Combine Roomle and Planner 5D patterns.** | §5. The patterns that carry over are a task-split catalog, labelled thumbnail tiles, a selection-then-"Style" step for materials, and a single `?`. Several others are listed as deferred, with the reason. |

**Two interpretation calls, confirmed by Adrian on 2026-10-05:**

1. *"Room creation or upload"* = room files, plans and sketches for rooms only. **Product** uploads (3D model, pack, module, texture) stay in the Product workspace.
2. *"thumbnail drop-down with texture options"* = thumbnail pickers for **objects** and for the **material lists** that are text-only today (wall, floor, texture target). The per-slot swatches stay inline but get labels. **New requirement from Adrian:** consider switching between thumbnails and a list, "for ease of use under more use cases". Added as a view toggle (handoff UX-14 step 2b, DT8). **I have no evidence yet on which view users prefer**; §7 has a probe.

---

## 2. Method and coverage

**Done**

- Read: `index.html`, `src/styles.css`, the workspace, slot, placement and ingress code in `src/main.ts`, `src/viewer/{types,library,slots,RoomVibezViewer}.ts`, `public/assets/library/*.json`, the e2e specs, `ASSUMPTIONS.md`, the copy deck §1–3, the stress test, `catalog-room-toggle-ux.md`, `persona-formats-and-planner5d-full-plan.md`, and both sibling handoffs.
- Ran the app: cold load, Room workspace, created a room, placed a chair, measured element positions with a script.
- Roomle: fetched official docs and marketing pages; opened a **public shared sample plan** linked from `roomle.com/en/floorplanner` ("Plan now") and its editor, without logging in. Looked at the catalog overlay (Construction, Products, Rooms tabs) and the `?` help.
- Planner 5D: fetched official help pages *Catalogue Menu (Web)*, *How to navigate through Planner 5D*, *How to Edit an Object*, and public marketing pages.

**Not done (so don't assume it)**

- **Any user research.** See §0.
- **Planner 5D's editor was not observed.** "Start a project" goes straight to a sign-up page (Google / Apple / email). **I did not create an account.** Everything about Planner 5D below is **D** or **S**.
- **Roomle:** I did not click a catalog tile (it would add an item to a public plan). My click on a plan object did not register as a selection. So **how Roomle presents material or finish options is Unknown to me.** I did not accept cookies or create an account there either.
- Placement in the live app used the test hook `window.__rv.simulateRoomPointer`, not a real canvas click.
- Not checked: mobile widths (the stress test measured 0 px overflow at 375 px), screen readers, Safari/Firefox, real-GPU WebGL.
- The Planner 5D custom-texture article returned 404 when fetched directly; its content below is **S** (from a search snippet).

---

## 3. Flows (derived, not validated)

Derived from the app's own capabilities. The persona names come from `persona-formats-and-planner5d-full-plan.md` (consumer, designer, architect, reseller). **Whether these are the flows real users run is Unknown.**

| # | Flow | Lives in | Today's cost (M, 1024×768; sidebar 649 px tall) |
|---|---|---|---|
| FL1 | Look at a product and try finishes | Product | Product picker 982 px down; Materials 1,835 px down |
| FL2 | Make a room from scratch | Room | First card, but it stays open above the tools afterwards |
| FL3 | Start from an existing plan file | Room | Same card, second tab |
| FL4 | Start from a saved template | Room | Same card, third tab |
| FL5 | Furnish the room with chosen finishes | Room | Place button 1,602 px down; the picker for *what* to place is in the Product card, 1,777 px down |
| FL6 | Keep the work (export / import project, plan PNG) | Room | Mid-card |
| FL7 | Add my own model or texture | Product | Three upload blocks plus a separate Add texture card, 1,258 to 2,290 px down |

---

## 4. Findings

Severity is **my judgement**. "Sibling" means `fixes/ux-improvements-handoff.md`.

| ID | Finding | Evidence | Sev. | Handled by |
|---|---|---|---|---|
| **UR1** | The default (Product) workspace opens on the **Room creation form**. The first sidebar card is `room-card`. The product picker starts at **982 px**, Materials at **1,835 px**, Light preset at 2,704 px. Total sidebar height **3,106 px**, about 4.8 times the 649 px viewport. | **M** | High | Sibling UX-07 |
| **UR2** | The inactive workspace's controls are **dimmed (opacity 0.72), not hidden, and fully usable**. This was a deliberate earlier decision (`catalog-room-toggle-ux.md`: "dims the other, still usable"). | **M** (computed opacity 0.72) · **C** (`styles.css:181-188`) | High | Sibling UX-07 |
| **UR3** | In the Room workspace, **what to place is chosen in a different card.** `placeCurrentProduct` places `currentProduct`, which only the Product card's `<select>` sets. With a room present: Place button at 1,602 px, picker at 1,777 px, sidebar 3,901 px (6.2 times the 633 px viewport). | **M** · **C** (`main.ts`: `placeCurrentProduct`, `productSelect` change handler) | High | Sibling UX-08 |
| **UR4** | After a room exists the creation form stays open above the tools: Draw walls at 1,207 px, Openings at 1,440 px. | **M** · **C** (`renderRoomUi` only toggles `roomTools.hidden`) | Med | Sibling UX-08 |
| **UR5** | Room workspace with no room still shows the demo chair on the stage. | **M** (screenshot 02) | Med | Sibling UX-06 |
| **UR6** | **Object catalog = a native `<select>` with 2 text options.** `Product` has **no thumbnail, category or maker field**, and the engine has **no thumbnail capability** (renderer created with `preserveDrawingBuffer:false`; no `toDataURL`/`toBlob` anywhere in `src/` or `scripts/`). | **M** · **C** (`index.html:243`, `types.ts`, `RoomVibezViewer.ts:125`) | High for your ask | **New: UX-14** |
| **UR7** | **Texture options are text-only or tiny.** Wall and floor materials are `<select>`s with **14 text options each**; the Add-texture target is another text select. Per-slot swatches are 34 px circles with the name only in a tooltip. Options per slot today: 3 to 6. | **M** (14 options) · **C** (`renderSlots`, `library.json`) | Med-High | **New: UX-15** |
| **UR8** | **A finish chosen in Product does not reach a placed product, and the placed product is not textured at all.** After picking Walnut for the Frame (card shows "Walnut"), creating a room and placing the chair: `slot_bindings.frame` = **`wood-oak`** (the default), and the placed chair's 14 meshes use material **`placeholder_frame`, colour `#e7e7e7`, no texture**. Flat grey on a pale room. The design docs say placements carry `slot_bindings` (`room-from-scratch-feasibility.md:126,165`); `updatePlacement` exists in the engine but `main.ts` never calls it. | **M** | **High** | Sibling UX-10 (**confirmed here, and wider than it states**) → **UX-16** |
| **UR9** | Placed products cannot be selected, moved or re-finished. The list offers a name and Delete. In the 2D plan a placed chair is a plain dark square. | **C** · **M** (screenshot 03) | Med-High | Sibling UX-09 |
| **UR10** | **Predicted, not observed:** once UX-07 hides the Materials card in the Room workspace, there is **no way to choose a finish while furnishing** without switching workspace and back. | **C** (reasoning from UX-07 + `placeCurrentProduct`) | Med | **New: UX-16 step 3** |

**Protect these (they work):** per-slot filtering by allowed material category (`materialsForSlot`), so a picker never offers an invalid material; failures that leave the room intact (stress test R7); undo/redo; honesty labels.

---

## 5. Pattern evidence: Roomle and Planner 5D

### 5.1 Roomle (O unless marked)

Opened a public shared sample plan, then its editor at `roomle.com/app/editor/<plan id>`, with no login. Screenshots 04 to 08 (see §8).

- **Editor chrome is icon-only.** Top centre: undo, redo, text, add image, ruler, **?**, settings, print. Top right: close. Bottom left: area (71 m²), fit-to-screen, zoom slider. Bottom centre: **2D, 3D, walk** view icons.
- **One large red `+` button** on the right opens the catalog.
- **The catalog is a full-screen overlay** with four top tabs: **Construction · Products · Rooms · Brands**, plus search and close. The active tab is bold. The URL changes with the tab (`…/catalog/rooms`, `/construction`, `/products`).
- **Left category rail, then a labelled thumbnail grid.** Construction: Doors, Windows, Stairs, Fences, Heating, Cubes, Garage. Products: Seating, Tables, Storage, Beds, Lighting, Miscellaneous, Mockup furniture. Rooms: Living room, Dining room, Bedroom, Kitchen, and more.
- **Tiles are four across: thumbnail, a small grey maker line, then the product name.** Sections have sub-headings ("Barstools"). A **"Show all >"** link ends a row.
- **Doors and windows are catalog items with thumbnails** in the Construction tab, not a toggle plus numbers.
- **`?` opens a 10-step modal** ("Setup your floor plan") with Close, Next and Feedback. The first step is a YouTube video.
- **Selecting an object (documented, D):** "select any item in the room to access its full configuration parameters instantly" (`roomle.com/en/documentation/overview-room-designer`). **How that looks is Unknown to me.**
- **Catalog structure (D):** products are grouped by **tags** set in Roomle's admin; materials use a separate material root tag per wall, floor, door, window and object (`docs.roomle.com/.../rubens-room-designer/getting-started`). The page names no UI elements.

### 5.2 Planner 5D (D unless marked)

Editor not observed (sign-up wall, screenshot 09). From *How to navigate*, *Catalogue Menu (Web)* and *How to Edit an Object*:

- **Web left menu:** Search · Build · Interior · Exterior · Favorites · New · Import · Shop. Mobile and desktop apps list Rooms, Construction, Interior, Exterior, Search.
- **Top of the editor:** **2D / 3D** switch. Upper left: All floor plans, Floor menu, Undo, Redo.
- **Adding objects:** "click or drag it to add to your plan." Construction objects are doors, windows, stairs, roofs. **Whether catalog items are shown as thumbnails is not stated** on those pages.
- **Selecting an object** shows a selection box and a context toolbar. Web: **Style**, Duplicate, Favorite, Center, Flip, Delete, Rotate, Levitation (3D only). **Style** "opens material and appearance options." The pages **do not say how materials are laid out**.
- **Start options (marketing page):** template, blank canvas, or upload a plan (JPG, PNG, PDF, DWG, DXF) for AI recognition.
- **Custom textures (S):** Roller icon, then Personal, then New; images 512×512 to 1024×1024 px. On the free plan: 5 textures for walls and floors, and customizing objects needs a paid plan.
- **Catalog size claims (marketing/S):** figures such as "4,000+", "8,000+" and "8,400+" items appear on different pages and disagree. I did not rely on any.

### 5.3 What carries over

| Pattern | Roomle | Planner 5D | Use in Room Vibez |
|---|---|---|---|
| Split the catalog by **task**, not one list | **O** Construction / Products / Rooms / Brands | **D** Build / Interior / Exterior | Matches the sibling's Build then Furnish order (UX-08). Validates it. A "Construction" group for doors and windows is **deferred** (openings are empty cutouts today: A20/U15). |
| **Labelled thumbnail tiles** for browsing | **O** thumbnail + maker + name | **U** | **UX-14**: tile = thumbnail + name. No maker line, because `Product` has no maker field. |
| **Search** in the catalog | **O** magnifier icon | **D** Search first in the left menu | Show a search box only when the list is long. Threshold is **undecided**. |
| **List view** as an alternative to thumbnails | not seen (thumbnail grids only) | **U** | Adrian's request (2026-10-05), **not from either competitor**. UX-14 step 2b. |
| **Category rail / grouped sections** | **O** | **U** | Data-driven: shows only when products have categories. **None do today.** |
| **Select an item, then a "Style" step** | **D** "select any item… configuration" | **D** context toolbar with **Style** | **UX-16b** (after UX-09): select a placed product, then a Finish choice. |
| **Doors and windows as catalog items** | **O** | **D** (Construction objects) | **Deferred** (U15). |
| **2D / 3D as canvas modes** | **O** bottom-centre icons | **D** top switch | **Deferred.** Our 2D plan is a small SVG in the sidebar. A stage-level 2D view is a new camera mode. |
| **Single `?` for help** | **O** 10-step modal | **D** "Training session" in the top menu | Already the direction in the copy handoff. Evidence supports it. Roomle's version is steps with video; ours is tabs. Not a conflict. |
| **Favorites** | — | **D** left menu + object toolbar | **Deferred.** Not requested. |
| **Catalog state in the URL** | **O** | **U** | **Deferred.** |
| **Account wall before the editor** | not seen (a shared plan opened without login) | **O** sign-up page before "Start a project" | Not a pattern to copy. Observation only: the app has no accounts, so first value comes before any sign-up. |

### 5.4 What neither source tells me (U)

How Roomle shows material choices; whether Planner 5D shows catalog items as thumbnails; how either handles very long catalogs on small screens; how either behaves with a user's own uploaded model; what real users of either do first. **I have no data on whether these patterns work for Room Vibez's users.**

---

## 6. Proposals (summary; steps are in the handoff)

| ID | Proposal | Why (reasoning) | Trade-off |
|---|---|---|---|
| **UX-14** | **Drop-down for the object catalog, with thumbnail and list views.** A trigger showing the current product's thumbnail and name opens a grid of labelled tiles. The native `<select id="product-select">` stays as the state holder, so the 8 test calls that use it keep working. | Recognition over recall (UR6). Roomle (O) does it. | Needs thumbnails the app cannot make today. Spike first; the list view is the fallback if it fails. **No evidence yet on which view users prefer.** |
| **UX-15** | **Texture options as thumbnails.** Same picker for wall, floor and texture-target. Slot swatches stay **inline** but get visible labels and larger targets. | Wall and floor lists are 14 text options (UR7). Slot swatches are pinned by `viewer.spec.ts:54,56,90`; a closed dropdown there would break the only e2e spec that is safe to run, and each slot has only 3 to 6 options. | Slots stay one click, but the library will outgrow inline swatches. Revisit then. |
| **UX-16** | **Make the finish real in the room.** Apply library materials to placed products, snapshot the current choices into `slot_bindings`, and show the Materials card in the Room "Place products" step. | UR8 and UR10. Without it, texture options in the catalog are cosmetic. | Needs a **new viewer method**: the existing material code is private and tied to the turntable. Effort **Unknown**; spike first. |

---

## 7. Validation plan (needs people; not something Claude can run)

**Question to answer:** do the segmented sidebar and the thumbnail pickers reduce wrong-place clicks, scrolling and time on task, compared with today's build?

- **Participants:** 5 to 8 is the usual range for a qualitative usability test (research-skill reference). **The right mix across consumer, designer, architect and reseller is undecided.** Recruiting channel: **Unknown.**
- **Format:** moderated, think-aloud, one session per person, current build vs. fixed build, order alternated. At this size, report patterns and task times, **no statistics**.
- **Tasks (no hints):**
  1. "Find the side table and see it with a marble top." (FL1)
  2. "Make a 5 × 4 m room." (FL2)
  3. "Start a room from this plan image." (FL3)
  4. "Put two chairs in the room, one with a walnut frame." (FL5; exposes UR8)
  5. "Change the floor to marble." (UR7)
  6. "Save your work so you can pick it up tomorrow." (FL6)
  7. "Add your own model." (FL7, from inside the Room workspace)
- **Measure:** completed or not, time, clicks on the wrong workspace's controls, panel scroll distance (scriptable), a 1-to-5 confidence rating after each task.
- **View probe (thumbnails vs list):** in tasks 1, 4 and 5 don't tell participants a list view exists. Note whether they find the toggle, which view they use first, and whether they switch. In the reaction segment ask what each view is good for. Include a run where thumbnails are unavailable (placeholders only). **Don't read a preference into 5 to 8 sessions.** Use the probe to decide the default and whether the toggle stays.
- **Interview guide** (skill structure, 50 minutes): warm-up 5 · how they plan or furnish a room today, which tools, whether they hold plan files 10 · tasks 20 · reaction: show the old select and the new picker, ask what each one tells them 10 · wrap-up 5. Don't ask about Roomle or Planner 5D unless the participant uses them.
- **Open:** consent wording, data handling and incentives are **Unknown**.

---

## 8. Reproduce and evidence

**Environment:** in-app browser, viewport **1024×768**, dev server `http://127.0.0.1:18767/`, `localStorage` as left by earlier sessions on first load. The sibling's baseline used 1440×900, so absolute px differ; the shape (Materials about 2 screens down) agrees.

**Measurement script** (paste in the console; offsets are from the top of `.panel`):

```js
(() => {
  const panel = document.querySelector('.panel'), pr = panel.getBoundingClientRect();
  const top = el => el && el.offsetParent !== null ? Math.round(el.getBoundingClientRect().top - pr.top + panel.scrollTop) : null;
  const ids = ['room-card','btn-create-room','btn-draw-wall-mode','btn-opening-mode','btn-place-mode','product-select','slots','presets','parts-list'];
  return { workspace: document.body.dataset.workspace, viewport: [innerWidth, innerHeight],
    panelClientHeight: panel.clientHeight, panelScrollHeight: panel.scrollHeight,
    firstCard: panel.firstElementChild.id,
    offsets: Object.fromEntries(ids.map(id => [id, top(document.getElementById(id))])) };
})()
```

**Finish carry-over test (UR8):** in a fresh load, click `.slot[data-slot="frame"] .swatch[data-material="wood-walnut"]`; click `#workspace-mode button[data-mode="room"]`; click `#btn-create-room`; run `__rv.simulateRoomPointer({kind:'floor',point:{x:0,y:0,z:0}},'place')`; then read `__rv.roomGraph().placements[0].slot_bindings` and traverse `__rv.viewer().scene` for objects with `userData.placementId`, listing `material.name` and `material.color`.

**Screenshots (9), captured this session.** They are in the session scratchpad, **not in the project**, because the agent shell cannot write inside the project. Say the word and I will save them to `media/usability-research/`.

| File | Shows |
|---|---|
| 01-catalog3d-product-cold-load | Product workspace; Room form first in the sidebar |
| 02-catalog3d-room-workspace-no-room | Room workspace, no room, chair still on stage |
| 03-catalog3d-room-created-chair-placed | Room created, chair placed (dark square in 2D plan; chair not visible in 3D) |
| 04-roomle-editor-2d-plan | Roomle editor chrome |
| 05, 06, 07-roomle-catalog-… | Roomle catalog: Rooms, Construction, Products |
| 08-roomle-help-walkthrough-modal | Roomle `?` modal |
| 09-planner5d-signup-wall | Planner 5D: sign-up before the editor |

**Sources fetched**

- Roomle: `docs.roomle.com/rubens/rubens-products/rubens-room-designer/getting-started`; `docs.roomle.com/llms.txt`; `roomle.com/en/floorplanner`; `roomle.com/en/documentation/overview-room-designer`.
- Planner 5D: `support.planner5d.com/en/articles/5876855-catalogue-menu-web`; `/5876772-how-to-navigate-through-planner-5d`; `/16944106-how-to-edit-an-object`; `planner5d.com/interior-design-app`; `planner5d.com/blog/guide-to-creating-floor-plans/`.
