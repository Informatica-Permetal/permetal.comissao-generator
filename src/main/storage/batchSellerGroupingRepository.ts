import type { DatabaseSync } from 'node:sqlite';
import type { GroupingMode } from '@shared/types/history';

interface BatchSellerGroupingRow {
  seller_code: string;
  grouping_mode: string;
}

/**
 * Persists each seller's resolved grouping mode independently of any single
 * `documents` row - keyed only to the batch. This is what makes "Gerar
 * novamente" able to preserve a seller's original consolidado/separado
 * choice even if every document that mode once produced was later deleted
 * from Histórico: the choice itself is remembered here, not inferred from
 * whatever document rows happen to still exist. Removed only when the whole
 * batch is deleted (ON DELETE CASCADE) - never by an individual document delete.
 */
export function upsertBatchSellerGroupingModes(
  db: DatabaseSync,
  batchId: string,
  modeBySeller: ReadonlyMap<string, GroupingMode>
): void {
  const stmt = db.prepare(
    `INSERT INTO batch_seller_grouping (batch_id, seller_code, grouping_mode)
     VALUES (?, ?, ?)
     ON CONFLICT(batch_id, seller_code) DO UPDATE SET grouping_mode = excluded.grouping_mode`
  );
  for (const [sellerCode, mode] of modeBySeller) {
    stmt.run(batchId, sellerCode, mode);
  }
}

export function getBatchSellerGroupingModes(db: DatabaseSync, batchId: string): Map<string, GroupingMode> {
  const rows = db
    .prepare('SELECT seller_code, grouping_mode FROM batch_seller_grouping WHERE batch_id = ?')
    .all(batchId) as unknown as BatchSellerGroupingRow[];
  return new Map(rows.map((row) => [row.seller_code, row.grouping_mode as GroupingMode]));
}
