# Input Contracts - Smart View v1

These contracts were validated against the two reduced `.xlsx` exports supplied by the user. Treat them as the v1 input contract. Column order is not significant, but all required canonical fields must be present after header normalization.

## Global import rules

- Accept `.xlsx` only in v1.
- Resolve columns by header name, never by position.
- Trim Unicode whitespace on headers and cells. The validated Previsao workbook contained trailing spaces in `Vencimento` and `DT Baixa` before trimming.
- Preserve identifier cells as text and preserve leading zeros.
- Never deduplicate rows.
- Never calculate commission from base/percentage/date/status.
- The only financial arithmetic is summing the designated commission field for one seller + branch document.
- Blank designated commission cells contribute zero to the total but the row itself remains present.
- Negative designated commission cells remain negative and reduce the total.
- Keep original source order unless the PDF renderer groups Previsao rows by classification; even then preserve original relative order inside each classification.

## Contract A - Previsao de Comissoes

Validated workbook dimensions: 165 data rows and 13 columns. Observed branches were 0103, 0104, 0105, and 0106. Observed classifications included `Titulo original` and `Pedido de venda` (actual workbook labels contain Portuguese accents).

### Required fields

1. `Dados do cliente` - Client display/audit data; do not use for financial decisions.
2. `Dados do título` - Title/document display value.
3. `Dados do pedido` - Order display value; may be blank for title rows.
4. `Emissão pedido/título` - Display date only.
5. `Vencimento` - Display date only.
6. `Valor base para baixa` - Display base value only; NEVER use to derive commission.
7. `Valor total de comissão` - Gross commission source/audit value; NEVER derive net from it.
8. `DT Baixa` - Display/audit date only; NEVER use to decide inclusion.
9. `Valor IRRF` - IRRF source/audit value; NEVER recalculate it.
10. `Comissão total (líquido)` - Authoritative field for displayed commission and the ONLY field summed for the Previsao document total.
11. `Dados do vendedor` - Contains seller code + seller name. Parse identity from this field without losing leading zeros.
12. `Classificação` - Raw classification used for visual grouping only. Never filter eligibility based on it.
13. `Nome da filial` - Contains branch code + branch name. Branch code is the document/company profile key.

### Previsao identity parsing

Validated seller example pattern: `000001 - ADEMIR FURLANETO`.
Parse with a robust first separator strategy, keeping seller code as text.

Validated branch example pattern: `0104 - PERMETAL CRAVINHOS`.
Parse branch code as text and use the remaining text as the source display branch name.

Validated client example pattern: `064756/01 - VENANCIO HIDRAULICA LTDA (...)`.
The PDF may present a cleaned display form, but the raw value must remain available internally. Do not infer commission logic from client data.

### Previsao total

For each `(branch_code, seller_code)` group, total exactly the source field `Comissão total (líquido)` using decimal-safe arithmetic. Do not sum `Valor total de comissão` as a replacement and do not derive the total from base or percentage.

## Contract B - Relacao de Comissoes

Validated workbook dimensions: 1358 data rows and 15 columns. Observed branches were 0103, 0104, 0105, and 0106. In the validated sample all rows were record type `Comissao` and origin `Baixa` (actual workbook value uses Portuguese accent in `Comissao`). This is evidence about the sample, not a filtering rule.

### Required fields

1. `Tipo de Registro` - Source record type; validate/report unexpected values but do not silently filter.
2. `Nome do Vendedor` - Seller display name; trim padding spaces.
3. `Filial do Sistema` - Authoritative branch code for grouping and company profile lookup.
4. `Codigo do Vendedor` - Authoritative seller code for grouping; preserve leading zeros.
5. `Prefixo` - Title prefix display/audit identifier; preserve leading zeros.
6. `Numero do Titulo Original` - Original title number display/audit identifier; preserve leading zeros.
7. `Parcela` - Parcel identifier; preserve leading zeros/blank values.
8. `Nome do cliente` - Client display name; trim padding spaces.
9. `Data de Baixa do Titulo` - Display/audit date only; never use to decide whether a row is payable.
10. `Data do Pgto da Comissao` - Display/audit date only; never use to exclude paid/unpaid rows.
11. `Numero do Pedido` - Order number display/audit identifier; preserve leading zeros.
12. `Valor Base da Comissao` - Base value for display only; NEVER use to derive commission.
13. `% Comissao sobre Vl.Base` - Percentage for display only; NEVER use to derive commission.
14. `Valor da Comissao` - Authoritative field for displayed commission and the ONLY field summed for the Relacao document total.
15. `Comissao gerada pela B/E` - Source B/E classification; warn on unexpected values but do not silently filter.

### Relacao document identity

Group by `(Filial do Sistema, Codigo do Vendedor)` after trimming. Seller name is a display field, not the identity key.

Build a title display string from Prefixo + Numero do Titulo Original + Parcela only for presentation. Never convert the identifier to a number.

### Relacao total

For each `(branch_code, seller_code)` group, total exactly the source field `Valor da Comissao` using decimal-safe arithmetic.

## Wrong-mode detection

Use distinctive required headers to identify a likely mismatch.

Examples:

- If the user is in Previsao mode and the workbook contains Relacao markers such as `Filial do Sistema`, `Codigo do Vendedor`, and `Valor da Comissao`, report that the file appears to be Relacao de Comissoes.
- If the user is in Relacao mode and the workbook contains Previsao markers such as `Dados do vendedor`, `Classificacao`, and `Comissao total (liquido)` (canonical actual headers contain accents), report that the file appears to be Previsao de Comissoes.
- Do not auto-switch mode without informing the user. Offer a direct action to open/process in the detected mode.

## Numeric parsing examples from validated exports

- `109.360` -> 109360
- `48.133,12` -> 48133.12
- `0,35` -> 0.35
- `7,93129527965909` -> 7.93129527965909

These conversions exist only to format values and sum the designated commission field. They must never feed a commission formula.

## Null/blank behavior

- Blank text -> display `-` where appropriate.
- Blank dates -> display `-`.
- Blank financial audit fields -> display `-`.
- Blank designated commission value -> include the row and treat its contribution to the document total as zero.
- Do not hide zero-commission rows.

## Duplicate-looking rows

The source reports can contain rows that appear identical in all exported columns. Preserve every row exactly once per workbook row. Do not collapse, deduplicate, aggregate, or merge them. If desired, surface a non-blocking warning in the preview, but the PDF and total must still include every exported row.
