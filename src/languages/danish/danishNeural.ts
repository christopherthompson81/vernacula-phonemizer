/**
 * Async neural entry for Danish (da). Runs the per-grapheme BiLSTM tagger (danishTagger.ts, ONNX) over the OOV words —
 * those the ~37k shipped lexicon (NST ∩ top-50k freq) misses — and leaves everything else (lexicon, punctuation, clause
 * assembly) to the SYNC engine. Precedence per word: lexicon → BiLSTM tagger → rule g2p. The BiLSTM replaces the old
 * averaged-perceptron OOV tier, which was data-starved on the previous 7.5k lexicon; trained on the FULL 199k NST it is
 * un-starved (~96% symbol held-out) and matches the NST narrow convention. Integration is the shared fleet pre-pass
 * (askedWordsNeuralPrepass): tag each distinct word the engine asks `oovOverride` for, then inject the readings —
 * so ONLY OOV word readings change; lexicon + punctuation output is byte-identical to
 * `phonemize(text, "da")`. When `onnxruntime-node` or the model is absent the tagger is `undefined` and this returns
 * exactly the sync path (no throw). This is a SEPARATE async path; the sync engine is untouched.
 */
import { askedWordsNeuralPrepass } from "../../core/structuralTagger.ts";
import { withHost } from "../../core/foreign.ts";
import { createDanish } from "./danish.ts";
import { createDanishTagger, type DanishTagger } from "./danishTagger.ts";

/**
 * ⚠ THE WORDS TAGGED ARE THE WORDS THE ENGINE ASKS FOR, recorded rather than re-derived (#1578). This file used
 * to scan the caller's text with its own copy of the engine's tokenizer and key, and drifted twice:
 *   · keyed by the RAW match where danish.ts asks for the NATIVISED spelling, so `Galápagosøer`, `Cañitas`
 *     and 19 other FLEURS da_dk types were tagged under a key the engine never looked up (`Cañitas` was
 *     even split, as `Ca` + `itas`);
 *   · scanning the text BEFORE normalization, so no number word was ever tagged. `47` read
 *     *sˈyvoɡfyʁə* by rule while the same word written out, `syvogfyrre`, read *ˈsywˀɐwfœːɐ* by the tagger:
 *     82 of the 181 words the normalizer and the number words create are outside the lexicon.
 * See `askedWordsNeuralPrepass` in core/structuralTagger.ts.
 */
let taggerP: Promise<DanishTagger | undefined> | undefined;
let engine: ReturnType<typeof createDanish> | undefined;
const daEngine = (): ReturnType<typeof createDanish> => (engine ??= createDanish());

/**
 * Phonemize Danish text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to the
 * plain sync path (NST lexicon + rule g2p) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeDaNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createDanishTagger();
    const tagger = await taggerP;
    const E = daEngine();
    if (!tagger) return withHost("da", () => E.text(text)); // no model → sync path
    return askedWordsNeuralPrepass(text, {
        tag: (w) => tagger.tag(w), // tagger lowercases+NFCs internally; "" = declined → left to the rule g2p
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
        // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
        render: (t, oov) => withHost("da", () => E.text(t, oov)),
    });
}
