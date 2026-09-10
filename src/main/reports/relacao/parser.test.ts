import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MissingHeadersError, WrongModeError } from '../common/errors';
import { createFixtureDir, removeFixtureDir, writeFixtureWorkbook } from '../testSupport/xlsxFixtures';
import { parseRelacaoFile } from './parser';

const HEADERS = [
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

function row(overrides: Partial<Record<(typeof HEADERS)[number], unknown>> = {}): unknown[] {
  const base: Record<string, unknown> = {
    'Tipo de Registro': 'Comissao',
    'Nome do Vendedor': 'VENDEDOR SINTETICO',
    'Filial do Sistema': '0199',
    'Codigo do Vendedor': '000009',
    Prefixo: '001',
    'Numero do Titulo Original': '000099999',
    Parcela: '01',
    'Nome do cliente': 'CLIENTE SINTETICO LTDA',
    'Data de Baixa do Titulo': '01/03/2026',
    'Data do Pgto da Comissao': null,
    'Numero do Pedido': '029999',
    'Valor Base da Comissao': '1.000,00',
    '% Comissao sobre Vl.Base': '0,15',
    'Valor da Comissao': '150,00',
    'Comissao gerada pela B/E': 'Baixa'
  };
  return HEADERS.map((header) => (header in overrides ? overrides[header] : base[header]));
}

let dir: string;
beforeEach(() => {
  dir = createFixtureDir('fc-relacao-');
});
afterEach(() => {
  removeFixtureDir(dir);
});

describe('parseRelacaoFile - caminho feliz', () => {
  it('parseia uma linha valida e soma somente Valor da Comissao', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [row()]);
    const result = await parseRelacaoFile(path);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].valorDaComissao?.toString()).toBe('150');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].total.toString()).toBe('150');
    expect(result.groups[0].branchCode).toBe('0199');
    expect(result.groups[0].sellerCode).toBe('000009');
  });

  it('nunca deriva o total de base x percentual - usa somente o campo autoritativo', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [
      row({ 'Valor Base da Comissao': '1.000,00', '% Comissao sobre Vl.Base': '50', 'Valor da Comissao': '1,00' })
    ]);
    const result = await parseRelacaoFile(path);
    expect(result.groups[0].total.toString()).toBe('1');
  });
});

describe('parseRelacaoFile - colunas reordenadas', () => {
  it('nao depende da ordem das colunas', async () => {
    const baseRow = row();
    const shuffledHeaders = [...HEADERS].reverse();
    const shuffledRow = shuffledHeaders.map((header) => baseRow[HEADERS.indexOf(header)]);
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', shuffledHeaders, [shuffledRow]);
    const result = await parseRelacaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].valorDaComissao?.toString()).toBe('150');
    expect(result.rows[0].filialCodigo).toBe('0199');
  });
});

describe('parseRelacaoFile - cabecalhos com espacos', () => {
  it('tolera espacos extras e NBSP nos cabecalhos', async () => {
    const spacedHeaders = HEADERS.map((h) => `  ${h}   `);
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', spacedHeaders, [row()]);
    const result = await parseRelacaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].valorDaComissao?.toString()).toBe('150');
  });
});

describe('parseRelacaoFile - zeros a esquerda', () => {
  it('preserva zeros a esquerda em codigo de vendedor e filial', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [
      row({ 'Codigo do Vendedor': '000007', 'Filial do Sistema': '0007', Prefixo: '001', 'Numero do Titulo Original': '000000042' })
    ]);
    const result = await parseRelacaoFile(path);
    expect(result.rows[0].vendedorCodigo).toBe('000007');
    expect(result.rows[0].filialCodigo).toBe('0007');
    expect(result.rows[0].numeroDoTituloOriginal).toBe('000000042');
  });
});

describe('parseRelacaoFile - numeros brasileiros', () => {
  it('converte formatos brasileiros corretamente, inclusive alta precisao', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [
      row({ 'Valor Base da Comissao': '48.133,12', 'Valor da Comissao': '7,93129527965909' })
    ]);
    const result = await parseRelacaoFile(path);
    expect(result.rows[0].valorBaseDaComissao?.toString()).toBe('48133.12');
    expect(result.rows[0].valorDaComissao?.toString()).toBe('7.93129527965909');
  });
});

describe('parseRelacaoFile - valores em branco/zero/negativos', () => {
  it('linha com comissao em branco conta zero no total mas permanece na lista', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [row({ 'Valor da Comissao': '' })]);
    const result = await parseRelacaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].valorDaComissao).toBeNull();
    expect(result.groups[0].total.toString()).toBe('0');
  });

  it('valor zero permanece como linha valida, nao e filtrado', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [row({ 'Valor da Comissao': '0' })]);
    const result = await parseRelacaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].valorDaComissao?.toString()).toBe('0');
  });

  it('valor negativo reduz o total exatamente como exportado', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [
      row({ 'Valor da Comissao': '200,00' }),
      row({ 'Valor da Comissao': '-50,00' })
    ]);
    const result = await parseRelacaoFile(path);
    expect(result.groups[0].total.toString()).toBe('150');
  });
});

describe('parseRelacaoFile - linha duplicada', () => {
  it('preserva integralmente linhas identicas - nunca deduplica', async () => {
    const identicalRow = row();
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [identicalRow, identicalRow]);
    const result = await parseRelacaoFile(path);
    expect(result.rows).toHaveLength(2);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].rows).toHaveLength(2);
    expect(result.groups[0].total.toString()).toBe('300'); // 150 + 150, nunca 150
  });
});

describe('parseRelacaoFile - varios vendedores', () => {
  it('agrupa vendedores diferentes na mesma filial em documentos separados', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [
      row({ 'Codigo do Vendedor': '000001', 'Nome do Vendedor': 'VENDEDOR UM', 'Valor da Comissao': '100,00' }),
      row({ 'Codigo do Vendedor': '000002', 'Nome do Vendedor': 'VENDEDOR DOIS', 'Valor da Comissao': '200,00' })
    ]);
    const result = await parseRelacaoFile(path);
    expect(result.groups).toHaveLength(2);
    const byCode = new Map(result.groups.map((g) => [g.sellerCode, g]));
    expect(byCode.get('000001')?.total.toString()).toBe('100');
    expect(byCode.get('000002')?.total.toString()).toBe('200');
  });
});

describe('parseRelacaoFile - mesmo vendedor em duas filiais', () => {
  it('gera um grupo por filial mesmo para o mesmo codigo de vendedor', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [
      row({ 'Filial do Sistema': '0103', 'Valor da Comissao': '10,00' }),
      row({ 'Filial do Sistema': '0104', 'Valor da Comissao': '20,00' })
    ]);
    const result = await parseRelacaoFile(path);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.every((g) => g.sellerCode === '000009')).toBe(true);
    const byBranch = new Map(result.groups.map((g) => [g.branchCode, g]));
    expect(byBranch.get('0103')?.total.toString()).toBe('10');
    expect(byBranch.get('0104')?.total.toString()).toBe('20');
  });
});

describe('parseRelacaoFile - arquivo do modo errado', () => {
  it('detecta um arquivo de Previsao enviado para o modo Relacao', async () => {
    const previsaoHeaders = [
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
    const previsaoRow = [
      'CLIENTE TESTE',
      '001-000099999--NF',
      null,
      '01/03/2026',
      '01/03/2026',
      '1.000,00',
      '150,00',
      '02/03/2026',
      '10,00',
      '140,00',
      '000009 - VENDEDOR TESTE',
      'Titulo original',
      '0103 - FILIAL TESTE'
    ];
    const path = await writeFixtureWorkbook(dir, 'previsao-no-modo-relacao.xlsx', previsaoHeaders, [
      previsaoRow
    ]);
    await expect(parseRelacaoFile(path)).rejects.toBeInstanceOf(WrongModeError);
  });
});

describe('parseRelacaoFile - coluna obrigatoria ausente', () => {
  it('reporta a coluna faltante em vez de falhar silenciosamente', async () => {
    const missingIndex = HEADERS.indexOf('Valor da Comissao');
    const headersMissingOne = HEADERS.filter((_, index) => index !== missingIndex);
    const rowMissingOne = row().filter((_, index) => index !== missingIndex);
    const path = await writeFixtureWorkbook(dir, 'relacao-sem-coluna.xlsx', headersMissingOne, [
      rowMissingOne
    ]);
    await expect(parseRelacaoFile(path)).rejects.toBeInstanceOf(MissingHeadersError);
    try {
      await parseRelacaoFile(path);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MissingHeadersError);
      expect((error as MissingHeadersError).missingHeaders).toContain('Valor da Comissao');
    }
  });
});

describe('parseRelacaoFile - avisos nao bloqueantes', () => {
  it('avisa sobre Tipo de Registro inesperado sem filtrar a linha', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [
      row({ 'Tipo de Registro': 'Estorno' })
    ]);
    const result = await parseRelacaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('Tipo de Registro'))).toBe(true);
  });

  it('avisa sobre B/E diferente de Baixa (ex.: Emissao) sem filtrar a linha', async () => {
    const path = await writeFixtureWorkbook(dir, 'relacao.xlsx', HEADERS, [
      row({ 'Comissao gerada pela B/E': 'Emissao' })
    ]);
    const result = await parseRelacaoFile(path);
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('B/E'))).toBe(true);
  });
});
