import { escapeHtml } from '../format';
import type { PrevisaoConsolidatedPdfViewModel, RelacaoConsolidatedPdfViewModel } from '../types';
import { BASE_CSS } from './baseCss';
import {
  buildBranchSectionHeadingHtml,
  buildConsolidatedMetaHtml,
  buildDocumentHeaderHtml,
  buildSignatureBlockHtml,
  buildSubtotalBlockHtml,
  buildTitleHtml,
  buildTotalBlockHtml
} from './layout';

/**
 * Consolidated PDFs (Fase 5: one document per seller spanning several
 * branches) are deliberately NOT a polished redesign yet - visual finishing
 * is an explicitly deferred future phase. This renders each included
 * branch as its own letterhead + table + subtotal section, back to back in
 * one document, followed by a single grand total. Correct and complete,
 * not decorated.
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
  generatedAtLabel: string
): string {
  const firstCompany = vm.branches[0].company;
  const branchesHtml = vm.branches
    .map((branch) => {
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

      return `
        <section class="branch-section">
          ${buildBranchSectionHeadingHtml(branch.branchCode, branch.branchName)}
          <table>
            <colgroup>
              ${PREVISAO_COLUMNS.map((c) => `<col style="width:${c.width}" />`).join('')}
            </colgroup>
            <thead>
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
    ${buildDocumentHeaderHtml(firstCompany)}
    ${buildTitleHtml('Previsão de Comissões - Consolidado por Vendedor', 'Relatório de previsão para conferência')}
    ${buildConsolidatedMetaHtml(vm.identity, generatedAtLabel)}
    ${branchesHtml}
    ${buildTotalBlockHtml('Total Consolidado da Previsão', vm.total)}
    ${buildSignatureBlockHtml()}
  </body>
</html>`;
}

export function buildRelacaoConsolidatedHtmlDocument(
  vm: RelacaoConsolidatedPdfViewModel,
  generatedAtLabel: string
): string {
  const firstCompany = vm.branches[0].company;
  const branchesHtml = vm.branches
    .map((branch) => {
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

      return `
        <section class="branch-section">
          ${buildBranchSectionHeadingHtml(branch.branchCode, branch.branchName)}
          <table>
            <colgroup>
              ${RELACAO_COLUMNS.map((c) => `<col style="width:${c.width}" />`).join('')}
            </colgroup>
            <thead>
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
    ${buildDocumentHeaderHtml(firstCompany)}
    ${buildTitleHtml('Relação de Comissões - Consolidado por Vendedor', 'Comissões para conferência e pagamento')}
    ${buildConsolidatedMetaHtml(vm.identity, generatedAtLabel)}
    ${branchesHtml}
    ${buildTotalBlockHtml('Total Consolidado da Comissão', vm.total)}
    ${buildSignatureBlockHtml()}
  </body>
</html>`;
}
