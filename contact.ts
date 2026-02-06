import { applyTranslations } from './i18n';

export function initContactForm() {
  const form = document.getElementById('contact-form') as HTMLFormElement;
  const statusMessage = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;

  if (!form || !statusMessage || !submitBtn) {
    return;
  }

  // Enable button immediately
  submitBtn.disabled = false;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Collect form data
    const name = (document.getElementById('name') as HTMLInputElement).value.trim();
    const message = (document.getElementById('message') as HTMLTextAreaElement).value.trim();

    if (!name || !message) {
      statusMessage.setAttribute('data-i18n', 'contact.error');
      statusMessage.textContent = 'Please fill in all fields.';
      statusMessage.className = 'form-status error active';
      applyTranslations();
      return;
    }

    // Form disabled for now
    statusMessage.setAttribute('data-i18n', 'contact.disabled');
    statusMessage.textContent = ''; // Clear content to let i18n handle it or set a fallback
    statusMessage.className = 'form-status error active';
    applyTranslations();

    // Hide status message after 5 seconds
    setTimeout(() => {
      statusMessage.classList.remove('active');
      statusMessage.classList.remove('error');
    }, 5000);
  });
}
