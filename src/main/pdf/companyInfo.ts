import type { CompanyGroup, CompanyProfile } from '@shared/types/companyProfile';
import { resolveBrandLabel } from '../companies/brandLabel';
import type { PdfCompanyInfo } from './types';

export function toPdfCompanyInfo(profile: CompanyProfile, group: CompanyGroup | null = null): PdfCompanyInfo {
  return {
    logoPath: profile.logoPath,
    displayName: profile.displayName,
    brandLabel: resolveBrandLabel(profile.logoPath),
    legalName: profile.legalName,
    cnpj: profile.cnpj,
    address: profile.address,
    group: group
      ? {
          displayName: group.displayName,
          legalName: group.legalName,
          headquartersAddress: group.headquartersAddress
        }
      : null
  };
}
