/**
 * Async neural entry for Bengali (bn). Runs the per-grapheme STRUCTURAL TAGGER (bengaliTagger.ts, a BiLSTM,
 * ONNX) over the OOV words — those the authoritative Kolkata gold + cross-source consensus lexicon
 * (bengali-lexicon.tsv) miss — and leaves everything else to the SYNC engine. Precedence is lexicon → tagger →
 * rule engine: the tagger's whole-word bidirectional pass reads Bengali's ɔ/o raising + inherent-vowel deletion
 * (held-out OOV ɔ/o 90.5% vs the rule engine's 62.6%), and because it emits one IPA-chunk per grapheme it CANNOT
 * degenerate or break the consonant skeleton.
 *
 * Integration is a pre-pass: resolve each OOV Bengali word to IPA with the tagger, then run the ordinary sync
 * `createBengali(...).text()` with those readings injected as its `oovOverride`. So the tokenizer, number path,
 * clause/pause assembly, and lexicon precedence are the SYNC engine's, byte-identical to `phonemize(text, "bn")` —
 * ONLY the OOV word readings change. When `onnxruntime-node` or the model is absent the tagger is `undefined` and
 * this returns exactly the sync path (no throw). This is a SEPARATE async path; the sync engine and its C#-parity
 * are untouched. See data/languages/bengali/bn-g2p-tagger.PROVENANCE.md.
 */
import { createBengali, bengaliLexicon } from "./bengali.ts";
import { withHost } from "../../core/foreign.ts";
import { createBengaliTagger, type BengaliTagger } from "./bengaliTagger.ts";
import { getPhonemizer } from "../../registry.ts";
import { BENGALI_WORD } from "../../core/unicode.ts";
import { wordLevelNeuralPrepass } from "../../core/structuralTagger.ts";

const WORD = new RegExp(`[${BENGALI_WORD}]+`, "gu");
let taggerP: Promise<BengaliTagger | undefined> | undefined;
// One built engine, reused across calls (like the sync path's singleton — no per-call rebuild). Built WITH the same
// English `foreign` phonemizer the registry wires for "bn", so embedded Latin is transliterated identically to
// phonemize(text,"bn"); getPhonemizer is called lazily so there is no import cycle at module init.
let engine: ReturnType<typeof createBengali> | undefined;
const bnEngine = (): ReturnType<typeof createBengali> =>
    (engine ??= createBengali((latin) => getPhonemizer("en").text(latin)));

/**
 * Phonemize Bengali text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to
 * the plain sync path (lexicon + rule engine) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeBnNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createBengaliTagger();
    const tagger = await taggerP;
    if (!tagger) return withHost("bn", () => bnEngine().text(text)); // no model → sync path
    const lex = bengaliLexicon();
    return wordLevelNeuralPrepass(text, {
        word: WORD,
        lexHas: (w) => lex.has(w.normalize("NFC")), // lexicon-covered words are served by the sync lexicon path
        tag: (w) => tagger.tag(w),
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
        // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
        render: (t, oov) => withHost("bn", () => bnEngine().text(t, oov)),
    });
}
