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

let MR: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "marathi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** Build the Marathi phonemizer. `foreign` handles embedded Latin runs. */
export function createMarathi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return engine(foreign);
}

/** Bare word→IPA (tests / referee eval). */
export function phonemizeWord(w: string): string {
    return (MR ??= engine()).word(w);
}
