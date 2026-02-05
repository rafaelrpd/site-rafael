import enUSTranslations from './locales/en-US.json';
import ptBRTranslations from './locales/pt-BR.json';

export type Locale = 'en-US' | 'pt-BR';

type Translations = typeof enUSTranslations;

const STORAGE_KEY = 'preferred-language';
const SUPPORTED_LOCALES: Locale[] = ['en-US', 'pt-BR'];
const DEFAULT_LOCALE: Locale = 'en-US';

const translations: Record<Locale, Translations> = {
  'en-US': enUSTranslations,
  'pt-BR': ptBRTranslations,
};

let currentLocale: Locale = DEFAULT_LOCALE;

/**
 * Detects the user's preferred language.
 * Priority: localStorage > navigator.languages > default (en)
 */
function detectLanguage(): Locale {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
    return stored as Locale;
  }

  // Check browser preferences
  const browserLangs = navigator.languages || [navigator.language];
  for (const lang of browserLangs) {
    // Check for exact match (e.g., "pt-BR")
    if (SUPPORTED_LOCALES.includes(lang as Locale)) {
      return lang as Locale;
    }
    // Check for language prefix (e.g., "pt" matches "pt-BR")
    const prefix = lang.split('-')[0];
    if (!prefix) continue;
    const match = SUPPORTED_LOCALES.find((l) => l.startsWith(prefix));
    if (match) {
      return match;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Applies translations to all elements with data-i18n attribute.
 */
export function applyTranslations(): void {
  const t = translations[currentLocale];
  const elements = document.querySelectorAll<HTMLElement>('[data-i18n]');

  elements.forEach((el) => {
    const key = el.dataset.i18n as keyof Translations;
    if (t[key]) {
      el.innerHTML = t[key];
    }
  });

  // Update html lang attribute
  document.documentElement.lang = currentLocale;

  // Update active button state
  document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLocale);
  });
}

/**
 * Sets the current language and persists the choice.
 */
export function setLanguage(locale: Locale): void {
  if (!SUPPORTED_LOCALES.includes(locale)) return;

  currentLocale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  applyTranslations();
}

/**
 * Returns the current language.
 */
export function getCurrentLanguage(): Locale {
  return currentLocale;
}

/**
 * Initializes the i18n system.
 */
export function initI18n(): void {
  currentLocale = detectLanguage();
  applyTranslations();

  // Setup language switcher event listeners
  document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang as Locale;
      if (lang) {
        setLanguage(lang);
      }
    });
  });
}
