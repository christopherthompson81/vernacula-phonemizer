/**
 * Tigrinya (ti) text normalization — pure text→text, run inside `Text()` before tokenization.
 * Ported from src/languages/tigrinya/normalize.ts — see that file for the corpus evidence, the
 * ordering argument between the steps, and every refusal with its count.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tigrinya;

public static class Normalize
{
    /** Ethiopic syllabary letters, EXCLUDING the punctuation (U+1360+) and numeral (U+1369+) sub-blocks. */
    private const string FID = "[\\u1200-\\u135A]";

    private const string POINT = "ነጥቢ";
    private const string FROM = "ካብ";
    private const string UNTIL = "ክሳብ";

    /** Read from the manifest — see the jsonc, where the evidence lives. */
    private static IReadOnlyDictionary<string, string> ORDINAL => TigrinyaPhonemizer.DEF.Ordinals;

    /** ETHIOPIC NUMERALS → the VALUE WORD OF EACH CHARACTER, deliberately not an arithmetic evaluation. */
    private static readonly IReadOnlyDictionary<string, double> GEEZ_DIGIT = new Dictionary<string, double>
    {
        ["፩"] = 1, ["፪"] = 2, ["፫"] = 3, ["፬"] = 4, ["፭"] = 5, ["፮"] = 6, ["፯"] = 7, ["፰"] = 8, ["፱"] = 9,
        ["፲"] = 10, ["፳"] = 20, ["፴"] = 30, ["፵"] = 40, ["፶"] = 50, ["፷"] = 60, ["፸"] = 70, ["፹"] = 80, ["፺"] = 90,
        ["፻"] = 100, ["፼"] = 10000,
    };

    private static readonly JsRe DOUBLE_WORDSPACE = JsRegex.Compile("፡፡", "gu");
    private static readonly JsRe DOUBLE_COLON = JsRegex.Compile("::", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<!\\d)(\\d{1,2})፡([0-5]\\d)(?!\\d)", "gu");
    private static readonly JsRe ERA_BCE = JsRegex.Compile("(?<![ሀ-ፚ])ቅ\\.ል\\.(?:ክ\\.?)?", "gu");
    private static readonly JsRe ERA_CE = JsRegex.Compile("(?<![ሀ-ፚ])ድ\\.(?:ል|ክ)\\.(?:ክ\\.?)?", "gu");
    private static readonly JsRe MULTI_DOT = JsRegex.Compile($"(?:{FID}{{1,5}}\\.){{2,}}{FID}{{0,5}}\\.?", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe INTERIOR_DOT = JsRegex.Compile($"(?<={FID})\\.(?={FID})", "gu");
    private static readonly JsRe LONE_WORDSPACE = JsRegex.Compile("፡-?", "gu");
    private static readonly JsRe PERIOD_TOKEN = JsRegex.Compile("(?<![\\d,.])[\\d.]+(?![\\d,.])", "gu");
    private static readonly JsRe PERIOD_GROUP = JsRegex.Compile("(\\d)(?<!(?<![\\d])0)\\.(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe COMMA_GROUP = JsRegex.Compile("(\\d)(?<!(?<![\\d])0),(?=\\d{3}(?!\\d))", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}])ካብ\\s?(\\d[\\d.]*)\\s?[-–—]\\s?(\\d[\\d.]*)", "gu");
    private static readonly JsRe SQUARE_KM = JsRegex.Compile("(?<![ሀ-ፚ])ኪሜ\\s?[²2](?![\\d\\p{L}])", "gu");
    private static readonly JsRe KM = JsRegex.Compile("(?<![ሀ-ፚ])ኪሜ(?![ሀ-ፚ])", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d+)[.,](\\d+)(?![\\d.])", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile("(?<![\\d.])(\\d+)\\s*ይ([ቲትን]?)(?![ሀ-ፚ])", "gu");
    private static readonly JsRe ORDINAL_GEEZ = JsRegex.Compile("(?<![፩-፼])([፩-፼])ይ([ቲትን]?)(?![ሀ-ፚ])", "gu");
    private static readonly JsRe GEEZ_NUMERAL = JsRegex.Compile("[፩-፼]+", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("°", "gu");
    private static readonly JsRe DOUBLE_SPACE = JsRegex.Compile("[ \u00a0]{2,}", "gu");

    /**
     * Build the Tigrinya normalizer. `numberToText` is injected rather than imported so that this module
     * and the engine do not form a cycle in the TypeScript; `symbols` is threaded THROUGH rather than
     * wrapping, because the ordering is load-bearing in both directions (step 9).
     */
    public static Func<string, string> MakeTigrinyaNormalizer(Func<double, string> numberToText, Func<string, string> symbols)
    {
        /** Spell one integer string; falls back to the digits when out of the composer's range. */
        string Words(string digits)
        {
            var n = Js.Number(digits);
            return double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d && n >= 0 && n < 1e12
                ? numberToText(n) : digits;
        }
        /** Digits read one at a time — the fractional tail of a decimal. */
        string EachDigit(string digits) =>
            string.Join(" ", Js.CodePoints(digits).Select(d => numberToText(Js.Number(d))));

        string Ordinalize(string m, double value, string tail) =>
            ORDINAL.TryGetValue(Js.NumberToString(value), out var o) ? $" {o}{tail} " : m;

        return input =>
        {
            var s = input;

            s = DOUBLE_WORDSPACE.Replace(s, "።");
            s = DOUBLE_COLON.Replace(s, "።");

            s = CLOCK.Replace(s, m =>
            {
                var h = m.Groups[1].Value;
                var mi = m.Groups[2].Value;
                return Js.Number(mi) == 0 ? $" {Words(h)} " : $" {Words(h)} {Words(mi)} ";
            });

            s = ERA_BCE.Replace(s, " ቅድሚ ልደተ ክርስቶስ ");
            s = ERA_CE.Replace(s, " ድሕሪ ልደተ ክርስቶስ ");

            s = MULTI_DOT.Replace(s, m => DOTS.Replace(m.Value, ""));
            s = INTERIOR_DOT.Replace(s, "");

            s = LONE_WORDSPACE.Replace(s, ",");

            s = PERIOD_TOKEN.Replace(s, m => PERIOD_GROUP.Replace(m.Value, "$1"));
            s = COMMA_GROUP.Replace(s, "$1");
            s = COMMA_GROUP.Replace(s, "$1"); // second pass for 5,000,000

            s = RANGE.Replace(s, m => $"{FROM} {m.Groups[1].Value} {UNTIL} {m.Groups[2].Value}");

            s = SQUARE_KM.Replace(s, "ትርብዒት ኪሎ ሜተር");
            s = KM.Replace(s, "ኪሎ ሜተር");

            s = symbols(s);

            s = DECIMAL.Replace(s, m => $" {Words(m.Groups[1].Value)} {POINT} {EachDigit(m.Groups[2].Value)} ");

            s = ORDINAL_RE.Replace(s, m => Ordinalize(m.Value, Js.Number(m.Groups[1].Value), m.Groups[2].Value));
            s = ORDINAL_GEEZ.Replace(s, m =>
                Ordinalize(m.Value, GEEZ_DIGIT.TryGetValue(m.Groups[1].Value, out var v) ? v : 0, m.Groups[2].Value));

            s = GEEZ_NUMERAL.Replace(s, m =>
                " " + string.Join(" ", Js.CodePoints(m.Value)
                    .Select(c => GEEZ_DIGIT.TryGetValue(c, out var v) ? numberToText(v) : "")
                    .Where(w => w.Length > 0)) + " ");

            s = DEGREE.Replace(s, " ዲግሪ ");

            return DOUBLE_SPACE.Replace(s, " ");  // space, NBSP
        };
    }
}
