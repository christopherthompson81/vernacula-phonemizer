/**
 * Native Gujarati (gu) text phonemizer — canonical IPA, espeak-independent. Indo-Aryan, the Gujarati abugida.
 * A thin wrapper: it reuses the generic abugida engine + the entire Hindi orchestration (makeNativeHindi —
 * schwa deletion, weight stress, the Indic number compositor, clause assembly) with a Gujarati-Unicode data file
 * (gujarati.jsonc) and the Gujarati script's word-run + digit constants. See docs/gu_native_bringup_investigation.md.
 */
import {
    makeNativeHindi,
    type HindiDef,
    type ForeignPhonemizer,
} from "../hindi/hindi.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { GUJARATI_WORD, GUJARATI_DIGITS } from "../../core/unicode.ts";

/** Load gujarati.jsonc (beside this file) and build the Gujarati phonemizer. `foreign` handles embedded Latin. */
export function createGujarati(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "gujarati.jsonc"),
        loadSharedPhonology(),
        foreign,
        { word: GUJARATI_WORD, digits: GUJARATI_DIGITS },
    );
}

/** Bare word→IPA (tests / eval). */
export function phonemizeWord(word: string): string {
    return (WORD ??= makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "gujarati.jsonc"),
        loadSharedPhonology(),
    )).word(word);
}
let WORD: { word(w: string): string } | undefined;
