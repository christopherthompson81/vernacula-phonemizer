/**
 * Native Nepali / नेपाली (ne) text phonemizer — canonical IPA, espeak-independent. Indo-Aryan, Devanagari.
 * Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers) with a Nepali
 * data file whose divergences from Hindi are: the inherent vowel realised as [ʌ] (not ə — the schwa-deletion
 * logic runs on ə, then this module maps the surviving ə→ʌ), the DENTAL affricates च/छ/ज/झ→[t͡s t͡sʰ d͡z d͡zʱ]
 * (not palatal), the sibilant merger श/ष→[s], NO phonemic vowel length (ई→i, ऊ→u), the diphthongs ऐ→[ʌi]/
 * औ→[ʌu], and व→[w]. Validated vs wikipron nep + kaikki. See docs/investigations/ne_native_bringup_investigation.md.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

// The Devanagari inherent/independent vowel stays ə through the shared schwa-deletion, then surfaces as the
// Nepali [ʌ]. The word/wordRules/number paths are pure Devanagari, so mapping ə→ʌ on them is safe.
const nepaliVowel = (s: string): string => s.replace(/ə/gu, "ʌ");

// text() interleaves EMBEDDED-Latin runs (English via `foreign`), whose /ə/ is a real, contrastive vowel that
// must NOT become [ʌ]. So the foreign output's ə is shielded behind a private-use sentinel before interleaving,
// then restored after the Devanagari ə→ʌ map.
const SENTINEL = "";

function engine(foreign?: ForeignPhonemizer): ReturnType<typeof makeNativeHindi> {
    const shieldedForeign: ForeignPhonemizer | undefined = foreign
        ? (latin) => foreign(latin).replace(/ə/gu, SENTINEL)
        : undefined;
    const base = makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "nepali.jsonc"),
        loadSharedPhonology(),
        shieldedForeign,
    );
    return {
        word: (w) => nepaliVowel(base.word(w)),
        wordRules: (w) => nepaliVowel(base.wordRules(w)),
        number: (d) => nepaliVowel(base.number(d)),
        // Map Devanagari ə→ʌ, then restore the shielded English ə (computer stays kəmpjuːt̬ɚ, not kʌmpjuːt̬ɚ).
        text: (i) => nepaliVowel(base.text(i)).split(SENTINEL).join("ə"),
    };
}

/** Build the Nepali phonemizer. `foreign` handles embedded Latin runs. */
export function createNepali(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

let NE: ReturnType<typeof makeNativeHindi> | undefined;
/** Bare word→IPA (tests / eval). */
export function phonemizeWord(w: string): string {
    return (NE ??= engine()).word(w);
}
