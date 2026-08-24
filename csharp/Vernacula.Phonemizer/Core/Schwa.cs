/**
 * Medial schwa deletion for Indic-abugida IPA (Ohala 1983 VCəCV rule).
 * Ported from src/core/schwa.ts — see that file for the corpus evidence.
 */

namespace Vernacula.Phonemizer.Core;

public static class Schwa
{
    private static readonly HashSet<char> HI_VOWEL_BASES = new("aeiouɛɔəɪʊoɐɑɒʌæ");

    private readonly record struct Unit(string Text, bool IsStress, bool IsVowel);

    private static readonly HashSet<char> MOD = new("ʰʱʲˠʷⁱᵊːˑ");

    private static readonly JsRe Combining = JsRegex.Compile("[̀-ͯ]", "u");

    private static List<Unit> SegmentUnits(string ipa)
    {
        var units = new List<Unit>();
        var i = 0;
        while (i < ipa.Length)
        {
            var c = ipa[i];
            if (c == 'ˈ' || c == 'ˌ')
            {
                units.Add(new Unit(c.ToString(), true, false));
                i++;
                continue;
            }
            var unit = c.ToString();
            i++;
            while (i < ipa.Length)
            {
                var n = ipa[i];
                if (n == '͡')
                {
                    unit += n + (i + 1 < ipa.Length ? ipa[i + 1].ToString() : "");
                    i += 2;
                    continue;
                } // tie bar links next base
                if (Combining.IsMatch(n.ToString()) || MOD.Contains(n))
                {
                    unit += n;
                    i++;
                    continue;
                } // combining / modifier
                break;
            }
            units.Add(new Unit(unit, false, HI_VOWEL_BASES.Contains(unit[0])));
        }
        return units;
    }

    private static readonly JsRe WhitespaceSplit = JsRegex.Compile("(\\s+)", "u");
    private static readonly JsRe NonSpace = JsRegex.Compile("\\S");

    /** Delete the medial inherent vowel in a V·C·_·C·V context (right-to-left), per word (whitespace-preserving).
     *  `schwa` is the inherent-vowel symbol to delete — /ə/ for Hindi, /ɔ/ for Bengali (both already in the
     * vowel
     *  base set), so the same Ohala rule serves either abugida. */
    public static string DeleteMedialSchwa(string ipa, string schwa = "ə")
    {
        // JS split with a CAPTURING group keeps the separators — .NET Regex.Split does the same.
        return string.Concat(WhitespaceSplit.Re.Split(ipa).Select(w =>
        {
            if (!NonSpace.IsMatch(w)) return w;
            var units = SegmentUnits(w);
            var deleted = new bool[units.Count];
            int PrevPhon(int from)
            {
                var k = from;
                while (k >= 0 && (units[k].IsStress || deleted[k])) k--;
                return k;
            }
            int NextPhon(int from)
            {
                var k = from;
                while (k < units.Count && (units[k].IsStress || deleted[k])) k++;
                return k;
            }
            for (var idx = units.Count - 1; idx >= 0; idx--)
            {
                if (units[idx].IsStress || deleted[idx] || units[idx].Text != schwa)
                    continue;
                var p = PrevPhon(idx - 1); // consonant?
                var pp = PrevPhon(p - 1); // vowel before it?
                var n = NextPhon(idx + 1); // consonant?
                var nn = NextPhon(n + 1); // vowel after it?
                if (p >= 0 &&
                    pp >= 0 &&
                    n < units.Count &&
                    nn < units.Count &&
                    !units[p].IsVowel &&
                    units[pp].IsVowel &&
                    !units[n].IsVowel &&
                    units[nn].IsVowel &&
                    !units[p].Text.Contains('ː') &&
                    !units[n].Text.Contains('ː'))
                {
                    deleted[idx] = true;
                    if (idx - 1 >= 0 && units[idx - 1].IsStress)
                        deleted[idx - 1] = true; // stress was on the deleted schwa
                }
            }
            return string.Concat(units.Where((_, k) => !deleted[k]).Select(u => u.Text));
        }));
    }
}
