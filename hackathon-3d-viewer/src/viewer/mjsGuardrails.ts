/**
 * Best-effort guardrails for opt-in .mjs loads.
 * NOT a sandbox — arbitrary JS still runs after user confirm.
 * Production untrusted uploads still need iframe CSP / server review.
 */

export interface MjsScanResult {
  ok: boolean;
  risks: string[];
  /** True when patterns look like a typical Polyfork/Three module. */
  looksLikeAssetModule: boolean;
}

const DENY = [
  { re: /\bdocument\s*\./, label: 'document.* DOM access' },
  { re: /\bwindow\s*\./, label: 'window.* access' },
  { re: /\blocalStorage\b/, label: 'localStorage' },
  { re: /\bindexedDB\b/, label: 'indexedDB' },
  { re: /\bfetch\s*\(/, label: 'fetch(' },
  { re: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { re: /\bWebSocket\b/, label: 'WebSocket' },
  { re: /\beval\s*\(/, label: 'eval(' },
  { re: /\bFunction\s*\(/, label: 'Function(' },
  { re: /\bimportScripts\b/, label: 'importScripts' },
  { re: /\bworker\s*\(/i, label: 'Worker(' },
  { re: /\bprocess\s*\./, label: 'process.*' },
  { re: /\brequire\s*\(/, label: 'require(' },
  { re: /https?:\/\//, label: 'absolute http(s) URL in source' },
];

const ASSET_HINTS = [
  /createAsset/,
  /\bTHREE\b/,
  /from\s+['"]three['"]/,
  /export\s+(const|function|default)/,
];

export function scanMjsSource(source: string): MjsScanResult {
  const risks: string[] = [];
  for (const d of DENY) {
    if (d.re.test(source)) risks.push(d.label);
  }
  const looksLikeAssetModule = ASSET_HINTS.some((re) => re.test(source));
  return {
    ok: risks.length === 0,
    risks: [...new Set(risks)],
    looksLikeAssetModule,
  };
}

/**
 * The .mjs confirmation, worded as in docs/ux-copy-deck.md §5 ("Load .mjs").
 * `title` is the dialog title. `paragraphs` is the body in order: the fixed warning, then the scan
 * line when the scan flagged something, then the not-a-pack line when the source does not look like one.
 * The deck's button labels are "Load and run" and "Don't load"; those belong to the host's dialog.
 */
export function mjsGuardPrompt(scan: MjsScanResult, fileName: string): { title: string; paragraphs: string[] } {
  const paragraphs = [
    'An .mjs file is a program, not a model. It runs in this page and can do anything the page can. Only continue if you trust where it came from.',
  ];
  if (scan.risks.length) {
    paragraphs.push(`A quick scan flagged: ${scan.risks.join(', ')}. These are unusual for a furniture pack.`);
  }
  if (!scan.looksLikeAssetModule) {
    paragraphs.push("This file doesn't look like a furniture pack.");
  }
  return { title: `Run code from “${fileName}”?`, paragraphs };
}

/**
 * The confirmation as one string, as passed to `confirmFn` in `importModuleFile`:
 * the first line is the dialog title, then a blank line, then the body paragraphs separated by blank lines.
 * `parseMjsGuardMessage` splits it back.
 */
export function formatMjsGuardMessage(scan: MjsScanResult, fileName: string): string {
  const { title, paragraphs } = mjsGuardPrompt(scan, fileName);
  return [title, ...paragraphs].join('\n\n');
}

/** Split a `formatMjsGuardMessage` string into the dialog title (first line) and body paragraphs (the rest). */
export function parseMjsGuardMessage(message: string): { title: string; paragraphs: string[] } {
  const [title = '', ...rest] = message.split('\n');
  return { title, paragraphs: rest.map((line) => line.trim()).filter((line) => line.length > 0) };
}

/**
 * Deck §5: a native `window.confirm` cannot relabel its buttons, so when one is used the body ends with
 * this sentence. `importModuleFile` appends it only on its `window.confirm` fallback.
 */
export const MJS_NATIVE_CONFIRM_HINT = 'Choose OK to load, or Cancel to stop.';

/** localStorage flag: when '0', MJS loads are disabled until re-enabled. */
export const MJS_ENABLED_KEY = 'catalog3d.mjsEnabled';

export function isMjsLoadingEnabled(): boolean {
  try {
    return localStorage.getItem(MJS_ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setMjsLoadingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(MJS_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}
