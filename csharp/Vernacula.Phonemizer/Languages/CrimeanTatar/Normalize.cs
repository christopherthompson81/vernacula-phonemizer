/**
 * Crimean Tatar (crh) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites what is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE SHARED SYMBOL TIER RUNS INSIDE THIS PASS, between the percent-suffix step and the de-grouping —
 * the percent rule needs the figure still carrying its written case suffix, and the de-grouping needs to
 * run after the tier has matched the figure whole.
 * Ported from src/languages/crimeantatar/normalize.ts — see that file for the corpus evidence and the
 * sourcing of every word.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.CrimeanTatar;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "faiz" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "dollar" },
            ["$"] = new[] { "dollar" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometr" }, ["m"] = new[] { "metr" }, ["sm"] = new[] { "santimetr" },
            ["mm"] = new[] { "millimetr" }, ["kg"] = new[] { "kilogramm" }, ["sn"] = new[] { "saniye" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadrat" },
            Cubed = new[] { "kub" },
            Position = ExponentPosition.Before,
        },
        Ampersand = "ve",
        Magnitudes = new[] { "biñ", "million", "milliard" },
    });

    /** The percent sign carrying a written case suffix — `5%-nen` → *beş faiznen*. */
    private static readonly JsRe PERCENT_SUFFIX =
        JsRegex.Compile("(\\d)\\s?%\\s?-?\\s?(\\p{Ll}{1,4})(?![\\p{L}\\p{M}])", "gu");

    private static readonly JsRe KVADRAT_KM =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}kvadrat(\\s+)km{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe MLN_DOT =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mln\\s?\\.\\s?", "gu");
    private static readonly JsRe MLRD_DOT =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mlrd\\s?\\.\\s?", "gu");
    private static readonly JsRe MLN_BARE =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mln{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe MLRD_BARE =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mlrd{Boundaries.NOT_LETTER_AFTER}", "gu");

    // The four grouping conventions, de-grouped after the tier has seen the figure whole.
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");  // space, NBSP, NNBSP, thin
    private static readonly JsRe SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile("(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile("(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    /** Whatever separator survives the de-grouping is a decimal, and it is SPENT rather than spoken. */
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)[.,](?=\\d)", "gu");

    /** `m. e.` — *milâttan evel* (BC). The final dot is kept at a sentence end, or the pause is lost. */
    private static readonly JsRe ERA =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}m\\s?\\.\\s?e\\s?\\.", "gu");
    private static readonly JsRe SENTENCE_END = JsRegex.Compile("^\\s*[\"»)']?\\s*$", "u");

    /** The four compass coordinate abbreviations, each with its adjective and its noun. */
    private static readonly (string Pattern, string Adj, string Noun)[] COORDS =
    [
        ("ş\\s?\\.\\s?e\\s?\\.", "şimaliy", "enlik"),
        ("c\\s?\\.\\s?e\\s?\\.", "cenübiy", "enlik"),
        ("ş\\s?\\.\\s?b\\s?\\.", "şarqiy", "boyluq"),
        ("ğ\\s?\\.\\s?b\\s?\\.", "ğarbiy", "boyluq"),
    ];
    private static readonly JsRe[] COORD_RULES = COORDS
        .Select(c => JsRegex.Compile(
            $"{Boundaries.NOT_LETTER_BEFORE}{c.Pattern}(\\s*)({c.Noun}\\p{{L}}*)?", "gu"))
        .ToArray();

    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[–—]\\s?(?=[+-]?\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE =
        JsRegex.Compile("(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-\\u2212\\u2013]\\s?(\\d)", "gu");

    /** ⚠ BOTH THE LATIN ⟨C⟩ AND THE CYRILLIC ⟨С⟩, in both cases — they render identically, and a class
     *  carrying only one of them leaves the other to be read as a bare letter. Spelled as escapes so the
     *  pair is legible: C U+0043 / С U+0421, c U+0063 / с U+0441. */
    private const string SCALE_C = "[\\u0043\\u0421\\u0063\\u0441]";
    private static readonly JsRe DEG_C_SUFFIX =
        JsRegex.Compile($"(\\d)\\s?°\\s?{SCALE_C}\\s?-\\s?(\\p{{Ll}}{{1,4}})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_C =
        JsRegex.Compile($"(\\d)\\s?°\\s?{SCALE_C}(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_SUFFIX =
        JsRegex.Compile("(\\d)\\s?°\\s?-\\s?(\\p{Ll}{1,4})(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    public static string NormalizeCrimeanTatar(string input)
    {
        var s = input;

        // The percent sign with a written case suffix, before the tier claims the figure.
        s = Rewrite(s, PERCENT_SUFFIX, "$1 faiz$2");

        // The spelled square, and the magnitude abbreviations with and without their dot.
        s = Rewrite(s, KVADRAT_KM, "kvadrat$1kilometr");
        s = Rewrite(s, MLN_DOT, "million ");
        s = Rewrite(s, MLRD_DOT, "milliard ");
        s = Rewrite(s, MLN_BARE, "million");
        s = Rewrite(s, MLRD_BARE, "milliard");

        // The shared symbol tier — percent, currency, units, the exponent.
        s = SYMBOLS(s);

        // De-grouping, after the tier: space, comma and dot conventions all occur.
        s = Rewrite(s, GROUP_SPACE, m => m.Groups[1].Value + SPACES.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, GROUP_COMMA, m => m.Groups[1].Value + COMMAS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, GROUP_DOT, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DECIMAL, "$1 ");

        // The era marker, with the sentence-end guard.
        var frozen = s;
        s = Rewrite(s, ERA, m =>
        {
            var rest = frozen[(m.Index + m.Length)..];
            return SENTENCE_END.IsMatch(rest) ? "milâttan evel." : "milâttan evel";
        });

        // The compass coordinates — the noun is emitted only when the writer did not already write it.
        for (var i = 0; i < COORD_RULES.Length; i++)
        {
            var (_, adj, noun) = COORDS[i];
            s = Rewrite(s, COORD_RULES[i], m =>
            {
                var gap = m.Groups[1].Value;
                return m.Groups[2].Success ? $"{adj}{gap}{m.Groups[2].Value}" : $"{adj} {noun}{gap}";
            });
        }

        // Ranges, then the sign — the range rules spend the dash first.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, $2");
        s = Rewrite(s, MINUS, "$1minus $2");

        // Degrees, the suffixed forms before the bare ones.
        s = Rewrite(s, DEG_C_SUFFIX, "$1 derece$2");
        s = Rewrite(s, DEG_C, "$1 derece");
        s = Rewrite(s, DEG_SUFFIX, "$1 derece$2");
        s = Rewrite(s, DEG_BARE, "$1 derece ");

        return WS_RUN.Replace(s, " ");
    }
}
