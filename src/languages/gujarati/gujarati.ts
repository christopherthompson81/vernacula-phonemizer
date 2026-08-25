/**
 * Native Gujarati (gu) text phonemizer — canonical IPA. Indo-Aryan, the Gujarati abugida.
 * A thin wrapper: it reuses the generic abugida engine + the entire Hindi orchestration (makeNativeHindi —
 * schwa deletion, weight stress, the Indic number compositor, clause assembly) with a Gujarati-Unicode data file
 * (gujarati.jsonc) and the Gujarati script's word-run + digit constants.
 */
import {
    makeNativeHindi,
    type HindiDef,
    type ForeignPhonemizer,
} from "../hindi/hindi.ts";
import { MANIFEST } from "./manifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { GUJARATI_WORD, GUJARATI_DIGITS } from "../../core/unicode.ts";
import { makeGujaratiNormalizer } from "./normalize.ts";

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

/**
 * normalization. Gujarati shares Hindi's ENGINE but not Hindi's orthographic conventions or its
 * SCRIPT, so it supplies its own normalizer and its own symbol words through `makeNativeHindi`'s
 * overrides rather than inheriting Hindi's. The inheritance was not merely saying the wrong word: Hindi's
 * tier emits DEVANAGARI, which `core/unicode.ts` GUJARATI_WORD excludes, so the tokenizer dropped it —
 * "45%" came out [pˈistalis] with the percent word gone and "$45 મિલિયન" lost its currency outright.
 *
 * Every word here is attested in the gu_in FLEURS corpus in the same function (ટકા ×40, ડોલર ×4/ડૉલર ×2,
 * યુરો ×37, પાઉન્ડ ×8, યેન ×3, કિલોમીટર ×15, મીલીમીટર ×3, માઇલ, કલાક ×30, સેકંડ ×2, and પ્રતિ ×6 as the
 * rate connective, "8 માઇલ પ્રતિ સેકંડ" / "240 કિલોમીટર પ્રતિ કલાક") except રૂપિયા, સેન્ટીમીટર and
 * કિલોગ્રામ, which are transparent international units and whose signs/abbreviations do not occur here.
 *
 * `US$` and `AUD$` are declared because the corpus writes both ("US$30", "US$11,000થી", "AUD$45 મિલિયન")
 * and the tier's currency lookbehind `(?<![\p{L}\p{M}])` would otherwise refuse the bare `$` after a
 * letter and drop the sign silently. `ક` (for કલાક, in "165 કિમી/ક") is a rateDenominator rather than a
 * unit precisely because ⚠ a one-letter key matchable standalone
 * is confidently wrong far more often than it is right.
 */
/** ⚠ NON-NULL: gujarati.jsonc declares ; the field is optional on the SHARED HindiDef
 *  because hi/mr/gu are migrating one at a time. */
const SYM = MANIFEST.symbolTier!;

const GU_SYMBOLS = makeSymbolNormalizer({
    percent: SYM.percent,
    currency: SYM.currency,
    units: SYM.units,
    rateDenominators: SYM.rateDenominators,
    unitPer: SYM.unitPer,
    exponentWords: SYM.exponentWords,
    magnitudes: SYM.magnitudes,
    ampersand: SYM.ampersand,
    multiply: SYM.multiply,
});

/** Load gujarati.jsonc (beside this file) and build the Gujarati phonemizer. `foreign` handles embedded Latin. */
export function createGujarati(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    const def = loadManifest<HindiDef>(import.meta.url, "gujarati.jsonc");
    return makeNativeHindi(
        def,
        loadSharedPhonology(),
        foreign,
        { word: GUJARATI_WORD, digits: GUJARATI_DIGITS, avagraha: "\u0ABD" },
        lexicon(),
        { normalize: makeGujaratiNormalizer(def.numbers), symbols: GU_SYMBOLS },
    );
}

function build() {
    return (WORD ??= makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "gujarati.jsonc"),
        loadSharedPhonology(),
        undefined,
        { word: GUJARATI_WORD, digits: GUJARATI_DIGITS, avagraha: "\u0ABD" },
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
