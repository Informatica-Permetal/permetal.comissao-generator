import ExcelJS from 'exceljs';
import { extname } from 'node:path';

export class UnsupportedFileTypeError extends Error {
  constructor(filePath: string) {
    super(`Apenas arquivos .xlsx sao aceitos: "${filePath}"`);
    this.name = 'UnsupportedFileTypeError';
  }
}

export async function loadWorkbookFromFile(filePath: string): Promise<ExcelJS.Workbook> {
  if (extname(filePath).toLowerCase() !== '.xlsx') {
    throw new UnsupportedFileTypeError(filePath);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

export function getFirstWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('A planilha nao contem nenhuma aba.');
  }
  return sheet;
}
