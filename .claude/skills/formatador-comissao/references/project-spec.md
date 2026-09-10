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
