export const REPORT_MODES = ['Previsao', 'Relacao'] as const;
export type ReportMode = (typeof REPORT_MODES)[number];

export const MODE_SUBFOLDERS = ['Entrada', 'Processamento', 'Processados', 'Gerados', 'Historico'] as const;
export type ModeSubfolder = (typeof MODE_SUBFOLDERS)[number];
