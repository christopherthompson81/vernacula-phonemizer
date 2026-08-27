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
import { wordLevelNeuralPrepass } from "../../core/structuralTagger.ts";
import { withHost } from "../../core/foreign.ts";
import { createDanish, danishLexicon, nat, DA_WORD } from "./danish.ts";
import { createDanishTagger, type DanishTagger } from "./danishTagger.ts";

/**
 * ⚠ THE PRE-PASS MUST TOKENIZE AND KEY EXACTLY AS THE SYNC ENGINE DOES, and for 22 corpus tokens it did not —
 * so the tagger tier this file exists to install was SKIPPED for them and the rule engine answered instead.
 * `danish.ts` hands `oovOverride` the NATIVISED spelling of a LATIN_RUN match (`nat(m[1])`); this file used a
 * hand-listed letter class keyed by the RAW match. Both halves miss:
 *   · a letter the nativiser rewrites is a KEY MISS — `Galápagosøer` was tagged under its own spelling while
 *     the engine asked for `Galapagosøer`, so it read *ɡˈalapaɡosøɐ* by rule against the tagger's
 *     *ɡaˈlaːˀpaˌɡɐsˌøːˀɐ*; likewise `taínoer` (×2), `Guaraníerne`, `Haldarsvík`, `Chişinău`, `Asunción`, …
 *   · a letter the hand list omits SPLITS the word — `Cañitas` was tagged as `Ca` + `itas`, two readings the
 *     engine never asks for, while it asked for `Canitas` and got nothing.
 * 21 distinct types over FLEURS da_dk, every one of which the tagger CAN read (it declines nothing here,
 * because the fold has already removed the out-of-vocab letter). Deriving both from danish.ts's own exports
 * is what keeps the two tokenizers from drifting again.
 */
// ⚠ `DA_WORD`, NOT core's `LATIN_RUN`. Danish's word arm claims a MEDIAL APOSTROPHE (`FN's`, `DNA'et`) and
// core's does not, so importing the shared one would tokenize differently from the engine this pre-pass
// feeds — the exact drift the ⚠ above records, re-opened one layer down.
const WORD = new RegExp(DA_WORD, "gu"); // `gu` to match danish.ts's TOKEN — see the flag note there
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

    const lex = danishLexicon();
    return wordLevelNeuralPrepass(text, {
        word: WORD,
        key: nat, // …the spelling danish.ts's text() hands oovOverride; see the ⚠ on WORD
        lexHas: (w) => lex.has(w.toLowerCase()), // lexicon-covered words are served by the sync lexicon path
        tag: (w) => tagger.tag(w), // tagger lowercases+NFCs internally; "" = declined → left to the rule g2p
        // `withHost` — the engine is built here rather than by the registry, so nothing else pushes the host
        // and a foreign run would be dropped for want of one (core/foreign.ts). Sync, as that stack requires.
        render: (t, oov) => withHost("da", () => E.text(t, oov)),
    });
}
