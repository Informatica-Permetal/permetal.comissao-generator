/**
 * Warns (non-blocking) when the same identity code shows up with a different
 * display name later in the same workbook - never renamed or filtered.
 */
export function warnIfNameInconsistent(
  knownNameByCode: Map<string, string>,
  key: string,
  name: string,
  warnings: string[],
  rowNumber: number
): void {
  if (name === '') return;
  const existing = knownNameByCode.get(key);
  if (existing === undefined) {
    knownNameByCode.set(key, name);
  } else if (existing !== name) {
    warnings.push(
      `Linha ${rowNumber}: nome "${name}" diverge do nome "${existing}" ja visto para o mesmo codigo neste arquivo.`
    );
  }
}
