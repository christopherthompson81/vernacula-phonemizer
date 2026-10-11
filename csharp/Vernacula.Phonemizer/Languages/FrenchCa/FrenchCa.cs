/**
 * Québécois French (fr-CA) — an ACCENT VARIANT of the France-French `fr` engine (not a separate language).
 * Reuses the full French G2P and applies a context-free surface DELTA to its output — the es-419 pattern, no
 * information lost, so a post-process rather than an engine fork.
 * Ported from src/languages/french-ca/french-ca.ts — see that file for the phonological sources (Walker 1984,
 * Côté 2012) and for what is deliberately DEFERRED (the nasal shifts, diphthongisation, the /ɑ/–/a/ split).
 *
 * ⚠ THE LENGTHENING SET IS ABOUT THE CODA AFTER THE VOWEL. `dire`→d͡ziʁ stays tense because /ʁ/ follows the
 * /i/; `musique`→myzɪk LAXES because the /z/ there is an onset BEFORE the /i/ and the actual coda is /k/. The
 * TS docstring listed musique as tense until this port's test was written from the comment and disagreed with
 * both engines; the comment was wrong, the code was right.
 *
 * ⚠ NO ROMAN POLICY IS REGISTERED, and that is not an omission: `fr-CA` is in `Registry.ROMAN_NATIVE`, so the
 * shared Roman pass is skipped entirely and French resolves numerals in its own normalization, with more
 * context than the shared pass has. Registering one here would pre-empt it.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.French;

namespace Vernacula.Phonemizer.Languages.FrenchCa;

public static class FrenchCa
{
    private static readonly IReadOnlyDictionary<string, string> LAX = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["i"] = "ɪ", ["y"] = "ʏ", ["u"] = "ʊ",
    };
    // Non-lengthening coda consonants; the LENGTHENING set /ʁ v z ʒ/ is deliberately absent — it keeps the
    // vowel tense.
    private const string CODA = "ptkbdɡfsʃmnɲŋlç";
    // After a coda consonant: end-of-word or another consonant. A vowel / stress mark / affricate TIE means the
    // consonant is a syllable ONSET (open syllable) → no laxing. ⚠ U+0361 COMBINING DOUBLE INVERTED BREVE is
    // the last character of this class: a coda C followed by the tie is an affricate onset (t͡s), not a coda.
    private const string OPEN = "aeɛiouyœøəɑɔˈ͡";
    // ⚠ AN OBSTRUENT + LIQUID before a vowel is a two-consonant ONSET, not a coda (pu.blique, cy.clone,
    // ci.tron), so the vowel before it is in an OPEN syllable and stays tense (#1533).
    private const string ONSET_CLUSTER = $"[ptkbdɡf][lʁ][{OPEN}]";

    private static readonly JsRe AFFRICATE_T = JsRegex.Compile("t(?=[ˈˌ]?[iyɥj])", "gu");
    private static readonly JsRe AFFRICATE_D = JsRegex.Compile("d(?=[ˈˌ]?[iyɥj])", "gu");
    private static readonly JsRe LAXING = JsRegex.Compile($"([iyu])(?=(?!{ONSET_CLUSTER})[{CODA}](?![{OPEN}]))", "gu");
    private static readonly JsRe FINAL_A = JsRegex.Compile("a(?=[ .,;!?…»)]|$)", "gu");

    /** France-French citation IPA → Québécois (affrication + high-vowel laxing + final-/a/ backing). */
    public static string ToQuebecois(string fr)
    {
        // AFFRICATION FIRST — it needs the underlying /i y j ɥ/, before laxing rewrites them.
        var s = AFFRICATE_D.Replace(AFFRICATE_T.Replace(fr, "t͡s"), "d͡z");
        s = LAXING.Replace(s, m => LAX[m.Groups[1].Value]);
        return FINAL_A.Replace(s, "ɑ");
    }

    /** One fr-CA word → canonical IPA. Context-free, so the shipped path IS the rule path. */
    public static string PhonemizeWord(string word) =>
        FrenchPhonemizer.CreateFrench(accent: ToQuebecois).Text(word);

    /** Alias kept for parity with the variants (en-GB/pt-BR) that split a lexicon-bearing shipped path. */
    public static string PhonemizeWordRules(string word) => PhonemizeWord(word);

    /**
     * Build the Québécois-French phonemizer (France engine + the Québécois delta on each French word).
     * ⚠ THE DELTA IS HANDED TO THE ENGINE AND APPLIED PER FRENCH WORD (#1533). On the assembled string it also
     * rewrote an embedded FOREIGN run read by another engine (Greek τι → t͡si). No rule of it looks across a
     * space, so every French word reads as before, and the trace's output spans are now exact for fr-CA.
     */
    public static ILanguage CreateFrenchCA() => FrenchPhonemizer.CreateFrench(accent: ToQuebecois);

    internal static void RegisterSelf() => Registry.Register("french-ca", CreateFrenchCA);
}
