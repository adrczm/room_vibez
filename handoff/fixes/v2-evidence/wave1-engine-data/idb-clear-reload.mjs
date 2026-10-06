// Task 6: create room -> Export project -> Clear room -> reload. Does the room come back?
// Run against the dev server on :18782. Records facts only.
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-data/node_modules/playwright/index.mjs';

const BASE = process.env.RV_BASE || 'http://127.0.0.1:18782/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ready = (page) => page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
const snap = (page) => page.evaluate(async () => {
  const idb = await new Promise((resolve) => {
    const req = indexedDB.open('catalog3d-local', 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
    req.onerror = () => resolve({ error: String(req.error) });
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('kv', 'readonly');
      const out = {};
      const keys = ['project', 'room_graph', 'updated_at'];
      let left = keys.length;
      for (const k of keys) {
        const r = tx.objectStore('kv').get(k);
        r.onsuccess = () => {
          const v = r.result;
          out[k] = v === undefined ? 'undefined' : v === null ? 'null' : k === 'project' ? { room_graph_walls: v.room_graph ? v.room_graph.walls.length : null, templates: v.templates?.length } : k === 'room_graph' ? { walls: v.walls?.length } : v;
          if (--left === 0) { db.close(); resolve(out); }
        };
      }
    };
  });
  const g = window.__rv.roomGraph();
  return {
    appRoomGraph: g ? { walls: g.walls.length, label: g.label, openings: g.openings.length } : null,
    localStorageRoomKey: localStorage.getItem('catalog3d.roomGraph') === null ? null : `${localStorage.getItem('catalog3d.roomGraph').length} chars`,
    idb,
    viewerStatus: document.body.dataset.viewerStatus,
    workspace: document.body.dataset.workspace,
  };
});

async function scenario(name, steps) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message().slice(0, 100)); d.accept(); });
  await page.goto(BASE);
  await ready(page);
  const out = { name };
  out['0 fresh profile'] = await snap(page);
  await steps(page, out);
  out.dialogs = dialogs;
  await ctx.close();
  console.log(JSON.stringify(out, null, 1));
  return out;
}

const createRoom = async (page) => {
  await page.locator('#workspace-mode button[data-mode=room]').click();
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
};
const exportProject = async (page) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#btn-export-project')]);
  await page.waitForTimeout(1200); // persistProjectToIdb is fire-and-forget (three sequential transactions)
  return dl.suggestedFilename();
};
const clearRoom = async (page) => {
  // The Clear button may be behind a confirm dialog in later builds; here it is a plain button.
  await page.locator('#workspace-mode button[data-mode=room]').click();
  await page.click('#btn-clear-room');
  await page.waitForTimeout(600);
};
const reload = async (page) => { await page.reload(); await ready(page); await page.waitForTimeout(800); };

// A. The question as asked.
await scenario('A: create -> export -> clear -> reload', async (page, out) => {
  await createRoom(page);
  out['1 after create'] = await snap(page);
  out.exportedFile = await exportProject(page);
  out['2 after export'] = await snap(page);
  await clearRoom(page);
  out['3 after clear'] = await snap(page);
  await reload(page);
  out['4 after reload'] = await snap(page);
  await reload(page);
  out['5 after second reload'] = await snap(page);
});

// B. Control: no export. Clear -> reload should stay empty.
await scenario('B (control): create -> clear -> reload, no export', async (page, out) => {
  await createRoom(page);
  await clearRoom(page);
  out['3 after clear'] = await snap(page);
  await reload(page);
  out['4 after reload'] = await snap(page);
});

// C. Is the returned room the exported snapshot or the latest state? Export, then add an opening, then clear, reload.
await scenario('C: create -> export -> add a door -> clear -> reload', async (page, out) => {
  await createRoom(page);
  out.exportedFile = await exportProject(page);
  await page.click('#btn-opening-mode');
  await page.evaluate(() => {
    const g = window.__rv.roomGraph(); const wall = g.walls[0];
    window.__rv.simulateRoomPointer({ kind: 'wall', wallId: wall.id, offsetAlongWall: 1.2, point: { x: 0, y: 1, z: wall.a.z } }, 'opening');
  });
  await page.waitForFunction(() => window.__rv.roomGraph().openings.length === 1);
  out['2 after adding a door (post-export)'] = await snap(page);
  await clearRoom(page);
  await reload(page);
  out['4 after reload'] = await snap(page);
});

await browser.close();
