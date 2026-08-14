/**
 * Async neural entry for Sindhi (sd). Runs the per-letter STRUCTURAL TAGGER (sindhiTagger.ts, a BiLSTM, ONNX)
 * over the OOV words — those the vocalized lexicon (sindhi-lexicon.tsv) misses — and leaves everything else to
 * the SYNC engine. Precedence is lexicon → tagger → default-ə rules.
 *
 * Integration is a pre-pass: resolve each OOV Sindhi word with the tagger, then run the ordinary sync engine with
 * those readings injected as its `oovOverride`. Tokenizer, clause/pause assembly and lexicon precedence stay the
 * sync engine's, byte-identical to `phonemize(text, "sd")` — ONLY the OOV word readings change. When
 * `onnxruntime-node` or the model is absent the tagger is `undefined` and this is exactly the sync path (no throw).
 */
import { createSindhiEngine, sindhiLexiconHas } from "./sindhi.ts";
import { withHost } from "../../core/foreign.ts";
import { createSindhiTagger, type SindhiTagger } from "./sindhiTagger.ts";
import { wordLevelNeuralPrepass } from "../../core/structuralTagger.ts";

const WORD = /[؀-ۿݐ-ݿ]+/gu;
let taggerP: Promise<SindhiTagger | undefined> | undefined;
let engine: ReturnType<typeof createSindhiEngine> | undefined;
const sdEngine = () => (engine ??= createSindhiEngine());

/** Phonemize Sindhi text with the neural tagger filling the OOV tail. */
export async function phonemizeSdNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createSindhiTagger();
    const tagger = await taggerP;
    if (!tagger) return withHost("sd", () => sdEngine().text(text));
    return wordLevelNeuralPrepass(text, {
        word: WORD,
        lexHas: (w) => sindhiLexiconHas(w), // same lookup the engine does — see sindhiLexiconHas
        tag: (w) => tagger.tag(w),
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
        // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
        render: (t, oov) => withHost("sd", () => sdEngine().text(t, oov)),
    });
}
