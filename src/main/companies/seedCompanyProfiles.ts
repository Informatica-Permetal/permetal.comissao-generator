import type { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getCompanyProfile, setCompanyProfileLogo, upsertCompanyProfile } from './companyProfileRepository';
import { resolveBundledBrandLogoPath, type BrandKey } from './brandLogos';

interface SeedProfile {
  branchCode: string;
  displayName: string;
  brand: BrandKey;
}

/**
 * Every branch code actually observed in the validated Previsao/Relacao
 * exports. Tres-S has no known branch code yet (none observed so far), so it
 * is not seeded here - its logo stays available for a profile the user
 * creates by hand once a Tres-S branch shows up in a real import.
 */
const SEED_PROFILES: readonly SeedProfile[] = [
  { branchCode: '0103', displayName: 'PERMETAL SAO PAULO', brand: 'PERMETAL' },
  { branchCode: '0104', displayName: 'PERMETAL CRAVINHOS', brand: 'PERMETAL' },
  { branchCode: '0105', displayName: 'METALGRADE NOVA', brand: 'METALGRADE' },
  { branchCode: '0106', displayName: 'MG', brand: 'MG_ZINC' }
];

/**
 * Idempotent: only ever inserts branch codes that do not exist yet, so a
 * user's edits in Configuracoes survive every future app restart.
 * `brandLogosDir` must already be resolved for dev vs packaged/asar (see
 * `main/app/assets.ts` `resolveBrandLogosDir`).
 */
export function seedDefaultCompanyProfiles(db: DatabaseSync, brandLogosDir: string, logosDir: string): void {
  mkdirSync(logosDir, { recursive: true });

  for (const seed of SEED_PROFILES) {
    if (getCompanyProfile(db, seed.branchCode)) continue;

    const bundledLogo = resolveBundledBrandLogoPath(brandLogosDir, seed.brand);
    const targetLogo = join(logosDir, `${seed.brand}.png`);
    if (existsSync(bundledLogo) && !existsSync(targetLogo)) {
      copyFileSync(bundledLogo, targetLogo);
    }

    upsertCompanyProfile(db, {
      branchCode: seed.branchCode,
      displayName: seed.displayName,
      active: true
    });
    if (existsSync(targetLogo)) {
      setCompanyProfileLogo(db, seed.branchCode, targetLogo);
    }
  }
}
