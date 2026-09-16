import type { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CompanyAddress, CompanyGroupInput, CompanyProfileInput } from '@shared/types/companyProfile';
import { fillEmptyCompanyProfileFields, getCompanyProfile, setCompanyProfileLogo } from './companyProfileRepository';
import { fillEmptyCompanyGroupFields } from './companyGroupRepository';
import { resolveBundledBrandLogoPath, type BrandKey } from './brandLogos';

interface SeedProfile extends Omit<CompanyProfileInput, 'active'> {
  brand: BrandKey;
}

/**
 * Real cadastral data supplied by the user in
 * `Cadastro-Empresas-Formatador-Comissao.md` (2026-09-15) - never invented,
 * never fetched from the internet. Two corporate groups, seven branches.
 */
const CRAVINHOS: Pick<CompanyAddress, 'cidade' | 'uf' | 'cep' | 'bairro'> = {
  bairro: 'Parque Industrial',
  cidade: 'Cravinhos',
  uf: 'SP',
  cep: '14140-000'
};

const PERMETAL_LEGAL_NAME = 'Permetal S A Metais Perfurados';
const TRES_S_LEGAL_NAME = 'Tres S Ferramentas de Precisao LTDA';

const SEED_GROUPS: readonly CompanyGroupInput[] = [
  {
    groupKey: 'PERMETAL',
    displayName: 'Permetal S.A. Metais Perfurados',
    legalName: PERMETAL_LEGAL_NAME,
    headquartersBranchCode: '0104',
    headquartersCnpj: '61.139.192/0004-59',
    headquartersAddress: {
      endereco: 'Rodovia Anhanguera Km 298+193 Mts, S/N, Galpão 1-A',
      ...CRAVINHOS
    }
  },
  {
    groupKey: 'TRES_S',
    displayName: 'Três-S Ferramentas de Precisão',
    legalName: TRES_S_LEGAL_NAME,
    headquartersBranchCode: '0504',
    headquartersCnpj: '62.439.294/0004-52',
    headquartersAddress: {
      endereco: 'Rodovia Anhanguera SP 330 Km 298 + 193 Mts, S/N, Galpão 1 B',
      bairro: 'Industrial',
      cidade: 'Cravinhos',
      uf: 'SP',
      cep: '14140-000'
    }
  }
];

const SEED_PROFILES: readonly SeedProfile[] = [
  {
    branchCode: '0101',
    displayName: 'PERMETAL',
    legalName: PERMETAL_LEGAL_NAME,
    cnpj: '61.139.192/0001-06',
    address: { endereco: 'Rodovia Anhanguera Km 298 + 193 Mts, S/N, Galpão 1 A Sala 02', bairro: 'Setor Industrial', cidade: 'Cravinhos', uf: 'SP', cep: '14140-000' },
    groupKey: 'PERMETAL',
    brand: 'PERMETAL'
  },
  {
    branchCode: '0103',
    displayName: 'PERMETAL SÃO PAULO',
    legalName: PERMETAL_LEGAL_NAME,
    cnpj: '61.139.192/0003-78',
    address: { endereco: 'Rua Dias da Silva, 1122, Quadra 62', bairro: 'Vila Maria', cidade: 'São Paulo', uf: 'SP', cep: '02114-002' },
    groupKey: 'PERMETAL',
    brand: 'PERMETAL'
  },
  {
    branchCode: '0104',
    displayName: 'PERMETAL CRAVINHOS',
    legalName: PERMETAL_LEGAL_NAME,
    cnpj: '61.139.192/0004-59',
    address: { endereco: 'Rodovia Anhanguera Km 298+193 Mts, S/N, Galpão 1-A', ...CRAVINHOS },
    groupKey: 'PERMETAL',
    brand: 'PERMETAL'
  },
  {
    branchCode: '0105',
    displayName: 'METALGRADE NOVA',
    legalName: PERMETAL_LEGAL_NAME,
    tradeName: 'Metalgrade Pisos Industriais',
    cnpj: '61.139.192/0005-30',
    address: { endereco: 'Rodovia Anhanguera SP 300 - Km 298 + 193 M, S/N, Galpão 2A', ...CRAVINHOS },
    groupKey: 'PERMETAL',
    brand: 'METALGRADE'
  },
  {
    branchCode: '0106',
    displayName: 'MGZINC GALVANIZAÇÃO',
    legalName: PERMETAL_LEGAL_NAME,
    tradeName: 'MGZINC GALVANIZACAO',
    cnpj: '61.139.192/0006-10',
    address: { endereco: 'Rodovia Anhanguera SP 300 - Km 298 + 193 M, S/N, Galpão 2C', ...CRAVINHOS },
    groupKey: 'PERMETAL',
    brand: 'MG_ZINC'
  },
  {
    branchCode: '0503',
    displayName: 'TRÊS-S FILIAL',
    legalName: TRES_S_LEGAL_NAME,
    cnpj: '62.439.294/0003-71',
    address: { endereco: 'Rodovia Anhanguera SP 330 Km 298 + 193 Mts, S/N, Galpão 3-A', bairro: 'Industrial', cidade: 'Cravinhos', uf: 'SP', cep: '14140-000' },
    groupKey: 'TRES_S',
    brand: 'TRES_S'
  },
  {
    branchCode: '0504',
    displayName: 'TRÊS-S MATRIZ DISCO',
    legalName: TRES_S_LEGAL_NAME,
    cnpj: '62.439.294/0004-52',
    address: { endereco: 'Rodovia Anhanguera SP 330 Km 298 + 193 Mts, S/N, Galpão 1 B', bairro: 'Industrial', cidade: 'Cravinhos', uf: 'SP', cep: '14140-000' },
    groupKey: 'TRES_S',
    brand: 'TRES_S'
  }
];

/**
 * Idempotent and safe for both a brand-new database and an existing one:
 * inserts any branch/group that does not exist yet, and for ones that
 * already exist, fills only currently-empty fields - it never overwrites a
 * value a user (or a previous seed run) already set. `brandLogosDir` must
 * already be resolved for dev vs packaged/asar (see `main/app/assets.ts`
 * `resolveBrandLogosDir`).
 */
export function seedDefaultCompanyProfiles(db: DatabaseSync, brandLogosDir: string, logosDir: string): void {
  mkdirSync(logosDir, { recursive: true });

  for (const group of SEED_GROUPS) {
    fillEmptyCompanyGroupFields(db, group);
  }

  for (const seed of SEED_PROFILES) {
    const before = getCompanyProfile(db, seed.branchCode);

    const bundledLogo = resolveBundledBrandLogoPath(brandLogosDir, seed.brand);
    const targetLogo = join(logosDir, `${seed.brand}.png`);
    if (existsSync(bundledLogo) && !existsSync(targetLogo)) {
      copyFileSync(bundledLogo, targetLogo);
    }

    const profileInput: CompanyProfileInput = {
      branchCode: seed.branchCode,
      displayName: seed.displayName,
      legalName: seed.legalName,
      tradeName: seed.tradeName,
      cnpj: seed.cnpj,
      address: seed.address,
      groupKey: seed.groupKey
    };
    fillEmptyCompanyProfileFields(db, profileInput);

    // Only fills a logo that is currently empty - never replaces one already set.
    if (!before?.logoPath && existsSync(targetLogo)) {
      setCompanyProfileLogo(db, seed.branchCode, targetLogo);
    }
  }
}
