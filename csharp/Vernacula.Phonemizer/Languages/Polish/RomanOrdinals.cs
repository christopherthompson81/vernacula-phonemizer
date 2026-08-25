/**
 * Polish Roman-numeral reading: a century is read as an ORDINAL — `XIX wiek` is *dziewiętnasty wiek*, and a
 * cardinal there would mean "nineteen century". Masculine nominative, both numeral-first and postposed.
 * Ported from src/languages/polish/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

public static class RomanOrdinals
{
    /** Read from the manifest — see the jsonc. */
    private static IReadOnlyList<string> ORD_1_19 => Manifest.MANIFEST.RomanOrdinals;

    /** Whole tens, masculine nominative. */
    private static readonly string[] ORD_TENS =
    {
        "", "dziesiąty", "dwudziesty", "trzydziesty", "czterdziesty", "pięćdziesiąty", "sześćdziesiąty",
        "siedemdziesiąty", "osiemdziesiąty", "dziewięćdziesiąty",
    };

    /** Integer → Polish ordinal, masculine nominative. Above 20 BOTH elements inflect (*dwudziesty pierwszy*),
     *  which is why no cardinal table is needed here; `null` above 100 lets the caller fall back to a cardinal. */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return "setny";
        if (n < 20) return ORD_1_19[n];
        int t = n / 10, u = n % 10;
        return u == 0 ? ORD_TENS[t] : $"{ORD_TENS[t]} {ORD_1_19[u]}";
    }

    /** Double overload for the normalizer, which works in `double` throughout (JS `number`). */
    public static string? Ordinal(double n) =>
        double.IsInteger(n) && n >= 1 && n <= 100 ? Ordinal((int)n) : null;

    /**
     * The ordinal CONTEXT words, in the cases that occur: wiek and stulecie with their paradigms, plus rocznica
     * and zjazd — the contexts that reach past XXX ("L rocznica", "XL zjazd"). Matched on either side, since
     * both `XIX wiek` and `wiek XIX` are ordinary Polish.
     */
    private static readonly JsRe CONTEXT = JsRegex.Compile(
        "^(wiek(u|i|ów|iem|om|ach|ami)?|stuleci(e|a|u|em|ach|om|ami)?|rocznic(a|y|ę|ą|e|om|ach|ami)|zjazd(u|zie|em|y|ów|om|ach|ami)?)$",
        "iu");

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
