import { copyFileSync, renameSync, unlinkSync } from 'node:fs';

/** Renames when possible (atomic, same volume); falls back to copy+delete across volumes. */
export function moveFileSafely(sourcePath: string, targetPath: string): void {
  try {
    renameSync(sourcePath, targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
      copyFileSync(sourcePath, targetPath);
      unlinkSync(sourcePath);
    } else {
      throw error;
    }
  }
}
