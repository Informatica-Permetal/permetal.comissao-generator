import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateFolderSafely } from './migrateFolderSafely';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fc-migrate-folder-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('migrateFolderSafely - caminho simples (destino nao existe)', () => {
  it('nao faz nada quando a origem nao existe', () => {
    const onWarning = vi.fn();
    migrateFolderSafely(join(root, 'nao-existe'), join(root, 'novo'), onWarning);
    expect(existsSync(join(root, 'novo'))).toBe(false);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('renomeia a arvore inteira em um so passo quando o destino nao existe', () => {
    const oldDir = join(root, 'Formatador Comissao');
    mkdirSync(join(oldDir, 'logs'), { recursive: true });
    writeFileSync(join(oldDir, 'app.db'), 'dado do banco');
    writeFileSync(join(oldDir, 'logs', '2026-01-01.log'), 'log antigo');

    const onWarning = vi.fn();
    migrateFolderSafely(oldDir, join(root, 'Formatador Comissão'), onWarning);

    expect(existsSync(oldDir)).toBe(false);
    expect(readFileSync(join(root, 'Formatador Comissão', 'app.db'), 'utf8')).toBe('dado do banco');
    expect(readFileSync(join(root, 'Formatador Comissão', 'logs', '2026-01-01.log'), 'utf8')).toBe('log antigo');
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('move um unico arquivo (nao diretorio) quando o destino nao existe', () => {
    const oldFile = join(root, 'old.db');
    writeFileSync(oldFile, 'conteudo');
    migrateFolderSafely(oldFile, join(root, 'new.db'), vi.fn());
    expect(existsSync(oldFile)).toBe(false);
    expect(readFileSync(join(root, 'new.db'), 'utf8')).toBe('conteudo');
  });
});

describe('migrateFolderSafely - mesclagem (destino ja existe)', () => {
  it('mescla arquivos que nao colidem, preservando os dois lados sem perda', () => {
    const oldDir = join(root, 'old');
    const newDir = join(root, 'new');
    mkdirSync(oldDir, { recursive: true });
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(oldDir, 'a.txt'), 'do antigo');
    writeFileSync(join(newDir, 'b.txt'), 'ja no novo');

    const onWarning = vi.fn();
    migrateFolderSafely(oldDir, newDir, onWarning);

    expect(readFileSync(join(newDir, 'a.txt'), 'utf8')).toBe('do antigo');
    expect(readFileSync(join(newDir, 'b.txt'), 'utf8')).toBe('ja no novo');
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('nunca sobrescreve um arquivo colidente - mantem o novo e avisa, sem apagar o antigo', () => {
    const oldDir = join(root, 'old');
    const newDir = join(root, 'new');
    mkdirSync(oldDir, { recursive: true });
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(oldDir, 'conflito.txt'), 'versao antiga');
    writeFileSync(join(newDir, 'conflito.txt'), 'versao nova - autoritativa');

    const onWarning = vi.fn();
    migrateFolderSafely(oldDir, newDir, onWarning);

    expect(readFileSync(join(newDir, 'conflito.txt'), 'utf8')).toBe('versao nova - autoritativa');
    // a copia legada em conflito nunca e apagada
    expect(existsSync(join(oldDir, 'conflito.txt'))).toBe(true);
    expect(readFileSync(join(oldDir, 'conflito.txt'), 'utf8')).toBe('versao antiga');
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('mescla subpastas recursivamente, inclusive quando so uma parte colide', () => {
    const oldDir = join(root, 'old');
    const newDir = join(root, 'new');
    mkdirSync(join(oldDir, 'Previsao', 'Historico'), { recursive: true });
    mkdirSync(join(newDir, 'Previsão'), { recursive: true });
    writeFileSync(join(oldDir, 'Previsao', 'Historico', 'doc1.pdf'), 'pdf1');
    writeFileSync(join(oldDir, 'Previsao', 'novo-arquivo.xlsx'), 'planilha');

    migrateFolderSafely(join(oldDir, 'Previsao'), join(newDir, 'Previsão'), vi.fn());

    expect(readFileSync(join(newDir, 'Previsão', 'Historico', 'doc1.pdf'), 'utf8')).toBe('pdf1');
    expect(readFileSync(join(newDir, 'Previsão', 'novo-arquivo.xlsx'), 'utf8')).toBe('planilha');
  });

  it('remove diretorios legados que ficam vazios apos a mesclagem, mas preserva os que ainda tem conflitos', () => {
    const oldDir = join(root, 'old');
    const newDir = join(root, 'new');
    mkdirSync(join(oldDir, 'vazio-depois'), { recursive: true });
    mkdirSync(join(oldDir, 'com-conflito'), { recursive: true });
    mkdirSync(join(newDir, 'com-conflito'), { recursive: true });
    writeFileSync(join(oldDir, 'vazio-depois', 'a.txt'), 'x');
    writeFileSync(join(oldDir, 'com-conflito', 'b.txt'), 'legado');
    writeFileSync(join(newDir, 'com-conflito', 'b.txt'), 'atual');

    migrateFolderSafely(oldDir, newDir, vi.fn());

    expect(existsSync(join(oldDir, 'vazio-depois'))).toBe(false); // esvaziado -> removido
    expect(existsSync(join(oldDir, 'com-conflito', 'b.txt'))).toBe(true); // conflito -> preservado
    expect(readFileSync(join(newDir, 'com-conflito', 'b.txt'), 'utf8')).toBe('atual');
  });
});

describe('migrateFolderSafely - idempotencia', () => {
  it('rodar duas vezes seguidas nao apaga nem duplica nada', () => {
    const oldDir = join(root, 'Formatador Comissao');
    mkdirSync(oldDir, { recursive: true });
    writeFileSync(join(oldDir, 'app.db'), 'dado');
    const newDir = join(root, 'Formatador Comissão');

    migrateFolderSafely(oldDir, newDir, vi.fn());
    expect(existsSync(oldDir)).toBe(false);

    // segunda execucao: origem ja nao existe - deve ser inofensiva
    migrateFolderSafely(oldDir, newDir, vi.fn());
    expect(readFileSync(join(newDir, 'app.db'), 'utf8')).toBe('dado');
    expect(readdirSync(newDir)).toEqual(['app.db']);
  });

  it('retomar uma migracao parcial (conflito resolvido manualmente) completa sem duplicar', () => {
    const oldDir = join(root, 'old');
    const newDir = join(root, 'new');
    mkdirSync(oldDir, { recursive: true });
    mkdirSync(newDir, { recursive: true });
    writeFileSync(join(oldDir, 'conflito.txt'), 'legado');
    writeFileSync(join(newDir, 'conflito.txt'), 'atual');
    writeFileSync(join(oldDir, 'sem-conflito.txt'), 'unico');

    migrateFolderSafely(oldDir, newDir, vi.fn());
    expect(existsSync(join(oldDir, 'conflito.txt'))).toBe(true); // ainda em conflito
    expect(existsSync(join(oldDir, 'sem-conflito.txt'))).toBe(false); // ja movido

    // usuario (ou uma correcao futura) remove o conflito do lado legado
    rmSync(join(oldDir, 'conflito.txt'));
    migrateFolderSafely(oldDir, newDir, vi.fn());

    expect(existsSync(oldDir)).toBe(false); // agora vazio, removido
    expect(readFileSync(join(newDir, 'conflito.txt'), 'utf8')).toBe('atual');
  });
});
