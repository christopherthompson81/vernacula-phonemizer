/**
 * Lithuanian (lt) cardinal number compositor. Returns composed Lithuanian TEXT (space-separated) that
 * Lithuanian.cs runs through the g2p, so the IPA stays consistent with the word engine.
 *
 * ⚠ WHY THIS IS NOT `WesternNumberWords`: (a) Lithuanian has NO irregular round-hundred words — the hundreds
 *   are a COUNTED NOUN (šimtas / du šimtai), so there is nothing to put in the shared `hundreds` array; and
 *   (b) every magnitude noun agrees with its count, which the shared composer's one-string-per-magnitude
 *   schema cannot express. The concord is the Lithuanian THREE-WAY split (= the CLDR lt one/few/other
 *   categories):
 *
 *     count ends in 1, but not 11        → nom SG   dvidešimt vienas tūkstantis
 *     count ends in 2–9, not 12–19       → nom PL   du tūkstančiai · penki šimtai
 *     count ends in 0, or is 11–19       → gen PL   dvidešimt tūkstančių · šimtas tūkstančių
 *
 *   This differs from the Slavic paucal rule (cs/pl 2–4 vs 5+) — hence a Baltic-specific `Agree` here rather
 *   than the shared `SlavicCountForm`. The numeral words are sourced in lithuanian.jsonc.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Lithuanian;

public static class Numbers
{
    private static LithuanianNumbers N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> UNITS => N.Units;
    private static IReadOnlyList<string> TEENS => N.Teens;
    private static IReadOnlyList<string> TENS => N.Tens;
    private static LithuanianMagnitudes MAG => N.Magnitudes;

    /**
     * The Lithuanian concord form of a counted noun for `count`. See the header table.
     *
     * ⚠ PUBLIC FOR Normalize.cs, and that is the whole reason Lithuanian cannot use
     * `Core/NormalizeSymbols.cs`: the shared tier holds ONE invariant string per unit, and every Lithuanian
     * counted noun — procentas, laipsnis, kilometras, doleris — takes this same three-way split. A digit has
     * no word for a noun to agree WITH, so each rule must words-ify its operand and call this itself.
     */
    public static string Agree(double count, LithuanianAgreement forms)
    {
        var m100 = count % 100;
        var m10 = count % 10;
        if (m100 >= 11 && m100 <= 19) return forms.Gen; // vienuolika tūkstančių … devyniolika tūkstančių
        if (m10 == 1) return forms.Sg;                  // …1 → nom sg (dvidešimt vienas tūkstantis)
        if (m10 == 0) return forms.Gen;                 // …0 → gen pl (dvidešimt / šimtas tūkstančių)
        return forms.Pl;                                // …2–9 → nom pl (du tūkstančiai)
    }

    /** 0–99 → Lithuanian text (teens are one -lika word; tens + units are space-separated). */
    private static string Sub100(double n)
    {
        if (n < 10) return UNITS[(int)n];
        if (n < 20) return TEENS[(int)n - 10];
        var t = Math.Floor(n / 10);
        var u = n % 10;
        return u == 0 ? TENS[(int)t] : $"{TENS[(int)t]} {UNITS[(int)u]}";
    }

    /** 0–999 → Lithuanian text. The hundred is a counted noun: 1 → šimtas, 2–9 → (count) šimtai. */
    private static string Sub1000(double n)
    {
        var h = Math.Floor(n / 100);
        var r = n % 100;
        if (h == 0) return Sub100(r);
        var hw = h == 1 ? MAG.Hundred.Sg : $"{UNITS[(int)h]} {Agree(h, MAG.Hundred)}";
        return r != 0 ? $"{hw} {Sub100(r)}" : hw;
    }

    /** One magnitude group. `keepOne` = whether a count of exactly 1 keeps the numeral: 1000 is read as the
     *  bare noun "tūkstantis" (as the bare hundred "šimtas" is), while 1 000 000 keeps it — "vienas
     *  milijonas" (the same split the sibling Latvian engine makes for tūkstotis vs viens miljons). */
    private static string Magnitude(double count, LithuanianAgreement forms, bool keepOne)
    {
        if (count == 1) return keepOne ? $"{UNITS[1]} {forms.Sg}" : forms.Sg;
        return $"{Sub1000(count)} {Agree(count, forms)}";
    }

    /**
     * Read a raw digit STRING digit-by-digit — the fallback beyond the milijardas group (n ≥ 10^12).
     *
     * ⚠ CODE UNITS, NOT CODE POINTS: the TS spells this `digits.split("")`, which splits an astral pair into
     * its two surrogate halves and spaces each one out on its own. Iterating code points would be a
     * divergence, not a fix.
     */
    public static string ReadDigits(string digits) =>
        string.Join(" ", digits.Select(d => Core.Numbers.DigitWord(UNITS, d.ToString()) ?? d.ToString()));

    /** A non-negative integer (< 10^12) → space-separated Lithuanian cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || double.IsNaN(n) || double.IsInfinity(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return UNITS[0]; // nulis
        if (n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        var parts = new List<string>();
        var bil = Math.Floor(n / 1e9);
        n %= 1e9;
        if (bil != 0) parts.Add(Magnitude(bil, MAG.Billion, true));
        var mil = Math.Floor(n / 1e6);
        n %= 1e6;
        if (mil != 0) parts.Add(Magnitude(mil, MAG.Million, true));
        var th = Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(Magnitude(th, MAG.Thousand, false)); // 1000 → bare "tūkstantis"
        if (n != 0) parts.Add(Sub1000(n));
        return string.Join(" ", parts);
    }
}
