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
import { makeMarathiNormalizer } from "./normalize.ts";

let MR: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "marathi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** #562 normalization. Marathi shares Hindi's ENGINE but not Hindi's orthographic conventions, and
 *  `makeNativeHindi` hard-wires Hindi's normalizer and Hindi's symbol tier — there is no parameter for a
 *  different one. So the Marathi pass is applied HERE, ahead of `text()`, and is written to consume its
 *  input completely so that the Hindi pass inside `text()` finds nothing left to claim. See the header
 *  of normalize.ts, and steps 6b / 7a / 12, for the three places that coupling is visible. */
export function createMarathi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    const mr = engine(foreign);
    const normalize = makeMarathiNormalizer(
        loadManifest<HindiDef>(import.meta.url, "marathi.jsonc").numbers,
    );
    return { text: (input: string) => mr.text(normalize(input)) };
}

/** Bare word→IPA (tests / referee eval). */
export function phonemizeWord(w: string): string {
    return (MR ??= engine()).word(w);
}
