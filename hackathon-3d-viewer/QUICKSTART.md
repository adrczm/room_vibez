# Quickstart — run the Room Vibez 3D viewer on another computer

1. **Install Node.js** (LTS, version 18 or newer) from https://nodejs.org if it isn't installed.
2. **Unzip** the archive anywhere.
3. **Start it:**
   - **Mac:** double-click `Start Viewer.command`. The first time, macOS may block it: right-click the file, choose **Open**, then click **Open**.
     - If the page says the browser could not start WebGL, use `Start Viewer (software 3D).command` instead. It needs Google Chrome.
   - **Windows:** double-click `Start Viewer.bat`.
   - **Any OS, from a terminal:** `npm install` then `npm run dev`, then open http://127.0.0.1:18777/
4. The first run downloads dependencies (needs internet, takes about a minute). The browser then opens the viewer.
5. To stop the viewer, close the terminal window that opened.

See `README.md` for what the viewer does and how it's built.
