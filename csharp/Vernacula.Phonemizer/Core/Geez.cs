/**
 * Shared Ge'ez / Fidäl engine — for the Ethiosemitic languages written in the Ethiopic SYLLABARY-abugida (Amharic
 * `am`, Tigrinya `ti`). Each codepoint is a whole CV syllable (the vowel is baked into the glyph), so the g2p is a
 * flat fidel→CV lookup rather than a Brahmic matra/virama engine. Two features are UNWRITTEN in the script and
 * handled here: GEMINATION (phonemic but unmarked — left single, folded vs the referee) and the 6th-order vowel
 * [ɨ] (sadis), which is EPENTHETIC — inserted to break illegal clusters — and so is deleted on the surface
 * wherever the surrounding consonants form a legal cluster. The per-language differences (which fidel a codepoint
 * maps to — e.g. Tigrinya keeps the pharyngeals ħ/ʕ that Amharic merged to h/ʔ) live entirely in each language's
 * fidel.tsv; the epenthesis phonotactics are shared Ethiosemitic.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class Geez
{
    private const string VOWEL = "əuiaeɨoɐæ";
    private static readonly HashSet<string> VOWELS = new(Js.CodePoints(VOWEL));

    /** A phoneme token is a VOWEL if its BASE code point is one (so a modifier-bearing token like 'aː' still counts). */
    private static bool IsVowelTok(string? t) =>
        t is not null && t.Length > 0 && VOWELS.Contains(Js.CodePoints(t)[0]);

    /** Split an IPA string into PHONEME tokens: an affricate (X͡Y) + any trailing modifiers (ʼ ʷ ʰ ̥ ː) count as ONE
     *  consonant, so cluster counting isn't fooled by the multi-codepoint spellings (d͡ʒ is one C, not three). */
    private static List<string> ToPhonemes(string s)
    {
        var a = Js.CodePoints(s);
        var outp = new List<string>();
        for (var i = 0; i < a.Count; i++)
        {
            var t = a[i];
            if (i + 1 < a.Count && a[i + 1] == "͡") { t += a[i + 1] + (i + 2 < a.Count ? a[i + 2] : ""); i += 2; } // affricate base ͡ base
            while (i + 1 < a.Count && "ʼʷʰ̥ː".Contains(a[i + 1], StringComparison.Ordinal)) t += a[++i]; // trailing modifiers
            outp.Add(t);
        }
        return outp;
    }

    private static readonly HashSet<string> NASAL = new(Js.CodePoints("mnɲŋ"));
    private static readonly HashSet<string> FRICATIVE = new(Js.CodePoints("szʃʒfhħ"));

    /** Is the consonant sequence c1·c2 an illegal Ethiosemitic cluster that an epenthetic ɨ must break? Keyed on each
     *  token's BASE code point (so labialized sʷ/mʷ classify by s/m). Nasal + a homorganic stop (nb, nd, nɡ) is LEGAL;
     *  a fricative + ɾ (sɾ) is LEGAL; only a STOP + ɾ and nasal + nasal break. */
    private static bool IllegalCluster(string c1, string c2)
    {
        var b1 = Js.CodePoints(c1)[0];
        var b2 = Js.CodePoints(c2)[0];
        if (b2 == "ɾ" && !FRICATIVE.Contains(b1)) return true; // stop + ɾ (ɡɨɾ, bɨɾ); fricative + ɾ (sɾ) is fine
        if (NASAL.Contains(b1) && NASAL.Contains(b2)) return true; // nasal + nasal (nɨɲ, mɨn)
        return false;
    }

    /**
     * Delete the epenthetic 6th-order [ɨ] where the surrounding consonants form a LEGAL cluster; keep it where deleting
     * would create an illegal one. The sadis [ɨ] is inserted to break clusters, so on the surface it survives only
     * where needed: (a) KEPT word-initially (ɨɡɨɾ 'foot'); (b) KEPT if deleting it would leave a WORD-FINAL consonant
     * cluster of ≥3 — an illegal complex coda (አምስት→amɨst, since 'mst#' is illegal; but MEDIALLY the cluster
     * resyllabifies, so አምስተኛ→amstəɲa keeps NO ɨ); (c) KEPT where deleting would abut a truly-illegal 2-cluster — a
     * STOP + /ɾ/ (ɡɨɾ, bɨɾ; a fricative + ɾ like sɾ is legal) or a nasal + nasal (nɨɲ, mɨn). Processed RIGHT-TO-LEFT so
     * an earlier ɨ sees the clusters a later deletion already created.
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
            if (!anyVowelBefore) continue; // word-initial ɨ is kept
            var wordFinal = true; // no vowel follows → word-final cluster
            for (var j = i + 1; j < p.Count; j++)
                if (IsVowelTok(p[j])) { wordFinal = false; break; }
            var left = 0;
            for (var j = i - 1; j >= 0 && !IsVowelTok(p[j]); j--) if (p[j] != "") left++;
            var right = 0;
            for (var j = i + 1; j < p.Count && !IsVowelTok(p[j]); j++) if (p[j] != "") right++;
            if (wordFinal && left + right >= 3) continue; // deleting → illegal ≥3 complex coda → keep
            // The IMMEDIATE non-empty neighbours become adjacent when the ɨ is deleted; a cluster forms only if BOTH
            // are consonants (a vowel on either side means no cluster — nothing to break).
            string? prev = null;
            for (var j = i - 1; j >= 0; j--) if (p[j] != "") { prev = p[j]; break; }
            string? next = null;
            for (var j = i + 1; j < p.Count; j++) if (p[j] != "") { next = p[j]; break; }
            if (IsCons(prev) && IsCons(next) && IllegalCluster(prev!, next!)) continue; // deleting → illegal 2-cluster → keep
            p[i] = "";
        }
        return string.Concat(p);
    }

    // Verbatim TS patterns via the JsRegex translator (PORTING.md, regex section).
    private static readonly JsRe WordspaceTest = JsRegex.Compile("[፡\\s]", "u");
    private static readonly JsRe WordspaceSplit = JsRegex.Compile("[፡\\s]+", "u");

    /** Build a fidel→CV word phonemizer for a Ge'ez-script language: `import.meta.url` + the fidel TSV filename
     *  (C# port: `moduleDir` relative to src/ — see LoadTsv.cs). The Ethiopic wordspace ፡ (and any whitespace) is
     *  a word boundary — each part is phonemized independently. */
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
