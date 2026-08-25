/**
 * UZBEK (uz) Roman-numeral reading — ORDINAL. A century is `XIX asr` = *oʻn toʻqqizinchi asr*; the
 * orthography writes no hyphen after a Roman numeral, so the numeral IS the ordinal writing.
 * Ported from src/languages/uzbek/romanOrdinals.ts — see that file for the sourcing and its thinness.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Uzbek;

public static class RomanOrdinals
{
    private static NumbersDef N => Manifest.DEF.Numbers;

    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[aeiou]$", "u");

    /** Cardinal stem → ordinal: vowel-final → -nchi, consonant-final → -inchi. ʻ (U+02BB) is not a vowel. */
    private static string Suffixed(string stem) => $"{stem}{(ENDS_VOWEL.IsMatch(stem) ? "" : "i")}nchi";

    /** Integer → Uzbek ordinal. `null` above 100 falls back to the cardinal. */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return Suffixed(N.Magnitudes.Hundred);
        if (n < 10) return Suffixed(N.Units[n]);
        int t = n / 10, u = n % 10;
        if (!N.Tens.TryGetValue(Js.NumberToString(t * 10), out var tens)) return null;
        return u == 0 ? Suffixed(tens) : $"{tens} {Suffixed(N.Units[u])}";
    }

    /** Agglutinative, so unanchored at the end: `asr` also matches asrda, asrning, asrlar, asrga. */
    private static readonly JsRe CONTEXT =
        JsRegex.Compile("^(asr|yuzyillik|mingyillik|yubiley|kongress|sinf)", "iu");

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
