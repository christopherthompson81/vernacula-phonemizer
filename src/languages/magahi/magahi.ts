/**
 * Native Magahi / मगही (mag) text phonemizer — canonical IPA. Indo-Aryan (Bihari, Magadhan), Devanagari.
 * Reuses the Hindi/Bhojpuri Devanagari engine (makeNativeHindi — schwa deletion, weight stress) with a Magahi
 * data file.
 *
 * Magahi shares the Bihari core with Bhojpuri — NO phonemic vowel length, single sibilant श/ष→[s], ण/ञ→[n] —
 * but differs in its documented GLIDE HARDENING (Vinod Kumar 2026, *A Comparative Phonological Study of Bihari
 * Languages*, §6.2): word-initial व→[b] (वंश→bans) and य→[d͡ʒ] (यन्त्र→jantar), where Bhojpuri preserves the
 * glides (व→w, य→j). ⚠ That delta rests on a SINGLE comparative source over the grammar-anchored Bhojpuri base.
 */
/**
 * NORMALIZER WORDS. This engine inherits Hindi's, and four are confirmed for Magahi — sentences judged
 * Magahi by हे / हल / हलै / आउ / -के:
 *
 *   प्रतिशत    a DEFINITIONAL citation, which outranks any usage example: "प्रतिशतके अर्थ हे प्रति सौ या
 *             प्रति सैकड़ा (% = 1/100)" ties the word directly to the SIGN this layer is reading.
 *   बजे       "रातके १२ बजे होलै हल"
 *   मिनट      "प्रति मिनट क्रान्ति, सङ्क्षिप्त आर/मिनट या आरपिएम हे"
 *   ईसा पूर्व  "ईसा पूर्व ३०४ से ईसा पूर्व २३२ … हल"
 *
 * बजकर, Hindi's clock connective, is NOT attested for Magahi. It stands unconfirmed rather than being
 * replaced — an unsourced substitute is worse than an inherited word.
 *
 * ⚠ AND THE FOUR ARE A SMALL PART OF WHAT IS INHERITED. The clock, sign, unit and abbreviation words are
 * hardcoded in ../hindi/normalize.ts, not in any manifest, so no amount of reading magahi.jsonc finds
 * them: डिग्री, प्लस, ऋण, बराबर, गुणा, भाग, धन ऋण, और, बटा/आधा/चौथाई/तिहाई, किमी→किलोमीटर, डॉ→डॉक्टर.
 * All Hindi's, all unconfirmed for Magahi, all live.
 */

/**
 * THE ORDINAL SUFFIX IS THE ONE PLACE THE INHERITANCE WAS MEASURABLY WRONG, and magahi.jsonc now declares
 * its own. Magahi writes the ordinal `१७मा`; Hindi's inherited वाँ/वीं/वें table claimed none of the 15
 * corpus instances, so the suffix was tokenized apart and spoken as the stray word मा. See the
 * `ordinalSuffixes` block in magahi.jsonc for the counts and for why only the regular arm is declared.
 */

/**
 * ⚠ FILED, NOT FIXED — THE GLIDE HARDENING IS CITED WORD-INITIALLY AND APPLIED EVERYWHERE. The header
 * above, `magahi.jsonc`'s `provenance` and test/magahi.test.ts all state the rule as word-initial; the
 * manifest implements it as a flat `consonants` mapping, because this engine has no positional consonant
 * machinery. Over the 302-line mag corpus that is 481 word-initial व against 1178 elsewhere and 182
 * word-initial य against 1586 elsewhere — ~81% of the applications are outside the cited position, and
 * they are not marginal words (महाकाव्य → *məɦɑkˈɑbd͡ʒ*, पाण्डव → *pˈɑnɖəb*, भारतीय → *bʱˈɑɾt̪id͡ʒ*).
 * The engine COULD express the cited rule — map व→w / य→j and add `^w`→b, `^j`→d͡ʒ post-rules, which run
 * per word — so this is a decision about the source, not a limitation. It is not taken here because there
 * is no instrument to take it with: mag has no referee (tools/referee-eval/langs carries awa/bho/hne and
 * no mag) and no FLEURS audio, and the change would move essentially every golden row. Both engines keep
 * the current behaviour and the finding is recorded; see the ⚠ in provenance.
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
