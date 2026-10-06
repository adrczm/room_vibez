// Picker §7 item 2: open with 30 items and RECORD how long the first open takes in each view.
// There is no threshold; the numbers are the result. Headless Chrome on a shared machine: treat as indicative.
import { writeFileSync } from 'node:fs';
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-picker/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:18784/picker-harness.html';
const HERE = new URL('./', import.meta.url).pathname;
const SAMPLES = 9;
const TRIGGER = '.tpicker[data-picker-for="product-select"] .tpicker-trigger';
const POPUP = '.tpicker-popup[data-picker-for="product-select"]';

const CASES = [
  { name: 'thumbnails, placeholders (no image yet)', query: '?n=30&thumbs=manual', view: 'grid' },
  { name: 'thumbnails, 30 images already supplied (192 px PNG data URLs)', query: '?n=30&thumbs=preset', view: 'grid' },
  { name: 'list (text rows, no image)', query: '?n=30&thumbs=manual', view: 'list' },
  { name: 'list, 30 cached images shown at 32 px', query: '?n=30&thumbs=preset', view: 'list' },
];

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const r1 = (n) => Math.round(n * 10) / 10;
const stats = (a) => ({ median: r1(median(a)), min: r1(Math.min(...a)), max: r1(Math.max(...a)) });

const browser = await chromium.launch({ channel: 'chrome' });
const out = { chrome: browser.version(), samples: SAMPLES, note: 'ms; sync = the click handler (read items, build 30 options, show, place, focus); frame = click until the frame after the first paint (two rAFs); fresh page load per sample', rows: [] };

for (const [w, h] of [[1440, 900], [375, 812]]) {
  for (const c of CASES) {
    const first = { sync: [], frame: [] };
    const second = { sync: [], frame: [] };
    let meta;
    for (let i = 0; i < SAMPLES; i++) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.addInitScript((view) => { try { localStorage.setItem('catalog3d.pickerView.product', view); } catch {} }, c.view);
      await page.goto(BASE + c.query);
      await page.waitForSelector('body[data-harness=ready]');
      await page.waitForTimeout(150); // let the page settle so load work is not counted
      const measure = () => page.evaluate(async ([t, p]) => {
        const trigger = document.querySelector(t);
        const t0 = performance.now();
        trigger.click();
        const sync = performance.now() - t0;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const frame = performance.now() - t0;
        const popup = document.querySelector(p);
        return { sync, frame, open: popup.matches(':popover-open'), view: popup.dataset.view, options: popup.querySelectorAll('[role=option]').length, imgs: popup.querySelectorAll('img').length, nodes: popup.querySelectorAll('*').length };
      }, [TRIGGER, POPUP]);
      const a = await measure();
      if (!a.open || a.view !== c.view || a.options !== 30) throw new Error('unexpected state ' + JSON.stringify(a));
      first.sync.push(a.sync); first.frame.push(a.frame);
      meta = { options: a.options, imgs: a.imgs, nodes: a.nodes };
      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
      const b = await measure();
      second.sync.push(b.sync); second.frame.push(b.frame);
      await ctx.close();
    }
    const row = { viewport: `${w}x${h}`, case: c.name, ...meta, firstOpen: { sync: stats(first.sync), frame: stats(first.frame) }, secondOpen: { sync: stats(second.sync), frame: stats(second.frame) } };
    out.rows.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync(HERE + 'timings.json', JSON.stringify(out, null, 2));
await browser.close();
