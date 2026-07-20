/**
 * Native Bhojpuri / भोजपुरी (bho) text phonemizer — canonical IPA, espeak-independent. Indo-Aryan, Devanagari.
 * Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress) with a Bhojpuri data file.
 * REVISED from "A Grammar of Bhojpuri" (dissertation, Shukla-tradition), whose glossed forms were g2p-mined (1622
 * Devanagari→IPA pairs) as a falsifiable anchor: Bhojpuri has an 8-vowel /i e ɛ a ʌ ɔ o u/ system with NO phonemic
 * length, ऐ→[ɛ]/औ→[ɔ] MONOPHTHONGS (not the diphthongs earlier claimed), श/ष→[s] (only /s ɦ/ fricatives), व→[w]
 * (not Hindi ʋ), ण/ञ→[n]. 🔷 single published source; see docs/investigations/bho_native_bringup_investigation.md.
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
