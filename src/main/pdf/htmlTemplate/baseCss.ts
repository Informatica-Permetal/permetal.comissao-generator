export const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1a1a1a;
    font-size: 10px;
  }

  /* ---------- Header (brand + decorative motif) ---------- */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 14px;
    margin-bottom: 4px;
    border-bottom: 2px solid #1a1a1a;
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: avoid-page;
  }
  .doc-header__brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .doc-header__logo {
    height: 46px;
    width: auto;
    max-width: 150px;
    object-fit: contain;
  }
  .doc-header__company strong {
    display: block;
    font-size: 13px;
    letter-spacing: 0.3px;
    color: #111;
  }
  .doc-header__company span {
    display: block;
    font-size: 9px;
    color: #555;
    line-height: 1.55;
  }
  /* Real "chapa perfurada" photo, cropped to its textured right edge - a compact corner accent,
     no fade needed at this size (the fade is reserved for the wider consolidado cover below). */
  .doc-header__motif {
    flex: none;
    display: block;
    width: 148px;
    height: 66px;
    object-fit: cover;
    object-position: right center;
    border-radius: 4px;
    border: 1px solid #d5d8db;
  }
  .doc-header__meta {
    text-align: right;
    font-size: 8.5px;
    color: #777;
    white-space: nowrap;
    margin-top: 2px;
  }

  /* ---------- Title ---------- */
  .doc-title {
    text-align: center;
    margin: 14px 0 16px;
  }
  .doc-title h1 {
    font-size: 20px;
    letter-spacing: 0.8px;
    margin: 0;
    text-transform: uppercase;
    color: #111;
  }
  .doc-title p {
    margin: 4px 0 0;
    font-size: 10px;
    color: #666;
  }

  /* ---------- Consolidado cover (first-page title, no branch identity) ---------- */
  .doc-cover {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding-bottom: 16px;
    margin-bottom: 4px;
    border-bottom: 2px solid #1a1a1a;
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: avoid-page;
  }
  .doc-cover__text { flex: 1 1 auto; min-width: 0; }
  .doc-cover__text h1 {
    font-size: 19px;
    letter-spacing: 0.6px;
    margin: 0;
    text-transform: uppercase;
    color: #111;
  }
  .doc-cover__text p {
    margin: 5px 0 0;
    font-size: 10px;
    color: #666;
  }
  /* Full banner, fade intact (not cropped) - the one place this document shows the
     "arte industrial" treatment the photo was composed for, blending into the page. */
  .doc-cover__motif {
    flex: none;
    height: 86px;
    width: auto;
    max-width: 320px;
    object-fit: contain;
    object-position: right center;
  }

  /* ---------- Identity / metadata block (vendedor, filial, data - shown once) ---------- */
  .doc-meta {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    margin: 0 0 18px;
    background: #f5f6f7;
    border: 1px solid #e5e7e9;
    border-radius: 6px;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .doc-meta__item {
    padding: 9px 14px;
    border-left: 1px solid #e5e7e9;
  }
  .doc-meta__item:first-child { border-left: none; }
  .doc-meta__label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #7a828c;
    margin: 0 0 3px;
  }
  .doc-meta__value {
    font-size: 11.5px;
    font-weight: 600;
    color: #111;
    margin: 0;
    line-height: 1.3;
  }
  .doc-meta__sub {
    font-size: 9px;
    color: #666;
    margin: 1px 0 0;
  }
  /* Top-of-consolidado block: no branch/company identity, just 4 document-level facts. */
  .doc-meta--consolidated-top { grid-template-columns: repeat(4, 1fr); }

  /* ---------- Table ---------- */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.8px;
    table-layout: fixed;
  }
  thead { display: table-header-group; }
  thead th {
    background: #1a1a1a;
    color: #fff;
    text-align: left;
    padding: 6px 7px;
    font-weight: 600;
    font-size: 8.3px;
    letter-spacing: 0.2px;
    text-transform: uppercase;
  }
  tbody td {
    padding: 5px 7px;
    border-bottom: 1px solid #e8e8e8;
    vertical-align: top;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  tbody tr { break-inside: avoid; page-break-inside: avoid; }
  tbody tr.data-row:nth-child(even) { background: #fafbfb; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  td.nowrap, th.nowrap { white-space: nowrap; }
  tr.section-row td {
    background: #eaecee;
    font-weight: 700;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 6px 7px;
    border-top: 2px solid #1a1a1a;
    border-bottom: 1px solid #ccc;
  }
  /* Repeats inside <thead> on every page a consolidado branch's table spans, so a
     continuation page never leaves the reader unsure which filial it belongs to. */
  tr.branch-context-row td {
    background: #1a1a1a;
    color: #fff;
    font-weight: 700;
    font-size: 8.3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 5px 7px;
  }

  /* ---------- Total ---------- */
  .total-block {
    display: flex;
    justify-content: flex-end;
    margin: 16px 0 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .total-block__inner {
    text-align: right;
    background: #1a1a1a;
    color: #fff;
    padding: 10px 18px;
    border-radius: 6px;
    min-width: 210px;
  }
  .total-block__label {
    font-size: 9px;
    letter-spacing: 0.8px;
    color: #c9cbce;
    text-transform: uppercase;
  }
  .total-block__value {
    font-size: 19px;
    font-weight: 700;
    color: #fff;
    margin-top: 2px;
  }

  /* ---------- Consolidated (multi-branch) sections ---------- */
  .branch-section {
    margin-top: 22px;
  }
  /* Deliberately no break-inside:avoid-page here: a real filial section is very often taller
     than a single page (its own header and subtotal already have their own break protection
     below), and forcing the whole section to avoid splitting only pushes it to start on a fresh
     page even when the previous page still has plenty of room - wasting it for no benefit, since
     the "avoid" could never actually be honored for a section that large anyway. Found via a real
     230-row/3-filial sample, where filial 0103 alone left most of the cover page blank. */
  /* Elegant, unambiguous break between filiais - one plain, continuous rule (never the industrial
     motif, which appears exactly once, in the document's own global cover), so a reader skimming a
     printed multi-filial document never mistakes a new section for a continuation of the previous
     filial. Never rendered before the first section. */
  .branch-divider {
    margin: 30px 0 4px;
    height: 1px;
    background: #d5d8db;
    break-after: avoid-page;
  }
  .subtotal-block {
    display: flex;
    justify-content: flex-end;
    margin: 8px 0 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .subtotal-block__inner {
    text-align: right;
    background: #eaecee;
    color: #1a1a1a;
    padding: 6px 14px;
    border-radius: 5px;
    min-width: 170px;
  }
  .subtotal-block__label {
    font-size: 7.8px;
    letter-spacing: 0.6px;
    color: #666;
    text-transform: uppercase;
  }
  .subtotal-block__value {
    font-size: 13px;
    font-weight: 700;
    margin-top: 1px;
  }

  /* ---------- Signature ---------- */
  .signature {
    margin-top: 34px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .signature__declaration {
    font-size: 9px;
    color: #333;
    margin-bottom: 28px;
    padding-top: 10px;
    border-top: 1px solid #e0e0e0;
  }
  .signature__row {
    display: flex;
    align-items: flex-end;
    gap: 24px;
  }
  .signature__line {
    flex: 1;
    border-top: 1px solid #1a1a1a;
    padding-top: 5px;
    font-size: 8.5px;
    text-align: center;
    color: #333;
  }
  .signature__date {
    font-size: 8.5px;
    color: #333;
    white-space: nowrap;
    padding-top: 5px;
    border-top: 1px solid transparent;
  }
`;
