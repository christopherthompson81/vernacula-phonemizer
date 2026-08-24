/**
 * Polish (pl) cardinal number compositor. Returns composed Polish TEXT (space-separated) that polish.ts runs
 * through the g2p, so the IPA stays consistent with the word engine.
 *
 * SOURCE for the numeral words: pl.wikipedia's per-number articles — "1 (liczba)" → jeden, … "20 (liczba)" →
 * dwadzieścia, "40 (liczba)" → czterdzieści, "100 (liczba)" → sto, "200 (liczba)" → dwieście, "300 (liczba)" →
 * trzysta, "400 (liczba)" → czterysta, "500 (liczba)" → pięćset, "1000 (liczba)" → tysiąc; the table itself lives
 * in polish.jsonc. Magnitude agreement forms are the standard paradigm (tysiąc/tysiące/tysięcy,
 * milion/miliony/milionów, miliard/miliardy/miliardów).
 *
 * ⚠ WHY THIS IS NOT `westernNumberWords`: the shared Western composer stores ONE string per magnitude, but a
 *   Slavic magnitude noun agrees with its count (2 tysiące vs 5 tysięcy). Polish also DIVERGES from the shared
 *   `slavicCountForm` used by ru/cs for symbol agreement: in Polish a compound numeral ending in "jeden" takes
 *   the GENITIVE PLURAL, not the singular — "dwadzieścia jeden tysięcy" (3 hits on pl.wikipedia) vs
 *   *"dwadzieścia jeden tysiąc" (0 hits); cf. Russian двадцать одна тысяча. So the singular is reserved for an
 *   EXACT count of 1 and `agree()` below is Polish-specific rather than the shared selector.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

public static class PolishNumbers
{
    private static PolishNumbersDef N => Manifest.MANIFEST.Numbers;
    private static string[] UNITS => N.Units;
    private static string[] TEENS => N.Teens;
    private static string[] TENS => N.Tens;
    private static string[] HUNDREDS => N.Hundreds;
    private static PolishMagnitudes MAG => N.Magnitudes;

    /** 0–99 → Polish text (tens and units SPACE-separated: dwadzieścia jeden). */
    private static string Sub100(double n)
    {
        if (n < 10) return UNITS[(int)n];
        if (n < 20) return TEENS[(int)n - 10];
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? TENS[(int)t] : $"{TENS[(int)t]} {UNITS[(int)u]}";
    }

    /** 0–999 → Polish text (irregular round hundred + the sub-hundred remainder). */
    private static string Sub1000(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return Sub100(r);
        return HUNDREDS[(int)h] + (r != 0 ? $" {Sub100(r)}" : "");
    }

    /** The Polish count form of a magnitude noun: EXACTLY 1 → sg; …2–4 (but not …12–14) → paucal; else gen-pl.
     *  Unlike Russian, a compound ending in 1 (21, 101) takes the genitive plural — dwadzieścia jeden tysięcy. */
    private static string Agree(double count, Agreement forms)
    {
        if (count == 1) return forms.Sg;
        double m100 = count % 100, m10 = count % 10;
        if (m100 >= 12 && m100 <= 14) return forms.Plural;
        return m10 >= 2 && m10 <= 4 ? forms.Paucal : forms.Plural;
    }

    /** One magnitude group. A bare count of 1 drops the numeral entirely (tysiąc / milion / miliard — the idiomatic
     *  reading of 1000 / 1 000 000, parallel to the bare hundred "sto"); any other count is spelled + agreed. */
    private static string Magnitude(double count, Agreement forms) =>
        count == 1 ? forms.Sg : $"{Sub1000(count)} {Agree(count, forms)}";

    /** Read a raw digit STRING digit-by-digit — the fallback beyond the miliard group (n ≥ 10^12). */
    public static string ReadDigits(string digits) =>
        string.Join(" ", Js.CodePoints(digits).Select(d =>
        {
            var i = (int)Js.Number(d);
            return i >= 0 && i < UNITS.Length ? UNITS[i] : d;
        }));

    /** A non-negative integer (< 10^12) → space-separated Polish cardinal words. */
    public static string NumberToWords(double n)
    {
        if (n < 0 || !double.IsFinite(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return UNITS[0]; // zero
        if (n >= 1e12) return ReadDigits(Js.NumberToString(n));
        var parts = new List<string>();
        var bil = Math.Floor(n / 1e9);
        n %= 1e9;
        if (bil != 0) parts.Add(Magnitude(bil, MAG.Billion));
        var mil = Math.Floor(n / 1e6);
        n %= 1e6;
        if (mil != 0) parts.Add(Magnitude(mil, MAG.Million));
        var th = Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(Magnitude(th, MAG.Thousand));
        if (n != 0) parts.Add(Sub1000(n));
        return string.Join(" ", parts);
    }
}
