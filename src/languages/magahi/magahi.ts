/**
 * Native Magahi / मगही (mag) text phonemizer — canonical IPA. Indo-Aryan (Bihari, Magadhan),
 * Devanagari. Reuses the Hindi/Bhojpuri Devanagari engine (makeNativeHindi — schwa deletion, weight stress) with a
 * Magahi data file. Magahi shares the Bihari core with Bhojpuri — NO phonemic vowel length, single sibilant श/ष→[s],
 * ण/ञ→[n] — but differs in its documented GLIDE HARDENING (Vinod Kumar 2026, A Comparative Phonological Study of
 * Bihari Languages, §6.2): word-initial व→[b] (वंश→bans) and य→[d͡ʒ] (यन्त्र→jantar), where Bhojpuri preserves the
 * glides (व→w, य→j). Single comparative-source delta on the grammar-anchored Bhojpuri base → 🔷. Was a mag→bho
 * alias until the reference revealed the delta.
 */
/**
 * NORMALIZER WORDS: the Hindi defaults are RETAINED and four are confirmed for Magahi, one of them by a
 * DEFINITION rather than a usage. Evidence from mag.wikipedia via `tools/normalization/attest.ts`
 * (`tools/corpus/attest/mag.jsonc`); sentences judged Magahi by हे / हल / हलै / आउ / -के:
 *
 *   प्रतिशत  ✓✓ the Magahi wiki's own article DEFINES it: "प्रतिशतके अर्थ हे प्रति सौ या प्रति सैकड़ा
 *               (% = 1/100)" — a definitional citation tying the word to the SIGN, which is stronger than
 *               any usage example. Also in use: "साक्षरता दर ७५ प्रतिशत … हलै आउ".
 *   बजे      ✓ "रातके १२ बजे होलै हल"
 *   मिनट     ✓ "प्रति मिनट क्रान्ति, सङ्क्षिप्त आर/मिनट या आरपिएम हे"
 *   ईसा पूर्व ✓ "ईसा पूर्व ३०४ से ईसा पूर्व २३२ … हल"
 *   बजकर      NOT ATTESTED (0 hits) — Hindi's clock connective stands, unconfirmed.
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
