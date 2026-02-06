# Configuração do GitHub - rafaeldias-mail-router

Este guia descreve como configurar o repositório GitHub para o fluxo de deploy do Worker de e-mail.

## 1. Criar Branch worker-prod

A branch `worker-prod` será usada exclusivamente para deploy do Worker.

### Via GitHub Web

1. Vá até o repositório em github.com
2. Clique no seletor de branch (mostrando "main")
3. Digite `worker-prod` no campo de busca
4. Clique em **Create branch: worker-prod from 'main'**

### Via Terminal

```bash
git checkout main
git pull origin main
git checkout -b worker-prod
git push -u origin worker-prod
```

---

## 2. Configurar Proteção de Branches (Rulesets)

O GitHub mudou de "Branch Protection Rules" para "Rulesets" na nova interface.

### Acessar Rulesets

1. Vá para o repositório no GitHub
2. Clique em **Settings** (aba superior)
3. Na sidebar esquerda, clique em **Rules** → **Rulesets**

### Criar Ruleset para main

1. Clique em **New ruleset** → **New branch ruleset**
2. Configure:
   - **Ruleset Name**: `Proteção main`
   - **Enforcement status**: `Active`

3. Em **Target branches**, clique em **Add target** → **Include by pattern**:
   - Pattern: `main`

4. Em **Branch rules**, ative:
   - ✅ **Restrict deletions**
   - ✅ **Require a pull request before merging**
     - Required approvals: `1`
   - ✅ **Block force pushes**

5. Em **Bypass list** (opcional):
   - Se quiser que admins também precisem de PR, não adicione bypass

6. Clique em **Create**

### Criar Ruleset para worker-prod

1. Clique em **New ruleset** → **New branch ruleset**
2. Configure:
   - **Ruleset Name**: `Proteção worker-prod`
   - **Enforcement status**: `Active`

3. Em **Target branches**, clique em **Add target** → **Include by pattern**:
   - Pattern: `worker-prod`

4. Em **Branch rules**, ative:
   - ✅ **Restrict deletions**
   - ✅ **Require a pull request before merging**
     - Required approvals: `1`
   - ✅ **Require status checks to pass**
     - Clique em **Add checks**
     - Procure e selecione: `TypeCheck Worker` (nome do job no CI)
   - ✅ **Block force pushes**

5. Clique em **Create**

---

## 3. Configurar Secrets do Repositório

Os workflows de deploy precisam de credenciais da Cloudflare.

### Acessar Secrets

1. Vá para o repositório no GitHub
2. Clique em **Settings**
3. Na sidebar, clique em **Secrets and variables** → **Actions**

### Criar Secrets

Clique em **New repository secret** para cada um:

#### CLOUDFLARE_ACCOUNT_ID

1. **Name**: `CLOUDFLARE_ACCOUNT_ID`
2. **Secret**: Seu Account ID da Cloudflare
   - Encontre em: Cloudflare Dashboard → Workers & Pages → Overview → Account ID (sidebar direita)

#### CLOUDFLARE_API_TOKEN

1. **Name**: `CLOUDFLARE_API_TOKEN`
2. **Secret**: Token da API com permissões mínimas

Para criar o token:
1. Vá para Cloudflare Dashboard → **My Profile** (canto superior direito)
2. Clique em **API Tokens** (sidebar)
3. Clique em **Create Token**
4. Escolha **Custom token**
5. Configure:
   - **Token name**: `GitHub Actions - rafaeldias-mail-router`
   - **Permissions**:
     - Account / Workers Scripts / Edit
     - Account / Workers Routes / Edit
     - Account / Workers KV Storage / Edit
     - Zone / Workers Routes / Edit (para a zone rafaeldias.net)
   - **Account Resources**: Include / Sua conta
   - **Zone Resources**: Include / Specific zone / rafaeldias.net

6. Clique em **Continue to summary** → **Create Token**
7. Copie o token (só aparece uma vez!)

---

## 4. Evitar Deploy do Pages para worker-prod

Se o Cloudflare Pages estiver integrado ao repositório via GitHub:

### Verificar Configuração no Cloudflare

1. Cloudflare Dashboard → Workers & Pages
2. Clique no seu projeto Pages (site)
3. Settings → Builds & deployments

### Desabilitar Preview para worker-prod

Em **Branch deployments**:
- Se estiver usando "All non-production branches", mude para:
  - **Production branch**: `main`
  - **Preview branch control**: `Custom branches`
  - **Include branches**: deixe vazio ou especifique branches desejadas (não inclua `worker-prod`)

Alternativamente, em **Include/Exclude**:
- **Exclude branches matching**: `worker-prod`

---

## 5. Fluxo de Trabalho

### Para alterar o Worker

1. Crie uma branch a partir de `worker-prod`:
   ```bash
   git checkout worker-prod
   git pull origin worker-prod
   git checkout -b feature/minha-alteracao
   ```

2. Faça suas alterações em `worker-mail/`

3. Commit e push:
   ```bash
   git add worker-mail/
   git commit -m "feat(worker): minha alteração"
   git push -u origin feature/minha-alteracao
   ```

4. Abra um PR de `feature/minha-alteracao` → `worker-prod`

5. Aguarde o CI passar (TypeCheck Worker)

6. Solicite review e aprove

7. Merge o PR → Deploy automático

### Para alterar o Site

O fluxo do site continua o mesmo (PR para `main`).

---

## Resumo de Acessos Necessários

| Recurso | Caminho no GitHub |
|---------|-------------------|
| Rulesets | Settings → Rules → Rulesets |
| Secrets | Settings → Secrets and variables → Actions |
| Workflows | Actions (aba) |
| Branches | Code → branch selector |
