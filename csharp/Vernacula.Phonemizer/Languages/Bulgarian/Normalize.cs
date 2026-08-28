/**
 * Bulgarian (bg) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Bulgarian g2p
 * cannot already read into Bulgarian words the existing pipeline speaks.
 * Ported from src/languages/bulgarian/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Bulgarian;

public static class Normalize
{
    /** Unit abbreviations → the COUNTING form of the word (the form Bulgarian uses after a numeral). */
    private static readonly (string Abbr, string Word)[] UNITS =
    {
        ("км", "километра"), ("кг", "килограма"), ("см", "сантиметра"), ("мм", "милиметра"),
        ("km", "километра"), ("kg", "килограма"), ("cm", "сантиметра"), ("mm", "милиметра"),
        ("м", "метра"), ("г", "грама"),
    };

    /** Squared / cubed units. Bulgarian PREPOSES the modifier as a separate adjective — `квадратни
     *  километра`, unlike Romanian's postposed `kilometri pătrați` and the Germanic single-word compound. */
    private static readonly (JsRe Re, string Word)[] SQUARED =
    {
        (JsRegex.Compile("(?<!\\p{L})(?:км|km)\\s*[²2](?!\\d)", "giu"), "квадратни километра"),
        (JsRegex.Compile("(?<!\\p{L})м\\s*[²2](?!\\d)", "giu"), "квадратни метра"),
        (JsRegex.Compile("(?<!\\p{L})(?:км|km)\\s*[³3](?!\\d)", "giu"), "кубични километра"),
        (JsRegex.Compile("(?<!\\p{L})м\\s*[³3](?!\\d)", "giu"), "кубични метра"),
    };

    /** Currency sign → the counting form. */
    private static readonly (string Sign, string Word)[] CURRENCY =
    {
        ("$", "долара"), ("€", "евро"), ("£", "паунда"), ("¥", "йени"),
    };

    /** Relational and operator signs, read in every position — a dropped sign is inaudible. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    {
        (JsRegex.Compile("±", "gu"), " плюс минус "),
        (JsRegex.Compile("≈", "gu"), " приблизително равно на "),
        (JsRegex.Compile("≤", "gu"), " по-малко или равно на "),
        (JsRegex.Compile("≥", "gu"), " по-голямо или равно на "),
        (JsRegex.Compile("=", "gu"), " равно на "),
        (JsRegex.Compile("<", "gu"), " по-малко от "),
        (JsRegex.Compile(">", "gu"), " по-голямо от "),
        (JsRegex.Compile("×|(?<=\\p{Nd})[ \\t]?x[ \\t]?(?=\\p{Nd})", "gu"), " по "),
        (JsRegex.Compile("÷", "gu"), " делено на "),
    };

    private static readonly JsRe YEAR_G = JsRegex.Compile("(\\d)\\s*г\\.", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile("пр\\.\\s*н\\.\\s*е\\.", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("сл\\.\\s*н\\.\\s*е\\.", "giu");
    private static readonly JsRe RATE_KM_H = JsRegex.Compile("(?<!\\p{L})км\\s*\\/\\s*ч(?!\\p{L})", "giu");
    private static readonly JsRe RATE_PER_HOUR = JsRegex.Compile("(\\p{L}+)\\s*\\/\\s*час(?!\\p{L})", "giu");
    private static readonly JsRe RATE_M_S = JsRegex.Compile("(?<!\\p{L})м\\s*\\/\\s*(?:сек|с)(?!\\p{L})", "giu");
    private static readonly JsRe RATE_KM_H_LAT = JsRegex.Compile("(?<!\\p{L})km\\s*\\/\\s*h(?!\\p{L})", "giu");
    private static readonly JsRe RATE_M_S_LAT = JsRegex.Compile("(?<!\\p{L})m\\s*\\/\\s*s(?!\\p{L})", "giu");
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile("(?<=\\d)(?<!(?<![\\d\\.,])0)[ \u00a0\u202f\u2009](?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d+),(\\d+)", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(\\d{1,2}):(\\d{2})(?!\\d)", "gu");
    private static readonly JsRe NUMERO = JsRegex.Compile("№\\s?(?=\\d)", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+)\\s*%", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("℉", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s*°\\s*C(?!\\p{L})", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s*°\\s*F(?!\\p{L})", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s*°", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![-–—])(\\d+)\\s*[-–—]\\s*(\\d+)(?!\\d)(?!\\s*[-–—]\\s*\\d)", "gu");
    private static readonly JsRe SIGNED = JsRegex.Compile("(?<![\\p{L}\\d])([-−+])(\\d+)", "gu");
    private static readonly JsRe PLUS_INFIX = JsRegex.Compile("(\\d)\\s*\\+\\s*(\\d)", "gu");
    private static readonly JsRe AMP = JsRegex.Compile("\\s*[&＆]\\s*", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[ \\t]{2,}", "gu");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");

    private static readonly List<(JsRe Re, string Word)> UNIT_RES = UNITS
        .Select(u => (JsRegex.Compile($"(\\d)\\s*{u.Abbr}(?!\\p{{L}})", "gu"), $"$1 {u.Word}"))
        .ToList();
    private static readonly List<(JsRe Before, JsRe After, string Word)> CURRENCY_RES = CURRENCY
        .Select(c =>
        {
            var esc = ESCAPE.Replace(c.Sign, "\\$&");
            return (JsRegex.Compile($"{esc}\\s*(\\d+)", "gu"), JsRegex.Compile($"(\\d+)\\s*{esc}", "gu"), c.Word);
        })
        .ToList();

    public static string NormalizeBulgarian(string input)
    {
        var t = input;

        t = Rewrite(t, YEAR_G, "$1 година");

        t = Rewrite(t, ERA_BC, "преди новата ера");
        t = Rewrite(t, ERA_AD, "след новата ера");

        t = Rewrite(t, RATE_KM_H, "километра в час");
        t = Rewrite(t, RATE_PER_HOUR, "$1 в час");
        t = Rewrite(t, RATE_M_S, "метра в секунда");
        t = Rewrite(t, RATE_KM_H_LAT, "километра в час");
        t = Rewrite(t, RATE_M_S_LAT, "метра в секунда");

        string prev;
        do
        {
            prev = t;
            t = Rewrite(t, SPACE_GROUP, "");
        } while (t != prev);

        t = Rewrite(t, DECIMAL, m =>
            $"{m.Groups[1].Value} цяло и {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        t = Rewrite(t, CLOCK, "$1 $2");

        t = Rewrite(t, NUMERO, "номер ");

        t = Rewrite(t, PERCENT, "$1 процента");

        t = Rewrite(Rewrite(t, DEG_C_SIGN, "°C"), DEG_F_SIGN, "°F");
        t = Rewrite(t, DEG_C, "$1 градуса по Целзий");
        t = Rewrite(t, DEG_F, "$1 градуса по Фаренхайт");
        t = Rewrite(t, DEG, "$1 градуса");

        foreach (var (re, word) in SQUARED) t = Rewrite(t, re, word);

        foreach (var (re, replacement) in UNIT_RES) t = Rewrite(t, re, replacement);

        t = Rewrite(t, RANGE, "$1 до $2");

        foreach (var (before, after, word) in CURRENCY_RES)
        {
            t = Rewrite(t, before, $"$1 {word}");
            t = Rewrite(t, after, $"$1 {word}");
        }

        t = Rewrite(t, SIGNED, m => $"{(m.Groups[1].Value == "+" ? "плюс" : "минус")} {m.Groups[2].Value}");

        t = Rewrite(t, PLUS_INFIX, "$1 плюс $2");
        foreach (var (re, word) in RELATIONAL) t = Rewrite(t, re, word);

        t = Rewrite(t, AMP, " и ");

        return Rewrite(t, MULTI_SPACE, " ");
    }
}
