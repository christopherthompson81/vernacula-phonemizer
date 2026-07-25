/**
 * Async neural entry for Danish (da). Runs the per-grapheme BiLSTM tagger (danishTagger.ts, ONNX) over the OOV words —
 * those the ~37k shipped lexicon (NST ∩ top-50k freq) misses — and leaves everything else (lexicon, punctuation, clause
 * assembly) to the SYNC engine. Precedence per word: lexicon → BiLSTM tagger → rule g2p. The BiLSTM replaces the old
 * averaged-perceptron OOV tier, which was data-starved on the previous 7.5k lexicon; trained on the FULL 199k NST it is
 * un-starved (~96% symbol held-out) and matches the NST narrow convention. Integration is the shared fleet pre-pass
 * (wordLevelNeuralPrepass, the nb/bn pattern): tag each distinct OOV word once, inject the readings as the sync engine's
 * `oovOverride` — so ONLY OOV word readings change; lexicon + punctuation output is byte-identical to
 * `phonemize(text, "da")`. When `onnxruntime-node` or the model is absent the tagger is `undefined` and this returns
 * exactly the sync path (no throw). This is a SEPARATE async path; the sync engine is untouched.
 */
import { wordLevelNeuralPrepass } from "./core/structuralTagger.ts";
import { createDanish, danishLexicon } from "./languages/danish/danish.ts";
import { createDanishTagger, type DanishTagger } from "./languages/danish/danishTagger.ts";

// The da TOKEN word class (danish.ts) — the pre-pass keys the tagged map by the raw match, which is what the sync
// engine hands `oovOverride`, so precedence lexicon → tagger → rule is preserved for capitalised OOV words too.
const WORD = /[a-zæøåéöäüóèãà]+/giu;
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
    if (!tagger) return E.text(text); // no model → sync path

    const lex = danishLexicon();
    return wordLevelNeuralPrepass(text, {
        word: WORD,
        lexHas: (w) => lex.has(w.toLowerCase()), // lexicon-covered words are served by the sync lexicon path
        tag: (w) => tagger.tag(w), // tagger lowercases+NFCs internally; "" = declined → left to the rule g2p
        render: (t, oov) => E.text(t, oov),
    });
}
