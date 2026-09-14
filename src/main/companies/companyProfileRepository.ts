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
       (branch_code, display_name, legal_name, trade_name, cnpj, address_json, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(branch_code) DO UPDATE SET
       display_name = excluded.display_name,
       legal_name = excluded.legal_name,
       trade_name = excluded.trade_name,
       cnpj = excluded.cnpj,
       address_json = excluded.address_json,
       active = excluded.active,
       updated_at = excluded.updated_at`
  ).run(
    input.branchCode,
    input.displayName,
    input.legalName ?? null,
    input.tradeName ?? null,
    input.cnpj ?? null,
    addressJson,
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
