import { describe, expect, it } from 'vitest';
import type { PdfCompanyInfo, PdfDocumentIdentity, ConsolidatedPdfIdentity } from '../types';
import {
  buildBranchDividerHtml,
  buildBranchTableContextRowHtml,
  buildConsolidatedCoverHtml,
  buildConsolidatedMetaHtml,
  buildConsolidatedPrintHeaderTemplate,
  buildDocumentHeaderHtml,
  buildDocumentMetaHtml,
  buildSignatureBlockHtml
} from './layout';

const FAKE_MOTIF_DATA_URI = 'data:image/png;base64,ZmFrZQ==';

const COMPANY_NO_GROUP: PdfCompanyInfo = {
  logoPath: null,
  displayName: 'PERMETAL SAO PAULO',
  brandLabel: 'Permetal',
  legalName: 'Permetal S A Metais Perfurados',
  cnpj: '61.139.192/0003-78',
  address: { endereco: 'Rua Dias da Silva, 1122', cidade: 'São Paulo', uf: 'SP' },
  group: null
};

const COMPANY_WITH_GROUP: PdfCompanyInfo = {
  logoPath: null,
  displayName: 'PERMETAL CRAVINHOS',
  brandLabel: 'Permetal',
  legalName: 'Permetal S A Metais Perfurados',
  cnpj: '61.139.192/0004-59',
  address: { endereco: 'Rodovia Anhanguera Km 298+193 Mts, S/N, Galpão 1-A', cidade: 'Cravinhos', uf: 'SP' },
  group: {
    displayName: 'Permetal S.A. Metais Perfurados',
    legalName: 'Permetal S A Metais Perfurados',
    headquartersAddress: { endereco: 'Rodovia Anhanguera Km 298+193 Mts, S/N, Galpão 1-A', cidade: 'Cravinhos', uf: 'SP' }
  }
};

const IDENTITY: PdfDocumentIdentity = {
  mode: 'Relacao',
  sellerCode: '000090',
  sellerName: 'CARLOS EDUARDO ROSA',
  branchCode: '0104',
  branchName: 'PERMETAL CRAVINHOS',
  generatedAt: new Date(),
  periodoAnalise: '01/08/2026 a 20/09/2026'
};

describe('buildDocumentHeaderHtml - sem grupo corporativo', () => {
  it('usa a razao social/marca da propria filial quando nao ha grupo (comportamento anterior preservado)', () => {
    const html = buildDocumentHeaderHtml(COMPANY_NO_GROUP);
    expect(html).toContain('Permetal S A Metais Perfurados');
    expect(html).toContain('CNPJ: 61.139.192/0003-78');
    expect(html).toContain('Rua Dias da Silva, 1122');
    // Sem grupo, nunca mostra linha "Matriz:" nem "Filial:" - nao ha dado de matriz para exibir.
    expect(html).not.toContain('Matriz:');
    expect(html).not.toContain('Filial:');
  });
});

describe('buildDocumentHeaderHtml - com grupo corporativo', () => {
  it('mostra grupo, razao social da matriz, endereco da matriz, filial e CNPJ da filial - todos os 6 campos exigidos', () => {
    const html = buildDocumentHeaderHtml(COMPANY_WITH_GROUP);
    expect(html).toContain('Permetal S.A. Metais Perfurados'); // grupo/organizacao
    expect(html).toContain('Permetal S A Metais Perfurados'); // razao social da matriz
    expect(html).toContain('Matriz: Rodovia Anhanguera Km 298+193 Mts, S/N, Galpão 1-A - Cravinhos/SP'); // endereco da matriz
    expect(html).toContain('Filial: PERMETAL CRAVINHOS'); // filial
    expect(html).toContain('CNPJ: 61.139.192/0004-59'); // CNPJ da filial (nunca o da matriz)
  });

  it('nunca usa uma filial especifica como identidade do grupo - o CNPJ mostrado e sempre o da propria filial', () => {
    const otherBranch: PdfCompanyInfo = {
      ...COMPANY_WITH_GROUP,
      displayName: 'PERMETAL SAO PAULO',
      cnpj: '61.139.192/0003-78'
    };
    const html = buildDocumentHeaderHtml(otherBranch);
    expect(html).toContain('CNPJ: 61.139.192/0003-78');
    expect(html).not.toContain('61.139.192/0004-59');
  });

  it('omite a linha de razao social da matriz quando ela e identica ao nome de exibicao do grupo (evita repetir o mesmo texto)', () => {
    const sameNameGroup: PdfCompanyInfo = {
      ...COMPANY_WITH_GROUP,
      group: { ...COMPANY_WITH_GROUP.group!, legalName: COMPANY_WITH_GROUP.group!.displayName }
    };
    const html = buildDocumentHeaderHtml(sameNameGroup);
    const occurrences = html.split(sameNameGroup.group!.displayName).length - 1;
    expect(occurrences).toBe(1);
  });

  it('nunca inventa endereco da matriz quando o grupo nao tem um cadastrado', () => {
    const groupNoAddress: PdfCompanyInfo = {
      ...COMPANY_WITH_GROUP,
      group: { ...COMPANY_WITH_GROUP.group!, headquartersAddress: null }
    };
    const html = buildDocumentHeaderHtml(groupNoAddress);
    expect(html).not.toContain('Matriz:');
  });
});

describe('buildDocumentMetaHtml', () => {
  it('mostra os 6 campos exigidos: vendedor, empresa/filial, codigo da filial, moeda, periodo e data de geracao', () => {
    const html = buildDocumentMetaHtml(IDENTITY, COMPANY_WITH_GROUP, '15/09/2026 10:00');
    expect(html).toContain('CARLOS EDUARDO ROSA');
    expect(html).toContain('Código 000090');
    expect(html).toContain('Permetal / PERMETAL CRAVINHOS'); // Empresa/Filial
    expect(html).toContain('0104'); // Codigo da filial
    expect(html).toContain('REAL'); // Moeda
    expect(html).toContain('01/08/2026 a 20/09/2026'); // Periodo de analise
    expect(html).toContain('15/09/2026 10:00'); // Data de geracao
  });

  it('Empresa/Filial cai para so o nome da filial quando nao ha marca resolvida', () => {
    const noBrand: PdfCompanyInfo = { ...COMPANY_WITH_GROUP, brandLabel: null };
    const html = buildDocumentMetaHtml(IDENTITY, noBrand, '15/09/2026 10:00');
    expect(html).toContain('PERMETAL CRAVINHOS');
    expect(html).not.toContain('undefined');
  });

  it('mostra "Não informado" quando o periodo de analise nao tem nenhuma data valida - nunca oculta o campo', () => {
    const noPeriod: PdfDocumentIdentity = { ...IDENTITY, periodoAnalise: 'Não informado' };
    const html = buildDocumentMetaHtml(noPeriod, COMPANY_WITH_GROUP, '15/09/2026 10:00');
    expect(html).toContain('Não informado');
  });
});

describe('buildConsolidatedMetaHtml - topo do consolidado nunca usa uma filial como identidade global', () => {
  const consolidatedIdentity: ConsolidatedPdfIdentity = {
    mode: 'Relacao',
    sellerCode: '000097',
    sellerName: 'RODRIGO LEAL MIGNELLA',
    branchCodes: ['0103', '0104', '0105'],
    generatedAt: new Date(),
    periodoAnalise: '01/08/2026 a 20/09/2026'
  };

  it('mostra vendedor, moeda, periodo geral e data de geracao - nunca uma filial ou empresa especifica', () => {
    const html = buildConsolidatedMetaHtml(consolidatedIdentity, '15/09/2026 10:00');
    expect(html).toContain('RODRIGO LEAL MIGNELLA');
    expect(html).toContain('Código 000097');
    expect(html).toContain('REAL');
    expect(html).toContain('01/08/2026 a 20/09/2026');
    expect(html).toContain('15/09/2026 10:00');
    // Nenhuma filial especifica e citada no bloco do topo.
    expect(html).not.toContain('0103');
    expect(html).not.toContain('0104');
    expect(html).not.toContain('0105');
  });
});

describe('buildConsolidatedPrintHeaderTemplate - nunca usa uma filial/empresa como identidade global', () => {
  it('mostra o modo e o vendedor, nunca um CNPJ, razao social ou logo de uma filial especifica', () => {
    const identity: ConsolidatedPdfIdentity = {
      mode: 'Relacao',
      sellerCode: '000097',
      sellerName: 'RODRIGO LEAL MIGNELLA',
      branchCodes: ['0103', '0104', '0105'],
      generatedAt: new Date(),
      periodoAnalise: 'Não informado'
    };
    const html = buildConsolidatedPrintHeaderTemplate('Relação de Comissões', identity);
    expect(html).toContain('RODRIGO LEAL MIGNELLA');
    expect(html).toContain('3 filiais');
    expect(html).not.toContain('CNPJ');
  });
});

describe('buildBranchTableContextRowHtml', () => {
  it('identifica a filial dentro do proprio thead, para repetir em paginas de continuacao', () => {
    const html = buildBranchTableContextRowHtml('0105', 'METALGRADE NOVA', 7);
    expect(html).toContain('Filial 0105 - METALGRADE NOVA');
    expect(html).toContain('colspan="7"');
    expect(html).toContain('branch-context-row');
  });
});

describe('buildDocumentHeaderHtml - motivo industrial (chapa perfurada)', () => {
  it('renderiza a imagem real quando um data URI e fornecido', () => {
    const html = buildDocumentHeaderHtml(COMPANY_NO_GROUP, FAKE_MOTIF_DATA_URI);
    expect(html).toContain(`<img class="doc-header__motif" src="${FAKE_MOTIF_DATA_URI}"`);
  });

  it('omite a imagem (nunca um placeholder gerado) quando nao ha data URI', () => {
    const html = buildDocumentHeaderHtml(COMPANY_NO_GROUP);
    expect(html).not.toContain('doc-header__motif');
    expect(html).not.toContain('<svg');
  });
});

describe('buildConsolidatedCoverHtml', () => {
  it('mostra o titulo, subtitulo e a imagem do motivo quando fornecida - nunca dado de filial/empresa', () => {
    const html = buildConsolidatedCoverHtml(
      'Relação de Comissões — Consolidado por Vendedor',
      'Comissões para conferência e pagamento',
      FAKE_MOTIF_DATA_URI
    );
    expect(html).toContain('Relação de Comissões — Consolidado por Vendedor');
    expect(html).toContain('Comissões para conferência e pagamento');
    expect(html).toContain(`<img class="doc-cover__motif" src="${FAKE_MOTIF_DATA_URI}"`);
    expect(html).not.toContain('CNPJ');
  });

  it('omite a imagem quando nao ha data URI, mantendo o titulo', () => {
    const html = buildConsolidatedCoverHtml('Título', 'Subtítulo');
    expect(html).toContain('Título');
    expect(html).not.toContain('doc-cover__motif');
  });
});

describe('buildBranchDividerHtml - separador entre filiais', () => {
  it('inclui a imagem do motivo quando fornecida', () => {
    const html = buildBranchDividerHtml(FAKE_MOTIF_DATA_URI);
    expect(html).toContain('branch-divider');
    expect(html).toContain(`<img class="branch-divider__motif" src="${FAKE_MOTIF_DATA_URI}"`);
  });

  it('ainda produz o separador visual (linha) quando nao ha data URI', () => {
    const html = buildBranchDividerHtml();
    expect(html).toContain('branch-divider');
    expect(html).not.toContain('branch-divider__motif');
  });
});

describe('buildSignatureBlockHtml', () => {
  it('sempre mostra a declaracao e as duas assinaturas, com ou sem motivo', () => {
    const html = buildSignatureBlockHtml();
    expect(html).toContain('Declaro que conferi');
    expect(html).toContain('Assinatura do Vendedor');
    expect(html).toContain('Assinatura do Responsável');
    expect(html).not.toContain('doc-footer-motif');
  });

  it('adiciona o acento discreto do rodape antes da assinatura quando ha data URI', () => {
    const html = buildSignatureBlockHtml(FAKE_MOTIF_DATA_URI);
    expect(html).toContain('doc-footer-motif');
    expect(html.indexOf('doc-footer-motif')).toBeLessThan(html.indexOf('signature__declaration'));
  });
});
