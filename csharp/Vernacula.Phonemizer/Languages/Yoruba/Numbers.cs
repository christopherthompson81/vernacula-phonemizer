/**
 * Yoruba cardinal numbers — a VIGESIMAL system with both addition and subtraction.
 * Ported from src/languages/yoruba/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Yoruba;

public static class Numbers
{
    private static YorubaNumbersDef N => Manifest.MANIFEST.Numbers;

    /** 1-10 as free-standing words. */
    private static string Unit(double n) => N.Units[(int)n];

    /** 11-99. The last digit decides the shape: 1-4 additive on the ten below, 5-9 subtractive from the ten
     *  above. */
    private static string BelowTwoHundred(double n)
    {
        if (n == 15) return N.Fifteen;
        if (n == 25) return N.TwentyFive;
        // ⚠ THE UNIT GUARD COMES FIRST: the teens arm below is bounded above (n < 15) and not below, so without
        // this line `2` falls through it and reads *méjìlá* (12).
        if (n < 11) return Unit(n);
        var u = n % 10;
        if (u == 0) return N.Tens[Js.NumberToString(n)].Free;
        if (n < 15) return $"{N.Front[(int)u]}{N.Teen}"; // 11-14: unit + lá
        var lower = n - u;
        if (u <= 4) return $"{N.Front[(int)u]}{N.Add}{N.Tens[Js.NumberToString(lower)].Fused}";
        return $"{N.Front[(int)(10 - u)]}{N.Subtract}{N.Tens[Js.NumberToString(lower + 10)].Fused}";
    }

    /** 100-999. */
    private static string Below1000(double n)
    {
        if (n < 200) return BelowTwoHundred(n);
        double h = Math.Floor(n / 100), rest = n % 100;
        var hundred = N.Hundreds[(int)h];
        return rest == 0 ? hundred : $"{hundred} {N.Join} {Below1000(rest)}";
    }

    /** A magnitude and its multiplier. */
    private static string Scaled(string magnitude, double multiplier)
    {
        if (multiplier == 1) return $"{magnitude} {N.MultiplierOne}";
        if (multiplier <= 10) return $"{magnitude} {Unit(multiplier)}";
        return $"{magnitude} {N.Times} {Below1000(multiplier)}";
    }

    /**
     * Reads each digit separately, in Yoruba units — the floor, so nothing ever escapes to English.
     *
     * ⚠ IT TAKES THE DIGIT STRING, NEVER A NUMBER, and the `double` elsewhere in this file makes that easy to
     * "improve" back. Above 1e21 JavaScript stringifies to EXPONENTIAL notation (`1e+21`), and past 2^53
     * `Number` has already lost digits — so reading the string keeps every digit and cannot produce a
     * character that is not a digit.
     */
    private static string DigitByDigit(string digits) =>
        string.Join(" ", Js.CodePoints(digits)
            .Select(ch =>
            {
                var d = Js.Number(ch);
                return double.IsNaN(d) ? "" : d == 0 ? N.Zero : Unit(d);
            })
            .Where(x => x != ""));

    /** A run of DIGITS → its Yoruba cardinal reading. */
    public static string YorubaNumber(string digits)
    {
        var n = Js.Number(digits);
        // Not a safe integer → read the given digits, not a rounded reconstruction of them.
        return IsSafeInteger(n) ? YorubaCardinal(n) : DigitByDigit(digits);
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** A non-negative integer → its Yoruba cardinal reading. */
    public static string YorubaCardinal(double n)
    {
        if (!double.IsFinite(n) || n < 0 || !double.IsInteger(n) || !IsSafeInteger(n))
            return DigitByDigit(double.IsFinite(n) ? Js.NumberToString(Math.Abs(Math.Truncate(n))) : "");
        if (n == 0) return N.Zero;
        if (n < 1000) return Below1000(n);
        foreach (var (limit, word) in new (double, string)[] { (1e6, N.Thousand), (1e9, N.Million), (1e12, N.Billion) })
        {
            var bas = limit / 1000;
            if (n < limit)
            {
                double mult = Math.Floor(n / bas), rest = n % bas;
                var head = Scaled(word, mult);
                return rest == 0 ? head : $"{head} {N.Join} {YorubaCardinal(rest)}";
            }
        }
        return DigitByDigit(Js.NumberToString(n));
    }

    private static readonly JsRe DIGIT_RUN = JsRegex.Compile("\\p{Nd}+", "gu");

    /** Every run of digits in `text` → its Yoruba cardinal reading. */
    public static string ReadYorubaNumbers(string text) => DIGIT_RUN.Replace(text, m => YorubaNumber(m.Value));
}
