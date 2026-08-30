/**
 * Karakalpak (kaa) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/karakalpak/normalize.ts — see that file for the corpus evidence and the sourcing.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Karakalpak;

public static class Normalize
{
    /** The shared SYMBOL tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "procent" },
        // ⚠ `US$` IS DECLARED AHEAD OF `$` — the tier matches longest-first, and a currency key is more
        // than one character.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "dollar" }, ["$"] = new[] { "dollar" }, ["€"] = new[] { "evro" }, ["£"] = new[] { "funt" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometr" }, ["m"] = new[] { "metr" }, ["sm"] = new[] { "santimetr" },
            ["mm"] = new[] { "millimetr" }, ["kg"] = new[] { "kilogramm" }, ["t"] = new[] { "tonna" },
            ["ga"] = new[] { "gektar" }, ["kvt"] = new[] { "kilovatt" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadrat" }, Cubed = new[] { "kub" }, Position = ExponentPosition.Before,
        },
        Ampersand = "hám",
        // ⚠ `mıń` (thousand) IS DECLARED AS A MAGNITUDE BECAUSE IT SITS BETWEEN THE FIGURE AND THE UNIT,
        // which is where the tier's number-adjacency requirement would otherwise fail.
        Magnitudes = new[] { "mıń", "million", "milliard" },
    });

    /** 1) THE PERCENT SIGN AND ITS CASE SUFFIX, TOGETHER AND BEFORE THE TIER. */
    private static readonly JsRe PERCENT_SUFFIX =
        JsRegex.Compile("(\\d)\\s?%\\s?(k[ei]|[td][ae]n|t[ıi]|[ıi]n?)(?![\\p{L}\\p{M}])", "gu");

    /** 2) THE MAGNITUDE ABBREVIATIONS AND THE TWO-TOKEN SQUARE MEASURES, BEFORE THE TIER — and the
     *  ordering is the whole point (see the TS for the first-draft failure). */
    private static readonly JsRe MLN_DOT = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mln\\s?\\.\\s?", "gu");
    private static readonly JsRe MLRD_DOT = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mlrd\\s?\\.\\s?", "gu");
    private static readonly JsRe MLN = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mln{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe MLRD = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}mlrd{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe M_KV = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}m\\s?\\.\\s?kv\\s?\\.", "gu");
    private static readonly JsRe KM_KV_DOT = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}km\\s?\\.?\\s?kv\\s?\\.", "gu");
    private static readonly JsRe KM_KV = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}km\\s+kv{Boundaries.NOT_LETTER_AFTER}", "gu");
    private static readonly JsRe KVT_SAAT = JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}kvt\\s?[/\\-]\\s?saat", "gu");

    /** 4) DE-GROUPING — ⚠ THE WHOLE NUMBER AT ONCE, and the trailing guard rejects a DIGIT and nothing
     *  else; a magnitude word after the group means it is a decimal after all. */
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:,\\d{3})+)(?!\\d)(?!\\s?(?:mıń|million|milliard))", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        "(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:[ \\u00a0\\u202f\\u2009]\\d{3})+)(?!\\d)", "gu");
    /** The separators of the two de-groupings, spelled as escapes — a literal NBSP in a heredoc is the nso trap. */
    private static readonly JsRe COMMA = JsRegex.Compile(",", "gu");
    private static readonly JsRe GROUP_SPACE_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");

    /** 5) THE DECIMAL SEPARATORS, NEUTRALISED — what is left with a dot is a decimal ONLY IF THE RUN
     *  CARRIES EXACTLY ONE, the guard that keeps this off an IP address or a dotted date. */
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(\\d),(?=\\d)", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");

    /** 6) THE ERA MARKER. */
    private static readonly JsRe ERA =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}b\\s?\\.\\s?e\\s?\\.\\s?sh\\s?\\.", "giu");
    private static readonly JsRe SENTENCE_END = JsRegex.Compile("^\\s*[\"»)']?\\s*$", "u");

    /** 7) THE ABBREVIATIONS THIS CORPUS PUTS BESIDE ITS FIGURES. */
    private static readonly JsRe YEAR = JsRegex.Compile("(\\d)-j\\s?\\.", "gu");
    private static readonly JsRe T_RASI =
        JsRegex.Compile($"{Boundaries.NOT_LETTER_BEFORE}t-r(ası|a){Boundaries.NOT_LETTER_AFTER}", "gu");

    /** 8) THE CLOCK — the hour bound is what declines a standard number. */
    private static readonly JsRe CLOCK =
        JsRegex.Compile("(?<![\\d:.,])([01]?\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?(?![\\d:.,])", "gu");

    /** 9) SIGNS — the plus is claimed and the DIGIT lookahead is the whole guard (`C++` never has one). */
    private static readonly JsRe PLUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|(?<!\\d)[\\s(])[-\\u2212\\u2013]\\s?(?=\\d)", "gu");
    /** …the paired second sign, GATED ON A FOLLOWING DEGREE — ungated it reads a 6-to-90 mm span as an addition. */
    private static readonly JsRe PAIRED_PLUS = JsRegex.Compile("(?<=\\d)\\+(?=\\d{1,3}\\s?(?:°|gradus))", "gu");
    private static readonly JsRe PAIRED_MINUS = JsRegex.Compile("(?<=\\d)-(?=\\d{1,2}\\s?(?:°|gradus))", "gu");

    /** 10) DEGREES — the scale letter may be CYRILLIC and the sign may be missing; the corpus glosses its
     *  own sign, so the word is not emitted twice. */
    private static readonly JsRe DEG_C_GLOSS =
        JsRegex.Compile("(\\d)\\s?°\\s?[CС](?![\\p{L}\\p{M}])(?!\\s*gradus)", "gui");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?[CС](?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_GLOSS = JsRegex.Compile("(\\d)\\s?°(?!\\s*gradus)", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** 11) RANGES — the dash is spent on a pause rather than a connective; NOTHING MAY BE REQUIRED AFTER
     *  THE SECOND NUMBER, and an adjacent slash means a citation rather than a span. */
    private static readonly JsRe DASH_RANGE = JsRegex.Compile("(\\d)\\s?[\\u2013\\u2014]\\s?(?=\\d)", "gu");
    private static readonly JsRe HYPHEN_RANGE =
        JsRegex.Compile("(?<![\\d.,\\-\\/])(\\d+)\\s?-\\s?(\\d+)(?![\\d\\/])(?!\\s?-\\s?\\d)", "gu");

    private static readonly JsRe WS_RUN = JsRegex.Compile("[^\\S\\n]{2,}", "gu");

    /** Normalize one Karakalpak input string. Pure text→text. Steps are ORDER-DEPENDENT. */
    public static string NormalizeKarakalpak(string input)
    {
        var s = input;

        // 1) THE PERCENT SIGN AND ITS CASE SUFFIX, TOGETHER AND BEFORE THE TIER — see the TS header.
        s = Rewrite(s, PERCENT_SUFFIX, "$1 procent$2");

        // 2) THE TWO-TOKEN SQUARE MEASURES AND THE COMPOUND ENERGY UNIT, BEFORE THE TIER — and the
        //    magnitude abbreviations, for the same ordering reason and one more.
        s = Rewrite(s, MLN_DOT, "million ");
        s = Rewrite(s, MLRD_DOT, "milliard ");
        s = Rewrite(s, MLN, "million");
        s = Rewrite(s, MLRD, "milliard");
        s = Rewrite(s, M_KV, "kvadrat metr");
        s = Rewrite(s, KM_KV_DOT, "kvadrat kilometr");
        s = Rewrite(s, KM_KV, "kvadrat kilometr");
        s = Rewrite(s, KVT_SAAT, "kilovatt saat");

        // 3) THE SHARED SYMBOL TIER — its own numeral pattern reads `19,605,052` and `1.65` as ONE token,
        //    and steps 4 and 5 split precisely those.
        s = SYMBOLS(s);

        // 4) DE-GROUPING THE COMMA, by the three-digit test — ⚠ THE WHOLE NUMBER AT ONCE, and the trailing
        //    guard rejects a DIGIT and nothing else. The separator removal runs on the CAPTURED side, not
        //    the pipeline string, so it stays off the seam.
        s = Rewrite(s, GROUP_COMMA, m => m.Groups[1].Value + COMMA.Replace(m.Groups[2].Value, ""));
        //    …and the SPACE, which this corpus also uses. Same idiom, same whole-number match.
        s = Rewrite(s, GROUP_SPACE, m => m.Groups[1].Value + GROUP_SPACE_SEPS.Replace(m.Groups[2].Value, ""));

        // 5) THE DECIMAL SEPARATORS, NEUTRALISED — see the TS header for why no word is spoken.
        s = Rewrite(s, DECIMAL_COMMA, "$1 ");
        s = Rewrite(s, DECIMAL_DOT, "$1 $2");

        // 6) THE ERA MARKER. ⚠ THE FINAL DOT IS KEPT AT A SENTENCE END, or the pause is lost outright.
        s = Rewrite(s, ERA, m =>
        {
            var rest = s[(m.Index + m.Length)..];
            return SENTENCE_END.IsMatch(rest) ? "biziń eramızǵa shekem." : "biziń eramızǵa shekem";
        });

        // 7) THE ABBREVIATIONS BESIDE THE FIGURES — the magnitude dots, the year, the hyphen-cut.
        s = Rewrite(s, YEAR, "$1 jıl");
        s = Rewrite(s, T_RASI, "temperatur$1");

        // 8) THE CLOCK — the figures are left as figures and only the colon is spent.
        s = Rewrite(s, CLOCK, m =>
            m.Groups[3].Success
                ? $"{m.Groups[1].Value} {m.Groups[2].Value} {m.Groups[3].Value}"
                : $"{m.Groups[1].Value} {m.Groups[2].Value}");

        // 9) SIGNS.
        s = Rewrite(s, PLUS, "$1plyus ");
        s = Rewrite(s, MINUS, "$1minus ");
        //    …the paired second sign, which sits directly against the first number.
        s = Rewrite(s, PAIRED_PLUS, " plyus ");
        s = Rewrite(s, PAIRED_MINUS, " minus ");

        // 10) DEGREES — the bare degree word, and the corpus's own gloss is not emitted twice.
        s = Rewrite(s, DEG_C_GLOSS, "$1 gradus");
        s = Rewrite(s, DEG_C, "$1");
        s = Rewrite(s, DEG_GLOSS, "$1 gradus ");
        s = Rewrite(s, DEG_BARE, "$1");

        // 11) RANGES.
        s = Rewrite(s, DASH_RANGE, "$1, ");
        s = Rewrite(s, HYPHEN_RANGE, "$1, $2");

        // A padded replacement doubles a space that was already there. Harmless downstream because
        // AssembleClauses collapses runs, but this pass should not be the one producing the candidates.
        return Rewrite(s, WS_RUN, " ");
    }
}
