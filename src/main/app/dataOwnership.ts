import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Marker file written once, directly inside the report root, the moment the
 * app creates it (see `reportRoot.ts`). Its only purpose is to let the
 * uninstaller's data-cleanup path know EXACTLY what this app is responsible
 * for at that location, instead of trusting the folder just because the
 * settings database happens to point at it. No deletion of report-root
 * content may ever proceed without reading this file first - see
 * `uninstallPlan.ts`.
 */
export const REPORT_ROOT_MANIFEST_FILENAME = '.formador-comissao-report-root.json';

export interface ReportRootManifest {
  schemaVersion: 1;
  appId: string;
  createdAt: string;
  /** Top-level folder names, directly inside the report root, that this app created and manages. */
  managedTopLevelNames: string[];
}

function resolveManifestPath(root: string): string {
  return join(root, REPORT_ROOT_MANIFEST_FILENAME);
}

/** Idempotent: never overwrites an existing manifest (its `createdAt` should reflect the original setup, not a later reinstall/upgrade). */
export function writeReportRootManifestIfMissing(root: string, appId: string, managedTopLevelNames: string[]): void {
  const manifestPath = resolveManifestPath(root);
  if (existsSync(manifestPath)) return;

  const manifest: ReportRootManifest = {
    schemaVersion: 1,
    appId,
    createdAt: new Date().toISOString(),
    managedTopLevelNames
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

/** Returns `null` for anything that isn't a valid, well-formed manifest - a missing or corrupt/foreign file must never be treated as proof of ownership. */
export function readReportRootManifest(root: string): ReportRootManifest | null {
  const manifestPath = resolveManifestPath(root);
  if (!existsSync(manifestPath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
    if (!isValidManifestShape(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isValidManifestShape(value: unknown): value is ReportRootManifest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate['schemaVersion'] === 1 &&
    typeof candidate['appId'] === 'string' &&
    typeof candidate['createdAt'] === 'string' &&
    Array.isArray(candidate['managedTopLevelNames']) &&
    candidate['managedTopLevelNames'].every((name) => typeof name === 'string')
  );
}
