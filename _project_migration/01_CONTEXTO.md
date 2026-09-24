# 01 — Contexto do projeto

## 1. O que é

**Formatador Comissão** é um aplicativo desktop Windows (Electron + React + TypeScript) que
recebe as planilhas `.xlsx` de comissões exportadas do **TOTVS Protheus Smart View** e gera
**PDFs profissionais** — um por **vendedor + filial** (ou um consolidado por vendedor, quando o
usuário escolhe) — com a identidade visual da empresa/filial.

- Repositório: `https://github.com/Informatica-Permetal/permetal.comissao-generator` (público).
- Pasta local: `C:\dev\permetal.comissao-generator`.
- Usuário final: equipe interna (Permetal / grupo Três-S) que distribui relatórios de comissão aos
  vendedores.
- Versão atual publicada: **1.2.4** (2026-09-22).

## 2. O que ele NÃO é (regra de negócio mais importante)

O app **não calcula comissão**. O Protheus é a fonte da verdade financeira. O app:

- **nunca** recalcula comissão a partir de base, percentual, datas ou status;
- **nunca** decide se o vendedor tem direito à comissão;
- **nunca** remove, deduplica, mescla ou "corrige" linhas do Protheus;
- a **única** aritmética permitida é **somar** o campo de comissão já calculado pelo Protheus,
  por documento:
  - modo **Previsão**: campo `Comissão total (líquido)`;
  - modo **Relação**: campo `Valor da Comissão`;
- soma com `decimal.js` (nunca ponto flutuante);
- linhas "parecidas" continuam separadas e todas entram no total; zeros e negativos são válidos;
- colunas são localizadas **pelo nome normalizado**, nunca pela posição (exceção: dois
  `Vencimento` na Previsão **bloqueiam** a importação com orientação ao usuário);
- zeros à esquerda de filial, vendedor, título, prefixo, parcela e pedido são preservados;
- 100% offline, sem telemetria, dados sempre no perfil do usuário Windows, sem exigir admin.

Essas regras estão detalhadas na skill do projeto (`.claude/skills/formatador-comissao/SKILL.md`,
versionada no Git) e na especificação (`docs/Formatador-Comissao-Especificacao.md`).

## 3. Dois modos de relatório

| Modo | Relatório no Protheus Smart View | Campo somado | Colunas obrigatórias |
|---|---|---|---|
| **Previsão de Comissões** | `FINSV047` | `Comissão total (líquido)` | 13 |
| **Relação de Comissões** | `FATSV019` | `Valor da Comissão` | 12 |

Cada modo valida o próprio contrato e recusa (com opção "Processar como...") a planilha do outro
modo. A tela de importação tem uma ajuda integrada explicando como exportar do Smart View; o
conteúdo dela (`src/renderer/src/lib/importHelpContent.ts`) deve ficar em sincronia com
`.claude/skills/formatador-comissao/references/input-contracts.md`.

## 4. Filiais e grupos cadastrados (seed)

`src/main/companies/seedCompanyProfiles.ts` cria 2 grupos corporativos (**PERMETAL** e
**TRES_S**) e 7 filiais: `0101`, `0103`, `0104`, `0105`, `0106`, `0503`, `0504`. Logos em
`resources/brand-logos/` (`PERMETAL.png`, `METALGRADE.png`, `MGZINC.png`, `TRES-S.png`). O seed é
idempotente (só preenche campos vazios). Filial que aparece na planilha sem cadastro **bloqueia**
a geração até ser configurada. O arquivo de origem desses dados cadastrais
(`Cadastro-Empresas-Formatador-Comissao.md`, citado no `IMPLEMENTATION_STATUS.md`) **não está no
repositório** e não foi encontrado no notebook — os dados vivem apenas no seed em código.

## 5. Linha do tempo

| Data | Versão | Marco |
|---|---|---|
| 2026-09-09 | — | Repositório criado no GitHub |
| 2026-09-10 | 0.1.0 | Especificação + skill + scaffold electron-vite |
| 2026-09-10 → 14 | — | Fases 1–7: shell seguro, SQLite, contratos, PDF, importação, histórico, instalador NSIS per-user |
| 2026-09-14 | **1.0.0** | Primeira versão estável (instalador gerado manualmente) |
| 2026-09-15 → 18 | **1.1.0** | Redesenho UI/PDF A4 retrato, **consolidado por vendedor**, contrato Smart View v2, pt-BR com pastas acentuadas + migração, ajuda Smart View, cadastro corporativo, desinstalador seguro |
| 2026-09-18 | **1.2.0** | Chapa perfurada uma vez por documento (último instalador manual) |
| 2026-09-18 | — | Criado o workflow de Release automático (`release.yml`) |
| 2026-09-21 | 1.2.1 | **Abortada** (bug libuv/Node 24.20.0 no runner) |
| 2026-09-21 | — | Criados `ci.yml` e `.node-version` (24.21.0); perfis DEV/HOMOLOGATION |
| 2026-09-21 | 1.2.2 | **Abortada** (publicação implícita do electron-builder) |
| 2026-09-21 | — | `--publish never`; helper de SQLite para testes |
| 2026-09-21 | **1.2.3** | Primeira Release 100% automática; refinamentos visuais de PDF e UI |
| 2026-09-22 | **1.2.4** | Novo ícone oficial (ICO multi-resolução) — **Latest** |

## 6. Decisões técnicas relevantes (e por quê)

| Decisão | Motivo |
|---|---|
| `node:sqlite` (`DatabaseSync`) em vez de driver nativo | sem node-gyp/electron-rebuild, instalador simples |
| `exceljs` em vez de SheetJS | SheetJS no npm parado em 0.18.5 com advisories |
| `decimal.js` para totais | nunca ponto flutuante em dinheiro |
| Datas por getters UTC | o meio-dia UTC do export não "muda de dia" |
| Dados em `%LOCALAPPDATA%` | por usuário, sem admin |
| Recursos (logos, motivo, ícone) em `extraResources`, fora do asar | `copyFileSync`/`__dirname` não funcionam dentro do asar |
| Janela utilitária oculta reaproveitada para PDF/impressão | criar/destruir janelas ocultas dava `ERR_FAILED` intermitente |
| Um único serviço de importação | drag-drop, seletor e watcher passam pelo mesmo pipeline |
| Exclusões sempre para a Lixeira (`shell.trashItem`) | nada é apagado permanentemente pelo app |
| `modeLock` (mutex por modo) | corrigiu corridas reais entre gerar/regenerar/excluir |
| Instalador NSIS per-user, sem UAC, dados preservados ao desinstalar | requisito do produto |
| Sem auto-update | v1 offline; cada versão é um Setup novo |
| Perfis DEV / HOMOLOGATION / PRODUCTION isolados | testar sem nunca tocar dados reais |
| Release só pelo GitHub Actions a partir de tag | tag = commit = código = instalador, sempre |
| `.node-version` exato + CI em `main` | evitar surpresas de runner (v1.2.1) |
| `--publish never` | electron-builder nunca publica; só `gh release create` (v1.2.2) |
| Tag enviada é imutável; falha → próximo patch | rastreabilidade (v1.2.1/v1.2.2 preservadas) |

## 7. Fontes de conhecimento dentro do repositório

| Arquivo | Conteúdo | Atualizado até |
|---|---|---|
| `.claude/skills/formatador-comissao/SKILL.md` + `references/*.md` | Regras inegociáveis, contratos de entrada, design do PDF, arquitetura, plano de fases | Especificação original (alguns trechos desatualizados — ver 08) |
| `docs/Formatador-Comissao-Especificacao.md` | Especificação consolidada | Idem |
| `docs/RELEASE_PROCESS.md` | Processo oficial de release | 1.2.3 (com trechos contraditórios — ver 05 §15) |
| `IMPLEMENTATION_STATUS.md` (188 KB) | Diário técnico fase a fase, decisões, testes, homologações | **1.2.0** — não cobre 1.2.1→1.2.4 |
| `CHANGELOG.md` | Notas por versão (fonte das notas da Release) | 1.2.4 |
| `_project_migration/` (esta pasta) | Documentação de continuidade | 2026-09-24 |

Não existe `README.md` nem `CLAUDE.md` na raiz.
