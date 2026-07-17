/**
 * Native Bhojpuri / भोजपुरी (bho) text phonemizer — canonical IPA, espeak-independent. Indo-Aryan, Devanagari.
 * Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers) with a Bhojpuri
 * data file whose DIVERGENCES from Hindi are the genuine segmental differences: श/ष→[s] (Bhojpuri has NO /ʃ/,
 * शहर→sahar), ऐ/औ kept as the diphthongs [ai]/[au] (Hindi monophthongised to ɛː/ɔː), and no Hindi əɦə-lowering.
 *
 * ⚠ CANNOT-VERIFY: there is NO independent referee for Bhojpuri — wikipron/kaikki have none, and epitran bho-Deva
 * is a CIRCULAR Hindi clone (it gives the Hindi values श→ʃ, ऐ→ɛː). The committed anchor is a small hand-adjudicated
 * gold of the DISTINCTIVE features (test/bhojpuri.test.ts), which grades exactly where Bhojpuri ≠ Hindi — the one
 * axis that is NOT circular with a Hindi clone. See docs/investigations/bho_native_bringup_investigation.md.
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
