import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

/** Embeds a local image as a data: URI so the print HTML never depends on external file loading. */
export function embedImageAsDataUri(filePath: string): string | null {
  try {
    const buffer = readFileSync(filePath);
    const mime = MIME_BY_EXTENSION[extname(filePath).toLowerCase()] ?? 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}
