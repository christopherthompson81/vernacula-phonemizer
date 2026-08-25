/**
 * Brazilian Portuguese (pt-BR) — "neutral"/standard (paulistano-based) realization, an ACCENT VARIANT of the
 * European Portuguese `pt` engine (not a separate language).
 * Ported from src/languages/portuguese-br/portuguese-br.ts — see that file for the EP→BP delta in full.
 *
 * ⚠ THIS IS A MODE, NOT A POST-PROCESS, and the distinction is load-bearing. es-419 could wrap the base
 * engine and substitute on its output because seseo and yeísmo lose no information; BP vowel REDUCTION is
 * not recoverable from EP surface forms, so the delta lives inside the engine as `dialect: "bp"`. The C#
 * engine already carried that mode throughout — `ToSegments`, `Sibilants`, `Realize` all take it — so what
 * was missing here was the factory and the open/close lexicon, not any phonology.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Portuguese;

namespace Vernacula.Phonemizer.Languages.PortugueseBr;

public static class PortugueseBr
{
    /**
     * BP open/close override lexicon: word → the correct STRESSED mid vowel (e/ɛ/o/ɔ). The stressed-vowel
     * openness the rules cannot predict (cheque [ɛ] vs sede [e]; the -osa/-ote/verb-morphology open ɔ/ɛ) is
     * genuinely LEXICAL — mined from the wikipron BZ referee for words where the rule output matches NO
     * attested variant, so homographs (which match one reading) are left alone.
     */
    private static Dictionary<string, string>? LEX;
    private static Dictionary<string, string> Lex() =>
        LEX ??= LoadTsv.LoadTsvMap("languages/portuguese-br", "pt-br-openclose.tsv", optional: true);

    /** Apply the BP open/close override: replace the stressed vowel (the char after ˈ) with the target. */
    private static readonly JsRe STRESSED = JsRegex.Compile("ˈ.", "u");
    public static string OpenClose(string ipa, string word) =>
        Lex().TryGetValue(word, out var t) ? STRESSED.Replace(ipa, $"ˈ{t}") : ipa;

    /** One BP word → canonical IPA, SHIPPED path (rule engine in Brazilian mode + the open/close lexicon). */
    public static string PhonemizeWord(string word) =>
        OpenClose(PortuguesePhonemizer.PhonemizeWord(word, "bp"), word.ToLowerInvariant());

    /** One BP word → canonical IPA, RULE-ONLY — the non-circular signal for the referee eval. */
    public static string PhonemizeWordRules(string word) => PortuguesePhonemizer.PhonemizeWord(word, "bp");

    /** Build the Brazilian Portuguese phonemizer (EP engine, `dialect: "bp"`, + the open/close lexicon). */
    public static ILanguage CreatePortugueseBR() =>
        PortuguesePhonemizer.CreatePortuguese("bp", OpenClose);

    internal static void RegisterSelf()
    {
        Registry.Register("portuguese-br", CreatePortugueseBR);
        // Numeral WORDS are identical to `pt` — the variety differs in phonology, not in the numeral lexicon,
        // and shares the ordinal-≤X / cardinal-≥XI convention. The same policy object is registered rather
        // than a copy, so the two cannot drift.
        Registry.RegisterRomanPolicy("pt-BR", Portuguese.RomanOrdinals.ROMAN_POLICY);
    }
}
