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
const GU_SYMBOLS = makeSymbolNormalizer({
    // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: "ગુણ્યા" },
    // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `અને` ×1128 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    ampersand: "અને",
    percent: ["ટકા"], // Hindi's प्रतिशत is not Gujarati — and in Devanagari it was not even audible
    currency: {
        "US$": ["ડોલર"], "AUD$": ["ડોલર"], "$": ["ડોલર"],
        "€": ["યુરો"], "£": ["પાઉન્ડ"], "¥": ["યેન"], "₹": ["રૂપિયા"],
    },
    magnitudes: ["મિલિયન", "બિલિયન", "ટ્રિલિયન", "કરોડ", "લાખ", "અબજ", "હજાર"],
    units: {
        "કિમી": ["કિલોમીટર"], "કિમિ": ["કિલોમીટર"],
        "મીમી": ["મીલીમીટર"], "મિમી": ["મીલીમીટર"], "એમએમ": ["મીલીમીટર"],
        "માઇલ": ["માઇલ"], "માઈલ": ["માઈલ"], // identity — declared so the RATE form માઇલ/કલાક composes
        km: ["કિલોમીટર"], cm: ["સેન્ટીમીટર"], mm: ["મીલીમીટર"], kg: ["કિલોગ્રામ"],
        // `m` ADDED so the cube word below has a head noun — without it `120 m³` read as a bare letter
        // *ˈɛm* and the declaration was dead. મીટર ×28 spelled out, and digit-adjacent bare `m` is ×0 in
        // this corpus, so the one-letter-key hazard is checked rather than assumed. (Same measurement over
        // hi/kn/or/sd — all ×0 — and mr ×7, all of them `100m આણિ 200m` swimming events, i.e. metres. Those
        // five have no cube word yet and are left to the bare-`m` sweep.)
        m: ["મીટર"],
    },
    unitPer: "પ્રતિ",
    rateDenominators: { "ક": "કલાક", "કલાક": "કલાક", "સેકંડ": "સેકંડ", h: "કલાક", s: "સેકંડ" },
    // `વર્ગ કિલોમીટર` ×10 — the best-attested measure word in this sweep — and `ક્યુબિક મીટર` ×2, both
    // word-first. ⚠ NEITHER bare word is the evidence, and both bare counts are traps:
    //   વર્ગ ×55   is the CLASSROOM ("વિદ્યાર્થીઓ તેમના વર્ગમાં બેસીને")
    //   ઘન  ×6    is SOLID, the state of matter ("ઘન, પ્રવાહી, વાયુ અને પ્લાઝમા") — and it is the same
    //             ધન/ઘન cluster that offers confidently wrong plus words to a token count.
    // The cube word here is the English loan ક્યુબિક, not ઘન. Only the collocation decides it.
    exponentWords: { squared: ["વર્ગ"], cubed: ["ક્યુબિક"], position: "before" },
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
        { word: GUJARATI_WORD, digits: GUJARATI_DIGITS },
        lexicon(),
        { normalize: makeGujaratiNormalizer(def.numbers), symbols: GU_SYMBOLS },
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
