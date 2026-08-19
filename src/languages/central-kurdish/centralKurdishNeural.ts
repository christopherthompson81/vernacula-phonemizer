/**
 * Async neural entry for Central Kurdish (ckb). Runs the BIZROKE tagger (centralKurdishTagger.ts) over the
 * words the AsoSoft-derived lexicon misses and leaves everything else to the SYNC engine. Precedence is
 * lexicon → tagger → rules.
 *
 * Integration is a pre-pass: resolve each OOV Sorani word with the tagger, then run the ordinary sync engine
 * with those readings injected as its `oovOverride`. Tokenizer, number composition and clause assembly stay the
 * sync engine's, byte-identical to `phonemize(text, "ckb")` — ONLY the OOV word readings change, and by
 * construction they change only by an inserted /ɪ/. When `onnxruntime-node` or the model is absent the tagger
 * is `undefined` and this is exactly the sync path (no throw).
 */
import { bizrokeLexiconHas, createCentralKurdishEngine } from "./central-kurdish.ts";
import { normalizeCentralKurdish } from "./normalize.ts";
import { withHost } from "../../core/foreign.ts";
import { createCentralKurdishTagger, type CentralKurdishTagger } from "./centralKurdishTagger.ts";
import { wordLevelNeuralPrepass } from "../../core/structuralTagger.ts";

const WORD = /[ؠ-ۿ‌]+/gu;
let taggerP: Promise<CentralKurdishTagger | undefined> | undefined;
let engine: ReturnType<typeof createCentralKurdishEngine> | undefined;
const ckbEngine = () => (engine ??= createCentralKurdishEngine());

/** Phonemize Sorani text with the bizroke tagger filling the OOV tail. */
export async function phonemizeCkbNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createCentralKurdishTagger();
    const tagger = await taggerP;
    if (!tagger) return withHost("ckb", () => ckbEngine().text(text));
    // ⚠ NORMALISE FIRST. The pre-pass keys its readings by the word as it appears in `text`, but the engine
    // tokenizes the NORMALISED text — so an Arabic yeh/kaf rewritten by normalize.ts would key the override
    // under a word the engine never asks for. Measured on the FLEURS ckb corpus: 162 of 5,655 tokens (2.9%)
    // differ, i.e. that fraction would silently fall through to the rule reading. `normalizeCentralKurdish`
    // is idempotent (verified over all 3,040 corpus rows), so the engine re-running it below is a no-op.
    return wordLevelNeuralPrepass(normalizeCentralKurdish(text), {
        word: WORD,
        lexHas: (w) => bizrokeLexiconHas(w), // the same lookup the engine does
        tag: (w) => tagger.tag(w),
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host.
        render: (t, oov) => withHost("ckb", () => ckbEngine().text(t, oov)),
    });
}
