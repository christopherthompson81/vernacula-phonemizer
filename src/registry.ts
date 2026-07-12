/**
 * Language registry: code → canonical-IPA phonemizer. Deliberately tiny and explicit (one row per
 * language), built lazily and cached. No espeak, no fallback — an unknown language throws.
 */
import { createHindi } from "./languages/hindi/hindi.ts";

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
    // Embedded Latin in Hindi text will route to the English phonemizer once it lands; undefined drops it.
    case "hi": return createHindi();
    default: throw new Error(`vernacula-phonemizer: no phonemizer registered for "${lang}"`);
  }
}
