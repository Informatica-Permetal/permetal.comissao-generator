import { writeFileSync } from 'node:fs';
import type { CompanyProfile } from '@shared/types/companyProfile';
import type { ReportMode } from '@shared/constants/folders';
import type { DocumentGroup } from '../reports/common/grouping';
import { findUnconfiguredBranchCodes } from '../companies/branchConfiguration';
import type { PrevisaoParseResult } from '../reports/previsao/parser';
import type { RelacaoParseResult } from '../reports/relacao/parser';
import { buildPrevisaoHtmlDocument } from './htmlTemplate/previsaoTemplate';
import { buildRelacaoHtmlDocument } from './htmlTemplate/relacaoTemplate';
import { buildPrintFooterTemplate, buildPrintHeaderTemplate } from './htmlTemplate/layout';
import { buildPdfFileName, resolveGeradosDir, resolveUniqueOutputPath } from './outputPath';
import { buildPrevisaoViewModel } from './previsaoViewModel';
import { buildRelacaoViewModel } from './relacaoViewModel';
import { toPdfCompanyInfo } from './companyInfo';
import type { RenderPdfOptions } from './renderPdf';
import type { PdfDocumentIdentity } from './types';

export interface GeneratedPdf {
  branchCode: string;
  sellerCode: string;
  sellerName: string;
  filePath: string;
  total: string;
  rowCount: number;
}

export interface GenerateReportPdfsResult {
  generated: GeneratedPdf[];
  /** Branch codes present in the source data with no configured company profile - blocks generation entirely. */
  missingBranchCodes: string[];
}

export interface GenerateReportPdfsDeps {
  reportRoot: string;
  generatedAt: Date;
  lookupCompanyProfile: (branchCode: string) => CompanyProfile | null;
  /** Injected so orchestration can be unit-tested without a real Electron BrowserWindow. */
  renderPdf: (html: string, options: RenderPdfOptions) => Promise<Buffer>;
}

type PdfViewModel = { identity: PdfDocumentIdentity; total: string; rowCount: number };

async function generateGroupPdfs<TRow, TViewModel extends PdfViewModel>(
  groups: readonly DocumentGroup<TRow>[],
  mode: ReportMode,
  modeTitle: string,
  buildViewModel: (group: DocumentGroup<TRow>, company: CompanyProfile, generatedAt: Date) => TViewModel,
  buildHtml: (viewModel: TViewModel, generatedAtLabel: string) => string,
  deps: GenerateReportPdfsDeps
): Promise<GenerateReportPdfsResult> {
  const { reportRoot, generatedAt, lookupCompanyProfile, renderPdf } = deps;

  const missingBranchCodes = findUnconfiguredBranchCodes(groups, lookupCompanyProfile);
  if (missingBranchCodes.length > 0) {
    return { generated: [], missingBranchCodes };
  }

  const generatedAtLabel = formatGeneratedAtLabel(generatedAt);
  const geradosDir = resolveGeradosDir(reportRoot, mode);
  const generated: GeneratedPdf[] = [];

  for (const group of groups) {
    const company = lookupCompanyProfile(group.branchCode) as CompanyProfile;
    const viewModel = buildViewModel(group, company, generatedAt);
    const html = buildHtml(viewModel, generatedAtLabel);

    const pdfBuffer = await renderPdf(html, {
      headerTemplate: buildPrintHeaderTemplate(toPdfCompanyInfo(company), modeTitle, viewModel.identity),
      footerTemplate: buildPrintFooterTemplate()
    });

    const fileName = buildPdfFileName(mode, generatedAt, group.branchCode, group.sellerCode, group.sellerName);
    const filePath = resolveUniqueOutputPath(geradosDir, fileName);
    writeFileSync(filePath, pdfBuffer);

    generated.push({
      branchCode: group.branchCode,
      sellerCode: group.sellerCode,
      sellerName: group.sellerName,
      filePath,
      total: viewModel.total,
      rowCount: viewModel.rowCount
    });
  }

  return { generated, missingBranchCodes: [] };
}

export function generatePrevisaoPdfs(
  parseResult: PrevisaoParseResult,
  deps: GenerateReportPdfsDeps
): Promise<GenerateReportPdfsResult> {
  return generateGroupPdfs(
    parseResult.groups,
    'Previsao',
    'Previsão de Comissões',
    buildPrevisaoViewModel,
    buildPrevisaoHtmlDocument,
    deps
  );
}

export function generateRelacaoPdfs(
  parseResult: RelacaoParseResult,
  deps: GenerateReportPdfsDeps
): Promise<GenerateReportPdfsResult> {
  return generateGroupPdfs(
    parseResult.groups,
    'Relacao',
    'Relação de Comissões',
    buildRelacaoViewModel,
    buildRelacaoHtmlDocument,
    deps
  );
}

function formatGeneratedAtLabel(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
