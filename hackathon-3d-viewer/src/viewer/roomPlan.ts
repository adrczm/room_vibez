/**
 * 2D plan SVG polish derived from RoomGraph (not a CAD editor).
 */

import {
  formatLength,
  wallLength,
  type DisplayUnit,
  type RoomGraph,
  type WallEntity,
} from './roomGraph';

export interface PlanSvgOptions {
  size?: number;
  unit?: DisplayUnit;
  /** Optional underlay image (object URL or path) drawn under the plan. */
  underlayHref?: string | null;
  underlayOpacity?: number;
}

function wallMid(wall: WallEntity): { x: number; z: number } {
  return { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 };
}

/** Build polished plan SVG markup for `#room-plan`. */
export function buildPlanSvg(graph: RoomGraph, opts: PlanSvgOptions = {}): string {
  const room = graph.rooms[0];
  if (!room?.floor_polygon?.length) return '';
  const poly = room.floor_polygon;
  const pad = 28;
  const size = opts.size ?? 260;
  const xs = poly.map((p) => p.x);
  const zs = poly.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const w = maxX - minX || 1;
  const h = maxZ - minZ || 1;
  const scale = (size - pad * 2) / Math.max(w, h);
  const ox = pad + (size - pad * 2 - w * scale) / 2;
  const oz = pad + (size - pad * 2 - h * scale) / 2;
  const toX = (x: number) => ox + (x - minX) * scale;
  const toY = (z: number) => oz + (z - minZ) * scale;
  const u = opts.unit ?? graph.display_unit ?? 'm';
  const points = poly.map((p) => `${toX(p.x)},${toY(p.z)}`).join(' ');

  let dimLabels = '';
  for (const wall of graph.walls) {
    const mid = wallMid(wall);
    const len = wallLength(wall);
    dimLabels += `<text x="${toX(mid.x)}" y="${toY(mid.z)}" text-anchor="middle" dominant-baseline="middle" fill="#616161" font-size="9">${formatLength(len, u)}</text>`;
  }

  let openingsSvg = '';
  for (const op of graph.openings) {
    const wall = graph.walls.find((wl) => wl.id === op.wall_id);
    if (!wall) continue;
    const len = wallLength(wall);
    if (len < 1e-6) continue;
    const t0 = op.offset_along_wall / len;
    const t1 = (op.offset_along_wall + op.width) / len;
    const x0 = wall.a.x + (wall.b.x - wall.a.x) * t0;
    const z0 = wall.a.z + (wall.b.z - wall.a.z) * t0;
    const x1 = wall.a.x + (wall.b.x - wall.a.x) * t1;
    const z1 = wall.a.z + (wall.b.z - wall.a.z) * t1;
    const color = op.type === 'door' ? '#008060' : '#2c6ecb';
    openingsSvg += `<line x1="${toX(x0)}" y1="${toY(z0)}" x2="${toX(x1)}" y2="${toY(z1)}" stroke="${color}" stroke-width="5" stroke-linecap="square" />`;
    if (op.type === 'door') {
      // Simple swing arc toward room interior (quarter circle approximation).
      const dx = x1 - x0;
      const dz = z1 - z0;
      const nx = dz;
      const nz = -dx;
      const nlen = Math.hypot(nx, nz) || 1;
      const ix = (nx / nlen) * op.width;
      const iz = (nz / nlen) * op.width;
      // Prefer inward: test against floor centroid.
      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
      const cz = poly.reduce((s, p) => s + p.z, 0) / poly.length;
      const midX = (x0 + x1) / 2;
      const midZ = (z0 + z1) / 2;
      const sign = (cx - midX) * ix + (cz - midZ) * iz >= 0 ? 1 : -1;
      const ex = x0 + sign * ix;
      const ez = z0 + sign * iz;
      openingsSvg += `<path d="M ${toX(x0)} ${toY(z0)} A ${op.width * scale} ${op.width * scale} 0 0 1 ${toX(ex)} ${toY(ez)}" fill="none" stroke="#008060" stroke-width="1.5" stroke-dasharray="3 2" />`;
    } else {
      // Window tick marks.
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const dx = wall.b.x - wall.a.x;
      const dz = wall.b.z - wall.a.z;
      const nlen = Math.hypot(dx, dz) || 1;
      const nx = (dz / nlen) * 0.12;
      const nz = (-dx / nlen) * 0.12;
      openingsSvg += `<line x1="${toX(mx - nx)}" y1="${toY(mz - nz)}" x2="${toX(mx + nx)}" y2="${toY(mz + nz)}" stroke="#2c6ecb" stroke-width="2" />`;
    }
  }

  let furnitureSvg = '';
  for (const pl of graph.placements) {
    const r = 5;
    furnitureSvg += `<g transform="translate(${toX(pl.position.x)},${toY(pl.position.z)}) rotate(${(-pl.rotation_y * 180) / Math.PI})">
      <rect x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" fill="#303030" opacity="0.85" />
    </g>`;
  }

  const underlay =
    opts.underlayHref
      ? `<image href="${opts.underlayHref}" x="${ox}" y="${oz}" width="${w * scale}" height="${h * scale}" opacity="${opts.underlayOpacity ?? 0.35}" preserveAspectRatio="none" />`
      : '';

  const scaleBarM = Math.max(1, Math.round(Math.min(w, h) / 4));
  const scaleBarPx = scaleBarM * scale;

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="2D room plan">
    <rect width="${size}" height="${size}" fill="#f6f6f7" />
    ${underlay}
    <polygon points="${points}" fill="#fff" fill-opacity="0.92" stroke="#303030" stroke-width="2.5" />
    ${openingsSvg}${furnitureSvg}${dimLabels}
    <text x="${size / 2}" y="14" text-anchor="middle" fill="#616161" font-size="11">${formatLength(w, u)} × ${formatLength(h, u)}</text>
    <line x1="${pad}" y1="${size - 12}" x2="${pad + scaleBarPx}" y2="${size - 12}" stroke="#303030" stroke-width="2" />
    <text x="${pad}" y="${size - 16}" fill="#616161" font-size="9">${formatLength(scaleBarM, u)}</text>
  </svg>`;
}

/** Rasterize plan SVG to PNG data URL via canvas (best-effort share-out). */
export async function planSvgToPngDataUrl(svgMarkup: string, pixelSize = 512): Promise<string> {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to rasterize plan SVG'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pixelSize, pixelSize);
    ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
