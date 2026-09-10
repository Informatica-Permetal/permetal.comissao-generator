import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MissingHeadersError, WrongModeError } from '../common/errors';
import { createFixtureDir, removeFixtureDir, writeFixtureWorkbook } from '../testSupport/xlsxFixtures';
import { parsePrevisaoFile } from './parser';

const HEADERS = [
  'Dados do cliente',
  'Dados do titulo',
  'Dados do pedido',
  'Emissao pedido/titulo',
  'Vencimento',
  'Valor base para baixa',
  'Valor total de comissao',
  'DT Baixa',
  'Valor IRRF',
  'Comissao total (liquido)',
  'Dados do vendedor',
  'Classificacao',
  'Nome da filial'
];

function row(overrides: Partial<Record<(typeof HEADERS)[number], unknown>> = {}): unknown[] {
  const base: Record<string, unknown> = {
    'Dados do cliente': '999999/01 - CLIENTE SINTETICO LTDA',
    'Dados do titulo': '001-000099999--NF',
    'Dados do pedido': null,
    'Emissao pedido/titulo': '01/03/2026',
    Vencimento: '01/03/2026',
    'Valor base para baixa': '1.000,00',
    'Valor total de comissao': '150,00',
    'DT Baixa': '02/03/2026',
    'Valor IRRF': '10,00',
    'Comissao total (liquido)': '140,00',
    'Dados do vendedor': '000009 - VENDEDOR SINTETICO',
    Classificacao: 'Titulo original',
    'Nome da filial': '0199 - FILIAL SINTETICA'
  };
  return HEADERS.map((header) => (header in overrides ? overrides[header] : base[header]));
}

let dir: string;
beforeEach(() => {
  dir = createFixtureDir('fc-previsao-');
});
afterEach(() => {
  removeFixtureDir(dir);
});

describe('parsePrevisaoFile - caminho feliz', () => {
  it('parseia uma linha valida e soma somente Comissao total (liquido)', async () => {
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [row()]);
    const result = await parsePrevisaoFile(path);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].comissaoTotalLiquido?.toString()).toBe('140');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].total.toString()).toBe('140');
    expect(result.groups[0].branchCode).toBe('0199');
    expect(result.groups[0].sellerCode).toBe('000009');
  });

  it('nunca deriva o total de base x percentual - usa somente o campo autoritativo', async () => {
    // valorBaseParaBaixa * (qualquer percentual plausivel) nunca poderia dar 1 -
    // se o total mudar de "1" para outra coisa, alguem introduziu uma formula de comissao.
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [
      row({ 'Valor base para baixa': '1.000,00', 'Valor total de comissao': '999,00', 'Comissao total (liquido)': '1,00' })
    ]);
    const result = await parsePrevisaoFile(path);
    expect(result.groups[0].total.toString()).toBe('1');
  });
});

describe('parsePrevisaoFile - colunas reordenadas', () => {
  it('nao depende da ordem das colunas', async () => {
    const baseRow = row();
    const shuffledHeaders = [...HEADERS].reverse();
    const shuffledRow = shuffledHeaders.map((header) => baseRow[HEADERS.indexOf(header)]);
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', shuffledHeaders, [shuffledRow]);
    const result = await parsePrevisaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].comissaoTotalLiquido?.toString()).toBe('140');
    expect(result.rows[0].filialCodigo).toBe('0199');
  });
});

describe('parsePrevisaoFile - cabecalhos com espacos', () => {
  it('tolera espacos extras e NBSP nos cabecalhos', async () => {
    const spacedHeaders = HEADERS.map((h) => `  ${h}   `);
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', spacedHeaders, [row()]);
    const result = await parsePrevisaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].comissaoTotalLiquido?.toString()).toBe('140');
  });
});

describe('parsePrevisaoFile - zeros a esquerda', () => {
  it('preserva zeros a esquerda em codigo de vendedor e filial', async () => {
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [
      row({ 'Dados do vendedor': '000042 - VENDEDOR ZERO', 'Nome da filial': '0007 - FILIAL ZERO' })
    ]);
    const result = await parsePrevisaoFile(path);
    expect(result.rows[0].vendedorCodigo).toBe('000042');
    expect(result.rows[0].filialCodigo).toBe('0007');
  });
});

describe('parsePrevisaoFile - numeros brasileiros', () => {
  it('converte formatos brasileiros corretamente, inclusive alta precisao', async () => {
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [
      row({ 'Valor base para baixa': '109.360', 'Comissao total (liquido)': '7,93129527965909' })
    ]);
    const result = await parsePrevisaoFile(path);
    expect(result.rows[0].valorBaseParaBaixa?.toString()).toBe('109360');
    expect(result.rows[0].comissaoTotalLiquido?.toString()).toBe('7.93129527965909');
  });
});

describe('parsePrevisaoFile - valores em branco/zero/negativos', () => {
  it('linha com comissao em branco conta zero no total mas permanece na lista', async () => {
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [
      row({ 'Comissao total (liquido)': '' })
    ]);
    const result = await parsePrevisaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].comissaoTotalLiquido).toBeNull();
    expect(result.groups[0].total.toString()).toBe('0');
  });

  it('valor zero permanece como linha valida, nao e filtrado', async () => {
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [
      row({ 'Comissao total (liquido)': '0' })
    ]);
    const result = await parsePrevisaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].comissaoTotalLiquido?.toString()).toBe('0');
  });

  it('valor negativo reduz o total exatamente como exportado', async () => {
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [
      row({ 'Comissao total (liquido)': '200,00' }),
      row({ 'Comissao total (liquido)': '-50,00' })
    ]);
    const result = await parsePrevisaoFile(path);
    expect(result.groups[0].total.toString()).toBe('150');
  });
});

describe('parsePrevisaoFile - linha duplicada', () => {
  it('preserva integralmente linhas identicas - nunca deduplica', async () => {
    const identicalRow = row();
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [identicalRow, identicalRow]);
    const result = await parsePrevisaoFile(path);
    expect(result.rows).toHaveLength(2);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].rows).toHaveLength(2);
    expect(result.groups[0].total.toString()).toBe('280'); // 140 + 140, nunca 140
  });
});

describe('parsePrevisaoFile - varios vendedores', () => {
  it('agrupa vendedores diferentes na mesma filial em documentos separados', async () => {
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [
      row({ 'Dados do vendedor': '000001 - VENDEDOR UM', 'Comissao total (liquido)': '100,00' }),
      row({ 'Dados do vendedor': '000002 - VENDEDOR DOIS', 'Comissao total (liquido)': '200,00' })
    ]);
    const result = await parsePrevisaoFile(path);
    expect(result.groups).toHaveLength(2);
    const byCode = new Map(result.groups.map((g) => [g.sellerCode, g]));
    expect(byCode.get('000001')?.total.toString()).toBe('100');
    expect(byCode.get('000002')?.total.toString()).toBe('200');
  });
});

describe('parsePrevisaoFile - mesmo vendedor em duas filiais', () => {
  it('gera um grupo por filial mesmo para o mesmo codigo de vendedor', async () => {
    const path = await writeFixtureWorkbook(dir, 'previsao.xlsx', HEADERS, [
      row({ 'Nome da filial': '0103 - FILIAL A', 'Comissao total (liquido)': '10,00' }),
      row({ 'Nome da filial': '0104 - FILIAL B', 'Comissao total (liquido)': '20,00' })
    ]);
    const result = await parsePrevisaoFile(path);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.every((g) => g.sellerCode === '000009')).toBe(true);
    const byBranch = new Map(result.groups.map((g) => [g.branchCode, g]));
    expect(byBranch.get('0103')?.total.toString()).toBe('10');
    expect(byBranch.get('0104')?.total.toString()).toBe('20');
  });
});

describe('parsePrevisaoFile - arquivo do modo errado', () => {
  it('detecta um arquivo de Relacao enviado para o modo Previsao', async () => {
    const relacaoHeaders = [
      'Tipo de Registro',
      'Nome do Vendedor',
      'Filial do Sistema',
      'Codigo do Vendedor',
      'Prefixo',
      'Numero do Titulo Original',
      'Parcela',
      'Nome do cliente',
      'Data de Baixa do Titulo',
      'Data do Pgto da Comissao',
      'Numero do Pedido',
      'Valor Base da Comissao',
      '% Comissao sobre Vl.Base',
      'Valor da Comissao',
      'Comissao gerada pela B/E'
    ];
    const relacaoRow = [
      'Comissao',
      'VENDEDOR TESTE',
      '0103',
      '000009',
      '001',
      '000099999',
      '01',
      'CLIENTE TESTE',
      '01/03/2026',
      null,
      '029999',
      '1.000,00',
      '0,15',
      '150,00',
      'Baixa'
    ];
    const path = await writeFixtureWorkbook(dir, 'relacao-no-modo-previsao.xlsx', relacaoHeaders, [relacaoRow]);
    await expect(parsePrevisaoFile(path)).rejects.toBeInstanceOf(WrongModeError);
  });
});

describe('parsePrevisaoFile - coluna obrigatoria ausente', () => {
  it('reporta a coluna faltante em vez de falhar silenciosamente', async () => {
    const missingIndex = HEADERS.indexOf('Comissao total (liquido)');
    const headersMissingOne = HEADERS.filter((_, index) => index !== missingIndex);
    const rowMissingOne = row().filter((_, index) => index !== missingIndex);
    const path = await writeFixtureWorkbook(dir, 'previsao-sem-coluna.xlsx', headersMissingOne, [
      rowMissingOne
    ]);
    await expect(parsePrevisaoFile(path)).rejects.toBeInstanceOf(MissingHeadersError);
    try {
      await parsePrevisaoFile(path);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MissingHeadersError);
      expect((error as MissingHeadersError).missingHeaders).toContain('Comissao total (liquido)');
    }
  });
});
