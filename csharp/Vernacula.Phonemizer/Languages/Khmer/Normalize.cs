/**
 * Khmer text normalization — the symbols and marks the tokenizer cannot see, rewritten as Khmer words, plus
 * the ៗ iteration mark (repeat the preceding WORD, from the segmenter).
 * Ported from src/languages/khmer/normalize.ts — see that file for every reading's corpus attestation and
 * for why each refused class stays refused.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Khmer;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "ភាគរយ" },
        // ⚠ INSERTION-ORDERED, matching the TS object literal: the tier's longest-first sort is stable, so
        // declaration order is the tie-break.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "ដុល្លារ" },
            ["៛"] = new[] { "រៀល" },
            ["€"] = new[] { "អឺរ៉ូ" },
            ["£"] = new[] { "ផោន" },
            ["US$"] = new[] { "ដុល្លារអាមេរិក" },
            ["CN¥"] = new[] { "យូអាន" },
        },
        // ⚠ THE UNIT KEYS MUST BE LOWERCASE — the tier looks a match up as `units[u.ToLowerInvariant()]`.
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["គម"] = new[] { "គីឡូម៉ែត្រ" },
            ["km"] = new[] { "គីឡូម៉ែត្រ" },
            ["°c"] = new[] { "អង្សាសេ" },
            ["℃"] = new[] { "អង្សាសេ" },
            ["°"] = new[] { "អង្សា" },
        },
        Magnitudes = new[]
        {
            "ពាន់លាន",
            "រយពាន់",
            "រយកោដិ",
            "ពាន់កោដិ",
            "រយលាន",
            "ដប់កោដិ",
            "លាន",
            "ពាន់",
            "ម៉ឺន",
            "កោដិ",
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ការេ" },
            Position = ExponentPosition.Suffix,
        },
        Multiply = new MultiplyDef { Times = "គុណ" },
        Ampersand = "និង",
        UnspacedScript = true,
    });

    /** Khmer letters, marks and signs — the run the tokenizer treats as one unit. Excludes ៗ by construction. */
    private const string KH = "ក-៓ៜ៝";
    /** Both digit ranges, always together. */
    private const string D = "\\d០-៩";
    /** ⚠ A SEPARATOR IN KHMER INCLUDES ZERO-WIDTH SPACE, AND `\s` DOES NOT MATCH IT — in either engine.
     *  Written as escapes because the TS source's literal ZWSP/ZWNJ are invisible. */
    private const string SEP = "[\\s\u200b\u200c]*";

    private static readonly JsRe REPEAT = JsRegex.Compile($"([{KH}]+){SEP}ៗ", "gu");
    private static readonly JsRe DEGROUP = JsRegex.Compile($"(?<=[{D}])(?<!(?<![{D}\\.,])0),(?=[{D}]{{3}}(?![{D}]))", "gu");
    private static readonly JsRe DEGROUP_SPACE = JsRegex.Compile(
        $"(?<=[{D}])(?<!(?<![{D}\\.,])0)[ \u00a0\u202f\u2009\u200b](?=[{D}]{{3}}(?![{D}]))", "gu");
    private static readonly JsRe DECIMAL_POINT = JsRegex.Compile($"(?<=[{D}])\\.(?=[{D}])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile($"(?<=[{D}]),(?=[{D}])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile($"(?<=[{D}]){SEP}[–—-]{SEP}(?=[{D}])", "gu");
    private static readonly JsRe EQUALS_DIGITS = JsRegex.Compile($"(?<=[{D}]){SEP}={SEP}(?=[{D}])", "gu");
    private static readonly JsRe EQUALS_SPACED = JsRegex.Compile(
        $"(?<![=!<>])(?<=[{D}\\p{{L}}\\p{{M}}²³)]) = (?=[{D}\\p{{L}}\\p{{M}}(])(?![=<>])", "gu");
    private static readonly JsRe PLUS_DIGITS = JsRegex.Compile($"(?<=[{D}]){SEP}\\+{SEP}(?=[{D}])", "gu");
    private static readonly JsRe PLUS_SPACED = JsRegex.Compile(
        $"(?<=[{D}\\p{{L}}\\p{{M}}²³)]) \\+ (?=[{D}\\p{{L}}\\p{{M}}(])", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}{D}%‰\\\\)])\\+{SEP}(?=[{D}])", "gu");
    private static readonly JsRe PLUS_TZ = JsRegex.Compile($"(?<=[A-Z]{{2,4}})\\+(?=[{D}])", "gu");
    private static readonly JsRe PLUSMINUS = JsRegex.Compile($"(?<=[{D}]){SEP}±{SEP}(?=[{D}])", "gu");
    private static readonly JsRe PLUSMINUS_LEADING = JsRegex.Compile($"(?<![{D}])±{SEP}(?=[{D}])", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile($"(?<![{D}{KH}])[-−–](?=[{D}])", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile($"(?<=[{D}]){SEP}÷{SEP}(?=[{D}])", "gu");
    private static readonly JsRe LESS = JsRegex.Compile($"(?<=[{D}]){SEP}<{SEP}(?=[{D}])", "gu");
    private static readonly JsRe GREATER = JsRegex.Compile($"(?<=[{D}]){SEP}>{SEP}(?=[{D}])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile($"(?<=[{D}]){SEP}/{SEP}(?=[{D}])", "gu");

    /** The final word of a Khmer run — the perceptron's answer, or the unigram segmenter's when unavailable. */
    private static string LastWord(string run)
    {
        if (!KhmerPerceptron.HavePerceptron()) return Segment.LastKhmerWord(run);
        var parts = KhmerPerceptron.SegmentRun(run);
        return parts.Count > 0 ? parts[^1] : run;
    }

    public static string NormalizeKhmer(string text)
    {
        var s = text;

        // 1. ៗ (លេខទោ) = repeat the preceding WORD. FIRST, because it is the only rule that reads a Khmer run.
        s = Rewrite(s, REPEAT, m =>
        {
            var run = m.Groups[1].Value;
            return run == "" ? "" : $"{run} {LastWord(run)}";
        });

        // 2. de-group thousands (comma, then the space-grouped forms). Applied repeatedly because the
        // lookbehind cannot span a group it has already consumed.
        for (var i = 0; i < 4 && DEGROUP.IsMatch(s); i++) s = Rewrite(s, DEGROUP, "");
        for (var i = 0; i < 4 && DEGROUP_SPACE.IsMatch(s); i++) s = Rewrite(s, DEGROUP_SPACE, "");

        // 3. decimal point / comma → a space, AFTER de-grouping (which is the entire discrimination).
        s = Rewrite(s, DECIMAL_POINT, " ");
        s = Rewrite(s, DECIMAL_COMMA, " ");

        // 4. ranges, BEFORE the arithmetic rule — both compete for a hyphen and the range wins 4,014:399.
        s = Rewrite(s, RANGE, " ដល់ ");

        // 5. equals — digit-flanked, then the SPACED operand-flanked shape.
        s = Rewrite(s, EQUALS_DIGITS, " ស្មើ ");
        s = Rewrite(s, EQUALS_SPACED, " ស្មើ ");

        // 5b. plus, and plus-minus.
        s = Rewrite(s, PLUS_DIGITS, " បូក ");
        s = Rewrite(s, PLUS_SPACED, " បូក ");
        s = Rewrite(s, PLUS_LEADING, "វិជ្ជមាន ");
        s = Rewrite(s, PLUS_TZ, " បូក ");
        s = Rewrite(s, PLUSMINUS, " បូក ឬ ដក ");
        s = Rewrite(s, PLUSMINUS_LEADING, "បូក ឬ ដក ");

        // 6. minus — AFTER step 4, which has claimed every dash BETWEEN two numbers.
        s = Rewrite(s, MINUS, "ដក ");

        // 6b. divide, less-than, greater-than — robustness; zero digit-flanked instances in this corpus.
        s = Rewrite(s, DIVIDE, " ចែក ");
        s = Rewrite(s, LESS, " តិចជាង ");
        s = Rewrite(s, GREATER, " ច្រើនជាង ");

        // 7. fractions — NUM ភាគ NUM, the language's own construction.
        s = Rewrite(s, FRACTION, " ភាគ ");

        // 8. the shared symbol tier, LAST: it works on numbers the rules above have finished shaping.
        s = SYMBOLS(s);

        return s;
    }
}
