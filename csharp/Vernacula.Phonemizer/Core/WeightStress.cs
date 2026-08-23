/**
 * Weight-based (quantity-sensitive) word stress — GENERAL, not abugida-specific: pure IPA-string in/out,
 * script-agnostic. `tokenizeIpa` splits any IPA string into C/V units; `applyWeightStress` places stress
 * from syllable WEIGHT. This is the Latin/Arabic/Indic quantity-sensitive stress family; Hindi is just the
 * first consumer (see the examples below). Reusable by any native language with quantity-sensitive stress.
 *
 * Weight rule (Hayes/Pandey): syllable weights are Light (short open V),
 * Heavy (long/nasal V, or short V + coda), Superheavy (long/nasal V + coda). Primary stress goes to
 * the RIGHTMOST superheavy syllable; else the rightmost NON-FINAL heavy (the final syllable is
 * extrametrical); else the first syllable.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class WeightStress
{
    // Regexes built from the notation-primitive lists in `./unicode.ts` — the list is the single source, the
    // pattern is derived. VOWEL = syllable nuclei; MOD = trailing modifiers that attach
    // to the preceding unit (spacing modifiers ː ˑ ʲ ʰ ʱ ʼ + any combining diacritic, so t̪/d̪/n̪ stay ONE token).
    private static readonly JsRe VOWEL = JsRegex.Compile("[" + Unicode.IPA_VOWELS + "]");
    private static readonly JsRe MOD =
        JsRegex.Compile("[" + Unicode.ATTACHING_MODIFIERS + Unicode.COMBINING_DIACRITICS + "]");

    /** Tokenize an IPA string into consonant/vowel units (ties + modifiers stay attached). */
    public static List<string> TokenizeIpa(string ipa)
    {
        // NFD so combining marks (nasal ◌̃, dental ◌̪) are separate → attach to their base vowel/consonant
        // as MOD, and a precomposed nasal vowel (ẽ) is recognised as a vowel (base e).
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

    /** Insert the primary-stress mark ˈ before the onset of the weight-selected syllable. */
    public static string ApplyWeightStress(string ipa)
    {
        var T = TokenizeIpa(ipa);
        var nuclei = new List<int>();
        for (var k = 0; k < T.Count; k++)
            if (IsVowel(T[k])) nuclei.Add(k);
        if (nuclei.Count == 0) return ipa;

        // Syllable onset = the single consonant immediately before the nucleus (belongs to THIS syllable);
        // any earlier consonants since the previous nucleus are the previous syllable's coda.
        int Onset(int si)
        {
            var v = nuclei[si];
            var prevV = si > 0 ? nuclei[si - 1] : -1;
            return v > prevV + 1 && !IsVowel(T[v - 1]) ? v - 1 : v;
        }
        // Coda count of syllable si = consonants between this nucleus and the next syllable's onset.
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

        // The stress mark is placed before the NUCLEUS (vowel), matching the fleet convention
        // (kˈiː, not the standard-IPA before-onset ˈkiː) so native output is fleet-consistent. `onset` is
        // retained for syllable-weight bookkeeping only.
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
