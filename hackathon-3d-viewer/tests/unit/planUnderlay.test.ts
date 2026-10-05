import { describe, expect, it } from 'vitest';
import { confirmUnderlayToRoomGraph, isPdfPlanFile, isRasterPlanFile, startUnderlayJob } from '../../src/viewer/planUnderlay';

describe('planUnderlay', () => {
  it('detects raster vs pdf', () => {
    expect(isRasterPlanFile(new File([], 'plan.png', { type: 'image/png' }))).toBe(true);
    expect(isPdfPlanFile(new File([], 'plan.pdf', { type: 'application/pdf' }))).toBe(true);
  });

  it('confirms underlay to rectangular room graph', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'plan.jpg', { type: 'image/jpeg' });
    const job = await startUnderlayJob(file, { width_m: 6, depth_m: 4 });
    const g = confirmUnderlayToRoomGraph(job);
    expect(g.underlay?.uri).toBeTruthy();
    expect(g.source_assets[0]?.extract_path).toBe('raster_underlay');
    expect(g.provenance.confirm_status).toBe('confirmed');
  });

  it('blocks PDF without raster', async () => {
    const file = new File([new Uint8Array([1])], 'plan.pdf', { type: 'application/pdf' });
    await expect(startUnderlayJob(file)).rejects.toThrow(/rasterizer/i);
  });
});
