/**
 * TATAR (tt) cardinal number composition — Kipchak Turkic, Cyrillic. Authored DATA + the compositor; the
 * words are in Tatar's OWN orthography and phonemized by the g2p (never hand IPA), which is why this
 * returns WORDS and not a joined string.
 *
 * The Turkic decimal shape, with Tatar's ONE deviation from the Turkish/Uzbek pattern: THE TEENS ARE
 * FUSED INTO ONE WORD (унбер 11 … унтугыз 19) while 21-99 stay two words (егерме бер) — which matters
 * because a fused teen is a single stress domain.
 * Ported from src/languages/tatar/numbers.ts — see that file for the sourcing and the judgment calls.
 */
namespace Vernacula.Phonemizer.Languages.Tatar;

public static class Numbers
{
    private static readonly string[] UNITS =
        ["нуль", "бер", "ике", "өч", "дүрт", "биш", "алты", "җиде", "сигез", "тугыз"];

    /** 10-19. ⟨ун⟩ alone at index 0; 11-19 are the FUSED ун+unit forms, one word each. */
    private static readonly string[] TEENS =
        ["ун", "унбер", "унике", "унөч", "ундүрт", "унбиш", "уналты", "унҗиде", "унсигез", "унтугыз"];

    /** ⚠ Keyed by the ROUND value ("20".."90"), not by the tens digit — the TS is a
     *  `Record<number, string>` indexed with `Math.floor(n / 10) * 10`. */
    private static readonly IReadOnlyDictionary<int, string> TENS = new Dictionary<int, string>
    {
        [20] = "егерме", [30] = "утыз", [40] = "кырык", [50] = "илле",
        [60] = "алтмыш", [70] = "җитмеш", [80] = "сиксән", [90] = "туксан",
    };

    private const string HUNDRED = "йөз";
    private const string THOUSAND = "мең";
    private const string MILLION = "миллион";
    private const string BILLION = "миллиард";

    /** A non-negative safe integer → the ordered Tatar number WORDS (spellings, not IPA). */
    public static List<string> NumberToWords(double n)
    {
        if (n < 10) return [UNITS[(int)n]];
        if (n < 20) return [TEENS[(int)n - 10]]; // fused: унбер, унике, …
        if (n < 100)
        {
            var t = (int)Math.Floor(n / 10) * 10; // ROUND value — TENS is keyed "20".."90", not "2".."9"
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
