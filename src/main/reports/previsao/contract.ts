import type { FieldDefinition } from '../common/contractValidation';

export const PREVISAO_FIELDS: readonly FieldDefinition[] = [
  { key: 'dadosCliente', canonicalHeader: 'Dados do cliente' },
  { key: 'dadosTitulo', canonicalHeader: 'Dados do titulo' },
  { key: 'dadosPedido', canonicalHeader: 'Dados do pedido' },
  { key: 'emissaoPedidoTitulo', canonicalHeader: 'Emissao pedido/titulo' },
  { key: 'vencimento', canonicalHeader: 'Vencimento' },
  { key: 'valorBaseParaBaixa', canonicalHeader: 'Valor base para baixa' },
  { key: 'valorTotalComissao', canonicalHeader: 'Valor total de comissao' },
  { key: 'dtBaixa', canonicalHeader: 'DT Baixa' },
  { key: 'valorIrrf', canonicalHeader: 'Valor IRRF' },
  { key: 'comissaoTotalLiquido', canonicalHeader: 'Comissao total (liquido)' },
  { key: 'dadosVendedor', canonicalHeader: 'Dados do vendedor' },
  { key: 'classificacao', canonicalHeader: 'Classificacao' },
  { key: 'nomeDaFilial', canonicalHeader: 'Nome da filial' }
] as const;

/** The single field summed for the Previsao document total. Never change this. */
export const PREVISAO_TOTAL_FIELD_KEY = 'comissaoTotalLiquido';

export const KNOWN_PREVISAO_CLASSIFICATIONS = ['Titulo original', 'Pedido de venda'] as const;

/** Headers that only appear in a Relacao workbook - used to detect a wrong-mode upload. */
export const RELACAO_MARKERS = ['Filial do Sistema', 'Codigo do Vendedor', 'Valor da Comissao'] as const;
