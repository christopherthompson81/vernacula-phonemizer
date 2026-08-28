/**
 * Malagasy (mg) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/malagasy/normalize.ts — see that file for the corpus evidence behind every
 * rule, every declined class, and the sourcing of each word in the symbol tier.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Malagasy;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "isan-jato" },
        // ⚠ INSERTION-ORDERED: keys sort longest-first STABLY, so declaration order breaks ties.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dolara" },
            ["US$"] = new[] { "dolara amerikana" },
            ["€"] = new[] { "eorô" },
            ["Ar"] = new[] { "ariary" },
        },
        Magnitudes = new[] { "arivo", "tapitrisa", "lavitrisa" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilaometatra" },
            ["m"] = new[] { "metatra" },
            ["cm"] = new[] { "santimetatra" },
            ["kg"] = new[] { "kilao" },
            ["mm"] = new[] { "milimetatra" },
            ["l"] = new[] { "litatra" },
            ["L"] = new[] { "litatra" },
            // ⚠ NOT AN SI UNIT — the POPULATION abbreviation, the numerator of the only rate this corpus writes.
            ["mp"] = new[] { "mponina" },
        },
        UnitPer = "isaky ny",
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "toradroa" }, Cubed = new[] { "toratelo" }, Position = ExponentPosition.After,
        },
        Ampersand = "sy",
    });

    /** The two Malagasy abbreviations the corpus writes as bare consonant runs — see the TS table. */
    private static readonly (JsRe Re, string Words)[] ABBREVIATIONS =
    {
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])sns(?![\\p{L}\\p{M}])", "gu"), "sy ny sisa"),
        (JsRegex.Compile("(?<![\\p{L}\\p{M}])snm(?![\\p{L}\\p{M}])", "gu"), "sy ny manaraka"),
    };

    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;", "gu");
    private static readonly JsRe SPACE_GROUPED = JsRegex.Compile(
        "(?<![\\p{Nd}.,])(\\p{Nd}{1,3}(?:(?<!(?<!\\p{Nd})0)[ \\u00a0\\u202f\\u2009]\\p{Nd}{3})+)(?!\\p{Nd})", "gu");
    private static readonly JsRe GROUP_SPACES = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");
    private static readonly JsRe DOT_GROUPED = JsRegex.Compile(
        "(?<![\\p{Nd}.,])(\\p{Nd}{1,3}(?:(?<!(?<!\\p{Nd})0)\\.\\p{Nd}{3})+)(?![\\p{Nd}.,°])", "gu");
    private static readonly JsRe DEGREE_SCALE = JsRegex.Compile(
        "(\\p{Nd}+(?:[.,]\\p{Nd}+)?)\\s*°\\s*[CF](?![\\p{L}])", "giu");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(
        "(?<!faha\\s{0,3}\\p{Nd}{0,4})(\\p{Nd}+(?:[.,]\\p{Nd}+)?)\\s*°", "gu");
    private static readonly JsRe PERCENT_GENITIVE = JsRegex.Compile("%\\s*n['’]", "gu");
    private static readonly JsRe RUN_OF_SPACES = JsRegex.Compile(" {2,}", "gu");
    private static readonly JsRe TRAILING_SPACES = JsRegex.Compile(" +$", "u");
    private static readonly JsRe DIGIT_BEFORE_SY_NY = JsRegex.Compile("(?<=\\p{Nd})(?=sy ny )", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile(
        "(?<![\\p{Nd}.,])(\\p{Nd}+)[.,](\\p{Nd}+)(?![\\p{Nd}.,])", "gu");

    /** Every rule emits Malagasy WORDS or ASCII digits; nothing reaches the phoneme sink as a spelling. */
    public static string NormalizeMalagasy(string input)
    {
        var s = input;

        // 1) `&nbsp;` — French thin-space typography, and it must become a real space or every guard below
        //    sees a LETTER run where it expects a boundary.
        s = Rewrite(s, NBSP_ENTITY, " ");

        // 2) THOUSANDS GROUPED WITH A SPACE — the defect with no symptom.
        s = Rewrite(s, SPACE_GROUPED, m => GROUP_SPACES.Replace(m.Value, ""));

        // 3) THOUSANDS GROUPED WITH A PERIOD — only at exactly three digits, and only when no `°` follows.
        s = Rewrite(s, DOT_GROUPED, m => m.Value.Replace(".", "", StringComparison.Ordinal));

        // 4) DEGREES — `degre`, POSTPOSED. The scale letter is CONSUMED, case-insensitively.
        s = Rewrite(s, DEGREE_SCALE, "$1 degre ");
        //    ⚠ `taonjato faha 17°` is an ORDINAL, not a degree; only the preceding `faha` separates them.
        s = Rewrite(s, DEGREE_BARE, "$1 degre ");

        // 5) PERCENT — the bound genitive is written on the SIGN and has to move onto the WORD.
        s = Rewrite(s, PERCENT_GENITIVE, " isan-jaton'");
        //    Steps 4 and 5 emit a padding space; where the source already had one, collapse the pair.
        s = Rewrite(Rewrite(s, RUN_OF_SPACES, " "), TRAILING_SPACES, "");

        // 5b) THE MALAGASY ABBREVIATIONS — BEFORE the tier, so nothing in the expansion collides with a unit
        //     key. ⚠ The guard excludes LETTERS, not word characters: the corpus fuses `snm` to a digit.
        foreach (var (re, words) in ABBREVIATIONS) s = Rewrite(s, re, words);
        //     ⚠ The separator is restored only where one is MISSING — a global tidy-up rewrote a corpus
        //     line whose spaced semicolon is pinned by a golden.
        s = Rewrite(s, DIGIT_BEFORE_SY_NY, " ");

        // 6) THE SHARED TIER — ABOVE step 7, because a unit matches only with a NUMBER adjacent and the
        //    decimal rewrite destroys that adjacency.
        s = SYMBOLS(s);

        // 7) THE DECIMAL SEPARATOR — `faingo`, fed by BOTH marks; the fractional digits are said one at a time.
        s = Rewrite(s, DECIMAL, m =>
            $"{m.Groups[1].Value} faingo {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 8) The minus, `=`/`×`, ranges and the clock are all DECLINED — see the TS for each count.
        return s;
    }
}
