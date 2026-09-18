import { escapeHtml } from '../format';
import type { PrevisaoConsolidatedPdfViewModel, RelacaoConsolidatedPdfViewModel } from '../types';
import { BASE_CSS } from './baseCss';
import {
  buildBranchDividerHtml,
  buildBranchTableContextRowHtml,
  buildConsolidatedCoverHtml,
  buildConsolidatedMetaHtml,
  buildDocumentHeaderHtml,
  buildSignatureBlockHtml,
  buildSubtotalBlockHtml,
  buildTotalBlockHtml
} from './layout';

/**
 * Consolidated PDF - one document per seller spanning several branches.
 * Deliberately does NOT use any one branch as the document's global
 * identity: the top block carries only seller/moeda/período/data, and each
 * included branch gets its own full institutional section (own letterhead,
 * own table, own optional subtotal), in stable (first-appearance) order. A
 * single grand total and a single signature block close the document -
 * never one per branch.
 */

interface PrevisaoColumnDefinition {
  key: string;
  label: string;
  width: string;
  numeric?: boolean;
}

const PREVISAO_COLUMNS: readonly PrevisaoColumnDefinition[] = [
  { key: 'documento', label: 'Documento', width: '17%' },
  { key: 'cliente', label: 'Cliente', width: '31%' },
  { key: 'emissao', label: 'Emissão', width: '9%' },
  { key: 'vencimento', label: 'Vencimento', width: '9%' },
  { key: 'dataDaBaixa', label: 'Data da Baixa', width: '9%' },
  { key: 'baseParaBaixa', label: 'Base para Baixa', width: '13%', numeric: true },
  { key: 'comissao', label: 'Comissão', width: '12%', numeric: true }
];

const RELACAO_COLUMNS: readonly PrevisaoColumnDefinition[] = [
  { key: 'pedido', label: 'Pedido', width: '11%' },
  { key: 'titulo', label: 'Título', width: '16%' },
  { key: 'cliente', label: 'Cliente', width: '29%' },
  { key: 'dataDaBaixa', label: 'Data da Baixa', width: '11%' },
  { key: 'baseDaComissao', label: 'Base da Comissão', width: '14%', numeric: true },
  { key: 'percentComissao', label: '% Comissão', width: '9%', numeric: true },
  { key: 'valorDaComissao', label: 'Valor da Comissão', width: '15%', numeric: true }
];

export function buildPrevisaoConsolidatedHtmlDocument(
  vm: PrevisaoConsolidatedPdfViewModel,
  generatedAtLabel: string,
  motifDataUri: string | null = null
): string {
  const branchesHtml = vm.branches
    .map((branch, index) => {
      const rowsHtml = branch.sections
        .map((section) => {
          const sectionRow = `<tr class="section-row"><td colspan="${PREVISAO_COLUMNS.length}">${escapeHtml(section.classificacao)}</td></tr>`;
          const dataRows = section.rows
            .map(
              (row) => `
                <tr class="data-row">
                  <td>${escapeHtml(row.documento)}</td>
                  <td>${escapeHtml(row.cliente)}</td>
                  <td class="nowrap">${escapeHtml(row.emissao)}</td>
                  <td class="nowrap">${escapeHtml(row.vencimento)}</td>
                  <td class="nowrap">${escapeHtml(row.dataDaBaixa)}</td>
                  <td class="num">${escapeHtml(row.baseParaBaixa)}</td>
                  <td class="num">${escapeHtml(row.comissao)}</td>
                </tr>
              `
            )
            .join('');
          return sectionRow + dataRows;
        })
        .join('');

      const divider = index > 0 ? buildBranchDividerHtml(motifDataUri) : '';

      return `
        ${divider}
        <section class="branch-section">
          ${buildDocumentHeaderHtml(branch.company, motifDataUri)}
          <table>
            <colgroup>
              ${PREVISAO_COLUMNS.map((c) => `<col style="width:${c.width}" />`).join('')}
            </colgroup>
            <thead>
              ${buildBranchTableContextRowHtml(branch.branchCode, branch.branchName, PREVISAO_COLUMNS.length)}
              <tr>
                ${PREVISAO_COLUMNS.map((c) => `<th${c.numeric ? ' class="num"' : ''}>${escapeHtml(c.label)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          ${buildSubtotalBlockHtml(`Subtotal - Filial ${branch.branchCode}`, branch.subtotal)}
        </section>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Previsão de Comissões (Consolidado)</title>
    <style>${BASE_CSS}</style>
  </head>
  <body>
    ${buildConsolidatedCoverHtml('Previsão de Comissões — Consolidado por Vendedor', 'Relatório de previsão para conferência', motifDataUri)}
    ${buildConsolidatedMetaHtml(vm.identity, generatedAtLabel)}
    ${branchesHtml}
    ${buildTotalBlockHtml('Total da Previsão', vm.total)}
    ${buildSignatureBlockHtml(motifDataUri)}
  </body>
</html>`;
}

export function buildRelacaoConsolidatedHtmlDocument(
  vm: RelacaoConsolidatedPdfViewModel,
  generatedAtLabel: string,
  motifDataUri: string | null = null
): string {
  const branchesHtml = vm.branches
    .map((branch, index) => {
      const rowsHtml = branch.rows
        .map(
          (row) => `
            <tr class="data-row">
              <td class="nowrap">${escapeHtml(row.pedido)}</td>
              <td>${escapeHtml(row.titulo)}</td>
              <td>${escapeHtml(row.cliente)}</td>
              <td class="nowrap">${escapeHtml(row.dataDaBaixa)}</td>
              <td class="num">${escapeHtml(row.baseDaComissao)}</td>
              <td class="num">${escapeHtml(row.percentComissao)}</td>
              <td class="num">${escapeHtml(row.valorDaComissao)}</td>
            </tr>
          `
        )
        .join('');

      const divider = index > 0 ? buildBranchDividerHtml(motifDataUri) : '';

      return `
        ${divider}
        <section class="branch-section">
          ${buildDocumentHeaderHtml(branch.company, motifDataUri)}
          <table>
            <colgroup>
              ${RELACAO_COLUMNS.map((c) => `<col style="width:${c.width}" />`).join('')}
            </colgroup>
            <thead>
              ${buildBranchTableContextRowHtml(branch.branchCode, branch.branchName, RELACAO_COLUMNS.length)}
              <tr>
                ${RELACAO_COLUMNS.map((c) => `<th${c.numeric ? ' class="num"' : ''}>${escapeHtml(c.label)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          ${buildSubtotalBlockHtml(`Subtotal - Filial ${branch.branchCode}`, branch.subtotal)}
        </section>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Relação de Comissões (Consolidado)</title>
    <style>${BASE_CSS}</style>
  </head>
  <body>
    ${buildConsolidatedCoverHtml('Relação de Comissões — Consolidado por Vendedor', 'Comissões para conferência e pagamento', motifDataUri)}
    ${buildConsolidatedMetaHtml(vm.identity, generatedAtLabel)}
    ${branchesHtml}
    ${buildTotalBlockHtml('Total da Comissão', vm.total)}
    ${buildSignatureBlockHtml(motifDataUri)}
  </body>
</html>`;
}
