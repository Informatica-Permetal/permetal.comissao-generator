import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error';

let logFilePath: string | null = null;

export function initLogger(logDir: string): void {
  mkdirSync(logDir, { recursive: true });
  logFilePath = join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  if (logFilePath) {
    appendFileSync(logFilePath, `${line}\n`, 'utf8');
  }
}
