/**
 * Romanian Roman-numeral reading — ORDINAL, in the `al …-lea` construction.
 * Ported from src/languages/romanian/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Romanian;

public static class RomanOrdinals
{
    private static readonly JsRe VOWEL_FINAL = JsRegex.Compile("[aeiouăâîy]$", "u");

    /** Romanian masculine/neuter ordinal (`al …-lea`) for any n a Roman numeral can encode. */
    public static string? RomanianOrdinal(int n)
    {
        if (n < 1) return null;
        if (n == 1) return "întâi"; // secolul I = secolul întâi; there is no *al unulea*
        var card = RomanianPhonemizer.NumberWords(n, stem: true);
        var words = card.Split(' ').ToList();
        var last = words[^1];
        words[^1] = VOWEL_FINAL.IsMatch(last) ? $"{last}lea" : $"{last}ulea";
        return $"al {string.Join(" ", words)}";
    }

    /** This policy always supplies `ordinal`, which is optional on `RomanPolicy`. */
    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Exclude = Roman.ROMAN_EXCLUSIONS["ro"], // "vii" = alive/vines — preserved here so the wiring cannot drop it
        Ordinal = RomanianOrdinal,
        /** Noun BEFORE the numeral: century nouns, enumeration heads, and male regnal given names. */
        OrdinalBefore = JsRegex.Compile(
            "^(secolul|secolele|secolelor|secole|secol|mileniul|mileniile|capitolul|volumul|tomul|cântul|actul|articolul|paragraful|regele|papa|împăratul|țarul|sultanul|carol|mihai|ferdinand|alexandru|constantin|nicolae|ștefan|mircea|vlad|petru|radu|iancu|ioan|paul|pius|benedict|francisc|leon|grigore|clement|inocențiu|urban|sixt|celestin|adrian|bonifaciu|honoriu|ludovic|filip|henric|frederic|wilhelm|george|eduard|iacob|richard|alfons|iosif|leopold|maximilian|otto|napoleon|petre)$",
            "iu"),
        /** Noun AFTER the numeral. */
        OrdinalAfter = JsRegex.Compile("^(secol|secole|aniversar|congres|campionat|volum|capitol|articol)$", "iu"),
    };
}
