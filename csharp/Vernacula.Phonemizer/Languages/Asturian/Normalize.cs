/**
 * Asturian (ast) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks.
 * Ported from src/languages/asturian/normalize.ts — see that file for the corpus evidence.
 */

/** ⚠ NEVER `\b` — Asturian carries `á é í ó ú ñ ḷ ḥ`, which `\b` treats as boundaries (trap 1/23). */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Asturian;

public static class Normalize
{
    /** The Roman month numerals, 1–12, for the `24-X-1793` date form. */
    private static readonly string[] MONTHS =
    {
        "", "xineru", "febreru", "marzu", "abril", "mayu", "xunu",
        "xunetu", "agostu", "setiembre", "ochobre", "payares", "avientu",
    };

    private static readonly IReadOnlyDictionary<string, int> ROMAN_MONTH = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["I"] = 1, ["II"] = 2, ["III"] = 3, ["IV"] = 4, ["V"] = 5, ["VI"] = 6, ["VII"] = 7,
        ["VIII"] = 8, ["IX"] = 9, ["X"] = 10, ["XI"] = 11, ["XII"] = 12,
    };

    /** What may follow a degree sign for it to BE a degree. */
    private const string DEGREE_TAIL =
        "(?:\\s?[CF]|\\s?[NSEW]|\\s?\\d+\\s?[′']|\\s*(?:de|y|col|na)(?![\\p{L}\\p{M}])|\\s*[.,;:)»]|\\s*$)";

    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space
    private static readonly JsRe DOT_GROUP = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DOT_DECIMAL = JsRegex.Compile("(?<!\\d)(\\d+)\\.(\\d+)(?!\\d)", "gu");
    private static readonly JsRe SENTENCE_TAIL = JsRegex.Compile("^\\s*[\"»)']?\\s*$", "u");
    private static readonly List<(JsRe Re, string Word)> MULTI = new()
    {
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}e\\s?\\.\\s?C\\s?\\.", "gu"), "enantes de Cristu"),
        (JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}d\\s?\\.\\s?C\\s?\\.", "gu"), "dempués de Cristu"),
    };
    private static readonly JsRe ROMAN_DATE = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(\\d{{1,2}})\\s?-\\s?(I{{1,3}}|IV|V|VI{{1,3}}|IX|XI{{0,2}})\\s?-\\s?(\\d{{3,4}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe NUMERIC_DATE = JsRegex.Compile(
        $"{Boundaries.NOT_LETTER_BEFORE}(\\d{{1,2}})\\s?-\\s?(\\d{{1,2}})\\s?-\\s?(\\d{{3,4}}){Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d)(?![\\d:.,])", "gu");
    private static readonly JsRe DEG_SCALE = JsRegex.Compile("(\\d)\\s?[°º]\\s?([CF])(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_MIN = JsRegex.Compile("(\\d)\\s?[°º]\\s?(\\d+)\\s?[′']", "gu");
    private static readonly JsRe DEG = JsRegex.Compile($"(\\d)\\s?[°º](?={DEGREE_TAIL})", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-−–]\\s?(\\d)", "gu");
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE = JsRegex.Compile(
        "(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Asturian input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeAsturian(string input)
    {
        var s = input;

        s = SPACE_GROUP.Replace(s, m => m.Groups[1].Value + SPACE_SEPS.Replace(m.Groups[2].Value, ""));
        s = DOT_GROUP.Replace(s, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));
        s = DOT_DECIMAL.Replace(s, "$1,$2");

        foreach (var (re, word) in MULTI)
        {
            var frozen = s;
            s = re.Replace(s, m =>
            {
                var rest = frozen[(m.Index + m.Value.Length)..];
                return SENTENCE_TAIL.IsMatch(rest) ? $"{word}." : word;
            });
        }

        s = ROMAN_DATE.Replace(s, m =>
        {
            if (!ROMAN_MONTH.TryGetValue(m.Groups[2].Value, out var mon)) return m.Value;
            return $"{m.Groups[1].Value} de {MONTHS[mon]} de {m.Groups[3].Value}";
        });

        s = NUMERIC_DATE.Replace(s, m =>
        {
            var mon = Js.Number(m.Groups[2].Value);
            return mon >= 1 && mon <= 12
                ? $"{m.Groups[1].Value} de {MONTHS[(int)mon]} de {m.Groups[3].Value}"
                : m.Value;
        });

        s = CLOCK.Replace(s, "$1 $2");

        s = DEG_SCALE.Replace(s, m =>
            $"{m.Groups[1].Value} graos {(m.Groups[2].Value.ToUpperInvariant() == "C" ? "Celsius" : "Fahrenheit")}");
        s = DEG_MIN.Replace(s, "$1 graos $2 minutos ");
        s = DEG.Replace(s, "$1 graos ");

        s = MINUS.Replace(s, "$1menos $2");

        s = DASH_RANGE.Replace(s, "$1, ");
        s = HYPHEN_RANGE.Replace(s, "$1, $2");

        return MULTI_SPACE.Replace(s, " ");
    }
}
