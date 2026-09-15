/**
 * Decorative "perforated metal plate" motif for the PDF header - a local,
 * versioned, purely generated SVG (no external file, no network dependency).
 * Inspired by industrial drilled sheet metal, kept in low-contrast grays so
 * it stays subtle, print-safe, and legible on a grayscale printer.
 */
export function buildPerforatedMetalMotif(width = 168, height = 76): string {
  const cols = 12;
  const rows = 5;
  const spacingX = width / cols;
  const spacingY = height / rows;
  const radius = Math.min(spacingX, spacingY) * 0.24;

  const holes: string[] = [];
  for (let row = 0; row < rows; row++) {
    const rowOffset = row % 2 === 0 ? 0 : spacingX / 2;
    for (let col = 0; col < cols; col++) {
      const cx = col * spacingX + spacingX / 2 + rowOffset - spacingX / 2;
      const cy = row * spacingY + spacingY / 2;
      if (cx < radius || cx > width - radius) continue;
      holes.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${radius.toFixed(1)}" />`);
    }
  }

  return `
    <svg class="doc-header__motif" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="motifPlate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#dfe2e5" />
          <stop offset="100%" stop-color="#eef0f2" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="3" fill="url(#motifPlate)" />
      <g fill="#ffffff">${holes.join('')}</g>
      <rect width="${width}" height="${height}" rx="3" fill="none" stroke="#cfd3d8" stroke-width="1" />
    </svg>
  `;
}
