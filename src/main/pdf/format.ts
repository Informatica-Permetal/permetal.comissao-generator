import type Decimal from 'decimal.js';

const THOUSANDS_SEPARATOR_PATTERN = /\B(?=(\d{3})+(?!\d))/g;

export function formatDateBR(date: Date | null): string {
  if (!date) return '-';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Displays with 2 decimals (BRL convention); the Decimal itself keeps full precision. */
export function formatCurrencyBRL(value: Decimal | null): string {
  if (!value) return '-';
  const fixed = value.toFixed(2);
  const negative = fixed.startsWith('-');
  const [intPart, decPart] = (negative ? fixed.slice(1) : fixed).split('.');
  const withThousands = intPart.replace(THOUSANDS_SEPARATOR_PATTERN, '.');
  return `${negative ? '-' : ''}R$ ${withThousands},${decPart}`;
}

/** Displays the source percentage as-is (never recalculated), comma decimal, % suffix. */
export function formatPercent(value: Decimal | null): string {
  if (!value) return '-';
  return `${value.toFixed(2).replace('.', ',')}%`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
