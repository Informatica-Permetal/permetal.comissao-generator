import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeReportRootManifestIfMissing } from './dataOwnership';
import {
  buildUninstallPlan,
  executeUninstallPlan,
  findHardBlockReason,
  resolveCanonicalIfExists,
  type SpecialFolders
} from './uninstallPlan';

const APP_ID = 'com.formatadorcomissao.app';
const MANAGED_NAMES = ['Previsão', 'Relação'];

function fakeSpecialFolders(base: string): SpecialFolders {
  return {
    home: join(base, 'special-home'),
    documents: join(base, 'special-documents'),
    desktop: join(base, 'special-desktop'),
    downloads: join(base, 'special-downloads')
  };
}

let baseDir: string;
beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), 'fc-uninstall-plan-'));
});
afterEach(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

describe('findHardBlockReason', () => {
  it('bloqueia a raiz de uma unidade de disco', () => {
    const driveRoot = parse(process.cwd()).root; // e.g. "C:\\" - real, but never written to
    const special = fakeSpecialFolders(baseDir);
    expect(findHardBlockReason(driveRoot, special)).toMatch(/unidade de disco/);
  });

  it('bloqueia quando o caminho e exatamente a pasta especial (home/documents/desktop/downloads)', () => {
    const special = fakeSpecialFolders(baseDir);
    expect(findHardBlockReason(special.home, special)).toMatch(/perfil/);
    expect(findHardBlockReason(special.documents, special)).toMatch(/Documentos/);
    expect(findHardBlockReason(special.desktop, special)).toMatch(/Área de Trabalho/);
    expect(findHardBlockReason(special.downloads, special)).toMatch(/Downloads/);
  });

  it('NAO bloqueia uma subpasta legitima dentro de uma pasta especial (ex.: o root sugerido dentro de Documents)', () => {
    const special = fakeSpecialFolders(baseDir);
    const suggestedDefault = join(special.documents, 'Formatador Comissão');
    expect(findHardBlockReason(suggestedDefault, special)).toBeNull();
  });

  it('comparacao e case-insensitive (sistema de arquivos do Windows)', () => {
    const special = fakeSpecialFolders(baseDir);
    expect(findHardBlockReason(special.documents.toUpperCase(), special)).not.toBeNull();
  });
});

describe('buildUninstallPlan - cenario normal (root gerenciado, sem problemas)', () => {
  it('inclui appData e as pastas gerenciadas + o manifesto, quando tudo e legitimo', () => {
    const appDataPath = join(baseDir, 'AppData');
    mkdirSync(appDataPath, { recursive: true });
    writeFileSync(join(appDataPath, 'Formatador Comissão.db'), 'fake db');

    const reportRoot = join(baseDir, 'Formatador Comissão');
    mkdirSync(join(reportRoot, 'Previsão'), { recursive: true });
    mkdirSync(join(reportRoot, 'Relação'), { recursive: true });
    writeReportRootManifestIfMissing(reportRoot, APP_ID, MANAGED_NAMES);

    const plan = buildUninstallPlan({
      appId: APP_ID,
      appDataPath,
      reportRoot,
      managedTopLevelNames: MANAGED_NAMES,
      special: fakeSpecialFolders(baseDir)
    });

    expect(plan.blocked).toEqual([]);
    const paths = plan.items.map((i) => i.path);
    expect(paths).toContain(resolveCanonicalIfExists(appDataPath));
    expect(paths).toContain(resolveCanonicalIfExists(join(reportRoot, 'Previsão')));
    expect(paths).toContain(resolveCanonicalIfExists(join(reportRoot, 'Relação')));
    expect(paths).toContain(join(reportRoot, '.formador-comissao-report-root.json'));
    expect(plan.items).toHaveLength(4);
  });

  it('funciona com um nome de pasta raiz totalmente customizado, nao apenas o padrao sugerido', () => {
    const reportRoot = join(baseDir, 'Onde Eu Quiser Guardar Meus Relatorios');
    mkdirSync(join(reportRoot, 'Previsão'), { recursive: true });
    writeReportRootManifestIfMissing(reportRoot, APP_ID, MANAGED_NAMES);

    const plan = buildUninstallPlan({
      appId: APP_ID,
      appDataPath: null,
      reportRoot,
      managedTopLevelNames: MANAGED_NAMES,
      special: fakeSpecialFolders(baseDir)
    });

    expect(plan.blocked).toEqual([]);
    expect(plan.items.map((i) => i.path)).toContain(resolveCanonicalIfExists(join(reportRoot, 'Previsão')));
  });
});

describe('buildUninstallPlan - preserva arquivo/pasta estranha nao gerenciada dentro do root', () => {
  it('remove somente Previsao/Relacao/manifesto, nunca um arquivo ou pasta alheia no mesmo root', () => {
    const reportRoot = join(baseDir, 'Formatador Comissão');
    mkdirSync(join(reportRoot, 'Previsão'), { recursive: true });
    mkdirSync(join(reportRoot, 'Relação'), { recursive: true });
    mkdirSync(join(reportRoot, 'Projeto Pessoal Do Usuario'), { recursive: true });
    writeFileSync(join(reportRoot, 'nao-gerenciado.txt'), 'arquivo do usuario, nao tocar');
    writeReportRootManifestIfMissing(reportRoot, APP_ID, MANAGED_NAMES);

    const plan = buildUninstallPlan({
      appId: APP_ID,
      appDataPath: null,
      reportRoot,
      managedTopLevelNames: MANAGED_NAMES,
      special: fakeSpecialFolders(baseDir)
    });

    const paths = plan.items.map((i) => i.path);
    expect(paths).not.toContain(resolveCanonicalIfExists(join(reportRoot, 'Projeto Pessoal Do Usuario')));
    expect(paths.some((p) => p.includes('nao-gerenciado.txt'))).toBe(false);

    executeUninstallPlan(plan);
    expect(existsSync(join(reportRoot, 'Previsão'))).toBe(false);
    expect(existsSync(join(reportRoot, 'Relação'))).toBe(false);
    expect(existsSync(join(reportRoot, 'Projeto Pessoal Do Usuario'))).toBe(true);
    expect(existsSync(join(reportRoot, 'nao-gerenciado.txt'))).toBe(true);
  });
});

describe('buildUninstallPlan - nunca exclui sem um manifesto valido', () => {
  it('bloqueia quando nao ha manifesto algum na pasta', () => {
    const reportRoot = join(baseDir, 'Formatador Comissão');
    mkdirSync(join(reportRoot, 'Previsão'), { recursive: true });

    const plan = buildUninstallPlan({
      appId: APP_ID,
      appDataPath: null,
      reportRoot,
      managedTopLevelNames: MANAGED_NAMES,
      special: fakeSpecialFolders(baseDir)
    });

    expect(plan.items).toEqual([]);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0].reason).toMatch(/gerenciada/);
  });

  it('bloqueia quando o manifesto existe mas pertence a outro appId', () => {
    const reportRoot = join(baseDir, 'Formatador Comissão');
    mkdirSync(join(reportRoot, 'Previsão'), { recursive: true });
    writeReportRootManifestIfMissing(reportRoot, 'com.outro.app', MANAGED_NAMES);

    const plan = buildUninstallPlan({
      appId: APP_ID,
      appDataPath: null,
      reportRoot,
      managedTopLevelNames: MANAGED_NAMES,
      special: fakeSpecialFolders(baseDir)
    });

    expect(plan.items).toEqual([]);
    expect(plan.blocked).toHaveLength(1);
  });

  it('bloqueia quando o "manifesto" e um JSON corrompido/invalido', () => {
    const reportRoot = join(baseDir, 'Formatador Comissão');
    mkdirSync(reportRoot, { recursive: true });
    writeFileSync(join(reportRoot, '.formador-comissao-report-root.json'), '{ isso nao e json valido');

    const plan = buildUninstallPlan({
      appId: APP_ID,
      appDataPath: null,
      reportRoot,
      managedTopLevelNames: MANAGED_NAMES,
      special: fakeSpecialFolders(baseDir)
    });

    expect(plan.items).toEqual([]);
    expect(plan.blocked).toHaveLength(1);
  });
});

describe('buildUninstallPlan - bloqueio de pasta ampla tem prioridade absoluta sobre o manifesto', () => {
  it('bloqueia mesmo se, adversarialmente, um manifesto valido existir dentro de Documents/Desktop/etc', () => {
    const special = fakeSpecialFolders(baseDir);
    mkdirSync(special.documents, { recursive: true });
    mkdirSync(join(special.documents, 'Previsão'), { recursive: true });
    writeReportRootManifestIfMissing(special.documents, APP_ID, MANAGED_NAMES);

    const plan = buildUninstallPlan({
      appId: APP_ID,
      appDataPath: null,
      reportRoot: special.documents,
      managedTopLevelNames: MANAGED_NAMES,
      special
    });

    expect(plan.items).toEqual([]);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0].reason).toMatch(/Documentos/);
  });
});

describe('buildUninstallPlan - protecao contra escape por symlink/junction', () => {
  it('nunca exclui uma "pasta gerenciada" que na verdade e uma junction apontando para fora do root', () => {
    const reportRoot = join(baseDir, 'Formatador Comissão');
    mkdirSync(reportRoot, { recursive: true });
    writeReportRootManifestIfMissing(reportRoot, APP_ID, MANAGED_NAMES);

    const outsideTarget = join(baseDir, 'algo-totalmente-alheio');
    mkdirSync(outsideTarget, { recursive: true });
    writeFileSync(join(outsideTarget, 'dado-importante-do-usuario.txt'), 'nao apagar');

    // "Previsão" is not a real directory here - it is a junction pointing outside the report root.
    symlinkSync(outsideTarget, join(reportRoot, 'Previsão'), 'junction');

    const plan = buildUninstallPlan({
      appId: APP_ID,
      appDataPath: null,
      reportRoot,
      managedTopLevelNames: MANAGED_NAMES,
      special: fakeSpecialFolders(baseDir)
    });

    const paths = plan.items.map((i) => i.path);
    expect(paths.some((p) => p.toLowerCase() === outsideTarget.toLowerCase())).toBe(false);
    expect(paths.some((p) => p.toLowerCase().startsWith(outsideTarget.toLowerCase()))).toBe(false);

    executeUninstallPlan(plan);
    expect(existsSync(join(outsideTarget, 'dado-importante-do-usuario.txt'))).toBe(true);
  });
});

describe('executeUninstallPlan', () => {
  it('remove exatamente os itens do plano e relata cada um como removido', () => {
    const dirA = join(baseDir, 'a');
    const dirB = join(baseDir, 'b');
    mkdirSync(dirA);
    mkdirSync(dirB);

    const result = executeUninstallPlan({
      items: [
        { label: 'A', path: dirA },
        { label: 'B', path: dirB }
      ],
      blocked: []
    });

    expect(result.errors).toEqual([]);
    expect(new Set(result.deletedPaths)).toEqual(new Set([dirA, dirB]));
    expect(existsSync(dirA)).toBe(false);
    expect(existsSync(dirB)).toBe(false);
  });
});
