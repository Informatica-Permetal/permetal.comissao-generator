# Implementation Status - Formatador Comissao

Fonte de verdade: `.claude/skills/formatador-comissao/SKILL.md`, `.claude/skills/formatador-comissao/references/*.md` e `docs/Formatador-Comissao-Especificacao.md`.

## Fase 0 - Auditoria de repositorio e baseline de engenharia (CONCLUIDA)

### Auditoria realizada

- Branch: `main` (working tree limpo antes de iniciar; upstream `origin/main` existe mas o tracking local estava ausente - nao bloqueante, nao alterado nesta fase).
- Repositorio antes da Fase 0: continha apenas documentacao (`SKILL.md`, `references/*.md`, `docs/*.md`, `assets/README.md`, `agents/openai.yaml`). Nenhum codigo-fonte, nenhum `package.json`, nenhum scaffold Electron/React.
- Package manager: nenhum configurado antes desta fase. Adotado `npm` (compativel com o toolchain Node/Electron padrao do `architecture.md`).
- Lint/typecheck/test/build: inexistentes antes desta fase. Configurados nesta fase (ver abaixo).
- Nenhuma implementacao anterior de calculo de comissao, deduplicacao de linhas, acesso de rede/nuvem, ou privilegio de renderer inseguro foi encontrada, porque nao havia codigo algum. Nenhum conflito com a regra de nao-calculo.

### Scaffold minimo criado

Stack: Electron + React + TypeScript + Vite via `electron-vite` (ferramenta que gerencia os tres bundles main/preload/renderer exigidos pelo `architecture.md`).

Apenas o necessario para provar que o pipeline de build/typecheck/lint/test funciona com os limites de seguranca corretos. Nenhuma logica de negocio, leitura de XLSX, geracao de PDF, watcher, historico, empresas/logos, impressao ou instalador foi implementada.

- `src/main/index.ts` - processo main minimo: cria a `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; titulo da janela e `app.setName` usam o nome de produto exato via `shared/constants/app.ts`; bloqueia abertura de novas janelas/URLs remotas via `setWindowOpenHandler`.
- `src/preload/index.ts` + `index.d.ts` - preload minimo, expoe um objeto `api` vazio via `contextBridge` (sem `fs`/`shell`/IPC generico). Sera preenchido com metodos IPC tipados a partir da Fase 1+.
- `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx` - tela placeholder unica mostrando apenas o nome do produto. Nao e a Home screen final (cards Previsao/Relacao/Historico) - isso e escopo da Fase 1.
- `src/shared/constants/app.ts` - constante `APP_NAME = 'Formatador Comissao'`, consumida por main e renderer, com teste unitario (`app.test.ts`) que trava o nome exato exigido pela regra 1 do `SKILL.md`.

### Ferramentas de qualidade configuradas

- TypeScript (`tsconfig.json` para o contexto web/renderer com DOM lib; `tsconfig.node.json` para o contexto main/preload sem DOM lib) - separacao reflete a fronteira de processos do `architecture.md`.
- ESLint 10 (flat config, `eslint.config.mjs`) com `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-config-prettier`.
- Prettier (`.prettierrc.json`).
- Vitest (`vitest.config.ts`, ambiente `node`).

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm install` | OK - 203 pacotes, 0 vulnerabilidades |
| `npm run typecheck` (node + web) | OK - sem erros |
| `npm run lint` | OK - sem erros/avisos |
| `npm run test` | OK - 1/1 teste passou |
| `npm run build` (`electron-vite build`) | OK - gerou `out/main`, `out/preload`, `out/renderer` |

`npm run dev` (execucao interativa da janela Electron) nao foi disparado nesta fase; a verificacao "funciona como usuario Windows padrao" e gate de aceite da Fase 1, nao da Fase 0.

## Fase 1 - Shell desktop, seguranca, storage e primeiro uso (CONCLUIDA)

### O que foi implementado

- **SQLite real** via `node:sqlite` (`DatabaseSync`), nativo do Node 24 empacotado no Electron 44 - sem dependencia nativa externa, sem `node-gyp`/`electron-rebuild`, o que mantem o instalador per-user simples. Confirmado experimentalmente (`process.versions.sqlite` presente, sem aviso de API experimental).
- Migracao unica (`PRAGMA user_version`) cria as 4 tabelas do schema base de `architecture.md` secao 9 (`settings`, `company_profiles`, `batches`, `documents`) mais os indices sugeridos. `company_profiles`/`batches`/`documents` ficam vazias/nao usadas ate as Fases 2-5; so a estrutura foi criada agora, conforme pedido explicitamente pelo prompt de Fase 1 ("SQLite initialization with migrations and the baseline tables from the architecture reference").
- **Logs locais**: `src/main/app/logger.ts` grava JSON-lines por dia em `%LOCALAPPDATA%\Formatador Comissao\logs\`.
- **Dados internos** (`userData` do Electron) redirecionados de `%APPDATA%` (padrao do Electron) para `%LOCALAPPDATA%\Formatador Comissao\`, conforme `project-spec.md`/`architecture.md`.
- **IPC tipado e restrito**: um unico contrato compartilhado (`src/shared/contracts/api.ts` + `src/shared/contracts/ipc.ts` + `src/shared/types/settings.ts`) implementado identicamente no preload (`contextBridge.exposeInMainWorld('api', ...)`) e consumido no renderer via `window.api`. Apenas 4 metodos expostos, todos sob `settings.*`: `getState`, `chooseFolder`, `testFolder`, `completeFirstRun`. Nenhum `fs`/`shell`/`ipcRenderer` generico exposto.
- **Primeiro uso** (`FirstRunPage.tsx` + `src/main/app/reportRoot.ts` + `settingsHandlers.ts`): sugere `<Documentos>/Formatador Comissao` (via `app.getPath('documents')`, respeita redirecionamento OneDrive/KFM), permite escolher outra pasta (dialogo nativo do Windows), testa permissao de criar/gravar/excluir automaticamente a cada mudanca de pasta, e so libera "Concluir configuracao inicial" quando o teste passa. Ao confirmar, cria a arvore completa `Previsao/{Entrada,Processamento,Processados,Gerados,Historico}` e `Relacao/{...}` e persiste `reportRoot` + `firstRunCompletedAt` no SQLite.
- **Tela inicial**: `HomePage.tsx` com os 3 cards (Previsao de Comissoes, Relacao de Comissoes, Historico) mais um botao "Configuracoes" no cabecalho do shell (`App.tsx`), que leva a `SettingsPage.tsx` mostrando pasta raiz, dados internos, logs, banco de dados e versao. `PrevisaoPage`/`RelacaoPage`/`HistoricoPage` sao placeholders explicitos ("sera implementado na Fase X").
- Alias `@shared` (em `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts`) para importar `src/shared/*` de forma estavel a partir de main, preload e qualquer profundidade do renderer, em vez de caminhos relativos frageis.

### Desvio documentado do mapa de modulos original

`renderer/src/pages` e `renderer/src/components` foram usados para todas as telas desta fase, em vez de `renderer/src/features/{home,settings}` sugerido em `architecture.md`. Motivo: nao ha ainda complexidade especifica de feature (formularios de import, tabela de preview) que justifique a subdivisao; `pages/` e suficiente e mais simples para 6 telas. `features/` sera introduzido quando a Fase 3 (import/preview) precisar de componentes proprios e complexos o bastante para justificar o isolamento.

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` (node + web) | OK - sem erros |
| `npm run lint` | OK - sem erros/avisos |
| `npm run test` | OK - 12/12 testes (5 arquivos) |
| `npm run build` | OK - `out/main` 9.58 kB, `out/preload` 0.77 kB, `out/renderer` ~650 kB |

### Verificacao manual no Windows real (nao apenas testes automatizados)

Build de producao executado de fato via `electron.exe` neste computador (nao apenas `npm run dev`), varias vezes, incluindo reinicializacoes reais (processo encerrado e reaberto):

- Confirmado: nenhum prompt de UAC/administrador em nenhum momento; tudo criado sob `%LOCALAPPDATA%\Formatador Comissao\` do usuario atual.
- Confirmado por leitura direta do arquivo `.db` (bytes crus e via `node:sqlite` a partir de um processo separado, com o app totalmente fechado): as 4 tabelas do schema existem de fato em disco apos o primeiro `app.whenReady()`.
- Confirmado **caminho com espacos**: `createFolderTree`/`testFolderPermissions` testados (Vitest) contra uma pasta como `Formatador Comissao - Pasta de Testes` dentro de um diretorio temporario, e a propria pasta padrao de dados internos (`Formatador Comissao`, que contem espaco) foi criada com sucesso pelo app real.
- Confirmado **reinicializacao sem perder configuracao**: gravei `reportRoot`/`firstRunCompletedAt` no banco (equivalente ao clique em "Concluir configuracao inicial"), fechei o processo Electron por completo, reabri um processo novo do zero, e o mesmo `reportRoot` (com espaco no caminho) e `firstRunCompletedAt` continuavam la - validado tanto por teste automatizado (`settingsRepository.test.ts`, fecha e reabre um `DatabaseSync` sobre o mesmo arquivo) quanto pela execucao real do binario.
- Os artefatos dessa verificacao manual (`%LOCALAPPDATA%\Formatador Comissao\` de teste) foram removidos ao final para que o **seu** primeiro uso real do app comece limpo, do zero, passando pela tela de configuracao inicial de verdade.
- Nao testado por automacao de UI (sem ferramenta de automacao de janela nativa disponivel neste ambiente): cliques reais em "Escolher outra pasta" e "Concluir configuracao inicial" na interface grafica. A logica por tras desses botoes (dialogo nativo, teste de permissao, criacao de pastas, persistencia) foi validada como descrito acima; falta apenas a confirmacao visual/interativa, recomendada como primeiro passo ao abrir o app.

Regra permanente (nao muda em nenhuma fase futura): o Formatador Comissao nao calcula comissao. O Protheus e a fonte dos valores. A unica aritmetica financeira permitida e a soma do campo de comissao ja designado pelo Protheus (`Comissao total (liquido)` em Previsao, `Valor da Comissao` em Relacao) por documento vendedor+filial. Nunca usar base x percentual, datas, status ou classificacao para calcular ou decidir comissao. Nunca deduplicar linhas do Protheus. Nenhum codigo desta fase toca esses campos.

## Mapa de modulos (atualizado apos a Fase 1)

`[criado]` = existe fisicamente hoje. Sem marca = mapa-alvo para as fases futuras (conforme `references/architecture.md`, com o desvio documentado acima em `renderer/`).

```text
src/
  main/
    index.ts               [criado - bootstrap, janela segura, wiring de IPC/DB/logger]
    app/
      paths.ts              [criado - %LOCALAPPDATA% e sugestao de pasta de Documentos]
      logger.ts              [criado - logs JSON-lines locais]
      reportRoot.ts           [criado - arvore de pastas + teste de permissao]
    ipc/
      settingsHandlers.ts    [criado - 4 handlers tipados: getState/chooseFolder/testFolder/completeFirstRun]
    storage/
      database.ts            [criado - abertura + migrations SQLite]
      settingsRepository.ts   [criado - get/set settings, reportRoot, firstRunCompletedAt]
    reports/                 (Fase 2: normalizacao de cabecalho, adapters Previsao/Relacao)
    pdf/                     (Fase 4)
    printing/                (Fase 4)
    watcher/                 (Fase 3)
    history/                 (Fase 5)
    companies/               (Fase 4)
  preload/
    index.ts                [criado - expoe window.api.settings.*, nada generico]
    index.d.ts               [criado]
  renderer/
    index.html               [criado]
    src/
      main.tsx               [criado]
      App.tsx                 [criado - maquina de estado: carregando/erro/first-run/shell]
      App.css                 [criado]
      pages/
        FirstRunPage.tsx       [criado]
        HomePage.tsx            [criado - 3 cards]
        SettingsPage.tsx         [criado]
        PrevisaoPage.tsx          [criado - placeholder]
        RelacaoPage.tsx            [criado - placeholder]
        HistoricoPage.tsx          [criado - placeholder]
      components/
        PlaceholderPage.tsx      [criado]
      features/                 (Fase 3+: import/preview, quando houver complexidade que justifique)
  shared/
    constants/
      app.ts                 [criado - APP_NAME]
      folders.ts               [criado - REPORT_MODES, MODE_SUBFOLDERS]
    contracts/
      ipc.ts                  [criado - nomes de canal]
      api.ts                   [criado - FormatadorComissaoApi]
    types/
      settings.ts              [criado - AppState, FolderPermissionResult, CompleteFirstRunResult]
    validation/                (ainda nao usado pelo renderer/IPC - validacao de contrato vive em main/reports/common ate a Fase 3 precisar expor algo tipado ao renderer)
```

## Fase 2 - Contratos de entrada Excel, parsing, validacao, agrupamento e totais (CONCLUIDA)

### O que foi implementado

Biblioteca pura em `src/main/reports/` (ainda nao ligada a nenhuma tela ou IPC - isso e Fase 3):

- **Leitura de `.xlsx`**: `exceljs` (nao o pacote `xlsx`/SheetJS do npm, que esta travado em 0.18.5 com advisories de prototype-pollution/ReDoS nao corrigidos nessa distribuicao; `exceljs` e ativamente mantido e e explicitamente permitido por `architecture.md`: "`xlsx` or a maintained Excel reader"). `decimal.js` para toda a aritmetica de totais.
- **Normalizacao de cabecalho** (`common/text.ts`): remove NBSP, colapsa espacos, remove acentos (NFD + faixa de diacriticos por code point, sem depender de regex com caracteres Unicode literais no codigo-fonte), normaliza caixa. Localizacao de cabecalho (`common/contractValidation.ts`) escaneia as 5 primeiras linhas preferindo a linha 1, casa por nome normalizado (nunca por posicao), e mantem o cabecalho real (com acento) disponivel para diagnostico.
- **Contrato Previsao** (`previsao/contract.ts`): os 13 campos exatos de `input-contracts.md`. **Contrato Relacao** (`relacao/contract.ts`): os 15 campos exatos.
- **Numeros brasileiros** (`common/numbers.ts`): aceita numero nativo do Excel OU string BR (`.` milhar, `,` decimal); `Decimal` sem perda de precisao.
- **Datas** (`common/dates.ts`): sempre via getters/constructors UTC, nunca locais - o meio-dia UTC dos exports nunca vira o dia anterior/seguinte independente do fuso da maquina.
- **Identidade** (`common/text.ts` `parseCodeNamePair`): separa "CODIGO - NOME" pelo primeiro `" - "` apenas, preservando zeros a esquerda como texto (nunca convertido a numero).
- **Deteccao de modo errado**: `WrongModeError` quando o arquivo tem os marcadores do outro modo. **Coluna ausente**: `MissingHeadersError` listando exatamente os cabecalhos faltantes.
- **Agrupamento** (`common/grouping.ts`): estritamente por `(filial_codigo, vendedor_codigo)`; soma decimal-safe usando **apenas** o campo autoritativo passado pelo chamador - nenhuma outra aritmetica.
- **Avisos nao bloqueantes**: classificacao Previsao desconhecida, `Tipo de Registro`/`B-E` inesperados na Relacao, nome divergente para o mesmo codigo - nunca filtram/alteram a linha.
- Nenhuma linha e removida por estar em branco, zerada, negativa ou "parecer duplicada"; uma linha so e pulada se **todas** as celulas mapeadas estiverem vazias (linha fantasma no fim da planilha).

### Confirmacao explicita

- **Previsao**: o unico campo somado para o total do PDF e `Comissao total (liquido)` (`PREVISAO_TOTAL_FIELD_KEY` em `previsao/contract.ts`).
- **Relacao**: o unico campo somado para o total do PDF e `Valor da Comissao` (`RELACAO_TOTAL_FIELD_KEY` em `relacao/contract.ts`).
- **Nenhuma formula de comissao foi criada.** Auditoria (`grep`) confirmou zero ocorrencias de multiplicacao/divisao entre `valorBaseParaBaixa`/`valorTotalComissao`/`valorIrrf`/`valorBaseDaComissao`/`percentComissaoSobreVlBase` em todo `src/main/reports/`, e zero uso de `DISTINCT`/`drop_duplicates`/dedupe. Os campos de base/percentual/IRRF sao parseados e guardados apenas para exibicao/auditoria futura (Fase 4), nunca combinados entre si.

### Validacao com os dois arquivos reais anexados

Executada localmente via um teste temporario (`_realFileValidation.test.ts`, **deletado** antes de finalizar a fase - nunca commitado) apontando para os arquivos em `Downloads/`, mais uma soma independente (script fora do repo, sem usar o parser) para descartar bug mascarado:

| Arquivo | Linhas | Grupos (filial+vendedor) | Total (campo autoritativo) | Bate com soma independente? |
|---|---|---|---|---|
| Previsao de comissoes.xlsx | 165 | 26 | 6324.00287465011359 | Sim, digito a digito |
| Relacao de Comissoes.xlsx | 1358 | 38 | 165297.49 | Sim, digito a digito |

Nenhum aviso disparado em nenhum dos dois arquivos (dados observados sao limpos: classificacoes e Tipo de Registro/B-E dentro do esperado). Nenhum dos dois arquivos, nem qualquer trecho de seus dados (nomes de cliente/vendedor, valores), foi copiado para fixture, log persistente ou commit - `git status` confirmado limpo dessas referencias ao final.

### Testes sinteticos versionados

42 testes (`npm run test`), nenhum usa dado real. Fixtures sao geradas em runtime como `.xlsx` de verdade (via `exceljs`, escritos em pasta temporaria e apagados no `afterEach`) por `testSupport/xlsxFixtures.ts` - exercita o mesmo caminho de leitura de arquivo binario que o app usa, sem nenhum binario fixo versionado. Cobrindo, para os dois modos: caminho feliz, colunas reordenadas, cabecalhos com espacos extras/NBSP, zeros a esquerda, numeros brasileiros (incluindo alta precisao), valor em branco/zero/negativo, linha duplicada preservada, varios vendedores, mesmo vendedor em duas filiais, arquivo do modo errado, coluna obrigatoria ausente, e um teste dedicado provando que o total nunca deriva de base x percentual.

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run test` | OK - **42/42** testes (7 arquivos) |
| `npm run build` | OK - bundle do main nao cresceu (9.58 kB) porque o parser ainda nao e importado por nenhum entry point; e codigo testado mas nao ligado a UI/IPC ate a Fase 3 |

### Nota de seguranca de dependencia

`npm audit` reporta 2 avisos moderados de `uuid` (`GHSA-w5hq-g745-h8pq`), puxado transitivamente por `exceljs`. `uuid` e usado pelo `exceljs` apenas ao **escrever** planilhas (geracao de IDs de relacionamento XML); nesta fase so **lemos** `.xlsx`, entao o caminho vulneravel nunca e exercitado. `npm audit fix --force` rebaixaria `exceljs` para 3.4.0 (breaking change) sem necessidade real - nao apliquei. Revisitar quando a Fase 4 (geracao de PDF) ou qualquer escrita de xlsx entrar em cena.

## Proximo passo

Fase 3 (`references/implementation-plan.md`): UX de importacao (drag/drop, seletor de arquivo, `Abrir pasta de entrada`), watchers das pastas Entrada, e tela de preview antes da geracao - e onde os parsers desta fase finalmente sao ligados a IPC/UI. Nao iniciar sem aprovacao explicita.
