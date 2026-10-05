// The ? pop-up (Copy handoff Phase 2, deck §2 "Behavior").
//
// A native <dialog> opened with showModal(): the browser supplies the focus trap and Esc.
// Five tabs (real tablist, roving tabindex, arrow keys); a Topic <select> replaces them at
// 860 px and below. The pop-up builds its own DOM on first open, so nothing has to be
// added to index.html except the ? button, which createHelpButton() makes to spec.
//
// It never opens by itself. The content is static authored HTML from help-content.ts.
import './help.css';
import {
  HELP_ANCHORS,
  HELP_BUTTON_ARIA_LABEL,
  HELP_BUTTON_TEXT,
  HELP_BUTTON_TOOLTIP,
  HELP_CLOSE_ARIA_LABEL,
  HELP_TITLE,
  HELP_TOPIC_LABEL,
  buildHelpTabs,
  type HelpAnchor,
  type HelpTab,
  type HelpTabId,
} from './help-content';
import { wireModalDialog } from './ui/confirmDialog';

export type { HelpAnchor, HelpTabId } from './help-content';

export interface HelpOptions {
  /**
   * Copy handoff §6 item A. Leave false until the "Saving blocked" banner (deck §4.F)
   * really appears when storage fails. false shows the interim sentence in Files & saving;
   * true shows the deck sentence "If your browser blocks saving, the app tells you."
   * Default: false.
   */
  storageFailureIsSurfaced?: boolean;
  /**
   * Deck §2 Behavior: "first visit → Start here". The first time the pop-up is opened
   * from the ? button it shows Start here; after that it follows the workspace.
   * false: always follow the workspace. Default: true.
   */
  startHereOnFirstVisit?: boolean;
  /**
   * Deck §2 Behavior (optional item): a small dot on the ? until the pop-up has been
   * opened once. Default: false.
   */
  unseenDot?: boolean;
  /** An existing ? button to set up, instead of calling createHelpButton(). */
  button?: HTMLButtonElement | null;
}

export interface OpenHelpOptions {
  /** Tab to show. Default: the tab for the current workspace (or the anchor's tab). */
  tab?: HelpTabId;
  /** Section to land on: 'import-plan' (Room tab) or 'plans' (Files & saving). A leading # is accepted. */
  anchor?: HelpAnchor | `#${HelpAnchor}`;
  /**
   * Element that gets focus back when the pop-up closes, for example the "Why?" link
   * that opened it. Default: the element focused when openHelp() was called, or the
   * ? button if nothing was.
   */
  returnFocusTo?: HTMLElement | null;
}

/** localStorage flag: '1' once the pop-up has been opened. Same prefix as the app's other keys. */
export const HELP_SEEN_KEY = 'catalog3d.helpSeen';

const CLOSE_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<path d="M3.5 3.5l9 9m0-9l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const settings = {
  storageFailureIsSurfaced: false,
  startHereOnFirstVisit: true,
  unseenDot: false,
};

interface HelpDom {
  /** Value of `storageFailureIsSurfaced` the content was built with. */
  builtSurfaced: boolean;
  dialog: HTMLDialogElement;
  scroller: HTMLElement;
  tablist: HTMLElement;
  topic: HTMLSelectElement;
  tabs: Map<HelpTabId, HTMLButtonElement>;
  panels: Map<HelpTabId, HTMLElement>;
  order: HelpTabId[];
}

let dom: HelpDom | null = null;
let activeTab: HelpTabId = 'start';
let helpButton: HTMLButtonElement | null = null;
const helpButtons = new Set<HTMLButtonElement>();
let returnFocusTo: HTMLElement | null = null;
let seenThisPageLoad = false;

/* ---------- "seen" flag (storage can be blocked, so every access is guarded) ---------- */

function hasBeenSeen(): boolean {
  if (seenThisPageLoad) return true;
  try {
    return localStorage.getItem(HELP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  seenThisPageLoad = true;
  try {
    localStorage.setItem(HELP_SEEN_KEY, '1');
  } catch {
    // Storage is blocked. The flag then lasts for this page load only.
  }
  helpButtons.forEach((button) => delete button.dataset.unseen);
}

function syncUnseenDot(button: HTMLButtonElement): void {
  if (settings.unseenDot && !hasBeenSeen()) button.dataset.unseen = 'true';
  else delete button.dataset.unseen;
}

/* ---------- Building the dialog ---------- */

function buildDialog(): HelpDom {
  const builtSurfaced = settings.storageFailureIsSurfaced;
  const tabsContent: HelpTab[] = buildHelpTabs({ storageFailureIsSurfaced: builtSurfaced });

  // A hot reload can leave the previous module's dialog behind. Keep ids unique.
  document.getElementById('help-dialog')?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'help-dialog';
  dialog.className = 'app-dialog help-dialog';
  dialog.setAttribute('aria-labelledby', 'help-title');

  const surface = document.createElement('div');
  surface.className = 'app-dialog-surface';

  const head = document.createElement('div');
  head.className = 'app-dialog-head';
  const title = document.createElement('h2');
  title.id = 'help-title';
  title.className = 'app-dialog-title';
  title.textContent = HELP_TITLE;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'app-dialog-close';
  close.setAttribute('aria-label', HELP_CLOSE_ARIA_LABEL);
  close.innerHTML = CLOSE_ICON;
  close.addEventListener('click', () => dialog.close());
  head.append(title, close);

  const nav = document.createElement('div');
  nav.className = 'help-nav';

  // Tabs (desktop). Not .segmented as is: .help-tabs lays the five out in one row.
  const tablist = document.createElement('div');
  tablist.className = 'segmented help-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-labelledby', 'help-topic-label');

  // Topic select (860 px and below).
  const topicField = document.createElement('label');
  topicField.className = 'field help-topic';
  const topicLabel = document.createElement('span');
  topicLabel.id = 'help-topic-label';
  topicLabel.textContent = HELP_TOPIC_LABEL;
  const topic = document.createElement('select');
  topic.id = 'help-topic';
  topic.className = 'select';
  topicField.append(topicLabel, topic);

  const scroller = document.createElement('div');
  scroller.className = 'help-body';

  const tabs = new Map<HelpTabId, HTMLButtonElement>();
  const panels = new Map<HelpTabId, HTMLElement>();
  const order: HelpTabId[] = [];

  for (const content of tabsContent) {
    order.push(content.id);

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `help-tab-${content.id}`;
    tab.dataset.helpTab = content.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `help-panel-${content.id}`);
    tab.setAttribute('aria-selected', 'false');
    tab.tabIndex = -1;
    tab.textContent = content.label;
    tab.addEventListener('click', () => selectTab(content.id));
    tablist.append(tab);
    tabs.set(content.id, tab);

    const option = document.createElement('option');
    option.value = content.id;
    option.textContent = content.label;
    topic.append(option);

    const panel = document.createElement('section');
    panel.id = `help-panel-${content.id}`;
    panel.className = 'help-panel';
    panel.dataset.helpPanel = content.id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    panel.hidden = true;
    // Static authored HTML from help-content.ts. Never user input.
    panel.innerHTML = content.html;
    scroller.append(panel);
    panels.set(content.id, panel);
  }

  tablist.addEventListener('keydown', (event) => {
    const index = order.indexOf(activeTab);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + order.length) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    if (next < 0) return;
    event.preventDefault();
    selectTab(order[next]);
    tabs.get(order[next])?.focus();
  });

  topic.addEventListener('change', () => selectTab(topic.value as HelpTabId));

  nav.append(tablist, topicField);
  surface.append(head, nav, scroller);
  dialog.append(surface);

  wireModalDialog(dialog);
  dialog.addEventListener('close', () => {
    const target = returnFocusTo?.isConnected ? returnFocusTo : helpButton;
    returnFocusTo = null;
    target?.focus();
  });

  document.body.append(dialog);
  return { builtSurfaced, dialog, scroller, tablist, topic, tabs, panels, order };
}

function ensureDialog(): HelpDom {
  // Rebuild when the content option changed since the dialog was built (never while open).
  const stale = dom && !dom.dialog.open && dom.builtSurfaced !== settings.storageFailureIsSurfaced;
  if (!dom || !dom.dialog.isConnected || stale) dom = buildDialog();
  return dom;
}

/* ---------- Tabs ---------- */

function clearTarget(): void {
  dom?.dialog.querySelectorAll('.help-target').forEach((element) => element.classList.remove('help-target'));
}

function selectTab(id: HelpTabId): void {
  const d = ensureDialog();
  if (!d.panels.has(id)) return;
  activeTab = id;
  d.tabs.forEach((tab, tabId) => {
    const selected = tabId === id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  d.panels.forEach((panel, panelId) => {
    panel.hidden = panelId !== id;
  });
  d.topic.value = id;
  d.scroller.scrollTop = 0;
  clearTarget();
}

/** Deck §2: Product workspace → Product, Room workspace → Room, first visit → Start here. */
function tabForContext(): HelpTabId {
  if (settings.startHereOnFirstVisit && !hasBeenSeen()) return 'start';
  const workspace = document.body.dataset.workspace;
  if (workspace === 'catalog') return 'product';
  if (workspace === 'room') return 'room';
  return 'start';
}

function isShown(element: HTMLElement): boolean {
  return element.getClientRects().length > 0;
}

/* ---------- Public API ---------- */

/**
 * Opens the pop-up. With no arguments it picks the tab from the workspace
 * (`document.body.dataset.workspace`). `anchor` lands on one section and wins over `tab`.
 */
export function openHelp(target: OpenHelpOptions = {}): void {
  const d = ensureDialog();
  const anchorKey = target.anchor ? (target.anchor.replace(/^#/, '') as HelpAnchor) : undefined;
  const anchor = anchorKey ? HELP_ANCHORS[anchorKey] : undefined;
  const tab = anchor?.tab ?? target.tab ?? tabForContext();
  markSeen();

  if (!d.dialog.open) {
    const focused = document.activeElement;
    returnFocusTo =
      target.returnFocusTo ?? (focused instanceof HTMLElement && focused !== document.body ? focused : null);
    d.dialog.showModal();
  }
  selectTab(tab);

  const section = anchor ? d.dialog.querySelector<HTMLElement>(`#${anchor.elementId}`) : null;
  if (section) {
    section.classList.add('help-target');
    // Instant, so there is no scroll animation to switch off for reduced motion.
    d.scroller.scrollTop += section.getBoundingClientRect().top - d.scroller.getBoundingClientRect().top - 8;
    section.focus({ preventScroll: true });
    return;
  }
  // Focus the control that switches topic: the selected tab, or the Topic select when the
  // tabs are replaced at 860 px and below.
  const selectedTab = d.tabs.get(tab);
  if (selectedTab && isShown(selectedTab)) selectedTab.focus();
  else d.topic.focus();
}

export function closeHelp(): void {
  if (dom?.dialog.open) dom.dialog.close();
}

export function isHelpOpen(): boolean {
  return Boolean(dom?.dialog.open);
}

function setUpButton(button: HTMLButtonElement): void {
  button.type = 'button';
  button.classList.add('btn', 'help-btn');
  button.title = HELP_BUTTON_TOOLTIP;
  button.setAttribute('aria-label', HELP_BUTTON_ARIA_LABEL);
  button.setAttribute('aria-haspopup', 'dialog');
  if (!button.textContent?.trim()) button.textContent = HELP_BUTTON_TEXT;
  if (!helpButtons.has(button)) {
    helpButtons.add(button);
    button.addEventListener('click', () => openHelp({ returnFocusTo: button }));
  }
  helpButton = button;
  syncUnseenDot(button);
}

/**
 * Makes the top-bar ? button to spec (28 x 28 circle, tooltip "How this works",
 * aria-label "Help: how this works", aria-haspopup="dialog") and wires it to openHelp().
 * The caller places it: `topbar.append(createHelpButton())`, after `.workspace-nav`.
 */
export function createHelpButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = 'btn-help';
  setUpButton(button);
  return button;
}

/**
 * Sets the options. Call once at boot. Calling it again applies the new options the next
 * time the pop-up opens. Calling it is optional: without it the defaults apply.
 */
export function initHelp(options: HelpOptions = {}): void {
  if (options.storageFailureIsSurfaced !== undefined) settings.storageFailureIsSurfaced = options.storageFailureIsSurfaced;
  if (options.startHereOnFirstVisit !== undefined) settings.startHereOnFirstVisit = options.startHereOnFirstVisit;
  if (options.unseenDot !== undefined) settings.unseenDot = options.unseenDot;
  if (options.button) setUpButton(options.button);
  helpButtons.forEach(syncUnseenDot);
}
