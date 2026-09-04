/**
 * Madurese (mad) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the Latin → IPA pipeline already speaks. Madurese writes BOTH separator
 * conventions, so only the DIGIT COUNT after a separator tells a thousands group from a decimal.
 * Ported from src/languages/madurese/normalize.ts — see that file for the corpus evidence and for the
 * four classes deliberately left unread.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Madurese;

public static class Normalize
{
    /** Not-a-letter, on both sides. `\b` cannot be used — see the TS header. */
    private const string L = "[\\p{L}\\p{M}]";

    /** The shared symbol tier. Madurese has no nominal plural, so every CountForms is a single entry. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "persen" },
        // ⚠ INSERTION-ORDERED and matched longest-first: `US$`/`AS$` must be declared before the bare `$`.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "dolar Amèrika" },
            ["AS$"] = new[] { "dolar Amèrika" },
            ["$"] = new[] { "dolar" },
            ["Rp"] = new[] { "rupiah" },
            ["€"] = new[] { "euro" },
        },
        Magnitudes = new[] { "èbu", "ebu", "juta", "jutah", "miliar", "milyad", "milyar", "triliun", "triliyun" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilomèter" },
            ["m"] = new[] { "mèter" },
            ["cm"] = new[] { "sèntimèter" },
            ["mm"] = new[] { "milimeter" },
            ["kg"] = new[] { "kilogram" },
            ["ha"] = new[] { "hèktar" },
        },
        UnitPer = "per",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["taon"] = "taon", ["detik"] = "detik", ["s"] = "detik", // `s` aliases `detik` (#1257)
        },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "persegi" }, Cubed = new[] { "kubik" } },
        Ampersand = "bân",
        Multiply = new MultiplyDef { Times = "kalè" },
    });

    /** Unit abbreviation → its Madurese noun, for the two RATE shapes the shared tier cannot reach. */
    private static readonly IReadOnlyDictionary<string, string> UNIT_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kilomèter", ["m"] = "mèter", ["cm"] = "sèntimèter",
        ["mm"] = "milimeter", ["kg"] = "kilogram", ["ha"] = "hèktar",
    };
    private static readonly IReadOnlyDictionary<string, string> EXP_WORD = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        [""] = "", ["²"] = " persegi", ["³"] = " kubik", ["2"] = " persegi", ["3"] = " kubik",
    };

    /** The clock words this corpus writes. */
    private const string HOUR_WORD = "(?:pokol|kol|jhâm|jam)";
    /** What marks a bare `H.MM`/`H:MM` as a TIME when no hour word precedes it. */
    private const string CLOCK_MARK = "(?:WIB|WITA|WIT|PM|AM|malem|bâkto)";

    private const string RATE_UNIT = "(km|cm|mm|kg|ha|m)";

    private static readonly JsRe CLOCK_HOUR_WORD =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])({HOUR_WORD})(\\s*)(\\d{{1,2}})[.:]00(?![\\d.:])", "giu");
    private static readonly JsRe CLOCK_MARKED =
        JsRegex.Compile($"(?<![\\d.:,])(\\d{{1,2}})[.:]00(?![\\d.:])(?=\\s*{CLOCK_MARK}(?!{L}))", "gu");
    private static readonly JsRe CLOCK_BARE_COLON =
        JsRegex.Compile("(?<![\\d.:,])([01]?\\d|2[0-3]):00(?![\\d.:])", "gu");

    private static readonly JsRe GROUPED_PERIOD = JsRegex.Compile("(?<![\\d.,])[1-9]\\d{0,2}(?:\\.\\d{3})+(?![\\d.])", "gu");
    private static readonly JsRe GROUPED_COMMA = JsRegex.Compile("(?<![\\d.,])(?!0,)[1-9]\\d{0,2}(?:,\\d{3})+(?![\\d,])", "gu");

    private static readonly JsRe COORD_DASH = JsRegex.Compile("(?<=\\d)(['’′″\"”º°]+)\\s*[-–—]\\s*(?=\\d)", "gu");

    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?[°º]\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?[°º]\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?[°º]\\s?", "gu");

    private static readonly JsRe PLUS_MINUS =
        JsRegex.Compile("(?<!(?:korang lebbi|ra-kèra|sakètar|kèra-kèra)\\s?)(?<![\\p{L}\\p{M}])±\\s*(?=\\d)", "gu");
    private static readonly JsRe PLUS_MINUS_DOUBLED =
        JsRegex.Compile("((?:korang lebbi|ra-kèra|sakètar|kèra-kèra)\\s?)±\\s*(?=\\d)", "gu");

    private static readonly JsRe ERA_SM = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])(\\d+)\\s?SM(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe ERA_M = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d])(\\d+)\\s?M(?![\\p{L}\\p{M}\\d])", "gu");

    private static readonly JsRe SLASH_RATE =
        JsRegex.Compile($"(?<={L})\\s?/\\s?{RATE_UNIT}(²|³|2|3)?(?![\\p{{L}}\\p{{M}}\\d])", "giu");
    private static readonly JsRe PER_RATE =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}])per\\s+{RATE_UNIT}(²|³|2|3)?(?![\\p{{L}}\\p{{M}}\\d])", "giu");

    private static readonly JsRe DPL =
        JsRegex.Compile("(?<![\\p{L}\\p{M}])(m[èe]t[èe]r)\\s+dpl(?![\\p{L}\\p{M}\\d])", "giu");

    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<![\\d.,\\p{L}\\p{M}/-])(\\d+(?:[.,]\\d+)?)\\s?[-–—]\\s?(\\d+(?:[.,]\\d+)?)(?![\\d\\p{L}\\p{M}/-]|[.,]\\d)",
        "gu");

    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<![\\d.,])(\\d+),(\\d{1,3})(?![\\d,])", "gu");
    private static readonly JsRe DECIMAL_PERIOD = JsRegex.Compile("(?<![\\d.,])(\\d+)\\.(\\d{1,3})(?![\\d,])(?!\\.\\d)", "gu");
    private static readonly JsRe HOUR_TAIL = JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}]){HOUR_WORD}\\s*$", "iu");

    /**
     * Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them.
     */
    public static string NormalizeMadurese(string input)
    {
        var s = input;

        // ── 1. THE CLOCK — FIRST, before any rule that reads a dot ──
        s = Rewrite(s, CLOCK_HOUR_WORD, m =>
            $"{m.Groups[1].Value}{m.Groups[2].Value}{Js.NumberToString(Js.Number(m.Groups[3].Value))}");
        s = Rewrite(s, CLOCK_MARKED, m => Js.NumberToString(Js.Number(m.Groups[1].Value)));
        s = Rewrite(s, CLOCK_BARE_COLON, m => Js.NumberToString(Js.Number(m.Groups[1].Value)));

        // ── 2. DE-GROUP THOUSANDS ──
        s = Rewrite(s, GROUPED_PERIOD, m => m.Value.Replace(".", "", StringComparison.Ordinal));
        s = Rewrite(s, GROUPED_COMMA, m => m.Value.Replace(",", "", StringComparison.Ordinal));

        // ── 3. THE COORDINATE RANGE'S DASH — before the degree rules destroy the adjacency ──
        s = Rewrite(s, COORD_DASH, "$1 sampè' ");

        // ── 4. DEGREES — the scale letters, then the bare sign ──
        s = Rewrite(s, DEG_C, "$1 derajat celcius");
        s = Rewrite(s, DEG_F, "$1 derajat fahrenheit");
        s = Rewrite(s, DEG, "$1 derajat ");

        // ── 5. `±` IS "ABOUT", NOT A TOLERANCE ──
        s = Rewrite(s, PLUS_MINUS, "korang lebbi ");
        s = Rewrite(s, PLUS_MINUS_DOUBLED, "$1");

        // ── 6. ERA MARKERS — SM before M, always ──
        s = Rewrite(s, ERA_SM, "$1 sabellunna Masèhi");
        s = Rewrite(s, ERA_M, "$1 Masèhi");

        // ── 7. THE TWO RATE SHAPES THE SHARED TIER CANNOT REACH — before the tier ──
        s = Rewrite(s, SLASH_RATE, m =>
            $" per {UNIT_WORD[m.Groups[1].Value.ToLowerInvariant()]}{ExpWord(m.Groups[2])}");
        s = Rewrite(s, PER_RATE, m =>
            $"per {UNIT_WORD[m.Groups[1].Value.ToLowerInvariant()]}{ExpWord(m.Groups[2])}");

        // ── 8. THE SHARED TIER — after de-grouping and the degree rules, before the decimal rule ──
        s = SYMBOLS(s);

        // ── 8b. `dpl`, bound to the metre word the tier has just supplied ──
        s = Rewrite(s, DPL, "$1 è attas tasè'");

        // ── 9. RANGES → `sampè'` — last of the rules that own a dash ──
        s = Rewrite(s, RANGE, "$1 sampè' $2");

        // ── 10. DECIMALS → `koma` — last, because every rule above needs its separator intact ──
        s = Rewrite(s, DECIMAL_COMMA, m => Decimal(m.Groups[1].Value, m.Groups[2].Value));
        var full = s;
        s = Rewrite(s, DECIMAL_PERIOD, m =>
            HOUR_TAIL.IsMatch(full[..m.Index]) ? m.Value : Decimal(m.Groups[1].Value, m.Groups[2].Value));

        return s;
    }

    /** TS `EXP_WORD[exp ?? ""] ?? ""` — an unmatched optional group is `undefined`, i.e. the "" key. */
    private static string ExpWord(System.Text.RegularExpressions.Group g) =>
        EXP_WORD.TryGetValue(g.Success ? g.Value : "", out var w) ? w : "";

    /** The fraction is read DIGIT BY DIGIT, emitted as spaced digits for the engine's cardinal path. */
    private static string Decimal(string intPart, string frac) =>
        $"{intPart} {Manifest.MANIFEST.Numbers.DecimalWord} {string.Join(" ", Js.CodePoints(frac))}";
}
