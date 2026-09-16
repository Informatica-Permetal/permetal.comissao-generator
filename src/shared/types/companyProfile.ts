export interface CompanyAddress {
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export interface CompanyProfile {
  branchCode: string;
  displayName: string;
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  address: CompanyAddress | null;
  logoPath: string | null;
  /** Corporate group/organization this branch belongs to (e.g. "PERMETAL"), distinct from the Protheus branch code and from the brand/logo. Null when the branch has no known group. */
  groupKey: string | null;
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
  groupKey?: string | null;
  active?: boolean;
}

/**
 * A corporate group/organization (e.g. "Grupo Permetal") that owns one or
 * more Protheus branches sharing the same CNPJ root, kept as its own entity
 * so it is never conflated with a single branch or with a brand/logo.
 */
export interface CompanyGroup {
  groupKey: string;
  displayName: string;
  legalName: string | null;
  headquartersBranchCode: string | null;
  headquartersCnpj: string | null;
  headquartersAddress: CompanyAddress | null;
  updatedAt: string;
}

export interface CompanyGroupInput {
  groupKey: string;
  displayName: string;
  legalName?: string | null;
  headquartersBranchCode?: string | null;
  headquartersCnpj?: string | null;
  headquartersAddress?: CompanyAddress | null;
}

export interface DeleteCompanyProfileResult {
  ok: boolean;
  reason?: 'hasDocuments';
  documentCount?: number;
}
