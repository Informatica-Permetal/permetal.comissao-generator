import type { ReportMode } from '@shared/constants/folders';

export class MissingHeadersError extends Error {
  readonly mode: ReportMode;
  readonly missingHeaders: string[];

  constructor(mode: ReportMode, missingHeaders: string[]) {
    super(`Colunas obrigatorias ausentes para o modo ${mode}: ${missingHeaders.join(', ')}`);
    this.name = 'MissingHeadersError';
    this.mode = mode;
    this.missingHeaders = missingHeaders;
  }
}

export class WrongModeError extends Error {
  readonly expectedMode: ReportMode;
  readonly detectedMode: ReportMode;

  constructor(expectedMode: ReportMode, detectedMode: ReportMode) {
    super(`O arquivo parece ser de ${detectedMode}, mas o modo selecionado foi ${expectedMode}.`);
    this.name = 'WrongModeError';
    this.expectedMode = expectedMode;
    this.detectedMode = detectedMode;
  }
}
