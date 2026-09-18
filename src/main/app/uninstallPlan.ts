import { rmSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { join, parse, sep } from 'node:path';
import { readReportRootManifest, REPORT_ROOT_MANIFEST_FILENAME } from './dataOwnership';

/**
 * Safe, opt-in cleanup of app-managed data for the uninstaller's "Também
 * excluir dados e documentos" checkbox. Two-phase by design: `buildUninstallPlan`
 * decides WHAT may be deleted (every safety check lives here, never in the
 * execute step), `executeUninstallPlan` blindly deletes exactly what the plan
 * already vetted. Preserving data is always the default - this module is
 * only ever consulted when the user has explicitly opted in.
 */

export interface SpecialFolders {
  home: string;
  documents: string;
  desktop: string;
  downloads: string;
}

export interface UninstallItem {
  label: string;
  path: string;
}

export interface BlockedPath {
  path: string;
  reason: string;
}

export interface UninstallPlan {
  items: UninstallItem[];
  blocked: BlockedPath[];
}

export interface BuildUninstallPlanInput {
  appId: string;
  /** The app's own dedicated AppData folder - always a fixed, code-controlled path, but still checked defensively, never assumed safe. */
  appDataPath: string | null;
  /** The user-chosen report root, as currently stored in settings - `null` if never configured. */
  reportRoot: string | null;
  /** The current code's known set of top-level folder names it creates inside a report root (e.g. "Previsão", "Relação"). */
  managedTopLevelNames: readonly string[];
  special: SpecialFolders;
}

/** Resolves symlinks/junctions to the real underlying path - `null` if the path does not exist. Never guesses; a path that can't be resolved is never treated as deletable. */
export function resolveCanonicalIfExists(targetPath: string): string | null {
  try {
    return realpathSync.native(targetPath);
  } catch {
    return null;
  }
}

function normalizeForCompare(p: string): string {
  return p.toLowerCase();
}

function isDriveRoot(resolvedPath: string): boolean {
  const root = parse(resolvedPath).root;
  return root.length > 0 && normalizeForCompare(root) === normalizeForCompare(resolvedPath);
}

/**
 * Returns a human-readable block reason, or `null` if the path is not one of
 * the hard-blocked broad locations. Exact-match only (never blocks a
 * legitimate subfolder of one of these, e.g. the suggested default report
 * root under Documents).
 *
 * Each special folder is re-resolved to its own canonical form before
 * comparing (falling back to the raw value if that fails) - Windows can
 * report the very same directory via different aliases (short 8.3 names like
 * `INFORM~1` vs the long form) depending on how a path was obtained, and
 * `canonicalPath` is always already-canonical (see `resolveCanonicalIfExists`).
 * Comparing an un-canonicalized special folder against it would silently miss
 * a real match.
 */
export function findHardBlockReason(canonicalPath: string, special: SpecialFolders): string | null {
  if (isDriveRoot(canonicalPath)) {
    return 'É a raiz de uma unidade de disco.';
  }
  const checks: ReadonlyArray<readonly [string, string]> = [
    [special.home, 'É a pasta de perfil do usuário.'],
    [special.documents, 'É a pasta Documentos.'],
    [special.desktop, 'É a pasta Área de Trabalho.'],
    [special.downloads, 'É a pasta Downloads.']
  ];
  const target = normalizeForCompare(canonicalPath);
  for (const [specialPath, reason] of checks) {
    if (!specialPath) continue;
    const canonicalSpecialPath = resolveCanonicalIfExists(specialPath) ?? specialPath;
    if (normalizeForCompare(canonicalSpecialPath) === target) return reason;
  }
  return null;
}

/** Whether `child` (already canonical) lies inside `parent` (already canonical) - guards a managed subfolder that was swapped for a symlink/junction pointing outside the report root. */
function isWithin(parentCanonical: string, childCanonical: string): boolean {
  const parentWithSep = parentCanonical.endsWith(sep) ? parentCanonical : parentCanonical + sep;
  return normalizeForCompare(childCanonical).startsWith(normalizeForCompare(parentWithSep));
}

export function buildUninstallPlan(input: BuildUninstallPlanInput): UninstallPlan {
  const items: UninstallItem[] = [];
  const blocked: BlockedPath[] = [];

  if (input.appDataPath) {
    const appDataCanonical = resolveCanonicalIfExists(input.appDataPath);
    if (appDataCanonical) {
      const blockReason = findHardBlockReason(appDataCanonical, input.special);
      if (blockReason) {
        blocked.push({ path: input.appDataPath, reason: blockReason });
      } else {
        items.push({ label: 'Dados do aplicativo (configurações, histórico, logs)', path: appDataCanonical });
      }
    }
  }

  if (input.reportRoot) {
    const rootCanonical = resolveCanonicalIfExists(input.reportRoot);
    if (!rootCanonical) {
      // Configured but no longer exists on disk - nothing to protect or delete.
    } else {
      const blockReason = findHardBlockReason(rootCanonical, input.special);
      if (blockReason) {
        blocked.push({ path: input.reportRoot, reason: blockReason });
      } else {
        const manifest = readReportRootManifest(rootCanonical);
        if (!manifest || manifest.appId !== input.appId) {
          blocked.push({
            path: input.reportRoot,
            reason: 'Nenhum registro comprovando que esta pasta é gerenciada pelo Formatador Comissão foi encontrado.'
          });
        } else {
          const namesToConsider = manifest.managedTopLevelNames.filter((name) =>
            input.managedTopLevelNames.includes(name)
          );
          for (const name of namesToConsider) {
            const candidatePath = join(input.reportRoot, name);
            const candidateCanonical = resolveCanonicalIfExists(candidatePath);
            if (!candidateCanonical) continue;
            if (!isWithin(rootCanonical, candidateCanonical)) continue;
            items.push({ label: `Pasta "${name}"`, path: candidateCanonical });
          }
          const manifestPath = join(input.reportRoot, REPORT_ROOT_MANIFEST_FILENAME);
          if (resolveCanonicalIfExists(manifestPath)) {
            items.push({ label: 'Registro de propriedade da pasta', path: manifestPath });
          }
        }
      }
    }
  }

  return { items, blocked };
}

export interface ExecuteUninstallPlanResult {
  deletedPaths: string[];
  errors: Array<{ path: string; error: string }>;
}

/** Deletes exactly - and only - the paths the plan already vetted. Performs no validation of its own; every safety decision belongs in `buildUninstallPlan`. */
export function executeUninstallPlan(plan: UninstallPlan): ExecuteUninstallPlanResult {
  const deletedPaths: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const item of plan.items) {
    try {
      rmSync(item.path, { recursive: true, force: true });
      deletedPaths.push(item.path);
    } catch (error) {
      errors.push({ path: item.path, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { deletedPaths, errors };
}
