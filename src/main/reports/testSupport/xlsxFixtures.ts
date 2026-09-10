import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

/** Builds a real, throwaway .xlsx file with entirely made-up data - never real Protheus data. */
export async function writeFixtureWorkbook(
  dir: string,
  fileName: string,
  headers: string[],
  rows: unknown[][]
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('sheet1');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const filePath = join(dir, fileName);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

export function createFixtureDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeFixtureDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
