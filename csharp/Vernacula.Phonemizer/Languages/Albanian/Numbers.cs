/**
 * Standard Albanian (Tosk) number → words, for 0–999,999,999,999. Without it a digit string passes
 * straight through and leaks into the IPA.
 *
 * SOURCE: Newmark, Hubbard & Prifti, *Standard Albanian: A Reference Grammar for Students* (Stanford,
 * 1982), the cardinal-numeral section; cross-checked against Wiktionary's Albanian numeral entries. The
 * word list lives in albanian.jsonc (`numbers`).
 *
 * ⚠ ALBANIAN IS DECIMAL AND REGULAR, so the only reason this is not a `westernNumberWords` data block is
 * the OBLIGATORY ⟨e⟩ "and" CONNECTOR between the groups of a composed numeral — njëzet **e** një "21",
 * njëqind **e** një "101", një mijë **e** dyqind **e** tridhjetë **e** katër "1234". The connector is a
 * separate word (it must reach the g2p as its own token, [ˈɛ], not fused into the neighbouring numeral),
 * which the shared Western composer has no slot for. Everything else is plain: fused round hundreds
 * (njëqind, dyqind, treqind…), unit + ⟨mbë⟩ + dhjetë teens, unit + ⟨dhjetë⟩ tens.
 *
 * CITATION FORM for the inflecting numeral: ⟨tre⟩. Albanian 3 has a masculine ⟨tre⟩ and a feminine ⟨tri⟩;
 * the MASCULINE is chosen as the citation form (the dictionary headword, and the form used when counting
 * with no noun in sight — which is exactly the digit-string case). ⟨tri⟩ is never emitted. The compounds
 * built on 3 are already fixed regardless of gender (trembëdhjetë "13", tridhjetë "30", treqind "300").
 *
 * NOTE on ⟨njëzet⟩ "20" / ⟨dyzet⟩ "40": etymologically "one twenty" / "two twenties", a vigesimal fossil.
 * They are treated as plain round-ten words — the system around them is decimal (tridhjetë, pesëdhjetë,
 * …), so there is no base change to model.
 * Ported from src/languages/albanian/numbers.ts — see that file and the jsonc for the sourcing.
 */
using System.Globalization;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Albanian;

public static class Numbers
{
    private static AlbanianNumbersDef N => Manifest.MANIFEST.Numbers;

    private static readonly JsRe WS_RUN = JsRegex.Compile("\\s+", "gu");

    /** The obligatory group connector, ` e `. */
    private static string E => " " + N.Connector + " ";

    /** 1–99. */
    private static string UnderHundred(long n)
    {
        if (n < 10) return N.Units[(int)n];
        if (n < 20) return N.Teens[(int)(n - 10)];
        var t = n / 10 * 10;
        var u = n % 10;
        return N.Tens[t.ToString(CultureInfo.InvariantCulture)] + (u != 0 ? E + N.Units[(int)u] : "");
    }

    /** A magnitude group: `një mijë` / `dy mijë`, `një milion` / `dy milionë`. The "one" is KEPT
     *  (Albanian says një mijë, një milion — there is no bare *mijë the way Latin has bare mīlle). */
    private static string Magnitude(long count, string singular, string plural) =>
        $"{Compose(count)} {(count == 1 ? singular : plural)}";

    private static string Compose(long n)
    {
        if (n < 100) return UnderHundred(n);
        if (n < 1_000)
        {
            var h = n / 100;
            var rem100 = n % 100;
            return N.Hundreds[(int)h] + (rem100 != 0 ? E + Compose(rem100) : "");
        }
        if (n < 1_000_000)
        {
            var th = n / 1_000;
            var remK = n % 1_000;
            return Magnitude(th, N.Magnitudes.Thousand, N.Magnitudes.Thousand) + (remK != 0 ? E + Compose(remK) : "");
        }
        if (n < 1_000_000_000)
        {
            var m = n / 1_000_000;
            var remM = n % 1_000_000;
            return Magnitude(m, N.Magnitudes.Million, N.Magnitudes.MillionPlural) + (remM != 0 ? E + Compose(remM) : "");
        }
        var b = n / 1_000_000_000;
        var remB = n % 1_000_000_000;
        return Magnitude(b, N.Magnitudes.Billion, N.Magnitudes.BillionPlural) + (remB != 0 ? E + Compose(remB) : "");
    }

    /** Non-negative integer → Standard Albanian words. Out-of-range input falls back to digit-by-digit. */
    public static string NumberToWords(double n, string? raw = null)
    {
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0)
        {
            var src = raw ?? Js.NumberToString(n);
            var parts = Js.CodePoints(src).Where(c => c.Length == 1 && c[0] >= '0' && c[0] <= '9').Select(c => N.Units[c[0] - '0']);
            return string.Join(" ", parts);
        }
        if (n == 0) return N.Units[0]; // zero
        return Js.Trim(WS_RUN.Replace(Compose((long)n), " "));
    }
}
