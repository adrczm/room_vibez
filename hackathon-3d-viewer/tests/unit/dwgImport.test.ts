import { describe, expect, it } from 'vitest';
import {
  builtInFixtureCandidates,
  confirmImportToRoomGraph,
  parseCandidatesPayload,
  scaleFactorFromKnownLength,
  setCandidateAccepted,
  setScaleFactor,
  startImportJob,
} from '../../src/viewer/dwgImport';

describe('dwgImport mock pipeline', () => {
  it('built-in fixture exposes walls/openings/rooms with ODA unavailable', () => {
    const c = builtInFixtureCandidates();
    expect(c.schema_version).toBe(1);
    expect(c.walls.length).toBe(4);
    expect(c.openings.length).toBe(2);
    expect(c.rooms.length).toBe(1);
    expect(c.extract.oda_available).toBe(false);
    expect(c.extract.path).toBe('mock_fixture');
  });

  it('parses JSON candidates payload', () => {
    const raw = builtInFixtureCandidates();
    const parsed = parseCandidatesPayload(raw);
    expect(parsed.walls).toHaveLength(4);
    expect(parsed.label).toContain('mock');
  });

  it('starts fixture job and confirms into owned RoomGraph', async () => {
    const job = await startImportJob(null, { useFixture: true });
    expect(job.status).toBe('draft');
    expect(job.source.extract_path).toBe('mock_fixture');
    expect(job.candidates.extract.oda_available).toBe(false);

    const graph = confirmImportToRoomGraph(job);
    expect(graph.provenance.kind).toBe('dwg_import');
    expect(graph.provenance.confirm_status).toBe('confirmed');
    expect(graph.provenance.import_job_id).toBe(job.id);
    expect(graph.source_assets).toHaveLength(1);
    expect(graph.source_assets[0]!.kind).toBe('mock_fixture');
    expect(graph.walls).toHaveLength(4);
    expect(graph.openings).toHaveLength(2);
    expect(graph.placements).toHaveLength(0);
    expect(graph.openings.every((o) => o.inferred === true)).toBe(true);
  });

  it('applies scale confirm from known length', async () => {
    let job = await startImportJob(null, { useFixture: true });
    const factor = scaleFactorFromKnownLength(job, 10); // hint is 5 m → ×2
    expect(factor).toBeCloseTo(2, 5);
    job = setScaleFactor(job, factor);
    const graph = confirmImportToRoomGraph(job);
    const south = graph.walls[0]!;
    const len = Math.hypot(south.b.x - south.a.x, south.b.z - south.a.z);
    expect(len).toBeCloseTo(10, 5);
  });

  it('rejects confirm when too few walls accepted', async () => {
    let job = await startImportJob(null, { useFixture: true });
    for (const w of job.candidates.walls) {
      job = setCandidateAccepted(job, 'wall', w.id, false);
    }
    expect(() => confirmImportToRoomGraph(job)).toThrow(/at least 3 wall/i);
  });

  it('keeps DWG upload as SourceAsset but uses mock extract', async () => {
    const bytes = new Uint8Array([0x41, 0x43, 0x31, 0x30]); // fake header stub
    const file = new File([bytes], 'client-plan.dwg', { type: 'application/octet-stream' });
    const job = await startImportJob(file, { useFixture: false });
    expect(job.source.kind).toBe('dwg');
    expect(job.source.filename).toBe('client-plan.dwg');
    expect(job.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(job.source.extract_path).toBe('mock_fixture');
    expect(job.candidates.extract.oda_available).toBe(false);
    expect(job.candidates.extract.note).toMatch(/not entity-parsed/i);
  });
});
