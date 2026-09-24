# 03 — Ambiente local

## 1. Ferramentas necessárias

| Ferramenta | Versão recomendada | Versão no notebook antigo (2026-09-24) | Obrigatória? |
|---|---|---|---|
| Windows 10/11 x64 | — | Windows 11 Pro 10.0.26200 | Sim |
| **Node.js** | **exatamente `24.21.0`** (= `.node-version`) | 24.15.0 (divergente!) | Sim |
| npm | a que vem com o Node 24.21.0 (CI usa 11.19.0) | 11.12.1 | Sim |
| Git for Windows (inclui Git Credential Manager) | 2.55.x ou mais nova | 2.55.0.windows.4 (GCM 2.9.0) | Sim |
| GitHub CLI (`gh`) | 2.101 ou mais nova | 2.101.0 | Sim (acompanhar CI/Release) |
| PowerShell 7 (`pwsh`) | 7.x | 7.6.6 | Recomendado |
| VS Code | atual | 1.136.1 | Recomendado |
| Claude Code | atual | via app desktop | Opcional |

Não são necessários: Visual Studio Build Tools, Python, Chocolatey, nvm, pacotes npm globais.
(No notebook antigo existiam `ts-node` e `@gitlawb/openclaude` globais — **não** usados pelo
projeto.)

**Por que Node exato:** os workflows usam `24.21.0`. Rodar local com outra versão pode esconder ou
criar problemas (ex.: o bug do libuv que derrubou a v1.2.1 estava no 24.20.0). Mantenha local =
`.node-version`.

## 2. Instalação num Windows novo

```powershell
# Git, GitHub CLI, PowerShell 7, VS Code (winget)
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id Microsoft.PowerShell -e
winget install --id Microsoft.VisualStudioCode -e
```

**Node 24.21.0** — instale o MSI oficial x64 dessa versão exata (página de downloads do nodejs.org,
pasta `v24.21.0`, arquivo `node-v24.21.0-x64.msi`). Depois confira:

```powershell
node --version   # v24.21.0
npm --version
```

Alternativa com gerenciador de versões que lê `.node-version` automaticamente: `fnm`
(`winget install Schniz.fnm`, depois `fnm install 24.21.0` e `fnm use`). Opcional.

## 3. Identidade Git e autenticação

```powershell
git config --global user.name "Murilo Arbarotti Alexandre"
git config --global user.email "<mesmo e-mail usado nos commits anteriores>"
# core.autocrlf=true já é o padrão do Git for Windows
```

Duas contas GitHub foram usadas no notebook antigo:

| Uso | Conta | Como autenticar |
|---|---|---|
| `git push` (commits e tags) | `Murilo-Alexandre` (permissão write) | Git Credential Manager abre o navegador no primeiro push |
| `gh` CLI (acompanhar runs, ver Releases) | `Informatica-Permetal` (dona/admin do repo) | `gh auth login` → GitHub.com → HTTPS → navegador |

Qualquer uma das duas contas com permissão de escrita funciona para o fluxo de release. Se for
usar o `gh` para **dar push de alterações em `.github/workflows/*`**, o token do `gh` precisa do
escopo `workflow`: `gh auth refresh -s workflow` (o token antigo não tinha).

## 4. Clonar e instalar

```powershell
New-Item -ItemType Directory -Force C:\dev | Out-Null
git clone https://github.com/Informatica-Permetal/permetal.comissao-generator.git C:\dev\permetal.comissao-generator
cd C:\dev\permetal.comissao-generator
npm ci
```

- `npm ci` instala exatamente o `package-lock.json` (591 pacotes) e baixa o Electron 44.3.0 no
  `postinstall`.
- Sempre `npm ci`, não `npm install` (que pode reescrever o lock). Use `npm install <pacote>` só
  quando for **intencionalmente** adicionar/atualizar dependência (e commite o lock).
- É normal o aviso `2 moderate severity vulnerabilities` (advisory conhecido via exceljs; ver 08).
  **Não** rode `npm audit fix --force` (rebaixaria o exceljs).

## 5. Comandos do dia a dia

| Comando | O que faz | Onde usar |
|---|---|---|
| `npm run dev` | App em desenvolvimento (HMR no renderer), perfil **DEV** | local |
| `npm run lint` | ESLint (0 erros; 2 warnings conhecidos de `react-refresh`) | local, CI, Release |
| `npm run typecheck` | `tsc --noEmit` nos dois tsconfig (main e renderer) | local, CI, Release |
| `npm run test` | Vitest (39 arquivos, 342 testes) | local, CI, Release |
| `npx vitest` | Vitest em modo watch | local |
| `npx vitest run src/main/pdf` | roda só um caminho | local |
| `npm run build` | electron-vite → `out/` | local, CI |
| `npm run pack` | build + `electron-builder --dir` → `release\win-unpacked\Formatador Comissão.exe` (sem Setup) | local (homologação) |
| `npm run pack:run` / `npm run homolog` | **só executa** o `win-unpacked` em **HOMOLOGATION** (não empacota!) | local, depois do `pack` |
| `npm run dist` | build + Setup NSIS em `release\` | **reservado ao GitHub Actions.** Local só para testar instalação/upgrade/desinstalação — nunca publicar |
| `npm run format` | Prettier `--write` em tudo | **evitar**: ~97 arquivos atuais não estão no padrão; geraria diff enorme. Só num commit dedicado |

## 6. Homologação local (antes de qualquer release)

1. `npm run dev` → testar a mudança no perfil DEV.
2. `npm run pack` → gera o app empacotado real.
3. `npm run pack:run` → abre esse app em HOMOLOGATION (dados em
   `%LOCALAPPDATA%\Formatador Comissão Homologação`).
4. No primeiro uso de HOMOLOGATION, escolha a pasta de relatórios de homologação
   (`Documentos\Formatador Comissão Homologação`), **não** a de produção.
5. Para importar, use as planilhas de exemplo do Smart View (ver 09 — elas **não** estão no Git).

O que DEV/HOMOLOGATION **não** cobrem (exigem o Setup real, via `npm run dist` local só para
teste): instalação per-user sem UAC, atalhos, upgrade sobre versão anterior, desinstalação com e
sem apagar dados, reinstalação.

## 7. Caches (não precisam de backup; se regeneram)

| Pasta | Tamanho (notebook antigo) |
|---|---|
| `%LOCALAPPDATA%\electron\Cache` | ~407 MB |
| `%LOCALAPPDATA%\electron-builder\Cache` (NSIS, winCodeSign, 7zip) | ~168 MB |
| `%LOCALAPPDATA%\npm-cache` | ~4 GB |
| `node_modules\`, `out\`, `release\` (no repo, ignorados pelo Git) | ~714 MB / ~1 MB / ~880 MB |

Exigem acesso de saída ao registry do npm e a `github.com` / `objects.githubusercontent.com`.

## 8. VS Code e Claude Code

- Extensões úteis: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`,
  `github.vscode-github-actions`, `eamodio.gitlens`, `redhat.vscode-yaml`,
  `ms-vscode.powershell`, `anthropic.claude-code`, `ms-ceintl.vscode-language-pack-pt-br`.
- Não existe `.vscode/` no repositório.
- A skill do projeto (`.claude/skills/formatador-comissao/`) volta com o clone. Não há
  `.claude/settings.json` no repo; a pasta de memória do Claude deste projeto estava **vazia**
  (nada a preservar ali).
- Para contextualizar um Claude novo: [PROMPT_MESTRE_POS_FORMATACAO.md](PROMPT_MESTRE_POS_FORMATACAO.md).

## 9. Armadilhas conhecidas

- **Git Bash sem `gh`:** `export PATH="$PATH:/c/Program Files/GitHub CLI"` ou use PowerShell.
- **Aviso `LF will be replaced by CRLF`:** inofensivo (`core.autocrlf=true`).
- **Nome com espaço e acento** (`Formatador Comissão.exe`): sempre use aspas nos caminhos.
- **Ícone antigo no Explorer:** cache de ícones do Windows, não defeito do build.
- **Rodar `release\win-unpacked\...exe` direto:** abre como PRODUCTION. Não faça.
- **Testes que usam banco:** use `openTestDatabase`, nunca `openDatabase` direto (timeout em CI).
