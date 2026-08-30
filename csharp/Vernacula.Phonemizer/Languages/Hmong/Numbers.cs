/**
 * White Hmong (hmn) cardinal-number compositor — RPA words only (Hmong.cs reads each syllable through the
 * ordinary RPA→IPA converter, so no IPA is authored here).
 * Ported from src/languages/hmong/numbers.ts — see that file for the sources and the 10⁹ judgment call.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hmong;

public static class Numbers
{
    private static readonly string[] UNITS =
        ["xoom", "ib", "ob", "peb", "plaub", "tsib", "rau", "xya", "yim", "cuaj"];

    // Round tens 30–90 (20 is the irregular "nees nkaum", 10 is "kaum" — both handled below).
    private static readonly Dictionary<int, string[]> TENS = new()
    {
        [3] = ["peb", "caug"], [4] = ["plaub", "caug"], [5] = ["tsib", "caug"],
        [6] = ["rau", "caum"], [7] = ["xya", "caum"], [8] = ["yim", "caum"], [9] = ["cuaj", "caum"],
    };

    // ⚠ ORDER MATTERS — largest magnitude first, and the multiplier is ALWAYS spoken (ib puas, ib txhiab).
    private static readonly List<(double V, string W)> MAG =
    [
        (1e6, "roob"), (1e3, "txhiab"), (100, "puas"),
    ];

    /** `Number.isSafeInteger` — the local idiom the fleet uses; there is no BCL equivalent. */
    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /** An integer → the ordered White Hmong (RPA) number words that speak it. */
    public static List<string> NumberToHmongWords(double n, string? raw = null)
    {
        if (!IsSafeInteger(n) || n < 0)
        {
            return Js.CodePoints(raw ?? Js.NumberToString(Math.Abs(n)))
                .Where(c => string.CompareOrdinal(c, "0") >= 0 && string.CompareOrdinal(c, "9") <= 0)
                .Select(d => UNITS[(int)Js.Number(d)])
                .ToList();
        }
        if (n == 0) return [UNITS[0]];
        var outp = new List<string>();
        double r = n;
        foreach (var (v, w) in MAG)
        {
            if (r >= v)
            {
                outp.AddRange(NumberToHmongWords(Math.Floor(r / v))); // multiplier always spoken: ib puas, ib txhiab
                outp.Add(w);
                r %= v;
            }
        }
        if (r >= 20)
        {
            double t = Math.Floor(r / 10);
            if (t == 2) outp.AddRange(["nees", "nkaum"]);
            else outp.AddRange(TENS[(int)t]);
            r %= 10;
        }
        else if (r >= 10)
        {
            outp.Add("kaum"); // 10–19 = kaum (+ unit)
            r %= 10;
        }
        if (r > 0) outp.Add(UNITS[(int)r]);
        return outp;
    }
}
