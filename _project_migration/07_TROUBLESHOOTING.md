# 07 — Troubleshooting

> Primeiro comando em qualquer falha do GitHub Actions:
> ```powershell
> gh run list --limit 5
> gh run view <run-id> --log-failed
> ```
> Regra de decisão central: **se a tag já foi enviada ao GitHub, ela não é tocada.** Ou é falha
> transitória (re-run), ou é correção em `main` + **próximo patch**.
>
> **Atenção:** `docs/RELEASE_PROCESS.md` (dentro do repo), passo 8, manda apagar e recriar a tag
> após falha. Isso está **desatualizado** e contradiz a política adotada — ignore esse passo
> (ver 05 §15).

---

## 1. Árvore de decisão rápida

```
Criei a tag mas ainda NÃO dei push (ou o push falhou)?
 └─ git ls-remote --tags origin | Select-String vX.Y.Z  vazio?
      → tag só local: git tag -d vX.Y.Z é seguro. Corrija e recrie. Nada consumido.
        (Se o push falhou por credencial/rede, apenas repita o push.)

Dei push da tag e NENHUM run de Release apareceu (gh run list --workflow=release.yml --branch vX.Y.Z vazio)?
 ├─ A tag está no remoto?  git ls-remote --tags origin | Select-String vX.Y.Z
 │     não → git push origin vX.Y.Z   (uma tag por vez; "git push origin main" NÃO envia tags)
 ├─ O nome casa com o gatilho 'v*.*.*'?  (ex.: "1.2.5" ou "v1.2" não disparam)
 ├─ Enviou mais de 3 tags de uma vez?  (o GitHub não gera evento — envie uma por vez)
 └─ Actions está habilitado? (aba Actions do repo)
    Não apague/mova a tag. Uma tag que nunca disparou run não foi "consumida" por falha,
    mas também não pode ser reaproveitada movendo-a.

Falhou o CI de main (antes de qualquer tag)?
 └─ Nenhuma versão consumida. Intermitente → gh run rerun <id-do-CI> --failed.
    Real → corrigir, commit, push, esperar verde. A tag vai no novo HEAD verde.

Falhou o Release (depois do push da tag)?
 ├─ Falhou em "Validar tag"?
 │    ├─ "nao segue o padrao estrito vX.Y.Z" (nome malformado, ex. v1.2.5-beta):
 │    │     deixe a tag malformada como está; se package.json já está em X.Y.Z e a tag vX.Y.Z
 │    │     não existe, crie vX.Y.Z no MESMO commit verde (não é mover nem reaproveitar tag).
 │    └─ "Divergencia de versao": a versão no commit está errada → tag consumida.
 │          npm version <próximo> --no-git-tag-version, CHANGELOG, commit, CI verde, nova tag.
 ├─ O CI do MESMO commit estava verde E o erro parece rede/runner/timeout?
 │     → gh run rerun <id> --failed   (não consome versão; só até ~30 dias após o run)
 └─ Precisa mudar código, package.json, .node-version ou o release.yml?
       → corrigir em main → CI verde
         → se a correção é de EMPACOTAMENTO (package.json build, installer.nsh, scripts
           dist/pack, artifactName, ícone): rode também "npm run dist" LOCAL (só teste) e
           confira que release\ tem exatamente 1 "*-Setup-<versão>.exe" — o CI não testa isso
         → próximo patch (npm version + RENOMEAR a seção do CHANGELOG, ver 06 "Se falhar")
         → nova tag. A tag que falhou fica como "tentativa abortada".
```

---

## 2. Falhas por passo do `release.yml`

(Os passos são citados pelo **nome** que aparece na aba Actions — a numeração da UI, a dos
comentários do `release.yml` e a do documento 05 não coincidem.)

| Passo | Sintoma no log | Causa provável | O que fazer |
|---|---|---|---|
| Checkout do codigo na tag | erro de clone/timeout | instabilidade do GitHub | re-run |
| Configurar Node.js | "Unable to find Node version" / erro lendo `.node-version` | arquivo inválido ou versão inexistente | corrigir `.node-version` em `main`, CI verde, próximo patch |
| Validar tag... | `Tag '...' nao segue o padrao estrito vX.Y.Z` | tag com sufixo (`-beta`) ou 4 números | ver árvore §1 (criar `vX.Y.Z` correta no mesmo commit, se ainda não existir) |
| Validar tag... | `Divergencia de versao: tag pede 'X' mas diverge de: ...` | esqueceu `npm version`, editou `package.json` à mão, ou taggeou o commit errado | tag consumida; `npm version <próximo> --no-git-tag-version`, commit, CI, nova tag |
| Instalar dependencias (npm ci) | `npm ci can only install packages when your package.json and package-lock.json ... are in sync` | lock desatualizado | `npm install` local, commitar o lock, CI verde, próximo patch |
| Instalar dependencias (npm ci) | `ETIMEDOUT`, `ECONNRESET`, 5xx do registry | rede | re-run |
| Lint / Typecheck | erros de ESLint/TS | código | não deveria ocorrer com CI verde no mesmo commit — confira se taggeou o commit certo: `gh run list --workflow=ci.yml --commit (git rev-list -n1 vX.Y.Z)` |
| Testes | `Test timed out in 5000ms` | runner lento (histórico: SQLite com fsync) | se o CI do mesmo commit passou: re-run. Se repetir: investigar o teste (§3.3); nunca aumentar timeout global às cegas |
| Testes | `Assertion failed: !_wcsnicmp(filename, dir, dirlen)` e o processo cai | bug do libuv no Node do runner (histórico v1.2.1) | conferir a versão impressa em "Mostrar versoes do runtime"; ajustar `.node-version` |
| Gerar instalador Windows (npm run dist) | `Implicit publishing triggered by git tag` / `GitHub Personal Access Token is not set` | alguém removeu `--publish never` do `dist` | recolocar `--publish never` (nunca fornecer token); testar `npm run dist` local antes da nova tag |
| Gerar instalador Windows (npm run dist) | falha baixando Electron/NSIS/winCodeSign | rede | re-run |
| Gerar instalador Windows (npm run dist) | erro do `makensis` citando `installer.nsh` | edição quebrada no script NSIS | corrigir; testar com `npm run dist` **local só para teste** (sem publicar) antes da nova tag |
| Localizar instalador gerado | `Esperado exatamente 1 instalador ... encontrado 0` | `artifactName` alterado (sem `-Setup-${version}`) ou versão do artefato diferente da do `package.json` (a busca é por sufixo, então mudar `productName` sozinho não causa isso) | restaurar `artifactName` ou ajustar o passo "Localizar instalador gerado" do `release.yml`; testar com `npm run dist` local |
| Extrair notas de release do CHANGELOG.md | *warning* `Secao '## X.Y.Z' nao encontrada` (não falha) | CHANGELOG sem a seção ou cabeçalho em outro formato | a Release sai com nota mínima; corrigir depois com `gh release edit vX.Y.Z --notes-file ...` (**pedir autorização**, é conteúdo público). Prevenção: checagem do 06 §5 |
| Criar GitHub Release | `HTTP 403: Resource not accessible by integration` | bloco `permissions: contents: write` removido/alterado no `release.yml` (o padrão do repositório é **somente leitura** — confirmado; o repo é de conta pessoal, não há política de organização) | restaurar o bloco no `release.yml` (via `main` + próximo patch). **Não** alterar "Workflow permissions" em Settings → Actions (configuração de segurança — decisão do responsável) |
| Criar GitHub Release | `a release with the same tag name already exists` | já existe Release **publicada** para a tag (criada à mão pelo site/`gh`, ou re-run de um run que já tinha concluído com sucesso). Drafts não disparam este erro | inspecionar a Release existente (`gh release view vX.Y.Z`) antes de agir; decisão do responsável |
| Criar GitHub Release | falha no upload do asset / na publicação | rede | o `gh` cria a Release como draft, sobe os assets e só então publica; se o upload ou a publicação falha, ele **apaga o draft sozinho**. Confira `gh release list` (não deve haver Release publicada da tag) e procure no log por `cleaning up draft failed`. Sem Release publicada → `gh run rerun <id> --failed`. Só se sobrar um draft órfão (limpeza falhou ou job cancelado), avise o responsável para removê-lo depois |

---

## 3. Casos reais já vividos (assinaturas para reconhecer)

Os logs originais expiram após 90 dias (retenção do repositório); os trechos abaixo foram
copiados em 2026-09-24.

### 3.1 v1.2.1 — libuv / Node 24.20.0
- Passo: **Testes** (`entradaWatcher.test.ts`, que usa `chokidar` com watcher real).
- Log (run `35601362290`):
  ```
  Assertion failed: !_wcsnicmp(filename, dir, dirlen), file src\win\fs-event.c, line 72
  Error: [vitest-pool]: Worker forks emitted error.
  Caused by: Error: Worker exited unexpectedly with exit code 3221226505 ... entradaWatcher.test.ts
   Test Files  38 passed (39)
        Tests  339 passed (342)
  ```
  `3221226505` = `0xC0000409` (processo abortado). O log do `setup-node` mostrava
  `node: v24.20.0` (na época o workflow pedia só a major `24`, e o runner usou a 24.20.0 do cache
  da imagem).
- Causa: runner reportando o diretório temporário em formato curto 8.3 (`C:\Users\RUNNER~1\...`)
  enquanto o watcher usa o caminho longo; bug conhecido do libuv (nodejs/node#63638), corrigido
  em nodejs/node#65118, presente a partir do Node 24.21.0.
- Correção: arquivo `.node-version` com `24.21.0` e `node-version-file` nos dois workflows.
  Nenhum código do app foi alterado.

### 3.2 v1.2.2 — publicação implícita do electron-builder
- Passo: **Gerar instalador Windows (npm run dist)** (run `35603973138`).
- Log:
  ```
  • Implicit publishing triggered by git tag. This behavior will be disabled in electron-builder v27. Please use --publish explicitly.  tag=v1.2.2
  • building        target=nsis file=release\Formatador Comissão-Setup-1.2.2.exe archs=x64 oneClick=false perMachine=false
  ⨯ GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"
  ```
- Causa: electron-builder 26.x detecta tag + CI e tenta publicar sozinho. O `CI` de `main` estava
  verde no mesmo commit — só acontece com tag presente.
- Correção: `--publish never` nos scripts `dist` e `pack` do `package.json`. O token **não** foi
  fornecido de propósito — a Release é responsabilidade exclusiva do `gh release create`.

### 3.3 CI de `main` — timeout do SQLite
- Passo: **Testes** (`seedCompanyProfiles.test.ts`, "semeia as 7 filiais..."), run `35605735534`.
- Log: `Error: Test timed out in 5000ms.` (1 failed / 341 passed; execução real ~6,4 s; arquivo
  inteiro 11,3 s).
- Causa: `node:sqlite` abre com `synchronous=FULL` e `journal_mode=DELETE` (fsync real a cada
  commit) — correto em produção, lento no disco dos runners Windows.
- Correção: `src/main/storage/testDatabase.ts` → `openTestDatabase()` abre o banco como a
  produção e depois aplica `PRAGMA synchronous = OFF` e `PRAGMA journal_mode = MEMORY`, **só em
  testes** (15 arquivos de teste migrados). O arquivo passou de 11,3 s para 1,7 s.
  `database.ts` (produção) não foi alterado.
- Lição: **não aumentar timeout global**; achar a causa. Todo teste novo que abre banco deve usar
  `openTestDatabase`, nunca `openDatabase` direto.

---

## 4. Problemas no ambiente local

| Sintoma | Causa | Solução |
|---|---|---|
| `npm run pack:run` → `Pasta empacotada nao encontrada` | `pack:run` **não** empacota; só executa | rode `npm run pack` antes |
| `npm run pack:run` → `Executavel esperado nao encontrado` | `productName` mudou ou `win-unpacked` antigo | `npm run pack` de novo |
| App empacotado abriu com dados de produção | executou `release\win-unpacked\Formatador Comissão.exe` direto (sem a variável = PRODUCTION) | **Prevenção:** nunca abrir direto; usar `npm run pack:run`. **Se já aconteceu:** feche o app; faça backup de `%LOCALAPPDATA%\Formatador Comissão` e de `Documentos\Formatador Comissão`; verifique se algum arquivo da `Entrada` foi processado/movido; se o build aberto era mais novo que o instalado, verifique se ele aplicou migração de esquema (`MIGRATIONS` em `src/main/storage/database.ts`) antes de voltar ao app instalado |
| Erro `Valor invalido para FC_EXECUTION_PROFILE` | variável com valor diferente de `HOMOLOGATION` num build empacotado | remover a variável ou usar `HOMOLOGATION` |
| Ícone antigo no Explorer/atalho | cache de ícones do Windows | o binário está certo se `npm run pack` passou; `ie4uinit.exe -show` ou reiniciar o Explorer |
| Testes com `Assertion failed ... _wcsnicmp` localmente | Node local diferente de `.node-version` | instalar exatamente a versão de `.node-version` |
| `gh: command not found` no Git Bash | PATH do Git Bash sem o GitHub CLI | `export PATH="$PATH:/c/Program Files/GitHub CLI"` ou usar PowerShell |
| `gh` pede login | máquina nova | `gh auth login` (GitHub.com, HTTPS, navegador) |
| `git push` pede credencial | máquina nova | Git Credential Manager (vem com Git for Windows) abre o navegador; ou `gh auth setup-git` |
| Push recusado ao alterar `.github/workflows/*` | token sem escopo `workflow` | `gh auth refresh -s workflow` (se o push usa credencial do `gh`) |
| Avisos `LF will be replaced by CRLF` | `core.autocrlf` do Git for Windows | inofensivo |
| `&&` dá erro de sintaxe | Windows PowerShell 5.1 | use PowerShell 7 (`pwsh`) |
| Aviso "Windows protegeu o computador" ao instalar | Setup sem assinatura de código | "Mais informações" → "Executar assim mesmo"; esperado |

---

## 5. Comandos de inspeção úteis

```powershell
# Estado de versões e tags
git tag -l "v*"
foreach ($t in git tag -l "v*") { "$t -> $(git rev-list -n1 $t)" }
gh release list

# Runs
gh run list --workflow=release.yml --limit 10
gh run list --workflow=release.yml --branch vX.Y.Z               # run de uma tag específica
gh run list --workflow=ci.yml --commit (git rev-list -n1 vX.Y.Z)  # CI do commit taggeado estava verde?
gh run view <id> --log-failed
gh run rerun <id> --failed        # só para falha transitória, até ~30 dias após o run

# Release específica
gh release view vX.Y.Z --json name,tagName,isDraft,isPrerelease,publishedAt,assets,body
#   (o commit real da Release é: git rev-list -n1 vX.Y.Z — o campo targetCommitish mostra "main"
#    e não deve ser usado para isso)

# Conferir versão nos 3 campos
node -e "const p=require('./package.json'),l=require('./package-lock.json');console.log(p.version,l.version,l.packages[''].version)"
```
