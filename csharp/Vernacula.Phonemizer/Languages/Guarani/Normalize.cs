/**
 * Paraguayan Guaraní (gn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/guarani/normalize.ts, whose header carries the corpus counts behind every
 * word chosen and the refusals behind every class declined (the hectare, the rate, the decimal word,
 * the arc-minute, the minute clock). Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Guarani;

public static class Normalize
{
    /**
     * The shared symbol tier. Every word is attested in the slot on gn.wikipedia — `kilómetro` and
     * `kilogramo` from articles that name their own abbreviation in Guaraní prose; `sua` is the
     * engine's own scale word; `por ciento` is the one spelled-out percent the corpus has, taken for
     * the reason the TS header states. `ha` is NOT a key — the coordinator and the ordinal own every
     * digit-adjacent instance of it, and the TS header is the measurement that says so.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "por ciento" },
        // ⚠ INSERTION-ORDERED, like JS `Object.keys`: the tier sorts currency keys longest-first, stably.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "dólar" },
            ["$"] = new[] { "dólar" },
        },
        Magnitudes = ["sua"],
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilómetro" },
            ["m"] = new[] { "metro" },
            ["cm"] = new[] { "centímetro" },
            ["mm"] = new[] { "milímetro" },
            ["kg"] = new[] { "kilogramo" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "cuadrado" }, Cubed = new[] { "cúbico" }, Position = ExponentPosition.After,
        },
    });

    /** Read from the manifest — see the jsonc, where the evidence lives. */
    private static readonly string ORDINAL_SUFFIX = Manifest.MANIFEST.OrdinalSuffix;

    // ── 1. THE PUSO — the three glyphs the engine must fold to the one `graphemes` reads. ──
    // ʼ U+02BC, ’ U+2019, ꞌ U+A78C (saltillo), Ꞌ U+A78B.
    private static readonly JsRe PUSO = JsRegex.Compile("[\u02bc\u2019\ua78c\ua78b]", "gu");

    // ── 2. ZERO-WIDTH MARKS — ZWSP, ZWNJ, ZWJ, BOM. ──
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\u200b\u200c\u200d\ufeff]", "gu");

    // ── 3. º/ª STANDING IN FOR THE DEGREE SIGN — before step 4 deletes the leftovers. ──
    private static readonly JsRe DEGREE_STANDING_IN =
        JsRegex.Compile(@"(\d\s*)[ºª](\s*[CF](?![\p{L}\p{M}]))", "gu");

    // ── 4. THE MARKS THAT READ AS PHONEMES OR AS NOTHING — a declared refusal, not a reading. ──
    private static readonly JsRe ORDINAL_INDICATOR = JsRegex.Compile("[ºª]", "gu");
    private static readonly JsRe ARC_MINUTE =
        JsRegex.Compile(@"(?<=\d)\s*['´′″“”]+(?![\p{L}\p{M}\d])", "gu");

    // ── 5. TEMPERATURE — the SCALE name only; the degree word is deliberately withheld. ──
    private static readonly JsRe CELSIUS = JsRegex.Compile(@"(\d)\s*°\s*C(?![\p{L}\p{M}])", "gui");
    private static readonly JsRe FAHRENHEIT = JsRegex.Compile(@"(\d)\s*°\s*F(?![\p{L}\p{M}])", "gui");

    // ── 6. DE-GROUP THOUSANDS — period and the three space forms. ──
    private static readonly JsRe GROUP_DOT =
        JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2}(?:\.\d{3})+)(?!\d)", "gu");
    // space, NBSP, NNBSP, thin space
    private static readonly JsRe GROUP_SPACE =
        JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)", "gu");
    // NBSP, NNBSP, thin space
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile(@"[\s\u00a0\u202f\u2009]", "gu");

    // ── 7. THE ORDINAL SUFFIX -ha GLUED TO DIGITS — the operand is worded INSIDE the rule. ──
    private static readonly JsRe ORDINAL =
        JsRegex.Compile(@"(?<![\d.,])(\d{1,6})ha(?![\p{L}\p{M}]|\s*\d)", "gu");

    // ── 9. THE DECIMAL SEPARATOR — read as a pause, not as a word. ──
    private static readonly JsRe DECIMAL_LEADING_ZERO =
        JsRegex.Compile(@"(?<![\d.,])(0)\.(\d{3})(?![\d.,])", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile(@"(?<=\d)\.(?=\d{1,2}(?![\d.]))", "gu");

    // ── 10. YEAR SPANS — guive … peve, four digits on both sides. ──
    private static readonly JsRe YEAR_SPAN =
        JsRegex.Compile(@"(?<![\d.,–—-])(\d{4})\s?[-–—]\s?(\d{4})(?![\d–—-]|[.,]\d)", "gu");

    // ── 11. THE CLOCK — on the hour only; a following `aravo` is declined. ──
    private static readonly JsRe CLOCK =
        JsRegex.Compile(@"(?<![\d.,:])([01]?\d|2[0-3]):00(?![\d.,:])(?!\s*aravo(?![\p{L}\p{M}]))", "gu");

    /** Normalize one Guaraní string. The steps are ORDER-DEPENDENT; the TS states each coupling. */
    public static string NormalizeGuarani(string input)
    {
        var s = input;

        // 1) THE PUSO, FIRST, ABOVE EVERYTHING — a LETTER fix, and it must live here rather than in
        //    PhonemizeWord, because for U+02BC the tokenizer has already split the word by the time the
        //    scan runs.
        s = Rewrite(s, PUSO, "'");

        // 2) ZERO-WIDTH MARKS, deleted not spaced — the two halves are one word plus its bound
        //    postposition.
        s = Rewrite(s, ZERO_WIDTH, "");

        // 3) º/ª STANDING IN FOR °, folded before 4) eats the survivors.
        s = Rewrite(s, DEGREE_STANDING_IN, "$1°$2");

        // 4) THE ORDINAL INDICATOR, deleted — an unreadable mark, not an ordinal to invent. AND THE
        //    ARC-MINUTE MARKS after digits, guarded on a digit to the left and no letter to the right,
        //    so no intra-word puesto can be reached.
        s = Rewrite(s, ORDINAL_INDICATOR, "");
        s = Rewrite(s, ARC_MINUTE, "");

        // 5) TEMPERATURE — "39 Celsius", NOT "39 degrees Celsius"; an under-reading, never a wrong one.
        s = Rewrite(s, CELSIUS, "$1 Celsius");
        s = Rewrite(s, FAHRENHEIT, "$1 Fahrenheit");

        // 6) DE-GROUPING, before every other numeric rule AND before the tier — or `1.098.581 km²`
        //    reaches the unit path as `581 km²`. The integer part may not begin with `0` (that is what
        //    separates grouping from a three-digit decimal), and the trailing guard rejects only a
        //    DIGIT, so a group followed by its own decimal comma still de-groups.
        //    ⚠ THE CALLBACK REWRITES A MATCHED SUBSTRING, so it stays off the seam.
        s = Rewrite(s, GROUP_DOT, m => m.Value.Replace(".", ""));
        s = Rewrite(s, GROUP_SPACE, m => JsRegex.Replace(m.Value, GROUP_SPACES, ""));

        // 7) THE ORDINAL SUFFIX — trap 14: a digit becomes words in the TOKENIZER, downstream of every
        //    rule here, so the operand is converted to WORDS inside the rule and the suffix attached to
        //    the last of them. A following digit-run refuses the match (the coordinator written tight).
        s = Rewrite(s, ORDINAL,
            m => $"{Numbers.NumberToWords(Js.Number(m.Groups[1].Value), m.Groups[1].Value)}{ORDINAL_SUFFIX}");

        // 8) THE SHARED TIER — %, $, units, the squared/cubed words. AFTER de-grouping, BEFORE the
        //    decimal fold (the `NOT_VERSION` guard on the one-letter `m` works by seeing the dot).
        s = SYMBOLS(s);

        // 9) THE DECIMAL SEPARATOR — the two conventions read alike; no decimal word is emitted. The
        //    `0.` head that step 6 refuses is admitted here, which is where `0.572` belongs.
        s = Rewrite(s, DECIMAL_LEADING_ZERO, "$1,$2");
        s = Rewrite(s, DECIMAL_DOT, ",");

        // 10) YEAR SPANS — `guive … peve`, both postpositions taking one operand each. Both operands
        //     exactly four digits; a hyphen chain is an identifier; the trailing guard is `[.,]\d`, not
        //     a bare `[.,]`, or every span that ends a clause is declined.
        s = Rewrite(s, YEAR_SPAN, "$1 guive $2 peve");

        // 11) THE CLOCK, on the hour only — `aravo` is sourced, the minute frame is not, so a non-zero
        //     time is refused whole, and a noun the text already wrote is not doubled.
        s = Rewrite(s, CLOCK, m => $"{Js.NumberToString(Js.Number(m.Groups[1].Value))} aravo");

        return s;
    }
}
