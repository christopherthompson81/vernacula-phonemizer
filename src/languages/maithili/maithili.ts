/**
 * Native Maithili / मैथिली (mai) text phonemizer — canonical IPA. Eastern Indo-Aryan (Bihari group),
 * Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers)
 * with a Maithili data file. The divergences from Hindi: SHORT e/o (ए→e, ओ→o), the diphthongs ऐ→[əɪ] /
 * औ→[əu], and inherent /ə/.
 *
 * Maithili's signature — a cluster schwa that Hindi DELETES is instead reduced to an ULTRASHORT [ᵊ]
 * (इसपात→ɪsᵊpaːt) — is a narrow phonetic detail, folded (ᵊ~∅) rather than contrasted.
 *
 * ⚠ SINGLE-SOURCE bring-up: the only referee is a small human set (167 pairs), so this is verified rather
 * than convergent.
 */
/**
 * NORMALIZER WORDS. This engine inherits Hindi's. The CLOCK words (बजकर, मिनट) are confirmed for Maithili;
 * the percent word प्रतिशत is NOT, and is retained unconfirmed — an unsourced substitute is worse than an
 * inherited word.
 *
 * ⚠ ATTESTATION MUST BE JUDGED PER SENTENCE, NOT PER HIT, and this language is why. Devanagari wikis quote
 * each other verbatim, so a search for a Maithili word returns Hindi and Nepali passages under a Maithili
 * title: half the बजकर hits here are one Hindi passage quoted whole (का मुहूर्त, रहा, मिलाकर), and the
 * only प्रतिशत hit is Nepali (भन्दा अधिक, लागेकाछन्). A hit counts only when the surrounding sentence
 * carries Maithili morphology — होइत अछि, रहल जे, सेकेण्ड सँ.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

let MAI: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "maithili.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** Build the Maithili phonemizer. `foreign` handles embedded Latin runs. */
export function createMaithili(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

/** Bare word→IPA (tests / eval). */
export function phonemizeWord(w: string): string {
    return (MAI ??= engine()).word(w);
}
