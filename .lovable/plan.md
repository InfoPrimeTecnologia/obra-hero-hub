# Emails de autenticação via Resend (sem mudança de DNS)

Como o domínio `mestre360.com.br` já está verificado no Resend e fica na Cloudflare, vamos **bypass do sistema de email do Supabase Auth** e implementar os 3 fluxos manualmente usando o connector Resend que já está conectado.

## O que será criado

### 1. Tabela de tokens (`auth_email_tokens`)
Armazena tokens de uso único para os 3 fluxos:
- `id`, `user_id`, `email`, `token_hash` (SHA-256), `type` (`signup` | `recovery` | `magic_link`), `expires_at`, `used_at`, `created_at`
- RLS: apenas service role acessa (todos os fluxos passam pelo backend)
- Índice em `token_hash` + `type` para lookup rápido
- Tokens expiram em 1h (signup/recovery) ou 15min (magic link)

### 2. Server functions (TanStack `createServerFn`)
Em `src/lib/auth-email.functions.ts`:

- **`requestPasswordReset({ email })`** — gera token, salva hash no banco, envia email via Resend com link `/auth/reset-password?token=xxx`
- **`resetPassword({ token, newPassword })`** — valida token, chama `supabase.auth.admin.updateUserById()` com service role, marca token como usado
- **`requestEmailConfirmation({ email })`** — usado após signup; gera token, envia email com link `/auth/confirm?token=xxx`
- **`confirmEmail({ token })`** — valida token e marca `email_confirmed_at` via admin API
- **`requestMagicLink({ email })`** — gera token, envia email com link `/auth/magic-link?token=xxx`
- **`consumeMagicLink({ token })`** — valida token e cria sessão via `generateLink()` admin API

Todas usam Resend através do gateway Lovable (`connector-gateway.lovable.dev/resend`), com `RESEND_API_KEY` e `LOVABLE_API_KEY` que já existem no projeto.

### 3. Páginas novas
- **`/auth/reset-password`** — form de nova senha (lê `?token=` da URL)
- **`/auth/confirm`** — confirma email automaticamente ao abrir (mostra "Email confirmado!")
- **`/auth/magic-link`** — consome o token e redireciona pro app logado
- **`/auth/forgot-password`** — form pra solicitar reset (já pode existir, vou checar)

### 4. Ajustes nas telas existentes
- **Signup**: após `supabase.auth.signUp()`, chamar `requestEmailConfirmation()` e mostrar tela "Verifique seu email"
- **Login**: bloquear login se `email_confirmed_at` for null, com opção "Reenviar confirmação"
- **Forgot password**: usar `requestPasswordReset()` no lugar de `supabase.auth.resetPasswordForEmail()`
- Adicionar botão "Entrar com magic link" (opcional)

### 5. Templates de email
HTML inline em português, com a marca Mestre 360. Remetente: `noreply@mestre360.com.br` (que já é verificado no Resend).

## Detalhes técnicos

- **Segurança**: tokens gerados com `crypto.randomBytes(32)`, armazenados apenas como hash SHA-256, uso único, expiração curta, rate-limit por email (max 3 solicitações / 10min via tabela)
- **Admin API**: usa `supabaseAdmin` (service role) para confirmar email e resetar senha — usuário nunca precisa de sessão válida pra esses fluxos
- **Idempotência**: requests duplicados não geram múltiplos emails (cooldown de 60s por tipo+email)
- **Configuração Supabase**: vou desativar "Confirm email" nas auth settings via tool (já que agora fazemos isso manualmente), evitando o duplo envio do Supabase

## Arquivos a criar/editar

```
NOVOS:
  src/lib/auth-email.functions.ts        (server functions)
  src/lib/auth-email.server.ts           (helpers: token gen, Resend client, templates)
  src/routes/auth/reset-password.tsx     (nova senha)
  src/routes/auth/confirm.tsx            (confirma email)
  src/routes/auth/magic-link.tsx         (consome magic link)
  migrations: auth_email_tokens          (tabela + RLS + índices)

EDITAR:
  src/routes/auth/forgot-password.tsx    (ou criar)
  páginas de signup/login existentes     (integrar nova lógica)
```

## O que NÃO faremos
- Não mexer em DNS (zero alteração na Cloudflare)
- Não usar o email hook do Supabase
- Não usar o Lovable Emails (sistema de subdomínio NS)

Aprova que eu começo a implementar?