import './style.css';
import { initI18n } from './i18n';
import { renderProjects } from './projects';
import { initContactForm } from './contact';

// Initialize internationalization
document.addEventListener('DOMContentLoaded', () => {
  renderProjects();
  initI18n();
  initContactForm();

  // Remove loading screen
  const loader = document.getElementById('loading-screen');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.remove();
      }, 600);
    }, 500);
  }

  // Scroll Animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-up').forEach((el) => {
    observer.observe(el);
  });
});

console.log('Portfolio site loaded successfully!');
