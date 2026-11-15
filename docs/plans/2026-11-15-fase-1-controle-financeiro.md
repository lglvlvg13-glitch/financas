# Fase 1 — Controle Financeiro: Plano de Implementação

> **Para quem implementa:** siga este plano tarefa por tarefa (executing-plans). Os passos usam caixas `- [ ]` para acompanhar o progresso.

**Objetivo:** um web app instalável em que o casal entra com a conta Google da família, lança receitas, despesas e compras no cartão, vê faturas e o resumo do mês, com os dados guardados no Google Drive e sincronizados entre aparelhos, inclusive offline.

**Arquitetura:** SPA em React que roda inteira no navegador. O IndexedDB do aparelho é a fonte local; um único arquivo JSON no Drive é a cópia compartilhada. A sincronização baixa o arquivo, junta registro a registro (vence a alteração mais recente, exclusões viram "lápides") e regrava. Regras de negócio ficam em funções puras em `src/domain`, testadas sem navegador.

**Stack:** Vite 6 + React 18 + TypeScript (strict), Dexie 4 (IndexedDB), Google Identity Services (token client), Google Drive REST v3 via `fetch`, vite-plugin-pwa, Vitest + Testing Library + fake-indexeddb, GitHub Pages via GitHub Actions.

**Spec:** `docs/specs/2026-11-15-app-financas-familia-design.md` (documento completo: https://claude.ai/artifact/LUJNH26ToL5FvombfF7muq)

## Restrições Globais

- Textos da interface em português do Brasil; moeda R$ formatada como `R$ 1.234,56`.
- Dinheiro sempre em **centavos inteiros** (`number`, sem frações). Datas como string ISO `YYYY-MM-DD`; meses como `YYYY-MM`.
- Perfis: ids fixos `'u1'` e `'u2'`, nomes padrão `"Usuário 1"` e `"Usuário 2"`, renomeáveis.
- Escopo OAuth único: `https://www.googleapis.com/auth/drive.file`. Nenhum outro escopo.
- Pasta no Drive: `Finanças da Família`; arquivo de dados: `financas.json` dentro dela.
- Nenhum servidor próprio, nenhum segredo no código. O Client ID do Google vem de `VITE_GOOGLE_CLIENT_ID`.
- Todo registro de dados carrega `updatedAt` (ms desde epoch), `updatedBy` (`'u1' | 'u2'`) e `deletedAt?` (lápide). Nada é apagado fisicamente.
- O app funciona sem internet; sincroniza quando a conexão volta.

## Pontos de Atenção na Revisão

1. **Dois aparelhos lançam ao mesmo tempo** → nenhum lançamento some. Teste: `merge.test.ts › "registros novos dos dois lados sobrevivem"` (Tarefa 2) e `sync.test.ts › "upload concorrente é recuperado na próxima sincronização"` (Tarefa 7).
2. **Compra no dia exato do fechamento do cartão** → vai para a fatura seguinte. Teste: `invoice.test.ts › "compra no dia do fechamento vai para o mês seguinte"` (Tarefa 4).
3. **Dia de fechamento 31 em mês curto** (fevereiro) → usa o último dia do mês. Teste: `invoice.test.ts › "fechamento 31 em fevereiro usa dia 28"` (Tarefa 4).
4. **Parcelamento que não divide exato** (R$ 100,00 em 3x) → parcelas somam exatamente o total, a diferença de centavos na 1ª. Teste: `installments.test.ts › "100,00 em 3x = 33,34 + 33,33 + 33,33"` (Tarefa 4).
5. **Token do Google expirado no meio do uso** → o app pede login de novo sem perder o que foi lançado offline. Teste: `sync.test.ts › "401 marca necessidade de login e mantém dados locais"` (Tarefa 7).

---

## Estrutura de Arquivos

```
src/
  domain/            regras puras, sem React nem navegador
    money.ts         centavos ⇄ texto R$
    dates.ts         meses, dias, último dia do mês
    types.ts         tipos de todos os registros e do documento
    merge.ts         junção de dois documentos (LWW + lápides)
    invoice.ts       fatura de cartão: mês de fechamento, parcelas, totais
    summary.ts       recorrências e resumo do mês
    defaults.ts      categorias e perfis iniciais
  data/
    db.ts            Dexie: tabelas e repositório
  google/
    auth.ts          Google Identity Services (token)
    drive.ts         cliente REST do Drive
  sync/
    sync.ts          motor de sincronização
  ui/                telas React
    App.tsx, Onboarding.tsx, Transactions.tsx, TransactionForm.tsx,
    Cards.tsx, Accounts.tsx, Categories.tsx, Summary.tsx, Settings.tsx
  main.tsx
tests/               espelha src/
```

---

### Tarefa 1: Projeto, dinheiro e datas

**Arquivos:**
- Criar: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx` (renderiza "Finanças da Família"), `.gitignore`
- Criar: `src/domain/money.ts`, `src/domain/dates.ts`
- Teste: `tests/domain/money.test.ts`, `tests/domain/dates.test.ts`

**Interfaces:**
- Produz: `formatBRL(cents: number): string`, `parseBRL(text: string): number | null`, `splitCents(total: number, parts: number): number[]`
- Produz: `addMonths(month: string, n: number): string`, `monthOf(date: string): string`, `lastDayOfMonth(month: string): number`, `clampDay(month: string, day: number): string` (retorna a data `YYYY-MM-DD`)

- [ ] **Passo 1: Criar o projeto** — `npm create vite@latest . -- --template react-ts`, depois `npm i dexie` e `npm i -D vitest @testing-library/react @testing-library/user-event jsdom fake-indexeddb vite-plugin-pwa`. Script `"test": "vitest run"`, ambiente `jsdom`.

- [ ] **Passo 2: Testes que falham**

```ts
test('formata centavos em reais', () => {
  expect(formatBRL(123456)).toBe('R$ 1.234,56');
  expect(formatBRL(-500)).toBe('-R$ 5,00');
  expect(formatBRL(0)).toBe('R$ 0,00');
});
test('lê texto digitado', () => {
  expect(parseBRL('1.234,56')).toBe(123456);
  expect(parseBRL('R$ 10')).toBe(1000);
  expect(parseBRL('10,5')).toBe(1050);
  expect(parseBRL('abc')).toBeNull();
});
test('splitCents põe a sobra nas primeiras partes', () => {
  expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
  expect(splitCents(9, 2)).toEqual([5, 4]);
});
test('datas', () => {
  expect(addMonths('2026-11', 3)).toBe('2027-02');
  expect(addMonths('2026-01', -1)).toBe('2025-12');
  expect(monthOf('2026-11-15')).toBe('2026-11');
  expect(lastDayOfMonth('2026-02')).toBe(28);
  expect(lastDayOfMonth('2028-02')).toBe(29);
  expect(clampDay('2026-02', 31)).toBe('2026-02-28');
});
```

- [ ] **Passo 3: Rodar e ver falhar** — `npm test` → FAIL (funções inexistentes).
- [ ] **Passo 4: Implementar** `money.ts` e `dates.ts`. `formatBRL` usa `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})` e normaliza o espaço não separável para espaço comum. Datas por aritmética de string/número, nunca `Date` com fuso local.
- [ ] **Passo 5: Rodar** — `npm test` → PASS; `npm run build` sem erros.
- [ ] **Passo 6: Commit** — `git commit -m "feat: projeto base, dinheiro e datas"`

---

### Tarefa 2: Tipos e junção de documentos

**Arquivos:**
- Criar: `src/domain/types.ts`, `src/domain/merge.ts`, `src/domain/defaults.ts`
- Teste: `tests/domain/merge.test.ts`

**Interfaces:**
- Produz (`types.ts`):

```ts
export type ProfileId = 'u1' | 'u2';
export interface Meta { id: string; updatedAt: number; updatedBy: ProfileId; deletedAt?: number }
export interface Profile extends Meta { id: ProfileId; name: string }
export interface Account extends Meta { name: string; kind: 'corrente' | 'poupanca' | 'carteira'; initialBalanceCents: number }
export interface Category extends Meta { name: string; kind: 'receita' | 'despesa'; monthlyBudgetCents?: number; system?: boolean }
export interface Card extends Meta { name: string; limitCents: number; closingDay: number; dueDay: number }
export interface Transaction extends Meta {
  kind: 'receita' | 'despesa';
  amountCents: number;          // sempre positivo
  date: string;                 // YYYY-MM-DD (data da compra)
  categoryId: string;
  profileId: ProfileId;
  accountId?: string;           // obrigatório se não houver cardId
  cardId?: string;              // compra no cartão
  invoiceMonth?: string;        // YYYY-MM, calculado na gravação para compras no cartão
  installment?: { groupId: string; n: number; total: number };
  cardPayment?: { cardId: string; invoiceMonth: string };  // pagamento de fatura
  recurrenceId?: string;
  note?: string;
}
export interface Recurrence extends Meta {
  template: Omit<Transaction, keyof Meta | 'date' | 'recurrenceId' | 'invoiceMonth' | 'installment'>;
  dayOfMonth: number; startMonth: string; endMonth?: string;
}
export type Collection = 'profiles' | 'accounts' | 'categories' | 'cards' | 'transactions' | 'recurrences';
export interface DataDoc { schemaVersion: 1; records: { [C in Collection]: Record<string, Meta & Record<string, unknown>> } }
export const emptyDoc: () => DataDoc;
```

- Produz (`merge.ts`): `mergeDocs(a: DataDoc, b: DataDoc): DataDoc` — por coleção e por id, fica o registro de maior `updatedAt`; empate → maior `updatedBy` em ordem alfabética (determinístico). Lápides entram na disputa como qualquer alteração.
- Produz (`defaults.ts`): `defaultProfiles(now: number): Profile[]` (u1 "Usuário 1", u2 "Usuário 2"); `defaultCategories(now: number): Category[]` com ids fixos: receitas `cat-salario` "Salário", `cat-outras-receitas` "Outras receitas"; despesas `cat-moradia` "Moradia", `cat-alimentacao` "Alimentação", `cat-transporte` "Transporte", `cat-saude` "Saúde", `cat-educacao` "Educação", `cat-lazer` "Lazer", `cat-assinaturas` "Assinaturas", `cat-outros` "Outros", e `cat-pagamento-fatura` "Pagamento de fatura" com `system: true`.

- [ ] **Passo 1: Testes que falham** (`merge.test.ts`):
  - `"registros novos dos dois lados sobrevivem"`: A tem `t1`, B tem `t2` → resultado tem `t1` e `t2`.
  - `"vence a alteração mais recente"`: mesmo `t1`, A `updatedAt: 100, amountCents: 500`, B `updatedAt: 200, amountCents: 900` → `900`.
  - `"exclusão mais recente vence edição antiga"`: A `t1` com `deletedAt: 300, updatedAt: 300`; B `t1` editado `updatedAt: 200` → resultado tem `deletedAt: 300`.
  - `"edição posterior à exclusão revive o registro"`: inverso, edição `updatedAt: 400` vence lápide de `300` → sem `deletedAt`.
  - `"merge é comutativo"`: `mergeDocs(a,b)` deep-equal `mergeDocs(b,a)`, inclusive no empate de `updatedAt`.
  - `"categorias padrão têm ids fixos"`: dois aparelhos que criam os padrões separadamente geram os mesmos ids (não duplicam após merge).
- [ ] **Passo 2: Rodar e ver falhar.**
- [ ] **Passo 3: Implementar** `types.ts`, `merge.ts`, `defaults.ts`.
- [ ] **Passo 4: Rodar** → PASS.
- [ ] **Passo 5: Commit** — `"feat: modelo de dados e junção de documentos"`

---

### Tarefa 3: Banco local (IndexedDB)

**Arquivos:**
- Criar: `src/data/db.ts`
- Teste: `tests/data/db.test.ts` (com `import 'fake-indexeddb/auto'`)

**Interfaces:**
- Consome: `DataDoc`, `Collection`, `Meta`, `mergeDocs`, `defaultProfiles`, `defaultCategories` (Tarefa 2)
- Produz:
  - `class Repo { constructor(dbName?: string) }`
  - `repo.put<T extends Meta>(c: Collection, rec: Omit<T, 'updatedAt' | 'updatedBy'> & { id?: string }, by: ProfileId): Promise<T>` — gera `id` com `crypto.randomUUID()` se faltar, carimba `updatedAt = Date.now()` e `updatedBy`, marca o banco como "sujo".
  - `repo.remove(c: Collection, id: string, by: ProfileId): Promise<void>` — grava lápide.
  - `repo.list<T>(c: Collection): Promise<T[]>` — sem lápides.
  - `repo.exportDoc(): Promise<DataDoc>` — com lápides.
  - `repo.importDoc(remote: DataDoc): Promise<void>` — grava `mergeDocs(local, remote)`.
  - `repo.isDirty(): Promise<boolean>`, `repo.markClean(): Promise<void>`
  - `repo.ensureDefaults(by: ProfileId): Promise<void>` — cria perfis e categorias padrão só se ainda não existem.
  - Configuração do aparelho (não sincronizada, tabela `device`): `repo.getDevice(): Promise<{ profileId?: ProfileId; dataFileId?: string; folderId?: string }>`, `repo.setDevice(patch): Promise<void>`

- [ ] **Passo 1: Testes que falham:**
  - `"put gera id e carimbo"`: `put('accounts', {name:'Nubank', kind:'corrente', initialBalanceCents:0}, 'u1')` → `id` não vazio, `updatedBy:'u1'`, `isDirty()` true.
  - `"remove esconde da lista mas exporta lápide"`.
  - `"importDoc junta com o local"`: local `t1`, remoto `t2` → `list('transactions')` tem os dois.
  - `"ensureDefaults é idempotente"`: duas chamadas → 2 perfis, 11 categorias.
  - `"device não entra no exportDoc"`.
- [ ] **Passo 2: Ver falhar.** **Passo 3: Implementar** com Dexie (uma tabela por coleção, chave `id`; tabela `device`; tabela `state` com `dirty`). **Passo 4: PASS.** **Passo 5: Commit** — `"feat: banco local com Dexie"`

---

### Tarefa 4: Cartões, faturas e parcelas

**Arquivos:**
- Criar: `src/domain/invoice.ts`
- Teste: `tests/domain/invoice.test.ts`, `tests/domain/installments.test.ts`

**Interfaces:**
- Consome: `splitCents`, `addMonths`, `monthOf`, `clampDay` (Tarefa 1); `Card`, `Transaction` (Tarefa 2)
- Produz:
  - `invoiceMonthFor(purchaseDate: string, closingDay: number): string` — mês (`YYYY-MM`) em que a fatura **fecha**. Compra com dia ≥ dia efetivo de fechamento daquele mês → mês seguinte; senão, o mesmo mês. Dia efetivo = `min(closingDay, lastDayOfMonth)`.
  - `dueDateFor(invoiceMonth: string, card: Card): string` — vencimento no `dueDay` do mesmo mês se `dueDay > closingDay`, senão no mês seguinte; dia ajustado com `clampDay`.
  - `buildInstallments(base: Omit<Transaction, keyof Meta | 'installment' | 'invoiceMonth'> & {cardId: string}, card: Card, count: number, groupId: string): Array<Omit<Transaction, keyof Meta>>` — `count` lançamentos, valores de `splitCents`, mesma `date` da compra, `invoiceMonth` da parcela k = `invoiceMonthFor(date) + (k-1)` meses, `installment: {groupId, n:k, total:count}`.
  - `invoiceSummary(card: Card, month: string, txs: Transaction[]): { totalCents: number; paidCents: number; dueDate: string; items: Transaction[] }` — compras com `cardId` e `invoiceMonth === month`; pagos = despesas com `cardPayment` daquele cartão e mês.
  - `limitUsedCents(card: Card, txs: Transaction[]): number` — soma de todas as compras (todas as parcelas, inclusive futuras) menos todos os pagamentos daquele cartão.

- [ ] **Passo 1: Testes que falham** (cartão `closingDay: 5, dueDay: 15` salvo indicação):
  - `"compra antes do fechamento fica no mês"`: `invoiceMonthFor('2026-11-03', 5)` → `'2026-11'`.
  - `"compra no dia do fechamento vai para o mês seguinte"`: `('2026-11-05', 5)` → `'2026-12'`.
  - `"fechamento 31 em fevereiro usa dia 28"`: `('2026-02-28', 31)` → `'2026-03'`; `('2026-02-27', 31)` → `'2026-02'`.
  - `"vencimento no mesmo mês ou no seguinte"`: `dueDateFor('2026-11', {closingDay:5, dueDay:15})` → `'2026-11-15'`; `{closingDay:28, dueDay:5}` → `'2026-12-05'`.
  - `"100,00 em 3x = 33,34 + 33,33 + 33,33"` (installments.test): valores `[3334,3333,3333]`, `invoiceMonth` `2026-11`, `2026-12`, `2027-01` para compra em `2026-11-03`.
  - `"fatura soma compras do mês e desconta pagamentos"`: duas compras de 5000 e 2500 em `2026-11`, um pagamento de 7500 → `totalCents 7500, paidCents 7500`.
  - `"limite usado inclui parcelas futuras"`: compra 3x de 30000 → `limitUsedCents` = 30000 antes de qualquer pagamento.
- [ ] **Passo 2: Ver falhar.** **Passo 3: Implementar.** **Passo 4: PASS.** **Passo 5: Commit** — `"feat: faturas e parcelamento de cartão"`

---

### Tarefa 5: Recorrências e resumo do mês

**Arquivos:**
- Criar: `src/domain/summary.ts`
- Teste: `tests/domain/summary.test.ts`

**Interfaces:**
- Consome: Tarefas 1, 2 e 4
- Produz:
  - `dueRecurrences(recs: Recurrence[], month: string, existing: Transaction[]): Array<Omit<Transaction, keyof Meta>>` — para cada recorrência ativa no mês (entre `startMonth` e `endMonth`, sem lápide), gera o lançamento do mês com `date = clampDay(month, dayOfMonth)` e `recurrenceId`, **exceto** se já existir um lançamento não excluído com o mesmo `recurrenceId` naquele mês.
  - `monthSummary(month: string, data: {transactions: Transaction[]; categories: Category[]; accounts: Account[]}, profile?: ProfileId): { incomeCents: number; expenseCents: number; balanceCents: number; byCategory: Array<{categoryId: string; spentCents: number; budgetCents?: number}>; byProfile: Record<ProfileId, {incomeCents: number; expenseCents: number}> }`
  - Regra de competência: compras no cartão contam no mês da **data da compra** (parcelas: no mês do seu `invoiceMonth`); pagamentos de fatura (`cardPayment`) **não** contam como despesa no resumo (evita contar duas vezes). Lápides ignoradas. Com `profile`, só os lançamentos daquele perfil.
  - `accountBalanceCents(account: Account, txs: Transaction[]): number` — saldo inicial + receitas − despesas da conta (inclui pagamentos de fatura feitos por ela).

- [ ] **Passo 1: Testes que falham:**
  - `"recorrência gera lançamento no dia certo"`: aluguel dia 31, mês `2026-02` → data `2026-02-28`.
  - `"recorrência não duplica"`: já existe lançamento com o `recurrenceId` em `2026-11` → nada gerado.
  - `"recorrência encerrada não gera"`: `endMonth: '2026-10'`, mês `2026-11` → vazio.
  - `"pagamento de fatura não conta duas vezes"`: compra 10000 no cartão + pagamento 10000 → `expenseCents` 10000.
  - `"resumo por perfil"`: u1 gasta 3000, u2 gasta 2000 → `byProfile.u1.expenseCents` 3000; com `profile:'u2'` → `expenseCents` 2000.
  - `"orçamento por categoria"`: categoria com `monthlyBudgetCents: 50000` aparece em `byCategory` com `budgetCents 50000`.
  - `"saldo da conta"`: inicial 100000, receita 50000, despesa 20000, pagamento de fatura 10000 → 120000.
- [ ] **Passo 2: Ver falhar.** **Passo 3: Implementar.** **Passo 4: PASS.** **Passo 5: Commit** — `"feat: recorrências e resumo do mês"`

---

### Tarefa 6: Login Google e cliente do Drive

**Arquivos:**
- Criar: `src/google/auth.ts`, `src/google/drive.ts`
- Teste: `tests/google/drive.test.ts` (com `fetch` falso injetado)

**Interfaces:**
- Produz (`auth.ts`):
  - `loadGis(): Promise<void>` — injeta `https://accounts.google.com/gsi/client` uma vez.
  - `requestToken(clientId: string, opts?: {prompt?: '' | 'consent'}): Promise<{accessToken: string; expiresAt: number}>` — `google.accounts.oauth2.initTokenClient` com escopo `drive.file`. Token só em memória (não gravar em disco).
- Produz (`drive.ts`): `class DriveClient { constructor(getToken: () => Promise<string>, fetchFn = fetch) }`
  - `ensureFolder(name = 'Finanças da Família'): Promise<string>` — procura (`q: name='…' and mimeType='application/vnd.google-apps.folder' and trashed=false`), cria se não houver; retorna id.
  - `findOrCreateFile(folderId: string, name = 'financas.json', initial: DataDoc): Promise<string>`
  - `download(fileId: string): Promise<DataDoc>` — `GET files/{id}?alt=media`
  - `upload(fileId: string, doc: DataDoc): Promise<void>` — `PATCH upload/drive/v3/files/{id}?uploadType=media`, `Content-Type: application/json`
  - Erros: lança `AuthError` em HTTP 401/403, `NetworkError` quando `fetch` rejeita; ambos exportados.

- [ ] **Passo 1: Testes que falham:**
  - `"ensureFolder reutiliza pasta existente"`: busca responde `{files:[{id:'F1'}]}` → retorna `'F1'` e não faz POST.
  - `"ensureFolder cria quando não existe"`: busca vazia → POST com `mimeType` de pasta; retorna id criado.
  - `"upload envia JSON com token"`: header `Authorization: Bearer TOKEN`, corpo = `JSON.stringify(doc)`.
  - `"401 vira AuthError"`; `"fetch rejeitado vira NetworkError"`.
  - `"nome da pasta com apóstrofo é escapado na busca"` (`q` com `\'`).
- [ ] **Passo 2: Ver falhar.** **Passo 3: Implementar** (`auth.ts` sem teste automatizado: é o adaptador fino do script do Google; verificado no Passo 5). **Passo 4: PASS.**
- [ ] **Passo 5: Verificação manual** — com um Client ID de teste e `npm run dev`, entrar e confirmar que a pasta "Finanças da Família" e `financas.json` aparecem no Drive.
- [ ] **Passo 6: Commit** — `"feat: login Google e cliente do Drive"`

---

### Tarefa 7: Motor de sincronização

**Arquivos:**
- Criar: `src/sync/sync.ts`
- Teste: `tests/sync/sync.test.ts`

**Interfaces:**
- Consome: `Repo` (Tarefa 3), `DriveClient`, `AuthError`, `NetworkError` (Tarefa 6), `mergeDocs` (Tarefa 2)
- Produz:
  - `type SyncStatus = 'ok' | 'offline' | 'precisa-login' | 'sincronizando'`
  - `syncOnce(repo: Repo, drive: Pick<DriveClient,'download'|'upload'>, fileId: string): Promise<SyncStatus>` — baixa → `repo.importDoc(remoto)` → `repo.exportDoc()` → envia → `markClean`. Em `NetworkError` → `'offline'`; em `AuthError` → `'precisa-login'`; dados locais nunca são descartados.
  - `startAutoSync(run: () => Promise<SyncStatus>, onStatus: (s: SyncStatus) => void): () => void` — sincroniza ao abrir, a cada 60 s, no evento `online` e 2 s depois de cada gravação (debounce); retorna função para parar.

- [ ] **Passo 1: Testes que falham** (Drive falso em memória):
  - `"envia lançamentos locais"`: local `t1` → arquivo remoto passa a ter `t1`.
  - `"traz lançamentos do outro aparelho"`: remoto `t2` → `repo.list` tem `t2`.
  - `"upload concorrente é recuperado na próxima sincronização"`: aparelho A e B sincronizam intercalados de modo que o upload de B sobrescreve o de A; após nova sincronização de A, o remoto tem `tA` e `tB`.
  - `"401 marca necessidade de login e mantém dados locais"`: download lança `AuthError` → status `'precisa-login'`, `repo.list` inalterado, `isDirty` continua true.
  - `"sem rede fica offline e tenta depois"`: `NetworkError` → `'offline'`.
- [ ] **Passo 2: Ver falhar.** **Passo 3: Implementar.** **Passo 4: PASS.** **Passo 5: Commit** — `"feat: sincronização com o Drive"`

---

### Tarefa 8: Primeiro uso e configurações

**Arquivos:**
- Criar: `src/ui/App.tsx`, `src/ui/Onboarding.tsx`, `src/ui/Settings.tsx`, `src/ui/context.tsx` (provê `repo`, `profileId`, `syncStatus`)
- Teste: `tests/ui/onboarding.test.tsx`

**Comportamento:**
1. Sem token na sessão → tela "Entrar com Google" (botão). Ao entrar: `ensureFolder` → `findOrCreateFile` → guarda ids em `repo.setDevice` → `syncOnce` → `ensureDefaults`.
2. Sem `profileId` no aparelho → "Quem é você?" com dois botões, com os nomes atuais dos perfis.
3. Configurações: renomear os dois perfis (nome não vazio, até 30 caracteres), trocar "Quem é você" neste aparelho, botão "Sincronizar agora", indicador do status (`ok` "Sincronizado", `offline` "Sem internet — salvo no aparelho", `precisa-login` "Entre de novo para sincronizar").

- [ ] **Passo 1: Testes que falham** (Google e Drive substituídos por falsos):
  - `"mostra Quem é você depois do login"` e grava `profileId` escolhido.
  - `"renomear perfil atualiza o botão"`: renomeia u1 para "Ana" → botão mostra "Ana".
  - `"nome vazio não é aceito"`.
- [ ] **Passo 2–4:** ver falhar, implementar, PASS. **Passo 5: Commit** — `"feat: primeiro uso e configurações"`

---

### Tarefa 9: Lançamentos, contas e categorias

**Arquivos:**
- Criar: `src/ui/Transactions.tsx`, `src/ui/TransactionForm.tsx`, `src/ui/Accounts.tsx`, `src/ui/Categories.tsx`
- Teste: `tests/ui/transactions.test.tsx`

**Comportamento:**
- Lista do mês (setas mês anterior/seguinte), mais recente primeiro, com valor, categoria, perfil e conta/cartão; filtro Todos / perfil 1 / perfil 2.
- Formulário: tipo (receita/despesa), valor (`parseBRL`), data (hoje por padrão), categoria (filtrada pelo tipo), forma (conta ou cartão), parcelas (só cartão, 1–24), "repetir todo mês" (cria `Recurrence`), observação. O perfil é o do aparelho.
- Compra no cartão parcelada → `buildInstallments`; editar/excluir uma parcela pergunta "só esta" ou "todas as parcelas".
- Ao abrir o mês, `dueRecurrences` gera os lançamentos recorrentes pendentes.
- Contas: criar/editar/excluir, saldo atual (`accountBalanceCents`). Categorias: criar/editar/excluir (exceto `system`), orçamento mensal opcional.

- [ ] **Passo 1: Testes que falham:**
  - `"valor inválido bloqueia o salvar"` ("abc" → mensagem "Valor inválido").
  - `"compra 3x no cartão cria 3 lançamentos"`.
  - `"lançamento recebe o perfil do aparelho"`.
  - `"excluir todas as parcelas grava 3 lápides"`.
  - `"categoria do sistema não pode ser excluída"`.
- [ ] **Passo 2–4:** ver falhar, implementar, PASS. **Passo 5: Commit** — `"feat: lançamentos, contas e categorias"`

---

### Tarefa 10: Cartões e faturas (telas)

**Arquivos:**
- Criar: `src/ui/Cards.tsx`
- Teste: `tests/ui/cards.test.tsx`

**Comportamento:**
- Cadastro de cartão: nome, limite, dia de fechamento (1–31), dia de vencimento (1–31).
- Por cartão: fatura do mês escolhido (`invoiceSummary`) com itens, total, vencimento e situação ("aberta", "fechada", "paga" quando `paidCents >= totalCents`); limite usado e disponível (`limitUsedCents`).
- "Pagar fatura": escolhe conta e valor (padrão: restante) → lançamento despesa em `cat-pagamento-fatura` com `cardPayment`.

- [ ] **Passo 1: Testes que falham:** `"fatura mostra total e vencimento"`, `"pagar fatura marca como paga"`, `"dia de fechamento 0 ou 32 é recusado"`.
- [ ] **Passo 2–4:** ver falhar, implementar, PASS. **Passo 5: Commit** — `"feat: telas de cartões e faturas"`

---

### Tarefa 11: Resumo do mês

**Arquivos:**
- Criar: `src/ui/Summary.tsx` (tela inicial após o login)
- Teste: `tests/ui/summary.test.tsx`

**Comportamento:** entradas, saídas e sobra do mês (`monthSummary`); gastos por categoria com barra do orçamento (vermelha acima de 100%); comparação Usuário 1 × Usuário 2; próximas faturas a vencer; filtro por perfil.

- [ ] **Passo 1: Testes que falham:** `"mostra sobra do mês"`, `"categoria acima do orçamento fica destacada"`, `"filtro por perfil muda os totais"`.
- [ ] **Passo 2–4:** ver falhar, implementar, PASS. **Passo 5: Commit** — `"feat: resumo do mês"`

---

### Tarefa 12: App instalável, publicação e guia de configuração

**Arquivos:**
- Modificar: `vite.config.ts` (vite-plugin-pwa: nome "Finanças da Família", `display: standalone`, ícones 192 e 512, cache dos arquivos do app; `base: '/<nome-do-repositório>/'`)
- Criar: `public/icon-192.png`, `public/icon-512.png`, `.github/workflows/deploy.yml` (build com `VITE_GOOGLE_CLIENT_ID` de um *secret* do repositório e publicação no GitHub Pages), `README.md` em português
- Teste: verificação de build e manual

**README — guia passo a passo para o casal:**
1. Criar a conta Google da família.
2. Criar conta no GitHub e um repositório com este código.
3. No Google Cloud Console: criar projeto, ativar a Google Drive API, configurar a tela de consentimento (tipo externo, modo de teste, adicionar o e-mail da família como usuário de teste), criar um Client ID "Aplicativo da Web" com origem autorizada `https://<usuario>.github.io`.
4. Gravar o Client ID no secret `VITE_GOOGLE_CLIENT_ID` do repositório e ativar o GitHub Pages (origem: GitHub Actions).
5. Abrir o endereço no celular e no PC e usar "Instalar app" / "Adicionar à tela inicial".

- [ ] **Passo 1:** `npm run build` → sem erros; `dist/manifest.webmanifest` existe.
- [ ] **Passo 2:** `npm run preview`, abrir no navegador, conferir que o app abre sem internet depois do primeiro acesso (DevTools → Offline).
- [ ] **Passo 3:** `npm test` → todos PASS.
- [ ] **Passo 4: Commit** — `"feat: app instalável, publicação e guia"`

---

## Fora desta fase

Objetivos, diagnóstico e planos (Fase 2); dados de mercado e análises (Fase 3); importação de extratos; gráficos além das barras de orçamento.
