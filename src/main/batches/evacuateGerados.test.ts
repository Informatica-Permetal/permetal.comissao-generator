import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openTestDatabase } from '../storage/testDatabase';
import { insertBatch } from '../storage/batchRepository';
import { insertDocument, listDocumentsByBatch } from '../storage/documentRepository';
import { createFixtureDir, removeFixtureDir } from '../reports/testSupport/xlsxFixtures';
import { resolveGeradosDir } from '../pdf/outputPath';
import { evacuateGeradosToHistorico } from './evacuateGerados';

let reportRoot: string;
let db: DatabaseSync;

beforeEach(() => {
  reportRoot = createFixtureDir('fc-evacuate-');
  db = openTestDatabase(join(reportRoot, 'app.db'));
  insertBatch(db, {
    id: 'batch-x',
    mode: 'Previsao',
    sourceOriginalName: 'previsao.xlsx',
    sourceHash: 'hash-x',
    importedAt: '2026-09-14T10:00:00.000Z',
    sourceRowCount: 1,
    outputCount: 0,
    status: 'completed',
    appVersion: '0.1.0-test'
  });
});

afterEach(() => {
  db.close();
  removeFixtureDir(reportRoot);
});

describe('evacuateGeradosToHistorico', () => {
  it('nao sobrescreve um PDF historico ja existente quando o mesmo lote e evacuado uma segunda vez no mesmo dia', () => {
    const geradosDir = resolveGeradosDir(reportRoot, 'Previsao');
    mkdirSync(geradosDir, { recursive: true });

    // Mesmo batchId, mesma data (mesmo nome de arquivo deterministico) - reproduz exatamente
    // o cenario onde uma regeneracao no mesmo dia produz um PDF com nome identico ao anterior.
    const sameGeneratedAt = '2026-09-14T12:00:00.000Z';
    const fileName = '2026-09-14_PREVISAO_0103_000001_ADEMIR_FURLANETO.pdf';

    const firstPdfPath = join(geradosDir, fileName);
    writeFileSync(firstPdfPath, 'conteudo-original');
    insertDocument(db, {
      id: 'doc-1',
      batchId: 'batch-x',
      mode: 'Previsao',
      groupingMode: 'separate_by_branch',
      sellerCode: '000001',
      sellerName: 'ADEMIR FURLANETO',
      sourceRowCount: 1,
      commissionTotal: 'R$ 10,00',
      pdfPath: firstPdfPath,
      generatedAt: sameGeneratedAt,
      templateVersion: '1',
      branches: [{ branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 10,00' }]
    });

    // Primeira evacuacao: move o PDF original para o Historico.
    const firstEvacuation = evacuateGeradosToHistorico(db, reportRoot, 'Previsao');
    expect(firstEvacuation.movedDocumentCount).toBe(1);
    const [afterFirst] = listDocumentsByBatch(db, 'batch-x');
    expect(existsSync(afterFirst.pdfPath)).toBe(true);
    expect(readFileSync(afterFirst.pdfPath, 'utf8')).toBe('conteudo-original');
    const historicoPathAfterFirst = afterFirst.pdfPath;

    // Uma regeneracao do MESMO lote, no mesmo dia, produz um PDF com o MESMO nome
    // deterministico de volta em Gerados - com conteudo NOVO.
    const secondPdfPath = join(geradosDir, fileName);
    mkdirSync(geradosDir, { recursive: true });
    writeFileSync(secondPdfPath, 'conteudo-regenerado');
    insertDocument(db, {
      id: 'doc-2',
      batchId: 'batch-x',
      mode: 'Previsao',
      groupingMode: 'separate_by_branch',
      sellerCode: '000001',
      sellerName: 'ADEMIR FURLANETO',
      sourceRowCount: 1,
      commissionTotal: 'R$ 10,00',
      pdfPath: secondPdfPath,
      generatedAt: sameGeneratedAt,
      templateVersion: '1',
      branches: [{ branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 10,00' }]
    });

    // Segunda evacuacao: deve mover o PDF novo SEM destruir o PDF historico ja arquivado.
    const secondEvacuation = evacuateGeradosToHistorico(db, reportRoot, 'Previsao');
    expect(secondEvacuation.movedDocumentCount).toBe(1);

    // O primeiro PDF historico continua intacto, com o conteudo original.
    expect(existsSync(historicoPathAfterFirst)).toBe(true);
    expect(readFileSync(historicoPathAfterFirst, 'utf8')).toBe('conteudo-original');

    // O segundo documento foi movido para um caminho DIFERENTE (sufixo numerico), preservando seu proprio conteudo.
    const [doc1, doc2] = listDocumentsByBatch(db, 'batch-x').sort((a, b) => a.id.localeCompare(b.id));
    expect(doc1.pdfPath).toBe(historicoPathAfterFirst);
    expect(doc2.pdfPath).not.toBe(historicoPathAfterFirst);
    expect(existsSync(doc2.pdfPath)).toBe(true);
    expect(readFileSync(doc2.pdfPath, 'utf8')).toBe('conteudo-regenerado');
  });
});
