// Confirmation dialog (Copy handoff Phase 4 item 3, UX-03). Native <dialog>, opened with
// showModal(), sharing the help dialog's shell styles (.app-dialog in ../help.css).
//
// The caller passes every string (deck §5). Nothing here is rendered as HTML: titles and
// labels are text, and a string body is split into text nodes (see `body` below).
import '../help.css';
import './confirmDialog.css';

export interface ConfirmDialogOptions {
  /** Dialog heading, shown as plain text. Example: `Clear this room?` */
  title: string;
  /**
   * What will happen.
   * - string: plain text, never parsed as HTML. A line break starts a new paragraph, and
   *   `**words**` are shown in bold (the deck writes the "You can't undo it." warnings
   *   that way), built with text nodes only.
   * - Node: appended as given, for callers that build their own DOM.
   */
  body: string | Node;
  /** Label of the button that resolves `true`. Example: `Clear room` */
  confirmLabel: string;
  /** Label of the button that resolves `false`. Example: `Keep room` */
  cancelLabel: string;
  /** true: the confirm button gets critical styling instead of the primary colour. */
  destructive?: boolean;
}

let dialogCount = 0;
let pageShortcutGuardInstalled = false;

/**
 * While one of the app's modal dialogs is open, a key press that is not aimed at the
 * dialog (nothing focused, so it targets <body>) is kept away from page-level listeners.
 * Runs in the capture phase on window, before any document listener.
 */
function installPageShortcutGuard(): void {
  if (pageShortcutGuardInstalled) return;
  pageShortcutGuardInstalled = true;
  window.addEventListener(
    'keydown',
    (event) => {
      const openDialogs = document.querySelectorAll<HTMLDialogElement>('dialog.app-dialog[open]');
      if (openDialogs.length === 0) return;
      const target = event.target;
      const insideDialog = target instanceof Node && [...openDialogs].some((dialog) => dialog.contains(target));
      // Inside the dialog: let its own controls handle the key (wireModalDialog stops it
      // on the way back up). Outside: stop it here.
      if (!insideDialog) event.stopPropagation();
    },
    true,
  );
}

/**
 * Behaviour shared by the app's modal dialogs (this one and the ? pop-up):
 * - a click on the backdrop closes the dialog (a press that starts inside the dialog and
 *   ends on the backdrop, such as a text selection drag, does not);
 * - key presses while the dialog is open do not reach page-level shortcuts (undo, redo,
 *   Esc to leave a tool). Esc still closes the dialog: that is the browser's own
 *   behaviour and does not depend on the event reaching the document.
 */
export function wireModalDialog(dialog: HTMLDialogElement): void {
  installPageShortcutGuard();
  let pressStartedOnBackdrop = false;
  dialog.addEventListener('pointerdown', (event) => {
    pressStartedOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener('click', (event) => {
    const onBackdrop = pressStartedOnBackdrop && event.target === dialog;
    pressStartedOnBackdrop = false;
    if (onBackdrop) dialog.close();
  });
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
}

function appendBody(target: HTMLElement, body: string | Node): void {
  if (typeof body !== 'string') {
    target.append(body);
    return;
  }
  for (const line of body.split(/\n+/)) {
    const text = line.trim();
    if (!text) continue;
    const paragraph = document.createElement('p');
    // Odd-numbered pieces are the words between ** and **.
    text.split(/\*\*(.+?)\*\*/g).forEach((piece, index) => {
      if (!piece) return;
      if (index % 2 === 1) {
        const strong = document.createElement('strong');
        strong.textContent = piece;
        paragraph.append(strong);
      } else {
        paragraph.append(piece);
      }
    });
    target.append(paragraph);
  }
}

/**
 * Asks the user to confirm an action. Resolves `true` only when the confirm button is
 * chosen. The cancel button, Esc and a click on the backdrop resolve `false`.
 *
 * Focus starts on the cancel button, so Enter on a freshly opened dialog keeps the user's
 * work. When the dialog closes, focus goes back to the element that had it before.
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const id = ++dialogCount;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const dialog = document.createElement('dialog');
  dialog.className = 'app-dialog confirm-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-labelledby', `confirm-dialog-title-${id}`);
  dialog.setAttribute('aria-describedby', `confirm-dialog-body-${id}`);
  if (options.destructive) dialog.dataset.destructive = 'true';

  const surface = document.createElement('div');
  surface.className = 'app-dialog-surface';

  const head = document.createElement('div');
  head.className = 'app-dialog-head';
  const title = document.createElement('h2');
  title.className = 'app-dialog-title';
  title.id = `confirm-dialog-title-${id}`;
  title.textContent = options.title;
  head.append(title);

  const body = document.createElement('div');
  body.className = 'confirm-body';
  body.id = `confirm-dialog-body-${id}`;
  appendBody(body, options.body);

  const actions = document.createElement('div');
  actions.className = 'confirm-actions';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn';
  cancelButton.dataset.action = 'cancel';
  cancelButton.textContent = options.cancelLabel;
  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = options.destructive ? 'btn btn-critical' : 'btn btn-primary';
  confirmButton.dataset.action = 'confirm';
  confirmButton.textContent = options.confirmLabel;
  actions.append(cancelButton, confirmButton);

  surface.append(head, body, actions);
  dialog.append(surface);

  return new Promise<boolean>((resolve) => {
    let confirmed = false;
    confirmButton.addEventListener('click', () => {
      confirmed = true;
      dialog.close();
    });
    cancelButton.addEventListener('click', () => dialog.close());
    wireModalDialog(dialog);
    // Esc and the backdrop both end in close() without setting `confirmed`.
    dialog.addEventListener(
      'close',
      () => {
        dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(confirmed);
      },
      { once: true },
    );

    document.body.append(dialog);
    dialog.showModal();
    cancelButton.focus();
  });
}
