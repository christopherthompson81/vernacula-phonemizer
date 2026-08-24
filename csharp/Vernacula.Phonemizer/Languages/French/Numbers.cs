/**
 * French number → words (standard/France, vigesimal 70/80/90). Covers 0 … <10⁹. Decimals read
 * "virgule" + digits.
 *
 * TOKENIZATION: the sub-100 group is emitted as ONE hyphenated orthographic word (dix-sept,
 * vingt-et-un, quatre-vingt-dix-sept) and the magnitude groups are space-separated
 * ("mille neuf cent quatre-vingt-huit"). The hyphens are not cosmetic — they are what makes the
 * numeral resolve against the Lexique compounds. ⚠ THE SPACE-SEPARATED FORM IS PHONEMICALLY WRONG AT THE
 * JOINS, because each piece is then phonemized in isolation:
 *     17  dix sept      → [dis sɛt]   but dix-sept      is [disɛt]    (one [s], not two)
 *     18  dix huit      → [dis ɥit]   but dix-huit      is [dizɥit]   (voiced — huit blocks liaison
 *                                     as a separate word, but not compound-internally)
 *     19  dix neuf      → [dis nœf]   but dix-neuf      is [diznœf]
 *     21  vingt et un   → [vɛ̃ e œ̃]    but vingt-et-un   is [vɛ̃teœ̃]    (the t liaison was lost)
 *     90  quatre vingt dix → [katʁ vɛ̃ dis] but quatre-vingt-dix is [katʁəvɛ̃dis]
 * Lexique attests the compounds (including soixante-dix-sept, quatre-vingt-dix-sept, trente-sept), so
 * they are served as data; the few it lacks (quarante-et-un, cinquante-et-un, soixante-et-un) fall to
 * the per-part concatenation in french.ts, which reproduces the same result. Hyphenating throughout
 * also matches the 1990 orthographic reform.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class Numbers
{
    // Number words are authored DATA — consolidated in french.jsonc; the composition logic below is the algorithm.
    private static IReadOnlyList<string> SMALL => Manifest.MANIFEST.Numbers.Small;
    private static IReadOnlyList<string> TENS => Manifest.MANIFEST.Numbers.Tens;
    private static FrenchMagnitudes MAG => Manifest.MANIFEST.Numbers.Magnitudes;

    /** 0 ≤ n < 100 */
    private static string Below100(int n)
    {
        if (n < 20) return SMALL[n];
        if (n < 60)
        {
            int t = n / 10, u = n % 10;
            if (u == 0) return TENS[t];
            if (u == 1) return $"{TENS[t]}-et-un";
            return $"{TENS[t]}-{SMALL[u]}";
        }
        if (n < 80)
        {
            // 60–79: soixante + 0..19
            var r0 = n - 60;
            if (r0 == 0) return MAG.Sixty;
            if (r0 == 1) return $"{MAG.Sixty}-et-un";
            if (r0 == 11) return $"{MAG.Sixty}-et-onze";
            return $"{MAG.Sixty}-{SMALL[r0]}";
        }
        var r = n - 80; // 80–99: quatre-vingt(s) + 0..19
        return r == 0 ? $"{MAG.Eighty}s" : $"{MAG.Eighty}-{SMALL[r]}";
    }

    /** 1 ≤ n < 1000 */
    private static string Below1000(int n)
    {
        if (n < 100) return Below100(n);
        int h = n / 100, r = n % 100;
        var hundred =
            h == 1
                ? MAG.Hundred
                : $"{SMALL[h]} {MAG.Hundred}{(r == 0 ? "s" : "")}"; // deux cents, deux cent un
        return r != 0 ? $"{hundred} {Below100(r)}" : hundred;
    }

    /** Non-negative integer (< 10⁹) → French words; larger / non-finite → digit-by-digit. */
    public static string NumberToWords(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 0 || n >= 1e9)
            return string.Join(" ", Js.NumberToString(Math.Abs(n))
                .Select(d => d >= '0' && d <= '9' ? SMALL[d - '0'] : d.ToString()));
        var v = (int)n;
        if (v == 0) return SMALL[0]; // zéro
        if (v < 1000) return Below1000(v);
        if (v < 1_000_000)
        {
            int th = v / 1000, r0 = v % 1000;
            var thousand = th == 1 ? MAG.Thousand : $"{Below1000(th)} {MAG.Thousand}";
            return r0 != 0 ? $"{thousand} {Below1000(r0)}" : thousand;
        }
        int m = v / 1_000_000, r = v % 1_000_000;
        var million = m == 1 ? $"un {MAG.Million}" : $"{Below1000(m)} {MAG.Millions}";
        return r != 0 ? $"{million} {NumberToWords(r)}" : million;
    }
}
