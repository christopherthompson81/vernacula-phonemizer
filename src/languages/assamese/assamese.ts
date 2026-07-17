/**
 * Native Assamese (as) text phonemizer — canonical IPA, espeak-independent. Eastern Indo-Aryan, Bengali-Assamese
 * script. Reuses the Bengali engine (makeNativeBengali — the generic abugida scan + ɔ→o height harmony +
 * inherent-vowel deletion + geminate→length, all shared Eastern-Indic phonology) with an Assamese manifest whose
 * phoneme values carry the divergences from Bengali: the three sibilants শ/ষ/স → [x] (velar fricative — the
 * signature), deaffrication চ/ছ→[s] জ/ঝ→[z], the alveolar merger (no retroflex/dental split → plain t/tʰ/d/dʱ),
 * and the extra letters ৰ→[ɹ], ৱ→[w]. The Assamese geminate consonants (t/d/s/z/x) that the Bengali engine's
 * geminate set does not cover are collapsed to length here. See docs/investigations/as_native_bringup_investigation.md.
 */
import {
    makeNativeBengali,
    type BengaliDef,
    type ForeignPhonemizer,
} from "../bengali/bengali.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

// Assamese-specific geminate → length: the Bengali engine collapses only its own phoneme set (t͡ʃ, d̪, ʃ, …); the
// Assamese consonants that result from deaffrication + the alveolar merger (t tʰ d dʱ s z x) need their own pass.
// A doubled base (optionally aspirated) → single + length ː; guard against a tie bar (there are none here, but
// keep it parallel to the fleet convention).
const AS_GEMINATE = /(tʰ|dʱ|[tdszxpbkɡmnlŋ])\1/gu;
const collapseGeminates = (ipa: string): string => ipa.replace(AS_GEMINATE, "$1ː");

function wrap(base: ReturnType<typeof makeNativeBengali>): ReturnType<typeof makeNativeBengali> {
    return {
        word: (w) => collapseGeminates(base.word(w)),
        wordRules: (w) => collapseGeminates(base.wordRules(w)),
        number: (d) => collapseGeminates(base.number(d)),
        text: (i) => collapseGeminates(base.text(i)),
    };
}

/** Load assamese.jsonc (beside this file) and build the Assamese phonemizer. `foreign` handles embedded Latin. */
export function createAssamese(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return wrap(
        makeNativeBengali(
            loadManifest<BengaliDef>(import.meta.url, "assamese.jsonc"),
            loadSharedPhonology(),
            foreign,
        ),
    );
}

let AS: ReturnType<typeof makeNativeBengali> | undefined;
/** Bare word→IPA (tests / eval). */
export function phonemizeWord(w: string): string {
    return (AS ??= wrap(
        makeNativeBengali(loadManifest<BengaliDef>(import.meta.url, "assamese.jsonc")),
    )).word(w);
}
