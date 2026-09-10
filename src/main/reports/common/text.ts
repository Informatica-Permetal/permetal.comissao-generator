const NBSP_CODE = 160;
const COMBINING_DIACRITIC_RANGE_START = 768;
const COMBINING_DIACRITIC_RANGE_END = 879;

function isNbsp(char: string): boolean {
  return char.charCodeAt(0) === NBSP_CODE;
}

function isCombiningDiacritic(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= COMBINING_DIACRITIC_RANGE_START && code <= COMBINING_DIACRITIC_RANGE_END;
}

/**
 * Canonical form used only for header matching: NBSP/whitespace collapsed,
 * accents stripped, case-folded. Diagnostics must keep showing the raw header.
 */
export function normalizeHeader(raw: unknown): string {
  const text = raw == null ? '' : String(raw);
  const withoutNbsp = Array.from(text)
    .map((char) => (isNbsp(char) ? ' ' : char))
    .join('');
  const collapsedWhitespace = withoutNbsp.trim().split(/\s+/).join(' ');
  const decomposed = collapsedWhitespace.normalize('NFD');
  const withoutAccents = Array.from(decomposed)
    .filter((char) => !isCombiningDiacritic(char))
    .join('');
  return withoutAccents.toLowerCase();
}

export interface CodeNamePair {
  raw: string;
  codigo: string;
  nome: string;
}

/**
 * Splits compound "CODE - NAME" cells (e.g. "000001 - ADEMIR FURLANETO") on the
 * first " - " only, so hyphens inside the name never break the code.
 */
export function parseCodeNamePair(raw: unknown): CodeNamePair {
  const text = raw == null ? '' : String(raw).trim();
  const separatorIndex = text.indexOf(' - ');
  if (separatorIndex === -1) {
    return { raw: text, codigo: text, nome: '' };
  }
  return {
    raw: text,
    codigo: text.slice(0, separatorIndex).trim(),
    nome: text.slice(separatorIndex + 3).trim()
  };
}

export function cellToTrimmedString(raw: unknown): string {
  return raw == null ? '' : String(raw).trim();
}

export function cellToNullableTrimmedString(raw: unknown): string | null {
  const text = cellToTrimmedString(raw);
  return text === '' ? null : text;
}
