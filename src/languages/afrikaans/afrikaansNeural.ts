/**
 * Async neural entry for Afrikaans (af). Runs the per-grapheme STRUCTURAL TAGGER (afrikaansTagger.ts, a BiLSTM,
 * ONNX) over the OOV words — those BOTH shipped lexicons miss — and leaves everything else to the SYNC engine.
 *
 * Precedence: curated af-lexicon.tsv → af-rcrl-lexicon.tsv → **tagger** → rules. The tagger sits below the
 * dictionaries because they are exact for the words they cover (86% of running-text tokens) and above the rules
 * because on the words neither covers it is far better: 91.8% vs 64.0% word-exact on a held-out split.
 *
 * The shared `wordLevelNeuralPrepass` tags each distinct OOV word once and injects the readings as the sync
 * engine's oovOverride, so tokenizer / numbers / normalization / clause assembly stay byte-identical to
 * `phonemize(text, "af")` — only OOV word readings change. When `onnxruntime-node` or the model is absent the
 * tagger is `undefined` and this returns exactly the sync path (no throw). The sync engine is untouched.
 */
import { createAfrikaans, afrikaansLexiconHas } from "./afrikaans.ts";
import { createAfrikaansTagger, type AfrikaansTagger } from "./afrikaansTagger.ts";
import { wordLevelNeuralPrepass } from "../../core/structuralTagger.ts";

// Mirrors the sync engine's TOKEN word class (Latin-script runs with an optional internal apostrophe).
const WORD = /['’]?\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*/gu;
let taggerP: Promise<AfrikaansTagger | undefined> | undefined;
let engine: ReturnType<typeof createAfrikaans> | undefined;
const afEngine = (): ReturnType<typeof createAfrikaans> => (engine ??= createAfrikaans());

/**
 * Phonemize Afrikaans text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back
 * to the plain sync path (lexicons + rule engine) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeAfNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createAfrikaansTagger();
    const tagger = await taggerP;
    if (!tagger) return afEngine().text(text); // no model → sync path
    return wordLevelNeuralPrepass(text, {
        word: WORD,
        key: (w) => w.toLowerCase(),
        lexHas: (w) => afrikaansLexiconHas(w), // lexicon-covered words are served by the sync lexicon path
        tag: (w) => tagger.tag(w),
        render: (t, oov) => afEngine().text(t, oov),
    });
}
