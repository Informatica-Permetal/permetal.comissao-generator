import { embedImageAsDataUri } from '../embedImage';
import { escapeHtml } from '../format';
import type { PdfCompanyInfo, PdfDocumentIdentity } from '../types';

export function buildDocumentHeaderHtml(company: PdfCompanyInfo, generatedAtLabel: string): string {
  const logoDataUri = company.logoPath ? embedImageAsDataUri(company.logoPath) : null;
  const logoHtml = logoDataUri
    ? `<img class="doc-header__logo" src="${logoDataUri}" alt="${escapeHtml(company.displayName)}" />`
    : '';

  const companyLines: string[] = [];
  if (company.legalName) companyLines.push(escapeHtml(company.legalName));
  if (company.cnpj) companyLines.push(`CNPJ: ${escapeHtml(company.cnpj)}`);
  const addressLine = formatAddressLine(company);
  if (addressLine) companyLines.push(escapeHtml(addressLine));

  return `
    <header class="doc-header">
      <div class="doc-header__brand">
        ${logoHtml}
        <div class="doc-header__company">
          <strong>${escapeHtml(company.displayName)}</strong>
          ${companyLines.map((line) => `<span>${line}</span>`).join('')}
        </div>
      </div>
      <div class="doc-header__meta">
        <div>Gerado em ${escapeHtml(generatedAtLabel)}</div>
      </div>
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

export function buildIdentityHtml(identity: PdfDocumentIdentity): string {
  return `
    <section class="doc-identity">
      <dl>
        <dt>Vendedor</dt>
        <dd>${escapeHtml(identity.sellerName || '-')}</dd>
        <dt>Codigo</dt>
        <dd>${escapeHtml(identity.sellerCode)}</dd>
      </dl>
      <dl>
        <dt>Filial</dt>
        <dd>${escapeHtml(identity.branchName || '-')}</dd>
        <dt>Codigo da filial</dt>
        <dd>${escapeHtml(identity.branchCode)}</dd>
      </dl>
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
        Declaro que conferi e estou ciente das informacoes e dos valores apresentados neste relatorio.
      </p>
      <div class="signature__row">
        <div class="signature__line">Assinatura do Vendedor</div>
        <div class="signature__line">Assinatura do Responsavel</div>
        <div class="signature__date">Data: ____/____/________</div>
      </div>
    </section>
  `;
}

export function buildPrintHeaderTemplate(
  company: PdfCompanyInfo,
  modeTitle: string,
  identity: PdfDocumentIdentity
): string {
  return `
    <div style="font-size:8px; width:100%; padding:0 24px; display:flex; justify-content:space-between;
                color:#888; font-family:Arial,sans-serif;">
      <span>${escapeHtml(company.displayName)} - ${escapeHtml(modeTitle)}</span>
      <span>${escapeHtml(identity.sellerName)} (${escapeHtml(identity.sellerCode)}) - Filial ${escapeHtml(identity.branchCode)}</span>
    </div>
  `;
}

export function buildPrintFooterTemplate(): string {
  return `
    <div style="font-size:8px; width:100%; padding:0 24px; display:flex; justify-content:space-between;
                color:#666; font-family:Arial,sans-serif;">
      <span>Documento interno para conferencia</span>
      <span>Pagina <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>
  `;
}
