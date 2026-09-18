import { join } from 'node:path';
import { app } from 'electron';

/**
 * Resolves bundled, versioned binary assets (brand logos, app icon) that must
 * work identically in `npm run dev` and in a packaged/asar build.
 *
 * In dev, `__dirname` is `out/main` and the project root sits two levels up,
 * with `resources/` right next to it on disk - a plain `fs` read works.
 *
 * In a packaged build, `out/main` is bundled inside `app.asar`. Some `fs`
 * operations (notably `copyFileSync`'s source read) do not reliably work
 * through the asar virtual filesystem, so these assets are shipped OUTSIDE
 * the asar via electron-builder's `extraResources` (see `package.json`
 * `build.extraResources`), landing in `process.resourcesPath` as real files
 * on disk - `app.isPackaged` picks that path instead.
 */
export function resolveBrandLogosDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'brand-logos')
    : join(__dirname, '..', '..', 'resources', 'brand-logos');
}

export function resolveAppIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '..', '..', 'resources', 'icon.ico');
}

/** The real photographic "chapa perfurada" asset used as the PDF's decorative industrial motif - never generated at runtime. */
export function resolvePerforatedMetalMotifPath(): string {
  const dir = app.isPackaged
    ? join(process.resourcesPath, 'pdf-motifs')
    : join(__dirname, '..', '..', 'resources', 'pdf-motifs');
  return join(dir, 'chapa-perfurada.png');
}
