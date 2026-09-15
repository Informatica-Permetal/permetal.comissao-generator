# Input Contracts - Smart View v2

These contracts were revised against four real `.xlsx` exports supplied by the user (validated locally, never committed): a reduced export per mode containing exactly the required fields below, and a "Todos os Campos" export per mode containing every Smart View field, used to prove that extra and even duplicate-named optional columns never break import. This v2 revision supersedes the v1 field lists below wherever they conflict with it. Column order is not significant, but all required canonical fields must be present after header normalization.

## What changed from v1

- Relacao de Comissoes now requires only 12 fields, not 15. `Tipo de Registro`, `Data do Pgto da Comissao`, and `Comissao gerada pela B/E` are no longer required - see "Optional fields" under Contract B.
- Previsao de Comissoes still requires the same 13 fields, but a new rule handles a real Smart View quirk: the export can contain two columns both literally named `Vencimento`. See "Vencimento ambiguity" under Contract A.

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

## Contract A - Previsao de Comissoes (13 required fields)

Real validated reduced workbook: 165 data rows and 13 columns, matching exactly the required list below. Real "Todos os Campos" export: 165 data rows and 79 columns - confirms extra columns never break import, and is also the export that reproduces the Vencimento ambiguity described below. Observed branches were 0103, 0104, 0105, and 0106. Observed classifications included `Titulo original` and `Pedido de venda` (actual workbook labels contain Portuguese accents).

### Required fields

1. `Nome da filial` - Contains branch code + branch name. Branch code is the document/company profile key.
2. `Dados do vendedor` - Contains seller code + seller name. Parse identity from this field without losing leading zeros.
3. `Classificação` - Raw classification used for visual grouping only. Never filter eligibility based on it.
4. `Dados do cliente` - Client display/audit data; do not use for financial decisions.
5. `Dados do título` - Title/document display value.
6. `Dados do pedido` - Order display value; may be blank for title rows.
7. `Emissão pedido/título` - Display date only.
8. `Vencimento` - Display date only. See "Vencimento ambiguity" below - this is the one field with a special, mandatory duplicate-header check.
9. `DT Baixa` - Display/audit date only; NEVER use to decide inclusion.
10. `Valor base para baixa` - Display base value only; NEVER use to derive commission.
11. `Valor total de comissão` - Gross commission source/audit value; NEVER derive net from it.
12. `Valor IRRF` - IRRF source/audit value; NEVER recalculate it.
13. `Comissão total (líquido)` - Authoritative field for displayed commission and the ONLY field summed for the Previsao document total.

### Vencimento ambiguity (mandatory check)

The Previsao Smart View field list can contain two fields both literally named `Vencimento`: an earlier, incorrect one and the intended one further down the field list. Protheus does not give them distinct names - only their position in the Smart View field selection distinguishes them, and the user must select only the second one before exporting.

- If exactly one column normalizes to `vencimento`, use it - this is the common, expected case.
- If two or more columns normalize to `vencimento`, BLOCK the import. Never guess, never default to the first or last occurrence, never use column position to silently resolve it.
- The blocking error must explain the ambiguity in plain language and instruct the user to return to the Smart View field selection, keep only the second `Vencimento` field selected (the one appearing further down the list), and re-export.
- This is the one deliberate, documented exception to "never depend on column position" in the global import rules above: position is used only to detect and reject the ambiguous case, never to silently pick a value from it.

### Previsao identity parsing

Validated seller example pattern: `000001 - ADEMIR FURLANETO`.
Parse with a robust first separator strategy, keeping seller code as text.

Validated branch example pattern: `0104 - PERMETAL CRAVINHOS`.
Parse branch code as text and use the remaining text as the source display branch name.

Validated client example pattern: `064756/01 - VENANCIO HIDRAULICA LTDA (...)`.
The PDF may present a cleaned display form, but the raw value must remain available internally. Do not infer commission logic from client data.

### Previsao total

For each `(branch_code, seller_code)` group, total exactly the source field `Comissão total (líquido)` using decimal-safe arithmetic. Do not sum `Valor total de comissão` as a replacement and do not derive the total from base or percentage.

## Contract B - Relacao de Comissoes (12 required fields)

Real validated reduced workbook: 1375 data rows and 12 columns, matching exactly the required list below. Real "Todos os Campos" export: 1375 data rows and 35 columns, including duplicate-named optional columns (e.g. two `Nome do cliente` columns) - confirms extra and duplicate-named non-required columns never block import. Observed branches were 0103, 0104, 0105, and 0106. In the validated sample all rows were record type `Comissao` and origin `Baixa` (actual workbook value uses Portuguese accent in `Comissao`). This is evidence about the sample, not a filtering rule.

### Required fields

1. `Filial do Sistema` - Authoritative branch code for grouping and company profile lookup.
2. `Codigo do Vendedor` - Authoritative seller code for grouping; preserve leading zeros.
3. `Nome do Vendedor` - Seller display name; trim padding spaces.
4. `Prefixo` - Title prefix display/audit identifier; preserve leading zeros.
5. `Numero do Titulo Original` - Original title number display/audit identifier; preserve leading zeros.
6. `Parcela` - Parcel identifier; preserve leading zeros/blank values.
7. `Nome do cliente` - Client display name; trim padding spaces.
8. `Data de Baixa do Titulo` - Display/audit date only; never use to decide whether a row is payable.
9. `Numero do Pedido` - Order number display/audit identifier; preserve leading zeros.
10. `Valor Base da Comissao` - Base value for display only; NEVER use to derive commission.
11. `% Comissao sobre Vl.Base` - Percentage for display only; NEVER use to derive commission.
12. `Valor da Comissao` - Authoritative field for displayed commission and the ONLY field summed for the Relacao document total.

### Optional fields (no longer required, v2)

These three fields were required in v1 and are not anymore. Never reject a Relacao workbook solely because one or more of them is missing:

- `Tipo de Registro` - when present, validate/report unexpected values (still non-blocking) exactly as before; when the column is absent, skip the check entirely - do not warn about a missing value that was never expected.
- `Data do Pgto da Comissao` - when present, display/audit date only, exactly as before; when absent, treat every row as if it were blank.
- `Comissao gerada pela B/E` - when present, warn on unexpected values (still non-blocking) exactly as before; when absent, skip the check entirely.

If present, these fields keep every v1 behavior unchanged (validation, warnings, display). The only change is that their column may legitimately not exist in the workbook at all.

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

## Future option (documented, not implemented): consolidated PDF per seller

Today the app always generates one PDF per `(seller code, branch code)` pair - this never changes and is not affected by this note. A possible future option, not yet implemented and requiring explicit approval before work starts, would let the user optionally generate a single consolidated PDF per seller across all of that seller's branches in one document (e.g. one PDF for seller 000097 covering both filial 0103 and filial 0104), as an alternative to today's per-branch mode. If implemented, it must not change how totals are computed (still one total per branch section within the consolidated document, never a single blended total across branches) and must not weaken the "never mix branches in a way that hides which branch a row belongs to" rule - branch identity must remain visible per section even inside a consolidated document.
