/**
 * Ukrainian Roman-numeral reading.
 * Ported from src/languages/ukrainian/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

public static class RomanOrdinals
{
    /** Cardinal tens, read from the language's own number data (ukrainian.jsonc): двадцять, тридцять, … */
    private static IReadOnlyDictionary<string, string> TENS_CARDINAL => Manifest.DEF.Numbers.Tens;

    /** 1–19, NEUTER nominative. Irregular stems (перше, друге, третє, четверте) → table. Apostrophe is U+0027,
     *  matching the orthography used in ukrainian.jsonc (дев'ять, п'ять). */
    private static readonly string[] ORD_1_19 =
    {
        "", "перше", "друге", "третє", "четверте", "п'яте", "шосте", "сьоме", "восьме", "дев'яте",
        "десяте", "одинадцяте", "дванадцяте", "тринадцяте", "чотирнадцяте", "п'ятнадцяте", "шістнадцяте",
        "сімнадцяте", "вісімнадцяте", "дев'ятнадцяте",
    };

    /** Whole tens, NEUTER nominative — own stems (сорокове, дев'яносте). */
    private static readonly string[] ORD_TENS =
    {
        "", "десяте", "двадцяте", "тридцяте", "сорокове", "п'ятдесяте", "шістдесяте", "сімдесяте",
        "вісімдесяте", "дев'яносте",
    };

    /** Integer → Ukrainian ordinal, neuter nominative. */
    public static string? Ordinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return "соте";
        if (n < 20) return ORD_1_19[n];
        int t = n / 10, u = n % 10;
        if (u == 0) return ORD_TENS[t];
        // ⚠ A MISSING TENS KEY IS `undefined` IN JS, not a throw: the TS reads `TENS_CARDINAL[String(t * 10)]`
        // and returns `undefined` when the table has no such key, so the caller falls back to the cardinal.
        // `Dictionary`'s indexer would throw instead, which is a different behaviour at the same input.
        return TENS_CARDINAL.TryGetValue(Js.NumberToString(t * 10), out var tens) ? $"{tens} {ORD_1_19[u]}" : null;
    }

    /**
     * століття / сторіччя in the cases that occur (nom-gen-acc -я, dat -ю, loc -і, instr -ям, loc pl -ях,
     * instr pl -ями, gen pl століть / сторіч), plus річниця and з'їзд. вік is excluded on purpose.
     */
    private static readonly JsRe CONTEXT = JsRegex.Compile(
        "^(століт(тя|тю|ті|тям|тях|тями|ь)|сторіч(чя|чю|чі|чям|чях|чями|)|річниц(я|і|ю|ею|ям|ях)|з'їзд(у|і|ом|и|ів|ам|ах)?)$",
        "iu");

    /** This policy always supplies `ordinal`, which is optional on `RomanPolicy`. */
    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = Ordinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
