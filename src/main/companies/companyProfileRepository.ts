import type { DatabaseSync } from 'node:sqlite';
import type { CompanyAddress, CompanyProfile, CompanyProfileInput } from '@shared/types/companyProfile';

interface CompanyProfileRow {
  branch_code: string;
  display_name: string | null;
  legal_name: string | null;
  trade_name: string | null;
  cnpj: string | null;
  address_json: string | null;
  logo_path: string | null;
  group_key: string | null;
  active: number;
  updated_at: string;
}

function rowToProfile(row: CompanyProfileRow): CompanyProfile {
  let address: CompanyAddress | null = null;
  if (row.address_json) {
    try {
      address = JSON.parse(row.address_json) as CompanyAddress;
    } catch {
      address = null;
    }
  }
  return {
    branchCode: row.branch_code,
    displayName: row.display_name ?? '',
    legalName: row.legal_name,
    tradeName: row.trade_name,
    cnpj: row.cnpj,
    address,
    logoPath: row.logo_path,
    groupKey: row.group_key,
    active: row.active !== 0,
    updatedAt: row.updated_at
  };
}

export function listCompanyProfiles(db: DatabaseSync): CompanyProfile[] {
  const rows = db
    .prepare('SELECT * FROM company_profiles ORDER BY branch_code')
    .all() as unknown as CompanyProfileRow[];
  return rows.map(rowToProfile);
}

export function getCompanyProfile(db: DatabaseSync, branchCode: string): CompanyProfile | null {
  const row = db.prepare('SELECT * FROM company_profiles WHERE branch_code = ?').get(branchCode) as
    | CompanyProfileRow
    | undefined;
  return row ? rowToProfile(row) : null;
}

export function upsertCompanyProfile(db: DatabaseSync, input: CompanyProfileInput): CompanyProfile {
  const now = new Date().toISOString();
  const addressJson = input.address ? JSON.stringify(input.address) : null;
  db.prepare(
    `INSERT INTO company_profiles
       (branch_code, display_name, legal_name, trade_name, cnpj, address_json, group_key, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(branch_code) DO UPDATE SET
       display_name = excluded.display_name,
       legal_name = excluded.legal_name,
       trade_name = excluded.trade_name,
       cnpj = excluded.cnpj,
       address_json = excluded.address_json,
       group_key = excluded.group_key,
       active = excluded.active,
       updated_at = excluded.updated_at`
  ).run(
    input.branchCode,
    input.displayName,
    input.legalName ?? null,
    input.tradeName ?? null,
    input.cnpj ?? null,
    addressJson,
    input.groupKey ?? null,
    input.active === false ? 0 : 1,
    now
  );
  return getCompanyProfile(db, input.branchCode) as CompanyProfile;
}

export function setCompanyProfileLogo(db: DatabaseSync, branchCode: string, logoPath: string): void {
  db.prepare('UPDATE company_profiles SET logo_path = ?, updated_at = ? WHERE branch_code = ?').run(
    logoPath,
    new Date().toISOString(),
    branchCode
  );
}

export function setCompanyProfileActive(db: DatabaseSync, branchCode: string, active: boolean): CompanyProfile | null {
  db.prepare('UPDATE company_profiles SET active = ?, updated_at = ? WHERE branch_code = ?').run(
    active ? 1 : 0,
    new Date().toISOString(),
    branchCode
  );
  return getCompanyProfile(db, branchCode);
}

/** Raw delete: never checks for linked history. Callers must use the service-level safe delete instead. */
export function deleteCompanyProfileRecord(db: DatabaseSync, branchCode: string): void {
  db.prepare('DELETE FROM company_profiles WHERE branch_code = ?').run(branchCode);
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
 * Seed-safe upsert: inserts the branch if it does not exist yet; otherwise
 * only fills currently-empty fields (including per-field inside `address`),
 * never overwriting anything already set - whether set by a user or by a
 * previous seed run. `active` and `logoPath` are never touched here.
 */
export function fillEmptyCompanyProfileFields(db: DatabaseSync, seed: CompanyProfileInput): CompanyProfile {
  const existing = getCompanyProfile(db, seed.branchCode);
  if (!existing) {
    return upsertCompanyProfile(db, seed);
  }
  return upsertCompanyProfile(db, {
    branchCode: existing.branchCode,
    displayName: existing.displayName || seed.displayName,
    legalName: existing.legalName || seed.legalName || null,
    tradeName: existing.tradeName || seed.tradeName || null,
    cnpj: existing.cnpj || seed.cnpj || null,
    address: mergeAddress(existing.address, seed.address ?? null),
    groupKey: existing.groupKey || seed.groupKey || null,
    active: existing.active
  });
}
