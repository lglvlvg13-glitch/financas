# Finanças da Família

Aplicativo de controle financeiro para o casal. Funciona no celular e no computador, inclusive sem internet, e guarda os dados no Google Drive da conta da família — numa pasta chamada **Finanças da Família**, no arquivo `financas.json`.

O app só enxerga os arquivos que ele mesmo criou no Drive. Ele não lê nem mexe em mais nada da conta.

Esta é a Fase 1: lançamentos, contas, categorias com orçamento, cartões e faturas, parcelamentos, lançamentos recorrentes e o resumo do mês. Tudo pode ser editado e excluído, e toda exclusão pode ser desfeita por 5 segundos.

## Como colocar no ar

A configuração é feita uma vez só, por um dos dois, num computador. Leva cerca de 30 minutos. Nada aqui é pago.

### 1. Crie a conta Google da família

Crie uma conta Gmail nova, só para isso (por exemplo, `financas.sobrenome@gmail.com`). Os dois vão entrar no app com ela. Os dados ficam no Drive dessa conta.

### 2. Coloque o código no GitHub

1. Crie uma conta em [github.com](https://github.com), se ainda não tiver.
2. Crie um repositório novo (pode ser privado), por exemplo `financas`.
3. Envie esta pasta do projeto para ele.

O endereço do app será `https://SEU-USUARIO.github.io/financas/`.

### 3. Libere o login com Google

No [Google Cloud Console](https://console.cloud.google.com), entrando com a conta da família:

1. **Crie um projeto** (menu no topo → Novo projeto), com o nome "Finanças da Família".
2. **Ative a API do Drive**: APIs e serviços → Biblioteca → procure "Google Drive API" → Ativar.
3. **Configure a tela de consentimento** (APIs e serviços → Tela de consentimento OAuth, ou "Google Auth Platform"):
   - Tipo de usuário: **Externo**.
   - Nome do app: "Finanças da Família"; e-mail de suporte: o da família.
   - Em **Acesso a dados / Escopos**, adicione só `.../auth/drive.file` ("Ver, editar, criar e excluir apenas os arquivos do Google Drive que você usa com este app").
   - Em **Público / Usuários de teste**, adicione o e-mail da família. Deixe o app em **modo de teste** — não é preciso publicar nem passar por verificação do Google.
4. **Crie o Client ID**: Credenciais → Criar credenciais → ID do cliente OAuth → tipo **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, coloque `https://SEU-USUARIO.github.io` (sem o `/financas` no fim).
   - Copie o **ID do cliente** que aparece (termina em `.apps.googleusercontent.com`). Ele não é senha; pode ficar no site.

No modo de teste o Google mostra um aviso "O Google não verificou este app" no primeiro login. É esperado: clique em **Continuar**.

### 4. Publique

No repositório do GitHub:

1. Settings → Secrets and variables → Actions → **New repository secret**. Nome: `VITE_GOOGLE_CLIENT_ID`. Valor: o ID do cliente copiado.
2. Settings → Pages → em **Source**, escolha **GitHub Actions**.
3. Aba Actions → "Publicar no GitHub Pages" → **Run workflow** (ou envie qualquer alteração para a branch `main`).

Em uns 2 minutos o app está no endereço `https://SEU-USUARIO.github.io/financas/`.

### 5. Instale nos aparelhos

- **Android (Chrome):** abra o endereço → menu ⋮ → **Instalar app**.
- **iPhone (Safari):** abra o endereço → Compartilhar → **Adicionar à Tela de Início**.
- **Computador (Chrome ou Edge):** abra o endereço → ícone de instalar na barra de endereço.

Em cada aparelho: toque em **Entrar com Google**, use a conta da família e escolha quem é você (Usuário 1 ou Usuário 2). Os nomes podem ser trocados em Ajustes.

## Como funciona a sincronização

- Tudo o que vocês lançam fica salvo primeiro no próprio aparelho, então o app funciona sem internet.
- Com internet, o app sincroniza ao abrir, a cada minuto e logo depois de cada lançamento.
- Se os dois lançarem ao mesmo tempo, nada se perde: o app junta os lançamentos dos dois aparelhos.
- Quando o login do Google expira (cerca de 1 hora), aparece o aviso "Entre de novo para sincronizar". Nada do que foi lançado se perde enquanto isso.

## Para quem for mexer no código

```bash
npm install
npm test           # testes automáticos
npm run dev        # app em http://localhost:5173 (crie um .env.local com VITE_GOOGLE_CLIENT_ID=...)
npm run build      # versão final em dist/
```

Para testar o login localmente, adicione `http://localhost:5173` às origens autorizadas do Client ID.

Feito com React, TypeScript, Vite e IndexedDB (Dexie). Valores guardados em centavos inteiros.
