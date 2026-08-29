/**
 * Crimean Tatar (crh) cardinal number → WORDS (not a joined string: the engine phonemizes each through the
 * same g2p). Kipchak Turkic, decimal and regular — one lexeme per round ten, then juxtaposition with no
 * connector. `biñ` (1000) and `yüz` (100) drop their multiplier at exactly one.
 * Ported from src/languages/crimeantatar/numbers.ts — see that file for the sourcing.
 */
namespace Vernacula.Phonemizer.Languages.CrimeanTatar;

public static class Numbers
{
    private static readonly string[] UNITS =
        ["sıfır", "bir", "eki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "doquz"];

    /** ⚠ Keyed by the ROUND value (10..90), not by the tens digit — the TS is a `Record<number, string>`
     *  indexed with `Math.floor(n / 10) * 10`. */
    private static readonly IReadOnlyDictionary<int, string> TENS = new Dictionary<int, string>
    {
        [10] = "on", [20] = "yigirmi", [30] = "otuz", [40] = "qırq", [50] = "elli",
        [60] = "altmış", [70] = "yetmiş", [80] = "seksen", [90] = "doqsan",
    };

    private const string HUNDRED = "yüz";
    private const string THOUSAND = "biñ";
    private const string MILLION = "million";
    private const string BILLION = "milliard";

    public static List<string> NumberToWords(double n)
    {
        if (n < 10) return [UNITS[(int)n]];
        if (n < 100)
        {
            var t = (int)Math.Floor(n / 10) * 10; // ROUND value — TENS is keyed 10..90
            var u = (int)(n % 10);
            var outp = new List<string> { TENS[t] };
            if (u != 0) outp.Add(UNITS[u]);
            return outp;
        }
        if (n < 1000)
        {
            var h = (int)Math.Floor(n / 100);
            var r = n % 100;
            var outp = new List<string>();
            if (h > 1) outp.Add(UNITS[h]);
            outp.Add(HUNDRED);
            if (r != 0) outp.AddRange(NumberToWords(r));
            return outp;
        }
        if (n < 1_000_000)
        {
            var th = Math.Floor(n / 1000);
            var r = n % 1000;
            var outp = new List<string>();
            if (th > 1) outp.AddRange(NumberToWords(th));
            outp.Add(THOUSAND);
            if (r != 0) outp.AddRange(NumberToWords(r));
            return outp;
        }
        if (n < 1_000_000_000)
        {
            var m = Math.Floor(n / 1_000_000);
            var r = n % 1_000_000;
            var outp = new List<string>(NumberToWords(m)) { MILLION };
            if (r != 0) outp.AddRange(NumberToWords(r));
            return outp;
        }
        var b = Math.Floor(n / 1_000_000_000);
        var rem = n % 1_000_000_000;
        var res = new List<string>(NumberToWords(b)) { BILLION };
        if (rem != 0) res.AddRange(NumberToWords(rem));
        return res;
    }
}
