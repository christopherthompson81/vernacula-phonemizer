/**
 * Amharic (am) text normalization — pure text→text, run inside `text()` before tokenization.
 * Ported from src/languages/amharic/normalize.ts — see that file for the corpus evidence.
 */

/** Ethiopic syllabary letters, EXCLUDING the punctuation and numeral sub-blocks (U+135F and up). */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Amharic;

public static class Normalize
{
    private const string FID = "[\\u1200-\\u135A]";

    /** Amharic decimal point. */
    private const string POINT = "ነጥብ";

    /**
     * Range connective — Amharic writes "ከ 100 እስከ 250 ሜትር" out in full, which the hyphenated form
     * abbreviates.
     */
    private const string UNTIL = "እስከ";

    /** ORDINALS. */
    private static readonly IReadOnlyDictionary<string, string> ORDINAL = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["አንድ"] = "አንደኛ", ["ሁለት"] = "ሁለተኛ", ["ሦስት"] = "ሦስተኛ", ["አራት"] = "አራተኛ", ["አምስት"] = "አምስተኛ",
        ["ስድስት"] = "ስድስተኛ", ["ሰባት"] = "ሰባተኛ", ["ስምንት"] = "ስምንተኛ", ["ዘጠኝ"] = "ዘጠነኛ", ["አስር"] = "አስረኛ",
        ["ሃያ"] = "ሃያኛ", ["ሰላሳ"] = "ሰላሳኛ", ["አርባ"] = "አርባኛ", ["ሃምሳ"] = "ሃምሳኛ", ["ስልሳ"] = "ስልሳኛ",
        ["ሰባ"] = "ሰባኛ", ["ሰማንያ"] = "ሰማንያኛ", ["ዘጠና"] = "ዘጠናኛ",
        ["መቶ"] = "መቶኛ", ["ሺ"] = "ሺኛ", ["ሚሊዮን"] = "ሚሊዮንኛ", ["ቢሊዮን"] = "ቢሊዮንኛ", ["ዜሮ"] = "ዜሮኛ",
    };

    private static readonly JsRe DOUBLE_WORDSPACE = JsRegex.Compile("፡፡", "gu");
    private static readonly JsRe TIME_SEP = JsRegex.Compile("(\\d)፡(\\d)", "gu");
    private static readonly JsRe MULTI_DOT = JsRegex.Compile($"(?:{FID}{{1,5}}\\.){{2,}}{FID}{{0,5}}\\.?", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe INTERIOR_DOT = JsRegex.Compile($"(?<={FID})\\.(?={FID})", "gu");
    private static readonly JsRe LONE_WORDSPACE = JsRegex.Compile("፡-?", "gu");
    private static readonly JsRe GROUPED = JsRegex.Compile("(\\d),(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<!\\d)(\\d{1,2}):([0-5]\\d)(?:\\.(\\d+))?(?!\\d)", "gu");
    private static readonly JsRe CLOCK_DOT_TZ = JsRegex.Compile("(?<!\\d)(\\d{1,2})\\.00(?=\\s*(?:GMT|UTC|ዩቲሲ|ጂኤምቲ))", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\p{L}\\p{M}])ከ\\s?(\\d[\\d.]*)\\s?[-–—]\\s?(\\d[\\d.]*)", "gu");
    private static readonly JsRe CODE_PREFIXED_SIGN = JsRegex.Compile("(?<=[A-Za-zሀ-ፚ])(?=\\$\\s?\\d)", "gu");
    private static readonly JsRe REDUNDANT_DOLLAR = JsRegex.Compile(
        "\\$\\s?(\\d[\\d.,]*)(\\s+(?:ሚሊዮን|ቢሊዮን|ቢልየን|ትሪሊዮን))?(?=\\s*ዶላ[ርሮ])", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\s*ኛ([ውዋ]?)(?![ሀ-ፚ])", "gu");
    private static readonly JsRe SQUARE_KM = JsRegex.Compile("(?<![ሀ-ፚ])ኪሜ\\s?[²2](?![\\d\\p{L}])", "gu");
    private static readonly JsRe KM = JsRegex.Compile("(?<![ሀ-ፚ])ኪሜ(?![ሀ-ፚ])", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("°", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+[ \u00a0]?(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|[ \u00a0])\\+[ \u00a0]?(?=\\d)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\S+)\\s*<\\s*(\\S+)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\S+)\\s*>\\s*(\\S+)", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\S+)\\s*÷\\s*(\\S+)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile("[ \u00a0]{2,}", "gu");

    /** Build the Amharic normalizer. */
    public static Func<string, string> MakeAmharicNormalizer(Func<double, string> numberToText, Func<string, string> symbols)
    {
        /** Spell one integer string; falls back to the digits when out of the composer's range. */
        string Words(string digits)
        {
            var n = Js.Number(digits);
            return double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d && n >= 0 && n < 1e12 ? numberToText(n) : digits;
        }
        /** Digits read one at a time — the fractional tail of a decimal. */
        string EachDigit(string digits) =>
            string.Join(" ", Js.CodePoints(digits).Select(d => numberToText(Js.Number(d))));
        /** Ordinal: compose the cardinal, then inflect only its FINAL word. */
        string Ordinal(string digits)
        {
            var w = Words(digits).Split(' ').ToList();
            if (!ORDINAL.TryGetValue(w[^1], out var o)) return "";
            w[^1] = o;
            return string.Join(" ", w);
        }

        return input =>
        {
            var s = input;

            s = DOUBLE_WORDSPACE.Replace(s, "።");

            s = TIME_SEP.Replace(s, "$1:$2");

            s = MULTI_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));
            s = INTERIOR_DOT.Replace(s, "");

            s = LONE_WORDSPACE.Replace(s, ",");

            s = GROUPED.Replace(s, "$1");
            s = GROUPED.Replace(s, "$1"); // second pass for 5,000,000

            //    sports splits are "4:41.30", where the clock must take 4:41 and leave .30 to step 10.
            s = CLOCK.Replace(s, m =>
            {
                var h = m.Groups[1].Value;
                var mi = m.Groups[2].Value;
                string? frac = m.Groups[3].Success ? m.Groups[3].Value : null;
                var hm = Js.Number(mi) == 0 && frac is null ? Words(h) : $"{Words(h)} {Words(mi)}";
                return frac is null ? $" {hm} " : $" {hm} {POINT} {EachDigit(frac)} ";
            });

            s = CLOCK_DOT_TZ.Replace(s, m => $" {Words(m.Groups[1].Value)} ");

            // RANGES are restricted to the ከ ("from") frame — ⚠ the restriction IS the rule, because most
            // hyphenated number pairs are scores or year spans and must NOT become "from…to".
            s = RANGE.Replace(s, m => $"ከ {m.Groups[1].Value} {UNTIL} {m.Groups[2].Value}");

            // Two LOCAL workarounds for the shared currency tier: a letter-code prefix ("US$14.7") blocks the
            // tier's own key, and its "the text already says it" prefix test misses Amharic plural morphology.
            s = CODE_PREFIXED_SIGN.Replace(s, " ");
            s = REDUNDANT_DOLLAR.Replace(s, m => $"{m.Groups[1].Value}{(m.Groups[2].Success ? m.Groups[2].Value : "")}");

            s = symbols(s);

            s = DECIMAL.Replace(s, m => $" {Words(m.Groups[1].Value)} {POINT} {EachDigit(m.Groups[2].Value)} ");

            s = ORDINAL_RE.Replace(s, m =>
            {
                var o = Ordinal(m.Groups[1].Value);
                return o == "" ? m.Value : $" {o}{m.Groups[2].Value} ";
            });

            s = SQUARE_KM.Replace(s, "ካሬ ኪሎ ሜትር");

            s = KM.Replace(s, "ኪሎ ሜትር");

            s = DEGREE.Replace(s, " ዲግሪ ");

            s = PLUS_ATTACHED.Replace(s, "$1 ፕላስ ");
            s = PLUS_LEADING.Replace(s, "$1ፕላስ ");

            s = LESS_THAN.Replace(s, "$1 ከ$2 ያነሰ");
            s = GREATER_THAN.Replace(s, "$1 ከ$2 የበለጠ");
            s = DIVIDE.Replace(s, "$1 በ$2 በመክፈል");
            s = EQUALS.Replace(s, " እኩል ");

            return DOUBLE_SPACE.Replace(s, " ");
        };
    }
}
