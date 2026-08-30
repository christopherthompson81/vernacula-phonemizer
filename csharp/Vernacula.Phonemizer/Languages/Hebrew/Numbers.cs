/**
 * Hebrew (he) cardinal-number → IPA compositor: Semitic gendered structure over the niqqud-authored number
 * words in hebrew.jsonc, rendered by the deterministic rule g2p. Feminine citation register.
 * Ported from src/languages/hebrew/numbers.ts — see that file for the register and the gender rules.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hebrew;

public static class Numbers
{
    private static HebrewNumbers N => Manifest.MANIFEST.Numbers;

    /** Prefix the connector וְ to a term's head word (the internal "and"). */
    private static List<string> WithVav(List<string> term) =>
        new List<string> { N.And + term[0] }.Concat(term.Skip(1)).ToList();

    /** Concatenate a higher group with a lower remainder, adding the וְ connector on the remainder's head iff
     *  the remainder is a single term. */
    private static List<List<string>> JoinRem(List<List<string>> higher, List<List<string>> lower) =>
        higher.Concat(lower.Count == 1 ? new List<List<string>> { WithVav(lower[0]) } : lower).ToList();

    /** 0–99 → terms (each term = one indivisible cardinal). */
    private static List<List<string>> Sub100(double n, bool masc)
    {
        var U = masc ? N.UnitsM : N.UnitsF;
        if (n < 10) return new() { new() { U[(int)n] } };
        if (n == 10) return new() { new() { N.Ten } };
        if (n < 20) return new() { new() { N.TeensOnes[(int)n - 10], N.TeenSuffix } };
        var t = Math.Floor(n / 10);
        var u = n % 10;
        return u == 0
            ? new() { new() { N.Tens[(int)t] } }
            : new() { new() { N.Tens[(int)t] }, new() { N.And + U[(int)u] } };
    }

    /** 0–999 → terms. Hundreds: 1 מֵאָה, 2 מָאתַיִם (dual), 3-9 reduced-fem unit + מֵאוֹת. */
    private static List<List<string>> Sub1000(double n, bool masc)
    {
        if (n < 100) return Sub100(n, masc);
        var h = Math.Floor(n / 100);
        var rest = n % 100;
        var hs = h == 1
            ? new List<List<string>> { new() { N.Hundred } }
            : h == 2
                ? new List<List<string>> { new() { N.TwoHundred } }
                : new List<List<string>> { new() { N.TeensOnes[(int)h], N.HundredsPlural } };
        return rest != 0 ? JoinRem(hs, Sub100(rest, masc)) : hs;
    }

    /** A magnitude group: `mult` copies of `word` (masculine agreement). The unit arm stops at 9 — there is
     *  no masculine ten in this data model, and reading `UnitsM[10]` threw; see the TS for the defect. */
    private static List<List<string>> Magnitude(double mult, string word)
    {
        if (mult == 1) return new() { new() { word } };
        if (mult == 2) return new() { new() { N.TwoConstruct, word } };
        if (mult < 10) return new() { new() { N.UnitsM[(int)mult], word } };
        return Sub1000(mult, true).Concat(new List<List<string>> { new() { word } }).ToList();
    }

    /** Thousands group: 1 אֶלֶף, 2 אַלְפַּיִם (dual), 3-10 construct + אֲלָפִים, ≥11 masc multiplier + singular. */
    private static List<List<string>> Thousands(double k)
    {
        if (k == 1) return new() { new() { N.Thousand } };
        if (k == 2) return new() { new() { N.TwoThousand } };
        if (k <= 10) return new() { new() { N.ThousandsConstruct[(int)k], N.ThousandsPlural } };
        return Sub1000(k, true).Concat(new List<List<string>> { new() { N.Thousand } }).ToList();
    }

    /** 0 … 10¹²-1 → terms (final remainder feminine; magnitude multipliers masculine). */
    private static List<List<string>> Compose(double n)
    {
        if (n < 1000) return Sub1000(n, false);
        if (n < 1e6)
        {
            double k = Math.Floor(n / 1000), r = n % 1000;
            var g = Thousands(k);
            return r != 0 ? JoinRem(g, Sub1000(r, false)) : g;
        }
        if (n < 1e9)
        {
            double m = Math.Floor(n / 1e6), r = n % 1e6;
            var g = Magnitude(m, N.Million);
            return r != 0 ? JoinRem(g, Compose(r)) : g;
        }
        double b = Math.Floor(n / 1e9), rr = n % 1e9;
        var gb = Magnitude(b, N.Milliard);
        return rr != 0 ? JoinRem(gb, Compose(rr)) : gb;
    }

    /** An integer → its ordered niqqud number-words. Digit-by-digit past 10¹²-1 or unsafe — from `raw`, the
     *  TOKEN's own digits, because above 2^53 the double the caller parsed has already lost them (#1059). */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    private static List<string> IntegerWords(double n, string? raw = null)
    {
        if (n == 0) return new List<string> { N.UnitsF[0] };
        if (n >= 1e12 || !IsSafeInteger(n))
            return Js.CodePoints(raw ?? Js.NumberToString(n))
                .Select(d =>
                {
                    var v = Js.Number(d);
                    // `N.unitsF[Number(d)] ?? d` — a non-digit character keeps itself (JS index miss).
                    return double.IsInteger(v) && v >= 0 && v < N.UnitsF.Length ? N.UnitsF[(int)v] : d;
                }).ToList();
        return Compose(n).SelectMany(t => t).ToList();
    }

    /** Phonemize a digit token (integer or decimal) to Modern Israeli IPA via the rule g2p. */
    public static string NumberToIpa(string digits)
    {
        var dot = digits.IndexOf('.');
        if (dot < 0)
            return string.Join(" ", IntegerWords(Js.Number(digits), digits).Select(HebrewPhonemizer.PhonemizeWord));
        var intWords = IntegerWords(Js.Number(digits[..dot]), digits[..dot]);
        var fracWords = Js.CodePoints(digits[(dot + 1)..]).Select(d => (Core.Numbers.DigitWord(N.UnitsF, d) ?? d));
        return string.Join(" ", intWords.Append(N.Point).Concat(fracWords).Select(HebrewPhonemizer.PhonemizeWord));
    }
}
