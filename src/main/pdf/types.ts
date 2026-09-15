import type { CompanyAddress } from '@shared/types/companyProfile';

export interface PdfCompanyInfo {
  logoPath: string | null;
  displayName: string;
  /** Short brand label derived from the logo (e.g. "Permetal") - distinct text from the branch's own display name, so the letterhead and the document identity block never repeat the same wording. */
  brandLabel: string | null;
  legalName: string | null;
  cnpj: string | null;
  address: CompanyAddress | null;
}

export interface PdfDocumentIdentity {
  mode: 'Previsao' | 'Relacao';
  sellerCode: string;
  sellerName: string;
  branchCode: string;
  branchName: string;
  generatedAt: Date;
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
