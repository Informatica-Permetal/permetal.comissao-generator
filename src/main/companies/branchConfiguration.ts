import type { CompanyProfile } from '@shared/types/companyProfile';

/** Distinct branch codes present in `groups` that have no configured company profile. */
export function findUnconfiguredBranchCodes(
  groups: readonly { branchCode: string }[],
  lookupCompanyProfile: (branchCode: string) => CompanyProfile | null
): string[] {
  return [
    ...new Set(groups.filter((group) => !lookupCompanyProfile(group.branchCode)).map((group) => group.branchCode))
  ];
}
