# 06 — Release Express (receita rápida)

> Para o porquê de cada passo: [05_RELEASE_WORKFLOW.md](05_RELEASE_WORKFLOW.md).
> Troque `X.Y.Z` pela versão nova (ex.: `1.2.5`). Rode tudo em **PowerShell 7 (`pwsh`)**, na pasta
> do projeto (o Windows PowerShell 5.1 não tem `&&` nem `-AsHashtable`).
> `git status` "limpo" aqui significa: nada além de `?? _project_migration/` (se esta pasta estiver
> no repo sem commit). **Nunca** rode `git clean` para "limpar" isso.

## Nunca

- `npm run dist` local para publicar
- subir `.exe` à mão / criar Release ou tag pelo site do GitHub
- mover, apagar, recriar ou reaproveitar tag **já enviada ao GitHub**
- PAT pessoal ou `GH_TOKEN` para o electron-builder
- `git push --force` em `main`; `git push --tags`
- criar tag antes do `CI` verde no commit exato
- editar `version` à mão no `package.json`

## 0. Pré-voo

```powershell
cd C:\dev\permetal.comissao-generator
git status                                  # limpo
git switch main; git pull --ff-only origin main
node --version; Get-Content .node-version   # v24.21.0 x 24.21.0 — se diferente, instale a versão do arquivo (03 §2)
npm ci
gh auth status                              # logado
git tag -l "v*"; gh release list            # X.Y.Z ainda não existe
```

## 1. Mudança funcional (se ainda não commitada)

```powershell
npm run lint && npm run typecheck && npm run test && npm run build
```

Se a mudança mexe em **empacotamento** (bloco `build` do `package.json`, `resources/icon.ico`,
`resources/installer.nsh`, scripts `pack`/`dist`, versão do electron-builder/Electron): o `CI`
**não** testa isso. Rode também `npm run pack` (e, se quiser testar o NSIS, `npm run dist` —
**só localmente, nunca publicar o resultado**) antes de seguir.

```powershell
git add <arquivos-da-mudança>
git commit -m "feat|fix: descricao"
git push origin main
$run = gh run list --workflow=ci.yml --commit (git rev-parse HEAD) --json databaseId --jq '.[0].databaseId'
if (-not $run) { "run do CI ainda nao apareceu - espere alguns segundos e repita" } else { gh run watch $run --exit-status }
```

## 2. Preparar versão

```powershell
npm version X.Y.Z --no-git-tag-version
git diff -- package.json package-lock.json  # só "version" mudou
```

Topo do `CHANGELOG.md` (logo abaixo do título, sem apagar seções publicadas):

```markdown
## X.Y.Z - AAAA-MM-DD

### <Seção>

- <o que o usuário ganha>

---
```

## 3. Gates + commit de preparação

```powershell
npm run lint && npm run typecheck && npm run test && npm run build
git add CHANGELOG.md package.json package-lock.json
git status                                  # staged: só esses 3
git commit -m "chore: prepara release X.Y.Z"
git push origin main
```

## 4. Esperar CI verde NO COMMIT EXATO

```powershell
$run = gh run list --workflow=ci.yml --commit (git rev-parse HEAD) --json databaseId --jq '.[0].databaseId'
if (-not $run) { "run do CI ainda nao apareceu - espere alguns segundos e repita" } else { gh run watch $run --exit-status }
# precisa terminar com sucesso (exit code 0) antes de seguir
```

## 5. Checagens finais e tag (o push da tag é irreversível)

```powershell
$v = "X.Y.Z"
$pkg  = (Get-Content package.json -Raw | ConvertFrom-Json).version
$lock = Get-Content package-lock.json -Raw | ConvertFrom-Json -AsHashtable
"$pkg / $($lock['version']) / $($lock['packages']['']['version'])"        # os 3 = X.Y.Z
(Select-String -Path CHANGELOG.md -Pattern "^## $([regex]::Escape($v))(\s|$)").Line   # '## X.Y.Z - ...'
git ls-remote --tags origin | Select-String "v$v"                          # nada
git rev-parse HEAD; git rev-parse origin/main                              # iguais, e = commit do CI verde
```

Se qualquer linha não bater, **não crie a tag**.

```powershell
git tag -a "v$v" -m "Formatador Comissao v$v"
git log -1 --format='%H %s' "v$v"           # = HEAD verde, "chore: prepara release X.Y.Z"
git push origin "v$v"
```

## 6. Acompanhar Release (~3 min)

```powershell
$run = gh run list --workflow=release.yml --branch "v$v" --json databaseId --jq '.[0].databaseId'
if (-not $run) { "run do Release ainda nao apareceu - espere alguns segundos e repita" } else { gh run watch $run --exit-status }
# filtrar por --branch "v$v" garante que é o run DESTA tag, e não o da versão anterior
```

## 7. Validar

```powershell
$v = "X.Y.Z"
gh release list                                                     # vX.Y.Z = Latest
gh release view "v$v" --json isDraft,isPrerelease,assets --jq '{isDraft, isPrerelease, assets: [.assets[].name]}'
gh release view "v$v" --json name,body --jq '.name, (.body | split("\n")[0])'
#   deve imprimir: "Formatador Comissao vX.Y.Z" e "## X.Y.Z - AAAA-MM-DD"

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
git status                                                          # limpo
```

**Pronto quando:** Latest, não draft, não prerelease, exatamente 2 assets (`.exe` + `.sha256`),
título e primeira linha das notas corretos, hash confere (`esperado` e `obtido` preenchidos e
iguais).

## Se falhar

| Situação | Faça |
|---|---|
| `CI` de `main` vermelho (antes da tag) | Nenhuma versão consumida. Se for intermitente (ex.: timeout de runner): `gh run rerun <id-do-CI> --failed`. Se precisar corrigir: commit + push, esperar verde — a tag vai nesse **novo HEAD verde**. |
| Tag criada **só localmente** (push não feito ou falhou) | Confira `git ls-remote --tags origin \| Select-String vX.Y.Z`. Se vazio, `git tag -d vX.Y.Z` é seguro; corrija e recrie. Nenhuma versão consumida. Se o push falhou por credencial/rede, só repita o push. |
| Push da tag feito, mas **nenhum run** de Release apareceu | Ver [07_TROUBLESHOOTING.md](07_TROUBLESHOOTING.md) §1 (nome da tag, tag no remoto, Actions habilitado). Não apague a tag. |
| `Release` falhou por algo transitório (rede, runner) e o `CI` do mesmo commit estava verde | `gh run rerun <id> --failed` (só até ~30 dias após o run) e `gh run watch <id> --exit-status`. Se o passo que falhou foi "Criar GitHub Release", antes confira `gh release view vX.Y.Z` e nada destrutivo sem autorização. |
| `Release` falhou e precisa mudar código/config | **Não mexa na tag enviada.** 1) corrija em `main` (commit + push, CI verde; se for empacotamento, rode também `npm run dist` local só para testar); 2) `npm version X.Y.(Z+1) --no-git-tag-version`; 3) no CHANGELOG, **renomeie** `## X.Y.Z - ...` para `## X.Y.(Z+1) - <data>` (o conteúdo nunca foi publicado — não crie seção nova em cima) e acrescente `_Nota técnica: a versão X.Y.Z teve sua publicação interrompida pelo pipeline antes da geração de qualquer Release; a publicação oficial dessas melhorias ocorre na X.Y.(Z+1)._`; 4) refaça a partir do passo 3 com X.Y.(Z+1). |
| Qualquer outra coisa | `gh run view <id> --log-failed` e [07_TROUBLESHOOTING.md](07_TROUBLESHOOTING.md) |
