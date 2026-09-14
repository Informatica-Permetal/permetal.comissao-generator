import { shell } from 'electron';
import { getUtilityWindow } from './utilityWindow';

export async function openPdf(filePath: string): Promise<string | null> {
  const errorMessage = await shell.openPath(filePath);
  return errorMessage === '' ? null : errorMessage;
}

export function openContainingFolder(filePath: string): void {
  shell.showItemInFolder(filePath);
}

/**
 * Prints a generated PDF by loading it into the shared hidden utility window
 * (Chromium's built-in PDF viewer) and invoking the normal OS print dialog.
 */
export async function printPdf(filePath: string): Promise<void> {
  const window = getUtilityWindow();
  const finishedLoading = new Promise<void>((resolve) => {
    window.webContents.once('did-finish-load', () => resolve());
  });
  await window.loadFile(filePath);
  await finishedLoading;

  await new Promise<void>((resolve, reject) => {
    window.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
      if (success || failureReason === 'cancelled') {
        resolve();
      } else {
        reject(new Error(failureReason));
      }
    });
  });
}
