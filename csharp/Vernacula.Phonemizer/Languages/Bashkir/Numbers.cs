/**
 * BASHKIR (ba) cardinal number composition — Kipchak Turkic (Tatar's closest sibling), Cyrillic. Authored
 * DATA + the compositor; the words are in Bashkir's OWN orthography and phonemized by the g2p (never hand
 * IPA), which is why this returns WORDS and not a joined string.
 *
 * The Turkic decimal shape: one lexeme per round ten (10 = ун), then juxtaposition with no connector —
 * егерме бер (21), йөҙ егерме бер (121). Bashkir is not Tatar with a spelling filter: the ҫ/ҙ
 * interdentals, the ҡ/ғ uvulars and the initial ⟨һ⟩ for Tatar ⟨с⟩ in 8/80 (һигеҙ, һикһән) all show in the
 * table, and Bashkir does NOT fuse its teens — 11 is TWO words, ун бер.
 *
 * The multiplier "бер" is dropped before both йөҙ (100) and мең (1000), kept before миллион/миллиард.
 * Ported from src/languages/bashkir/numbers.ts — see that file for the sourcing and the judgment calls.
 */
namespace Vernacula.Phonemizer.Languages.Bashkir;

public static class Numbers
{
    private static readonly string[] UNITS =
        ["нуль", "бер", "ике", "өс", "дүрт", "биш", "алты", "ете", "һигеҙ", "туғыҙ"];

    /** ⚠ Keyed by the ROUND value ("10".."90"), not by the tens digit — the TS is a
     *  `Record<number, string>` indexed with `Math.floor(n / 10) * 10`. */
    private static readonly IReadOnlyDictionary<int, string> TENS = new Dictionary<int, string>
    {
        [10] = "ун", [20] = "егерме", [30] = "утыҙ", [40] = "ҡырҡ", [50] = "илле",
        [60] = "алтмыш", [70] = "етмеш", [80] = "һикһән", [90] = "туҡһан",
    };

    private const string HUNDRED = "йөҙ";
    private const string THOUSAND = "мең";
    private const string MILLION = "миллион";
    private const string BILLION = "миллиард";

    /** A non-negative safe integer → the ordered Bashkir number WORDS (spellings, not IPA). */
    public static List<string> NumberToWords(double n)
    {
        if (n < 10) return [UNITS[(int)n]];
        if (n < 100)
        {
            var t = (int)Math.Floor(n / 10) * 10; // ROUND value — TENS is keyed "10".."90", not "1".."9"
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
