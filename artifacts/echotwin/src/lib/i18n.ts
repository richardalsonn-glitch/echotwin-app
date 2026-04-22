import { translations, tr } from "@/locales/translations";

export const LANGUAGE_STORAGE_KEY = "bendeki-sen-language";

export const SUPPORTED_LANGUAGES = ["tr", "en", "ja"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export type TranslationKey = keyof typeof tr;
export type TranslationParams = Record<string, string | number>;

export type LanguageOption = {
  code: Language;
  label: string;
  shortLabel: string;
  nativeLabel: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "tr", label: "Turkish", shortLabel: "TR", nativeLabel: "Türkçe" },
  { code: "en", label: "English", shortLabel: "EN", nativeLabel: "English" },
  { code: "ja", label: "Japanese", shortLabel: "日本語", nativeLabel: "日本語" },
];

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    SUPPORTED_LANGUAGES.includes(value as Language)
  );
}

export function interpolate(
  template: string,
  params?: TranslationParams
): string {
  if (!params) return template;

  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const dictionary = translations[language] as Record<TranslationKey, string>;
  const fallback = translations.tr as Record<TranslationKey, string>;
  return interpolate(dictionary[key] ?? fallback[key] ?? key, params);
}

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "tr";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLanguage(stored) ? stored : "tr";
}

