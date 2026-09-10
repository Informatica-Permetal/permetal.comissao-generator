import type { DatabaseSync } from 'node:sqlite';

const SETTINGS_KEYS = {
  reportRoot: 'reportRoot',
  firstRunCompletedAt: 'firstRunCompletedAt'
} as const;

export function getSettingValue(db: DatabaseSync, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSettingValue(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function getReportRoot(db: DatabaseSync): string | null {
  return getSettingValue(db, SETTINGS_KEYS.reportRoot);
}

export function isFirstRunComplete(db: DatabaseSync): boolean {
  return getSettingValue(db, SETTINGS_KEYS.firstRunCompletedAt) !== null;
}

export function persistFirstRunCompletion(db: DatabaseSync, reportRoot: string): void {
  setSettingValue(db, SETTINGS_KEYS.reportRoot, reportRoot);
  setSettingValue(db, SETTINGS_KEYS.firstRunCompletedAt, new Date().toISOString());
}
