import type { CompanyProfile } from '@shared/types/companyProfile';
import { resolveBrandLabel } from '../companies/brandLabel';
import type { PdfCompanyInfo } from './types';

export function toPdfCompanyInfo(profile: CompanyProfile): PdfCompanyInfo {
  return {
    logoPath: profile.logoPath,
    displayName: profile.displayName,
    brandLabel: resolveBrandLabel(profile.logoPath),
    legalName: profile.legalName,
    cnpj: profile.cnpj,
    address: profile.address
  };
}
