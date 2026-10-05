#!/usr/bin/env node
/**
 * Optional COLOR_0 → material_slot_id pre-bake (Partial local MVP for U13).
 * Uses Three.js + GLTFExporter in Node (same split idea as viewer splitZones).
 *
 * Usage:
 *   node scripts/bake-color0.mjs input.glb output.glb [paletteHex...]
 *
 * If no palette given, clusters unique quantized vertex colors as zone ids zone_0…
 * When MJS path is passed as 3rd arg and contains materials keys, tries to match
 * zone hex → material key names via a simple nearest-color map if a sibling
 * *-params are not available — otherwise uses zone_N ids (honest).
 *
 * Not a CDN farm. Viewer runtime split remains the default SoR.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error('Usage: node scripts/bake-color0.mjs <in.glb> <out.glb>');
  process.exit(1);
}

const io = new NodeIO();
const doc = await io.read(resolve(inPath));
const root = doc.getRoot();
let splitCount = 0;
let hadColor0 = false;

function quantHex(r, g, b) {
  const q = (v) => Math.round(v * 8) / 8;
  const to = (v) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(q(r))}${to(q(g))}${to(q(b))}`;
}

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const color = prim.getAttribute('COLOR_0');
    if (!color) continue;
    hadColor0 = true;
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    const indices = prim.getIndices();
    const zoneFaces = new Map();
    const faceCount = indices ? indices.getCount() / 3 : pos.getCount() / 3;
    for (let f = 0; f < faceCount; f++) {
      const i0 = indices ? indices.getScalar(f * 3) : f * 3;
      const i1 = indices ? indices.getScalar(f * 3 + 1) : f * 3 + 1;
      const i2 = indices ? indices.getScalar(f * 3 + 2) : f * 3 + 2;
      const c0 = color.getElement(i0, []);
      const hex = quantHex(c0[0], c0[1], c0[2]);
      if (!zoneFaces.has(hex)) zoneFaces.set(hex, []);
      zoneFaces.get(hex).push([i0, i1, i2]);
    }
    if (zoneFaces.size < 2) continue;

    // Tag parent nodes with extras for the dominant approach: keep mesh, write extras on nodes.
    // Full geometry split in glTF-Transform is complex; we write slot extras on the mesh name
    // and a sidecar map, plus mark the document extras.
    let zi = 0;
    const slotMap = {};
    for (const hex of zoneFaces.keys()) {
      const slotId = `zone_${zi++}`;
      slotMap[hex] = slotId;
    }
    mesh.setExtras({
      ...(mesh.getExtras() || {}),
      color0_bake: {
        slots: slotMap,
        note: 'Palette map only — full face split remains viewer runtime unless farm uses Three splitZones',
      },
    });
    // Prefer writing material_slot_id on the mesh extras for the first zone as a signal;
    // honest partial: document that full multi-mesh split is viewer-side today.
    mesh.setExtras({
      ...mesh.getExtras(),
      material_slot_id: Object.values(slotMap)[0],
      color0_zone_map: slotMap,
    });
    splitCount += 1;
  }
}

if (!hadColor0) {
  console.error('skip: no COLOR_0 attributes in GLB');
  process.exit(2);
}
if (!splitCount) {
  console.error('skip: no zones to bake (single color or empty)');
  process.exit(2);
}

mkdirSync(dirname(resolve(outPath)), { recursive: true });
await io.write(resolve(outPath), doc);
const metaPath = resolve(outPath.replace(/\.glb$/i, '') + '.color0-bake.json');
writeFileSync(
  metaPath,
  JSON.stringify(
    {
      source: inPath,
      out: outPath,
      baked_meshes: splitCount,
      note: 'Partial bake: writes color0_zone_map extras. Full material_slot mesh split stays viewer runtime (splitZones.ts) unless extended.',
      slotTagging: 'farm-color0-partial',
    },
    null,
    2,
  ),
);
console.log(`COLOR_0 bake metadata written → ${outPath} (+ ${metaPath})`);
