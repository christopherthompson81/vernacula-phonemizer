/**
 * Yoruba text normalization — the symbols a reader voices, rewritten to words before the tokenizer sees them.
 * Ported from src/languages/yoruba/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Yoruba;

public static class Normalize
{
    private static YorubaSymbols SYM => Manifest.MANIFEST.Symbols;

    /**
     * ⚠ NO `Percent` AND NO `PercentPrefix`, AND THE SABOTAGE SWEEP IS WHAT PROVED IT. Both were declared and
     * both were DEAD: rule 3 below consumes every `%` in the string before this tier ever runs, because Yoruba's
     * percent is a CIRCUMFIX (`ìdá 84 nínú ọgọ́rùn-ún`) and `PercentPrefix` can only move ONE word to the front.
     * Wrecking the manifest key moved zero readings. Removed rather than left as documentation: a tier field
     * read by nothing is a false statement about where this language's percent word comes from.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = Manifest.MANIFEST.Symbols.And,
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { Manifest.MANIFEST.Symbols.Squared }, Position = ExponentPosition.After,
        },
        Currency = Manifest.MANIFEST.SymbolTier.Currency,
        Units = Manifest.MANIFEST.SymbolTier.Units,
        RateDenominators = Manifest.MANIFEST.SymbolTier.RateDenominators,
        UnitPer = Manifest.MANIFEST.SymbolTier.UnitPer,
    });

    private static readonly JsRe GROUPED = JsRegex.Compile("(\\d),(\\d{3})(?!\\d)", "gu");
    /** A digit-flanked dash. See rule 2: in Yoruba this is a RANGE, never a minus. */
    private static readonly JsRe RANGE = JsRegex.Compile("(\\d)\\s*[-–—]\\s*(?=\\d)", "gu");
    /** U+2212 ONLY, and LEADING — see the TS module. The hyphen is this language's range mark and its own
     *  compounding; `(?<!\p{Nd}\s)` refuses the space-separated exponent this corpus writes. */
    private static readonly JsRe MINUS = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\p{Nd}])(?<!\\p{Nd}\\s)\u2212(?=\\p{Nd})", "gu");
    /** `60%`, `8.3%` — the sign FOLLOWS the number here; none lead it. */
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d+(?:\\.\\d+)?)\\s*%", "gu");
    private static readonly JsRe PERCENT_PAREN = JsRegex.Compile("\\(\\s*(\\d+(?:\\.\\d+)?)\\s*%\\s*\\)", "gu");

    private static readonly JsRe MARKS = JsRegex.Compile("\\p{M}+", "gu");
    private static string Fold(string x) =>
        MARKS.Replace(x.Normalize(System.Text.NormalizationForm.FormD), "").ToLowerInvariant();
    /** The percent circumfix already spelled out in the text, so the rule does not read it a second time. */
    private static readonly JsRe SAID_AFTER = JsRegex.Compile("ninu\\s+[oọ]g[oọ]run", "u");
    private static readonly JsRe SAID_BEFORE = JsRegex.Compile("(?:[iì]da|[iì]pin)\\s*$", "u");

    /**
     * The bare metre, read here rather than through the shared unit tier. ⚠ The `(?<!\p{Nd}h[ ])` guard is what
     * declines the `9h 50m 30.0s` duration notation, where the `m` is MINUTES and not a metre.
     */
    private static readonly JsRe METRE = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d.,])(?<!\\p{Nd}h[ \u00a0])(\\d+(?:\\.\\d+)?)[ \u00a0]?m(?![\\p{L}\\p{M}'’\\d])", "gu");
    private const string METRE_WORD = "mítà";

    /** The unit nouns this layer expands, and a squared one with no number necessarily beside it. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORDS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kìlómítà", ["ha"] = "hẹ́kítà",
    };
    /** The remaining `units` keys `sq` may precede (see `SQ_PREFIX`). Kept beside `UNIT_WORDS` rather than
     *  merged into it, because that table is also `UNIT_SQUARED`'s. */
    private static readonly IReadOnlyDictionary<string, string> SQ_UNITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["mi"] = "máìlì", ["ft"] = "ẹsẹ̀ bàtà",
    };
    private static readonly JsRe UNIT_SQUARED = JsRegex.Compile("(?<![\\p{L}\\p{M}])(km|ha)\\s*²", "gu");
    private static readonly JsRe SQ_PREFIX = JsRegex.Compile("(?<![\\p{L}\\p{M}])sq\\.?\\s*(km|ha|mi|ft)(?![\\p{L}\\p{M}\\d])", "giu");
    /** `38°C`, `79.63 °F` — a number, the sign, and a scale letter. The bare ° is refused; see the header. */
    private static readonly JsRe SCALED_DEGREE = JsRegex.Compile("(\\d+(?:\\.\\d+)?)\\s*°\\s*([CFK])(?![\\p{L}\\p{M}])", "gui");
    /** A digit-flanked ×: relay legs, dimensions and resolutions. */
    private static readonly JsRe TIMES = JsRegex.Compile("(\\d)\\s*×\\s*(?=\\d)", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)\\.(\\d+)", "gu");
    private static readonly JsRe RUNS = JsRegex.Compile("[ \\t]{2,}", "gu");

    /**
     * Normalize Yoruba text: symbols the reader voices become words, before `yoruba.ts`'s TOKEN sees them.
     */
    public static string NormalizeYoruba(string text)
    {
        var s = text;
        // The TS loops on `GROUPED.test`, resetting `lastIndex` each turn; a stateless IsMatch is the same loop
        // without the reset.
        while (GROUPED.IsMatch(s)) s = GROUPED.Replace(s, "$1$2");
        s = RANGE.Replace(s, $"$1 {SYM.Range} ");
        s = MINUS.Replace(s, $"{SYM.Negative} ");
        {
            var subject = s;
            s = PERCENT_PAREN.Replace(s, m =>
                SAID_AFTER.IsMatch(Fold(subject[Math.Max(0, m.Index - 60)..m.Index])) ? "" : m.Value);
        }
        {
            var subject = s;
            s = PERCENT.Replace(s, m =>
            {
                var num = m.Groups[1].Value;
                var at = m.Index;
                return SAID_AFTER.IsMatch(Fold(subject[at..Math.Min(subject.Length, at + 40)]))
                    || SAID_BEFORE.IsMatch(Fold(subject[Math.Max(0, at - 20)..at]))
                    ? num
                    : $"{SYM.PercentBefore} {num} {SYM.PercentAfter}";
            });
        }
        s = UNIT_SQUARED.Replace(s, m =>
        {
            var u = m.Groups[1].Value;
            return $"{(UNIT_WORDS.TryGetValue(u, out var w) ? w : u)} {SYM.Squared}";
        });
        s = SQ_PREFIX.Replace(s, m =>
        {
            var u = m.Groups[1].Value.ToLowerInvariant();
            var w = UNIT_WORDS.TryGetValue(u, out var a) ? a : SQ_UNITS.TryGetValue(u, out var b) ? b : m.Groups[1].Value;
            return $" {w} {SYM.Squared}";
        });
        s = SYMBOLS(s);
        // ⚠ THE BARE METRE RUNS AFTER THE TIER, so every shape the tier can read (`10 km`, `56 km²`, `100 km/h`)
        // consumes its `m` there first — and before the decimal rule, which still needs `8.62` intact.
        s = METRE.Replace(s, m => $"{m.Groups[1].Value} {METRE_WORD}");
        s = SCALED_DEGREE.Replace(s, m =>
        {
            var letter = m.Groups[2].Value.ToUpperInvariant();
            var name = SYM.Scales.TryGetValue(letter, out var sc) ? sc : m.Groups[2].Value;
            return $"{SYM.Degree} {m.Groups[1].Value} {name}";
        });
        s = TIMES.Replace(s, $"$1 {SYM.Times} ");
        // ⚠ THE DECIMAL SEPARATOR LAST, AND THE ORDER IS LOAD-BEARING: run earlier it splits `8.3%` so the
        // percent circumfix wraps only one half, and turns `100.4°F` into two numbers before the scale is read.
        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} {SYM.DecimalWord} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");
        return RUNS.Replace(s, " ");
    }
}
