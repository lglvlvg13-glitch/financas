# Fase 1.5 — Tudo da planilha da família + resumo por período

Base: `PLANILHA_FINANCEIRA_FAMILIAR_1.xlsm`, que o usuário mandou em 16/11/2026 dizendo "tudo que tem nela eu quero no app". Todas as abas foram lidas, inclusive a AUX (oculta), as fórmulas e a macro `LancarRecorrenciasMensais`. A planilha não tem objetivos; eles continuam na Fase 2.

## Por quê

O casal já controla as finanças por essa planilha. O app tem que fazer tudo o que ela faz, para que eles possam largá-la sem perder nada, e com o que a planilha não faz: celular, dois usuários sincronizados e resumo em qualquer período.

## Objetivos

- Tudo da planilha: categorias, tipos, status, o lançador de recorrentes, o relatório anual, o método 50/30/20 com as 17 variações e o dashboard.
- Resumo por período: dia, semana, mês, trimestre, semestre, ano ou um período personalizado.
- Exportar o resumo de qualquer período.

## Fora do escopo

- Análise de investimentos. A antiga Fase 3 saiu do app.
- Importar os lançamentos da planilha: ela só tem 3 lançamentos de teste.
- Objetivos, diagnóstico, dívidas e reserva: ficam na Fase 2.

## O que não pode acontecer

- O app recomendar. Ele mostra "dentro" ou "fora" do método e quanto foi previsto e quanto foi real. Nunca diz "corte", "invista" ou "compre".
- Perder ou alterar lançamentos existentes por causa da mudança de modelo. Precisa de migração do `schemaVersion` 1 para o 2, sem perda.

## Abordagens consideradas

1. **Estender o modelo atual (escolhida).** O lançamento ganha o tipo `investimento`, `dueDate` e `paidDate`. A situação é calculada como na fórmula da planilha. Categorias ganham `group` (Necessidade ou Desejo) e `examples`. O resumo passa a receber um intervalo de datas. Isso reaproveita a sincronização, a junção e a exclusão com Desfazer.
2. Uma "aba por mês" como na planilha. Foi descartada: duplica dados entre meses e quebra parcelas e recorrentes que atravessam o ano.
3. Gerar uma planilha a partir do app e calcular nela. Foi descartada: o casal quer usar no celular, e a planilha vira só um formato de exportação.

## Como fica

### Configurações → categorias padrão (substituem as atuais)

- **Receita:** Salário (Usuário 1), Salário (Usuário 2), Comissões, Outras receitas.
  - Os nomes seguem os perfis.
  - As linhas "Receitas 4..11" da planilha eram vagas a preencher, então viram só a possibilidade de criar categorias.
- **Despesa (15, nesta ordem):** Moradia, Contas de serviços, Alimentação, Transporte, Saúde e bem-estar, Educação e desenvolvimento, Lazer e entretenimento, Vestuário, Poupança e investimentos, Seguros e impostos, Filhos e dependentes, Animais de estimação, Família e social, Doações e caridade, Emergenciais / imprevistos.
  - Cada uma traz a lista de exemplos do Lançador, que aparece como dica.
  - Classificação: Lazer e entretenimento, Vestuário e Família e social são **Desejo**. As outras são **Necessidade**. Uma categoria nova entra como Desejo e pode ser mudada.
- **Investimento:** Caixinha 1, Caixinha 2, Poupança, Corretora. Ficam editáveis.
- **Contas:** o tipo `pix` entra junto com corrente, poupança e carteira.
- **Migração do que já foi lançado:**
  - As categorias antigas que já foram usadas ficam.
  - As que não foram usadas são trocadas pelas novas.
  - `cat-pagamento-fatura` continua como categoria do sistema.

### Lançamento

- **Tipos:** Receita, Despesa, Investimento.
- **Campos:** "Vence em" (`dueDate`) e "Pago em" (`paidDate`, opcional).
- **Situação**, calculada como na planilha:
  - tem `paidDate` → **Pago**;
  - não tem `paidDate` e o vencimento já passou → **Atrasado**;
  - não tem `paidDate` e o vencimento ainda não chegou → **Previsto**.
- **Comportamento:**
  - Um lançamento novo já vem marcado como "Pago hoje" e pode ser desmarcado.
  - Os recorrentes gerados chegam como Previsto.
  - Na lista dá para marcar como pago com um toque.
  - Compra no cartão conta como paga quando a fatura do mês dela é paga.
- **Migração:** os lançamentos existentes ficam com `dueDate = paidDate = date`.

### Recorrentes (o Lançador)

- **Campos:** tipo, categoria, descrição, valor, dia de vencimento, mês inicial e "por quantos meses".
- Sem quantidade de meses, a recorrência repete todo mês.
- Pode passar de dezembro: o app não tem o limite do ano que a planilha tem.

### Resumo por período

- **Seletor de período:**
  - Dia, Semana (segunda a domingo), Mês, Trimestre, Semestre, Ano e Personalizado (início e fim).
  - Setas para ir ao período anterior e ao seguinte.
- **Totais:**
  - Entradas, Saídas, Investimentos.
  - Saldo antes do investimento = Entradas − Saídas.
  - Saldo final = Entradas − Saídas − Investimentos.
- **Interruptor** "Considerar: só pagos / todos", como o `AUX!D10` da planilha.
- **Por categoria:**
  - Despesas, receitas e investimentos de cada categoria.
  - O orçamento acompanha o período: mensal × dias do período ÷ dias do mês, somando mês a mês quando o período cruza meses.
- **Comparação entre os dois perfis.**
- **Método 50/30/20:**
  - As 17 variações, cada uma com os percentuais da planilha.
  - A escolha fica salva e é sincronizada entre os aparelhos.
  - Mostra Previsto (Receita × %), Real e a diferença em Necessidades, Desejos e Investimentos.
  - Mostra também o saldo que o método previa e o saldo que aconteceu.
- **Gráfico de barras:** um dia por barra na semana e no mês; um mês por barra no trimestre, no semestre e no ano; sem gráfico no dia.
- **Exportar:**
  - "Baixar planilha (.csv)": em pt-BR, separador `;`, vírgula decimal e um lançamento por linha.
  - "Imprimir / salvar em PDF": versão para impressão via `@media print`.

### Relatório do ano (como a aba RELATÓRIO FINANCEIRO)

- **Linhas:** o total de Receita e cada categoria de receita; o total de Despesa e cada categoria de despesa; o saldo antes do investimento; o total de Investimento e cada tipo; o saldo final.
- **Colunas:** de janeiro a dezembro, mais o total do ano.
- Tem o mesmo interruptor "só pagos / todos" e o mesmo bloco 50/30/20 aplicado ao ano.

### Painel (como o DASHBOARD)

- **Cartões:**
  - despesas atrasadas;
  - receitas atrasadas;
  - investido no ano (pago);
  - despesas pagas no ano;
  - receitas pagas no ano;
  - saldo final.
- **Gráficos de barras mês a mês:**
  - entradas;
  - saídas;
  - investimentos;
  - saldo;
  - saldo final.

### Navegação

- **Barra de baixo:** Resumo, Lançamentos, Painel, Cartões, Mais.
- **Mais:** Contas, Relatório do ano, Ajustes.

## Decisões que ficam com quem constrói

- Gráficos feitos à mão em SVG, sem biblioteca, para o app continuar leve e funcionar offline.
- Cores dos três tipos: entrada em verde, saída em coral e investimento num terceiro tom da paleta atual.
- Onde cada dica de exemplos aparece no formulário.
