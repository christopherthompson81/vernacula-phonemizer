/**
 * ⚠ Georgian (ka) VIGESIMAL cardinal number compositor. Returns composed Georgian TEXT that Georgian.cs runs
 * through the g2p, so the IPA stays consistent with the word engine. Georgian is NOT decimal-Western below
 * 100 — it counts 20–99 in SCORES of twenty, so a shared units+teens+round-tens composer has no round tens
 * to read; there are none.
 *
 *   ⚠ THE SCORE CONSTRUCTION (20–99): 20 ოცი, 40 ორმოცი (2×20), 60 სამოცი (3×20), 80 ოთხმოცი (4×20). An
 *     exact multiple of 20 is that word; anything else is the score's stem + -და- ("and") + the PLAIN 1–19
 *     numeral as ONE word — 30 ოცდაათი, 45 ორმოცდახუთი, 99 ოთხმოცდაცხრამეტი. There is no "ten" digit at all.
 *   ⚠ TRUNCATION (≥ 100): groups are separate words and a numeral FOLLOWED by a smaller number drops its
 *     final ⟨ი⟩. This is LOCAL — the hundred truncates iff its own sub-hundred remainder is non-zero, and a
 *     magnitude noun truncates iff any remainder follows. 1300 = ათას სამასი; 1959 = ათას ცხრაას
 *     ორმოცდაცხრამეტი. A MULTIPLIER does not truncate: 2001 is ორი ათას ერთი, not *ორ ათას ერთი.
 *
 * Judgment call kept from the TS: 1000 reads as the bare ათასი (no *ერთი ათასი), but 10⁶/10⁹ KEEP the
 * numeral — ერთი მილიონი / ერთი მილიარდი.
 * Ported from src/languages/georgian/numbers.ts — see that file and the jsonc for the sourcing.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Georgian;

public static class Numbers
{
    private static GeorgianNumbersDef N => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> UNITS => N.Units;
    private static IReadOnlyList<string> TEENS => N.Teens;
    private static GeorgianFormArrays SCORES => N.Scores;
    private static GeorgianFormArrays HUNDREDS => N.Hundreds;
    private static GeorgianMagnitudes MAG => N.Magnitudes;

    /** 0–19 → the plain Georgian numeral (the series that attaches after -და- in a score compound). */
    private static string Sub20(int n) => n < 10 ? UNITS[n] : TEENS[n - 10];

    /** 0–99 → ONE Georgian word. 20–99 is score·20 + remainder, joined by the score stem's -და-. */
    internal static string Sub100(int n)
    {
        if (n < 20) return Sub20(n);
        var s = n / 20;          // 1–4 → ოც / ორმოც / სამოც / ოთხმოც
        var r = n - s * 20;      // 0–19
        return r == 0 ? SCORES.Bare[s] : SCORES.Comb[s] + Sub20(r);
    }

    /** 0–999 → Georgian text. The round hundred truncates iff a sub-hundred remainder follows it. */
    internal static string Sub1000(int n)
    {
        var h = n / 100;
        var r = n % 100;
        if (h == 0) return Sub100(n);
        return r == 0 ? HUNDREDS.Bare[h] : $"{HUNDREDS.Comb[h]} {Sub100(r)}";
    }

    /** One magnitude group: the (never-truncated) multiplier + the magnitude noun, itself truncated iff
     *  `more`. `keepOne` = whether a count of exactly 1 keeps the numeral ერთი. */
    private static string Magnitude(int count, GeorgianNumeralPair forms, bool more, bool keepOne)
    {
        var noun = more ? forms.Comb : forms.Bare;
        if (count == 1) return keepOne ? $"{UNITS[1]} {noun}" : noun;
        return $"{Sub1000(count)} {noun}";
    }

    /** Read a raw digit STRING digit-by-digit — the fallback beyond the მილიარდი group (n ≥ 10¹²). */
    public static string ReadDigits(string digits) =>
        string.Join(" ", digits.Select(d =>
        {
            var v = Js.Number(d.ToString());
            return double.IsInteger(v) && v >= 0 && v < UNITS.Count ? UNITS[(int)v] : d.ToString();
        }));

    /** A non-negative integer (&lt; 10¹²) → space-separated Georgian cardinal words. */
    public static string NumberToWords(double n, string? raw = null)
    {
        if (n < 0 || !double.IsFinite(n)) return "";
        n = Math.Floor(n);
        if (n == 0) return UNITS[0]; // ნული
        if (n >= 1e12) return ReadDigits(raw ?? Js.NumberToString(n));
        var parts = new List<string>();
        var bil = (int)Math.Floor(n / 1e9);
        n %= 1e9;
        if (bil != 0) parts.Add(Magnitude(bil, MAG.Billion, n > 0, true));
        var mil = (int)Math.Floor(n / 1e6);
        n %= 1e6;
        if (mil != 0) parts.Add(Magnitude(mil, MAG.Million, n > 0, true));
        var th = (int)Math.Floor(n / 1000);
        n %= 1000;
        if (th != 0) parts.Add(Magnitude(th, MAG.Thousand, n > 0, false)); // 1000 → bare ათასი
        if (n != 0) parts.Add(Sub1000((int)n));
        return string.Join(" ", parts);
    }
}
