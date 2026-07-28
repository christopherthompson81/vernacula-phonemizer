/**
 * vernacula-phonemizer — canonical-IPA, espeak-independent.
 *
 *   phonemize("भारत", "hi") → "bʱaːɾət̪"
 *   phonemize("I read a book", "en") → "aᶦ ɹˈɛd ə bˈʊk"
 */
import { getPhonemizer } from "./registry.ts";
import { phonemizeArabic } from "./languages/arabic/arabic.ts";
import { phonemizeEnNeural } from "./enNeural.ts";
import { phonemizeBnNeural } from "./bengaliNeural.ts";
import { phonemizeDaNeural } from "./daNeural.ts";
import { phonemizeNbNeural } from "./nbNeural.ts";
import { phonemizeFrNeural } from "./frNeural.ts";
import { phonemizeFaNeural } from "./faNeural.ts";
import { phonemizeHebrewNeural } from "./hebrewNeural.ts";
import { phonemizeRiderNeural } from "./riderNeural.ts";
import { phonemizeSdNeural } from "./sindhiNeural.ts";

export { getPhonemizer, type Phonemizer } from "./registry.ts";

/** Phonemize `text` in language `lang` to canonical IPA (SYNCHRONOUS). Throws for an unregistered language.
 *  This is the simple path: a complete rule/lexicon engine for every language. Two caveats it does NOT cover —
 *  the unpointed ABJADS (Arabic `ar`+dialects, Hebrew `he`) expect VOCALIZED input here (bare text → the consonant
 *  skeleton), and the languages with a neural OOV/restoration upgrade (en, bn, da, nb, fr, fa, ur, ps, pnb) use
 *  their SYNC fallback. `phonemizeAsync` covers both — prefer it for real-world text. */
export function phonemize(text: string, lang: string): string {
    return getPhonemizer(lang).text(text);
}

// Arabic ISO code → engine variety (mirrors the registry); every key routes bare text through the async diacritizer.
const ARABIC_VARIETY: Record<string, string | undefined> = {
    ar: undefined, arz: "egyptian", apc: "levantine", ajp: "southlevantine", apd: "sudanese",
    acm: "iraqi", afb: "gulf", acw: "hijazi", ary: "moroccan", ayl: "libyan",
};

// The per-language ASYNC neural best-paths (ONNX). Each wrapper self-falls-back to the sync engine when the
// optional `onnxruntime-node` dep / model is absent, so routing here is always safe. Perso-Arabic RIDERS
// (ur/ps/pnb) share the multilingual harakat diacritizer via phonemizeRiderNeural(text, lang).
const NEURAL: Record<string, (text: string) => Promise<string>> = {
    en: phonemizeEnNeural, // BiLSTM OOV reader (else the sync n-gram OOV G2P)
    sd: phonemizeSdNeural, // per-letter BiLSTM restoring the abjad's unwritten short vowels on OOV words
    bn: phonemizeBnNeural,
    da: phonemizeDaNeural,
    nb: phonemizeNbNeural,
    fr: phonemizeFrNeural,
    fa: phonemizeFaNeural,
    he: phonemizeHebrewNeural, // the NAKDAN — restores niqqud on bare Hebrew
    ur: (t) => phonemizeRiderNeural(t, "ur"),
    ps: (t) => phonemizeRiderNeural(t, "ps"),
    // Western Punjabi (Shahmukhi) is registry code `pnb`, but the rider keys its Perso-Arabic Punjabi as `pa`
    // (the Gurmukhi `pa` is fully voweled → not a rider; it passes through sync).
    pnb: (t) => phonemizeRiderNeural(t, "pa"),
};

/** Phonemize real-world text to canonical IPA — the UNIFIED best-output entry. Identical to `phonemize` for the
 *  bulk, but routes each language to its best available path: the unpointed ABJADS restore their unwritten vowels
 *  from BARE input (Arabic `ar`+dialects via the neural diacritizer), and the neural-upgrade languages (en's BiLSTM
 *  OOV, bn/da/nb/fr taggers, he NAKDAN, fa + the ur/ps/pnb Perso-Arabic riders) use their ONNX model. Every other
 *  language resolves synchronously. When a model / `onnxruntime-node` is absent each path degrades to the sync
 *  engine, so this is always safe to call. Use this for undiacritized / novel-word text. */
export async function phonemizeAsync(text: string, lang: string): Promise<string> {
    if (lang in ARABIC_VARIETY) return phonemizeArabic(text, ARABIC_VARIETY[lang]);
    const neural = NEURAL[lang];
    return neural ? neural(text) : phonemize(text, lang);
}
