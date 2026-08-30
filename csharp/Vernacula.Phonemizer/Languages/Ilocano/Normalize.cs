/**
 * Ilocano (ilo) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/ilocano/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Ilocano;

public static class Normalize
{
    /** The shared symbol tier. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "porsiento" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "doliar ti Estados Unidos" },
            ["$"] = new[] { "doliar" },
            ["€"] = new[] { "euro" },
            ["₱"] = new[] { "pisos" },
            ["£"] = new[] { "libra esterlina" },
        },
        Magnitudes = new[] { "ribo", "riwriw", "milion", "bilion", "trilion" },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometro" },
            ["m"] = new[] { "metro" },
            ["cm"] = new[] { "sentimetro" },
            ["mm"] = new[] { "milimetro" },
            ["kg"] = new[] { "kilogramo" },
            ["mi"] = new[] { "milia" },
            ["ml"] = new[] { "mililitro" },
            ["ft"] = new[] { "pie" },
            // ⚠ `mph` IS ITS OWN KEY, NOT THE COMPOSITION OF ITS PARTS — trap 44. There is no `p` denominator
            // to compose through, so without this the whole abbreviation reaches the IPA raw (`560 mph` → *mph*).
            ["mph"] = new[] { "milia kada oras" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kuadrado" },
            Cubed = new[] { "kubiko" },
            // ⚠ THE MEASURE WORD GOES BEFORE ITS NOUN — where ceb and hil are wrong for Ilocano.
            Position = ExponentPosition.Before,
        },
        UnitPer = "kada",
        RateDenominators = new Dictionary<string, string>
        {
            ["h"] = "oras",
            // `s` IS A RATE DENOMINATOR ONLY, never standalone (the Dutch `Il-76s` lesson).
            ["s"] = "segundo",
        },
        Ampersand = "ken",
    });

    /** A UNIT IN THE `per` SLOT HAS NO NUMBER BESIDE IT, so the shared tier cannot reach it — local is right
     *  when the tier CANNOT say it. */
    private static readonly IReadOnlyDictionary<string, string> PER_UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km²"] = "kuadrado kilometro", ["m²"] = "kuadrado metro", ["km"] = "kilometro", ["m"] = "metro",
    };
    private static readonly string PER_UNIT_ALT = string.Join("|", PER_UNIT.Keys.OrderByDescending(k => k.Length));

    /** Dotted abbreviations, and the list is SHORT ON PURPOSE — keyed on a closed list, never on the shape. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["blng"] = "Bilang", ["dr"] = "Doktor", ["jr"] = "Junior", ["sr"] = "Senior", ["st"] = "Santo",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe DE_GROUP = JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2}(?:,\d{3})+)(?!\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "gu");
    // ⚠ U+2212 ONLY — the ASCII hyphen stays refused; the lookbehind pair keeps it off `UTC−08:00` and the
    // space-separated negative exponent.
    private static readonly JsRe MINUS = JsRegex.Compile(@"(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)\u2212(?=\p{Nd})", "gu");
    // THE GUARD IS THE RULE: a bare `\d{1,2}:\d{2}` is mostly UTC offsets, scripture references and ratios,
    // so each arm is measured and the leading-sign guard keeps arm (a) off the offsets.
    private const string HOUR = @"(?<![\d.:+\-\u2212])([01]?\d|2[0-3]):([0-5]\d)(?!\d)";
    private static readonly JsRe CLOCK_AMPM = JsRegex.Compile(HOUR + @"(?=\s*(?:[ap]\.?\s?m\.?(?![\p{L}])|GMT|UTC))", "giu");
    private static readonly JsRe CLOCK_PART_OF_DAY = JsRegex.Compile(
        HOUR + @"(?=\s*(?:ti|iti)\s+(?:agsapa|bigat|malem|rabii|sardam|aldaw))", "giu");
    private static readonly JsRe CLOCK_ORAS = JsRegex.Compile(@"(?<=oras\s+(?:a|ti|nga)\s+)" + HOUR, "giu");
    // ⚠ THE `Nh NNm NNs` TIME COORDINATE — BEFORE the tier, and it exists to disarm bare `m`'s false positive.
    private static readonly JsRe TIME_COORD = JsRegex.Compile(
        @"(?<![\p{L}\p{M}\p{Nd}])(\d{1,2})\s?h\s?(\d{1,2})\s?m(?:\s?(\d{1,2}(?:\.\d+)?)\s?s)?(?![\p{L}\p{M}\p{Nd}])", "gu");
    private static readonly JsRe PER_SLOT = JsRegex.Compile(
        @"(?<=tunggal\s(?:maysa\s(?:a|nga)\s)?)(" + PER_UNIT_ALT + @")(?![\p{L}\p{M}\u00B2\u00B3])", "gu");
    // ⚠ THE OPERANDS ACCEPT A DECIMAL, WHICH IS WHY THIS RUNS ABOVE THE DECIMAL RULE.
    private static readonly JsRe RANGE = JsRegex.Compile(
        @"(?<!\b(?:aginggana|agingga|inggana|manipud|manipud iti|manipud idi)\s(?:iti\s|ti\s)?)(?<![\d.,\p{L}-])(\d[\d,]*(?:\.\d+)?)\s?[-–]\s?(\d[\d,]*(?:\.\d+)?)(?![\d,-]|\.\d)",
        "gu");
    // ⚠ ONE OR TWO FRACTIONAL DIGITS ONLY — the two-digit cap is what makes the rule unable to eat a
    // period-thousands group, and this corpus has none.
    private static readonly JsRe DECIMAL = JsRegex.Compile(@"(\d)\.(\d{1,2})(?![\d.,])", "gu");
    private static readonly JsRe DEGREE_C = JsRegex.Compile(@"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui");
    private static readonly JsRe DEGREE_F = JsRegex.Compile(@"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui");
    private static readonly JsRe DEGREE_BARE = JsRegex.Compile(@"(\d)\s?°", "gu");
    private static readonly JsRe ABBREV = JsRegex.Compile(@"(?<![\p{L}\p{M}])(" + ABBREV_ALT + @")\.", "giu");
    // ⚠ A FOLLOWING DIGIT IS REQUIRED, and that is what separates `c.` from a personal INITIAL.
    private static readonly JsRe CIRCA = JsRegex.Compile(@"(?<![\p{L}\p{M}.])c(?:a)?\.\s*(?=\d)", "giu");

    /** The clock reading: on the hour the minutes drop out, else they join with the manifest's own connector. */
    private static string Clock(string h, string min) =>
        Js.Number(min) == 0
            ? Js.NumberToString(Js.Number(h))
            : $"{Js.NumberToString(Js.Number(h))} ket {Js.NumberToString(Js.Number(min))}";

    /** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
    public static string NormalizeIlocano(string input)
    {
        var s = input;

        // ── 1. DE-GROUP THOUSANDS — FIRST, and the biggest defect this layer repairs ─────────────────────────
        s = Rewrite(s, DE_GROUP, m => COMMAS.Replace(m.Value, ""));

        // ── 1b. THE MINUS — U+2212 ONLY, and the character's identity is the argument ────────────────────────
        s = Rewrite(s, MINUS, "negatibo ");

        // ── 2. CLOCK — BEFORE the tier and before the decimal rule ───────────────────────────────────────────
        s = Rewrite(s, CLOCK_AMPM, m => Clock(m.Groups[1].Value, m.Groups[2].Value));
        s = Rewrite(s, CLOCK_PART_OF_DAY, m => Clock(m.Groups[1].Value, m.Groups[2].Value));
        s = Rewrite(s, CLOCK_ORAS, m => Clock(m.Groups[1].Value, m.Groups[2].Value));

        // ── 2b. THE `Nh NNm NNs` TIME COORDINATE — BEFORE the tier ───────────────────────────────────────────
        s = Rewrite(s, TIME_COORD, m =>
        {
            var h = m.Groups[1].Value;
            var min = m.Groups[2].Value;
            var sec = m.Groups[3];
            return sec.Success ? $"{h} oras {min} minuto {sec.Value} segundo" : $"{h} oras {min} minuto";
        });

        // ── 3. THE SHARED TIER — percent, currency, units, the measure words, rates, `&` ─────────────────────
        // ⚠ AFTER DE-GROUPING, or `676,578 km²` is seen as `578 km²`. ⚠ BEFORE THE DECIMAL RULE — the tier
        // matches a unit only when a NUMBER is adjacent, and rewriting `3.79` destroys that adjacency.
        // ⚠ THE PER-SLOT UNIT MUST BE SPENT BEFORE THE TIER RUNS: the density template contains a number.
        s = Rewrite(s, PER_SLOT, m => PER_UNIT[m.Groups[1].Value]);
        s = SYMBOLS(s);

        // ── 4. RANGES → `aginggana iti` — BEFORE the decimal rule ────────────────────────────────────────────
        s = Rewrite(s, RANGE, "$1 aginggana iti $2");

        // ── 5. DECIMALS → `punto` ────────────────────────────────────────────────────────────────────────────
        s = Rewrite(s, DECIMAL, m =>
            $"{m.Groups[1].Value} punto {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // ── 6. DEGREES → `grado`, with the two scale names ───────────────────────────────────────────────────
        s = Rewrite(s, DEGREE_C, "$1 grado Celsius");
        s = Rewrite(s, DEGREE_F, "$1 grado Fahrenheit");
        s = Rewrite(s, DEGREE_BARE, "$1 grado ");

        // ── 7. DOTTED ABBREVIATIONS — closed list ────────────────────────────────────────────────────────────
        s = Rewrite(s, ABBREV, m =>
        {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own keys but
            // carries `i`+`u`, so JS's fold widens it and a near-miss (`ſr.`) matches while its key is
            // absent — the match falls through unchanged rather than stringifying `undefined`.
            return DOTTED_ABBREV.TryGetValue(Js.ToLowerCase(m.Groups[1].Value), out var w) ? w : m.Value;
        });

        // ── 8. `c.` / `ca.` BEFORE A YEAR → `agarup a` ───────────────────────────────────────────────────────
        s = Rewrite(s, CIRCA, "agarup a ");

        return s;
    }
}
