/**
 * Native Magahi / मगही (mag) text phonemizer — canonical IPA, espeak-independent. Indo-Aryan (Bihari, Magadhan),
 * Devanagari. Reuses the Hindi/Bhojpuri Devanagari engine (makeNativeHindi — schwa deletion, weight stress) with a
 * Magahi data file. Magahi shares the Bihari core with Bhojpuri — NO phonemic vowel length, single sibilant श/ष→[s],
 * ण/ञ→[n] — but differs in its documented GLIDE HARDENING (Vinod Kumar 2026, A Comparative Phonological Study of
 * Bihari Languages, §6.2): word-initial व→[b] (वंश→bans) and य→[d͡ʒ] (यन्त्र→jantar), where Bhojpuri preserves the
 * glides (व→w, य→j). Single comparative-source delta on the grammar-anchored Bhojpuri base → 🔷. Was a mag→bho
 * alias until the reference revealed the delta. See docs/investigations/mag_native_bringup_investigation.md.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

let MAG: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "magahi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** Build the Magahi phonemizer. `foreign` handles embedded Latin runs. */
export function createMagahi(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

/** Bare word→IPA (tests). */
export function phonemizeWord(w: string): string {
    return (MAG ??= engine()).word(w);
}
