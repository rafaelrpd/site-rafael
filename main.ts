import './style.css';
import { initI18n } from './i18n';
import { renderProjects } from './projects';

// Initialize internationalization
document.addEventListener('DOMContentLoaded', () => {
  renderProjects();
  initI18n();

  // Remove loading screen
  const loader = document.getElementById('loading-screen');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.remove();
      }, 500); // Wait for transition
    }, 500); // Minimal delay to prevent flash
  }
});

console.log('Portfolio site loaded successfully!');
