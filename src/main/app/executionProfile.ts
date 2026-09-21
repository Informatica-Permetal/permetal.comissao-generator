export type ExecutionProfile = 'PRODUCTION' | 'DEV' | 'HOMOLOGATION';

const EXECUTION_PROFILE_ENV_VAR = 'FC_EXECUTION_PROFILE';

/** The only values `FC_EXECUTION_PROFILE` may request on a packaged build. */
const VALID_PACKAGED_OVERRIDES: readonly ExecutionProfile[] = ['HOMOLOGATION'];

/**
 * `npm run dev` (electron-vite dev) always runs unpackaged - that alone determines
 * DEV, unconditionally, before any environment variable is even considered. A packaged
 * build (an installed Setup, or `electron-builder --dir`'s `win-unpacked`) is
 * PRODUCTION unless `FC_EXECUTION_PROFILE` explicitly requests HOMOLOGATION - never
 * inferred from the executable's own path (e.g. "contains win-unpacked"), which would
 * be a fragile heuristic a user could defeat just by copying the folder.
 *
 * Any other value for the env var (a typo, an old/removed profile name) throws rather
 * than silently falling back to PRODUCTION - a misconfigured flag must never cause a
 * homologation run to silently touch real production data, or vice versa.
 */
export function resolveExecutionProfile(isPackaged: boolean, env: NodeJS.ProcessEnv = process.env): ExecutionProfile {
  if (!isPackaged) return 'DEV';

  const override = env[EXECUTION_PROFILE_ENV_VAR];
  if (override === undefined || override === '') return 'PRODUCTION';
  if ((VALID_PACKAGED_OVERRIDES as readonly string[]).includes(override)) {
    return override as ExecutionProfile;
  }

  throw new Error(
    `Valor invalido para ${EXECUTION_PROFILE_ENV_VAR}: "${override}". Valores aceitos num build empacotado: ` +
      `${VALID_PACKAGED_OVERRIDES.join(', ')} (ou deixe a variavel sem definir, para PRODUCTION).`
  );
}

/** Folder-name suffix appended to the product name for non-production profiles - PRODUCTION's is empty, so its path is byte-identical to before this profile system existed. */
export const PROFILE_FOLDER_SUFFIX: Record<ExecutionProfile, string> = {
  PRODUCTION: '',
  DEV: ' Dev',
  HOMOLOGATION: ' Homologação'
};

export function resolveProfileAppName(baseAppName: string, profile: ExecutionProfile): string {
  return `${baseAppName}${PROFILE_FOLDER_SUFFIX[profile]}`;
}
