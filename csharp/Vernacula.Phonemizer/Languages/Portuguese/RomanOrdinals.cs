/**
 * PORTUGUESE (pt) Roman-numeral reading: the prenominal ordinal of event and edition names, which is
 * ordinal at any value. Centuries and regnal numbers stay with the shared cardinal pass, by design.
 * Ported from src/languages/portuguese/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Portuguese;

public static class RomanOrdinals
{
    /** The masculine ordinal tables (portuguese.jsonc `ordinals`). Shared with Normalize.cs, which reads
     *  them for the ordinal INDICATORS (1º / 5ª) and for fractions — one table, three callers. */
    private static PortugueseOrdinals ORD => Manifest.MANIFEST.Ordinals;

    /**
     * Portuguese masculine ordinal, 1 … 1000; null above that (a Roman-numeral year reads as a cardinal).
     * Public so Normalize can reuse it for the ordinal indicators (1º/5ª) and for fractions.
     */
    public static string? PortugueseOrdinal(int n)
    {
        if (n < 1 || n > 1000) return null;
        if (n == 1000) return ORD.Thousandth;
        if (n < 10) return ORD.Units[n];
        if (n < 100)
        {
            int t = n / 10, u = n % 10;
            return u == 0 ? ORD.Tens[t] : $"{ORD.Tens[t]} {ORD.Units[u]}"; // décimo primeiro, vigésimo quinto
        }
        int h = n / 100, r = n % 100;
        return r == 0 ? ORD.Hundreds[h] : $"{ORD.Hundreds[h]} {PortugueseOrdinal(r)}";
    }

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = PortugueseOrdinal,
        /**
         * Noun AFTER the numeral — the prenominal ordinal of event and edition names, the one Portuguese
         * context that is genuinely ordinal at any value. Masculine nouns only — this table emits the
         * -ésimo form, so a feminine head (a XXV edição) must stay out and keep the cardinal reading.
         */
        OrdinalAfter = JsRegex.Compile(
            "^(aniversário|centenário|congresso|encontro|festival|campeonato|certame|concurso|prémio|premio|salão|simpósio|colóquio|seminário|torneio|fórum|ciclo|volume|capítulo|tomo|canto|ato|acto|artigo|batalhão|regimento|governo)$",
            "iu"),
    };
}
