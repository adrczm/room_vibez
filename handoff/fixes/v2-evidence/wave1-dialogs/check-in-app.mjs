// The three components against the REAL page (the workspace's unmodified index.html + main.ts),
// wired at run time exactly the way the report tells the host to wire them. No app file is edited.
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-ui/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:18783/';
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

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

for (const size of [
  { name: '1280x800', viewport: { width: 1280, height: 800 } },
  { name: '1440x900', viewport: { width: 1440, height: 900 } },
  { name: '375x812', viewport: { width: 375, height: 812 } },
]) {
  console.log(`\n===== real app, ${size.name} =====`);
  const context = await browser.newContext(size);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE);
  let ready = true;
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 }).catch(() => { ready = false; });
  console.log(`      viewer status ready: ${ready}`);

  const before = await page.evaluate(() => ({
    topbar: Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
    navRight: Math.round(document.querySelector('.workspace-nav').getBoundingClientRect().right),
    workspace: document.body.dataset.workspace,
    hiddenLeaks: [...document.querySelectorAll('[hidden]')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id),
  }));

  // --- the wiring the report describes
  await page.addScriptTag({
    type: 'module',
    content: `
      import { createHelpButton, initHelp, openHelp } from '/src/help.ts';
      import { confirmDialog } from '/src/ui/confirmDialog.ts';
      import { mountNotifier, notify } from '/src/ui/notify.ts';
      initHelp({ storageFailureIsSurfaced: false });
      document.querySelector('.topbar').append(createHelpButton());
      mountNotifier(document.querySelector('.stage'));
      window.__b2 = { openHelp, confirmDialog, notify, keys: [] };
      document.addEventListener('keydown', (e) => window.__b2.keys.push(e.key));
      document.body.dataset.b2Ready = 'true';
    `,
  });
  await page.waitForSelector('body[data-b2-ready="true"]');

  const after = await page.evaluate(() => {
    const b = document.querySelector('.topbar > .help-btn').getBoundingClientRect();
    const bar = document.querySelector('.topbar').getBoundingClientRect();
    const nav = document.querySelector('.workspace-nav').getBoundingClientRect();
    return {
      topbar: Math.round(bar.height), btn: [Math.round(b.width), Math.round(b.height)],
      rightGap: Math.round(bar.right - b.right), navRight: Math.round(nav.right), btnLeft: Math.round(b.left),
      sameRowAsNav: b.top < nav.bottom && b.bottom > nav.top,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      newHiddenLeaks: [...document.querySelectorAll('[hidden]')].filter((e) => getComputedStyle(e).display !== 'none' && e.closest('#stage-toast, #help-dialog, .help-btn')).length,
    };
  });
  const narrow = size.viewport.width <= 720;
  check('? button in the real top bar: 28 x 28, 16 px from the right edge, no horizontal scroll', after.btn.join('x') === '28x28' && after.rightGap === 16 && after.overflowX <= 0, JSON.stringify(after));
  if (!narrow) check('wide: top bar height unchanged by the ?; Workspace switch still beside it', after.topbar === before.topbar && after.sameRowAsNav && after.btnLeft - after.navRight === 16, `topbar ${before.topbar} → ${after.topbar}px; nav right ${before.navRight} → ${after.navRight}`);
  else check('narrow: top bar still wraps; ? on the brand row', !after.sameRowAsNav, `topbar ${before.topbar} → ${after.topbar}px`);
  console.log(`      top bar height: ${before.topbar}px before, ${after.topbar}px with the ? button`);
  check('the components add no [hidden] element that still displays', after.newHiddenLeaks === 0, `app's own before: ${JSON.stringify(before.hiddenLeaks)}`);

  // --- help: first open, then per real workspace switch
  await page.click('.help-btn');
  const t1 = await page.evaluate(() => document.querySelector('#help-dialog [role=tab][aria-selected=true]').dataset.helpTab);
  await page.screenshot({ path: `${SHOTS}/app-${size.name}-help-first-open.png` });
  await page.keyboard.press('Escape');
  await page.click('.help-btn');
  const t2 = await page.evaluate(() => document.querySelector('#help-dialog [role=tab][aria-selected=true]').dataset.helpTab);
  await page.keyboard.press('Escape');
  await page.click('#workspace-mode button[data-mode="room"]');
  const ws = await page.evaluate(() => document.body.dataset.workspace);
  await page.click('.help-btn');
  const t3 = await page.evaluate(() => document.querySelector('#help-dialog [role=tab][aria-selected=true]').dataset.helpTab);
  await page.screenshot({ path: `${SHOTS}/app-${size.name}-help-room.png` });
  // keys while the pop-up is open must not reach the app's document keydown (its undo/redo handler lives there)
  await page.evaluate(() => { window.__b2.keys.length = 0; });
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Meta+z');
  const leaked = await page.evaluate(() => window.__b2.keys.slice());
  await page.keyboard.press('Escape');
  const focusBack = await page.evaluate(() => document.activeElement?.id);
  check('real app: first open Start here; then Product in the Product workspace; Room after the real switch', t1 === 'start' && t2 === 'product' && ws === 'room' && t3 === 'room', `${t1}, ${t2}, workspace=${ws} → ${t3}`);
  check('real app: Ctrl+Z / Cmd+Z with the pop-up open do not reach document keydown listeners', leaked.length === 0, JSON.stringify(leaked));
  check('real app: Esc closes and focus returns to the ? button', focusBack === 'btn-help', String(focusBack));
  const closedText = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      dialogInDom: !!document.querySelector('#help-dialog'), dialogOpen: document.querySelector('#help-dialog').open,
      bodyHasTitle: body.includes('How Catalog 3D works'), bodyHasTab5: body.includes('Why Catalog 3D works the way it does'),
      bodyHasDevNote: body.includes('extras.material_slot_id, a sidecar map'),
    };
  });
  check('closed pop-up (still in the DOM) adds nothing to document.body.innerText, so the Copy §8 vocabulary check stays valid', closedText.dialogInDom && !closedText.dialogOpen && !closedText.bodyHasTitle && !closedText.bodyHasTab5 && !closedText.bodyHasDevNote, JSON.stringify(closedText));

  // --- toast on the real stage, with the real toolbar and the real hint text
  // At 860 px and below the app scrolls the page on a workspace switch (QA-03), which can take
  // the whole stage, and the toast in it, out of view. Bring the stage back before measuring.
  const scrolledAway = await page.evaluate(() => {
    const r = document.querySelector('.stage').getBoundingClientRect();
    const away = r.bottom <= 0 || r.top >= innerHeight || r.top < 0;
    document.querySelector('.stage').scrollIntoView({ block: 'start' });
    return { away, stageTopBefore: Math.round(r.top) };
  });
  console.log(`      stage out of view before the toast check: ${scrolledAway.away} (stage top was ${scrolledAway.stageTopBefore}px)`);
  for (const [kind, message] of [
    ['warning', 'Click the floor inside the room.'],
    ['error', "Couldn't place “Lounge chair”. Load its pack again and try once more."],
  ]) {
    const m = await page.evaluate(async ([k, text]) => {
      window.__b2.notify(text, { kind: k, timeoutMs: 0 });
      const toast = document.getElementById('stage-toast');
      await Promise.all(toast.getAnimations().map((a) => a.finished));
      const rect = (el) => el.getBoundingClientRect();
      const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const t = rect(toast);
      const stage = rect(document.querySelector('.stage'));
      const toolbar = rect(document.querySelector('.stage-toolbar'));
      const hint = rect(document.getElementById('stage-hint'));
      const textEl = rect(toast.querySelector('.stage-toast-text'));
      const top = document.elementFromPoint(textEl.left + 4, textEl.top + textEl.height / 2);
      return {
        box: [Math.round(t.left), Math.round(t.top), Math.round(t.width), Math.round(t.height)],
        stage: [Math.round(stage.width), Math.round(stage.height)],
        inside: t.left >= stage.left && t.right <= stage.right && t.top >= stage.top && t.bottom <= stage.bottom,
        coversToolbar: hits(t, toolbar), coversHint: hits(t, hint),
        hintHeight: Math.round(hint.height), toolbarHeight: Math.round(toolbar.height),
        gapAboveHint: Math.round(hint.top - t.bottom), gapBelowToolbar: Math.round(t.top - toolbar.bottom),
        onTop: !!top?.closest('#stage-toast'), opacity: getComputedStyle(toast).opacity,
        hintText: document.getElementById('stage-hint').textContent,
      };
    }, [kind, message]);
    check(`real stage, ${kind}: inside the stage, painted on top, clear of the real toolbar and hint`, m.inside && m.onTop && m.opacity === '1' && !m.coversToolbar && !m.coversHint, JSON.stringify(m));
    await page.screenshot({ path: `${SHOTS}/app-${size.name}-toast-${kind}.png` });
  }
  await page.evaluate(() => window.__b2.notify(''));
  check('notify("") closes the toast', !(await page.locator('#stage-toast').isVisible()));

  // --- confirm over the real page
  const answer = page.evaluate(() => window.__b2.confirmDialog({
    title: 'Clear this room?',
    body: "This removes the walls, 0 openings and 0 placed products. **You can't undo it.** Export project first if you want to keep it.",
    confirmLabel: 'Clear room', cancelLabel: 'Keep room', destructive: true,
  }));
  await page.waitForSelector('dialog.confirm-dialog[open]');
  await page.screenshot({ path: `${SHOTS}/app-${size.name}-confirm.png` });
  await page.keyboard.press('Escape');
  check('real page: confirm resolves false on Esc', (await answer) === false);

  check('no page errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
console.log(failures ? `\nFAILURES: ${failures}` : '\nALL IN-APP CHECKS PASSED');
process.exit(failures ? 1 : 0);
