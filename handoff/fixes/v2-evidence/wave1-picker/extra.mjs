// Extra checks: Chrome's accessibility tree, CSS order independence, a modal dialog opening over the popup,
// the keyboard focus ring, and contrast numbers. Writes extra.json.
import { writeFileSync } from 'node:fs';
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-picker/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:18784/picker-harness.html';
const HERE = new URL('./', import.meta.url).pathname;
const T = (id) => `.tpicker[data-picker-for="${id}"] .tpicker-trigger`;
const P = (id) => `.tpicker-popup[data-picker-for="${id}"]`;
const out = {};
let failures = 0;
const check = (name, pass, value) => { if (!pass) failures++; out[name] = { pass: Boolean(pass), value }; console.log(`${pass ? 'PASS' : 'FAIL'} ${name} :: ${typeof value === 'string' ? value : JSON.stringify(value)}`); };

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE);
await page.waitForSelector('body[data-harness=ready]');

// 1. Accessibility tree as Chrome computes it (not a screen-reader test).
const closedTree = await page.locator('#catalog-card').ariaSnapshot();
console.log('--- #catalog-card, closed ---\n' + closedTree);
check('a11y: closed card exposes one button named "Product Lounge chair (demo)" and no combobox (the select is hidden from the tree)',
  /button "Product Lounge chair \(demo\)"/.test(closedTree) && !/combobox/.test(closedTree), closedTree.replace(/\n/g, ' | '));
await page.focus(T('room-wall-material'));
await page.keyboard.press('Enter');
const wallTree = await page.locator(P('room-wall-material')).ariaSnapshot();
console.log('--- wall popup ---\n' + wallTree);
check('a11y: popup is a dialog named by its title, with a View radiogroup, a group radiogroup, and a listbox of options with one selected',
  /dialog "Wall material"/.test(wallTree) && /radiogroup "View"/.test(wallTree) && /radio "Thumbnails" \[checked\]/.test(wallTree) && /radiogroup "Category"/.test(wallTree) && /radio "All" \[checked\]/.test(wallTree) && /listbox "Wall material"/.test(wallTree) && /option "Default" \[selected\]/.test(wallTree) && /option "Natural oak"/.test(wallTree) && /button "Close"/.test(wallTree),
  'see console');
const expanded = await page.getAttribute(T('room-wall-material'), 'aria-expanded');
check('a11y: trigger aria-expanded is true while open', expanded === 'true', expanded);

// 2. Keyboard focus ring on a tile.
await page.keyboard.press('ArrowRight');
const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { el: document.activeElement.dataset.id, outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, focusVisible: document.activeElement.matches(':focus-visible') }; });
check('focus ring: a keyboard-focused tile has a 2px solid accent outline', ring.focusVisible && ring.outline === '2px solid rgb(0, 128, 96)', ring);
await page.screenshot({ path: HERE + 'shots/1440x900-wall-grid-keyboard-focus.png' });

// 3. A modal dialog opening while the popup is open closes the popup (the "?" and confirm dialogs are modal).
const modal = await page.evaluate((sel) => { const d = document.createElement('dialog'); d.textContent = 'modal stand-in'; document.body.append(d); d.showModal(); const open = document.querySelector(sel).matches(':popover-open'); const exp = document.querySelector('.tpicker[data-picker-for="room-wall-material"] .tpicker-trigger').getAttribute('aria-expanded'); d.close(); d.remove(); return { popupOpen: open, expanded: exp }; }, P('room-wall-material'));
check('modal dialog: showModal() closes an open picker and aria-expanded follows', !modal.popupOpen && modal.expanded === 'false', modal);

// 4. CSS order: put the app stylesheet AFTER the picker's and re-measure what the picker overrides.
const measure = () => page.evaluate(() => {
  const sel = document.getElementById('product-select').getBoundingClientRect();
  const popup = document.querySelector('.tpicker-popup[data-picker-for="product-select"]');
  const vb = popup.querySelector('.tpicker-view button');
  const cs = getComputedStyle(vb);
  const search = popup.querySelector('.tpicker-search');
  const trig = document.querySelector('.tpicker[data-picker-for="product-select"] .tpicker-trigger').getBoundingClientRect();
  return { select: [sel.width, sel.height], viewButton: [cs.minHeight, cs.paddingTop, cs.paddingLeft, cs.whiteSpace], viewToggleCols: getComputedStyle(popup.querySelector('.tpicker-view')).gridTemplateColumns.split(' ').length, searchFlex: getComputedStyle(search).flexBasis, trigger: [trig.width, trig.height], popupWidth: popup.getBoundingClientRect().width, popupDisplay: getComputedStyle(popup).display };
});
await page.goto(BASE + '?n=30&thumbs=manual');
await page.waitForSelector('body[data-harness=ready]');
await page.click(T('product-select'));
const before = await measure();
await page.keyboard.press('Escape');
const order = await page.evaluate(async () => {
  const link = document.querySelector('link[rel=stylesheet][href="/src/styles.css"]');
  const clone = link.cloneNode();
  await new Promise((res) => { clone.addEventListener('load', res); document.head.append(clone); });
  link.remove();
  const sheets = [...document.styleSheets].map((s) => (s.href ? 'styles.css' : [...s.cssRules].some((r) => r.cssText.includes('.tpicker')) ? 'picker css' : 'other'));
  return sheets;
});
await page.click(T('product-select'));
const after = await measure();
check('CSS order: with src/styles.css loaded after the picker CSS, the measured picker styles are identical', JSON.stringify(before) === JSON.stringify(after) && order.indexOf('picker css') < order.lastIndexOf('styles.css'), { sheetOrder: order, before, after });
await page.keyboard.press('Escape');

// 5. Contrast (WCAG relative luminance) of the picker's own text/fill pairs, from the tokens.
const lum = (hex) => { const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const tok = { text: '#303030', muted: '#616161', surface: '#ffffff', hover: '#f7f7f7', bg: '#f1f1f1', accent: '#008060', accentSoft: '#e3f1ec', borderStrong: '#c9cccf' };
const contrast = {
  'name (--text) on selected fill (--accent-soft)': ratio(tok.text, tok.accentSoft),
  'sublabel (--text-muted) on selected fill': ratio(tok.muted, tok.accentSoft),
  'sublabel (--text-muted) on white': ratio(tok.muted, tok.surface),
  'sublabel (--text-muted) on hover fill': ratio(tok.muted, tok.hover),
  'sublabel (--text-muted) on pressed fill (--bg)': ratio(tok.muted, tok.bg),
  'checked group tab text (--text) on --accent-soft': ratio(tok.text, tok.accentSoft),
  'selected border / check badge (--accent) on white': ratio(tok.accent, tok.surface),
  'selected border (--accent) against its own fill (--accent-soft)': ratio(tok.accent, tok.accentSoft),
  'white check on the accent badge': ratio(tok.surface, tok.accent),
  'focus ring (--accent) on white': ratio(tok.accent, tok.surface),
  'trigger / popup border (--border-strong) on white [same token as .select]': ratio(tok.borderStrong, tok.surface),
};
const textPairs = Object.entries(contrast).filter(([k]) => /name|sublabel|text|check on/.test(k));
check('contrast: every text pair the picker adds is >= 4.5:1', textPairs.every(([, v]) => v >= 4.5), contrast);

check('no page errors', errors.length === 0, errors);
writeFileSync(HERE + 'extra.json', JSON.stringify({ failures, out, contrast }, null, 2));
await browser.close();
console.log(failures ? `${failures} FAILED` : 'all extra checks passed');
process.exit(failures ? 1 : 0);
