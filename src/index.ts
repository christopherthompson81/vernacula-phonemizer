/**
 * vernacula-phonemizer — canonical-IPA.
 *
 *   phonemize("भारत", "hi") → "bʱaːɾət̪"
 *   phonemize("I read a book", "en") → "aᶦ ɹˈɛd ə bˈʊk"
 */
import { getPhonemizer } from "./registry.ts";
import { getNeuralPhonemizer } from "./neuralRegistry.ts";

export { getPhonemizer, type Phonemizer } from "./registry.ts";

/** Phonemize `text` in language `lang` to canonical IPA (SYNCHRONOUS). Throws for an unregistered language.
 *  This is the simple path: a complete rule/lexicon engine for every language. Two caveats it does NOT cover —
 *  the unpointed ABJADS (Arabic `ar`+dialects, Hebrew `he`) expect VOCALIZED input here (bare text → the consonant
 *  skeleton), and the languages with a neural OOV/restoration upgrade (en, bn, da, nb, fr, fa, ur, ps, pnb) use
 *  their SYNC fallback. `phonemizeAsync` covers both — prefer it for real-world text. */
export function phonemize(text: string, lang: string): string {
    return getPhonemizer(lang).text(text);
}

/** Phonemize real-world text to canonical IPA — the UNIFIED best-output entry. Identical to `phonemize` for the
 *  bulk, but routes each language to its best available path (neuralRegistry.ts): the unpointed ABJADS restore
 *  their unwritten vowels from BARE input (Arabic `ar`+dialects via the neural diacritizer), and the
 *  neural-upgrade languages (en's BiLSTM OOV, bn/da/nb/fr taggers, he NAKDAN, fa + the ur/ps/pnb Perso-Arabic
 *  riders) use their ONNX model. Every other language resolves synchronously. When a model / `onnxruntime-node`
 *  is absent each path degrades to the sync engine, so this is always safe to call. Use this for undiacritized /
 *  novel-word text. */
export async function phonemizeAsync(text: string, lang: string): Promise<string> {
    const neural = getNeuralPhonemizer(lang);
    return neural ? neural(text) : phonemize(text, lang);
}
