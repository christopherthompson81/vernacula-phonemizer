/**
 * vernacula-phonemizer — canonical-IPA, espeak-independent.
 *
 *   phonemize("भारत", "hi") → "bʱaːɾət̪"
 *   phonemize("I read a book", "en") → "aᶦ ɹˈɛd ə bˈʊk"
 */
import { getPhonemizer } from "./registry.ts";

export { getPhonemizer, type Phonemizer } from "./registry.ts";

/** Phonemize `text` in language `lang` to canonical IPA. Throws for an unregistered language. */
export function phonemize(text: string, lang: string): string {
  return getPhonemizer(lang).text(text);
}

// NB bare (undiacritized) Arabic needs an async diacritizer pre-pass, so it is NOT on this sync path — import
// `phonemizeArabic` from ./languages/arabic/arabic.ts.
