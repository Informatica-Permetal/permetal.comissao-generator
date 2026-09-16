import Decimal from 'decimal.js';
import type { GroupingMode } from '@shared/types/history';

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

function groupsBySeller<TRow>(groups: readonly DocumentGroup<TRow>[]): Map<string, DocumentGroup<TRow>[]> {
  const bySeller = new Map<string, DocumentGroup<TRow>[]>();
  for (const group of groups) {
    const list = bySeller.get(group.sellerCode) ?? [];
    list.push(group);
    bySeller.set(group.sellerCode, list);
  }
  return bySeller;
}

/** A seller whose rows span more than one branch within the same import. */
export interface MultiBranchSellerSummary {
  sellerCode: string;
  sellerName: string;
  branchCodes: string[];
}

/**
 * Sellers with rows in 2+ branches within `groups` - the ones eligible for
 * the separado/consolidado choice. Deliberately not generic over `TRow`
 * (only identity fields matter here) so it accepts groups from either mode
 * without forcing callers to disambiguate a union type.
 */
export function findMultiBranchSellers(groups: readonly DocumentIdentity[]): MultiBranchSellerSummary[] {
  const bySeller = new Map<string, { sellerName: string; branchCodes: string[] }>();
  for (const group of groups) {
    const entry = bySeller.get(group.sellerCode) ?? { sellerName: group.sellerName, branchCodes: [] };
    entry.branchCodes.push(group.branchCode);
    bySeller.set(group.sellerCode, entry);
  }
  return [...bySeller.entries()]
    .filter(([, entry]) => entry.branchCodes.length > 1)
    .map(([sellerCode, entry]) => ({ sellerCode, sellerName: entry.sellerName, branchCodes: entry.branchCodes }));
}

/** One seller's rows merged across every branch chosen for consolidation - never recalculates any amount, only sums already-computed per-branch `Decimal` totals. */
export interface ConsolidatedSellerGroup<TRow> {
  sellerCode: string;
  sellerName: string;
  /** Per-branch breakdown, in first-appearance order - each branch's own rows and its own (never-recalculated) subtotal. */
  branches: DocumentGroup<TRow>[];
  rowCount: number;
  total: Decimal;
}

export type PublishUnit<TRow> =
  | { groupingMode: 'separate_by_branch'; group: DocumentGroup<TRow> }
  | { groupingMode: 'consolidated_by_seller'; group: ConsolidatedSellerGroup<TRow> };

export function isSeparateUnit<TRow>(
  unit: PublishUnit<TRow>
): unit is Extract<PublishUnit<TRow>, { groupingMode: 'separate_by_branch' }> {
  return unit.groupingMode === 'separate_by_branch';
}

export function isConsolidatedUnit<TRow>(
  unit: PublishUnit<TRow>
): unit is Extract<PublishUnit<TRow>, { groupingMode: 'consolidated_by_seller' }> {
  return unit.groupingMode === 'consolidated_by_seller';
}

function mergeIntoConsolidatedGroup<TRow>(branchGroups: readonly DocumentGroup<TRow>[]): ConsolidatedSellerGroup<TRow> {
  let total = new Decimal(0);
  let rowCount = 0;
  for (const branch of branchGroups) {
    total = total.plus(branch.total);
    rowCount += branch.rows.length;
  }
  return {
    sellerCode: branchGroups[0].sellerCode,
    sellerName: branchGroups[0].sellerName,
    branches: [...branchGroups],
    rowCount,
    total
  };
}

/**
 * Turns the flat per-(branch, seller) `groups` into the actual units to publish, applying the
 * user's per-seller grouping choice. A seller absent from `modeBySeller` (or with only one
 * branch, for whom the choice is moot) always publishes `separate_by_branch` - the default is
 * never inferred, it is simply "no explicit consolidated choice was made for this seller".
 */
export function resolvePublishUnits<TRow>(
  groups: readonly DocumentGroup<TRow>[],
  modeBySeller: ReadonlyMap<string, GroupingMode>
): PublishUnit<TRow>[] {
  const units: PublishUnit<TRow>[] = [];
  for (const [sellerCode, branchGroups] of groupsBySeller(groups)) {
    const mode = branchGroups.length > 1 ? modeBySeller.get(sellerCode) ?? 'separate_by_branch' : 'separate_by_branch';
    if (mode === 'consolidated_by_seller') {
      units.push({ groupingMode: 'consolidated_by_seller', group: mergeIntoConsolidatedGroup(branchGroups) });
    } else {
      for (const group of branchGroups) {
        units.push({ groupingMode: 'separate_by_branch', group });
      }
    }
  }
  return units;
}
