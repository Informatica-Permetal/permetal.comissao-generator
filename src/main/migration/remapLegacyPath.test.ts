import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { remapLegacyReportPath, remapPathPrefix } from './remapLegacyPath';

describe('remapPathPrefix', () => {
  it('troca o prefixo quando o caminho vive sob o prefixo antigo', () => {
    const result = remapPathPrefix(
      'C:\\Users\\Maria\\AppData\\Local\\Formatador Comissao',
      'C:\\Users\\Maria\\AppData\\Local\\Formatador Comissão',
      join('C:\\Users\\Maria\\AppData\\Local\\Formatador Comissao', 'logos', '0103-123.png')
    );
    expect(result).toBe(join('C:\\Users\\Maria\\AppData\\Local\\Formatador Comissão', 'logos', '0103-123.png'));
  });

  it('deixa null passar direto', () => {
    expect(remapPathPrefix('C:\\old', 'C:\\new', null)).toBeNull();
  });

  it('nao toca um caminho que nao vive sob o prefixo antigo', () => {
    const outside = 'C:\\Users\\Maria\\Downloads\\logo.png';
    expect(remapPathPrefix('C:\\old', 'C:\\new', outside)).toBe(outside);
  });

  it('nao confunde um prefixo parcial (ex.: "C:\\old" nao deve casar com "C:\\old-outra-coisa")', () => {
    const lookalike = 'C:\\old-outra-coisa\\arquivo.txt';
    expect(remapPathPrefix('C:\\old', 'C:\\new', lookalike)).toBe(lookalike);
  });

  it('troca o proprio caminho quando ele e exatamente igual ao prefixo antigo', () => {
    expect(remapPathPrefix('C:\\old', 'C:\\new', 'C:\\old')).toBe('C:\\new');
  });
});

describe('remapLegacyReportPath', () => {
  const oldRoot = 'C:\\Users\\Maria\\Documents\\Formatador Comissao';
  const newRoot = 'C:\\Users\\Maria\\Documents\\Formatador Comissão';

  it('renomeia o segmento do modo e mantem o resto do caminho intacto (Gerados)', () => {
    const oldPath = join(oldRoot, 'Previsao', 'Gerados', 'doc.pdf');
    expect(remapLegacyReportPath(oldRoot, newRoot, oldPath)).toBe(join(newRoot, 'Previsão', 'Gerados', 'doc.pdf'));
  });

  it('renomeia o modo E o subdiretorio Historico', () => {
    const oldPath = join(oldRoot, 'Relacao', 'Historico', '2026', '03', 'batch-1', 'doc.pdf');
    expect(remapLegacyReportPath(oldRoot, newRoot, oldPath)).toBe(
      join(newRoot, 'Relação', 'Histórico', '2026', '03', 'batch-1', 'doc.pdf')
    );
  });

  it('preserva Processados/Processamento/Entrada sem alteracao - so o modo muda', () => {
    expect(remapLegacyReportPath(oldRoot, newRoot, join(oldRoot, 'Previsao', 'Processados', '2026', '01', 'b', 'f.xlsx'))).toBe(
      join(newRoot, 'Previsão', 'Processados', '2026', '01', 'b', 'f.xlsx')
    );
    expect(remapLegacyReportPath(oldRoot, newRoot, join(oldRoot, 'Relacao', 'Processamento', 'b', 'f.xlsx'))).toBe(
      join(newRoot, 'Relação', 'Processamento', 'b', 'f.xlsx')
    );
    expect(remapLegacyReportPath(oldRoot, newRoot, join(oldRoot, 'Previsao', 'Entrada', 'f.xlsx'))).toBe(
      join(newRoot, 'Previsão', 'Entrada', 'f.xlsx')
    );
  });

  it('retorna null quando o caminho de entrada e null', () => {
    expect(remapLegacyReportPath(oldRoot, newRoot, null)).toBeNull();
  });

  it('nao toca um caminho fora do reportRoot (ex.: arquivo fonte externo)', () => {
    const external = 'C:\\Users\\Maria\\Downloads\\relatorio.xlsx';
    expect(remapLegacyReportPath(oldRoot, newRoot, external)).toBe(external);
  });

  it('nao toca um caminho cujo primeiro segmento nao e um modo reconhecido (defensivo)', () => {
    const weird = join(oldRoot, 'PastaDesconhecida', 'arquivo.txt');
    expect(remapLegacyReportPath(oldRoot, newRoot, weird)).toBe(weird);
  });

  it('quando oldRoot === newRoot (raiz customizada, nunca renomeada) ainda assim renomeia so o modo/Historico', () => {
    const customRoot = 'D:\\Relatorios da Empresa';
    const oldPath = join(customRoot, 'Relacao', 'Historico', '2026', '02', 'b', 'f.pdf');
    expect(remapLegacyReportPath(customRoot, customRoot, oldPath)).toBe(
      join(customRoot, 'Relação', 'Histórico', '2026', '02', 'b', 'f.pdf')
    );
  });

  it('e idempotente: aplicar duas vezes no resultado ja migrado nao muda nada', () => {
    const oldPath = join(oldRoot, 'Previsao', 'Gerados', 'doc.pdf');
    const once = remapLegacyReportPath(oldRoot, newRoot, oldPath);
    const twice = remapLegacyReportPath(oldRoot, newRoot, once);
    expect(twice).toBe(once);
  });
});
