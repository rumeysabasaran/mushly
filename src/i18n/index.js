/*
  INTERNATIONALIZATION
  The app speaks the phone's language: Turkish when the device is set to Turkish,
  English otherwise. The language is read once at startup.

  Usage:
    t('home.title')                       → "What's in the forest today?"
    t('common.points', { count: 3 })      → "3 points"   (uses `_one` / `_other` keys)
    localized({ en: '…', tr: '…' })        → picks the current language
    upper('yeni keşif')                   → "YENİ KEŞİF" (language-aware uppercase)
*/
import { getLocales } from 'expo-localization';
import en from './en';
import tr from './tr';

const DICTIONARIES = { en, tr };
export const SUPPORTED_LANGUAGES = Object.keys(DICTIONARIES);

function detectLanguage() {
  // Optional override for development and screenshots: EXPO_PUBLIC_LANGUAGE=en npx expo start
  const forced = process.env.EXPO_PUBLIC_LANGUAGE;
  if (SUPPORTED_LANGUAGES.includes(forced)) return forced;
  try {
    const code = getLocales()?.[0]?.languageCode?.toLowerCase();
    return SUPPORTED_LANGUAGES.includes(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

/** Current UI language: 'en' or 'tr' */
export const language = detectLanguage();

/** BCP 47 tag for dates and casing */
export const localeTag = language === 'tr' ? 'tr-TR' : 'en-US';

function lookup(dict, key) {
  const value = key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
  return typeof value === 'string' ? value : undefined;
}

/** Finds a key in one dictionary, preferring its `_one` / `_other` form when a count is given. */
function resolve(dict, key, count) {
  if (typeof count === 'number') {
    const plural = lookup(dict, `${key}_${count === 1 ? 'one' : 'other'}`);
    if (plural) return plural;
  }
  return lookup(dict, key);
}

/**
 * Translates a key. Missing keys fall back to English, then to the key itself,
 * so a forgotten translation never crashes a screen.
 */
export function t(key, params = {}) {
  const template = resolve(DICTIONARIES[language], key, params.count) ?? resolve(en, key, params.count) ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (params[name] != null ? String(params[name]) : match));
}

/** Picks the current language from an { en, tr } object (falls back to English). */
export function localized(value) {
  if (value == null || typeof value === 'string') return value ?? '';
  return value[language] ?? value.en ?? '';
}

/** A translated message for an error code such as 'timeout' (falls back to a generic message). */
export function errorMessage(code) {
  const key = `errors.${code}`;
  const message = t(key);
  return message === key ? t('errors.generic') : message;
}

/**
 * Language-aware uppercase (Turkish: i → İ, ı → I). Never rely on textTransform for this.
 * The dotted/dotless i is mapped by hand, because some JavaScript engines on phones
 * ignore the locale in toLocaleUpperCase() and would turn "mevsim" into "MEVSIM".
 */
export function upper(text) {
  if (typeof text !== 'string') return text;
  if (language === 'tr') return text.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
  return text.toUpperCase();
}
