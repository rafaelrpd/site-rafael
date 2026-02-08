import { applyTranslations } from './i18n';

let turnstileToken: string | null = null;
let startedAt = 0;

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    onTurnstileExpired?: () => void;
    onTurnstileError?: () => void;
    onTurnstileTimeout?: () => void;
  }
}

export function initContactForm() {
  const form = document.getElementById('contact-form') as HTMLFormElement;
  const statusMessage = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;

  if (!form || !statusMessage || !submitBtn) {
    return;
  }

  submitBtn.disabled = true;

  const startTimer = () => {
    if (!startedAt) startedAt = Date.now();
  };

  form.addEventListener('focusin', startTimer, { once: true });
  form.addEventListener('input', startTimer, { once: true });

  // Callbacks globais pro Turnstile
  window.onTurnstileSuccess = (token) => {
    turnstileToken = token;
    submitBtn.disabled = false;
  };

  window.onTurnstileExpired = () => {
    turnstileToken = null;
    submitBtn.disabled = true;
  };

  window.onTurnstileError = () => {
    turnstileToken = null;
    submitBtn.disabled = true;
  };

  window.onTurnstileTimeout = () => {
    turnstileToken = null;
    submitBtn.disabled = true;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;

    // Collect form data
    const name = (document.getElementById('name') as HTMLInputElement).value.trim();
    const email = (document.getElementById('email') as HTMLInputElement).value.trim();
    const message = (document.getElementById('message') as HTMLTextAreaElement).value.trim();

    // Honeypot (anti-not-so-smart bots)
    const middleName =
      (document.getElementById('middleName') as HTMLInputElement | null)?.value?.trim() ?? '';
    const elapsedMs = startedAt ? Date.now() - startedAt : 0;

    if (!name || !email || !message) {
      statusMessage.setAttribute('data-i18n', 'contact.error');
      statusMessage.textContent = 'Please fill in all fields.';
      statusMessage.className = 'form-status error active';
      applyTranslations();
      submitBtn.disabled = false;
      return;
    }

    if (!turnstileToken) {
      statusMessage.setAttribute('data-i18n', 'contact.turnstile.error');
      statusMessage.textContent = 'Failed to verify you are human.';
      statusMessage.className = 'form-status error active';
      applyTranslations();
      submitBtn.disabled = false;
      return;
    }

    const payload = {
      name,
      email,
      message,
      middleName,
      elapsedMs,
      turnstileToken,
    };

    try {
      const res = await fetch('https://www.rafaeldias.net/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        statusMessage.setAttribute('data-i18n', 'contact.success');
        statusMessage.textContent = 'Message sent successfully.';
        statusMessage.className = 'form-status success active';

        form.reset();
        turnstileToken = null;
        startedAt = 0;
        submitBtn.disabled = true;
      } else {
        statusMessage.setAttribute('data-i18n', 'contact.error');
        statusMessage.textContent = 'Failed to send message.';
        statusMessage.className = 'form-status error active';
        submitBtn.disabled = false;
      }
    } catch {
      statusMessage.setAttribute('data-i18n', 'contact.error');
      statusMessage.textContent = 'Failed to send message.';
      statusMessage.className = 'form-status error active';
      submitBtn.disabled = false;
    }

    // Hide status message after 5 seconds
    setTimeout(() => {
      statusMessage.classList.remove('active');
      statusMessage.classList.remove('error');
      statusMessage.classList.remove('success');
    }, 5000);
  });
}
