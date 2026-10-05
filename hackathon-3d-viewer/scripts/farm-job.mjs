#!/usr/bin/env node
/**
 * Local conversion-farm job queue (Partial MVP) — not a server farm.
 *
 * Stages (honest local only):
 *   1. validate sidecar / pack basename pairing
 *   2. optional emit thin stub .mjs
 *   3. optional COLOR_0 pre-bake via bake-color0.mjs
 *   4. write job report JSON
 *
 * Usage:
 *   node scripts/farm-job.mjs --in path/to/pack-dir --out path/to/out-dir
 *   node scripts/farm-job.mjs --queue path/to/queue.json
 *
 * queue.json: { "jobs": [ { "id":"j1", "glb":"…", "mjs":"…?", "sidecar":"…?", "bakeColor0": true } ] }
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'scripts');

function parseArgs(argv) {
  const out = { in: null, out: null, queue: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--in') out.in = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i] === '--queue') out.queue = argv[++i];
  }
  return out;
}

function discoverPackDir(dir) {
  const files = readdirSync(dir);
  const glbs = files.filter((f) => /\.glb$/i.test(f));
  const jobs = [];
  for (const glb of glbs) {
    const stem = glb.replace(/\.glb$/i, '');
    const mjs = files.find((f) => f.toLowerCase() === `${stem}.mjs`.toLowerCase());
    const sidecar = files.find(
      (f) =>
        f.toLowerCase() === `${stem}.slots.json`.toLowerCase() ||
        f.toLowerCase() === `${stem}.json`.toLowerCase(),
    );
    jobs.push({
      id: stem,
      glb: join(dir, glb),
      mjs: mjs ? join(dir, mjs) : null,
      sidecar: sidecar ? join(dir, sidecar) : null,
      bakeColor0: true,
    });
  }
  return jobs;
}

function runJob(job, outDir) {
  const report = {
    id: job.id,
    started_at: new Date().toISOString(),
    stages: [],
    ok: true,
    note: 'Local farm job — not CDN/catalog DB register',
  };
  mkdirSync(outDir, { recursive: true });

  if (!job.glb || !existsSync(job.glb)) {
    report.ok = false;
    report.stages.push({ name: 'validate', ok: false, error: 'missing GLB' });
    return report;
  }
  report.stages.push({ name: 'validate', ok: true, glb: basename(job.glb) });

  if (job.sidecar && existsSync(job.sidecar) && !job.mjs) {
    const stubOut = join(outDir, `${job.id}.stub.mjs`);
    const r = spawnSync(process.execPath, [join(SCRIPTS, 'emit-stub-mjs.mjs'), job.sidecar, stubOut], {
      encoding: 'utf8',
    });
    report.stages.push({
      name: 'emit-stub-mjs',
      ok: r.status === 0,
      out: stubOut,
      stderr: r.stderr || undefined,
    });
    if (r.status !== 0) report.ok = false;
  } else {
    report.stages.push({ name: 'emit-stub-mjs', ok: true, skipped: true, reason: job.mjs ? 'vendor mjs present' : 'no sidecar' });
  }

  if (job.bakeColor0) {
    const baked = join(outDir, `${job.id}.color0-split.glb`);
    const r = spawnSync(
      process.execPath,
      [join(SCRIPTS, 'bake-color0.mjs'), job.glb, baked, job.mjs ?? ''].filter(Boolean),
      { encoding: 'utf8' },
    );
    report.stages.push({
      name: 'bake-color0',
      ok: r.status === 0,
      out: baked,
      stdout: (r.stdout || '').trim() || undefined,
      stderr: (r.stderr || '').trim() || undefined,
    });
    // bake may skip if no COLOR_0 — treat skip message as ok
    if (r.status !== 0 && !/skip|no COLOR_0|no zones/i.test(r.stderr + r.stdout)) report.ok = false;
    if (r.status !== 0 && /skip|no COLOR_0|no zones/i.test(r.stderr + r.stdout)) {
      report.stages[report.stages.length - 1].ok = true;
      report.stages[report.stages.length - 1].skipped = true;
    }
  }

  report.finished_at = new Date().toISOString();
  writeFileSync(join(outDir, `${job.id}.farm-report.json`), JSON.stringify(report, null, 2));
  return report;
}

const args = parseArgs(process.argv);
let jobs = [];
let outRoot = args.out ? resolve(args.out) : join(ROOT, 'farm-out');

if (args.queue) {
  const q = JSON.parse(readFileSync(resolve(args.queue), 'utf8'));
  jobs = q.jobs ?? [];
} else if (args.in) {
  jobs = discoverPackDir(resolve(args.in));
} else {
  console.error('Usage: node scripts/farm-job.mjs --in <pack-dir> --out <out-dir>');
  console.error('   or: node scripts/farm-job.mjs --queue queue.json --out <out-dir>');
  process.exit(1);
}

mkdirSync(outRoot, { recursive: true });
const summary = { farm: 'local-stub', jobs: [] };
for (const job of jobs) {
  const dir = join(outRoot, job.id || 'job');
  summary.jobs.push(runJob(job, dir));
}
writeFileSync(join(outRoot, 'farm-summary.json'), JSON.stringify(summary, null, 2));
console.log(`Farm queue done → ${outRoot} (${summary.jobs.length} job(s))`);
