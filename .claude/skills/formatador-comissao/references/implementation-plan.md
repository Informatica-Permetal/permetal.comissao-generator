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
- multi-page A4 landscape pagination;
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
