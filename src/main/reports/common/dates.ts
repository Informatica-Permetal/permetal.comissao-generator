const DATE_ONLY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * Reads only the calendar date, always via UTC getters/constructors, so the
 * noon-UTC timestamps these Smart View exports use never drift to the
 * previous/next day regardless of the machine's local timezone.
 */
export function parseCalendarDate(raw: unknown): Date | null {
  if (raw == null) return null;

  if (raw instanceof Date) {
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }

  const text = String(raw).trim();
  if (text === '') return null;

  const match = DATE_ONLY_PATTERN.exec(text);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
