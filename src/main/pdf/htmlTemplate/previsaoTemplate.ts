import { escapeHtml } from '../format';
import type { PrevisaoPdfViewModel } from '../types';
import { BASE_CSS } from './baseCss';
import {
  buildDocumentHeaderHtml,
  buildDocumentMetaHtml,
  buildSignatureBlockHtml,
  buildTitleHtml,
  buildTotalBlockHtml
} from './layout';

interface ColumnDefinition {
  key: string;
  label: string;
  width: string;
  numeric?: boolean;
}

const COLUMNS: readonly ColumnDefinition[] = [
  { key: 'documento', label: 'Documento', width: '17%' },
  { key: 'cliente', label: 'Cliente', width: '31%' },
  { key: 'emissao', label: 'Emissão', width: '9%' },
  { key: 'vencimento', label: 'Vencimento', width: '9%' },
  { key: 'dataDaBaixa', label: 'Data da Baixa', width: '9%' },
  { key: 'baseParaBaixa', label: 'Base para Baixa', width: '13%', numeric: true },
  { key: 'comissao', label: 'Comissão', width: '12%', numeric: true }
];

export function buildPrevisaoHtmlDocument(
  vm: PrevisaoPdfViewModel,
  generatedAtLabel: string,
  motifDataUri: string | null = null
): string {
  const rowsHtml = vm.sections
    .map((section) => {
      const sectionRow = `<tr class="section-row"><td colspan="${COLUMNS.length}">${escapeHtml(section.classificacao)}</td></tr>`;
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

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Previsão de Comissões</title>
    <style>${BASE_CSS}</style>
  </head>
  <body>
    ${buildDocumentHeaderHtml(vm.company, motifDataUri)}
    ${buildTitleHtml('Previsão de Comissões', 'Relatório de previsão para conferência')}
    ${buildDocumentMetaHtml(vm.identity, vm.company, generatedAtLabel)}
    <table>
      <colgroup>
        ${COLUMNS.map((c) => `<col style="width:${c.width}" />`).join('')}
      </colgroup>
      <thead>
        <tr>
          ${COLUMNS.map((c) => `<th${c.numeric ? ' class="num"' : ''}>${escapeHtml(c.label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    ${buildTotalBlockHtml('Total da Previsão', vm.total)}
    ${buildSignatureBlockHtml(motifDataUri)}
  </body>
</html>`;
}
