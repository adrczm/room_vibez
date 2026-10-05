// Pre-bakes the hackathon demo assets. This stands in for the conversion farm (see ARCHITECTURE.md §5).
//
// Outputs:
//   public/assets/models/lounge-chair.glb  — 3 slots, tagged via glTF node `extras.material_slot_id`
//   public/assets/models/side-table.glb    — 2 slots, tagged via node-name convention `slot_<id>__<part>`
//   public/assets/textures/*.png           — procedural baseColor textures for the materials library
//
// The geometry is procedural (boxes + an ellipsoid). It is a stand-in for real DCC exports, not a product model.

import { Document, NodeIO } from '@gltf-transform/core';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = join(ROOT, 'public/assets/models');
const TEXTURES = join(ROOT, 'public/assets/textures');
mkdirSync(MODELS, { recursive: true });
mkdirSync(TEXTURES, { recursive: true });

// ---------------------------------------------------------------- geometry

/** Axis-aligned box centred at the origin; 24 verts so each face has its own normal/UV. */
function boxGeometry(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2;
  // [normal, 4 corners (CCW seen from outside)]
  const faces = [
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
  ];
  const pos = [], nrm = [], uv = [], idx = [];
  const uvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
  faces.forEach(([n, corners], f) => {
    corners.forEach((c, i) => { pos.push(...c); nrm.push(...n); uv.push(...uvs[i]); });
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { pos, nrm, uv, idx };
}

/** UV sphere scaled to an ellipsoid with radii (rx, ry, rz) — used for cushions. */
function ellipsoidGeometry(rx, ry, rz, seg = 32, rings = 16) {
  const pos = [], nrm = [], uv = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings, phi = v * Math.PI;
    for (let s = 0; s <= seg; s++) {
      const u = s / seg, theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(theta);
      pos.push(nx * rx, ny * ry, nz * rz);
      // ellipsoid normal = gradient of the implicit surface
      const gx = nx / rx, gy = ny / ry, gz = nz / rz, len = Math.hypot(gx, gy, gz) || 1;
      nrm.push(gx / len, gy / len, gz / len);
      uv.push(u * 2, v);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return { pos, nrm, uv, idx };
}

// ---------------------------------------------------------------- glTF helpers

function makeBuilder(doc) {
  const buffer = doc.createBuffer();
  const placeholder = new Map();

  /** One placeholder material per slot. The viewer replaces these with library materials; they are not SoR. */
  function placeholderFor(slotId) {
    if (!placeholder.has(slotId)) {
      placeholder.set(slotId, doc.createMaterial(`placeholder_${slotId}`).setBaseColorFactor([0.8, 0.8, 0.8, 1]).setRoughnessFactor(0.8));
    }
    return placeholder.get(slotId);
  }

  function mesh(name, geo, slotId) {
    const acc = (type, arr, T) => doc.createAccessor().setType(type).setArray(new T(arr)).setBuffer(buffer);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', acc('VEC3', geo.pos, Float32Array))
      .setAttribute('NORMAL', acc('VEC3', geo.nrm, Float32Array))
      .setAttribute('TEXCOORD_0', acc('VEC2', geo.uv, Float32Array))
      .setIndices(acc('SCALAR', geo.idx, Uint16Array))
      .setMaterial(placeholderFor(slotId));
    return doc.createMesh(name).addPrimitive(prim);
  }

  return { mesh };
}

async function writeGlb(doc, file) {
  const io = new NodeIO();
  const glb = await io.writeBinary(doc);
  writeFileSync(join(MODELS, file), glb);
  console.log(`wrote models/${file} (${glb.byteLength} bytes)`);
}

// ---------------------------------------------------------------- lounge chair (extras-tagged)

async function buildChair() {
  const doc = new Document();
  doc.getRoot().getAsset().generator = 'room-vibez hackathon build-assets.mjs';
  const b = makeBuilder(doc);
  const scene = doc.createScene('lounge_chair');
  const root = doc.createNode('lounge_chair').setExtras({ product_id: 'demo-lounge-chair' });
  scene.addChild(root);

  // Slot ids are attached to *group* nodes so every descendant mesh inherits them (viewer walks ancestors).
  const group = (name, slot) => {
    const n = doc.createNode(name).setExtras({ material_slot_id: slot });
    root.addChild(n);
    return n;
  };
  const part = (parent, name, geo, slot, t) => {
    parent.addChild(doc.createNode(name).setMesh(b.mesh(name, geo, slot)).setTranslation(t));
  };

  const frame = group('frame', 'frame');
  const legH = 0.42, seatY = legH, w = 0.62, d = 0.62;
  for (const [sx, sz, tag] of [[-1, -1, 'bl'], [1, -1, 'br'], [-1, 1, 'fl'], [1, 1, 'fr']]) {
    part(frame, `leg_${tag}`, boxGeometry(0.045, legH, 0.045), 'frame', [sx * (w / 2 - 0.03), legH / 2, sz * (d / 2 - 0.03)]);
  }
  part(frame, 'seat_base', boxGeometry(w, 0.05, d), 'frame', [0, seatY + 0.025, 0]);
  part(frame, 'back_panel', boxGeometry(w, 0.48, 0.045), 'frame', [0, seatY + 0.05 + 0.24, -d / 2 + 0.0225]);
  for (const sx of [-1, 1]) {
    const tag = sx < 0 ? 'l' : 'r';
    part(frame, `arm_post_${tag}`, boxGeometry(0.045, 0.2, 0.045), 'frame', [sx * (w / 2 - 0.03), seatY + 0.05 + 0.1, d / 2 - 0.08]);
    part(frame, `arm_rail_${tag}`, boxGeometry(0.06, 0.035, d - 0.05), 'frame', [sx * (w / 2 - 0.03), seatY + 0.05 + 0.2 + 0.0175, 0.0]);
  }

  // "Plastic handles": grips on the front of each arm rail.
  const handles = group('handles', 'handles');
  for (const sx of [-1, 1]) {
    part(handles, `grip_${sx < 0 ? 'l' : 'r'}`, boxGeometry(0.075, 0.05, 0.16), 'handles', [sx * (w / 2 - 0.03), seatY + 0.05 + 0.2 + 0.02, d / 2 - 0.1]);
  }

  // "Wool pillow": seat cushion + back cushion.
  const pillow = group('pillow', 'pillow');
  part(pillow, 'seat_cushion', ellipsoidGeometry(0.25, 0.06, 0.25), 'pillow', [0, seatY + 0.05 + 0.055, 0.02]);
  part(pillow, 'back_cushion', ellipsoidGeometry(0.24, 0.18, 0.05), 'pillow', [0, seatY + 0.05 + 0.24, -d / 2 + 0.09]);

  await writeGlb(doc, 'lounge-chair.glb');
}

// ---------------------------------------------------------------- side table (name-convention tagged, no extras)

async function buildTable() {
  const doc = new Document();
  doc.getRoot().getAsset().generator = 'room-vibez hackathon build-assets.mjs';
  const b = makeBuilder(doc);
  const scene = doc.createScene('side_table');
  const root = doc.createNode('side_table');
  scene.addChild(root);

  const h = 0.55, s = 0.5;
  // Convention: slot_<slotId>__<partName>
  root.addChild(doc.createNode('slot_top__tabletop').setMesh(b.mesh('tabletop', boxGeometry(s, 0.03, s), 'top')).setTranslation([0, h - 0.015, 0]));
  for (const [sx, sz, tag] of [[-1, -1, 'bl'], [1, -1, 'br'], [-1, 1, 'fl'], [1, 1, 'fr']]) {
    root.addChild(
      doc.createNode(`slot_legs__leg_${tag}`)
        .setMesh(b.mesh(`leg_${tag}`, boxGeometry(0.03, h - 0.03, 0.03), 'legs'))
        .setTranslation([sx * (s / 2 - 0.04), (h - 0.03) / 2, sz * (s / 2 - 0.04)]),
    );
  }
  root.addChild(doc.createNode('slot_legs__shelf_rail').setMesh(b.mesh('shelf_rail', boxGeometry(s - 0.06, 0.02, s - 0.06), 'legs')).setTranslation([0, 0.15, 0]));

  await writeGlb(doc, 'side-table.glb');
}

// ---------------------------------------------------------------- textures (baseColor PNGs)

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 4) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { sum += amp * valueNoise(x * f, y * f); amp *= 0.5; f *= 2; }
  return sum;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function writePng(file, size, shade) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = shade(x / size, y / size);
      const i = (y * size + x) * 4;
      png.data[i] = Math.max(0, Math.min(255, r));
      png.data[i + 1] = Math.max(0, Math.min(255, g));
      png.data[i + 2] = Math.max(0, Math.min(255, b));
      png.data[i + 3] = 255;
    }
  }
  writeFileSync(join(TEXTURES, file), PNG.sync.write(png));
  console.log(`wrote textures/${file}`);
}

function wood(light, dark) {
  // u runs across the grain, v along it: long, gently warped growth lines plus fine pore streaks.
  return (u, v) => {
    const warp = fbm(u * 2 + 7, v * 1.2, 4) * 1.6;
    const lines = 0.5 + 0.5 * Math.sin((u * 7 + warp) * Math.PI * 2);
    const pores = fbm(u * 90, v * 2.5, 3);
    const t = Math.pow(lines, 3) * 0.55 + pores * 0.35 + fbm(u * 3, v * 3, 2) * 0.1;
    return mix(light, dark, t);
  };
}

function knit(base) {
  // Tileable chevron-ish knit with slight noise; neutral so the library can tint via `color`.
  return (u, v) => {
    const cx = (u * 32) % 1, cy = (v * 32) % 1;
    const rib = Math.abs(Math.sin((cx + Math.abs(cy - 0.5)) * Math.PI));
    const n = fbm(u * 64, v * 64, 2);
    const k = 0.78 + 0.16 * rib + 0.06 * n;
    return base.map((c) => c * k);
  };
}

function marble(base, vein) {
  return (u, v) => {
    const t = Math.abs(Math.sin((u * 4 + v * 2 + fbm(u * 4, v * 4, 5) * 4) * Math.PI));
    return mix(vein, base, Math.pow(t, 0.35));
  };
}

async function main() {
  await buildChair();
  await buildTable();
  writePng('wood-oak.png', 512, wood([214, 172, 120], [150, 104, 60]));
  writePng('wood-walnut.png', 512, wood([120, 78, 50], [62, 38, 24]));
  writePng('wool-knit.png', 256, knit([245, 245, 245]));
  writePng('marble-white.png', 512, marble([236, 234, 230], [150, 150, 155]));
}

main().catch((err) => { console.error(err); process.exit(1); });
