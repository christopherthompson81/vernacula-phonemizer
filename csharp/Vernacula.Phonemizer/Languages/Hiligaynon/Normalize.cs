/**
 * Hiligaynon (hil) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/hiligaynon/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Hiligaynon;

public static class Normalize
{
    /** The shared symbol tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "porsiyento" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["₱"] = new[] { "piso" },
        },
        Magnitudes = new[] { "libo", "milyon", "bilyon", "trilyon" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometro" },
            ["m"] = new[] { "metro" },
            ["cm"] = new[] { "sentimetro" },
            ["mm"] = new[] { "milimetro" },
            ["kg"] = new[] { "kilo" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kwadrado" },
            Position = ExponentPosition.After,
        },
        UnitPer = "kada",
        RateDenominators = new Dictionary<string, string>
        {
            ["h"] = "oras",
        },
        Ampersand = "kag",
    });

    /** Dotted abbreviations, and the list is SHORT ON PURPOSE — see the header note at step 6. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "Doktor", ["jr"] = "Junior", ["sr"] = "Senior", ["st"] = "Santo",
        ["mr"] = "Ginoo", ["mrs"] = "Ginang", ["prof"] = "Propesor", ["fr"] = "Padre",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe GROUPED = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    // The `a?las` lookbehind is the guard: the corpus's other colons are a standard's number (`ISO 20715:2023`).
    private static readonly JsRe CLOCK = JsRegex.Compile("(?<=(?:a?las)[- ])(?<![\\d.:])([01]?\\d|2[0-3]):([0-5]\\d)(?!\\d)", "giu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<!\\b(?:hasta|asta|tubtob|tubtub|halin sa|halin)\\s)(?<![\\d.,\\p{L}-])(\\d[\\d,]*(?:\\.\\d+)?)\\s?[-–]\\s?(\\d[\\d,]*(?:\\.\\d+)?)(?![\\d,-]|\\.\\d)",
        "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)\\.(\\d{1,2})(?![\\d.,])", "gu");
    private static readonly JsRe ABBREV = JsRegex.Compile($"\\b({ABBREV_ALT})\\.", "giu");
    private static readonly JsRe IKA_LINKER = JsRegex.Compile("(?<![\\p{L}\\p{M}])(ika-\\d+)ng(?![\\p{L}\\p{M}])", "giu");
    // Lower case only, and bounded against dot, slash, colon and hyphen — the collisions are in upper case.
    private static readonly JsRe SG = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}.:/-])sg(?![\\p{L}\\p{M}\\p{Nd}.:/-])", "gu");

    /** The clock reading: on the hour the minutes drop out, else they join with `kag`. */
    private static string Clock(string h, string min) =>
        Js.Number(min) == 0
            ? Js.NumberToString(Js.Number(h))
            : $"{Js.NumberToString(Js.Number(h))} kag {Js.NumberToString(Js.Number(min))}";

    /** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
    public static string NormalizeHiligaynon(string input)
    {
        var s = input;

        s = Rewrite(s, GROUPED, m => COMMAS.Replace(m.Value, ""));

        s = Rewrite(s, CLOCK, m => Clock(m.Groups[1].Value, m.Groups[2].Value));

        s = SYMBOLS(s);

        s = Rewrite(s, RANGE, "$1 hasta $2");

        s = Rewrite(s, DECIMAL, m =>
            $"{m.Groups[1].Value} punto {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        s = Rewrite(s, ABBREV, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122) — the pattern is built from this table's own keys but
            // carries `i`+`u`, so JS's fold widens it and a near-miss matches while its key is absent.
            DOTTED_ABBREV.TryGetValue(Js.ToLowerCase(m.Groups[1].Value), out var w) ? w : m.Value);

        s = Rewrite(s, IKA_LINKER, "$1 nga");

        s = Rewrite(s, SG, "sang");

        return s;
    }
}
