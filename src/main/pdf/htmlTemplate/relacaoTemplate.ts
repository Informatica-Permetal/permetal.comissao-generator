import { escapeHtml } from '../format';
import type { RelacaoPdfViewModel } from '../types';
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
  { key: 'pedido', label: 'Pedido', width: '11%' },
  { key: 'titulo', label: 'Titulo', width: '16%' },
  { key: 'cliente', label: 'Cliente', width: '29%' },
  { key: 'dataDaBaixa', label: 'Data da Baixa', width: '11%' },
  { key: 'baseDaComissao', label: 'Base da Comissao', width: '14%', numeric: true },
  { key: 'percentComissao', label: '% Comissao', width: '9%', numeric: true },
  { key: 'valorDaComissao', label: 'Valor da Comissao', width: '15%', numeric: true }
];

export function buildRelacaoHtmlDocument(vm: RelacaoPdfViewModel, generatedAtLabel: string): string {
  const rowsHtml = vm.rows
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

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Relacao de Comissoes</title>
    <style>${BASE_CSS}</style>
  </head>
  <body>
    ${buildDocumentHeaderHtml(vm.company)}
    ${buildTitleHtml('Relacao de Comissoes', 'Comissoes para conferencia e pagamento')}
    ${buildDocumentMetaHtml(vm.identity, generatedAtLabel)}
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
    ${buildTotalBlockHtml('Total da Comissao', vm.total)}
    ${buildSignatureBlockHtml()}
  </body>
</html>`;
}
