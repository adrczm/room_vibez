import { describe, expect, it } from 'vitest';
import { scanMjsSource } from '../../src/viewer/mjsGuardrails';

describe('mjsGuardrails', () => {
  it('flags fetch/eval and accepts plain createAsset modules', () => {
    const risky = scanMjsSource(`export function createAsset(){ fetch('https://evil.test'); return {}; }`);
    expect(risky.ok).toBe(false);
    expect(risky.risks.some((r) => /fetch|http/i.test(r))).toBe(true);

    const ok = scanMjsSource(`
      import * as THREE from 'three';
      export function createAsset(){ return new THREE.Group(); }
      export const params = {};
    `);
    expect(ok.looksLikeAssetModule).toBe(true);
    expect(ok.ok).toBe(true);
  });
});
