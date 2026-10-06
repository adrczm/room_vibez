# Getting started

## Requirements

- Node.js 18 or newer (developed and tested with Node 24 on macOS).
- A browser with WebGL. Chromium is the only browser the test suite covers; Safari and Firefox have not been checked.
- For the end-to-end tests only: Google Chrome installed (Playwright drives it with software WebGL).

## Run the viewer

```bash
cd hackathon-3d-viewer
npm install
npm run dev
```

Open http://127.0.0.1:18777/. The dev server uses `--strictPort`, so "port in use" means a server is already running there; open the page instead.

Mac: `hackathon-3d-viewer/Start Viewer.command` does the same with a double-click (macOS may ask you to right-click → Open the first time). If the page says the browser could not start WebGL, use `Start Viewer (software 3D).command`, which needs Google Chrome. Windows: `Start Viewer.bat`. Details in [QUICKSTART.md](../hackathon-3d-viewer/QUICKSTART.md).

## Build

```bash
npm run build      # type-check, then production build to dist/
npm run preview    # serve dist/ on http://127.0.0.1:18778/
```

## Run the prototype

`prototypes/room-vibez-planner-flows/index.html` is a static page; open it in a browser. It loads Three.js and fonts from public CDNs (unpkg.com, fonts.googleapis.com), so it needs an internet connection. It is a click-through of the wider planner's flows, not the viewer, and it says so on screen.

## A note on saved data

The app saves your room and templates in the browser's storage for its origin. A different port is a different origin, so a room saved at `:18777` is not visible at `:18778`, and the reverse. Uploaded models, textures and plans are kept only until you refresh; use **Export project** to keep a room as a file.
