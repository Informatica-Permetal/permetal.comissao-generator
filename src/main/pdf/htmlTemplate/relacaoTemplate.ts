import { escapeHtml } from '../format';
import type { RelacaoPdfViewModel } from '../types';
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
  { key: 'pedido', label: 'Pedido' },
  { key: 'titulo', label: 'Titulo' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'dataDaBaixa', label: 'Data da Baixa' },
  { key: 'baseDaComissao', label: 'Base da Comissao', numeric: true },
  { key: 'percentComissao', label: '% Comissao', numeric: true },
  { key: 'valorDaComissao', label: 'Valor da Comissao', numeric: true }
];

export function buildRelacaoHtmlDocument(vm: RelacaoPdfViewModel, generatedAtLabel: string): string {
  const rowsHtml = vm.rows
    .map(
      (row) => `
        <tr class="data-row">
          <td>${escapeHtml(row.pedido)}</td>
          <td>${escapeHtml(row.titulo)}</td>
          <td>${escapeHtml(row.cliente)}</td>
          <td>${escapeHtml(row.dataDaBaixa)}</td>
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
    ${buildDocumentHeaderHtml(vm.company, generatedAtLabel)}
    ${buildTitleHtml('Relacao de Comissoes', 'Comissoes para conferencia e pagamento')}
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
    ${buildTotalBlockHtml('Total da Comissao', vm.total)}
    ${buildSignatureBlockHtml()}
  </body>
</html>`;
}
