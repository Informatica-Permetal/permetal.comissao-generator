import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getUtilityWindow } from './utilityWindow';

export interface RenderPdfOptions {
  headerTemplate: string;
  footerTemplate: string;
}

const PRINT_MARGINS = { top: 0.5, bottom: 0.6, left: 0.4, right: 0.4 };

/** Renders a self-contained HTML string to a PDF Buffer via the shared hidden utility window. */
export async function renderHtmlToPdf(html: string, options: RenderPdfOptions): Promise<Buffer> {
  const workDir = mkdtempSync(join(tmpdir(), 'fc-pdf-render-'));
  const htmlPath = join(workDir, 'report.html');
  writeFileSync(htmlPath, html, 'utf8');

  try {
    const window = getUtilityWindow();
    await window.loadFile(htmlPath);
    return await window.webContents.printToPDF({
      landscape: false,
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: true,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
      margins: PRINT_MARGINS
    });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
