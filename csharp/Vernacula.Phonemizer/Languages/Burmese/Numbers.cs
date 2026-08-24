/**
 * Burmese (my) cardinal number → words.
 * Ported from src/languages/burmese/numbers.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Burmese;

public static class Numbers
{
    private static BurmeseNumbersDef N => Manifest.DEF.Numbers;

    private const double CRORE = 10_000_000; // 10⁷ ကုဋေ — the place at which the series repeats

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** THE DIGIT-AT-A-TIME READING — the fallback for a digit run `numberToWords` must refuse. */
    public static string SpellDigits(string digits) =>
        string.Join(" ", digits.Where(c => c >= '0' && c <= '9')
            .Select(c => c == '0' ? N.Zero : N.Units[c - '0']));

    /** Non-negative integer → the Burmese numeral as ONE orthographic word (no spaces). */
    public static string NumberToWords(double n)
    {
        if (!IsSafeInteger(n) || n < 0) return Js.NumberToString(n);
        if (n == 0) return N.Zero;
        if (n >= CRORE)
        {
            var crores = Math.Floor(n / CRORE);
            var restC = n % CRORE;
            var placeC = N.Places[6]; // ကုဋေ
            return string.Concat(new[]
            {
                NumberToWords(crores),
                restC == 0 ? placeC[0] : placeC[1],
                restC == 0 ? "" : NumberToWords(restC),
            }.Where(s => s != ""));
        }
        var outp = new List<string>();
        for (var p = 6; p >= 1; p--)
        {
            var value = Math.Pow(10, p);
            var mult = Math.Floor(n / value) % 10;
            if (mult == 0) continue;
            var place = N.Places[p - 1];
            var rest = n % value;
            if (!(mult == 1 && p == 1)) outp.Add(mult == 1 ? N.One : N.Units[(int)mult]);
            outp.Add(rest == 0 ? place[0] : place[1]);
        }
        var unit = n % 10;
        if (unit != 0) outp.Add(N.Units[(int)unit]);
        return string.Concat(outp);
    }
}
