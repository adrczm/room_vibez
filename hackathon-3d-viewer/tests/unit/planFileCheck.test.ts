import { describe, expect, it } from 'vitest';
import {
  IMPORT_NOT_A_ROOM_MESSAGE,
  PlanFileError,
  builtInFixtureCandidates,
  checkPlanFile,
  confirmImportToRoomGraph,
  looksLikeDwg,
  looksLikeDxf,
  setScaleFactor,
  startImportJob,
} from '../../src/viewer/dwgImport';
import { normalizeRoomGraph } from '../../src/viewer/roomGraph';

const ascii = (text: string) => new TextEncoder().encode(text);
const file = (name: string, content: Uint8Array | string, type = 'application/octet-stream') =>
  new File([typeof content === 'string' ? content : new Uint8Array(content)], name, { type });

/** Deterministic "random" bytes (the stress test fed random bytes named .dwg). */
function junkBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = 0x9e3779b9;
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

// Synthetic stand-ins written for this test. They are NOT drawings from a CAD program:
// only the first bytes follow the documented start of each format.
const DWG_LIKE = new Uint8Array([...ascii('AC1032'), 0, 0, 0, 0, 0, 3, 0, 0, 0, 0]);
const DXF_TEXT = '  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1015\n  0\nENDSEC\n  0\nEOF\n';
const WINDOWS_EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // "MZ" header

describe('looksLikeDwg', () => {
  it('accepts a start of the form AC10xx', () => {
    expect(looksLikeDwg(DWG_LIKE)).toBe(true);
    expect(looksLikeDwg(ascii('AC1015'))).toBe(true);
    expect(looksLikeDwg(ascii('AC1009'))).toBe(true);
  });

  it('rejects everything else', () => {
    expect(looksLikeDwg(new Uint8Array(0))).toBe(false);
    expect(looksLikeDwg(junkBytes(256))).toBe(false);
    expect(looksLikeDwg(WINDOWS_EXE)).toBe(false);
    expect(looksLikeDwg(ascii('AC10'))).toBe(false); // too short to carry a version
    expect(looksLikeDwg(ascii('AC10xx'))).toBe(false);
    expect(looksLikeDwg(ascii('ac1015'))).toBe(false);
    expect(looksLikeDwg(ascii('%PDF-1.7'))).toBe(false);
  });
});

describe('looksLikeDxf', () => {
  it('accepts text that starts with a 0 / SECTION group, with or without comments, CRLF or a BOM', () => {
    expect(looksLikeDxf(ascii(DXF_TEXT))).toBe(true);
    expect(looksLikeDxf(ascii(DXF_TEXT.replace(/\n/g, '\r\n')))).toBe(true);
    expect(looksLikeDxf(ascii(`999\nmade by a test\n${DXF_TEXT}`))).toBe(true);
    expect(looksLikeDxf(new Uint8Array([0xef, 0xbb, 0xbf, ...ascii(DXF_TEXT)]))).toBe(true);
    expect(looksLikeDxf(ascii('0\nEOF\n'))).toBe(true);
  });

  it('accepts the binary DXF sentinel', () => {
    expect(looksLikeDxf(new Uint8Array([...ascii('AutoCAD Binary DXF\r\n'), 0x1a, 0x00, 0x00, 0x00]))).toBe(true);
  });

  it('rejects everything else', () => {
    expect(looksLikeDxf(new Uint8Array(0))).toBe(false);
    expect(looksLikeDxf(junkBytes(256))).toBe(false);
    expect(looksLikeDxf(WINDOWS_EXE)).toBe(false);
    expect(looksLikeDxf(ascii('hello world\nthis is a text file\n'))).toBe(false);
    expect(looksLikeDxf(ascii('0\nLINE\n8\n0\n'))).toBe(false); // an entity outside any section
    expect(looksLikeDxf(ascii('{"schema_version":1}'))).toBe(false);
    expect(looksLikeDxf(ascii('999\nonly a comment\n'))).toBe(false);
  });
});

describe('checkPlanFile', () => {
  it('routes images to the underlay path without reading them', async () => {
    expect(await checkPlanFile(file('plan.png', junkBytes(8), 'image/png'))).toEqual({ ok: true, kind: 'raster', filename: 'plan.png' });
    expect(await checkPlanFile(file('PLAN.JPG', junkBytes(8), ''))).toEqual({ ok: true, kind: 'raster', filename: 'PLAN.JPG' });
    expect((await checkPlanFile(file('plan.webp', junkBytes(8), 'image/webp'))).ok).toBe(true);
  });

  it('refuses a PDF as "pdf_unsupported"', async () => {
    expect(await checkPlanFile(file('plan.pdf', '%PDF-1.7', 'application/pdf'))).toEqual({
      ok: false,
      reason: 'pdf_unsupported',
      filename: 'plan.pdf',
      extension: 'pdf',
    });
  });

  it('refuses types with no import path as "unsupported_type" (stress test R3)', async () => {
    expect(await checkPlanFile(file('building.ifc', 'ISO-10303-21;'))).toEqual({
      ok: false,
      reason: 'unsupported_type',
      filename: 'building.ifc',
      extension: 'ifc',
    });
    expect(await checkPlanFile(file('setup.exe', WINDOWS_EXE))).toMatchObject({ ok: false, reason: 'unsupported_type', extension: 'exe' });
    expect(await checkPlanFile(file('notes.txt', 'hello'))).toMatchObject({ ok: false, reason: 'unsupported_type', extension: 'txt' });
    expect(await checkPlanFile(file('README', 'hello'))).toMatchObject({ ok: false, reason: 'unsupported_type', extension: '' });
  });

  it('refuses a .dwg whose content is not a DWG as "not_dwg" (stress test R4)', async () => {
    expect(await checkPlanFile(file('random.dwg', junkBytes(2048)))).toEqual({
      ok: false,
      reason: 'not_dwg',
      filename: 'random.dwg',
      extension: 'dwg',
    });
    expect(await checkPlanFile(file('setup.dwg', WINDOWS_EXE))).toMatchObject({ ok: false, reason: 'not_dwg' });
    expect(await checkPlanFile(file('empty.dwg', new Uint8Array(0)))).toMatchObject({ ok: false, reason: 'not_dwg' });
    expect(await checkPlanFile(file('really-a-dxf.dwg', DXF_TEXT))).toMatchObject({ ok: false, reason: 'not_dwg' });
  });

  it('accepts a .dwg that starts with an AC10xx version tag', async () => {
    expect(await checkPlanFile(file('Client Plan.DWG', DWG_LIKE))).toEqual({ ok: true, kind: 'dwg', filename: 'Client Plan.DWG' });
  });

  it('refuses a .dxf whose content is not a DXF as "not_dxf", and accepts one that starts like a DXF', async () => {
    expect(await checkPlanFile(file('random.dxf', junkBytes(2048)))).toMatchObject({ ok: false, reason: 'not_dxf', extension: 'dxf' });
    expect(await checkPlanFile(file('really-a-dwg.dxf', DWG_LIKE))).toMatchObject({ ok: false, reason: 'not_dxf' });
    expect(await checkPlanFile(file('plan.dxf', DXF_TEXT))).toEqual({ ok: true, kind: 'dxf', filename: 'plan.dxf' });
  });

  it('passes .json on by name; startImportJob validates the content', async () => {
    expect(await checkPlanFile(file('plan.candidates.json', '{bad'))).toEqual({
      ok: true,
      kind: 'json_candidates',
      filename: 'plan.candidates.json',
    });
  });
});

describe('startImportJob no longer gives a sample extract to files it has no path for', () => {
  it('throws PlanFileError "unsupported_type" for .ifc, .exe and a file with no extension', async () => {
    for (const f of [file('building.ifc', 'ISO-10303-21;'), file('setup.exe', WINDOWS_EXE), file('README', 'x')]) {
      const err = await startImportJob(f, { useFixture: false }).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(PlanFileError);
      expect((err as PlanFileError).reason).toBe('unsupported_type');
      expect((err as PlanFileError).filename).toBe(f.name);
      expect((err as PlanFileError).message).toBe(
        `Unsupported plan file type: "${f.name}" (expected .dwg, .dxf or .json)`,
      );
    }
  });

  it('a .json that is not JSON gets the existing "must be a JSON object" message, not parser text', async () => {
    await expect(startImportJob(file('plan.json', '{bad'), { useFixture: false })).rejects.toThrow(
      'Candidates payload must be a JSON object',
    );
  });

  it('a valid candidates .json still imports', async () => {
    const job = await startImportJob(file('plan.json', JSON.stringify(builtInFixtureCandidates())), { useFixture: false });
    expect(job.source.kind).toBe('json_candidates');
    expect(job.candidates.walls).toHaveLength(4);
  });

  it('the sample plan still loads with no file', async () => {
    const job = await startImportJob(null, { useFixture: true });
    expect(job.source.extract_path).toBe('mock_fixture');
  });

  it('startImportJob itself still does not look inside a .dwg: checkPlanFile is the gate', async () => {
    // Same four-byte stub as tests/unit/dwgImport.test.ts, which expects the labeled mock extract.
    const stub = file('client-plan.dwg', new Uint8Array([0x41, 0x43, 0x31, 0x30]));
    expect((await startImportJob(stub, { useFixture: false })).source.extract_path).toBe('mock_fixture');
    expect(await checkPlanFile(stub)).toMatchObject({ ok: false, reason: 'not_dwg' });
  });
});

describe('confirmImportToRoomGraph refuses candidates that do not make a usable room', () => {
  it('a candidates file whose walls have no thickness or height fails at confirm, with the failed check', async () => {
    const payload = builtInFixtureCandidates() as any;
    for (const w of payload.walls) {
      delete w.thickness;
      delete w.height;
    }
    const job = await startImportJob(file('hand-written.json', JSON.stringify(payload)), { useFixture: false });
    expect(() => confirmImportToRoomGraph(job)).toThrow(
      `${IMPORT_NOT_A_ROOM_MESSAGE}: walls[0].thickness is not a number above 0`,
    );
    expect(IMPORT_NOT_A_ROOM_MESSAGE).toBe('Import candidates are not a usable room');
  });

  it('the sample plan still confirms, at any scale, into a room that can be saved and reopened', async () => {
    const job = setScaleFactor(await startImportJob(null, { useFixture: true }), 2);
    const graph = confirmImportToRoomGraph(job);
    expect(normalizeRoomGraph(JSON.parse(JSON.stringify(graph)))).toEqual(graph);
  });
});
