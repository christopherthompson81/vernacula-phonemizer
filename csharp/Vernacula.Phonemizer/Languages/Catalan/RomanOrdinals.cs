/**
 * CATALAN (ca) Roman-numeral reading — the PRENOMINAL ordinal, which Optimot marks as ordinal at any value.
 * Ported from src/languages/catalan/romanOrdinals.ts — see that file for the sources and the scope argument.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Catalan;

public static class RomanOrdinals
{
    /** 1–10; *primer/segon/tercer/quart* and *desè* are not derivable from the cardinal. */
    private static readonly IReadOnlyDictionary<int, string> IRREGULAR = new Dictionary<int, string>
    {
        [1] = "primer", [2] = "segon", [3] = "tercer", [4] = "quart", [5] = "cinquè",
        [6] = "sisè", [7] = "setè", [8] = "vuitè", [9] = "novè", [10] = "desè",
    };

    private static readonly JsRe FINAL_VOWEL = JsRegex.Compile("[aeiou]$", "u");

    /** Cardinal final word → its ordinal stem, where `-è` cannot simply be appended. */
    private static string OrdinalizeWord(string w)
    {
        if (w.EndsWith("cinc", StringComparison.Ordinal)) return $"{w[..^1]}què";
        if (w.EndsWith("nou", StringComparison.Ordinal)) return $"{w[..^1]}vè";
        if (w.EndsWith("deu", StringComparison.Ordinal)) return $"{w[..^1]}sè";
        if (w == "cents") return "centè";
        if (FINAL_VOWEL.IsMatch(w)) return $"{w[..^1]}è";
        return $"{w}è";
    }

    /** Catalan masculine ordinal for any n a Roman numeral can encode. */
    public static string? CatalanOrdinal(int n)
    {
        if (n < 1) return null;
        if (IRREGULAR.TryGetValue(n, out var irr)) return irr;
        var words = Numbers.NumberToWords(n).Split(' ');
        words[^1] = OrdinalizeWord(words[^1]);
        return string.Join(" ", words);
    }

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = CatalanOrdinal,
        /** Noun AFTER the numeral — Optimot's prenominal case, ordinal at any value. Masculine nouns only. */
        OrdinalAfter = JsRegex.Compile(
            "^(aniversari|centenari|congrés|congres|encontre|festival|campionat|certamen|concurs|premi|saló|salo|simposi|col·loqui|seminari|torneig|cicle|volum|capítol|capitol|cant|acte|article|batalló|regiment|govern)$",
            "iu"),
    };
}
