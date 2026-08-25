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
import { makeHindiNormalizer } from "../hindi/normalize.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

/**
 * ⟨॑⟩ U+0951 IS THIS CORPUS'S SECOND SPELLING OF THE AVAGRAHA, and the artifact proves it against itself.
 *
 * `schwaDeletion.retainOnAvagraha` reads ⟨ऽ⟩ U+093D from the spelling — the mark that writes the final
 * inherent vowel Maithili would otherwise delete. U+0951 is nominally DEVANAGARI STRESS SIGN UDATTA, a
 * Vedic tone mark; here it is a look-alike substitute for the same job, and the evidence is that **the same
 * words occur in the artifact under both spellings**:
 *
 *     कऽ ×65   क॑ ×9      भऽ ×24     लऽ ×19   ल॑ ×1     नऽ ×5   न॑ ×3
 *     मऽ ×1    म॑ ×22     सऽ ×1      स॑ ×9
 *
 * — `कऽ`/`क॑` is the one postposition, and its two spellings sit in one corpus. (Unicode's own account
 * agrees that the vowel needs a mark above the consonant: it documents Maithili writing it with U+A8F1
 * COMBINING DEVANAGARI SIGN AVAGRAHA or with U+02BC, and U+A8F1 renders as a near-identical small vertical
 * stroke. That block is ×0 in this artifact — the writers reached for the one their font had.)
 *
 * ⚠ FOLDED, NOT GIVEN A PHONE OF ITS OWN. This adds no reading: it routes 45 occurrences into the avagraha
 * rule the manifest already declares and the referee already corroborates, so nothing is invented and the
 * KNOWN DIVERGENCE recorded in `maithili.jsonc` (the referee's long vowel vs the engine's short ⟨ə⟩) is
 * inherited rather than re-argued.
 *
 * ⚠ ITS MEASURED REACH IS SMALL, AND SAYING SO IS THE POINT. 44 of the 45 occurrences are on MONOSYLLABLES
 * (म॑ स॑ क॑ न॑ ल॑), where `retainInMonosyllable` already keeps the vowel and the reading is identical either
 * way — which is exactly why `silentCharsIn` could call the character inert. The one polysyllable in the
 * artifact, `अब॑`, is the whole of the reading change: *ˈəb* → *ˈəbə*. A rule is not worth less for being
 * right about one word; it is worth reporting honestly.
 */
const UDATTA_AS_AVAGRAHA = /॑/gu;

let MAI: ReturnType<typeof makeNativeHindi> | undefined;
function engine(foreign?: ForeignPhonemizer) {
    const def = loadManifest<HindiDef>(import.meta.url, "maithili.jsonc");
    const hindi = makeHindiNormalizer(def.numbers, def);
    return makeNativeHindi(
        def,
        loadSharedPhonology(),
        foreign,
        undefined,
        undefined,
        // The fold runs BEFORE the inherited normalizer, so every rule downstream — including the word
        // tokenizer, which does not carry U+0951 in its class — sees the avagraha the writer meant.
        { normalize: (input: string) => hindi(input.replace(UDATTA_AS_AVAGRAHA, "ऽ")) },
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
