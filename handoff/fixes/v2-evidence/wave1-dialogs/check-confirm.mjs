// confirmDialog: resolves true/false by click, Enter, Esc and backdrop; styling; safety.
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
const result = (page) => page.textContent('#h-result');
const dialogCount = (page) => page.evaluate(() => document.querySelectorAll('dialog.confirm-dialog').length);
const active = (page) => page.evaluate(() => ({ id: document.activeElement?.id ?? '', action: document.activeElement?.dataset?.action ?? '', tag: document.activeElement?.tagName }));
const gone = (page) => page.waitForFunction(() => document.querySelectorAll('dialog.confirm-dialog').length === 0);
const reset = (page) => page.evaluate(() => { document.getElementById('h-result').textContent = 'pending'; });

for (const size of [
  { name: '1280x800', viewport: { width: 1280, height: 800 } },
  { name: '375x812', viewport: { width: 375, height: 812 } },
]) {
  console.log(`\n===== ${size.name} =====`);
  const context = await browser.newContext(size);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector('body[data-harness-ready="true"]');

  // --- open: structure, names, initial focus
  await reset(page);
  await page.click('#h-clear');
  const opened = await page.evaluate(() => {
    const d = document.querySelector('dialog.confirm-dialog');
    const confirm = d.querySelector('[data-action=confirm]');
    const cancel = d.querySelector('[data-action=cancel]');
    const cs = getComputedStyle(confirm);
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const r = d.getBoundingClientRect();
    return {
      open: d.open, modal: d.matches(':modal'), role: d.getAttribute('role'),
      title: d.querySelector('.app-dialog-title').textContent,
      labelledby: document.getElementById(d.getAttribute('aria-labelledby'))?.textContent,
      describedby: document.getElementById(d.getAttribute('aria-describedby'))?.textContent,
      strong: [...d.querySelectorAll('.confirm-body strong')].map((s) => s.textContent),
      hasLiteralStars: d.textContent.includes('**'),
      confirmText: confirm.textContent, cancelText: cancel.textContent,
      confirmClass: confirm.className, cancelClass: cancel.className,
      confirmBg: cs.backgroundColor, confirmColor: cs.color, confirmBorder: cs.borderTopColor,
      contrast: Math.round(ratio(cs.color, cs.backgroundColor) * 100) / 100,
      cancelBg: getComputedStyle(cancel).backgroundColor,
      accent,
      focused: document.activeElement?.dataset?.action,
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      inViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
      overflowX: d.querySelector('.app-dialog-surface').scrollWidth - d.querySelector('.app-dialog-surface').clientWidth,
      confirmRightOfCancel: confirm.getBoundingClientRect().left > cancel.getBoundingClientRect().left,
    };
  });
  check('opens as a modal <dialog> with role="alertdialog"', opened.open && opened.modal && opened.role === 'alertdialog');
  check('title and body are the caller\'s strings; named and described by them', opened.title === 'Clear this room?' && opened.labelledby === opened.title && opened.describedby.startsWith('This removes the walls, 1 opening and 2 placed products.'), `${opened.title} / ${opened.describedby}`);
  check('**…** in the body is shown bold, with no literal asterisks', opened.strong.join('|') === "You can't undo it." && !opened.hasLiteralStars, JSON.stringify(opened.strong));
  check('buttons carry the caller\'s labels', opened.confirmText === 'Clear room' && opened.cancelText === 'Keep room', `${opened.cancelText} · ${opened.confirmText}`);
  check('destructive confirm: critical styling, not the primary colour', opened.confirmClass === 'btn btn-critical' && opened.confirmBg === 'rgb(254, 233, 232)' && opened.confirmColor === 'rgb(142, 31, 11)' && opened.confirmBg !== 'rgb(0, 128, 96)', `bg ${opened.confirmBg}, text ${opened.confirmColor}, border ${opened.confirmBorder}; --accent ${opened.accent}`);
  check('destructive confirm text contrast >= 4.5:1', opened.contrast >= 4.5, `${opened.contrast}:1`);
  check('cancel is a plain .btn', opened.cancelClass === 'btn' && opened.cancelBg === 'rgb(255, 255, 255)', opened.cancelBg);
  check('initial focus is on the cancel button', opened.focused === 'cancel', opened.focused);
  check('dialog inside the viewport, no horizontal overflow', opened.inViewport && opened.overflowX <= 0, JSON.stringify(opened.rect));
  check('accessible: getByRole(alertdialog, name)', (await page.getByRole('alertdialog', { name: 'Clear this room?' }).count()) === 1);
  await page.screenshot({ path: `${SHOTS}/confirm-${size.name}-clear.png` });

  // --- click confirm → true
  await page.click('dialog.confirm-dialog [data-action=confirm]');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);
  check('click confirm → resolves true', (await result(page)) === 'result: true', await result(page));
  check('dialog is removed from the page after closing', (await dialogCount(page)) === 0);
  check('focus returns to the button that opened it', (await active(page)).id === 'h-clear', JSON.stringify(await active(page)));

  // --- click cancel → false
  await reset(page);
  await page.click('#h-clear');
  await page.click('dialog.confirm-dialog [data-action=cancel]');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);
  check('click cancel → resolves false', (await result(page)) === 'result: false', await result(page));

  // --- Enter on a freshly opened dialog → false (focus is on cancel)
  await reset(page);
  await page.click('#h-clear');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);
  check('Enter on a freshly opened dialog → false (cancel has focus)', (await result(page)) === 'result: false', await result(page));

  // --- Tab to confirm, Enter → true
  await reset(page);
  await page.click('#h-clear');
  await page.keyboard.press('Tab');
  const onConfirm = (await active(page)).action;
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);
  check('Tab to the confirm button, Enter → true', onConfirm === 'confirm' && (await result(page)) === 'result: true', `focused ${onConfirm}; ${await result(page)}`);

  // --- Space on confirm → true
  await reset(page);
  await page.click('#h-clear');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);
  check('Space on the confirm button → true', (await result(page)) === 'result: true', await result(page));

  // --- Esc → false; keys do not leak
  await reset(page);
  await page.click('#h-clear');
  await page.evaluate(() => { window.__ui.keys.length = 0; });
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);
  check('Esc → resolves false', (await result(page)) === 'result: false', await result(page));
  check('Ctrl+Z and Esc pressed in the dialog do not reach a document keydown listener', (await page.evaluate(() => window.__ui.keys.length)) === 0, JSON.stringify(await page.evaluate(() => window.__ui.keys.slice())));
  check('Esc: focus returns to the opener', (await active(page)).id === 'h-clear');

  // --- backdrop → false
  await reset(page);
  await page.click('#h-clear');
  await page.mouse.click(4, 4);
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);
  check('backdrop click → resolves false', (await result(page)) === 'result: false', await result(page));

  // --- click on the dialog body does nothing
  await reset(page);
  await page.click('#h-clear');
  await page.click('dialog.confirm-dialog .confirm-body');
  check('click on the body text neither resolves nor closes', (await result(page)) === 'pending' && (await dialogCount(page)) === 1);
  // focus trap
  let pageControls = 0;
  const stops = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const a = await page.evaluate(() => ({ tag: document.activeElement.tagName, action: document.activeElement.dataset?.action ?? '', inDialog: !!document.activeElement.closest('dialog.confirm-dialog') }));
    if (!a.inDialog && a.tag !== 'BODY') pageControls++;
    stops.push(a.action || a.tag);
  }
  check('Tab never reaches a page control behind the dialog', pageControls === 0, stops.join(' > '));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);

  // --- non-destructive (.mjs wording)
  await reset(page);
  await page.click('#h-mjs');
  const mjs = await page.evaluate(() => {
    const d = document.querySelector('dialog.confirm-dialog');
    const confirm = d.querySelector('[data-action=confirm]');
    const cs = getComputedStyle(confirm);
    const actions = d.querySelector('.confirm-actions').getBoundingClientRect();
    const cr = confirm.getBoundingClientRect();
    return {
      cls: confirm.className, bg: cs.backgroundColor, color: cs.color, marginTop: cs.marginTop,
      notFullWidth: cr.width < actions.width - 40, paragraphs: d.querySelectorAll('.confirm-body p').length,
      focused: document.activeElement?.dataset?.action, text: confirm.textContent,
    };
  });
  check('non-destructive confirm uses .btn-primary (accent), auto width, no top margin', mjs.cls === 'btn btn-primary' && mjs.bg === 'rgb(0, 128, 96)' && mjs.marginTop === '0px' && mjs.notFullWidth, JSON.stringify(mjs));
  check('a line break in the body starts a new paragraph', mjs.paragraphs === 2, `${mjs.paragraphs} paragraphs`);
  check('non-destructive: initial focus is still on cancel', mjs.focused === 'cancel');
  await page.screenshot({ path: `${SHOTS}/confirm-${size.name}-mjs.png` });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);

  // --- replace + long unbroken title
  await reset(page);
  await page.click('#h-replace');
  await page.screenshot({ path: `${SHOTS}/confirm-${size.name}-replace.png` });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);
  await reset(page);
  await page.click('#h-delete');
  const long = await page.evaluate(() => {
    const d = document.querySelector('dialog.confirm-dialog');
    const s = d.querySelector('.app-dialog-surface');
    const r = d.getBoundingClientRect();
    const buttons = [...d.querySelectorAll('.confirm-actions button')].map((b) => b.getBoundingClientRect());
    return {
      overflowX: s.scrollWidth - s.clientWidth, pageOverflowX: document.documentElement.scrollWidth - innerWidth,
      inViewport: r.left >= 0 && r.right <= innerWidth,
      buttonsInside: buttons.every((b) => b.left >= r.left && b.right <= r.right),
      width: Math.round(r.width),
    };
  });
  check('64-character unbroken name in the title wraps; buttons stay inside the dialog', long.overflowX <= 0 && long.pageOverflowX <= 0 && long.inViewport && long.buttonsInside, JSON.stringify(long));
  await page.screenshot({ path: `${SHOTS}/confirm-${size.name}-delete-long-name.png` });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('h-result').textContent !== 'pending');
  await gone(page);

  // --- markup in caller strings is shown as text, never run
  const safety = await page.evaluate(async () => {
    const hostile = '<img src=x onerror="window.__pwned=1"><b>bold</b>';
    const promise = window.__ui.confirmDialog({ title: hostile, body: `${hostile}\n**${hostile}**`, confirmLabel: hostile, cancelLabel: 'No', destructive: true });
    const d = [...document.querySelectorAll('dialog.confirm-dialog')].at(-1);
    const facts = {
      imgs: d.querySelectorAll('img').length, bs: d.querySelectorAll('b').length,
      titleText: d.querySelector('.app-dialog-title').textContent === hostile,
      bodyHasText: d.querySelector('.confirm-body').textContent.includes('<img src=x'),
      strongText: d.querySelector('.confirm-body strong')?.textContent === hostile,
      buttonText: d.querySelector('[data-action=confirm]').textContent === hostile,
    };
    d.querySelector('[data-action=cancel]').click();
    const answer = await promise;
    await new Promise((r) => setTimeout(r, 50));
    return { ...facts, answer, pwned: window.__pwned ?? null };
  });
  check('markup in title, body and labels is rendered as text (no elements created, nothing runs)', safety.imgs === 0 && safety.bs === 0 && safety.titleText && safety.bodyHasText && safety.strongText && safety.buttonText && safety.pwned === null && safety.answer === false, JSON.stringify(safety));

  // --- Node body; resolves once; two calls in a row
  const nodeBody = await page.evaluate(async () => {
    const fragment = document.createDocumentFragment();
    const p = document.createElement('p');
    p.id = 'custom-body';
    p.textContent = 'Built by the caller.';
    fragment.append(p);
    let settled = 0;
    const promise = window.__ui.confirmDialog({ title: 'T', body: fragment, confirmLabel: 'Yes', cancelLabel: 'No' }).then((v) => { settled++; return v; });
    const own = [...document.querySelectorAll('dialog.confirm-dialog')].at(-1);
    const present = !!own.querySelector('#custom-body');
    const confirm = own.querySelector('[data-action=confirm]');
    confirm.click();
    confirm.click();
    const answer = await promise;
    await new Promise((r) => setTimeout(r, 50));
    return { present, answer, settled, left: document.querySelectorAll('dialog.confirm-dialog').length };
  });
  check('a Node body is appended as given; the promise settles once; nothing is left in the page', nodeBody.present && nodeBody.answer === true && nodeBody.settled === 1 && nodeBody.left === 0, JSON.stringify(nodeBody));

  check('no page errors or console errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
console.log(failures ? `\nFAILURES: ${failures}` : '\nALL CONFIRM CHECKS PASSED');
process.exit(failures ? 1 : 0);
