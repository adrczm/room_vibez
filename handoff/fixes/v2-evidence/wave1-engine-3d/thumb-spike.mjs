// UX-14 step 5 spike: run-time thumbnails next to the live viewer. Headless Chrome, SwiftShader.
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine/node_modules/playwright/index.mjs';
import pngjs from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine/node_modules/pngjs/lib/png.js';
import { writeFileSync, mkdirSync } from 'node:fs';
const { PNG } = pngjs;
const OUT = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/out-engine';
mkdirSync(`${OUT}/shots`, { recursive: true });
const res = {};
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  const all = [];
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = orig.call(this, type, ...rest);
    if (c && /^(webgl|experimental-webgl)/.test(type) && !all.some((e) => e.gl === c)) all.push({ gl: c, canvas: this });
    return c;
  };
  window.__gl = () => ({ created: all.length, live: all.filter((e) => !e.gl.isContextLost()).map((e) => ({ inDocument: e.canvas.isConnected, size: `${e.canvas.width}x${e.canvas.height}` })) });
  window.__lostEvents = 0;
  addEventListener('webglcontextlost', () => window.__lostEvents++, true);
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push('pageerror ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
await page.goto('http://127.0.0.1:18781/');
await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
await page.waitForTimeout(1500);
const gl = () => page.evaluate(() => window.__gl());
const woodOnViewer = async () => { const png = PNG.sync.read(await page.locator('#viewer-host canvas').screenshot()); let wood = 0; const d = png.data; for (let i = 0; i < d.length; i += 4 * 31) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 120 && g > 90 && b < 140 && r > g + 10) wood++; } return wood; };
const savePng = (name, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); writeFileSync(`${OUT}/shots/${name}.png`, buf); const png = PNG.sync.read(buf); let opaque = 0, wood = 0; for (let i = 0; i < png.data.length; i += 4) { if (png.data[i + 3] > 200) opaque++; const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2]; if (png.data[i + 3] > 200 && r > 120 && g > 90 && b < 140 && r > g + 10) wood++; } return { px: `${png.width}x${png.height}`, bytes: buf.length, opaquePct: +((opaque / (png.width * png.height)) * 100).toFixed(1), woodPx: wood }; };

res.contexts_boot = await gl();
res.viewerWood_before = await woodOnViewer();

await page.evaluate(async () => {
  const m = await import('/src/viewer/index.ts');
  window.__m = m;
  window.__mk = (extra = {}) => m.createThumbnailRenderer({ loadRoot: m.loadProductRoot, applyFinish: (root, p) => window.__rv.viewer().applySlotBindings(root, p), ...extra });
  window.__thumbs = window.__mk();
  window.__time = async (fn) => { const t = performance.now(); const v = await fn(); return { ms: +(performance.now() - t).toFixed(1), v }; };
});
res.contexts_afterCreate_beforeFirstRender = await gl(); // lazy: still viewer only

const first = await page.evaluate(() => window.__time(() => window.__thumbs.render(window.__rv.catalog().products[0])));
res.render_chair_cold = { ms: first.ms, ...savePng('thumb-chair', first.v), stats: await page.evaluate(() => window.__thumbs.stats()) };
res.contexts_afterFirstRender = await gl();
const second = await page.evaluate(() => window.__time(() => window.__thumbs.render(window.__rv.catalog().products[1])));
res.render_table_warm = { ms: second.ms, ...savePng('thumb-table', second.v), stats: await page.evaluate(() => window.__thumbs.stats()) };
const again = await page.evaluate(() => window.__time(() => window.__thumbs.render(window.__rv.catalog().products[0])));
res.render_chair_cached = { ms: again.ms, sameUrl: again.v === first.v, renders: (await page.evaluate(() => window.__thumbs.stats())).renders };

// warm re-render of the chair (cache dropped), 5 times: steady-state cost of one thumbnail
res.render_chair_warm_ms = await page.evaluate(async () => { const out = []; const p = window.__rv.catalog().products[0]; for (let i = 0; i < 5; i++) { window.__thumbs.invalidate(p.id); out.push((await window.__time(() => window.__thumbs.render(p))).ms); } return out; });

// 30 products through the queue (duplicates of the two demo products under new ids)
const many = await page.evaluate(async () => {
  const base = window.__rv.catalog().products;
  const list = Array.from({ length: 30 }, (_, i) => ({ ...base[i % 2], id: `dup-${i}` }));
  const before = window.__thumbs.stats();
  const viewerInfo = () => { const i = window.__rv.viewer().renderer.info.memory; return { geometries: i.geometries, textures: i.textures }; };
  const viewerBefore = viewerInfo();
  const t = performance.now();
  const urls = await Promise.all(list.map((p) => window.__thumbs.render(p)));
  const totalMs = performance.now() - t;
  return { totalMs: +totalMs.toFixed(0), perRenderMs: +(totalMs / 30).toFixed(1), distinctUrls: new Set(urls).size, cachedBytes: urls.reduce((n, u) => n + u.length, 0), statsBefore: before, statsAfter: window.__thumbs.stats(), viewerMemoryBefore: viewerBefore, viewerMemoryAfter: viewerInfo(), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
});
res.queue_30 = many;
res.contexts_after30 = await gl();
res.viewer_after30 = await page.evaluate(() => ({ viewerContextLost: window.__rv.viewer().renderer.getContext().isContextLost(), lostEvents: window.__lostEvents, status: document.body.dataset.viewerStatus }));
res.viewerWood_after30 = await woodOnViewer();

// no finish applied: what the asset itself looks like
const plain = await page.evaluate(async () => { const t = window.__m.createThumbnailRenderer({ loadRoot: window.__m.loadProductRoot }); const r = await window.__time(() => t.render(window.__rv.catalog().products[0])); const during = window.__gl(); t.dispose(); return { ...r, liveDuring: during.live.length, liveAfterDispose: window.__gl().live.length }; });
res.render_chair_noFinish = { ms: plain.ms, ...savePng('thumb-chair-nofinish', plain.v), liveContextsWhileSecondRendererExisted: plain.liveDuring, liveAfterItsDispose: plain.liveAfterDispose };

// pixel ratio 2 (what a retina display would ask for)
const hi = await page.evaluate(async () => { const t = window.__mk({ pixelRatio: 2 }); const cold = await window.__time(() => t.render(window.__rv.catalog().products[0])); t.invalidate(); const warm = await window.__time(() => t.render(window.__rv.catalog().products[0])); t.dispose(); return { coldMs: cold.ms, warmMs: warm.ms, v: warm.v }; });
res.render_chair_dpr2 = { coldMs: hi.coldMs, warmMs: hi.warmMs, ...savePng('thumb-chair-dpr2', hi.v) };

// thumbnailUrl wins; a broken product rejects and the queue carries on
res.thumbnailUrl_wins = await page.evaluate(async () => { const before = window.__thumbs.stats().renders; const url = await window.__thumbs.render({ ...window.__rv.catalog().products[0], id: 'with-url', thumbnailUrl: '/assets/textures/wood-oak.png' }); return { url, rendersUnchanged: window.__thumbs.stats().renders === before }; });
res.broken_product = await page.evaluate(async () => { const base = window.__rv.catalog().products[0]; const bad = window.__thumbs.render({ ...base, id: 'broken', glb: '/assets/models/does-not-exist.glb' }).then(() => 'resolved', (e) => 'rejected: ' + String(e.message || e).slice(0, 80)); const good = window.__thumbs.render({ ...base, id: 'after-broken' }).then((u) => u.slice(0, 22)); return { bad: await bad, good: await good, stats: window.__thumbs.stats() }; });

// viewer remount (the app's own dispose + recreate): contexts stay at viewer + 1
await page.click('#btn-remount');
await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
await page.waitForTimeout(800);
res.contexts_afterViewerRemount = await gl();
const afterRemount = await page.evaluate(async () => { const p = window.__rv.catalog().products[0]; window.__thumbs.invalidate(p.id); return window.__time(() => window.__thumbs.render(p)); });
res.render_afterRemount = { ms: afterRemount.ms, ...savePng('thumb-chair-after-remount', afterRemount.v) };
res.viewerWood_afterRemount = await woodOnViewer();

// dispose while renders are queued, then dispose for good
res.dispose_with_queue = await page.evaluate(async () => { const base = window.__rv.catalog().products; const jobs = Array.from({ length: 5 }, (_, i) => window.__thumbs.render({ ...base[i % 2], id: `late-${i}` }).then(() => 'resolved', (e) => 'rejected: ' + e.message)); window.__thumbs.dispose(); const settled = await Promise.all(jobs); return { settled, stats: window.__thumbs.stats(), gl: window.__gl() }; });
// used again after dispose: a new context
const revived = await page.evaluate(async () => { const r = await window.__time(() => window.__thumbs.render(window.__rv.catalog().products[1])); const s = window.__thumbs.stats(); const g = window.__gl(); window.__thumbs.dispose(); return { ms: r.ms, stats: s, liveWhileAlive: g.live.length, afterDispose: window.__gl(), statsAfterDispose: window.__thumbs.stats() }; });
res.reuse_after_dispose = revived;
res.final = await page.evaluate(() => ({ viewerContextLost: window.__rv.viewer().renderer.getContext().isContextLost(), lostEvents: window.__lostEvents, status: document.body.dataset.viewerStatus }));
res.consoleErrors = consoleErrors;
await browser.close();
writeFileSync(`${OUT}/thumb-spike.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
