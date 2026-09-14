import type { DatabaseSync } from 'node:sqlite';
import type { ReportMode } from '@shared/constants/folders';
import type { HistoryBatch } from '@shared/types/history';

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
  source_archived_path: string | null;
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

function rowToHistoryBatch(row: BatchRow): HistoryBatch {
  return {
    id: row.id,
    mode: row.mode as ReportMode,
    sourceOriginalName: row.source_original_name,
    sourceArchivedPath: row.source_archived_path,
    sourceHash: row.source_hash,
    importedAt: row.imported_at,
    sourceRowCount: row.source_row_count,
    outputCount: row.output_count,
    status: row.status
  };
}

/** Most recent batch that processed this exact file content, if any. */
export function findLatestBatchBySourceHash(db: DatabaseSync, sourceHash: string): BatchRecord | null {
  const row = db
    .prepare('SELECT * FROM batches WHERE source_hash = ? ORDER BY imported_at DESC LIMIT 1')
    .get(sourceHash) as BatchRow | undefined;
  return row ? rowToBatch(row) : null;
}

export function getBatchById(db: DatabaseSync, batchId: string): HistoryBatch | null {
  const row = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as BatchRow | undefined;
  return row ? rowToHistoryBatch(row) : null;
}

/** Distinct batch ids that currently have at least one document, restricted to a mode. */
export function listBatchIdsWithDocuments(db: DatabaseSync, mode: ReportMode): string[] {
  const rows = db
    .prepare('SELECT DISTINCT batch_id FROM documents WHERE mode = ?')
    .all(mode) as unknown as { batch_id: string }[];
  return rows.map((row) => row.batch_id);
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

export function updateBatchStatus(db: DatabaseSync, batchId: string, status: string): void {
  db.prepare('UPDATE batches SET status = ? WHERE id = ?').run(status, batchId);
}

export function updateBatchArchivedPath(db: DatabaseSync, batchId: string, sourceArchivedPath: string): void {
  db.prepare('UPDATE batches SET source_archived_path = ? WHERE id = ?').run(sourceArchivedPath, batchId);
}

export function updateBatchOutputCount(db: DatabaseSync, batchId: string, outputCount: number): void {
  db.prepare('UPDATE batches SET output_count = ? WHERE id = ?').run(outputCount, batchId);
}

export function deleteBatchRecord(db: DatabaseSync, batchId: string): void {
  db.prepare('DELETE FROM documents WHERE batch_id = ?').run(batchId);
  db.prepare('DELETE FROM batches WHERE id = ?').run(batchId);
}
