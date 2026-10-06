import { launch, BASE } from './lib.mjs';
const browser = await launch();
for (let i = 0; i < 3; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__t = {};
    const obs = new MutationObserver(() => {
      const b = document.getElementById('btn-reset');
      if (b && b.textContent && !window.__t.labels) { window.__t.labels = performance.now(); obs.disconnect(); }
    });
    obs.observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  const t = await page.evaluate(() => ({ labelsAt: Math.round(window.__t.labels), fcp: Math.round(performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? -1), domInteractive: Math.round(performance.getEntriesByType('navigation')[0].domInteractive), ready: Math.round(performance.now()) }));
  console.log(JSON.stringify(t));
  await ctx.close();
}
await browser.close();
