import type { CompanyProfile } from '@shared/types/companyProfile';
import type { ConsolidatedSellerGroup } from '../reports/common/grouping';
import type { PrevisaoParsedRow } from '../reports/previsao/parser';
import type { RelacaoParsedRow } from '../reports/relacao/parser';
import { toPdfCompanyInfo } from './companyInfo';
import { formatCurrencyBRL, formatDateBR, formatPercent } from './format';
import type {
  PrevisaoConsolidatedBranchSection,
  PrevisaoConsolidatedPdfViewModel,
  PrevisaoPdfRow,
  PrevisaoPdfSection,
  RelacaoConsolidatedBranchSection,
  RelacaoConsolidatedPdfViewModel,
  RelacaoPdfRow
} from './types';

const UNCLASSIFIED_LABEL = '(sem classificação)';

export function buildPrevisaoConsolidatedViewModel(
  consolidated: ConsolidatedSellerGroup<PrevisaoParsedRow>,
  lookupCompanyProfile: (branchCode: string) => CompanyProfile | null,
  generatedAt: Date
): PrevisaoConsolidatedPdfViewModel {
  const branches: PrevisaoConsolidatedBranchSection[] = consolidated.branches.map((branch) => {
    const company = lookupCompanyProfile(branch.branchCode) as CompanyProfile;
    return {
      branchCode: branch.branchCode,
      branchName: branch.branchName || company.displayName,
      company: toPdfCompanyInfo(company),
      sections: groupByClassification(branch.rows),
      rowCount: branch.rows.length,
      subtotal: formatCurrencyBRL(branch.total)
    };
  });

  return {
    identity: {
      mode: 'Previsao',
      sellerCode: consolidated.sellerCode,
      sellerName: consolidated.sellerName,
      branchCodes: consolidated.branches.map((branch) => branch.branchCode),
      generatedAt
    },
    branches,
    rowCount: consolidated.rowCount,
    total: formatCurrencyBRL(consolidated.total)
  };
}

export function buildRelacaoConsolidatedViewModel(
  consolidated: ConsolidatedSellerGroup<RelacaoParsedRow>,
  lookupCompanyProfile: (branchCode: string) => CompanyProfile | null,
  generatedAt: Date
): RelacaoConsolidatedPdfViewModel {
  const branches: RelacaoConsolidatedBranchSection[] = consolidated.branches.map((branch) => {
    const company = lookupCompanyProfile(branch.branchCode) as CompanyProfile;
    return {
      branchCode: branch.branchCode,
      branchName: branch.branchName || company.displayName,
      company: toPdfCompanyInfo(company),
      rows: branch.rows.map(toRelacaoPdfRow),
      rowCount: branch.rows.length,
      subtotal: formatCurrencyBRL(branch.total)
    };
  });

  return {
    identity: {
      mode: 'Relacao',
      sellerCode: consolidated.sellerCode,
      sellerName: consolidated.sellerName,
      branchCodes: consolidated.branches.map((branch) => branch.branchCode),
      generatedAt
    },
    branches,
    rowCount: consolidated.rowCount,
    total: formatCurrencyBRL(consolidated.total)
  };
}

function groupByClassification(rows: readonly PrevisaoParsedRow[]): PrevisaoPdfSection[] {
  const order: string[] = [];
  const byClassification = new Map<string, PrevisaoParsedRow[]>();

  for (const row of rows) {
    const key = row.classificacao || UNCLASSIFIED_LABEL;
    if (!byClassification.has(key)) {
      byClassification.set(key, []);
      order.push(key);
    }
    byClassification.get(key)?.push(row);
  }

  return order.map((classificacao) => ({
    classificacao,
    rows: (byClassification.get(classificacao) ?? []).map(toPrevisaoPdfRow)
  }));
}

function toPrevisaoPdfRow(row: PrevisaoParsedRow): PrevisaoPdfRow {
  return {
    documento: formatDocumento(row),
    cliente: row.dadosCliente ?? '-',
    emissao: formatDateBR(row.emissaoPedidoTitulo),
    vencimento: formatDateBR(row.vencimento),
    dataDaBaixa: formatDateBR(row.dtBaixa),
    baseParaBaixa: formatCurrencyBRL(row.valorBaseParaBaixa),
    comissao: formatCurrencyBRL(row.comissaoTotalLiquido)
  };
}

function formatDocumento(row: PrevisaoParsedRow): string {
  const parts = [row.dadosTitulo, row.dadosPedido].filter((value): value is string => value !== null && value !== '');
  return parts.length > 0 ? parts.join(' / ') : '-';
}

function toRelacaoPdfRow(row: RelacaoParsedRow): RelacaoPdfRow {
  return {
    pedido: row.numeroDoPedido ?? '-',
    titulo: formatTitulo(row),
    cliente: row.nomeDoCliente ?? '-',
    dataDaBaixa: formatDateBR(row.dataDeBaixaDoTitulo),
    baseDaComissao: formatCurrencyBRL(row.valorBaseDaComissao),
    percentComissao: formatPercent(row.percentComissaoSobreVlBase),
    valorDaComissao: formatCurrencyBRL(row.valorDaComissao)
  };
}

function formatTitulo(row: RelacaoParsedRow): string {
  const parts = [row.prefixo, row.numeroDoTituloOriginal].filter(
    (value): value is string => value !== null && value !== ''
  );
  const base = parts.join('-');
  const parcela = row.parcela && row.parcela.trim() !== '' ? row.parcela.trim() : null;
  if (base === '' && !parcela) return '-';
  return parcela ? `${base}-${parcela}` : base;
}
