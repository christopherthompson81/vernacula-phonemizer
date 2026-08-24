/**
 * SPANISH (es) Roman-numeral reading.
 * Ported from src/languages/spanish/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public static class RomanOrdinals
{
    private static readonly string[] UNITS =
        { "", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno" };
    private static readonly string[] TEENS =
    {
        "décimo", "undécimo", "duodécimo", "decimotercero", "decimocuarto",
        "decimoquinto", "decimosexto", "decimoséptimo", "decimoctavo", "decimonoveno",
    };
    private static readonly string[] TENS =
    {
        "", "", "vigésimo", "trigésimo", "cuadragésimo", "quincuagésimo",
        "sexagésimo", "septuagésimo", "octogésimo", "nonagésimo",
    };
    private static readonly string[] HUNDREDS =
    {
        "", "centésimo", "ducentésimo", "tricentésimo", "cuadringentésimo",
        "quingentésimo", "sexcentésimo", "septingentésimo", "octingentésimo", "noningentésimo",
    };

    /** Spanish masculine ordinal, 1 … 1000; `null` above that (a Roman-numeral year reads as a cardinal).
     *  Exposed so normalize.ts can reuse it for the ordinal INDICATORS (1º/1ª/1er) and for fractions. */
    public static string? SpanishOrdinal(int n)
    {
        if (n < 1 || n > 1000) return null;
        if (n == 1000) return "milésimo";
        if (n < 10) return UNITS[n];
        if (n < 20) return TEENS[n - 10];
        if (n < 100)
        {
            int t = n / 10, u = n % 10;
            return u == 0 ? TENS[t] : $"{TENS[t]} {UNITS[u]}";
        }
        int h = n / 100, r = n % 100;
        return r == 0 ? HUNDREDS[h] : $"{HUNDREDS[h]} {SpanishOrdinal(r)}";
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
