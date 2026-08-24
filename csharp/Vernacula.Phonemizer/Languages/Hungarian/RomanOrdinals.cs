/**
 * Hungarian Roman-numeral reading.
 * Ported from src/languages/hungarian/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hungarian;

public static class RomanOrdinals
{
    /**
     * Context nouns, UNANCHORED at the end because Hungarian is agglutinative: `század` must also match
     * században, századi, századtól, századok, századokban.
     *
     * ⚠ Spelled in both cases rather than matched case-insensitively: `OrdinalAfter` below shares this
     * alternation with a `\p{Lu}` test, and case-insensitive matching case-folds property escapes.
     */
    private static readonly string[] NOUNS =
    {
        "század",
        "évszázad",
        "évezred",
        "évfordul",
        "kerület",
        "kongresszus",
        "fejezet",
        "olimpi",
        "világháború",
    };
    private static string BothCases(string w) => $"[{w[..1].ToUpperInvariant()}{w[..1]}]{w[1..]}";
    private static readonly string NOUN_ALT = string.Join("|", NOUNS.Select(BothCases));
    private static readonly JsRe CONTEXT = JsRegex.Compile($"^(?:{NOUN_ALT})", "u");

    /** Integer → Hungarian ordinal (see numbers.ts). Named locally so the policy's shape stays readable. */
    private static string? Ordinal(int n) => n >= 1 ? Numbers.OrdinalWords(n) : null;

    /** This policy always supplies `ordinal`, which is optional on `RomanPolicy`. */
    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        /** A capitalised following word is the REGNAL pattern (`II. Erzsébet` → *második Erzsébet*). */
        OrdinalAfter = JsRegex.Compile($"^(?:{NOUN_ALT}|\\p{{Lu}})", "u"),
    };
}
