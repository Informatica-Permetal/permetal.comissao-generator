import { escapeHtml } from '../format';
import type { PrevisaoPdfViewModel } from '../types';
import { BASE_CSS } from './baseCss';
import {
  buildDocumentHeaderHtml,
  buildIdentityHtml,
  buildSignatureBlockHtml,
  buildTitleHtml,
  buildTotalBlockHtml
} from './layout';

interface ColumnDefinition {
  key: string;
  label: string;
  numeric?: boolean;
}

const COLUMNS: readonly ColumnDefinition[] = [
  { key: 'documento', label: 'Documento' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'emissao', label: 'Emissao' },
  { key: 'vencimento', label: 'Vencimento' },
  { key: 'dataDaBaixa', label: 'Data da Baixa' },
  { key: 'baseParaBaixa', label: 'Base para Baixa', numeric: true },
  { key: 'comissao', label: 'Comissao', numeric: true }
];

export function buildPrevisaoHtmlDocument(vm: PrevisaoPdfViewModel, generatedAtLabel: string): string {
  const rowsHtml = vm.sections
    .map((section) => {
      const sectionRow = `<tr class="section-row"><td colspan="${COLUMNS.length}">${escapeHtml(section.classificacao)}</td></tr>`;
      const dataRows = section.rows
        .map(
          (row) => `
            <tr class="data-row">
              <td>${escapeHtml(row.documento)}</td>
              <td>${escapeHtml(row.cliente)}</td>
              <td>${escapeHtml(row.emissao)}</td>
              <td>${escapeHtml(row.vencimento)}</td>
              <td>${escapeHtml(row.dataDaBaixa)}</td>
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
    <title>Previsao de Comissoes</title>
    <style>${BASE_CSS}</style>
  </head>
  <body>
    ${buildDocumentHeaderHtml(vm.company, generatedAtLabel)}
    ${buildTitleHtml('Previsao de Comissoes', 'Relatorio de previsao para conferencia')}
    ${buildIdentityHtml(vm.identity)}
    <table>
      <thead>
        <tr>
          ${COLUMNS.map((c) => `<th${c.numeric ? ' class="num"' : ''}>${escapeHtml(c.label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    ${buildTotalBlockHtml('Total da Previsao', vm.total)}
    ${buildSignatureBlockHtml()}
  </body>
</html>`;
}
