import Decimal from 'decimal.js';

/**
 * Parses a cell that may be a native Excel number or a Brazilian-formatted
 * string ("." thousands separator, "," decimal separator). Never rounds or
 * loses precision - callers get an arbitrary-precision Decimal.
 */
export function parseBrazilianDecimal(raw: unknown, fieldName: string): Decimal | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return new Decimal(raw);
  const text = String(raw).trim();
  if (text === '') return null;

  const normalized = text.replace(/\./g, '').replace(',', '.');
  try {
    return new Decimal(normalized);
  } catch {
    throw new Error(`Valor numerico invalido no campo "${fieldName}": "${text}"`);
  }
}
