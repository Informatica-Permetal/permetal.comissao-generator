# PROMPT MESTRE — contextualizar um Claude novo

> Copie **tudo** entre as linhas `=====` e cole como primeira mensagem numa sessão nova do Claude
> Code aberta em `C:\dev\permetal.comissao-generator`. No final, escreva o que você quer fazer.

=====

Você vai trabalhar no projeto **Formatador Comissão**, repositório
`https://github.com/Informatica-Permetal/permetal.comissao-generator` (público), clonado em
`C:\dev\permetal.comissao-generator`, num Windows. Responda sempre em **português**.

## Antes de qualquer coisa

1. Carregue a skill do projeto **`formatador-comissao`** (`.claude/skills/formatador-comissao/SKILL.md`).
   Ela contém as regras de negócio inegociáveis. Atenção a trechos desatualizados dela:
   - o PDF **consolidado por vendedor** (várias filiais do mesmo vendedor num PDF, com subtotal
     por filial e **total geral**) **existe desde a 1.1.0** e é permitido quando o usuário
     escolhe — as regras da skill que dizem "nunca misturar filiais" / "nunca um total único entre
     filiais" referem-se ao modo separado;
   - o nome real do produto é **"Formatador Comissão"** (com ã); a skill escreve sem acento só por
     ser um arquivo ASCII — **nunca** "corrija" o nome no código, pastas ou `productName`;
   - hoje há **7 filiais** no seed (a skill lista 4).
2. Leia `_project_migration/00_LEIA_PRIMEIRO.md` e, conforme a tarefa, os demais arquivos dessa
   pasta (05 e 06 para releases; 02 para arquitetura; 07 para falhas). Essa pasta **não está no
   Git**: se ela não existir no clone, **pare** e peça ao responsável para restaurá-la do backup
   (não a recrie nem a commite sem autorização).
3. **Não confie cegamente nesta mensagem nem nos documentos**: confirme o estado real com
   `git status`, `git log --oneline -10`, `git tag -l "v*"`, `gh release list`,
   `gh run list --limit 5`, `Get-Content .node-version`, `node --version`. Se
   `node --version` for diferente de `.node-version`, avise e não trate os gates locais como
   válidos até alinhar (`_project_migration/03_AMBIENTE_LOCAL.md` §2).

## O que é o sistema

App desktop Windows (Electron 44 + React 19 + TypeScript + electron-vite; SQLite via `node:sqlite`;
exceljs; decimal.js; chokidar) que importa planilhas `.xlsx` do **TOTVS Protheus Smart View**
(modos **Previsão** — `FINSV047` — e **Relação** — `FATSV019`) e gera PDFs por vendedor + filial
(ou consolidado por vendedor). Instalador NSIS per-user sem admin, sem auto-update, sem
assinatura de código.

## Regras de negócio que você NUNCA quebra

- O app **não calcula comissão**. A única aritmética permitida é **somar** o campo já calculado
  pelo Protheus (`Comissão total (líquido)` na Previsão; `Valor da Comissão` na Relação), com
  `decimal.js`.
- Nunca remover, deduplicar, mesclar ou "corrigir" linhas; nunca decidir direito à comissão por
  datas/status; zeros e negativos são válidos.
- Colunas por **nome** normalizado, nunca por posição. Preservar zeros à esquerda.
- Offline, sem telemetria, dados no perfil do usuário, sem exigir admin.
- Nunca commitar planilhas reais, PDFs gerados ou dados de clientes (o repositório é **público**).

## Ambientes de execução

- `npm run dev` → perfil **DEV** (`%LOCALAPPDATA%\Formatador Comissão Dev`).
- `npm run pack` e depois `npm run pack:run` → perfil **HOMOLOGATION** (`...\Formatador Comissão Homologação`).
  `pack:run` **não** empacota, só executa.
- App instalado → **PRODUCTION** (`%LOCALAPPDATA%\Formatador Comissão` + `Documentos\Formatador Comissão`).
- **Nunca** execute `release\win-unpacked\Formatador Comissão.exe` direto (abriria em PRODUCTION).
- Não altere caminhos de PRODUCTION, `appId`, `productName`, `artifactName`, configuração per-user
  do NSIS nem `deleteAppDataOnUninstall: false` sem decisão explícita do responsável.

## Gates obrigatórios após qualquer mudança

```
npm run lint        (0 erros; 2 warnings react-refresh conhecidos)
npm run typecheck
npm run test        (Vitest; testes com banco usam openTestDatabase de src/main/storage/testDatabase.ts)
npm run build
```
Não rode `npm run format` (reformataria ~97 arquivos). Não rode `npm audit fix --force`.

## Como uma Release é publicada (mecanismo automático)

- `.github/workflows/ci.yml`: roda em push/PR para `main` (lint, typecheck, test, build). Nunca publica.
- `.github/workflows/release.yml`: roda **somente** no `git push` de uma tag. Não existe
  `workflow_dispatch`. O gatilho é o glob `v*.*.*`: qualquer tag parecida (ex.: `v1.2.5-rc1`)
  também dispara, falha na validação e **queima o número** — nunca crie tags de teste.
  Faz: checkout da tag → Node de `.node-version` (24.21.0) → valida que a tag
  = `package.json.version` = `package-lock.json.version` = `package-lock.json.packages[""].version`
  → `npm ci` → lint → typecheck → test → `npm run dist` (`electron-builder --win --publish never`)
  → localiza `release/*-Setup-X.Y.Z.exe` → SHA256 → notas da seção `## X.Y.Z` do `CHANGELOG.md`
  → `gh release create` com o `GITHUB_TOKEN` automático, anexando **só** o `.exe` e o `.sha256`.
- Não há secrets no repositório e não são necessários. Nunca crie PAT/`GH_TOKEN` para o
  electron-builder.

Procedimento (detalhe em `_project_migration/06_RELEASE_EXPRESS.md`):
1. mudança commitada em `main` com `CI` verde;
2. `npm version X.Y.Z --no-git-tag-version` + nova seção `## X.Y.Z - AAAA-MM-DD` no topo do
   `CHANGELOG.md` (sem apagar seções publicadas);
3. gates locais; commit `chore: prepara release X.Y.Z` (só `package.json`, `package-lock.json`,
   `CHANGELOG.md`); `git push origin main`;
4. **esperar o `CI` verde nesse commit exato**;
5. `git tag -a vX.Y.Z -m "Formatador Comissao vX.Y.Z"`; conferir que aponta para esse commit;
   `git push origin vX.Y.Z` (uma tag por vez);
6. acompanhar o `Release` do run **desta** tag (`gh run list --workflow=release.yml --branch vX.Y.Z`,
   depois `gh run watch <id> --exit-status`, ~3 min);
7. validar: Latest, não draft, não prerelease, exatamente 2 assets, hash do `.exe` = conteúdo do
   `.sha256` (compare o hash; `sha256sum -c` não funciona porque o GitHub renomeia o asset para
   `Formatador.Comissao-Setup-X.Y.Z.exe`).

## Proibições do processo de release

- Nunca `npm run dist` local para publicar; nunca subir `.exe` à mão; nunca criar Release/tag pelo
  site.
- **Tag enviada ao GitHub nunca é movida, apagada, recriada ou reaproveitada** (política do
  projeto; o GitHub não impede). Se a Release falhar após o push da tag por algo que exige
  mudança, corrija em `main`, espere `CI` verde e publique o **próximo patch** (foi assim:
  v1.2.1 e v1.2.2 abortadas → v1.2.3): `npm version X.Y.(Z+1) --no-git-tag-version` e
  **renomeie** o cabeçalho `## X.Y.Z` do CHANGELOG para `## X.Y.(Z+1)` (não crie seção nova
  acima), com uma nota técnica curta.
- Mudanças de empacotamento (bloco `build` do `package.json`, ícone, `installer.nsh`,
  electron-builder) não são testadas pelo `CI`: rode `npm run dist` localmente **só como
  teste** antes de preparar a release.
- Só use "Re-run failed jobs" / `gh run rerun <id> --failed` para falha **transitória** (rede,
  runner) sem nenhuma mudança de código — o re-run usa o commit e o `release.yml` da tag.
- Nunca `git push --force` em `main`; nunca desabilitar gates, pular testes, usar
  `continue-on-error` ou aumentar timeout global para "passar".

## Estado conhecido (2026-09-24 — confirme)

- Latest: **v1.2.4** (novo ícone). `main` = `76bce1c`. Próximo número livre: 1.2.5 / 1.3.0.
- Tags abortadas sem Release: v1.2.1, v1.2.2 (manter assim).
- `docs/RELEASE_PROCESS.md` tem um passo 8 que manda apagar/recriar tag — **ignore**, vale a regra
  de imutabilidade acima.
- Riscos/pendências listados em `_project_migration/08_ESTADO_ATUAL.md` (ex.: Electron 44.3.0 embute
  Node 24.20.0; `actions/*@v4` em Node 20 depreciado; CI não roda `dist`).

## Quando parar e perguntar ao responsável

**Sempre**, antes de qualquer `git push` (em `main` ou de tag) e, obrigatoriamente, antes de
criar/enviar uma tag `vX.Y.Z`: mostre o commit, a versão, o resultado do `CI` e as checagens
pré-tag, e espere um OK explícito. O push de uma tag publica uma Release pública (ou queima o
número se falhar) e não pode ser desfeito.

Antes de: mudar regra financeira/cálculo/agrupamento; alterar comportamento funcional visível;
mexer em dados ou caminhos de produção; mudança incompatível de banco; mudança de segurança;
precisar de secret/credencial nova; apagar/mover tag; publicar/editar Release manualmente;
qualquer ação destrutiva. Falhas comuns de CI/build/teste você pode investigar e corrigir
(com causa raiz, sem atalhos).

## Estilo de trabalho esperado

Audite antes de alterar; mudanças mínimas e justificadas; commits Conventional Commits em
português sem acento (`feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `test:`); stage controlado (nada
de `git add .`); não commitar sem eu pedir; relatório final consolidado com o que mudou, gates e
`git status`.

Minha tarefa agora: <DESCREVA AQUI>

=====
