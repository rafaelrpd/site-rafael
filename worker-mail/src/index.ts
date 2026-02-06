/**
 * rafaeldias-mail-router
 *
 * Cloudflare Worker para gerenciar fluxo de e-mail bidirecional:
 * - Recebe submissões do formulário de contato via POST /api/contact
 * - Encaminha notificações para o Gmail via Email Routing
 * - Processa respostas do admin (Gmail) e envia para visitante via Resend
 * - Processa respostas do visitante e encaminha para Gmail
 */

import PostalMime from 'postal-mime';
import { createMimeMessage, Mailbox } from 'mimetext';
import { EmailMessage } from 'cloudflare:email';

// ==============================================================================
// Types
// ==============================================================================

interface Env {
  // KV Namespaces
  THREADS: KVNamespace;
  RATE: KVNamespace;

  // Email Binding
  NOTIFY_GMAIL: SendEmail;

  // Environment Variables
  DOMAIN: string;
  ADMIN_GMAIL_EMAIL: string;
  DESTINATION_GMAIL_EMAIL: string;
  ALLOWED_ORIGINS: string;
  CONTACT_FROM: string;
  REPLY_LOCAL_PART: string;
  THREAD_TTL_SECONDS: string;
  RATE_WINDOW_SECONDS: string;
  RATE_MAX_PER_WINDOW: string;

  // Secrets
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
}

interface ContactPayload {
  name: string;
  email: string;
  subject?: string;
  message: string;
  turnstileToken: string;
}

interface ThreadData {
  token: string;
  visitorEmail: string;
  visitorName: string;
  subject: string;
  createdAt: string;
  lastVisitorMessage?: string;
  lastAdminReplyAt?: string;
}

// ==============================================================================
// Utilities
// ==============================================================================

/**
 * Gera um token seguro usando crypto.getRandomValues
 */
function generateSecureToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // Base64url encoding (sem padding)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Valida formato de email básico
 */
function isValidEmail(email: string): boolean {
  if (email.length < 3 || email.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Extrai endereço de email puro de um header (ex: "Nome <email@example.com>")
 */
function extractEmailAddress(input: string): string {
  const match = input.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return input.toLowerCase().trim();
}

/**
 * Extrai token do endereço reply+TOKEN@domain
 */
function extractTokenFromAddress(
  address: string,
  replyLocalPart: string,
  domain: string,
): string | null {
  const lowerAddress = address.toLowerCase();
  const prefix = `${replyLocalPart}+`;
  const suffix = `@${domain}`;

  if (!lowerAddress.includes(prefix) || !lowerAddress.endsWith(suffix)) {
    return null;
  }

  const start = lowerAddress.indexOf(prefix) + prefix.length;
  const end = lowerAddress.lastIndexOf(suffix);
  if (start >= end) return null;

  return address.substring(start, end);
}

/**
 * Remove texto citado (quoted text) básico de uma resposta de email
 * Mantém apenas o conteúdo acima de marcadores como "On ... wrote:"
 */
function extractNewContent(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    // Detectar início de citação
    if (
      line.match(/^On .+ wrote:$/i) ||
      line.match(/^Em .+ escreveu:$/i) ||
      line.match(/^-{3,}\s*Original Message\s*-{3,}$/i) ||
      line.match(/^-{3,}\s*Mensagem Original\s*-{3,}$/i) ||
      line.match(/^>{2,}/) ||
      line.match(/^From:\s+.+@.+$/i)
    ) {
      break;
    }

    // Ignorar linhas que começam com > (citação inline)
    if (line.startsWith('>')) continue;

    result.push(line);
  }

  return result.join('\n').trim();
}

/**
 * Retorna resposta CORS com headers apropriados
 */
function corsResponse(response: Response, origin: string, allowedOrigins: string[]): Response {
  const headers = new Headers(response.headers);

  if (allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Cria resposta JSON
 */
function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==============================================================================
// Rate Limiting
// ==============================================================================

async function checkRateLimit(
  env: Env,
  ip: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const windowSeconds = parseInt(env.RATE_WINDOW_SECONDS, 10);
  const maxPerWindow = parseInt(env.RATE_MAX_PER_WINDOW, 10);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;

  const key = `rl:${ip}:${windowStart}`;
  const currentStr = await env.RATE.get(key);
  const current = currentStr ? parseInt(currentStr, 10) : 0;

  if (current >= maxPerWindow) {
    return { allowed: false, remaining: 0 };
  }

  // Incrementar contador
  await env.RATE.put(key, String(current + 1), { expirationTtl: windowSeconds * 2 });

  return { allowed: true, remaining: maxPerWindow - current - 1 };
}

// ==============================================================================
// Turnstile Validation
// ==============================================================================

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

async function validateTurnstile(
  token: string,
  secret: string,
  remoteIp?: string,
): Promise<{ valid: boolean; error?: string }> {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const result = (await response.json()) as TurnstileResponse;

    if (!result.success) {
      return {
        valid: false,
        error: result['error-codes']?.join(', ') || 'Verificação anti-spam falhou',
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Erro ao verificar captcha' };
  }
}

// ==============================================================================
// Email Sending via Resend
// ==============================================================================

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  headers?: Record<string, string>;
}

async function sendViaResend(
  env: Env,
  payload: ResendPayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ==============================================================================
// Email Creation (MIME)
// ==============================================================================

function createNotificationEmail(env: Env, thread: ThreadData, message: string): EmailMessage {
  const replyTo = `${env.REPLY_LOCAL_PART}+${thread.token}@${env.DOMAIN}`;

  const msg = createMimeMessage();
  msg.setSender(new Mailbox({ addr: env.CONTACT_FROM }));
  msg.setRecipient(new Mailbox({ addr: env.DESTINATION_GMAIL_EMAIL }));
  msg.setSubject(`[Contato] ${thread.visitorName} - ${thread.subject}`);
  msg.setHeader('Reply-To', replyTo);
  msg.setHeader('X-RD-MailRouter', '1');

  const body = `Nova mensagem de contato do site rafaeldias.net

De: ${thread.visitorName}
Email: ${thread.visitorEmail}
Assunto: ${thread.subject}

Mensagem:
${message}

---
Para responder, basta responder este e-mail.
O visitante receberá sua resposta em ${thread.visitorEmail}.

Link para responder: mailto:${replyTo}?subject=Re:${encodeURIComponent(thread.subject)}`;

  msg.addMessage({
    contentType: 'text/plain',
    data: body,
  });

  // Criar EmailMessage para o binding send_email
  const rawMessage = msg.asRaw();
  return new EmailMessage(env.CONTACT_FROM, env.DESTINATION_GMAIL_EMAIL, rawMessage);
}

function createVisitorReplyNotificationEmail(
  env: Env,
  thread: ThreadData,
  visitorMessage: string,
): EmailMessage {
  const replyTo = `${env.REPLY_LOCAL_PART}+${thread.token}@${env.DOMAIN}`;

  const msg = createMimeMessage();
  msg.setSender(new Mailbox({ addr: env.CONTACT_FROM }));
  msg.setRecipient(new Mailbox({ addr: env.DESTINATION_GMAIL_EMAIL }));
  msg.setSubject(`[Resposta Visitante] ${thread.subject}`);
  msg.setHeader('Reply-To', replyTo);
  msg.setHeader('X-RD-MailRouter', '1');

  const body = `O visitante respondeu a conversa.

De: ${thread.visitorName} <${thread.visitorEmail}>
Assunto original: ${thread.subject}

Mensagem:
${visitorMessage}

---
Para responder, basta responder este e-mail.`;

  msg.addMessage({
    contentType: 'text/plain',
    data: body,
  });

  const rawMessage = msg.asRaw();
  return new EmailMessage(env.CONTACT_FROM, env.DESTINATION_GMAIL_EMAIL, rawMessage);
}

// ==============================================================================
// Fetch Handler (POST /api/contact)
// ==============================================================================

async function handleFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

  // CORS Preflight
  if (request.method === 'OPTIONS') {
    return corsResponse(new Response(null, { status: 204 }), origin, allowedOrigins);
  }

  // Apenas POST /api/contact
  if (request.method !== 'POST' || url.pathname !== '/api/contact') {
    return corsResponse(jsonResponse({ error: 'Not found' }, 404), origin, allowedOrigins);
  }

  // Validar Origin
  if (!allowedOrigins.includes(origin)) {
    return corsResponse(
      jsonResponse({ error: 'Origin não permitida' }, 403),
      origin,
      allowedOrigins,
    );
  }

  // Obter IP para rate limit
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Rate Limit
  const rateResult = await checkRateLimit(env, clientIP);
  if (!rateResult.allowed) {
    return corsResponse(
      jsonResponse({ error: 'Muitas requisições. Tente novamente em 1 minuto.' }, 429),
      origin,
      allowedOrigins,
    );
  }

  // Parse body
  let payload: ContactPayload;
  try {
    const body = await request.text();
    if (body.length > 10000) {
      return corsResponse(
        jsonResponse({ error: 'Payload muito grande' }, 400),
        origin,
        allowedOrigins,
      );
    }
    payload = JSON.parse(body);
  } catch {
    return corsResponse(jsonResponse({ error: 'JSON inválido' }, 400), origin, allowedOrigins);
  }

  // Validações
  const { name, email, subject, message, turnstileToken } = payload;

  if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
    return corsResponse(
      jsonResponse({ error: 'Nome inválido (1-100 caracteres)' }, 400),
      origin,
      allowedOrigins,
    );
  }

  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    return corsResponse(jsonResponse({ error: 'Email inválido' }, 400), origin, allowedOrigins);
  }

  const finalSubject =
    subject && typeof subject === 'string' && subject.length <= 120 ? subject : 'Contato do site';

  if (!message || typeof message !== 'string' || message.length < 1 || message.length > 4000) {
    return corsResponse(
      jsonResponse({ error: 'Mensagem inválida (1-4000 caracteres)' }, 400),
      origin,
      allowedOrigins,
    );
  }

  if (!turnstileToken || typeof turnstileToken !== 'string') {
    return corsResponse(
      jsonResponse({ error: 'Token de verificação ausente' }, 400),
      origin,
      allowedOrigins,
    );
  }

  // Validar Turnstile
  const turnstileResult = await validateTurnstile(turnstileToken, env.TURNSTILE_SECRET, clientIP);
  if (!turnstileResult.valid) {
    return corsResponse(
      jsonResponse({ error: turnstileResult.error || 'Verificação anti-spam falhou' }, 400),
      origin,
      allowedOrigins,
    );
  }

  // Gerar token e criar thread
  const token = generateSecureToken();
  const thread: ThreadData = {
    token,
    visitorEmail: email,
    visitorName: name,
    subject: finalSubject,
    createdAt: new Date().toISOString(),
    lastVisitorMessage: message,
  };

  // Salvar no KV
  const ttl = parseInt(env.THREAD_TTL_SECONDS, 10);
  await env.THREADS.put(token, JSON.stringify(thread), { expirationTtl: ttl });

  // Enviar email de notificação
  try {
    const emailMessage = createNotificationEmail(env, thread, message);
    ctx.waitUntil(env.NOTIFY_GMAIL.send(emailMessage));
  } catch (e) {
    console.error('Erro ao enviar notificação:', e);
    // Não falhar a requisição, o formulário foi recebido
  }

  return corsResponse(jsonResponse({ ok: true }), origin, allowedOrigins);
}

// ==============================================================================
// Email Handler
// ==============================================================================

async function handleEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  // Parse do email
  const rawEmail = await new Response(message.raw).arrayBuffer();
  const parser = new PostalMime();
  const parsed = await parser.parse(rawEmail);

  // Extrair remetente
  const fromRaw = parsed.from?.address || message.from;
  const fromEmail = extractEmailAddress(fromRaw);

  // Extrair destinatário (para obter o token)
  const toAddresses = parsed.to || [];
  let token: string | null = null;

  for (const addr of toAddresses) {
    const address = typeof addr === 'string' ? addr : addr.address || '';
    token = extractTokenFromAddress(address, env.REPLY_LOCAL_PART, env.DOMAIN);
    if (token) break;
  }

  // Também verificar o message.to original
  if (!token) {
    token = extractTokenFromAddress(message.to, env.REPLY_LOCAL_PART, env.DOMAIN);
  }

  // Anti-loop: verificar header marcador
  const antiLoopHeader = parsed.headers?.find((h) => h.key.toLowerCase() === 'x-rd-mailrouter');
  const hasLoopMarker = antiLoopHeader?.value === '1';

  if (hasLoopMarker) {
    // Verificar se é um loop (email vindo do próprio sistema para o mesmo destino)
    const toEmail = extractEmailAddress(message.to);
    const isLoopToGmail = toEmail.includes(env.DESTINATION_GMAIL_EMAIL.toLowerCase());
    const isLoopFromContact = fromEmail === env.CONTACT_FROM.toLowerCase();

    if (isLoopToGmail || isLoopFromContact) {
      console.log('Anti-loop: ignorando email marcado como sistema');
      return;
    }
  }

  // Buscar thread no KV
  let thread: ThreadData | null = null;
  if (token) {
    const threadStr = await env.THREADS.get(token);
    if (threadStr) {
      try {
        thread = JSON.parse(threadStr);
      } catch {
        thread = null;
      }
    }
  }

  // Se não encontrou thread, criar uma fallback para novas conversas
  if (!thread) {
    // Criar thread fallback
    const newToken = token || generateSecureToken();
    thread = {
      token: newToken,
      visitorEmail: fromEmail,
      visitorName: parsed.from?.name || fromEmail.split('@')[0],
      subject: parsed.subject || 'Sem assunto',
      createdAt: new Date().toISOString(),
      lastVisitorMessage: parsed.text || '',
    };

    const ttl = parseInt(env.THREAD_TTL_SECONDS, 10);
    await env.THREADS.put(newToken, JSON.stringify(thread), { expirationTtl: ttl });
    token = newToken;
  }

  const messageText = parsed.text || '';

  // Distinguir fluxos
  const adminEmail = env.ADMIN_GMAIL_EMAIL.toLowerCase();
  const isFromAdmin = fromEmail === adminEmail;

  if (isFromAdmin) {
    // === FLUXO 1: Admin (Gmail) respondendo ao visitante ===
    console.log(`Admin respondendo para thread ${token}`);

    // Extrair conteúdo novo (sem citações)
    const cleanText = extractNewContent(messageText);

    if (!cleanText) {
      console.log('Resposta vazia após remover citações, ignorando');
      return;
    }

    // Enviar para o visitante via Resend
    const replyTo = `${env.REPLY_LOCAL_PART}+${token}@${env.DOMAIN}`;

    const resendResult = await sendViaResend(env, {
      from: env.RESEND_FROM_EMAIL,
      to: [thread.visitorEmail],
      subject: `Re: ${thread.subject}`,
      text: cleanText,
      headers: {
        'Reply-To': replyTo,
      },
    });

    if (!resendResult.success) {
      console.error('Erro ao enviar via Resend:', resendResult.error);
      return;
    }

    // Atualizar thread
    thread.lastAdminReplyAt = new Date().toISOString();
    const ttl = parseInt(env.THREAD_TTL_SECONDS, 10);
    ctx.waitUntil(env.THREADS.put(token!, JSON.stringify(thread), { expirationTtl: ttl }));

    console.log(`Email enviado para ${thread.visitorEmail} via Resend`);
  } else {
    // === FLUXO 2: Visitante respondendo ===
    console.log(`Visitante ${fromEmail} respondendo para thread ${token}`);

    // Verificar se o remetente é o mesmo visitante original
    if (thread.visitorEmail.toLowerCase() !== fromEmail) {
      console.log(
        `Email ${fromEmail} não corresponde ao visitante da thread ${thread.visitorEmail}`,
      );
      // Criar nova thread para este remetente
      const newToken = generateSecureToken();
      const newThread: ThreadData = {
        token: newToken,
        visitorEmail: fromEmail,
        visitorName: parsed.from?.name || fromEmail.split('@')[0],
        subject: parsed.subject || thread.subject,
        createdAt: new Date().toISOString(),
        lastVisitorMessage: messageText,
      };

      const ttl = parseInt(env.THREAD_TTL_SECONDS, 10);
      await env.THREADS.put(newToken, JSON.stringify(newThread), { expirationTtl: ttl });

      // Encaminhar para o admin
      try {
        const emailMessage = createVisitorReplyNotificationEmail(env, newThread, messageText);
        ctx.waitUntil(env.NOTIFY_GMAIL.send(emailMessage));
      } catch (e) {
        console.error('Erro ao encaminhar resposta:', e);
      }

      return;
    }

    // Encaminhar para o Gmail
    try {
      const emailMessage = createVisitorReplyNotificationEmail(env, thread, messageText);
      ctx.waitUntil(env.NOTIFY_GMAIL.send(emailMessage));
    } catch (e) {
      console.error('Erro ao encaminhar resposta:', e);
    }

    // Atualizar thread
    thread.lastVisitorMessage = messageText;
    const ttl = parseInt(env.THREAD_TTL_SECONDS, 10);
    ctx.waitUntil(env.THREADS.put(token!, JSON.stringify(thread), { expirationTtl: ttl }));

    console.log(`Resposta do visitante encaminhada para ${env.DESTINATION_GMAIL_EMAIL}`);
  }
}

// ==============================================================================
// Export
// ==============================================================================

export default {
  fetch: handleFetch,
  email: handleEmail,
} satisfies ExportedHandler<Env>;
