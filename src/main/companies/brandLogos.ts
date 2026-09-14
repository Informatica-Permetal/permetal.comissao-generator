import { join } from 'node:path';

export const BRAND_LOGO_FILES = {
  PERMETAL: 'PERMETAL.png',
  METALGRADE: 'METALGRADE.png',
  MG_ZINC: 'MGZINC.png',
  TRES_S: 'TRES-S.png'
} as const;

export type BrandKey = keyof typeof BRAND_LOGO_FILES;

/**
 * Path to the bundled, versioned brand logo shipped with the app under
 * `resources/brand-logos/`. `projectRootPath` must be the actual project
 * root, NOT `app.getAppPath()` (which resolves to the bundled entry
 * script's own directory - `out/main` here - not the project root; verified
 * empirically). Callers should derive it from `__dirname` the same way
 * `main/index.ts` already does for the preload path (`out/main/../..`),
 * kept as a parameter so this stays testable outside Electron. Revisit when
 * Phase 6 wires electron-builder `extraResources` for a packaged build.
 */
export function resolveBundledBrandLogoPath(projectRootPath: string, brand: BrandKey): string {
  return join(projectRootPath, 'resources', 'brand-logos', BRAND_LOGO_FILES[brand]);
}
