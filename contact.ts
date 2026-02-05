import { applyTranslations } from './i18n';

export function initContactForm() {
  const form = document.getElementById('contact-form') as HTMLFormElement;
  const statusMessage = document.getElementById('form-status');

  if (!form || !statusMessage) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    // Set loading state
    submitBtn.disabled = true;
    submitBtn.textContent = '...'; // Temporary, will be updated by i18n
    // Force a quick translation update to show "Sending..." if available,
    // or just hardcode for immediate feedback if i18n isn't instant.
    // Ideally, we swap the data-i18n key temporarily.
    submitBtn.setAttribute('data-i18n', 'contact.sending');
    applyTranslations();

    const formData = new FormData(form);

    try {
      // TODO: Implement form submission logic
      console.log('Form data:', Object.fromEntries(formData));

      // Simulate network delay for UI testing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate success
      statusMessage.setAttribute('data-i18n', 'contact.success');
      statusMessage.className = 'form-status success active';
      form.reset();
    } catch (error) {
      console.error('Error:', error);
      statusMessage.setAttribute('data-i18n', 'contact.error');
      statusMessage.className = 'form-status error active';
    } finally {
      // Reset button state
      submitBtn.disabled = false;
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
