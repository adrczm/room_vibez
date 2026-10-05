#!/usr/bin/env node
/**
 * Emit a thin Room Vibez stub .mjs from a sidecar JSON.
 * Does NOT claim Polyfork commercial createAsset compatibility.
 *
 * Usage:
 *   node scripts/emit-stub-mjs.mjs path/to/sku.sidecar.json [out.mjs]
 *
 * Sidecar shape (subset):
 *   {
 *     "params": { "colorway": { "type":"choice", "options":["a","b"], "default":"a" }, ... },
 *     "presets": { "a": { "cover": "#0a5" } },
 *     "materials": { "cover": { "kind":"textile", "finish":"matte" } },
 *     "slots": { "meshName": "cover" }   // optional; ignored by stub
 *   }
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const inPath = process.argv[2];
if (!inPath) {
  console.error('Usage: node scripts/emit-stub-mjs.mjs <sidecar.json> [out.mjs]');
  process.exit(1);
}
const outPath = resolve(process.argv[3] ?? inPath.replace(/(\.slots)?\.json$/i, '') + '.stub.mjs');
const raw = JSON.parse(readFileSync(inPath, 'utf8'));

const params = raw.params ?? {};
const presets = raw.presets ?? {};
const materials = raw.materials ?? {};
const sku = raw.sku ?? basename(inPath).replace(/\.(slots\.)?json$/i, '');

const source = `/**
 * Auto-generated Room Vibez stub — NOT a Polyfork commercial asset generator.
 * Geometry lives in the paired GLB. createAsset throws by design.
 * Source sidecar: ${basename(inPath)}
 */
export const params = ${JSON.stringify(params, null, 2)};
export const presets = ${JSON.stringify(presets, null, 2)};
export const materials = ${JSON.stringify(materials, null, 2)};
export const meta = {
  stub: true,
  geometry: 'glb-only',
  sku: ${JSON.stringify(sku)},
};

export function createAsset() {
  throw new Error(
    'Geometry lives in the paired GLB; createAsset is unavailable for this Room Vibez stub SKU (' +
      ${JSON.stringify(sku)} +
      ')',
  );
}

export default createAsset;
`;

writeFileSync(outPath, source, 'utf8');
console.log(`Wrote stub MJS → ${outPath}`);
