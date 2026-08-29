/**
 * vernacula-phonemizer — canonical-IPA.
 *
 *   phonemize("भारत", "hi") → "bʱaːɾət̪"
 *   phonemize("I read a book", "en") → "aᶦ ɹˈɛd ə bˈʊk"
 */
import { startTrace, stopTrace, type TraceRewrite, type TraceToken } from "./core/trace.ts";
import { getPhonemizer } from "./registry.ts";
import { getNeuralPhonemizer } from "./neuralRegistry.ts";
import { prewarmForeignEnglish } from "./languages/english/englishNeural.ts";

/**
 * Does `text` mix a Latin run into a non-Latin script? Then the host's tokenizer will not claim the Latin and it
 * becomes a FOREIGN RUN, delegated to English (core/foreign.ts) — so its OOV words are worth prewarming.
 *
 * The gate is on the TEXT, not a table of host scripts, because that is what the delegation actually keys on, and
 * because it keeps the prewarm off the languages that would waste it: a Latin-script host (en, vi, tr, …) reads
 * its own words, so an all-Latin text needs nothing tagged for the foreign path.
 */
const MIXED_LATIN = (text: string): boolean =>
    /\p{Script=Latin}/u.test(text) && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Devanagari}\p{Script=Tamil}\p{Script=Ethiopic}\p{Script=Hebrew}\p{Script=Bengali}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Sinhala}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Georgian}\p{Script=Armenian}\p{Script=Greek}\p{Script=Tibetan}\p{Script=Oriya}\p{Script=Thaana}\p{Script=Syriac}\p{Script=Cherokee}]/u.test(text);

export { getPhonemizer, type Phonemizer } from "./registry.ts";
export type { TraceRewrite, TraceToken } from "./core/trace.ts";

/** Phonemize `text` in language `lang` to canonical IPA (SYNCHRONOUS). Throws for an unregistered language.
 *  This is the simple path: a complete rule/lexicon engine for every language. Two caveats it does NOT cover —
 *  the unpointed ABJADS (Arabic `ar`+dialects, Hebrew `he`) expect VOCALIZED input here (bare text → the consonant
 *  skeleton), and the languages with a neural OOV/restoration upgrade (en, bn, da, nb, fr, fa, ur, ps, pnb) use
 *  their SYNC fallback. `phonemizeAsync` covers both — prefer it for real-world text. */
export function phonemize(text: string, lang: string): string {
    return getPhonemizer(lang).text(text);
}

/** The result of {@link phonemizeTrace}: the reading, the text its spans index, and the per-token record. */
export interface PhonemeTrace {
    /** Byte-identical to `phonemize(text, lang)`. */
    ipa: string;
    /** The text the tokenizer saw — `normalize.ts` has already rewritten it. `token.span` indexes THIS. */
    normalized: string;
    /**
     * ⚠ FALSE MEANS THIS ENGINE IS NOT TRACED, NOT THAT IT HAD NOTHING TO SAY. `tokens` is derived at
     * `assembleClauses`, which 159 of 180 language directories route through — but `en`, `fr`, `cmn` and `my`
     * hand-roll their own tokenizer loop (english's two-phase tagger, french's liaison lookahead), so they
     * emit no tokens at all. Returning an empty list silently would be the same defect this trace exists to
     * expose: an absence that reads like a clean result. Check this before believing `tokens`.
     */
    traced: boolean;
    tokens: TraceToken[];
    /**
     * Whole-string rewrites, in the order they ran. ⚠ THIS IS WHY `TraceToken.emitted` MAY NOT BE A SUBSTRING
     * OF `ipa`: a token reports what it contributed, and a rewrite here may then have changed it. Spanish
     * spirantizes across word boundaries; Assamese collapses a doubled aspirate. Empty when nothing moved.
     *
     * ⚠ AND IT IS ALSO WHY `TraceToken.ipaSpan` CAN BE ABSENT (#1150 stage 3). A rewrite that is one
     * character for one leaves every offset meaning what it meant, so the spans survive it; one that changes
     * lengths does not, and the span is withheld rather than pointed at a string that no longer exists.
     * Measured over the golden corpus: six of the eight are positional and keep their spans, `as` and `fr-CA`
     * are not and lose them.
     */
    rewrites: TraceRewrite[];
}

/**
 * `phonemize`, plus what happened on the way — the additive trace of #1150 stage 1.
 *
 * ⚠ `ipa` IS BYTE-IDENTICAL TO `phonemize(text, lang)`, and `test/trace.test.ts` asserts that over the golden
 * corpus. This adds a second VIEW of the same run, never a second reading: the parity gate is 136 languages ×
 * 26,827 rows across two engines, and a second output shape that could drift from the first would be a fork
 * wearing a feature's clothes.
 *
 * ⚠ SPANS INDEX `normalized`, NOT `text`. `normalize.ts` runs before the tokenizer and REWRITES — it changes
 * length in both directions and can REORDER (Luganda puts the measure noun before its number, so `1 244.7 km²`
 * reads *kiromita eza kyebiriga 1244 7* with the unit's reading ahead of the figure it came after). Mapping a
 * span back to the caller's own string is therefore not a matter of an offset, and is deliberately NOT
 * attempted here — that is #1150 stage 2. `normalized` is returned so the spans mean something.
 *
 * What stage 1 buys, which is the whole reason it was worth doing on its own: `nativised` makes the
 * input-side rewrite legible. It is the step that folded ⟨ŋ⟩→n before the g2p ran (#1131), that made a
 * deliberate ⟨ŋ⟩ rule unreachable (#1139), and that erased Nama's phonemic length (#1140) — none of which
 * moved a golden row, and all of which had to be found by a human reading a comment.
 */
export function phonemizeTrace(text: string, lang: string): PhonemeTrace {
    startTrace(text);
    try {
        const ipa = phonemize(text, lang);
        const { normalized, tokens, rewrites, traced } = stopTrace(ipa);
        return { ipa, normalized, traced, tokens, rewrites };
    } finally {
        // `stopTrace` already ran on the success path; this clears the recorder when the engine THREW, so a
        // failed call cannot leave ambient state for the next one.
        stopTrace();
    }
}

/** Phonemize real-world text to canonical IPA — the UNIFIED best-output entry. Identical to `phonemize` for the
 *  bulk, but routes each language to its best available path (neuralRegistry.ts): the unpointed ABJADS restore
 *  their unwritten vowels from BARE input (Arabic `ar`+dialects via the neural diacritizer), and the
 *  neural-upgrade languages (en's BiLSTM OOV, bn/da/nb/fr taggers, he NAKDAN, fa + the ur/ps/pnb Perso-Arabic
 *  riders) use their ONNX model. Every other language resolves synchronously. When a model / `onnxruntime-node`
 *  is absent each path degrades to the sync engine, so this is always safe to call. Use this for undiacritized /
 *  novel-word text.
 *
 *  ⚠ THE TWO ENTRIES SHARE THE REGISTRY'S PRE-PASSES. Markup stripping, the native/fullwidth digit folds, the
 *  vulgar-fraction fold, the Roman-numeral pass and the foreign-run host apply here exactly as they do to
 *  `phonemize` — they used not to, because the async registry's entries build their engine directly and so
 *  never reached the wrapper `getPhonemizer` installs. `getNeuralPhonemizer` applies them now; see the note
 *  there, and `test/phonemizeAsync.test.ts` for the invariant that keeps the two in step. */
export async function phonemizeAsync(text: string, lang: string): Promise<string> {
    // FOREIGN RUNS FIRST. An embedded Latin run is read by a synchronous reader (core/foreign.ts), so its OOV
    // words have to be tagged BEFORE the host renders — there is no await available once the host's tokenizer is
    // running. Skipped for English itself, whose entry tags its own OOV tail. Never throws the host's render:
    // the memo is an optimisation, and an empty one is the pre-existing behaviour.
    if (lang !== "en" && MIXED_LATIN(text)) {
        try {
            await prewarmForeignEnglish(text);
        } catch {
            // A missing model or a tagger failure must not take the utterance down.
        }
    }
    const neural = getNeuralPhonemizer(lang);
    return neural ? neural(text) : phonemize(text, lang);
}
