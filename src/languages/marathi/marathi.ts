/**
 * Native Marathi (mr) text phonemizer — canonical IPA, espeak-independent. Marathi is written in Devanagari
 * and shares almost all of Hindi's abugida machinery, so it REUSES the generic Hindi engine (makeNativeHindi)
 * with a Marathi data file (marathi.jsonc). The Marathi-specific facts live entirely in the manifest:
 *   - ळ → retroflex lateral [ɭ]; ष → retroflex [ʂ] (Hindi merges it to ʃ);
 *   - च/छ/ज/झ → DENTAL affricates [t͡s t͡sʰ d͡z d͡zʱ] before a back/central vowel (postRules), palatal before front;
 *   - no Hindi और-offglide / əɦə→ɛɦɛ finalRules (Marathi keeps शहर→ɕəɦəɾ);
 *   - Marathi number spellings.
 * Inherent-schwa deletion + weight stress are the same shared algorithms as Hindi.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { makeMarathiNormalizer } from "./normalize.ts";

let MR: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "marathi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** #562 normalization. Marathi shares Hindi's ENGINE but not Hindi's orthographic conventions, so it
 *  supplies its OWN normalizer and its OWN symbol words through `makeNativeHindi`'s overrides rather than
 *  inheriting Hindi's. Before that parameter existed the Marathi pass had to run AHEAD of `text()` and be
 *  written to consume its input completely, so the Hindi pass inside would find nothing left to claim —
 *  a coupling that was load-bearing in three separate steps. Verified byte-identical over the whole
 *  mr_in corpus when moved onto the seam. */
const MR_SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: "गुणिले" },
    // #586 — `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `आणि` ×1073 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    ampersand: "आणि",
    percent: ["टक्के"], // Hindi's प्रतिशत is not Marathi
    currency: { "$": ["डॉलर"], "€": ["युरो"], "£": ["पाउंड"], "₹": ["रुपये"], "¥": ["येन"] },
    units: { km: ["किलोमीटर"], cm: ["सेंटीमीटर"], mm: ["मिलिमीटर"], kg: ["किलोग्रॅम"] },
});

export function createMarathi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    const def = loadManifest<HindiDef>(import.meta.url, "marathi.jsonc");
    return makeNativeHindi(def, loadSharedPhonology(), foreign, undefined, undefined, {
        normalize: makeMarathiNormalizer(def.numbers),
        symbols: MR_SYMBOLS,
    });
}

/** Bare word→IPA (tests / referee eval). */
export function phonemizeWord(w: string): string {
    return (MR ??= engine()).word(w);
}
