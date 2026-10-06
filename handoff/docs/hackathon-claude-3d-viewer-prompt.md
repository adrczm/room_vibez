# HACKATHON PROMPT — Room Vibez 3D Viewer (for Claude)

**Audience:** Claude (or similar coding agent). Not a human briefing.  
**Mode:** Hackathon sprint — decide architecture from given constraints, then **build, test, and run locally** a working 3D viewer.  
**Hard rule:** Do **not invent** product requirements, vendor capabilities, or file-format support. If something is not in this prompt, mark it **Unknown** and choose the simplest safe assumption; document assumptions in `ASSUMPTIONS.md`.

---

## 0. Mission

1. Re-read this entire prompt and any linked project docs if present on disk.  
2. Propose / confirm a **minimal architecture** for a Room Vibez–style **catalog 3D viewer** (not a full room planner in this sprint unless time remains).  
3. **Implement** that viewer as a local web app.  
4. **Test** it (manual + whatever automated checks are practical).  
5. Leave a **running local URL** and clear run instructions.

Success = a stakeholder can open a browser, see a GLB product, orbit it, swap materials on named slots, and understand how it fits the wider Room Vibez architecture.

---

## 1. Product context (fixed)

**Room Vibez** bridges:
- customers buying / managing interior products,
- interior designers,
- architects,
- resellers.

**MVP product intent (broader than this hackathon):** full room editor + materials/lights + models DB.  
**This hackathon slice:** the **3D viewer / catalog placer foundation** (Rubens GLB Viewer–like), aligned with the owned stack — **not** a Planner 5D or Roomle embed.

Competitive notes (context only, not specs to copy blindly):
- Coohom was observed as a SaaS workbench; do not assume APIs you did not verify.
- Roomle Rubens publicly documents **Three.js + WebGL**, **WASM for vendor logic**, **GLB** assets, modules Viewer → Configurator → Room Designer. Room Vibez should **steal patterns**, not depend on Roomle WASM/API.

---

## 2. Locked technical decisions (must obey)

| Decision | Value |
|---|---|
| Realtime mesh engine | **Three.js only** (not Babylon dual-engine) |
| Catalog furniture runtime | **GLB** (from OBJ→conversion farm or native glTF) |
| Furniture materials | **Not embedded as SoR** — bind from a **materials library** via `material_slot_id` on named meshes |
| Lights | **Scene / render presets**, not per-SKU light rigs in furniture files |
| Architecture / empty rooms | **DWG** (+ PDF/JPG/PNG sketches) → room graph — **out of scope for viewer MVP** except as documented future hook |
| Catalog furniture format | **Must NOT be DWG** — mesh/GLB only, then **placed into** rooms later |
| BOM / SKU | Owned system of record (viewer may emit a stub parts list; do not fake a full ERP) |
| Design system for any UI chrome | Prefer **Shopify Polaris**-like tokens if you style UI (bg `#F1F1F1`, surface `#FFFFFF`, border `#E3E3E5`/`#E3E3E3`, text `#303030` / `#616161`, accent `#008060`) |
| Do not use | Planner 5D API / Roomle SDK **as the viewer runtime** for this hackathon (owned Three.js) |

---

## 3. Formats (viewer-relevant)

### Required for this hackathon
- **Ingest/display:** `.glb` / `.gltf`  
- **Optional demo source:** `.obj` + sidecar JSON mapping mesh name → `material_slot_id` **if** you also include a tiny offline convert step or preconvert to GLB before runtime  
- **Material library textures:** PNG/JPEG for baseColor (and optional normal/roughness if present)

### Explicitly out of scope for this sprint
- Native DWG editing/viewing in the viewer  
- Full AI floor-plan pipeline  
- ODA inWEB / Autodesk APS  
- Production conversion farm (you may stub or pre-bake 1–2 assets)

### Known MVP platform formats (for architecture notes only)
Plans: JPG/JPEG, PNG, PDF, DWG, DXF (+ manual draw).  
Furniture platform: OBJ+sidecar, GLB/glTF.  
Share: PDF/PNG, optional GLB.  
Planner 5D (if ever used later) does **not** equal full Room Vibez ingest — conversion farm fills gaps. **Unknown:** exact Planner Admin mesh list beyond public FAQ — do not invent.

---

## 4. Architecture you must target (owned core)

Use this as the north star (same IA as Room Vibez core diagram):

```text
[Auth · projects · commerce · BOM/SKU UI]     ← stub OK this sprint
        │
        ├─ Room editor (Three.js)             ← NOT required this sprint
        ├─ Catalog placer / 3D Viewer         ← **BUILD THIS**
        └─ Architect mode (optional)          ← stub / README only
                │
        [Conversion farm]                     ← stub or prebaked assets
                │
        [Databases: SKU · material_slot · materials · BOM · projects · presets]
```

**Viewer subsystem requirements (hackathon):**
1. Three.js WebGL canvas in host DOM.  
2. Load GLB from local `/public` or `/assets` (CDN later).  
3. Detect meshes / nodes; bind materials by `material_slot_id` (from glTF `extras`, node name convention, or sidecar).  
4. UI to switch library materials per slot (e.g. chair: wood frame, plastic handles, wool pillow — three slots).  
5. Orbit / zoom / pan controls.  
6. Light **preset** switcher (2–3 presets: e.g. studio soft, warm interior, neutral — keep simple).  
7. Lifecycle: init / dispose cleanly (SPA-friendly).  
8. Optional stretch: emit a stub `partsList` JSON when materials change (Rubens-like `onPartListUpdate` pattern).  
9. Optional stretch: AR via `model-viewer` / OS Quick Look or Scene Viewer **only if** you can do it without inventing asset pipelines; otherwise document as Unknown/future.

**Do not** implement a closed WASM configurator kernel. Prefer explicit TypeScript config/state.

---

## 5. Rubens patterns to steal (not copy)

From public Roomle Rubens docs (Three.js + WASM + api.roomle.com):
- Module ladder: Viewer → Configurator → Planner — **this sprint = Viewer (+ light material slots)**.  
- Host owns UI; engine owns canvas.  
- Parts-list events for commerce.  
- AR as OS handoff (USDZ/GLB) — optional.  
- Honest about WebGL/ES6 constraints.

**Critique to honor:** avoid vendor WASM opacity and API lock-in; keep BOM/SKU and materials DB owned; don’t confuse Room Designer with DWG SoT.

---

## 6. Deliverables (filesystem)

Create a new folder (prefer repo root or `/workspace` if empty project; if Desktop Room Vibez exists on the machine, you may place under `prototypes/hackathon-3d-viewer/`):

```text
hackathon-3d-viewer/
  README.md              # how to run, architecture decisions, unknowns
  ASSUMPTIONS.md         # every assumption + Unknowns
  package.json           # or equivalent
  src/ or app/           # viewer code
  public/assets/         # at least one multi-slot GLB (or generate a simple procedural stand-in + document limitation)
  tests/                 # smoke tests if feasible
```

Also write short:
- `ARCHITECTURE.md` — chosen stack, data flow, how slots work, what was deferred.

**Running:**
- Bind to an uncommon port (avoid 3000/5173/8080 if possible; e.g. `4173` or `18767`).  
- Leave the dev server running.  
- Print the local URL clearly.

---

## 7. Acceptance criteria

Must:
- [ ] `npm install && npm run dev` (or documented equivalent) works  
- [ ] Browser shows interactive 3D model (orbit)  
- [ ] At least **two material slots** can be changed independently from a library UI  
- [ ] Light preset can be changed  
- [ ] README explains mapping to Room Vibez core architecture  
- [ ] ASSUMPTIONS.md lists Unknowns (no silent invention)  
- [ ] No Planner 5D / Roomle SDK runtime dependency  

Should:
- [ ] Polaris-like visual styling for chrome  
- [ ] Stub parts-list callback / JSON panel  
- [ ] Basic automated smoke test (Playwright/Vitest/node canvas optional)

Must not:
- [ ] Claim DWG in-viewer support  
- [ ] Claim production AI floor-plan  
- [ ] Use Babylon as second engine  
- [ ] Embed secrets or fake vendor SLAs  

---

## 8. Suggested build order (hackathon timebox)

1. Scaffold Vite + Three.js + TypeScript.  
2. GLB loader + OrbitControls + resize.  
3. Slot discovery + material library JSON.  
4. UI for slots + presets (Polaris-ish).  
5. Dispose/lifecycle + README/ARCHITECTURE.  
6. Tests + polish.  
7. If time: parts-list stub, second demo asset, model-viewer AR link.

---

## 9. Unknowns (do not invent answers)

- Furniture client’s real DCC export quality / named groups reliability.  
- Whether glTF `extras` will carry `material_slot_id` vs name convention only.  
- Exact ODA vs APS vs hybrid-only for future DWG architect mode.  
- Whether product will embed Planner 5D or Rubens long-term (this sprint assumes **owned** viewer).  
- Production poly budgets — use Khronos planner-tier guidance (~40k tris/item when many items) as soft target only.  
- Roomle WASM internal scope — irrelevant; do not reverse engineer.

---

## 10. Tone for your working notes

Be a senior engineer: reason in ARCHITECTURE.md, cite this prompt’s locks, prefer boring reliable Three.js patterns (`GLTFLoader`, `RoomEnvironment` or simple lights, `MeshStandardMaterial`), and ship a demo that matches the specs above.

**Start now:** scaffold, implement, test, run locally, report the URL and file paths when done.
