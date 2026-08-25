/**
 * Native Marathi (mr) text phonemizer — canonical IPA. Marathi is written in Devanagari
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
import { makeMarathiNormalizer, type MarathiWords } from "./normalize.ts";

/**
 * Marathi's manifest adds the word tables Hindi's def does not carry. ⚠ `MarathiWords` is normalize.ts's
 * half; the tier below reads `percent`, `currency`, `ampersand`, `multiply` and `units` from the SAME
 * object, which is the whole point — see the £ note in marathi.jsonc.
 */
export interface MarathiDef extends HindiDef, MarathiWords {
    ampersand: string;
    multiply: string;
    units: Record<string, string>;
}

// ⚠ ONE LOAD, MODULE-LEVEL. The tier below is built at import time and must read the same object the engine
// does, or the two go back to disagreeing — which is exactly what happened to £ (see marathi.jsonc).
export const DEF = loadManifest<MarathiDef>(import.meta.url, "marathi.jsonc");

// The bare-sign map the Hindi engine tokenizes on is DERIVED from `percent`, not authored a second time.
const WITH_SYMBOLS: MarathiDef = { ...DEF, symbols: { ...(DEF.symbols ?? {}), "%": DEF.percent.plural } };


let MR: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        WITH_SYMBOLS,
        loadSharedPhonology(),
        foreign,
    );
}

/** Normalization. Marathi shares Hindi's ENGINE but not Hindi's orthographic conventions, so it supplies
 *  its OWN normalizer and its OWN symbol words through `makeNativeHindi`'s overrides rather than
 *  inheriting Hindi's. */
const MR_SYMBOLS = makeSymbolNormalizer({
    // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: DEF.multiply },
    // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `आणि` ×1073 in this corpus. The tier spaces it on both sides, because `B&B` is two
    ampersand: DEF.ampersand,
    percent: [DEF.percent.plural], // Hindi's प्रतिशत is not Marathi
    // From the manifest, and shared with normalize.ts — the two paths claim the sign in different positions
    // and used to answer with different words for £.
    currency: Object.fromEntries(Object.entries(DEF.currency).map(([k, v]) => [k, [v]])),
    // ⚠ ⟨ha⟩ ⟨l⟩ ⟨L⟩ WERE MIS-READING, NOT LEAKING — `10 ha` read *d̪ˈəɦaː hˈɑː* and `10 l` *d̪ˈəɦaː ˈɛɫ*,
    // the English letter name out of a Devanagari engine, with no ASCII surviving and nothing vanishing.
    // See `tools/normalization/misread.ts`. Each word is definitional on mr.wikipedia:
    //   हेक्टर  52/13  "हेक्टर हे क्षेत्रफळ मोजण्याचे एकक आहे … १०० मीटर X १०० मीटर = १ हेक्टर = १०००० वर्ग मीटर"
    //   लिटर    26/12  "…डब्यात मावणाऱ्या द्रवाबरोबरचे आकारमान हे लिटर होय. तसेच, १००० मिली लिटर = १ लिटर"
    // ⚠ हेक्टर IS THE HECTARE IN MARATHI AND HECTOR IN HINDI — the same string, opposite verdicts, and the
    // reason both were read rather than counted. hi's हेक्टर is 56 tokens of the Trojan prince and its
    // hectare is हेक्टेयर; mr's हेक्टर heads the HECTARE article, and its personal-name hits (हेक्टर मोरेनो
    // the footballer) are the minority sense. Neither language's answer could be borrowed from the other.
    // ⚠ ⟨g⟩ IS REFUSED THOUGH ग्रॅम IS THE BEST-ATTESTED WORD HERE (88 tokens / 20 arts, definitional:
    // "किलोग्रॅम हे वजनाचे एकक आहे … याचे एस. आय. संक्षिप्त नाम kg आहे", and "१० ग्रॅम शुद्ध सोन्याचा" is a
    // digit-adjacent gram). The artifact's only `<digit> g` is `802.11 g` — a Wi-Fi standard — and it is
    // written WITH A SPACE, which the tier's `NOT_VERSION` guard cannot see: that guard requires the letter
    // GLUED to the number (`\d+[.,]\d+[a-zA-Z]`), deliberately, because `12.5 g` is a real measurement of
    // exactly the spaced shape. Verified against a language that does declare ⟨g⟩: `802.11 g` reads
    // *… ɛlf ɡʁam* in de and *… wˈʌn ɡɹˈæmz* in en. Undecidable at this layer, so mr declines the key.
    // ⚠ ⟨m⟩ stays refused for the reason `normalize.ts` already records — `100m`/`200m` are swim events.
    // From the manifest, shared with normalize.ts's own (larger) table — marathi.jsonc records why the
    // two tables exist and must not be merged.
    units: Object.fromEntries(Object.entries(DEF.units).map(([k, v]) => [k, [v]])),
});

export function createMarathi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativeHindi(WITH_SYMBOLS, loadSharedPhonology(), foreign, undefined, undefined, {
        normalize: makeMarathiNormalizer(DEF),
        symbols: MR_SYMBOLS,
    });
}

/** Bare word→IPA (tests / referee eval). */
export function phonemizeWord(w: string): string {
    return (MR ??= engine()).word(w);
}
