/**
 * Launches the already-packaged app (`release/win-unpacked`, produced by `npm run pack`)
 * with the HOMOLOGATION execution profile explicitly requested via environment variable -
 * never inferred from the executable's own path (e.g. "contains win-unpacked"). Used
 * instead of a raw shell command specifically because the packaged executable's name
 * contains a space and an accented character ("Formatador Comissão.exe");
 * `child_process.spawn` with an argument array handles that correctly without any
 * shell-specific quoting.
 *
 * The executable is located deterministically as `${build.productName}.exe` (the exact
 * name electron-builder gives the unpacked app) - never "the first .exe found in the
 * folder", which could silently launch the wrong binary if `win-unpacked` ever contains
 * more than one (a leftover from a previous productName, a helper binary, etc.).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const packagedDir = join(projectRoot, 'release', 'win-unpacked');

if (!existsSync(packagedDir)) {
  console.error(`Pasta empacotada nao encontrada: ${packagedDir}`);
  console.error('Rode "npm run pack" primeiro.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const productName = pkg.build?.productName ?? pkg.productName;
const expectedExeName = `${productName}.exe`;
const expectedExePath = join(packagedDir, expectedExeName);

if (!existsSync(expectedExePath)) {
  const candidates = readdirSync(packagedDir).filter((name) => name.toLowerCase().endsWith('.exe'));
  console.error(`Executavel esperado nao encontrado: ${expectedExePath}`);
  console.error(`(esperado "${expectedExeName}", derivado de build.productName no package.json)`);
  if (candidates.length === 0) {
    console.error(`Nenhum .exe encontrado em ${packagedDir}. Rode "npm run pack" novamente.`);
  } else {
    console.error(
      `Encontrei ${candidates.length} outro(s) .exe em ${packagedDir}, mas nenhum bate com o nome esperado - ` +
        'recusando escolher um arbitrariamente:'
    );
    for (const candidate of candidates) console.error(`  - ${candidate}`);
  }
  process.exit(1);
}

console.log(`Iniciando em HOMOLOGATION: ${expectedExePath}`);

const child = spawn(expectedExePath, [], {
  env: { ...process.env, FC_EXECUTION_PROFILE: 'HOMOLOGATION' },
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error(`Falha ao iniciar o app empacotado: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
