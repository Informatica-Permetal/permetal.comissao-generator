# Product Specification - Formatador Comissao

## 1. Product goal

Create a Windows desktop application that turns commission spreadsheets exported from TOTVS Protheus Smart View into clean, professional, printable PDF documents.

The application has two business-facing modes:

- **Previsao de Comissoes**: formats the Protheus Previsao de Comissoes export, typically used when the business needs a complete forecast document such as a termination settlement review.
- **Relacao de Comissoes**: formats the Protheus Relacao de Comissoes export, typically used for the regular commission payment/conference document.

The application is a formatter and document manager. Protheus remains the only source of financial/business calculation.

## 2. Core principle: no commission calculation

The application must not:

- calculate commission from a base and percentage;
- calculate commission from invoice/payment dates;
- decide whether a row is payable;
- decide whether a forecast should be included;
- apply a commission rule;
- recalculate IRRF;
- recalculate net commission;
- remove duplicate-looking records;
- alter values exported by Protheus.

The only financial arithmetic allowed is summing the correct Protheus-provided commission column per generated PDF.

Previsao total = sum of the source field `Comissao total (liquido)`.

Relacao total = sum of the source field `Valor da Comissao`.

## 3. App identity

Product name: **Formatador Comissao**.

Do not brand the software shell as Permetal, THMV, Metalgrade, or another company. The same application can render company-specific report headers based on branch configuration.

Suggested window title: `Formatador Comissao`.

Suggested installer title: `Formatador Comissao`.

Suggested executable name: `Formatador Comissao.exe` or an ASCII-safe equivalent while keeping the visible product name unchanged.

## 4. Home screen

Provide a modern, simple home screen with three clear destinations:

- Card: **Previsao de Comissoes**
- Card: **Relacao de Comissoes**
- Entry point: **Historico**

Also expose Settings through a standard icon/menu.

Each mode card should explain its expected report in one short sentence. Avoid technical Protheus implementation details in the primary UI.

## 5. Import UX

Inside each mode show a large import area with:

- drag-and-drop `.xlsx`;
- button `+ Selecionar arquivo`;
- button `Abrir pasta de entrada`;
- optional status showing that the mode's Entrada folder is being monitored.

When a file is selected or detected:

1. Ignore Excel temporary files such as `~$arquivo.xlsx`.
2. Wait until file size/mtime is stable before processing watched files.
3. Create an isolated batch workspace in `Processamento`.
4. Copy the workbook into that workspace before parsing.
5. Validate the selected mode's contract.
6. If the file matches the other mode, show a clear message telling the user which mode appears correct.
7. If required headers are missing, list the missing fields.
8. Never modify the original external file.

For files placed inside a managed `Entrada` folder, move/archive the source into `Processados` only after successful processing. For files selected from outside the managed folders, leave the external original untouched and archive an internal copy.

## 6. Pre-generation summary

Before creating PDFs, show a confirmation screen containing:

- mode;
- source filename;
- number of source rows;
- number of unique sellers;
- number of unique branches;
- number of seller + branch documents to generate;
- a table with branch, seller code, seller name, row count, and total commission for each output document;
- warnings, if any.

Do not let users manually edit financial values in this screen.

Do not provide a default feature that silently excludes rows or sellers. The source report controls the content.

## 7. Document split rule

The output key is always:

`branch_code + seller_code`

Examples:

- same seller in branch 0103 and 0104 -> two PDFs;
- two sellers in branch 0104 -> two PDFs;
- same seller name with different seller codes -> separate PDFs;
- never combine branches into one PDF.

Use codes as identity; names are display values.

If the same code appears with inconsistent names in one source file, warn before generation. Do not invent a correction silently.

### Future option (documented, not implemented): consolidated PDF per seller

This split rule (`branch_code + seller_code`, one PDF per pair, never combining branches) is the only implemented behavior today and does not change. A possible future option - not implemented, and requiring explicit approval before any work starts - would add a user-selectable alternative mode that consolidates one seller's documents across all of that seller's branches into a single PDF, instead of one PDF per branch. If ever implemented: totals must still be computed and shown per branch section inside the consolidated document (never a single blended total across branches), and each section must keep its branch identity clearly visible, so consolidation never hides which branch a row belongs to.

## 8. Batch model

One imported workbook creates one **batch**.

A batch may create one or many PDFs.

Use a collision-safe batch ID, for example timestamp plus random suffix/UUID.

Persist at least:

- batch id;
- mode;
- source original filename;
- archived source path;
- SHA-256 of source workbook;
- import time;
- row count;
- number of outputs;
- status;
- app version.

Each generated document stores:

- batch id;
- branch code/name;
- seller code/name;
- source row count for that document;
- commission total;
- generated PDF path;
- generation time;
- template version.

## 9. Managed folders

Default user-visible root:

`%USERPROFILE%\Documents\Formatador Comissao`

Allow the user to choose another writable directory during installation/first-run setup. Validate create/write/delete permission before accepting it.

Under the root create two fully separate mode trees:

```text
Formatador Comissao/
  Previsao/
    Entrada/
    Processamento/
    Processados/
    Gerados/
    Historico/
  Relacao/
    Entrada/
    Processamento/
    Processados/
    Gerados/
    Historico/
```

Meanings:

- **Entrada**: monitored manual drop folder.
- **Processamento**: temporary per-batch working copies; successful batches clean their workspace. Failed jobs may remain for recovery/diagnostics until resolved or manually cleaned.
- **Processados**: archived source XLSX files organized by year/month/batch.
- **Gerados**: PDFs from the most recent successful batch in that mode for easy access.
- **Historico**: older generated PDFs organized by year/month/batch.

Before publishing a new successful batch to `Gerados`, move the existing `Gerados` content for that mode into the appropriate `Historico/YYYY/MM/<batch-id>/` location. Do not overwrite previous documents.

Store internal database/config/logs separately under the current user's local application data, for example:

`%LOCALAPPDATA%\Formatador Comissao\`

Normal use must not write to Program Files or machine-wide registry locations.

## 10. First-run/setup

Target UX: immediately during installation or the first launch onboarding, let the user confirm/change the report root folder.

Requirements:

- show the proposed root path;
- button to choose another path;
- test create/write/delete permission;
- create both mode folder trees;
- initialize local database;
- display a success summary and open the app.

If installer technology makes safe persistence of the report root unnecessarily fragile, implement this as the mandatory first-run screen directly after installation. Do not require elevation just to satisfy the folder picker.

## 11. Company/branch profiles

Provide `Configuracoes > Empresas/Filiais`.

Each profile is keyed by branch code and contains:

- branch code;
- display name;
- legal/company name;
- optional trade name;
- CNPJ;
- address lines;
- optional city/state;
- logo file;
- active flag.

Observed branch codes in the validated input set: 0103, 0104, 0105, 0106.

The user will provide logos and visual examples. Bundle sensible initial profiles when metadata is supplied, but keep profiles editable without rebuilding the application.

If an imported file contains an unknown/unconfigured branch, block PDF generation for that batch and provide a direct action to configure it. Never guess a logo or legal identity.

## 12. History screen

Provide a searchable/filterable history UI.

At minimum support filters by:

- mode;
- date range;
- seller;
- branch;
- source filename/batch.

Show document rows with:

- generated date/time;
- mode;
- seller;
- branch;
- total;
- source batch/file;
- PDF availability.

Actions:

- open PDF;
- print;
- open containing folder;
- regenerate from archived source;
- delete document;
- open/view batch;
- delete entire batch.

## 13. Deletion behavior

Prefer Windows Recycle Bin instead of irreversible direct deletion for files. In Electron, use the platform trash API when available.

Deleting an individual document:

- trash the PDF;
- remove/update its history record;
- do not delete the batch source workbook while other documents still reference the batch.

Deleting an entire batch:

- confirm clearly;
- trash all generated PDFs for the batch;
- trash the archived source XLSX;
- remove the batch/document history records;
- clean empty batch folders where safe.

Support multi-select and age-based cleanup later in the same history feature if it can be implemented safely. Never delete external originals selected from outside the managed root.

## 14. Regeneration

`Gerar novamente` should regenerate documents from the archived source XLSX.

Regeneration uses current app/report template and current branch profile unless a future explicit requirement adds immutable historical template snapshots.

Warn if the archived source file no longer exists.

## 15. Duplicate source file handling

Hash source XLSX files with SHA-256.

If the exact file hash has already been processed, warn:

`Este arquivo ja foi processado em <data>. Deseja processar novamente?`

This warning is about the source file import only. It must never deduplicate report rows.

## 16. Error and warning philosophy

Block only when the system cannot safely produce the requested document, such as:

- wrong report contract for selected mode;
- missing required headers;
- ambiguous required header (e.g. Previsao with two columns both named `Vencimento` - see the input contracts section above); explain the ambiguity and how to fix it in Smart View, never resolve it by column position;
- workbook unreadable/corrupt;
- no data rows;
- branch profile missing;
- no permission to create/archive output;
- PDF generation failure.

Warn but preserve source data when encountering:

- duplicate-looking rows;
- unexpected Previsao classification;
- Relacao rows not marked `Baixa`;
- unexpected `Tipo de Registro`;
- inconsistent seller or branch display names for the same code;
- source file already processed.

Warnings must never trigger hidden business filtering.

## 17. Logging

Write local technical logs under user local app data.

Log:

- timestamps;
- batch ids;
- high-level operations;
- errors and stack traces;
- file paths when needed for support;
- header validation diagnostics.

Do not log full report row payloads by default. Avoid unnecessary client/commission data exposure in logs.

## 18. Privacy/offline behavior

The application handles sensitive internal financial data.

v1 requirements:

- no telemetry;
- no analytics SDK;
- no cloud sync;
- no automatic upload;
- no third-party API calls;
- no remote fonts/images for report rendering;
- all logos/assets loaded locally.

## 19. Naming of generated files

Use a deterministic readable name plus collision protection, for example:

`2026-09-10_RELACAO_0104_000001_ADEMIR_FURLANETO.pdf`

`2026-09-10_PREVISAO_0104_000001_ADEMIR_FURLANETO.pdf`

Sanitize illegal Windows filename characters. Preserve seller/branch codes. Never overwrite an existing archived PDF; add a safe suffix if needed.

## 20. Out of scope for v1

Unless explicitly requested later, do not implement:

- direct Protheus API/database access;
- commission business rules;
- editing commission amounts;
- electronic/digital signature platforms;
- cloud storage;
- user authentication/server accounts;
- multi-user network database;
- Excel writing/back-sync;
- email sending;
- automatic Protheus execution.


---

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

## Contract A - Previsao de Comissoes (13 required fields, v2)

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

## Contract B - Relacao de Comissoes (12 required fields, v2)

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


---

# PDF Design Specification

## 1. Objective

Create a polished corporate document suitable for conference, signature, printing, and internal filing. The initial user-provided image is only a visual direction. Do not reproduce its KPI cards or one-page constraint mechanically.

The user will provide actual company logos and may provide a reference PDF/image. When supplied, use those assets to refine typography, spacing, header composition, and brand treatment.

## 2. Page format

Default: A4 portrait.

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

`Data do Pgto da Comissao` and `Comissao gerada pela B/E` are audit fields, optional since the v2 input contract - the source workbook may not include them at all. They do not need to consume table width by default. If the provided reference design or later requirement asks for them, they can appear in a secondary detail area only when present in the source. Never use them to filter rows.

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


---

# Technical Architecture

## 1. Baseline stack

Use this baseline unless explicitly changed with user approval:

- Electron
- React
- TypeScript
- Vite
- electron-builder
- NSIS per-user installer
- `xlsx` or a maintained Excel reader for `.xlsx` parsing
- `decimal.js` (or equivalent arbitrary-precision decimal library) for totals
- `chokidar` for Entrada folder monitoring
- SQLite for local history/config metadata (prefer a mature Electron-compatible driver)
- HTML/CSS rendered by Chromium for PDF generation through Electron `printToPDF`
- Electron printing API for direct print workflow
- a standard test runner such as Vitest plus focused integration tests

Use a current stable Node/Electron toolchain that can be built reproducibly on Windows.

## 2. Process boundaries

### Main process

Own all privileged operations:

- filesystem access;
- folder watcher;
- SQLite/database;
- Excel workbook loading/parsing service;
- batch orchestration;
- hashing;
- PDF generation window;
- print operations;
- shell open/open-folder/trash actions;
- app settings paths.

### Preload

Expose a minimal typed API only. No generic `fs`, `shell`, or arbitrary IPC passthrough.

### Renderer

React UI only. Treat all report data as values received through typed IPC DTOs.

Security:

- `contextIsolation: true`
- `nodeIntegration: false`
- disable unnecessary navigation/new-window behavior
- no remote URLs for report content
- use CSP appropriate for a local desktop app

## 3. Suggested module boundaries

```text
src/
  main/
    app/
    ipc/
    storage/
    reports/
      common/
      previsao/
      relacao/
    pdf/
    printing/
    watcher/
    history/
    companies/
  preload/
  renderer/
    pages/
    components/
    features/
      home/
      import/
      preview/
      history/
      settings/
  shared/
    contracts/
    types/
    constants/
    validation/
```

Keep Previsao and Relacao adapters separate. Share only generic infrastructure and presentation primitives.

## 4. Excel adapter pattern

Define a common normalized document model while keeping report-specific raw adapters.

Suggested conceptual flow:

`Workbook -> Header normalization -> Contract validation -> Raw row parsing -> Report adapter -> Document groups -> PDF view model`

Never mutate the raw source row object. Create normalized display fields separately.

### Canonical header normalization

For matching only:

1. convert to string;
2. Unicode trim including NBSP;
3. collapse internal whitespace;
4. Unicode normalization (NFKD or appropriate equivalent);
5. accent-insensitive comparison;
6. lowercase/casefold.

Diagnostics must still display the canonical expected user-facing header names.

Column order must not matter.

## 5. Brazilian decimal parsing

Source cells may be native numbers or strings.

For Brazilian-formatted strings:

- `109.360` -> 109360
- `48.133,12` -> 48133.12
- `0,35` -> 0.35
- `7,93129527965909` -> 7.93129527965909
- blank -> null

Use decimal-safe arithmetic for the total only.

Do not use parsed base/percentage to derive commission.

Persist totals as decimal strings in SQLite if the chosen driver lacks exact decimal types.

Format monetary display using `pt-BR`, BRL, two decimal places.

## 6. Dates

Support Excel date values and strings. Normalize valid dates to an internal date representation without timezone shifting the calendar date. The example exports contain noon timestamps; display the calendar date only.

Use `dd/MM/yyyy` in PDFs.

Blank date -> `-`.

Do not use dates to decide row inclusion or payable status.

## 7. Batch state machine

Suggested states:

- `detected`
- `copying`
- `validating`
- `ready`
- `generating`
- `archiving`
- `completed`
- `failed`

Persist meaningful transitions to support crash recovery.

A batch must never be marked completed until the source archive and all expected PDFs/history records are safely persisted.

## 8. Transaction strategy

Filesystem and SQLite cannot share one atomic transaction, so use an explicit staged process:

1. create batch workspace;
2. copy source;
3. validate/parse;
4. generate PDFs to workspace;
5. verify each PDF exists and is non-empty;
6. archive source and PDFs to final locations using collision-safe names;
7. write/commit DB records;
8. publish latest PDFs to `Gerados` or finalize their location;
9. mark batch completed;
10. clean workspace.

On failure, retain enough workspace/log detail to retry or diagnose. Never destroy the only copy of a source file.

## 9. SQLite schema suggestion

### settings

- key TEXT PRIMARY KEY
- value TEXT

### company_profiles

- branch_code TEXT PRIMARY KEY
- display_name TEXT
- legal_name TEXT
- trade_name TEXT NULL
- cnpj TEXT NULL
- address_json TEXT NULL
- logo_path TEXT NULL
- active INTEGER
- updated_at TEXT

### batches

- id TEXT PRIMARY KEY
- mode TEXT
- source_original_name TEXT
- source_archived_path TEXT
- source_hash TEXT
- imported_at TEXT
- source_row_count INTEGER
- output_count INTEGER
- status TEXT
- app_version TEXT
- warning_json TEXT NULL

### documents

- id TEXT PRIMARY KEY
- batch_id TEXT REFERENCES batches(id)
- mode TEXT
- branch_code TEXT
- branch_name TEXT
- seller_code TEXT
- seller_name TEXT
- source_row_count INTEGER
- commission_total TEXT
- pdf_path TEXT
- generated_at TEXT
- template_version TEXT

Add indexes for mode/date/branch/seller and batch foreign key.

## 10. Folder watcher

Use one watcher per mode Entrada folder while the app is running.

Rules:

- `.xlsx` only;
- ignore `~$*`;
- ignore directories;
- debounce duplicate events;
- wait for file stability before opening;
- do not process a path already active;
- route each watched path to the mode owning that Entrada folder.

## 11. File import service

Drag/drop and file picker must use the same import service as the watcher. Do not create three separate processing implementations.

The import service receives `{ mode, sourcePath, sourceKind }` and returns a batch preview or a structured error.

`sourceKind` can distinguish managed Entrada vs external selection so archival behavior is safe.

## 12. PDF engine

Generate an HTML report model and render in a hidden/offscreen BrowserWindow using local CSS and local images, then call `webContents.printToPDF`.

Advantages required by this project:

- predictable A4 pagination;
- reusable CSS;
- high-quality typography;
- easy branded headers;
- repeated table headers;
- print backgrounds;
- same content can be sent to `webContents.print` for direct printing.

Do not depend on a web server or remote asset URLs.

## 13. Printing

Expose `Imprimir` from recent outputs and history.

Preferred flow:

- regenerate/load the report's local HTML representation or a printable local document;
- call Electron print with `silent: false` so the normal printer selection experience remains available;
- print backgrounds enabled.

If the platform cannot reliably print an archived PDF directly through the same path, opening the local PDF in the OS viewer may be offered as a fallback, but the primary UI should still attempt a direct application print flow.

## 14. Installer/no-admin requirement

Use electron-builder NSIS with per-user settings. Target:

- `oneClick: false`
- `perMachine: false`
- no forced elevation
- allow user-level installation directory selection if needed
- install under current user's local programs area

Do not require Program Files.

Store app runtime data under `%LOCALAPPDATA%\Formatador Comissao` and user documents under the configured report root.

Installer/first-run must create the two mode trees without elevation.

## 15. App updates

No automatic internet updater in v1. Produce a versioned installer artifact manually.

## 16. Diagnostics

Add a support/diagnostics area or action that can expose:

- app version;
- report root;
- database path;
- log folder;
- configured branches;
- last failed batch id;

Do not expose full client financial payloads in diagnostics by default.


---

# Implementation Plan

Implement sequentially. Each phase must leave a reviewable result. Do not implement future phases early unless a minimal stub is required for build integrity.

## Phase 0 - Repository audit and engineering baseline

Goal: understand the repository if one exists and establish a safe plan without changing product behavior unexpectedly.

Deliverables:

- inspect existing repository/branch;
- inventory stack, scripts, lint/test/build setup;
- compare repository reality with this skill;
- write/update a concise technical implementation checklist;
- confirm no existing feature conflicts with the no-calculation rule.

Acceptance gate:

- repository builds or current build problems are documented;
- plan maps existing files to the architecture;
- no business feature implementation yet unless the repo is empty and a minimal scaffold is required.

## Phase 1 - Desktop shell, security, storage, and first-run folders

Goal: produce a running desktop application with the final product identity and safe local foundations.

Implement:

- Electron + React + TypeScript + Vite shell;
- product name `Formatador Comissao`;
- secure main/preload/renderer boundaries;
- home screen with Previsao, Relacao, Historico entry points;
- Settings shell;
- local app-data path;
- SQLite initialization/schema/migrations;
- first-run report-root chooser;
- permission test;
- creation of both complete folder trees;
- persisted root-path setting;
- basic logs.

Do not implement Excel parsing or PDF generation yet.

Acceptance gate:

- works as standard Windows user;
- creates folders under user-writable location;
- reopening app preserves configuration;
- no admin/elevation needed for runtime.

## Phase 2 - Input contracts, Excel parsing, validation, grouping, totals

Goal: correctly understand both validated Smart View layouts with zero business recalculation.

Implement:

- shared header normalization;
- Previsao adapter for its exact 13-field contract;
- Relacao adapter for its exact 15-field contract;
- Brazilian decimal/date parsing;
- wrong-mode detection;
- missing-header diagnostics;
- seller/branch identity extraction;
- document grouping by branch code + seller code;
- total only from the designated Protheus commission field;
- duplicate-row preservation;
- warnings for data quality without filtering;
- unit/integration tests using synthetic fixture workbooks.

Do not implement final PDFs yet.

Acceptance gate:

- validated sample contracts parse successfully;
- moving columns does not break parsing;
- trailing spaces in headers do not break parsing;
- source duplicate rows stay duplicated;
- totals match expected sum of source commission field;
- no code derives commission from base/percentage.

## Phase 3 - Import UX, drag/drop, file picker, watchers, and batch preview

Goal: complete the user-facing file intake workflow.

Implement:

- mode-specific import screens;
- drag-and-drop;
- `+ Selecionar arquivo`;
- `Abrir pasta de entrada`;
- chokidar watchers for both Entrada folders;
- file-stability debounce;
- batch workspace in Processamento;
- source hashing/duplicate-file warning;
- pre-generation preview table;
- branch profile validation;
- batch status handling and structured errors.

PDF button may still invoke a temporary placeholder until Phase 4, but preview data must be real.

Acceptance gate:

- all three import paths use the same service;
- wrong mode is clearly detected;
- one file with multiple sellers/branches shows the exact number of output documents;
- external originals remain untouched.

## Phase 4 - Company profiles, logos, report template, PDF generation, printing

Goal: generate production-quality reports.

Before coding final visuals, inspect the logos and reference PDF/image provided by the user. Do not invent brand assets.

Implement:

- company/branch profile settings;
- logo import/storage;
- observed branch profile seeds if metadata is provided;
- HTML/CSS report renderer;
- Relacao PDF layout;
- Previsao PDF layout;
- multi-page A4 portrait pagination;
- repeated table headers;
- page numbering;
- final total only;
- signature block on final page;
- PDF generation through Electron Chromium;
- direct print workflow;
- open PDF/open folder actions;
- tests for multi-page and long client names.

Acceptance gate:

- one PDF per seller + branch;
- correct logo/profile per branch;
- totals use only source commission field;
- no row disappears;
- large reports paginate cleanly;
- signature block is not split;
- PDFs print legibly.

## Phase 5 - Archival lifecycle, recent outputs, history, delete, regenerate

Goal: complete the document-management workflow.

Implement:

- archive original XLSX into Processados;
- maintain Gerados as latest successful batch per mode;
- move prior Gerados into date/batch Historico;
- persist batches/documents;
- History UI and filters;
- open/print/open-folder;
- regenerate from archived source;
- delete document;
- delete batch;
- Recycle Bin behavior;
- clean empty folders safely;
- crash/failure recovery for incomplete batches.

Acceptance gate:

- previous outputs are never overwritten;
- source workbook can be traced from a generated document;
- individual deletion does not delete a shared batch source incorrectly;
- batch deletion removes only managed copies, never an external original;
- regeneration works from archived input.

## Phase 6 - Installer, per-user deployment, Windows polish

Goal: ship an installable application that works for a non-admin user.

Implement:

- electron-builder production config;
- NSIS per-user installer;
- no forced elevation;
- install to user-local programs path;
- Start Menu/Desktop shortcuts as appropriate;
- product icon if supplied;
- first-run or installer-connected report-root setup;
- clean uninstall behavior that does not silently destroy user report history;
- version metadata;
- installer artifact generation.

Acceptance gate:

- tested on a standard non-admin Windows account;
- install, launch, import, generate, print/open, delete managed history all work without UAC elevation;
- uninstall preserves user documents unless user explicitly chooses removal.

## Phase 7 - QA hardening and release candidate

Goal: validate real-world behavior before handoff.

Test matrix:

- both real validated report shapes;
- multiple sellers;
- same seller across multiple branches;
- 0103/0104/0105/0106 branding;
- unknown branch;
- reordered columns;
- headers with trailing spaces;
- blank/zero/negative commission values;
- duplicate-looking rows;
- long client names;
- 1-page and 10+ page PDFs;
- locked/incomplete XLSX in Entrada;
- duplicate source file hash;
- wrong-mode upload;
- deletion and recycle behavior;
- path with spaces and non-ASCII Windows username;
- no-admin installation;
- application restart during/after failed processing.

Deliver:

- test results;
- remaining known issues;
- release checklist;
- final installer path/artifact;
- concise operator guide.

Acceptance gate:

- no known data-loss bug;
- no known commission-recalculation path;
- no admin requirement;
- PDFs visually approved against supplied reference assets.
