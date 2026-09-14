import type { CompanyProfile } from '@shared/types/companyProfile';
import type { DocumentGroup } from '../reports/common/grouping';
import type { PrevisaoParsedRow } from '../reports/previsao/parser';
import { toPdfCompanyInfo } from './companyInfo';
import { formatCurrencyBRL, formatDateBR } from './format';
import type { PrevisaoPdfRow, PrevisaoPdfSection, PrevisaoPdfViewModel } from './types';

const UNCLASSIFIED_LABEL = '(sem classificacao)';

export function buildPrevisaoViewModel(
  group: DocumentGroup<PrevisaoParsedRow>,
  company: CompanyProfile,
  generatedAt: Date
): PrevisaoPdfViewModel {
  return {
    identity: {
      mode: 'Previsao',
      sellerCode: group.sellerCode,
      sellerName: group.sellerName,
      branchCode: group.branchCode,
      branchName: group.branchName || company.displayName,
      generatedAt
    },
    company: toPdfCompanyInfo(company),
    sections: groupByClassification(group.rows),
    rowCount: group.rows.length,
    total: formatCurrencyBRL(group.total)
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
  const parts = [row.dadosTitulo, row.dadosPedido].filter(
    (value): value is string => value !== null && value !== ''
  );
  return parts.length > 0 ? parts.join(' / ') : '-';
}
