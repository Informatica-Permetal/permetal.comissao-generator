import { join } from 'node:path';

export const BRAND_LOGO_FILES = {
  PERMETAL: 'PERMETAL.png',
  METALGRADE: 'METALGRADE.png',
  MG_ZINC: 'MGZINC.png',
  TRES_S: 'TRES-S.png'
} as const;

export type BrandKey = keyof typeof BRAND_LOGO_FILES;

/**
 * Path to the bundled, versioned brand logo shipped with the app.
 * `brandLogosDir` must already be resolved for the current runtime (dev vs
 * packaged/asar - see `main/app/assets.ts` `resolveBrandLogosDir`), kept as
 * a parameter so this stays testable outside Electron.
 */
export function resolveBundledBrandLogoPath(brandLogosDir: string, brand: BrandKey): string {
  return join(brandLogosDir, BRAND_LOGO_FILES[brand]);
}
