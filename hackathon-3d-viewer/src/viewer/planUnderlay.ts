/**
 * JPG/PNG plan underlay → human confirm → owned RoomGraph.
 * Not AI recognition. PDF needs a rasterizer (blocked unless caller supplies a PNG data URL).
 */

import {
  DEFAULT_CEILING_HEIGHT_M,
  DEFAULT_WALL_THICKNESS_M,
  createRectangularRoom,
  type RoomGraph,
  type SourceAsset,
  type SourceAssetKind,
} from './roomGraph';

export interface UnderlayJob {
  id: string;
  source: SourceAsset;
  /** Object URL or data URL for the raster. */
  imageUri: string;
  width_m: number;
  depth_m: number;
  ceiling_height: number;
  wall_thickness: number;
  opacity: number;
  status: 'draft' | 'confirmed';
  note: string;
}

let seq = 0;
function nid(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function isRasterPlanFile(file: File): boolean {
  return /\.(png|jpe?g|webp)$/i.test(file.name) || /^image\/(png|jpeg|webp)$/i.test(file.type);
}

export function isPdfPlanFile(file: File): boolean {
  return /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
}

export function kindFromRasterFilename(name: string): SourceAssetKind {
  if (/\.png$/i.test(name)) return 'png';
  if (/\.jpe?g$/i.test(name)) return 'jpg';
  if (/\.pdf$/i.test(name)) return 'pdf';
  return 'underlay';
}

/**
 * Start an underlay review job. PDF without a pre-rasterized imageUri throws
 * (honest: no invented PDF parser).
 */
export async function startUnderlayJob(
  file: File,
  opts?: { width_m?: number; depth_m?: number; imageUri?: string },
): Promise<UnderlayJob> {
  if (isPdfPlanFile(file) && !opts?.imageUri) {
    throw new Error(
      'PDF plan ingest needs a rasterizer (e.g. pdf.js) or a pre-rendered PNG/JPG. Upload PNG/JPG for underlay confirm, or provide imageUri.',
    );
  }
  if (!isRasterPlanFile(file) && !opts?.imageUri) {
    throw new Error('Underlay accepts PNG / JPEG / WebP (PDF blocked without rasterizer)');
  }
  const uri = opts?.imageUri ?? URL.createObjectURL(file);
  const kind = kindFromRasterFilename(file.name);
  const source: SourceAsset = {
    id: nid('src'),
    kind,
    filename: file.name,
    uri,
    bytes: file.size,
    extract_path: 'raster_underlay',
    note: 'Raster underlay — human confirms size; no AI floor-plan recognition.',
  };
  return {
    id: nid('underlay'),
    source,
    imageUri: uri,
    width_m: opts?.width_m ?? 5,
    depth_m: opts?.depth_m ?? 4,
    ceiling_height: DEFAULT_CEILING_HEIGHT_M,
    wall_thickness: DEFAULT_WALL_THICKNESS_M,
    opacity: 0.4,
    status: 'draft',
    note: 'Trace is rectangular shell matching underlay width×depth. Adjust meters, then confirm.',
  };
}

/** Confirm underlay → rectangular RoomGraph with underlay metadata (same SoT as scratch). */
export function confirmUnderlayToRoomGraph(job: UnderlayJob): RoomGraph {
  if (!(job.width_m > 0) || !(job.depth_m > 0)) {
    throw new Error('Underlay width and depth must be positive meters');
  }
  const graph = createRectangularRoom({
    length: job.width_m,
    width: job.depth_m,
    ceilingHeight: job.ceiling_height,
    wallThickness: job.wall_thickness,
    name: `Underlay · ${job.source.filename}`,
  });
  return {
    ...graph,
    source_assets: [job.source],
    provenance: {
      kind: 'dwg_import',
      import_job_id: job.id,
      confirm_status: 'confirmed',
    },
    underlay: {
      source_asset_id: job.source.id,
      uri: job.imageUri,
      opacity: job.opacity,
      width_m: job.width_m,
      depth_m: job.depth_m,
    },
    label: graph.label,
  };
}
