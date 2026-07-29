/**
 * Async neural entry for the Perso-Arabic riders (Urdu, Persian, Pashto, Punjabi-Shahmukhi) — the deploy wrapper
 * that runs the shared multilingual BiLSTM harakat pre-pass (core/riderDiacritizer.ts, ONNX) and then the SYNC
 * phonemizer. This is the full two-layer path: the pre-pass leaves lexicon-covered words BARE (the sync g2p's
 * restoreHarakat then applies the authoritative gold lexicon) and neural-vocalizes only the rest — so precedence
 * is lexicon → neural → default. When the optional `onnxruntime-node` dep or the .onnx model is absent the pre-pass
 * is a no-op and you get exactly the sync `phonemize(text, lang)` (lexicon + default). Bare Arabic uses the
 * separate `phonemizeArabic`; this is its rider analogue. See docs/investigations/arabic_script_restorer_investigation.md.
 */
import { getPhonemizer } from "../../registry.ts";
import { createRiderDiacritizer, type RiderDiacritizer } from "./riderDiacritizer.ts";
import { coverageLexicon as ur } from "../urdu/urdu.ts";
import { harakatLexicon as fa } from "../persian/persian.ts";
import { harakatLexicon as ps } from "../pashto/pashto.ts";
import { harakatLexicon as pa } from "../punjabi/punjabi.ts";

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
    return getPhonemizer(lang).text(vocalized);
}
