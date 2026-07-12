/**
 * vernacula-phonemizer — canonical-IPA, espeak-independent.
 *
 *   phonemize("भारत", "hi") → "bʱaːɾət̪"
 *   phonemize("I read a book", "en") → "aᶦ ɹˈɛd ə bˈʊk"
 */
import { getPhonemizer } from "./registry.ts";
import { createArabicDiacritizer } from "./languages/arabic/diacritizer.ts";

export { getPhonemizer, type Phonemizer } from "./registry.ts";

/** Phonemize `text` in language `lang` to canonical IPA. Throws for an unregistered language. */
export function phonemize(text: string, lang: string): string {
  return getPhonemizer(lang).text(text);
}

let arabicDiacritizer: ReturnType<typeof createArabicDiacritizer> | undefined;

/**
 * Phonemize BARE (undiacritized) Arabic. Runs the neural diacritizer pre-pass (ONNX, async) to restore short
 * vowels, then the synchronous g2p. Requires the optional `onnxruntime-node` dependency and a diacritizer
 * model beside the arabic module; if the model is absent it falls back to phonemizing the input as-is (which
 * is correct only for already-diacritized text). Diacritized input can use the sync `phonemize(text, "ar")`.
 */
export async function phonemizeArabic(text: string): Promise<string> {
  if (arabicDiacritizer === undefined) arabicDiacritizer = createArabicDiacritizer();
  const diac = await arabicDiacritizer;
  const vocalized = diac ? await diac.diacritize(text) : text;
  return phonemize(vocalized, "ar");
}
