/**
 * Async neural entry for Norwegian Bokmål (nb). Runs the per-grapheme STRUCTURAL TAGGER (norwegianTagger.ts, a
 * BiLSTM, ONNX) over the OOV words — those the NST pronunciation lexicon (nb-lexicon.tsv) misses — and leaves
 * everything else to the SYNC engine (precedence lexicon → tagger → rules). The shared `askedWordsNeuralPrepass`
 * (core/structuralTagger.ts) tags each distinct word the engine asks for once and injects the readings as its
 * oovOverride, so tokenizer / numbers / clause assembly stay byte-identical to `phonemize(text, "nb")` — only OOV
 * word readings change. When `onnxruntime-node` or the model is absent the tagger is `undefined` and this returns
 * exactly the sync path (no throw). This is a SEPARATE async path; the sync engine is untouched.
 */
import { createNorwegian } from "./norwegian.ts";
import { withHost } from "../../core/foreign.ts";
import { createNorwegianTagger, type NorwegianTagger } from "./norwegianTagger.ts";
import { askedWordsNeuralPrepass } from "../../core/structuralTagger.ts";

// ⚠ THE WORDS TAGGED ARE THE WORDS THE ENGINE ASKS FOR, recorded rather than re-derived (#1578). This file used
// to scan the caller's text with a hand-listed letter class, keyed by the raw match, while norwegian.ts asks
// for the NATIVISED whole token: `Dvořák` was offered as `Dvo` + `k` while the engine asked for `Dvorak`, and
// `São` as `S` + `o` against `Sao`, so those words read by rule. It also scanned the text before normalization,
// so no word the normalizer creates was tagged. See `askedWordsNeuralPrepass` in core/structuralTagger.ts.
let taggerP: Promise<NorwegianTagger | undefined> | undefined;
// One built engine, reused across calls (like the sync path's singleton — no per-call rebuild).
let engine: ReturnType<typeof createNorwegian> | undefined;
const nbEngine = (): ReturnType<typeof createNorwegian> => (engine ??= createNorwegian());

/**
 * Phonemize Norwegian text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to
 * the plain sync path (lexicon + rule engine) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeNbNeural(text: string): Promise<string> {
    if (taggerP === undefined) taggerP = createNorwegianTagger();
    const tagger = await taggerP;
    if (!tagger) return withHost("nb", () => nbEngine().text(text)); // no model → sync path
    return askedWordsNeuralPrepass(text, {
        tag: (w) => tagger.tag(w),
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
        // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
        render: (t, oov) => withHost("nb", () => nbEngine().text(t, oov)),
    });
}
