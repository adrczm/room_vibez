/**
 * E2E: the copy pass, first half (Copy handoff Phase 1 "visible copy diet" and Phase 2 "the ? pop-up";
 * QA-10 and QA-14). The words are the deck's (docs/ux-copy-deck.md §2 and §3.1 to §3.6).
 *
 *  - the ? pop-up: opens from the top bar, never by itself; closes with Esc, its close button and a
 *    click on the backdrop; keeps focus inside and gives it back; opens on the tab of the workspace;
 *    the three "Why?" links land on their section
 *  - the two honesty pins keep their technical sentence in the page, inside a collapsed
 *    "Technical details", under one friendly line
 *  - the top bar is the same height in both workspaces at 1440, 1024 and 375 px (QA-10)
 *  - the accessible name of a labelled field is the label people see (QA-14, WCAG 2.5.3)
 *  - the labels that end in a unit follow the Units select
 *  - every static word comes from src/copy.ts; the removed paragraphs are gone; visible text holds no
 *    team vocabulary beyond what the deck keeps on screen
 *  - a button with aria-pressed never renames itself (tool buttons, Included / Left out, swatches)
 *  - the stage overlay says which of three things failed, in the deck's words
 * Writes no files.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const HELP = 'dialog#help-dialog';
const HELP_BUTTON = '#btn-help';
const ROOM_TOGGLE = '#workspace-mode button[data-mode=room]';
const PRODUCT_TOGGLE = '#workspace-mode button[data-mode=catalog]';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

async function open(page: Page) {
  await page.goto('/');
  await ready(page);
}

const selectedTab = (page: Page) =>
  page.evaluate(() => document.querySelector<HTMLElement>('#help-dialog [role=tab][aria-selected=true]')?.dataset.helpTab ?? null);

const helpIsOpen = (page: Page) => page.evaluate(() => !!document.querySelector<HTMLDialogElement>('#help-dialog')?.open);

const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? null);

/** True when an element of the open pop-up is inside the part of its scroller that is on screen. */
const inHelpView = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const el = document.querySelector<HTMLElement>(selector)!;
    const scroller = el.closest<HTMLElement>('.help-body')!;
    const a = el.getBoundingClientRect();
    const b = scroller.getBoundingClientRect();
    return a.height > 0 && a.top >= b.top - 1 && a.top < b.bottom;
  }, selector);

/** The Copy §8 check. `innerText` leaves out closed dialogs and collapsed disclosures. */
const TEAM_WORDS =
  /(SoT|SoR|MVP|\bstub\b|ingress|candidates|fixture|Polyfork|material_slot_id|\bmock\b|createAsset|COLOR_0|normalizeRoomGraph|Unknown \/ not in public)/gi;

/** Every match of the Copy §8 regex in the visible text, with the line it is on. */
const teamWords = (page: Page) =>
  page.evaluate((source) => {
    const text = document.body.innerText;
    const re = new RegExp(source, 'gi');
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = text.lastIndexOf('\n', m.index) + 1;
      const end = text.indexOf('\n', m.index);
      out.push(text.slice(start, end < 0 ? text.length : end).trim());
    }
    return out;
  }, TEAM_WORDS.source);

test('the ? pop-up: opens only when asked, closes three ways, keeps focus in and gives it back, follows the workspace', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await open(page);

  // The button: last in the top bar, after the Workspace switch, 28 px round, named for what it opens.
  const button = page.locator(HELP_BUTTON);
  await expect(button).toHaveText('?');
  await expect(button).toHaveAttribute('aria-label', 'Help: how this works');
  await expect(button).toHaveAttribute('title', 'How this works');
  await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  const place = await page.evaluate(() => {
    const bar = document.querySelector('.topbar')!;
    const help = document.getElementById('btn-help')!;
    const nav = document.querySelector('.workspace-nav')!;
    const r = help.getBoundingClientRect();
    return {
      lastInBar: bar.lastElementChild === help,
      afterSwitch: !!(nav.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING),
      rightOfSwitch: r.left >= nav.getBoundingClientRect().right,
      size: [r.width, r.height],
      gapToRightEdge: Math.round(window.innerWidth - r.right),
    };
  });
  expect(place).toEqual({ lastInBar: true, afterSwitch: true, rightOfSwitch: true, size: [28, 28], gapToRightEdge: 16 });

  // It never opens by itself.
  expect(await helpIsOpen(page)).toBe(false);

  // First ever open: Start here. Title and close button are named.
  await button.click();
  expect(await helpIsOpen(page)).toBe(true);
  const dialog = page.locator(HELP);
  await expect(dialog).toHaveAttribute('aria-labelledby', 'help-title');
  await expect(page.locator('#help-title')).toHaveText('How Catalog 3D works');
  await expect(dialog.locator('.app-dialog-close')).toHaveAttribute('aria-label', 'Close help');
  await expect(dialog.locator('[role=tab]')).toHaveText(['Start here', 'Product', 'Room', 'Files & saving', "How it's built"]);
  expect(await selectedTab(page)).toBe('start');
  await expect(page.locator('#help-panel-start')).toBeVisible();
  await expect(page.locator('#help-panel-product')).toBeHidden();
  // It is modal: the page behind it is inert for the pointer and for Tab.
  expect(await page.evaluate(() => document.querySelector('#help-dialog')!.matches(':modal'))).toBe(true);
  await expect(page.locator('#help-tab-start')).toBeFocused();

  // Arrow keys move along the tabs (roving tabindex): one tab stop for the five.
  await page.keyboard.press('ArrowRight');
  expect(await selectedTab(page)).toBe('product');
  await expect(page.locator('#help-tab-product')).toBeFocused();
  await page.keyboard.press('End');
  expect(await selectedTab(page)).toBe('built');
  await page.keyboard.press('Home');
  expect(await selectedTab(page)).toBe('start');
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#help-dialog [role=tab]')].map((t) => t.tabIndex))).toEqual([0, -1, -1, -1, -1]);

  // Tab never reaches a control of the page behind the pop-up.
  const outside: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return 'body';
      return el.closest('#help-dialog') ? 'dialog' : `outside:${el.id || el.tagName}`;
    });
    if (where.startsWith('outside')) outside.push(where);
  }
  expect(outside).toEqual([]);

  // 1. Esc closes it, and focus is back on the ? button. (Esc does not reach the page's own shortcuts.)
  await page.keyboard.press('Escape');
  expect(await helpIsOpen(page)).toBe(false);
  await expect(button).toBeFocused();

  // Opened again, it follows the workspace: Product.
  await button.click();
  expect(await selectedTab(page)).toBe('product');
  await expect(page.locator('#help-panel-product')).toBeVisible();
  // 2. The close button.
  await dialog.locator('.app-dialog-close').click();
  expect(await helpIsOpen(page)).toBe(false);
  await expect(button).toBeFocused();

  // Room workspace: Room.
  await page.click(ROOM_TOGGLE);
  await button.click();
  expect(await selectedTab(page)).toBe('room');
  await expect(page.locator('#help-panel-room')).toBeVisible();
  // 3. A click on the backdrop. A click inside the pop-up does not close it.
  await page.locator('#help-panel-room h3').first().click();
  expect(await helpIsOpen(page)).toBe(true);
  await page.mouse.click(8, 8);
  expect(await helpIsOpen(page)).toBe(false);
  await expect(button).toBeFocused();

  // Until the saving-blocked banner exists, Files & saving does not claim "the app tells you" (Copy §6 A).
  await button.click();
  await page.click('#help-tab-files');
  await expect(page.locator('#help-panel-files [data-help-sentence=storage-failure]')).toHaveText(
    'If your browser blocks saving, your room only lasts while this tab is open.',
  );
  // "For developers" is collapsed at the bottom of How it's built.
  await page.click('#help-tab-built');
  expect(await page.evaluate(() => document.querySelector<HTMLDetailsElement>('#help-panel-built details.help-developers')!.open)).toBe(false);
  // The Room tab says how a placed product is moved today (the deck's sentence was "delete it … and place it again").
  await page.click('#help-tab-room');
  await expect(page.locator('#help-panel-room')).toContainText('To move something, select it in the list and use the arrow keys.');
  await expect(page.locator('#help-panel-room')).not.toContainText('place it again');
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('each "Why?" link opens the pop-up on its section and takes focus back when it closes', async ({ page }) => {
  await open(page);

  // Parts list note → the Product tab.
  const partsWhy = page.locator('#parts-note .why-link');
  await expect(page.locator('#parts-note')).toHaveText(/^\s*Placeholder SKUs · no prices\s+Why\?\s*$/);
  await partsWhy.click();
  expect(await helpIsOpen(page)).toBe(true);
  expect(await selectedTab(page)).toBe('product');
  await expect(page.locator('#help-panel-product')).toContainText('SKUs are placeholders and there are no prices yet.');
  await page.keyboard.press('Escape');
  await expect(partsWhy).toBeFocused();

  // Import nudge → Room tab, "Import plan" (#import-plan).
  await page.click(ROOM_TOGGLE);
  await page.click('#room-ingress button[data-ingress=import]');
  const importWhy = page.locator('#import-oda-note .why-link');
  await importWhy.click();
  expect(await selectedTab(page)).toBe('room');
  await expect(page.locator('#help-import-plan')).toHaveClass(/help-target/);
  await expect(page.locator('#help-import-plan')).toContainText('Import plan.');
  expect(await focusedId(page)).toBe('help-import-plan');
  expect(await inHelpView(page, '#help-import-plan')).toBe(true);
  await page.locator(`${HELP} .app-dialog-close`).click();
  await expect(importWhy).toBeFocused();

  // Sample banner → Files & saving, "Plans" (#plans), which is far down that tab.
  await page.click('#btn-import-fixture');
  await expect(page.locator('#import-review')).toBeVisible({ timeout: 10_000 });
  const bannerWhy = page.locator('#import-extract-banner .why-link');
  await bannerWhy.click();
  expect(await selectedTab(page)).toBe('files');
  await expect(page.locator('#help-plans')).toHaveClass(/help-target/);
  await expect(page.locator('#help-plans')).toHaveText('Plans');
  expect(await focusedId(page)).toBe('help-plans');
  expect(await inHelpView(page, '#help-plans')).toBe(true);
  expect(await page.evaluate(() => document.querySelector('#help-dialog .help-body')!.scrollTop)).toBeGreaterThan(100);
  await page.keyboard.press('Escape');
  await expect(bannerWhy).toBeFocused();
  // The marker of a deep link does not stay for the next plain open.
  await page.click(HELP_BUTTON);
  expect(await selectedTab(page)).toBe('room');
  await expect(page.locator('#help-dialog .help-target')).toHaveCount(0);
});

test('the ? pop-up at 375 px: a Topic select replaces the tabs and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page);
  await page.click(HELP_BUTTON);
  await expect(page.locator(`${HELP} .help-tabs`)).toBeHidden();
  const topic = page.locator('#help-topic');
  await expect(topic).toBeVisible();
  await expect(topic).toBeFocused();
  await expect(page.locator(`${HELP} .help-topic > span`)).toHaveText('Topic');
  await expect(topic).toHaveValue('start');
  const sideways = () =>
    page.evaluate(() => {
      const d = document.querySelector<HTMLElement>('#help-dialog')!;
      const body = d.querySelector<HTMLElement>('.help-body')!;
      const r = d.getBoundingClientRect();
      return {
        page: document.documentElement.scrollWidth - window.innerWidth,
        body: body.scrollWidth - body.clientWidth,
        insideViewport: r.left >= 0 && r.right <= window.innerWidth,
      };
    });
  for (const id of ['start', 'product', 'room', 'files', 'built']) {
    await topic.selectOption(id);
    await expect(page.locator(`#help-panel-${id}`)).toBeVisible();
    expect(await sideways(), id).toEqual({ page: 0, body: 0, insideViewport: true });
  }
  await page.keyboard.press('Escape');
  await expect(page.locator(HELP_BUTTON)).toBeFocused();

  // A deep link at this width lands on its section too.
  await page.click(ROOM_TOGGLE);
  await page.click('#room-ingress button[data-ingress=import]');
  await page.click('#import-oda-note .why-link');
  await expect(topic).toHaveValue('room');
  expect(await inHelpView(page, '#help-import-plan')).toBe(true);
  expect(await sideways()).toEqual({ page: 0, body: 0, insideViewport: true });
});

test('the two honesty pins: one friendly line on screen, the technical sentence kept in a collapsed "Technical details"', async ({ page }) => {
  await open(page);
  await page.click(ROOM_TOGGLE);
  await page.click('#room-ingress button[data-ingress=import]');

  // ---- #import-oda-note (Copy Phase 1 step 6) ----
  const note = page.locator('#import-oda-note');
  await expect(page.locator('#room-ingress-import .badge')).toHaveText('Sample only');
  await expect(note.locator('.import-note-line')).toHaveText(
    /^\s*Best with a PNG or JPG\. DWG\/DXF shows a sample result for now\. PDF isn't supported yet\.\s+Why\?\s*$/,
  );
  const noteDetails = note.locator('details');
  await expect(noteDetails.locator('summary')).toHaveText('Technical details');
  expect(await noteDetails.evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);
  // Collapsed, the sentence is not shown...
  await expect(noteDetails.locator('.technical-body')).toBeHidden();
  expect(await note.evaluate((el: HTMLElement) => el.innerText)).not.toContain('ODA');
  // ...and it is still in the page (the pin of dwg-plan-import.spec.ts).
  await expect(note).toContainText('ODA / APS not available');
  await noteDetails.locator('summary').click();
  await expect(noteDetails.locator('.technical-body')).toBeVisible();
  await expect(noteDetails.locator('.technical-body')).toHaveText(
    'ODA / APS not available here — DWG/DXF use a clearly labeled mock fixture extract, not real entity parsing.',
  );
  await noteDetails.locator('summary').click();

  // ---- #import-extract-banner (Copy Phase 1 step 5) ----
  const banner = page.locator('#import-extract-banner');
  await expect(banner).toHaveAttribute('role', 'status');
  expect(await banner.evaluate((el) => el.tagName)).toBe('DIV');

  // "Try the sample plan": there is no file, so the line does not say one was kept.
  await page.click('#btn-import-fixture');
  await expect(page.locator('#import-review')).toBeVisible({ timeout: 10_000 });
  await expect(banner.locator('.import-banner-line')).toHaveText(/^Sample plan\. These walls come from a built-in example\.\s+Why\?$/);
  await expect(banner.locator('.import-banner-line strong')).toHaveText('Sample plan.');
  await expect(page.locator('#import-status')).toHaveText('Sample plan');
  const bannerDetails = banner.locator('details');
  await expect(bannerDetails.locator('summary')).toHaveText('Technical details');
  expect(await bannerDetails.evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);
  await expect(bannerDetails.locator('.technical-body')).toBeHidden();
  expect(await banner.evaluate((el: HTMLElement) => el.innerText)).not.toMatch(/mock_fixture|ODA/);
  await expect(banner).toContainText('mock_fixture');
  await expect(banner).toContainText('ODA available: no');
  // The original string, unchanged.
  await expect(bannerDetails.locator('.technical-body')).toHaveText(/^\[mock_fixture\] ODA available: no — ODA Drawings \/ APS Model Derivative not available on this machine\./);
  // Opened, it stays open while the review is redrawn (a row is left out).
  await bannerDetails.locator('summary').click();
  await expect(bannerDetails.locator('.technical-body')).toBeVisible();
  await page.click('#import-wall-list li:nth-child(1) button[data-include=false]');
  expect(await banner.locator('details').evaluate((d: HTMLDetailsElement) => d.open)).toBe(true);

  // An uploaded DWG: the deck's line. The file is kept, not read; the walls are the sample's.
  await page.setInputFiles('#plan-file', {
    name: 'ground-floor.dwg',
    mimeType: 'application/acad',
    buffer: Buffer.concat([Buffer.from('AC1027'), Buffer.alloc(64)]),
  });
  await page.click('#btn-import-plan');
  await expect(page.locator('#import-status')).toHaveText('ground-floor.dwg');
  await expect(banner.locator('.import-banner-line')).toHaveText(
    /^Sample result\. Your file was kept but not read\. These walls come from a built-in example, not your drawing\.\s+Why\?$/,
  );
  await expect(banner.locator('.import-banner-line strong')).toHaveText('Sample result.');
  await expect(banner).toHaveAttribute('data-kind', 'sample');
  await expect(banner).toContainText('mock_fixture');
  await expect(banner).toContainText('ODA available: no');

  // A JSON plan is the user's own list of walls, and it is read: no sample line, only the technical string.
  const plan = await page.evaluate(() => fetch('/fixtures/dwg-import/sample-plan.candidates.json').then((r) => r.json()));
  delete plan.extract; // a plan of the user's own does not carry the sample's label
  await page.setInputFiles('#plan-file', { name: 'my-plan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(plan)) });
  await page.click('#btn-import-plan');
  await expect(page.locator('#import-status')).toHaveText('my-plan.json');
  await expect(banner).toHaveAttribute('data-kind', 'plain');
  await expect(banner.locator('.import-banner-line')).toHaveCount(0);
  await expect(banner.locator('.why-link')).toHaveCount(0);
  await expect(banner).toContainText('[json_candidates] ODA available: no');
  await expect(banner.locator('details summary')).toHaveText('Technical details');

  // An image is traced, not sampled: its form has the deck's words and no banner (deck §3.5).
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.setInputFiles('#plan-file', { name: 'flat.png', mimeType: 'image/png', buffer: onePixelPng });
  await page.click('#btn-import-plan');
  const trace = page.locator('#underlay-review');
  await expect(trace).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#import-review')).toBeHidden();
  await expect(trace.locator('.room-subhead')).toHaveText('Trace over your image');
  await expect(trace.locator('.badge')).toHaveCount(0);
  await expect(page.locator('#underlay-status')).toHaveText('Enter the real size of this plan. A rectangular room will be traced to match.');
  await expect(trace.locator('label > span')).toHaveText(['Width (m)', 'Depth (m)']);
  await expect(page.locator('#btn-underlay-confirm')).toHaveText('Create room from image');
  await expect(page.locator('#underlay-preview')).toHaveAttribute('aria-label', 'Preview of your image');
  await expect(page.locator('#underlay-preview img')).toHaveAttribute('alt', 'Preview of your image');
  expect(await teamWords(page)).toEqual([]);
});

for (const size of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
]) {
  test(`QA-10: the top bar keeps its height when the workspace changes, at ${size.width} px`, async ({ page }) => {
    await page.setViewportSize(size);
    await open(page);
    const measure = () =>
      page.evaluate(() => {
        const hint = document.getElementById('workspace-mode-hint')!;
        return {
          topbar: document.querySelector('.topbar')!.getBoundingClientRect().height,
          stageTop: document.querySelector('.stage')!.getBoundingClientRect().top + window.scrollY,
          hintLines: Math.round(hint.getBoundingClientRect().height / parseFloat(getComputedStyle(hint).lineHeight)),
          help: !!document.getElementById('btn-help'),
        };
      });
    const product = await measure();
    expect(product.help).toBe(true); // measured with the ? button in place
    expect(product.hintLines).toBe(1);
    await expect(page.locator('#workspace-mode-hint')).toHaveText('Spin a product and try materials.');
    await page.click(ROOM_TOGGLE);
    await expect(page.locator('#workspace-mode-hint')).toHaveText('Build a room, then place products in it.');
    const room = await measure();
    expect(room).toEqual(product);
    await page.click(PRODUCT_TOGGLE);
    expect(await measure()).toEqual(product);
  });
}

test('QA-14: the accessible name of each labelled field is its visible label', async ({ page }) => {
  await open(page);

  // The audit's own check (fixes/qa-evidence, section F5): a field that has both a visible label
  // and an aria-label must have the label's words in the aria-label. Run over the whole page.
  const mismatches = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')]
      .filter((e) => e.getAttribute('aria-label'))
      .map((e) => {
        const label = e.labels?.[0];
        let visible = '';
        if (label) {
          const copy = label.cloneNode(true) as HTMLElement;
          copy.querySelectorAll('select,input,textarea').forEach((x) => x.remove());
          visible = (copy.textContent ?? '').trim().replace(/\s+/g, ' ');
        }
        const name = e.getAttribute('aria-label')!;
        return { id: e.id, visible, name, ok: !visible || name.toLowerCase().includes(visible.toLowerCase()) };
      })
      .filter((x) => !x.ok),
  );
  expect(mismatches).toEqual([]);

  // The six fields of QA-14, each shown and asked for its accessible name.
  await expect(page.locator('#model-files')).toHaveAccessibleName('Add 3D model');
  await page.click('#product-advanced-summary');
  await expect(page.locator('#pack-files')).toHaveAccessibleName('Load pack (.mjs + .glb)');
  await expect(page.locator('#pack-glb-mate')).toHaveAccessibleName('Or add the .glb on its own');
  await expect(page.locator('#module-file')).toHaveAccessibleName('Load module (.mjs only)');
  // "Add to material" is a picker: the control people use is its trigger, named by the label and the choice.
  await page.selectOption('#texture-role', 'normalMap');
  await expect(page.locator('#texture-target-wrap > span')).toHaveText('Add to material');
  await expect(page.locator('.tpicker[data-picker-for=texture-target] .tpicker-trigger')).toHaveAccessibleName(/^Add to material\b/);
  expect(await page.evaluate(() => document.getElementById('texture-target')!.getAttribute('aria-label'))).toBeNull();
  // The other fields of that form are named by their labels as well.
  await expect(page.locator('#texture-file')).toHaveAccessibleName('Image');
  await expect(page.locator('#texture-name')).toHaveAccessibleName('Name');
  await expect(page.locator('#texture-name')).toHaveAttribute('placeholder', 'Optional');
  await expect(page.locator('#texture-category')).toHaveAccessibleName('Category');
  await expect(page.locator('#texture-role')).toHaveAccessibleName('Use as');
  await expect(page.locator('#mjs-enabled')).toHaveAccessibleName('Allow .mjs files (they run code)');

  await page.click(ROOM_TOGGLE);
  await page.click('#room-ingress button[data-ingress=import]');
  await expect(page.locator('#plan-file')).toHaveAccessibleName('Plan file');
  await expect(page.locator('#room-units')).toHaveAccessibleName('Units');
  await page.click('#room-ingress button[data-ingress=scratch]');
  await expect(page.locator('#room-preset')).toHaveAccessibleName('Preset');
  for (const id of ['plan-file', 'model-files', 'pack-files', 'pack-glb-mate', 'module-file', 'texture-target']) {
    expect(await page.evaluate((id) => document.getElementById(id)!.hasAttribute('aria-label'), id), id).toBe(false);
  }
});

test('the labels that end in a unit follow the Units select', async ({ page }) => {
  await open(page);
  await page.click(ROOM_TOGGLE);
  const labels = () =>
    page.evaluate(() =>
      ['room-length', 'room-width', 'room-ceiling', 'room-thickness', 'opening-width', 'opening-height', 'opening-sill'].map(
        (id) => (document.getElementById(id) as HTMLInputElement).labels![0]!.querySelector('span')!.textContent,
      ),
    );
  const expected = (unit: string) => [
    `Length (${unit})`, `Width (${unit})`, `Ceiling height (${unit})`, `Wall thickness (${unit})`,
    `Width (${unit})`, `Height (${unit})`, `Sill height (${unit})`,
  ];
  await expect(page.locator('#room-units option')).toHaveText(['Meters (m)', 'Centimeters (cm)', 'Feet']);
  expect(await labels()).toEqual(expected('m'));

  await page.selectOption('#room-units', 'cm');
  expect(await labels()).toEqual(expected('cm'));
  // The label is the field's accessible name, and the number in the field is in that unit.
  await page.selectOption('#room-preset', 'custom');
  await expect(page.locator('#room-length')).toHaveAccessibleName('Length (cm)');
  await expect(page.locator('#room-thickness')).toHaveValue('12');

  await page.selectOption('#room-units', 'ft-in');
  expect(await labels()).toEqual(expected('ft'));
  await expect(page.locator('#room-ceiling')).toHaveAccessibleName('Ceiling height (ft)');

  await page.selectOption('#room-units', 'm');
  expect(await labels()).toEqual(expected('m'));

  // With a room, the opening fields are on screen: the same labels there.
  await page.selectOption('#room-units', 'cm');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  await expect(page.locator('#step-openings-body')).toBeVisible();
  await expect(page.locator('#opening-width')).toHaveAccessibleName('Width (cm)');
  await expect(page.locator('#opening-sill')).toHaveAccessibleName('Sill height (cm)');
  await expect(page.locator('#opening-width')).toHaveValue('90');

  // The plan-import fields are always in metres, and say so.
  await page.click('#btn-step-room-change');
  await page.click('#room-ingress button[data-ingress=import]');
  await page.click('#btn-import-fixture');
  await expect(page.locator('#import-review')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#import-known-length')).toHaveAccessibleName('Length of the south wall (m)');
});

test('static words come from the deck: labels, badges, options; the removed paragraphs are gone; no team vocabulary on screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await open(page);

  // Nothing that names a string in src/copy.ts was left without it.
  const unfilled = await page.evaluate(() => ({
    text: [...document.querySelectorAll<HTMLElement>('[data-copy], [data-unit-label]')].filter((e) => !e.textContent!.trim()).map((e) => e.outerHTML.slice(0, 100)),
    ariaLabel: [...document.querySelectorAll('[data-copy-aria-label]')].filter((e) => !e.getAttribute('aria-label')).length,
    title: [...document.querySelectorAll<HTMLElement>('[data-copy-title]')].filter((e) => !e.title).length,
    placeholder: [...document.querySelectorAll('[data-copy-placeholder]')].filter((e) => !e.getAttribute('placeholder')).length,
  }));
  expect(unfilled).toEqual({ text: [], ariaLabel: 0, title: 0, placeholder: 0 });

  // ---- Product workspace (deck §3.1, §3.2, §3.4) ----
  await expect(page.locator('.brand')).toHaveText('Catalog 3D');
  await expect(page.locator('#workspace-mode-label')).toHaveText('Workspace');
  await expect(page.locator('#workspace-mode button')).toHaveText(['Product', 'Room workspace']);
  await expect(page.locator('#btn-reset')).toHaveText('Reset camera');
  await expect(page.locator('#btn-remount')).toHaveText('Restart 3D view');
  await expect(page.locator('#btn-remount')).toHaveAttribute('title', 'Rebuilds the 3D view. Your choices are kept.');
  await expect(page.locator('#presets button')).toHaveText(['Studio soft', 'Warm interior', 'Neutral']);
  await expect(page.locator('#stage-hint')).toHaveText('Drag to spin · scroll to zoom · right-drag to pan');
  await expect(page.locator('#catalog-card h2')).toHaveText('Product');
  await expect(page.locator('#product-meta')).toHaveText('STUB-SKU-CHAIR-001');
  await expect(page.locator('#materials-card h2')).toHaveText('Materials');
  await expect(page.locator('#slots .slot-meta')).toHaveCount(0);
  await expect(page.locator('label[for=model-files]')).toHaveText('Add 3D model');
  await expect(page.locator('#add-model-card .upload-hint')).toHaveText('.glb works best. OBJ and glTF also work.');
  await expect(page.locator('#parts-card h2')).toHaveText(/^Parts list\s+Placeholder$/);
  await page.click('#product-advanced-summary');
  await expect(page.locator('.advanced-block h3')).toHaveText('Add texture');
  await expect(page.locator('.advanced-block .upload-hint')).toHaveText('PNG, JPEG or WebP. Gone when you refresh.');
  await expect(page.locator('.advanced-block .form-grid > label > span')).toHaveText(['Image', 'Name', 'Category', 'Use as', 'Add to material']);
  await expect(page.locator('#texture-category option')).toHaveText(['Wood', 'Textile', 'Plastic', 'Stone', 'Metal']);
  await expect(page.locator('#texture-role option')).toHaveText([
    'Color (new material)', 'Normal map (existing material)', 'Roughness map (existing material)',
  ]);
  await expect(page.locator('#btn-add-texture')).toHaveText('Add to library');
  await expect(page.locator('label[for=pack-files] + .upload-hint')).toHaveText('Select both files together. Runs code — only load files you trust.');
  await expect(page.locator('label[for=module-file] + .upload-hint')).toHaveText('Use Load pack if you also have the .glb.');
  // Visible text, Product: the only team word left is the placeholder SKU prefix, on the SKU line
  // and inside the Parts list data (deck §3.4 and §10 keep both as they are).
  const productWords = await teamWords(page);
  expect(productWords.filter((line) => !/STUB-(SKU|MAT)-|^"stub": true,$/.test(line))).toEqual([]);
  expect(productWords.length).toBeGreaterThan(0);
  await page.click('#product-advanced-summary');

  // ---- Room workspace, no room (deck §3.1, §3.3, §3.5, §3.6) ----
  await page.click(ROOM_TOGGLE);
  await expect(page.locator('#room-card > h2')).toHaveText(/^Room workspace\s+Preview$/);
  await expect(page.locator('#room-status')).toHaveText('No room yet. Pick a way to start below.');
  await expect(page.locator('#stage-hint')).toHaveText('Create or import a room to start.');
  await expect(page.locator('#room-toolbar button:visible')).toHaveText(['Import project']);
  await expect(page.locator('#room-ingress button')).toHaveText(['From scratch', 'Import plan', 'From template']);
  await expect(page.locator('#room-preset option')).toHaveText([
    'Small bedroom · 3 × 3 m', 'Living room · 5 × 4 m', 'Studio · 6 × 4 m', 'Custom size…',
  ]);
  await expect(page.locator('#btn-create-room')).toHaveText('Create room');
  await expect(page.locator('.step-alt .room-subhead')).toHaveText('Draw walls');
  await expect(page.locator('#btn-draw-wall-mode')).toHaveText('Draw walls');
  await page.click('#room-more-summary');
  await expect(page.locator('#room-more label > span')).toHaveText('Template name (optional)');
  await expect(page.locator('#template-title')).toHaveAttribute('placeholder', 'My room template');
  await expect(page.locator('#btn-save-template-scratch')).toHaveText('Save as template');
  await page.click('#room-more-summary');
  await expect(page.locator('#room-card .room-graph-details > summary')).toHaveText('Developer view: room data (JSON)');
  // The three sub-heads under the tabs are gone (the tab says it), in each tab.
  await expect(page.locator('#room-ingress-scratch .room-subhead')).toHaveCount(0);
  expect(await teamWords(page)).toEqual([]);

  await page.click('#room-ingress button[data-ingress=template]');
  await expect(page.locator('#room-ingress-template .room-subhead')).toHaveCount(0);
  await expect(page.locator('#template-status')).toHaveText('No templates yet. Save a room to reuse it.');

  // ---- Import plan review ----
  await page.click('#room-ingress button[data-ingress=import]');
  await expect(page.locator('#room-ingress-import > .room-subhead')).toHaveCount(0);
  await expect(page.locator('label[for=plan-file]')).toHaveText('Plan file');
  await expect(page.locator('#btn-import-plan')).toHaveText('Upload plan');
  await expect(page.locator('#btn-import-fixture')).toHaveText('Try the sample plan');
  await page.click('#btn-import-fixture');
  await expect(page.locator('#import-review')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#import-review label > span')).toHaveText('Length of the south wall (m)');
  await expect(page.locator('#btn-import-apply-scale')).toHaveText('Set scale');
  await expect(page.locator('#import-scale-status')).toHaveText('The drawing suggests this wall is 5 m.');
  await expect(page.locator('#import-review .list-nudge')).toHaveText("Leave out anything that doesn't belong.");
  await expect(page.locator('#import-review .room-subhead')).toHaveText(['Walls found', 'Doors and windows found', 'Rooms found']);
  await expect(page.locator('#import-wall-list li > span:first-child')).toHaveText(['Wall 1 · 5.00 m', 'Wall 2 · 4.00 m', 'Wall 3 · 5.00 m', 'Wall 4 · 4.00 m']);
  await expect(page.locator('#import-opening-list li > span:first-child').first()).toHaveText(/^(Door|Window) · \d\.\d\d m( · estimated)?$/);
  await expect(page.locator('#btn-import-start-editing')).toHaveText('Create room from plan');
  await expect(page.locator('#btn-import-save-template')).toHaveText('Save as template');
  expect(await teamWords(page)).toEqual([]);

  // Included / Left out: both words on every row, as two buttons that never rename themselves.
  const toggles = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#import-review .room-list li')].map((li) =>
        [...li.querySelectorAll('button')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`).join(' '),
      ),
    );
  const all = await toggles();
  expect(all.length).toBeGreaterThanOrEqual(6);
  expect(new Set(all)).toEqual(new Set(['Included:true Left out:false']));
  const leaveOut = page.locator('#import-wall-list li:nth-child(2) button[data-include=false]');
  await leaveOut.click();
  expect((await toggles())[1]).toBe('Included:false Left out:true');
  expect(await page.evaluate(() => window.__rv.importJob()!.candidates.walls[1]!.accepted)).toBe(false);
  await expect(leaveOut).toBeFocused(); // the list was redrawn; focus stayed on the button that was pressed
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  expect((await toggles())[1]).toBe('Included:true Left out:false');
  expect(await page.evaluate(() => window.__rv.importJob()!.candidates.walls[1]!.accepted)).toBe(true);

  // Save it as a template: the row, its button and the count are the deck's.
  await page.click('#btn-import-save-template');
  await expect(page.locator('#template-list li')).toHaveCount(1);
  await expect(page.locator('#template-list li > span:first-child')).toHaveText(/ · 4 walls$/);
  await expect(page.locator('#template-list li button')).toHaveText(['Use template', 'Delete']);
  await expect(page.locator('#template-list li button').first()).toHaveAttribute('data-action', 'use-template');
  await expect(page.locator('#template-status')).toHaveText('1 saved in this browser.');

  // ---- A room with a placed product (deck §3.6) ----
  await page.click('#template-list li button[data-action="use-template"]');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  await expect(page.locator('#room-toolbar button')).toHaveText(['Undo', 'Redo', 'Export project', 'Import project']);
  await expect(page.locator('#btn-undo')).toHaveAttribute('title', 'Undo (Ctrl/Cmd+Z)');
  await expect(page.locator('#btn-redo')).toHaveAttribute('title', 'Redo (Ctrl/Cmd+Shift+Z)');
  await expect(page.locator('#opening-type button')).toHaveText(['Door', 'Window']);
  await expect(page.locator('#btn-opening-mode')).toHaveText('Add opening');
  await expect(page.locator('#opening-list')).toHaveAttribute('aria-label', 'Openings');
  // The sample plan has a door and a window: their rows.
  await expect(page.locator('#opening-list li > span:first-child').first()).toHaveText(/^(Door|Window) · \d\.\d\d m × \d\.\d\d m · sill \d\.\d\d m$/);
  await expect(page.locator('#opening-list li button').first()).toHaveText('Delete');
  await page.click('.step[data-step=place] .step-toggle');
  await expect(page.locator('#step-place-body > p')).toHaveCount(0); // the "Select a Catalog product…" paragraph
  await expect(page.locator('#step-place-body .checkbox-field span')).toHaveText('Snap to nearest wall');
  await expect(page.locator('#btn-place-mode')).toHaveText('Place product');
  await expect(page.locator('#placement-list')).toHaveAttribute('aria-label', 'Products');
  await expect(page.locator('#step-place-body #materials-card h2')).toHaveText('Materials');
  await page.click('#btn-add-to-room');
  await expect(page.locator('#placement-list li.placement-row')).toHaveCount(1);
  await page.click('.step[data-step=finish] .step-toggle');
  await expect(page.locator('#step-finish-body label > span')).toHaveText(['Walls', 'Floor']);
  await expect(page.locator('#btn-download-plan')).toHaveText('Download plan PNG');
  await expect(page.locator('#btn-clear-room')).toHaveText('Clear room');
  expect(await teamWords(page)).toEqual([]);

  // The five paragraphs the deck removes are nowhere in the page, shown or not.
  const everything = await page.evaluate(() => document.body.textContent ?? '');
  for (const gone of [
    'Three create paths',
    'Rectangular shell',
    'Instantiate a saved room-graph seed',
    'Click floor corners to trace an orthogonal polygon',
    'Select a Catalog product, then click the floor',
    'Dispose',
    'Polyfork',
  ]) {
    expect(everything, gone).not.toContain(gone);
  }

  expect(errors).toEqual([]);
});

test('a slot swatch keeps its name and tooltip whatever is pressed (aria-pressed carries the state)', async ({ page }) => {
  await open(page);
  const swatches = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLButtonElement>('.slot[data-slot=frame] .swatch')].map((b) => ({
        name: b.getAttribute('aria-label'),
        title: b.title,
        pressed: b.getAttribute('aria-pressed'),
      })),
    );
  const before = await swatches();
  expect(before.map((s) => s.pressed)).toEqual(['true', 'false', 'false']);
  expect(before[0]).toMatchObject({ name: 'Natural oak', title: 'Natural oak (STUB-MAT-WOOD-OAK)' });
  await expect(page.locator('.slot[data-slot=frame] .swatches')).toHaveAttribute('aria-label', 'Frame materials');
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await expect(page.locator('.slot[data-slot=frame] .swatch[data-material=wood-walnut]')).toHaveAttribute('aria-pressed', 'true');
  const after = await swatches();
  expect(after.map((s) => s.pressed)).toEqual(['false', 'true', 'false']);
  expect(after.map(({ name, title }) => ({ name, title }))).toEqual(before.map(({ name, title }) => ({ name, title })));
});

test.describe('the stage overlay says what failed, in the deck\'s words (Copy Phase 1 step 8)', () => {
  const overlayText = (page: Page) => page.locator('#viewer-overlay');
  const waitForError = (page: Page) =>
    expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'error', { timeout: 30_000 });

  test('the viewer could not start: it does not say "model"', async ({ page }) => {
    await page.route('**/assets/library/catalog.json', (route) => route.fulfill({ status: 500, body: 'no' }));
    await page.goto('/');
    await waitForError(page);
    await expect(overlayText(page)).toHaveText("The viewer couldn't start. Reload the page. If it happens again, your saved room may be damaged.");
    await expect(overlayText(page).locator('strong')).toHaveText("The viewer couldn't start.");
    await expect(overlayText(page)).not.toContainText(/model|HTTP 500|catalog\.json/);
    await expect(overlayText(page)).toHaveClass(/error/);
  });

  test('the product\'s model could not be loaded: it says so, without the raw error', async ({ page }) => {
    await page.route('**/*.glb', (route) => route.fulfill({ status: 404, body: 'gone' }));
    await page.goto('/');
    await waitForError(page);
    await expect(overlayText(page)).toHaveText("This product's 3D model couldn't be loaded. Choose another product, or reload the page.");
    await expect(overlayText(page)).not.toContainText(/404|fetch|\.glb/);
    // The rest of the page is there and labelled: this is not a failed start.
    await expect(page.locator('#workspace-mode button')).toHaveText(['Product', 'Room workspace']);
    await expect(page.locator(HELP_BUTTON)).toBeVisible();
  });

  test('the browser has no 3D: the software-3D launcher is the one named', async ({ page }) => {
    // A browser without WebGL: every request for a WebGL context is refused.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    await page.goto('/');
    await waitForError(page);
    await expect(overlayText(page)).toHaveText(
      "3D isn't available in this browser. Turn on hardware acceleration, or try another browser. On a Mac you can also open “Start Viewer (software 3D).command” from the viewer folder.",
    );
    await expect(overlayText(page).locator('strong')).toHaveText("3D isn't available in this browser.");
  });
});
