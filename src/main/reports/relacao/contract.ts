import type { FieldDefinition } from '../common/contractValidation';

export const RELACAO_FIELDS: readonly FieldDefinition[] = [
  { key: 'filialDoSistema', canonicalHeader: 'Filial do Sistema' },
  { key: 'codigoDoVendedor', canonicalHeader: 'Codigo do Vendedor' },
  { key: 'nomeDoVendedor', canonicalHeader: 'Nome do Vendedor' },
  { key: 'prefixo', canonicalHeader: 'Prefixo' },
  { key: 'numeroDoTituloOriginal', canonicalHeader: 'Numero do Titulo Original' },
  { key: 'parcela', canonicalHeader: 'Parcela' },
  { key: 'nomeDoCliente', canonicalHeader: 'Nome do cliente' },
  { key: 'dataDeBaixaDoTitulo', canonicalHeader: 'Data de Baixa do Titulo' },
  { key: 'numeroDoPedido', canonicalHeader: 'Numero do Pedido' },
  { key: 'valorBaseDaComissao', canonicalHeader: 'Valor Base da Comissao' },
  { key: 'percentComissaoSobreVlBase', canonicalHeader: '% Comissao sobre Vl.Base' },
  { key: 'valorDaComissao', canonicalHeader: 'Valor da Comissao' }
] as const;

/**
 * No longer required for import to succeed (v2 contract). Still read and
 * used for their existing audit/warning behavior when present; simply absent
 * from the parsed row (never an error, never a warning) when the column is
 * missing from the workbook.
 */
export const RELACAO_OPTIONAL_FIELDS: readonly FieldDefinition[] = [
  { key: 'tipoDeRegistro', canonicalHeader: 'Tipo de Registro' },
  { key: 'dataDoPgtoDaComissao', canonicalHeader: 'Data do Pgto da Comissao' },
  { key: 'comissaoGeradaPelaBE', canonicalHeader: 'Comissao gerada pela B/E' }
] as const;

/** The single field summed for the Relacao document total. Never change this. */
export const RELACAO_TOTAL_FIELD_KEY = 'valorDaComissao';

export const EXPECTED_TIPO_DE_REGISTRO = 'Comissao';
export const EXPECTED_ORIGEM_BE = 'Baixa';

/** Headers that only appear in a Previsao workbook - used to detect a wrong-mode upload. */
export const PREVISAO_MARKERS = ['Dados do vendedor', 'Classificacao', 'Comissao total (liquido)'] as const;
