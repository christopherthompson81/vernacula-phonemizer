/**
 * SPANISH (es) Roman-numeral reading.
 * Ported from src/languages/spanish/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public static class RomanOrdinals
{
    /** The masculine ordinal tables (spanish.jsonc `ordinals`). Shared with Normalize.cs, which reads them
     *  for the ordinal INDICATORS (1º / 1ª / 1er) and for fractions — one table, three callers. */
    private static SpanishOrdinals ORD => Manifest.MANIFEST.Ordinals;

    public static string? SpanishOrdinal(int n)
    {
        if (n < 1 || n > 1000) return null;
        if (n == 1000) return ORD.Thousandth;
        if (n < 10) return ORD.Units[n];
        if (n < 20) return ORD.Teens[n - 10];
        if (n < 100)
        {
            int t = n / 10, u = n % 10;
            return u == 0 ? ORD.Tens[t] : $"{ORD.Tens[t]} {ORD.Units[u]}";
        }
        int h = n / 100, r = n % 100;
        return r == 0 ? ORD.Hundreds[h] : $"{ORD.Hundreds[h]} {SpanishOrdinal(r)}";
    }

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = SpanishOrdinal,
        /**
         * Noun AFTER the numeral — the prenominal ordinal of event and edition names, the one Spanish context
         * that is genuinely ordinal at any value.
         */
        OrdinalAfter = JsRegex.Compile(
            "^(aniversario|centenario|congreso|encuentro|festival|campeonato|certamen|concurso|premio|salón|simposio|coloquio|seminario|torneo|foro|ciclo|volumen|capítulo|tomo|canto|acto|artículo|batallón|regimiento|gobierno)$",
            "iu"),
    };
}
