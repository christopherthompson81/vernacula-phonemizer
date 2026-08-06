/**
 * Native Bhojpuri / भोजपुरी (bho) text phonemizer — canonical IPA. Indo-Aryan, Devanagari.
 * Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress) with a Bhojpuri data file.
 * REVISED from "A Grammar of Bhojpuri" (dissertation, Shukla-tradition), whose glossed forms were g2p-mined (1622
 * Devanagari→IPA pairs) as a falsifiable anchor: Bhojpuri has an 8-vowel /i e ɛ a ʌ ɔ o u/ system with NO phonemic
 * length, ऐ→[ɛ]/औ→[ɔ] MONOPHTHONGS (not the diphthongs earlier claimed), श/ष→[s] (only /s ɦ/ fricatives), व→[w]
 * (not Hindi ʋ), ण/ञ→[n]. 🔷 single published source.
 */
/**
 * #583 — NORMALIZER WORDS: the Hindi defaults are RETAINED and four are confirmed for Bhojpuri. Evidence from
 * bh.wikipedia via `tools/normalization/attest.ts` (`tools/corpus/attest/bho.jsonc`); each sentence's language
 * judged from its morphology (बा, होला, गइल, भइल), since a Devanagari hit on a small wiki is often quoted Hindi:
 *
 *   प्रतिशत  ✓ "नेपाल देस के कुल आवादी के … प्रतिशत भू–भाग होला"
 *   बजे      ✓ "मोदी के घोषणा सवा आठ बजे साँझ के प्रसारित भइल"
 *   मिनट     ✓ "आपरेशन कुछ मिनट से ले के कई दिन तक चले वाला हो सके लें"
 *   ईसा पूर्व ✓ "7वीं सदी ईसा पूर्व में … रहल बा"                     (×4)
 *   बजकर      NOT ATTESTED (0 hits) — Hindi's clock connective stands, unconfirmed.
 *
 * ALSO ATTESTED, AND DELIBERATELY NOT ADOPTED: `फीसदी` ✓ "जनसंख्या के 22 फीसदी लोग" is equally good Bhojpuri
 * for percent. Two valid words is not a reason to change a working one — replacing प्रतिशत here would trade a
 * confirmed reading for another confirmed reading and churn the corpus diff for nothing.
 * `सैकड़ा` occurs as the RATIO phrase प्रति सैकड़ा ("94.77 औरत प्रति सैकड़ा मरद"), not as the `%` word.
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
