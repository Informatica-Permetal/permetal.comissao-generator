import { BrowserWindow } from 'electron';

let utilityWindow: BrowserWindow | null = null;

/**
 * A single hidden BrowserWindow reused for every PDF render/print operation.
 * Creating and destroying many hidden windows back-to-back (with no other
 * window ever shown) was found to intermittently fail to load local files
 * on this platform; reusing one window sidesteps that entirely and is also
 * cheaper than spinning up a fresh renderer process per document.
 */
export function getUtilityWindow(): BrowserWindow {
  if (!utilityWindow || utilityWindow.isDestroyed()) {
    utilityWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        plugins: true
      }
    });
  }
  return utilityWindow;
}
