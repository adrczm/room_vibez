// On-stage toast (UX-04 item 1). The host mounts it inside `.stage` and routes
// canvas-originated messages through notify().
//
// - One live region (`.stage-toast-text`). It stays in the page the whole time, so a new
//   message is a text change inside an existing region. Errors switch it to role="alert"
//   (QA-17); everything else is role="status".
// - An error is marked by an icon, a heavier left edge and bolder text, not only by colour.
// - The toast stacks above the hint line and stops below the stage toolbar. Both are
//   measured, so it holds when either wraps.
// - The toast does not take the pointer, except on its buttons: it lies over the canvas, and a
//   click on the room under it must reach the room (notify.css).
// - The entrance animation lives inside a prefers-reduced-motion query in notify.css.
//
// The existing #stage-hint is the state line. This module only reads its position.
import './notify.css';

export type NotifyKind = 'info' | 'success' | 'warning' | 'error';

export interface NotifyAction {
  /** Button text. The caller supplies it (deck voice, from copy.ts). */
  label: string;
  /** Runs when the button is chosen. The toast then closes. */
  onSelect: () => void;
}

export interface NotifyOptions {
  /**
   * 'info' (default) and 'success' are neutral. 'warning' uses the app's .warning colours.
   * 'error' is for task-blocking errors: .warning.critical colours and role="alert".
   */
  kind?: NotifyKind;
  /** One optional action button, for example Undo. */
  action?: NotifyAction;
  /**
   * Milliseconds before the toast closes by itself. 0 keeps it until it is dismissed or
   * replaced. Default: 6000 for info and success, 12000 for warning and error.
   * The countdown pauses while the pointer is over one of the toast's buttons or focus is inside
   * it. (The rest of the toast lets the pointer through to the canvas: see notify.css.)
   */
  timeoutMs?: number;
}

export interface NotifierOptions {
  /**
   * Elements inside the stage that the toast must not cover.
   * Default: the stage's `.stage-toolbar` and `#stage-hint`, looked up each time.
   */
  avoid?: HTMLElement[];
  /** Accessible name of the close button. Default: 'Dismiss'. Not a deck string. */
  dismissLabel?: string;
}

export interface Notifier {
  /** The toast container, `#stage-toast`. It has no box while nothing is shown. */
  readonly element: HTMLElement;
  notify(message: string, options?: NotifyOptions): void;
  /** Closes the toast now. */
  dismiss(): void;
  /** Removes the toast and its listeners. */
  destroy(): void;
}

const DEFAULT_TIMEOUT_MS: Record<NotifyKind, number> = {
  info: 6000,
  success: 6000,
  warning: 12000,
  error: 12000,
};

/** Gap kept between the toast and the stage edge or anything it avoids. */
const EDGE_GAP = 12;
const STACK_GAP = 8;
/** How long the region stays empty before an identical message is written again. */
const REPEAT_GAP_MS = 80;

const SVG_OPEN = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">';
const ICONS: Record<NotifyKind, string> = {
  info: '',
  success: `${SVG_OPEN}<path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  warning: `${SVG_OPEN}<path d="M8 1.6l6.9 12.3H1.1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.2v3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.8" r="0.9" fill="currentColor"/></svg>`,
  error: `${SVG_OPEN}<circle cx="8" cy="8" r="7" fill="currentColor"/><path class="stage-toast-icon-mark" d="M8 4.2v4.6" stroke-width="1.8" stroke-linecap="round"/><circle class="stage-toast-icon-mark" cx="8" cy="11.4" r="1" stroke-width="0"/></svg>`,
};
const CLOSE_ICON = `${SVG_OPEN}<path d="M3.5 3.5l9 9m0-9l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

/** The notifier that the module-level notify() uses: the one mounted last. */
let activeNotifier: Notifier | null = null;

function isShown(element: Element): boolean {
  return element.getClientRects().length > 0;
}

/**
 * Creates the toast inside `stage` (the `.stage` section). If the stage already contains
 * an element with id `stage-toast`, that element is taken over instead of adding a second.
 */
export function mountNotifier(stage: HTMLElement, options: NotifierOptions = {}): Notifier {
  const existing = stage.querySelector<HTMLElement>('#stage-toast');
  const element = existing ?? document.createElement('div');
  element.id = 'stage-toast';
  element.className = 'stage-toast';
  // The live region is the text element below, not the container.
  element.removeAttribute('aria-live');
  element.removeAttribute('role');
  element.hidden = false;
  element.dataset.open = 'false';

  const icon = document.createElement('span');
  icon.className = 'stage-toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.hidden = true;

  const text = document.createElement('span');
  text.className = 'stage-toast-text';
  text.setAttribute('role', 'status');
  text.setAttribute('aria-live', 'polite');
  text.setAttribute('aria-atomic', 'true');

  const actionButton = document.createElement('button');
  actionButton.type = 'button';
  actionButton.className = 'btn stage-toast-action';
  actionButton.hidden = true;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'stage-toast-close';
  closeButton.setAttribute('aria-label', options.dismissLabel ?? 'Dismiss');
  closeButton.innerHTML = CLOSE_ICON;
  closeButton.hidden = true;

  element.replaceChildren(icon, text, actionButton, closeButton);
  if (!existing) stage.append(element);

  let open = false;
  let onAction: (() => void) | null = null;
  let timer: number | undefined;
  let remainingMs = 0;
  let timerStartedAt = 0;
  let repeatTimer: number | undefined;
  let hovered = false;

  const obstacles = (): HTMLElement[] =>
    options.avoid ??
    [stage.querySelector<HTMLElement>('.stage-toolbar'), stage.querySelector<HTMLElement>('#stage-hint')].filter(
      (candidate): candidate is HTMLElement => candidate !== null,
    );

  /** Sits above anything in the lower half of the stage and stops below anything in the upper half. */
  function place(): void {
    const stageRect = stage.getBoundingClientRect();
    const middle = stageRect.top + stageRect.height / 2;
    let bottom = EDGE_GAP;
    let top = EDGE_GAP;
    for (const obstacle of obstacles()) {
      if (obstacle === element || !isShown(obstacle)) continue;
      const rect = obstacle.getBoundingClientRect();
      if (rect.height === 0) continue;
      if ((rect.top + rect.bottom) / 2 >= middle) bottom = Math.max(bottom, stageRect.bottom - rect.top + STACK_GAP);
      else top = Math.max(top, rect.bottom - stageRect.top + STACK_GAP);
    }
    element.style.setProperty('--stage-toast-bottom', `${Math.round(bottom)}px`);
    element.style.setProperty(
      '--stage-toast-max-height',
      `${Math.max(48, Math.round(stageRect.height - bottom - top))}px`,
    );
  }

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => open && place());

  function clearTimer(): void {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  }

  function startTimer(ms: number): void {
    clearTimer();
    remainingMs = ms;
    if (ms <= 0 || hovered || element.contains(document.activeElement)) return;
    timerStartedAt = Date.now();
    timer = window.setTimeout(dismiss, ms);
  }

  function pauseTimer(): void {
    if (timer === undefined) return;
    clearTimer();
    remainingMs = Math.max(0, remainingMs - (Date.now() - timerStartedAt));
  }

  function resumeTimer(): void {
    if (!open || timer !== undefined || remainingMs <= 0) return;
    if (hovered || element.contains(document.activeElement)) return;
    startTimer(remainingMs);
  }

  function dismiss(): void {
    clearTimer();
    if (repeatTimer !== undefined) window.clearTimeout(repeatTimer);
    repeatTimer = undefined;
    resizeObserver?.disconnect();
    open = false;
    hovered = false;
    onAction = null;
    remainingMs = 0;
    text.textContent = '';
    icon.hidden = true;
    actionButton.hidden = true;
    closeButton.hidden = true;
    element.classList.remove('is-open', 'warning', 'critical');
    element.dataset.open = 'false';
    delete element.dataset.kind;
  }

  function notify(message: string, notifyOptions: NotifyOptions = {}): void {
    if (!message) {
      dismiss();
      return;
    }
    const kind = notifyOptions.kind ?? 'info';
    clearTimer();
    if (repeatTimer !== undefined) window.clearTimeout(repeatTimer);
    repeatTimer = undefined;

    // Role first, then the text, so the change is announced with the right urgency.
    text.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    text.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
    if (open && text.textContent === message) {
      // Same words again (two undos in a row). Empty the region briefly so the repeat
      // counts as a change.
      text.textContent = '';
      repeatTimer = window.setTimeout(() => {
        repeatTimer = undefined;
        text.textContent = message;
      }, REPEAT_GAP_MS);
    } else {
      text.textContent = message;
    }

    icon.innerHTML = ICONS[kind];
    icon.hidden = ICONS[kind] === '';

    onAction = notifyOptions.action?.onSelect ?? null;
    actionButton.textContent = notifyOptions.action?.label ?? '';
    actionButton.hidden = !notifyOptions.action;
    closeButton.hidden = false;

    // Restart the entrance animation for a replacement toast (no-op under reduced motion).
    element.classList.remove('is-open');
    void element.offsetWidth;
    element.classList.toggle('warning', kind === 'warning' || kind === 'error');
    element.classList.toggle('critical', kind === 'error');
    element.classList.add('is-open');
    element.dataset.open = 'true';
    element.dataset.kind = kind;
    open = true;

    place();
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver.observe(stage);
      obstacles().forEach((obstacle) => resizeObserver.observe(obstacle));
    }
    startTimer(notifyOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS[kind]);
  }

  actionButton.addEventListener('click', () => {
    const run = onAction;
    dismiss();
    run?.();
  });
  closeButton.addEventListener('click', dismiss);
  element.addEventListener('pointerenter', () => {
    hovered = true;
    pauseTimer();
  });
  element.addEventListener('pointerleave', () => {
    hovered = false;
    resumeTimer();
  });
  element.addEventListener('focusin', pauseTimer);
  element.addEventListener('focusout', () => window.setTimeout(resumeTimer, 0));

  const notifier: Notifier = {
    element,
    notify,
    dismiss,
    destroy() {
      dismiss();
      element.remove();
      if (activeNotifier === notifier) activeNotifier = null;
    },
  };
  activeNotifier = notifier;
  return notifier;
}

/**
 * Shows a toast on the stage through the notifier mounted last. If none is mounted yet,
 * one is mounted in the page's `.stage`. Without a stage the message goes to the console.
 */
export function notify(message: string, options?: NotifyOptions): void {
  if (!activeNotifier) {
    const stage = document.querySelector<HTMLElement>('.stage');
    if (stage) mountNotifier(stage);
  }
  if (activeNotifier) activeNotifier.notify(message, options);
  else console.warn('[notify] no .stage to show the message in:', message);
}

/** Closes the current toast, if any. */
export function dismissNotification(): void {
  activeNotifier?.dismiss();
}
