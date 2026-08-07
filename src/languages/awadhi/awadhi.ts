/**
 * Native Awadhi / अवधी (awa) text phonemizer — canonical IPA. Eastern Hindi (Indo-Aryan),
 * Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers) with
 * an Awadhi data file whose implemented DIVERGENCES from Hindi are drawn from Baburam Saksena's Evolution of
 * Awadhi (1937): the SIBILANT MERGER श/ष→[s] (data file) and the INTERVOCALIC FLAP ड/ढ→[ɽ]/[ɽʱ] except after a
 * nasal (this module — Saksena: intervocalically ḍ/ḍh become ṛ/ṛh; they stay only after a nasal).
 *
 * ⚠ SINGLE-SOURCE. The divergences come from ONE documented source, Baburam Saksena's Evolution of Awadhi
 * (1937) — a real Awadhi-specific grammar with IPA, not a circular Hindi clone. There is no INDEPENDENT second
 * referee: wikipron, kaikki and epitran ship no Awadhi, and a machine Hindi-clone check would be circular. So
 * this engine is graded against Saksena and nothing else. Per Saksena (quoting Bloch) the Eastern-Indo-Aryan
 * phonologies are "perceptibly identical", distinguished chiefly by GRAMMAR, which is what licenses the
 * Hindi-shared rules. Measured at 93.9% folded against a Saksena referee of 33 of his own transcribed forms.
 */
/**
 * NORMALIZER WORDS: the Hindi defaults are RETAINED, and three of them are confirmed for Awadhi rather than
 * merely inherited — प्रतिशत, मिनट and ईसा पूर्व each occur in sentences whose MORPHOLOGY is Awadhi (कय, होय,
 * मा, कइन्हिन). ⚠ The morphology test is the point: a Devanagari token hit on a small wiki is routinely a
 * quoted HINDI passage, so a bare count proves nothing.
 * ⚠ बजकर / बजे ARE NOT ATTESTED. The clock connective is rare in encyclopedic prose, so that is absence of
 * evidence rather than evidence of absence; Hindi's default stands, unconfirmed.
 *
 * ⚠ A TRAP: `सैकड़ा` is real Awadhi and means CRICKET CENTURIES ("वन १६ सैकड़ा लगाय चुका हैं"), not "per hundred".
 * It is NOT a percent word here. Same shape as the Malay `paun` weight-vs-currency trap.
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
