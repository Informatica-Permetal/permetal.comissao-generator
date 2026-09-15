import { basename, extname } from 'node:path';

/**
 * Presentation-only brand label derived from the already-known logo file
 * name (e.g. `.../logos/MG_ZINC.png` -> "MG Zinc"). Never persisted, never
 * invented - the brand-to-logo association already exists in
 * `companies/brandLogos.ts` seeding; this only turns the file name back
 * into a short human label for the PDF letterhead, distinct from a
 * branch's own display name (e.g. "Permetal" vs "Permetal Cravinhos") so
 * the two never repeat the same text in the document header.
 */
const LABEL_BY_TOKEN: Record<string, string> = {
  PERMETAL: 'Permetal',
  METALGRADE: 'Metalgrade',
  MG_ZINC: 'MG Zinc',
  'TRES-S': 'Tres-S'
};

export function resolveBrandLabel(logoPath: string | null): string | null {
  if (!logoPath) return null;
  const token = basename(logoPath, extname(logoPath)).toUpperCase();
  return LABEL_BY_TOKEN[token] ?? null;
}
