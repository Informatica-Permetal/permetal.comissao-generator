import Decimal from 'decimal.js';

export interface DocumentIdentity {
  branchCode: string;
  branchName: string;
  sellerCode: string;
  sellerName: string;
}

export interface DocumentGroup<TRow> extends DocumentIdentity {
  rows: TRow[];
  total: Decimal;
}

const GROUP_KEY_SEPARATOR = '|';

/**
 * Groups rows strictly by (branch_code, seller_code) and sums only the
 * caller-provided authoritative amount - no row is ever dropped or merged,
 * duplicate-looking rows each contribute their own amount to the total.
 */
export function groupRows<TRow>(
  rows: readonly TRow[],
  identityOf: (row: TRow) => DocumentIdentity,
  amountOf: (row: TRow) => Decimal
): DocumentGroup<TRow>[] {
  const groupsByKey = new Map<string, DocumentGroup<TRow>>();

  for (const row of rows) {
    const identity = identityOf(row);
    const key = identity.branchCode + GROUP_KEY_SEPARATOR + identity.sellerCode;
    let group = groupsByKey.get(key);
    if (!group) {
      group = { ...identity, rows: [], total: new Decimal(0) };
      groupsByKey.set(key, group);
    }
    group.rows.push(row);
    group.total = group.total.plus(amountOf(row));
  }

  return [...groupsByKey.values()];
}
