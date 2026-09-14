import type { DatabaseSync } from 'node:sqlite';
import type { ReportMode } from '@shared/constants/folders';

export interface BatchRecord {
  id: string;
  mode: ReportMode;
  sourceOriginalName: string;
  sourceHash: string;
  importedAt: string;
  sourceRowCount: number;
  outputCount: number;
  status: string;
  appVersion: string | null;
}

interface BatchRow {
  id: string;
  mode: string;
  source_original_name: string;
  source_hash: string;
  imported_at: string;
  source_row_count: number;
  output_count: number;
  status: string;
  app_version: string | null;
}

function rowToBatch(row: BatchRow): BatchRecord {
  return {
    id: row.id,
    mode: row.mode as ReportMode,
    sourceOriginalName: row.source_original_name,
    sourceHash: row.source_hash,
    importedAt: row.imported_at,
    sourceRowCount: row.source_row_count,
    outputCount: row.output_count,
    status: row.status,
    appVersion: row.app_version
  };
}

/** Most recent batch that processed this exact file content, if any. */
export function findLatestBatchBySourceHash(db: DatabaseSync, sourceHash: string): BatchRecord | null {
  const row = db
    .prepare('SELECT * FROM batches WHERE source_hash = ? ORDER BY imported_at DESC LIMIT 1')
    .get(sourceHash) as BatchRow | undefined;
  return row ? rowToBatch(row) : null;
}

export function insertBatch(db: DatabaseSync, record: BatchRecord): void {
  db.prepare(
    `INSERT INTO batches
       (id, mode, source_original_name, source_hash, imported_at, source_row_count, output_count, status, app_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.mode,
    record.sourceOriginalName,
    record.sourceHash,
    record.importedAt,
    record.sourceRowCount,
    record.outputCount,
    record.status,
    record.appVersion
  );
}
