import type { CompanyProfile } from '@shared/types/companyProfile';
import type { DocumentGroup } from '../reports/common/grouping';
import type { RelacaoParsedRow } from '../reports/relacao/parser';
import { toPdfCompanyInfo } from './companyInfo';
import { formatCurrencyBRL, formatDateBR, formatPercent } from './format';
import type { RelacaoPdfRow, RelacaoPdfViewModel } from './types';

export function buildRelacaoViewModel(
  group: DocumentGroup<RelacaoParsedRow>,
  company: CompanyProfile,
  generatedAt: Date
): RelacaoPdfViewModel {
  return {
    identity: {
      mode: 'Relacao',
      sellerCode: group.sellerCode,
      sellerName: group.sellerName,
      branchCode: group.branchCode,
      branchName: company.displayName,
      generatedAt
    },
    company: toPdfCompanyInfo(company),
    rows: group.rows.map(toRelacaoPdfRow),
    rowCount: group.rows.length,
    total: formatCurrencyBRL(group.total)
  };
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
