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

## Fase 5 - Ciclo de vida completo do lote: arquivamento, rotacao, historico, regenerar, excluir (CONCLUIDA)

**Nao reimplementou nem o parsing (Fase 2) nem a geracao de PDF (Fase 4)**: `generatePrevisaoPdfs`/`generateRelacaoPdfs`, os templates HTML/CSS, `renderHtmlToPdf` e `parsePrevisaoFile`/`parseRelacaoFile` continuam exatamente os mesmos - a Fase 5 os envolve numa orquestracao de ciclo de vida (`main/batches/batchLifecycle.ts`), sem alterar uma linha da logica de parsing ou de layout do PDF.

### Orquestracao do lote (`main/batches/`)

- **`batchLifecycle.ts`** (`runBatchGeneration`): parse (Fase 2, inalterado) -> bloqueio por filial nao configurada (contrato identico ao da Fase 4: nada e persistido, nada e publicado) -> `insertBatch` com `status:'generating'` -> dentro de um bloco try: evacua o ocupante atual de `Gerados` para `Historico` (`evacuateGeradosToHistorico`), gera (Fase 4, inalterado), **verifica cada PDF gerado** (existe e tem tamanho > 0, senao lanca erro), `status:'archiving'`, copia a fonte para `Processados/AAAA/MM/<batchId>/` (nunca move - a copia de trabalho em `Processamento` so e apagada depois de tudo confirmado), remove o original da `Entrada` **somente** se `sourceKind==='entrada'` e o caminho realmente comeca dentro da pasta `Entrada` daquele modo (defensivo contra apagar algo fora do esperado), insere um registro `documents` por PDF gerado, `status:'completed'`. Qualquer excecao no bloco try marca `status:'failed'` e relanca - a copia de trabalho e a fonte externa nunca sao tocadas nesse caminho.
- **`publishGeneratedDocuments`** foi extraida como funcao compartilhada (evacuar -> gerar -> verificar -> persistir documentos -> atualizar contagem) para ser reutilizada identica tanto pela primeira geracao quanto pela regeneracao (`regenerateService.ts`), evitando duas implementacoes divergentes do mesmo fluxo.
- **`evacuateGerados.ts`**: move (nao copia) cada PDF hoje em `Gerados` para `Historico/AAAA/MM/<batchId-original>/` (organizado pelo `batchId`/`generatedAt` **do documento sendo movido**, nao do lote novo) e atualiza o `pdf_path` no banco - nunca sobrescreve, nunca perde um lote anterior.
- **`archiveSource.ts`** / **`archivePaths.ts`** / **`moveFileSafely.ts`**: copia da fonte para `Processados`, resolucao de caminho `AAAA/MM/<batchId>` para `Processados`/`Historico`/`Processamento`, e um `rename` com fallback `copy+delete` para mover entre volumes (`EXDEV`).
- **`regenerateService.ts`** (`regenerateBatch`/`regenerateDocument`): re-le a fonte **ja arquivada** (`source_archived_path`) com o parser atual, roda `publishGeneratedDocuments` de novo (mesma evacuacao/verificacao/persistencia da geracao original) - o PDF novo publica em `Gerados`; a versao anterior desse mesmo lote vai para `Historico` como qualquer outro ocupante evacuado, entao nenhuma versao e perdida. Se a fonte arquivada nao existe mais, retorna um aviso estruturado sem tocar em nada (o lote `completed` permanece intacto - uma tentativa de regeneracao que falha nunca corrompe um historico ja bom). `regenerateDocument` resolve o lote do documento e regenera o lote inteiro, porque o gerador da Fase 4 sempre renderiza um lote completo de uma vez (nao ha funcao de renderizar um unico grupo isoladamente, e criar uma so para isso seria reimplementar o gerador).
- **`deleteService.ts`** (`deleteDocument`/`deleteBatch`): usa `shell.trashItem` (Lixeira do Windows, nunca exclusao permanente direta) via dependencia injetada. `deleteDocument` manda so aquele PDF para a lixeira e remove so aquele registro - **nunca** toca a fonte arquivada do lote (outros documentos do mesmo lote podem precisar dela para regenerar depois). `deleteBatch` manda todos os PDFs do lote **e** a fonte arquivada (a copia interna em `Processados`, nunca o arquivo externo original) para a lixeira, remove lote+documentos do banco, e tenta limpar (best-effort, nunca falha a operacao) ate 3 niveis de pastas vazias acima de cada arquivo removido.

### Banco de dados

Nenhuma migracao nova foi necessaria: o schema da Fase 1 (`batches.source_archived_path`, `batches.warning_json`) ja antecipava os campos da Fase 5, so ficaram sem uso ate agora. `storage/batchRepository.ts` ganhou `getBatchById`, `updateBatchStatus`, `updateBatchArchivedPath`, `updateBatchOutputCount`, `deleteBatchRecord`, `listBatchIdsWithDocuments`. Novo `storage/documentRepository.ts`: CRUD completo + `listDocuments` com filtro dinamico (modo/vendedor/filial/busca/data) para a tela de Historico, e `listDocumentsInGerados` (usada pela evacuacao).

### IPC e contrato compartilhado

`reports:generate-pdfs` mudou de assinatura: antes recebia `(mode, filePath)` e fazia uma geracao minima sem arquivamento; agora recebe o `BatchPreview` inteiro (o renderer ja o tem, vindo da previa da Fase 3) e chama `runBatchGeneration` com `batchId`/`sourcePath`/`sourceKind`/`workspaceFilePath` - o **mesmo** `batchId` da previa, preservando a ligacao entre a pasta `Processamento` e o registro final em `Processados`/`documents`. Seis canais novos sob `history:*` (`list`, `get-batch`, `delete-document`, `delete-batch`, `regenerate-document`, `regenerate-batch`), implementados em `main/ipc/historyHandlers.ts` reusando `deleteService`/`regenerateService`/`documentRepository`/`batchRepository` - nenhuma logica nova no handler alem de checar se a pasta raiz esta configurada.

### Tela de Historico

`renderer/src/pages/HistoricoPage.tsx` deixou de ser o placeholder da Fase 1: filtros (modo/busca por arquivo-ou-lote/filial/vendedor/data de-ate), lista agrupada por lote com cabecalho do lote (nome do arquivo, modo, acoes "Gerar novamente (lote)"/"Excluir lote") e uma tabela de documentos por lote com filial/vendedor/linhas/total/data e acoes por documento (Abrir PDF, Abrir local, Imprimir - reusando os mesmos `window.api.pdf.*` ja existentes da Fase 4; Gerar novamente; Excluir). Exclusao (documento ou lote inteiro) pede confirmacao nativa (`window.confirm`) antes de qualquer chamada IPC destrutiva.

### Bug real encontrado e corrigido durante a implementacao

`batchLifecycle.ts` na primeira versao importava e chamava `renderHtmlToPdf` (o renderizador real, que cria uma `BrowserWindow`) diretamente, em vez de recebe-lo como dependencia injetada - quebrando o padrao de testabilidade ja estabelecido pelo proprio `generateReportPdfs.ts` (`GenerateReportPdfsDeps.renderPdf`). Corrigido antes de qualquer teste ser escrito: `renderPdf` agora e um campo obrigatorio de `RunBatchGenerationDeps`, injetado pelo `pdfHandlers.ts`/`historyHandlers.ts` reais com `renderHtmlToPdf` e substituido por uma funcao falsa nos testes.

### Testes sinteticos versionados

23 testes novos (`batchLifecycle.test.ts`, `deleteService.test.ts`, `regenerateService.test.ts`), todos com fixtures `.xlsx` sinteticas geradas em runtime (`reports/testSupport/xlsxFixtures.ts`, reaproveitado da Fase 3) e um `renderPdf`/`trashItem` falso injetado (nenhuma `BrowserWindow`/Lixeira real e tocada pelos testes automatizados). Cobrindo: geracao completa (PDF+arquivamento+persistencia+`completed`), remocao do original da Entrada so apos sucesso, segunda geracao evacuando a primeira para Historico sem sobrescrever, bloqueio por filial nao configurada sem tocar em Gerados/banco, falha durante a geracao marcando `failed` e preservando a copia de trabalho, exclusao de documento preservando a fonte do lote, exclusao de lote completo (PDFs+fonte+registros), erros estruturados para lote/documento inexistente, regeneracao publicando uma nova versao e preservando a anterior no Historico, e aviso estruturado (sem excecao) quando a fonte arquivada foi removida externamente.

### Validacao ponta a ponta com os dois arquivos reais anexados

Script temporario (`main/debugE2E.ts`, **deletado** junto com o gancho em `main/index.ts` antes de finalizar - nunca commitado) rodou dentro do Electron real, cobrindo os 14 cenarios pedidos:

| # | Cenario | Resultado |
|---|---|---|
| 1-2 | Geracao a partir de arquivo externo (Previsao e Relacao) | 26 e 38 PDFs gerados, 0 filiais faltando, lote `completed`, arquivo original em Downloads intacto (bytes identicos antes/depois) |
| 3 | Multiplos PDFs num unico lote | Relacao real gerou 38 documentos distintos num so lote |
| 2b | Geracao a partir da Entrada | copia na pasta Entrada removida so apos arquivamento confirmado; lote `completed` |
| 4 | Novo lote move o anterior de Gerados para Historico | confirmado por identidade de lote no banco (nao por nome de arquivo, que e deterministico por data+filial+vendedor e por isso pode coincidir entre lotes do mesmo dia) - os documentos do lote anterior passaram a apontar para `Historico/AAAA/MM/<batchId>/` e o arquivo la existe |
| 5 | Busca/filtros | filtro por modo, por nome de arquivo/lote e por filial retornaram exatamente o esperado |
| 6-8 | Abrir PDF / Imprimir / Abrir local | wrappers inalterados da Fase 4 (`shell.openPath`/`print`/`showItemInFolder`) - **nao invocados de propria vontade** nesta automacao para nao abrir janelas do SO/dialogo de impressao sem supervisao; validado indiretamente confirmando que os PDFs-alvo existem e sao validos |
| 9 | Excluir um documento | PDF foi para a lixeira, registro removido, contagem do lote caiu exatamente 1 |
| 10 | Fonte do lote permanece apos excluir 1 documento | confirmado - `source_archived_path` do lote Relacao continuou existindo |
| 11 | Excluir um lote inteiro | todos os PDFs do lote da Entrada + sua fonte arquivada foram para a lixeira, registros de lote e documentos removidos do banco |
| 12 | Regenerar | lote Relacao regenerado a partir da fonte arquivada, 38 PDFs novos publicados, lote continuou `completed` |
| 13 | Arquivo repetido (hash) | `previouslyProcessedAt` sinalizado corretamente na terceira importacao do mesmo arquivo Previsao |
| 14 | Falha durante o arquivamento | bloqueio proposital do diretorio de destino em `Processados` (arquivo no lugar de pasta) fez `runBatchGeneration` lancar excecao real; lote marcado `failed`; copia de trabalho **nao** foi perdida; arquivo original em Downloads continuou intacto |

Um erro de sequenciamento no **proprio script de validacao** (nao no app) apareceu na primeira rodada: o cenario 4 comparava contra os caminhos do lote 1, mas o cenario 2b (geracao pela Entrada, que roda entre 1 e 4) ja tinha evacuado o lote 1 para o Historico antes do cenario 4 rodar - a comparacao certa e contra o ocupante *atual* de Gerados no momento do cenario 4, nao contra o lote 1. Corrigido no script (nao no app) e revalidado - todos os 14 cenarios passaram na rodada seguinte.

### Confirmacao explicita

- **Financeiro inalterado**: Previsao continua somando somente `Comissao total (liquido)`; Relacao continua somando somente `Valor da Comissao`. Nenhuma linha nova de aritmetica foi adicionada em nenhum modulo da Fase 5 - toda a soma continua vindo do `groupRows` da Fase 2, so reempacotada em PDFs novos ou republicados.
- **Fonte externa nunca tocada**: confirmado por leitura de codigo (`archiveSourceFile` so copia, nunca escreve no `sourcePath`) e pelo teste real - bytes do arquivo em Downloads identicos antes/depois de geracao, geracao repetida e ate do cenario de falha.
- **Nenhum lote e marcado `completed` prematuramente**: `status` so vira `completed` na ultima linha do bloco try, apos fonte arquivada + todos os PDFs verificados + documentos persistidos; qualquer excecao antes disso deixa o lote em `failed` (nunca em silencio).
- **Nenhum lote anterior e apagado antes de o novo publicar**: a evacuacao move (nunca apaga) o ocupante de Gerados para Historico **antes** de escrever qualquer PDF novo; se a geracao falhar depois da evacuacao, o lote anterior continua integro em Historico (nunca em Gerados, mas nunca perdido).

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` (node + web) | OK - sem erros |
| `npm run lint` | OK - sem erros/avisos |
| `npm run test` | OK - **105/105** testes (19 arquivos) |
| `npm run build` | OK - `out/main` ~79 kB, `out/renderer` ~681 kB |

## Auditoria adversarial pos-Fase 5 (CONCLUIDA)

Nao e uma fase nova - uma revisao adversarial (6 revisores independentes por dimensao, cada achado verificado por um segundo agente instruido a tentar refuta-lo) rodou sobre o codigo da Fase 5 recem-concluida, cobrindo perda de dado, condicoes de corrida, contrato IPC/seguranca, conformidade financeira, corretude de UI e cobertura de teste. **10 achados foram confirmados como reais e corrigidos** (nenhum foi descartado como falso-positivo apos verificacao). Nenhum deles violou o comportamento ja validado no relatorio da Fase 5 acima (financeiro, fonte externa intocada, e os 14 cenarios reais) - todos sao lacunas adicionais que a auditoria achou por baixo desse comportamento correto no caminho feliz.

### Achados de perda de dado (severidade alta/baixa) - CORRIGIDOS

| # | Achado | Correcao |
|---|---|---|
| 1 | `evacuateGerados.ts` movia um PDF para o Historico com `join(historicoDir, basename(...))` sem checar colisao - como o nome do PDF e deterministico por data+filial+vendedor, uma segunda evacuacao do MESMO lote no MESMO dia (ex.: regenerar duas vezes) sobrescrevia e destruia permanentemente o PDF historico anterior, violando "arquivos historicos nunca sao sobrescritos" | Passou a usar `resolveUniqueOutputPath` (ja existente em `pdf/outputPath.ts`, o mesmo helper que protege a escrita original em Gerados) - colisao agora ganha sufixo numerico, nunca sobrescreve |
| 2 | Em `publishGeneratedDocuments`, se um lote com varios documentos tivesse um PDF invalido/vazio, os outros PDFs do MESMO lote ja escritos em disco ficavam orfaos (sem registro em `documents`) - como toda evacuacao/Historico/exclusao so enxerga arquivos via consulta ao banco, esses PDFs reais ficavam presos em Gerados para sempre, invisiveis ao app | O loop de verificacao agora apaga (best-effort) todos os PDFs que essa tentativa escreveu antes de lancar o erro - nenhum arquivo sobra sem registro |

### Achados de concorrencia (severidade alta/media) - CORRIGIDOS

Nenhum dos tres achados abaixo era alcancavel no caminho feliz sequencial ja validado na Fase 5 - todos exigiam duas operacoes assincronas reais (geracao/regeneracao/exclusao) disparadas ao mesmo tempo para o mesmo modo, algo que a tela de Historico permite (os botoes de acao por documento e por lote nao se bloqueavam entre si).

| # | Achado | Correcao |
|---|---|---|
| 3 | `regenerateBatch` sem trava: uma `deleteBatch` concorrente podia remover a linha do lote em `batches` enquanto `regenerateBatch` ainda estava renderizando PDFs - ao terminar, `insertDocument` violava a constraint de chave estrangeira, mas os PDFs ja escritos em Gerados ficavam orfaos e sem rollback | Novo `main/batches/modeLock.ts` (mutex assincrono por chave) serializa toda geracao/regeneracao/exclusao do MESMO modo - a segunda operacao so comeca depois que a primeira termina |
| 4 | `regenerateBatch` sem trava contra si mesma: duas regeneracoes concorrentes do MESMO lote podiam evacuar/gerar/inserir em paralelo, produzindo registros de documento duplicados e uma contagem `output_count` inconsistente ("ultimo a escrever vence") | Mesmo `modeLock.ts` - regeneracoes do mesmo lote (mesmo modo) agora sao estritamente sequenciais |
| 5 | `evacuateGeradosToHistorico` decide o que mover so consultando o banco, nunca o disco - uma segunda geracao/regeneracao do MESMO modo, comecando antes da primeira inserir seus registros de documento, evacuava "nada" (porque o banco ainda nao sabia dos arquivos da primeira) e escrevia seus proprios PDFs por cima, deixando Gerados com arquivos de dois lotes ao mesmo tempo | Mesmo `modeLock.ts` - elimina a janela de corrida entre "PDF escrito em disco" e "registro inserido no banco" para operacoes concorrentes do mesmo modo |

`modeLock.ts` e um mutex por chave simples (fila de promises encadeadas por `ReportMode`), sem dependencias novas. `runBatchGeneration`, `regenerateBatch`, `deleteBatch` e `deleteDocument` foram reestruturados em um wrapper fino (le o `mode` do lote/documento primeiro, fora da trava) + uma funcao `*Locked` (todo o trabalho que muta arquivos/banco, dentro da trava) - a funcao `*Locked` sempre re-busca o registro fresco do banco, entao um lote apagado entre a checagem inicial e a aquisicao da trava vira "nao encontrado" de forma limpa, nunca uma excecao.

### Achado de UI (severidade media) - CORRIGIDO

| # | Achado | Correcao |
|---|---|---|
| 6 | O balao de mensagem de acao na tela de Historico (`.historico-page__message`) tinha uma unica cor verde de sucesso fixa, usada tanto para mensagens de sucesso quanto de falha (ex.: "Falha ao excluir o documento." aparecia com a mesma cara de "2 PDF(s) regenerado(s) com sucesso.") - um usuario podia ler uma falha como confirmacao de que a acao destrutiva funcionou | `actionMessage` passou a carregar `{kind: 'success' \| 'error', text}`; nova classe `.historico-page__message--error` (vermelho, mesmo padrao ja usado em `.import-page__error`) e aplicada quando `kind === 'error'` |

De brinde, os botoes de acao por documento e por lote (Gerar novamente/Excluir) passaram a se desabilitar mutuamente dentro do mesmo lote (`isBatchBusy`) - antes, uma acao no lote inteiro nao desabilitava os botoes dos documentos individuais desse lote e vice-versa, permitindo o clique duplo que alimentava os achados #3/#4 do lado do servidor (agora inofensivo gracas ao `modeLock`, mas a UI tambem foi corrigida para nao enfileirar cliques sem necessidade).

### Achados de cobertura de teste (severidade alta/media) - CORRIGIDOS

| # | Achado | Teste novo/fortalecido |
|---|---|---|
| 7 | Nenhum teste em `batchLifecycle.test.ts`/`regenerateService.test.ts`/`deleteService.test.ts` semeava um lote com mais de um documento - "lote com varios PDFs" (item 3 do checklist original da Fase 5) e "excluir um documento preservando os IRMAOS do mesmo lote" (item 5) nao eram realmente provados | `deleteService.test.ts`: novo teste com um lote de 2 documentos, excluindo um e confirmando que o outro (registro + PDF) continua intacto |
| 8 | O teste de "filial nao configurada" comecava com Gerados vazio, entao nunca provava que uma importacao bloqueada deixa um lote ja publicado intocado | `batchLifecycle.test.ts`: novo teste publica um lote valido primeiro, depois roda uma importacao bloqueada do mesmo modo, e confirma que o PDF/registro do lote publicado continuam exatamente como estavam |
| 9 | Nenhum teste combinava `sourceKind: 'entrada'` com uma falha de geracao/arquivamento - o unico teste de falha usava fonte externa | `batchLifecycle.test.ts`: novo teste forca falha do `renderPdf` com uma fonte da Entrada e confirma que o arquivo original da Entrada sobrevive (so e removido apos sucesso) |
| (achado #2 acima) | Sem teste para PDFs orfaos em lote com varios documentos | `batchLifecycle.test.ts`: novo teste com 2 documentos onde o segundo falha na verificacao, confirmando que Gerados fica vazio (zero arquivos orfaos) apos a falha |
| (achado #1 acima) | Sem teste de regressao para a sobrescrita no Historico | Novo arquivo `evacuateGerados.test.ts`: reproduz duas evacuacoes do mesmo lote no mesmo dia e confirma que o PDF historico original preserva seu conteudo |
| (achados #3/#4/#5 acima) | Sem teste de concorrencia | Novo `modeLock.test.ts` (3 testes unitarios do mutex) + dois testes novos em `regenerateService.test.ts`: duas regeneracoes concorrentes do mesmo lote (confirma serializacao, sem duplicar/corromper Gerados) e regenerar+excluir o mesmo lote ao mesmo tempo (confirma que nunca sobra PDF orfao nem excecao nao tratada) |

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` (node + web) | OK - sem erros |
| `npm run lint` | OK - sem erros/avisos |
| `npm run test` | OK - **115/115** testes (21 arquivos, +10 desde o relatorio original da Fase 5) |
| `npm run build` | OK - `out/main` ~81 kB, `out/renderer` ~681 kB |

**Seguro prosseguir para a Fase 6.**

## Proximo passo

Fase 6 ainda nao implementada (empacotamento/instalador Windows e demais itens fora do escopo das Fases 1-5, conforme `implementation-plan.md`). Nao iniciar sem aprovacao explicita.
