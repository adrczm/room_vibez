// Copy Phase 2 acceptance for the ? pop-up, at 1280x800 and 375x812.
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-ui/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:18783/ui-harness.html';
const SHOTS = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ui/shots';
let failures = 0;
let lastStep = 'start';
let lastStepAt = Date.now();
setInterval(() => {
  if (Date.now() - lastStepAt > 150000) {
    console.log(`WATCHDOG: no progress for 150 s after: ${lastStep}`);
    process.exit(3);
  }
}, 5000).unref();
const check = (label, ok, detail = '') => {
  lastStep = label;
  lastStepAt = Date.now();
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? '  [' + detail + ']' : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome' });

async function open(page, query = '') {
  await page.goto(BASE + query);
  await page.waitForSelector('body[data-harness-ready="true"]');
}
const activeInfo = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return { id: a?.id ?? '', tag: a?.tagName ?? '', cls: a?.className ?? '', inDialog: !!a?.closest?.('#help-dialog') };
  });
const selectedTab = (page) =>
  page.evaluate(() => document.querySelector('#help-dialog [role=tab][aria-selected=true]')?.dataset.helpTab ?? null);
const isOpen = (page) => page.evaluate(() => !!document.querySelector('#help-dialog')?.open);

for (const size of [
  { name: '1280x800', viewport: { width: 1280, height: 800 } },
  { name: '375x812', viewport: { width: 375, height: 812 } },
  { name: '375x812-touch', viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
]) {
  console.log(`\n===== ${size.name} =====`);
  const narrow = size.viewport.width <= 860;
  const context = await browser.newContext(size);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await open(page);

  // --- never auto-opens; nothing in the DOM until asked
  const boot = await page.evaluate(() => ({
    dialogInDom: !!document.querySelector('dialog'),
    anyOpen: !!document.querySelector('dialog[open]'),
  }));
  check('does not auto-open (no <dialog> in the page after load)', !boot.dialogInDom && !boot.anyOpen, JSON.stringify(boot));

  // --- the ? button
  const btn = await page.evaluate(() => {
    const b = document.querySelector('.topbar > .help-btn');
    const r = b.getBoundingClientRect();
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    const nav = document.querySelector('.workspace-nav').getBoundingClientRect();
    const brand = document.querySelector('.brand').getBoundingClientRect();
    const cs = getComputedStyle(b);
    return {
      w: r.width, h: r.height, radius: cs.borderRadius, title: b.title, aria: b.getAttribute('aria-label'),
      haspopup: b.getAttribute('aria-haspopup'), text: b.textContent, type: b.type,
      isLast: b === document.querySelector('.topbar').lastElementChild,
      afterNav: b.previousElementSibling?.classList.contains('workspace-nav'),
      rightGap: Math.round(bar.right - r.right), navRight: Math.round(nav.right), btnLeft: Math.round(r.left),
      btnTop: Math.round(r.top), brandTop: Math.round(brand.top), navTop: Math.round(nav.top), barH: Math.round(bar.height),
      sameRowAsBrand: r.top < brand.bottom && r.bottom > brand.top,
      sameRowAsNav: r.top < nav.bottom && r.bottom > nav.top,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    };
  });
  const expectSize = size.hasTouch ? 44 : 28;
  check(`? button is ${expectSize} x ${expectSize} and circular`, btn.w === expectSize && btn.h === expectSize && btn.radius === '50%', `${btn.w}x${btn.h}, radius ${btn.radius}`);
  check('? button: tooltip, aria-label, aria-haspopup, text', btn.title === 'How this works' && btn.aria === 'Help: how this works' && btn.haspopup === 'dialog' && btn.text === '?' && btn.type === 'button', JSON.stringify({ title: btn.title, aria: btn.aria, haspopup: btn.haspopup, text: btn.text }));
  check('? button is the last child of .topbar, after .workspace-nav', btn.isLast && btn.afterNav);
  check('? button sits at the right end of the top bar', btn.rightGap === 16, `gap to bar edge ${btn.rightGap}px`);
  if (!narrow) check('wide: Workspace switch stays beside the ? (same row)', btn.sameRowAsNav && btn.btnLeft - btn.navRight === 16, `nav right ${btn.navRight}, ? left ${btn.btnLeft}`);
  else check('narrow (<=720): top bar wraps; brand and ? on row 1, switch below', btn.sameRowAsBrand && !btn.sameRowAsNav && btn.navTop > btn.btnTop, `brandTop ${btn.brandTop}, ?Top ${btn.btnTop}, navTop ${btn.navTop}, topbar ${btn.barH}px`);
  check('no horizontal page scroll with the ? in the top bar', btn.overflowX <= 0, `overflowX ${btn.overflowX}`);
  console.log(`      topbar height with ?: ${btn.barH}px`);
  await page.screenshot({ path: `${SHOTS}/help-${size.name}-00-topbar.png` });

  // --- opens; first visit → Start here
  await page.click('.help-btn');
  check('opens as a modal dialog on click', await page.evaluate(() => { const d = document.querySelector('#help-dialog'); return d.open && d.matches(':modal'); }));
  check('first visit opens on Start here (deck §2 Behavior)', (await selectedTab(page)) === 'start', await selectedTab(page));
  const names = {
    dialog: await page.getByRole('dialog', { name: 'How Catalog 3D works' }).count(),
    close: await page.getByRole('button', { name: 'Close help' }).count(),
    tablist: narrow ? 'n/a' : await page.getByRole('tablist', { name: 'Topic' }).count(),
    topic: narrow ? await page.getByRole('combobox', { name: 'Topic' }).count() : 'n/a',
    panel: await page.getByRole('tabpanel', { name: 'Start here' }).count(),
  };
  check('accessible names: dialog, close button, tablist or Topic select, tabpanel', names.dialog === 1 && names.close === 1 && (narrow ? names.topic === 1 : names.tablist === 1) && names.panel === 1, JSON.stringify(names));
  const focus0 = await activeInfo(page);
  check(narrow ? 'initial focus is on the Topic select' : 'initial focus is on the selected tab', narrow ? focus0.id === 'help-topic' : focus0.id === 'help-tab-start', JSON.stringify(focus0));

  // --- tabs vs Topic select
  const nav = await page.evaluate(() => ({
    tabsDisplay: getComputedStyle(document.querySelector('.help-tabs')).display,
    topicDisplay: getComputedStyle(document.querySelector('.help-topic')).display,
  }));
  if (narrow) check('Topic select replaces the tabs', nav.tabsDisplay === 'none' && nav.topicDisplay !== 'none', JSON.stringify(nav));
  else check('tabs shown, Topic select hidden', nav.tabsDisplay !== 'none' && nav.topicDisplay === 'none', JSON.stringify(nav));

  // --- closes three ways and returns focus to the ?
  await page.keyboard.press('Escape');
  check('Esc closes', !(await isOpen(page)));
  check('Esc: focus returns to the ? button', (await activeInfo(page)).id === 'btn-help', JSON.stringify(await activeInfo(page)));

  await page.click('.help-btn');
  await page.click('#help-dialog .app-dialog-close');
  check('close button closes', !(await isOpen(page)));
  check('close button: focus returns to the ? button', (await activeInfo(page)).id === 'btn-help');

  await page.click('.help-btn');
  await page.mouse.click(4, 4);
  check('backdrop click closes', !(await isOpen(page)));
  check('backdrop: focus returns to the ? button', (await activeInfo(page)).id === 'btn-help');

  // a press that starts inside and ends on the backdrop must not close
  await page.click('.help-btn');
  const box = await page.locator('#help-dialog .help-body').boundingBox();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(3, 3, { steps: 4 });
  await page.mouse.up();
  check('drag from inside to the backdrop does not close', await isOpen(page));
  await page.mouse.click(box.x + 40, box.y + 40);
  check('click inside the dialog does not close', await isOpen(page));
  await page.keyboard.press('Escape');

  // --- context-aware opening (after the first visit)
  await page.evaluate(() => { document.body.dataset.workspace = 'catalog'; });
  await page.click('.help-btn');
  check('Product workspace (data-workspace="catalog") opens on Product', (await selectedTab(page)) === 'product', await selectedTab(page));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.body.dataset.workspace = 'room'; });
  await page.click('.help-btn');
  check('Room workspace (data-workspace="room") opens on Room', (await selectedTab(page)) === 'room', await selectedTab(page));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { delete document.body.dataset.workspace; });
  await page.click('.help-btn');
  check('no workspace set opens on Start here', (await selectedTab(page)) === 'start', await selectedTab(page));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.body.dataset.workspace = 'room'; });

  // --- focus trap
  await page.click('.help-btn');
  const visited = [];
  let onPageControl = 0;
  let onBody = 0;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press(i < 14 ? 'Tab' : 'Shift+Tab');
    const a = await activeInfo(page);
    if (a.tag === 'BODY') onBody++;
    else if (!a.inDialog) onPageControl++;
    if (i < 6) visited.push(a.id || a.cls || a.tag);
  }
  check('focus never lands on a page control outside the dialog (14 Tab + 6 Shift+Tab)', onPageControl === 0, `page controls reached: ${onPageControl}; stops with nothing focused (browser-UI stop, BODY in headless): ${onBody}; first cycle: ${visited.join(' > ')}`);
  // with nothing focused, key presses target <body>: they must still not reach page shortcuts
  await page.evaluate(() => { document.activeElement?.blur?.(); window.__ui.keys.length = 0; });
  const blurred = await activeInfo(page);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('y');
  const leakedFromBody = await page.evaluate(() => window.__ui.keys.slice());
  check('with nothing focused (keys target <body>), Ctrl+Z and y still do not reach a document listener', blurred.tag === 'BODY' && leakedFromBody.length === 0, `active ${blurred.tag}; leaked ${JSON.stringify(leakedFromBody)}`);
  await page.click('#help-title');
  const afterTitleClick = await activeInfo(page);
  await page.keyboard.press('Control+z');
  const leakedAfterClick = await page.evaluate(() => window.__ui.keys.slice());
  check('after clicking the (non-focusable) title, Ctrl+Z does not reach a document listener', leakedAfterClick.length === 0, `active ${afterTitleClick.tag}#${afterTitleClick.id}; leaked ${JSON.stringify(leakedAfterClick)}`);
  await page.keyboard.press('Tab');
  check('Tab from there goes back into the dialog', (await activeInfo(page)).inDialog, JSON.stringify(await activeInfo(page)));
  check('page behind is inert while open (? button cannot be clicked)', await page.evaluate(() => {
    const b = document.querySelector('.help-btn').getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !hit?.closest('.help-btn');
  }));

  // --- keys pressed in the dialog do not reach page shortcuts
  await page.evaluate(() => { window.__ui.keys.length = 0; });
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Meta+z');
  await page.keyboard.press('y');
  await page.keyboard.press('Escape');
  const leaked = await page.evaluate(() => window.__ui.keys.slice());
  check('keys pressed inside the dialog (Ctrl+Z, Cmd+Z, y, Esc) do not reach a document keydown listener', leaked.length === 0, JSON.stringify(leaked));
  check('Esc still closed the dialog', !(await isOpen(page)));
  await page.keyboard.press('Control+z');
  check('with the dialog closed, page key listeners receive keys again', (await page.evaluate(() => window.__ui.keys.slice())).includes('z'), JSON.stringify(await page.evaluate(() => window.__ui.keys.slice())));

  // --- tabs: arrow keys, roving tabindex (wide) / Topic select (narrow)
  await page.click('.help-btn'); // Room workspace → Room tab
  if (!narrow) {
    const seq = [];
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'Home', 'ArrowLeft', 'End', 'Home']) {
      await page.keyboard.press(key);
      const s = await page.evaluate(() => ({
        selected: document.querySelector('#help-dialog [role=tab][aria-selected=true]').dataset.helpTab,
        focused: document.activeElement.dataset.helpTab ?? null,
        zeroTabindex: [...document.querySelectorAll('#help-dialog [role=tab]')].filter((t) => t.tabIndex === 0).map((t) => t.dataset.helpTab),
        visiblePanels: [...document.querySelectorAll('#help-dialog [role=tabpanel]')].filter((p) => !p.hidden).map((p) => p.dataset.helpPanel),
      }));
      seq.push(`${key}→${s.selected}`);
      if (s.selected !== s.focused || s.zeroTabindex.length !== 1 || s.zeroTabindex[0] !== s.selected || s.visiblePanels.length !== 1 || s.visiblePanels[0] !== s.selected) {
        check(`arrow keys: consistent state after ${key}`, false, JSON.stringify(s));
      }
    }
    const expected = 'ArrowRight→files, ArrowRight→built, ArrowRight→start, ArrowLeft→built, Home→start, ArrowLeft→built, End→built, Home→start';
    check('arrow keys, Home and End move between tabs (wraps; roving tabindex; one panel shown)', seq.join(', ') === expected, seq.join(', '));
    await page.click('#help-tab-product');
    check('clicking a tab selects it', (await selectedTab(page)) === 'product');
  } else {
    await page.selectOption('#help-topic', 'files');
    const s = await page.evaluate(() => ({
      selected: document.querySelector('#help-dialog [role=tab][aria-selected=true]').dataset.helpTab,
      visiblePanels: [...document.querySelectorAll('#help-dialog [role=tabpanel]')].filter((p) => !p.hidden).map((p) => p.dataset.helpPanel),
      topicValue: document.getElementById('help-topic').value,
    }));
    check('Topic select switches the panel', s.selected === 'files' && s.visiblePanels.join() === 'files', JSON.stringify(s));
  }

  // --- each tab: no horizontal scroll, screenshot; "For developers" collapsed
  const tabIds = ['start', 'product', 'room', 'files', 'built'];
  for (const [i, id] of tabIds.entries()) {
    await page.evaluate((tab) => window.__ui.help.openHelp({ tab }), id);
    const m = await page.evaluate(() => {
      const d = document.querySelector('#help-dialog');
      const s = d.querySelector('.help-body');
      const r = d.getBoundingClientRect();
      return {
        pageOverflowX: document.documentElement.scrollWidth - innerWidth,
        bodyOverflowX: s.scrollWidth - s.clientWidth,
        dialog: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        inViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
        scrollTop: s.scrollTop,
      };
    });
    check(`tab ${i + 1} (${id}): no horizontal scroll, dialog inside the viewport`, m.pageOverflowX <= 0 && m.bodyOverflowX <= 0 && m.inViewport, JSON.stringify(m));
    await page.screenshot({ path: `${SHOTS}/help-${size.name}-0${i + 1}-${id}.png` });
  }
  const dev = await page.evaluate(() => {
    const d = document.querySelector('#help-panel-built details');
    return { open: d.open, summary: d.querySelector('summary').textContent, isLast: d === d.parentElement.lastElementChild };
  });
  check('"For developers" is a collapsed <details> at the bottom of How it\'s built', dev.open === false && dev.summary === 'For developers' && dev.isLast, JSON.stringify(dev));
  await page.keyboard.press('Escape');

  // --- deep links from "Why?" (harness buttons call openHelp({ anchor, returnFocusTo }))
  for (const link of [
    { button: '#h-why-import', tab: 'room', target: 'help-import-plan', starts: 'Import plan.' },
    { button: '#h-why-plans', tab: 'files', target: 'help-plans', starts: 'Plans' },
  ]) {
    await page.locator(link.button).scrollIntoViewIfNeeded();
    await page.click(link.button);
    const m = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const s = document.querySelector('#help-dialog .help-body');
      const er = el.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return {
        selected: document.querySelector('#help-dialog [role=tab][aria-selected=true]').dataset.helpTab,
        offsetFromScrollerTop: Math.round(er.top - sr.top),
        fullyVisible: er.top >= sr.top && er.bottom <= sr.bottom,
        focused: document.activeElement === el,
        highlighted: el.classList.contains('help-target'),
        text: el.textContent.trim().slice(0, 12),
        scrollTop: Math.round(s.scrollTop),
      };
    }, link.target);
    check(`deep link ${link.button}: lands on tab "${link.tab}", section visible, focused and marked`, m.selected === link.tab && m.fullyVisible && m.focused && m.highlighted && m.text.startsWith(link.starts), JSON.stringify(m));
    await page.screenshot({ path: `${SHOTS}/help-${size.name}-deeplink-${link.target}.png` });
    await page.keyboard.press('Escape');
    const a = await activeInfo(page);
    check(`deep link ${link.button}: focus returns to the link that opened it`, a.id === link.button.slice(1), JSON.stringify(a));
  }
  // highlight cleared on the next ordinary open
  await page.click('.help-btn');
  check('the deep-link highlight is cleared on the next open', await page.evaluate(() => document.querySelectorAll('#help-dialog .help-target').length === 0));
  await page.keyboard.press('Escape');

  check('no page errors or console errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// --- breakpoint: 860 vs 861
console.log('\n===== breakpoint =====');
for (const width of [860, 861]) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await open(page);
  await page.click('.help-btn');
  const nav = await page.evaluate(() => ({
    tabs: getComputedStyle(document.querySelector('.help-tabs')).display,
    topic: getComputedStyle(document.querySelector('.help-topic')).display,
  }));
  check(`${width}px: ${width <= 860 ? 'Topic select' : 'tabs'}`, width <= 860 ? nav.tabs === 'none' && nav.topic !== 'none' : nav.tabs !== 'none' && nav.topic === 'none', JSON.stringify(nav));
  await page.close();
}

// --- options
console.log('\n===== options =====');
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await open(page, '?first=0');
  await page.click('.help-btn');
  check('startHereOnFirstVisit:false → first open follows the workspace (Product)', (await selectedTab(page)) === 'product', await selectedTab(page));
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await open(page, '?dot=1');
  const before = await page.evaluate(() => ({
    unseen: document.querySelector('.help-btn').dataset.unseen ?? null,
    dot: getComputedStyle(document.querySelector('.help-btn'), '::after').content,
  }));
  await page.click('.help-btn');
  await page.keyboard.press('Escape');
  const after = await page.evaluate(() => ({
    unseen: document.querySelector('.help-btn').dataset.unseen ?? null,
    stored: localStorage.getItem('catalog3d.helpSeen'),
  }));
  await open(page, '?dot=1');
  const reloaded = await page.evaluate(() => document.querySelector('.help-btn').dataset.unseen ?? null);
  check('unseenDot:true → dot until first opened, remembered in localStorage', before.unseen === 'true' && before.dot !== 'none' && after.unseen === null && after.stored === '1' && reloaded === null, JSON.stringify({ before, after, reloaded }));
  await page.click('.help-btn');
  check('second visit (flag stored) opens on the workspace tab, not Start here', (await selectedTab(page)) === 'product', await selectedTab(page));
  await context.close();
}
{
  // unseenDot default: no dot
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await open(page);
  check('default: no dot on the ?', await page.evaluate(() => document.querySelector('.help-btn').dataset.unseen === undefined));
  await page.close();
}
{
  // blocked storage
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    const blocked = () => { throw new DOMException('blocked', 'SecurityError'); };
    Storage.prototype.getItem = blocked;
    Storage.prototype.setItem = blocked;
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page, '?dot=1');
  await page.click('.help-btn');
  const first = await selectedTab(page);
  await page.keyboard.press('Escape');
  await page.click('.help-btn');
  const second = await selectedTab(page);
  check('storage blocked: opens without errors; first open Start here, later opens follow the workspace', errors.length === 0 && first === 'start' && second === 'product', JSON.stringify({ first, second, errors }));
  await context.close();
}

{
  // initHelp({ button }) with a button the host wrote itself; closeHelp(); isHelpOpen()
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await open(page, '?first=0');
  const r = await page.evaluate(async () => {
    const own = document.createElement('button');
    own.id = 'own-help';
    document.querySelector('.topbar').append(own);
    window.__ui.help.initHelp({ button: own });
    const attrs = { cls: own.className, title: own.title, aria: own.getAttribute('aria-label'), haspopup: own.getAttribute('aria-haspopup'), text: own.textContent, type: own.type, size: [own.getBoundingClientRect().width, own.getBoundingClientRect().height] };
    own.click();
    const openAfterClick = window.__ui.help.isHelpOpen();
    window.__ui.help.closeHelp();
    await new Promise((res) => setTimeout(res, 50));
    return { attrs, openAfterClick, openAfterClose: window.__ui.help.isHelpOpen(), focus: document.activeElement.id, dialogs: document.querySelectorAll('#help-dialog').length };
  });
  check('initHelp({ button }) sets up a host-written button to spec; closeHelp() and isHelpOpen() work; focus returns to that button', r.attrs.cls === 'btn help-btn' && r.attrs.title === 'How this works' && r.attrs.aria === 'Help: how this works' && r.attrs.haspopup === 'dialog' && r.attrs.text === '?' && r.attrs.size.join() === '28,28' && r.openAfterClick && !r.openAfterClose && r.focus === 'own-help' && r.dialogs === 1, JSON.stringify(r));
  await page.close();
}

await browser.close();
console.log(failures ? `\nFAILURES: ${failures}` : '\nALL HELP CHECKS PASSED');
process.exit(failures ? 1 : 0);
