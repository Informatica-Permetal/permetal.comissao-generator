# Copy/Paste Development Prompts - Formatador Comissao

Use these prompts sequentially with the coding agent. The project skill is the source of truth. Do not skip acceptance gates.

---

## Prompt 0 - Kickoff / read the engineering contract

You are the senior software engineer responsible for implementing the Windows desktop application **Formatador Comissao**.

Before changing any code, read the entire project skill `SKILL.md` and these references:

- `references/project-spec.md`
- `references/input-contracts.md`
- `references/pdf-design.md`
- `references/architecture.md`
- `references/implementation-plan.md`

Treat them as the authoritative product/engineering contract.

The most important business rule is non-negotiable: **this application does not calculate commissions**. TOTVS Protheus is the sole financial source of truth. The application only reads Protheus exports, preserves their rows and values, splits output by seller + branch, formats the data, and sums the one designated Protheus commission field to display the final total. Never derive commission from base, percentage, payment date, classification, or any other field. Never deduplicate report rows.

Also keep the product name exactly **Formatador Comissao**. Do not use THMV or Permetal as the application name. Company names/logos belong only to branch-specific report branding/configuration.

Your first response must:

1. confirm the skill/reference files were read;
2. summarize the architecture you found in the repository and compare it with the required architecture;
3. identify risks/conflicts before implementation;
4. propose the exact files/modules that Phase 0/1 will touch;
5. do not implement future phases yet.

If the repository already contains code, preserve useful existing work and adapt it rather than rewriting blindly.

---

## Prompt Phase 0 - Repository audit and baseline

Implement **Phase 0 only** from `references/implementation-plan.md`.

Read `SKILL.md` and all referenced engineering documents first.

Tasks:

- inspect the current repository, active branch, package manager, build scripts, Electron/React state, test/lint/typecheck setup, and existing filesystem/report logic;
- identify anything that could violate the project rules, especially any code that calculates commission, deduplicates rows, writes outside the user profile, uses insecure Electron renderer privileges, or uses cloud/network services;
- if the repository is empty, create only the minimum scaffold necessary to make Phase 1 possible; do not implement Excel parsing/PDF/history workflows prematurely;
- document the module map you will use and any deviations from `references/architecture.md`;
- run the current build/typecheck/tests where available and record the baseline result.

Do not implement commission parsing, PDF generation, final folder watcher behavior, or installer packaging in this phase.

At the end report:

- current architecture;
- files changed (if any);
- commands/tests run and results;
- blockers/risks;
- readiness for Phase 1.

Do not proceed to Phase 1 automatically.

---

## Prompt Phase 1 - Desktop shell, local storage, and first-run setup

Implement **Phase 1 only** from `references/implementation-plan.md`.

Read the skill and references again before coding. Keep the app buildable throughout the phase.

Required result:

- Electron + React + TypeScript + Vite desktop shell following the secure process boundaries in `references/architecture.md`;
- visible product name exactly `Formatador Comissao`;
- `contextIsolation: true` and renderer `nodeIntegration: false`;
- narrow typed preload/IPC API, no generic filesystem exposure to the renderer;
- Home screen with cards for `Previsao de Comissoes` and `Relacao de Comissoes`, plus entry points for `Historico` and `Configuracoes`;
- local SQLite initialization with migrations and the baseline tables from the architecture reference;
- local log directory under the current user profile;
- mandatory first-run report-root selection/confirmation, defaulting to the current user's Documents area;
- permission test for create/write/delete;
- automatic creation of both complete trees:
  - `Previsao/Entrada`
  - `Previsao/Processamento`
  - `Previsao/Processados`
  - `Previsao/Gerados`
  - `Previsao/Historico`
  - `Relacao/Entrada`
  - `Relacao/Processamento`
  - `Relacao/Processados`
  - `Relacao/Gerados`
  - `Relacao/Historico`
- persist the selected report root and restore it on restart;
- Settings page able to show current report root and internal app-data/log locations.

Do not implement Excel parsing or report PDF generation yet. Placeholder empty mode pages are acceptable if clearly labeled.

No operation may require administrator rights.

Tests/validation:

- unit test path/folder creation logic where practical;
- typecheck/lint/tests;
- production build;
- verify path handling with spaces;
- verify repeated startup is idempotent and does not destroy existing folders/data.

At the end, report exactly what was implemented, files materially changed, tests run/results, and what remains for Phase 2. Do not proceed automatically.

---

## Prompt Phase 2 - Excel contracts, parsing, grouping, and totals

Implement **Phase 2 only** from the implementation plan. This phase is about correctness of data intake, not PDF visuals.

Mandatory rule: **do not calculate commission**. Search the implementation before finishing and ensure there is no formula like base * percentage or business rule based on dates/status. The only allowed financial arithmetic is summing the designated source commission field per seller + branch.

Implement:

1. A common `.xlsx` loader that does not depend on column order.
2. Header matching that tolerates trailing spaces/Unicode whitespace, repeated whitespace, case differences, and accent differences for matching while preserving canonical/raw names for diagnostics.
3. The exact **Previsao de Comissoes** 13-field contract from `references/input-contracts.md`.
4. The exact **Relacao de Comissoes** 15-field contract from `references/input-contracts.md`.
5. Wrong-mode detection with a clear structured error/suggestion.
6. Missing-header diagnostics listing canonical field names.
7. Brazilian decimal parsing that correctly handles examples such as `109.360`, `48.133,12`, `0,35`, and long decimal values.
8. Date parsing that preserves calendar dates and does not introduce timezone date shifts.
9. Preserve leading zeros in all identifiers.
10. Previsao seller/branch parsing from compound fields.
11. Relacao seller/branch identity from explicit code fields.
12. Group documents strictly by `(branch_code, seller_code)`.
13. Previsao document total = sum only `Comissao total (liquido)` from Protheus.
14. Relacao document total = sum only `Valor da Comissao` from Protheus.
15. Blank designated commission values contribute zero but rows remain present.
16. Zero and negative commission rows remain present.
17. Duplicate-looking workbook rows remain fully preserved. Do not use `drop_duplicates`, Set-based row elimination, SQL DISTINCT on source rows, or equivalent logic.
18. Warnings for unexpected classification/type/B-E values without filtering rows.

Create synthetic fixture workbooks that mirror the validated schemas without copying sensitive real client data. Include tests for:

- column reordering;
- trailing spaces in headers;
- leading-zero identifiers;
- Brazilian numeric strings;
- blank/zero/negative commission values;
- duplicate-looking rows counted twice;
- multiple sellers in one branch;
- same seller across two branches;
- wrong-mode file;
- missing required column;
- long-precision Previsao commission values.

Do not generate final PDFs yet.

At completion, show the parsed/grouped summary produced by tests and explicitly state which field is summed in each mode. Report files changed and all test/build results. Do not proceed automatically.

---

## Prompt Phase 3 - File intake UX, watchers, and batch preview

Implement **Phase 3 only**.

Use the same core import service for all intake methods. Do not create divergent logic for drag/drop, file picker, and watched folders.

Implement the user flow for both modes:

- dedicated mode page;
- large `.xlsx` drag-and-drop zone;
- button `+ Selecionar arquivo`;
- button `Abrir pasta de entrada`;
- watch each mode's `Entrada` folder while the app is running;
- ignore `~$` Excel temporary files;
- debounce duplicate filesystem events and wait for file stability before opening;
- create a batch workspace under the selected mode's `Processamento` folder;
- always parse a processing copy, never mutate the external original;
- for external picker/drop files, keep the external source untouched;
- compute SHA-256 and warn when the exact source file was previously processed;
- validate the chosen mode and offer a clear action if the other mode is detected;
- show missing-header errors when appropriate;
- build the pre-generation confirmation screen.

The pre-generation screen must show:

- mode;
- source filename;
- total source rows;
- count of sellers;
- count of branches;
- count of seller + branch PDFs that will be produced;
- a table with branch, seller code, seller name, source-row count, and final total for each output document;
- warnings.

Financial values in preview are read-only. Do not let the user edit commission values. Do not add row-exclusion checkboxes.

Add branch profile lookup. If a branch is not configured, generation readiness must be blocked with a direct route to company/branch settings; do not guess company branding.

For this phase, the final `Gerar PDFs` action may end at a well-defined service boundary/placeholder because actual PDF generation is Phase 4.

Persist batch preview/status sufficiently to support the later lifecycle implementation.

Test all three intake routes and a file with multiple seller/branch groups. Run typecheck/lint/tests/build. Report results and do not proceed automatically.

---

## Prompt Phase 4 - Branding, professional PDFs, and printing

Implement **Phase 4 only**.

Before finalizing visuals, inspect every logo and reference PDF/image I provide with this prompt/conversation. Those assets are authoritative visual references. Do not fetch logos from the internet and do not invent legal/company information.

Read `references/pdf-design.md` closely. The original visual mockup is only inspiration; create a cleaner document from scratch. Do not add meaningless `total de titulos` or other KPI cards. The only computed financial summary is the final commission total.

Implement company/branch profiles keyed by branch code, including editable:

- display name;
- legal/company name;
- trade name if needed;
- CNPJ;
- address;
- logo;
- active status.

Use local assets only.

Implement Chromium HTML/CSS -> PDF generation with A4 portrait, print backgrounds, strong corporate typography, clean spacing, and reliable multi-page behavior.

### Relacao PDF

Use source fields to display a clean table centered on:

- Pedido
- Titulo (presentation composed from Prefixo + Numero do Titulo Original + Parcela, preserving zeros)
- Cliente
- Data da Baixa
- Base da Comissao
- % Comissao
- Valor da Comissao

Do not calculate the commission from base/percentage.

Final summary: one prominent `TOTAL DA COMISSAO`, summing only source `Valor da Comissao`.

### Previsao PDF

Visually organize rows by raw `Classificacao`, without filtering. Known sections include `Titulo original` and `Pedido de venda`; unknown future classifications must render as their own section.

Use a clean table centered on:

- Documento (Dados do titulo and/or Dados do pedido)
- Cliente
- Emissao
- Vencimento
- Data da Baixa
- Base para Baixa
- Comissao

The displayed/final commission source is `Comissao total (liquido)`. `Valor total de comissao` and `Valor IRRF` may be shown only as their own source values when visually useful, especially if IRRF is non-zero. Never derive one from another.

Final summary: one prominent `TOTAL DA PREVISAO`, summing only source `Comissao total (liquido)`.

### Common PDF requirements

- one PDF per seller code + branch code;
- correct configured logo/company header per branch;
- seller name/code and branch clearly visible;
- support one page or many pages;
- repeated table header on each page;
- compact continuation header;
- `Pagina X de Y`;
- total only at document end;
- declaration + signature lines for seller and responsible person + date;
- keep signature block together;
- wrap long client names cleanly;
- no filesystem paths/hashes printed;
- preserve every source row;
- currency in BRL with two decimals;
- dates as dd/MM/yyyy;
- source percentages displayed only, never recalculated.

Implement direct `Imprimir` using the application's printable report path with a normal printer-selection experience. Also implement `Abrir PDF` and `Abrir pasta` for generated output.

Create tests/fixtures for 1-page, multi-page (10+ pages), long client name, blank fields, duplicate-looking rows, unknown Previsao classification, and all configured branches.

Visually inspect generated sample PDFs before claiming completion. Report changed files, test/build results, and any visual decisions taken from the supplied logos/reference. Do not proceed automatically.

---

## Prompt Phase 5 - Archiving, recent outputs, history, deletion, regeneration

Implement **Phase 5 only**.

Complete the batch/document lifecycle defined by the skill.

Required behavior:

- after successful generation, archive the source XLSX under the mode's `Processados/YYYY/MM/<batch-id>/` (or equivalent collision-safe structure);
- if the source came from managed `Entrada`, remove/move it from Entrada only after success; if it was an external file, never delete/move the external original;
- publish the new batch PDFs into that mode's `Gerados` area;
- before publishing a new batch, move prior `Gerados` output into `Historico/YYYY/MM/<batch-id>/` without overwriting;
- persist batch and document history in SQLite;
- never mark a batch completed until source archive, PDFs, and history metadata are safely committed;
- preserve failed workspace/log information needed for recovery.

Implement a full History screen with filters for mode, date, seller, branch, and source batch/file.

Per-document actions:

- Abrir PDF
- Imprimir
- Abrir localizacao
- Gerar novamente
- Excluir

Batch actions:

- view all generated documents;
- regenerate from archived source;
- delete batch.

Deletion rules:

- prefer Windows Recycle Bin, not irreversible delete;
- deleting one document trashes only that PDF/history record and must not delete the shared source XLSX if other documents belong to the batch;
- deleting an entire batch may trash all managed PDFs and the archived source XLSX after explicit confirmation;
- never delete an external original outside the managed root;
- clean empty managed folders only when safe.

Regeneration uses the archived source workbook plus the current report template/company profile. Warn if source no longer exists.

Add tests for lifecycle transitions, failed generation recovery, shared source handling, duplicate source hash warning, delete document, delete batch, and regenerate.

Run lint/typecheck/tests/build and report results. Do not proceed automatically.

---

## Prompt Phase 6 - Per-user Windows installer and deployment

Implement **Phase 6 only**.

Produce a Windows installer for `Formatador Comissao` that is designed to work for a standard non-admin user.

Use the approved Electron/electron-builder architecture and configure an NSIS per-user installation:

- product visible name `Formatador Comissao`;
- `perMachine: false`;
- no forced elevation;
- install in the current user's local programs area, not Program Files;
- normal Start Menu/Desktop shortcut behavior as appropriate;
- use the supplied app icon if one exists; otherwise keep a neutral temporary icon and clearly mark it for replacement;
- preserve the mandatory first-run report-root chooser or integrate the chooser into the installer only if it remains reliable without elevation;
- create/use report folders under the selected user-writable root;
- internal DB/config/logs under user-local app data;
- version metadata and reproducible installer artifact name;
- no automatic internet updater in v1.

Uninstall must not silently destroy user report history/documents. If app-data cleanup is offered, make it explicit and separate from user-generated report folders.

Test or document an actual test procedure using a non-admin Windows account:

1. install without UAC elevation;
2. launch;
3. first-run folder setup;
4. import each report mode;
5. generate/open/print a PDF;
6. use history;
7. delete a managed historical record;
8. restart app;
9. uninstall and verify user documents remain unless explicitly removed.

Run production build/package. Report the installer artifact path, package results, files changed, and any platform limitation. Do not proceed automatically.

---

## Prompt Phase 7 - QA hardening and release candidate

Implement **Phase 7 only** as a release-candidate hardening pass. Do not add unrelated features.

Read the full skill again and audit the code against every non-negotiable rule.

Mandatory audit question: can any code path calculate, infer, adjust, deduplicate, or filter commission entitlement beyond summing the designated Protheus commission field? If yes, remove/fix it unless it is explicitly required by the skill.

Execute the test matrix from `references/implementation-plan.md`, including:

- both validated report contracts;
- multiple sellers;
- same seller in multiple branches;
- all known branch profiles;
- unknown branch;
- reordered columns;
- trailing-spaced headers;
- blank, zero, and negative commission values;
- duplicate-looking rows preserved;
- long client names;
- one-page PDF;
- 10+ page PDF;
- wrong-mode import;
- duplicate source file;
- locked/incomplete Entrada file;
- source archive/history lifecycle;
- document deletion;
- batch deletion;
- regeneration;
- path containing spaces;
- non-ASCII Windows username/path where possible;
- non-admin installation/runtime;
- restart/recovery around a failed/incomplete batch.

Also visually compare PDFs with the logos/reference design I supplied. Fix clipping, awkward page breaks, unreadable columns, bad logo scaling, broken signature layout, and print problems.

Deliver:

- final test report with pass/fail status;
- any known issues with severity;
- proof that no business commission calculation exists;
- final installer artifact path/version;
- concise operator guide: how to use Previsao, how to use Relacao, where Entrada/Gerados/Historico are, how to print, how to delete history, and how to configure a branch/logo;
- release checklist.

Do not claim release readiness if a data-loss, wrong-total, wrong-branch, admin-rights, or row-loss bug remains.
