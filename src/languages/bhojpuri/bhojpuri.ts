/**
 * Native Bhojpuri / भोजपुरी (bho) text phonemizer — canonical IPA. Indo-Aryan, Devanagari. Reuses the Hindi
 * Devanagari engine (`makeNativeHindi` — schwa deletion, weight stress) with a Bhojpuri data file.
 *
 * ⚠ SINGLE-SOURCE: revised from "A Grammar of Bhojpuri" (dissertation, Shukla tradition), whose glossed forms
 * were g2p-mined into 1622 Devanagari→IPA pairs as a falsifiable anchor. There is no independent referee.
 *
 * ⚠ THE DIVERGENCES FROM HINDI ARE THE POINT, since the engine is Hindi's: an 8-vowel /i e ɛ a ʌ ɔ o u/ system
 * with NO phonemic length, ऐ→[ɛ] and औ→[ɔ] as MONOPHTHONGS rather than diphthongs, श/ष→[s] (the only fricatives
 * are /s ɦ/), व→[w] rather than Hindi's ʋ, and ण/ञ→[n].
 *
 * NORMALIZER WORDS: the Hindi defaults are RETAINED, and प्रतिशत, बजे, मिनट and ईसा पूर्व are each confirmed for
 * Bhojpuri by sentences whose MORPHOLOGY is Bhojpuri (बा, होला, गइल, भइल). ⚠ The morphology test is the point: a
 * Devanagari hit on a small wiki is often a quoted HINDI passage. बजकर is NOT attested, so Hindi's clock
 * connective stands unconfirmed.
 *
 * ⚠ ALSO ATTESTED AND DELIBERATELY NOT ADOPTED: `फीसदी` is equally good Bhojpuri for percent. Two valid words is
 * not a reason to change a working one. And `सैकड़ा` occurs only in the RATIO phrase प्रति सैकड़ा ("94.77 औरत
 * प्रति सैकड़ा मरद"), never as the `%` word.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

let BHO: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "bhojpuri.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** Build the Bhojpuri phonemizer. `foreign` handles embedded Latin runs. */
export function createBhojpuri(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

/** Bare word→IPA (tests). */
export function phonemizeWord(w: string): string {
    return (BHO ??= engine()).word(w);
}
