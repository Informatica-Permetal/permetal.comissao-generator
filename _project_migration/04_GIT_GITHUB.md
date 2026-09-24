# 04 — Git e GitHub

## 1. Repositório

| Item | Valor |
|---|---|
| URL | `https://github.com/Informatica-Permetal/permetal.comissao-generator` |
| Visibilidade | **Pública** |
| Dono | conta de **usuário** `Informatica-Permetal` (não é organização) |
| Colaboradores | `Informatica-Permetal` (admin), `Murilo-Alexandre` (write), `joaoMia` (write) |
| Contas usadas no notebook antigo | `git push` = `Murilo-Alexandre` (via Git Credential Manager; autor de todos os runs); `gh` CLI = `Informatica-Permetal` — ver [03_AMBIENTE_LOCAL.md](03_AMBIENTE_LOCAL.md) §3 |
| Branch padrão / única | `main` |
| Remote local | `origin` → `https://github.com/Informatica-Permetal/permetal.comissao-generator.git` |
| Issues / PRs | nenhuma issue, nenhum PR até hoje |
| Segurança | secret scanning e push protection **ativos**; Dependabot **desativado** |
| Deploy keys / webhooks | nenhum |

Como o repositório é **público**, tudo que for commitado fica visível na internet. Nunca commitar
planilhas reais do Protheus, PDFs gerados, dados de clientes/vendedores ou credenciais.

## 2. Branches

- Só existe `main`. Todo o trabalho é feito direto em `main` (sem PRs, sem branches de feature até
  hoje).
- `main` **não é protegida** (sem branch protection, sem rulesets). Qualquer colaborador com write
  pode dar push direto. Por isso as regras (CI verde antes de tag, nada de `--force`) são de
  **disciplina**, não impostas pelo GitHub.
- O `ci.yml` também roda em pull requests contra `main`, caso um dia se passe a usar PRs.

## 3. Tags

| Tag | Commit | Tipo | Mensagem | Release |
|---|---|---|---|---|
| v1.0.0 | `1bfa052` | anotada | Formatador Comissão v1.0.0 | manual |
| v1.1.0 | `a7cac0d` | anotada | Formatador Comissão v1.1.0 | manual |
| v1.2.0 | `fa79661` | anotada | Formatador Comissão v1.2.0 | manual |
| v1.2.1 | `6b8c567` | anotada | Formatador Comissão v1.2.1 | **nenhuma** (abortada) |
| v1.2.2 | `e84b149` | anotada | Formatador Comissão v1.2.2 | **nenhuma** (abortada) |
| v1.2.3 | `45595d7` | anotada | Formatador Comissao v1.2.3 | workflow |
| v1.2.4 | `76bce1c` | anotada | Formatador Comissao v1.2.4 | workflow — **Latest** |

- As três primeiras foram criadas retroativamente em 2026-09-18 (mesmo segundo), antes do
  workflow existir.
- **Não há proteção de tags.** A regra "tag enviada é imutável" é disciplina.
- Envie **uma tag por vez** (`git push origin vX.Y.Z`). Não use `git push --tags` (enviaria tudo;
  além disso, pela documentação do GitHub, push de mais de 3 tags de uma vez não gera eventos de
  push de tag — o Release poderia nem disparar).

## 4. Convenções

| Item | Convenção |
|---|---|
| Mensagem de commit | Conventional Commits, **português sem acento/cedilha**, sem escopo: `feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `test:` |
| Commit de preparação | `chore: prepara release X.Y.Z` — altera **só** `package.json`, `package-lock.json`, `CHANGELOG.md` |
| Tag | anotada, `vX.Y.Z`, mensagem `Formatador Comissao vX.Y.Z` |
| Título da Release | fixo no workflow: `Formatador Comissao vX.Y.Z` |
| Autor dos commits | `Murilo Arbarotti Alexandre` (e-mail pessoal configurado no `~/.gitconfig`) |
| Trailer | commits feitos com ajuda do Claude levam `Co-Authored-By: Claude ...` |
| Stage | controlado (`git add <arquivos>`), evitar `git add .` |
| Histórico | nunca reescrever `main` (sem `push --force`, sem `rebase` de commits publicados) |

## 5. Configuração do GitHub Actions no repositório

| Configuração | Valor |
|---|---|
| Actions habilitado | sim, todas as actions permitidas |
| Permissão padrão do `GITHUB_TOKEN` | **read** (o `release.yml` eleva para `contents: write` no próprio arquivo) |
| Actions pode criar/aprovar PR | não |
| Secrets de repositório | **nenhum** |
| Variables | **nenhuma** |
| Environments | **nenhum** |
| Retenção de logs/artifacts | **90 dias** (logs das falhas de 21/09/2026 expiram por volta de 20/12/2026 — os trechos importantes estão copiados em 05 e 07) |
| Workflows | `CI` (`.github/workflows/ci.yml`), `Release` (`.github/workflows/release.yml`) |
| Caches | caches `node-cache-Windows-x64-npm-*` do `setup-node` (~65 MB cada) — descartáveis |

Nada disso precisa ser recriado depois da formatação: vive no GitHub.

## 6. Histórico resumido de commits (29 até 2026-09-22)

| Era | Commits | Resumo |
|---|---|---|
| Especificação/scaffold | `3681a17`, `dd26eb8` | skill, especificação, electron-vite |
| Fases até 1.0.0 | `2252335` → `1bfa052` | shell, contratos, PDF, importação, histórico, instalador |
| Até 1.2.0 (manual) | `261cb8f` → `fa79661` | UI nova, contrato v2, pt-BR, consolidado, desinstalador seguro |
| CI/CD | `9906e8a`, `0186433`, `35838b1`, `6b8c567`, `3c1f001`, `e84b149`, `5f5e280`, `9d8418e`, `45595d7` | release.yml, validação de versão, perfis, ci.yml + Node fixo, `--publish never`, SQLite de teste, 1.2.3 |
| Manutenção | `0a81240`, `76bce1c` | ícone, 1.2.4 |

Commits que mexeram no mecanismo de release e o porquê:

| Commit | Mudança | Motivo |
|---|---|---|
| `9906e8a` | cria `release.yml` e `docs/RELEASE_PROCESS.md` | instalador oficial só pelo workflow |
| `0186433` | valida os 3 campos de versão | `package-lock` já tinha divergido do `package.json` nas tags v1.0.0 e v1.2.0 |
| `3c1f001` | cria `ci.yml` e `.node-version` (24.21.0) | falha da v1.2.1 (Node do runner) descoberta só no push da tag |
| `5f5e280` | `--publish never` em `pack` e `dist` | falha da v1.2.2 (electron-builder tentando publicar) |
| `9d8418e` | `openTestDatabase` (novo `src/main/storage/testDatabase.ts`, adotado em 15 arquivos de teste) | CI de `main` com timeout de SQLite |

## 7. Comandos Git/GitHub úteis

```powershell
git status
git log --oneline --decorate -15
git tag -l "v*"
foreach ($t in git tag -l "v*") { "$t -> $(git rev-list -n1 $t)" }
git ls-remote --tags origin

gh auth status
gh repo view Informatica-Permetal/permetal.comissao-generator
gh release list
gh run list --limit 10
gh workflow list
gh api repos/Informatica-Permetal/permetal.comissao-generator/actions/permissions/workflow
```
