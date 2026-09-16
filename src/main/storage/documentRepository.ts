import type { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import type { ReportMode } from '@shared/constants/folders';
import type { HistoryDocument, HistoryFilters } from '@shared/types/history';

export interface DocumentRecord {
  id: string;
  batchId: string;
  mode: ReportMode;
  branchCode: string;
  branchName: string;
  sellerCode: string;
  sellerName: string;
  sourceRowCount: number;
  commissionTotal: string;
  pdfPath: string;
  generatedAt: string;
  templateVersion: string;
}

interface DocumentRow {
  id: string;
  batch_id: string;
  mode: string;
  branch_code: string;
  branch_name: string | null;
  seller_code: string;
  seller_name: string | null;
  source_row_count: number;
  commission_total: string | null;
  pdf_path: string | null;
  generated_at: string;
  source_original_name: string;
}

function rowToHistoryDocument(row: DocumentRow): HistoryDocument {
  return {
    id: row.id,
    batchId: row.batch_id,
    mode: row.mode as ReportMode,
    branchCode: row.branch_code,
    branchName: row.branch_name ?? '',
    sellerCode: row.seller_code,
    sellerName: row.seller_name ?? '',
    sourceRowCount: row.source_row_count,
    commissionTotal: row.commission_total ?? '-',
    pdfPath: row.pdf_path ?? '',
    pdfAvailable: !!row.pdf_path && existsSync(row.pdf_path),
    generatedAt: row.generated_at,
    sourceOriginalName: row.source_original_name
  };
}

export function insertDocument(db: DatabaseSync, record: DocumentRecord): void {
  db.prepare(
    `INSERT INTO documents
       (id, batch_id, mode, branch_code, branch_name, seller_code, seller_name,
        source_row_count, commission_total, pdf_path, generated_at, template_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.batchId,
    record.mode,
    record.branchCode,
    record.branchName,
    record.sellerCode,
    record.sellerName,
    record.sourceRowCount,
    record.commissionTotal,
    record.pdfPath,
    record.generatedAt,
    record.templateVersion
  );
}

export function updateDocumentPdfPath(db: DatabaseSync, documentId: string, pdfPath: string): void {
  db.prepare('UPDATE documents SET pdf_path = ? WHERE id = ?').run(pdfPath, documentId);
}

export function deleteDocumentRecord(db: DatabaseSync, documentId: string): void {
  db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
}

/** Number of document records (history entries) currently linked to a branch code. */
export function countDocumentsForBranch(db: DatabaseSync, branchCode: string): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM documents WHERE branch_code = ?').get(branchCode) as {
    count: number;
  };
  return row.count;
}

export function getDocumentById(db: DatabaseSync, documentId: string): HistoryDocument | null {
  const row = db
    .prepare(
      `SELECT documents.*, batches.source_original_name as source_original_name
       FROM documents JOIN batches ON documents.batch_id = batches.id
       WHERE documents.id = ?`
    )
    .get(documentId) as DocumentRow | undefined;
  return row ? rowToHistoryDocument(row) : null;
}

export function listDocumentsByBatch(db: DatabaseSync, batchId: string): HistoryDocument[] {
  const rows = db
    .prepare(
      `SELECT documents.*, batches.source_original_name as source_original_name
       FROM documents JOIN batches ON documents.batch_id = batches.id
       WHERE documents.batch_id = ?
       ORDER BY documents.branch_code, documents.seller_code`
    )
    .all(batchId) as unknown as DocumentRow[];
  return rows.map(rowToHistoryDocument);
}

/** Documents whose PDF currently lives directly under `<reportRoot>/<mode>/Gerados/`. */
export function listDocumentsInGerados(db: DatabaseSync, mode: ReportMode, geradosDir: string): HistoryDocument[] {
  const rows = db
    .prepare(
      `SELECT documents.*, batches.source_original_name as source_original_name
       FROM documents JOIN batches ON documents.batch_id = batches.id
       WHERE documents.mode = ? AND documents.pdf_path LIKE ?`
    )
    .all(mode, `${geradosDir}%`) as unknown as DocumentRow[];
  return rows.map(rowToHistoryDocument);
}

export function listDocuments(db: DatabaseSync, filters: HistoryFilters): HistoryDocument[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filters.mode) {
    clauses.push('documents.mode = ?');
    params.push(filters.mode);
  }
  if (filters.sellerCode) {
    clauses.push('documents.seller_code = ?');
    params.push(filters.sellerCode);
  }
  if (filters.branchCode) {
    clauses.push('documents.branch_code = ?');
    params.push(filters.branchCode);
  }
  if (filters.search) {
    clauses.push('(batches.source_original_name LIKE ? OR documents.batch_id LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.dateFrom) {
    clauses.push('documents.generated_at >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push('documents.generated_at <= ?');
    params.push(`${filters.dateTo}T23:59:59.999Z`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT documents.*, batches.source_original_name as source_original_name
       FROM documents JOIN batches ON documents.batch_id = batches.id
       ${where}
       ORDER BY documents.generated_at DESC`
    )
    .all(...params) as unknown as DocumentRow[];
  return rows.map(rowToHistoryDocument);
}
