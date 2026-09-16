import type { DatabaseSync } from 'node:sqlite';
import type { CompanyAddress, CompanyGroup, CompanyGroupInput } from '@shared/types/companyProfile';

interface CompanyGroupRow {
  group_key: string;
  display_name: string | null;
  legal_name: string | null;
  headquarters_branch_code: string | null;
  headquarters_cnpj: string | null;
  headquarters_address_json: string | null;
  updated_at: string;
}

function rowToGroup(row: CompanyGroupRow): CompanyGroup {
  let headquartersAddress: CompanyAddress | null = null;
  if (row.headquarters_address_json) {
    try {
      headquartersAddress = JSON.parse(row.headquarters_address_json) as CompanyAddress;
    } catch {
      headquartersAddress = null;
    }
  }
  return {
    groupKey: row.group_key,
    displayName: row.display_name ?? '',
    legalName: row.legal_name,
    headquartersBranchCode: row.headquarters_branch_code,
    headquartersCnpj: row.headquarters_cnpj,
    headquartersAddress,
    updatedAt: row.updated_at
  };
}

export function listCompanyGroups(db: DatabaseSync): CompanyGroup[] {
  const rows = db.prepare('SELECT * FROM company_groups ORDER BY group_key').all() as unknown as CompanyGroupRow[];
  return rows.map(rowToGroup);
}

export function getCompanyGroup(db: DatabaseSync, groupKey: string): CompanyGroup | null {
  const row = db.prepare('SELECT * FROM company_groups WHERE group_key = ?').get(groupKey) as
    | CompanyGroupRow
    | undefined;
  return row ? rowToGroup(row) : null;
}

export function upsertCompanyGroup(db: DatabaseSync, input: CompanyGroupInput): CompanyGroup {
  const now = new Date().toISOString();
  const addressJson = input.headquartersAddress ? JSON.stringify(input.headquartersAddress) : null;
  db.prepare(
    `INSERT INTO company_groups
       (group_key, display_name, legal_name, headquarters_branch_code, headquarters_cnpj, headquarters_address_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(group_key) DO UPDATE SET
       display_name = excluded.display_name,
       legal_name = excluded.legal_name,
       headquarters_branch_code = excluded.headquarters_branch_code,
       headquarters_cnpj = excluded.headquarters_cnpj,
       headquarters_address_json = excluded.headquarters_address_json,
       updated_at = excluded.updated_at`
  ).run(
    input.groupKey,
    input.displayName,
    input.legalName ?? null,
    input.headquartersBranchCode ?? null,
    input.headquartersCnpj ?? null,
    addressJson,
    now
  );
  return getCompanyGroup(db, input.groupKey) as CompanyGroup;
}

function mergeAddress(existing: CompanyAddress | null, seed: CompanyAddress | null): CompanyAddress | null {
  if (!seed) return existing;
  const merged: CompanyAddress = { ...existing };
  for (const key of ['endereco', 'bairro', 'cidade', 'uf', 'cep'] as const) {
    if (!merged[key] && seed[key]) merged[key] = seed[key];
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * Seed-safe upsert: inserts the group if it does not exist yet; otherwise
 * only fills currently-empty fields, never overwriting anything already set
 * (whether set by a user or by a previous seed run).
 */
export function fillEmptyCompanyGroupFields(db: DatabaseSync, seed: CompanyGroupInput): CompanyGroup {
  const existing = getCompanyGroup(db, seed.groupKey);
  if (!existing) {
    return upsertCompanyGroup(db, seed);
  }
  return upsertCompanyGroup(db, {
    groupKey: existing.groupKey,
    displayName: existing.displayName || seed.displayName,
    legalName: existing.legalName || seed.legalName || null,
    headquartersBranchCode: existing.headquartersBranchCode || seed.headquartersBranchCode || null,
    headquartersCnpj: existing.headquartersCnpj || seed.headquartersCnpj || null,
    headquartersAddress: mergeAddress(existing.headquartersAddress, seed.headquartersAddress ?? null)
  });
}
