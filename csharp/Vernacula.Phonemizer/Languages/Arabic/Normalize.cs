/**
 * Arabic (ar and its varieties) text normalization — the pre-tokenizer pass for what the engine's number
 * tokenizer and the shared symbol tier do not already handle.
 * Ported from src/languages/arabic/normalize.ts — see that file for the corpus evidence.
 */

/** Arabic-Indic digits, both the standard and the extended (Persian/Urdu) ranges. */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Arabic;

public static class Normalize
{
    /** Arabic-Indic digits, both the standard and the extended (Persian/Urdu) ranges. */
    private static readonly JsRe ARABIC_DIGIT = JsRegex.Compile("[٠-٩۰-۹]", "gu");
    private const string DIGIT = "0-9٠-٩۰-۹";

    /** Arabic-Indic digit → ASCII. */
    private static string FoldDigit(string c)
    {
        var cp = Js.CodePointAt0(c);
        if (cp >= 0x0660 && cp <= 0x0669) return Js.NumberToString(cp - 0x0660); // ٠-٩
        if (cp >= 0x06f0 && cp <= 0x06f9) return Js.NumberToString(cp - 0x06f0); // ۰-۹
        return c;
    }

    /** Unit abbreviations → the full word, WRITTEN WITH HARAKAT. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["كم"] = "كِيلُومِتْر", ["سم"] = "سِنْتِيمِتْر", ["مم"] = "مِلِّيمِتْر", ["كجم"] = "كِيلُوجِرَام", ["جم"] = "جِرَام",
        ["كم/س"] = "كِيلُومِتْر فِي السَّاعَة",
    };
    private static readonly string UNIT_ALT = string.Join("|",
        new[] { "كم", "سم", "مم", "كجم", "جم", "كم/س" }.OrderByDescending(k => k.Length));

    private static readonly JsRe FARSI_YEH = JsRegex.Compile("ی", "gu");
    private static readonly JsRe KEHEH = JsRegex.Compile("ک", "gu");

    /** PERSO-ARABIC LETTERFORM VARIANTS → the Arabic codepoint for the same letter. */
    public static string FoldLetterforms(string input) =>
        KEHEH.Replace(FARSI_YEH.Replace(input, "ي"), "ك");

    private static readonly JsRe AR_PERCENT = JsRegex.Compile("٪", "gu");
    private static readonly JsRe AR_DECIMAL = JsRegex.Compile("٫", "gu");
    private static readonly JsRe AR_THOUSANDS = JsRegex.Compile("٬", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"([{DIGIT}])\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile($"([{DIGIT}])\\s?°\\s?C(?![\\p{{L}}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile($"([{DIGIT}])\\s?°\\s?F(?![\\p{{L}}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile($"([{DIGIT}])\\s?°", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        $"(الساعة\\s*)?(?<![{DIGIT}:])([{DIGIT}]{{1,2}}):([{DIGIT}]{{2}})(?![{DIGIT}:])", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile($"(^|[\\s(])[-−–]([{DIGIT}])", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile($"(\\S)\\+\\s?([{DIGIT}])", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile($"(^|\\s)\\+\\s?([{DIGIT}])", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe DIMENSION = JsRegex.Compile($"\\s*(?:×|(?<=[{DIGIT}])x)\\s*(?=[{DIGIT}])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile(
        $"(?<![{DIGIT}.,/])([{DIGIT}]{{1,3}})/([{DIGIT}]{{1,3}})(?![{DIGIT}/])", "gu");

    public static string NormalizeArabic(string input)
    {
        var s = FoldLetterforms(input);

        s = AR_THOUSANDS.Replace(AR_DECIMAL.Replace(AR_PERCENT.Replace(s, "%"), "."), ",");

        s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

        s = DEG_C.Replace(s, "$1 دَرَجَة مِئَوِيَّة");
        s = DEG_F.Replace(s, "$1 دَرَجَة فَهْرَنْهَايْت");
        s = DEG_BARE.Replace(s, "$1 دَرَجَة");

        s = CLOCK.Replace(s, m =>
        {
            var hv = Js.Number(string.Concat(Js.CodePoints(m.Groups[2].Value).Select(FoldDigit)));
            var mv = Js.Number(string.Concat(Js.CodePoints(m.Groups[3].Value).Select(FoldDigit)));
            if (hv > 23 || mv > 59) return m.Value;
            var head = m.Groups[1].Success ? m.Groups[1].Value : "السَّاعَة ";
            return mv == 0
                ? $"{head}{Js.NumberToString(hv)}"
                : $"{head}{Js.NumberToString(hv)} وَ {Js.NumberToString(mv)} دَقِيقَة";
        });

        s = MINUS.Replace(s, "$1نَاقِص $2");
        s = PLUS_MINUS.Replace(s, " زَائِد نَاقِص ");
        s = PLUS_ATTACHED.Replace(s, "$1 زَائِد $2");
        s = PLUS_LEADING.Replace(s, "$1زَائِد $2");

        s = EQUALS_RE.Replace(s, " يُسَاوِي ");
        s = LESS_THAN.Replace(s, " أَصْغَر مِن ");
        s = GREATER_THAN.Replace(s, " أَكْبَر مِن ");
        s = DIVIDE.Replace(s, " مَقْسُوم عَلَى ");

        s = DIMENSION.Replace(s, " في ");

        s = FRACTION.Replace(s, m => $"{m.Groups[1].Value} عَلَى {m.Groups[2].Value}");

        return ARABIC_DIGIT.Replace(s, m => FoldDigit(m.Value));
    }
}
