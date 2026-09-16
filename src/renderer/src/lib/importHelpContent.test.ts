import { describe, expect, it } from 'vitest';
import { formatFieldListForCopy, IMPORT_HELP_CONTENT } from './importHelpContent';

describe('IMPORT_HELP_CONTENT - Relacao', () => {
  const content = IMPORT_HELP_CONTENT.Relacao;

  it('lista exatamente os 12 campos obrigatorios, sem duplicatas', () => {
    expect(content.fields).toHaveLength(12);
    expect(content.requiredFieldCount).toBe(12);
    expect(new Set(content.fields).size).toBe(content.fields.length);
  });

  it('usa os nomes exatos do Protheus (sem acento, como no export real)', () => {
    expect(content.fields).toEqual([
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
    ]);
  });

  it('traz codigo e caminho corretos do relatorio no Protheus', () => {
    expect(content.code).toBe('FATSV019');
    expect(content.path.join(' > ')).toBe('Módulo Faturamento > Consultas > SmartView > Comissões > Comissões');
  });

  it('nao tem aviso de ambiguidade (isso e exclusivo da Previsao)', () => {
    expect(content.warning).toBeUndefined();
  });

  it('documenta os 3 campos opcionais e a regra do total', () => {
    const allNotes = content.notes.join(' ');
    expect(allNotes).toContain('Tipo de Registro');
    expect(allNotes).toContain('Data do Pgto da Comissao');
    expect(allNotes).toContain('Comissao gerada pela B/E');
    expect(allNotes).toContain('Valor da Comissao');
  });
});

describe('IMPORT_HELP_CONTENT - Previsao', () => {
  const content = IMPORT_HELP_CONTENT.Previsao;

  it('lista exatamente os 13 campos obrigatorios, sem duplicatas', () => {
    expect(content.fields).toHaveLength(13);
    expect(content.requiredFieldCount).toBe(13);
    expect(new Set(content.fields).size).toBe(content.fields.length);
  });

  it('usa os nomes exatos do Protheus (com acento, como no export real)', () => {
    expect(content.fields).toEqual([
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
    ]);
  });

  it('traz codigo e caminho corretos do relatorio no Protheus', () => {
    expect(content.code).toBe('FINSV047');
    expect(content.path.join(' > ')).toBe('Módulo Financeiro > Consultas > SmartView > Comissão > Previsão de Comissões');
  });

  it('destaca o aviso de ambiguidade do Vencimento, orientando o segundo campo', () => {
    expect(content.warning).toBeDefined();
    expect(content.warning).toContain('dois campos');
    expect(content.warning).toContain('Vencimento');
    expect(content.warning).toContain('SEGUNDO');
  });

  it('documenta que o total usa somente Comissao total (liquido)', () => {
    const allNotes = content.notes.join(' ');
    expect(allNotes).toContain('Comissão total (líquido)');
    expect(allNotes).toContain('Valor total de comissão');
    expect(allNotes).toContain('Valor IRRF');
  });
});

describe('formatFieldListForCopy', () => {
  it('numera cada campo em uma linha, na ordem original', () => {
    const text = formatFieldListForCopy(IMPORT_HELP_CONTENT.Relacao);
    const lines = text.split('\n');
    expect(lines).toHaveLength(12);
    expect(lines[0]).toBe('1. Filial do Sistema');
    expect(lines[11]).toBe('12. Valor da Comissao');
  });
});
