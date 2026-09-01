/**
 * Turkmen Roman-numeral reading. A century is an ORDINAL: `XX asyr` is *ýigriminji asyr*; the shared
 * cardinal pass gives *ýigrimi asyr*, which means "twenty centuries".
 *
 * ⚠ NO SEPARATE ORDINAL TABLE — Normalize.cs already derives it, so this file calls that function rather
 * than authoring a second copy. ⚠ BUT THE BACKNESS HAS TO BE DECIDED HERE, which is the one thing that is
 * not free: `OrdinalOf` takes the choice from the suffix the WRITER typed, and a Roman numeral has no
 * written suffix. Turkmen's rule is the ordinary one — the suffix harmonises with the last vowel of the
 * numeral's final word (`üç` → *üçünji*, `alty` → *altynjy*) — and the helper below reads that vowel and
 * passes the answer in.
 * Ported from src/languages/turkmen/romanOrdinals.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Turkmen;

public static class RomanOrdinals
{
    private const string FRONT = "äeiöü";
    private const string VOWELS = "aäeioöuüy";

    /** Bounded at 100: above that a Roman numeral is a year or a regnal number, and the cardinal is right. */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        var words = Numbers.NumberToWords(n);
        if (words.Count == 0) return null;
        var last = words[^1];
        var vowels = last.Where(c => VOWELS.Contains(c, StringComparison.Ordinal)).ToList();
        if (vowels.Count == 0) return null;
        return Normalize.OrdinalOf(n, FRONT.Contains(vowels[^1], StringComparison.Ordinal));
    }

    /**
     * `asyr` (century) in the cases the corpus writes. ⚠ `ýyl` (year) is NOT here: a Roman numeral beside
     * a year would be a regnal or volume number, and this corpus writes its years in digits. No event
     * noun is listed either — none occurs beside a Roman numeral in the retained text, and a trigger with
     * no attested instance is a misfire generator (trap 9).
     */
    private static readonly JsRe CONTEXT =
        JsRegex.Compile("^(asyr(yň|da|dan|a|y|lar|laryň|larda|lardan)?)$", "iu");

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
