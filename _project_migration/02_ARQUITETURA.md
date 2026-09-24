# 02 — Arquitetura

## 1. Stack

| Camada | Tecnologia | Versão (lock/instalada) |
|---|---|---|
| Runtime desktop | Electron | 44.3.0 (embute Node 24.20.0, Chromium 152) |
| Build | electron-vite + Vite | 5.0.0 / 7.3.6 |
| UI | React + lucide-react (ícones), CSS puro (`App.css`) | 19.3.0 / 1.46.0 |
| Linguagem | TypeScript (strict) | 5.9.3 |
| Excel | exceljs (só `.xlsx`, 1ª aba) | 4.4.0 |
| Dinheiro | decimal.js | 10.6.0 |
| Watcher | chokidar | 5.0.0 |
| Banco | `node:sqlite` (`DatabaseSync`, embutido) | — |
| PDF | Chromium `webContents.printToPDF` | — |
| Empacotamento | electron-builder (NSIS x64, per-user) | 26.15.3 |
| Testes | Vitest (ambiente jsdom único) + Testing Library | 5.0.0 |
| Lint/format | ESLint 10 (flat config) + Prettier 3 | — |
| Node de build/CI | `.node-version` | 24.21.0 |

Não há módulo nativo em produção (nada para compilar; não precisa de Visual Studio Build Tools nem
Python). Qualquer pacote usado pelo processo main **tem que estar em `dependencies`** (não em
`devDependencies`), senão o app empacotado quebra — o electron-builder só copia `dependencies`.

### 1.1 Dependências (`package.json`; lock v3 = instalado)

| Runtime (`dependencies`) | Versão |
|---|---|
| chokidar | ^5.0.0 |
| decimal.js | ^10.6.0 |
| exceljs | ^4.4.0 |
| lucide-react | ^1.46.0 |
| react / react-dom | ^19.3.0 |

| Desenvolvimento (`devDependencies`) | Versão |
|---|---|
| electron | ^44.3.0 |
| electron-builder | ^26.15.3 |
| electron-vite / vite / @vitejs/plugin-react | ^5.0.0 / ^7.3.6 / ^5.0.4 (5.2.0 instalado) |
| typescript / @types/node / @types/react / @types/react-dom | ^5.9.3 / ^24.13.4 / ^19.3.0 / ^19.3.0 |
| vitest / jsdom / @testing-library/react / @testing-library/jest-dom | ^5.0.0 / ^30.0.1 / ^16.3.3 / ^7.0.1 |
| eslint / @eslint/js / typescript-eslint / eslint-plugin-react-hooks / eslint-plugin-react-refresh / eslint-config-prettier / globals | ^10.10.0 / ^10.0.1 / ^8.70.0 / ^7.1.1 / ^0.5.6 / ^10.1.8 / ^17.12.0 |
| prettier | ^3.9.6 |

Sem `engines` no `package.json` (a versão do Node é controlada por `.node-version`). Não há
Dependabot ativo; atualizações de dependências são manuais (`npm install <pacote>@<versão>`,
gates, commit do lock).

### 1.2 Arquivos de configuração

| Arquivo | O que configura |
|---|---|
| `electron.vite.config.ts` | 3 alvos (main, preload, renderer); alias `@shared` → `src/shared`; `externalizeDepsPlugin` no main/preload (marcado deprecated no electron-vite 5, ainda funciona) |
| `tsconfig.json` | TypeScript do renderer + shared + `src/preload/index.d.ts` (DOM, `jsx: react-jsx`, strict) |
| `tsconfig.node.json` | TypeScript do main + preload + shared + configs (types node, strict). `scripts/*.mjs` não é checado |
| `vitest.config.ts` | ambiente **jsdom único** para todos os testes; inclui `src/**/*.test.ts(x)`; sem `setupFiles`; timeout padrão 5 s |
| `eslint.config.mjs` | flat config: recommended + typescript-eslint; regras react-hooks/react-refresh no renderer; globals Node no main/scripts; ignora `out`, `dist`, `node_modules` |
| `.prettierrc.json` | `semi`, `singleQuote`, `printWidth: 100`, `trailingComma: none` (não verificado no CI) |
| `.node-version` | `24.21.0` (lido pelos workflows) |
| `.gitignore` | `node_modules/`, `out/`, `release/`, `dist/`, `build/`, logs, `coverage/`, `.vscode/*` |
| `package.json` → `build` | electron-builder / NSIS (ver 05 §7.1) |
| `resources/installer.nsh` | página customizada do desinstalador |

Configuração **do app em runtime**: não há arquivo de configuração; o que o usuário define
(pasta de relatórios, cadastro de filiais/logos) fica no banco SQLite do perfil (§7).

## 2. Estrutura de pastas

```
permetal.comissao-generator/
├─ .claude/skills/formatador-comissao/   skill do projeto (regras, contratos, design) — versionada
├─ .github/workflows/ci.yml              gate contínuo (push/PR em main)
├─ .github/workflows/release.yml         release automática (push de tag vX.Y.Z)
├─ .node-version                         24.21.0 (usado pelos 2 workflows)
├─ docs/                                 especificação, prompts, RELEASE_PROCESS.md
├─ resources/
│  ├─ brand-logos/                       logos das empresas (usados no PDF)
│  ├─ pdf-motifs/chapa-perfurada.png     foto decorativa do PDF
│  ├─ icon.ico                           ícone do app (7 frames 16→256)
│  └─ installer.nsh                      página customizada do desinstalador
├─ scripts/run-homologation.mjs          launcher do app empacotado em HOMOLOGATION
├─ src/
│  ├─ main/                              processo principal (Node/Electron)
│  │  ├─ index.ts                        entrada: perfil, paths, banco, IPC, janela
│  │  ├─ app/                            perfis, paths, pastas, logger, assets, plano de desinstalação
│  │  ├─ batches/                        ciclo de vida do lote (gerar, arquivar, regenerar, excluir)
│  │  ├─ companies/                      filiais, grupos, seed, logos
│  │  ├─ import/                         importFile (pipeline único), watcher da Entrada, hash
│  │  ├─ ipc/                            handlers IPC (settings, companies, import, pdf, history)
│  │  ├─ migration/                      migração de nomes antigos sem acento (só PRODUCTION)
│  │  ├─ pdf/                            view models, templates HTML, render, impressão, nomes
│  │  ├─ reports/                        contratos + parsers (common/, previsao/, relacao/)
│  │  ├─ storage/                        SQLite, repositórios, testDatabase.ts (só testes)
│  │  └─ uninstallCli.ts                 modo headless chamado pelo desinstalador
│  ├─ preload/                           contextBridge → window.api (tipado)
│  ├─ renderer/                          React (páginas, componentes)
│  └─ shared/                            contratos IPC, tipos, constantes (alias @shared)
├─ CHANGELOG.md                          fonte das notas da Release
├─ IMPLEMENTATION_STATUS.md              diário técnico (até 1.2.0)
├─ electron.vite.config.ts / tsconfig*.json / vitest.config.ts / eslint.config.mjs
└─ (ignorados) node_modules/  out/  release/
```

## 3. Processos e segurança

- **main** (`src/main/index.ts`): tudo que toca disco, banco, Excel, PDF.
- **preload** (`src/preload/index.ts`): expõe `window.api` via `contextBridge`; 23 canais `invoke`
  + 1 evento (`reports:entrada-file-detected`). Contrato em `src/shared/contracts/api.ts` e
  `ipc.ts`.
- **renderer** (`src/renderer`): React sem router; a navegação é um estado (`home`, `previsao`,
  `relacao`, `historico`, `configuracoes`).
- Janela principal: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; links
  externos abrem no navegador do sistema.
- Janela utilitária oculta e reaproveitada (`src/main/pdf/utilityWindow.ts`) para `printToPDF` e
  impressão.

## 4. Perfis de execução (DEV / HOMOLOGATION / PRODUCTION)

Resolvido **antes** de qualquer serviço iniciar (`src/main/app/executionProfile.ts`,
`src/main/index.ts`):

| Como iniciou | Perfil |
|---|---|
| `npm run dev` (não empacotado) | **DEV**, sempre |
| App empacotado sem `FC_EXECUTION_PROFILE` | **PRODUCTION** |
| App empacotado com `FC_EXECUTION_PROFILE=HOMOLOGATION` (é o que `npm run pack:run` faz) | **HOMOLOGATION** |
| App empacotado com qualquer outro valor | **erro** — o app não abre (de propósito) |

| Perfil | Dados internos (userData, banco, logs, cache Chromium) | Relatórios (sugestão no 1º uso) |
|---|---|---|
| PRODUCTION | `%LOCALAPPDATA%\Formatador Comissão\` (banco `Formatador Comissão.db`) | `Documentos\Formatador Comissão` |
| DEV | `%LOCALAPPDATA%\Formatador Comissão Dev\` | `Documentos\Formatador Comissão Dev` |
| HOMOLOGATION | `%LOCALAPPDATA%\Formatador Comissão Homologação\` | `Documentos\Formatador Comissão Homologação` |

Observação: a pasta de relatórios é apenas **sugerida** por perfil; o usuário escolhe no primeiro
uso e o código não impede que DEV/HOMOLOGATION apontem para a pasta de produção — cuidado ao
homologar.

**Nunca** abra `release\win-unpacked\Formatador Comissão.exe` com duplo-clique: sem a variável,
ele roda como PRODUCTION e usa dados reais. Use `npm run pack:run`.

## 5. Estrutura de pastas de relatórios (por modo)

Dentro da raiz escolhida, para cada modo (`Previsão\` e `Relação\`):

| Pasta | Papel |
|---|---|
| `Entrada\` | monitorada pelo chokidar; arquivos `.xlsx` colocados aqui são importados |
| `Processamento\<batchId>\` | cópia de trabalho durante a importação (removida no sucesso) |
| `Gerados\` | PDFs do lote mais recente |
| `Histórico\AAAA\MM\<batchId>\` | PDFs de lotes anteriores (evacuados de `Gerados`) |
| `Processados\AAAA\MM\<batchId>\` | cópia arquivada da planilha de origem |

Manifesto oculto na raiz: `.formador-comissao-report-root.json` (grafia "formador" é **nome
persistido** — não "corrigir"). É o que autoriza o desinstalador a apagar a raiz, se o usuário
pedir.

## 6. Fluxo de uma importação

```
Entrada (drag-drop | botão "Selecionar arquivo" | watcher da pasta Entrada)
  → importService.importFile
      rejeita ~$*, não-.xlsx, arquivo já em processamento
      copia para Processamento\<batchId>\ ; SHA-256 da cópia
      parser do modo (contrato por nome de coluna; erro de modo errado / colunas ausentes / ambíguo)
      agrupa por filial + vendedor (Decimal) ; verifica filiais sem cadastro ; aviso se hash já processado
  → prévia na UI (nada gravado no banco ainda)
      usuário escolhe "separado por filial" ou "consolidado por vendedor" para quem tem >1 filial
  → batchLifecycle.runBatchGeneration  (withModeLock por modo)
      re-parse ; bloqueia se falta filial ; batch 'generating'
      Gerados → Histórico ; gera PDFs (HTML → printToPDF) ; confere tamanho > 0
      grava documents + document_branches (transação) ; 'archiving'
      copia planilha para Processados ; remove original da Entrada (só se veio da Entrada)
      apaga Processamento\<batchId> ; 'completed'   (erro → 'failed', workspace preservado)
```

Nome dos PDFs (`src/main/pdf/outputPath.ts`):
`AAAA-MM-DD_PREVISAO|RELACAO_<filial>_<codVendedor>_<NOME>.pdf` ou
`AAAA-MM-DD_<MODO>_CONSOLIDADO_<codVendedor>_<NOME>.pdf`; nunca sobrescreve (`_2`, `_3`...).

## 7. Banco de dados (`src/main/storage/database.ts`)

- `node:sqlite` `DatabaseSync`, `PRAGMA foreign_keys = ON`, migrações versionadas por
  `PRAGMA user_version`, cada uma em transação.
- Esquema atual: **v4** (desde 2026-09-16, antes da 1.1.0 — todas as versões publicadas de 1.1.0 a
  1.2.4 usam o mesmo esquema).
  - v1: `settings`, `company_profiles`, `batches`, `documents`
  - v2: `company_groups` + `company_profiles.group_key`
  - v3: `documents.grouping_mode` + `document_branches`
  - v4: `batch_seller_grouping`
- Chaves de `settings`: `reportRoot`, `firstRunCompletedAt`.
- Totais gravados como **texto BRL formatado** (`R$ 1.234,56`).
- O banco guarda **caminhos absolutos** (logos, PDFs, planilha arquivada, `reportRoot`) — ao
  restaurar backup em outra máquina, mantenha o **mesmo usuário Windows e as mesmas pastas**.
- Testes usam `openTestDatabase` (`src/main/storage/testDatabase.ts`), que relaxa durabilidade
  **só em teste**. Todo teste novo com banco deve usá-lo.

## 8. PDF

- Templates HTML autocontidos em `src/main/pdf/htmlTemplate/` (`layout.ts`, `baseCss.ts`,
  `previsaoTemplate.ts`, `relacaoTemplate.ts`, `consolidatedTemplate.ts`); todo texto passa por
  `escapeHtml`.
- Render: HTML temporário → janela utilitária → `printToPDF` (A4 retrato, cabeçalho/rodapé
  "Página X de Y").
- Logos e a foto da chapa perfurada entram como data URI; a chapa aparece **uma vez por
  documento** (cabeçalho do separado ou capa do consolidado).
- Impressão: abre o PDF na janela utilitária e chama `webContents.print` (diálogo do sistema).

## 9. Instalador e desinstalador

- NSIS per-user (`perMachine: false`, `allowElevation: false`), assistente (`oneClick: false`),
  atalhos na Área de Trabalho e Menu Iniciar, instala em `%LOCALAPPDATA%\Programs\formatador-comissao\`.
- `deleteAppDataOnUninstall: false` — desinstalar preserva dados por padrão.
- `resources/installer.nsh` adiciona uma página com checkbox **desmarcado** "Também excluir dados
  e documentos". Se marcado, chama o próprio exe em modo headless (`--uninstall-check-paths` para
  listar, `--uninstall-delete-data` para apagar, saída em UTF-16LE). Toda a lógica de segurança
  (bloqueio de Documentos/Desktop/Downloads/raiz de disco, exigência do manifesto) fica em
  TypeScript testável (`src/main/app/uninstallPlan.ts`). Desinstalação silenciosa (`/S`) sempre
  preserva dados.
- Instalador **não assinado** (SmartScreen avisa "editor desconhecido").
- Sem auto-update.

## 10. Invariantes — "não mexer sem decisão explícita"

- Regras financeiras (§2 de 01_CONTEXTO) e o campo somado de cada contrato (marcados "Never change
  this" em `reports/*/contract.ts`).
- `appId` `com.formatadorcomissao.app`, `productName` `Formatador Comissão`, `artifactName`.
- Configuração per-user do NSIS e `deleteAppDataOnUninstall: false`.
- Nome do manifesto `.formador-comissao-report-root.json`.
- Caminhos de PRODUCTION (`%LOCALAPPDATA%\Formatador Comissão`).
- `--publish never` nos scripts `pack` e `dist`.
- `openDatabase` de produção (durabilidade total).

## 11. Onde mexer para cada tipo de mudança

| Quero mudar... | Arquivos |
|---|---|
| Layout/visual do PDF | `src/main/pdf/htmlTemplate/*`, view models em `src/main/pdf/*ViewModel.ts` |
| Colunas aceitas de uma planilha | `src/main/reports/<modo>/contract.ts` + `parser.ts` + `importHelpContent.ts` + skill `input-contracts.md` |
| Telas | `src/renderer/src/pages/*`, `components/*`, `App.css` |
| Novo canal IPC | `src/shared/contracts/ipc.ts` + `api.ts`, `src/preload/index.ts`, `src/main/ipc/*Handlers.ts` |
| Esquema do banco | nova entrada **no fim** do array `MIGRATIONS` em `database.ts` (nunca editar migração existente) |
| Filiais/grupos padrão | `src/main/companies/seedCompanyProfiles.ts` |
| Ícone | `resources/icon.ico` (manter multi-resolução) |
| Logos das empresas | `resources/brand-logos/*.png` |
| Instalador | `package.json` → `build`, `resources/installer.nsh` |
| Pipeline | `.github/workflows/*.yml`, `.node-version` (ver 05) |
