# Fase 1.5: plano de implementação (planilha e resumo por período)

> **Para agentes:** execute tarefa por tarefa (executing-plans). TDD em cada uma.

**Objetivo:** levar para o app tudo o que a planilha da família faz e acrescentar o resumo por período e a exportação.

**Arquitetura:** o modelo atual ganha só campos opcionais, então o `schemaVersion` continua 1. Registros antigos são lidos como "pago na própria data". Os cálculos ficam em funções puras em `src/domain/`, e as telas só desenham o que elas devolvem.

**Spec:** docs/specs/2026-11-16-fase-1-5-planilha-design.md

## Restrições globais

- O app analisa e nunca recomenda: diz "Dentro do método" ou "Fora do método", previsto e real.
- Dinheiro sempre em centavos inteiros. Datas em `YYYY-MM-DD`.
- Lançamentos antigos (sem `pending` e sem `paidDate`) contam como **Pago** na própria data.
- Toda exclusão continua pedindo confirmação e oferecendo Desfazer.
- Categoria sem `group` conta como Desejo (regra da planilha).

## Pontos de atenção na revisão

1. Período que cruza meses: o orçamento é proporcional aos dias de cada mês do período. Teste em `period.test.ts`.
2. Parcela de cartão: entra no mês da compra + (n−1) e conta como paga quando a fatura daquele mês está paga. Teste em `status.test.ts`.
3. "Só pagos" exclui Previsto e Atrasado de todos os totais, do gráfico e do 50/30/20. Teste em `period.test.ts`.
4. Categoria padrão nunca editada (`updatedAt` 0) é atualizada para o nome novo. Categoria editada pelo usuário não é tocada. Teste em `db.test.ts`.
5. Recorrente gerado chega como Previsto e para depois de N meses. Teste em `recurring.test.ts`.

---

### Tarefa 1: domínio (tipos, padrões da planilha, situação, períodos, cálculos)

**Arquivos:** `src/domain/types.ts`, `src/domain/defaults.ts`, `src/domain/status.ts`, `src/domain/period.ts`, `src/domain/methods.ts`, `src/domain/report.ts`, `src/domain/csv.ts`. Testes: `tests/domain/status.test.ts`, `period.test.ts`, `report.test.ts`, `csv.test.ts`.

**Produz:**
- **Tipos:**
  - `Transaction.kind` passa a aceitar `'investimento'`.
  - `Transaction.pending?: true` e `paidDate?: string`.
  - `Category.kind` aceita `'investimento'` e ganha `group?: 'necessidade' | 'desejo'`.
  - `Account.kind` aceita `'pix'`.
  - Nova coleção `settings` com o registro `{ id: 'app', methodId?: string }`.
- **`txStatus(t, txs, cards, today)`**, que devolve `'pago' | 'previsto' | 'atrasado'`.
- **`competenceDate(t)`**: a data em que o lançamento conta nos totais.
- **`periodRange(kind, anchor)`** e **`shiftPeriod(kind, anchor, ±1)`**, para os tipos `dia`, `semana`, `mes`, `trimestre`, `semestre` e `ano`.
- **`periodSummary(range, data, { profile?, onlyPaid?, methodId?, today })`**, que devolve:
  - os totais de entradas, saídas e investimentos, o saldo antes do investimento e o saldo final;
  - `byCategory`, com o orçamento proporcional ao período;
  - `byProfile`;
  - `method`, com os buckets do 50/30/20;
  - `series`, um ponto por dia ou por mês.
- **`METHODS`**: as 17 variações da planilha.
- **`EXAMPLES`**: os exemplos de cada categoria.
- **`yearReport(year, data, onlyPaid, today)`**.
- **`dashboard(year, data, onlyPaid, today)`**.
- **`toCsv(rows)`**: separador `;`, vírgula decimal e BOM.

### Tarefa 2: dados (configurações, migração dos padrões, recorrentes)

**Mudanças:**
- Dexie passa à versão 2, com a tabela `settings`.
- `ensureDefaults` cria os padrões que faltam e atualiza os que nunca foram editados (`updatedAt` 0). Também exclui os padrões antigos que não estão em uso e nunca foram editados.
- Recorrentes:
  - ganham `months?`, de onde vem o `endMonth`;
  - os lançamentos gerados nascem com `pending: true`.
- `accountBalanceCents` conta só o que está pago.

### Tarefa 3: telas de lançamento, lista, categorias, contas e recorrentes

**Mudanças:**
- **Formulário:** três tipos, a dica de exemplos da categoria, "Vence em", "Já está pago" com "Pago em", e "Por quantos meses".
- **Lista:** a situação de cada lançamento, os filtros por situação e o botão "Marcar como pago".
- **Categorias:** separadas em três seções, com Necessidade/Desejo em cada uma.
- **Contas:** o tipo Pix.

### Tarefa 4: Resumo por período, Painel, Relatório do ano, navegação e exportação

**Mudanças:**
- Navegação: Resumo, Lançamentos, Painel, Cartões e Mais. Em Mais ficam Contas, Relatório do ano e Ajustes.
- Exportação: "Baixar .csv" e "Imprimir / PDF", este último com `@media print`.

### Tarefa 5: dados da demonstração e publicação da demonstração
