/**
 * ASYNC (neural best-path) registry: code → the language's best available async phonemizer.
 * The sync sibling is registry.ts; index.ts routes phonemizeAsync through here. Each entry
 * self-falls-back to the sync engine when `onnxruntime-node` or its model is absent, so routing
 * here is always safe. Every language entry lives beside its engine in src/languages/<lang>/.
 */
import { phonemizeArabic } from "./languages/arabic/arabic.ts";
import { phonemizeEnNeural } from "./languages/english/englishNeural.ts";
import { phonemizeBnNeural } from "./languages/bengali/bengaliNeural.ts";
import { phonemizeDaNeural } from "./languages/danish/danishNeural.ts";
import { phonemizeNbNeural } from "./languages/norwegian/norwegianNeural.ts";
import { phonemizeFrNeural } from "./languages/french/frenchNeural.ts";
import { phonemizeFaNeural } from "./languages/persian/persianNeural.ts";
import { phonemizeHebrewNeural } from "./languages/hebrew/hebrewNeural.ts";
import { phonemizeKmNeural } from "./languages/khmer/khmerNeural.ts";
import { phonemizeRiderNeural } from "./languages/perso-arabic/riderNeural.ts";
import { phonemizeSdNeural } from "./languages/sindhi/sindhiNeural.ts";
import { phonemizeAfNeural } from "./languages/afrikaans/afrikaansNeural.ts";

// Arabic ISO code → engine variety (mirrors the sync registry); every key routes bare text
// through the async diacritizer.
const ARABIC_VARIETY: Record<string, string | undefined> = {
    ar: undefined, arz: "egyptian", apc: "levantine", ajp: "southlevantine", apd: "sudanese",
    acm: "iraqi", afb: "gulf", acw: "hijazi", ary: "moroccan", ayl: "libyan",
};

const NEURAL: Record<string, (text: string) => Promise<string>> = {
    en: phonemizeEnNeural, // BiLSTM OOV reader (else the sync n-gram OOV G2P)
    sd: phonemizeSdNeural, // per-letter BiLSTM restoring the abjad's unwritten short vowels on OOV words
    // per-grapheme BiLSTM reading the words BOTH af lexicons miss: 91.4% vs the rules' 63.5% word-exact
    // on a dictionary-gold held-out split, because af's residual is stress-conditioned vowel quality — contextual, not tabulable
    af: phonemizeAfNeural,
    bn: phonemizeBnNeural,
    da: phonemizeDaNeural,
    nb: phonemizeNbNeural,
    fr: phonemizeFrNeural,
    fa: phonemizeFaNeural,
    he: phonemizeHebrewNeural, // the NAKDAN — restores niqqud on bare Hebrew
    // per-character BiLSTM restoring the WORD BOUNDARIES Khmer does not write: joining two words
    // corrupts the reading 54.6% of the time, measured on writer-typed U+200B junctions
    km: phonemizeKmNeural,
    ur: (t) => phonemizeRiderNeural(t, "ur"),
    ps: (t) => phonemizeRiderNeural(t, "ps"),
    // Western Punjabi (Shahmukhi) is registry code `pnb`, but the rider keys its Perso-Arabic
    // Punjabi as `pa` (the Gurmukhi `pa` is fully voweled → not a rider; it passes through sync).
    pnb: (t) => phonemizeRiderNeural(t, "pa"),
};

/** The language's best ASYNC path, or undefined when its best path is the sync engine. */
export function getNeuralPhonemizer(lang: string): ((text: string) => Promise<string>) | undefined {
    if (lang in ARABIC_VARIETY) return (t) => phonemizeArabic(t, ARABIC_VARIETY[lang]);
    return NEURAL[lang];
}
