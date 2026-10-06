// What the project's own audits would say about the picker. The three expressions below are copied from
// fixes/qa-evidence/audit-viewer.mjs (:60-61 vis, :76/:88 controlsUnder32px, :111-114 targets) and the UX §6 snippet.
// Run on the harness, popup closed and open, at 1440×900 and at 375×812 with a coarse pointer.
// Usage: node audit-replica.mjs <label>   → writes audit-replica-<label>.json
import { writeFileSync } from 'node:fs';
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-picker/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:18784/picker-harness.html';
const HERE = new URL('./', import.meta.url).pathname;
const label = process.argv[2] ?? 'run';

const probe = () => {
  const vis = (el) => !!el && el.getClientRects().length > 0 && (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  const d = (e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : ''}`;
  const size = (e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; };
  const mine = (e) => !!e.closest('.tpicker, .tpicker-popup');
  // UX §6 snippet / audit-viewer.mjs:76,88
  const controls = [...document.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),summary')].filter((e) => e.offsetParent !== null);
  const controlsUnder32px = controls.filter((e) => e.getBoundingClientRect().height < 32);
  // audit-viewer.mjs:111-114
  const targets = [...document.querySelectorAll('a[href],button,select,input:not([type=hidden]),textarea,summary,[tabindex]:not([tabindex="-1"])')].filter(vis);
  const under = (n) => targets.filter((e) => { const r = e.getBoundingClientRect(); return Math.round(r.height) < n || Math.round(r.width) < n; });
  const list = (els) => els.filter(mine).map((e) => `${d(e)} ${size(e)}`);
  return {
    pointerCoarse: matchMedia('(pointer: coarse)').matches,
    pickerControlsUnder32px: list(controlsUnder32px),
    pickerTargetsUnder24: list(under(24)),
    pickerTargetsUnder44: list(under(44)),
    hiddenSelects: [...document.querySelectorAll('select.tpicker-native')].map((e) => `${e.id} ${size(e)} vis=${vis(e)} offsetParent=${e.offsetParent !== null}`),
    pickerTargetsCounted: targets.filter(mine).length,
  };
};

const browser = await chromium.launch({ channel: 'chrome' });
const out = { label, chrome: browser.version(), runs: {} };
for (const [name, opts] of [
  ['1440x900 mouse', { viewport: { width: 1440, height: 900 } }],
  ['375x812 coarse', { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(BASE + '?n=30&thumbs=manual');
  await page.waitForSelector('body[data-harness=ready]');
  const closed = await page.evaluate(probe);
  const visible = await page.isVisible('#product-select');
  await page.selectOption('#product-select', 'demo-side-table');
  const selected = await page.inputValue('#product-select');
  await page.evaluate(() => window.__h.pickers.product.open());
  await page.waitForTimeout(150);
  const openProduct = await page.evaluate(probe);
  await page.evaluate(() => { window.__h.pickers.product.close(); window.__h.pickers.wall.open(); });
  await page.waitForTimeout(150);
  const openWall = await page.evaluate(probe);
  out.runs[name] = { playwrightSeesSelectVisible: visible, selectOptionWorked: selected === 'demo-side-table', closed, openProduct30: openProduct, openWall };
  await ctx.close();
}
await browser.close();
writeFileSync(`${HERE}audit-replica-${label}.json`, JSON.stringify(out, null, 2));
for (const [name, r] of Object.entries(out.runs)) {
  console.log(`\n== ${name} (pointer coarse: ${r.closed.pointerCoarse}; Playwright visible: ${r.playwrightSeesSelectVisible}; selectOption: ${r.selectOptionWorked})`);
  console.log(' hidden selects      :', r.closed.hiddenSelects.join(' | '));
  for (const state of ['closed', 'openProduct30', 'openWall']) {
    const s = r[state];
    console.log(` ${state.padEnd(14)} under32(h): ${JSON.stringify(s.pickerControlsUnder32px)}  under24: ${JSON.stringify(s.pickerTargetsUnder24)}  under44: ${s.pickerTargetsUnder44.length} ${JSON.stringify(s.pickerTargetsUnder44.slice(0, 6))}`);
  }
}
