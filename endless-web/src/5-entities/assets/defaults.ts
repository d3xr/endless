import { RealAsset } from './types'

/**
 * Fallback when no active persona has been selected. Always empty in the
 * public demo build. Per-persona assets live in
 * endless-web/src/demoData/personas/profiles.ts and are injected into
 * localStorage by loadDemoData() when the visitor picks a persona.
 */
export const DEFAULT_ASSETS: RealAsset[] = []
