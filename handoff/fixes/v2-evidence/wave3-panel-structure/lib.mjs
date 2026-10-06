// Shared helpers for the wave-3 ad-hoc browser checks (headless Chrome, SwiftShader).
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';

export const BASE = process.env.RV_BASE || 'http://127.0.0.1:18777/';
export const OUT = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/h3';

export async function launch() {
  return chromium.launch({
    channel: 'chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

/** Fresh context (clean storage), page at BASE, waited for ready, then settled. */
export async function fresh(browser, { viewport = { width: 1440, height: 900 }, mobile = false, settle = 2000, reducedMotion } = {}) {
  const ctx = await browser.newContext({
    viewport,
    ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}),
    ...(reducedMotion ? { reducedMotion } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  if (settle) await page.waitForTimeout(settle);
  return { ctx, page, errors };
}

/** The UX handoff §6 measurement snippet, verbatim, plus the scrollbar mode (QA C1). */
export const uxSnippet = () => {
  const panel = document.querySelector('.panel');
  const pr = panel.getBoundingClientRect();
  const inPanel = (el) => (el ? Math.round(el.getBoundingClientRect().top - pr.top + panel.scrollTop) : null);
  const controls = [...document.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),summary')].filter(
    (e) => e.offsetParent !== null,
  );
  return {
    viewport: [innerWidth, innerHeight],
    mode: document.body.dataset.workspace,
    panelClientH: panel.clientHeight,
    panelScrollH: panel.scrollHeight,
    slotsTopInPanel: inPanel(document.getElementById('slots')),
    visibleFileInputs: [...document.querySelectorAll('input[type=file]')].filter(
      (e) => e.offsetParent !== null && getComputedStyle(e).display !== 'none',
    ).length,
    visibleFileInputIds: [...document.querySelectorAll('input[type=file]')]
      .filter((e) => e.offsetParent !== null && getComputedStyle(e).display !== 'none')
      .map((e) => e.id),
    controlsUnder32px: controls.filter((e) => e.getBoundingClientRect().height < 32).length,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    // extra, not in the handoff snippet
    scrollbarMode: panel.offsetWidth - panel.clientWidth > 0 ? `classic ${panel.offsetWidth - panel.clientWidth}px` : 'overlay (0px)',
    panelScrollTop: Math.round(panel.scrollTop),
    pageScrollY: Math.round(scrollY),
    docScrollH: document.documentElement.scrollHeight,
    topbarH: Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
  };
};

/** Picker handoff A2, verbatim logic. Returns the ids still rendered that must not be. */
export const a2 = () => {
  const gone = (ids) => ids.filter((id) => { const el = document.getElementById(id); return el && el.offsetParent !== null; });
  const ws = document.body.dataset.workspace;
  if (ws === 'catalog')
    return { workspace: ws, rendered: gone(['btn-create-room', 'room-preset', 'plan-file', 'btn-import-plan', 'btn-import-fixture', 'project-file', 'btn-import-project', 'btn-export-project', 'btn-clear-room', 'btn-draw-wall-mode', 'btn-opening-mode', 'btn-place-mode', 'room-wall-material']) };
  return { workspace: ws, rendered: gone(['model-files', 'pack-files', 'module-file', 'texture-file']) };
};

/** Where Materials sits against the visible panel (desktop) or the page (narrow). */
export const materialsView = () => {
  const panel = document.querySelector('.panel');
  const pr = panel.getBoundingClientRect();
  const narrow = getComputedStyle(panel).overflowY === 'visible';
  const box = narrow ? { top: 0, bottom: innerHeight } : { top: pr.top, bottom: pr.bottom };
  const slots = [...document.querySelectorAll('#slots .slot')];
  const need = (el) => Math.max(0, Math.round(el.getBoundingClientRect().bottom - box.bottom));
  const slotsEl = document.getElementById('slots');
  const r = slotsEl.getBoundingClientRect();
  return {
    slotCount: slots.length,
    slotsFullyVisible: r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && slotsEl.offsetParent !== null,
    scrollNeededFirstSwatchRow: slots[0] ? need(slots[0].querySelector('.swatches')) : null,
    scrollNeededAllSlots: slots.length ? need(slots[slots.length - 1]) : null,
    // distance from the top of the document to the slots, in screens (narrow layout)
    screensToSlotsTop: +((r.top + scrollY) / innerHeight).toFixed(2),
    screensToSlotsBottom: +((r.bottom + scrollY) / innerHeight).toFixed(2),
  };
};

/** QA-03: scroll position and how much of the stage (canvas) is inside the viewport. */
export const stageView = () => {
  const st = document.querySelector('.stage').getBoundingClientRect();
  const visiblePx = Math.max(0, Math.min(innerHeight, st.bottom) - Math.max(0, st.top));
  return { scrollY: Math.round(scrollY), canvasVisiblePct: Math.round((visiblePx / st.height) * 100), stageTop: Math.round(st.top), stageH: Math.round(st.height) };
};

/** Tab through the page from the first top-bar control; report every stop and whether it is inside a hidden workspace group. */
export async function tabWalk(page) {
  await page.evaluate(() => document.querySelector('#workspace-mode button').focus());
  const d = () => {
    const e = document.activeElement;
    if (!e || e === document.body) return null;
    const group = e.closest('[data-workspace-panel]');
    const t = (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return {
      el: `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${t ? ` "${t}"` : ''}`,
      group: group ? group.dataset.workspacePanel : null,
      inInactiveGroup: !!group && group.dataset.workspacePanel !== document.body.dataset.workspace,
      inHiddenSubtree: !!e.closest('[hidden]'),
    };
  };
  const stops = [await page.evaluate(d)];
  for (let i = 0; i < 160; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(d);
    if (!s || s.el === stops[0].el) break;
    stops.push(s);
  }
  return stops;
}
