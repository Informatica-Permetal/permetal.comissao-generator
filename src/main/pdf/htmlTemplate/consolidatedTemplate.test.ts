/// <reference lib="dom" />
// This suite's structural assertions need DOMParser to check real nesting (not string/regex
// matching). tsconfig.node.json deliberately has no DOM lib (main-process code shouldn't use
// DOM globals) - this directive opts in just this test file's type-checking, while DOMParser
// itself is available at runtime because vitest.config.ts's shared test environment is jsdom.
import { describe, expect, it } from 'vitest';
import type {
  PdfCompanyInfo,
  PrevisaoConsolidatedBranchSection,
  PrevisaoConsolidatedPdfViewModel,
  RelacaoConsolidatedBranchSection,
  RelacaoConsolidatedPdfViewModel
} from '../types';
import { buildPrevisaoConsolidatedHtmlDocument, buildRelacaoConsolidatedHtmlDocument } from './consolidatedTemplate';

const FAKE_COMPANY: PdfCompanyInfo = {
  logoPath: null,
  displayName: 'Permetal São Paulo',
  brandLabel: 'Permetal',
  legalName: null,
  cnpj: null,
  address: null,
  group: null
};

describe('buildPrevisaoConsolidatedHtmlDocument - cabecalho global', () => {
  const branch: PrevisaoConsolidatedBranchSection = {
    branchCode: '0103',
    branchName: 'PERMETAL SAO PAULO',
    company: FAKE_COMPANY,
    sections: [],
    rowCount: 0,
    subtotal: 'R$ 0,00'
  };

  const vm: PrevisaoConsolidatedPdfViewModel = {
    identity: {
      mode: 'Previsao',
      sellerCode: '000001',
      sellerName: 'ADEMIR FURLANETO',
      branchCodes: ['0103', '0104'],
      generatedAt: new Date('2026-09-21T11:32:00Z'),
      periodoAnalise: '03/08/2026 a 07/08/2026'
    },
    branches: [branch],
    rowCount: 0,
    total: 'R$ 0,00'
  };

  it('separa o titulo principal ("Previsão de Comissões") do contexto ("Consolidado por vendedor") em elementos distintos', () => {
    const html = buildPrevisaoConsolidatedHtmlDocument(vm, '21/09/2026 11:32');
    expect(html).toContain('<h1>Previsão de Comissões</h1>');
    expect(html).toContain('<p>Consolidado por vendedor</p>');
  });

  it('nunca junta modo e variante numa unica string longa (a causa da quebra de linha feia)', () => {
    const html = buildPrevisaoConsolidatedHtmlDocument(vm, '21/09/2026 11:32');
    expect(html).not.toContain('<h1>Previsão de Comissões — Consolidado por Vendedor</h1>');
    expect(html).not.toContain('CONSOLIDADO POR VENDEDOR');
  });

  it('titulo/subtitulo e a grade de metadados (vendedor/moeda/periodo/data) sao um unico bloco de cabecalho, nao dois elementos soltos', () => {
    const html = buildPrevisaoConsolidatedHtmlDocument(vm, '21/09/2026 11:32');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const headerBlock = doc.querySelector('.doc-header-block');
    expect(headerBlock).not.toBeNull();
    expect(headerBlock?.querySelector('.doc-cover')).not.toBeNull();
    expect(headerBlock?.querySelector('.doc-meta')).not.toBeNull();
  });

  it('cabecalho da filial (logo/empresa) e a tabela daquela filial formam um unico bloco visual; o subtotal fica fora dele', () => {
    const html = buildPrevisaoConsolidatedHtmlDocument(vm, '21/09/2026 11:32');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const branchBlock = doc.querySelector('.branch-section .branch-block');
    expect(branchBlock).not.toBeNull();
    expect(branchBlock?.querySelector('.doc-header')).not.toBeNull();
    expect(branchBlock?.querySelector('table')).not.toBeNull();
    // O subtotal e um elemento irmao do bloco, nao um descendente dele.
    expect(branchBlock?.querySelector('.subtotal-block')).toBeNull();
    expect(doc.querySelector('.branch-section > .subtotal-block')).not.toBeNull();
  });
});

describe('buildRelacaoConsolidatedHtmlDocument - cabecalho global', () => {
  const branch: RelacaoConsolidatedBranchSection = {
    branchCode: '0103',
    branchName: 'PERMETAL SAO PAULO',
    company: FAKE_COMPANY,
    rows: [],
    rowCount: 0,
    subtotal: 'R$ 0,00'
  };

  const vm: RelacaoConsolidatedPdfViewModel = {
    identity: {
      mode: 'Relacao',
      sellerCode: '000001',
      sellerName: 'ADEMIR FURLANETO',
      branchCodes: ['0103', '0104'],
      generatedAt: new Date('2026-09-21T11:32:00Z'),
      periodoAnalise: '03/08/2026 a 07/08/2026'
    },
    branches: [branch],
    rowCount: 0,
    total: 'R$ 0,00'
  };

  it('separa o titulo principal ("Relação de Comissões") do contexto ("Consolidado por vendedor") em elementos distintos', () => {
    const html = buildRelacaoConsolidatedHtmlDocument(vm, '21/09/2026 11:32');
    expect(html).toContain('<h1>Relação de Comissões</h1>');
    expect(html).toContain('<p>Consolidado por vendedor</p>');
  });

  it('nunca junta modo e variante numa unica string longa (a causa da quebra de linha feia)', () => {
    const html = buildRelacaoConsolidatedHtmlDocument(vm, '21/09/2026 11:32');
    expect(html).not.toContain('<h1>Relação de Comissões — Consolidado por Vendedor</h1>');
    expect(html).not.toContain('CONSOLIDADO POR VENDEDOR');
  });

  it('titulo/subtitulo e a grade de metadados (vendedor/moeda/periodo/data) sao um unico bloco de cabecalho, nao dois elementos soltos', () => {
    const html = buildRelacaoConsolidatedHtmlDocument(vm, '21/09/2026 11:32');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const headerBlock = doc.querySelector('.doc-header-block');
    expect(headerBlock).not.toBeNull();
    expect(headerBlock?.querySelector('.doc-cover')).not.toBeNull();
    expect(headerBlock?.querySelector('.doc-meta')).not.toBeNull();
  });

  it('cabecalho da filial (logo/empresa) e a tabela daquela filial formam um unico bloco visual; o subtotal fica fora dele', () => {
    const html = buildRelacaoConsolidatedHtmlDocument(vm, '21/09/2026 11:32');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const branchBlock = doc.querySelector('.branch-section .branch-block');
    expect(branchBlock).not.toBeNull();
    expect(branchBlock?.querySelector('.doc-header')).not.toBeNull();
    expect(branchBlock?.querySelector('table')).not.toBeNull();
    expect(branchBlock?.querySelector('.subtotal-block')).toBeNull();
    expect(doc.querySelector('.branch-section > .subtotal-block')).not.toBeNull();
  });
});
