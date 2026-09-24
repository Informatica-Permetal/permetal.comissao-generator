# 05 — Workflow de Release (documentação completa)

> Documento de referência **exaustivo** sobre como o Formatador Comissão é publicado.
> Para a receita rápida do dia a dia, veja [06_RELEASE_EXPRESS.md](06_RELEASE_EXPRESS.md).
> Para diagnóstico de falhas, veja também [07_TROUBLESHOOTING.md](07_TROUBLESHOOTING.md).
>
> Levantado em 2026-09-24 por leitura direta de `.github/workflows/release.yml`,
> `.github/workflows/ci.yml`, `package.json`, `.node-version`, `docs/RELEASE_PROCESS.md`,
> `CHANGELOG.md` e do histórico real de execuções no GitHub (v1.2.1 → v1.2.4).

---

## 0. Resumo em 30 segundos

- **O que publica:** o workflow `Release` (`.github/workflows/release.yml`).
- **O que dispara:** **somente** o `git push` de uma **tag** `vX.Y.Z`. Nada mais (nem push em
  `main`, nem mudança de versão, nem botão manual — não existe `workflow_dispatch`).
- **Onde roda:** GitHub Actions, runner `windows-latest`, Node da versão exata em `.node-version`
  (hoje `24.21.0`).
- **O que faz:** valida a tag contra a versão do `package.json`/`package-lock.json` → `npm ci` →
  lint → typecheck → testes → `npm run dist` (gera o Setup NSIS) → calcula SHA256 → extrai as
  notas do `CHANGELOG.md` → `gh release create` anexando **somente** o `.exe` e o `.sha256`.
- **Credenciais:** apenas o `GITHUB_TOKEN` automático do Actions. **Nenhum secret customizado,
  nenhum PAT.** O `electron-builder` nunca recebe token (roda com `--publish never`).
- **Regra de ouro 1:** a tag só é criada depois que o workflow `CI` estiver **verde** no commit
  exato que será taggeado.
- **Regra de ouro 2 (política do projeto — o GitHub NÃO impede):** tag enviada ao GitHub nunca é
  movida, apagada ou reaproveitada. Se a Release falhar depois do push da tag por algo que exige
  mudança, a tag fica como "tentativa abortada" e a próxima tentativa usa o **próximo patch**
  (foi assim com v1.2.1 e v1.2.2 → publicado como v1.2.3). Exceção: falha transitória sem
  mudança de código → re-run na mesma tag (§11).
- **Regra de ouro 3:** o instalador oficial **nunca** é gerado nem publicado manualmente.

---

## 1. Visão geral do fluxo (ponta a ponta)

```
 Desenvolvedor (local)                         GitHub
 ─────────────────────                         ──────────────────────────────────────────────
 1. código + testes locais
 2. npm version X.Y.Z --no-git-tag-version
 3. CHANGELOG.md: "## X.Y.Z - AAAA-MM-DD"
 4. lint / typecheck / test / build
 5. commit "chore: prepara release X.Y.Z"
 6. git push origin main  ───────────────────▶  workflow "CI" (ci.yml)  — push em main
                                                 checkout → Node → npm ci → lint → typecheck
                                                 → testes → build        (NUNCA publica)
 7. esperar CI VERDE no commit exato  ◀─────────  verde / vermelho
 8. git tag -a vX.Y.Z -m "..."
 9. git push origin vX.Y.Z  ─────────────────▶  workflow "Release" (release.yml) — push de tag
                                                 checkout da tag → Node → validar versões
                                                 → npm ci → lint → typecheck → testes
                                                 → npm run dist (Setup NSIS)
                                                 → localizar .exe → SHA256
                                                 → notas do CHANGELOG
                                                 → gh release create  (GITHUB_TOKEN)
10. validar a Release  ◀────────────────────────  GitHub Release "Formatador Comissao vX.Y.Z"
                                                   assets: Setup .exe + .sha256, marcada Latest
```

---

## 2. Arquivos que compõem o mecanismo

| Arquivo | Papel | Observação |
|---|---|---|
| `.github/workflows/release.yml` | Workflow que gera e publica a Release | Único que tem `contents: write` |
| `.github/workflows/ci.yml` | Gate contínuo em `main`/PRs | `contents: read`, nunca publica |
| `.node-version` | Versão **exata** do Node usada pelos dois workflows | Conteúdo atual: `24.21.0` |
| `package.json` → `version` | Versão do app; tem que bater com a tag | Alterar só via `npm version` |
| `package-lock.json` → `version` e `packages[""].version` | Idem — os **dois** campos são validados | `npm version` sincroniza |
| `package.json` → `scripts.dist` | `npm run build && electron-builder --win --publish never` | O `--publish never` é **obrigatório** |
| `package.json` → `build` | Configuração do electron-builder (NSIS per-user, ícone, artifactName) | Ver §7 |
| `resources/icon.ico` | Ícone do exe/instalador/desinstalador/atalhos/janela | 7 frames 16→256, 32bpp |
| `resources/installer.nsh` | Página customizada do desinstalador (opção de apagar dados) | Incluído via `build.nsis.include` |
| `CHANGELOG.md` | Fonte das notas da Release | Seção `## X.Y.Z` extraída automaticamente |
| `docs/RELEASE_PROCESS.md` | Documento oficial do processo dentro do repo | Tem trechos desatualizados — ver §15 |

---

## 3. Gatilhos (o que dispara e o que NÃO dispara)

### 3.1 `release.yml`

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```

| Pergunta | Resposta |
|---|---|
| Push em `main` dispara? | **Não.** |
| Push em qualquer outra branch dispara? | **Não.** |
| Push de tag dispara? | **Sim**, se o nome casar com o glob `v*.*.*`. |
| Mudar a versão no `package.json` dispara? | **Não.** Só a tag dispara. |
| Existe disparo manual (`workflow_dispatch`, botão "Run workflow")? | **Não.** Não há como iniciar o Release pelo botão. |
| Existe agendamento (`schedule`)? | **Não.** |
| Pull request dispara? | **Não.** |
| "Re-run jobs" na aba Actions funciona? | **Sim**, reexecuta a mesma tag/commit — ver §11. |

**Atenção ao glob vs. validação estrita:** o glob `v*.*.*` aceita coisas como `v1.2.3-beta` ou
`v1.2.3.4` (o `*` casa qualquer sequência sem `/`). Essas tags **disparam** o workflow, mas o
passo "Validar tag" exige a regex estrita `^v(\d+\.\d+\.\d+)$` e **falha** — nenhuma Release é
criada, porém a tag fica consumida. Portanto: **só crie tags no formato exato `vX.Y.Z`.**

**Envie uma tag por vez:** use `git push origin vX.Y.Z`, nunca `git push --tags`. Pela
documentação do GitHub, um push com mais de 3 tags de uma vez não gera eventos de push de tag — o
Release poderia simplesmente não disparar.

**Nada no GitHub obriga o CI verde antes da tag:** o `release.yml` não tem `needs`, não consulta o
`CI` e não verifica se o commit da tag está em `main`. A regra "CI verde antes da tag" é
procedimento — e é ela que evita consumir números de versão à toa.

**Cuidado com a interface web do GitHub:** não crie tags nem Releases pelo site
("Draft a new release" → "Choose a tag" → criar tag). Isso cria a tag no remoto e pode disparar o
workflow, que então tentaria criar uma Release que você já criou manualmente → conflito. O fluxo
oficial é **sempre** tag anotada criada localmente + `git push origin vX.Y.Z`.

### 3.2 `ci.yml`

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

- Roda em **todo** push para `main` e em toda PR contra `main`.
- **Nunca** roda em tags (não há `tags:` no gatilho).
- Serve como gate: o commit que vai receber a tag precisa ter um run `CI` **verde**.

### 3.3 Inatividade longa

O GitHub desabilita automaticamente **apenas workflows agendados (`schedule`)** após 60 dias sem
atividade no repositório. **Os dois workflows deste projeto são disparados por `push`**, então
não são afetados por inatividade — depois de meses parado, o próximo push/tag funciona
normalmente (desde que o Actions continue habilitado no repositório; confira na aba Actions).

---

## 4. Job, runner e ambiente

| Item | `release.yml` | `ci.yml` |
|---|---|---|
| Nome do job | `release` — "Build, testar e publicar release" | `ci` — "Lint, typecheck, testes e build" |
| Runner | `windows-latest` (hospedado pelo GitHub) | `windows-latest` |
| Node | `actions/setup-node@v4` com `node-version-file: '.node-version'` | idem |
| Cache | `cache: 'npm'` — guarda o diretório de cache do npm (`npm config get cache`; no runner Windows `C:\npm\cache`), indexado pelo hash do `package-lock.json` | idem |
| Jobs | 1 único job, sem matriz, sem dependências entre jobs | 1 único job |
| Duração típica | ~3 min (v1.2.3: 2m58s; v1.2.4: 3m09s) | ~1m30s a 3m30s |
| Imagem observada (v1.2.4) | `windows-2025-vs2026` (Windows Server 2025), runner 2.337.0, PowerShell 7 como shell padrão | idem |
| Node/npm efetivos (v1.2.4) | Node 24.21.0 baixado a cada run (a imagem só traz 24.20.0 em cache), npm 11.19.0 | idem |

**Por que o Node é exato:** a v1.2.1 quebrou porque o workflow da época pedia só a major `24` e o
runner usou a `24.20.0` que estava no cache da imagem (bug do libuv). A imagem era a mesma das
versões que depois funcionaram — o problema foi a versão não fixada. Por isso a versão agora é
**exata** e lida de `.node-version`.

**`windows-latest` é um alias móvel**: o GitHub troca a imagem por trás dele ao longo do tempo
(ex.: Windows Server 2022 → 2025), mudando ferramentas pré-instaladas. Por isso o `CI` roda em
todo push: se uma troca de imagem quebrar algo, o `CI` avisa **antes** de você consumir um número
de versão.

---

## 5. Permissões, tokens e secrets

| Item | Valor | Onde |
|---|---|---|
| Permissão padrão do repositório para o `GITHUB_TOKEN` | **read** (Settings → Actions → General) | `gh api repos/.../actions/permissions/workflow` |
| Permissão do `release.yml` | `permissions: contents: write` (nível do workflow) — é o que eleva o token; o log do run mostra `Contents: write / Metadata: read` | `release.yml` linhas 11–12 |
| Permissão do `ci.yml` | `permissions: contents: read` | `ci.yml` linhas 17–18 |
| Token usado para criar a Release | `secrets.GITHUB_TOKEN` (automático, gerado pelo Actions a cada run, expira no fim do job) | passo "Criar GitHub Release", `env: GITHUB_TOKEN` |
| Secrets customizados necessários | **Nenhum** — confirmado: 0 secrets, 0 variables, 0 environments no repositório | `gh secret list`, `gh api .../environments` |
| PAT pessoal | **Nunca** usar | decisão registrada em `docs/RELEASE_PROCESS.md` |
| `GH_TOKEN` para o electron-builder | **Nunca** fornecido — de propósito | `--publish never` no script `dist` |
| Certificado de assinatura de código | **Não existe** — o Setup é **não assinado** | ver §7.4 |

Por que `contents: write` basta: criar uma Release, associá-la à tag existente e fazer upload de
assets são operações do escopo "contents". O bloco `permissions` do workflow concede isso
explicitamente, independentemente da permissão padrão configurada no repositório.

> Os valores reais de secrets nunca aparecem neste documento. Neste projeto, aliás, não há
> secrets de repositório a documentar — o `GITHUB_TOKEN` é injetado automaticamente.

---

## 6. Passo a passo do `release.yml` (o que cada etapa faz, entradas, saídas, falhas)

A ordem abaixo é a ordem real do arquivo. Qualquer passo que falha **interrompe o job**; como a
Release só é criada no último passo, **uma falha em qualquer etapa anterior garante que nenhuma
Release é publicada**.

> **Numeração:** a numeração "Passo N" deste documento **não** coincide com a da aba Actions (lá
> há um passo 1 "Set up job" antes, então é N+1) nem com os comentários `# N.` dentro do
> `release.yml`. Ao diagnosticar, refira-se sempre ao **nome** do passo.

### Passo 1 — `Checkout do codigo na tag` (`actions/checkout@v4`)
- Faz checkout de `GITHUB_SHA`, que num push de tag é o commit apontado pela tag.
- Consequência importante: **o próprio `release.yml` usado é o que existe no commit da tag**, não
  o de `main`. Corrigir o workflow em `main` não conserta uma tag antiga (ver §11).

### Passo 2 — `Configurar Node.js` (`actions/setup-node@v4`)
- Lê `.node-version` (`24.21.0`) e instala exatamente essa versão; ativa cache do npm.
- Por que exata: v1.2.1 falhou com Node 24.20.0 (bug do libuv no watcher de arquivos do Windows,
  `Assertion failed: !_wcsnicmp(filename, dir, dirlen)`, nodejs/node#63638, corrigido em
  nodejs/node#65118 e presente em 24.21.0).

### Passo 3 — `Mostrar versoes do runtime`
- `node --version` e `npm --version` no log. Serve para diagnóstico: o log sempre mostra o
  runtime real.

### Passo 4 — `Validar tag contra package.json e package-lock.json` (PowerShell)
- Extrai a versão da tag com a regex estrita `^v(\d+\.\d+\.\d+)$`. Se não casar → falha.
- Compara a versão da tag com **três** campos do commit taggeado:
  1. `package.json` → `version`
  2. `package-lock.json` → `version`
  3. `package-lock.json` → `packages[""].version` (lido com `ConvertFrom-Json -AsHashtable`,
     **obrigatório**: sem ele o PowerShell 7 recusa o JSON inteiro por causa da chave vazia `""` —
     não "simplifique" esse trecho)
- Se qualquer um divergir → `Write-Error "Divergencia de versao..."` e `exit 1`.
- Saída: variável de ambiente `APP_VERSION=<versão>` (usada nos passos seguintes).
- Por que existe: no passado o `package.json` já foi alterado manualmente sem atualizar o lock.

### Passo 5 — `Instalar dependencias (npm ci)`
- Instalação reprodutível a partir do `package-lock.json`. Falha se o lock estiver fora de
  sincronia com o `package.json`.

### Passos 6, 7, 8 — `Lint`, `Typecheck`, `Testes`
- `npm run lint` (ESLint), `npm run typecheck` (tsc nos dois tsconfig), `npm run test`
  (Vitest, 39 arquivos / 342 testes na v1.2.4).
- São os **mesmos** gates do `CI`. Se o `CI` estava verde no mesmo commit e algo falha aqui, a
  primeira suspeita é instabilidade do runner (ver §11 e 07_TROUBLESHOOTING).

### Passo 9 — `Gerar instalador Windows (npm run dist)`
- `npm run dist` = `npm run build && electron-builder --win --publish never`.
  - `npm run build` = `electron-vite build` → gera `out/main`, `out/preload`, `out/renderer`.
  - `electron-builder --win` → empacota com Electron 44.x, aplica o ícone, gera o NSIS em
    `release/`.
  - `--publish never` → **desliga a publicação implícita** do electron-builder. Sem isso, ao
    detectar tag + CI ele tenta publicar sozinho no GitHub e falha pedindo `GH_TOKEN` (foi o que
    derrubou a v1.2.2: "GitHub Personal Access Token is not set").
- O workflow **não** roda `npm run build` separadamente (o `dist` já inclui), para não compilar
  duas vezes.
- O log mostra `signing with signtool.exe`, mas **não há certificado configurado** — o Setup sai
  **sem assinatura Authenticode** (ver §7.4).

### Passo 10 — `Localizar instalador gerado` (PowerShell)
- Procura em `release/` exatamente **um** arquivo `*-Setup-<APP_VERSION>.exe` (busca por sufixo,
  para não depender do acento/espaço do nome do produto).
- Se encontrar 0 ou mais de 1 → falha.
- Saídas: `INSTALLER_PATH` e `INSTALLER_NAME`.

### Passo 11 — `Gerar SHA256 do instalador` (PowerShell)
- `Get-FileHash -Algorithm SHA256`, hash em minúsculas.
- Escreve `<INSTALLER_PATH>.sha256` com **uma linha**: `<hash><2 espaços><nome original do exe>`,
  UTF-8 sem BOM (formato do `sha256sum`).
- Saída: `SHA256_PATH`.

### Passo 12 — `Extrair notas de release do CHANGELOG.md` (PowerShell)
- Procura a primeira linha que casa `^## <versão>(\s|$)` (ex.: `## 1.2.4 - 2026-09-22`).
- Pega tudo até a próxima linha que começa com `## ` (ou fim do arquivo).
- Remove do final linhas vazias e separadores `---`.
- Grava em `release-notes.md`.
- **Se a seção não existir:** não falha — emite *warning* e usa nota mínima
  ("Formatador Comissao X.Y.Z / Ver CHANGELOG.md ..."). **A Release é publicada mesmo assim**,
  com nota pobre. Por isso escreva o CHANGELOG **antes** do commit de preparação.

### Passo 13 — `Criar GitHub Release` (PowerShell + `gh`)
```powershell
gh release create "<tag>" "<INSTALLER_PATH>" "<SHA256_PATH>" `
  --title "Formatador Comissao <tag>" `
  --notes-file release-notes.md
```
- Autenticado por `GITHUB_TOKEN`.
- Cria a Release na tag que disparou o workflow, publicada (não draft, não prerelease).
- **Latest:** não há flag `--latest`; nesse caso a Release recém-publicada vira Latest (padrão
  da API do GitHub para uma Release nova publicada). Foi assim que v1.2.3 e v1.2.4 viraram Latest.
  Como as versões são lineares, isso é o esperado. Se um dia for publicado um patch de uma linha
  **antiga** (ex.: 1.2.6 depois de 1.3.0), ele também viraria Latest — isso exigiria ajustar o
  workflow (`--latest=false`), decisão do responsável.
- Com assets, o `gh` cria a Release como draft, envia os arquivos e só então publica; se o
  upload ou a publicação falha, ele tenta apagar esse draft sozinho (ver §11.2).
- Anexa **somente** os dois arquivos. Nunca `win-unpacked/`, `builder-debug.yml`, `latest.yml`
  ou `.blockmap` (não há `electron-updater` no projeto; esses arquivos não servem para nada ao
  usuário).

---

## 7. Build, packaging e artefatos

### 7.1 Configuração do electron-builder (`package.json` → `build`)

| Chave | Valor | Pode mudar? |
|---|---|---|
| `appId` | `com.formatadorcomissao.app` | **Não.** Identifica a instalação para upgrade/desinstalação |
| `productName` | `Formatador Comissão` | **Não** sem avaliar impacto (nome do exe, pastas de dados, atalhos) |
| `directories.output` | `release` | — |
| `directories.buildResources` | `resources` | — |
| `files` | `out/**/*`, `package.json` | — |
| `extraResources` | `brand-logos/`, `pdf-motifs/`, `icon.ico` (fora do asar, lidos em runtime) | — |
| `win.target` | `nsis`, `x64` | — |
| `win.icon` | `resources/icon.ico` (também usado como ícone do instalador/desinstalador) | — |
| `win.artifactName` / `nsis.artifactName` | `${productName}-Setup-${version}.${ext}` | **Não** sem ajustar o passo "Localizar instalador gerado" |
| `nsis.oneClick` | `false` (assistente com páginas) | — |
| `nsis.perMachine` / `allowElevation` | `false` / `false` → instalação **por usuário, sem UAC** | **Não** |
| `nsis.allowToChangeInstallationDirectory` | `true` | — |
| `nsis.createDesktopShortcut` / `createStartMenuShortcut` | `true` / `true` | — |
| `nsis.shortcutName` | `Formatador Comissão` | — |
| `nsis.deleteAppDataOnUninstall` | `false` (dados preservados por padrão) | **Não** |
| `nsis.include` | `resources/installer.nsh` | — |

### 7.2 Nome dos artefatos

| Onde | Nome |
|---|---|
| Gerado no runner (`release/`) | `Formatador Comissão-Setup-X.Y.Z.exe` e `Formatador Comissão-Setup-X.Y.Z.exe.sha256` |
| **Publicado na Release** (GitHub sanitiza nomes de assets: espaço → `.`, `ã` → `a`) | `Formatador.Comissao-Setup-X.Y.Z.exe` e `Formatador.Comissao-Setup-X.Y.Z.exe.sha256` |
| Conteúdo do `.sha256` | `<hash>  Formatador Comissão-Setup-X.Y.Z.exe` (nome **original**, com acento e espaço) |

**Consequência prática:** `sha256sum -c` sobre os arquivos baixados **não funciona** direto, porque
o nome dentro do `.sha256` difere do nome do asset baixado. Valide comparando os hashes (ver §10).
O `.sha256` é uma linha UTF-8 sem BOM terminada em CRLF (escrita com `Set-Content` no Windows):
64 caracteres de hash + 2 espaços + nome original do exe. Na v1.2.4 tem 104 bytes (o tamanho varia
com o número da versão).

O GitHub também calcula um `digest` SHA256 de cada asset (com prefixo `sha256:`), consultável
pela API sem baixar o Setup — ver §10. Na v1.2.4 ele confere com o hash do passo "Gerar SHA256"
(`f3fac05f…27464`).

Tamanho típico do Setup: ~114 MB (119.384.087 bytes na v1.2.4).

### 7.3 Onde os artefatos são publicados

- **Somente** como assets da **GitHub Release** da tag
  (`https://github.com/Informatica-Permetal/permetal.comissao-generator/releases`).
- O workflow **não** usa `actions/upload-artifact` — não há "artifacts" do run na aba Actions. Se o
  job falhar depois do `dist`, o Setup gerado se perde junto com o runner (por design: nada que não
  passou por todos os gates pode ser publicado).
- O GitHub também anexa automaticamente "Source code (zip)" e "Source code (tar.gz)" — isso é
  padrão do GitHub e esperado.

### 7.4 Assinatura de código (SmartScreen)

- O Setup e o exe **não são assinados** (`Get-AuthenticodeSignature` → `NotSigned`).
- Efeito: o Windows pode mostrar "O Windows protegeu o computador" / "Editor desconhecido". O
  usuário clica em "Mais informações" → "Executar assim mesmo". Isso **não** é falha do release.
- Adicionar assinatura exigiria um certificado + secrets novos → **decisão do responsável**
  (não fazer por conta própria).

---

## 8. Versionamento e tags

### 8.1 Esquema de versão
- `MAJOR.MINOR.PATCH` (SemVer). Histórico: 1.0.0 → 1.1.0 → 1.2.0 → (1.2.1, 1.2.2 abortadas) →
  1.2.3 → 1.2.4.
- Convenção prática observada: PATCH para ajustes visuais/correções/infra; MINOR para
  funcionalidades novas (ex.: consolidado por vendedor entrou na 1.1.0).

### 8.2 Como alterar a versão (sempre assim)
```powershell
npm version X.Y.Z --no-git-tag-version
```
- Atualiza `package.json.version`, `package-lock.json.version` e
  `package-lock.json.packages[""].version` de uma vez.
- `--no-git-tag-version` impede o npm de criar commit/tag sozinho (a tag é criada à mão, depois
  do CI verde).
- **Nunca** edite a versão à mão no `package.json`.

### 8.3 Tags
- Sempre **anotadas**: `git tag -a vX.Y.Z -m "Formatador Comissao vX.Y.Z"` (padrão das tags
  v1.2.3/v1.2.4, sem acento).
- Aponta para o **HEAD de `main` cujo `CI` está verde** e que contém a preparação X.Y.Z —
  normalmente o próprio commit `chore: prepara release X.Y.Z`; se foi preciso um commit de
  correção depois dele, a tag vai nesse novo HEAD verde. Nunca num commit com CI vermelho.
- Formato estrito `vX.Y.Z`.

### 8.4 Imutabilidade (política adotada)
- **Tag enviada ao remoto nunca é movida, apagada, recriada nem reaproveitada.**
- Se a Release falhar depois do push da tag: a tag vira "tentativa abortada", o problema é
  corrigido em `main`, o `CI` fica verde, e publica-se o **próximo patch**.
- Tags abortadas existentes: `v1.2.1` (→ `6b8c567`) e `v1.2.2` (→ `e84b149`). Não têm Release e
  não devem ter.
- **Como publicar o próximo patch depois de uma tag abortada** (exatamente como foi feito em
  1.2.1 → 1.2.2 → 1.2.3):
  1. corrigir em `main` (commit + push, `CI` verde; se a correção é de empacotamento, testar
     também `npm run dist` localmente, só como teste);
  2. `npm version X.Y.(Z+1) --no-git-tag-version`;
  3. no `CHANGELOG.md`, **renomear** o cabeçalho `## X.Y.Z - ...` para `## X.Y.(Z+1) - <data>`
     (o conteúdo nunca foi publicado; **não** criar uma seção nova acima — o workflow só extrai até
     o próximo `## `, e o conteúdo da X.Y.Z sumiria das notas) e acrescentar a nota técnica
     `_Nota técnica: a versão X.Y.Z teve sua publicação interrompida pelo pipeline antes da geração
     de qualquer Release; a publicação oficial dessas melhorias ocorre na X.Y.(Z+1)._`;
  4. commit `chore: prepara release X.Y.(Z+1)`, `CI` verde, nova tag.
- Tag criada **só localmente** (nunca enviada) não conta como consumida: pode ser apagada com
  `git tag -d` se `git ls-remote --tags origin` não a mostrar.
- Tag com **nome malformado** (ex.: `v1.2.5-beta`) consome só aquele nome: se `package.json` já
  está em 1.2.5 e `v1.2.5` não existe, pode-se criar `v1.2.5` no mesmo commit verde.
- Motivo: tag é referência pública; mover tag faz dois commits diferentes terem o "mesmo" nome,
  quebra rastreabilidade e caches/clones de terceiros.

### 8.5 Estado atual das versões (2026-09-24)

| Tag | Commit | Release? | Origem |
|---|---|---|---|
| v1.0.0 | `1bfa052` | Sim | Instalador manual (antes do workflow) |
| v1.1.0 | `a7cac0d` | Sim | Instalador manual |
| v1.2.0 | `fa79661` | Sim | Instalador manual |
| v1.2.1 | `6b8c567` | **Não** (abortada: bug libuv/Node 24.20.0) | Workflow |
| v1.2.2 | `e84b149` | **Não** (abortada: publicação implícita do electron-builder) | Workflow |
| v1.2.3 | `45595d7` | Sim | Workflow (1ª Release automática) |
| **v1.2.4** | `76bce1c` | **Sim — Latest** | Workflow |

**Próxima versão disponível:** `1.2.5` (patch) ou `1.3.0` (minor). Antes de escolher, rode
`git tag -l` e `gh release list` — o número escolhido **não pode** já existir como tag.

---

## 9. Como criar uma nova versão (procedimento completo)

> Versão curta: [06_RELEASE_EXPRESS.md](06_RELEASE_EXPRESS.md).

1. **Pré-voo** (principalmente após meses parado):
   ```powershell
   cd C:\dev\permetal.comissao-generator
   git status                      # limpo, exceto "?? _project_migration/" se esta pasta estiver
                                   # no repo sem commit — NUNCA rode git clean para "limpar"
   git switch main
   git pull --ff-only origin main
   node --version                  # deve ser igual a: Get-Content .node-version
   gh auth status                  # logado em github.com
   npm ci
   ```
2. Implementar/homologar a mudança (DEV com `npm run dev`; empacotado com `npm run pack` e depois
   `npm run pack:run`). Se a mudança mexe em **empacotamento** (bloco `build` do `package.json`,
   `resources/icon.ico`, `resources/installer.nsh`, scripts `pack`/`dist`, versão do
   electron-builder/Electron), o `CI` não testa isso: rode também `npm run dist` localmente
   **só como teste** (nunca publique o resultado) e confira que `release\` tem 1
   `*-Setup-<versão>.exe`.
3. Commitar a mudança funcional e fazer `git push origin main`. Esperar o `CI` verde.
4. Escolher a versão: `git tag -l "v*"` e `gh release list` para ver o que já existe.
5. `npm version X.Y.Z --no-git-tag-version` e conferir:
   ```powershell
   git diff -- package.json package-lock.json   # só as linhas de version devem mudar
   ```
6. Adicionar no **topo** do `CHANGELOG.md` (abaixo do título), sem apagar seções publicadas:
   ```markdown
   ## X.Y.Z - AAAA-MM-DD

   ### <Seção>

   - Item focado no usuário.

   ---
   ```
7. Gates locais (PowerShell 7): `npm run lint && npm run typecheck && npm run test && npm run build`
   (**não** `npm run dist`). Use `&&`, não `;` — com `;` um erro do lint passa despercebido
   no meio da saída longa dos testes.
8. Stage controlado (evite `git add .`):
   ```powershell
   git add CHANGELOG.md package.json package-lock.json
   git status
   git commit -m "chore: prepara release X.Y.Z"
   git push origin main
   ```
9. Esperar o `CI` **verde** nesse commit exato (filtrar pelo commit evita pegar o run anterior,
   que já está verde, logo após o push):
   ```powershell
   $run = gh run list --workflow=ci.yml --commit (git rev-parse HEAD) --json databaseId --jq '.[0].databaseId'
   if (-not $run) { "ainda nao apareceu - espere e repita" } else { gh run watch $run --exit-status }
   ```
10. Checagens pré-tag (o push da tag é irreversível; o `CI` não confere versão nem CHANGELOG):
    ```powershell
    $v = "X.Y.Z"
    $pkg  = (Get-Content package.json -Raw | ConvertFrom-Json).version
    $lock = Get-Content package-lock.json -Raw | ConvertFrom-Json -AsHashtable
    "$pkg / $($lock['version']) / $($lock['packages']['']['version'])"      # os 3 = X.Y.Z
    (Select-String -Path CHANGELOG.md -Pattern "^## $([regex]::Escape($v))(\s|$)").Line   # '## X.Y.Z - ...'
    git rev-parse HEAD; git rev-parse origin/main                            # iguais (= commit do CI verde)
    git ls-remote --tags origin | Select-String "v$v"                        # vazio
    gh release view "v$v"                                                    # "release not found"
    ```
    Se algo não bater, **não crie a tag**.
11. Tag anotada + push:
    ```powershell
    git tag -a vX.Y.Z -m "Formatador Comissao vX.Y.Z"
    git log -1 --format='%H %s' vX.Y.Z                     # = HEAD verde ("chore: prepara release X.Y.Z")
    git push origin vX.Y.Z
    ```
12. Acompanhar (filtrar pela tag garante que é o run DESTA versão):
    ```powershell
    $run = gh run list --workflow=release.yml --branch "vX.Y.Z" --json databaseId --jq '.[0].databaseId'
    if (-not $run) { "ainda nao apareceu - espere e repita" } else { gh run watch $run --exit-status }
    ```
13. Validar a Release (§10).

---

## 10. Como validar a Release

Checklist:

- [ ] Run do `Release` concluído com sucesso (todos os passos verdes).
- [ ] `gh release view vX.Y.Z` → título `Formatador Comissao vX.Y.Z`, não draft, não prerelease.
- [ ] `gh release list` → `vX.Y.Z` com `Latest`.
- [ ] Exatamente 2 assets próprios: `Formatador.Comissao-Setup-X.Y.Z.exe` e `.exe.sha256`.
- [ ] Notas da Release = seção `## X.Y.Z` do CHANGELOG (e não a nota mínima de fallback).
- [ ] Hash do `.exe` baixado = hash do `.sha256`.
- [ ] Tags antigas intactas (v1.2.1/v1.2.2 continuam sem Release).

Comandos (PowerShell, dentro da pasta do projeto):

```powershell
$v = "X.Y.Z"
gh release view "v$v" --json name,tagName,isDraft,isPrerelease,publishedAt,assets
gh release list

gh release view "v$v" --json name,body --jq '.name, (.body | split("\n")[0])'
#   deve imprimir "Formatador Comissao vX.Y.Z" e "## X.Y.Z - AAAA-MM-DD"

# Validação completa (baixa o Setup; falha de forma explícita se algo der errado)
$dir = Join-Path $env:TEMP "fc-verify-$v"
gh release download "v$v" --dir $dir --clobber
if ($LASTEXITCODE -ne 0) { throw "download falhou - a Release existe/terminou?" }
$exe = @(Get-ChildItem $dir -Filter "*-Setup-$v.exe" -ErrorAction Stop)
if ($exe.Count -ne 1) { throw "esperado 1 instalador, achei $($exe.Count)" }
$line = (Get-Content "$($exe[0].FullName).sha256" -Raw -ErrorAction Stop).Trim()
if ($line -notmatch '^([0-9a-fA-F]{64})\s') { throw "conteudo inesperado: '$line'" }
$exp = $Matches[1].ToLower()
$act = (Get-FileHash $exe[0].FullName -Algorithm SHA256).Hash.ToLower()
"esperado: $exp"; "obtido:   $act"; "confere:  $($exp -eq $act)"
Remove-Item $dir -Recurse -Force
```

Validação rápida sem baixar o Setup (compara o `digest` que o GitHub calculou para o `.exe`
armazenado com o hash escrito no `.sha256`; prova a integridade do asset guardado, não de um
download seu):

```powershell
$v = "X.Y.Z"
$dir = Join-Path $env:TEMP "fc-sha-$v"
gh release download "v$v" --pattern "*.sha256" --dir $dir --clobber
if ($LASTEXITCODE -ne 0) { throw "download do .sha256 falhou" }
$line = (Get-Content (Get-ChildItem $dir -Filter "*.sha256")[0].FullName -Raw).Trim()
$exp  = ($line -split '\s+')[0].ToLower()
$dig  = (gh api "repos/Informatica-Permetal/permetal.comissao-generator/releases/tags/v$v" --jq '.assets[] | select(.name | endswith(".exe")) | .digest') -replace '^sha256:',''
"sha256 file: $exp"; "digest api:  $dig"; "confere:     $($exp -eq $dig)"
Remove-Item $dir -Recurse -Force
```

Teste funcional opcional (recomendado em versões com mudança relevante): instalar o Setup baixado
numa máquina/usuário de teste e verificar instalação sem UAC, atalhos, abertura do app, upgrade
sobre a versão anterior e desinstalação preservando dados.

---

## 11. Como repetir uma execução

### 11.1 "Re-run failed jobs" (aba Actions → run → botão Re-run)
- Reexecuta **o mesmo commit da tag** e **o mesmo `release.yml` daquele commit**.
- Use **somente** quando a falha foi **transitória** e **nada no código precisa mudar**, por
  exemplo: falha de rede no `npm ci` ou no download do Electron/NSIS, runner instável, teste que
  passa no `CI` do mesmo commit mas falhou por lentidão do runner.
- Via CLI: `gh run rerun <run-id> --failed`.
- O GitHub só permite re-run por um período limitado após o run original (cerca de 30 dias).
- Re-run **não** consome nova versão e **não** move tag — é seguro dentro dessas condições.

### 11.2 Quando re-run NÃO resolve
- Qualquer correção de código, de `package.json`, de `.node-version` ou do próprio `release.yml`:
  o re-run continuaria usando os arquivos do commit antigo da tag. É preciso **nova versão**
  (próximo patch) com nova tag no commit corrigido.
- Se já existe uma Release **publicada** para a tag (criada à mão, ou o run já tinha concluído
  com sucesso e alguém rodou "Re-run all jobs"), o passo `Criar GitHub Release` falha com
  `a release with the same tag name already exists`. Inspecione a Release antes de qualquer ação
  (§12).
- Falha **durante o upload/publicação**: o `gh` cria a Release como draft, sobe os assets e só
  então publica; se algo falha, ele tenta apagar o draft sozinho (o log mostra
  `cleaning up draft failed` se nem isso deu certo). Drafts não disparam o erro "already exists",
  então, sem Release publicada, o re-run (`--failed`) é o caminho. Só um draft órfão (limpeza
  falhou ou job cancelado) precisa ser removido depois — decisão do responsável.

### 11.3 Retenção dos logs
Os logs de runs ficam disponíveis por **90 dias** (configuração do repositório). Depois disso não
é mais possível consultar por que um run antigo falhou — por isso as assinaturas das falhas
históricas estão transcritas no §13 e em 07_TROUBLESHOOTING.

### 11.4 Não existe disparo manual
Não há `workflow_dispatch`. Não é possível "rodar o Release de novo para a versão X" a partir de
`main`. O único gatilho é push de tag nova.

---

## 12. Rollback / contingência

**Princípio:** preferir **seguir em frente** (roll-forward) com um novo patch. Nunca reescrever
histórico de `main` (sem `push --force`), nunca mover/apagar tags.

| Situação | Ação recomendada | Precisa de autorização do responsável? |
|---|---|---|
| Release publicada com bug | Corrigir em `main` (ou `git revert <commit>`), CI verde, publicar próximo patch | Não (fluxo normal) |
| Quer que usuários voltem a baixar a versão anterior enquanto corrige | `gh release edit v<anterior> --latest` (ou marcar a ruim como prerelease: `gh release edit v<ruim> --prerelease`) | **Sim** — altera conteúdo público |
| Notas da Release saíram erradas (ex.: fallback) | `gh release edit vX.Y.Z --notes-file <arquivo>` | **Sim** |
| Draft órfão ficou após falha no último passo (raro: o `gh` normalmente apaga sozinho) | Inspecionar; decidir se remove o draft (não apaga a tag); em geral re-run do job resolve | **Sim** — ação destrutiva |
| Usuário final precisa voltar de versão | Baixar o Setup da Release anterior; desinstalar a atual (dados são preservados por padrão — checkbox desmarcada) e instalar a anterior | Avaliar compatibilidade do banco (ver nota) |

Depois de qualquer `gh release edit ... --latest` / `--prerelease`, confirme com
`gh release list` qual Release ficou como Latest.

**Nota sobre downgrade do usuário final:** a partir da **1.1.0** os dados de produção ficam em
`%LOCALAPPDATA%\Formatador Comissão` (banco SQLite `Formatador Comissão.db`); a 1.0.0 usava
`%LOCALAPPDATA%\Formatador Comissao` (sem acento) e a 1.1.0 migrou automaticamente — **não faça
downgrade para 1.0.0** (ela não encontraria os dados migrados). O esquema do banco é versionado por
`PRAGMA user_version` + array `MIGRATIONS` em `src/main/storage/database.ts`; hoje está em v4
desde antes da 1.1.0, então entre 1.1.0 e 1.2.4 não há diferença de esquema. Se uma versão futura
acrescentar migração, a anterior pode não entender o banco: faça backup da pasta antes de qualquer
downgrade.

---

## 13. Como diagnosticar uma falha

```powershell
gh run list --workflow=release.yml --limit 5
gh run view <run-id>                 # mostra qual passo falhou
gh run view <run-id> --log-failed    # só o log dos passos que falharam
gh run view <run-id> --log > release-log.txt   # log completo para busca
```

Tabela de sintomas → causa → correção: ver [07_TROUBLESHOOTING.md](07_TROUBLESHOOTING.md).
Resumo das falhas históricas reais:

| Versão | Passo que falhou | Assinatura no log | Causa | Correção aplicada |
|---|---|---|---|---|
| v1.2.1 | Testes | `Assertion failed: !_wcsnicmp(filename, dir, dirlen)` (processo de teste derrubado, em `entradaWatcher.test.ts`) | Node 24.20.0 do runner + bug do libuv com caminhos 8.3 (`RUNNER~1`) | `.node-version` = `24.21.0` + `node-version-file` nos 2 workflows |
| v1.2.2 | Gerar instalador | `Implicit publishing triggered by git tag` → `GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"` | electron-builder tentou publicar sozinho | `--publish never` nos scripts `dist` e `pack` |
| (CI de `main`, entre v1.2.2 e v1.2.3) | Testes | `Test timed out in 5000ms` em `seedCompanyProfiles.test.ts` | fsync do SQLite lento no disco do runner | `src/main/storage/testDatabase.ts` (`openTestDatabase`, PRAGMAs relaxados só em teste) |

---

## 14. Manutenção preventiva (antes que vire falha)

| Item | Situação atual | Quando agir |
|---|---|---|
| `actions/checkout@v4`, `actions/setup-node@v4` | Os runs já mostram o aviso "Node.js 20 is deprecated ... forced to run on Node.js 24" | Quando o GitHub remover o suporte, atualizar para a major seguinte (ex.: `@v5`) numa mudança só de CI, validada pelo `CI` antes de qualquer tag |
| `.node-version` (`24.21.0`) | Fixo de propósito | Ao atualizar: mudar só esse arquivo, push, CI verde; nunca junto com uma tag |
| `windows-latest` | Alias móvel | Se o CI quebrar sem mudança de código, suspeitar da imagem; pode-se fixar `windows-2022`/`windows-2025` como correção de CI |
| electron-builder v27 | Removerá a publicação implícita por padrão | O `--publish never` continua correto; manter |
| `CI` não roda `npm run dist` / `pack` | Erros de empacotamento (NSIS/`installer.nsh`, ícone, configuração do electron-builder) só aparecem no push da tag. (A falha da v1.2.2 **não** seria pega por isso: a publicação implícita só acontece com tag presente — e hoje está bloqueada pelo `--publish never`.) | Enquanto não houver passo de empacotamento no CI: testar `npm run dist` local em mudanças de empacotamento. Melhoria possível (decisão do responsável): passo `npm run pack` no `ci.yml` |
| Assinatura de código | Não existe | Decisão de negócio (custo do certificado) |

---

## 15. Divergências conhecidas na documentação existente (não corrigidas nesta auditoria)

1. `docs/RELEASE_PROCESS.md`, passo 8: diz para **apagar a tag remota e recriá-la** após falha.
   Isso **contradiz** a política adotada (tag imutável, próximo patch), registrada na seção
   "Tentativas abortadas" do mesmo arquivo e aplicada em v1.2.1/v1.2.2. **Vale a política de
   imutabilidade.**
2. `docs/RELEASE_PROCESS.md`, seção "Tentativas abortadas": termina com "A próxima publicação
   oficial é a v1.2.3" — desatualizado (v1.2.3 e v1.2.4 já publicadas).
3. `docs/RELEASE_PROCESS.md`, passo 5: usa `git add .` — prefira stage controlado dos arquivos.
4. `docs/RELEASE_PROCESS.md`, passo 6: mensagem de tag com acento ("Comissão"); as tags reais
   v1.2.3/v1.2.4 usam "Formatador Comissao vX.Y.Z" (sem acento). Ambos funcionam; mantenha o padrão
   sem acento por consistência.
5. `release.yml`, comentário da linha ~95: cita `"dist": "npm run build && electron-builder --win"`
   sem o `--publish never` (o script real tem). Só o comentário está velho; o comportamento está
   correto.
6. `docs/RELEASE_PROCESS.md`, seção "Build vs. publicação": diz que o `dist` "assina" o Setup —
   não há assinatura Authenticode (o Setup sai `NotSigned`) — e descreve o script como
   `electron-vite build && ...` quando é `npm run build && ...`.

A lista completa de dívidas de documentação (incluindo a skill e o `IMPLEMENTATION_STATUS.md`)
está em [08_ESTADO_ATUAL.md](08_ESTADO_ATUAL.md) §6. Sugestão: corrigir em commits separados —
`docs:` para `docs/`, skill e `IMPLEMENTATION_STATUS.md`; `ci:` para o comentário do
`release.yml` (arquivo de workflow; o push exige credencial com escopo `workflow`). Ambos disparam
só o `CI`.
