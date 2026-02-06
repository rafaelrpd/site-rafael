# Configuração do Cloudflare - rafaeldias-mail-router

Guia completo para configurar Workers, Email Routing, Turnstile e Resend.

## 1. Cloudflare Workers

### Acessar Workers

1. Cloudflare Dashboard → **Workers & Pages**

### Criar KV Namespaces

1. Na sidebar esquerda, clique em **KV**
2. Clique em **Create a namespace**

#### Namespace THREADS

1. **Namespace Name**: `rafaeldias-mail-threads`
2. Clique em **Add**
3. Copie o **ID** exibido (ex: `abc123...`)
4. No arquivo `worker-mail/wrangler.jsonc`, substitua:
   ```
   <<<KV_THREADS_ID>>> → ID copiado
   ```

#### Namespace RATE

1. Clique em **Create a namespace**
2. **Namespace Name**: `rafaeldias-mail-rate`
3. Clique em **Add**
4. Copie o **ID**
5. No arquivo `worker-mail/wrangler.jsonc`, substitua:
   ```
   <<<KV_RATE_ID>>> → ID copiado
   ```

### Configurar Secrets do Worker

Execute no terminal (dentro de `worker-mail/`):

```bash
cd worker-mail
npx wrangler secret put TURNSTILE_SECRET
# Cole o secret do Turnstile quando solicitado

npx wrangler secret put RESEND_API_KEY
# Cole sua API key do Resend

npx wrangler secret put RESEND_FROM_EMAIL
# Cole: contact@rafaeldias.net (ou Rafael <contact@rafaeldias.net>)
```

---

## 2. Email Routing

### Acessar Email Routing

1. Cloudflare Dashboard → Selecione o domínio **rafaeldias.net**
2. Na sidebar, clique em **Email** → **Email Routing**

### Habilitar Email Routing

Se ainda não estiver habilitado:
1. Clique em **Enable Email Routing**
2. Siga as instruções para adicionar os registros MX necessários

### Verificar Destination Email

1. Na aba **Destination addresses**
2. Clique em **Add destination address**
3. Digite seu Gmail: (o que substituirá `<<<DESTINATION_GMAIL_EMAIL>>>`)
4. Clique em **Add**
5. Verifique seu email e clique no link de confirmação

### Criar Routing Rules

#### Rule 1: contact@rafaeldias.net → Forward para Gmail

1. Na aba **Routing rules**
2. Clique em **Create address**
3. Configure:
   - **Custom address**: `contact`
   - **Action**: Forward to
   - **Destination**: Selecione seu Gmail verificado
4. Clique em **Save**

#### Rule 2: reply@rafaeldias.net → Worker

1. Clique em **Create address**
2. Configure:
   - **Custom address**: `reply`
   - **Action**: Send to a Worker
   - **Destination**: Selecione `rafaeldias-mail-router`
3. Clique em **Save**

### Habilitar Subaddressing (+)

O subaddressing permite que `reply+TOKEN@rafaeldias.net` seja roteado para `reply@rafaeldias.net`.

1. Na aba **Settings** do Email Routing
2. Procure por **Subaddressing** ou **Plus addressing**
3. Certifique-se de que está **habilitado**

> **Nota**: O Cloudflare Email Routing suporta subaddressing nativamente para custom addresses. Emails enviados para `reply+qualquercoisa@rafaeldias.net` serão roteados para a regra de `reply@rafaeldias.net`.

---

## 3. Turnstile (Captcha)

### Acessar Turnstile

1. Cloudflare Dashboard → **Turnstile** (menu lateral ou pesquise)

### Criar Widget

1. Clique em **Add site**
2. Configure:
   - **Site name**: `rafaeldias.net`
   - **Hostname(s)**:
     - `rafaeldias.net`
     - `www.rafaeldias.net`
     - `localhost` (para testes locais)
   - **Widget Mode**: `Managed` (recomendado)
3. Clique em **Create**

### Obter Keys

Após criar:
- **Site Key**: Copie e substitua `<<<TURNSTILE_SITE_KEY>>>` no snippet do formulário
- **Secret Key**: Use para `wrangler secret put TURNSTILE_SECRET`

---

## 4. Resend (DNS Verification)

### Criar Conta e Obter API Key

1. Acesse resend.com e crie uma conta
2. Vá para **Settings** → **API Keys**
3. Clique em **Create API Key**
4. Configure:
   - **Name**: `rafaeldias-mail-router`
   - **Permission**: `Sending access`
   - **Domain access**: `rafaeldias.net` (ou Full access se preferir)
5. Copie a API Key (só aparece uma vez!)

### Adicionar e Verificar Domínio

1. Vá para **Domains**
2. Clique em **Add domain**
3. Digite: `rafaeldias.net`
4. O Resend mostrará registros DNS necessários

### Adicionar Registros DNS no Cloudflare

1. Cloudflare Dashboard → **rafaeldias.net** → **DNS** → **Records**

#### Registros do Resend (exemplo típico):

| Tipo | Nome | Conteúdo | Proxy |
|------|------|----------|-------|
| TXT | `resend._domainkey` | (valor fornecido pelo Resend) | DNS only |
| CNAME | `resend.rafaeldias.net` | (valor fornecido pelo Resend) | DNS only |

> **Importante**: Use exatamente os valores que o Resend fornecer. Os nomes e valores podem variar.

> **Atenção**: NÃO altere os registros MX que o Email Routing configurou!

### Verificar no Resend

1. Após adicionar os registros, volte ao Resend
2. Clique em **Verify**
3. A verificação pode levar alguns minutos
4. Status deve mudar para **Verified**

---

## 5. Substituir Placeholders

Após todas as configurações, atualize `worker-mail/wrangler.jsonc`:

| Placeholder | Substituir por |
|-------------|----------------|
| `<<<KV_THREADS_ID>>>` | ID do namespace THREADS |
| `<<<KV_RATE_ID>>>` | ID do namespace RATE |
| `<<<ADMIN_GMAIL_EMAIL>>>` | Seu Gmail (para allowlist) |
| `<<<DESTINATION_GMAIL_EMAIL>>>` | Gmail que recebe notificações |
| `<<<ALLOWED_ORIGINS>>>` | `https://rafaeldias.net,https://www.rafaeldias.net` |

Atualize o snippet do formulário:

| Placeholder | Substituir por |
|-------------|----------------|
| `<<<TURNSTILE_SITE_KEY>>>` | Site Key do Turnstile |

---

## 6. Deploy Inicial

Após configurar tudo:

```bash
cd worker-mail
npm install
npm run typecheck

# Deploy manual para primeiro teste
npx wrangler deploy
```

Verifique no Cloudflare Dashboard → Workers & Pages que:
- O worker `rafaeldias-mail-router` está listado
- A route `rafaeldias.net/api/*` está configurada

---

## Resumo de Configurações

| Serviço | O que fazer |
|---------|-------------|
| **Workers** | KV namespaces + Secrets |
| **Email Routing** | Destination + Rules + Subaddressing |
| **Turnstile** | Criar widget |
| **Resend** | Verificar domínio + API key |
| **DNS** | Registros DKIM do Resend |
