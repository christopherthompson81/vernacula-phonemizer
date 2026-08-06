/**
 * Native Awadhi / अवधी (awa) text phonemizer — canonical IPA. Eastern Hindi (Indo-Aryan),
 * Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers) with
 * an Awadhi data file whose implemented DIVERGENCES from Hindi are drawn from Baburam Saksena's Evolution of
 * Awadhi (1937): the SIBILANT MERGER श/ष→[s] (data file) and the INTERVOCALIC FLAP ड/ढ→[ɽ]/[ɽʱ] except after a
 * nasal (this module — Saksena: intervocalically ḍ/ḍh become ṛ/ṛh; they stay only after a nasal).
 *
 * 🔷 SINGLE-SOURCE: the divergences are drawn from ONE documented source, Baburam Saksena's Evolution of Awadhi
 * (1937) — a real Awadhi-specific grammar with IPA, not a circular Hindi clone. That single source is what 🔷
 * requires; there is no *independent* second referee (wikipron/kaikki/epitran ship no Awadhi, and a machine
 * Hindi-clone check would be circular), so awa is single-source, not multiply-verified — but it is NOT ⛔, because
 * grading against Saksena measures something real. Per Saksena (quoting Bloch) the Eastern-Indo-Aryan phonologies
 * are "perceptibly identical", distinguished chiefly by GRAMMAR, so the Hindi-shared rules hold BY ATTESTATION.
 * MEASURED: 93.9% folded against a Saksena referee (tools/referee-eval/referees/awa.saksena.tsv, 33 of his own
 * transcribed forms; Devanagari confirmed against the Awadhi Shabd-Kosh corpus). Coverage: 99.99% of 48.6k
 * awawiki types + 100% of 6.6k dictionary headwords phonemize (real Awadhi, not Hindi cognates).
 */
/**
 * NORMALIZER WORDS: the Hindi defaults are RETAINED, and three of them are now confirmed for Awadhi
 * rather than merely inherited. Evidence from awa.wikipedia via `tools/normalization/attest.ts`
 * (`tools/corpus/attest/awa.jsonc`), with each sentence's language judged from its MORPHOLOGY, because a
 * Devanagari token hit on a small wiki is routinely a quoted Hindi passage:
 *
 *   प्रतिशत  ✓ "प्रायद्वीप कय 40 प्रतिशत हिस्सा होय"        — कय / होय are Awadhi
 *   मिनट     ✓ "16 घंटा 20 मिनट मा तय कइन्हिन"              — मा / कइन्हिन are Awadhi
 *   ईसा पूर्व ✓ "५५० ईसा पूर्व मा इ क्षेत्र कय जीत लिहिन"    — Awadhi
 *   बजकर, बजे  NOT ATTESTED (0 hits) — the clock connective is rare in encyclopedic prose, so this is
 *              absence of evidence, not evidence of absence. Hindi's default stands, unconfirmed.
 *
 * A TRAP RECORDED: `सैकड़ा` ×2 is real Awadhi and means CRICKET CENTURIES — "वन १६ सैकड़ा लगाय चुका हैं" —
 * not "per hundred". It is not a percent word here. Same shape as the Malay `paun` weight-vs-currency trap.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

// Vowel nuclei the Hindi engine can emit (incl. long ː and nasalization ̃) — the intervocalic context for the flap.
// ʌ is included because Awadhi ऐ/औ emit the central-onset diphthongs ʌi/ʌu (Saksena §2395), so a flap can border one.
const V = "aəʌɪiʊueɛoɔɐ";
// Saksena: intervocalic ड/ढ (ɖ/ɖʱ) → the flap ɽ/ɽʱ, EXCEPT after a nasal "or after nasalisation" — post-nasal
// ɖ stays. So the lookbehind is an ORAL vowel (optionally long) — a preceding nasal CONSONANT (अंडा→ə̃ɳɖaː, ɳ
// blocks it) or a nasalized VOWEL (अँडा→ə̃ɖaː, the ̃ mark blocks it, NOT in the class) both keep [ɖ]; word start
// keeps [ɖ] too. A geminate ɖː is not followed by a vowel. The flap runs on the engine's final output, which
// already carries the stress mark ˈ — allow one between the consonant and the following vowel (pəɖˈoːsiː →
// pəɽˈoːsiː) so a stressed syllable doesn't block the rule.
const FLAP = new RegExp(`(?<=[${V}]ː?)ɖ(ʱ?)(?=[ˈˌ]?[${V}])`, "gu");
const awadhify = (s: string): string => s.replace(FLAP, "ɽ$1");

function engine(foreign?: ForeignPhonemizer): ReturnType<typeof makeNativeHindi> {
    const base = makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "awadhi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
    // Wrap every string-producing entry point in the Saksena intervocalic flap. text() is post-processed as a
    // whole (the flap's vowel context never spans a word boundary — a space is not a vowel), so word-internal
    // application is preserved without re-deriving the tokenizer.
    return {
        word: (w) => awadhify(base.word(w)),
        wordRules: (w) => awadhify(base.wordRules(w)),
        number: (d) => awadhify(base.number(d)),
        text: (i) => awadhify(base.text(i)),
    };
}

/** Build the Awadhi phonemizer. `foreign` handles embedded Latin runs. */
export function createAwadhi(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

let AWA: ReturnType<typeof makeNativeHindi> | undefined;
/** Bare word→IPA (tests). */
export function phonemizeWord(w: string): string {
    return (AWA ??= engine()).word(w);
}
