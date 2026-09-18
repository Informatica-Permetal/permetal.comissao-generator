# Changelog - Formatador Comissão

## 1.2.0 - 2026-09-18

Ajuste pontual de identidade visual pós-homologação da v1.1.0. Nenhuma regra financeira, funcionalidade de segurança do desinstalador ou comportamento de paginação foi alterado nesta versão.

### Adicionado

- Chapa perfurada real (foto) como motivo decorativo institucional, agora aparecendo exatamente uma vez por documento: no cabeçalho de um relatório separado, ou na capa global de um consolidado - nunca repetida no cabeçalho de cada filial, no separador entre filiais ou no rodapé/assinatura.
- Separador entre seções de filial no PDF consolidado simplificado para uma linha simples, sem a imagem do motivo.

---

## 1.1.0 - 2026-09-18

Ciclo de refinamento visual, funcional e de segurança pós-lançamento inicial. Nenhuma regra financeira foi alterada.

### Adicionado

- Redesenho completo da interface (sidebar fixa, navegação por ícones) e dos relatórios PDF, agora em A4 retrato, eliminando a repetição de vendedor/filial que existia no documento.
- Nova opção de geração consolidada por vendedor: quando o mesmo vendedor aparece em mais de uma filial, é possível reunir tudo em um único PDF (com subtotal por filial e total geral), além da geração separada por filial já existente.
- PDF consolidado com cabeçalho institucional, grade de metadados do relatório, período de análise e paginação revisada.
- Motivo decorativo real da "chapa perfurada" (foto, substituindo o SVG sintético anterior) e capa própria para documentos consolidados.
- Contrato de importação Smart View atualizado, com novas validações de relatório.
- Textos da interface revisados para português correto, pastas com acentuação (com migração automática de instalações antigas) e ajuda integrada explicando o Smart View diretamente nas telas de importação.
- Revisão do cadastro corporativo de filiais/grupos.
- Desinstalador mais seguro: opção de também excluir dados e documentos do aplicativo, desmarcada por padrão, com lista dos caminhos afetados e confirmação explícita antes de qualquer exclusão permanente.

### Corrigido

- Paginação: a primeira seção de filial de um PDF consolidado não pula mais para uma página em branco quando a página da capa ainda tinha espaço livre.
- Bloco de subtotal por filial nunca mais é dividido entre duas páginas.

---

## 1.0.0 - 2026-09-14

Primeira versão estável do Formatador Comissão: importação, geração de PDF, histórico e instalador Windows completos e testados. Ver `IMPLEMENTATION_STATUS.md` para o detalhamento fase a fase.

### Adicionado

- Importação de Previsão de Comissões e Relação de Comissões exportadas do TOTVS Protheus Smart View (.xlsx), com validação do contrato de cada modo.
- Geração de um PDF por vendedor + filial, com totais somados exatamente como calculados pelo Protheus.
- Cadastro de empresas/filiais com logo, usado na identidade visual de cada relatório.
- Histórico com filtros (modo/filial/vendedor/data), abrir, imprimir, localizar no Explorer, gerar novamente e excluir (sempre para a Lixeira do Windows).
- Instalador Windows por usuário, sem exigir privilégios de administrador e sem atualização automática pela internet.
