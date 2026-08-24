/**
 * Russian Roman-numeral reading.
 * Ported from src/languages/russian/romanOrdinals.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Russian;

public static class RomanOrdinals
{
    /** Cardinal tens, reused from the language's own number data (russian.jsonc): двадцать, тридцать, … */
    private static IReadOnlyList<string> TENS_CARDINAL => Manifest.MANIFEST.Numbers.Tens;

    /** 1–19 — irregular stems throughout (первый … четвёртый), so a table, not a rule. */
    private static readonly string[] ORD_1_19 =
    {
        "", "первый", "второй", "третий", "четвёртый", "пятый", "шестой", "седьмой", "восьмой", "девятый",
        "десятый", "одиннадцатый", "двенадцатый", "тринадцатый", "четырнадцатый", "пятнадцатый",
        "шестнадцатый", "семнадцатый", "восемнадцатый", "девятнадцатый",
    };

    /** Whole tens — their own stems (сороковой, пятидесятый), not derivable from the cardinal. */
    private static readonly string[] ORD_TENS =
    {
        "", "десятый", "двадцатый", "тридцатый", "сороковой", "пятидесятый", "шестидесятый", "семидесятый",
        "восьмидесятый", "девяностый",
    };

    /** Integer → Russian ordinal, masculine nominative. */
    public static string? RussianOrdinal(int n)
    {
        if (n < 1 || n > 100) return null;
        if (n == 100) return "сотый";
        if (n < 20) return ORD_1_19[n];
        int t = n / 10, u = n % 10;
        return u == 0 ? ORD_TENS[t] : $"{TENS_CARDINAL[t]} {ORD_1_19[u]}";
    }

    /** Century noun in the cases that occur, plus the two ordinal-taking count nouns (годовщина, съезд). */
    private static readonly JsRe CONTEXT = JsRegex.Compile(
        "^(век(а|е|у|ом|ов|ам|ах|ами)?|столети(е|я|и|ю|ем|й|ям|ях|ями)|годовщин(а|ы|е|у|ой|ам|ах)?|съезд(а|е|у|ом|ы|ов|ам|ах)?)$",
        "iu");

    /** Russian writes `XIX век` (numeral first) as the norm; `век XIX` occurs in reference lists. */
    public static readonly RomanPolicy ROMAN_POLICY = new()
    {
        Ordinal = RussianOrdinal,
        OrdinalBefore = CONTEXT,
        OrdinalAfter = CONTEXT,
    };
}
