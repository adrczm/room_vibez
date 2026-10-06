// Stage toast (UX-04 item 1): bounds, overlap with toolbar and hint, live region, timeout,
// reduced motion. Sizes: 1440x900 and 375x812 (the two the brief names), plus 1280x800.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LONG = 'Placed “Lounge chair”. It overlaps a wall and “Side table”. You can leave it, or delete it from the list below.';
const LONG_HINT = 'Click floor corners. Click the first corner to close.';

// Geometry, type and colour facts about the open toast.
const measure = (page) =>
  page.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
    const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const toast = document.getElementById('stage-toast');
    const text = toast.querySelector('.stage-toast-text');
    const stage = rect(document.querySelector('.stage'));
    const toolbar = rect(document.querySelector('.stage-toolbar'));
    const hint = rect(document.getElementById('stage-hint'));
    const t = rect(toast);
    const cs = getComputedStyle(toast);
    const icon = toast.querySelector('.stage-toast-icon');
    return {
      open: toast.dataset.open, kind: toast.dataset.kind ?? null, message: text.textContent,
      box: [Math.round(t.l), Math.round(t.t), Math.round(t.w), Math.round(t.h)],
      insideStage: t.l >= stage.l && t.r <= stage.r && t.t >= stage.t && t.b <= stage.b,
      coversToolbar: hits(t, toolbar), coversHint: hits(t, hint),
      gapAboveHint: Math.round(hint.t - t.b), gapBelowToolbar: Math.round(t.t - toolbar.b),
      fontSize: parseFloat(getComputedStyle(text).fontSize),
      color: cs.color, background: cs.backgroundColor, contrast: ratio(cs.color, cs.backgroundColor),
      borderLeft: cs.borderLeftWidth, fontWeight: cs.fontWeight,
      role: text.getAttribute('role'), live: text.getAttribute('aria-live'), atomic: text.getAttribute('aria-atomic'),
      containerLive: toast.getAttribute('aria-live'), containerRole: toast.getAttribute('role'),
      iconShown: !icon.hidden && !!icon.querySelector('svg'), iconAriaHidden: icon.getAttribute('aria-hidden'),
      animationName: cs.animationName, animationDuration: cs.animationDuration,
      runningAnimations: toast.getAnimations().length,
      pageOverflowX: document.documentElement.scrollWidth - innerWidth,
      stage: [Math.round(stage.w), Math.round(stage.h)],
    };
  });

// Waits for the entrance animation to end, then says whether the toast is really painted.
const settled = (page) =>
  page.evaluate(async () => {
    const toast = document.getElementById('stage-toast');
    await Promise.all(toast.getAnimations().map((a) => a.finished));
    const r = toast.getBoundingClientRect();
    const hint = document.getElementById('stage-hint').getBoundingClientRect();
    const toolbar = document.querySelector('.stage-toolbar').getBoundingClientRect();
    const text = toast.querySelector('.stage-toast-text').getBoundingClientRect();
    const top = document.elementFromPoint(text.left + 4, text.top + text.height / 2);
    return {
      opacity: getComputedStyle(toast).opacity, transform: getComputedStyle(toast).transform,
      onTop: !!top?.closest('#stage-toast'), topIs: top?.className || top?.id || top?.tagName,
      gapAboveHint: Math.round(hint.top - r.bottom), gapBelowToolbar: Math.round(r.top - toolbar.bottom),
      left: Math.round(r.left - document.querySelector('.stage').getBoundingClientRect().left),
    };
  });

const browser = await chromium.launch({ channel: 'chrome' });

for (const size of [
  { name: '1440x900', viewport: { width: 1440, height: 900 } },
  { name: '375x812', viewport: { width: 375, height: 812 } },
  { name: '1280x800', viewport: { width: 1280, height: 800 } },
]) {
  console.log(`\n===== ${size.name} =====`);
  const context = await browser.newContext(size);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector('body[data-harness-ready="true"]');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const liveNodes = async () => {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    return nodes.filter((n) => !n.ignored && ['status', 'alert'].includes(n.role?.value)).map((n) => {
      const kids = (n.childIds ?? []).map((id) => nodes.find((m) => m.nodeId === id)).filter(Boolean);
      const live = n.properties?.find((p) => p.name === 'live')?.value?.value ?? null;
      return { role: n.role.value, live, text: kids.map((k) => k.name?.value ?? '').join('') || n.name?.value || '' };
    });
  };

  // --- idle
  const idle = await page.evaluate(() => {
    const toast = document.getElementById('stage-toast');
    const r = toast.getBoundingClientRect();
    const hint = document.getElementById('stage-hint').getBoundingClientRect();
    const probe = document.elementFromPoint(hint.left + 20, hint.top - 20);
    return {
      inStage: toast.parentElement.classList.contains('stage'), count: document.querySelectorAll('#stage-toast').length,
      w: r.width, h: r.height, hiddenAttr: toast.hidden,
      liveInside: toast.querySelectorAll('[role=status],[role=alert],[aria-live]').length,
      containerLive: toast.getAttribute('aria-live'),
      probe: probe?.id || probe?.className || probe?.tagName,
      focusables: [...toast.querySelectorAll('button')].filter((b) => b.getClientRects().length > 0).length,
    };
  });
  check('mounted once inside .stage; idle: no box, no focusable buttons', idle.inStage && idle.count === 1 && idle.h === 0 && idle.focusables === 0, JSON.stringify(idle));
  check('idle: Playwright sees #stage-toast as hidden', !(await page.locator('#stage-toast').isVisible()));
  check('one live region inside the toast; the container itself is not one', idle.liveInside === 1 && idle.containerLive === null, `live regions inside: ${idle.liveInside}`);
  check('idle: a click where the toast will appear reaches the stage, not the toast', idle.probe !== 'stage-toast' && !String(idle.probe).includes('stage-toast'), String(idle.probe));
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#stage-toast .stage-toast-text' });
  const { nodes: own } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  const ownAx = { ignored: own[0]?.ignored, role: own[0]?.role?.value, live: own[0]?.properties?.find((p) => p.name === 'live')?.value?.value };
  check('idle: the toast\'s own region is already in Chrome\'s accessibility tree (status, polite, not ignored)', ownAx.ignored === false && ownAx.role === 'status' && ownAx.live === 'polite', JSON.stringify(ownAx));

  // --- info toast; announce count
  await page.evaluate(() => {
    const region = document.querySelector('#stage-toast .stage-toast-text');
    window.__mutations = [];
    new MutationObserver((list) => list.forEach(() => window.__mutations.push(region.textContent))).observe(region, { childList: true, characterData: true, subtree: true });
  });
  await page.click('#h-toast-info');
  check('notify(): #stage-toast is visible with the text', (await page.locator('#stage-toast').isVisible()) && (await page.locator('#stage-toast').textContent()) === 'Undid last change.', await page.locator('#stage-toast').textContent());
  let m = await measure(page);
  check('info: inside the stage bounds', m.insideStage, `toast ${JSON.stringify(m.box)} in stage ${JSON.stringify(m.stage)}`);
  check('info: does not cover the stage toolbar or the hint line', !m.coversToolbar && !m.coversHint, `gap above hint ${m.gapAboveHint}px, gap below toolbar ${m.gapBelowToolbar}px`);
  check('info: text >= 12 px and contrast >= 4.5:1', m.fontSize >= 12 && m.contrast >= 4.5, `${m.fontSize}px, ${m.contrast}:1 (${m.color} on ${m.background})`);
  check('info: role="status", aria-live="polite", aria-atomic', m.role === 'status' && m.live === 'polite' && m.atomic === 'true' && m.containerLive === null && m.containerRole === null);
  const mutations = await page.evaluate(() => window.__mutations.slice());
  check('announces once: the live region\'s text changed exactly once for one notify()', mutations.length === 1 && mutations[0] === 'Undid last change.', JSON.stringify(mutations));
  const withText = (await liveNodes()).filter((n) => n.text.includes('Undid last change.'));
  check('announces once: exactly one live region in the accessibility tree holds the message (status, polite)', withText.length === 1 && withText[0].role === 'status' && withText[0].live === 'polite', JSON.stringify(withText));
  const dismiss = await page.getByRole('button', { name: 'Dismiss' }).count();
  check('close button has the accessible name "Dismiss"', dismiss === 1);
  let painted = await settled(page);
  check('info: really painted once the fade-in ends (opacity 1, top-most at its own text)', painted.opacity === '1' && painted.onTop, JSON.stringify(painted));
  check('info: settled position is 9 px above the hint, 12 px from the stage\'s left edge', painted.gapAboveHint === 9 && painted.left === 13, `gap above hint ${painted.gapAboveHint}px (3 px at the first animation frame), left ${painted.left}px incl. 1 px border`);
  await page.screenshot({ path: `${SHOTS}/toast-${size.name}-info.png` });

  // --- repeat of the same words is written again
  await page.evaluate(() => { window.__mutations.length = 0; });
  await page.click('#h-toast-info');
  await sleep(250);
  const repeat = await page.evaluate(() => window.__mutations.slice());
  check('same message again: region emptied, then written again', repeat.length === 2 && repeat[0] === '' && repeat[1] === 'Undid last change.', JSON.stringify(repeat));

  // --- other kinds
  await page.click('#h-toast-success');
  m = await measure(page);
  check('success: neutral surface with an icon; inside stage; clear of toolbar and hint', m.kind === 'success' && m.iconShown && m.insideStage && !m.coversToolbar && !m.coversHint && m.contrast >= 4.5, `${m.contrast}:1`);
  check('replacement: still one toast, with the new text', (await page.locator('#stage-toast').count()) === 1 && m.message === 'Placed “Lounge chair”.', m.message);

  await page.click('#h-toast-warning');
  m = await measure(page);
  check('warning: .warning colours, icon, polite', m.kind === 'warning' && m.iconShown && m.background === 'rgb(255, 248, 219)' && m.role === 'status' && m.live === 'polite', `${m.color} on ${m.background}`);
  check('warning: text >= 12 px and contrast >= 4.5:1; clear of toolbar and hint', m.fontSize >= 12 && m.contrast >= 4.5 && m.insideStage && !m.coversToolbar && !m.coversHint, `${m.fontSize}px, ${m.contrast}:1`);
  painted = await settled(page);
  check('warning: really painted (opacity 1, top-most at its own text)', painted.opacity === '1' && painted.onTop, JSON.stringify(painted));
  await page.screenshot({ path: `${SHOTS}/toast-${size.name}-warning.png` });

  await page.click('#h-toast-error');
  m = await measure(page);
  check('error: role="alert", aria-live="assertive"', m.role === 'alert' && m.live === 'assertive', `${m.role}/${m.live}`);
  check('error: marked by more than colour (icon, 4 px left edge, weight 550)', m.iconShown && m.iconAriaHidden === 'true' && m.borderLeft === '4px' && m.fontWeight === '550', `icon ${m.iconShown}, left edge ${m.borderLeft}, weight ${m.fontWeight}`);
  check('error: .warning.critical colours, text >= 12 px, contrast >= 4.5:1', m.background === 'rgb(254, 233, 232)' && m.color === 'rgb(142, 31, 11)' && m.fontSize >= 12 && m.contrast >= 4.5, `${m.fontSize}px, ${m.contrast}:1`);
  check('error: inside the stage; clear of toolbar and hint', m.insideStage && !m.coversToolbar && !m.coversHint, `toast ${JSON.stringify(m.box)}; gap above hint ${m.gapAboveHint}px, below toolbar ${m.gapBelowToolbar}px`);
  const alertNodes = (await liveNodes()).filter((n) => n.text.includes("Couldn't place"));
  check('error: accessibility tree shows one alert (assertive) holding the message', alertNodes.length === 1 && alertNodes[0].role === 'alert' && alertNodes[0].live === 'assertive', JSON.stringify(alertNodes));
  painted = await settled(page);
  check('error: really painted (opacity 1, top-most at its own text)', painted.opacity === '1' && painted.onTop, JSON.stringify(painted));
  await page.screenshot({ path: `${SHOTS}/toast-${size.name}-error.png` });

  // --- long message, then the hint grows to its longest deck wording while the toast is open
  await page.click('#h-toast-long');
  m = await measure(page);
  check('long warning: inside the stage; clear of toolbar and hint', m.insideStage && !m.coversToolbar && !m.coversHint, `toast ${JSON.stringify(m.box)}; gap above hint ${m.gapAboveHint}px, below toolbar ${m.gapBelowToolbar}px`);
  await page.evaluate((text) => { document.getElementById('stage-hint').textContent = text + ' ' + text; }, LONG_HINT);
  await sleep(200);
  m = await measure(page);
  check('hint grows while the toast is open: the toast moves up and still clears it', m.insideStage && !m.coversToolbar && !m.coversHint && m.gapAboveHint >= 8, `toast ${JSON.stringify(m.box)}; gap above hint ${m.gapAboveHint}px`);
  check('no horizontal page scroll', m.pageOverflowX <= 0, `overflowX ${m.pageOverflowX}`);
  await page.screenshot({ path: `${SHOTS}/toast-${size.name}-long-with-long-hint.png` });
  await page.evaluate(() => { document.getElementById('stage-hint').hidden = true; document.getElementById('stage-hint').style.display = 'none'; });
  await sleep(200);
  m = await measure(page);
  check('hint hidden: the toast drops to 12 px above the stage edge', m.insideStage && !m.coversToolbar, `toast ${JSON.stringify(m.box)}`);
  await page.evaluate(() => { const h = document.getElementById('stage-hint'); h.hidden = false; h.style.display = ''; h.textContent = 'Drag to spin · scroll to zoom · right-drag to pan'; });

  // --- dismiss button; timeoutMs: 0 stays
  await sleep(700);
  check('timeoutMs: 0 keeps the toast (still open after 1.1 s)', (await measure(page)).open === 'true');
  await page.click('#stage-toast .stage-toast-close');
  check('Dismiss closes the toast and empties the region', !(await page.locator('#stage-toast').isVisible()) && (await page.evaluate(() => document.querySelector('.stage-toast-text').textContent)) === '');

  // --- action button
  await page.click('#h-toast-action');
  const action = await page.evaluate(() => { const b = document.querySelector('#stage-toast .stage-toast-action'); return { text: b.textContent, shown: b.getClientRects().length > 0, h: b.getBoundingClientRect().height }; });
  m = await measure(page);
  check('action: button shows the caller\'s label; toast still clear of toolbar and hint', action.text === 'Undo' && action.shown && m.insideStage && !m.coversHint && !m.coversToolbar, JSON.stringify(action));
  check('action: the live region holds only the message, not the button label', m.message === 'Placed “Lounge chair”.', m.message);
  painted = await settled(page);
  check('action: really painted (opacity 1, top-most at its own text)', painted.opacity === '1' && painted.onTop, JSON.stringify(painted));
  await page.screenshot({ path: `${SHOTS}/toast-${size.name}-action.png` });
  await page.click('#stage-toast .stage-toast-action');
  check('action: runs onSelect and closes the toast', (await page.textContent('#h-result')) === 'action: chosen' && !(await page.locator('#stage-toast').isVisible()));

  // --- times out (real time), and pauses under the pointer
  await page.evaluate(() => window.__ui.toast.notify('Undid last change.', { timeoutMs: 500 }));
  await sleep(250);
  const mid = await page.locator('#stage-toast').isVisible();
  await sleep(600);
  check('times out: open at 250 ms, closed by 850 ms with timeoutMs 500', mid && !(await page.locator('#stage-toast').isVisible()));
  await page.evaluate(() => window.__ui.toast.notify('Undid last change.', { timeoutMs: 500 }));
  const tb = await page.locator('#stage-toast').boundingBox();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await sleep(1000);
  const whileHovered = await page.locator('#stage-toast').isVisible();
  await page.mouse.move(tb.x + tb.width / 2, tb.y - 120);
  await sleep(800);
  check('the countdown pauses while the pointer is over the toast and resumes after', whileHovered && !(await page.locator('#stage-toast').isVisible()), `open after 1 s of hover: ${whileHovered}`);

  // --- reduced motion
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.click('#h-toast-info');
  const motion = await measure(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.click('#h-toast-success');
  const reduced = await measure(page);
  check('no preference: entrance animation stage-toast-in, 0.18 s', motion.animationName === 'stage-toast-in' && motion.animationDuration === '0.18s', `${motion.animationName} ${motion.animationDuration}, running ${motion.runningAnimations}`);
  check('prefers-reduced-motion: reduce → no animation at all', reduced.animationName === 'none' && reduced.runningAnimations === 0, `${reduced.animationName}, running ${reduced.runningAnimations}`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.__ui.toast.dismissNotification());

  // --- hidden elements really are display:none (QA-08's check), with the help dialog built too
  await page.click('.help-btn');
  await page.keyboard.press('Escape');
  const leaky = await page.evaluate(() => [...document.querySelectorAll('[hidden]')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id || e.className));
  check('QA-08 check: every [hidden] element from these components computes display:none', leaky.length === 0, JSON.stringify(leaky));

  check('no page errors or console errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// --- default timeouts, with a controlled clock
console.log('\n===== default timeouts (controlled clock) =====');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.clock.install();
  await page.goto(BASE);
  await page.waitForSelector('body[data-harness-ready="true"]');
  const openNow = () => page.evaluate(() => document.getElementById('stage-toast').dataset.open);
  for (const [kind, ms] of [['info', 6000], ['success', 6000], ['warning', 12000], ['error', 12000]]) {
    await page.evaluate((k) => window.__ui.toast.notify('Message', { kind: k }), kind);
    await page.clock.runFor(ms - 100);
    const before = await openNow();
    await page.clock.runFor(200);
    const after = await openNow();
    check(`default timeout for ${kind}: open at ${ms - 100} ms, closed at ${ms + 100} ms`, before === 'true' && after === 'false', `${before} → ${after}`);
  }
  await page.evaluate(() => window.__ui.toast.notify('Message', { kind: 'error', timeoutMs: 0 }));
  await page.clock.runFor(120000);
  check('timeoutMs: 0 → still open after 120 s', (await openNow()) === 'true');
  await page.close();
}

// --- takes over the markup UX-04 describes, if the host has put it in index.html
console.log('\n===== existing #stage-toast markup =====');
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE);
  await page.waitForSelector('body[data-harness-ready="true"]');
  const adopted = await page.evaluate(() => {
    window.__ui.notifier.destroy();
    const stage = document.querySelector('.stage');
    stage.insertAdjacentHTML('beforeend', '<div id="stage-toast" aria-live="polite" hidden></div>');
    const n = window.__ui.toast.mountNotifier(stage);
    n.notify('Click the floor inside the room.', { kind: 'warning' });
    const el = document.getElementById('stage-toast');
    return {
      count: document.querySelectorAll('#stage-toast').length, same: n.element === el, hidden: el.hidden,
      containerLive: el.getAttribute('aria-live'), liveInside: el.querySelectorAll('[aria-live]').length,
      visible: el.getBoundingClientRect().height > 0, text: el.textContent,
    };
  });
  check('an existing <div id="stage-toast" aria-live="polite" hidden> is taken over, not duplicated', adopted.count === 1 && adopted.same && !adopted.hidden && adopted.containerLive === null && adopted.liveInside === 1 && adopted.visible, JSON.stringify(adopted));
  const lazy = await page.evaluate(() => {
    window.__ui.toast.dismissNotification();
    const closed = document.getElementById('stage-toast').dataset.open;
    // no notifier mounted: the module-level notify() mounts one in .stage itself
    window.__ui.toast.mountNotifier(document.querySelector('.stage')).destroy();
    const gone = document.querySelectorAll('#stage-toast').length;
    window.__ui.toast.notify('Undid last change.');
    const el = document.getElementById('stage-toast');
    return { closed, gone, remounted: !!el && el.parentElement.classList.contains('stage'), text: el?.textContent, count: document.querySelectorAll('#stage-toast').length };
  });
  check('dismissNotification() closes; destroy() removes; notify() with nothing mounted mounts one in .stage', lazy.closed === 'false' && lazy.gone === 0 && lazy.remounted && lazy.text === 'Undid last change.' && lazy.count === 1, JSON.stringify(lazy));
  await page.close();
}

await browser.close();
console.log(failures ? `\nFAILURES: ${failures}` : '\nALL TOAST CHECKS PASSED');
process.exit(failures ? 1 : 0);
