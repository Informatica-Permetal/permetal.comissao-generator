# 09 — Antes e depois da formatação

> Os comandos de backup abaixo são para **você executar quando decidir** — nada foi copiado durante
> a auditoria.

---

## PARTE A — ANTES de formatar

### A.1 O que está no GitHub (não precisa backup)

Todo o código, workflows, skill do Claude, docs, CHANGELOG, ícone, logos versionados e as 5
Releases com instaladores. Confirme que não há nada local sem push:

```powershell
cd C:\dev\permetal.comissao-generator
git status                       # só deve aparecer _project_migration/ como não versionado
git fetch origin
git log origin/main..HEAD        # vazio = nada sem push
git ls-remote --tags origin      # 7 tags v1.0.0 … v1.2.4
```

### A.2 O que existe SÓ neste notebook (fazer backup)

| Prioridade | O quê | Onde | Tamanho aprox. | Observação |
|---|---|---|---|---|
| **Crítico** | Dados de produção do app | `%LOCALAPPDATA%\Formatador Comissão\` | 12,6 MB | banco `Formatador Comissão.db`, `logos\`, `logs\` (o resto é cache do Chromium) |
| **Crítico** | Relatórios de produção | `Documentos\Formatador Comissão\` | 75,8 MB | inclui o manifesto **oculto** `.formador-comissao-report-root.json` |
| **Alto** | Esta documentação | `C:\dev\permetal.comissao-generator\_project_migration\` | pequeno | **não está no Git** (ver A.4) |
| **Alto** | Planilhas de exemplo do Smart View (usadas em homologação) | `Downloads\Previsão de comissões.xlsx`, `Previsão de comissões(Campos Novos).xlsx`, `Relação de Comissões.xlsx`, `Relação de Comissões(Campos Novos).xlsx`, `Todos os Campos - Previsão de comissões.xlsx`, `Todos os Campos - Relação de Comissões.xlsx` | ~460 KB | dados **reais** de comissão — guardar em local **privado**, nunca no Git |
| Médio | PDF de referência visual | `Desktop\Exemplo visual Relatório Comissões.pdf` | 263 KB | referência de design do relatório |
| Baixo | Dados de teste DEV/HOMOLOGATION | `%LOCALAPPDATA%\Formatador Comissão Dev\`, `...\Formatador Comissão Homologação\`, `Documentos\Formatador Comissão Dev\`, `Documentos\Formatador Comissão Homologação\` | ~200 MB | descartáveis |
| Baixo | Identidade Git | `git config --global user.name` / `user.email` | — | anote os valores |
| Nenhum | `release\`, `out\`, `node_modules\`, caches do Electron/npm | — | ~2 GB | tudo se regenera; instaladores antigos estão nas Releases |

Não há secrets, tokens de CI, `.npmrc` ou certificados a preservar (o pipeline só usa o
`GITHUB_TOKEN` automático do GitHub).

### A.3 Como copiar (quando for fazer)

1. **Feche o Formatador Comissão** (copiar o SQLite com o app aberto pode gerar cópia
   inconsistente).
2. Ajuste o destino e rode:

```powershell
$dest = "E:\Backup-Formatador-Comissao"     # pendrive, HD externo ou pasta de rede PRIVADA
$docs = [Environment]::GetFolderPath('MyDocuments')

robocopy "$env:LOCALAPPDATA\Formatador Comissão" "$dest\LOCALAPPDATA\Formatador Comissão" /E /R:1 /W:1
robocopy "$docs\Formatador Comissão"             "$dest\Documentos\Formatador Comissão"   /E /R:1 /W:1
robocopy "C:\dev\permetal.comissao-generator\_project_migration" "$dest\_project_migration" /E /R:1 /W:1
robocopy "$env:USERPROFILE\Downloads" "$dest\Amostras-SmartView" "*comiss*.xlsx" /R:1 /W:1
Copy-Item "$env:USERPROFILE\Desktop\Exemplo visual Relatório Comissões.pdf" "$dest\" -ErrorAction SilentlyContinue
git config --global --list | Out-File "$dest\gitconfig-global.txt"
```

   O `robocopy` retorna código de saída **1** quando copiou arquivos com sucesso (0 a 7 = sucesso;
   8 ou mais = erro). Ele copia arquivos ocultos, inclusive o manifesto da pasta de relatórios
   (testado).

3. Confira no destino: o arquivo `Formatador Comissão.db` existe e tem o mesmo tamanho; a pasta
   `Documentos\Formatador Comissão` tem `Previsão\`, `Relação\` e o manifesto oculto
   (`Get-ChildItem -Force`).

### A.4 Esta pasta `_project_migration/` e o repositório público

A pasta não está versionada. Opções:

- **Copiar para o backup** (recomendado em qualquer caso) e/ou
- **Commitar no repositório** (sobrevive a qualquer perda local). Atenção: o repositório é
  **público** e estes documentos citam o nome do usuário Windows, o e-mail dos commits (que já é
  público no histórico), os nomes dos colaboradores e o caminho/IP do compartilhamento de rede
  interno (`\\192.168.2.2\...`). Se for commitar, avalie remover o caminho de rede antes.

### A.5 Contas e acessos (verifique que você consegue entrar)

- GitHub `Murilo-Alexandre` (push) e/ou `Informatica-Permetal` (admin) — senha **e** segundo fator
  (app autenticador / códigos de recuperação), se ativados. Sem isso não há como publicar.
- Compartilhamento de rede `\\192.168.2.2\permetal-publico\TI\09-COLABORADOR\Murilo\Logos` (fonte
  dos logos e do ícone original) — só leitura, não precisa backup.

---

## PARTE B — DEPOIS de formatar

### B.1 Ambiente

Siga [03_AMBIENTE_LOCAL.md](03_AMBIENTE_LOCAL.md) §2–§4: Git, GitHub CLI, PowerShell 7, VS Code,
**Node 24.21.0 exato**, identidade Git, `gh auth login`, clone em `C:\dev\permetal.comissao-generator`,
`npm ci`.

Depois do clone, **devolva esta pasta para dentro do repositório** (o clone não a traz, porque ela
não está no Git; o prompt mestre e os documentos esperam encontrá-la ali):

```powershell
$src = "E:\Backup-Formatador-Comissao"
robocopy "$src\_project_migration" "C:\dev\permetal.comissao-generator\_project_migration" /E /R:1 /W:1
# opcional: esconder do "git status" sem commitar (arquivo local, não versionado)
Add-Content "C:\dev\permetal.comissao-generator\.git\info\exclude" "_project_migration/"
```

(Se você decidiu commitar a pasta — ver A.4 — ela já vem com o clone e este passo não é
necessário.)

### B.2 Validação técnica local

```powershell
cd C:\dev\permetal.comissao-generator
node --version                 # v24.21.0
npm ci
npm run lint                   # 0 errors (2 warnings conhecidos)
npm run typecheck
npm run test                   # 39 arquivos, 342 testes
npm run build
npm run dev                    # abre em DEV; feche depois
npm run pack
npm run pack:run               # abre em HOMOLOGATION; título da janela com "Homologação"
```

### B.3 Restaurar os dados de produção

**Use o mesmo nome de usuário Windows do notebook antigo (`INFORMATICA2`).** O banco guarda
caminhos absolutos (`C:\Users\INFORMATICA2\...`) de PDFs, logos, planilhas arquivadas e da pasta de
relatórios; com outro usuário, o histórico aponta para caminhos inexistentes.

Ordem recomendada — restaurar **antes** de abrir o app pela primeira vez:

```powershell
$src  = "E:\Backup-Formatador-Comissao"
$docs = [Environment]::GetFolderPath('MyDocuments')
robocopy "$src\LOCALAPPDATA\Formatador Comissão" "$env:LOCALAPPDATA\Formatador Comissão" /E /R:1 /W:1
robocopy "$src\Documentos\Formatador Comissão"   "$docs\Formatador Comissão"            /E /R:1 /W:1
```

Depois:

1. Baixe o Setup da **Latest** (hoje v1.2.4):
   `gh release download v1.2.4 -R Informatica-Permetal/permetal.comissao-generator --pattern "*.exe*" --dir $env:TEMP`
   ou pela página de Releases. Valide o hash (05 §10).
2. Instale (per-user, sem admin; se o SmartScreen avisar: "Mais informações" → "Executar assim
   mesmo"). A última tela do instalador vem com "Executar Formatador Comissão" **marcado** — por
   isso a restauração acima vem **antes** da instalação. Se por algum motivo você instalou antes de
   restaurar, **desmarque** essa opção: abrir o app sem os dados cria um banco novo vazio e pede a
   configuração inicial.
3. Abra o app: ele **não** deve pedir a configuração inicial (o app decide isso pela chave
   `firstRunCompletedAt` gravada no banco restaurado); o Histórico deve listar os lotes e
   "Abrir PDF" deve funcionar.

Se o nome de usuário for diferente: trate como instalação nova (configure a pasta de relatórios do
zero) e mantenha o backup antigo como arquivo morto — não tente editar o banco à mão.

Restaure também as planilhas de exemplo numa pasta privada (fora do repositório) para
homologações futuras.

### B.4 Validar o pipeline do GitHub sem gastar versão

O `CI` roda em qualquer push em `main`. Um commit só de documentação prova que credencial, push e
runner funcionam, sem criar tag nem Release:

```powershell
# exemplo: primeira tarefa sugerida em 08 §7 (docs:)
git add <arquivos de docs>
git commit -m "docs: atualiza documentacao de continuidade"
git push origin main
gh run list --branch main --limit 1
gh run watch <id> --exit-status
```

### B.5 Checklist "pronto para desenvolver e publicar"

- [ ] `node --version` = conteúdo de `.node-version`
- [ ] `git push` funciona (credencial) e `gh auth status` OK
- [ ] lint / typecheck / test / build verdes localmente
- [ ] `npm run dev` e `npm run pack` + `npm run pack:run` abrem
- [ ] um push em `main` gerou `CI` verde
- [ ] dados de produção restaurados e o app instalado abre com histórico
- [ ] planilhas de exemplo disponíveis em local privado
- [ ] leu [06_RELEASE_EXPRESS.md](06_RELEASE_EXPRESS.md)

Com todos marcados, a próxima release é só seguir o 06.

---

## PARTE C — Veredito: Windows novo + projeto restaurado + GitHub é suficiente?

**Sim**, para desenvolver e para gerar uma nova release corretamente, desde que:

1. haja acesso a uma conta GitHub com **write** no repositório (e o segundo fator dela);
2. o Node local seja **24.21.0** (para os gates locais baterem com o CI);
3. a política de release seja seguida (06).

Por quê: o **build, os testes, o empacotamento, o SHA256 e a publicação acontecem inteiramente no
runner do GitHub**, a partir do código versionado. Não há secret, certificado, token ou ferramenta
local indispensável para publicar — localmente só são necessários Git (para commit/tag/push) e,
recomendado, o `gh` (para acompanhar). Tudo que o workflow usa (`.node-version`, `package.json`,
`package-lock.json`, `CHANGELOG.md`, `resources/`, `release.yml`) está no Git.

O que **não** é recuperável pelo GitHub e depende do backup da Parte A: os **dados de produção**
do app, as **planilhas de exemplo** para homologação e **esta documentação** (enquanto não for
commitada).
