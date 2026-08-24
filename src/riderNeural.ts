/**
 * Async neural entry for the Perso-Arabic riders (Urdu, Persian, Pashto, Punjabi-Shahmukhi) — the deploy wrapper
 * that runs the shared multilingual BiLSTM harakat pre-pass (core/riderDiacritizer.ts, ONNX) and then the SYNC
 * phonemizer. This is the full two-layer path: the pre-pass leaves lexicon-covered words BARE (the sync g2p's
 * restoreHarakat then applies the authoritative gold lexicon) and neural-vocalizes only the rest — so precedence
 * is lexicon → neural → default. When the optional `onnxruntime-node` dep or the .onnx model is absent the pre-pass
 * is a no-op and you get exactly the sync `phonemize(text, lang)` (lexicon + default). Bare Arabic uses the
 * separate `phonemizeArabic`; this is its rider analogue.
 */
import { renderInHost } from "./registry.ts";
import { createRiderDiacritizer, type RiderDiacritizer } from "./core/riderDiacritizer.ts";
import { coverageLexicon as ur } from "./languages/urdu/urdu.ts";
import { harakatLexicon as fa } from "./languages/persian/persian.ts";
import { harakatLexicon as ps } from "./languages/pashto/pashto.ts";
import { harakatLexicon as pa } from "./languages/punjabi/punjabi.ts";

// The model's language token codes (train_multilingual_harakat.py LANGS) → each rider's coverage-lexicon ACCESSOR.
// Lazy (functions, not eager Maps) so a single-language neural call loads only that rider's lexicon, not all four.
const LEXICONS: Record<string, () => ReadonlyMap<string, string>> = { ur, fa, ps, pa };

/** The rider languages served by the neural pre-pass (the model was trained on exactly these + Arabic). */
export const NEURAL_RIDERS = Object.keys(LEXICONS);

let diacritizer: Promise<RiderDiacritizer | undefined> | undefined;

/**
 * Phonemize bare (undiacritized) rider text via the neural short-vowel pre-pass + the sync g2p. `lang` must be one
 * of NEURAL_RIDERS. Async because the ONNX pre-pass is; the g2p itself stays sync. Falls back to the plain sync
 * path (lexicon + default) when the model/`onnxruntime-node` is unavailable.
 */
export async function phonemizeRiderNeural(text: string, lang: string): Promise<string> {
    const lex = LEXICONS[lang];
    if (lex === undefined) {
        throw new Error(`phonemizeRiderNeural: "${lang}" is not a neural rider (expected one of ${NEURAL_RIDERS.join(", ")})`);
    }
    if (diacritizer === undefined) diacritizer = createRiderDiacritizer();
    const diac = await diacritizer; // undefined when the model or onnxruntime-node is unavailable → sync fallback
    const vocalized = diac ? await diac.diacritize(text, lang, lex()) : text;
    // `renderInHost`, NOT `getPhonemizer(lang).text`: the shared pre-passes have already run once, at
    // `getNeuralPhonemizer`, and the chain is not idempotent — `stripMarkup` decodes entities, so a second pass
    // would turn an author's `&amp;lt;` into a real `<` and strip it. This renders in `lang`'s host with the
    // engine only. (This file was the ONE async entry that already reached the registry wrapper; the pre-passes
    // moved up rather than away.)
    return renderInHost(lang, vocalized);
}
