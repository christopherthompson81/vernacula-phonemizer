/**
 * Belarusian Roman-numeral reading — a century is read as a NEUTER ordinal (стагоддзе is neuter), so the
 * table is *-ае*, not *-ы*; the unit table's words come from the masculine ordinals in Normalize.cs and
 * only the ending differs.
 * Ported from src/languages/belarusian/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Belarusian;

public static class RomanOrdinals
{
    /** Cardinal tens, read from the language's own number data (belarusian.jsonc): дваццаць, трыццаць, сорак, … */
    private static IReadOnlyDictionary<string, string> TENS_CARDINAL => Manifest.DEF.Numbers.Tens;

    /** 1–19, NEUTER nominative. */
    private static readonly string[] ORD_1_19 =
    [
        "", "першае", "другое", "трэцяе", "чацвёртае", "пятае", "шостае", "сёмае", "восьмае", "дзявятае",
        "дзясятае", "адзінаццатае", "дванаццатае", "трынаццатае", "чатырнаццатае", "пятнаццатае",
        "шаснаццатае", "сямнаццатае", "васямнаццатае", "дзевятнаццатае",
    ];

    /** Whole tens, NEUTER nominative — own stems (саракавое, дзевяностае). */
    private static readonly string[] ORD_TENS =
    [
        "", "дзясятае", "дваццатае", "трыццатае", "саракавое", "пяцідзясятае", "шасцідзясятае",
        "сямідзясятае", "васьмідзясятае", "дзевяностае",
    ];

    /**
     * Integer → the Belarusian ordinal, neuter nominative. Like Russian and Ukrainian (and unlike Polish)
     * only the LAST element inflects above 20; `null` above 100 falls back to the cardinal.
     */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return "сотае";
        if (n < 20) return ORD_1_19[n];
        int t = n / 10, u = n % 10;
        if (u == 0) return ORD_TENS[t];
        // ⚠ A MISSING TENS KEY IS `undefined` IN JS, not a throw: the TS reads `TENS_CARDINAL[String(t * 10)]`
        // and returns `undefined` when the table has no such key, so the caller falls back to the cardinal.
        return TENS_CARDINAL.TryGetValue(Js.NumberToString(t * 10), out var tens) ? $"{tens} {ORD_1_19[u]}" : null;
    }

    /**
     * The nouns a Roman numeral is read as an ordinal next to — стагоддзе in the cases that occur, the bare
     * abbreviations `ст.` / `стст.` (this pass runs at the registry seam and sees the RAW input), гадавіна
     * and з'езд. `век` is excluded on purpose — the table is neuter and `век` is masculine.
     */
    private static readonly JsRe CONTEXT =
        JsRegex.Compile("^(ст|стст|стагодд(зе|зя|зю|зі|зем|зяў|зях|зямі)|гадавін(а|ы|е|у|ай)|з[\u2019'`]езд(а|у|ам|ы|аў)?)$", "iu");

    /** This policy always supplies `ordinal`, which is optional on `RomanPolicy`. */
    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
