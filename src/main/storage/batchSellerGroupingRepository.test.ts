import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openTestDatabase } from './testDatabase';
import { insertBatch, deleteBatchRecord } from './batchRepository';
import { getBatchSellerGroupingModes, upsertBatchSellerGroupingModes } from './batchSellerGroupingRepository';

let dir: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-batch-grouping-'));
  db = openTestDatabase(join(dir, 'test.db'));
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

describe('upsertBatchSellerGroupingModes / getBatchSellerGroupingModes', () => {
  it('retorna um mapa vazio quando o lote nao tem nenhum modo registrado', () => {
    expect(getBatchSellerGroupingModes(db, 'batch-1')).toEqual(new Map());
  });

  it('persiste o modo de cada vendedor, independente de qualquer documento', () => {
    upsertBatchSellerGroupingModes(
      db,
      'batch-1',
      new Map([
        ['000097', 'consolidated_by_seller'],
        ['000001', 'separate_by_branch']
      ])
    );

    const modes = getBatchSellerGroupingModes(db, 'batch-1');
    expect(modes.get('000097')).toBe('consolidated_by_seller');
    expect(modes.get('000001')).toBe('separate_by_branch');
  });

  it('upsert repetido para o mesmo vendedor atualiza o modo em vez de duplicar', () => {
    upsertBatchSellerGroupingModes(db, 'batch-1', new Map([['000097', 'separate_by_branch']]));
    upsertBatchSellerGroupingModes(db, 'batch-1', new Map([['000097', 'consolidated_by_seller']]));

    const modes = getBatchSellerGroupingModes(db, 'batch-1');
    expect(modes.size).toBe(1);
    expect(modes.get('000097')).toBe('consolidated_by_seller');
  });

  it('e removido quando o lote inteiro e excluido (cascade), nunca sobrevive sem o lote', () => {
    upsertBatchSellerGroupingModes(db, 'batch-1', new Map([['000097', 'consolidated_by_seller']]));
    deleteBatchRecord(db, 'batch-1');

    expect(getBatchSellerGroupingModes(db, 'batch-1')).toEqual(new Map());
  });
});
