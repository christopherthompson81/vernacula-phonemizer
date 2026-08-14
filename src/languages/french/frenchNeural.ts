/**
 * Async neural entry for French (fr). Runs the per-grapheme BiLSTM tagger (frenchTagger.ts, ONNX) over the OOV words —
 * those the Lexique 3.83 lexicon misses — and leaves everything else (lexicon, numbers, liaison, phrase accent,
 * punctuation) to the SYNC engine. Precedence per word: lexicon → BiLSTM tagger → rule g2p. On a clean Lexique held-out
 * the tagger cuts the OOV phone-error-rate from 5.7% to 0.9% (word-exact 94.9% vs the rule engine's 76.6%). Integration
 * is a pre-pass: resolve each OOV word to IPA with the tagger, then run the ordinary sync `createFrench().text()` with
 * those readings injected as its `oovOverride` — so ONLY OOV word readings change; numbers, liaison, and accentuation
 * are byte-identical to `phonemize(text, "fr")`. When `onnxruntime-node` or the model is absent the tagger is
 * `undefined` and this returns exactly the sync path (no throw). This is a SEPARATE async path; the sync engine is
 * untouched.
 */
import { wordLevelNeuralPrepass } from "../../core/structuralTagger.ts";
import { withHost } from "../../core/foreign.ts";
import { createFrench, frenchLexicon } from "./french.ts";
import { createFrenchTagger, type FrenchTagger } from "./frenchTagger.ts";

const WORD = /[a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?/giu;
const IN_VOCAB = /^[a-zà-ÿœæ-]+$/u; // the tagger's a–z + accented + hyphen training vocab (no apostrophe/elision)
let taggerP: Promise<FrenchTagger | undefined> | undefined;
let engine: ReturnType<typeof createFrench> | undefined;
const frEngine = (): ReturnType<typeof createFrench> => (engine ??= createFrench());

/**
 * Phonemize French text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to the
 * plain sync path (Lexique + rule g2p) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeFrNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createFrenchTagger();
    const tagger = await taggerP;
    const E = frEngine();
    if (!tagger) return withHost("fr", () => E.text(text)); // no model → sync path

    // Shared pre-pass, keyed by the LOWERCASED form (the key the sync resolver consults oovOverride with).
    // Lexicon-covered words are served by the sync lexicon path; a word outside the tagger's training vocab
    // (e.g. an elision apostrophe) is skipped so the sync rule g2p handles it.
    const lex = frenchLexicon();
    return wordLevelNeuralPrepass(text, {
        word: WORD,
        key: (w) => w.toLowerCase(),
        lexHas: (lower) => lex.has(lower) || !IN_VOCAB.test(lower),
        tag: (lower) => tagger.tag(lower),
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
        // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
        render: (t, oov) => withHost("fr", () => E.text(t, oov)),
    });
}
