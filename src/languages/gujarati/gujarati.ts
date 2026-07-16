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
import { loadTsvMap } from "../../core/loadTsv.ts";
import { GUJARATI_WORD, GUJARATI_DIGITS } from "../../core/unicode.ts";

// Whole-word lexicon for the proven-lexical medial-schwa tail (cross-source consensus of wikipron+kaikki; see
// gujarati-lexicon.tsv). NFC-normalized keys; applied on the SHIPPED path only, never in the rule engine.
let LEXICON: Map<string, string> | undefined;
const lexicon = (): Map<string, string> => {
    if (!LEXICON) {
        LEXICON = new Map();
        for (const [k, v] of loadTsvMap(import.meta.url, "gujarati-lexicon.tsv", (v) => v, { optional: true }))
            LEXICON.set(k.normalize("NFC"), v);
    }
    return LEXICON;
};

/** Load gujarati.jsonc (beside this file) and build the Gujarati phonemizer. `foreign` handles embedded Latin. */
export function createGujarati(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "gujarati.jsonc"),
        loadSharedPhonology(),
        foreign,
        { word: GUJARATI_WORD, digits: GUJARATI_DIGITS },
        lexicon(),
    );
}

function build() {
    return (WORD ??= makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "gujarati.jsonc"),
        loadSharedPhonology(),
        undefined,
        { word: GUJARATI_WORD, digits: GUJARATI_DIGITS },
        lexicon(),
    ));
}
/** Bare word→IPA, SHIPPED path (lexicon → rule engine). For tests and real text. */
export function phonemizeWord(word: string): string {
    return build().word(word);
}
/** Bare word→IPA, RULE-ENGINE ONLY (no lexicon) — the honest, non-circular signal for the referee eval. */
export function phonemizeWordRules(word: string): string {
    return build().wordRules(word);
}
let WORD:
    | { word(w: string): string; wordRules(w: string): string }
    | undefined;
