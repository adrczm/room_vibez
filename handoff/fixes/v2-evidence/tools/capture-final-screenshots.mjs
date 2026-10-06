// Final-state screenshots of v2: ten views at 1440×900 and 375×812. Reads the running app; writes only to OUT.
// Run: node fixes/v2-evidence/tools/capture-final-screenshots.mjs   (v2 dev server on :18777)
// RV_SHOTS_OUT overrides the output folder (default: media/ux-fix/ in this project).
import { chromium } from '../../../v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:18777/';
const OUT = (process.env.RV_SHOTS_OUT || fileURLToPath(new URL('../../../media/ux-fix/', import.meta.url))).replace(/\/?$/, '/');
mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: '1440x900', opts: { viewport: { width: 1440, height: 900 } } },
  { name: '375x812', opts: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
];
const log = [];

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

for (const size of SIZES) {
  const context = await browser.newContext(size.opts);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (n, label) => {
    const file = `${n}-${label}-${size.name}.png`;
    await page.screenshot({ path: OUT + file });
    log.push(file);
  };
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      log.push(`SKIPPED ${label} at ${size.name}: ${String(e).split('\n')[0]}`);
    }
  };

  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60_000 });
  await page.waitForTimeout(2000);
  await shot('01', 'product-arrival');

  await step('product picker', async () => {
    await page.click('.tpicker[data-picker-for="product-select"] .tpicker-trigger');
    await page.waitForTimeout(6000); // thumbnails render one at a time under software rendering
    await shot('02', 'product-picker-open');
    await page.keyboard.press('Escape');
  });

  await step('walnut swatch', async () => {
    await page.click('.slot[data-slot="frame"] .swatch[data-material="wood-walnut"]');
    await page.waitForTimeout(1500);
    await shot('03', 'product-walnut-frame');
  });

  await page.click('#workspace-mode button[data-mode="room"]');
  await page.waitForTimeout(1200);
  await shot('04', 'room-empty-state');

  await step('help pop-up', async () => {
    await page.click('#btn-help', { timeout: 5000 });
    await page.waitForTimeout(600);
    await shot('05', 'help-popup');
    await page.keyboard.press('Escape');
  });

  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4, null, { timeout: 30_000 });
  await page.waitForTimeout(2000);
  await shot('06', 'room-created-floor-visible');

  await step('place step', async () => {
    await page.click('.step[data-step="place"] .step-toggle');
    await page.waitForTimeout(800);
    await shot('07', 'place-products-step');
    await page.click('#btn-add-to-room');
    await page.waitForFunction(
      () => {
        const g = window.__rv.roomGraph();
        return !!g && g.placements.length === 1 && !!window.__rv.viewer().getPlacementRoot(g.placements[0].id);
      },
      null,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(1500);
    await shot('08', 'walnut-chair-placed-toast');
    await page.click('#placement-list li .placement-name');
    await page.waitForTimeout(800);
    await shot('09', 'placed-product-selected');
  });

  await step('clear confirm', async () => {
    await page.evaluate(() => document.getElementById('btn-clear-room').scrollIntoView({ block: 'center' }));
    await page.click('#btn-clear-room');
    await page.waitForSelector('dialog.confirm-dialog[open]', { timeout: 5000 });
    await page.waitForTimeout(400);
    await shot('10', 'confirm-clear-room');
    await page.click('dialog.confirm-dialog [data-action="cancel"]');
  });

  log.push(`${size.name}: page errors ${errors.length}${errors.length ? ' -> ' + errors.join(' | ') : ''}`);
  await context.close();
}
await browser.close();
writeFileSync(OUT + '_capture-log.txt', log.join('\n') + '\n');
console.log(log.join('\n'));
