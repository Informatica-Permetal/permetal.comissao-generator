import { isAbsolute, join, relative, sep } from 'node:path';
import { LEGACY_HISTORICO_FOLDER_NAME, LEGACY_MODE_FOLDER_NAME, MODE_FOLDER_NAME, SUBFOLDER_FOLDER_NAME } from '../app/folderNames';
import type { ReportMode } from '@shared/constants/folders';

const LEGACY_MODE_FOLDER_TO_KEY: Record<string, ReportMode> = Object.fromEntries(
  (Object.entries(LEGACY_MODE_FOLDER_NAME) as [ReportMode, string][]).map(([key, legacyName]) => [legacyName, key])
);

/**
 * Simple prefix swap for a path that lives under a directory that itself got
 * renamed, with no other structural change (e.g. the app's internal
 * `userData` folder). Returns the path unchanged if it is null or does not
 * actually live under `oldPrefix`.
 */
export function remapPathPrefix(oldPrefix: string, newPrefix: string, absolutePath: string | null): string | null {
  if (!absolutePath) return absolutePath;
  if (absolutePath === oldPrefix) return newPrefix;
  const withSep = oldPrefix.endsWith(sep) ? oldPrefix : oldPrefix + sep;
  if (!absolutePath.startsWith(withSep)) return absolutePath;
  return newPrefix + absolutePath.slice(oldPrefix.length);
}

/**
 * Remaps an absolute path that lives under a report root whose internal
 * `<mode>/<subfolder>/...` structure is being renamed to its accented
 * physical names (Previsao -> Previsão, Relacao -> Relação, and the
 * Historico subfolder -> Histórico). Only the mode segment and the
 * Historico subfolder segment are ever renamed; every other path segment
 * (Entrada, Processamento, Processados, Gerados, year/month/batchId/file
 * names) is preserved exactly.
 *
 * Returns the path unchanged if it is null or does not live under
 * `oldReportRoot` at all (e.g. an externally-selected source file) - this
 * function only ever touches paths that are genuinely inside the tree being
 * migrated.
 */
export function remapLegacyReportPath(
  oldReportRoot: string,
  newReportRoot: string,
  absolutePath: string | null
): string | null {
  if (!absolutePath) return absolutePath;

  const rel = relative(oldReportRoot, absolutePath);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return absolutePath;

  const segments = rel.split(sep);
  const [modeSegment, subfolderSegment, ...rest] = segments;

  const modeKey = LEGACY_MODE_FOLDER_TO_KEY[modeSegment];
  if (!modeKey) return absolutePath; // not a recognizable mode folder - leave untouched, defensive

  const newModeSegment = MODE_FOLDER_NAME[modeKey];
  if (subfolderSegment === undefined) {
    return join(newReportRoot, newModeSegment);
  }

  const newSubfolderSegment =
    subfolderSegment === LEGACY_HISTORICO_FOLDER_NAME ? SUBFOLDER_FOLDER_NAME.Historico : subfolderSegment;

  return join(newReportRoot, newModeSegment, newSubfolderSegment, ...rest);
}
