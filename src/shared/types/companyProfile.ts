export interface CompanyAddress {
  endereco?: string;
  cidade?: string;
  uf?: string;
}

export interface CompanyProfile {
  branchCode: string;
  displayName: string;
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  address: CompanyAddress | null;
  logoPath: string | null;
  active: boolean;
  updatedAt: string;
}

/** Renderer-facing shape: adds a ready-to-display data: URI, never a raw filesystem path. */
export interface CompanyProfileWithLogoPreview extends CompanyProfile {
  logoDataUri: string | null;
}

export interface CompanyProfileInput {
  branchCode: string;
  displayName: string;
  legalName?: string | null;
  tradeName?: string | null;
  cnpj?: string | null;
  address?: CompanyAddress | null;
  active?: boolean;
}
