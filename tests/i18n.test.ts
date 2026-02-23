import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyTranslations, getCurrentLanguage, initI18n, setLanguage } from '../i18n';

describe('i18n', () => {
    beforeEach(() => {
        // Reset DOM
        document.documentElement.lang = '';
        document.body.innerHTML = `
      <div data-i18n="hero.subtitle"></div>
      <button class="lang-btn" data-lang="en-US">EN</button>
      <button class="lang-btn" data-lang="pt-BR">PT</button>
    `;
        // Clear localStorage
        localStorage.clear();
        // Reset language to default (force by calling initI18n)
    });

    it('initializes with default language (en-US) if no local storage or navigator preference', () => {
        Object.defineProperty(navigator, 'languages', { value: ['fr-FR'], configurable: true });
        initI18n();
        expect(getCurrentLanguage()).toBe('en-US');
        expect(document.documentElement.lang).toBe('en-US');
    });

    it('detects language from localStorage', () => {
        localStorage.setItem('preferred-language', 'pt-BR');
        initI18n();
        expect(getCurrentLanguage()).toBe('pt-BR');
        expect(document.documentElement.lang).toBe('pt-BR');
    });

    it('changes language and persists to localStorage', () => {
        initI18n(); // Starts as en-US normally
        setLanguage('pt-BR');

        expect(getCurrentLanguage()).toBe('pt-BR');
        expect(localStorage.getItem('preferred-language')).toBe('pt-BR');
        expect(document.documentElement.lang).toBe('pt-BR');
    });

    it('updates translations in DOM elements', () => {
        initI18n();
        const heroRole = document.querySelector('[data-i18n="hero.subtitle"]') as HTMLElement;

        setLanguage('en-US');
        expect(heroRole.innerHTML).toBe('Software Developer');

        setLanguage('pt-BR');
        expect(heroRole.innerHTML).toBe('Desenvolvedor de Software');
    });

    it('toggles active class on language buttons', () => {
        initI18n();
        setLanguage('pt-BR');

        const enBtn = document.querySelector('[data-lang="en-US"]') as HTMLElement;
        const ptBtn = document.querySelector('[data-lang="pt-BR"]') as HTMLElement;

        expect(enBtn.classList.contains('active')).toBe(false);
        expect(ptBtn.classList.contains('active')).toBe(true);
    });
});
