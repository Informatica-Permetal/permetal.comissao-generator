import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './database';
import { insertBatch } from './batchRepository';
import {
  countDocumentsForBranch,
  deleteDocumentRecord,
  getDocumentById,
  insertDocument,
  listDocuments,
  listDocumentsByBatch,
  type DocumentRecord
} from './documentRepository';

let dir: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-documents-'));
  db = openDatabase(join(dir, 'test.db'));
  insertBatch(db, {
    id: 'batch-1',
    mode: 'Relacao',
    sourceOriginalName: 'relacao.xlsx',
    sourceHash: 'hash-1',
    importedAt: '2026-09-15T10:00:00.000Z',
    sourceRowCount: 3,
    outputCount: 0,
    status: 'completed',
    appVersion: '1.0.0'
  });
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function separateDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-1',
    batchId: 'batch-1',
    mode: 'Relacao',
    groupingMode: 'separate_by_branch',
    sellerCode: '000001',
    sellerName: 'ADEMIR FURLANETO',
    sourceRowCount: 1,
    commissionTotal: 'R$ 10,00',
    pdfPath: join(dir, 'doc-1.pdf'),
    generatedAt: '2026-09-15T10:00:00.000Z',
    templateVersion: '1',
    branches: [{ branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 10,00' }],
    ...overrides
  };
}

function consolidatedDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-consolidated-1',
    batchId: 'batch-1',
    mode: 'Relacao',
    groupingMode: 'consolidated_by_seller',
    sellerCode: '000097',
    sellerName: 'RODRIGO LEAL MIGNELLA',
    sourceRowCount: 3,
    commissionTotal: 'R$ 60,00',
    pdfPath: join(dir, 'doc-consolidated-1.pdf'),
    generatedAt: '2026-09-15T10:00:00.000Z',
    templateVersion: '1',
    branches: [
      { branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 10,00' },
      { branchCode: '0104', branchName: 'PERMETAL CRAVINHOS', rowCount: 1, subtotal: 'R$ 20,00' },
      { branchCode: '0105', branchName: 'METALGRADE NOVA', rowCount: 1, subtotal: 'R$ 30,00' }
    ],
    ...overrides
  };
}

describe('insertDocument / getDocumentById - separate_by_branch', () => {
  it('persiste um documento separado com exatamente uma filial', () => {
    insertDocument(db, separateDocument());
    const document = getDocumentById(db, 'doc-1');

    expect(document?.groupingMode).toBe('separate_by_branch');
    expect(document?.branchCode).toBe('0103');
    expect(document?.branches).toEqual([
      { branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 10,00' }
    ]);
  });

  it('nunca deixa a linha documents sem nenhuma document_branches - insert e tudo-ou-nada', () => {
    // Duas filiais com o MESMO branchCode violam a PRIMARY KEY (document_id, branch_code) de
    // document_branches no segundo insert - sem transacao, o documento ficaria orfao (existiria
    // em documents mas com so 1 das 2 filiais, ou nenhuma, dependendo da ordem de falha).
    expect(() =>
      insertDocument(
        db,
        separateDocument({
          id: 'doc-broken',
          branches: [
            { branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 10,00' },
            { branchCode: '0103', branchName: 'PERMETAL SAO PAULO (duplicado)', rowCount: 1, subtotal: 'R$ 5,00' }
          ]
        })
      )
    ).toThrow();

    // Nem a linha documents, nem nenhuma document_branches parcial, sobrevivem a falha.
    expect(getDocumentById(db, 'doc-broken')).toBeNull();
    const orphanBranches = db.prepare('SELECT * FROM document_branches WHERE document_id = ?').all('doc-broken');
    expect(orphanBranches).toHaveLength(0);
  });
});

describe('insertDocument / getDocumentById - consolidated_by_seller', () => {
  it('persiste um documento consolidado ligado a varias filiais, na ordem original', () => {
    insertDocument(db, consolidatedDocument());
    const document = getDocumentById(db, 'doc-consolidated-1');

    expect(document?.groupingMode).toBe('consolidated_by_seller');
    // branchCode primario e o da primeira filial - branches[] e a lista completa e autoritativa.
    expect(document?.branchCode).toBe('0103');
    expect(document?.branches).toHaveLength(3);
    expect(document?.branches.map((b) => b.branchCode)).toEqual(['0103', '0104', '0105']);
    expect(document?.commissionTotal).toBe('R$ 60,00');
  });

  it('nunca soma novamente os subtotais - o total persistido e exatamente o total ja calculado', () => {
    insertDocument(db, consolidatedDocument());
    const document = getDocumentById(db, 'doc-consolidated-1');
    expect(document?.commissionTotal).toBe('R$ 60,00');
    expect(document?.branches.map((b) => b.subtotal)).toEqual(['R$ 10,00', 'R$ 20,00', 'R$ 30,00']);
  });
});

describe('countDocumentsForBranch', () => {
  it('conta um documento separado apenas para a sua unica filial', () => {
    insertDocument(db, separateDocument());
    expect(countDocumentsForBranch(db, '0103')).toBe(1);
    expect(countDocumentsForBranch(db, '0104')).toBe(0);
  });

  it('conta um documento consolidado para QUALQUER uma de suas filiais, nao so a primaria', () => {
    insertDocument(db, consolidatedDocument());
    expect(countDocumentsForBranch(db, '0103')).toBe(1);
    expect(countDocumentsForBranch(db, '0104')).toBe(1);
    expect(countDocumentsForBranch(db, '0105')).toBe(1);
    expect(countDocumentsForBranch(db, '0106')).toBe(0);
  });

  it('nao conta duas vezes quando o mesmo documento aparece', () => {
    insertDocument(db, consolidatedDocument());
    insertDocument(db, separateDocument({ id: 'doc-2', branches: [{ branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 5,00' }] }));
    expect(countDocumentsForBranch(db, '0103')).toBe(2);
  });
});

describe('listDocuments - filtro por filial', () => {
  it('encontra um documento consolidado ao filtrar por uma filial que NAO e a primaria', () => {
    insertDocument(db, consolidatedDocument());
    const results = listDocuments(db, { branchCode: '0105' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc-consolidated-1');
  });

  it('nao encontra nada ao filtrar por uma filial que o documento consolidado nao inclui', () => {
    insertDocument(db, consolidatedDocument());
    expect(listDocuments(db, { branchCode: '0106' })).toHaveLength(0);
  });
});

describe('listDocumentsByBatch', () => {
  it('retorna cada documento com sua propria lista de filiais completa', () => {
    insertDocument(db, separateDocument());
    insertDocument(db, consolidatedDocument());
    const documents = listDocumentsByBatch(db, 'batch-1');
    expect(documents).toHaveLength(2);
    const separate = documents.find((d) => d.id === 'doc-1');
    const consolidated = documents.find((d) => d.id === 'doc-consolidated-1');
    expect(separate?.branches).toHaveLength(1);
    expect(consolidated?.branches).toHaveLength(3);
  });
});

describe('deleteDocumentRecord', () => {
  it('remove o documento e suas associacoes de filial (cascade), sem afetar outros documentos', () => {
    insertDocument(db, separateDocument());
    insertDocument(db, consolidatedDocument());

    deleteDocumentRecord(db, 'doc-consolidated-1');

    expect(getDocumentById(db, 'doc-consolidated-1')).toBeNull();
    expect(countDocumentsForBranch(db, '0104')).toBe(0);
    expect(countDocumentsForBranch(db, '0105')).toBe(0);
    // O documento separado, de outra filial, permanece intacto.
    expect(getDocumentById(db, 'doc-1')).not.toBeNull();
    expect(countDocumentsForBranch(db, '0103')).toBe(1);
  });
});
