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
 * are untouched. See src/languages/bengali/bn-g2p-tagger.PROVENANCE.md.
 */
import { createBengali, bengaliLexicon } from "./languages/bengali/bengali.ts";
import { createBengaliTagger, type BengaliTagger } from "./languages/bengali/bengaliTagger.ts";
import { BENGALI_WORD } from "./core/unicode.ts";

const WORD = new RegExp(`[${BENGALI_WORD}]+`, "gu");
let taggerP: Promise<BengaliTagger | undefined> | undefined;

/**
 * Phonemize Bengali text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to
 * the plain sync path (lexicon + rule engine) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeBnNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createBengaliTagger();
    const tagger = await taggerP;
    if (!tagger) return createBengali().text(text); // no model → sync path

    // PRE-PASS: tag every distinct OOV word once (lexicon-covered words are served by the sync lexicon path, so
    // skip them). The tagger emits final IPA directly, matching the lexicon/engine convention.
    const lex = bengaliLexicon();
    const tagged = new Map<string, string>();
    for (const m of text.matchAll(WORD)) {
        const w = m[0];
        if (!tagged.has(w) && !lex.has(w.normalize("NFC"))) tagged.set(w, await tagger.tag(w));
    }
    // Run the SYNC engine with the tagger readings injected between lexicon and rules — everything else (numbers,
    // Latin, punctuation, clause assembly) is the sync path, so only OOV word readings differ.
    return createBengali(undefined, (w) => tagged.get(w)).text(text);
}
