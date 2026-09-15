import type { ReportMode } from '@shared/constants/folders';

/**
 * Display-only label for a report mode. The internal `ReportMode` value
 * ('Previsao' | 'Relacao') stays ASCII everywhere else (types, IPC, form
 * values) - this is the one place it gets its accented, user-visible form.
 */
export const MODE_DISPLAY_LABEL: Record<ReportMode, string> = {
  Previsao: 'Previsão',
  Relacao: 'Relação'
};

export function modeDisplayLabel(mode: ReportMode): string {
  return MODE_DISPLAY_LABEL[mode];
}
