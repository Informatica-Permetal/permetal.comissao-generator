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

## Fase 6 - Instalador Windows per-user (CONCLUIDA)

Nenhuma regra financeira, parsing ou template de PDF foi alterada nesta fase. As unicas mudancas de codigo-fonte foram para corrigir um problema real de empacotamento (resolucao de caminho de asset dentro do asar - ver abaixo); todo o resto e configuracao de build (`package.json`) e um icone versionado novo.

### Ferramenta e alvo

`electron-builder` (devDependency nova, `26.15.3`) com alvo `nsis`, instalacao per-user:

- `productName`: "Formatador Comissao" (nome visivel, define tambem o nome do `.exe`, da pasta de instalacao e do atalho);
- `perMachine: false`, `oneClick: false`, `allowElevation: false` - instala em `%LOCALAPPDATA%\Programs\Formatador Comissao` por padrao (fora de `Program Files`, gravavel pelo usuario padrao, **sem nenhum prompt de UAC**);
- `allowToChangeInstallationDirectory: true` - o assistente de instalacao permite escolher outro caminho, mas continua sempre dentro da area do usuario por padrao;
- `createDesktopShortcut` / `createStartMenuShortcut: true`, `shortcutName: "Formatador Comissao"`;
- `deleteAppDataOnUninstall` **nao definido** (mantido no padrao `false` do electron-builder) - o desinstalador nunca apaga `%LOCALAPPDATA%\Formatador Comissao` (banco/logs/logos internos) silenciosamente, e nunca teve conhecimento algum da pasta de relatorios do usuario (essa pasta e escolhida pelo usuario em qualquer lugar do sistema, normalmente dentro de Documentos - fora do escopo do instalador/desinstalador por construcao, nao por uma regra especial);
- `icon`: `resources/icon.ico` (o icone fornecido pelo usuario - `Formatador-Comissao.ico`, 256x256, valido - foi copiado para `resources/icon.ico` e versionado, seguindo o mesmo padrao ja usado para as logos de marca). Nao foi necessario criar um icone neutro temporario porque um icone real foi fornecido.
- Sem atualizador automatico pela internet - nenhuma dependencia de auto-update foi adicionada.
- Instalador **nao assinado** (nenhum certificado de assinatura de codigo foi configurado/fornecido) - o Windows SmartScreen pode exibir um aviso de "editor desconhecido" no primeiro clique; isso nao impede a instalacao per-user sem admin, e e uma limitacao conhecida documentada abaixo.

### Bug real de empacotamento encontrado e corrigido

O codigo da Fase 4 (`companies/seedCompanyProfiles.ts`/`brandLogos.ts`) resolvia o caminho das logos de marca bundladas via `join(__dirname, '..', '..', 'resources', 'brand-logos', ...)` - funcionava em desenvolvimento (onde `out/main/../..` e a raiz do projeto, ao lado de `resources/`), mas o proprio codigo ja trazia um comentario da Fase 4 avisando: **"Revisit when Phase 6 wires electron-builder extraResources for a packaged build"**. Confirmado exatamente esse problema ao inspecionar o `app.asar` empacotado: `__dirname` dentro do asar aponta para `resources/app.asar/out/main`, entao o calculo antigo resolvia para `resources/app.asar/resources/brand-logos/...` (caminho duplicado e inexistente). Alem disso, `copyFileSync` (usado para copiar a logo bundlada para `userData/logos/`) e conhecido por nao funcionar de forma confiavel quando o arquivo de origem esta dentro do asar (o fast-path nativo do `copyFileSync` nao atravessa o sistema de arquivos virtual do asar).

**Correcao**: `resources/brand-logos/` (e `resources/icon.ico`) agora sao publicados **fora** do `app.asar` via `build.extraResources` do electron-builder, como arquivos reais em `process.resourcesPath` no build empacotado. Novo modulo `src/main/app/assets.ts` (`resolveBrandLogosDir`/`resolveAppIconPath`) resolve o caminho correto em cada contexto: `app.isPackaged` ? `join(process.resourcesPath, ...)` : `join(__dirname, '..', '..', 'resources', ...)` (o calculo antigo, que so era correto em dev). `brandLogos.ts` e `seedCompanyProfiles.ts` foram ajustados para receber o diretorio ja resolvido em vez de reconstruir o caminho `resources/brand-logos` internamente. `main/index.ts` tambem passou a definir `icon:` na `BrowserWindow` usando o mesmo resolvedor (a logo aparece na barra de tarefas/titulo da janela, nao so no `.exe`).

### Assets no build empacotado - confirmado funcionando

Testado de verdade contra o `app.asar` empacotado (nao apenas por leitura de codigo):

| Item | Resultado |
|---|---|
| `resources/brand-logos/*.png` e `resources/icon.ico` fora do asar | Confirmado - `release/win-unpacked/resources/brand-logos/` e `.../resources/icon.ico` existem como arquivos reais, `app.asar` nao os contem |
| `node_modules` de dependencias externalizadas (`chokidar`, `decimal.js`, `exceljs`) dentro do asar | Confirmado via `npx asar list` - `node_modules\chokidar\package.json`, `node_modules\decimal.js\package.json`, `node_modules\exceljs\package.json` presentes, alem de `out\main\index.js`, `out\preload\index.js`, `out\renderer\index.html` |
| `node:sqlite` | Nativo do Node/Electron - nenhum arquivo/dependencia extra para empacotar |
| Preload | Carrega de dentro do asar normalmente (padrao suportado pelo Electron) |
| Seed de perfis de empresa (le logo do `extraResources`, grava copia em `userData/logos/`) | Confirmado rodando o `.exe` empacotado de verdade: perfil `0103` semeado, `userData\logos\PERMETAL.png` etc. gravados com o tamanho exato do arquivo de origem |
| Geracao de PDF (Chromium `printToPDF`) a partir do bundle empacotado | Confirmado - 26 PDFs (Previsao) + 38 PDFs (Relacao) gerados de verdade a partir dos dois arquivos reais, rodando o `.exe` empacotado |
| Watcher de Entrada (`chokidar`) no build empacotado | Confirmado - arquivo colocado em `Entrada` foi detectado pelo watcher real dentro do processo empacotado |

### Primeiro uso

Fluxo da Fase 1 preservado sem nenhuma alteracao de codigo: sugestao de pasta em Documentos, escolha de outra pasta, teste de permissao, criacao das arvores `Previsao`/`Relacao`, tudo sem exigir admin. Nao foi integrado ao proprio instalador (nao ha tela de escolha de pasta de relatorios dentro do assistente NSIS) - o app continua pedindo isso no primeiro lancamento, conforme a arquitetura ja definida (`references/architecture.md` secao 14 permite qualquer uma das duas abordagens; o app mantem a que ja existia e ja era testada).

### Desinstalacao

Nao ha, nem foi adicionada, nenhuma opcao de "apagar dados internos do app" na interface - `deleteAppDataOnUninstall` fica no padrao `false`, entao o desinstalador nunca apaga `%LOCALAPPDATA%\Formatador Comissao` (banco de dados, logos internos, logs) nem a pasta de relatorios do usuario (que fica em outro lugar, normalmente Documentos, e o desinstalador nunca teve qualquer conhecimento dela). Confirmado empiricamente abaixo, com arquivos reais.

### Smoke test do instalador - executado de verdade, nao apenas planejado

Todos os passos abaixo foram executados literalmente nesta maquina Windows real, com a conta de usuario **atual confirmada como NAO administradora** (`WindowsPrincipal.IsInRole(Administrator) = False`, grupo `BUILTIN\Administradores` listado como "somente para negar" no token do usuario) - exatamente o cenario de aceite pedido pela Fase 6.

| # | Passo pedido | Resultado |
|---|---|---|
| 1 | Instalar | `Formatador Comissao-Setup-0.1.0.exe /S` (instalacao silenciosa, sem UAC) - `exit code 0` |
| - | Local de instalacao | `%LOCALAPPDATA%\Programs\Formatador Comissao` - confirmado que **nao** existe em `C:\Program Files` nem `C:\Program Files (x86)` |
| - | Atalhos | Atalho de Menu Iniciar e de Area de Trabalho confirmados criados (`Formatador Comissao.lnk` em ambos) |
| - | Registro (Adicionar/Remover Programas) | Entrada `HKCU\...\Uninstall\<guid>` confirmada com `DisplayName = "Formatador Comissao 0.1.0"` (per-user, nunca `HKLM`) |
| 2 | Abrir | `.exe` instalado lancado; processo permaneceu vivo com `MainWindowTitle = "Formatador Comissao"` |
| 3 | Primeiro uso | **NAO TESTADO interativamente** (sem ferramenta de automacao de janela nativa disponivel neste ambiente) - ver "Nao testado" abaixo para o procedimento manual. A logica de primeiro uso em si (criacao de arvore de pastas, teste de permissao, persistencia) e identica ao codigo ja validado manualmente na Fase 1 e nao foi alterada nesta fase |
| 4-8 | Importar Previsao/gerar, importar Relacao/gerar, abrir PDF, imprimir | **Fluxo de clique-a-clique NAO TESTADO** (mesma limitacao de automacao de UI). O PIPELINE por tras desses passos (parse -> agrupa -> gera PDF via Chromium) foi validado rodando de verdade dentro do `.exe` empacotado (nao apenas em dev) com os dois arquivos reais anexados - ver tabela de assets acima. "Abrir PDF"/"Imprimir" sao wrappers inalterados da Fase 4 (`shell.openPath`/impressao via janela utilitaria), ja validados em fases anteriores, e nao dependem de nada que o empacotamento muda |
| 9 | Watcher de Entrada | Confirmado rodando de verdade dentro do `.exe` empacotado (chokidar detectou um arquivo colocado na pasta `Entrada`) |
| 10 | Historico | **NAO TESTADO interativamente** nesta fase - UI e IPC inalterados desde a Fase 5 (ja testados la); nenhuma mudanca de empacotamento afeta esse fluxo especificamente |
| 11 | Reiniciar | App fechado (`Stop-Process`) e reaberto com sucesso a partir do local instalado |
| 12 | Desinstalar | `Uninstall Formatador Comissao.exe /S` - `exit code 0`. Confirmado apos a execucao: pasta de instalacao removida, atalho de Menu Iniciar removido, atalho de Area de Trabalho removido, entrada de registro removida |
| 13 | Confirmar preservacao dos documentos | **Confirmado com arquivos reais**: antes de desinstalar, uma pasta de relatorios de teste foi montada em `Documentos\Formatador Comissao` com 3 arquivos simulando uso real (`.xlsx` arquivado em Processados, `.pdf` em Gerados, `.pdf` em Historico). Apos a desinstalacao, os 3 arquivos continuavam presentes, com os mesmos nomes e tamanhos - a desinstalacao nunca tocou nessa pasta. `%LOCALAPPDATA%\Formatador Comissao` (banco/logs internos) tambem permaneceu intacto, como esperado de `deleteAppDataOnUninstall: false` |

Os arquivos de teste (pasta de relatorios simulada e o `userData` gerado durante os testes) foram apagados ao final para que o primeiro uso real do usuario comece limpo, do zero - mesmo padrao ja seguido em todas as fases anteriores.

### Nao testado - lista explicita e procedimento manual

Sem uma ferramenta de automacao de janela nativa do Windows disponivel neste ambiente (o navegador embutido so alcanca paginas web, nao janelas Electron nativas), os seguintes passos do checklist pedido **nao foram clicados manualmente**:

- Tela de primeiro uso (escolher pasta, ver o teste de permissao, clicar em "Concluir configuracao inicial");
- Arrastar-e-soltar ou usar o seletor de arquivo pela UI para importar Previsao/Relacao;
- Clicar em "Gerar PDFs", conferir a previa na tela;
- Clicar em "Abrir PDF" e "Imprimir" a partir da UI;
- Navegar pela tela de Historico (filtros, acoes por documento/lote) apos uma instalacao real.

**Procedimento manual recomendado** (deve ser feito uma vez por uma pessoa, idealmente numa conta padrao sem privilegios de administrador):

1. Rodar `release\Formatador Comissao-Setup-0.1.0.exe` (duplo-clique) e seguir o assistente (escolher ou aceitar o caminho padrao) - confirmar que nenhum prompt do Windows pedindo permissao de administrador aparece.
2. Abrir o app pelo atalho do Menu Iniciar ou da Area de Trabalho.
3. Na tela de primeiro uso, aceitar ou trocar a pasta sugerida, confirmar o teste de permissao (deve mostrar sucesso) e clicar em "Concluir configuracao inicial".
4. Ir em Previsao de Comissoes, arrastar o arquivo `Previsão de comissões.xlsx` (ou usar "+ Selecionar arquivo"), conferir a previa, clicar em "Gerar PDFs".
5. Repetir o passo 4 para Relacao de Comissoes com `Relação de Comissões.xlsx`.
6. Abrir um dos PDFs gerados ("Abrir PDF") e confirmar que abre no leitor padrao do Windows com o conteudo correto.
7. Clicar em "Imprimir" em um documento e confirmar que o dialogo de impressao nativo do Windows aparece.
8. Copiar um `.xlsx` de teste para a pasta `Entrada` de um dos modos (via "Abrir pasta de entrada") e confirmar que o app detecta e mostra a previa automaticamente.
9. Ir em Historico, confirmar que os documentos gerados aparecem, testar os filtros e as acoes (abrir, excluir, gerar novamente).
10. Fechar e reabrir o app; confirmar que a pasta de relatorios configurada e o historico continuam la.
11. Desinstalar pelo Menu Iniciar ou Painel de Controle > Programas; confirmar que nao pede admin.
12. Conferir que a pasta de relatorios (Documentos por padrao) continua intacta apos a desinstalacao.

### Limitacoes conhecidas

- **Instalador nao assinado**: sem certificado de assinatura de codigo configurado. O Windows SmartScreen pode mostrar "Windows protegeu seu PC" no primeiro clique do instalador - o usuario precisa clicar em "Mais informacoes" > "Executar assim mesmo". Isso nao impede a instalacao per-user sem admin (confirmado - o `/S` silencioso funcionou sem nenhum prompt neste teste), mas e uma fricao real para quem abrir via clique duplo/SmartScreen ativo. Resolver exigiria adquirir um certificado de assinatura de codigo, fora do escopo desta fase.
- **UI nao testada por clique manual** (ver secao acima) - toda a logica por tras foi validada (dev, testes automatizados, e agora o pipeline completo rodando de verdade dentro do `.exe` empacotado), mas a experiencia visual/interativa do instalador+app ainda depende de uma verificacao humana unica, recomendada acima.
- Instalador gerado apenas para `x64`. Nao foi gerado/testado para `arm64`.
- Sem assinatura de checksum publicada separadamente (o `.blockmap` gerado pelo electron-builder e para diffs de auto-update, nao usado aqui já que nao ha auto-update).

### Versao, artefato e comandos

| Item | Valor |
|---|---|
| Versao | `0.1.0` (ainda pre-lancamento; Fase 7 - QA hardening/release candidate - e o ponto natural para decidir uma versao `1.0.0`) |
| Instalador | `release\Formatador Comissao-Setup-0.1.0.exe` |
| Tamanho do instalador | 116.478.141 bytes (~111,1 MB) |
| Build unpacked (para testes) | `release\win-unpacked\Formatador Comissao.exe` |

| Comando | Resultado |
|---|---|
| `npm install --save-dev electron-builder@26.15.3` | OK |
| `npm run typecheck` (node + web) | OK - sem erros |
| `npm run lint` | OK - sem erros/avisos |
| `npm run test` | OK - **115/115** testes (21 arquivos, inalterados nesta fase) |
| `npm run build` | OK |
| `npm run pack` (`electron-builder --win --dir`) | OK - gerou `release\win-unpacked\` |
| `npm run dist` (`electron-builder --win`) | OK - gerou o instalador NSIS |

**Seguro prosseguir para a Fase 7.**

## Fase 7 - Auditoria final e release candidate (CONCLUIDA)

Fase de auditoria/QA, nao de funcionalidades novas. **Nenhuma regra financeira, parsing ou template de PDF foi alterada.** O unico arquivo de producao modificado foi `package.json` (bump de versao `0.1.0` -> `1.0.0`, marcando este release candidate); toda a validacao abaixo rodou contra o codigo exatamente como a Fase 6 o deixou - confirmado por `git diff` e por `out/main/index.js` ter saido byte-a-byte do mesmo tamanho (81,00 kB) antes e depois desta fase. Dois scripts de depuracao temporarios (`debugPhase7QA.ts`, `debugPhase7VisualQA.ts`) e um gancho temporario em `main/index.ts` foram usados para rodar as validacoes dentro do Electron real e apagados antes de finalizar - mesmo padrao ja seguido em todas as fases anteriores.

### 1. Auditoria financeira obrigatoria - prova de que nao existe calculo proprio de comissao

Pergunta do usuario: *"Existe algum caminho que calcule, infira, ajuste, deduplique ou filtre direito a comissao alem de somar o campo designado pelo Protheus?"* Resposta, com evidencia:

| Verificacao | Metodo | Resultado |
|---|---|---|
| Operadores aritmeticos Decimal (`.times`/`.mul`/`.div`/`.minus`/`.mod`/`.pow`) em qualquer lugar do codigo | `grep` em todo `src/` | **Zero ocorrencias** em todo o projeto |
| Chamadas a `.plus(` (soma) | `grep` em todo `src/` | Exatamente 3: a soma autoritativa em `reports/common/grouping.ts:38`, e 2 somas independentes em arquivos de TESTE que reconferem o mesmo campo unico (nao producao) |
| `groupRows()` (o unico lugar que soma) recebe o campo certo | Leitura de `previsao/parser.ts:125` e `relacao/parser.ts:141` | Previsao passa `row.comissaoTotalLiquido`; Relacao passa `row.valorDaComissao` - exatamente os campos designados, nada mais |
| Linhas com 2+ campos financeiros na mesma expressao (sinal de combinacao indevida) | `grep` de pares de nomes de campo na mesma linha em todo `src/` | Unico match: um teste dedicado (`relacaoViewModel.test.ts:69-77`) que usa valores DELIBERADAMENTE inconsistentes (base=109.360, %=0,18, mas valorDaComissao=191,38 - que NAO bate com base×%) especificamente para provar que o percentual e exibido como veio da fonte, nunca recalculado |
| `DISTINCT`/dedupe aplicado a linhas do Protheus | `grep` de `DISTINCT`/`drop_duplicates`/`dedupe` em todo `src/` | Unico `DISTINCT` real e uma query SQL de metadados (`SELECT DISTINCT batch_id FROM documents`), sem relacao com linhas de comissao; nenhum dedupe de linha em lugar nenhum |
| Linha pulada por causa de valor financeiro (zero/negativo/em branco) | Leitura de `previsao/parser.ts:83` e `relacao/parser.ts:86` | Uma linha so e pulada quando os campos de IDENTIDADE (vendedor+filial) estao totalmente vazios (linha fantasma no fim da planilha) - nunca por causa do valor de comissao |
| Datas/classificacao/B-E usadas para decidir elegibilidade | Leitura de todos os usos de `dtBaixa`, `dataDeBaixaDoTitulo`, `dataDoPgtoDaComissao`, `classificacao`, `comissaoGeradaPelaBE` em `src/main` | Usados apenas para exibicao e para gerar avisos nao-bloqueantes ("linha preservada"); `classificacao` tambem agrupa visualmente as secoes do PDF (permitido explicitamente pela especificacao) - nunca filtram nem alteram a inclusao de uma linha |
| `parseBrazilianDecimal` filtra zero/negativo | Leitura de `reports/common/numbers.ts` | Aceita e preserva qualquer numero nativo ou string BR, incluindo `0` e negativos; so retorna `null` para celula genuinamente vazia |
| Derivacao de IRRF/liquido (Bruta/IRRF/Liquida) | `grep` de "Bruta"/"Liquida"/"IRRF" em `src/main/pdf` | Recurso opcional da especificacao nunca implementado - `valorIrrf`/`valorTotalComissao` sao parseados para auditoria futura mas nem sequer aparecem no template atual, entao nao ha nenhuma superficie de derivacao |
| Arimetica escondida em template HTML (interpolacao de string) | `grep` de expressoes com operadores dentro de `${...}` em `src/main/pdf/htmlTemplate` | Nenhuma - os 2 falsos-positivos encontrados eram o operador `\|\|` (fallback de string vazia), nao aritmetica |

**Conclusao**: confirmado por auditoria de codigo completa (nao apenas amostragem) que a unica aritmetica financeira em todo o projeto e a soma do campo unico designado por modo, exatamente como exigido. Nada precisou ser corrigido.

### 2. QA funcional completo - executado de verdade dentro do Electron real

Rodado via `debugPhase7QA.ts` (temporario) com os dois arquivos reais anexados (`Previsão de comissões.xlsx`, `Relação de Comissões.xlsx` - usados so localmente, nunca commitados) mais fixtures sinteticas para os casos de borda que os arquivos reais nao cobrem. **75/75 verificacoes passaram** na rodada final (2 falhas na primeira rodada eram bugs no PROPRIO SCRIPT de teste - ver "Bugs encontrados" abaixo - nao no aplicativo).

| # | Item do checklist do usuario | Resultado | Evidencia |
|---|---|---|---|
| 1 | Previsao real | PASS | 165 linhas, 18 vendedores, 4 filiais, 26 documentos/PDFs gerados, arquivo original intacto |
| 2 | Relacao real | PASS | 1358 linhas, 27 vendedores, 4 filiais, 38 documentos/PDFs gerados, arquivo original intacto |
| 3 | Varios vendedores | PASS | 18 (Previsao) / 27 (Relacao) vendedores distintos confirmados |
| 4 | Varias filiais | PASS | 4 filiais distintas confirmadas nos dois arquivos |
| 5 | Mesmo vendedor em filiais diferentes | PASS | Vendedor 000001 aparece em 2 filiais, cada uma com seu proprio PDF (nunca mesclados) |
| 6 | Filial desconhecida | PASS | Filial sintetica 0199 listada em `missingBranchCodes`, geracao bloqueada, nada publicado |
| 7 | Modo errado | PASS | Arquivo real Relacao detectado como Relacao ao importar em modo Previsao (e vice-versa) |
| 8 | Cabecalho faltante | PASS | Remocao sintetica de "Comissao total (liquido)" detectada com o nome exato da coluna |
| 9 | Colunas reordenadas | PASS | Cabecalhos em ordem invertida ainda resolvem corretamente por nome (total bate) |
| 10 | Espacos/acentos nos cabecalhos | PASS | Cabecalho com acento real, espacos extras e NBSP (`\u00A0`) resolvido corretamente |
| 11 | Zeros a esquerda | PASS | Codigo de vendedor `000007` preservado como texto |
| 12 | Valores em branco | PASS | Linha com comissao em branco preservada, total = R$ 0,00 |
| 13 | Zero | PASS | Linha com comissao `0,00` preservada e exibida |
| 14 | Negativo | PASS | Linha com `-50,00` preservada, reduz o total corretamente |
| 15 | Duplicidades aparentes | PASS | 2 linhas identicas preservadas, total = 2x (nenhuma descartada) |
| 16 | Hash repetido | PASS | `previouslyProcessedAt` sinalizado na segunda importacao do mesmo arquivo |
| 17 | Arquivo temporario Excel (`~$`) | PASS | Rejeitado antes de qualquer leitura |
| 18 | Arquivo ainda sendo gravado | PASS | Escrita simulada em 2 etapas com atraso - watcher (`awaitWriteFinish`) so disparou apos estabilizar, arquivo detectado estava completo e legivel |
| 19 | Drag-and-drop | PASS (por auditoria de codigo) | `importFile()` e o unico ponto de entrada, identico ao usado pelo seletor/watcher - gesto de clique em si nao e automatizavel neste ambiente (ver "Nao testado") |
| 20 | Seletor de arquivo | PASS (por auditoria de codigo) | Mesmo servico que drag-and-drop |
| 21 | Watcher de Entrada | PASS | Deteccao real confirmada (item 18) |
| 22 | Previa | PASS | `BatchPreview` correto em todos os cenarios acima |
| 23 | Geracao | PASS | PDFs reais gerados via Chromium em todos os cenarios |
| 24 | Processamento | PASS | Workspace removido apos sucesso |
| 25 | Processados | PASS | Fonte arquivada em `Processados/AAAA/MM/<batchId>/`, confirmada em disco |
| 26 | Gerados | PASS | PDFs publicados corretamente |
| 27 | Historico | PASS | Rotacao Gerados->Historico confirmada (26 documentos movidos ao publicar novo lote) |
| 28 | Abrir PDF | PASS (estrutural) | PDF comeca com cabecalho `%PDF-` valido; wrapper (`shell.openPath`) inalterado desde a Fase 4, nao invocado para nao abrir janelas do SO sem supervisao |
| 29 | Abrir pasta | PASS (estrutural) | Wrapper inalterado (`shell.showItemInFolder`), mesma logica |
| 30 | Imprimir | PASS (estrutural) | Wrapper inalterado (janela utilitaria + `webContents.print`), mesma logica |
| 31 | Excluir documento | PASS | PDF removido, registro removido, fonte do lote e os outros 37 documentos preservados |
| 32 | Excluir lote | PASS | Todos os PDFs + fonte arquivada removidos, registro do lote removido do banco |
| 33 | Regenerar | PASS | Lote Relacao regenerado a partir da fonte arquivada (38 PDFs, integros mesmo apos exclusao de 1 documento avulso anteriormente) |
| 34 | Reiniciar apos falha | PASS | Falha forcada no renderizador -> lote `failed`, copia de trabalho preservada; banco fechado e reaberto ("reiniciar") - estado `failed` permaneceu consistente, sem corrupcao |

### 3. QA visual - PDFs reais e sinteticos comparados com as referencias

PDFs gerados de verdade (reais + sinteticos para bordas que os arquivos reais nao cobrem) e lidos/inspecionados visualmente, comparados com `Exemplo visual Relatório Comissões.pdf` (referencia estetica) e `Versão Antiga Relatório.pdf` (referencia funcional/SIGA) - **nenhum dos dois foi copiado mecanicamente**, exatamente como instruido desde a Fase 4.

| Item do checklist | Resultado | Evidencia |
|---|---|---|
| Logo correta | PASS | Permetal (0103/0104), Metalgrade (0105) e MG Zinc (0106) renderizadas corretamente, proporcao preservada, em documentos distintos |
| Filial correta | PASS | Nome e codigo da filial batem em cada PDF (ex.: "METALGRADE NOVA" / "0105") |
| Vendedor correto | PASS | Nome e codigo do vendedor batem em cada PDF |
| A4 paisagem | PASS | Confirmado visualmente em todos os PDFs inspecionados |
| 1 pagina | PASS | Documento de 1-3 linhas renderizou em exatamente 1 pagina |
| Varias paginas | PASS | Documento sintetico de 260 linhas renderizou em exatamente 10 paginas |
| 10+ paginas | PASS | Mesmo documento de 260 linhas/10 paginas (contagem confirmada via objetos `/Type /Page` no PDF) |
| Cabecalho de tabela repetido | PASS | Cabecalho da tabela (Documento/Cliente/Emissao/...) presente em todas as 10 paginas do documento longo |
| Pagina X de Y | PASS | "Pagina 1 de 9" ... "Pagina 9 de 9" confirmado na rodada de 9 paginas (formato exato pedido) |
| Nome longo | PASS | Razao social de ~150 caracteres quebrou em 2 linhas dentro da celula, sem estourar o layout, sem truncar |
| Campos vazios | PASS | Emissao/Vencimento/Data da Baixa em branco exibidos como "-"; `Documento` mostrando so o pedido quando o titulo esta ausente (logica exata da especificacao) |
| Classificacao desconhecida | PASS | "Nota de Debito" (nao cadastrada) renderizou em secao propria com o rotulo bruto, linha preservada e contabilizada no total |
| Total final | PASS | "TOTAL DA PREVISAO"/"TOTAL DA COMISSAO" aparece uma unica vez, ao final do documento, valor batendo com a soma esperada em cada caso (incluindo caso negativo: `-R$ 25,50`) |
| Bloco de assinatura | PASS | "Assinatura do Vendedor" / "Assinatura do Responsavel" / "Data: ___/___/______" presente apos o total em todos os documentos |
| Assinatura sem quebra | PASS | Bloco de declaracao+total+assinatura sempre junto na mesma pagina nos casos testados; o caso extremo de migracao para pagina nova quando nao cabe no fim ja foi provado na Fase 4 (11 paginas) com o mesmo template inalterado |
| Impressao em escala de cinza | PASS (por analise estrutural do CSS) | Nenhuma informacao depende so de cor: cabecalhos de tabela usam fundo escuro+texto branco (alto contraste), separadores de secao usam borda+negrito (nao so cor), valores negativos usam sinal "-" literal (nao cor). Nao foi impresso fisicamente em uma impressora real - ver "Nao testado" |
| Nenhuma linha perdida | PASS | Sequencia de 220/260 linhas conferida pagina a pagina sem lacunas nem duplicatas nas transicoes de pagina; total financeiro bate exatamente com `N linhas x valor unitario` em todos os casos sinteticos |
| KPI cards da referencia visual NAO copiados | PASS | Confirmado que o PDF gerado NAO tem os cards "Valor total dos titulos"/"Valor base para baixa"/"Comissao prevista total" da referencia - exatamente como instruido ("nao reproduzir os KPI cards mecanicamente") |

### 4. QA do instalador - reconfirmado com o artefato final (1.0.0)

Repetido do zero nesta fase (nao apenas citado da Fase 6), na mesma conta de usuario **confirmada nao-administradora**, contra o instalador `Formatador Comissao-Setup-1.0.0.exe` final:

| Item | Resultado |
|---|---|
| Instalacao per-user, silenciosa (`/S`) | PASS - `exit code 0`, sem prompt de UAC |
| Ausencia de exigencia indevida de admin | PASS - conta confirmada nao-administradora (`IsInRole(Administrator) = False`) durante todo o teste |
| Local de instalacao | PASS - `%LOCALAPPDATA%\Programs\Formatador Comissao`, confirmado fora de `C:\Program Files` e `C:\Program Files (x86)` |
| Atalhos | PASS - Menu Iniciar e Area de Trabalho criados |
| Registro (Adicionar/Remover Programas) | PASS - `HKCU\...\Uninstall\<guid>` com `DisplayName = "Formatador Comissao 1.0.0"` (per-user, nunca `HKLM`) |
| Abrir o app instalado | PASS - processo permaneceu vivo, `MainWindowTitle = "Formatador Comissao"` |
| Assets (logos via `extraResources`, SQLite) | PASS - `userData\logos\PERMETAL.png` e o banco de dados confirmados criados apos o primeiro lancamento |
| Watcher | PASS - ja confirmado rodando dentro do build empacotado na Fase 6 (codigo inalterado) |
| Historico | PASS (por auditoria de codigo) - UI/IPC inalterados desde a Fase 5 |
| Reiniciar | PASS - processo fechado e reaberto com sucesso |
| Desinstalacao | PASS - pasta de instalacao, atalhos e entrada de registro removidos (a checagem imediatamente apos o `/S` mostrou falso-negativo por causa do proprio uninstaller NSIS se copiar para um local temporario e se autodeletar um instante depois de o processo "pai" sair - re-checado alguns segundos depois e confirmado limpo) |
| Preservacao de dados internos | PASS - `%LOCALAPPDATA%\Formatador Comissao` (banco/logos/logs) sobreviveu a desinstalacao, como esperado de `deleteAppDataOnUninstall: false` |

Nota sobre o item "Desinstalacao": a primeira leitura imediatamente apos o processo do desinstalador sair reportou a pasta de instalacao ainda presente; uma nova checagem alguns segundos depois confirmou tudo removido. Isso e o comportamento padrao e esperado de um desinstalador NSIS (ele se copia para um local temporario para poder apagar seu proprio executavel), nao um defeito do instalador do Formatador Comissao - registrado aqui por transparencia, nao como bug.

### Bugs encontrados e corrigidos nesta fase

**Nenhum bug de aplicativo foi encontrado nesta fase.** A auditoria financeira, o QA funcional (75 verificacoes), o QA visual e o QA do instalador rodaram sem encontrar nenhum problema no codigo de producao - consistente com a Fase 5 ja ter passado por uma auditoria adversarial completa e a Fase 6 ja ter validado o empacotamento.

Dois problemas foram encontrados e corrigidos, mas **nos proprios scripts temporarios de teste desta fase**, nunca no aplicativo:

| # | Onde | Problema | Correcao |
|---|---|---|---|
| 1 | `debugPhase7QA.ts` (temporario) | Bug de precedencia de operador: `d.batchId === rotationImport.ok ? rotationImport.preview.batchId : ''` foi parseado como `(d.batchId === rotationImport.ok) ? ... : ...` em vez da comparacao pretendida - pego pelo TypeScript (`tsc` recusou compilar) antes mesmo de rodar | Extraido `rotationBatchId` como variavel local antes da comparacao |
| 2 | `debugPhase7QA.ts` (temporario) | Expectativa errada do proprio script: assumiu que regenerar um lote apos excluir 1 de 38 documentos avulsos produziria 37 PDFs - na verdade a exclusao de documento nunca toca a fonte arquivada (ja confirmado por outro teste no mesmo script), entao a fonte ainda tem os 38 grupos originais e a regeneracao corretamente produz 38 | Corrigida a expectativa do script de 37 para 38, com um comentario explicando o motivo |

Ambos os scripts foram apagados ao final da fase, junto com o gancho temporario em `main/index.ts` - nao sobrou nenhum vestigio no codigo de producao.

### Bugs conhecidos restantes

| # | Item | Severidade | Detalhe |
|---|---|---|---|
| 1 | Instalador sem assinatura de codigo | Baixa (fricao de confianca, nao funcional) | Sem certificado de assinatura disponivel; Windows SmartScreen pode avisar "editor desconhecido" no primeiro clique manual do instalador. Nao impede instalacao per-user sem admin (confirmado - `/S` funciona sem nenhum prompt). Mesma limitacao ja documentada na Fase 6 |
| 2 | UI nao clicada manualmente por um humano | Nao e bug - lacuna de teste | Sem ferramenta de automacao de janela nativa neste ambiente. Toda a logica por tras de cada tela foi validada via execucao real (nao apenas leitura de codigo) nesta e em fases anteriores; falta so a confirmacao visual/interativa de um humano, com procedimento detalhado abaixo |
| 3 | "Assinatura sem quebra" no limite exato (total nao cabe no fim da pagina) | Nao e bug - nao re-testado nesta fase | Esse caso extremo especifico ja foi validado na Fase 4 (11 paginas, bloco migrou inteiro para pagina nova) com o mesmo template, que nao mudou desde entao. Os testes desta fase (9 e 10 paginas) nao coincidiram exatamente com esse limite |
| 4 | Impressao em escala de cinza nao testada em impressora fisica | Nao e bug - limitacao do ambiente | Confirmado por analise estrutural do CSS (nada depende so de cor), mas nao foi impresso fisicamente. Sem impressora disponivel neste ambiente |
| 5 | Apenas x64, sem arm64 | Aceitavel para v1 | Nao pedido explicitamente; puxaria trabalho extra de empacotamento fora do escopo |

**Nenhum dos itens acima e um bug de: total errado, perda de linha, vendedor/filial misturados, empresa/logo errada, perda de arquivo, admin obrigatorio indevidamente, PDF corrompido/incorreto, ou historico inconsistente** - a barra de bloqueio de release explicitamente definida pelo usuario. Release liberada.

### Nao testado - lista explicita e procedimento manual

Sem automacao de janela nativa disponivel neste ambiente, os seguintes gestos de clique nao foram executados por um humano (a logica por tras de cada um foi validada via execucao real do codigo, nao apenas lida):

- Clicar fisicamente em "Escolher outra pasta"/"Concluir configuracao inicial" na tela de primeiro uso;
- Arrastar um arquivo `.xlsx` para a zona de drop da UI;
- Clicar no seletor de arquivo (dialogo nativo do Windows);
- Clicar em "Gerar PDFs" e olhar a previa na tela;
- Clicar em "Abrir PDF"/"Abrir pasta"/"Imprimir" a partir da UI e ver o resultado (o dialogo de impressao nativo do Windows, em particular);
- Navegar pela tela de Historico (filtros, acoes) clicando de verdade;
- Imprimir fisicamente um PDF numa impressora configurada para escala de cinza.

**Procedimento manual recomendado** (uma pessoa, idealmente numa conta padrao sem privilegios de administrador):

1. Rodar `release\Formatador Comissao-Setup-1.0.0.exe`, seguir o assistente - confirmar que nao pede admin.
2. Abrir pelo atalho criado; completar o primeiro uso (aceitar/trocar pasta, ver o teste de permissao passar, confirmar).
3. Arrastar `Previsão de comissões.xlsx` para a zona de drop; conferir a previa; clicar "Gerar PDFs".
4. Repetir com `Relação de Comissões.xlsx` em Relacao de Comissoes.
5. Abrir um PDF gerado; confirmar que abre corretamente no leitor padrao do Windows.
6. Clicar "Imprimir" num documento; confirmar que o dialogo de impressao do Windows aparece; se possivel, imprimir uma pagina em escala de cinza numa impressora real e confirmar legibilidade.
7. Copiar um `.xlsx` de teste para a pasta Entrada; confirmar deteccao automatica.
8. Ir em Historico; testar filtros e as acoes (abrir, abrir pasta, imprimir, excluir documento, excluir lote, gerar novamente).
9. Fechar e reabrir o app; confirmar que tudo persiste.
10. Desinstalar pelo Menu Iniciar/Painel de Controle; confirmar que nao pede admin e que a pasta de relatorios continua intacta.

### 5. Versao final

**`1.0.0`** - bump de `0.1.0` decidido nesta fase porque a Fase 7 e literalmente descrita em `implementation-plan.md` como a fase que produz o "release candidate", e todos os portoes de aceite definidos la ja estao satisfeitos (ver checklist de release abaixo). Nenhuma outra mudanca de codigo de producao acompanhou o bump.

### 6. Caminho do instalador

`release\Formatador Comissao-Setup-1.0.0.exe`

| Item | Valor |
|---|---|
| Tamanho | 116.478.159 bytes (~111,1 MB) |
| Build unpacked (para testes) | `release\win-unpacked\Formatador Comissao.exe` |
| Assinatura de codigo | Nenhuma (ver limitacoes conhecidas) |

### 7. Guia operacional curto

**Instalar**: baixar/copiar `Formatador Comissao-Setup-1.0.0.exe`, executar (nao precisa ser administrador), seguir o assistente. Instala em `%LOCALAPPDATA%\Programs\Formatador Comissao` por padrao.

**Primeiro uso**: ao abrir pela primeira vez, o app sugere uma pasta em Documentos para guardar os relatorios gerados (pode trocar por outra pasta gravavel). Ao confirmar, cria automaticamente as pastas `Previsao` e `Relacao`, cada uma com `Entrada/Processamento/Processados/Gerados/Historico`.

**Gerar um relatorio**: escolher Previsao ou Relacao na tela inicial; arrastar o `.xlsx` do Protheus para a zona indicada (ou usar "+ Selecionar arquivo", ou simplesmente colocar o arquivo na pasta `Entrada` daquele modo - o app detecta sozinho); conferir a previa (vendedores/filiais/documentos/totais); se alguma filial aparecer como "nao configurada", cadastrar em Configuracoes antes de continuar; clicar "Gerar PDFs".

**Depois de gerar**: cada PDF pode ser aberto, impresso ou localizado no Explorer diretamente pela tela de resultado ou pelo Historico.

**Historico**: tela dedicada com filtros (modo/filial/vendedor/data/busca) e acoes por documento (abrir, abrir pasta, imprimir, excluir, gerar novamente) e por lote inteiro (excluir lote, gerar novamente).

**Excluir**: sempre manda para a Lixeira do Windows, nunca apaga permanentemente de forma direta. Excluir um documento nunca afeta os outros documentos do mesmo lote nem a fonte arquivada. Excluir um lote remove todos os seus PDFs e a copia arquivada da fonte, mas nunca o arquivo original externo de onde ele veio.

**Desinstalar**: pelo Menu Iniciar ou Painel de Controle > Programas, sem precisar de administrador. Os relatorios gerados (pasta escolhida no primeiro uso, normalmente em Documentos) **nunca sao apagados** pela desinstalacao.

**Config/dados internos** (banco de dados, logs, logos cadastradas): ficam em `%LOCALAPPDATA%\Formatador Comissao\`, visiveis na tela de Configuracoes; nao sao apagados ao desinstalar.

### 8. Checklist de release

| Criterio de bloqueio (definido pelo usuario) | Status |
|---|---|
| Total errado | Nenhum encontrado - auditoria financeira completa + totais conferidos em todos os PDFs reais e sinteticos inspecionados |
| Perda de linha | Nenhuma encontrada - sequencias de ate 260 linhas conferidas sem lacunas; duplicidades preservadas; linhas em branco/zero/negativas preservadas |
| Vendedor/filial misturados | Nenhum encontrado - agrupamento estrito por (filial,vendedor) confirmado, inclusive para o mesmo vendedor em filiais diferentes |
| Empresa/logo errada | Nenhuma encontrada - logo/nome/codigo de filial conferidos visualmente em Permetal SP, Permetal Cravinhos, Metalgrade e MG Zinc |
| Perda de arquivo | Nenhuma encontrada - arquivos originais (externos e da Entrada) sempre intactos; fonte arquivada preservada mesmo apos exclusao de documento avulso; nenhum PDF orfao (achados corrigidos na auditoria pos-Fase-5 permanecem corrigidos) |
| Admin obrigatorio indevidamente | Nenhum encontrado - instalacao, uso e desinstalacao confirmados sem nenhum prompt de UAC numa conta nao-administradora real |
| PDF corrompido/incorreto | Nenhum encontrado - todos os PDFs inspecionados comecam com cabecalho `%PDF-` valido e renderizam corretamente |
| Historico inconsistente | Nenhum encontrado - rotacao Gerados/Historico, exclusao e regeneracao mantiveram o banco e o disco sempre coerentes em todos os cenarios testados |

**Nenhum criterio de bloqueio foi violado. Release candidate liberado.**

### Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` (node + web) | OK - sem erros |
| `npm run lint` | OK - sem erros/avisos |
| `npm run test` | OK - **115/115** testes (21 arquivos, inalterados nesta fase) |
| `npm run build` | OK - `out/main` 81,00 kB (identico a Fase 6 - confirma zero mudanca de codigo de producao) |
| `npm run dist` | OK - gerou `release\Formatador Comissao-Setup-1.0.0.exe` |

## Revisao Visual/UX e PDF Retrato (CONCLUIDA)

Fase explicitamente **nao-funcional**: revisao completa de UI/UX do aplicativo e redesenho completo dos PDFs, incluindo a troca de orientacao de A4 paisagem para **A4 retrato**. Regras financeiras, contratos de XLSX, agrupamento vendedor+filial, totais e logica de arquivamento/historico permanecem intocados (confirmado pelos 115 testes automatizados existentes, inalterados, todos verdes).

### Direcao visual adotada

Identidade neutra, premium, industrial-minimalista: sidebar escura fixa com navegacao por icone (Lucide), fundo neutro claro, cartoes com borda/sombra suave, paleta de tokens CSS (`src/renderer/src/App.css`) em vez de estilos soltos. Sem emojis como icone de interface. O shell do app continua generico ("Formatador Comissao"), sem virar "Sistema Permetal".

### Problema central identificado e corrigido (repeticao de vendedor/filial no PDF)

Diagnostico: o cabecalho Chromium nativo, o bloco de logo/empresa e o bloco de identidade do documento repetiam a mesma informacao de filial/vendedor de tres formas diferentes na mesma pagina.

Correcao:
- `src/main/companies/brandLabel.ts` (novo) deriva um **nome de marca curto** (ex.: "Permetal", "MG Zinc") a partir do logo ja associado a filial, distinto do nome completo da filial - usado apenas no cabecalho/letterhead.
- `src/main/pdf/htmlTemplate/layout.ts` foi reescrito: `buildDocumentHeaderHtml` agora mostra razao social (se cadastrada) ou o nome de marca curto (fallback, nunca inventa dado); `buildDocumentMetaHtml` (novo, substitui `buildIdentityHtml`) e o **unico** lugar no corpo do documento onde vendedor+filial aparecem, em um bloco de 3 colunas (VENDEDOR / FILIAL / DATA DE GERACAO), exatamente como especificado.
- O cabecalho/rodape nativo do Chromium (`buildPrintHeaderTemplate`/`buildPrintFooterTemplate`) foi reduzido a apenas codigos, em cinza discreto (ex.: "Vend. 000097 - Filial 0103"), lendo como utilitario de paginacao, nao como uma terceira repeticao da identidade completa.
- Verificado visualmente com e sem dados cadastrais completos (CNPJ/razao social/endereco) - em ambos os casos a informacao aparece exatamente uma vez no corpo do documento.

### PDF: A4 retrato (mudanca de requisito)

- `src/main/pdf/renderPdf.ts`: `printToPDF({ landscape: false, pageSize: 'A4', ... })`.
- `src/main/pdf/htmlTemplate/baseCss.ts` reescrito para retrato: nova tipografia, `.doc-header`/`.doc-meta`/tabela com `table-layout: fixed`, bloco de total (`.total-block__inner`) agora um cartao escuro de destaque, bloco de assinatura com separador.
- `previsaoTemplate.ts`/`relacaoTemplate.ts`: colunas redesenhadas para retrato via `<colgroup>` com larguras proprias por coluna (nao e a tabela paisagem encolhida) - Previsao prioriza Documento/Cliente; Relacao prioriza Cliente/Pedido/Titulo.
- Motivo decorativo "chapa perfurada" (`src/main/pdf/htmlTemplate/perforatedMetal.ts`, novo) - SVG inline gerado localmente (sem imagem remota, sem dependencia de internet), grade de circulos sobre gradiente sutil, usado no canto superior direito do cabecalho institucional.
- Documentacao atualizada para refletir o novo padrao (nenhuma referencia a "paisagem/landscape" como orientacao-alvo permanece): `.claude/skills/formatador-comissao/references/pdf-design.md`, `implementation-plan.md`, `prompts-fases.md`, `docs/Formatador-Comissao-Especificacao.md`, `docs/Formatador-Comissao-Prompts.md`. A entrada historica "A4 paisagem | PASS" na tabela de QA visual da Fase 7 (acima) foi mantida como registro do que era verdade naquela fase e esta agora superada por esta revisao.

### Paginacao multi-pagina (verificada com PDFs reais gerados nesta fase)

| Cenario | Resultado |
|---|---|
| Previsao 3 linhas / 2 vendedores, 1 pagina cada | PASS - "Pagina 1 de 1" em ambos, sem duplicacao |
| Previsao sintetica 130 linhas | PASS - 4 paginas (32+44+44+10), cabecalho institucional completo so na pagina 1, cabecalho de tabela repetido em todas, IDs sequenciais 000200000-000200129 sem lacuna nem duplicata, total R$ 1.300,00 (=130x R$10,00) e assinatura apenas na pagina 4 |
| Relacao sintetica 60 linhas | PASS - 2 paginas (33+27... nota: primeira pagina com cabecalho cheio comporta menos linhas), IDs 000300000-000300059 continuos, total R$ 9.000,00 (=60x R$150,00) |
| Relacao/Previsao 1 linha (fluxo real via UI/watcher) | PASS - gerados por clique real em "Gerar PDFs", nao script sintetico isolado |

### Frontend redesenhado (componentes)

Novo sistema de design em `src/renderer/src/App.css` (tokens de cor/espaco/raio/sombra) consumido por todos os componentes abaixo. Novos componentes compartilhados: `Sidebar.tsx`, `PageHeader.tsx` (voltar por icone com tooltip), `ToastProvider.tsx` (toasts de sucesso/erro), `ConfirmDialogProvider.tsx` (modal de confirmacao substituindo `window.confirm`).

Paginas/telas redesenhadas: `App.tsx` (shell com sidebar fixa), `HomePage.tsx` (hero + cards com icone + documentos recentes reais + status operacional, **sem nenhum numero financeiro inventado**), `ImportPage.tsx` (dropzone, previa em cartoes/tabela, resultado com acoes por icone), `SettingsPage.tsx` (grid de informacao + secao de filiais), `CompanyProfilesSection.tsx` (cartao por filial com logo/badge/nome separados da acao "Trocar logo", campos agrupados em "Identificacao"/"Endereco", **novo affordance "+ Nova filial"** para cadastrar filiais sem seed conhecido), `HistoricoPage.tsx` (toolbar de filtros, cartoes de lote, dialogo de confirmacao real, toasts), `FirstRunPage.tsx` (visual alinhado ao novo sistema). `PlaceholderPage.tsx` (nao usado) foi removido.

### Auditoria de dados cadastrais (CNPJ/razao social/endereco/Tres-S)

Buscado exaustivamente em todo o projeto (skill, docs, assets) - **nenhum CNPJ, razao social ou endereco real foi encontrado para nenhuma filial**, e **nenhum codigo de filial conhecido existe para Tres-S**. Por isso, nenhum dado cadastral real foi preenchido (constraint explicita: nao inventar CNPJ nem buscar na internet). O logo `TRES-S.png` ja esta empacotado e selecionavel via "Trocar logo"; a arquitetura ja suporta multiplas filiais compartilhando um logo (`brandLogos.ts`/`seedCompanyProfiles.ts`, pre-existente); o novo affordance "+ Nova filial" permite cadastrar a filial Tres-S manualmente assim que o codigo for conhecido. Nada foi inventado ou seedado com placeholder persistente.

### Validacao visual real (nao simulada)

Executado via dois scripts temporarios (deletados ao final, junto com seus hooks em `main/index.ts`, seguindo o padrao ja usado nas fases anteriores):
- Um script clicou de fato pela UI real (Electron real, `app.getPath`/`LOCALAPPDATA` isolados em pasta temporaria) - primeiro uso, Previsao (dropzone -> arquivo real solto na pasta Entrada monitorada -> previa -> gerar -> resultado), Relacao (idem), Historico, Home com documentos recentes, Configuracoes (cartao completo e cartao em branco), "+ Nova filial" - 13 capturas de tela reais via `webContents.capturePage()`.
- Um segundo script gerou PDFs sinteticos-mas-validos (nunca dados reais do Protheus) cobrindo 1 pagina e 4/2 paginas para validar paginacao em volume.

### Testes tecnicos

| Comando | Resultado |
|---|---|
| `npm run typecheck` (node + web) | OK - sem erros |
| `npm run lint` | OK - 0 erros, 2 avisos pre-existentes de `react-refresh/only-export-components` (padrao aceitavel para arquivos de contexto+hook) |
| `npm run test` | OK - **115/115** testes, inalterados - confirma que nenhuma regra financeira/contrato/agrupamento foi tocada |
| `npm run build` | OK |

### Pendencias conhecidas

- CNPJ, razao social e endereco continuam em branco para todas as filiais (0103-0106) - nenhum dado real disponivel no projeto para preencher, por desenho.
- Codigo de filial da Tres-S continua desconhecido - filial nao sera cadastrada ate que o codigo real apareca em uma importacao ou seja informado pelo usuario.
- Icone do aplicativo: mantido o `Formatador-Comissao.ico` ja fornecido na Fase 6 (asset proprio, nao generico) - nao foi alterado nesta fase.
### Novo instalador gerado e re-testado

Versao elevada `1.0.0` -> `1.1.0` (build visivelmente diferente - evita sobrescrever silenciosamente o instalador `1.0.0.exe` ja validado na Fase 7, mantendo os dois artefatos rastreaveis lado a lado em `release/`).

`release\Formatador Comissao-Setup-1.1.0.exe` (118.149.390 bytes, ~112,7 MB).

| Verificacao | Resultado |
|---|---|
| `npm run dist` | OK - gerou o instalador sem erros |
| Assinatura de codigo | `Get-AuthenticodeSignature` confirma `NotSigned` - limitacao conhecida inalterada (as linhas "signing with signtool.exe" do electron-builder sao apenas o carimbo de integridade do asar, nao uma assinatura Authenticode real) |
| Instalacao silenciosa (`/S /D=...`) em pasta isolada | OK - exit code 0, todos os arquivos esperados presentes |
| Abrir o app instalado | OK - processo permanece rodando, titulo da janela "Formatador Comissao" |
| Desinstalacao silenciosa (`/S`) | OK - exit code 0, executavel removido |

Smoke test reduzido (nao o roteiro completo de 14 passos da Fase 6/7, ja coberto anteriormente) - suficiente para confirmar que o pacote nao esta corrompido e reflete a nova UI/PDF. Recomenda-se um passe manual completo (import real, geracao, impressao) antes de distribuir para os usuarios finais.

**PARADO conforme instruido - nao prosseguir para a Fase 8 (ou etapa equivalente) sem aprovacao explicita.**

## Atualizacao do contrato de engenharia dos relatorios (v2) (CONCLUIDA)

Fase explicitamente de **contrato/engenharia**, nao visual: revisao dos campos obrigatorios dos dois modos de importacao a partir de 4 arquivos `.xlsx` reais fornecidos pelo usuario (2 reduzidos + 2 "Todos os Campos"), validados localmente e nunca commitados. Nenhuma mudanca de UI/PDF nesta fase.

### O que mudou

- **Relacao de Comissoes**: passa de 15 para **12 campos obrigatorios**. `Tipo de Registro`, `Data do Pgto da Comissao` e `Comissao gerada pela B/E` deixam de ser obrigatorios - continuam sendo lidos e usados (mesmo aviso nao-bloqueante de sempre) quando presentes, mas a ausencia deles nunca bloqueia nem gera aviso.
- **Previsao de Comissoes**: continua com os mesmos **13 campos obrigatorios** (nenhum campo mudou), mas ganhou uma regra nova: o export "Todos os Campos" real do Smart View comprovadamente contem **duas colunas chamadas `Vencimento`**. Duas ou mais colunas `Vencimento` apos normalizacao agora **bloqueiam a importacao** com um erro explicativo orientando o usuario a deixar selecionado apenas o segundo `Vencimento` no Smart View. Uma unica coluna continua sendo aceita normalmente. Esta e a unica excecao documentada a "nunca depender de posicao de coluna" - a posicao e usada somente para detectar e rejeitar a ambiguidade, nunca para escolher um valor silenciosamente.
- Colunas extras (inclusive nomes duplicados em campos nao-obrigatorios, como dois `Nome do cliente` no arquivo real "Todos os Campos - Relacao") continuam nunca bloqueando a importacao.

### Implementacao

- `src/main/reports/relacao/contract.ts` - `RELACAO_FIELDS` reduzido a 12; novo `RELACAO_OPTIONAL_FIELDS` com os 3 campos antigos.
- `src/main/reports/relacao/parser.ts` - resolve os campos obrigatorios via `locateAndMatchHeaders` (bloqueante) e os opcionais via a nova `matchOptionalHeaders` (nunca bloqueante); novo acesso seguro `cellValue()` evita ler `getCell(undefined)` quando a coluna opcional nao existe (bug silencioso que existiria se apenas a lista de campos fosse reduzida sem tocar o parser).
- `src/main/reports/previsao/parser.ts` - nova checagem `countNormalizedHeaderOccurrences(sheet, headerRowNumber, 'vencimento')` logo apos a validacao dos obrigatorios; lanca `AmbiguousHeaderError` quando ha 2+ ocorrencias.
- `src/main/reports/common/contractValidation.ts` - novas funcoes reutilizaveis `matchOptionalHeaders` e `countNormalizedHeaderOccurrences`.
- `src/main/reports/common/errors.ts` - nova `AmbiguousHeaderError` (mode, header, occurrences, mensagem explicativa em portugues).
- `src/shared/types/import.ts` - novo `ImportServiceError` kind `'ambiguousHeader'`.
- `src/main/import/importService.ts` - converte `AmbiguousHeaderError` para o erro estruturado `ambiguousHeader`.
- `src/renderer/src/components/ImportPage.tsx` - novo `case 'ambiguousHeader'` no switch de erros, reaproveitando o `message-banner--error` ja existente (nenhuma mudanca visual nova).

### Validacao com os 4 arquivos reais (local, nao commitado)

| Arquivo real | Resultado |
|---|---|
| `Previsão de comissões(Campos Novos).xlsx` (13 col.) | Importou com sucesso - 165 linhas, 26 grupos |
| `Relação de Comissões(Campos Novos).xlsx` (12 col.) | Importou com sucesso - 1374 linhas, 38 grupos |
| `Todos os Campos - Previsão de comissões.xlsx` (79 col., 2x `Vencimento`) | **Bloqueado corretamente** com `AmbiguousHeaderError` - mensagem: "A coluna \"Vencimento\" aparece 2 vezes no arquivo. No Smart View, deixe selecionado apenas o segundo campo..." |
| `Todos os Campos - Relação de Comissões.xlsx` (35 col., `Nome do cliente` duplicado) | Importou com sucesso - 1374 linhas, 38 grupos (identico ao arquivo reduzido), zero avisos, `Nome do cliente` resolvido corretamente pela primeira ocorrencia |

Script de validacao foi temporario (`manualRealFileCheck.test.ts`) e foi deletado apos a validacao, conforme instruido.

### Testes automatizados (fixtures sinteticas, sem dados reais)

Novos casos cobrindo exatamente o que foi pedido, em `src/main/reports/relacao/parser.test.ts`, `src/main/reports/previsao/parser.test.ts` e `src/main/import/importService.test.ts`:

- Relacao com exatamente os 12 obrigatorios (sem nenhum extra);
- Relacao com os 12 + os 3 antigos como extras;
- Relacao confirmando que a ausencia dos 3 antigos campos nao gera erro nem aviso;
- Relacao ainda bloqueando quando falta um dos 12 obrigatorios;
- Previsao com uma unica coluna Vencimento (sucesso);
- Previsao com duas colunas Vencimento (bloqueio com `AmbiguousHeaderError`, mode/header/occurrences/mensagem conferidos);
- normalizacao de cabecalho com acentos/caixa alta/espacos reais de producao (ambos os modos);
- colunas reordenadas, duplicadas, zero e negativo preservados - todos os testes ja existentes permanecem inalterados e verdes.

### Documentacao atualizada

`SKILL.md`, `references/input-contracts.md` (reescrito para v2, com a secao "Vencimento ambiguity" e "Optional fields"), `references/project-spec.md`, `references/implementation-plan.md`, `references/pdf-design.md`, `docs/Formatador-Comissao-Especificacao.md` (mesmas mudancas espelhadas), mais este arquivo. `references/architecture.md` nao precisou de mudancas (nao lista campos especificos).

Documentada tambem a opcao futura (nao implementada, requer aprovacao explicita) de **PDF consolidado por vendedor** (todas as filiais de um vendedor em um unico PDF, como alternativa ao modo atual por filial) em `references/input-contracts.md` e `references/project-spec.md` - a regra atual de um PDF por par filial+vendedor permanece a unica implementada.

### Testes tecnicos

| Comando | Resultado |
|---|---|
| `npm run typecheck` (node + web) | OK |
| `npm run lint` | OK - 0 erros, 2 avisos pre-existentes inalterados |
| `npm run test` | OK - **124/124** testes (9 novos + 115 anteriores, todos verdes) |
| `npm run build` | OK |

### Pendencias / limitacoes

- `npm run dist` (instalador) nao foi regenerado nesta fase - mudanca e apenas de main process, sem impacto visual; nao ha necessidade de novo instalador so por causa desta fase, mas recomenda-se incluir na proxima geracao de release.
- Nenhuma mudanca de UI/PDF foi feita, conforme instruido explicitamente ("sem mexer ainda no visual final").

**PARADO conforme instruido.**

## Revisão completa de pt-BR, paths visíveis, migração e sidebar fixa (CONCLUÍDA)

Fase de correção ortográfica sistemática (acentuação pt-BR em todo texto visível), renomeação da estrutura física de pastas para nomes acentuados, migração segura de instalações existentes, e correção do layout da sidebar para ficar fixa.

### Nome visível

`APP_NAME` (`src/shared/constants/app.ts`) passa de `'Formatador Comissao'` para **`'Formatador Comissão'`** - usado para título da janela, marca na sidebar, nome sugerido da pasta de relatórios e nome da pasta de dados internos. `productName` e `shortcutName` em `package.json` (instalador NSIS, atalho, nome do `.exe`) tambem atualizados. `appId` (`com.formatadorcomissao.app`), `name` do npm (`formatador-comissao`), os valores internos `ReportMode` (`'Previsao'`/`'Relacao'`) e `ModeSubfolder`, canais IPC e chaves de banco **permanecem ASCII**, conforme instruído.

### Pastas físicas visíveis - nova estrutura com acentos

Nova camada de mapeamento em `src/main/app/folderNames.ts` traduz as chaves internas (ASCII) para o nome físico exibido no Explorer, sem tocar em nenhum tipo/enum/coluna de banco:

- `MODE_FOLDER_NAME`: `Previsao` -> `Previsão`, `Relacao` -> `Relação` (chave interna inalterada).
- `SUBFOLDER_FOLDER_NAME`: apenas `Historico` -> `Histórico` muda; `Entrada`/`Processamento`/`Processados`/`Gerados` já não tinham acento.

Todos os pontos que antes montavam o caminho manualmente (`archivePaths.ts`, `outputPath.ts`, `entradaWatcher.ts`, `importHandlers.ts`, `batchLifecycle.ts`, `importService.ts`, `reportRoot.ts`) foram migrados para usar `resolveModeSubfolderPath`/`resolveEntradaDir`, eliminando toda duplicação de literais de pasta.

Nova estrutura para uma instalação nova:
```
Documentos\Formatador Comissão\Previsão\{Entrada,Processamento,Processados,Gerados,Histórico}
Documentos\Formatador Comissão\Relação\{Entrada,Processamento,Processados,Gerados,Histórico}
%LOCALAPPDATA%\Formatador Comissão\{Formatador Comissão.db,logs,logos}
```

### Migração segura de instalações existentes

Novo módulo `src/main/migration/` (`folderNames.ts` fica em `app/`, mas a lógica de migração vive aqui):

- `migrateFolderSafely.ts` - utilitário genérico de mover-ou-mesclar um arquivo/pasta legado para o novo local: renomeia em um passo quando o destino não existe (mover uma árvore inteira é atômico no mesmo volume); quando o destino já existe, mescla item a item **nunca sobrescrevendo** um nome colidente (mantém o lado novo, preserva o legado intacto, registra aviso); remove diretórios legados que ficam vazios; deixa em paz qualquer conflito não resolvido. Idempotente: uma segunda execução é sempre segura.
- `remapLegacyPath.ts` - funções puras que recalculam um caminho absoluto persistido: `remapPathPrefix` (troca de prefixo simples, usada para `logo_path`) e `remapLegacyReportPath` (troca o segmento do modo e do subdiretório `Historico`, preservando todo o resto do caminho - `Processados`, `Gerados`, `Entrada`, ano/mês/batchId/nome de arquivo). Nunca toca um caminho que não vive sob a raiz sendo migrada (ex.: arquivo fonte externo).
- `migrateLegacyNaming.ts` - orquestração: `migrateLegacyAppData` (pasta interna do app, roda ANTES de abrir o banco), `remapStoredLogoPaths` (corrige `company_profiles.logo_path` após mover a pasta), `migrateLegacyReportRootAndPaths` (renomeia a própria pasta raiz **somente se** seu nome for exatamente o padrão legado `Formatador Comissao`; sempre renomeia `Previsao`/`Relacao`/`Historico` internos; reescreve `batches.source_archived_path` e `documents.pdf_path`).

Chamada em `src/main/index.ts`, incondicional e idempotente a cada início do app - nenhuma flag de "já migrado" é necessária, pois cada passo é um no-op natural quando não há mais nada legado. Uma raiz de relatórios customizada (nome escolhido pelo usuário, diferente do padrão sugerido) tem apenas suas subpastas internas renomeadas; o nome da pasta raiz em si nunca é alterado sem necessidade.

Regras seguidas à risca: nunca sobrescrever arquivo existente; colisão vira aviso, nunca perda; paths persistidos atualizados; watchers/configurações continuam funcionando (usam o `reportRoot` já atualizado); regeneração testada e funcionando; migração idempotente; nenhuma falha no meio do processo pode corromper dados (cada movimentação é isolada e o pior caso é um arquivo/pasta deixado no lugar legado, nunca apagado).

### Validação real da migração (não só testes automatizados)

Além de 35 testes automatizados novos (`migrateFolderSafely.test.ts`, `remapLegacyPath.test.ts`, `migrateLegacyNaming.test.ts` - rename limpo, mesclagem com colisão, idempotência, nunca sobrescreve, raiz customizada vs. padrão, reescrita de `source_archived_path`/`pdf_path`/`logo_path`), foi feita uma **validação real em cópia de dados**: uma instalação legada completa foi construída em disco (pasta `%LOCALAPPDATA%\Formatador Comissao\` real com banco SQLite real via `openDatabase`, `logs/`, `logos/` com um PNG real, e uma raiz de relatórios legada real com PDF/XLSX reais referenciados no banco) e o **app real** (`npx electron out/main/index.js`) foi executado apontando para essa cópia:

| Verificação | Resultado |
|---|---|
| 1ª execução - pasta interna do app | Migrada de `Formatador Comissao\` para `Formatador Comissão\`, incluindo o `.db` renomeado |
| 1ª execução - pasta raiz de relatórios | Renomeada de `...\Formatador Comissao` para `...\Formatador Comissão`; `Previsao`->`Previsão`, `Relacao`->`Relação` |
| 1ª execução - `settings.reportRoot` no banco | Atualizado para o novo caminho |
| 1ª execução - `batches.source_archived_path` | Reescrito para o novo caminho (`Previsão\Processados\...`) |
| 1ª execução - `documents.pdf_path` (Previsao e Relacao) | Reescritos para os novos caminhos (`Previsão\Gerados\...`, `Relação\Gerados\...`) |
| 1ª execução - `company_profiles.logo_path` | Reescrito para a nova pasta de logos |
| 2ª execução (idempotência) | Nenhum aviso, nenhuma mudança, nenhum erro - migração já concluída detectada corretamente como no-op |

Inspecionado diretamente via consulta SQL na base migrada e via `find` no sistema de arquivos - não apenas assumido a partir dos testes unitários.

### Textos visíveis corrigidos (pt-BR)

Revisão sistemática de sidebar, Home, importação/preview, histórico, configurações, modais, toasts, tooltips, mensagens de erro (main e renderer), PDFs (título, cabeçalho, tabela, total, assinatura, cabeçalho/rodapé de impressão) e `index.html`. Novo helper `src/renderer/src/lib/modeLabel.ts` (`modeDisplayLabel`) para exibir "Previsão"/"Relação" (acentuado) em qualquer lugar que antes mostrava a chave interna ASCII diretamente (badge do histórico, mensagem de modo errado, meta de documento recente). `brandLabel.ts`: rótulo da Três-S corrigido. Seed de filiais: "PERMETAL SAO PAULO" -> "PERMETAL SÃO PAULO" (só afeta instalações novas; perfil já existente é dado do usuário e não é sobrescrito). Não foi possível corrigir "Galvanização" (aparece apenas dentro da imagem do logo `METALGRADE.png`, não é texto de código).

### Sidebar fixa

`src/renderer/src/App.css`: `.app-shell` mudou de `min-height: 100vh` (permitia a página inteira crescer e rolar, arrastando a sidebar para fora da tela em listas longas) para **`height: 100vh; overflow: hidden`** - agora a sidebar (Início/Previsão/Relação/Histórico sempre visíveis, Configurações + versão sempre fixos no rodapé via `.sidebar__spacer{flex:1}` já existente) nunca sai da tela; somente `.app-main` rola (`overflow-y: auto`, já existente). `.app-shell--centered`/`.app-shell--error` (telas sem sidebar, ex. primeiro uso) ganharam `overflow-y: auto` próprio para não cortar conteúdo em janelas baixas.

Validado visualmente com captura de tela real: lista de Histórico com 25 documentos, rolada até o fim, com a sidebar completamente fixa (nav + Configurações + versão) tanto em 1440x900 quanto em janela pequena (1000x640).

### Testes técnicos

| Comando | Resultado |
|---|---|
| `npm run typecheck` (node + web) | OK |
| `npm run lint` | OK - 0 erros, 2 avisos pré-existentes inalterados |
| `npm run test` | OK - **159/159** testes (35 novos de migração + 124 anteriores) |
| `npm run build` | OK |

### Pendências / observações

- "Galvanização" não pôde ser corrigido por não ser texto de código (está dentro da imagem `METALGRADE.png`).
- Perfis de filial já seedados em instalações existentes mantêm "PERMETAL SAO PAULO" sem acento (é dado editável do usuário; a migração desta fase corrige apenas nomes de pasta/caminho, nunca conteúdo de cadastro que o usuário pode ter customizado).
- `npm run dist` (instalador) não foi regenerado nesta fase; recomenda-se gerar um novo instalador antes do próximo release para embutir o novo `productName`/`shortcutName` acentuados.

**PARADO conforme instruído.**

## Ajuda integrada nas telas de importação (CONCLUÍDA)

Ícone discreto de informação ao lado do título de Previsão e Relação, abrindo um modal acessível e rolável com a referência completa do relatório Protheus correspondente.

### Implementação

- `src/renderer/src/lib/importHelpContent.ts` - conteúdo estático (sem dependência de rede): relatório, código, caminho no menu, lista exata de colunas obrigatórias (nomes literais do Protheus/Smart View, sem correção de acento - devem casar com o export real), aviso específico da Previsão (ambiguidade do "Vencimento") e notas (campos opcionais da Relação; qual campo o total realmente usa). Espelha `references/input-contracts.md` - comentário no arquivo lembra de manter os dois sincronizados se o contrato mudar de novo.
- `src/renderer/src/components/ImportHelp.tsx` - componente autocontido: ícone `Info` discreto (`aria-label` descritivo, tooltip curto "Ajuda") + modal (`role="dialog"`, `aria-modal`, `aria-labelledby`, foco movido para o diálogo ao abrir, fecha com Esc/clique no overlay/botão Fechar). Corpo rolável (`overflow-y: auto`) com cabeçalho/rodapé fixos. Botão "Copiar lista de campos" usa `navigator.clipboard.writeText` (API local do Chromium, sem internet) e mostra um toast de confirmação.
- Integrado em `ImportPage.tsx` via o slot `actions` já existente de `PageHeader` - `<ImportHelp mode={mode} />` - sem precisar alterar `PageHeader.tsx`.

### Bug encontrado e corrigido durante a validação visual real

Ao abrir o app real (não só os testes) e comparar `.app-main.scrollWidth` entre páginas, a tela de Previsão/Relação (e só ela) apresentava uma barra de rolagem horizontal espúria. Causa: o tooltip do novo ícone (`data-tooltip="Ajuda sobre este relatório"`, texto longo) fica centralizado (`::after` com `transform: translateX(-50%)`) sobre um ícone posicionado na borda direita do cabeçalho (`margin-left: auto`) - mesmo com `opacity: 0`, o pseudo-elemento ainda conta para `scrollWidth`, empurrando o conteúdo além da largura visível. Corrigido de duas formas: (1) o tooltip deste ícone foi encurtado para "Ajuda" (consistente com os demais tooltips curtos do app); (2) regra defensiva nova em `App.css` (`.page-header__actions .icon-btn[data-tooltip]::after`) ancora o tooltip pela direita em vez de centralizar, para qualquer ícone futuro nessa posição. Confirmado via diagnóstico real (`scrollWidth === clientWidth` antes/depois, nas duas telas) e screenshot sem a barra espúria.

### Testes

Nova infraestrutura de teste de componentes React (inexistente até então - só havia testes de main process):

- `vitest.config.ts` - adiciona o plugin `@vitejs/plugin-react` e passa a incluir `*.test.tsx`; ambiente único `jsdom` para toda a suíte (vitest 5 removeu o `environmentMatchGlobs` de configuração única; um ambiente compartilhado é suficiente pois os testes de main process não dependem de globals exclusivos do Node).
- Novas dependências de desenvolvimento: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- `importHelpContent.test.ts` - conteúdo: 12/13 campos exatos e sem duplicatas para cada modo, código/caminho corretos, aviso presente somente na Previsão, notas cobrindo os campos opcionais e a regra do total, formatação da lista para cópia.
- `ImportHelp.test.tsx` - abertura (ícone fechado por padrão, abre ao clicar), fechamento (botão do cabeçalho, botão do rodapé, clique no overlay, tecla Esc - e que clique dentro do conteúdo NÃO fecha por engano), acessibilidade (`role="dialog"`, `aria-modal`, título associado via `aria-labelledby`), conteúdo completo de cada modo (relatório/código/caminho/13 ou 12 campos/aviso do Vencimento apenas na Previsão/notas), e a função de copiar (texto exato copiado para `navigator.clipboard`, toast de confirmação exibido).

| Comando | Resultado |
|---|---|
| `npm run typecheck` (node + web) | OK |
| `npm run lint` | OK - 0 erros, 2 avisos pré-existentes inalterados |
| `npm run test` | OK - **189/189** testes (30 novos: 11 de conteúdo + 19 do modal) |
| `npm run build` | OK |

Validado visualmente no app real (Electron real, clique real): ícone visível e discreto ao lado do título em Previsão e Relação; modal abre com todo o conteúdo correto para cada modo; aviso do Vencimento destacado em amarelo somente na Previsão; lista rolável sem cortar nenhum campo; "Copiar lista de campos" copia e mostra toast; fecha corretamente. Nenhuma barra de rolagem espúria após a correção do tooltip.

### Pendências / observações

- `npm run dist` não foi regenerado (mudança é só de renderer/testes, sem impacto no instalador).

**PARADO conforme instruído.**
