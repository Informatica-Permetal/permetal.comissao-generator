import type { DatabaseSync } from 'node:sqlite';
import type { DeleteCompanyProfileResult } from '@shared/types/companyProfile';
import { countDocumentsForBranch } from '../storage/documentRepository';
import { deleteCompanyProfileRecord } from './companyProfileRepository';

/**
 * Deletes a branch only when it has no linked history. If any document
 * still references this branch code, deletion is refused - the caller
 * should offer deactivation instead, per the "never lose history" rule.
 */
export function deleteCompanyProfileSafely(db: DatabaseSync, branchCode: string): DeleteCompanyProfileResult {
  const documentCount = countDocumentsForBranch(db, branchCode);
  if (documentCount > 0) {
    return { ok: false, reason: 'hasDocuments', documentCount };
  }
  deleteCompanyProfileRecord(db, branchCode);
  return { ok: true };
}
