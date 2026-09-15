import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ReportMode } from '@shared/constants/folders';
import { resolveModeSubfolderPath } from '../app/folderNames';

const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const WHITESPACE_PATTERN = /\s+/g;
const REPEATED_UNDERSCORE_PATTERN = /_+/g;

export function sanitizeFilenamePart(text: string): string {
  return text
    .trim()
    .replace(ILLEGAL_FILENAME_CHARS, '')
    .replace(WHITESPACE_PATTERN, '_')
    .replace(REPEATED_UNDERSCORE_PATTERN, '_');
}

export function buildPdfFileName(
  mode: ReportMode,
  generatedAt: Date,
  branchCode: string,
  sellerCode: string,
  sellerName: string
): string {
  const datePart = generatedAt.toISOString().slice(0, 10);
  const modeLabel = mode === 'Previsao' ? 'PREVISAO' : 'RELACAO';
  const sellerNamePart = sanitizeFilenamePart(sellerName).toUpperCase();
  const branchPart = sanitizeFilenamePart(branchCode);
  const sellerCodePart = sanitizeFilenamePart(sellerCode);
  return `${datePart}_${modeLabel}_${branchPart}_${sellerCodePart}_${sellerNamePart}.pdf`;
}

export function resolveGeradosDir(reportRoot: string, mode: ReportMode): string {
  return resolveModeSubfolderPath(reportRoot, mode, 'Gerados');
}

/** Never overwrites an existing file; appends a numeric suffix when the name collides. */
export function resolveUniqueOutputPath(dir: string, fileName: string): string {
  mkdirSync(dir, { recursive: true });
  const candidate = join(dir, fileName);
  if (!existsSync(candidate)) return candidate;

  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const ext = dotIndex === -1 ? '' : fileName.slice(dotIndex);

  let suffix = 2;
  let next = join(dir, `${base}_${suffix}${ext}`);
  while (existsSync(next)) {
    suffix++;
    next = join(dir, `${base}_${suffix}${ext}`);
  }
  return next;
}
