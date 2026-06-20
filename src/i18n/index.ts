import i18next, { type TOptions } from "i18next";
import { createSignal } from "solid-js";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

export const LANGUAGE_STORAGE_KEY = "language";
export const SUPPORTED_LANGUAGES = {
  en: "English",
  "zh-CN": "简体中文",
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

const [locale, setLocale] = createSignal<SupportedLanguage>("en");

function normalizeLanguage(language: string | null): SupportedLanguage {
  return language === "zh-CN" ? "zh-CN" : "en";
}

export async function initI18n() {
  const savedLanguage = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));

  await i18next.init({
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    lng: savedLanguage,
    resources: {
      en: { translation: en },
      "zh-CN": { translation: zhCN },
    },
  });

  setLocale(savedLanguage);
}

export function t(key: string, options?: TOptions) {
  locale();
  return i18next.t(key, options);
}

export async function changeLanguage(language: SupportedLanguage) {
  await i18next.changeLanguage(language);
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  setLocale(language);
}

export function languageCodeToDisplay(language: SupportedLanguage) {
  return SUPPORTED_LANGUAGES[language];
}

export function languageDisplayToCode(displayName: string): SupportedLanguage {
  return displayName === SUPPORTED_LANGUAGES["zh-CN"] ? "zh-CN" : "en";
}

export { locale };
