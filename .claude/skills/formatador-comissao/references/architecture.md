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
