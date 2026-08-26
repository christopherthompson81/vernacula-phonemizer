/**
 * Native Awadhi / अवधी (awa) text phonemizer — canonical IPA. Eastern Hindi (Indo-Aryan),
 * Devanagari. Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers) with
 * an Awadhi data file whose implemented DIVERGENCES from Hindi are drawn from Baburam Saksena's Evolution of
 * Awadhi (1937). SIX, and — apart from the manifest header and the ⟨ज्ञ⟩ gap filed below — they are the
 * WHOLE diff against hindi.jsonc: the SIBILANT MERGER श/ष→[s], व→[w] (not Hindi's ʋ), ऐ/औ→[ʌi]/[ʌu] as
 * Lakhimpuri central-onset DIPHTHONGS (not Bhojpuri's
 * monophthongs, and not Hindi's ɛː/ɔː), a word-final avagraha ⟨ऽ⟩ that RETAINS the schwa (`retainOnAvagraha`,
 * Eastern Hindi), and Hindi's three `finalRules` dropped — all five in the data file — plus the INTERVOCALIC
 * FLAP ड/ढ→[ɽ]/[ɽʱ] except after a nasal, in this module (Saksena: intervocalically ḍ/ḍh become ṛ/ṛh; they
 * stay only after a nasal). Each is pinned by a test in test/awadhi.test.ts.
 *
 * ⚠ SINGLE-SOURCE. The divergences come from ONE documented source, Baburam Saksena's Evolution of Awadhi
 * (1937) — a real Awadhi-specific grammar with IPA, not a circular Hindi clone. There is no INDEPENDENT second
 * referee: wikipron, kaikki and epitran ship no Awadhi, and a machine Hindi-clone check would be circular. So
 * this engine is graded against Saksena and nothing else. Per Saksena (quoting Bloch) the Eastern-Indo-Aryan
 * phonologies are "perceptibly identical", distinguished chiefly by GRAMMAR, which is what licenses the
 * Hindi-shared rules. Measured at 93.9% folded against a Saksena referee of 33 of his own transcribed forms.
 */
/**
 * ⚠ NO OVERRIDES ARE PASSED, so awa also inherits Hindi's SHARED SYMBOL TIER — awa declares no
 * `symbolTier` and `makeNativeHindi` falls back to hindi.jsonc's. That tier runs BEFORE this engine's own
 * `symbols`/`stripSymbols`, so `₹500` reads *pˈaː̃t͡ʃ sˈʌu ɾˈʊpjeː* (Hindi's रुपये), NOT the bare number
 * awadhi.jsonc's `stripSymbols` comment used to claim; golden row 186 (a ₹20 salary) shows it. The ordinal
 * tables and the 21-99 numerals are Hindi's for the same reason. All inherited, none Saksena-sourced.
 *
 * ⚠ FILED, NOT FIXED — AN UNDOCUMENTED DIVERGENCE: hindi.jsonc has a postRule d͡ʒɲ→ɡj for ⟨ज्ञ⟩ and
 * awadhi.jsonc does not, so विज्ञान reads *wɪd͡ʒɲaːn* against Hindi *ʋɪɡjaːn* and Bhojpuri *wid͡ʒnɑn*. No
 * Awadhi source licenses [d͡ʒɲ] — it is what falls out of ञ→ɲ with the rule absent. The same gap is in
 * marathi/maithili/chhattisgarhi/nepali/rangpuri, so it is a family-wide decision, not an awa one; the
 * reading is PINNED in test/awadhi.test.ts so it cannot drift while it waits for a referee.
 */
/**
 * NORMALIZER WORDS: the Hindi defaults are RETAINED, and three of them are confirmed for Awadhi rather than
 * merely inherited — प्रतिशत, मिनट and ईसा पूर्व each occur in sentences whose MORPHOLOGY is Awadhi (कय, होय,
 * मा, कइन्हिन). ⚠ The morphology test is the point: a Devanagari token hit on a small wiki is routinely a
 * quoted HINDI passage, so a bare count proves nothing.
 * ⚠ बजे IS ATTESTED, and the attestation artifact first said otherwise — CORRECTED IN PLACE, with the
 * mechanism, at the बजे finding in tools/corpus/attest/awa.jsonc. tools/corpus/mined/awa.jsonc, mined from a
 * DUMP of the same wiki, carries "लगभग 6:24 बजे (सी.ई.टी) ज़ाग्रेब मा … भूकंप आवा", whose morphology is
 * Awadhi (कय, यकर, आवा, फइला, पय), so it passes the same test the three confirmed words pass. The line reads
 * *t͡ʃʰˈəɦ bˈəd͡ʒkəɾ t͡ʃʌubˈiːs mˈɪnəʈ*, i.e. the inherited Hindi clock rule fires on real Awadhi text.
 * ⚠ AND THE GENERAL LESSON IS WORTH MORE THAN THE WORD: `attest.ts` samples the top `--limit` CirrusSearch
 * results, so its `absent` means "not in the sampled articles", NOT "not in the wiki" — a one-article word
 * is exactly what it misses, and a dump-mined artifact is the stronger instrument where one exists.
 * बजकर itself is still unattested as a token, but the construction it belongs to now is. ⚠ THE GOLDEN
 * SAYS NOTHING EITHER WAY: 0/200 rows of csharp/goldens/awa.tsv contain a clock time. फीसदी is in neither
 * artifact.
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
