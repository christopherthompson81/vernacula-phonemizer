/**
 * Language registry: code → canonical-IPA phonemizer. Deliberately tiny and explicit (one row per
 * language), built lazily and cached. No espeak, no fallback — an unknown language throws.
 */
import { createHindi } from "./languages/hindi/hindi.ts";
import { createEnglish } from "./languages/english/english.ts";
import { createMandarin } from "./languages/mandarin/mandarin.ts";
import { createSpanish } from "./languages/spanish/spanish.ts";
import { createArabic } from "./languages/arabic/arabic.ts";
import { createFrench } from "./languages/french/french.ts";

export interface Phonemizer {
  /** Full text → canonical IPA. */
  text(input: string): string;
}

const cache = new Map<string, Phonemizer>();

/** Get (and memoize) the phonemizer for a language code. */
export function getPhonemizer(lang: string): Phonemizer {
  let p = cache.get(lang);
  if (p === undefined) {
    p = build(lang);
    cache.set(lang, p);
  }
  return p;
}

function build(lang: string): Phonemizer {
  switch (lang) {
    case "en": return createEnglish();
    // Embedded Latin in Chinese text routes to the English phonemizer (lazy — loaded only if it appears).
    case "cmn": return createMandarin((latin) => getPhonemizer("en").text(latin));
    case "es": return createSpanish();
    case "ar": return createArabic();
    case "fr": return createFrench();
    // Embedded Latin in Hindi text routes to the English phonemizer (lazy — loaded only if it appears).
    case "hi": return createHindi((latin) => getPhonemizer("en").text(latin));
    default: throw new Error(`vernacula-phonemizer: no phonemizer registered for "${lang}"`);
  }
}
