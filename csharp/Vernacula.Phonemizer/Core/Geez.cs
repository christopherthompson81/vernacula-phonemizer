/**
 * Shared Ge'ez / Fidäl engine for the Ethiosemitic languages (Amharic, Tigrinya): a flat fidel→CV
 * lookup, plus deletion of the epenthetic 6th-order [ɨ] wherever the surrounding cluster is legal.
 * Ported from src/core/geez.ts — see that file for the corpus evidence.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class Geez
{
    private const string VOWEL = "əuiaeɨoɐæ";
    private static readonly HashSet<string> VOWELS = new(Js.CodePoints(VOWEL));

    /** A token is a VOWEL if its BASE code point is one, so a modifier-bearing token like 'aː' still counts. */
    private static bool IsVowelTok(string? t) =>
        t is not null && t.Length > 0 && VOWELS.Contains(Js.CodePoints(t)[0]);

    /** Split an IPA string into PHONEME tokens: an affricate (X͡Y) plus any trailing modifiers is ONE token,
     *  so cluster counting is not fooled by the multi-code-point spellings. */
    private static List<string> ToPhonemes(string s)
    {
        var a = Js.CodePoints(s);
        var outp = new List<string>();
        for (var i = 0; i < a.Count; i++)
        {
            var t = a[i];
            if (i + 1 < a.Count && a[i + 1] == "͡") { t += a[i + 1] + (i + 2 < a.Count ? a[i + 2] : ""); i += 2; }
            while (i + 1 < a.Count && "ʼʷʰ̥ː".Contains(a[i + 1], StringComparison.Ordinal)) t += a[++i];
            outp.Add(t);
        }
        return outp;
    }

    private static readonly HashSet<string> NASAL = new(Js.CodePoints("mnɲŋ"));
    private static readonly HashSet<string> FRICATIVE = new(Js.CodePoints("szʃʒfhħ"));

    /** Is c1·c2 an illegal Ethiosemitic cluster that an epenthetic ɨ must break? Keyed on each token's BASE
     *  code point, so labialized sʷ/mʷ classify by s/m. */
    private static bool IllegalCluster(string c1, string c2)
    {
        var b1 = Js.CodePoints(c1)[0];
        var b2 = Js.CodePoints(c2)[0];
        if (b2 == "ɾ" && !FRICATIVE.Contains(b1)) return true;
        if (NASAL.Contains(b1) && NASAL.Contains(b2)) return true;
        return false;
    }

    /**
     * Delete the epenthetic 6th-order [ɨ] where the surrounding consonants form a LEGAL cluster; keep it where
     * deleting would create an illegal one. ⚠ RIGHT-TO-LEFT on purpose, so an earlier ɨ sees the clusters a
     * later deletion already created — reversing the loop changes the output.
     */
    public static string DeleteEpenthetic(string s)
    {
        var p = ToPhonemes(s);
        bool IsCons(string? t) => t is not null && t != "" && !IsVowelTok(t);
        for (var i = p.Count - 1; i >= 0; i--)
        {
            if (p[i] != "ɨ") continue;
            var anyVowelBefore = false;
            for (var j = 0; j < i; j++)
                if (p[j] != "" && IsVowelTok(p[j])) { anyVowelBefore = true; break; }
            if (!anyVowelBefore) continue;
            var wordFinal = true;
            for (var j = i + 1; j < p.Count; j++)
                if (IsVowelTok(p[j])) { wordFinal = false; break; }
            var left = 0;
            for (var j = i - 1; j >= 0 && !IsVowelTok(p[j]); j--) if (p[j] != "") left++;
            var right = 0;
            for (var j = i + 1; j < p.Count && !IsVowelTok(p[j]); j++) if (p[j] != "") right++;
            if (wordFinal && left + right >= 3) continue;
            string? prev = null;
            for (var j = i - 1; j >= 0; j--) if (p[j] != "") { prev = p[j]; break; }
            string? next = null;
            for (var j = i + 1; j < p.Count; j++) if (p[j] != "") { next = p[j]; break; }
            if (IsCons(prev) && IsCons(next) && IllegalCluster(prev!, next!)) continue;
            p[i] = "";
        }
        return string.Concat(p);
    }

    private static readonly JsRe WordspaceTest = JsRegex.Compile("[፡\\s]", "u");
    private static readonly JsRe WordspaceSplit = JsRegex.Compile("[፡\\s]+", "u");

    /** Build a fidel→CV word phonemizer for a Ge'ez-script language. `moduleDir` is relative to src/, standing
     *  in for the TS `import.meta.url` (see LoadTsv.cs). */
    public static Func<string, string> MakeGeezG2P(string moduleDir, string fidelFile)
    {
        Dictionary<string, string>? fidel = null;
        Dictionary<string, string> Map() => fidel ??= LoadTsv.LoadTsvMap(moduleDir, fidelFile);
        string Word(string w)
        {
            if (WordspaceTest.IsMatch(w))
                return string.Join(" ",
                    WordspaceSplit.Re.Split(w).Where(part => part.Length > 0).Select(Word));
            var outp = new StringBuilder();
            foreach (var ch in Js.CodePoints(w.Normalize(NormalizationForm.FormC)))
                outp.Append(Map().TryGetValue(ch, out var v) ? v : "");
            return DeleteEpenthetic(outp.ToString()).Normalize(NormalizationForm.FormC);
        }
        return Word;
    }
}
