# Catalog 3D — workspace mode control UX

**App:** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [http://127.0.0.1:18767/](http://127.0.0.1:18767/)  
**Date:** 2026-10-03  
**Decision:** **Recontextualize** (not remove).

## Problem

Header showed a gray segmented control labeled **Catalog | Room**. Chong read it as buttons that “don’t do anything in a clear manner.” The control was a real mode switch (product turntable vs room graph editor) but the chrome did not say so.

## Choice and why

**Preferred path: recontextualize.** Keep both Product and Room workspace capabilities; make the control read as navigation / mode switch:

- Uppercase **Workspace** label so the control is named as a mode, not a mystery toggle.
- Labels aligned with existing copy: **Product** (matches Product card) and **Room workspace** (matches Room workspace card).
- Live helper text under the control:
  - Product: *Product turntable — inspect GLB, materials, and packs.*
  - Room: *Room editor — build the shell, openings, and place Catalog 3D products.*
- Switching mode updates `body[data-workspace]`, emphasizes the matching sidebar card, dims the other (still usable), and scrolls that card into view.
- Two-column segmented layout (was sharing a 3-column grid with room-ingress).

**Remove rejected** because a single scroll page or sidebar-only CTA would bury one of the two canvas interaction modes without a clear “you are editing X” signal; both modes still need an explicit owner of the 3D stage.

## Preserved

OBJ / DWG / pack / room-from-scratch / import / template / placement flows unchanged. No features deleted. `#workspace-mode button[data-mode=…]` selectors kept for e2e.

## Verify

Chrome on :18767 (Playwright `channel: 'chrome'` + interactive Chrome pass). Shots in Project store `media/catalog-room-toggle-fix/`:

- `01`–`04` Playwright (full + header crops) + `verify.json`
- `05-chrome-product-selected.png` / `06-chrome-room-selected.png` — interactive Chrome confirm (both sidebars still present; mode helper updates)
- `07`–`08` additional Chrome crops

Interactive verify detail: store `internal/catalog-3d-ux-verification.md`.
