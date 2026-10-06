// How long does the first thumbnail render block the main thread, and how late does a test see "ready"?
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = [];
for (let i = 0; i < 3; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) }); }).observe({ entryTypes: ['longtask'] });
    window.__readyAt = null;
    const mo = new MutationObserver(() => { if (document.body?.dataset.viewerStatus === 'ready' && window.__readyAt === null) window.__readyAt = Math.round(performance.now()); });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { attributes: true }));
  });
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:18777/');
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  const seenReadyMs = Date.now() - t0;
  await page.waitForFunction(() => (window.__rv.thumbnails()?.renders ?? 0) >= 1, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({ readyAt: window.__readyAt, long: window.__long, stats: window.__rv.thumbnails(), now: Math.round(performance.now()) }));
  out.push({ seenReadyMs, readyAt: r.readyAt, lastRenderMs: Math.round(r.stats.lastRenderMs), longAfterReady: r.long.filter((l) => l.start + l.dur > r.readyAt), longBefore: r.long.filter((l) => l.start + l.dur <= r.readyAt).reduce((a, l) => a + l.dur, 0) });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
