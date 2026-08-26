/**
 * Khmer (km) cardinal-number compositor — Khmer-script words only; the bi-quinary 6–9 (5+n) over a decimal
 * ladder with the Thai-derived tens.
 * Ported from src/languages/khmer/numbers.ts — see that file for the sourcing and the 10⁹ judgement call.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Khmer;

public static class Numbers
{
    private static readonly string[] UNITS =
    {
        "សូន្យ", "មួយ", "ពីរ", "បី", "បួន", "ប្រាំ",
        "ប្រាំមួយ", "ប្រាំពីរ", "ប្រាំបី", "ប្រាំបួន",
    };

    private static readonly Dictionary<int, string> TENS = new()
    {
        [3] = "សាមសិប", [4] = "សែសិប", [5] = "ហាសិប", [6] = "ហុកសិប", [7] = "ចិតសិប", [8] = "ប៉ែតសិប", [9] = "កៅសិប",
    };

    private static readonly (double V, string W)[] MAG =
        { (1e6, "លាន"), (1e5, "សែន"), (1e4, "ម៉ឺន"), (1e3, "ពាន់"), (100, "រយ") };

    /** An integer → the ordered Khmer number words that speak it. */
    public static List<string> NumberToKhmerWords(double n, string? raw = null)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0)
        {
            return Js.CodePoints((raw ?? Js.NumberToString(Math.Abs(n))))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => UNITS[(int)Js.Number(d)])
                .ToList();
        }
        if (n == 0) return new List<string> { UNITS[0] };
        var @out = new List<string>();
        var r = n;
        foreach (var (v, w) in MAG)
        {
            if (r >= v)
            {
                @out.AddRange(NumberToKhmerWords(Math.Floor(r / v)));
                @out.Add(w);
                r %= v;
            }
        }
        if (r >= 20)
        {
            var t = Math.Floor(r / 10);
            @out.Add(t == 2 ? "ម្ភៃ" : TENS[(int)t]);
            r %= 10;
        }
        else if (r >= 10)
        {
            @out.Add("ដប់");
            r %= 10;
        }
        if (r > 0) @out.Add(UNITS[(int)r]);
        return @out;
    }
}
