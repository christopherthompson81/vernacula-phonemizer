/**
 * Weight-based (quantity-sensitive) word stress — GENERAL, not abugida-specific: pure IPA-string in/out,
 * script-agnostic.
 * Ported from src/core/weightStress.ts — see that file for the corpus evidence.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class WeightStress
{
    private static readonly JsRe VOWEL = JsRegex.Compile("[" + Unicode.IPA_VOWELS + "]");
    private static readonly JsRe MOD =
        JsRegex.Compile("[" + Unicode.ATTACHING_MODIFIERS + Unicode.COMBINING_DIACRITICS + "]");

    /** Tokenize an IPA string into consonant/vowel units (ties + modifiers stay attached). */
    public static List<string> TokenizeIpa(string ipa)
    {
        // NFD so combining marks (nasal ◌̃, dental ◌̪) separate and attach to their base as modifiers, and a
        // precomposed nasal vowel (ẽ) is recognised as a vowel.
        var s = Js.CodePoints(ipa.Normalize(NormalizationForm.FormD));
        var outp = new List<string>();
        for (var i = 0; i < s.Count;)
        {
            var t = s[i];
            i++;
            while (i < s.Count && (MOD.IsMatch(s[i]) || s[i] == Unicode.TIE_BAR))
            {
                t += s[i];
                if (s[i] == Unicode.TIE_BAR && i + 1 < s.Count)
                {
                    i++;
                    t += s[i];
                }
                i++;
            }
            outp.Add(t);
        }
        return outp;
    }

    private static bool IsVowel(string tok) => VOWEL.IsMatch(tok[0].ToString());

    private static readonly JsRe LongOrNasal = JsRegex.Compile("[ː̃]");

    /** Insert the primary-stress mark ˈ before the NUCLEUS of the weight-selected syllable — ⚠ the fleet
     *  convention (kˈiː), not standard IPA's before-the-onset placement (ˈkiː). `Onset` is computed for
     *  syllable-weight bookkeeping only. */
    public static string ApplyWeightStress(string ipa)
    {
        var T = TokenizeIpa(ipa);
        var nuclei = new List<int>();
        for (var k = 0; k < T.Count; k++)
            if (IsVowel(T[k])) nuclei.Add(k);
        if (nuclei.Count == 0) return ipa;

        int Onset(int si)
        {
            var v = nuclei[si];
            var prevV = si > 0 ? nuclei[si - 1] : -1;
            return v > prevV + 1 && !IsVowel(T[v - 1]) ? v - 1 : v;
        }
        int Coda(int si)
        {
            var v = nuclei[si];
            var end = si + 1 < nuclei.Count ? Onset(si + 1) : T.Count;
            return end - v - 1;
        }
        char Weight(int si)
        {
            var longNas = LongOrNasal.IsMatch(T[nuclei[si]]);
            var c = Coda(si);
            if ((longNas && c >= 1) || (!longNas && c >= 2)) return 'S';
            if (longNas || c >= 1) return 'H';
            return 'L';
        }

        if (nuclei.Count == 1) return Mark(T, nuclei[0]);

        var target = -1;
        for (var si = nuclei.Count - 1; si >= 0; si--)
            if (Weight(si) == 'S')
            {
                target = si;
                break;
            }
        if (target < 0)
            for (var si = nuclei.Count - 2; si >= 0; si--)
                if (Weight(si) == 'H')
                {
                    target = si;
                    break;
                }
        if (target < 0) target = 0;
        return Mark(T, nuclei[target]);
    }

    private static string Mark(List<string> T, int idx) =>
        string.Concat(T.Take(idx)) + Unicode.STRESS_PRIMARY + string.Concat(T.Skip(idx));
}
