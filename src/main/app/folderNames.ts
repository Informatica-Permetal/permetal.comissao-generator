import { join } from 'node:path';
import type { ModeSubfolder, ReportMode } from '@shared/constants/folders';

/**
 * Physical, user-visible folder name for each report mode's top-level folder
 * on disk. The internal `ReportMode` keys ('Previsao', 'Relacao') stay ASCII
 * everywhere else in the codebase (types, IPC payloads, SQLite `mode`
 * column) - only the actual folder name shown in Explorer changes here.
 */
export const MODE_FOLDER_NAME: Record<ReportMode, string> = {
  Previsao: 'Previsão',
  Relacao: 'Relação'
};

/**
 * Physical, user-visible folder name for each mode subfolder. Internal
 * `ModeSubfolder` keys stay ASCII; only `Historico` differs from its key.
 */
export const SUBFOLDER_FOLDER_NAME: Record<ModeSubfolder, string> = {
  Entrada: 'Entrada',
  Processamento: 'Processamento',
  Processados: 'Processados',
  Gerados: 'Gerados',
  Historico: 'Histórico'
};

/** The exact legacy (pre-accent) physical names this app ever wrote to disk, for migration. */
export const LEGACY_MODE_FOLDER_NAME: Record<ReportMode, string> = {
  Previsao: 'Previsao',
  Relacao: 'Relacao'
};

export const LEGACY_HISTORICO_FOLDER_NAME = 'Historico';

/** Legacy (pre-accent) product folder name, used only by the one-time migration. */
export const LEGACY_APP_NAME = 'Formatador Comissao';

export function resolveModeSubfolderPath(reportRoot: string, mode: ReportMode, subfolder: ModeSubfolder): string {
  return join(reportRoot, MODE_FOLDER_NAME[mode], SUBFOLDER_FOLDER_NAME[subfolder]);
}

export function resolveModeDir(reportRoot: string, mode: ReportMode): string {
  return join(reportRoot, MODE_FOLDER_NAME[mode]);
}

export function resolveEntradaDir(reportRoot: string, mode: ReportMode): string {
  return resolveModeSubfolderPath(reportRoot, mode, 'Entrada');
}
