import type { ReportMode } from '@shared/constants/folders';

export interface ImportHelpContent {
  modeTitle: string;
  reportName: string;
  code: string;
  /** Navigation path inside Protheus, one menu level per entry. */
  path: string[];
  requiredFieldCount: number;
  /** Exact Protheus/Smart View column names - never accent-corrected, must match the real export. */
  fields: string[];
  /** Highlighted, mode-specific warning (currently only Previsao's duplicate-Vencimento quirk). */
  warning?: string;
  notes: string[];
}

/**
 * Static, offline reference for what each Smart View export must contain.
 * Content matches `.claude/skills/formatador-comissao/references/input-contracts.md`
 * (the v2 contract) - keep both in sync if the contract ever changes again.
 */
export const IMPORT_HELP_CONTENT: Record<ReportMode, ImportHelpContent> = {
  Relacao: {
    modeTitle: 'Relação de Comissões',
    reportName: 'Relação de Comissão',
    code: 'FATSV019',
    path: ['Módulo Faturamento', 'Consultas', 'SmartView', 'Comissões', 'Comissões'],
    requiredFieldCount: 12,
    fields: [
      'Filial do Sistema',
      'Codigo do Vendedor',
      'Nome do Vendedor',
      'Prefixo',
      'Numero do Titulo Original',
      'Parcela',
      'Nome do cliente',
      'Data de Baixa do Titulo',
      'Numero do Pedido',
      'Valor Base da Comissao',
      '% Comissao sobre Vl.Base',
      'Valor da Comissao'
    ],
    notes: [
      '"Tipo de Registro", "Data do Pgto da Comissao" e "Comissao gerada pela B/E" não são obrigatórios - podem vir ou não no arquivo.',
      'O total do documento usa somente o campo "Valor da Comissao".'
    ]
  },
  Previsao: {
    modeTitle: 'Previsão de Comissões',
    reportName: 'Previsão de Comissões',
    code: 'FINSV047',
    path: ['Módulo Financeiro', 'Consultas', 'SmartView', 'Comissão', 'Previsão de Comissões'],
    requiredFieldCount: 13,
    fields: [
      'Nome da filial',
      'Dados do vendedor',
      'Classificação',
      'Dados do cliente',
      'Dados do título',
      'Dados do pedido',
      'Emissão pedido/título',
      'Vencimento',
      'DT Baixa',
      'Valor base para baixa',
      'Valor total de comissão',
      'Valor IRRF',
      'Comissão total (líquido)'
    ],
    warning:
      'ATENÇÃO: o Smart View apresenta dois campos chamados "Vencimento". Para o Formatador Comissão, selecione o SEGUNDO Vencimento, o que aparece mais abaixo na lista.',
    notes: [
      'O total do documento usa somente o campo "Comissão total (líquido)".',
      '"Valor total de comissão" e "Valor IRRF" são apenas dados do Protheus, exibidos para conferência - nunca usados para calcular o total.'
    ]
  }
};

export function formatFieldListForCopy(content: ImportHelpContent): string {
  return content.fields.map((field, index) => `${index + 1}. ${field}`).join('\n');
}
