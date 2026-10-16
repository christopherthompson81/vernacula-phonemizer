/**
 * Async neural entry for Afrikaans (af). Runs the per-grapheme STRUCTURAL TAGGER (afrikaansTagger.ts, a BiLSTM,
 * ONNX) over the OOV words — those BOTH shipped lexicons miss — and leaves everything else to the SYNC engine.
 *
 * Precedence: curated af-lexicon.tsv → af-rcrl-lexicon.tsv → **tagger** → rules. The tagger sits below the
 * dictionaries because they are exact for the words they cover (86% of running-text tokens) and above the rules
 * because on the words neither covers it is far better: 91.4% vs 63.5% word-exact on a dictionary-gold held-out split.
 *
 * The shared `askedWordsNeuralPrepass` tags each distinct word the engine asks for once and injects the readings as
 * the sync engine's oovOverride, so tokenizer / numbers / normalization / clause assembly stay byte-identical to
 * `phonemize(text, "af")` — only OOV word readings change. When `onnxruntime-node` or the model is absent the
 * tagger is `undefined` and this returns exactly the sync path (no throw). The sync engine is untouched.
 */
import { createAfrikaans } from "./afrikaans.ts";
import { withHost } from "../../core/foreign.ts";
import { createAfrikaansTagger, type AfrikaansTagger } from "./afrikaansTagger.ts";
import { askedWordsNeuralPrepass } from "../../core/structuralTagger.ts";

// ⚠ THE WORDS TAGGED ARE THE WORDS THE ENGINE ASKS FOR, recorded rather than re-derived (#1578). This file used
// to scan the caller's text, BEFORE normalization, so a word the normalizer creates never reached the tagger:
// 28 of the 87 it can emit are in neither lexicon, and `Dit is 90°F.` read *Fahrenheit* by rule while the
// written-out `Fahrenheit` read it by the tagger. Recording also keeps the old NFC-lowercase key and the
// lexicon / rule-reserved skips without restating them: `phonemizeWord` asks only after both lexicons miss,
// never for a rule-reserved word, and under its own NFC-lowercased key. See core/structuralTagger.ts.
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
    if (!tagger) return withHost("af", () => afEngine().text(text)); // no model → sync path
    return askedWordsNeuralPrepass(text, {
        tag: (w) => tagger.tag(w),
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
        // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
        render: (t, oov) => withHost("af", () => afEngine().text(t, oov)),
    });
}
