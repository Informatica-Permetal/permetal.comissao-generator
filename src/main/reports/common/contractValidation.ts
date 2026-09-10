import type ExcelJS from 'exceljs';
import { normalizeHeader } from './text';

export interface FieldDefinition {
  key: string;
  canonicalHeader: string;
}

export interface HeaderMatch {
  field: FieldDefinition;
  columnNumber: number;
  actualHeader: string;
}

export interface ContractValidationResult {
  headerRowNumber: number;
  matches: HeaderMatch[];
  missingFields: FieldDefinition[];
}

const MAX_HEADER_ROW_SCAN = 5;

/**
 * Locates the header row within the first few rows (preferring row 1 when it
 * already satisfies every required field) and matches each required field by
 * normalized header name. Column order never matters.
 */
export function locateAndMatchHeaders(
  sheet: ExcelJS.Worksheet,
  fields: readonly FieldDefinition[]
): ContractValidationResult {
  const lastRowToScan = Math.min(MAX_HEADER_ROW_SCAN, sheet.rowCount);
  let bestCandidate: ContractValidationResult | null = null;

  for (let rowNumber = 1; rowNumber <= lastRowToScan; rowNumber++) {
    const candidate = matchHeadersInRow(sheet, rowNumber, fields);
    if (candidate.missingFields.length === 0) {
      return candidate;
    }
    if (!bestCandidate || candidate.matches.length > bestCandidate.matches.length) {
      bestCandidate = candidate;
    }
  }

  return bestCandidate ?? { headerRowNumber: 1, matches: [], missingFields: [...fields] };
}

function matchHeadersInRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  fields: readonly FieldDefinition[]
): ContractValidationResult {
  const row = sheet.getRow(rowNumber);
  const byNormalizedHeader = new Map<string, { columnNumber: number; actualHeader: string }>();

  row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const actualHeader = cell.value == null ? '' : String(cell.value);
    const normalized = normalizeHeader(actualHeader);
    if (normalized && !byNormalizedHeader.has(normalized)) {
      byNormalizedHeader.set(normalized, { columnNumber, actualHeader });
    }
  });

  const matches: HeaderMatch[] = [];
  const missingFields: FieldDefinition[] = [];
  for (const field of fields) {
    const found = byNormalizedHeader.get(normalizeHeader(field.canonicalHeader));
    if (found) {
      matches.push({ field, columnNumber: found.columnNumber, actualHeader: found.actualHeader });
    } else {
      missingFields.push(field);
    }
  }

  return { headerRowNumber: rowNumber, matches, missingFields };
}

/** Collects every normalized header found in the first few rows, for wrong-mode detection. */
export function collectNormalizedHeaders(sheet: ExcelJS.Worksheet): Set<string> {
  const headers = new Set<string>();
  const lastRowToScan = Math.min(MAX_HEADER_ROW_SCAN, sheet.rowCount);
  for (let rowNumber = 1; rowNumber <= lastRowToScan; rowNumber++) {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => {
      const normalized = normalizeHeader(cell.value == null ? '' : String(cell.value));
      if (normalized) headers.add(normalized);
    });
  }
  return headers;
}

export function headersIncludeAllMarkers(headers: ReadonlySet<string>, markers: readonly string[]): boolean {
  return markers.every((marker) => headers.has(normalizeHeader(marker)));
}
