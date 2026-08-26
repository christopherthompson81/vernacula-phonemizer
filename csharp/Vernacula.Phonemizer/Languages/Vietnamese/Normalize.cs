/**
 * Vietnamese (vi) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable Vietnamese syllable into Vietnamese words the pipeline speaks.
 * Ported from src/languages/vietnamese/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Vietnamese;

public static class Normalize
{
    /** Vietnamese-native abbreviations, expanded to their spoken form. ⚠ LONGEST KEY FIRST, so CNTT is
     *  consumed before a shorter prefix could claim part of it — the array order is the rule order. */
    private static readonly (string From, string To)[] VI_ABBREV =
    {
        ("CNTT", "công nghệ thông tin"),
        ("TCN", "trước Công nguyên"),
        ("SCN", "sau Công nguyên"),
    };

    /** ⚠ `\b` is ASCII-defined and mis-fires against Vietnamese's precomposed diacritics (Tây, đầy). Every
     *  letter-edge guard in this file is an explicit lookaround over `\p{L}\p{M}` instead. */
    private const string NL = "(?![\\p{L}\\p{M}])";
    private const string NLB = "(?<![\\p{L}\\p{M}])";

    private static readonly JsRe DOT_G = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe COMMA_ONE = JsRegex.Compile(",", "u");
    private static readonly JsRe COMMA_G = JsRegex.Compile(",", "gu");

    /** Value of a possibly grouped / comma-decimal Vietnamese numeral, for the ascending test at step 7. */
    private static double NumVal(string s) =>
        Js.Number(JsRegex.Replace(JsRegex.Replace(s, DOT_G, _ => ""), COMMA_ONE, _ => "."));

    /** `HH:MM` → the Vietnamese clock, `H giờ M`. Zero minutes are dropped: 12:00 is "mười hai giờ", never
     *  "…giờ không". A leading zero is not spoken, so `07` → `7` and the cardinal compositor says "bảy". */
    private static string Clock(string hh, string mm) =>
        $"{Js.NumberToString(Js.Number(hh))} giờ" +
        (Js.Number(mm) == 0 ? "" : $" {Js.NumberToString(Js.Number(mm))}");

    // The step patterns. The TS builds several inline; JsRegex.Compile caches, so hoisting them here is a
    // readability choice and not a behaviour one.
    private static readonly JsRe SUP2 = JsRegex.Compile("<sup>\\s*2\\s*<\\/sup>", "giu");
    private static readonly JsRe ANY_TAG = JsRegex.Compile("<[^>]*>", "gu");
    private static readonly JsRe CLOCK_RANGE = JsRegex.Compile("((?<!\\d)\\d{1,2}:[0-5]\\d)\\s*[-–—]\\s*(\\d{1,2}:[0-5]\\d(?!\\d))", "gu");
    private static readonly JsRe SPORTS_TIME = JsRegex.Compile($"(?<!\\d)(\\d{{1,2}}):([0-5]\\d),(\\d{{1,2}})(?!\\d)(\\s+phút{NL})?", "gu");
    private static readonly JsRe CLOCK_RE = JsRegex.Compile($"(?<![\\d:])([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!,\\d)(\\s+giờ{NL})?", "gu");
    private static readonly JsRe KMH = JsRegex.Compile($"(?<=\\d\\s?)km/h{NL}", "giu");
    private static readonly JsRe KPH = JsRegex.Compile($"(?<=\\d\\s?)kph{NL}", "giu");
    private static readonly JsRe MPH = JsRegex.Compile($"(?<=\\d\\s?)mph{NL}", "giu");
    private static readonly JsRe DEG_C = JsRegex.Compile("\\s*°\\s*C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("\\s*°\\s*F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("\\s*°", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile("(?<!\\d)(?<!\\d[.,])[1-9]\\d{0,2}(?:\\.\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<!\\d)(?<!\\d[.,])[1-9]\\d{0,2}(?:,\\d{3})+(?!\\d)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\d.,])(\\d[\\d.,]*)\\s*[-–—]\\s*(\\d[\\d.,]*)(?![\\d.,])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<=\\d),(?=\\d)", "gu");
    private static readonly JsRe DOTTED_NUM = JsRegex.Compile("(?<=\\d)\\.(?=\\d)", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d\\/])(\\d{1,2})\\/(\\d{1,2})(?![\\d\\/])", "gu");
    private static readonly JsRe TIMES = JsRegex.Compile("(?<=\\d)\\s*[x×]\\s*(?=\\d)", "giu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_START = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_AT_END = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s?&\\s?", "gu");
    private static readonly JsRe HAS_LOWER = JsRegex.Compile("\\p{Ll}", "u");
    private static readonly JsRe HAS_SPACE = JsRegex.Compile("\\s", "u");
    private static readonly JsRe CAPS_RUN = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])[A-Z]{2,6}(?![\\p{L}\\p{M}\\d])", "gu");

    /** The ordered pass. */
    public static string NormalizeVietnamese(string input)
    {
        var s = input;

        s = JsRegex.Replace(s, SUP2, _ => "²");
        s = JsRegex.Replace(s, ANY_TAG, _ => "");

        // ⚠ ORDER: clock RANGES, then sports times, then clocks. A clock-clock pair must be joined before the
        // clock rule rewrites its operands into words, and `M:SS,hh` (4:41,30) must be claimed before the clock
        // rule, whose pattern the shape also matches.
        s = JsRegex.Replace(s, CLOCK_RANGE, m => $"{m.Groups[1].Value} đến {m.Groups[2].Value}");
        s = JsRegex.Replace(s, SPORTS_TIME, m =>
            $"{Js.NumberToString(Js.Number(m.Groups[1].Value))} phút {Js.NumberToString(Js.Number(m.Groups[2].Value))} giây {Js.NumberToString(Js.Number(m.Groups[3].Value))}");
        s = JsRegex.Replace(s, CLOCK_RE, m => Clock(m.Groups[1].Value, m.Groups[2].Value));

        s = JsRegex.Replace(s, KMH, _ => "km/giờ");
        s = JsRegex.Replace(s, KPH, _ => "km/giờ");
        s = JsRegex.Replace(s, MPH, _ => "dặm/giờ");

        s = JsRegex.Replace(s, DEG_C, _ => " độ xê");
        s = JsRegex.Replace(s, DEG_F, _ => " độ ép");
        s = JsRegex.Replace(s, DEG_BARE, _ => " độ");

        s = JsRegex.Replace(s, GROUP_DOT, m => JsRegex.Replace(m.Value, DOT_G, _ => ""));
        s = JsRegex.Replace(s, GROUP_COMMA, m => JsRegex.Replace(m.Value, COMMA_G, _ => ""));

        // ⚠ The ascending test is the span/score discriminator, and this rule sits AFTER de-grouping and BEFORE
        // the decimal rules — otherwise `4,2-3,9` has already become two numbers by the time it is read.
        s = JsRegex.Replace(s, RANGE, m =>
            NumVal(m.Groups[2].Value) > NumVal(m.Groups[1].Value)
                ? $"{m.Groups[1].Value} đến {m.Groups[2].Value}"
                : m.Value);

        s = JsRegex.Replace(s, DECIMAL_COMMA, _ => " phẩy ");

        s = JsRegex.Replace(s, DOTTED_NUM, _ => " chấm ");

        s = JsRegex.Replace(s, FRACTION, m => $"{m.Groups[1].Value} phần {m.Groups[2].Value}");

        s = JsRegex.Replace(s, TIMES, _ => " nhân ");

        s = JsRegex.Replace(s, PLUS_AFTER, m => $"{m.Groups[1].Value} cộng ");
        s = JsRegex.Replace(s, PLUS_START, m => $"{m.Groups[1].Value}cộng ");

        s = JsRegex.Replace(s, PLUSMINUS, _ => " cộng trừ ");
        var whole = s;
        s = JsRegex.Replace(s, MINUS, m =>
            DIGIT_AT_END.IsMatch(whole[..m.Index]) ? m.Value : $"{m.Groups[1].Value}âm ");

        s = JsRegex.Replace(s, EQUALS, _ => " bằng ");
        s = JsRegex.Replace(s, LESS_THAN, _ => " nhỏ hơn ");
        s = JsRegex.Replace(s, GREATER_THAN, _ => " lớn hơn ");
        s = JsRegex.Replace(s, DIVIDE, _ => " chia cho ");

        s = JsRegex.Replace(s, AMPERSAND, _ => " và ");

        foreach (var (from, to) in VI_ABBREV)
            s = JsRegex.Replace(s, JsRegex.Compile($"{NLB}{from}{NL}", "gu"), _ => to);
        if (HAS_LOWER.IsMatch(s) || !HAS_SPACE.IsMatch(s.Trim()))
            s = JsRegex.Replace(s, CAPS_RUN, m =>
                string.Join(" ", Js.CodePoints(m.Value).Select(c => Manifest.MANIFEST.LetterNames.GetValueOrDefault(c) ?? c)));

        return s;
    }
}
