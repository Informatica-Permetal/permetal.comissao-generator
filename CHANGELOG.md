# Changelog - Formatador Comissão

## 1.2.0 - 2026-09-18

Ciclo de refinamento visual dos relatórios e de segurança da desinstalação, homologado nesta versão. Nenhuma regra financeira ou de contrato de dados foi alterada.

### Adicionado

- Chapa perfurada real (foto, não mais um SVG sintético) como motivo decorativo institucional, aparecendo exatamente uma vez por documento: no cabeçalho de um relatório separado, ou na capa global de um consolidado (com o degradê completo) - nunca repetida no cabeçalho de cada filial, no separador entre filiais ou no rodapé.
- Separador visual elegante (uma linha) entre seções de filial no PDF consolidado, tornando a troca de filial inequívoca mesmo numa leitura rápida.
- Opção de limpeza de dados no desinstalador: checkbox **desmarcado por padrão** ("Também excluir dados e documentos do Formatador Comissão"), com lista real dos caminhos afetados e uma segunda confirmação explícita antes de qualquer exclusão permanente.
- Proteção ativa contra exclusão de pastas amplas (raiz de unidade, perfil do usuário, Documentos, Área de Trabalho, Downloads) e contra qualquer pasta sem um registro de propriedade (`manifesto`) válido - a limpeza opcional nunca remove algo que não foi comprovadamente criado pelo próprio aplicativo.

### Corrigido

- Paginação: a primeira seção de filial de um PDF consolidado não pula mais para uma página em branco quando a página da capa ainda tinha espaço livre.
- Bloco de subtotal por filial nunca mais é dividido entre duas páginas.

### Homologação desta versão

Auditoria completa de contratos de dados, regras financeiras, UI, filesystem/migração, geração de PDF, histórico e instalador - ver o relatório de homologação entregue junto com esta versão. Todos os itens críticos testados retornaram **PASS**.

---

## 1.1.0 e versões anteriores

Consolida as fases anteriores do projeto: parsing e validação dos contratos Previsão/Relação, geração de PDF separado e consolidado por vendedor, cadastro corporativo de filiais/grupos, histórico com regeneração e exclusão seguras, migração de nomenclatura legada (sem acentuação) e instalador Windows per-user sem privilégio de administrador. Ver `IMPLEMENTATION_STATUS.md` para o detalhamento fase a fase.
