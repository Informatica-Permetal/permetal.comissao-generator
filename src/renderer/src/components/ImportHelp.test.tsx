import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ImportHelp from './ImportHelp';
import { ToastProvider } from './ToastProvider';

function renderHelp(mode: 'Previsao' | 'Relacao') {
  return render(
    <ToastProvider>
      <ImportHelp mode={mode} />
    </ToastProvider>
  );
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
  cleanup();
});

describe('ImportHelp - abertura e fechamento', () => {
  it('nao mostra o modal antes de clicar no icone de ajuda', () => {
    renderHelp('Previsao');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre o modal ao clicar no icone de ajuda', () => {
    renderHelp('Previsao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fecha o modal ao clicar no botao Fechar do cabecalho', () => {
    renderHelp('Previsao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const headerCloseButton = screen.getAllByRole('button', { name: 'Fechar' })[0];
    fireEvent.click(headerCloseButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fecha o modal ao clicar no botao Fechar do rodape', () => {
    renderHelp('Relacao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    const footerCloseButton = screen.getAllByRole('button', { name: 'Fechar' })[1];
    fireEvent.click(footerCloseButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fecha o modal ao clicar fora (overlay)', () => {
    const { container } = renderHelp('Previsao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    const overlay = container.querySelector('.help-modal-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nao fecha ao clicar dentro do conteudo do modal (evita fechar por engano)', () => {
    renderHelp('Previsao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    fireEvent.click(screen.getByText('Colunas obrigatórias (13)'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fecha o modal ao pressionar Escape', () => {
    renderHelp('Previsao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('o dialogo e acessivel: role dialog, aria-modal e titulo associado', () => {
    renderHelp('Previsao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent('Ajuda - Previsão de Comissões');
  });
});

describe('ImportHelp - conteudo (Previsao)', () => {
  beforeEach(() => {
    renderHelp('Previsao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
  });

  it('mostra relatorio, codigo e caminho corretos', () => {
    // "Previsão de Comissões" aparece tanto como valor do relatório quanto como
    // ultimo segmento do caminho - verifica o campo especifico pelo rotulo ao lado.
    expect(screen.getByText('Relatório no Protheus').nextSibling).toHaveTextContent('Previsão de Comissões');
    expect(screen.getByText('FINSV047')).toBeInTheDocument();
    expect(screen.getByText('Módulo Financeiro')).toBeInTheDocument();
    expect(screen.getByText('Consultas')).toBeInTheDocument();
  });

  it('lista as 13 colunas obrigatorias, com os nomes exatos do Protheus', () => {
    expect(screen.getByText('Colunas obrigatórias (13)')).toBeInTheDocument();
    for (const field of [
      'Nome da filial',
      'Dados do vendedor',
      'Classificação',
      'Dados do cliente',
      'Dados do título',
      'Dados do pedido',
      'Emissão pedido/título',
      'Vencimento',
      'DT Baixa',
      'Valor base para baixa',
      'Valor total de comissão',
      'Valor IRRF',
      'Comissão total (líquido)'
    ]) {
      expect(screen.getByText(field)).toBeInTheDocument();
    }
  });

  it('destaca visualmente o aviso sobre os dois campos Vencimento', () => {
    expect(screen.getByText(/dois campos chamados "Vencimento"/i)).toBeInTheDocument();
    expect(screen.getByText(/SEGUNDO Vencimento/)).toBeInTheDocument();
  });

  it('explica que o total usa somente Comissao total (liquido)', () => {
    expect(screen.getByText(/somente o campo "Comissão total \(líquido\)"/)).toBeInTheDocument();
    expect(screen.getByText(/Valor total de comissão.*Valor IRRF.*apenas dados do Protheus/s)).toBeInTheDocument();
  });
});

describe('ImportHelp - conteudo (Relacao)', () => {
  beforeEach(() => {
    renderHelp('Relacao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
  });

  it('mostra relatorio, codigo e caminho corretos', () => {
    expect(screen.getByText('Relação de Comissão')).toBeInTheDocument();
    expect(screen.getByText('FATSV019')).toBeInTheDocument();
    expect(screen.getByText('Módulo Faturamento')).toBeInTheDocument();
  });

  it('lista as 12 colunas obrigatorias, com os nomes exatos do Protheus (sem acento)', () => {
    expect(screen.getByText('Colunas obrigatórias (12)')).toBeInTheDocument();
    for (const field of [
      'Filial do Sistema',
      'Codigo do Vendedor',
      'Nome do Vendedor',
      'Prefixo',
      'Numero do Titulo Original',
      'Parcela',
      'Nome do cliente',
      'Data de Baixa do Titulo',
      'Numero do Pedido',
      'Valor Base da Comissao',
      '% Comissao sobre Vl.Base',
      'Valor da Comissao'
    ]) {
      expect(screen.getByText(field)).toBeInTheDocument();
    }
  });

  it('nao mostra o aviso de Vencimento (exclusivo da Previsao)', () => {
    expect(screen.queryByText(/dois campos chamados/i)).not.toBeInTheDocument();
  });

  it('informa que Tipo de Registro, Data do Pgto e B/E nao sao obrigatorios', () => {
    expect(screen.getByText(/Tipo de Registro.*Data do Pgto da Comissao.*Comissao gerada pela B\/E.*não são obrigatórios/s)).toBeInTheDocument();
  });

  it('informa que o total usa somente Valor da Comissao', () => {
    expect(screen.getByText(/O total do documento usa somente o campo "Valor da Comissao"/)).toBeInTheDocument();
  });
});

describe('ImportHelp - copiar lista de campos', () => {
  it('copia a lista numerada para a area de transferencia ao clicar em Copiar', async () => {
    renderHelp('Relacao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    fireEvent.click(screen.getByRole('button', { name: /copiar lista de campos/i }));

    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });
    const copiedText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(copiedText.split('\n')).toHaveLength(12);
    expect(copiedText).toContain('1. Filial do Sistema');
    expect(copiedText).toContain('12. Valor da Comissao');
  });

  it('mostra um toast de sucesso apos copiar', async () => {
    renderHelp('Previsao');
    fireEvent.click(screen.getByRole('button', { name: /ajuda sobre o relatório/i }));
    fireEvent.click(screen.getByRole('button', { name: /copiar lista de campos/i }));

    await screen.findByText('Lista de campos copiada.');
  });
});
