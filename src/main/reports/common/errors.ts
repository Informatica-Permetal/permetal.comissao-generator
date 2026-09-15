import type { ReportMode } from '@shared/constants/folders';

export class MissingHeadersError extends Error {
  readonly mode: ReportMode;
  readonly missingHeaders: string[];

  constructor(mode: ReportMode, missingHeaders: string[]) {
    super(`Colunas obrigatórias ausentes para o modo ${mode}: ${missingHeaders.join(', ')}`);
    this.name = 'MissingHeadersError';
    this.mode = mode;
    this.missingHeaders = missingHeaders;
  }
}

/**
 * Raised when a required header's normalized name matches more than one
 * column in the sheet and the app cannot safely pick one without depending on
 * column position - e.g. Previsao's Smart View export can contain two columns
 * both literally named "Vencimento". Never resolved automatically; the user
 * must fix the export and re-select only the intended column in Smart View.
 */
export class AmbiguousHeaderError extends Error {
  readonly mode: ReportMode;
  readonly header: string;
  readonly occurrences: number;

  constructor(mode: ReportMode, header: string, occurrences: number) {
    super(
      `A coluna "${header}" aparece ${occurrences} vezes no arquivo. No Smart View, deixe selecionado apenas o segundo campo "${header}" (o que aparece mais abaixo na lista de colunas) e gere o relatório novamente.`
    );
    this.name = 'AmbiguousHeaderError';
    this.mode = mode;
    this.header = header;
    this.occurrences = occurrences;
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
