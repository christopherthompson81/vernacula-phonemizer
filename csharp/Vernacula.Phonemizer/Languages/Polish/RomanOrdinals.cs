/**
 * Polish Roman-numeral reading. A century is read as an ORDINAL: `XIX wiek` is *dziewiętnasty wiek*, and
 * `wiek XIX` is *wiek dziewiętnasty* — the cardinal (*dziewiętnaście wiek*) would mean "nineteen century".
 * Sources: Polish orthography (wieki are written in Roman numerals, read as ordinal adjectives); pl.wikipedia
 * uses the numeral-first order canonically ("XIX wiek", "XIX wieku"), and the postposed "wiek XIX" is the
 * ordinary academic/dating variant — hence BOTH `ordinalBefore` and `ordinalAfter`, with numeral-first
 * (`ordinalAfter`) the dominant pattern in running prose.
 *
 * FORM: masculine nominative singular, agreeing with the masculine **wiek**.
 *
 * DOCUMENTED LIMITATIONS (one word per integer, no access to the matched context word):
 *  - CASE. "w XIX wieku" — by far the most common shape in Polish prose — wants the locative
 *    *dziewiętnastym*. The nominative is emitted anyway; oblique forms are still matched, because the right
 *    lexeme with the wrong ending beats a cardinal that is the wrong word entirely.
 *  - GENDER. A feminine context (rocznica → *pięćdziesiąta*) reads masculine, as would a feminine regnal
 *    number.
 *  - REGNAL context is NOT triggered: it needs a proper-name list ("Jan XXIII" — the preceding word is the
 *    name), so `Jan XXIII` stays a cardinal. Deliberate; adding a papal/royal name list is a separate call.
 *
 * Polish needs no cardinal data: unlike Russian, BOTH elements of a compound ordinal inflect
 * (21 → *dwudziesty pierwszy*), so the two ordinal tables compose on their own.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

public static class RomanOrdinals
{
    /** 1–19, masculine nominative. Irregular stems (pierwszy, drugi, trzeci, ósmy) → table. */
    private static readonly string[] ORD_1_19 =
    {
        "", "pierwszy", "drugi", "trzeci", "czwarty", "piąty", "szósty", "siódmy", "ósmy", "dziewiąty",
        "dziesiąty", "jedenasty", "dwunasty", "trzynasty", "czternasty", "piętnasty", "szesnasty",
        "siedemnasty", "osiemnasty", "dziewiętnasty",
    };

    /** Whole tens, masculine nominative. */
    private static readonly string[] ORD_TENS =
    {
        "", "dziesiąty", "dwudziesty", "trzydziesty", "czterdziesty", "pięćdziesiąty", "sześćdziesiąty",
        "siedemdziesiąty", "osiemdziesiąty", "dziewięćdziesiąty",
    };

    /**
     * Integer → Polish ordinal, masculine nominative. Above 20 both elements are ordinal — *dwudziesty pierwszy*,
     * *pięćdziesiąty drugi*. `undefined` above 100 falls back to the cardinal.
     */
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
     * wiek in the cases that occur (wiek / wieku / wieki / wieków / wiekiem / wiekach / wiekami), stulecie and its
     * paradigm, plus rocznica and zjazd — the ordinal contexts that reach past XXX ("L rocznica", "XL zjazd").
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
