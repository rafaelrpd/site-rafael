import { applyTranslations } from './i18n';

// Turnstile token state
let turnstileToken: string | null = null;

// Turnstile callbacks (exposed globally for the widget)
declare global {
  interface Window {
    onTurnstileSuccess: (token: string) => void;
    onTurnstileExpired: () => void;
  }
}

window.onTurnstileSuccess = (token: string) => {
  turnstileToken = token;
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  if (submitBtn) submitBtn.disabled = false;
};

window.onTurnstileExpired = () => {
  turnstileToken = null;
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  if (submitBtn) submitBtn.disabled = true;
};

export function initContactForm() {
  const form = document.getElementById('contact-form') as HTMLFormElement;
  const statusMessage = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;

  if (!form || !statusMessage || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate Turnstile token
    if (!turnstileToken) {
      statusMessage.setAttribute('data-i18n', 'contact.turnstile_required');
      statusMessage.textContent = 'Please complete the verification.';
      statusMessage.className = 'form-status error active';
      applyTranslations();
      return;
    }

    // Set loading state
    submitBtn.disabled = true;
    submitBtn.setAttribute('data-i18n', 'contact.sending');
    applyTranslations();

    // Collect form data
    const formData = {
      name: (document.getElementById('name') as HTMLInputElement).value.trim(),
      email: (document.getElementById('email') as HTMLInputElement).value.trim(),
      message: (document.getElementById('message') as HTMLTextAreaElement).value.trim(),
      turnstileToken: turnstileToken,
    };

    try {
      const response = await fetch('https://rafaeldias.net/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        statusMessage.setAttribute('data-i18n', 'contact.success');
        statusMessage.className = 'form-status success active';
        form.reset();

        // Reset Turnstile
        if (window.turnstile) {
          window.turnstile.reset();
        }
        turnstileToken = null;
      } else {
        statusMessage.setAttribute('data-i18n', 'contact.error');
        statusMessage.textContent = result.error || 'An error occurred.';
        statusMessage.className = 'form-status error active';
      }
    } catch (error) {
      console.error('Error:', error);
      statusMessage.setAttribute('data-i18n', 'contact.error');
      statusMessage.className = 'form-status error active';
    } finally {
      // Reset button state
      submitBtn.disabled = !turnstileToken;
      submitBtn.setAttribute('data-i18n', 'contact.send');
      applyTranslations();

      // Hide status message after 5 seconds
      setTimeout(() => {
        statusMessage.classList.remove('active');
        statusMessage.classList.remove('success');
        statusMessage.classList.remove('error');
      }, 5000);
    }
  });
}

// Extend window for Turnstile API
declare global {
  interface Window {
    turnstile?: {
      reset: () => void;
    };
  }
}
