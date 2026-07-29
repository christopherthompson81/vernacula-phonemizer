/**
 * Async neural entry for English (en). Runs the per-grapheme BiLSTM tagger (englishTagger.ts, ONNX) over the OOV words
 * — those the CMUdict lexicon misses — and leaves everything else (dict, heteronym POS disambiguation, numbers,
 * possessives, clause assembly) to the SYNC engine. Precedence per word: heteronym → lexicon → possessive → BiLSTM
 * tagger → n-gram engine. On a clean CMUdict held-out the tagger roughly HALVES the OOV phone-error-rate vs the n-gram
 * (7.4% vs 18.2%; 92.6% vs 81.8% phone-accuracy). Integration is a pre-pass: resolve each OOV word to IPA with the
 * tagger, then run the ordinary sync
 * `createEnglish().text()` with those readings injected as its `oovOverride` — so ONLY OOV word readings change;
 * numbers, heteronyms, and punctuation are byte-identical to `phonemize(text, "en")`. When `onnxruntime-node` or the
 * model is absent the tagger is `undefined` and this returns exactly the sync path (no throw).
 */
import { createEnglish } from "./english.ts";
import { createEnglishTagger, type EnglishTagger } from "./englishTagger.ts";

const WORD = /[A-Za-z][A-Za-z']*/gu;
let taggerP: Promise<EnglishTagger | undefined> | undefined;
let engine: ReturnType<typeof createEnglish> | undefined;
const enEngine = (): ReturnType<typeof createEnglish> => (engine ??= createEnglish());

/** The sync resolver's OOV key: strip a trailing possessive ('s / s'), then any apostrophes — the exact `g2pKey`
 *  resolveWord() consults `oovOverride` with, so the pre-pass map lines up. */
function g2pKeyOf(word: string): string {
    const lower = word.toLowerCase();
    let lookup = lower;
    if (lower.endsWith("'s") && lower.length > 2) lookup = lower.slice(0, -2);
    else if (lower.endsWith("'") && lower.length > 2 && lower[lower.length - 2] === "s") lookup = lower.slice(0, -1);
    return lookup.replace(/'/gu, "");
}

/**
 * Phonemize English text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to
 * the plain sync path (CMUdict + n-gram engine) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeEnNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createEnglishTagger();
    const tagger = await taggerP;
    const E = enEngine();
    if (!tagger) return E.text(text); // no model → sync path

    // PRE-PASS: tag each distinct OOV word once. Skip words the sync engine already knows (dict/heteronym) — they are
    // served authoritatively by the sync path; genuinely-OOV pure-alpha words go to the BiLSTM. An empty tag ("")
    // means the tagger DECLINED (an out-of-vocab letter) → leave it out so the sync n-gram engine handles the word.
    const tagged = new Map<string, string>();
    for (const m of text.matchAll(WORD)) {
        const w = m[0];
        if (E.knownWord(w) !== undefined) continue; // dict / heteronym → sync path
        const key = g2pKeyOf(w);
        if (tagged.has(key) || !/^[a-z]+$/u.test(key)) continue;
        const ipa = await tagger.tag(key);
        if (ipa) tagged.set(key, ipa);
    }
    // Run the SYNC engine with the tagger readings injected between the lexicon and the n-gram — everything else
    // (numbers, heteronym POS, possessives, punctuation) is the sync path, so only OOV word readings differ.
    return E.text(text, undefined, (g2pKey) => tagged.get(g2pKey));
}
