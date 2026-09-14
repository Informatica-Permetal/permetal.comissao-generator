export const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1a1a1a;
    font-size: 11px;
  }
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #1a1a1a;
    margin-bottom: 14px;
  }
  .doc-header__brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .doc-header__logo {
    height: 52px;
    width: auto;
    object-fit: contain;
  }
  .doc-header__company strong {
    display: block;
    font-size: 13px;
    color: #111;
  }
  .doc-header__company span {
    display: block;
    font-size: 9.5px;
    color: #444;
    line-height: 1.5;
  }
  .doc-header__meta {
    text-align: right;
    font-size: 9px;
    color: #666;
    line-height: 1.6;
    white-space: nowrap;
  }
  .doc-title {
    text-align: center;
    margin: 6px 0 14px;
  }
  .doc-title h1 {
    font-size: 19px;
    letter-spacing: 0.6px;
    margin: 0;
    text-transform: uppercase;
  }
  .doc-title p {
    margin: 3px 0 0;
    font-size: 10.5px;
    color: #555;
  }
  .doc-identity {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin: 0 0 16px;
    padding: 10px 14px;
    background: #f3f4f5;
    border-radius: 4px;
  }
  .doc-identity dl {
    margin: 0;
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 2px 10px;
    font-size: 10px;
  }
  .doc-identity dt { color: #666; }
  .doc-identity dd { margin: 0; font-weight: 600; color: #111; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5px;
  }
  thead { display: table-header-group; }
  thead th {
    background: #1a1a1a;
    color: #fff;
    text-align: left;
    padding: 6px 8px;
    font-weight: 600;
    white-space: nowrap;
  }
  tbody td {
    padding: 5px 8px;
    border-bottom: 1px solid #e3e3e3;
    vertical-align: top;
  }
  tbody tr { break-inside: avoid; page-break-inside: avoid; }
  tbody tr.data-row:nth-child(even) { background: #fafafa; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tr.section-row td {
    background: #eaecee;
    font-weight: 700;
    padding: 6px 8px;
    border-top: 2px solid #1a1a1a;
    border-bottom: 1px solid #ccc;
  }
  .total-block {
    display: flex;
    justify-content: flex-end;
    margin: 18px 0 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .total-block__inner {
    text-align: right;
    border-top: 2px solid #1a1a1a;
    padding-top: 8px;
    min-width: 220px;
  }
  .total-block__label {
    font-size: 10.5px;
    letter-spacing: 0.6px;
    color: #555;
    text-transform: uppercase;
  }
  .total-block__value {
    font-size: 20px;
    font-weight: 700;
    color: #111;
  }
  .signature {
    margin-top: 36px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .signature__declaration {
    font-size: 9.5px;
    color: #333;
    margin-bottom: 30px;
  }
  .signature__row {
    display: flex;
    align-items: flex-end;
    gap: 32px;
  }
  .signature__line {
    flex: 1;
    border-top: 1px solid #1a1a1a;
    padding-top: 5px;
    font-size: 9px;
    text-align: center;
    color: #333;
  }
  .signature__date {
    font-size: 9px;
    color: #333;
    white-space: nowrap;
    padding-top: 5px;
  }
`;
