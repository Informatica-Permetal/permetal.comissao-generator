# 00 — LEIA PRIMEIRO

Documentação de continuidade do **Formatador Comissão**, gerada em **2026-09-24** por auditoria
somente leitura do repositório, do histórico Git, do GitHub (configurações, Releases e logs de
execução) e do ambiente do notebook, antes da formatação da máquina.

## Em uma frase

App desktop Windows que transforma as planilhas de comissão do Protheus Smart View em PDFs por
vendedor/filial **sem calcular nada** — e cujas versões são publicadas **automaticamente pelo
GitHub Actions** quando uma tag `vX.Y.Z` é enviada.

## Por onde começar

| Situação | Leia |
|---|---|
| Vou formatar o notebook agora | [09_POS_FORMATACAO.md](09_POS_FORMATACAO.md) — Parte A (backup) |
| Acabei de formatar | [09_POS_FORMATACAO.md](09_POS_FORMATACAO.md) — Parte B, depois [03_AMBIENTE_LOCAL.md](03_AMBIENTE_LOCAL.md) |
| Quero publicar uma versão (dia a dia) | [06_RELEASE_EXPRESS.md](06_RELEASE_EXPRESS.md) |
| Quero entender o mecanismo de release a fundo | [05_RELEASE_WORKFLOW.md](05_RELEASE_WORKFLOW.md) |
| Alguma coisa falhou | [07_TROUBLESHOOTING.md](07_TROUBLESHOOTING.md) |
| Vou mexer no código | [02_ARQUITETURA.md](02_ARQUITETURA.md) + skill `.claude/skills/formatador-comissao/` |
| Preciso lembrar o que é o projeto e por quê | [01_CONTEXTO.md](01_CONTEXTO.md) |
| Git, tags, configurações do GitHub | [04_GIT_GITHUB.md](04_GIT_GITHUB.md) (contas locais: [03_AMBIENTE_LOCAL.md](03_AMBIENTE_LOCAL.md) §3) |
| O que está pendente / riscos / próximo passo | [08_ESTADO_ATUAL.md](08_ESTADO_ATUAL.md) |
| Vou usar um Claude novo | [PROMPT_MESTRE_POS_FORMATACAO.md](PROMPT_MESTRE_POS_FORMATACAO.md) |

## As 12 regras que não podem ser esquecidas

1. O app **não calcula comissão** — só soma o campo que o Protheus já calculou (`decimal.js`).
2. Nunca remover, deduplicar ou "corrigir" linhas do Protheus.
3. Release **só** pelo GitHub Actions, disparada por `git push origin vX.Y.Z`.
4. **Nunca** `npm run dist` local para publicar; nunca upload manual; nunca Release pelo site.
5. Versão sempre via `npm version X.Y.Z --no-git-tag-version` (sincroniza os 3 campos que o
   workflow valida).
6. Seção `## X.Y.Z - AAAA-MM-DD` no topo do `CHANGELOG.md` antes do commit de preparação (vira a
   nota da Release).
7. Tag **só** depois do workflow `CI` verde no commit exato.
8. **Tag enviada nunca é movida nem apagada** (política; o GitHub não impede). Falhou depois do
   push por algo que exige mudança? Corrige em `main` e publica o **próximo patch** (v1.2.1 e
   v1.2.2 ficaram como tentativas abortadas). Exceção: falha transitória (rede/runner) sem nenhuma
   mudança → `gh run rerun <id> --failed` na mesma tag (05 §11).
9. Node local = `.node-version` (**24.21.0**).
10. `npm run pack:run` só **executa** o empacotado em HOMOLOGATION — rode `npm run pack` antes.
    Nunca abra `release\win-unpacked\*.exe` direto (seria PRODUCTION).
11. Nenhum secret é necessário. Nunca dar token ao electron-builder (`--publish never` fica).
12. Repositório **público**: nunca commitar planilhas reais, PDFs gerados ou credenciais.

## Estado em 2026-09-24

- **Latest: v1.2.4** (novo ícone). `main` = `76bce1c`, CI e Release verdes.
- Próxima versão livre: **1.2.5** (patch) ou **1.3.0** (minor).
- Nenhuma alteração de código pendente.
- **Esta pasta `_project_migration/` NÃO está no Git** — copie para o backup (e decida se commita;
  ver 09 §A.4).

## Veredito da auditoria

Com **Windows novo + projeto clonado do GitHub + acesso de escrita ao repositório**, é possível
desenvolver e publicar uma nova release corretamente: todo o build, testes, empacotamento, SHA256
e publicação rodam no GitHub Actions a partir do que está versionado, sem secrets. O que só existe
neste notebook e **precisa de backup antes de formatar**: dados de produção do app, planilhas de
exemplo do Smart View (Downloads) e esta pasta. Detalhes e checklist em
[09_POS_FORMATACAO.md](09_POS_FORMATACAO.md).

## Como esta documentação foi verificada

Fatos extraídos de: `.github/workflows/*.yml`, `package.json`, `package-lock.json`,
`.node-version`, `docs/RELEASE_PROCESS.md`, `CHANGELOG.md`, `IMPLEMENTATION_STATUS.md`, código em
`src/`, `git log`/`git tag`, `gh api` (configurações do repositório, secrets — só nomes —,
proteções, Releases, runs) e logs reais dos runs de Release v1.2.1, v1.2.2 (falhas) e v1.2.4
(sucesso). Itens não confirmados em execução estão marcados como tal (08 §4.2).
