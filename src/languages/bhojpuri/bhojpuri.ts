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
 *
 * ⚠ NO OVERRIDES ARE PASSED, so this language ALSO inherits Hindi's SHARED SYMBOL TIER — bho declares no
 * `symbolTier`, and `makeNativeHindi` falls back to hindi.jsonc's. That tier runs BEFORE the engine's own
 * `symbols`/`stripSymbols`, so `₹500` reads *pɑ̃t͡ʃ sɔ ɾupje* (Hindi's रुपये), not the bare number the
 * manifest's `stripSymbols` comment used to claim. The whole ordinal table is Hindi's for the same reason
 * (normalize.ts's `own?.irregularOrdinals ?? MANIFEST.irregularOrdinals`), and so are the 21–99 numerals,
 * which are byte-identical to hindi.jsonc's. All inherited, none Bhojpuri-sourced.
 *
 * ⚠ FILED, NOT FIXED: ⟨ऋ⟩/⟨ृ⟩ map to ASCII `ri` — an alveolar TRILL — in a manifest whose only rhotic is
 * ɾ, so कृष्ण reads *krisn* beside कर *kəɾ*. See the long note at the ऋ entry in bhojpuri.jsonc for the
 * evidence and for why the referee needed to settle it is not in the repo.
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
