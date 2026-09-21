import { embedImageAsDataUri } from '../embedImage';
import { escapeHtml } from '../format';
import type { ConsolidatedPdfIdentity, PdfCompanyInfo, PdfDocumentIdentity } from '../types';

/**
 * Renders the real "chapa perfurada" (perforated metal sheet) photo as the
 * decorative industrial motif - a local asset embedded as a data: URI (see
 * `embedImageAsDataUri`), never generated or fetched at runtime. `null` when
 * the caller has no motif to show (e.g. the asset is missing on disk), in
 * which case the motif is simply omitted - never a placeholder or a broken
 * image reference.
 */
function buildMotifImgHtml(motifDataUri: string | null, className: string): string {
  return motifDataUri ? `<img class="${className}" src="${motifDataUri}" alt="" />` : '';
}

/**
 * Institutional letterhead (logo + corporate identity), optionally paired
 * with the decorative industrial motif. Shows, in order, exactly the fields
 * required for every document (separado, or one per branch inside a
 * consolidado): grupo/organização, razão social da matriz, endereço da
 * matriz, filial, CNPJ da filial, marca/logo - each line omitted (never
 * invented) when its underlying data is absent. Falls back to the branch's
 * own identity alone when it belongs to no known corporate group. Deliberately
 * does NOT repeat the specific seller identity or a generation timestamp -
 * those live exactly once, in `buildDocumentMetaHtml`/`buildConsolidatedMetaHtml`.
 *
 * The motif is meant to appear exactly once per document, in its one global
 * header: a separado document's single call keeps it, but a consolidado's
 * repeated per-branch calls (see `consolidatedTemplate.ts`) omit it - the
 * motif already appears once in that document's own cover
 * (`buildConsolidatedCoverHtml`).
 */
export function buildDocumentHeaderHtml(company: PdfCompanyInfo, motifDataUri: string | null = null): string {
  const logoDataUri = company.logoPath ? embedImageAsDataUri(company.logoPath) : null;
  const logoHtml = logoDataUri
    ? `<img class="doc-header__logo" src="${logoDataUri}" alt="${escapeHtml(company.displayName)}" />`
    : '';

  const companyLines: string[] = [];
  let headlineName: string;

  if (company.group) {
    headlineName = company.group.displayName;
    if (company.group.legalName && company.group.legalName !== company.group.displayName) {
      companyLines.push(escapeHtml(company.group.legalName));
    }
    const matrizAddressLine = formatAddressLine(company.group.headquartersAddress);
    if (matrizAddressLine) companyLines.push(`Matriz: ${escapeHtml(matrizAddressLine)}`);
    companyLines.push(`Filial: ${escapeHtml(company.displayName)}`);
    if (company.cnpj) companyLines.push(`CNPJ: ${escapeHtml(company.cnpj)}`);
  } else {
    // No known corporate group for this branch - falls back to its own identity alone,
    // exactly as before the group concept existed (never invents a group that isn't there).
    headlineName = company.legalName ?? company.brandLabel ?? company.displayName;
    if (company.cnpj) companyLines.push(`CNPJ: ${escapeHtml(company.cnpj)}`);
    const addressLine = formatAddressLine(company.address);
    if (addressLine) companyLines.push(escapeHtml(addressLine));
  }

  return `
    <header class="doc-header">
      <div class="doc-header__brand">
        ${logoHtml}
        <div class="doc-header__company">
          <strong>${escapeHtml(headlineName)}</strong>
          ${companyLines.map((line) => `<span>${line}</span>`).join('')}
        </div>
      </div>
      ${buildMotifImgHtml(motifDataUri, 'doc-header__motif')}
    </header>
  `;
}

function formatAddressLine(address: { endereco?: string; cidade?: string; uf?: string } | null): string | null {
  if (!address) return null;
  const parts = [address.endereco, [address.cidade, address.uf].filter(Boolean).join('/')].filter(
    (part) => part && part.trim() !== ''
  );
  return parts.length > 0 ? parts.join(' - ') : null;
}

export function buildTitleHtml(title: string, subtitle: string): string {
  return `
    <div class="doc-title">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </div>
  `;
}

/**
 * First-page cover for a consolidado PDF - stands in for `buildDocumentHeaderHtml`
 * at the top of the document, since a consolidado's title block carries no
 * company/branch identity (see `buildConsolidatedMetaHtml`). Pairs the title
 * with the same industrial motif used in every branch's own letterhead, so
 * the document opens with a consistent visual identity before any specific
 * filial is shown.
 *
 * `title` and `subtitle` are deliberately kept semantically separate (never
 * concatenated by the caller into one long string, e.g. "Previsão de
 * Comissões — Consolidado por Vendedor") - `title` is just the mode name
 * ("Previsão de Comissões"/"Relação de Comissões"), always short enough to
 * never wrap even at this cover's larger type size; `subtitle` carries the
 * variant/context ("Consolidado por vendedor"), rendered smaller and lighter
 * as a clearly secondary line.
 */
export function buildConsolidatedCoverHtml(title: string, subtitle: string, motifDataUri: string | null = null): string {
  return `
    <header class="doc-cover">
      <div class="doc-cover__text">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      ${buildMotifImgHtml(motifDataUri, 'doc-cover__motif')}
    </header>
  `;
}

/**
 * The single authoritative place where this document's seller, branch,
 * moeda, período de análise and generation date appear - never repeated
 * anywhere else in the body (the letterhead above shows the issuing
 * company/brand, not the seller/branch; the running page header/footer show
 * only short codes for page-tracking, never the full names again).
 */
export function buildDocumentMetaHtml(
  identity: PdfDocumentIdentity,
  company: PdfCompanyInfo,
  generatedAtLabel: string
): string {
  const empresaFilial = company.brandLabel
    ? `${company.brandLabel} / ${identity.branchName || '-'}`
    : identity.branchName || '-';

  return `
    <section class="doc-meta">
      <div class="doc-meta__item">
        <p class="doc-meta__label">Vendedor</p>
        <p class="doc-meta__value">${escapeHtml(identity.sellerName || '-')}</p>
        <p class="doc-meta__sub">Código ${escapeHtml(identity.sellerCode)}</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Empresa/Filial</p>
        <p class="doc-meta__value">${escapeHtml(empresaFilial)}</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Código da Filial</p>
        <p class="doc-meta__value">${escapeHtml(identity.branchCode)}</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Moeda</p>
        <p class="doc-meta__value">REAL</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Período de Análise</p>
        <p class="doc-meta__value">${escapeHtml(identity.periodoAnalise)}</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Data de Geração</p>
        <p class="doc-meta__value">${escapeHtml(generatedAtLabel)}</p>
      </div>
    </section>
  `;
}

export function buildTotalBlockHtml(label: string, value: string): string {
  return `
    <div class="total-block">
      <div class="total-block__inner">
        <div class="total-block__label">${escapeHtml(label)}</div>
        <div class="total-block__value">${escapeHtml(value)}</div>
      </div>
    </div>
  `;
}

/**
 * The top-of-document block for a consolidado PDF - deliberately carries NO
 * company/branch identity (no specific filial is used as the document's
 * global identity): only the seller, moeda, período geral and data de
 * geração. Each branch's own institutional identity is shown separately,
 * once per branch, via `buildDocumentHeaderHtml` inside its own section.
 */
export function buildConsolidatedMetaHtml(identity: ConsolidatedPdfIdentity, generatedAtLabel: string): string {
  return `
    <section class="doc-meta doc-meta--consolidated-top">
      <div class="doc-meta__item">
        <p class="doc-meta__label">Vendedor</p>
        <p class="doc-meta__value">${escapeHtml(identity.sellerName || '-')}</p>
        <p class="doc-meta__sub">Código ${escapeHtml(identity.sellerCode)}</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Moeda</p>
        <p class="doc-meta__value">REAL</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Período de Análise</p>
        <p class="doc-meta__value">${escapeHtml(identity.periodoAnalise)}</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Data de Geração</p>
        <p class="doc-meta__value">${escapeHtml(generatedAtLabel)}</p>
      </div>
    </section>
  `;
}

/**
 * Repeats at the top of every table inside a `<thead>` (so it survives page
 * breaks automatically, same mechanism as the column-header row) - the only
 * reliable way to identify which filial a consolidado table's continuation
 * pages belong to, since Chromium's print header/footer templates are
 * static and cannot know which DOM section is showing on a given page.
 */
export function buildBranchTableContextRowHtml(branchCode: string, branchName: string, columnCount: number): string {
  return `<tr class="branch-context-row"><td colspan="${columnCount}">Filial ${escapeHtml(branchCode)} - ${escapeHtml(branchName)}</td></tr>`;
}

/**
 * Elegant, unambiguous separator between two consecutive filial sections in a
 * consolidado - never placed before the first section. A plain rule, never
 * the industrial motif (that appears exactly once, in the document's own
 * global cover header - see `buildConsolidatedCoverHtml`): the actual
 * identity change is carried by the next section's own
 * `buildDocumentHeaderHtml` letterhead, this just makes the transition
 * impossible to miss when skimming a printed multi-filial document.
 */
export function buildBranchDividerHtml(): string {
  return `<div class="branch-divider"></div>`;
}

export function buildSubtotalBlockHtml(label: string, value: string): string {
  return `
    <div class="subtotal-block">
      <div class="subtotal-block__inner">
        <div class="subtotal-block__label">${escapeHtml(label)}</div>
        <div class="subtotal-block__value">${escapeHtml(value)}</div>
      </div>
    </div>
  `;
}

/**
 * Running header for a consolidado document - deliberately never names a
 * single branch/company as the document's identity (per-page it only shows
 * the mode and the seller, matching the "no specific filial as global
 * identity" rule); which filial a given page's table belongs to is instead
 * identified via `buildBranchTableContextRowHtml`, repeated in-table.
 */
export function buildConsolidatedPrintHeaderTemplate(modeTitle: string, identity: ConsolidatedPdfIdentity): string {
  return `
    <div style="font-size:7px; width:100%; padding:0 24px 3px; display:flex; justify-content:space-between;
                color:#9a9a9a; font-family:Arial,sans-serif; border-bottom:0.5px solid #d8d8d8;">
      <span>${escapeHtml(modeTitle)} - Consolidado por Vendedor</span>
      <span>Vend. ${escapeHtml(identity.sellerName)} (${escapeHtml(identity.sellerCode)}) - ${identity.branchCodes.length} filiais</span>
    </div>
  `;
}

/**
 * Closing block of every document - the signature always appears exactly
 * once, at the very end (never per filial in a consolidado). Never carries
 * the industrial motif - that appears exactly once, in the document's own
 * global header/cover, nowhere else.
 */
export function buildSignatureBlockHtml(): string {
  return `
    <section class="signature">
      <p class="signature__declaration">
        Declaro que conferi e estou ciente das informações e dos valores apresentados neste relatório.
      </p>
      <div class="signature__row">
        <div class="signature__line">Assinatura do Vendedor</div>
        <div class="signature__line">Assinatura do Responsável</div>
        <div class="signature__date">Data: ____/____/________</div>
      </div>
    </section>
  `;
}

/**
 * Chromium's native running header, rendered identically on EVERY page
 * (including page 1, above our own HTML content) - kept deliberately tiny
 * and code-only (not the full names already shown once in the in-document
 * meta block) so it reads as a page-tracking utility, not a second
 * restatement of the document's identity.
 */
export function buildPrintHeaderTemplate(
  company: PdfCompanyInfo,
  modeTitle: string,
  identity: PdfDocumentIdentity
): string {
  const brandName = company.legalName ?? company.brandLabel ?? company.displayName;
  return `
    <div style="font-size:7px; width:100%; padding:0 24px 3px; display:flex; justify-content:space-between;
                color:#9a9a9a; font-family:Arial,sans-serif; border-bottom:0.5px solid #d8d8d8;">
      <span>${escapeHtml(brandName)} - ${escapeHtml(modeTitle)}</span>
      <span>Vend. ${escapeHtml(identity.sellerCode)} - Filial ${escapeHtml(identity.branchCode)}</span>
    </div>
  `;
}

export function buildPrintFooterTemplate(): string {
  return `
    <div style="font-size:7px; width:100%; padding:3px 24px 0; display:flex; justify-content:space-between;
                color:#9a9a9a; font-family:Arial,sans-serif; border-top:0.5px solid #d8d8d8;">
      <span>Documento interno para conferência</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>
  `;
}
