// Extra checks, part 2: type-ahead without a search field, disabled select, broken image, alignTo,
// sync() while open, and the popup closing when its trigger scrolls out of the panel. Writes extra2.json.
import { writeFileSync } from 'node:fs';
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-picker/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:18784/picker-harness.html';
const HERE = new URL('./', import.meta.url).pathname;
const T = (id) => `.tpicker[data-picker-for="${id}"] .tpicker-trigger`;
const P = (id) => `.tpicker-popup[data-picker-for="${id}"]`;
const out = {};
let failures = 0;
const check = (name, pass, value) => { if (!pass) failures++; out[name] = { pass: Boolean(pass), value }; console.log(`${pass ? 'PASS' : 'FAIL'} ${name} :: ${JSON.stringify(value)}`); };
const focusId = (page) => page.evaluate(() => document.activeElement?.dataset?.id ?? document.activeElement?.className);
const isOpen = (page, id) => page.evaluate((s) => document.querySelector(s).matches(':popover-open'), P(id));

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE);
await page.waitForSelector('body[data-harness=ready]');

// a. Type-ahead (no search field: 14 materials < 16)
await page.focus(T('room-wall-material'));
await page.keyboard.press('Enter');
await page.keyboard.press('w');
const first = await focusId(page);
await page.waitForTimeout(800);
await page.keyboard.press('w');
const second = await focusId(page);
await page.waitForTimeout(800);
await page.keyboard.type('wh');
const third = await focusId(page);
const searchHidden = await page.evaluate((s) => document.querySelector(s + ' .tpicker-search').hidden, P('room-wall-material'));
check('type-ahead without a search field: "w" → Walnut, "w" again → next W, "wh" → White marble', searchHidden && first === 'wood-walnut' && second === 'wool-cream' && third === 'stone-marble', { searchHidden, first, second, third });
await page.keyboard.press('Escape');

// b. Disabled select → disabled trigger
const disabled = await page.evaluate(() => { const s = document.getElementById('room-floor-material'); s.disabled = true; window.__h.pickers.floor.sync(); const t = document.querySelector('.tpicker[data-picker-for="room-floor-material"] .tpicker-trigger'); window.__h.pickers.floor.open(); const r = { triggerDisabled: t.disabled, opened: document.querySelector('.tpicker-popup[data-picker-for="room-floor-material"]').matches(':popover-open') }; s.disabled = false; window.__h.pickers.floor.sync(); r.enabledAgain = !t.disabled; return r; });
check('a disabled select gives a disabled trigger that does not open; sync() re-enables it', disabled.triggerDisabled && !disabled.opened && disabled.enabledAgain, disabled);

// c. A broken image falls back to the placeholder (nothing is drawn in its place)
await page.click(T('product-select'));
await page.evaluate(() => window.__h.pickers.product.setThumb('demo-side-table', 'data:image/png;base64,AAAA'));
await page.waitForTimeout(300);
const broken = await page.evaluate((s) => { const v = document.querySelector(s + ' [role=option][data-id="demo-side-table"] .tpicker-visual'); return { kind: v.dataset.kind, imgs: v.querySelectorAll('img').length }; }, P('product-select'));
check('a broken thumbnail URL falls back to the neutral placeholder', broken.kind === 'none' && broken.imgs === 0, broken);

// d. sync() while open (an item is added): the list updates and focus stays in the listbox
const before = await page.evaluate((s) => document.querySelectorAll(s + ' [role=option]').length, P('product-select'));
await page.evaluate(() => window.__h.addUpload('Added while open'));
const after = await page.evaluate((s) => ({ count: document.querySelectorAll(s + ' [role=option]').length, focusRole: document.activeElement.getAttribute('role'), focusId: document.activeElement.dataset.id, selected: [...document.querySelectorAll(s + ' [aria-selected=true]')].map((o) => o.dataset.id), open: document.querySelector(s).matches(':popover-open') }), P('product-select'));
check('sync() while open: the new item appears, the popup stays open, focus stays on an option, selection follows the select', after.open && after.count === before + 1 && after.focusRole === 'option' && after.selected.join() === 'upload-1', { before, ...after });
await page.keyboard.press('Escape');

// e. alignTo: a second picker lined up with the panel's right edge
const align = await page.evaluate(() => {
  const sel = document.createElement('select');
  sel.id = 'extra-select';
  sel.className = 'select';
  for (const m of window.__h.library.materials) sel.add(new Option(m.name, m.id));
  document.getElementById('materials-card').prepend(sel);
  const panel = document.querySelector('.panel');
  const picker = window.__h.createThumbnailPicker({ select: sel, label: 'Extra', viewKey: 'material', strings: window.__h.strings.materialStrings, getItems: () => window.__h.buildMaterialItems(window.__h.library.materials), alignTo: panel, formatGroup: (g) => g.toUpperCase() });
  picker.open();
  const popup = document.querySelector('.tpicker-popup[data-picker-for="extra-select"]');
  const r = { popupRight: Math.round(popup.getBoundingClientRect().right), panelRight: Math.round(panel.getBoundingClientRect().right), triggerRight: Math.round(picker.el.querySelector('.tpicker-trigger').getBoundingClientRect().right), tabs: [...popup.querySelectorAll('.tpicker-group')].map((b) => b.textContent) };
  picker.close();
  picker.destroy();
  sel.remove();
  return r;
});
check('alignTo lines the popup up with that element; formatGroup relabels the tabs', align.popupRight === align.panelRight && align.triggerRight !== align.panelRight && align.tabs.join() === 'All,WOOD,PLASTIC,TEXTILE,STONE,METAL', align);

// f. The popup follows its trigger while the panel scrolls, and closes once the trigger leaves the panel
await page.evaluate(() => (document.querySelector('.panel').scrollTop = 0));
await page.click(T('product-select'));
const panelTop = await page.evaluate(() => document.querySelector('.panel').getBoundingClientRect().top);
const trigBottom0 = await page.evaluate((t) => document.querySelector(t).getBoundingClientRect().bottom, T('product-select'));
await page.evaluate((d) => (document.querySelector('.panel').scrollTop += d), Math.round(trigBottom0 - panelTop - 20));
await page.waitForTimeout(200);
const stillVisible = { open: await isOpen(page, 'product-select'), triggerBottom: await page.evaluate((t) => Math.round(document.querySelector(t).getBoundingClientRect().bottom), T('product-select')) };
await page.evaluate(() => (document.querySelector('.panel').scrollTop += 60));
await page.waitForTimeout(200);
const scrolledOut = { open: await isOpen(page, 'product-select'), triggerBottom: await page.evaluate((t) => Math.round(document.querySelector(t).getBoundingClientRect().bottom), T('product-select')), expanded: await page.getAttribute(T('product-select'), 'aria-expanded') };
check('panel scroll: popup stays open while 20 px of the trigger still show, closes when the trigger is above the panel edge', stillVisible.open && !scrolledOut.open && scrolledOut.expanded === 'false' && scrolledOut.triggerBottom < panelTop && scrolledOut.triggerBottom > 0, { panelTop: Math.round(panelTop), stillVisible, scrolledOut });

// g. Resize across the 860 px breakpoint while open: anchored → sheet → anchored
await page.evaluate(() => (document.querySelector('.panel').scrollTop = 0));
await page.click(T('product-select'));
const l1 = await page.evaluate((s) => document.querySelector(s).dataset.layout, P('product-select'));
await page.setViewportSize({ width: 800, height: 900 });
await page.waitForTimeout(250);
const l2 = await page.evaluate((s) => { const p = document.querySelector(s); const r = p.getBoundingClientRect(); return { layout: p.dataset.layout, open: p.matches(':popover-open'), left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight }; }, P('product-select'));
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(250);
const l3 = await page.evaluate((s) => { const p = document.querySelector(s); return { layout: p.dataset.layout, open: p.matches(':popover-open'), width: p.getBoundingClientRect().width }; }, P('product-select'));
check('resizing across 860 px while open switches anchored → sheet → anchored', l1 === 'anchored' && l2.layout === 'sheet' && l2.left === 0 && l2.right === l2.vw && l2.bottom === l2.vh && l3.layout === 'anchored' && l3.width === 520, { l1, l2, l3 });

check('no page errors', errors.length === 0, errors);
writeFileSync(HERE + 'extra2.json', JSON.stringify({ failures, out }, null, 2));
await browser.close();
console.log(failures ? `${failures} FAILED` : 'all extra2 checks passed');
process.exit(failures ? 1 : 0);
