/**
 * CATALAN (ca) Roman-numeral reading — the PRENOMINAL ordinal, which Optimot marks as ordinal at any value.
 * Ported from src/languages/catalan/romanOrdinals.ts — see that file for the sources and the scope argument.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Catalan;

public static class RomanOrdinals
{
    /** Catalan masculine ordinal for any n a Roman numeral can encode. ⚠ THE SAME COMPOSITOR AS THE DIGIT
     *  ORDINAL (`21è`), not a second one (#1533): the two used to disagree on 21–99. */
    public static string? CatalanOrdinal(int n) => Normalize.OrdinalWords(n, false);

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = CatalanOrdinal,
        /** Noun AFTER the numeral — Optimot's prenominal case, ordinal at any value. Masculine nouns only. */
        OrdinalAfter = JsRegex.Compile(
            "^(aniversari|centenari|congrés|congres|encontre|festival|campionat|certamen|concurs|premi|saló|salo|simposi|col·loqui|seminari|torneig|cicle|volum|capítol|capitol|cant|acte|article|batalló|regiment|govern)$",
            "iu"),
    };
}
