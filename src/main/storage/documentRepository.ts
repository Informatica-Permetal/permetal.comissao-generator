import type { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import type { ReportMode } from '@shared/constants/folders';
import type { DocumentBranchInfo, GroupingMode, HistoryDocument, HistoryFilters } from '@shared/types/history';

export interface DocumentBranchRecord {
  branchCode: string;
  branchName: string;
  rowCount: number;
  subtotal: string;
}

export interface DocumentRecord {
  id: string;
  batchId: string;
  mode: ReportMode;
  groupingMode: GroupingMode;
  sellerCode: string;
  sellerName: string;
  sourceRowCount: number;
  commissionTotal: string;
  pdfPath: string;
  generatedAt: string;
  templateVersion: string;
  /** Every branch included in this document, in generation order - length 1 for `separate_by_branch`. */
  branches: DocumentBranchRecord[];
}

interface DocumentRow {
  id: string;
  batch_id: string;
  mode: string;
  grouping_mode: string;
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

interface DocumentBranchRow {
  document_id: string;
  branch_code: string;
  branch_name: string | null;
  position: number;
  row_count: number;
  subtotal: string;
}

function rowToHistoryDocument(row: DocumentRow, branches: DocumentBranchInfo[]): HistoryDocument {
  return {
    id: row.id,
    batchId: row.batch_id,
    mode: row.mode as ReportMode,
    groupingMode: (row.grouping_mode as GroupingMode) || 'separate_by_branch',
    branchCode: row.branch_code,
    branchName: row.branch_name ?? '',
    // Defensive fallback (should never trigger once the migration's backfill has run).
    branches:
      branches.length > 0
        ? branches
        : [
            {
              branchCode: row.branch_code,
              branchName: row.branch_name ?? '',
              rowCount: row.source_row_count,
              subtotal: row.commission_total ?? '-'
            }
          ],
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

/** Fetches every branch association for a set of document ids in one query, grouped and ordered by position. */
function fetchBranchesByDocumentId(db: DatabaseSync, documentIds: readonly string[]): Map<string, DocumentBranchInfo[]> {
  const map = new Map<string, DocumentBranchInfo[]>();
  if (documentIds.length === 0) return map;

  const placeholders = documentIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM document_branches WHERE document_id IN (${placeholders}) ORDER BY document_id, position`
    )
    .all(...documentIds) as unknown as DocumentBranchRow[];

  for (const row of rows) {
    const list = map.get(row.document_id) ?? [];
    list.push({
      branchCode: row.branch_code,
      branchName: row.branch_name ?? '',
      rowCount: row.row_count,
      subtotal: row.subtotal
    });
    map.set(row.document_id, list);
  }
  return map;
}

function rowsToHistoryDocuments(db: DatabaseSync, rows: DocumentRow[]): HistoryDocument[] {
  const branchesByDocumentId = fetchBranchesByDocumentId(db, rows.map((row) => row.id));
  return rows.map((row) => rowToHistoryDocument(row, branchesByDocumentId.get(row.id) ?? []));
}

/**
 * Inserts the `documents` row and all of its `document_branches` rows as one
 * atomic transaction - a consolidated document must never be left with only
 * some of its branches recorded if the process is interrupted mid-insert.
 */
export function insertDocument(db: DatabaseSync, record: DocumentRecord): void {
  const primary = record.branches[0];
  db.exec('BEGIN');
  try {
    db.prepare(
      `INSERT INTO documents
         (id, batch_id, mode, grouping_mode, branch_code, branch_name, seller_code, seller_name,
          source_row_count, commission_total, pdf_path, generated_at, template_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id,
      record.batchId,
      record.mode,
      record.groupingMode,
      primary.branchCode,
      primary.branchName,
      record.sellerCode,
      record.sellerName,
      record.sourceRowCount,
      record.commissionTotal,
      record.pdfPath,
      record.generatedAt,
      record.templateVersion
    );

    const insertBranch = db.prepare(
      `INSERT INTO document_branches (document_id, branch_code, branch_name, position, row_count, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    record.branches.forEach((branch, position) => {
      insertBranch.run(record.id, branch.branchCode, branch.branchName, position, branch.rowCount, branch.subtotal);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function updateDocumentPdfPath(db: DatabaseSync, documentId: string, pdfPath: string): void {
  db.prepare('UPDATE documents SET pdf_path = ? WHERE id = ?').run(pdfPath, documentId);
}

/** Cascades to `document_branches` automatically (ON DELETE CASCADE, foreign_keys = ON). */
export function deleteDocumentRecord(db: DatabaseSync, documentId: string): void {
  db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
}

/** Number of distinct documents (history entries) currently linked to a branch code, via ANY of their branches. */
export function countDocumentsForBranch(db: DatabaseSync, branchCode: string): number {
  const row = db
    .prepare('SELECT COUNT(DISTINCT document_id) as count FROM document_branches WHERE branch_code = ?')
    .get(branchCode) as { count: number };
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
  if (!row) return null;
  return rowsToHistoryDocuments(db, [row])[0];
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
  return rowsToHistoryDocuments(db, rows);
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
  return rowsToHistoryDocuments(db, rows);
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
    // Matches a consolidated document under ANY of its branches, not only its primary/first one.
    clauses.push('documents.id IN (SELECT document_id FROM document_branches WHERE branch_code = ?)');
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
  return rowsToHistoryDocuments(db, rows);
}
