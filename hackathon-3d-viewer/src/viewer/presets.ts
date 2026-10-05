// Light presets are scene-level, never baked into furniture GLBs (prompt §2 lock).

export interface PresetLight {
  type: 'directional' | 'hemisphere' | 'ambient';
  color: string;
  /** Hemisphere only. */
  groundColor?: string;
  intensity: number;
  /** Directional only; light points at the origin. */
  position?: [number, number, number];
  castShadow?: boolean;
}

export interface LightPreset {
  id: string;
  label: string;
  /** Use a PMREM-filtered RoomEnvironment for image-based lighting. */
  environment: boolean;
  environmentIntensity: number;
  exposure: number;
  background: string;
  shadowOpacity: number;
  lights: PresetLight[];
}

export const LIGHT_PRESETS: LightPreset[] = [
  {
    id: 'studio-soft',
    label: 'Studio soft',
    environment: true,
    environmentIntensity: 1.0,
    exposure: 1.0,
    background: '#F1F1F1',
    shadowOpacity: 0.18,
    lights: [{ type: 'directional', color: '#ffffff', intensity: 1.2, position: [2, 4, 3], castShadow: true }],
  },
  {
    id: 'warm-interior',
    label: 'Warm interior',
    environment: true,
    environmentIntensity: 0.35,
    exposure: 1.05,
    background: '#EFE7DD',
    shadowOpacity: 0.3,
    lights: [
      { type: 'hemisphere', color: '#ffe2bf', groundColor: '#5a4636', intensity: 0.8 },
      { type: 'directional', color: '#ffb46b', intensity: 2.4, position: [-3, 2.2, 2], castShadow: true },
    ],
  },
  {
    id: 'neutral',
    label: 'Neutral (no IBL)',
    environment: false,
    environmentIntensity: 0,
    exposure: 1.0,
    background: '#FFFFFF',
    shadowOpacity: 0.12,
    lights: [
      { type: 'hemisphere', color: '#ffffff', groundColor: '#bdbdbd', intensity: 1.6 },
      { type: 'directional', color: '#ffffff', intensity: 1.6, position: [3, 5, 4], castShadow: true },
      { type: 'directional', color: '#ffffff', intensity: 0.5, position: [-4, 2, -3] },
    ],
  },
];

export function findPreset(id: string): LightPreset | undefined {
  return LIGHT_PRESETS.find((p) => p.id === id);
}
