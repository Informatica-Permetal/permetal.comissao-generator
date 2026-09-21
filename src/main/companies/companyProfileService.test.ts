import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openTestDatabase } from '../storage/testDatabase';
import { insertBatch } from '../storage/batchRepository';
import { insertDocument } from '../storage/documentRepository';
import { getCompanyProfile, upsertCompanyProfile } from './companyProfileRepository';
import { deleteCompanyProfileSafely } from './companyProfileService';

let dir: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-company-service-'));
  db = openTestDatabase(join(dir, 'test.db'));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function seedDocumentForBranch(branchCode: string): void {
  insertBatch(db, {
    id: 'batch-1',
    mode: 'Previsao',
    sourceOriginalName: 'previsao.xlsx',
    sourceHash: 'hash-1',
    importedAt: new Date().toISOString(),
    sourceRowCount: 1,
    outputCount: 1,
    status: 'completed',
    appVersion: '1.0.0'
  });
  insertDocument(db, {
    id: 'doc-1',
    batchId: 'batch-1',
    mode: 'Previsao',
    groupingMode: 'separate_by_branch',
    sellerCode: 'V1',
    sellerName: 'Vendedor',
    sourceRowCount: 1,
    commissionTotal: '100.00',
    pdfPath: join(dir, 'doc-1.pdf'),
    generatedAt: new Date().toISOString(),
    templateVersion: '1',
    branches: [{ branchCode, branchName: 'Filial', rowCount: 1, subtotal: '100.00' }]
  });
}

describe('deleteCompanyProfileSafely', () => {
  it('exclui a filial quando nao ha nenhum documento vinculado', () => {
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO' });

    const result = deleteCompanyProfileSafely(db, '0103');

    expect(result.ok).toBe(true);
    expect(getCompanyProfile(db, '0103')).toBeNull();
  });

  it('bloqueia a exclusao quando ha historico/documentos vinculados a filial', () => {
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO' });
    seedDocumentForBranch('0103');

    const result = deleteCompanyProfileSafely(db, '0103');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('hasDocuments');
    expect(result.documentCount).toBe(1);
    // A filial deve permanecer cadastrada - exclusao destrutiva foi bloqueada.
    expect(getCompanyProfile(db, '0103')).not.toBeNull();
  });

  it('excluir uma filial sem documentos nunca afeta outras filiais', () => {
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO' });
    upsertCompanyProfile(db, { branchCode: '0104', displayName: 'PERMETAL CRAVINHOS' });

    deleteCompanyProfileSafely(db, '0103');

    expect(getCompanyProfile(db, '0103')).toBeNull();
    expect(getCompanyProfile(db, '0104')).not.toBeNull();
  });
});
