import type { CompanyAddress } from '@shared/types/companyProfile';

/** The branch's corporate group/organization - "grupo/organização" and "razão social/endereço da matriz" in the PDF header. Never conflated with the branch's own identity or its brand/logo. */
export interface PdfGroupInfo {
  displayName: string;
  legalName: string | null;
  headquartersAddress: CompanyAddress | null;
}

export interface PdfCompanyInfo {
  logoPath: string | null;
  displayName: string;
  /** Short brand label derived from the logo (e.g. "Permetal") - distinct text from the branch's own display name, so the letterhead and the document identity block never repeat the same wording. */
  brandLabel: string | null;
  legalName: string | null;
  cnpj: string | null;
  address: CompanyAddress | null;
  /** Null when this branch has no known corporate group - the header then falls back to the branch's own identity alone. */
  group: PdfGroupInfo | null;
}

export interface PdfDocumentIdentity {
  mode: 'Previsao' | 'Relacao';
  sellerCode: string;
  sellerName: string;
  branchCode: string;
  branchName: string;
  generatedAt: Date;
  /** "Não informado" when no row has a valid date for the mode's authoritative date field - never used to filter rows, purely a display summary. */
  periodoAnalise: string;
}

export interface PrevisaoPdfRow {
  documento: string;
  cliente: string;
  emissao: string;
  vencimento: string;
  dataDaBaixa: string;
  baseParaBaixa: string;
  comissao: string;
}

export interface PrevisaoPdfSection {
  classificacao: string;
  rows: PrevisaoPdfRow[];
}

export interface PrevisaoPdfViewModel {
  identity: PdfDocumentIdentity;
  company: PdfCompanyInfo;
  sections: PrevisaoPdfSection[];
  rowCount: number;
  total: string;
}

export interface RelacaoPdfRow {
  pedido: string;
  titulo: string;
  cliente: string;
  dataDaBaixa: string;
  baseDaComissao: string;
  percentComissao: string;
  valorDaComissao: string;
}

export interface RelacaoPdfViewModel {
  identity: PdfDocumentIdentity;
  company: PdfCompanyInfo;
  rows: RelacaoPdfRow[];
  rowCount: number;
  total: string;
}

/**
 * A consolidated PDF's identity is deliberately NOT `PdfDocumentIdentity` -
 * it has no single branch. Not polished (visual finishing is a later
 * phase); this is the minimal correct shape: one seller, several branch
 * sections, each keeping its own (never-recalculated) subtotal.
 */
export interface ConsolidatedPdfIdentity {
  mode: 'Previsao' | 'Relacao';
  sellerCode: string;
  sellerName: string;
  branchCodes: string[];
  generatedAt: Date;
  /** Computed across every row of every included branch - "Não informado" when none has a valid date. Never used to filter rows. */
  periodoAnalise: string;
}

export interface PrevisaoConsolidatedBranchSection {
  branchCode: string;
  branchName: string;
  company: PdfCompanyInfo;
  sections: PrevisaoPdfSection[];
  rowCount: number;
  subtotal: string;
}

export interface PrevisaoConsolidatedPdfViewModel {
  identity: ConsolidatedPdfIdentity;
  branches: PrevisaoConsolidatedBranchSection[];
  rowCount: number;
  total: string;
}

export interface RelacaoConsolidatedBranchSection {
  branchCode: string;
  branchName: string;
  company: PdfCompanyInfo;
  rows: RelacaoPdfRow[];
  rowCount: number;
  subtotal: string;
}

export interface RelacaoConsolidatedPdfViewModel {
  identity: ConsolidatedPdfIdentity;
  branches: RelacaoConsolidatedBranchSection[];
  rowCount: number;
  total: string;
}
