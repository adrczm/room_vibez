// Picker §7 item 2, in the harness, at 1440×900 and 375×812. Writes results.json and screenshots.
import { writeFileSync } from 'node:fs';
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-picker/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:18784/picker-harness.html';
const HERE = new URL('./', import.meta.url).pathname;
const SHOTS = HERE + 'shots/';
const VIEWPORTS = [[1440, 900], [375, 812]];

const results = [];
let failures = 0;
function check(vp, name, pass, value) {
  results.push({ vp, name, pass: Boolean(pass), value });
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'} [${vp}] ${name}${value !== undefined ? ' :: ' + JSON.stringify(value) : ''}`);
}

const T = (id) => `.tpicker[data-picker-for="${id}"] .tpicker-trigger`;
const P = (id) => `.tpicker-popup[data-picker-for="${id}"]`;

const browser = await chromium.launch({ channel: 'chrome' });
const chromeVersion = browser.version();
console.log('Chrome', chromeVersion);

async function open(ctx, query = '', init) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  if (init) await page.addInitScript(init);
  await page.goto(BASE + query);
  await page.waitForSelector('body[data-harness=ready]');
  return page;
}
const state = (page, id) =>
  page.evaluate((id) => {
    const popup = document.querySelector(`.tpicker-popup[data-picker-for="${id}"]`);
    const trigger = document.querySelector(`.tpicker[data-picker-for="${id}"] .tpicker-trigger`);
    const a = document.activeElement;
    return {
      open: popup.matches(':popover-open'),
      expanded: trigger.getAttribute('aria-expanded'),
      view: popup.dataset.view,
      layout: popup.dataset.layout,
      side: popup.dataset.side,
      value: document.getElementById(id).value,
      triggerText: trigger.querySelector('.tpicker-name').textContent,
      triggerSub: trigger.querySelector('.tpicker-sub').hidden ? '' : trigger.querySelector('.tpicker-sub').textContent,
      triggerVisual: trigger.querySelector('.tpicker-visual').dataset.kind,
      accName: trigger.getAttribute('aria-labelledby').split(' ').map((i) => document.getElementById(i).textContent).join(' '),
      focus: a === trigger ? 'trigger' : a?.getAttribute('role') === 'option' ? 'option:' + a.dataset.id : a?.id || a?.className || a?.tagName,
      focusInPopup: popup.contains(a),
      options: [...popup.querySelectorAll('[role=option]')].map((o) => o.dataset.id),
      selected: [...popup.querySelectorAll('[role=option][aria-selected=true]')].map((o) => o.dataset.id),
      tabStops: [...popup.querySelectorAll('[role=option][tabindex="0"]')].map((o) => o.dataset.id),
      searchShown: !popup.querySelector('.tpicker-search').hidden,
      groupsShown: !popup.querySelector('.tpicker-groups').hidden,
      groupTabs: [...popup.querySelectorAll('.tpicker-group')].map((b) => b.textContent),
      emptyText: popup.querySelector('.tpicker-empty').hidden ? '' : popup.querySelector('.tpicker-empty').textContent,
      requests: [...window.__h.requests],
      changes: window.__h.changes.map((c) => c.join('=')),
    };
  }, id);

for (const [w, h] of VIEWPORTS) {
  const vp = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });

  // ── A. The native select stays rendered and hidden the right way ──
  {
    const page = await open(ctx);
    const sel = await page.evaluate(() => {
      const s = document.getElementById('product-select');
      const r = s.getBoundingClientRect();
      const cs = getComputedStyle(s);
      const t = s.parentElement.querySelector('.tpicker-trigger').getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + 0.5, r.top + r.height / 2);
      return { w: r.width, h: r.height, triggerH: t.height, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, clipPath: cs.clipPath, pointerEvents: cs.pointerEvents, hiddenAttr: s.hidden, ariaHidden: s.getAttribute('aria-hidden'), tabindex: s.getAttribute('tabindex'), parent: s.parentElement.className, id: s.id, hitTestReachesSelect: hit === s };
    });
    check(vp, 'A1 select rendered (1 px wide, trigger height), clipped + transparent + no pointer events, not hidden/display:none, aria-hidden, tabindex -1',
      sel.w === 1 && sel.h === sel.triggerH && sel.h >= 32 && sel.display !== 'none' && sel.visibility === 'visible' && sel.opacity === '0' && sel.clipPath === 'inset(50%)' && sel.pointerEvents === 'none' && !sel.hitTestReachesSelect && !sel.hiddenAttr && sel.ariaHidden === 'true' && sel.tabindex === '-1', sel);
    check(vp, 'A2 Playwright sees #product-select as visible', await page.isVisible('#product-select'));
    const s0 = await state(page, 'product-select');
    check(vp, 'A3 trigger shows current item; name = label + item', s0.triggerText === 'Lounge chair (demo)' && s0.accName === 'Product Lounge chair (demo)', { text: s0.triggerText, accName: s0.accName });
    const trig = await page.evaluate((sel) => { const t = document.querySelector(sel); const r = t.getBoundingClientRect(); return { h: r.height, w: r.width, haspopup: t.getAttribute('aria-haspopup'), expanded: t.getAttribute('aria-expanded'), controls: !!document.getElementById(t.getAttribute('aria-controls')) }; }, T('product-select'));
    check(vp, 'A4 trigger height >= 32, aria-haspopup, aria-expanded=false, aria-controls resolves', trig.h >= 32 && trig.haspopup === 'dialog' && trig.expanded === 'false' && trig.controls, trig);

    // ── B. Keyboard path end to end ──
    await page.focus('#page-button');
    await page.keyboard.press('Tab');
    let s = await state(page, 'product-select');
    check(vp, 'B1 Tab from the previous control lands on the trigger (not the hidden select)', s.focus === 'trigger', s.focus);
    const scrollBefore = await page.evaluate(() => [document.querySelector('.panel').scrollTop, window.scrollY]);
    await page.keyboard.press('Enter');
    s = await state(page, 'product-select');
    check(vp, 'B2 Enter opens; focus on the selected option; aria-expanded true', s.open && s.expanded === 'true' && s.focus === 'option:demo-lounge-chair' && s.selected.join() === 'demo-lounge-chair', { open: s.open, focus: s.focus, selected: s.selected });
    const scrollAfter = await page.evaluate(() => [document.querySelector('.panel').scrollTop, window.scrollY]);
    check(vp, 'B3 opening does not scroll the panel or page', scrollBefore.join() === scrollAfter.join(), { scrollBefore, scrollAfter });
    await page.keyboard.press('ArrowRight');
    s = await state(page, 'product-select');
    check(vp, 'B4 ArrowRight moves focus to the next tile; selection has not moved', s.focus === 'option:demo-side-table' && s.value === 'demo-lounge-chair' && s.tabStops.join() === 'demo-side-table', { focus: s.focus, value: s.value, tabStops: s.tabStops });
    await page.keyboard.press('Home');
    const sHome = await state(page, 'product-select');
    await page.keyboard.press('End');
    const sEnd = await state(page, 'product-select');
    check(vp, 'B5 Home / End go to first / last', sHome.focus === 'option:demo-lounge-chair' && sEnd.focus === 'option:demo-side-table', [sHome.focus, sEnd.focus]);
    await page.keyboard.press('Enter');
    s = await state(page, 'product-select');
    check(vp, 'B6 Enter selects: select.value set, bubbling change reached select + document, popup closed, focus on trigger, trigger updated',
      s.value === 'demo-side-table' && s.changes.join() === 'product=demo-side-table,document=product-select' && !s.open && s.expanded === 'false' && s.focus === 'trigger' && s.triggerText === 'Side table (demo)',
      { value: s.value, changes: s.changes, open: s.open, focus: s.focus, trigger: s.triggerText });
    await page.keyboard.press('Space');
    s = await state(page, 'product-select');
    const openedBySpace = s.open && s.focus === 'option:demo-side-table';
    await page.keyboard.press('Escape');
    s = await state(page, 'product-select');
    check(vp, 'B7 Space opens; Esc closes, focus returns to the trigger, page-level Esc handler not reached',
      openedBySpace && !s.open && s.focus === 'trigger' && !s.changes.includes('document-escape='), { openedBySpace, open: s.open, focus: s.focus, changes: s.changes });
    await page.keyboard.press('ArrowDown');
    s = await state(page, 'product-select');
    const openedByArrow = s.open;
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Space');
    s = await state(page, 'product-select');
    check(vp, 'B8 ArrowDown opens; ArrowLeft + Space selects the first item', openedByArrow && s.value === 'demo-lounge-chair' && !s.open && s.focus === 'trigger', { openedByArrow, value: s.value, focus: s.focus });
    await page.keyboard.press('Tab');
    s = await state(page, 'product-select');
    check(vp, 'B9 Tab from the closed trigger skips the hidden select', s.focus === 'btn-add', s.focus);

    // Tab inside the popup
    await page.focus(T('product-select'));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    const back1 = await page.evaluate(() => document.activeElement.className + '|' + (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent));
    await page.keyboard.press('Shift+Tab');
    const back2 = await page.evaluate(() => document.activeElement.className + '|' + (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent));
    s = await state(page, 'product-select');
    check(vp, 'B10 Shift+Tab from the listbox reaches Close, then the view toggle, inside the popup', back1.startsWith('tpicker-close|Close') && /Thumbnails|List/.test(back2) && s.open && s.focusInPopup, { back1, back2 });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    s = await state(page, 'product-select');
    const backOnOption = s.focus;
    await page.keyboard.press('Tab');
    s = await state(page, 'product-select');
    check(vp, 'B11 Tab past the listbox leaves the popup and closes it', backOnOption.startsWith('option:') && !s.open && !s.focusInPopup, { backOnOption, open: s.open, focusNow: s.focus });

    // ── C. selectOption on the hidden select, and sync() ──
    await page.evaluate(() => (window.__h.changes.length = 0));
    await page.selectOption('#product-select', 'demo-side-table');
    s = await state(page, 'product-select');
    check(vp, 'C1 page.selectOption works on the hidden select; trigger follows (the picker listens for change)', s.value === 'demo-side-table' && s.triggerText === 'Side table (demo)' && s.changes.includes('product=demo-side-table'), { value: s.value, trigger: s.triggerText, changes: s.changes });
    await page.evaluate(() => { document.getElementById('product-select').value = 'demo-lounge-chair'; });
    const stale = await state(page, 'product-select');
    await page.evaluate(() => window.__h.pickers.product.sync());
    s = await state(page, 'product-select');
    check(vp, 'C2 .value set in code: trigger stale until sync(), correct after', stale.value === 'demo-lounge-chair' && stale.triggerText === 'Side table (demo)' && s.triggerText === 'Lounge chair (demo)', { before: stale.triggerText, after: s.triggerText });
    const wallCount = await page.locator('#room-wall-material option').count();
    await page.selectOption('#room-wall-material', { index: 1 });
    const wall = await state(page, 'room-wall-material');
    check(vp, 'C3 #room-wall-material keeps its 14 options; selectOption({index:1}) works and the trigger follows', wallCount === 14 && wall.value === 'wood-oak' && wall.triggerText === 'Natural oak' && wall.triggerVisual === 'swatch', { wallCount, value: wall.value, trigger: wall.triggerText, visual: wall.triggerVisual });

    // ── D. An added item appears with its sublabel ──
    await page.evaluate(() => window.__h.addUpload('My chair'));
    s = await state(page, 'product-select');
    const trigAfterAdd = { text: s.triggerText, sub: s.triggerSub, accName: s.accName };
    await page.click(T('product-select'));
    await page.waitForTimeout(150);
    s = await state(page, 'product-select');
    const added = await page.evaluate((sel) => { const o = document.querySelector(sel + ' [role=option][data-id="upload-1"]'); return o && { name: o.querySelector('.tpicker-name').textContent, sub: o.querySelector('.tpicker-sub')?.textContent, kind: o.querySelector('.tpicker-visual').dataset.kind, selected: o.getAttribute('aria-selected') }; }, P('product-select'));
    check(vp, 'D1 added product: trigger and grid show it with "Your upload" and a placeholder; it is requested in the thumbnail view',
      trigAfterAdd.text === 'My chair' && trigAfterAdd.sub === 'Your upload' && trigAfterAdd.accName === 'Product My chair Your upload' && s.options.length === 3 && added?.name === 'My chair' && added?.sub === 'Your upload' && added?.kind === 'none' && added?.selected === 'true' && s.requests.includes('upload-1'),
      { trigAfterAdd, options: s.options, added, requests: s.requests });
    if (w === 1440) await page.screenshot({ path: SHOTS + `${vp}-product-grid-with-upload.png` });

    // setThumb: the host hands the image back
    await page.evaluate(() => window.__h.answer('upload-1'));
    const withImg = await page.evaluate((sel) => ({ tile: !!document.querySelector(sel + ' [role=option][data-id="upload-1"] .tpicker-visual img'), tileKind: document.querySelector(sel + ' [role=option][data-id="upload-1"] .tpicker-visual').dataset.kind, trigger: !!document.querySelector('.tpicker[data-picker-for="product-select"] .tpicker-trigger .tpicker-visual img') }), P('product-select'));
    await page.evaluate(() => { window.__h.requests.length = 0; window.__h.pickers.product.setThumb('upload-1', null); });
    await page.waitForTimeout(200);
    const dropped = await page.evaluate((sel) => ({ tileKind: document.querySelector(sel + ' [role=option][data-id="upload-1"] .tpicker-visual').dataset.kind, requests: [...window.__h.requests] }), P('product-select'));
    check(vp, 'D2 setThumb(id, url) fills tile and trigger in place; setThumb(id, null) restores the placeholder and it is asked for again', withImg.tile && withImg.tileKind === 'thumb' && withImg.trigger && dropped.tileKind === 'none' && dropped.requests.join() === 'upload-1', { withImg, dropped });

    // ── E. Toggle to List and back ──
    await page.evaluate(() => (window.__h.requests.length = 0));
    await page.click(P('product-select') + ' [data-view-option=list]');
    s = await state(page, 'product-select');
    const listInfo = await page.evaluate((sel) => {
      const p = document.querySelector(sel);
      const rows = [...p.querySelectorAll('[role=option]')];
      return { rows: rows.length, tops: new Set(rows.map((r) => r.offsetTop)).size, placeholdersShown: rows.filter((r) => getComputedStyle(r.querySelector('.tpicker-visual')).display !== 'none').length,
        radios: [...p.querySelectorAll('.tpicker-view [role=radio]')].map((b) => b.textContent + ':' + b.getAttribute('aria-checked')), stored: localStorage.getItem('catalog3d.pickerView.product') };
    }, P('product-select'));
    check(vp, 'E1 List: one row per item, text only (no placeholder box), radio state and storage updated', s.view === 'list' && listInfo.rows === 3 && listInfo.tops === 3 && listInfo.placeholdersShown === 0 && listInfo.radios.join() === 'Thumbnails:false,List:true' && listInfo.stored === 'list', { view: s.view, ...listInfo });
    if (w === 1440) await page.screenshot({ path: SHOTS + `${vp}-product-list.png` });
    await page.click(P('product-select') + ' [role=option][data-id="demo-side-table"]');
    s = await state(page, 'product-select');
    check(vp, 'E2 selecting in the list works the same (value, change, closed, focus on trigger)', s.value === 'demo-side-table' && !s.open && s.focus === 'trigger' && s.changes.at(-2) === 'product=demo-side-table', { value: s.value, open: s.open, focus: s.focus, changes: s.changes.slice(-2) });
    // keyboard in the list
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    const afterRight = (await state(page, 'product-select')).focus;
    await page.keyboard.press('ArrowUp');
    const afterUp = (await state(page, 'product-select')).focus;
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    const afterDown = (await state(page, 'product-select')).focus;
    check(vp, 'E3 list keyboard: Left/Right do nothing, Up/Down move by one', afterRight === 'option:demo-side-table' && afterUp === 'option:demo-lounge-chair' && afterDown === 'option:upload-1', { afterRight, afterUp, afterDown });
    await page.keyboard.press('Escape');

    // ── E4. The choice survives a reload ──
    await page.reload();
    await page.waitForSelector('body[data-harness=ready]');
    await page.click(T('product-select'));
    await page.waitForTimeout(300);
    s = await state(page, 'product-select');
    check(vp, 'E4 after reload the picker opens in List; G1 the list view requested no thumbnails', s.view === 'list' && s.requests.length === 0, { view: s.view, requests: s.requests });
    // keyboard on the toggle: back to thumbnails
    await page.focus(P('product-select') + ' [data-view-option=list]');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(250);
    s = await state(page, 'product-select');
    const stored = await page.evaluate(() => localStorage.getItem('catalog3d.pickerView.product'));
    check(vp, 'E5 arrow key on the view toggle switches back to Thumbnails; stored; thumbnails are now requested', s.view === 'grid' && stored === 'grid' && s.requests.length === 2 && s.focus.includes('tpicker') === false, { view: s.view, stored, requests: s.requests, focus: s.focus });
    await page.keyboard.press('Escape');
    check(vp, 'errors so far (A–E)', page.errors.length === 0, page.errors);
    await page.evaluate(() => localStorage.clear());
    await page.close();
  }

  // ── F. Blocked storage ──
  for (const [label, init] of [
    ['setItem throws', () => { Storage.prototype.setItem = function () { throw new DOMException('blocked for test', 'QuotaExceededError'); }; }],
    ['localStorage getter throws', () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied for test', 'SecurityError'); } }); }],
  ]) {
    const page = await open(ctx, '', init);
    await page.click(T('product-select'));
    const first = (await state(page, 'product-select')).view;
    await page.click(P('product-select') + ' [data-view-option=list]');
    await page.keyboard.press('Escape');
    await page.click(T('product-select'));
    const second = await state(page, 'product-select');
    await page.keyboard.press('Escape');
    const threw = await page.evaluate(() => { try { window.localStorage.setItem('x', '1'); return false; } catch { return true; } });
    check(vp, `F (${label}): storage really blocked, nothing throws, List holds for the session`, threw && first === 'grid' && second.view === 'list' && second.open && page.errors.length === 0, { threw, first, reopened: second.view, errors: page.errors });
    await page.close();
  }

  // ── G. The list view never requests a thumbnail (30 items) ──
  {
    const page = await open(ctx, '?n=30&thumbs=manual', () => { try { localStorage.setItem('catalog3d.pickerView.product', 'list'); } catch {} });
    await page.click(T('product-select'));
    await page.waitForTimeout(300);
    let s = await state(page, 'product-select');
    const atOpen = s.requests.length;
    await page.evaluate((sel) => { const l = document.querySelector(sel + ' .tpicker-list'); l.scrollTop = l.scrollHeight; }, P('product-select'));
    await page.waitForTimeout(300);
    s = await state(page, 'product-select');
    const afterScroll = s.requests.length;
    await page.keyboard.type('test product 12');
    await page.waitForTimeout(200);
    s = await state(page, 'product-select');
    check(vp, 'G2 30 items in List: 0 requests on open, after scrolling to the end, and after searching', s.view === 'list' && s.options.length === 1 && atOpen === 0 && afterScroll === 0 && s.requests.length === 0, { view: s.view, atOpen, afterScroll, afterSearch: s.requests.length, matches: s.options });
    await page.screenshot({ path: SHOTS + `${vp}-30-list-search.png` });
    await page.fill(P('product-select') + ' .tpicker-search', '');
    if (w === 375) await page.screenshot({ path: SHOTS + `${vp}-30-list.png` });
    // now switch to thumbnails: only tiles on screen are requested
    await page.click(P('product-select') + ' [data-view-option=grid]');
    await page.waitForTimeout(300);
    s = await state(page, 'product-select');
    const visibleAtOpen = s.requests.length;
    await page.evaluate((sel) => { const l = document.querySelector(sel + ' .tpicker-list'); l.scrollTop = l.scrollHeight; }, P('product-select'));
    await page.waitForTimeout(300);
    s = await state(page, 'product-select');
    const unique = new Set(s.requests).size;
    check(vp, 'G3 Thumbnails with 30 items: only tiles in view are requested first, the rest as they scroll in, none twice', visibleAtOpen > 0 && visibleAtOpen < 30 && s.requests.length > visibleAtOpen && unique === s.requests.length, { requestedBeforeScroll: visibleAtOpen, requestedAfterScrollToEnd: s.requests.length, unique });
    await page.screenshot({ path: SHOTS + `${vp}-30-grid-placeholders.png` });
    check(vp, 'errors (G)', page.errors.length === 0, page.errors);
    await page.evaluate(() => localStorage.clear());
    await page.close();
  }

  // ── Default-view rule in the browser ──
  {
    const page = await open(ctx, '?thumbs=none');
    await page.click(T('product-select'));
    const s = await state(page, 'product-select');
    const trigBox = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel + ' .tpicker-visual')).display, T('product-select'));
    await page.keyboard.press('Escape');
    await page.click(T('room-wall-material'));
    const m = await state(page, 'room-wall-material');
    check(vp, 'Default view: no image, no swatch, no thumbnail source → List (trigger text only); materials (swatches) → Thumbnails', s.view === 'list' && trigBox === 'none' && m.view === 'grid', { product: s.view, trigBox, material: m.view });
    await page.keyboard.press('Escape');
    await page.close();
  }

  // ── H. Group tabs; material pickers; existing change handlers ──
  {
    const page = await open(ctx);
    await page.click(T('product-select'));
    const prod = await state(page, 'product-select');
    await page.keyboard.press('Escape');
    await page.click(T('room-wall-material'));
    await page.waitForTimeout(250);
    let s = await state(page, 'room-wall-material');
    check(vp, 'H1 group tabs: none for the two products; All + five groups for materials; no search in either', !prod.groupsShown && !prod.searchShown && s.groupsShown && s.groupTabs.join() === 'All,wood,plastic,textile,stone,metal' && !s.searchShown && s.options.length === 14, { product: { groups: prod.groupsShown, search: prod.searchShown }, materialTabs: s.groupTabs, materialSearch: s.searchShown, options: s.options.length });
    await page.screenshot({ path: SHOTS + `${vp}-wall-grid.png` });
    const swatch = await page.evaluate((sel) => { const v = document.querySelector(sel + ' [role=option][data-id="wood-black"] .tpicker-visual'); const cs = getComputedStyle(v); const d = document.querySelector(sel + ' [role=option][data-id=""] .tpicker-visual'); return { kind: v.dataset.kind, color: cs.backgroundColor, image: cs.backgroundImage, blend: cs.backgroundBlendMode, size: cs.backgroundSize, defaultKind: d.dataset.kind, imgs: document.querySelectorAll(sel + ' img').length }; }, P('room-wall-material'));
    check(vp, 'H2 swatches are CSS (colour × map, multiply, cover), no <img>; Default has the neutral placeholder', swatch.kind === 'swatch' && swatch.color === 'rgb(74, 74, 74)' && swatch.image.includes('wood-oak.png') && swatch.blend === 'multiply' && swatch.size === 'cover' && swatch.defaultKind === 'none' && swatch.imgs === 0, swatch);
    await page.click(P('room-wall-material') + ' .tpicker-group[data-group=wood]');
    s = await state(page, 'room-wall-material');
    const wood = s.options;
    await page.keyboard.press('ArrowRight');
    const tabsAfterArrow = await page.evaluate((sel) => [...document.querySelectorAll(sel + ' .tpicker-group')].filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.textContent + (b === document.activeElement ? '*' : '')), P('room-wall-material'));
    s = await state(page, 'room-wall-material');
    check(vp, 'H3 a group tab filters; arrow keys move between tabs', wood.join() === 'wood-oak,wood-walnut,wood-black' && tabsAfterArrow.join() === 'plastic*' && s.options.join() === 'plastic-black,plastic-white,plastic-green', { wood, tabsAfterArrow, plastic: s.options });
    await page.click(P('room-wall-material') + ' .tpicker-group[data-group=""]');
    await page.evaluate(() => (window.__h.changes.length = 0));
    await page.click(P('room-wall-material') + ' [role=option][data-id="wood-walnut"]');
    s = await state(page, 'room-wall-material');
    const meta = await page.textContent('#material-meta');
    const optCount = await page.locator('#room-wall-material option').count();
    check(vp, 'H4 picking a wall material: change reaches the existing listener; native select still has 14 options', s.value === 'wood-walnut' && s.changes.join() === 'room-wall-material=wood-walnut,document=room-wall-material' && meta === 'room-wall-material = wood-walnut' && optCount === 14 && s.triggerText === 'Walnut' && s.focus === 'trigger', { value: s.value, changes: s.changes, meta, optCount, trigger: s.triggerText });

    // list view for materials + shared per kind
    await page.click(T('room-wall-material'));
    await page.click(P('room-wall-material') + ' [data-view-option=list]');
    await page.waitForTimeout(100);
    await page.screenshot({ path: SHOTS + `${vp}-wall-list.png` });
    await page.keyboard.press('Escape');
    await page.click(T('room-floor-material'));
    const floor = await state(page, 'room-floor-material');
    await page.keyboard.press('Escape');
    await page.click(T('product-select'));
    const prod2 = await state(page, 'product-select');
    await page.keyboard.press('Escape');
    check(vp, 'H5 the view is remembered per kind: floor follows wall (material), product keeps its own', floor.view === 'list' && prod2.view === 'grid', { floor: floor.view, product: prod2.view });
    await page.evaluate(() => localStorage.clear());

    // ── M. Pointer: outside click, trigger click while open, host <label>, click inside ──
    await page.click(T('product-select'));
    await page.mouse.click(10, h - 10);
    let closedOutside = !(await state(page, 'product-select')).open;
    await page.click(T('product-select'));
    await page.click(T('product-select'));
    await page.waitForTimeout(150);
    const closedByTrigger = !(await state(page, 'product-select')).open;
    await page.click('label:has(#room-floor-material) > span');
    await page.waitForTimeout(100);
    const openedByLabel = (await state(page, 'room-floor-material')).open;
    const head = await page.locator(P('room-floor-material') + ' .tpicker-head').boundingBox();
    await page.mouse.click(head.x + 60, head.y + head.height - 2);
    await page.waitForTimeout(100);
    const stillOpenAfterInsideClick = (await state(page, 'room-floor-material')).open;
    check(vp, 'M1 outside click closes; trigger click while open closes and stays closed; a host <label> opens it; a click on the popup chrome keeps it open', closedOutside && closedByTrigger && openedByLabel && stillOpenAfterInsideClick, { closedOutside, closedByTrigger, openedByLabel, stillOpenAfterInsideClick });
    if (w === 1440) {
      // On the sheet the label is under the backdrop region; this part is a desktop check.
      await page.click('label:has(#room-floor-material) > span');
      await page.waitForTimeout(200);
      const s2 = await state(page, 'room-floor-material');
      check(vp, 'M2 clicking the host <label> while open closes it and it does not reopen', !s2.open, { open: s2.open });
    } else {
      await page.click(P('room-floor-material') + ' .tpicker-close');
      const s2 = await state(page, 'room-floor-material');
      check(vp, 'M2 (sheet) the Close button closes and returns focus to the trigger', !s2.open && s2.focus === 'trigger', { open: s2.open, focus: s2.focus });
    }
    // only one picker open at a time
    await page.click(T('product-select'));
    await page.evaluate(() => window.__h.pickers.wall.open());
    const both = [(await state(page, 'product-select')).open, (await state(page, 'room-wall-material')).open];
    check(vp, 'M3 opening one picker closes another', both.join() === 'false,true', both);
    await page.keyboard.press('Escape');

    // ── I/J. Not clipped by the panel; no horizontal scroll ──
    await page.click(T('room-wall-material'));
    await page.waitForTimeout(250);
    const geo = await page.evaluate((sel) => {
      const popup = document.querySelector(sel);
      const r = popup.getBoundingClientRect();
      const panel = document.querySelector('.panel');
      const pr = panel.getBoundingClientRect();
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
      const hit = (x, y) => popup.contains(document.elementFromPoint(x, y));
      const pts = { topLeft: hit(r.left + 6, r.top + 6), topRight: hit(r.right - 6, r.top + 6), bottomLeft: hit(r.left + 6, r.bottom - 6), bottomRight: hit(r.right - 6, r.bottom - 6), centre: hit((r.left + r.right) / 2, (r.top + r.bottom) / 2) };
      return { popup: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], panel: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.right), Math.round(pr.bottom)], panelOverflowY: getComputedStyle(panel).overflowY, vw, vh, pts,
        insideViewport: r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh, leavesPanel: r.left < pr.left || r.top < pr.top || r.bottom > pr.bottom || r.right > pr.right,
        layout: popup.dataset.layout, side: popup.dataset.side, docScrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth, topLayer: popup.matches(':popover-open') };
    }, P('room-wall-material'));
    check(vp, 'I1 popup is in the top layer, extends beyond the panel box and every corner is hit-testable (not clipped); fully inside the viewport', geo.topLayer && geo.leavesPanel && Object.values(geo.pts).every(Boolean) && geo.insideViewport, geo);
    check(vp, 'J1 no horizontal scroll with the popup open', geo.docScrollW <= geo.vw && geo.bodyScrollW <= geo.vw, { scrollWidth: geo.docScrollW, bodyScrollWidth: geo.bodyScrollW, clientWidth: geo.vw });
    check(vp, w > 860 ? 'I2 desktop: anchored popup, 520 px wide, right edge on the trigger' : 'I2 sheet: full width, on the bottom edge', w > 860 ? geo.layout === 'anchored' && geo.popup[2] - geo.popup[0] === 520 : geo.layout === 'sheet' && geo.popup[0] === 0 && geo.popup[2] === geo.vw && geo.popup[3] === geo.vh, { layout: geo.layout, side: geo.side, popup: geo.popup });
    await page.keyboard.press('Escape');

    // panel scroll while open: the popup follows its trigger (desktop)
    if (w > 860) {
      await page.click(T('product-select'));
      const before = await page.evaluate((sel) => [document.querySelector(sel).getBoundingClientRect().top, document.querySelector('.tpicker[data-picker-for="product-select"] .tpicker-trigger').getBoundingClientRect().bottom], P('product-select'));
      await page.evaluate(() => (document.querySelector('.panel').scrollTop += 120));
      await page.waitForTimeout(200);
      const after = await page.evaluate((sel) => [document.querySelector(sel).getBoundingClientRect().top, document.querySelector('.tpicker[data-picker-for="product-select"] .tpicker-trigger').getBoundingClientRect().bottom, document.querySelector(sel).matches(':popover-open')], P('product-select'));
      check(vp, 'I3 scrolling the panel while open: the popup stays attached to the trigger', after[2] && Math.abs((before[0] - before[1]) - (after[0] - after[1])) < 1 && Math.abs(before[0] - after[0] - 120) < 2, { before, after });
      await page.keyboard.press('Escape');
      await page.evaluate(() => (document.querySelector('.panel').scrollTop = 0));
    }

    // ── U. Long unbroken name ──
    await page.evaluate(() => window.__h.addUpload('Averyveryverylongunbrokenuploadfilenamewithnospaces_final_v2'));
    await page.click(T('product-select'));
    await page.waitForTimeout(200);
    const long = await page.evaluate((sel) => { const p = document.querySelector(sel); const l = p.querySelector('.tpicker-list'); const t = document.querySelector('.tpicker[data-picker-for="product-select"]'); return { listOverflow: l.scrollWidth - l.clientWidth, triggerOverflow: t.scrollWidth - t.clientWidth, triggerW: t.getBoundingClientRect().width, cardW: document.getElementById('catalog-card').clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }, P('product-select'));
    check(vp, 'U1 a 59-character unbroken name wraps: no overflow in trigger, list or page', long.listOverflow <= 0 && long.triggerOverflow <= 0 && long.doc <= 0 && long.triggerW <= long.cardW, long);
    await page.screenshot({ path: SHOTS + `${vp}-long-name.png` });
    await page.keyboard.press('Escape');

    // ── W. Re-parent the whole picker element ──
    await page.evaluate(() => { document.getElementById('materials-card').append(window.__h.pickers.product.el); window.__h.changes.length = 0; });
    await page.selectOption('#product-select', 'demo-side-table');
    await page.click(T('product-select'));
    await page.click(P('product-select') + ' [role=option][data-id="demo-lounge-chair"]');
    const moved = await state(page, 'product-select');
    check(vp, 'W1 after re-parenting el: selectOption and the picker both still work', moved.value === 'demo-lounge-chair' && moved.triggerText === 'Lounge chair (demo)' && moved.changes.includes('product=demo-side-table') && moved.changes.includes('product=demo-lounge-chair'), { value: moved.value, changes: moved.changes });

    // ── V. destroy() ──
    const destroyed = await page.evaluate(() => { window.__h.pickers.target.destroy(); const s = document.getElementById('texture-target'); const r = s.getBoundingClientRect(); return { parent: s.parentElement.id, w: r.width > 100, ariaHidden: s.getAttribute('aria-hidden'), tabindex: s.getAttribute('tabindex'), cls: s.className, popups: document.querySelectorAll('.tpicker-popup[data-picker-for="texture-target"]').length, wrappers: document.querySelectorAll('.tpicker[data-picker-for="texture-target"]').length }; });
    check(vp, 'V1 destroy() puts the select back as it was and removes the popup', destroyed.parent === 'texture-target-wrap' && destroyed.w && destroyed.ariaHidden === null && destroyed.tabindex === null && destroyed.cls === 'select' && destroyed.popups === 0 && destroyed.wrappers === 0, destroyed);
    check(vp, 'errors (H–W)', page.errors.length === 0, page.errors);
    await page.close();
  }

  // ── L. Search (30 items) ──
  {
    const page = await open(ctx, '?n=30&thumbs=manual');
    await page.focus(T('product-select'));
    await page.keyboard.press('Enter');
    let s = await state(page, 'product-select');
    const shown = s.searchShown;
    await page.keyboard.type('prod');
    await page.waitForTimeout(100);
    s = await state(page, 'product-select');
    const typed = await page.inputValue(P('product-select') + ' .tpicker-search');
    const afterType = { focus: s.focus, count: s.options.length };
    await page.keyboard.type('uct 2');
    s = await state(page, 'product-select');
    const narrowed = s.options;
    await page.keyboard.press('ArrowDown');
    s = await state(page, 'product-select');
    const focusAfterDown = s.focus;
    await page.keyboard.press('Enter');
    s = await state(page, 'product-select');
    check(vp, 'L1 30 items: search shown; typing on a tile continues in the field and filters; ArrowDown reaches the first match; Enter selects it',
      shown && typed === 'prod' && afterType.count === 28 && narrowed.length === 11 && focusAfterDown === 'option:' + narrowed[0] && s.value === narrowed[0] && !s.open,
      { shown, typed, afterType, narrowed: narrowed.length, focusAfterDown, value: s.value });
    await page.keyboard.press('Enter');
    await page.keyboard.type('zzzz');
    s = await state(page, 'product-select');
    const role = await page.getAttribute(P('product-select') + ' .tpicker-empty', 'role');
    check(vp, 'L2 no match: the empty message shows in a status region; reopening had cleared the previous search', s.options.length === 0 && s.emptyText === 'No products match.' && role === 'status', { empty: s.emptyText, role });
    await page.screenshot({ path: SHOTS + `${vp}-30-no-match.png` });
    await page.keyboard.press('Escape');
    s = await state(page, 'product-select');
    check(vp, 'L3 Esc from the search field closes and returns focus to the trigger', !s.open && s.focus === 'trigger', { open: s.open, focus: s.focus });
    // grid arrows in two dimensions
    await page.keyboard.press('Enter');
    const cols = await page.evaluate((sel) => { const o = [...document.querySelectorAll(sel + ' [role=option]')]; return o.filter((x) => x.offsetTop === o[0].offsetTop).length; }, P('product-select'));
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    const down = (await state(page, 'product-select')).focus;
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');
    const up = (await state(page, 'product-select')).focus;
    await page.keyboard.press('End');
    const inView = await page.evaluate((sel) => { const l = document.querySelector(sel + ' .tpicker-list').getBoundingClientRect(); const a = document.activeElement.getBoundingClientRect(); return a.top >= l.top - 1 && a.bottom <= l.bottom + 1; }, P('product-select'));
    const ids = await page.evaluate(() => window.__h.products.map((p) => p.id));
    check(vp, 'L4 grid arrows move in two dimensions (Down = +columns, Up = -columns); End scrolls the last tile into view', down === 'option:' + ids[cols] && up === 'option:' + ids[1] && inView, { cols, down, up, inView });
    await page.keyboard.press('Escape');
    check(vp, 'errors (L)', page.errors.length === 0, page.errors);
    await page.close();
  }

  // ── auto thumbnails returned through the promise ──
  {
    const page = await open(ctx, '?n=30&thumbs=auto');
    await page.click(T('product-select'));
    await page.waitForTimeout(700);
    const r = await page.evaluate((sel) => ({ imgs: document.querySelectorAll(sel + ' [role=option] img').length, requests: window.__h.requests.length, trigger: !!document.querySelector('.tpicker[data-picker-for="product-select"] .tpicker-trigger img') }), P('product-select'));
    check(vp, 'X1 requestThumb returning a promise: every requested tile gets its image, and the trigger shows the current one', r.imgs === r.requests && r.imgs > 0 && r.trigger, r);
    await page.screenshot({ path: SHOTS + `${vp}-30-grid-test-images.png` });
    await page.close();
  }

  // ── O. Reduced motion ──
  {
    const page = await open(ctx);
    await page.click(T('product-select'));
    const normal = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).transitionDuration, P('product-select'));
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.click(T('product-select'));
    const reduced = await page.evaluate((sel) => { const cs = getComputedStyle(document.querySelector(sel)); return [cs.transitionDuration, cs.opacity, cs.animationName]; }, P('product-select'));
    check(vp, 'O1 prefers-reduced-motion: reduce → no transition or animation on the popup', normal === '0.15s' && reduced[0] === '0s' && reduced[1] === '1' && reduced[2] === 'none', { normal, reduced });
    await page.close();
  }

  // ── Q. No Popover API → the native select is left alone ──
  {
    const page = await open(ctx, '', () => { delete HTMLElement.prototype.showPopover; });
    const fb = await page.evaluate(() => { const s = document.getElementById('product-select'); const r = s.getBoundingClientRect(); return { enhanced: s.parentElement.dataset.enhanced, w: r.width, h: r.height, ariaHidden: s.getAttribute('aria-hidden'), triggers: document.querySelectorAll('.tpicker-trigger').length }; });
    await page.selectOption('#product-select', 'demo-side-table');
    const v = await page.inputValue('#product-select');
    check(vp, 'Q1 without showPopover(): the plain select stays visible and usable, nothing throws', fb.enhanced === 'false' && fb.w > 100 && fb.h >= 30 && fb.ariaHidden === null && fb.triggers === 0 && v === 'demo-side-table' && page.errors.length === 0, { ...fb, value: v, errors: page.errors });
    await page.close();
  }
  await ctx.close();
}

// ── T. Coarse pointer sizes (touch phone emulation, 375×812) ──
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await open(ctx, '?n=30&thumbs=manual');
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await page.tap(T('product-select'));
  await page.waitForTimeout(200);
  const sizes = await page.evaluate((sel) => {
    const p = document.querySelector(sel);
    const hgt = (el) => Math.round(el.getBoundingClientRect().height);
    const wdt = (el) => Math.round(el.getBoundingClientRect().width);
    const tile = p.querySelector('[role=option]');
    return { trigger: hgt(document.querySelector('.tpicker[data-picker-for="product-select"] .tpicker-trigger')), tile: [wdt(tile), hgt(tile)], close: [wdt(p.querySelector('.tpicker-close')), hgt(p.querySelector('.tpicker-close'))], viewButton: hgt(p.querySelector('.tpicker-view button')), search: hgt(p.querySelector('.tpicker-search')) };
  }, P('product-select'));
  await page.tap(P('product-select') + ' [data-view-option=list]');
  const row = await page.evaluate((sel) => Math.round(document.querySelector(sel + ' [role=option]').getBoundingClientRect().height), P('product-select'));
  await page.tap(P('product-select') + ' [role=option][data-id="test-product-5"]');
  const v = await page.inputValue('#product-select');
  check('375x812 touch', 'T1 coarse pointer: trigger, tiles, rows, Close, view buttons and search are all >= 44 px; tap selects', coarse && sizes.trigger >= 44 && Math.min(...sizes.tile) >= 44 && Math.min(...sizes.close) >= 44 && sizes.viewButton >= 44 && sizes.search >= 44 && row >= 44 && v === 'test-product-5', { coarse, ...sizes, row, value: v });
  check('375x812 touch', 'errors (T)', page.errors.length === 0, page.errors);
  await ctx.close();
}

// ── Desktop target sizes ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await open(ctx, '?n=30&thumbs=manual');
  await page.click(T('room-wall-material'));
  const sizes = await page.evaluate((sel) => { const p = document.querySelector(sel); const hgt = (el) => Math.round(el.getBoundingClientRect().height); return { trigger: hgt(document.querySelector('.tpicker[data-picker-for="room-wall-material"] .tpicker-trigger')), close: hgt(p.querySelector('.tpicker-close')), viewButton: hgt(p.querySelector('.tpicker-view button')), groupTab: hgt(p.querySelector('.tpicker-group')), tile: hgt(p.querySelector('[role=option]')) }; }, P('room-wall-material'));
  await page.click(P('room-wall-material') + ' [data-view-option=list]');
  const row = await page.evaluate((sel) => Math.round(document.querySelector(sel + ' [role=option]').getBoundingClientRect().height), P('room-wall-material'));
  check('1440x900', 'T2 desktop: no picker control under 32 px', Math.min(sizes.trigger, sizes.close, sizes.viewButton, sizes.groupTab, sizes.tile, row) >= 32, { ...sizes, row });
  await ctx.close();
}

writeFileSync(HERE + 'results.json', JSON.stringify({ chromeVersion, failures, results }, null, 2));
console.log(`\n${results.length - failures}/${results.length} checks passed; ${failures} failed`);
await browser.close();
process.exit(failures ? 1 : 0);
