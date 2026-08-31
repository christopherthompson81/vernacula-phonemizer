/**
 * NOGAI (nog) cardinal number composition — Kipchak-Nogai (South-Kipchak) Turkic, Cyrillic. Authored
 * data + the compositor; words in Nogai's own orthography (including the soft-sign front-vowel digraphs
 * ⟨уь оь⟩ and the hard-sign ⟨нъ⟩), phonemized by Nogai.cs.
 * Ported from src/languages/nogai/numbers.ts — see that file for the Wiktionary/Omniglot sourcing and the
 * 50/40 judgment calls.
 */
namespace Vernacula.Phonemizer.Languages.Nogai;

public static class Numbers
{
    private static readonly string[] UNITS =
        ["ноль", "бир", "эки", "уьш", "доьрт", "бес", "алты", "ети", "сегиз", "тогыз"];
    private static readonly IReadOnlyDictionary<double, string> TENS = new Dictionary<double, string>
    {
        [10] = "он", [20] = "йырма", [30] = "отыз", [40] = "кырк", [50] = "элли",
        [60] = "алпыс", [70] = "етпис", [80] = "сексен", [90] = "токсан",
    };
    private const string HUNDRED = "юз";
    private const string THOUSAND = "мынъ";
    private const string MILLION = "миллион";
    private const string BILLION = "миллиард";

    /** A non-negative safe integer → the ordered Nogai number WORDS (Cyrillic spellings, not IPA). */
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
