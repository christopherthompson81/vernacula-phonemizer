/**
 * Hawaiian (haw) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA. The shared symbol
 * tier runs FIRST (its numeral pattern reads a grouped or decimal figure whole), then de-grouping, the
 * decimal neutralisation, the coordinate/degree rules, the clock, and the ranges.
 * Ported from src/languages/hawaiian/normalize.ts, whose header carries the evidential record.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Hawaiian;

public static class Normalize
{
    /**
     * The shared symbol tier. The unit table is the corpus's OWN Hawaiianised abbreviations, not the SI
     * ones, and the rate connective is the corpus's own two-word phrase `o ka`. See the TS for the
     * attestation of each word.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "pākēneka" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "kālā" },
            ["$"] = new[] { "kālā" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilomika" },
            ["klm"] = new[] { "kilomika" },
            ["m"] = new[] { "mika" },
            ["kp"] = new[] { "kapuaʻi" },
            ["mil"] = new[] { "mile" },
            ["mph"] = new[] { "mile o ka hola" },
        },
        UnitPer = "o ka",
        RateDenominators = new Dictionary<string, string>
        {
            ["h"] = "hola",
            ["s"] = "kekona", // the second, attested digit-adjacent ×7 (#1257)
        },
        // ⚠ `kuea` FOLLOWS the unit (`mile kuea`), the opposite of the Turkic rounds either side of this one.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kuea" },
            Cubed = new[] { "kupika" },
            Position = ExponentPosition.After,
        },
        Ampersand = "a me",
        Magnitudes = new[] { "miliona", "biliona" },
    });

    // ── the patterns, in step order ─────────────────────────────────────────
    // ⚠ NEVER `\b` — the ʻokina and the macrons are treated as boundaries by `\b` (trap 1/23).
    private static readonly JsRe DEGROUP_COMMA = JsRegex.Compile(
        @"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe DEGROUP_DOT = JsRegex.Compile(
        @"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile(@"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu");

    // ⚠ ONLY THE TWO COMPASS LETTERS THE ARTIFACT SHOWS ARE CLAIMED: ʻĀ = ʻākau (north), K = komohana (west).
    private static readonly JsRe COORD_N = JsRegex.Compile(@"(\d)\s?[°˚]\s?(\d+)\s?[′']\s?ʻĀ(?![\p{L}\p{M}ʻ])", "gu");
    private static readonly JsRe COORD_W = JsRegex.Compile(@"(\d)\s?[°˚]\s?(\d+)\s?[′']\s?K(?![\p{L}\p{M}ʻ])", "gu");
    private static readonly JsRe COORD_BARE = JsRegex.Compile(@"(\d)\s?[°˚]\s?(\d+)\s?[′']", "gu");
    // ⚠ BOTH SIGNS — `°` U+00B0 and `˚` U+02DA RING ABOVE.
    private static readonly JsRe DEGREE = JsRegex.Compile(@"(\d)\s?[°˚]", "gu");
    // ⚠ THE CODEPOINT IS THE GUARD: the scripture colon is U+02D0, the clocks are ASCII `:`.
    private static readonly JsRe CLOCK = JsRegex.Compile(@"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])", "gu");
    private static readonly JsRe RANGE_DASH = JsRegex.Compile(@"(\d)\s?[–—]\s?(?=\d)", "gu");
    private static readonly JsRe RANGE_HYPHEN = JsRegex.Compile(
        @"(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)", "gu");
    private static readonly JsRe MULTI_SPACE = JsRegex.Compile(@"[^\S\n]{2,}", "gu");

    /** Normalize one Hawaiian input string. Steps are ORDER-DEPENDENT. */
    public static string NormalizeHawaiian(string input)
    {
        var s = input;

        // 1) THE SHARED SYMBOL TIER FIRST — its own numeral pattern reads a grouped or decimal figure whole,
        //    and the steps below split precisely those.
        s = SYMBOLS(s);

        // 2) DE-GROUPING, BY THE THREE-DIGIT TEST ON BOTH MARKS. The comma groups throughout; the dot groups
        //    exactly once, inside a quoted German figure.
        s = Rewrite(s, DEGROUP_COMMA, m => m.Groups[1].Value + COMMAS.Replace(m.Groups[2].Value, ""));
        s = Rewrite(s, DEGROUP_DOT, m => m.Groups[1].Value + DOTS.Replace(m.Groups[2].Value, ""));

        // 3) THE DECIMAL DOT, NEUTRALISED — no decimal word is sourceable, so the mark is spent rather than
        //    spoken. The guard declines an IP address: a decimal has exactly ONE dot.
        s = Rewrite(s, DECIMAL_DOT, "$1 $2");

        // 4) THE COORDINATE, which the corpus glosses for itself.
        s = Rewrite(s, COORD_N, "$1 kēkelē $2 minuke ʻākau");
        s = Rewrite(s, COORD_W, "$1 kēkelē $2 minuke komohana");
        s = Rewrite(s, COORD_BARE, "$1 kēkelē $2 minuke ");

        // 5) DEGREES — the scale letter is left to the shared cardinal path.
        s = Rewrite(s, DEGREE, "$1 kēkelē ");

        // 6) THE CLOCK — the writer supplies `hola`, so only the colon is spent.
        s = Rewrite(s, CLOCK, "$1 $2");

        // 7) RANGES — the dash is spent on a pause rather than a connective.
        s = Rewrite(s, RANGE_DASH, "$1, ");
        s = Rewrite(s, RANGE_HYPHEN, "$1, $2");

        // A padded replacement doubles a space that was already there.
        return Rewrite(s, MULTI_SPACE, " ");
    }
}
