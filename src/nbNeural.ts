/**
 * Async neural entry for Norwegian Bokmål (nb). Runs the per-grapheme STRUCTURAL TAGGER (norwegianTagger.ts, a
 * BiLSTM, ONNX) over the OOV words — those the NST pronunciation lexicon (nb-lexicon.tsv) misses — and leaves
 * everything else to the SYNC engine (precedence lexicon → tagger → rules). The shared `wordLevelNeuralPrepass`
 * (core/structuralTagger.ts) tags each distinct OOV word once and injects the readings as the sync engine's
 * oovOverride, so tokenizer / numbers / clause assembly stay byte-identical to `phonemize(text, "nb")` — only OOV
 * word readings change. When `onnxruntime-node` or the model is absent the tagger is `undefined` and this returns
 * exactly the sync path (no throw). This is a SEPARATE async path; the sync engine is untouched.
 */
import { createNorwegian, norwegianLexicon } from "./languages/norwegian/norwegian.ts";
import { createNorwegianTagger, type NorwegianTagger } from "./languages/norwegian/norwegianTagger.ts";
import { wordLevelNeuralPrepass } from "./core/structuralTagger.ts";

const WORD = /[A-Za-zÆØÅæøåÉéÈèÊêËëÀàÂâÔôÜü]+/gu;
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
    if (!tagger) return nbEngine().text(text); // no model → sync path
    const lex = norwegianLexicon();
    return wordLevelNeuralPrepass(text, {
        word: WORD,
        lexHas: (w) => lex.has(w.toLowerCase()), // lexicon-covered words are served by the sync lexicon path
        tag: (w) => tagger.tag(w),
        render: (t, oov) => nbEngine().text(t, oov),
    });
}
