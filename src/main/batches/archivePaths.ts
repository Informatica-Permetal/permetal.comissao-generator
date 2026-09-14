import { join } from 'node:path';
import type { ReportMode } from '@shared/constants/folders';

function yearMonth(date: Date): { yyyy: string; mm: string } {
  return {
    yyyy: String(date.getUTCFullYear()),
    mm: String(date.getUTCMonth() + 1).padStart(2, '0')
  };
}

export function resolveProcessadosDir(reportRoot: string, mode: ReportMode, date: Date, batchId: string): string {
  const { yyyy, mm } = yearMonth(date);
  return join(reportRoot, mode, 'Processados', yyyy, mm, batchId);
}

export function resolveHistoricoDir(reportRoot: string, mode: ReportMode, date: Date, batchId: string): string {
  const { yyyy, mm } = yearMonth(date);
  return join(reportRoot, mode, 'Historico', yyyy, mm, batchId);
}

export function resolveProcessamentoDir(reportRoot: string, mode: ReportMode, batchId: string): string {
  return join(reportRoot, mode, 'Processamento', batchId);
}
