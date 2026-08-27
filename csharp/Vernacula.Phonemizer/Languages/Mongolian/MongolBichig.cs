/**
 * Traditional Mongolian script (Mongol bichig) → Cyrillic FRONT-END: each glyph to its Cyrillic base reading,
 * plus the classical→modern contraction (intervocalic ⟨г⟩ deletes and the vowels coalesce), so the existing
 * Cyrillic segmental/harmony/reduction machinery is reused rather than duplicated.
 * Ported from src/languages/mongolian/mongolBichig.ts — see that file for the historical-orthography argument.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mongolian;

public static class MongolBichig
{
    private static readonly Dictionary<string, string> GLYPH = new()
    {
        ["ᠠ"] = "а", ["ᠡ"] = "э", ["ᠢ"] = "и", ["ᠣ"] = "о", ["ᠤ"] = "у", ["ᠥ"] = "ө", ["ᠦ"] = "ү",
        ["ᠧ"] = "э",
        ["ᠨ"] = "н", ["ᠩ"] = "н",
        ["ᠪ"] = "б", ["ᠫ"] = "п", ["ᠬ"] = "х", ["ᠭ"] = "г", ["ᠮ"] = "м", ["ᠯ"] = "л",
        ["ᠰ"] = "с", ["ᠱ"] = "ш", ["ᠲ"] = "т", ["ᠳ"] = "д", ["ᠴ"] = "ч", ["ᠵ"] = "ж",
        ["ᠶ"] = "й", ["ᠷ"] = "р", ["ᠸ"] = "в", ["ᠹ"] = "ф", ["ᠺ"] = "к", ["ᠻ"] = "х",
        ["ᠼ"] = "ц", ["ᠽ"] = "з", ["ᠾ"] = "х",
    };

    /** Joiners, MVS, free-variation selectors, NNBSP — no phonemic value. */
    private static readonly JsRe IGNORE = JsRegex.Compile("[\\u180B-\\u180E\\u200C\\u200D\\u202f]", "gu");

    private static readonly JsRe CONTRACTION = JsRegex.Compile("([аэиоуөү])г([аэиоуөү])", "gu");

    /** Transliterate a Mongol-bichig word to Cyrillic (base readings) + the contraction rule. A non-bichig
     *  char is passed through unchanged, not dropped. */
    public static string BichigToCyrillic(string word)
    {
        var cyr = "";
        foreach (var ch in Js.CodePoints(IGNORE.Replace(word, "")))
            cyr += GLYPH.TryGetValue(ch, out var g) ? g : ch;
        // V г V → the doubled second vowel; looped to stability for multiple intervocalic ⟨г⟩.
        string prev;
        do { prev = cyr; cyr = CONTRACTION.Replace(cyr, m => m.Groups[2].Value + m.Groups[2].Value); }
        while (cyr != prev);
        return cyr;
    }

    private static readonly JsRe BICHIG = JsRegex.Compile("[ᠠ-ᡂ]", "u");

    /** Is this string in the traditional Mongolian script block (so it needs the bichig front-end)? */
    public static bool IsBichig(string s) => BICHIG.IsMatch(s);
}
