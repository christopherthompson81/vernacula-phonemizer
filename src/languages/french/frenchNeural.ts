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
import { createFrenchForPrepass, frenchHasWord } from "./french.ts";
import { createFrenchTagger, type FrenchTagger } from "./frenchTagger.ts";

const WORD = /[a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?/giu;
// The tagger's a–z + accented training letters (no apostrophe/elision). Its vocab also has the hyphen, but `WORD`
// never matches one: a hyphenated compound reaches the tagger part by part, through `phonemizeWord`'s recursion.
const IN_VOCAB = /^[a-zà-ÿœæ]+$/u;
let taggerP: Promise<FrenchTagger | undefined> | undefined;
let engine: ReturnType<typeof createFrenchForPrepass> | undefined;
const frEngine = (): ReturnType<typeof createFrenchForPrepass> => (engine ??= createFrenchForPrepass());

/**
 * Phonemize French text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to the
 * plain sync path (Lexique + rule g2p) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeFrNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createFrenchTagger();
    const tagger = await taggerP;
    const E = frEngine();
    if (!tagger) return withHost("fr", () => E.textNormalized(E.normalizedFor(text))); // no model → sync path
    return frenchPrepassWith(tagger, text);
}

/**
 * The pre-pass and render with a given tagger. Exported so a test can hand it a RECORDING tagger and see which
 * words are offered — which no reading can show while the tagger and the g2p agree. (`vi.mock` cannot do it:
 * the suite shares one module registry per worker, so `taggerP` may already hold an unwrapped tagger.)
 */
export function frenchPrepassWith(tagger: Pick<FrenchTagger, "tag">, text: string): Promise<string> {
    const E = frEngine();
    // Shared pre-pass, keyed by the LOWERCASED form (the key the sync resolver consults oovOverride with).
    // Lexicon- and supplement-covered words are served by the sync lexicon path; a word outside the tagger's
    // training vocab (e.g. an elision apostrophe) is skipped so the sync rule g2p handles it.
    // ⚠ THE NORMALIZED TEXT, NOT THE CALLER'S (#1463, the shape English fixed in #1452). This scanned `text`,
    // so a word the NORMALIZER creates — a number word, an expanded abbreviation, a unit — was never tagged.
    // Normalized ONCE, here, and handed to `textNormalized` rather than normalized again.
    // ⚠ THE LETTER NAMES ARE WHY THE ORDER OF THE FIX MATTERED. An initialism's spelled-out letters (`effe`,
    // `emme`, `ji`) are exactly such words, and the tagger reads them wrong (ef, ɑ̃m, dʒi) where the rule g2p
    // is right — so supplement.tsv carries them first and `frenchHasWord` keeps them away from the tagger.
    const normalized = E.normalizedFor(text);
    return wordLevelNeuralPrepass(normalized, {
        word: WORD,
        key: (w) => w.toLowerCase(),
        lexHas: (lower) => frenchHasWord(lower) || !IN_VOCAB.test(lower),
        tag: (lower) => tagger.tag(lower),
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
        // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
        render: (t, oov) => withHost("fr", () => E.textNormalized(t, oov)),
    });
}
