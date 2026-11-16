# App de Finanças Familiares — Documento de Design (resumo)

Documento completo e aprovado em 15/11/2026:
https://claude.ai/artifact/LUJNH26ToL5FvombfF7muq

## Pontos que valem para todo o código

- Web app instalável (PWA), o mesmo código no celular e no PC. Português do Brasil, valores em R$.
- Uma conta Google criada só para a família; os dois entram com ela.
- Perfis "Usuário 1" e "Usuário 2", renomeáveis. Cada aparelho pergunta "Quem é você?" na primeira vez; cada lançamento guarda o perfil.
- Dados no Google Drive dessa conta, numa pasta visível "Finanças da Família". Escopo `drive.file` (o app só vê o que criou). Nunca pedir o Drive inteiro.
- Uso simultâneo sem perder lançamentos; funciona offline e sincroniza depois.
- Sem servidor próprio. Hospedagem gratuita no GitHub Pages. Projeto Google Cloud do casal em modo de teste.
- O app analisa, não recomenda: "dentro do critério" / "fora do critério", nunca "compre"/"venda".

## Fases

1. Controle financeiro: login, Drive, perfis, lançamentos, categorias, contas, cartões e faturas, sincronização e offline.
1.5. Tudo da planilha da família + resumo por período (ver docs/specs/2026-11-16-fase-1-5-planilha-design.md).
2. Planejamento: objetivos, questionário de perfil, diagnóstico, plano de dívidas, plano de reserva.
3. ~~Investimentos~~ — retirada do escopo em 16/11/2026 a pedido do usuário. O app fica só com controle e planejamento; "Investimento" existe apenas como tipo de lançamento (registro do que foi guardado), sem análise de mercado.
