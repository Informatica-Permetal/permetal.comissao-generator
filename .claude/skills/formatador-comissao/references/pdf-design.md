# PDF Design Specification

## 1. Objective

Create a polished corporate document suitable for conference, signature, printing, and internal filing. The initial user-provided image is only a visual direction. Do not reproduce its KPI cards or one-page constraint mechanically.

The user will provide actual company logos and may provide a reference PDF/image. When supplied, use those assets to refine typography, spacing, header composition, and brand treatment.

## 2. Page format

Default: A4 landscape.

Requirements:

- support 1 to many pages;
- consistent print margins;
- no horizontal clipping;
- repeat table column headers on every page;
- compact company/report header on continuation pages;
- page number `Pagina X de Y`;
- total and signature area only at the end of the document;
- keep the signature block together; if necessary move it to the next page;
- use print backgrounds where appropriate, but remain readable on grayscale printers.

## 3. Common header

Use the configured branch/company profile:

- logo;
- company/legal name;
- CNPJ when configured;
- address when configured;
- branch display name.

Report identity:

- mode title;
- seller name;
- seller code;
- branch code/name;
- generated date/time;
- optional source filename in small audit text.

Do not show the software name as the primary brand in the company header.

## 4. Relacao de Comissoes document

Suggested title:

`RELACAO DE COMISSOES`

Suggested subtitle:

`Comissoes para conferencia e pagamento`

Primary table columns, designed for readability:

- Pedido
- Titulo
- Cliente
- Data da Baixa
- Base da Comissao
- % Comissao
- Valor da Comissao

Title display may combine source `Prefixo`, `Numero do Titulo Original`, and `Parcela` without losing leading zeros.

Do not calculate commission from base and percentage. `% Comissao` is displayed exactly as Protheus data after numeric formatting.

`Data do Pgto da Comissao` and `Comissao gerada pela B/E` are audit fields. They do not need to consume table width by default. If the provided reference design or later requirement asks for them, they can appear in a secondary detail area. Never use them to filter rows.

End summary:

- one prominent label: `TOTAL DA COMISSAO`
- value = sum of `Valor da Comissao` for that seller + branch group.

Do not add total title value or total base cards unless explicitly requested later.

## 5. Previsao de Comissoes document

Suggested title:

`PREVISAO DE COMISSOES`

Suggested subtitle:

`Relatorio de previsao para conferencia`

Organize rows visually by the raw `Classificacao` value, but do not filter or change row membership.

Known observed classifications:

- Titulo original
- Pedido de venda

Future/unknown classifications must render as their own section using the raw label.

Suggested table columns:

- Documento
- Cliente
- Emissao
- Vencimento
- Data da Baixa
- Base para Baixa
- Comissao

`Documento` is presentation-only:

- show `Dados do titulo` when present;
- show `Dados do pedido` when present;
- if both are present, show both clearly;
- if neither is present, show `-`.

Use `Comissao total (liquido)` as the displayed commission value and as the source for the final total.

`Valor total de comissao` and `Valor IRRF` are available source/audit fields. The default clean layout may show them in an expanded detail line or conditionally show a small Bruta/IRRF/Liquida trio only when IRRF is non-zero, but do not derive one from another. Every displayed financial value must come directly from its own Protheus field.

End summary:

- one prominent label: `TOTAL DA PREVISAO`
- value = sum of `Comissao total (liquido)` for that seller + branch group.

Do not create separate financial subtotals by classification in v1 unless explicitly requested later. Grouping is visual only.

## 6. Source rows and ordering

Preserve all source rows.

Default row ordering should preserve source order within each seller + branch document. Visual grouping by Previsao classification may reorder rows only if required to group sections; if grouping changes order, preserve original relative order inside each classification and make this behavior explicit in tests.

Relacao should preserve source order unless the user later asks for a different sort.

## 7. Formatting

- Currency: `R$ 1.234,56`
- Percent: use the source percentage, displayed with sensible decimal formatting and `%` suffix; do not recalculate it.
- Date: `dd/MM/yyyy`
- Blank: `-`
- IDs: text, preserve leading zeros.

For source commission values with more than two decimals, keep full precision internally for the total but display currency to two decimals. The validated sample produces matching rounded totals. Add a test guarding visible total consistency.

## 8. Long text

Client/company names can be long.

- wrap text cleanly;
- do not shrink the entire page to unreadable font sizes;
- truncate only when accompanied by a safe visual strategy, preferably avoid truncation in the final printable PDF;
- allow row height to expand.

## 9. Signature block

Default final block:

`Declaro que conferi e estou ciente das informacoes e dos valores apresentados neste relatorio.`

Then provide:

- line: `Assinatura do Vendedor`
- line: `Assinatura do Responsavel`
- date field: `Data: ____/____/________`

Keep labels configurable in settings later, but ship these defaults.

No electronic signature integration is required in v1.

## 10. Footer

Use a discreet footer containing:

- `Documento interno para conferencia`
- page numbering
- optional generated timestamp/source filename in small text

Do not expose filesystem paths or hashes on the printed PDF unless explicitly requested.

## 11. Visual quality

Target a modern industrial/corporate style:

- generous whitespace;
- strong hierarchy;
- restrained neutral palette derived from the supplied logo/brand assets;
- clean table striping or section separators;
- consistent alignment of monetary values;
- no decorative clutter;
- good legibility on office printers.

When actual logos/reference PDF are provided, inspect them before finalizing the template and document the chosen visual tokens in code (spacing, font sizes, neutral colors, border radii if used, etc.).
