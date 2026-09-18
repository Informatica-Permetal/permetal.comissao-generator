import { writeFileSync } from 'node:fs';
import type { CompanyGroup, CompanyProfile } from '@shared/types/companyProfile';
import type { ReportMode } from '@shared/constants/folders';
import type { GroupingMode } from '@shared/types/history';
import type { ConsolidatedSellerGroup, DocumentGroup } from '../reports/common/grouping';
import { isConsolidatedUnit, isSeparateUnit, resolvePublishUnits } from '../reports/common/grouping';
import { findUnconfiguredBranchCodes } from '../companies/branchConfiguration';
import type { PrevisaoParsedRow, PrevisaoParseResult } from '../reports/previsao/parser';
import type { RelacaoParsedRow, RelacaoParseResult } from '../reports/relacao/parser';
import { buildPrevisaoHtmlDocument } from './htmlTemplate/previsaoTemplate';
import { buildRelacaoHtmlDocument } from './htmlTemplate/relacaoTemplate';
import { buildPrevisaoConsolidatedHtmlDocument, buildRelacaoConsolidatedHtmlDocument } from './htmlTemplate/consolidatedTemplate';
import {
  buildConsolidatedPrintHeaderTemplate,
  buildPrintFooterTemplate,
  buildPrintHeaderTemplate
} from './htmlTemplate/layout';
import { buildConsolidatedPdfFileName, buildPdfFileName, resolveGeradosDir, resolveUniqueOutputPath } from './outputPath';
import { buildPrevisaoViewModel } from './previsaoViewModel';
import { buildRelacaoViewModel } from './relacaoViewModel';
import { buildPrevisaoConsolidatedViewModel, buildRelacaoConsolidatedViewModel } from './consolidatedViewModel';
import { toPdfCompanyInfo } from './companyInfo';
import type { RenderPdfOptions } from './renderPdf';
import type { PdfCompanyInfo, PdfDocumentIdentity } from './types';

export interface GeneratedPdfBranch {
  branchCode: string;
  branchName: string;
  rowCount: number;
  subtotal: string;
}

export interface GeneratedPdf {
  groupingMode: GroupingMode;
  /** Primary (first) branch - see `branches` for the full, authoritative list. */
  branchCode: string;
  sellerCode: string;
  sellerName: string;
  filePath: string;
  total: string;
  rowCount: number;
  branches: GeneratedPdfBranch[];
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
  /** Absent (or a branch with no groupKey) resolves to no group - the header then falls back to the branch's own identity alone. */
  lookupCompanyGroup?: (groupKey: string | null) => CompanyGroup | null;
  /** Per-seller grouping choice; a seller absent (or with a single branch) always publishes `separate_by_branch`. Omitted entirely = everyone separado, preserving the pre-Fase-5 default. */
  modeBySeller?: ReadonlyMap<string, GroupingMode>;
  /** Injected so orchestration can be unit-tested without a real Electron BrowserWindow. */
  renderPdf: (html: string, options: RenderPdfOptions) => Promise<Buffer>;
  /** The real "chapa perfurada" asset, pre-embedded as a data: URI (see `embedImageAsDataUri`) - resolved once per generation call, never re-read per document. Absent/null simply omits the motif. */
  motifDataUri?: string | null;
}

const NO_GROUP: (groupKey: string | null) => CompanyGroup | null = () => null;

type SeparatedViewModel = { identity: PdfDocumentIdentity; total: string; rowCount: number };

interface ConsolidatedBranchBase {
  branchCode: string;
  branchName: string;
  rowCount: number;
  subtotal: string;
  company: PdfCompanyInfo;
}

type ConsolidatedViewModel = {
  identity: {
    mode: 'Previsao' | 'Relacao';
    sellerCode: string;
    sellerName: string;
    branchCodes: string[];
    generatedAt: Date;
    periodoAnalise: string;
  };
  total: string;
  rowCount: number;
  branches: ConsolidatedBranchBase[];
};

async function generateSeparateGroupPdfs<TRow, TViewModel extends SeparatedViewModel>(
  groups: readonly DocumentGroup<TRow>[],
  mode: ReportMode,
  modeTitle: string,
  buildViewModel: (
    group: DocumentGroup<TRow>,
    company: CompanyProfile,
    lookupCompanyGroup: (groupKey: string | null) => CompanyGroup | null,
    generatedAt: Date
  ) => TViewModel,
  buildHtml: (viewModel: TViewModel, generatedAtLabel: string, motifDataUri: string | null) => string,
  deps: GenerateReportPdfsDeps
): Promise<GeneratedPdf[]> {
  const { reportRoot, generatedAt, lookupCompanyProfile, renderPdf } = deps;
  const lookupCompanyGroup = deps.lookupCompanyGroup ?? NO_GROUP;
  const motifDataUri = deps.motifDataUri ?? null;
  const generatedAtLabel = formatGeneratedAtLabel(generatedAt);
  const geradosDir = resolveGeradosDir(reportRoot, mode);
  const generated: GeneratedPdf[] = [];

  for (const group of groups) {
    const company = lookupCompanyProfile(group.branchCode) as CompanyProfile;
    const viewModel = buildViewModel(group, company, lookupCompanyGroup, generatedAt);
    const html = buildHtml(viewModel, generatedAtLabel, motifDataUri);

    const pdfBuffer = await renderPdf(html, {
      headerTemplate: buildPrintHeaderTemplate(toPdfCompanyInfo(company), modeTitle, viewModel.identity),
      footerTemplate: buildPrintFooterTemplate()
    });

    const fileName = buildPdfFileName(mode, generatedAt, group.branchCode, group.sellerCode, group.sellerName);
    const filePath = resolveUniqueOutputPath(geradosDir, fileName);
    writeFileSync(filePath, pdfBuffer);

    generated.push({
      groupingMode: 'separate_by_branch',
      branchCode: group.branchCode,
      sellerCode: group.sellerCode,
      sellerName: group.sellerName,
      filePath,
      total: viewModel.total,
      rowCount: viewModel.rowCount,
      branches: [
        {
          branchCode: group.branchCode,
          branchName: group.branchName || company.displayName,
          rowCount: group.rows.length,
          subtotal: viewModel.total
        }
      ]
    });
  }

  return generated;
}

async function generateConsolidatedGroupPdfs<TRow, TViewModel extends ConsolidatedViewModel>(
  consolidatedGroups: readonly ConsolidatedSellerGroup<TRow>[],
  mode: ReportMode,
  modeTitle: string,
  buildViewModel: (
    group: ConsolidatedSellerGroup<TRow>,
    lookupCompanyProfile: (branchCode: string) => CompanyProfile | null,
    lookupCompanyGroup: (groupKey: string | null) => CompanyGroup | null,
    generatedAt: Date
  ) => TViewModel,
  buildHtml: (viewModel: TViewModel, generatedAtLabel: string, motifDataUri: string | null) => string,
  deps: GenerateReportPdfsDeps
): Promise<GeneratedPdf[]> {
  const { reportRoot, generatedAt, lookupCompanyProfile, renderPdf } = deps;
  const lookupCompanyGroup = deps.lookupCompanyGroup ?? NO_GROUP;
  const motifDataUri = deps.motifDataUri ?? null;
  const generatedAtLabel = formatGeneratedAtLabel(generatedAt);
  const geradosDir = resolveGeradosDir(reportRoot, mode);
  const generated: GeneratedPdf[] = [];

  for (const group of consolidatedGroups) {
    const viewModel = buildViewModel(group, lookupCompanyProfile, lookupCompanyGroup, generatedAt);
    const html = buildHtml(viewModel, generatedAtLabel, motifDataUri);

    const pdfBuffer = await renderPdf(html, {
      headerTemplate: buildConsolidatedPrintHeaderTemplate(modeTitle, viewModel.identity),
      footerTemplate: buildPrintFooterTemplate()
    });

    const fileName = buildConsolidatedPdfFileName(mode, generatedAt, group.sellerCode, group.sellerName);
    const filePath = resolveUniqueOutputPath(geradosDir, fileName);
    writeFileSync(filePath, pdfBuffer);

    generated.push({
      groupingMode: 'consolidated_by_seller',
      branchCode: viewModel.branches[0].branchCode,
      sellerCode: group.sellerCode,
      sellerName: group.sellerName,
      filePath,
      total: viewModel.total,
      rowCount: viewModel.rowCount,
      branches: viewModel.branches.map((branch) => ({
        branchCode: branch.branchCode,
        branchName: branch.branchName,
        rowCount: branch.rowCount,
        subtotal: branch.subtotal
      }))
    });
  }

  return generated;
}

export async function generatePrevisaoPdfs(
  parseResult: PrevisaoParseResult,
  deps: GenerateReportPdfsDeps
): Promise<GenerateReportPdfsResult> {
  const missingBranchCodes = findUnconfiguredBranchCodes(parseResult.groups, deps.lookupCompanyProfile);
  if (missingBranchCodes.length > 0) {
    return { generated: [], missingBranchCodes };
  }

  const units = resolvePublishUnits(parseResult.groups, deps.modeBySeller ?? new Map());
  const separateGroups = units.filter(isSeparateUnit<PrevisaoParsedRow>).map((unit) => unit.group);
  const consolidatedGroups = units.filter(isConsolidatedUnit<PrevisaoParsedRow>).map((unit) => unit.group);

  const generated = [
    ...(await generateSeparateGroupPdfs(
      separateGroups,
      'Previsao',
      'Previsão de Comissões',
      buildPrevisaoViewModel,
      buildPrevisaoHtmlDocument,
      deps
    )),
    ...(await generateConsolidatedGroupPdfs(
      consolidatedGroups,
      'Previsao',
      'Previsão de Comissões',
      buildPrevisaoConsolidatedViewModel,
      buildPrevisaoConsolidatedHtmlDocument,
      deps
    ))
  ];

  return { generated, missingBranchCodes: [] };
}

export async function generateRelacaoPdfs(
  parseResult: RelacaoParseResult,
  deps: GenerateReportPdfsDeps
): Promise<GenerateReportPdfsResult> {
  const missingBranchCodes = findUnconfiguredBranchCodes(parseResult.groups, deps.lookupCompanyProfile);
  if (missingBranchCodes.length > 0) {
    return { generated: [], missingBranchCodes };
  }

  const units = resolvePublishUnits(parseResult.groups, deps.modeBySeller ?? new Map());
  const separateGroups = units.filter(isSeparateUnit<RelacaoParsedRow>).map((unit) => unit.group);
  const consolidatedGroups = units.filter(isConsolidatedUnit<RelacaoParsedRow>).map((unit) => unit.group);

  const generated = [
    ...(await generateSeparateGroupPdfs(
      separateGroups,
      'Relacao',
      'Relação de Comissões',
      buildRelacaoViewModel,
      buildRelacaoHtmlDocument,
      deps
    )),
    ...(await generateConsolidatedGroupPdfs(
      consolidatedGroups,
      'Relacao',
      'Relação de Comissões',
      buildRelacaoConsolidatedViewModel,
      buildRelacaoConsolidatedHtmlDocument,
      deps
    ))
  ];

  return { generated, missingBranchCodes: [] };
}

function formatGeneratedAtLabel(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
