import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PreviewSummary } from './ImportPage';
import type { BatchPreview } from '@shared/types/import';

afterEach(() => {
  cleanup();
});

function buildPreview(overrides: Partial<BatchPreview> = {}): BatchPreview {
  return {
    batchId: 'batch-1',
    mode: 'Previsao',
    sourceOriginalName: 'Previsão de comissões.xlsx',
    sourcePath: 'C:/Entrada/Previsão de comissões.xlsx',
    workspaceFilePath: 'C:/Processamento/batch-1.xlsx',
    sourceKind: 'entrada',
    sourceHash: 'hash',
    totalRows: 3,
    sellerCount: 3,
    branchCount: 2,
    documents: [
      { branchCode: '0103', sellerCode: '000001', sellerName: 'ADEMIR FURLANETO', rowCount: 2, total: 'R$ 0,00' },
      { branchCode: '0104', sellerCode: '000001', sellerName: 'ADEMIR FURLANETO', rowCount: 10, total: 'R$ 359,85' },
      { branchCode: '0103', sellerCode: '000004', sellerName: 'RENATO FURLANETO', rowCount: 1, total: 'R$ 0,00' }
    ],
    multiBranchSellers: [
      { sellerCode: '000001', sellerName: 'ADEMIR FURLANETO', branchCodes: ['0103', '0104'] },
      { sellerCode: '000004', sellerName: 'RENATO FURLANETO', branchCodes: ['0103', '0104'] }
    ],
    warnings: [],
    missingBranchCodes: [],
    previouslyProcessedAt: null,
    ...overrides
  };
}

describe('PreviewSummary - acao "Aplicar a todos"', () => {
  it('mostra o texto curto "Aplicar a todos" com o tooltip explicativo completo', () => {
    render(
      <PreviewSummary preview={buildPreview()} onConfirm={vi.fn()} onCancel={vi.fn()} onGoToSettings={vi.fn()} />
    );
    const buttons = screen.getAllByRole('button', { name: 'Aplicar a todos' });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveAttribute('title', 'Aplicar esta escolha a todos os vendedores com múltiplas filiais');
    }
  });

  it('nao aparece quando ha somente 1 vendedor multi-filial', () => {
    render(
      <PreviewSummary
        preview={buildPreview({ multiBranchSellers: [{ sellerCode: '000001', sellerName: 'ADEMIR FURLANETO', branchCodes: ['0103', '0104'] }] })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onGoToSettings={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'Aplicar a todos' })).not.toBeInTheDocument();
  });

  it('aplica a escolha atualmente selecionada NAQUELA linha a todos os vendedores multi-filial, preservando o restante', () => {
    render(
      <PreviewSummary preview={buildPreview()} onConfirm={vi.fn()} onCancel={vi.fn()} onGoToSettings={vi.fn()} />
    );

    // Vendedor 000004 (RENATO, 2a linha) muda para consolidado; vendedor 000001 (ADEMIR) permanece no
    // padrao (separado) - ha 2 radios "Gerar consolidado por vendedor" (um por vendedor).
    const consolidatedRadios = screen.getAllByRole('radio', { name: 'Gerar consolidado por vendedor' });
    fireEvent.click(consolidatedRadios[1]);

    // So existe 1 botao "Aplicar a todos" no card do vendedor que acabou de ser alterado (RENATO) - clica nele.
    const applyButtons = screen.getAllByRole('button', { name: 'Aplicar a todos' });
    fireEvent.click(applyButtons[1]);

    // Depois de aplicar, AMBOS os radios "consolidado" (ADEMIR e RENATO) devem estar marcados.
    const consolidatedRadiosAfter = screen.getAllByRole('radio', { name: 'Gerar consolidado por vendedor' });
    expect(consolidatedRadiosAfter[0]).toBeChecked();
    expect(consolidatedRadiosAfter[1]).toBeChecked();

    const separateRadiosAfter = screen.getAllByRole('radio', { name: 'Gerar separado por filial' });
    expect(separateRadiosAfter[0]).not.toBeChecked();
    expect(separateRadiosAfter[1]).not.toBeChecked();
  });
});
