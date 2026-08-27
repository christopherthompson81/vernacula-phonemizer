/**
 * Cebuano (ceb) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks.
 * Ported from src/languages/cebuano/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Cebuano;

public static class Normalize
{
    /** The shared symbol tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "ug",
        Multiply = new MultiplyDef { Times = "ka pilo" },
        Percent = CebuanoPhonemizer.DEF.SymbolTier.Percent,
        Currency = CebuanoPhonemizer.DEF.SymbolTier.Currency,
        Units = CebuanoPhonemizer.DEF.SymbolTier.Units,
        RateDenominators = CebuanoPhonemizer.DEF.SymbolTier.RateDenominators,
        UnitPer = CebuanoPhonemizer.DEF.SymbolTier.UnitPer,
        ExponentWords = CebuanoPhonemizer.DEF.SymbolTier.ExponentWords,
        Magnitudes = CebuanoPhonemizer.DEF.SymbolTier.Magnitudes,
    });

    /** Dotted abbreviations, and the list is SHORT ON PURPOSE — see the header note at step 6. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "Doktor", ["jr"] = "Junior", ["sr"] = "Senior", ["st"] = "Santo",
        ["mr"] = "Ginoo", ["mrs"] = "Ginang", ["prof"] = "Propesor",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe GROUPED = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<![\\d.:])([01]?\\d|2[0-3]):([0-5]\\d)\\b(?!\\.?\\d)", "gu");
    private static readonly JsRe CLOCK_DOT = JsRegex.Compile(
        "(?<![\\d.:])([01]?\\d|2[0-3])\\.([0-5]\\d)(?!\\d)(?=\\s*(?:GMT|UTC|[ap]\\.?m\\b|sa (?:buntag|hapon|gabii)))", "giu");
    private static readonly JsRe CLOCK_MILITARY = JsRegex.Compile("(?<![\\d.:])([01]\\d|2[0-3])([0-5]\\d)(?!\\d)(?=\\s*(?:GMT|UTC))", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)\\.(\\d{1,2})(?![\\d.,])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<!\\b(?:ngadto sa|hangtod|hangtud|gikan sa)\\s)(?<![\\d.,\\p{L}-])(\\d+)\\s?[-–]\\s?(\\d+)(?![\\d.,-])", "gu");
    private static readonly JsRe ABBREV = JsRegex.Compile($"\\b({ABBREV_ALT})\\.", "giu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");

    /** The clock reading: on the hour the minutes drop out, else they are joined with `ug`. */
    private static string Clock(string h, string min) =>
        Js.Number(min) == 0
            ? Js.NumberToString(Js.Number(h))
            : $"{Js.NumberToString(Js.Number(h))} ug {Js.NumberToString(Js.Number(min))}";

    /**
     * Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them.
     */
    public static string NormalizeCebuano(string input)
    {
        var s = input;

        s = GROUPED.Replace(s, m => COMMAS.Replace(m.Value, ""));

        s = CLOCK_COLON.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value));
        s = CLOCK_DOT.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value));
        s = CLOCK_MILITARY.Replace(s, m => Clock(m.Groups[1].Value, m.Groups[2].Value));

        s = SYMBOLS(s);

        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} punto {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        s = RANGE.Replace(s, "$1 ngadto sa $2");

        s = ABBREV.Replace(s, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122) — the pattern is built from this table's own keys but
            // carries `i`+`u`, so JS's fold widens it and a near-miss matches while its key is absent.
            DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? w : m.Value);

        s = FRACTION.Replace(s, m =>
            Js.Number(m.Groups[1].Value) == 1 && Js.Number(m.Groups[2].Value) == 2
                ? "tunga"
                : $"{m.Groups[1].Value} kabahin sa {m.Groups[2].Value}");

        s = PLUS_ATTACHED.Replace(s, "$1 dugang $2");
        s = PLUS_LEADING.Replace(s, "$1dugang $2");

        return s;
    }
}
