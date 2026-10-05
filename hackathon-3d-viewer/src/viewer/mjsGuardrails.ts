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

export function formatMjsGuardMessage(scan: MjsScanResult, fileName: string): string {
  const lines = [
    `Load trusted .mjs module “${fileName}”?`,
    '',
    'This executes JavaScript in the page (not a mesh file). Use only files you trust.',
  ];
  if (!scan.looksLikeAssetModule) {
    lines.push('', 'Warning: source does not look like a createAsset / three module.');
  }
  if (scan.risks.length) {
    lines.push('', `Static scan flagged: ${scan.risks.join(', ')}.`);
    lines.push('These patterns are unusual for a furniture pack — proceed only if intentional.');
  }
  return lines.join('\n');
}

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
