// Later for changing language.
import { createSignal } from 'solid-js';

// Load translations from JSON file.
// import translations from './translations.json';

const defaultLanguage = 'en';

// Function to retrieve translated text.
export function translate(key, params = {}, lang = defaultLanguage) {
  // // Check if translations exist for the specified language, otherwise fallback to default language.
  // const langTranslations = translations[lang] || translations[defaultLanguage];

  // // Retrieve translation for the specified key.
  // const translation = langTranslations[key] || key;

  // // Replace placeholders in the translation with provided params.
  // return translation.replace(/\{([^}]+)\}/g, (match, param) => params[param] || match);
}

