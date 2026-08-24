/**
 * Urdu (ur) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/urdu/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Urdu;

public static class Normalize
{
    /** Arabic-Indic digits, both ranges, folded to ASCII so one representation reaches every rule. */
    private static readonly JsRe ARABIC_DIGIT = JsRegex.Compile("[٠-٩۰-۹]", "gu");

    private static string FoldDigit(string c)
    {
        var cp = Js.CodePointAt0(c);
        if (cp >= 0x0660 && cp <= 0x0669) return Js.NumberToString(cp - 0x0660);
        if (cp >= 0x06f0 && cp <= 0x06f9) return Js.NumberToString(cp - 0x06f0);
        return c;
    }

    /** Ordinal suffixes. */
    private static readonly IReadOnlyDictionary<string, int> SUFFIX_FORM = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["واں"] = 0, ["وان"] = 0, ["ویں"] = 1, ["وین"] = 1,
    };
    private static readonly IReadOnlyDictionary<int, string[]> IRREGULAR = new Dictionary<int, string[]>
    {
        [1] = new[] { "پہلا", "پہلی" },
        [2] = new[] { "دوسرا", "دوسری" },
        [3] = new[] { "تیسرا", "تیسری" },
        [4] = new[] { "چوتھا", "چوتھی" },
        [6] = new[] { "چھٹا", "چھٹی" },
    };

    /** Unit abbreviations and the SPACED spelling `کلو میٹر`, which read as two words ([kˈəlluː mˈiːʈəɾ]). */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["کلو میٹر"] = "کلومیٹر", ["کلو گرام"] = "کلوگرام", ["سینٹی میٹر"] = "سینٹیمیٹر", ["ملی میٹر"] = "ملیمیٹر",
        ["کلومیٹر/گھنٹہ"] = "کلومیٹر فی گھنٹہ",
    };
    private static readonly string UNIT_ALT = string.Join("|", UNIT_WORD.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe AR_PERCENT = JsRegex.Compile("٪", "gu");
    private static readonly JsRe AR_DECIMAL = JsRegex.Compile("٫", "gu");
    private static readonly JsRe AR_THOUSANDS = JsRegex.Compile("٬", "gu");
    private static readonly JsRe AR_COMMA_GROUP = JsRegex.Compile("(\\d)،(\\d{3})(?!\\d)", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile(
        $"(?<![\\d.,])(\\d+)\\s?({string.Join("|", SUFFIX_FORM.Keys)})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe UNIT_RE = JsRegex.Compile($"(\\d)\\s?({UNIT_ALT})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}])", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile(
        "(?<![\\d:])([01]?\\d|2[0-3])\\s?:\\s?([0-5]\\d)(?![\\d:])(?!,\\d)(\\s*بجے)?", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d.,/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");

    /** Build the Urdu normalizer. Takes the numbers definition so ordinals compose the same cardinal words the
     *  engine's own number path uses. */
    public static Func<string, string> MakeUrduNormalizer(NumbersDef numbers)
    {
        List<string> Cardinal(double n) =>
            Core.Numbers.indicNumberWords(n, numbers).Select(w => w ?? "").ToList();

        string? Ordinal(double n, int form, string suffix)
        {
            if (IRREGULAR.TryGetValue((int)n, out var irr)) return irr[form];
            var words = Cardinal(n);
            if (words.Count == 0 || words.Any(w => w == "")) return null;
            words[^1] = $"{words[^1]}{suffix}";
            return string.Join(" ", words);
        }

        return input =>
        {
            var s = ARABIC_DIGIT.Replace(input, m => FoldDigit(m.Value));

            s = AR_THOUSANDS.Replace(AR_DECIMAL.Replace(AR_PERCENT.Replace(s, "%"), "."), ",");
            s = AR_COMMA_GROUP.Replace(s, "$1,$2");

            s = ORDINAL_RE.Replace(s, m =>
                Ordinal(Js.Number(m.Groups[1].Value), SUFFIX_FORM[m.Groups[2].Value], m.Groups[2].Value) ?? m.Value);

            s = UNIT_RE.Replace(s, m => $"{m.Groups[1].Value} {UNIT_WORD[m.Groups[2].Value]}");

            s = DEG_C.Replace(s, "$1 ڈگری سینٹی گریڈ");
            s = DEG_F.Replace(s, "$1 ڈگری فارن ہائیٹ");
            s = DEG.Replace(s, "$1 ڈگری");

            s = CLOCK.Replace(s, m =>
            {
                var hv = Js.Number(m.Groups[1].Value);
                var mv = Js.Number(m.Groups[2].Value);
                var hw = string.Join(" ", Cardinal(hv));
                if (hw == "") return m.Value;
                var baje = m.Groups[3].Success ? m.Groups[3].Value : null;
                if (mv == 0) return $"{hw}{baje ?? " بجے"}";
                return $"{hw} بج کر {string.Join(" ", Cardinal(mv))} منٹ";
            });

            s = MINUS.Replace(s, "$1منفی $2");
            s = PLUS_ATTACHED.Replace(s, "$1 جمع $2");
            s = PLUS_LEADING.Replace(s, "$1جمع $2");

            s = PostposedSignPass.PostposedSign(s, "<", "سے کم");
            s = PostposedSignPass.PostposedSign(s, ">", "سے زیادہ");
            s = EQUALS_RE.Replace(s, " برابر ");
            s = DIVIDE.Replace(s, " تقسیم ");

            s = FRACTION.Replace(s, m =>
            {
                var num = Js.Number(m.Groups[1].Value);
                var den = Js.Number(m.Groups[2].Value);
                if (num == 1 && den == 2) return "آدھا";
                var nw = string.Join(" ", Cardinal(num));
                var dw = string.Join(" ", Cardinal(den));
                return nw == "" || dw == "" ? m.Value : $"{nw} بٹا {dw}";
            });

            return s;
        };
    }
}
