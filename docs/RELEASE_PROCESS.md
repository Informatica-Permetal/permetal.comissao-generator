# Processo de Release - Formatador Comissão

A partir da versão seguinte a 1.2.0, toda release oficial é gerada automaticamente pelo
GitHub Actions (`.github/workflows/release.yml`) a partir de uma tag `vX.Y.Z`. Isso garante
que a **tag**, o **commit**, o **código-fonte compilado** e o **instalador publicado**
correspondem sempre exatamente uns aos outros.

**O instalador oficial NUNCA deve ser gerado manualmente (`npm run dist` local) para fins de
publicação.** Rodar `npm run dist` localmente continua funcionando normalmente para testes e
depuração, mas o `.exe` resultante de uma execução local não deve ser anexado a uma GitHub
Release. O único instalador oficial é o artefato produzido pelo workflow, a partir da tag.

## Visão geral do que o workflow faz

Ao receber um push de uma tag `vX.Y.Z`, o workflow, rodando em `windows-latest`:

1. Faz checkout exatamente no commit apontado pela tag.
2. Valida que a tag corresponde exatamente à `version` do `package.json` daquele commit -
   se divergir, o workflow falha e nenhuma release é criada.
3. Instala as dependências de forma reprodutível (`npm ci`).
4. Roda lint, typecheck e testes.
5. Gera o instalador oficial com `npm run dist` - este comando já inclui o build
   (`electron-vite build`) e o empacotamento (`electron-builder --win`) internamente; o
   workflow não roda `npm run build` como etapa separada, para não compilar duas vezes.
6. Calcula o SHA256 do instalador gerado.
7. Cria a GitHub Release usando a própria tag, anexando o instalador e o arquivo `.sha256`,
   com notas extraídas automaticamente da seção correspondente do `CHANGELOG.md`.

Qualquer falha em qualquer etapa anterior impede a criação da release.

## Passo a passo para publicar uma nova versão

Exemplo abaixo usando a versão `1.3.0` - substitua pelo número real da versão que está sendo
lançada.

1. Termine e valide o desenvolvimento da versão normalmente (lint, typecheck, testes e build
   locais, testes manuais na UI quando aplicável).

2. Atualize o campo `"version"` em `package.json` para a nova versão (ex.: `"1.3.0"`).

3. Atualize o `CHANGELOG.md`, adicionando uma nova seção no topo no formato:

   ```markdown
   ## 1.3.0 - 2026-XX-XX

   ### Adicionado
   - ...

   ### Corrigido
   - ...
   ```

   O workflow extrai automaticamente o texto entre o cabeçalho `## 1.3.0` e o próximo `## `
   (ou o fim do arquivo) para usar como notas da release. Escreva essa seção como o conteúdo
   final que deve aparecer publicamente na release.

4. Rode a suíte completa localmente antes de commitar:

   ```powershell
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```

5. Revise o que será commitado e faça o commit final da versão:

   ```powershell
   git status
   git add .
   git commit -m "chore: prepara release 1.3.0"
   git push origin main
   ```

6. Crie a tag anotada correspondente e envie-a - **é o push da tag que dispara o workflow**:

   ```powershell
   git tag -a v1.3.0 -m "Formatador Comissão v1.3.0"
   git push origin v1.3.0
   ```

7. Acompanhe a execução na aba **Actions** do repositório no GitHub. O job `release` deve
   passar por checkout, validação de versão, instalação, lint, typecheck, testes, geração do
   instalador (build + empacotamento via `npm run dist`), SHA256 e criação da release, nessa
   ordem.

8. Se o job falhar em qualquer etapa, **nenhuma release é publicada**. Corrija o problema,
   e então:
   - Se a tag ainda não corresponde a um commit correto, apague a tag remota
     (`git push origin :refs/tags/v1.3.0`) e a local (`git tag -d v1.3.0`), corrija o
     problema, faça um novo commit e recrie a tag do zero. Nunca reaproveite uma tag que já
     falhou uma vez para o mesmo número de versão.

9. Após a conclusão com sucesso, confira a aba **Releases** do repositório: a release
   `v1.3.0` deve conter exatamente dois arquivos anexados - o instalador `.exe` e o `.sha256`
   correspondente - com as notas extraídas do `CHANGELOG.md`.

## Por que apenas o `.exe` e o `.sha256` são publicados

O `electron-builder` também produz, na mesma pasta `release/`, arquivos como `latest.yml` e
`*.blockmap`. Esses arquivos existem para dar suporte a atualização automática via
`electron-updater`. Este projeto **não usa `electron-updater`** (não está entre as
dependências do `package.json`) e não tem nenhum mecanismo de auto-update na v1.x - logo,
esses arquivos não têm nenhuma utilidade para quem baixa a release e podem ser publicados com
segurança sem eles. Da mesma forma, a pasta `win-unpacked/` e o `builder-debug.yml` são
artefatos de build/depuração, não destinados a distribuição.

Se um mecanismo de auto-update vier a ser implementado no futuro, esta seção do documento e o
workflow precisarão ser revisados para passar a publicar também `latest.yml`/`.blockmap`.

## Versões anteriores (1.0.0, 1.1.0, 1.2.0)

Os instaladores dessas três versões foram gerados manualmente, antes da existência deste
workflow. As tags `v1.0.0`, `v1.1.0` e `v1.2.0` e as respectivas GitHub Releases (cada uma com
o instalador `.exe` e o `.sha256` correspondente) foram criadas e publicadas manualmente depois
- **não foram criadas nem passaram por este workflow**, que só existe a partir da versão
seguinte. Nenhuma delas será regenerada ou automatizada retroativamente por este processo.
