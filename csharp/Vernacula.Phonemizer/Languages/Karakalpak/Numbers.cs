/**
 * KARAKALPAK (kaa) cardinal number composition — Kipchak Turkic (Aral-Caspian, closest to Kazakh), 2016 LATIN
 * orthography. Data + the compositor; words in Karakalpak's own script, phonemized by Karakalpak.cs.
 * Ported from src/languages/karakalpak/numbers.ts — see that file for the sourcing and the 50/40 judgment
 * calls.
 */
namespace Vernacula.Phonemizer.Languages.Karakalpak;

public static class Numbers
{
    private static readonly string[] UNITS =
        ["nol", "bir", "eki", "úsh", "tórt", "bes", "altı", "jeti", "segiz", "toǵız"];
    private static readonly IReadOnlyDictionary<double, string> TENS = new Dictionary<double, string>
    {
        [10] = "on", [20] = "jigirma", [30] = "otız", [40] = "qırq", [50] = "eliw",
        [60] = "alpıs", [70] = "jetpis", [80] = "seksen", [90] = "toqsan",
    };
    private const string HUNDRED = "júz";
    private const string THOUSAND = "mıń";
    private const string MILLION = "million";
    private const string BILLION = "milliard";

    /** A non-negative safe integer → the ordered Karakalpak number WORDS (2016 Latin spellings, not IPA). */
    public static IReadOnlyList<string> NumberToWords(double n)
    {
        if (n < 10) return [UNITS[(int)n]];
        if (n < 100)
        {
            var t = Math.Floor(n / 10) * 10; // ROUND value — TENS is keyed 10..90
            var u = n % 10;
            var r = new List<string> { TENS[t] };
            if (u != 0) r.Add(UNITS[(int)u]);
            return r;
        }
        if (n < 1000)
        {
            var h = Math.Floor(n / 100);
            var r = n % 100;
            var outp = new List<string>();
            if (h > 1) outp.Add(UNITS[(int)h]);
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
            var outp = new List<string>();
            outp.AddRange(NumberToWords(m));
            outp.Add(MILLION);
            if (r != 0) outp.AddRange(NumberToWords(r));
            return outp;
        }
        var b = Math.Floor(n / 1_000_000_000);
        var rem = n % 1_000_000_000;
        var res = new List<string>();
        res.AddRange(NumberToWords(b));
        res.Add(BILLION);
        if (rem != 0) res.AddRange(NumberToWords(rem));
        return res;
    }
}
