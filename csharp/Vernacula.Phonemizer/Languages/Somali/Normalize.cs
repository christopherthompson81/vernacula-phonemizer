/**
 * Somali (so) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 * Ported from src/languages/somali/normalize.ts — see that file for the corpus evidence behind every arm.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Somali;

public static class Normalize
{
    /** The unit table, named once so the tier and the four local rules in step 3b cannot disagree.
     *  ⚠ INSERTION-ORDERED: the longest-first sorts below are STABLE, so this order decides the ties. */
    private static readonly IReadOnlyDictionary<string, string> UNIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["km"] = "kiiloomitir", ["m"] = "mitir", ["cm"] = "sentimitir",
        ["mm"] = "milimitir", ["ha"] = "hektar", ["mi"] = "mayl",
    };

    private static readonly IReadOnlyDictionary<string, string> EXPONENT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["²"] = "laba jibaaran", ["³"] = "cubo", ["2"] = "laba jibaaran", ["3"] = "cubo",
    };

    /** Any declared key, longest first so `km` cannot be matched as `m`. */
    private static readonly string UNIT_KEYS =
        string.Join("|", UNIT.Keys.OrderByDescending(k => k.Length));

    /** The keys safe to read with NO NUMBER ATTACHED — `IsBareUnitKey`'s test on this language's table. */
    private static readonly string BARE_KEYS =
        string.Join("|", UNIT.Keys.Where(NormalizeSymbols.IsBareUnitKey).OrderByDescending(k => k.Length));

    /** The shared symbol tier — see the TS module for the per-word corpus counts and the `kg` refusal. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "boqolkiiba" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "doolar" },
            ["US$"] = new[] { "doolar Maraykanka" },
            ["€"] = new[] { "yuuro" },
            ["Sh.So."] = new[] { "shilin Soomaali" },
        },
        Magnitudes = new[] { "kun", "malyan", "milyan", "bilyan", "tirilyan" },
        Units = UNIT.ToDictionary(e => e.Key, e => (IReadOnlyList<string>)new[] { e.Value }, StringComparer.Ordinal),
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "laba jibaaran" },
            Cubed = new[] { "cubo" },
        },
        UnitPer = "halkii",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal) { ["s"] = "ilbiriqsi", ["h"] = "saacad" },
        Ampersand = "iyo",
        Multiply = new MultiplyDef { Times = "ku dhufan" },
    });

    /** Compass points for the COORDINATE sense of `°`, keyed lowercase (the rule matches case-insensitively). */
    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["n"] = "waqooyi", ["s"] = "koonfur", ["e"] = "bari", ["w"] = "galbeed",
    };

    private static readonly JsRe GROUP_COMMA = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:,\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe GROUP_PERIOD = JsRegex.Compile("(?<![\\d.,])([1-9]\\d{0,2}(?:\\.\\d{3})+)(?!\\d)", "gu");
    private static readonly JsRe COMMA = JsRegex.Compile(",", "g");
    private static readonly JsRe PERIOD = JsRegex.Compile("\\.", "g");
    private static readonly JsRe GLUED_H = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)H(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe GLUED_M = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)M(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe YEAR_CONTEXT = JsRegex.Compile("[Ss]anad|[Bb]ish|[Qq]arni|Hijri|=", "u");
    // ⚠ `(?!:\d)` and the meridiem alternation are load-bearing — an h:mm followed by `:digit` is a ratio,
    // an h:m:s or an ISO stamp, not a clock; and JS `\b` is ASCII-only so a glued `PM` blocked the match.
    private static readonly JsRe CLOCK = JsRegex.Compile(
        "(?<![\\d.:])([01]?\\d|2[0-3]):([0-5]\\d)(?!:\\d)(?!\\.?\\d)(?:(?=\\s?[AaPp]\\.?[Mm]\\.?)|\\b)", "gu");
    private static readonly JsRe ORDINAL_TAIL = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)(?:st|nd|rd|th)(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe BARE_RATE = JsRegex.Compile(
        $@"(?<=[\d\p{{L}}])\s*/\s*(?=(?:sq |cu )?(?:{UNIT_KEYS})(?:[²³23])?(?![\p{{L}}\p{{M}}\d]))", "gu");
    private static readonly JsRe SPACED_EXPONENT = JsRegex.Compile(
        $@"(?<![\p{{L}}\p{{M}}])({UNIT_KEYS})\s+([23])(?![\d\p{{L}}\p{{M}}])", "gu");
    private static readonly JsRe SQ_CU = JsRegex.Compile(
        $@"(?<![\p{{L}}\p{{M}}])(sq|cu)\s+({UNIT_KEYS})(?![\p{{L}}\p{{M}}\d])", "giu");
    private static readonly JsRe MPH = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d)\\s*mph(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe BARE_UNIT_EXPONENT = JsRegex.Compile(
        $@"(?<![\p{{L}}\p{{M}}\p{{Nd}}'’ʼ-])({BARE_KEYS})([²³23])(?![\p{{L}}\p{{M}}\d])", "gu");
    private static readonly JsRe HYPHEN_UNIT = JsRegex.Compile(
        $@"(\d)-(?=(?:{UNIT_KEYS})(?:[²³23])?(?![\p{{L}}\p{{M}}\d]))", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(\\d)[.,](\\d{1,2})(?![\\d.,])", "gu");
    private static readonly JsRe ERA_CH = JsRegex.Compile("(\\d)\\s*C\\.?\\s?H\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_CD = JsRegex.Compile("(\\d)\\s*C\\.?\\s?D\\.?(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile("(\\d)\\s*(?:BCE|BC)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_CE = JsRegex.Compile("(\\d)\\s*(?:CE|AD)(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe ERA_AH = JsRegex.Compile("(\\d)\\s*AH(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        "(?<!\\b(?:ilaa|dhaxaysay|inta)\\s)(?<![\\d.,\\p{L}-])(\\d+)\\s?[-–]\\s?(\\d+)(?![\\d,-])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\d/])(\\d{1,3})\\/(\\d{1,3})(?![\\d/])", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEW])(?![\\p{L}\\p{M}])", "giu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe PLUS_AFTER = JsRegex.Compile("(\\S)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\(?\\s?[-−]?\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
    public static string NormalizeSomali(string input)
    {
        var s = input;

        // 1. De-group thousands — EXACTLY THREE DIGITS PER GROUP, so `0.53` and `2.5` survive as decimals.
        s = Rewrite(s, GROUP_COMMA, m => COMMA.Replace(m.Value, ""));
        s = Rewrite(s, GROUP_PERIOD, m => PERIOD.Replace(m.Value, ""));

        // 2. The glued calendar letters — BEFORE the tier, which would otherwise strand the `M`.
        s = Rewrite(s, GLUED_H, "$1 Hijri");
        var src = s; // the JS callback's 4th argument: the string as it stands BEFORE this replace
        s = Rewrite(src, GLUED_M, m =>
        {
            var n = m.Groups[1].Value;
            if (n.Length < 3) return $"{n} milyan";
            var off = m.Index;
            return YEAR_CONTEXT.IsMatch(src[Math.Max(0, off - 45)..off]) ? $"{n} Miilaadi" : m.Value;
        });

        // 3. Clock — BEFORE the decimal rule, which would otherwise claim `2:00` and `8:15`.
        s = Rewrite(s, CLOCK, m =>
        {
            var h = Js.NumberToString(Js.Number(m.Groups[1].Value));
            var min = Js.Number(m.Groups[2].Value);
            return min == 0 ? h : $"{h} iyo {Js.NumberToString(min)}";
        });

        // 3b-i. The English ordinal tail → the corpus's own bound `-aad`.
        s = Rewrite(s, ORDINAL_TAIL, "$1aad");
        // 3b-ii. The bare rate — ⚠ FIRST of the four, because every rule below rewrites the text its
        //        lookahead is reading.
        s = Rewrite(s, BARE_RATE, " halkii ");
        // 3b-iii. The exponent written with a space (`91 km 2`) — a MIS-READING, not a leak.
        s = Rewrite(s, SPACED_EXPONENT, "$1$2");
        // 3b-iv. `sq`/`cu` → the measure WORDS, and only before a DECLARED unit. ⚠ BOTH captures are folded:
        //        this is the only arm in step 3b with the `i` flag, and an unfolded unit key missed the table.
        s = Rewrite(s, SQ_CU, m =>
        {
            var mod = m.Groups[1].Value;
            var u = m.Groups[2].Value;
            return $"{UNIT[u.ToLowerInvariant()]} {(mod.ToLowerInvariant() == "sq" ? EXPONENT["2"] : EXPONENT["3"])}";
        });
        // 3b-v. `mph` spelled as the rate it abbreviates.
        s = Rewrite(s, MPH, "$1 mi/h");
        // 3b-vi. A bare unit carrying an exponent — Somali has both measure words, so nothing is stranded.
        s = Rewrite(s, BARE_UNIT_EXPONENT, m => $"{UNIT[m.Groups[1].Value]} {EXPONENT[m.Groups[2].Value]}");
        // 3b-vii. The hyphen-attached unit (`750-km`) — a declared unit key is not a Somali suffix.
        s = Rewrite(s, HYPHEN_UNIT, "$1 ");

        // 4. The shared tier — BEFORE the decimal rule, AFTER de-grouping.
        s = SYMBOLS(s);

        // 5. Decimals → `dhibic`, fractional part digit by digit.
        s = Rewrite(s, DECIMAL, m =>
            $"{m.Groups[1].Value} dhibic {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 6. Era markers. ⚠ LONGEST FIRST, and BCE before BC or the `E` is stranded.
        s = Rewrite(s, ERA_CH, "$1 Ciise Hortiis");
        s = Rewrite(s, ERA_CD, "$1 Ciise Dabadiis");
        s = Rewrite(s, ERA_BC, "$1 Ciise Hortiis");
        s = Rewrite(s, ERA_CE, "$1 Miilaadi");
        s = Rewrite(s, ERA_AH, "$1 Hijri");

        // 7. Ranges → `ilaa`.
        s = Rewrite(s, RANGE, "$1 ilaa $2");

        // 8. Fractions.
        s = Rewrite(s, FRACTION, m =>
        {
            double n = Js.Number(m.Groups[1].Value), d = Js.Number(m.Groups[2].Value);
            if (n == 1 && d == 2) return "nus";
            if (n == 1 && d == 4) return "rubuc";
            return $"{m.Groups[1].Value} {m.Groups[2].Value} meelood";
        });

        // 9. Degrees.
        s = Rewrite(s, DEG_C, "$1 darajo Celsius");
        s = Rewrite(s, DEG_F, "$1 darajo Fahrenheit");
        s = Rewrite(s, DEG_COMPASS, m =>
            // ⚠ REFUSE THE WHOLE MATCH ON AN UNKNOWN DIRECTION (#1122). The pattern carries `i` AND `u`, so
            // JS folds U+017F LONG S onto `s` and `12°ſ` MATCHES `[NSEW]` — while `ſ` is no COMPASS key. The
            // TS asserted non-null and spoke the word "undefined"; the C# indexer THREW.
            COMPASS.TryGetValue(m.Groups[2].Value.ToLowerInvariant(), out var dir)
                ? $"{m.Groups[1].Value} darajo {dir}"
                : m.Value);
        s = Rewrite(s, DEG_BARE, "$1 darajo");

        // 10. Signs. ⚠ PLUS BEFORE MINUS, or the minus arm claims the bracketed operand of `5 + (−3)`.
        s = Rewrite(s, PLUS_AFTER, "$1 ku dar $2");
        s = Rewrite(s, PLUS_LEADING, "$1ku dar $2");
        s = Rewrite(s, MINUS, "$1laga jaray $2");
        s = Rewrite(s, PLUS_MINUS, " ku dar ama laga jaray ");
        s = Rewrite(s, EQUALS, " u dhiganta ");
        s = Rewrite(s, LESS_THAN, " ka yar ");
        s = Rewrite(s, GREATER_THAN, " ka badan ");
        s = Rewrite(s, DIVIDE, " loo qeybiyay ");

        return s;
    }
}
