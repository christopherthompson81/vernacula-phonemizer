/**
 * Oromo number → words.
 * Ported from src/languages/oromo/numbers.ts — see that file for the per-class attestation flags.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Oromo;

public static class Numbers
{
    private static readonly string[] ONES =
    {
        "zeeroo", "tokko", "lama", "sadii", "afur", "shan", "jaha", "torba", "saddeet", "sagal", "kudhan",
    };
    private static readonly IReadOnlyDictionary<int, string> TENS = new Dictionary<int, string>
    {
        [2] = "digdama", [3] = "soddoma", [4] = "afurtama", [5] = "shantama",
        [6] = "jaatama", [7] = "torbaatama", [8] = "saddeettama", [9] = "sagaltama",
    };

    private static readonly JsRe FINAL_A = JsRegex.Compile("a$");

    /** Tens linking form before a unit: digdama → digdamii. */
    private static string Link(string tens) => FINAL_A.Replace(tens, "ii");

    private static string Below100(double n)
    {
        if (n <= 10) return ONES[(int)n];
        if (n < 20) return $"kudha {ONES[(int)n - 10]}";
        double t = Math.Floor(n / 10), u = n % 10;
        return u == 0 ? TENS[(int)t] : $"{Link(TENS[(int)t])} {ONES[(int)u]}";
    }

    private static string Below1000(double n)
    {
        if (n < 100) return Below100(n);
        double h = Math.Floor(n / 100), r = n % 100;
        var head = h == 1 ? "dhibba" : $"dhibba {ONES[(int)h]}";
        return r == 0 ? head : $"{head} {Below100(r)}";
    }

    public static string NumberToWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", (raw ?? Js.NumberToString(Math.Abs(n)))
                .Where(c => c >= '0' && c <= '9').Select(c => ONES[c - '0']));
        if (n == 0) return ONES[0];
        if (n < 1000) return Below1000(n);
        if (n < 1e6)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            var head = th == 1 ? "kuma" : $"kuma {Below1000(th)}";
            return r == 0 ? head : $"{head} {Below1000(r)}";
        }
        double m = Math.Floor(n / 1e6), rem = n % 1e6;
        var mh = m == 1 ? "miliyoona" : $"miliyoona {Below1000(m)}";
        return rem == 0 ? mh : $"{mh} {NumberToWords(rem)}";
    }
}
