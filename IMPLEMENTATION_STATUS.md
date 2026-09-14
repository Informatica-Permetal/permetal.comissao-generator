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

## Fase 4 - Perfis de empresa/filial, logos, template de PDF, geracao, impressao (CONCLUIDA)

Implementada a pedido explicito do usuario pulando a Fase 3 formal (UX de import/drag-drop/watcher/pre-generation preview completa continua pendente). Para tornar Abrir PDF/Abrir pasta/Imprimir testaveis de verdade, `PrevisaoPage`/`RelacaoPage` ganharam um harness minimo (`GenerateReportPanel`: escolher `.xlsx`, gerar, listar resultado com acoes) - explicitamente **nao** e a UX completa de import (sem drag-drop, sem watcher de `Entrada`, sem tabela de preview formal, sem arquivamento) - isso continua Fase 3/5.

### Empresa/marca x filial x logo

`company_profiles` (schema da Fase 1) ganhou repositorio real (`companies/companyProfileRepository.ts`) e seed idempotente (`companies/seedCompanyProfiles.ts`) para as 4 filiais observadas nos dados: 0103/0104 -> marca PERMETAL, 0105 -> METALGRADE, 0106 -> MG_ZINC (logo `MGZINC.png`, nome `MG` como catalogado). As 4 logos reais fornecidas foram movidas de `logos/` (pasta ad-hoc) para `resources/brand-logos/` (versionado - sao ativos de marca, nao dado de cliente). No seed, o arquivo de marca e copiado para `<userData>/logos/<MARCA>.png`; 0103 e 0104 apontam para o **mesmo arquivo fisico**, provando que a mesma logo e reutilizavel entre filiais da mesma marca. `TRES-S.png` fica disponivel mas sem filial associada (nenhum codigo Tres-S foi observado nos dados - nao inventei um). Nenhum dado cadastral (CNPJ/endereco/razao social) foi inventado; os campos ficam `null` ate o usuario preencher em Configuracoes.

### Geracao de PDF

`main/pdf/`: view-models (`previsaoViewModel.ts`/`relacaoViewModel.ts`) convertem `DocumentGroup` + `CompanyProfile` em texto/moeda ja formatados (nenhuma aritmetica alem da soma ja existente do Fase 2); templates HTML/CSS (`htmlTemplate/`) montam o documento completo; `renderPdf.ts` chama `webContents.printToPDF` com `headerTemplate`/`footerTemplate` nativos do Chromium para "Pagina X de Y" e um cabecalho compacto de continuacao; `generateReportPdfs.ts` orquestra grupo -> PDF, **bloqueando a geracao inteira** se qualquer filial do arquivo nao estiver configurada (retorna `missingBranchCodes`, nada e gerado ate isso ser resolvido). PDFs sao salvos em `<raiz>/<Modo>/Gerados/` com nome deterministico e colisao tratada com sufixo numerico (nunca sobrescreve).

**Bug real encontrado e corrigido durante a inspecao**: `app.getAppPath()` resolve para `out/main` (pasta do script), nao a raiz do projeto - verificado empiricamente. Corrigido usando `__dirname` relativo, no mesmo padrao ja usado para o caminho do preload.

**Bug de plataforma encontrado e corrigido**: criar/destruir varias `BrowserWindow` ocultas em sequencia, sem nenhuma janela jamais mostrada, falha de forma intermitente ao carregar arquivo local nesta maquina (`ERR_FAILED`) - reproduzido isoladamente. Com uma janela normal (como a `mainWindow` real do app) criada antes, o mesmo padrao funciona perfeitamente. Ainda assim adotei uma janela utilitaria unica reaproveitada (`pdf/utilityWindow.ts`) para renderizacao e impressao, por ser mais robusta (funciona nos dois cenarios) e mais barata (evita recriar processo de renderer a cada PDF).

### Acoes do PDF

`pdf/pdfActions.ts`: `Abrir PDF` (`shell.openPath`), `Abrir pasta` (`shell.showItemInFolder`), `Imprimir` (carrega o PDF no visualizador nativo do Chromium na janela utilitaria e chama `webContents.print` com dialogo normal do SO). Verificado empiricamente que `loadFile` de um `.pdf` funciona e que `printToPDF` a partir dele reproduz o conteudo fielmente antes de confiar no fluxo de impressao.

### Validacao visual com PDFs reais

Gerados via um harness temporario (`pdf/_debugGenerate.ts`, **deletado** antes de finalizar - nunca commitado) que constroi fixtures sinteticas `.xlsx` e roda o pipeline completo real (parse -> agrupa -> gera) dentro do Electron de verdade, cobrindo as 4 filiais/marcas, 1 pagina, multi-pagina, **11 paginas** (>10 pedido explicitamente), nome de cliente longo, campos em branco, linhas duplicadas e classificacao desconhecida ("Nota de Debito"). Inspecao visual pagina a pagina confirmou: logos com proporcao preservada (nunca esticadas) para Permetal/Metalgrade/MG Zinc; cabecalho completo so na pagina 1, cabecalho compacto nas seguintes; cabecalho de coluna repetido em toda pagina; secoes de classificacao preservadas em ordem, incluindo a desconhecida; linha duplicada e linha em branco preservadas sem alterar a contagem; nome longo nao quebra o layout; e o caso mais dificil - quando total+assinatura nao cabiam no fim da pagina 10, o bloco inteiro (nunca dividido) migrou para uma pagina 11 nova, exatamente como exigido. Nenhum dado real foi usado nessa validacao; nada disso foi commitado.

### Confirmacao explicita

- Previsao: unico campo somado para o total do PDF = `Comissao total (liquido)` (`TOTAL DA PREVISAO`).
- Relacao: unico campo somado para o total do PDF = `Valor da Comissao` (`TOTAL DA COMISSAO`).
- Nenhuma formula de comissao foi criada nesta fase: os view-models so formatam (moeda/data/percentual) valores ja calculados pelo Protheus e ja somados pelo `groupRows` da Fase 2; `% Comissao` e exibido exatamente como veio da fonte.

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run test` | OK - **78/78** testes (14 arquivos) |
| `npm run build` | OK - `out/main` 54.34 kB (cresceu porque o parser+PDF agora sao alcancaveis pelos handlers IPC reais) |

## Fase 3 - UX de importacao real (drag/drop, seletor, watcher, previa) (CONCLUIDA)

Implementada fora de ordem (depois da Fase 4, a pedido do usuario) para substituir o harness minimo da Fase 4. **Nada da Fase 4 foi reescrito**: o gerador (`generatePrevisaoPdfs`/`generateRelacaoPdfs`), os templates, os perfis de empresa/filial e as acoes do PDF continuam exatamente os mesmos - a Fase 3 so passou a chama-los a partir de um fluxo de importacao real em vez do harness.

### Servico central de importacao

`main/import/importService.ts` (`importFile`) e o **unico** ponto de entrada usado por drag-and-drop, `+ Selecionar arquivo` e pelo watcher da pasta `Entrada` - os tres chamam o mesmo handler IPC (`reports:preview-import`), que chama a mesma funcao. Ele:

1. rejeita `~$*` (arquivo temporario do Excel) e nao-`.xlsx` antes de tocar no arquivo;
2. impede duas importacoes concorrentes do mesmo `sourcePath` (`Set` em memoria);
3. cria um workspace isolado em `<raiz>/<Modo>/Processamento/<batchId>/` e copia o arquivo para la - o arquivo externo nunca e escrito;
4. calcula SHA-256 do arquivo copiado;
5. usa os parsers **ja existentes da Fase 2** (`parsePrevisaoFile`/`parseRelacaoFile`) - zero parsing novo;
6. converte `WrongModeError`/`MissingHeadersError` (lancados pelo parser) em um resultado estruturado serializavel por IPC (`{ ok: false, error: {...} }`), porque um `Error` lancado perde propriedades customizadas ao atravessar `ipcMain.handle` - verificado que so `message`/`name` sobrevivem, entao as classes de erro da Fase 2 nao podiam ser repassadas diretamente;
7. reusa `findUnconfiguredBranchCodes` (extraido do `generateReportPdfs.ts` da Fase 4 para um modulo compartilhado `companies/branchConfiguration.ts`, sem mudar o comportamento - os testes da Fase 4 continuam passando identicos) para listar filiais nao configuradas na previa;
8. consulta `batches` (tabela ja existente desde a Fase 1) por `source_hash` para sinalizar "ja processado em `<data>`" sem bloquear.

O registro em `batches` acontece apos uma geracao bem-sucedida (dentro do handler `reports:generate-pdfs` ja existente da Fase 4, so ganhou uma chamada a mais no final) - nao apos a previa, para nao marcar como "processado" um arquivo que o usuario so espiou.

### Watcher da pasta Entrada

`main/import/entradaWatcher.ts` usa `chokidar` (nao estava instalado, adicionado nesta fase), um watcher por modo, `awaitWriteFinish` para esperar o arquivo estabilizar, filtro de `~$*`/nao-`.xlsx`. **Bug real encontrado e corrigido**: o filtro `ignored` do chokidar tambem e chamado para a propria pasta raiz vigiada, sem `stats` - minha primeira versao rejeitava a pasta "Entrada" por ela nao terminar em `.xlsx`, o que silenciosamente desativava o watcher inteiro. Reproduzido isolado, corrigido tratando nomes sem extensao como "deixa passar" (nunca sao os arquivos que procuramos). O watcher so notifica o caminho para o renderer (`reports:entrada-file-detected`, `webContents.send`); a UI reage chamando a mesma previa usada por drag-and-drop/seletor - reforcando que e o mesmo servico, nao um quarto caminho.

### Tela de previa (somente leitura)

`renderer/src/components/ImportPage.tsx` substitui o harness. Mostra modo, arquivo, total de linhas, vendedores, filiais, documentos, avisos, aviso de "ja processado" (nao bloqueia), e a tabela filial/codigo/vendedor/linhas/total. Nenhum input editavel nos valores - a tabela e puramente `<td>`, sem checkbox, sem botao de exclusao de linha. Filial nao configurada bloqueia o botao "Gerar PDFs" (`disabled`) e mostra um botao "Ir para Configuracoes" que navega para a tela de perfis ja existente da Fase 4. Arquivo de modo errado mostra "Processar como `<modo detectado>`", que troca de pagina e reaproveita o mesmo `sourcePath`.

`window.api.files.getPathForFile` foi adicionado ao preload (`webUtils.getPathForFile`, a API atual do Electron - `File.path` esta descontinuado) para resolver o caminho real de um arquivo solto via drag-and-drop.

### Harness da Fase 4 removido

`renderer/src/components/GenerateReportPanel.tsx` foi deletado; `PrevisaoPage`/`RelacaoPage` agora renderizam `ImportPage`. Nenhuma referencia ao harness permanece no codigo (`grep` confirmado). So existe hoje um fluxo de importacao.

### Confirmacao explicita

- **Nenhum calculo proprio de comissao foi introduzido**: o servico de importacao so orquestra copia de arquivo, hash, chamada aos parsers da Fase 2 e leitura dos totais ja calculados por `groupRows`; nunca soma, multiplica ou reconstroi um valor.
- **O gerador da Fase 4 foi reutilizado, nao duplicado**: `reports:generate-pdfs` continua sendo a unica funcao que gera PDF, chamada tanto pelo fluxo antigo (harness, removido) quanto pelo novo (`ImportPage`), com o `workspaceFilePath` da previa como entrada.

### Testes sinteticos versionados

`importService.test.ts` (10 testes: caminho feliz Previsao/Relacao, modo errado nas duas direcoes, coluna ausente, arquivo temporario, filial nao configurada, arquivo repetido/hash, varios vendedores e filiais, processamento concorrente do mesmo path) e `entradaWatcher.test.ts` (3 testes com chokidar real sobre pastas temporarias reais: deteccao, roteamento por modo, filtro de `~$`/nao-`.xlsx`).

### Validacao com os dois arquivos reais anexados

Rodei um script temporario (deletado, nunca commitado) chamando `importFile` e o gerador de verdade contra os arquivos reais dentro do Electron real, cobrindo os 13 cenarios pedidos:

| Cenario | Resultado |
|---|---|
| Previsao correta | 165 linhas, 18 vendedores, 4 filiais, 26 documentos, 0 filiais faltando |
| Relacao correta | 1358 linhas, 27 vendedores, 4 filiais, 38 documentos, 0 filiais faltando |
| Relacao no modo Previsao | `wrongMode`, detectado Relacao |
| Previsao no modo Relacao | `wrongMode`, detectado Previsao |
| Filial nao configurada | as 4 filiais reais corretamente listadas como faltando quando o lookup nao encontra nenhuma |
| Arquivo temporario `~$` | rejeitado antes de qualquer leitura |
| Geracao real | 26 PDFs gerados de verdade reusando o gerador da Fase 4 |
| Arquivo repetido | `previouslyProcessedAt` populado corretamente apos a geracao registrar o lote |
| Watcher | detectou o arquivo real copiado numa pasta Entrada real |

Vendedores em mais de uma filial (cenario 12) fica provado pelos proprios numeros: 18 vendedores unicos produzindo 26 documentos so e possivel se varios vendedores aparecem em mais de uma filial - consistente com o teste sintetico dedicado que ja cobre esse caso isoladamente. Drag-and-drop e o dialogo do seletor de arquivo em si (gestos de UI) nao sao automatizaveis neste ambiente, mas chamam exatamente o mesmo `previewImport` validado acima - a logica e identica, so a origem do clique muda. Nenhum dado real foi copiado para fixtures ou logs; script e artefatos de teste apagados ao final.

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run test` | OK - **91/91** testes (16 arquivos) |
| `npm run build` | OK - `out/main` 62.45 kB |

## Auditoria de integracao Fase 3 x Fase 4 (CONCLUIDA)

Nao e uma fase nova - verificacao de que a inversao acidental (Fase 4 implementada antes da Fase 3) nao deixou codigo duplicado, harness concorrente ou estado inconsistente. **Nenhum defeito foi encontrado; nenhuma linha de codigo precisou mudar.**

### Verificacoes estruturais (grep/leitura de codigo)

| Verificacao | Resultado |
|---|---|
| Harness temporario (`GenerateReportPanel`) ainda existe | Nao - zero referencias, arquivo deletado |
| `parsePrevisaoFile`/`parseRelacaoFile` tem mais de uma implementacao | Nao - uma cada, ambas importadas so por `importService.ts` (previa) e `pdfHandlers.ts` (geracao) |
| `generatePrevisaoPdfs`/`generateRelacaoPdfs` tem mais de uma implementacao | Nao - uma, em `generateReportPdfs.ts`, chamada so por `pdfHandlers.ts` |
| Canal IPC registrado mais de uma vez | Nao - cada canal tem exatamente 1 handler no main + 1 uso no preload |
| `findUnconfiguredBranchCodes` duplicada entre previa e geracao | Nao - uma implementacao (`companies/branchConfiguration.ts`), usada pelos dois |
| `getCompanyProfile` (perfil de empresa/filial) diverge entre previa e geracao | Nao - mesma funcao, mesmo `db`, chamada em `importHandlers.ts` e `pdfHandlers.ts` |
| `reports.generatePdfs` chamado com caminho que nao seja a copia em Processamento | Nao - unico call site no renderer usa sempre `preview.workspaceFilePath` |
| Padroes proibidos (`DISTINCT`/dedupe/base x percentual) em todo `src/` | Nenhum encontrado (unico "distinct" e um comentario em ingles descrevendo o helper) |
| `importService.ts` escreve no `sourcePath` externo | Nao - so `copyFileSync(sourcePath, workspaceFilePath)`, nunca o inverso |

### Validacao ponta a ponta com os dois arquivos reais anexados (fluxo oficial completo)

Script temporario (deletado, nunca commitado) rodou o fluxo completo real - Entrada por arquivo -> copia para Processamento -> validacao -> parsing -> agrupamento -> previa -> geracao pelo pipeline da Fase 4 - para os dois modos:

| | Previsao | Relacao |
|---|---|---|
| Linhas na previa | 165 | 1358 |
| Documentos na previa | 26 | 38 |
| PDFs efetivamente gerados | 26 | 38 |
| Filiais/vendedores distintos nos PDFs gerados | 4 filiais / 18 vendedores | 4 filiais / 27 vendedores |
| Filiais faltando configuracao | 0 | 0 |

**Previa e geracao bateram numero por numero** (26=26, 38=38) - se previa e geracao usassem logica divergente em algum ponto, essa igualdade teria quebrado primeiro. Inspecionei visualmente um PDF de cada modo (Previsao filial 0103, Relacao filial 0104): logo Permetal renderizando com proporcao correta, cabecalho, identidade, tabela e total identicos ao validado na Fase 4 - nenhuma regressao visual. Nao houve necessidade de nenhum ajuste de design nesta etapa.

### Confirmacoes explicitas do checklist do usuario

- Drag-and-drop, seletor e watcher usam o mesmo servico - confirmado por leitura de codigo (todos chamam `reports:preview-import` -> `importFile()`).
- Existe apenas uma implementacao autoritativa de cada parser e um unico pipeline de geracao - confirmado acima.
- Perfis de empresa/filial sao os mesmos na previa e no PDF - confirmado (mesma funcao, mesmo banco).
- Filial nao configurada bloqueia a geracao antes do PDF - confirmado com os 2 arquivos reais (missingBranchCodes vazio quando configurado; population correta quando testado com lookup vazio, ja documentado na Fase 3).
- Nenhuma linha do Protheus desaparece, duplicidades permanecem - reconfirmado pelos 91 testes automatizados (inalterados) mais a igualdade previa=geracao com dados reais.
- Total da Previsao soma somente `Comissao total (liquido)`; total da Relacao soma somente `Valor da Comissao` - reconfirmado por grep em todo `src/` e pelos valores exatos do PDF real (R$ 191,38 + R$ 168,47 = R$ 359,85, identico ao valor bruto do arquivo original).
- Nenhuma comissao calculada por base/percentual - grep confirmou zero operacoes aritmeticas entre campos financeiros em todo o projeto.
- Erros de modo errado e de cabecalho ausente sao claros - estruturados (`wrongMode`/`missingHeaders`) desde a Fase 3, inalterados.
- Arquivos externos nunca sao modificados - confirmado por leitura de codigo (`importService.ts` so le `sourcePath`).

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run test` | OK - **91/91** testes (16 arquivos, inalterados) |
| `npm run build` | OK - `out/main` 62.45 kB (identico a antes da auditoria - nenhum codigo mudou) |

**Seguro prosseguir para a Fase 5.**

## Proximo passo

Fase 5 (arquivamento/rotacao Gerados->Historico, tela de Historico, regenerar, excluir) ainda nao implementada. `batches` ja recebe um registro por geracao bem-sucedida (necessario para a deteccao de arquivo repetido da Fase 3), mas isso e so o minimo pedido - nenhuma rotacao de pastas, nenhuma UI de historico, nenhum regenerar/excluir foi feito. Nao iniciar sem aprovacao explicita.
