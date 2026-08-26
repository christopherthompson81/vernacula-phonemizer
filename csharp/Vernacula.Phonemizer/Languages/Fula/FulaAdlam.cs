/**
 * Adlam (𞤀𞤁𞤂𞤃, U+1E900–1E95F) → Fula Boko/Latin transliteration — the second-script front-end for Fula (ff).
 * Each Adlam letter maps 1:1 to a Fula phoneme, so the word is transliterated to the Latin orthography and
 * the existing longest-match g2p reads it unchanged → identical IPA.
 * Ported from src/languages/fula/fulaAdlam.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Fula;

public static class FulaAdlam
{
    private static IReadOnlyDictionary<string, string> ADLAM => Manifest.MANIFEST.Adlam.Letters;
    private static readonly IReadOnlySet<string> LENGTHENER =
        new HashSet<string>(Manifest.MANIFEST.Adlam.Lengtheners, StringComparer.Ordinal);
    private static readonly string GEMINATION = Manifest.MANIFEST.Adlam.Gemination;
    private static readonly string HAMZA = Manifest.MANIFEST.Adlam.Hamza;
    private static readonly IReadOnlySet<string> DROP =
        new HashSet<string>(Manifest.MANIFEST.Adlam.Drop, StringComparer.Ordinal);
    /** 𞥐–𞥙, the only digits this scan may fold. */
    private static readonly JsRe ADLAM_DIGIT = JsRegex.Compile("[\\u{1E950}-\\u{1E959}]", "u");
    /** The LATIN spelling vowels (fula.jsonc). */
    private static readonly IReadOnlySet<string> VOWELS =
        new HashSet<string>(Manifest.MANIFEST.LatinVowels, StringComparer.Ordinal);

    /** Is any character of `s` in the Adlam block (U+1E900–1E95F)? */
    public static bool IsAdlam(string s)
    {
        foreach (var ch in Js.CodePoints(s))
        {
            var c = Js.CodePointAt0(ch);
            if (c >= 0x1e900 && c <= 0x1e95f) return true;
        }
        return false;
    }

    /** Fold an Adlam char to its lowercase form (uppercase U+1E900–1E921 → lowercase U+1E922–1E943). */
    private static string ToLower(string ch)
    {
        var c = Js.CodePointAt0(ch);
        return c >= 0x1e900 && c <= 0x1e921 ? Js.FromCodePoint(c + 0x22) : ch;
    }

    /** Transliterate an Adlam word → the Fula Boko/Latin orthography (then the caller runs the normal g2p). */
    public static string AdlamToLatin(string word)
    {
        var outSb = new StringBuilder();
        var lastBase = ""; // the Latin emitted for the previous base letter (for gemination doubling)
        foreach (var raw in Js.CodePoints(word))
        {
            var ch = ToLower(raw);
            if (LENGTHENER.Contains(ch))
            {
                // ⚠ JS `out.at(-1)` is the last UTF-16 CODE UNIT, not the last code point — a passed-through
                // astral character therefore presents its low surrogate here, which no Latin vowel equals.
                var v = outSb.Length > 0 ? outSb[^1].ToString() : "";
                if (v != "" && VOWELS.Contains(v)) outSb.Append(v);
                continue;
            }
            if (ch == GEMINATION) { outSb.Append(lastBase); continue; }
            if (ch == HAMZA) { outSb.Append('q'); lastBase = "q"; continue; }
            if (DROP.Contains(ch)) continue;
            // ⚠ THE DIGIT TEST MUST STAY NARROW — see the TS: an unguarded fold would never return the
            // "unknown" signal the pass-through below depends on, and would set the gemination target from a
            // character that is not an Adlam letter.
            var lat = ADLAM.TryGetValue(ch, out var mapped)
                ? mapped
                : ADLAM_DIGIT.IsMatch(ch) ? Unicode.FoldNativeDigits(ch) : null;
            if (lat is not null) { outSb.Append(lat); lastBase = lat; }
            else outSb.Append(raw); // pass unknown through
        }
        return outSb.ToString();
    }
}
