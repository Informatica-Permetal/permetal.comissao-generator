# 08 — Estado atual (fotografia de 2026-09-24)

> Confirme sempre o estado real antes de agir: `git status`, `git log --oneline -5`,
> `gh release list`, `gh run list --limit 5`.

## 1. Onde o projeto está

| Item | Estado |
|---|---|
| Versão publicada (Latest) | **v1.2.4** (2026-09-22), tag → `76bce1c` |
| `main` | `76bce1c chore: prepara release 1.2.4`, igual a `origin/main` |
| Último CI de `main` | verde (run `35728126606`) |
| Último Release | verde (run `35728307275`, 3m09s) |
| Working tree | limpo, exceto a pasta **não versionada** `_project_migration/` (esta documentação) |
| Branches extras / stash / PRs | nenhum |
| `package.json` version | `1.2.4` |
| Próximo número livre | `1.2.5` (patch) ou `1.3.0` (minor) |

## 2. Última funcionalidade entregue

- **1.2.4:** novo ícone oficial do app (`resources/icon.ico`, 7 frames 16/24/32/48/64/128/256,
  32bpp com alpha, arte original centralizada em canvas quadrado com margem de 10%). Aplicado ao
  exe, janela, barra de tarefas, instalador, desinstalador e atalhos (tudo sai do mesmo arquivo).
- **1.2.3:** refinamento do cabeçalho do PDF, hierarquia de "Consolidado por vendedor", blocos de
  filial integrados, bordas corrigidas, botão "Aplicar a todos"; pipeline estabilizado.

## 3. Alterações em andamento

Nenhuma alteração de código pendente. O app instalado **neste notebook** está na versão
**1.2.0** (em `%LOCALAPPDATA%\Programs\formatador-comissao`) — mais antigo que a Latest; após a
formatação, instale a 1.2.4 pela GitHub Release.

## 4. Riscos e problemas conhecidos

### 4.1 Confirmados
| # | Item | Impacto | Onde |
|---|---|---|---|
| 1 | Instalador sem assinatura de código | aviso do SmartScreen | decisão de negócio (certificado) |
| 2 | `actions/checkout@v4` e `actions/setup-node@v4` rodam sobre Node 20 (depreciado; hoje forçado para Node 24) | pode quebrar quando o GitHub remover o suporte | `.github/workflows/*.yml` |
| 3 | O `CI` não roda `npm run dist`/`pack` | erro de empacotamento (NSIS, ícone, config do electron-builder) só aparece no push da tag; até existir esse passo no CI, testar `npm run dist` local em mudanças de empacotamento | `ci.yml` |
| 4 | `main` e tags sem proteção no GitHub | regras dependem de disciplina | configurações do repo |
| 5 | Logs do Actions expiram em 90 dias | evidência das falhas antigas some ~20/12/2026 (trechos copiados em 05/07) | GitHub |
| 6 | `npm ci` reporta 2 vulnerabilidades moderadas (advisory de `uuid` via `exceljs`) | caminho vulnerável é só de escrita de xlsx, que o app não usa | decisão registrada no `IMPLEMENTATION_STATUS.md` — não usar `audit fix --force` |
| 7 | ~97 arquivos fora do padrão Prettier; formatação não é checada no CI | `npm run format` geraria diff enorme | — |
| 8 | `externalizeDepsPlugin` marcado como deprecated no electron-vite 5 | ainda funciona | `electron.vite.config.ts` |
| 9 | Documentação interna desatualizada (ver §6) | pode confundir um mantenedor novo | `docs/`, skill, `IMPLEMENTATION_STATUS.md` |
| 10 | Logos `METALGRADE.png` e `MGZINC.png` no compartilhamento de rede têm tamanho diferente dos versionados em `resources/brand-logos/` (versões da rede são de 16/09/2026) | pode haver revisão de logo não incorporada | decidir com o responsável |

### 4.2 Observações da leitura de código (NÃO confirmadas em execução — investigar antes de agir)
| # | Observação | Onde |
|---|---|---|
| A | **Electron 44.3.0 embute Node 24.20.0**, a mesma versão do bug do libuv (watcher de arquivos no Windows) que derrubou os testes da v1.2.1. O `.node-version` corrigiu os **testes/CI**, mas o watcher da pasta `Entrada` do **app empacotado** roda no Node do Electron. O bug depende de divergência entre caminho curto (8.3) e longo; não se sabe se ocorre em máquinas de usuário. Mitigação futura: atualizar o Electron para uma versão que embuta Node ≥ 24.21.0. | `src/main/import/entradaWatcher.ts`, `package.json` (electron) |
| B | Não há trava de instância única (`requestSingleInstanceLock`); duas instâncias podem rodar com watchers duplicados | `src/main/index.ts` |
| C | "Data de Geração" (com hora) é formatada em UTC: a **hora impressa no PDF fica sempre +3h** em relação a Brasília; além disso, a data no nome do PDF, as pastas `AAAA/MM` e o nome do log viram o dia seguinte para gerações após 21h | `generateReportPdfs.ts` (`formatGeneratedAtLabel`), `outputPath.ts`, `archivePaths.ts`, `logger.ts` |
| D | Rótulo de marca das filiais Três-S (0503/0504) pode resolver vazio: seed grava `TRES_S.png`, `brandLabel.ts` procura `TRES-S` | `src/main/companies/brandLabel.ts`, `seedCompanyProfiles.ts` |
| E | Prévias abandonadas e prévias rejeitadas (modo errado, cabeçalho faltando) deixam `Processamento\<batchId>\` órfão. **Atenção:** em falha de **geração** a cópia é mantida de propósito para diagnóstico — esse caso não deve ser "limpo" | `importService.ts`, `batchLifecycle.ts` |
| F | Janela utilitária única para PDF/impressão, mas o lock é por modo — geração simultânea de Previsão e Relação poderia disputar a janela | `utilityWindow.ts`, `modeLock.ts` |
| G | Filial **inativa** conta como "cadastrada" na verificação de bloqueio | `branchConfiguration.ts` |
| H | Evento da pasta `Entrada` só é tratado se a tela do modo correspondente estiver aberta (sem buffer) | `importHandlers.ts`, `ImportPage.tsx` |
| I | `pdf:open`, `pdf:open-folder`, `pdf:print` aceitam qualquer caminho vindo do renderer (sem validação no main) | `src/main/ipc/pdfHandlers.ts` |

Qualquer correção de A–I mexe em código de produção → tratar como tarefa própria, com testes e
homologação, e **confirmar com o responsável** quando alterar comportamento visível.

## 5. Backlog (herdado do `IMPLEMENTATION_STATUS.md` e da especificação)

**TODO/FIXME no código:** busca por `TODO`, `FIXME`, `HACK`, `XXX` em `src/`, `scripts/`,
`resources/`, `.github/` e configs (excluindo `node_modules`, `out`, `release`) **não encontrou
nenhum marcador real** — só falsos positivos (ex.: "regenera **todo** o lote" num teste,
placeholders `XXXX` em Markdown). O backlog vive nas seções "Pendências" do
`IMPLEMENTATION_STATUS.md`, resumidas abaixo. Há 3 supressões `eslint-disable-next-line
react-hooks/exhaustive-deps` (`ImportPage.tsx` 2×, `HistoricoPage.tsx` 1×), intencionais.

1. Teste manual humano do desinstalador (checkbox + 2 diálogos) — nunca clicado interativamente.
2. Regeneração e exclusão pela UI do Histórico em homologação humana (cobertas só por testes).
3. Impressão física (escala de cinza) nunca testada em impressora real.
4. Passada manual completa com dados reais antes de distribuição ampla.
5. Certificado de assinatura de código.
6. Suporte arm64 (hoje só x64).
7. "Gerar novamente com outro agrupamento" (separado ↔ consolidado) — não existe.
8. UI de CRUD de grupos corporativos (hoje só seed).
9. Itens "futuros" da especificação: multi-seleção e limpeza por idade no Histórico; rótulos de
   assinatura configuráveis; trio Bruta/IRRF/Líquida; snapshots imutáveis de template.
10. Se houver auto-update no futuro: publicar `latest.yml`/`.blockmap` (rever workflow).
11. Revisitar advisory `uuid`/exceljs se o app passar a escrever xlsx.

## 6. Dívidas de documentação (sem impacto em código)

| Documento | Problema |
|---|---|
| `docs/RELEASE_PROCESS.md` passo 8 | manda apagar/recriar tag após falha — contradiz a política adotada (tag imutável, próximo patch) |
| `docs/RELEASE_PROCESS.md` "Tentativas abortadas" | diz que a próxima é a v1.2.3 (já publicada) |
| `docs/RELEASE_PROCESS.md` passo 5 | `git add .` (preferir stage controlado) |
| `docs/RELEASE_PROCESS.md` passo 6 | mensagem da tag com acento; o padrão das tags automáticas é `Formatador Comissao vX.Y.Z` |
| `docs/RELEASE_PROCESS.md` "Build vs. publicação" | descreve o `dist` como `electron-vite build && ...` (é `npm run build && ...`) e diz que "assina" |
| `.github/workflows/release.yml` ~linha 95 | comentário cita o script `dist` antigo (sem `--publish never`) |
| `IMPLEMENTATION_STATUS.md` | parou na 1.2.0 |
| `SKILL.md` regras 7 e 9 | "Never mix branches in the same PDF" / total por vendedor+filial — o consolidado por vendedor (com total geral) já existe (1.1.0) |
| `SKILL.md` regra 1 | escreve "Formatador Comissao" sem acento (arquivo ASCII); o nome real é "Formatador Comissão" — não "corrigir" o código |
| `SKILL.md` lista de filiais | lista 4; hoje são 7 |
| `references/project-spec.md`, `input-contracts.md`, `docs/Formatador-Comissao-Especificacao.md` | ainda dizem que o consolidado "not implemented" |
| Raiz do repo | não há `README.md` nem `CLAUDE.md` |
| `.gitignore` | não ignora `*.xlsx`/`*.pdf` (proteção contra commit de dados reais é só disciplina) |

## 7. Próximo passo recomendado

1. **Antes de formatar:** executar o checklist de backup de [09_POS_FORMATACAO.md](09_POS_FORMATACAO.md)
   (dados de produção, planilhas de exemplo, esta pasta).
2. **Depois de formatar:** reconstruir o ambiente e rodar a validação completa do 09.
3. **Primeira tarefa sugerida no ambiente novo** (baixo risco, só dispara o `CI`): um commit
   `docs:` corrigindo as divergências da §6 em `docs/`, skill e `IMPLEMENTATION_STATUS.md`.
   O comentário velho do `release.yml` vai num commit **`ci:`** separado (é arquivo de
   workflow; o push exige credencial com escopo `workflow` — o Git Credential Manager já pede;
   se usar o `gh` como credencial: `gh auth refresh -s workflow`). Opcionalmente, um
   `CLAUDE.md` curto apontando para a skill — e para `_project_migration/` **só se** essa pasta
   for commitada (senão a referência fica quebrada para outros clones). Isso também prova que
   push + CI funcionam na máquina nova **sem consumir número de versão**.
4. Manutenção preventiva do pipeline (tarefa `ci:` separada, validada pelo `CI` antes de qualquer
   tag): subir `actions/checkout`/`actions/setup-node` para a major com Node 24.
5. Avaliar o risco 4.2-A (Electron com Node 24.20.0) na próxima atualização de dependências.
