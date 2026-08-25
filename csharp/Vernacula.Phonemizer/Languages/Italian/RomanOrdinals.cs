/**
 * ITALIAN (it) Roman-numeral reading — ORDINAL.
 * Ported from src/languages/italian/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Italian;

public static class RomanOrdinals
{
    /** 1–10: not derivable from the cardinal (primo ≠ uno-esimo). */
    /** 1–10 (italian.jsonc `ordinals`): not derivable from the cardinal (primo ≠ uno-esimo). Everything
     *  above 10 is composed from the cardinal below, which is why the manifest carries only this head. */
    private static IReadOnlyDictionary<string, string> IRREGULAR => ItalianPhonemizer.DEF.Ordinals;

    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[aeiou]$", "u");

    /**
     * Italian masculine ordinal for any n a Roman numeral can encode, or `undefined` where we decline to
     * guess.
     */
    public static string? ItalianOrdinal(int n)
    {
        if (n < 1) return null;
        if (IRREGULAR.TryGetValue(Js.NumberToString(n), out var irr)) return irr;
        var card = ItalianPhonemizer.NumberWords(n);
        if (card.Contains(' ')) return null; // millions split into words (un milione …) — not worth guessing
        if (card.EndsWith("tré", StringComparison.Ordinal)) return $"{card[..^1]}eesimo"; // ventitré → ventitreesimo
        if (card.EndsWith("sei", StringComparison.Ordinal)) return $"{card}esimo"; // ventisei → ventiseiesimo
        if (card.EndsWith("mila", StringComparison.Ordinal)) return $"{card[..^4]}millesimo"; // duemila → duemillesimo
        if (ENDS_VOWEL.IsMatch(card)) return $"{card[..^1]}esimo"; // venti → ventesimo
        return $"{card}esimo";
    }

    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = ItalianOrdinal,
        /** Noun BEFORE the numeral. MASCULINE heads only — a feminine head would need `-esima`, so adding
         *  one here yields a wrong-gender ordinal rather than the cardinal fallback. */
        OrdinalBefore = JsRegex.Compile(
            "^(secolo|secoli|capitolo|capitoli|libro|volume|tomo|canto|atto|articolo|paragrafo|allegato|papa|re|imperatore|zar|sultano|antipapa|beato|san|santo|giovanni|paolo|pio|benedetto|francesco|leone|gregorio|clemente|innocenzo|urbano|alessandro|sisto|celestino|adriano|callisto|bonifacio|onorio|eugenio|martino|niccolò|nicola|stefano|giulio|silvestro|pasquale|lucio|luigi|carlo|alberto|enrico|filippo|ferdinando|emanuele|umberto|napoleone|federico|guglielmo|giorgio|edoardo|giacomo|riccardo|alfonso|pietro|giuseppe|leopoldo|massimiliano|ottone|corrado|ludovico|amedeo|gustavo|cristiano|solimano|ramses|tolomeo)$",
            "iu"),
        /**
         * Noun AFTER the numeral — the dominant Italian order for centuries (`XIX secolo`) and for event
         * names (`XL anniversario`, `XXV congresso`), which is precisely where the range is NOT bounded by
         * the century: `L anniversario` is *cinquantesimo anniversario*. Masculine nouns only.
         */
        OrdinalAfter = JsRegex.Compile(
            "^(secolo|secoli|anniversario|congresso|convegno|simposio|campionato|festival|premio|concorso|raduno|torneo|centenario|capitolo|volume|libro|tomo|canto|atto|articolo|emendamento|reggimento|governo)$",
            "iu"),
    };
}
