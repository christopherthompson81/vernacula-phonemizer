/**
 * Native Awadhi / अवधी (awa) text phonemizer — canonical IPA, espeak-independent. Eastern Hindi (Indo-Aryan),
 * Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers) with
 * an Awadhi data file whose implemented DIVERGENCES from Hindi are drawn from Baburam Saksena's Evolution of
 * Awadhi (1937): the SIBILANT MERGER श/ष→[s] (data file) and the INTERVOCALIC FLAP ड/ढ→[ɽ]/[ɽʱ] except after a
 * nasal (this module — Saksena: intervocalically ḍ/ḍh become ṛ/ṛh; they stay only after a nasal).
 *
 * ⚠ CANNOT-VERIFY (⛔): there is NO independent referee for Awadhi — wikipron/kaikki/epitran ship none. Per
 * Saksena (quoting Bloch) the Eastern-Indo-Aryan phonologies are "perceptibly identical" and the lects are
 * distinguished chiefly by GRAMMAR, so most rules are shared with Hindi BY ATTESTATION, not by defaulting to the
 * parent. The committed anchor is a small hand-adjudicated gold of Saksena-transcribed forms (test/awadhi.test.ts),
 * which grades where Awadhi is documented to diverge. This is a SOURCED stub, not a measured convergence. See
 * docs/investigations/awa_native_bringup_investigation.md.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";

// Vowel nuclei the Hindi engine can emit (incl. long ː and nasalization ̃) — the intervocalic context for the flap.
const V = "aəɪiʊueɛoɔɐ";
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
