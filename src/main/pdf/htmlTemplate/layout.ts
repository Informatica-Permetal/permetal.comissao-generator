import { embedImageAsDataUri } from '../embedImage';
import { escapeHtml } from '../format';
import { buildPerforatedMetalMotif } from './perforatedMetal';
import type { PdfCompanyInfo, PdfDocumentIdentity } from '../types';

/**
 * Brand letterhead (logo + brand/legal identity) plus a decorative industrial
 * motif. Deliberately does NOT repeat the specific branch/seller identity -
 * that lives exactly once, in `buildDocumentMetaHtml` below - and does NOT
 * show a generation timestamp here either, for the same reason (single
 * source of truth, per branch instruction: an information appears once, in
 * the right place).
 */
export function buildDocumentHeaderHtml(company: PdfCompanyInfo): string {
  const logoDataUri = company.logoPath ? embedImageAsDataUri(company.logoPath) : null;
  const logoHtml = logoDataUri
    ? `<img class="doc-header__logo" src="${logoDataUri}" alt="${escapeHtml(company.displayName)}" />`
    : '';

  const brandName = company.legalName ?? company.brandLabel ?? company.displayName;
  const companyLines: string[] = [];
  if (company.cnpj) companyLines.push(`CNPJ: ${escapeHtml(company.cnpj)}`);
  const addressLine = formatAddressLine(company);
  if (addressLine) companyLines.push(escapeHtml(addressLine));

  return `
    <header class="doc-header">
      <div class="doc-header__brand">
        ${logoHtml}
        <div class="doc-header__company">
          <strong>${escapeHtml(brandName)}</strong>
          ${companyLines.map((line) => `<span>${line}</span>`).join('')}
        </div>
      </div>
      ${buildPerforatedMetalMotif()}
    </header>
  `;
}

function formatAddressLine(company: PdfCompanyInfo): string | null {
  const address = company.address;
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
 * The single authoritative place where this document's seller, branch and
 * generation date appear - vendor and branch identity are never repeated
 * anywhere else in the body (the letterhead above shows the issuing
 * company/brand, not the branch; the running page header/footer show only
 * short codes for page-tracking, never the full names again).
 */
export function buildDocumentMetaHtml(identity: PdfDocumentIdentity, generatedAtLabel: string): string {
  return `
    <section class="doc-meta">
      <div class="doc-meta__item">
        <p class="doc-meta__label">Vendedor</p>
        <p class="doc-meta__value">${escapeHtml(identity.sellerName || '-')}</p>
        <p class="doc-meta__sub">Código ${escapeHtml(identity.sellerCode)}</p>
      </div>
      <div class="doc-meta__item">
        <p class="doc-meta__label">Filial</p>
        <p class="doc-meta__value">${escapeHtml(identity.branchName || '-')}</p>
        <p class="doc-meta__sub">Código ${escapeHtml(identity.branchCode)}</p>
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
