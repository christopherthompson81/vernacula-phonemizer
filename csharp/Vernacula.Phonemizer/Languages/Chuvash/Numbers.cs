/**
 * CHUVASH (chv) cardinal number composition — the SOLE surviving Oghur (Bulgaric) Turkic language,
 * Cyrillic. Two features none of the Common-Turkic seven has: TWO SERIES per unit (FULL/substantival
 * with the geminate consonant, SHORT/attributive with the single) and UNIT-TIMES-TEN 80/90. Words are
 * Chuvash's own orthography, phonemized by Chuvash.cs.
 * Ported from src/languages/chuvash/numbers.ts — see that file for the sourcing and the judgment calls.
 */
namespace Vernacula.Phonemizer.Languages.Chuvash;

public static class Numbers
{
    // FULL (substantival / counting) forms — the default for a digit run read aloud.
    private static readonly string[] FULL =
        ["ноль", "пӗрре", "иккӗ", "виҫҫӗ", "тӑваттӑ", "пиллӗк", "улттӑ", "ҫиччӗ", "саккӑр", "тӑххӑр"];
    // SHORT (attributive) forms — used when the unit multiplies a following magnitude word (ик ҫӗр, виҫ пин).
    private static readonly string[] SHORT =
        ["ноль", "пӗр", "ик", "виҫ", "тӑват", "пилӗк", "улт", "ҫич", "сакӑр", "тӑхӑр"];

    private const string TEN_FULL = "вуннӑ"; // 10 standing alone
    private const string TEN_SHORT = "вун"; // the teens prefix and the attributive ten (вун ҫиччӗ, вун пин)

    /** ⚠ Keyed by the ROUND value (20..90), not the tens digit — the TS is a `Record<number,string>`
     *  indexed with `Math.floor(n / 10) * 10`. 80 and 90 are the Oghur unit-times-ten, one word each. */
    private static readonly IReadOnlyDictionary<int, string> TENS = new Dictionary<int, string>
    {
        [20] = "ҫирӗм", [30] = "вӑтӑр", [40] = "хӗрӗх", [50] = "аллӑ", [60] = "утмӑл", [70] = "ҫитмӗл",
        [80] = "сакӑрвуннӑ", [90] = "тӑхӑрвуннӑ",
    };

    private const string HUNDRED = "ҫӗр";
    private const string THOUSAND = "пин";
    private const string MILLION = "миллион";
    private const string BILLION = "миллиард";

    /** One unit 1-9 in the series the slot calls for: SHORT when it modifies a following magnitude word, else FULL. */
    private static string Unit(double u, bool attr) => attr ? SHORT[(int)u] : FULL[(int)u];

    /**
     * A non-negative safe integer → the ordered Chuvash number WORDS (spellings, not IPA). `attr` = this
     * group MULTIPLIES a magnitude word that follows it, so its final unit takes the short/attributive
     * series (3000 → виҫ пин, not виҫҫӗ пин). Top-level calls are substantival → `attr` false.
     */
    public static List<string> NumberToWords(double n, bool attr = false)
    {
        if (n < 10) return [Unit(n, attr)];
        if (n == 10) return [attr ? TEN_SHORT : TEN_FULL];
        if (n < 20) return [TEN_SHORT, Unit(n - 10, attr)]; // вун ҫиччӗ (17)
        if (n < 100)
        {
            var t = (int)Math.Floor(n / 10) * 10; // ROUND value — TENS is keyed 20..90
            var u = n % 10;
            var outp = new List<string> { TENS[t] };
            if (u != 0) outp.Add(Unit(u, attr));
            return outp;
        }
        if (n < 1000)
        {
            var h = (int)Math.Floor(n / 100);
            var r = n % 100;
            // the hundred-multiplier is an attributive slot → SHORT form (ик ҫӗр); 100 itself drops it (ҫӗр)
            var outp = new List<string>();
            if (h > 1) outp.Add(SHORT[h]);
            outp.Add(HUNDRED);
            if (r != 0) outp.AddRange(NumberToWords(r, attr));
            return outp;
        }
        if (n < 1_000_000)
        {
            var th = Math.Floor(n / 1000);
            var r = n % 1000;
            var outp = new List<string>();
            if (th > 1) outp.AddRange(NumberToWords(th, true));
            outp.Add(THOUSAND);
            if (r != 0) outp.AddRange(NumberToWords(r, attr));
            return outp;
        }
        if (n < 1_000_000_000)
        {
            var m = Math.Floor(n / 1_000_000);
            var r = n % 1_000_000;
            var outp = new List<string>(NumberToWords(m, true)) { MILLION };
            if (r != 0) outp.AddRange(NumberToWords(r, attr));
            return outp;
        }
        var b = Math.Floor(n / 1_000_000_000);
        var rem = n % 1_000_000_000;
        var res = new List<string>(NumberToWords(b, true)) { BILLION };
        if (rem != 0) res.AddRange(NumberToWords(rem, attr));
        return res;
    }
}
