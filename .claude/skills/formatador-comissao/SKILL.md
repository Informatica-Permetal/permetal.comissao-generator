---
name: formatador-comissao
description: "Engineering and phased implementation guide for the Windows desktop application Formatador Comissao. Use when planning, implementing, reviewing, testing, packaging, or modifying this project, including importing TOTVS Protheus Smart View commission Excel files, validating the two supported layouts, splitting by seller and branch, summing only commission values already calculated by Protheus, generating branded professional PDFs, printing, archiving source files and PDFs, managing history, and building a per-user Windows installer that does not require administrator rights."
---

# Formatador Comissao

## Mission

Build and maintain a local Windows desktop application named **Formatador Comissao**. The application is a document formatter for commission data exported from TOTVS Protheus Smart View. It is **not** a commission calculation engine.

Read the project references before changing behavior. Treat the rules in this skill as product requirements, not suggestions.

## Non-negotiable rules

1. Keep the product name exactly **Formatador Comissao**. Do not use THMV, Permetal, Metalgrade, or any company name in the executable name, installer name, main window title, application data folder name, or generic UI branding.
2. Company names and logos are allowed only as data-driven branding inside reports and company/branch configuration.
3. Protheus is the financial source of truth.
4. Never calculate a seller's commission from base, percentage, dates, status, or any other field.
5. Never decide whether a seller is entitled to a commission.
6. Never remove, deduplicate, merge, or silently correct Protheus rows.
7. The only financial arithmetic the application may perform is **summing the Protheus-provided commission field for one seller + one branch document**.
8. Preserve source values and row membership. Formatting, parsing, grouping, sorting for presentation, and totals are allowed; business recalculation is not.
9. Generate one PDF per **seller code + branch code**. Never mix branches in the same PDF, even for the same seller.
10. Support two explicit modes: **Previsao de Comissoes** and **Relacao de Comissoes**. Each mode must validate its own Excel contract and reject/warn on the wrong report type.
11. Keep all user data under the current Windows user's profile. Normal operation, file creation, history deletion, and printing must not require administrator rights.
12. Operate fully offline in v1. Do not send commission data, filenames, seller names, client names, totals, or PDFs to external services.
13. Preserve leading zeros in branch, seller, title, prefix, parcel, and order identifiers.
14. Resolve fields by normalized header name, never by column position.
15. Support Smart View whitespace quirks in headers and cell values.

## Source contracts

Read `references/input-contracts.md` before implementing or changing Excel import behavior. The two v1 contracts are fixed to the files validated with the user.

- **Previsao mode** total field: `Comissao total (liquido)` (actual workbook header contains accents; see contract reference).
- **Relacao mode** total field: `Valor da Comissao`.

Use decimal-safe arithmetic for totals. Do not use the floating-point total as the authoritative persisted value.

## Product behavior

Read `references/project-spec.md` for complete UX, workflow, storage, history, deletion, branch branding, error handling, and batch behavior.

Core flow:

1. User chooses **Previsao** or **Relacao**.
2. User imports an `.xlsx` by drag-and-drop, `+ Selecionar arquivo`, or by placing it in the mode's monitored `Entrada` folder.
3. Copy the source to an isolated processing workspace.
4. Validate the report contract for the chosen mode.
5. Parse values without changing financial meaning.
6. Identify unique seller-code + branch-code pairs.
7. Show a pre-generation summary: source file, mode, sellers/branches found, documents to be generated, row counts, and each document total.
8. Require branch/company configuration for every branch found.
9. Generate one professional PDF per seller + branch.
10. Archive the source workbook and generated PDFs.
11. Register the batch and documents in local history.
12. Allow open, print, open folder, regenerate, and delete actions from the application.

## PDF behavior

Read `references/pdf-design.md` before implementing report rendering.

The provided logo files and example PDF/image are design inputs, not hard-coded business rules. When the user supplies new logos or a reference PDF/image, inspect them and adapt the report template while preserving the data rules in this skill.

Do not copy the initial mockup mechanically. Build a clean corporate document from scratch. Do not display meaningless KPI cards such as total title value unless explicitly added later as a requirement.

## Technical architecture

Use the architecture in `references/architecture.md` unless the user explicitly approves a change. The baseline is an Electron + React + TypeScript desktop application with local SQLite history, safe IPC, Excel parsing, folder watching, Chromium HTML/CSS PDF generation, and electron-builder/NSIS per-user packaging.

Security requirements:

- `contextIsolation: true`
- `nodeIntegration: false` in renderer windows
- expose only narrow typed IPC APIs through preload
- no remote code or remote report content
- no telemetry in v1
- no external upload
- no administrator dependency

## Phase discipline

Read `references/implementation-plan.md` before coding. Implement one phase at a time. Do not pull future-phase work into the current phase unless required to keep the current phase buildable.

At the end of every implementation phase:

1. Run lint/typecheck/tests relevant to the phase.
2. Build the application if the phase is expected to remain buildable.
3. State exactly what was implemented.
4. List files materially changed.
5. State tests run and results.
6. State remaining known limitations for later phases.
7. Do not claim behavior was tested if it was not actually tested.

Use `references/prompts-fases.md` as the copy/paste execution prompts for each phase.

## Data integrity rules

- Never call `drop_duplicates` or equivalent on report rows.
- Duplicate-looking rows must remain duplicate-looking rows and both must contribute to the total if Protheus exported both values.
- Blank financial fields display as `-` and contribute zero to the total field only.
- Zero values remain valid source data and must not be filtered out.
- Negative commission values remain valid source data and reduce the total exactly as exported.
- Do not infer payment eligibility from `DT Baixa`, `Data de Baixa do Titulo`, `Data do Pgto da Comissao`, `Classificacao`, or `Comissao gerada pela B/E`.
- Those fields are display/audit metadata only unless a future explicit requirement changes this.
- If a relation report contains `Emissao` instead of `Baixa`, or an unexpected record type, warn the user but do not silently alter the data.
- If a previsao report contains a new classification, preserve it, display it as its own section/group, and include its commission values in the document total.

## Compatibility rules

- v1 accepts `.xlsx` only.
- Locate the header row robustly within the first few rows, but prefer row 1 when valid.
- Normalize header matching by trimming Unicode whitespace, collapsing repeated whitespace, case-folding, and optionally accent-insensitive comparison. Keep canonical raw names for diagnostics.
- Accept cells exported as native Excel numbers or Brazilian-formatted strings.
- Parse Brazilian number strings such as `109.360`, `48.133,12`, `0,35`, and `7,93129527965909` correctly.
- Use decimal arithmetic and format monetary output as BRL with two decimal places.
- Preserve the raw underlying value in the internal parsed row for audit/debugging.
- Dates may be Excel date values or date-like strings; display as `dd/MM/yyyy` when valid and `-` when blank.

## Branch/company profiles

Branch code is authoritative. Company profile data is configuration, not inferred business logic.

Observed v1 branches in validated source files:

- `0103` - PERMETAL SAO PAULO
- `0104` - PERMETAL CRAVINHOS
- `0105` - METALGRADE NOVA
- `0106` - MG

The user will provide logos and may provide legal name, CNPJ, address, and other header data. Store these values in editable local company profiles. Do not permanently hard-code legal data into report rendering logic.

## Resource map

- `references/project-spec.md` - complete functional specification and UX.
- `references/input-contracts.md` - exact v1 Smart View input fields and parsing rules.
- `references/pdf-design.md` - PDF layout, pagination, signatures, branding, and print behavior.
- `references/architecture.md` - technical stack, modules, storage, IPC, packaging, and data model.
- `references/implementation-plan.md` - phased development plan and acceptance gates.
- `references/prompts-fases.md` - ready-to-use prompts for each development phase.
- `assets/README.md` - expected logos and visual reference assets to be supplied by the user.
